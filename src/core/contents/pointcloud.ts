/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  Point cloud / PLY display options for Spatial Content Records and engines.
*/

/** How per-vertex colors are chosen when building the draw buffers. */
export type PlyColorMode = 'auto' | 'vertex' | 'uniform';

export type PlyLoadOptions = {
    colorMode?: PlyColorMode;
    /** RGB in 0..1; used for `uniform` / `auto` without file colors, and as fallback for `vertex` when the file has no colors. */
    uniformColor?: readonly [number, number, number];
};

/**
 * Parse SCR `definitions` string map into PLY / point-cloud display options (`plyColorMode`, `plyUniformColor`).
 */
export function parseScrPlyLoadOptions(definitions: Record<string, string>): PlyLoadOptions | undefined {
    const out: PlyLoadOptions = {};
    const mode = definitions['plyColorMode'];
    if (mode === 'auto' || mode === 'vertex' || mode === 'uniform') {
        out.colorMode = mode;
    }
    const ucs = definitions['plyUniformColor'];
    if (ucs) {
        const parts = ucs
            .split(/[,\s]+/)
            .map((s) => parseFloat(s.trim()))
            .filter((n) => !Number.isNaN(n));
        if (parts.length >= 3) {
            out.uniformColor = [parts[0]!, parts[1]!, parts[2]!];
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
