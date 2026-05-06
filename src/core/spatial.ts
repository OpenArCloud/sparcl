/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  SpatialDDS-aligned JSON types (Core Profile / OSCP GeoPose extensions) and parsers for wire payloads.
  Specification: [SpatialDDS Appendix A — Core Profile](https://spatialdds.org/v1.5/appendix-a/).
  Conventions: docs/workingwithcode/poseconversions.md
*/

/** SpatialDDS `spatial::common::FrameRef`: stable frame identity (`uuid` equality; `fqn` is a normalized human-readable alias). */
export type FrameRef = {
    uuid: string;
    fqn: string;
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

function parseFrameRef(raw: unknown): FrameRef | undefined {
    if (!isRecord(raw)) {
        return undefined;
    }
    const uuid = raw.uuid;
    const fqn = raw.fqn;
    if (typeof uuid !== 'string' || typeof fqn !== 'string' || uuid.length === 0 || fqn.length === 0) {
        return undefined;
    }
    return { uuid, fqn };
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
