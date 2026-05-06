/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  Helpers and a small client for 4×4 transforms between frames (e.g. HTTP transform-graph).

  Coordinate frames use `FrameRef` and SpatialDDS-aligned pose types from `@core/spatial`;
  Conventions: docs/workingwithcode/poseconversions.md
*/

import { mat4, vec3, type ReadonlyMat4 } from 'gl-matrix';

export type {
    CovarianceType,
    CovMatrix,
    FrameRef,
    FramedPose,
    NsTime,
    PoseSE3,
    QuatLike,
    Vec3Like,
} from '@core/spatial';
export { OSCP_WGS84_ENU_FRAME_REF } from '@core/spatial';

const CACHE_KEY_SEP = '\x1e';

function cacheKey(fromFrameId: string, toFrameId: string): string {
    return `${fromFrameId}${CACHE_KEY_SEP}${toFrameId}`;
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
