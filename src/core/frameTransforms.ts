/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  Helpers and a small client for 4×4 transforms between frames (e.g. HTTP transform-graph).

  Coordinate frames use `FrameRef` and SpatialDDS-aligned pose types from `@core/spatial`;
  Conventions: docs/workingwithcode/poseconversions.md
*/

import { mat4, quat, vec3, type ReadonlyMat4 } from 'gl-matrix';

import type { FrameRef, FramedPose, PoseSE3, QuatLike, Vec3Like } from '@core/spatial';

export type {
    CoordConvention,
    CoordScale,
    CoordScaleUnit,
    CovarianceType,
    CovMatrix,
    FrameRef,
    FramedPose,
    NsTime,
    PoseSE3,
    QuatLike,
    Vec3Like,
} from '@core/spatial';

/** Position + unit quaternion in a Cartesian frame (WebXR scene, ENU tangent offset, etc.). */
export type RigidPose = {
    position: Vec3Like;
    orientation: QuatLike;
};

/** WebXR / capture pose at localization (plain numbers, no OGL types). */
export type WebXrRigidPose = RigidPose;

/** GeoPose expressed in a local ENU tangent plane at `refGeoPose` (meters east / north / up, quaternion unchanged from GeoPose / ENU). */
export type EnuRigidPose = RigidPose;

const CACHE_KEY_SEP = '\x1e';

function cacheKey(fromFrameId: string, toFrameId: string): string {
    return `${fromFrameId}${CACHE_KEY_SEP}${toFrameId}`;
}


/**
 * Creates a column-major `mat4` from a **4×4 row-major** layout: each inner array is one matrix row (4 numbers).
 * @param rowWise4 - Exactly four rows of four finite numbers (e.g. parsed JSON or literal `number[][]`).
 * @returns Column-major `mat4` for `gl-matrix`.
 */
export function createColumnWiseMat4FromRowWiseArray4(rowWise4: number[][]): mat4 {
    return mat4.fromValues(
        rowWise4[0][0]!,
        rowWise4[1][0]!,
        rowWise4[2][0]!,
        rowWise4[3][0]!,
        rowWise4[0][1]!,
        rowWise4[1][1]!,
        rowWise4[2][1]!,
        rowWise4[3][1]!,
        rowWise4[0][2]!,
        rowWise4[1][2]!,
        rowWise4[2][2]!,
        rowWise4[3][2]!,
        rowWise4[0][3]!,
        rowWise4[1][3]!,
        rowWise4[2][3]!,
        rowWise4[3][3]!,
    );
}

/**
 * Compose column-major transforms: p_C = T_C_from_B * T_B_from_A * p_A.
 * Writes into `out` and returns it.
 */
export function composeFrameTransforms(out: mat4, tThirdFromSecond: ReadonlyMat4, tSecondFromFirst: ReadonlyMat4): mat4 {
    return mat4.multiply(out, tThirdFromSecond, tSecondFromFirst);
}

/**
 * Invert T_B_from_A to obtain T_A_from_B. Returns null if singular.
 */
export function invertFrameTransform(out: mat4, tBFromA: ReadonlyMat4): mat4 | null {
    return mat4.invert(out, tBFromA);
}

/** Copy a 4×4 column-major matrix into a new mat4. */
export function cloneMat4(m: ReadonlyMat4): mat4 {
    return mat4.clone(m);
}

/**
 * Rigid transform **T_ref_from_body** for SpatialDDS {@link PoseSE3} (`t`, `q`): maps body/camera coordinates into the pose’s reference frame (see {@link FramedPose}).
 * Returned `mat4` is usable as {@link ReadonlyMat4} (column-major float32); clone before mutating.
 */
export function mat4FromPoseSE3(pose: PoseSE3): mat4 {
    const q = quat.fromValues(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
    const tr = vec3.fromValues(pose.t.x, pose.t.y, pose.t.z);
    const out = mat4.create();
    mat4.fromRotationTranslation(out, q, tr);
    return out;
}

/**
 * Same kinematics as {@link mat4FromPoseSE3} using {@link FramedPose.pose} only (`frameRef`, `cov`, `stamp` are ignored).
 */
export function mat4FromFramedPose(framedPose: FramedPose): mat4 {
    return mat4FromPoseSE3(framedPose.pose);
}

/** Column-major **T_ref_from_body** from WebXR-style `position` + `orientation` (same kinematics as SpatialDDS `PoseSE3` with `t`/`q` renamed). */
export function mat4FromRigidPose(pose: RigidPose): mat4 {
    const q = quat.fromValues(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w);
    const tr = vec3.fromValues(pose.position.x, pose.position.y, pose.position.z);
    const m = mat4.create();
    mat4.fromRotationTranslation(m, q, tr);
    return m;
}

/**
 * Inverse of {@link mat4FromRigidPose}: reads translation from column-major indices `12–14` and the rotational part of the upper-left 3×3 into a unit quaternion \((x,y,z,w)\), matching **`gl-matrix`** (same kinematics as **T_ref_from_body** in {@link mat4FromPoseSE3}).
 * For arbitrary similarity or affine matrices, `mat4.getRotation` follows **`gl-matrix`** decomposition rules (not a strict rigid-body inverse). When **`requireRigid`** is true, throws if {@link isRigidTransformMat4} is false.
 */
export function mat4ToRigidPose(m: ReadonlyMat4, requireRigid?: boolean): RigidPose {
    if (requireRigid && !isRigidTransformMat4(m)) {
        throw new Error(
            'mat4ToRigidPose: expected a rigid transform (orthonormal 3×3 with determinant +1, translation in 12–14, bottom row 0,0,0,1); got scale, shear, reflection, or invalid layout',
        );
    }
    const tr = vec3.create();
    mat4.getTranslation(tr, m);
    const q = quat.create();
    mat4.getRotation(q, m);
    return {
        position: { x: tr[0], y: tr[1], z: tr[2] },
        orientation: { x: q[0], y: q[1], z: q[2], w: q[3] },
    };
}

/** Max absolute element-wise difference between two 4×4 column-major matrices (tests / diagnostics). */
export function maxAbsDiffMat4(a: ReadonlyMat4, b: ReadonlyMat4): number {
    let m = 0;
    for (let i = 0; i < 16; i++) {
        m = Math.max(m, Math.abs(a[i]! - b[i]!));
    }
    return m;
}

/** Column-major 4×4 identity. */
export function identityMat4(out?: mat4): mat4 {
    const o = out ?? mat4.create();
    return mat4.identity(o);
}

export type { ReadonlyMat4 };

export type ResolveTransformFn = (fromFrameId: string, toFrameId: string, signal?: AbortSignal) => Promise<mat4>;

export type FrameTransformsClientOptions = {
    /**
     * Custom resolver (e.g. HTTP transform service, local graph, or test stub).
     * If omitted, `baseUrl` is used to build a default HTTP request (see `fetchFrameTransformMatrix`).
     */
    resolveTransform?: ResolveTransformFn;
    /** Base URL for default HTTP resolver, e.g. `https://dt.example.com/api/` */
    baseUrl?: string;
    fetchImpl?: typeof fetch;
};

/** Any column-major 4×4 source gl-matrix can clone (JSON arrays, TypedArrays, mat4). */
export type Mat4Like = ReadonlyMat4 | Float32Array | readonly number[];

function assertMat4ColumnMajor(name: string, m: Mat4Like): void {
    if (m.length !== 16) {
        throw new Error(`${name}: expected 16 elements, got ${m.length}`);
    }
}

/**
 * Normalizes any 16-element column-major matrix into a fresh mat4.
 */
export function normalizeColumnMajorMat4(m: Mat4Like): mat4 {
    assertMat4ColumnMajor('normalizeColumnMajorMat4', m);
    return mat4.clone(m as ReadonlyMat4);
}

/** Default tolerances for {@link isSimilarityTransformMat4}. */
export const SIMILARITY_TRANSFORM_DEFAULT_EPS_BOTTOM = 2e-4;
export const SIMILARITY_TRANSFORM_DEFAULT_EPS_GRAM = 2e-3;

/**
 * True if `m` is a column-major 4×4 **similarity** transform: uniform scale × rotation (or reflection)
 * in the upper-left 3×3, translation in indices 12–14, bottom row `[0,0,0,1]`.
 * Rejects shear, non-uniform scale, non-finite values, and degenerate linear parts.
 */
export function isSimilarityTransformMat4(
    m: ReadonlyMat4,
    epsBottom = SIMILARITY_TRANSFORM_DEFAULT_EPS_BOTTOM,
    epsGramRel = SIMILARITY_TRANSFORM_DEFAULT_EPS_GRAM,
): boolean {
    if (m.length !== 16) {
        return false;
    }
    // Bottom row of mat4 (column-major): indices 3, 7, 11, 15.
    if (
        Math.abs(m[3]!) > epsBottom ||
        Math.abs(m[7]!) > epsBottom ||
        Math.abs(m[11]!) > epsBottom ||
        Math.abs(m[15]! - 1) > epsBottom
    ) {
        return false;
    }
    const v0 = vec3.fromValues(m[0]!, m[1]!, m[2]!);
    const v1 = vec3.fromValues(m[4]!, m[5]!, m[6]!);
    const v2 = vec3.fromValues(m[8]!, m[9]!, m[10]!);
    const d00 = vec3.dot(v0, v0);
    const d11 = vec3.dot(v1, v1);
    const d22 = vec3.dot(v2, v2);
    if (!Number.isFinite(d00) || !Number.isFinite(d11) || !Number.isFinite(d22) || d00 <= 0) {
        return false;
    }
    const s2 = (d00 + d11 + d22) / 3;
    if (!Number.isFinite(s2) || s2 <= 0) {
        return false;
    }
    if (
        Math.abs(d00 - d11) > epsGramRel * s2 ||
        Math.abs(d11 - d22) > epsGramRel * s2 ||
        Math.abs(d00 - d22) > epsGramRel * s2
    ) {
        return false;
    }
    const tol = epsGramRel * s2;
    const d01 = vec3.dot(v0, v1);
    const d02 = vec3.dot(v0, v2);
    const d12 = vec3.dot(v1, v2);
    if (Math.abs(d01) > tol || Math.abs(d02) > tol || Math.abs(d12) > tol) {
        return false;
    }
    return true;
}

/** Default: squared column length must be within this absolute band of `1` for {@link isRigidTransformMat4}. */
export const RIGID_TRANSFORM_DEFAULT_EPS_UNIT_SQ = 2e-3;
/** Default: `det(R)` must lie in `[1 - eps, 1 + eps]` when reflections are disallowed. */
export const RIGID_TRANSFORM_DEFAULT_EPS_DET = 2e-3;

export type IsRigidTransformMat4Options = {
    epsBottom?: number;
    epsGramRel?: number;
    /** Max deviation of each `‖column‖²` from `1` (after {@link isSimilarityTransformMat4} passes). */
    epsUnitSq?: number;
    /** Allowed deviation of `det(R)` from `+1` (or from `±1` when {@link allowReflection} is true). */
    epsDet?: number;
    /** When true, allow `det(R) ≈ -1` (improper / reflected rigid). */
    allowReflection?: boolean;
};

/**
 * True if `m` is a **proper rigid** transform in column-major `mat4` layout: similarity with **unit** scale (orthonormal columns), translation in `12–14`, bottom row `[0,0,0,1]`, and determinant **+1** (right-handed rotation).
 * Uses {@link isSimilarityTransformMat4} first, then rejects uniform scale ≠ 1 and (by default) improper rotations (`det ≈ -1`).
 */
export function isRigidTransformMat4(m: ReadonlyMat4, options?: IsRigidTransformMat4Options): boolean {
    const epsBottom = options?.epsBottom ?? SIMILARITY_TRANSFORM_DEFAULT_EPS_BOTTOM;
    const epsGramRel = options?.epsGramRel ?? SIMILARITY_TRANSFORM_DEFAULT_EPS_GRAM;
    const epsUnitSq = options?.epsUnitSq ?? RIGID_TRANSFORM_DEFAULT_EPS_UNIT_SQ;
    const epsDet = options?.epsDet ?? RIGID_TRANSFORM_DEFAULT_EPS_DET;
    const allowReflection = options?.allowReflection ?? false;

    if (!isSimilarityTransformMat4(m, epsBottom, epsGramRel)) {
        return false;
    }
    const v0 = vec3.fromValues(m[0]!, m[1]!, m[2]!);
    const v1 = vec3.fromValues(m[4]!, m[5]!, m[6]!);
    const v2 = vec3.fromValues(m[8]!, m[9]!, m[10]!);
    const d00 = vec3.dot(v0, v0);
    const d11 = vec3.dot(v1, v1);
    const d22 = vec3.dot(v2, v2);
    if (Math.abs(d00 - 1) > epsUnitSq || Math.abs(d11 - 1) > epsUnitSq || Math.abs(d22 - 1) > epsUnitSq) {
        return false;
    }
    const cross = vec3.create();
    vec3.cross(cross, v1, v2);
    const det = vec3.dot(v0, cross);
    if (!Number.isFinite(det)) {
        return false;
    }
    if (allowReflection) {
        if (Math.abs(Math.abs(det) - 1) > epsDet) {
            return false;
        }
    } else if (Math.abs(det - 1) > epsDet) {
        return false;
    }
    return true;
}

/** Directed adjacency: `fromFrameId` → neighbors `toFrameId` with **T_to_from**. */
type DirectedEdges = Map<string, Map<string, mat4>>;

/**
 * In-memory transform graph: pairwise **T_to_from** edges keyed by frame **`uuid`** strings.
 * {@link registerEdge} accepts only **similarity** transforms (uniform scale, rotation, translation).
 * Each registration also stores the inverse edge so paths can be traversed in either direction.
 */
export class FrameTransformGraph {
    private readonly forward: DirectedEdges = new Map();

    clear(): void {
        this.forward.clear();
    }

    /**
     * Removes directed edges **a→b** and **b→a** if present (used when session framed alignment is cleared).
     */
    removeUndirectedEdge(frameIdA: string, frameIdB: string): void {
        if (frameIdA === frameIdB) {
            return;
        }
        const outsA = this.forward.get(frameIdA);
        if (outsA !== undefined) {
            outsA.delete(frameIdB);
            if (outsA.size === 0) {
                this.forward.delete(frameIdA);
            }
        }
        const outsB = this.forward.get(frameIdB);
        if (outsB !== undefined) {
            outsB.delete(frameIdA);
            if (outsB.size === 0) {
                this.forward.delete(frameIdB);
            }
        }
    }

    /**
     * Stores **T_to_from** from `fromFrameId` to `toFrameId`, and **T_from_to** on the reverse arc.
     *
     * @throws If **tToFrom** is not a finite similarity transform ({@link isSimilarityTransformMat4}), or if singular after validation.
     */
    registerEdge(fromFrameId: string, toFrameId: string, tToFrom: Mat4Like): void {
        if (fromFrameId.length === 0 || toFrameId.length === 0) {
            throw new Error('registerEdge: frame ids must be non-empty strings');
        }
        if (fromFrameId === toFrameId) {
            throw new Error('registerEdge: fromFrameId and toFrameId must differ');
        }
        const m = normalizeColumnMajorMat4(tToFrom);
        if (!isSimilarityTransformMat4(m)) {
            throw new Error(
                'registerEdge: T_to_from must be a similarity transform (uniform scale, rotation, translation; bottom row [0,0,0,1])',
            );
        }
        const inv = mat4.create();
        if (!mat4.invert(inv, m)) {
            throw new Error('registerEdge: singular matrix (unexpected after similarity check)');
        }
        this.setDirectedEdge(fromFrameId, toFrameId, m);
        this.setDirectedEdge(toFrameId, fromFrameId, inv);
    }

    private setDirectedEdge(fromFrameId: string, toFrameId: string, matrix: ReadonlyMat4): void {
        let outs = this.forward.get(fromFrameId);
        if (outs === undefined) {
            outs = new Map();
            this.forward.set(fromFrameId, outs);
        }
        outs.set(toFrameId, cloneMat4(matrix));
    }

    /**
     * Returns **T_to_from** along a shortest path (BFS), or `null` if none exists.
     * Same `from` and `to` yields identity (new mat4).
     */
    getTransform(fromFrameId: string, toFrameId: string): mat4 | null {
        if (fromFrameId === toFrameId) {
            return identityMat4();
        }
        const acc = new Map<string, mat4>();
        acc.set(fromFrameId, identityMat4());
        const queue: string[] = [fromFrameId];

        while (queue.length > 0) {
            const u = queue.shift()!;
            const tuFromSource = acc.get(u)!;
            const outs = this.forward.get(u);
            if (outs === undefined) {
                continue;
            }
            for (const [v, tVFromU] of outs) {
                if (acc.has(v)) {
                    continue;
                }
                const tvFromSource = mat4.create();
                mat4.multiply(tvFromSource, tVFromU, tuFromSource);
                if (v === toFrameId) {
                    return cloneMat4(tvFromSource);
                }
                acc.set(v, tvFromSource);
                queue.push(v);
            }
        }
        return null;
    }
}

/** Shared graph instance for dev seeds and runtime transform resolution. */
export const frameTransformGraph = new FrameTransformGraph();

/**
 * Default HTTP fetch: `GET {baseUrl}/transform?fromFrameId=&toFrameId=`
 * Expects JSON `{ "matrix": number[16] }` (column-major, gl-matrix order).
 * Adjust when the real transform service API is fixed.
 */
export async function fetchFrameTransformMatrix(
    baseUrl: string,
    fromFrameId: string,
    toFrameId: string,
    fetchImpl: typeof fetch = fetch,
    signal?: AbortSignal,
): Promise<mat4> {
    const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const url = new URL('transform', root);
    url.searchParams.set('fromFrameId', fromFrameId);
    url.searchParams.set('toFrameId', toFrameId);
    const res = await fetchImpl(url.toString(), { signal });
    if (!res.ok) {
        throw new Error(`fetchFrameTransformMatrix: HTTP ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { matrix?: number[] };
    const raw = data.matrix;
    if (!raw || !Array.isArray(raw)) {
        throw new Error('fetchFrameTransformMatrix: response missing numeric "matrix" array');
    }
    return normalizeColumnMajorMat4(raw);
}

function notConfiguredResolver(): ResolveTransformFn {
    return () =>
        Promise.reject(
            new Error(
                'FrameTransformsClient: no resolveTransform or baseUrl configured. Pass FrameTransformsClientOptions.resolveTransform or baseUrl.',
            ),
        );
}

/**
 * Cached access to transforms T_to_from between named coordinate reference frames.
 * - Same `from` and `to` returns identity (no network).
 * - After resolving A→B, B→A is satisfied from cache via inversion when possible.
 */
export class FrameTransformsClient {
    private readonly cache = new Map<string, mat4>();
    private readonly resolve: ResolveTransformFn;
    private readonly fetchImpl: typeof fetch;

    constructor(options: FrameTransformsClientOptions = {}) {
        this.fetchImpl = options.fetchImpl ?? fetch;
        if (options.resolveTransform) {
            this.resolve = options.resolveTransform;
        } else if (options.baseUrl) {
            const base = options.baseUrl;
            this.resolve = (from, to, signal) => fetchFrameTransformMatrix(base, from, to, this.fetchImpl, signal);
        } else {
            this.resolve = notConfiguredResolver();
        }
    }

    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Returns a **new** mat4 (column-major) so callers cannot mutate the cache.
     */
    async getTransform(fromFrameId: string, toFrameId: string, signal?: AbortSignal): Promise<mat4> {
        if (fromFrameId === toFrameId) {
            return identityMat4();
        }

        const key = cacheKey(fromFrameId, toFrameId);
        const cached = this.cache.get(key);
        if (cached) {
            return cloneMat4(cached);
        }

        const reverseKey = cacheKey(toFrameId, fromFrameId);
        const cachedReverse = this.cache.get(reverseKey);
        if (cachedReverse) {
            const inverted = mat4.create();
            const inv = invertFrameTransform(inverted, cachedReverse);
            if (!inv) {
                throw new Error(`FrameTransformsClient: cached transform ${reverseKey} is singular`);
            }
            this.cache.set(key, cloneMat4(inv));
            return cloneMat4(inv);
        }

        const resolved = await this.resolve(fromFrameId, toFrameId, signal);
        const copy = normalizeColumnMajorMat4(resolved);
        this.cache.set(key, cloneMat4(copy));
        return cloneMat4(copy);
    }
}

/**
 * Placeholder for a future **transform graph** integration: resolve **T_B_from_A** between arbitrary
 * frame keys (e.g. `FrameRef.uuid`). Session state in `worldAlignment` may hold **geoPose** and **framed pose**
 * alignments; this resolver type is for edges not covered by those direct **T_scene_from_ref** matrices.
 * See {@link FrameTransformsClient} for a cache + optional HTTP **GET** stub.
 */
export type FrameGraphMat4Resolver = (fromFrameId: string, toFrameId: string, signal?: AbortSignal) => Promise<mat4>;

// --- Camera frame bridge (wire VPS camera convention ↔ graphics / XRView session camera) ---
//
// **T_wireCam_from_graphicsCam** constants: treat as immutable (clone with `mat4.clone` if you need a writable `mat4`).

const _mat4VpsFrameBridgeIdentity = mat4.create();
mat4.identity(_mat4VpsFrameBridgeIdentity);
/** **T_graphicsCam_from_graphicsCam** = **I** when wire and graphics camera conventions match. */
export const MAT4_VPS_FRAME_BRIDGE_IDENTITY: ReadonlyMat4 = _mat4VpsFrameBridgeIdentity;

const _mat4VisionCamFromGraphicsCam = mat4.create();
mat4.set(_mat4VisionCamFromGraphicsCam, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1);
/**
 * **T_visionCam_from_graphicsCam** — maps vectors from the **graphics** (WebXR view) camera frame into the
 * **vision** (OpenCV / COLMAP-style) camera frame on typical VPS wires (+X right, +Y down, +Z forward vs +Y up, −Z optical).
 */
export const MAT4_VISION_CAM_FROM_GRAPHICS_CAM: ReadonlyMat4 = _mat4VisionCamFromGraphicsCam;

const _mat4RoboticsCamFromGraphicsCam = mat4.create();
// Linear AC→graphics: p_g = M p_r with M column-major cols (0,0,-1), (-1,0,0), (0,1,0). B = M^{-1} = M^T.
mat4.set(_mat4RoboticsCamFromGraphicsCam, 0, -1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 1);
/**
 * **T_roboticsCam_from_graphicsCam** — rigid rotation matching the **linear** part of Augmented City / robotics
 * camera → graphics; translation zero.
 */
export const MAT4_ROBOTICS_CAM_FROM_GRAPHICS_CAM: ReadonlyMat4 = _mat4RoboticsCamFromGraphicsCam;

const GRAPHICS_FQN_TOKENS = ['webxr', 'graphics', 'opengl', 'webgl'] as const;
const ROBOTICS_FQN_TOKENS = ['robotics', 'ros', 'ac', 'augmentedcity'] as const;
const VISION_FQN_TOKENS = ['hloc', 'colmap', 'vision', 'opencv'] as const;

function frameRefHaystackLower(frameRef: FrameRef): string {
    return `${frameRef.fqn}\n${frameRef.uuid}`.toLowerCase();
}

function haystackIncludesAny(haystackLower: string, tokens: readonly string[]): boolean {
    for (const t of tokens) {
        if (haystackLower.includes(t)) {
            return true;
        }
    }
    return false;
}

/**
 * Returns **T_wireCam_from_graphicsCam** for fusing VPS **FramedPose** (wire camera) with **graphics** `XRView` capture.
 * When **`frameRef.coord_convention`** is set (SpatialDDS 1.6), that value selects the bridge; otherwise uses
 * lowercase substring rules on **`frameRef.fqn`** / **`frameRef.uuid`** (first matching row wins).
 */
export function vpsCameraFrameBridgeFromFrameRef(frameRef: FrameRef): ReadonlyMat4 {
    const cc = frameRef.coord_convention;
    if (cc !== undefined) {
        switch (cc) {
            case 'CV':
                return MAT4_VISION_CAM_FROM_GRAPHICS_CAM;
            case 'GRAPHICS':
                return MAT4_VPS_FRAME_BRIDGE_IDENTITY;
            case 'ENU':
                return MAT4_ROBOTICS_CAM_FROM_GRAPHICS_CAM;
            case 'NED':
            case 'UNITY_LH':
            case 'OTHER':
                break;
            default:
                break;
        }
    }

    const hay = frameRefHaystackLower(frameRef);
    if (haystackIncludesAny(hay, GRAPHICS_FQN_TOKENS)) {
        return MAT4_VPS_FRAME_BRIDGE_IDENTITY;
    }
    if (haystackIncludesAny(hay, ROBOTICS_FQN_TOKENS)) {
        return MAT4_ROBOTICS_CAM_FROM_GRAPHICS_CAM;
    }
    if (haystackIncludesAny(hay, VISION_FQN_TOKENS)) {
        return MAT4_VISION_CAM_FROM_GRAPHICS_CAM;
    }
    return MAT4_VPS_FRAME_BRIDGE_IDENTITY;
}
