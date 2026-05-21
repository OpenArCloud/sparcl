/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  World alignment kinematics (arbitrary anchor `FrameRef` + `T_scene_from_ref`): WGS84/ENU GeoPose path
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

import {
    type FrameRef,
    type FramedPose,
    OSCP_WGS84_ENU_FRAME_REF,
    SPARCL_WEBXR_SCENE_FRAME_REF,
    type QuatLike,
    getMetricScaleFactorForFrameRef,
    type Vec3Like,
} from '@core/spatial';
import {
    frameTransformGraph,
    mat4FromRigidPose,
    normalizeColumnMajorMat4,
    vpsCameraFrameBridgeFromFrameRef,
    type EnuRigidPose,
    type RigidPose,
    type WebXrRigidPose,
} from '@core/frameTransforms';

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
 * Session geopose alignment: **OSCP:WGS84-ENU** at `anchorGeopose` with scene ↔ ref matrices.
 * Used for WGS84 content, H3 queries, and `convertGeoPoseToLocalPose` / `*FromActive` geopose helpers.
 */
export type GeoPoseAlignmentState = {
    tSceneFromRef: mat4;
    tRefFromScene: mat4;
    referenceFrameRef: FrameRef;
    anchorGeopose: Geopose;
};

/**
 * One VPS / SpatialDDS **FramedPose** alignment: scene ↔ named **frameRef** (map, room, etc.).
 */
export type FramedPoseAlignmentState = {
    frameRef: FrameRef;
    tSceneFromRef: mat4;
    tRefFromScene: mat4;
    /** Original wire pose when available (debug / future transform graph). */
    sourceFramedPose?: FramedPose;
};

/** Snapshot of both alignment buckets (matrices are live `mat4` references; clone if mutating). */
export type ActiveWorldAlignmentSnapshot = {
    geo: GeoPoseAlignmentState | null;
    framed: readonly FramedPoseAlignmentState[];
};

/**
 * Set alignment from precomputed `T_scene_from_ref` (and optional inverse), e.g. after VPS `poses` / XR
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

let _geoPoseAlignment: GeoPoseAlignmentState | null = null;
let _framedPoseAlignments: FramedPoseAlignmentState[] = [];

export function frameRefsEqual(a: FrameRef, b: FrameRef): boolean {
    return a.uuid === b.uuid && a.fqn === b.fqn;
}

function upsertFramedAlignment(entry: FramedPoseAlignmentState): void {
    const i = _framedPoseAlignments.findIndex((f) => frameRefsEqual(f.frameRef, entry.frameRef));
    if (i >= 0) {
        _framedPoseAlignments[i] = entry;
    } else {
        _framedPoseAlignments.push(entry);
    }
}

/** One-way: copies session **T_scene_from_ref** into {@link frameTransformGraph} (VPS/map frame → WebXR scene). Does not read from the graph. */
function addFramedPoseAlignmentToTransformGraph(frameRef: FrameRef, tSceneFromRef: ReadonlyMat4): void {
    const sceneUuid = SPARCL_WEBXR_SCENE_FRAME_REF.uuid;
    if (frameRef.uuid === sceneUuid) {
        return;
    }
    frameTransformGraph.registerEdge(frameRef.uuid, sceneUuid, tSceneFromRef);
}

export function isOscpWgs84Enu(ref: FrameRef): boolean {
    return ref.uuid === OSCP_WGS84_ENU_FRAME_REF.uuid && ref.fqn === OSCP_WGS84_ENU_FRAME_REF.fqn;
}

function cloneFrameRef(r: FrameRef): FrameRef {
    const out: FrameRef = { uuid: r.uuid, fqn: r.fqn };
    if (r.coord_convention !== undefined) {
        out.coord_convention = r.coord_convention;
    }
    if (r.coord_scale !== undefined) {
        out.coord_scale = {
            target_unit: r.coord_scale.target_unit,
            scale_factor: r.coord_scale.scale_factor,
        };
    }
    return out;
}

function cloneMatLike(m: ReadonlyMat4 | Float32Array | readonly number[]): mat4 {
    if (Array.isArray(m) || m instanceof Float32Array) {
        return normalizeColumnMajorMat4(m);
    }
    return mat4.clone(m);
}

function cloneGeopose(g: Geopose): Geopose {
    return {
        position: { lat: g.position.lat, lon: g.position.lon, h: g.position.h },
        quaternion: { x: g.quaternion.x, y: g.quaternion.y, z: g.quaternion.z, w: g.quaternion.w },
    };
}

function requireGeoAlignment(): GeoPoseAlignmentState {
    if (_geoPoseAlignment === null) {
        throw new Error(
            'No active geopose alignment. Call setActiveGeoAlignmentFromCapture or setActiveWorldAlignmentFromMatrices with OSCP:WGS84-ENU and anchorGeopose.',
        );
    }
    return _geoPoseAlignment;
}

/**
 * Computes alignment from the capture pair and stores **geoPoseAlignment** for {@link convertGeoPoseToLocalPose} and related helpers.
 * Does not modify framed pose alignments.
 * Anchor frame is **OSCP:WGS84-ENU** with a full `anchorGeopose`.
 */
export function setActiveGeoAlignmentFromCapture(localCapture: WebXrRigidPose, globalCapture: Geopose): ActiveWorldAlignmentMatrices {
    const kin = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
    _geoPoseAlignment = {
        tSceneFromRef: mat4.clone(kin.tSceneFromRef),
        tRefFromScene: mat4.clone(kin.tRefFromScene),
        referenceFrameRef: cloneFrameRef(kin.referenceFrameRef),
        anchorGeopose: cloneGeopose(kin.anchorGeopose),
    };
    return {
        tSceneFromRef: _geoPoseAlignment.tSceneFromRef,
        tRefFromScene: _geoPoseAlignment.tRefFromScene,
    };
}

/**
 * Stores alignment from explicit `T_scene_from_ref` / `T_ref_from_scene`.
 * If **referenceFrameRef** is **OSCP:WGS84-ENU** and **anchorGeopose** is non-null, updates {@link _geoPoseAlignment}.
 * Otherwise upserts a **framed** alignment for that **referenceFrameRef** (map / local frames).
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

    if (isOscpWgs84Enu(params.referenceFrameRef) && anchorGeopose !== null) {
        _geoPoseAlignment = {
            tSceneFromRef,
            tRefFromScene,
            referenceFrameRef: cloneFrameRef(params.referenceFrameRef),
            anchorGeopose,
        };
    } else {
        upsertFramedAlignment({
            frameRef: cloneFrameRef(params.referenceFrameRef),
            tSceneFromRef,
            tRefFromScene,
        });
        addFramedPoseAlignmentToTransformGraph(params.referenceFrameRef, tSceneFromRef);
    }
    return {
        tSceneFromRef,
        tRefFromScene,
    };
}

/**
 * Aligns WebXR session space to **frameRef** using the capture-time camera pose in scene and the VPS `T_R_from_camera`.
 * `T_scene_from_R` = `T_scene_from_cam * inv(T_R_from_cam)`.
 * Updates **framed** alignments only; does not modify {@link _geoPoseAlignment}.
 *
 * Wire **FramedPose** camera convention vs **graphics** `localCapture` uses **T_map_from_graphicsCam** =
 * **T_map_from_wireCam · T_wireCam_from_graphicsCam**, where **T_wireCam_from_graphicsCam** comes from
 * {@link vpsCameraFrameBridgeFromFrameRef} on **`frameRef.coord_convention`** when set, else **`frameRef.fqn`** /
 * **`frameRef.uuid`** heuristics (see `test/cameraFrameBridge.test.ts`).
 * When **`frameRef.coord_scale`** is present with `target_unit === SI_METER`, **`pose.t`** is multiplied by **`scale_factor`**
 * before fusion (wire translation → meters). The wire still carries a **unit quaternion** (no length scale).
 *
 * When **`s !== 1`**, **`T_scene_from_ref`** is additionally right-multiplied by **`diag(s,s,s,1)`** so that the
 * alignment maps **ref-frame positions** the same way as **raw map / PLY vertex coordinates** (which stay in wire
 * units) relative to the **meterized** camera translation above. Without this, composing **`T_scene_from_ref`**
 * with transform-graph edges that use **raw** map units (or **similarity** **T_world_from_vps** with baked **s**)
 * mis-scales offsets. Applies to **any** localized `FrameRef` that reports **`coord_scale`** with **`s ≠ 1`**.
 */
export function setActiveAlignmentInFrame(
    localCapture: WebXrRigidPose,
    cameraPoseInRef: FramedPose,
): ActiveWorldAlignmentMatrices {
    const s = getMetricScaleFactorForFrameRef(cameraPoseInRef.frame_ref);
    const t = cameraPoseInRef.pose.t;
    const mRefFromCamWire = mat4FromRigidPose({
        position: { x: t.x * s, y: t.y * s, z: t.z * s }, // scale the translation to meters
        orientation: cameraPoseInRef.pose.q,
    });
    // bridge the camera pose between the VPS and the WebXR conventions
    const wireFromGraphics = vpsCameraFrameBridgeFromFrameRef(cameraPoseInRef.frame_ref);
    const tRefFromCam = mat4.create();
    mat4.multiply(tRefFromCam, mRefFromCamWire, wireFromGraphics);
    // invert the transform to get the camera pose in the reference frame
    const tCamFromRef = mat4.create();
    if (!mat4.invert(tCamFromRef, tRefFromCam)) {
        throw new Error('setActiveAlignmentInFrame: singular rigid pose in frame');
    }
    
    // Calculate the transform between the reference frame and the WebXR scene frame
    const tSceneFromCam = mat4FromRigidPose(localCapture);
    const tSceneFromRef = mat4.create();
    mat4.multiply(tSceneFromRef, tSceneFromCam, tCamFromRef);
    if (s !== 1.0) { // scale the whole transform to metric units
        const toRawVertexAsMeterized = mat4.fromScaling(mat4.create(), vec3.fromValues(s, s, s));
        const tSceneFromMetricRef = mat4.create();
        mat4.multiply(tSceneFromMetricRef, tSceneFromRef, toRawVertexAsMeterized);
        mat4.copy(tSceneFromRef, tSceneFromMetricRef);
    }

    const tRefFromScene = mat4.create();
    if (!mat4.invert(tRefFromScene, tSceneFromRef)) {
        throw new Error('setActiveAlignmentInFrame: singular alignment');
    }

    upsertFramedAlignment({
        frameRef: cloneFrameRef(cameraPoseInRef.frame_ref),
        tSceneFromRef,
        tRefFromScene,
        sourceFramedPose: cameraPoseInRef,
    });
    addFramedPoseAlignmentToTransformGraph(cameraPoseInRef.frame_ref, tSceneFromRef);

    return {
        tSceneFromRef,
        tRefFromScene,
    };
}

/** Clears only geopose (**OSCP:WGS84-ENU**) session alignment. Does not remove framed pose alignments. */
export function clearActiveGeoPoseAlignment(): void {
    _geoPoseAlignment = null;
}

/**
 * Removes framed pose alignments. With the default **empty** list, clears **all** framed alignments.
 * With one or more **FrameRef**s, removes only entries that match (see {@link frameRefsEqual}).
 */
export function clearActiveFramedPoseAlignment(frameRefs: readonly FrameRef[] = []): void {
    const sceneUuid = SPARCL_WEBXR_SCENE_FRAME_REF.uuid;
    const refsToStripFromGraph: readonly FrameRef[] =
        frameRefs.length === 0 ? _framedPoseAlignments.map((f) => f.frameRef) : frameRefs;

    if (frameRefs.length === 0) {
        _framedPoseAlignments = [];
    } else {
        _framedPoseAlignments = _framedPoseAlignments.filter(
            (f) => !frameRefs.some((r) => frameRefsEqual(r, f.frameRef)),
        );
    }

    for (const r of refsToStripFromGraph) {
        if (r.uuid !== sceneUuid) {
            frameTransformGraph.removeUndirectedEdge(r.uuid, sceneUuid);
        }
    }
}

/** True after any alignment is stored until the corresponding clear (see {@link clearActiveGeoPoseAlignment} / {@link clearActiveFramedPoseAlignment}). */
export function hasActiveWorldAlignment(): boolean {
    return _geoPoseAlignment !== null || _framedPoseAlignments.length > 0;
}

/** Geopose alignment bucket, or `null`. */
export function getActiveGeoAlignment(): GeoPoseAlignmentState | null {
    return _geoPoseAlignment;
}

/** Framed pose alignments (copy of array reference; entries hold cloned frame refs and matrices). */
export function getFramedPoseAlignments(): readonly FramedPoseAlignmentState[] {
    return _framedPoseAlignments;
}

/** Find a framed alignment by **frameRef**, or `undefined`. */
export function findFramedPoseAlignment(frameRef: FrameRef): FramedPoseAlignmentState | undefined {
    return _framedPoseAlignments.find((f) => frameRefsEqual(f.frameRef, frameRef));
}

/** Geo alignment **referenceFrameRef** (OSCP:WGS84-ENU when set via geo path), or `null`. */
export function getGeoAlignmentReferenceFrameRef(): FrameRef | null {
    return _geoPoseAlignment === null ? null : cloneFrameRef(_geoPoseAlignment.referenceFrameRef);
}

/** Anchor geopose for geo alignment; `null` if geo alignment is unset. */
export function getGeoAlignmentAnchorGeopose(): Geopose | null {
    if (_geoPoseAlignment === null) {
        return null;
    }
    return cloneGeopose(_geoPoseAlignment.anchorGeopose);
}

/**
 * Back-compat: geo alignment frame ref if present, else first framed alignment’s **frameRef**, else `null`.
 * Prefer {@link getGeoAlignmentReferenceFrameRef} / {@link getFramedPoseAlignments} for unambiguous use.
 */
export function getActiveReferenceFrameRef(): FrameRef | null {
    const g = getGeoAlignmentReferenceFrameRef();
    if (g !== null) {
        return g;
    }
    if (_framedPoseAlignments.length === 0) {
        return null;
    }
    return cloneFrameRef(_framedPoseAlignments[0]!.frameRef);
}

/**
 * Back-compat: same as {@link getGeoAlignmentAnchorGeopose} (anchor is only defined for geo alignment).
 */
export function getActiveAnchorGeopose(): Geopose | null {
    return getGeoAlignmentAnchorGeopose();
}

/** Composite snapshot of geo + framed alignments. */
export function getActiveWorldAlignment(): ActiveWorldAlignmentSnapshot {
    return {
        geo: _geoPoseAlignment,
        framed: [..._framedPoseAlignments],
    };
}

// TODO: add FromActive in the name
// TODO convertGeoPoseToSceneRigidPose reorder parameters to objectGeopose, tSceneFromRef, anchorGeopose
export function convertGeoPoseToLocalPose(objectGeopose: Geopose): RigidPose {
    const a = requireGeoAlignment();
    if (!isOscpWgs84Enu(a.referenceFrameRef)) {
        throw new Error(
            'convertGeoPoseToLocalPose requires an OSCP:WGS84-ENU geo alignment. For other frames, use convertFramedPoseToLocalPose or graph composition.',
        );
    }
    return convertGeoPoseToSceneRigidPose(a.anchorGeopose, objectGeopose, a.tSceneFromRef);
}

export function convertScenePoseToGeoposeFromActive(position: Vec3Like, quaternion: QuatLike): Geopose {
    const a = requireGeoAlignment();
    return convertScenePoseToGeopose(position, quaternion, a.tRefFromScene, a.anchorGeopose);
}

export function convertCameraWebXrPoseToGeoposeFromActive(position: Vec3Like, quaternion: QuatLike): Geopose {
    const a = requireGeoAlignment();
    return convertCameraWebXrPoseToGeopose(position, quaternion, a.tRefFromScene, a.anchorGeopose);
}

/**
 * Maps a `RigidPose` expressed in **frameRef** into WebXR scene space (`T_scene_from_ref * T_ref_from_body`).
 * Requires a matching {@link findFramedPoseAlignment} entry (from VPS **poses** / {@link setActiveAlignmentInFrame}).
 */
export function convertFramedPoseToLocalPose(frameRef: FrameRef, poseInRef: RigidPose): RigidPose {
    const fa = findFramedPoseAlignment(frameRef);
    if (fa === undefined) {
        throw new Error(
            `No framed alignment for frameRef uuid=${frameRef.uuid} fqn=${frameRef.fqn}. Localize with that FramedPose or compose transforms via the transform service.`,
        );
    }
    return convertRigidPoseToSceneRigidPose(fa.tSceneFromRef, poseInRef);
}

/**
 * Applies **T_scene_from_ref** to a **RigidPose** in that reference frame (same kinematics as {@link convertFramedPoseToLocalPose}, without session lookup).
 */
export function convertRigidPoseToSceneRigidPose(tSceneFromRef: ReadonlyMat4, poseInRef: RigidPose): RigidPose {
    const mRefObj = mat4FromRigidPose(poseInRef);
    const mScene = mat4.create();
    mat4.multiply(mScene, tSceneFromRef, mRefObj);
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
 * Rigid transform of an object's GeoPose `relative to the anchor` (ENU offset → WebXR axes + ENU quat → WebXR quat).
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

/** WebXR world matrix for the "global GeoPose camera at the localization" debug axes (legacy child of `T_scene_from_ref`). */
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
 * WebXR world matrix for the **ENU** tangent triad at the anchor.
 * Orientation in the reference frame is **not** raw WebXR identity: it is ENU identity
 * Position is the anchor offset in ref (zero when object equals anchor).
 * The resulting matrix is still left-multiplied by `T_scene_from_ref`, so the triad is placed
 * at the capture position and includes VPS↔WebXR alignment.
 */
export function mat4LocalizationDebugEnuAxes(anchorGeopose: Geopose, tSceneFromRef: ReadonlyMat4): mat4 {
    // Hamilton unit quaternion (x, y, z, w) = (0, 0, 0, 1)
    // The body / object frame is aligned with the local tangent **East, North, Up** axes at the reference geopoint.
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

/** Decomposed WebXR scene pose for a GeoPose under geopose alignment (same as `T_scene_from_ref * T_ref_from_object`). */
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
 * Converts a local pose to an ENU pose using the local to ENU transformation matrix `T_local_to_enu`.
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
 * Converts a local pose to a GeoPose using the local to ENU transformation matrix `T_local_to_enu` and the anchor geopose.
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
 * WebXR scene rigid pose → OSCP:WGS84-ENU GeoPose using the anchor and `T_ref_from_scene`
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
 * WebXR `camera` local pose → GeoPose camera orientation (identity looks East): applies +π/2 about scene **+Y**, then {@link convertScenePoseToGeopose}.
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
 * GeoPose in WGS-84 → ENU offset frame at `refGeoPose` (tangent plane meters + same ENU quaternion as `GeoPose`).
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
