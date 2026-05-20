/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  SpatialDDS-aligned JSON types (Core Profile / OSCP GeoPose extensions) and parsers for wire payloads.
  Specification: [SpatialDDS 1.6 — Core Profile / FrameRef](https://spatialdds.org/SpatialDDS-1.6-full/) (Appendix A).
  Conventions: docs/workingwithcode/poseconversions.md
*/

/**
 * SpatialDDS 1.6 `spatial::common::CoordConvention` — axis convention for poses in this frame (`FrameRef.coord_convention`).
 * When the wire omits the field (or `has_coord_convention` is false), the spec assumes **ENU** for frame semantics;
 * the client camera bridge still uses legacy `fqn`/`uuid` heuristics unless **`coord_convention` is explicitly set**.
 */
export type CoordConvention = 'ENU' | 'CV' | 'GRAPHICS' | 'UNITY_LH' | 'NED' | 'OTHER';

const COORD_CONVENTION_NAMES = new Set<string>([
    'ENU',
    'CV',
    'GRAPHICS',
    'UNITY_LH',
    'NED',
    'OTHER',
]);

/** SpatialDDS 1.6 default when `coord_convention` is absent (`has_coord_convention` false). */
export const DEFAULT_FRAME_COORD_CONVENTION: CoordConvention = 'ENU';

/** VPS extension (not yet in SpatialDDS): target unit for {@link FrameRef.coord_scale}. */
export type CoordScaleUnit = 'SI_METER';

/** VPS extension: scale wire translations to metric SI meters. */
export type CoordScale = {
    unit: CoordScaleUnit;
    scale_factor: number;
};

/** SpatialDDS `spatial::common::FrameRef`: stable frame identity (`uuid` equality; `fqn` is a normalized human-readable alias). */
export type FrameRef = {
    uuid: string;
    fqn: string;
    /** SpatialDDS 1.6 optional axis convention for poses in this frame. */
    coord_convention?: CoordConvention;
    /**
     * VPS extension (optional): multiply {@link FramedPose} translation `pose.t` by `scale_factor` to obtain **meters**
     * when `unit` is {@link CoordScaleUnit} **`SI_METER`**.
     */
    coord_scale?: CoordScale;
};

/** Reserved frame reference for OSCP GeoPose (WGS-84 + ENU), per poseconversions.md */
export const OSCP_WGS84_ENU_FRAME_REF: FrameRef = {
    uuid: 'OSCP:WGS84-ENU',
    fqn: 'OSCP:WGS84-ENU',
};

/**
 * Canonical WebXR session / renderer scene frame for transform-graph edges (sparcl convention).
 * Matches the scene frame used by dev override localization and SCR framing.
 */
export const SPARCL_WEBXR_SCENE_FRAME_REF: FrameRef = {
    uuid: 'sparcl-scene-frame',
    fqn: 'sparcl:WebXRScene',
};

/** Plain 3-vector (`spatial::common::Vec3` JSON: `x`, `y`, `z`). */
export type Vec3Like = { x: number; y: number; z: number };

/** Quaternion (x, y, z, w) in GeoPose / SpatialDDS order. */
export type QuatLike = { x: number; y: number; z: number; w: number };

/** SpatialDDS Core `PoseSE3`: translation `t` + quaternion `q`. */
export type PoseSE3 = {
    t: Vec3Like;
    q: QuatLike;
};

/** SpatialDDS `builtin::Time` — UTC `sec` + `nanosec` (e.g. `FramedPose.stamp`, sample timestamps). */
export type NsTime = {
    sec: number;
    nanosec: number;
};

/** SpatialDDS `spatial::common::CovarianceType` string names on JSON wire. */
export type CovarianceType =
    | 'COV_NONE'
    | 'COV_POS3'
    | 'COV_POSE6'
    | 'COV_ROT3'
    | 'COV_POSE6_TWIST6';

/**
 * SpatialDDS `CovMatrix` JSON — discriminated by `covarianceType`; payload keys match OSCP / SpatialDDS extensions.
 */
export type CovMatrix = {
    covarianceType: CovarianceType;
    pos?: readonly number[];
    pose?: readonly number[];
    rot?: readonly number[];
    poseTwist?: readonly number[];
};

/**
 * SpatialDDS Core `FramedPose`: `pose`, `frameRef`; optional `cov`, `stamp`.
 * Pose of the camera (or body) expressed in `frameRef`.
 */
export type FramedPose = {
    frameRef: FrameRef;
    pose: PoseSE3;
    cov?: CovMatrix;
    /** When the wire omits `stamp`, this property is omitted (not defaulted). */
    stamp?: NsTime;
};

function isRecord(x: unknown): x is Record<string, unknown> {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/** Parse SpatialDDS / OSCP JSON `time` object (`sec` + `nanosec`). */
export function parseNsTime(raw: unknown): NsTime | undefined {
    if (!isRecord(raw)) {
        return undefined;
    }
    const sec = raw.sec;
    const nanosec = raw.nanosec;
    if (typeof sec !== 'number' || typeof nanosec !== 'number') {
        return undefined;
    }
    return { sec, nanosec };
}

/** Parse a single `coord_convention` wire string. */
export function parseCoordConvention(raw: unknown): CoordConvention | undefined {
    if (typeof raw !== 'string' || !COORD_CONVENTION_NAMES.has(raw)) {
        return undefined;
    }
    return raw as CoordConvention;
}

/**
 * Parse `FrameRef.coord_scale` JSON (`target_unit`, `scale_factor`).
 * Unsupported `target_unit` values log a console warning and yield `undefined`.
 */
export function parseCoordScale(raw: unknown): CoordScale | undefined {
    if (!isRecord(raw)) {
        return undefined;
    }
    const targetUnitRaw = raw.target_unit;
    const scaleFactorRaw = raw.scale_factor;
    if (typeof targetUnitRaw !== 'string') {
        return undefined;
    }
    if (targetUnitRaw !== 'SI_METER') {
        console.warn(`FrameRef.coord_scale: unsupported unit "${targetUnitRaw}", ignoring coord_scale`);
        return undefined;
    }
    if (typeof scaleFactorRaw !== 'number' || !Number.isFinite(scaleFactorRaw)) {
        return undefined;
    }
    return { unit: 'SI_METER', scale_factor: scaleFactorRaw };
}

/**
 * Factor to multiply {@link FramedPose} translation components by for metric fusion (see {@link FrameRef.coord_scale}).
 * Returns **1** when `coord_scale` is absent or unusable.
 */
export function getMetricScaleFactorForFrameRef(frameRef: FrameRef): number {
    const cs = frameRef.coord_scale;
    if (cs === undefined) {
        return 1;
    }
    if (cs.unit !== 'SI_METER') {
        console.warn(`FrameRef.coord_scale: unsupported unit "${cs.unit}", ignoring scale`);
        return 1;
    }
    if (typeof cs.scale_factor !== 'number' || !Number.isFinite(cs.scale_factor)) {
        return 1;
    }
    return cs.scale_factor;
}

function parseFrameRef(raw: unknown): FrameRef | undefined {
    if (!isRecord(raw)) {
        return undefined;
    }
    const uuid = raw.uuid;
    const fqn = raw.fqn;
    if (typeof uuid !== 'string' || typeof fqn !== 'string' || uuid.length === 0 || fqn.length === 0) {
        return undefined;
    }
    const out: FrameRef = { uuid, fqn };

    const hasCoordConvention = raw.has_coord_convention ?? raw.hasCoordConvention;
    const ccWire = raw.coord_convention ?? raw.coordConvention;
    if (hasCoordConvention !== false && ccWire !== undefined && ccWire !== null) {
        const cc = parseCoordConvention(ccWire);
        if (cc !== undefined) {
            out.coord_convention = cc;
        }
    }

    const hasCoordScale = raw.has_coord_scale ?? raw.hasCoordScale;
    const csWire = raw.coord_scale ?? raw.coordScale;
    if (hasCoordScale !== false && csWire !== undefined && csWire !== null) {
        const cs = parseCoordScale(csWire);
        if (cs !== undefined) {
            out.coord_scale = cs;
        }
    }

    return out;
}

function parseFiniteNumberArray(raw: unknown): readonly number[] | undefined {
    if (!Array.isArray(raw)) {
        return undefined;
    }
    const out: number[] = [];
    for (const x of raw) {
        if (typeof x !== 'number' || !Number.isFinite(x)) {
            return undefined;
        }
        out.push(x);
    }
    return out;
}

const COVARIANCE_TYPES = new Set<CovarianceType>([
    'COV_NONE',
    'COV_POS3',
    'COV_POSE6',
    'COV_ROT3',
    'COV_POSE6_TWIST6',
]);

/** SpatialDDS `CovMatrix` on JSON wire (`covarianceType` + optional payload arrays). */
export function parseCovMatrix(raw: unknown): CovMatrix | undefined {
    if (!isRecord(raw)) {
        return undefined;
    }
    const ctRaw = raw.covarianceType ?? raw.covariance_type;
    if (typeof ctRaw !== 'string' || !COVARIANCE_TYPES.has(ctRaw as CovarianceType)) {
        return undefined;
    }
    const covarianceType = ctRaw as CovarianceType;
    const pos = parseFiniteNumberArray(raw.pos);
    const pose = parseFiniteNumberArray(raw.pose);
    const rot = parseFiniteNumberArray(raw.rot);
    const poseTwist = parseFiniteNumberArray(raw.poseTwist ?? raw.pose_twist);
    const out: CovMatrix = { covarianceType };
    if (pos !== undefined) {
        out.pos = pos;
    }
    if (pose !== undefined) {
        out.pose = pose;
    }
    if (rot !== undefined) {
        out.rot = rot;
    }
    if (poseTwist !== undefined) {
        out.poseTwist = poseTwist;
    }
    return out;
}

/**
 * Parse one SpatialDDS `FramedPose` JSON object: `pose.t` / `pose.q`, `frameRef`, optional `cov`, `stamp`.
 */
export function parseFramedPose(raw: unknown): FramedPose | undefined {
    if (!isRecord(raw)) {
        return undefined;
    }
    const poseBlock = raw.pose;
    if (!isRecord(poseBlock)) {
        return undefined;
    }
    const t = poseBlock.t;
    const q = poseBlock.q;
    const frameRef = parseFrameRef(raw.frameRef ?? raw.frame_ref);
    if (!frameRef || !isRecord(t) || !isRecord(q)) {
        return undefined;
    }
    const x = t.x;
    const y = t.y;
    const z = t.z;
    const ox = q.x;
    const oy = q.y;
    const oz = q.z;
    const ow = q.w;
    if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof z !== 'number' ||
        typeof ox !== 'number' ||
        typeof oy !== 'number' ||
        typeof oz !== 'number' ||
        typeof ow !== 'number'
    ) {
        return undefined;
    }
    const base: FramedPose = {
        frameRef,
        pose: {
            t: { x, y, z },
            q: { x: ox, y: oy, z: oz, w: ow },
        },
    };

    const stampRaw = raw.stamp;
    if (stampRaw !== undefined && stampRaw !== null) {
        const stamp = parseNsTime(stampRaw);
        if (stamp !== undefined) {
            base.stamp = stamp;
        }
    }

    const covRaw = raw.cov;
    if (covRaw !== undefined && covRaw !== null) {
        const cov = parseCovMatrix(covRaw);
        if (cov !== undefined) {
            base.cov = cov;
        }
    }

    return base;
}
