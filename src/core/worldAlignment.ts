/*
  (c) 2026 Open AR Cloud / contributors
  SPDX-License-Identifier: MIT

  World / GeoPose (OSCP:WGS84-ENU) alignment kinematics: no OGL / WebGL.
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

import { bumpWorldAlignmentRevision } from '../stateStore';
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
    bumpWorldAlignmentRevision();
    return {
        tSceneFromRef: _activeGeoAlignment.tSceneFromRef,
        tRefFromScene: _activeGeoAlignment.tRefFromScene,
    };
}

/** Clears session alignment (e.g. when the XR session ends or matrix-only alignment is applied). */
export function clearActiveGeoAlignment(): void {
    _activeGeoAlignment = null;
    bumpWorldAlignmentRevision();
}

/** True after a successful localization ({@link setActiveGeoAlignmentFromCapture}) until {@link clearActiveGeoAlignment}. */
export function hasActiveWorldAlignment(): boolean {
    return _activeGeoAlignment !== null;
}

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
    const globalImagePoseQuaternion = quat.fromValues(
        globalCapture.quaternion.x,
        globalCapture.quaternion.y,
        globalCapture.quaternion.z,
        globalCapture.quaternion.w,
    );
    const geoCamOrientation = convertAugmentedCityCam2WebQuat(globalImagePoseQuaternion);

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

/** Column-major world matrix from a plain rigid pose (optional placeholder scale). */
export function mat4FromRigidPose(rp: RigidPose, scale: readonly [number, number, number] = [1.0, 1.0, 1.0]): mat4 {
    const out = mat4.create();
    mat4.fromRotationTranslationScale(
        out,
        quat.fromValues(rp.orientation.x, rp.orientation.y, rp.orientation.z, rp.orientation.w),
        vec3.fromValues(rp.position.x, rp.position.y, rp.position.z),
        scale,
    );
    return out;
}

/** Same scale as legacy `createAxesBoxPlaceholder` debug nodes under the alignment root. */
const DEBUG_AXIS_PLACEHOLDER_SCALE: [number, number, number] = [0.02, 0.04, 0.06];

/** WebXR world matrix for the "AR camera at localization" debug axes. */
export function mat4LocalizationDebugArCamera(localCapture: WebXrRigidPose): mat4 {
    return mat4FromRigidPose(localCapture, DEBUG_AXIS_PLACEHOLDER_SCALE);
}

/** WebXR world matrix for the "global GeoPose camera at the localization" debug axes (legacy child of **T_scene_from_ref**). */
export function mat4LocalizationDebugGeoCamera(anchorGeopose: Geopose, tSceneFromRef: ReadonlyMat4): mat4 {
    const enuDelta = getRelativeGlobalPosition(anchorGeopose, anchorGeopose);
    const webxrPos = convertAugmentedCityCam2WebVec3(enuDelta);
    const qGlob = quat.fromValues(
        anchorGeopose.quaternion.x,
        anchorGeopose.quaternion.y,
        anchorGeopose.quaternion.z,
        anchorGeopose.quaternion.w,
    );
    const qRef = convertAugmentedCityCam2WebQuat(qGlob);
    const mRef = mat4.create();
    mat4.fromRotationTranslationScale(mRef, qRef, webxrPos, DEBUG_AXIS_PLACEHOLDER_SCALE);
    return mat4ComposeSceneFromRefLocal(tSceneFromRef, mRef);
}

/** WebXR world matrix for the "ENU axes at the localization" debug axes (legacy child of **T_scene_from_ref**). */
export function mat4LocalizationDebugEnuAxes(anchorGeopose: Geopose, tSceneFromRef: ReadonlyMat4): mat4 {
    const enuDelta = getRelativeGlobalPosition(anchorGeopose, anchorGeopose);
    const webxrPos = convertGeo2WebVec3(enuDelta);
    const qId = quat.create();
    const mRef = mat4.create();
    mat4.fromRotationTranslationScale(mRef, qId, webxrPos, DEBUG_AXIS_PLACEHOLDER_SCALE);
    return mat4ComposeSceneFromRefLocal(tSceneFromRef, mRef);
}

/** Alias for {@link mat4SceneFromGeoPose} (GeoPose object → WebXR scene **T_scene_from_object**). */
export function convertGeoPoseToSceneMat4(anchorGeopose: Geopose, objectGeopose: Geopose, tSceneFromRef: ReadonlyMat4): mat4 {
    return mat4SceneFromGeoPose(anchorGeopose, objectGeopose, tSceneFromRef);
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

/** Same as {@link convertScenePoseToGeopose} (kept for tests and older call sites). */
export function scenePoseToGeopose(
    position: { x: number; y: number; z: number },
    quaternion: { x: number; y: number; z: number; w: number },
    tRefFromScene: ReadonlyMat4,
    anchorGeopose: Geopose,
): Geopose {
    return convertScenePoseToGeopose(position, quaternion, tRefFromScene, anchorGeopose);
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