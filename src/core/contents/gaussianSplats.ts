/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  3D Gaussian splatting SCR content types and URL / MIME format detection.
*/

import { getUrlExtension } from '@core/contents/contentFormats';

/** SCR `content.type` for 3D Gaussian splat assets. */
export const SCR_GAUSSIAN_SPLATS_TYPE = 'GAUSSIAN_SPLATS';

/** File formats Spark loads from a URL via `SplatMesh` (no streamed SOG / RAD paging in v1). */
export type GaussianSplatsSourceFormat = 'ply' | 'spz' | 'sog' | 'splat' | 'ksplat';

export function isScrGaussianSplatsContentType(scrContentType: string): boolean {
    return scrContentType === SCR_GAUSSIAN_SPLATS_TYPE;
}

/**
 * Resolves Gaussian splat asset format from ref URL and MIME `contentType`.
 * Splats must use {@link isScrGaussianSplatsContentType}; do not infer splats from `.ply` alone.
 */
export function gaussianSplatsFormatFromRef(url: string, contentType: string): GaussianSplatsSourceFormat | null {
    const ext = getUrlExtension(url);
    const ct = (contentType || '').toLowerCase();

    if (ext === 'ksplat' || ct.includes('ksplat')) {
        return 'ksplat';
    }
    if (ext === 'splat' || ct.includes('splat')) {
        return 'splat';
    }
    if (ext === 'spz' || ct.includes('spz')) {
        return 'spz';
    }
    if (ext === 'sog' || ext === 'zip' || ct.includes('sog')) {
        return 'sog';
    }
    if (ext === 'ply' || ct.includes('ply')) {
        return 'ply';
    }
    return null;
}
