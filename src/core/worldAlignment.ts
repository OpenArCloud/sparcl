/*
  (c) 2026 Open AR Cloud / contributors
  SPDX-License-Identifier: MIT

  World / GeoPose (OSCP:WGS84-ENU) alignment kinematics: no OGL / WebGL.
  Conventions: docs/workingwithcode/poseconversions.md
*/

import { mat4, quat, vec3, type ReadonlyMat4, type ReadonlyQuat } from 'gl-matrix';
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

import { OSCP_WGS84_ENU_FRAME_REF } from '@core/frameTransforms';

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
    referenceFrameRef: typeof OSCP_WGS84_ENU_FRAME_REF;
};

export type ActiveWorldAlignmentMatrices = {
    tSceneFromRef: ReadonlyMat4;
    tRefFromScene: ReadonlyMat4;
};

type ActiveGeoAlignmentState = {
    tSceneFromRef: mat4;
    tRefFromScene: mat4;
    anchorGeopose: Geopose;
};

let _activeGeoAlignment: ActiveGeoAlignmentState | null = null;

function cloneGeopose(g: Geopose): Geopose {
    return {
        position: { lat: g.position.lat, lon: g.position.lon, h: g.position.h },
        quaternion: { x: g.quaternion.x, y: g.quaternion.y, z: g.quaternion.z, w: g.quaternion.w },
    };
}

function requireActiveGeoAlignment(): ActiveGeoAlignmentState {
    if (_activeGeoAlignment === null) {
        throw new Error('No active GeoPose alignment. Call setActiveGeoAlignmentFromCapture after localization.');
    }
    return _activeGeoAlignment;
}

/**
 * Computes alignment from the capture pair and stores it for {@link convertGeoPoseToLocalPose} and related helpers.
 */
export function setActiveGeoAlignmentFromCapture(localCapture: WebXrRigidPose, globalCapture: Geopose): ActiveWorldAlignmentMatrices {
    const kin = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
    _activeGeoAlignment = {
        tSceneFromRef: mat4.clone(kin.tSceneFromRef),
        tRefFromScene: mat4.clone(kin.tRefFromScene),
        anchorGeopose: cloneGeopose(kin.anchorGeopose),
    };
    return {
        tSceneFromRef: _activeGeoAlignment.tSceneFromRef,
        tRefFromScene: _activeGeoAlignment.tRefFromScene,
    };
}

/** Clears session alignment (e.g. when the XR session ends or matrix-only alignment is applied). */
export function clearActiveGeoAlignment(): void {
    _activeGeoAlignment = null;
}

/** True after a successful localization ({@link setActiveGeoAlignmentFromCapture}) until {@link clearActiveGeoAlignment}. */
export function hasActiveWorldAlignment(): boolean {
    return _activeGeoAlignment !== null;
}

// TODO: add FromActive in the name
// TODO convertGeoPoseToSceneRigidPose reorder parameters to objectGeopose, tSceneFromRef, anchorGeopose
export function convertGeoPoseToLocalPose(objectGeopose: Geopose): RigidPose {
    const a = requireActiveGeoAlignment();
    return convertGeoPoseToSceneRigidPose(a.anchorGeopose, objectGeopose, a.tSceneFromRef);
}

export function convertScenePoseToGeoposeFromActive(position: Vec3Like, quaternion: QuatLike): Geopose {
    const a = requireActiveGeoAlignment();
    return convertScenePoseToGeopose(position, quaternion, a.tRefFromScene, a.anchorGeopose);
}

export function convertCameraWebXrPoseToGeoposeFromActive(position: Vec3Like, quaternion: QuatLike): Geopose {
    const a = requireActiveGeoAlignment();
    return convertCameraWebXrPoseToGeopose(position, quaternion, a.tRefFromScene, a.anchorGeopose);
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