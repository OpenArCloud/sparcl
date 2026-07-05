/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * SCR content URL / MIME format detection (renderer-agnostic).
 */

/** File extension used for format detection (lowercase, no leading dot). Query strings and URL fragments are ignored. */
export function getUrlExtension(url: string): string {
    const path = url.split(/[?#]/)[0];
    const dot = path.lastIndexOf('.');
    return dot >= 0 ? path.slice(dot + 1).toLowerCase() : '';
}

/** SCR `content.type` values that represent point-cloud assets (OSCP naming variants). */
export function isScrPointCloudContentType(scrContentType: string): boolean {
    return scrContentType === 'POINT_CLOUD' || scrContentType === 'POINTCLOUD';
}

/** SCR `content.type` values that represent mesh / generic 3D model assets. */
export function isScrModel3dContentType(scrContentType: string): boolean {
    return scrContentType === 'MODEL_3D' || scrContentType === '3D' || scrContentType === 'placeholder';
}

function refLooksLikePly(url: string, contentType: string): boolean {
    const ext = getUrlExtension(url);
    const ct = (contentType || '').toLowerCase();
    return ext === 'ply' || ct.includes('ply');
}

/**
 * Point-cloud URL formats understood by rendering engines' point-cloud entry points.
 * Extend when adding loaders (e.g. PCD, LAS).
 */
export type PointCloudSourceFormat = 'ply';

/**
 * Resolves point-cloud handling from ref URL, MIME `contentType`, and optional SCR `content.type`.
 * When `scrContentType` is set, it must be a point-cloud SCR type; mesh SCR types yield `null` so
 * mesh placement uses {@link model3DFormatFromRef} instead.
 */
export function pointCloudFormatFromRef(
    url: string,
    contentType: string,
    scrContentType?: string,
): PointCloudSourceFormat | null {
    if (scrContentType != null && scrContentType !== '') {
        if (isScrModel3dContentType(scrContentType)) {
            return null;
        }
        if (!isScrPointCloudContentType(scrContentType)) {
            return null;
        }
    }
    return refLooksLikePly(url, contentType) ? 'ply' : null;
}

/**
 * MODEL_3D (and equivalent) asset formats engines can load today.
 * Extend when adding USDZ, OBJ, etc.
 */
export type Model3dSourceFormat = 'gltf' | 'ply';

/**
 * Resolves MODEL_3D handling from ref URL, MIME `contentType`, and optional SCR `content.type`.
 * When `scrContentType` is a point-cloud SCR type, returns `null` (use the point-cloud pipeline).
 * PLY mesh assets use the same URL/MIME rules as point clouds; GLTF is detected separately.
 */
export function model3DFormatFromRef(
    url: string,
    contentType: string,
    scrContentType?: string,
): Model3dSourceFormat | null {
    if (scrContentType != null && scrContentType !== '' && isScrPointCloudContentType(scrContentType)) {
        return null;
    }
    if (refLooksLikePly(url, contentType)) {
        return 'ply';
    }
    const ext = getUrlExtension(url);
    const ct = (contentType || '').toLowerCase();
    if (ext === 'glb' || ext === 'gltf' || ct.includes('gltf')) {
        return 'gltf';
    }
    return null;
}
