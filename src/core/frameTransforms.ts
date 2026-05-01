/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  Helpers and a small client for 4×4 transforms between frames (e.g. HTTP transform-graph).

  Coordinate frames use `FrameRef` and SpatialDDS-aligned pose types from `@core/spatial`;
  Conventions: docs/workingwithcode/poseconversions.md
*/

import { mat4, type ReadonlyMat4 } from 'gl-matrix';

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
