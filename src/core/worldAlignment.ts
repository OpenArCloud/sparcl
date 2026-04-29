/*
  (c) 2026 Open AR Cloud / contributors
  SPDX-License-Identifier: MIT

  World alignment kinematics (arbitrary anchor **FrameRef** + **T_scene_from_ref**): WGS84/ENU GeoPose path
  and optional matrix-only / local-frame path. No OGL / WebGL.
  Conventions: docs/workingwithcode/poseconversions.md
*/

import { mat4, quat, vec3, type ReadonlyMat4 } from 'gl-matrix';
import type { Geopose } from '@oarc/scd-access';
import {
    convertAugmentedCityCam2WebQuat,
    convertAugmentedCityCam2WebVec3,
    convertEnuToGeodetic,
    convertGeo2WebQuat,
    convertGeo2WebVec3,
    convertGeodeticToEnu,
    convertWeb2GeoQuat,
    convertWeb2GeoVec3,
    getRelativeGlobalPosition,
    getRelativeOrientation,
} from '@core/locationTools';

import { type FrameRef, normalizeColumnMajorMat4, OSCP_WGS84_ENU_FRAME_REF } from '@core/frameTransforms';

export type Vec3Like = { x: number; y: number; z: number };
export type QuatLike = { x: number; y: number; z: number; w: number };

/** Position + unit quaternion in a Cartesian frame (WebXR scene, ENU tangent offset, etc.). */
export type RigidPose = {
    position: Vec3Like;
    orientation: QuatLike;
};

/** WebXR / capture pose at localization (plain numbers, no OGL types). */
export type WebXrRigidPose = RigidPose;

/** GeoPose expressed in a local ENU tangent plane at `refGeoPose` (meters east / north / up, quaternion unchanged from GeoPose / ENU). */
export type EnuRigidPose = RigidPose;

export type GeoAlignmentKinematics = {
    /** T_scene_from_ref — maps reference (ENU-at-anchor) into WebXR scene. */
    tSceneFromRef: mat4;
    /** T_ref_from_scene — inverse of `tSceneFromRef`. */
    tRefFromScene: mat4;
    /** Anchor geopose at capture (localization reference). */
    anchorGeopose: Geopose;
    /** Reference frame for the anchor pose. */
    referenceFrameRef: FrameRef;
};

export type ActiveWorldAlignmentMatrices = {
    tSceneFromRef: ReadonlyMat4;
    tRefFromScene: ReadonlyMat4;
};

/**
 * Set alignment from precomputed **T_scene_from_ref** (and optional inverse), e.g. after **rigidPoseInFrame** + XR
 * capture fusion or transform-graph composition. For GeoPose ↔ scene conversions you still need
 * {@link OSCP_WGS84_ENU_FRAME_REF} and {@link SetWorldAlignmentFromMatricesParams.anchorGeopose}.
 */
export type SetWorldAlignmentFromMatricesParams = {
    tSceneFromRef: ReadonlyMat4 | Float32Array | readonly number[];
    /** If omitted, computed as {@link mat4.invert}(`tSceneFromRef`). */
    tRefFromScene?: ReadonlyMat4 | Float32Array | readonly number[];
    referenceFrameRef: FrameRef;
    /**
     * Anchor geodetic pose when using global GeoPose semantics (**OSCP:WGS84-ENU** ref).
     * Omit or `null` for purely local / Euclidean anchors (scene ↔ GeoPose helpers will throw until supplied).
     */
    anchorGeopose?: Geopose | null;
};

type ActiveWorldAlignmentState = {
    tSceneFromRef: mat4;
    tRefFromScene: mat4;
    referenceFrameRef: FrameRef;
    /** Present when coarse global pose exists for ENU / H3 / legacy conversion paths. */
    anchorGeopose: Geopose | null;
};

let _activeWorldAlignment: ActiveWorldAlignmentState | null = null;

function isOscpWgs84Enu(ref: FrameRef): boolean {
    return ref.uuid === OSCP_WGS84_ENU_FRAME_REF.uuid && ref.fqn === OSCP_WGS84_ENU_FRAME_REF.fqn;
}

function cloneFrameRef(r: FrameRef): FrameRef {
    return { uuid: r.uuid, fqn: r.fqn };
}

function cloneMatLike(m: ReadonlyMat4 | Float32Array | readonly number[]): mat4 {
    if (Array.isArray(m) || m instanceof Float32Array) {
        return normalizeColumnMajorMat4(m);
    }
    return mat4.clone(m);
}

function mat4FromRigidPose(pose: RigidPose): mat4 {
    const q = quat.fromValues(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w);
    const tr = vec3.fromValues(pose.position.x, pose.position.y, pose.position.z);
    const m = mat4.create();
    mat4.fromRotationTranslation(m, q, tr);
    return m;
}

function cloneGeopose(g: Geopose): Geopose {
    return {
        position: { lat: g.position.lat, lon: g.position.lon, h: g.position.h },
        quaternion: { x: g.quaternion.x, y: g.quaternion.y, z: g.quaternion.z, w: g.quaternion.w },
    };
}

function requireActiveWorldAlignment(): ActiveWorldAlignmentState {
    if (_activeWorldAlignment === null) {
        throw new Error('No active world alignment. Call setActiveGeoAlignmentFromCapture or setActiveWorldAlignmentFromMatrices after localization.');
    }
    return _activeWorldAlignment;
}

/**
 * Computes alignment from the capture pair and stores it for {@link convertGeoPoseToLocalPose} and related helpers.
 * Anchor frame is **OSCP:WGS84-ENU** with a full **anchorGeopose**.
 */
export function setActiveGeoAlignmentFromCapture(localCapture: WebXrRigidPose, globalCapture: Geopose): ActiveWorldAlignmentMatrices {
    const kin = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
    _activeWorldAlignment = {
        tSceneFromRef: mat4.clone(kin.tSceneFromRef),
        tRefFromScene: mat4.clone(kin.tRefFromScene),
        referenceFrameRef: cloneFrameRef(kin.referenceFrameRef),
        anchorGeopose: cloneGeopose(kin.anchorGeopose),
    };
    return {
        tSceneFromRef: _activeWorldAlignment.tSceneFromRef,
        tRefFromScene: _activeWorldAlignment.tRefFromScene,
    };
}

/**
 * Stores alignment from explicit **T_scene_from_ref** / **T_ref_from_scene** (see poseconversions.md).
 * Use for non-geodetic anchors once **referenceFrameRef** and matrices are known (e.g. VPS **rigidPoseInFrame** path).
 */
export function setActiveWorldAlignmentFromMatrices(params: SetWorldAlignmentFromMatricesParams): ActiveWorldAlignmentMatrices {
    const tSceneFromRef = cloneMatLike(params.tSceneFromRef);
    let tRefFromScene: mat4;
    if (params.tRefFromScene !== undefined) {
        tRefFromScene = cloneMatLike(params.tRefFromScene);
    } else {
        tRefFromScene = mat4.create();
        if (!mat4.invert(tRefFromScene, tSceneFromRef)) {
            throw new Error('setActiveWorldAlignmentFromMatrices: singular tSceneFromRef');
        }
    }
    const prod = mat4.create();
    mat4.multiply(prod, tSceneFromRef, tRefFromScene);
    const identityCheck = mat4.create();
    mat4.identity(identityCheck);
    let maxErr = 0;
    for (let i = 0; i < 16; i++) {
        maxErr = Math.max(maxErr, Math.abs(prod[i]! - identityCheck[i]!));
    }
    if (maxErr > 1e-4) {
        throw new Error('setActiveWorldAlignmentFromMatrices: tSceneFromRef and tRefFromScene are not mutual inverses');
    }

    const anchorGeopose =
        params.anchorGeopose === undefined ? null : params.anchorGeopose === null ? null : cloneGeopose(params.anchorGeopose);

    _activeWorldAlignment = {
        tSceneFromRef,
        tRefFromScene,
        referenceFrameRef: cloneFrameRef(params.referenceFrameRef),
        anchorGeopose,
    };
    return {
        tSceneFromRef: _activeWorldAlignment.tSceneFromRef,
        tRefFromScene: _activeWorldAlignment.tRefFromScene,
    };
}

/** Clears session alignment (e.g. when the XR session ends or before applying new alignment). */
export function clearActiveGeoAlignment(): void {
    _activeWorldAlignment = null;
}

/** True after a successful localization until {@link clearActiveGeoAlignment}. */
export function hasActiveWorldAlignment(): boolean {
    return _activeWorldAlignment !== null;
}

/** Active anchor **FrameRef**, or `null` if no alignment. */
export function getActiveReferenceFrameRef(): FrameRef | null {
    return _activeWorldAlignment === null ? null : cloneFrameRef(_activeWorldAlignment.referenceFrameRef);
}

/** Anchor geodetic pose when present (global GeoPose path); otherwise `null`. */
export function getActiveAnchorGeopose(): Geopose | null {
    if (_activeWorldAlignment === null || _activeWorldAlignment.anchorGeopose === null) {
        return null;
    }
    return cloneGeopose(_activeWorldAlignment.anchorGeopose);
}

/** Re-export for callers that store anchor metadata alongside alignment. */
export type { FrameRef } from '@core/frameTransforms';

// TODO: add FromActive in the name
// TODO convertGeoPoseToSceneRigidPose reorder parameters to objectGeopose, tSceneFromRef, anchorGeopose
export function convertGeoPoseToLocalPose(objectGeopose: Geopose): RigidPose {
    const a = requireActiveWorldAlignment();
    if (!isOscpWgs84Enu(a.referenceFrameRef) || a.anchorGeopose === null) {
        throw new Error(
            'convertGeoPoseToLocalPose requires an OSCP:WGS84-ENU anchor with anchorGeopose. For other frames, use convertRigidPoseInAnchorFrameToSceneRigidPose or graph composition.',
        );
    }
    return convertGeoPoseToSceneRigidPose(a.anchorGeopose, objectGeopose, a.tSceneFromRef);
}

export function convertScenePoseToGeoposeFromActive(position: Vec3Like, quaternion: QuatLike): Geopose {
    const a = requireActiveWorldAlignment();
    if (a.anchorGeopose === null) {
        throw new Error(
            'convertScenePoseToGeoposeFromActive requires anchorGeopose (coarse global pose). Unavailable for purely local anchors.',
        );
    }
    return convertScenePoseToGeopose(position, quaternion, a.tRefFromScene, a.anchorGeopose);
}

export function convertCameraWebXrPoseToGeoposeFromActive(position: Vec3Like, quaternion: QuatLike): Geopose {
    const a = requireActiveWorldAlignment();
    if (a.anchorGeopose === null) {
        throw new Error(
            'convertCameraWebXrPoseToGeoposeFromActive requires anchorGeopose (coarse global pose). Unavailable for purely local anchors.',
        );
    }
    return convertCameraWebXrPoseToGeopose(position, quaternion, a.tRefFromScene, a.anchorGeopose);
}

/**
 * Maps a **RigidPose** expressed in the active anchor reference frame into WebXR scene **RigidPose**
 * (**T_scene_from_ref * T_ref_from_body**).
 */
export function convertRigidPoseInAnchorFrameToSceneRigidPose(poseInRef: RigidPose): RigidPose {
    const a = requireActiveWorldAlignment();
    const mRefObj = mat4FromRigidPose(poseInRef);
    const mScene = mat4.create();
    mat4.multiply(mScene, a.tSceneFromRef, mRefObj);
    const tr = vec3.create();
    mat4.getTranslation(tr, mScene);
    const qr = quat.create();
    mat4.getRotation(qr, mScene);
    return {
        position: { x: tr[0], y: tr[1], z: tr[2] },
        orientation: { x: qr[0], y: qr[1], z: qr[2], w: qr[3] },
    };
}

/**
 * Computes rigid alignment from WebXR camera pose at capture and global GeoPose at the same instant.
 * Prefer {@link setActiveGeoAlignmentFromCapture} at localization time so session helpers stay in sync.
 */
export function computeGeoAlignmentFromPosePair(
    localCapture: WebXrRigidPose,
    globalCapture: Geopose,
): GeoAlignmentKinematics {
    const localImageOrientation = quat.fromValues(
        localCapture.orientation.x,
        localCapture.orientation.y,
        localCapture.orientation.z,
        localCapture.orientation.w,
    );
    const globalImageOrientation = quat.fromValues(
        globalCapture.quaternion.x,
        globalCapture.quaternion.y,
        globalCapture.quaternion.z,
        globalCapture.quaternion.w,
    );
    const geoCamOrientation = convertAugmentedCityCam2WebQuat(globalImageOrientation);

    const deltaRotAr2Geo = getRelativeOrientation(localImageOrientation, geoCamOrientation);
    const deltaRotGeo2Ar = quat.create();
    quat.invert(deltaRotGeo2Ar, deltaRotAr2Geo);

    const tSceneFromRef = mat4.create();
    mat4.fromRotationTranslation(
        tSceneFromRef,
        deltaRotGeo2Ar,
        vec3.fromValues(localCapture.position.x, localCapture.position.y, localCapture.position.z),
    );

    const tRefFromScene = mat4.create();
    if (!mat4.invert(tRefFromScene, tSceneFromRef)) {
        throw new Error('computeGeoAlignmentFromPosePair: singular alignment matrix');
    }

    return {
        tSceneFromRef,
        tRefFromScene,
        anchorGeopose: globalCapture,
        referenceFrameRef: OSCP_WGS84_ENU_FRAME_REF,
    };
}

/**
 * Rigid transform of an object's GeoPose **relative to the anchor** (ENU offset → WebXR axes + ENU quat → WebXR quat).
 * This is **T_ref_from_object** when the object frame is identity at the object origin.
 */
export function mat4ObjectInRefFromGeoPose(anchorGeopose: Geopose, objectGeopose: Geopose): mat4 {
    const enuPosition = getRelativeGlobalPosition(anchorGeopose, objectGeopose);
    const webxrEnuPosition = convertGeo2WebVec3(enuPosition);
    const enuQuaternion = [objectGeopose.quaternion.x, objectGeopose.quaternion.y, objectGeopose.quaternion.z, objectGeopose.quaternion.w] as const;
    const webxrEnuQuaternion = convertGeo2WebQuat(enuQuaternion);
    const m = mat4.create();
    mat4.fromRotationTranslation(m, webxrEnuQuaternion, vec3.fromValues(webxrEnuPosition[0], webxrEnuPosition[1], webxrEnuPosition[2]));
    return m;
}

/** T_scene_from_object = T_scene_from_ref * T_ref_from_object */
export function mat4SceneFromGeoPose(anchorGeopose: Geopose, objectGeopose: Geopose, tSceneFromRef: ReadonlyMat4): mat4 {
    const tRefObj = mat4ObjectInRefFromGeoPose(anchorGeopose, objectGeopose);
    const out = mat4.create();
    mat4.multiply(out, tSceneFromRef, tRefObj);
    return out;
}

/** `T_scene_world = T_scene_from_ref * M_in_ref`. */
export function mat4ComposeSceneFromRefLocal(tSceneFromRef: ReadonlyMat4, mInRef: ReadonlyMat4): mat4 {
    const out = mat4.create();
    mat4.multiply(out, tSceneFromRef, mInRef);
    return out;
}

/** Same scale as legacy `createAxesBoxPlaceholder` debug nodes under the alignment root. */
const DEBUG_AXIS_PLACEHOLDER_SCALE: [number, number, number] = [0.02, 0.04, 0.06];

/** WebXR world matrix for the "AR camera at localization" debug axes. */
export function mat4LocalizationDebugArCamera(localCapture: WebXrRigidPose): mat4 {
    const webxrPos = vec3.fromValues(localCapture.position.x, localCapture.position.y, localCapture.position.z);    
    // tiny offset so that we can see both the yellow and the cyan when the alignment is correct
    vec3.add(webxrPos, webxrPos, vec3.fromValues(0.001, 0.001, 0.001)); // small offset to avoid z-fighting
    const webxrQuat = quat.fromValues(localCapture.orientation.x, localCapture.orientation.y, localCapture.orientation.z, localCapture.orientation.w);
    const webxrScale = vec3.fromValues(0.02, 0.04, 0.06);
    const out = mat4.create();
    mat4.fromRotationTranslationScale(
        out,
        webxrQuat,
        webxrPos,
        webxrScale,
    );
    return out;
}

/** WebXR world matrix for the "global GeoPose camera at the localization" debug axes (legacy child of **T_scene_from_ref**). */
export function mat4LocalizationDebugGeoCamera(anchorGeopose: Geopose, tSceneFromRef: ReadonlyMat4): mat4 {
    const enuDelta = getRelativeGlobalPosition(anchorGeopose, anchorGeopose); // [0,0,0] vector
    const webxrPos = convertAugmentedCityCam2WebVec3(enuDelta); // convert from AC to WebXR // [0,0,0] vector
    const qGlob = quat.fromValues(
        anchorGeopose.quaternion.x,
        anchorGeopose.quaternion.y,
        anchorGeopose.quaternion.z,
        anchorGeopose.quaternion.w,
    );
    const qRef = convertAugmentedCityCam2WebQuat(qGlob); // convert from AC to WebXR
    const mRef = mat4.create();
    mat4.fromRotationTranslationScale(mRef, qRef, webxrPos, DEBUG_AXIS_PLACEHOLDER_SCALE);
    return mat4ComposeSceneFromRefLocal(tSceneFromRef, mRef);
}

/**
 * WebXR world matrix for the **ENU tangent triad** at the anchor
 * Orientation in the reference frame is **not** raw WebXR identity: it is ENU identity
 * Position is the anchor offset in ref (zero when object equals anchor).
 * The resulting matrix is still left-multiplied by **`T_scene_from_ref`**, so the triad is placed
 * at the capture position and includes VPS↔WebXR alignment.
 */
export function mat4LocalizationDebugEnuAxes(anchorGeopose: Geopose, tSceneFromRef: ReadonlyMat4): mat4 {
    // Hamilton unit quaternion (x, y, z, w) = (0, 0, 0, 1)
    // The body / object frame is aligned with the local tangent **East, North, Up** axes at the reference geodetic point.
    // This is the same numeric identity as “no rotation” in that frame
    // Map into WebXR with {@link convertGeo2WebQuat}
    const enuOrientation = [0, 0, 0, 1]; // ENU identity quaternion
    const webxrOrientation = convertGeo2WebQuat(enuOrientation); // [0,0,0,1] webxr identity quaternion
    
    const enuPositionDelta = getRelativeGlobalPosition(anchorGeopose, anchorGeopose); // [0,0,0] vector
    const webxrPosition = convertGeo2WebVec3(enuPositionDelta); // [0,0,0] vector
    
    const mRef = mat4.create();
    mat4.fromRotationTranslationScale(mRef, webxrOrientation, webxrPosition, DEBUG_AXIS_PLACEHOLDER_SCALE);
    return mat4ComposeSceneFromRefLocal(tSceneFromRef, mRef);
}

/** Decomposed WebXR scene pose for a GeoPose under geopose alignment (same as **T_scene_from_ref * T_ref_from_object**). */
export function convertGeoPoseToSceneRigidPose(anchorGeopose: Geopose, objectGeopose: Geopose, tSceneFromRef: ReadonlyMat4): RigidPose {
    const m = mat4SceneFromGeoPose(anchorGeopose, objectGeopose, tSceneFromRef);
    const tr = vec3.create();
    mat4.getTranslation(tr, m);
    const qr = quat.create();
    mat4.getRotation(qr, m);
    return {
        position: { x: tr[0], y: tr[1], z: tr[2] },
        orientation: { x: qr[0], y: qr[1], z: qr[2], w: qr[3] },
    };
}

/**
 * Converts a local pose to an ENU pose using the local to ENU transformation matrix.
 * @param localPose - The local pose to convert.
 * @param T_local_to_enu - The local to ENU transformation matrix.
 * @returns The ENU pose.
 */
export function convertLocalPoseToEnu(localPose: ReadonlyMat4, T_local_to_enu: ReadonlyMat4) {
    const enuPose = mat4.create();
    mat4.multiply(enuPose, T_local_to_enu, localPose);
    return enuPose;
}

/**
 * Converts a local pose to a GeoPose using the local to ENU transformation matrix and the anchor geopose.
 * @param localPose - The local pose to convert.
 * @param T_local_to_enu - The local to ENU transformation matrix.
 * @param anchorGeopose - The anchor geopose.
 * @returns The GeoPose.
 */
export function convertLocalPoseToGeoPose(localPose: ReadonlyMat4, T_local_to_enu: ReadonlyMat4, anchorGeopose: Geopose): Geopose {
    const enuPose:mat4 = convertLocalPoseToEnu(localPose, T_local_to_enu);
    const enuPosition = vec3.create();
    mat4.getTranslation(enuPosition, enuPose);
    const enuQuaternion = quat.create();
    mat4.getRotation(enuQuaternion, enuPose);

    const dE = enuPosition[0];
    const dN = enuPosition[1];
    const dU = enuPosition[2];
    const lat_ref = anchorGeopose.position.lat;
    const lon_ref = anchorGeopose.position.lon;
    const h_ref = anchorGeopose.position.h;
    const geodetic = convertEnuToGeodetic(dE, dN, dU, lat_ref, lon_ref, h_ref);

    const geoPose = {
        position: {
            lat: geodetic.lat,
            lon: geodetic.lon,
            h: geodetic.h,
        },
        quaternion: {
            x: enuQuaternion[0],
            y: enuQuaternion[1],
            z: enuQuaternion[2],
            w: enuQuaternion[3],
        },
    };
    return geoPose;
}
// TODO(soeroesg): this is almost the same as convertLocalPoseToGeoPose, merge them
// The only difference is that the above has no Web2Geo conversion. Why?

/**
 * WebXR scene rigid pose → OSCP:WGS84-ENU GeoPose using the anchor and **T_ref_from_scene**
 * (`T_ref_from_scene * T_scene_from_object` in the reference frame).
 */
export function convertScenePoseToGeopose(position: Vec3Like, quaternion: QuatLike, tRefFromScene: ReadonlyMat4, anchorGeopose: Geopose): Geopose {
    const tSceneObj = mat4.create();
    mat4.fromRotationTranslation(
        tSceneObj,
        quat.fromValues(quaternion.x, quaternion.y, quaternion.z, quaternion.w),
        vec3.fromValues(position.x, position.y, position.z),
    );
    const mRefObj = mat4.create();
    mat4.multiply(mRefObj, tRefFromScene, tSceneObj);

    const tr = vec3.create();
    mat4.getTranslation(tr, mRefObj);
    const qr = quat.create();
    mat4.getRotation(qr, mRefObj);

    const enuPosition = convertWeb2GeoVec3(tr);
    const geodetic = convertEnuToGeodetic(enuPosition[0], enuPosition[1], enuPosition[2], anchorGeopose.position.lat, anchorGeopose.position.lon, anchorGeopose.position.h);
    const enuQuaternion = convertWeb2GeoQuat(qr);

    return {
        position: {
            lat: geodetic.lat,
            lon: geodetic.lon,
            h: geodetic.h,
        },
        quaternion: {
            x: enuQuaternion[0],
            y: enuQuaternion[1],
            z: enuQuaternion[2],
            w: enuQuaternion[3],
        },
    };
}

/**
 * WebXR **camera** local pose → GeoPose camera orientation (identity looks East): applies +π/2 about scene **+Y**, then {@link convertScenePoseToGeopose}.
 * Matches legacy `ogl.convertCameraLocalPoseToGeoPose` (OGL `Quat.multiply(camera, y90)`).
 */
export function convertCameraWebXrPoseToGeopose(
    position: Vec3Like,
    quaternion: QuatLike,
    tRefFromScene: ReadonlyMat4,
    anchorGeopose: Geopose,
): Geopose {
    const qCam = quat.fromValues(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    const qCorr = quat.create();
    quat.setAxisAngle(qCorr, [0, 1, 0], Math.PI / 2);
    const qAdj = quat.create();
    quat.multiply(qAdj, qCam, qCorr);
    return convertScenePoseToGeopose(position, { x: qAdj[0], y: qAdj[1], z: qAdj[2], w: qAdj[3] }, tRefFromScene, anchorGeopose);
}

/**
 * GeoPose in WGS-84 → ENU offset frame at `refGeoPose` (tangent plane meters + same ENU quaternion as `geoPose`).
 * Pure counterpart to legacy `ogl.geoPose_to_ENU` (which wrapped the result in an OGL `Transform`).
 */
export function geoPoseToEnuPose(geoPose: Geopose, refGeoPose: Geopose): EnuRigidPose {
    const enuPosition = convertGeodeticToEnu(
        geoPose.position.lat,
        geoPose.position.lon,
        geoPose.position.h,
        refGeoPose.position.lat,
        refGeoPose.position.lon,
        refGeoPose.position.h,
    );
    return {
        position: { x: enuPosition.x, y: enuPosition.y, z: enuPosition.z },
        orientation: {
            x: geoPose.quaternion.x,
            y: geoPose.quaternion.y,
            z: geoPose.quaternion.z,
            w: geoPose.quaternion.w,
        },
    };
}