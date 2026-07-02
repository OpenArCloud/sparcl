/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import { Program, Geometry, type OGLRenderingContext } from 'ogl';

import { PLYLoader } from '@loaders.gl/ply';
import { parse } from '@loaders.gl/core';

import plyPointsVs from '@shaders/plyPoints.vert.glsl';
import plyPointsFs from '@shaders/plyPoints.frag.glsl';
import plyMeshVs from '@shaders/plyMesh.vert.glsl';
import plyMeshFs from '@shaders/plyMesh.frag.glsl';

/** How per-vertex colors are chosen when building the draw buffers. */
export type PlyColorMode = 'auto' | 'vertex' | 'uniform';

export type PlyLoadOptions = {
    colorMode?: PlyColorMode;
    /** RGB in 0..1; used for `uniform` / `auto` without file colors, and as fallback for `vertex` when the file has no colors. */
    uniformColor?: readonly [number, number, number];
};

export type LoadedPlyDisplay = {
    geometry: Geometry;
    /** `gl.POINTS` for point clouds, `gl.TRIANGLES` for indexed triangle meshes */
    mode: number;
    primitive: 'points' | 'triangles';
};

const DEFAULT_UNIFORM_COLOR: Readonly<[number, number, number]> = [0.9, 0.9, 0.0];

type PlyAttribute = {
    value: ArrayLike<number>;
    size: number;
    normalized?: boolean;
};

type PlyMeshData = {
    attributes: Record<string, PlyAttribute>;
    indices?: { value: ArrayLike<number>; size: number };
    topology?: string;
};

const programCache = new WeakMap<
    OGLRenderingContext,
    {
        points?: Program;
        mesh?: Program;
    }
>();

export function getPlyPointsProgram(gl: OGLRenderingContext): Program {
    let forGl = programCache.get(gl);
    if (!forGl) {
        forGl = {};
        programCache.set(gl, forGl);
    }
    if (!forGl.points) {
        forGl.points = new Program(gl, {
            vertex: plyPointsVs,
            fragment: plyPointsFs,
            uniforms: {},
            transparent: false,
            cullFace: gl.NONE,
            depthTest: true, //false,
            depthWrite: true, //false,
        });
    }
    return forGl.points;
}

export function getPlyMeshProgram(gl: OGLRenderingContext): Program {
    let forGl = programCache.get(gl);
    if (!forGl) {
        forGl = {};
        programCache.set(gl, forGl);
    }
    if (!forGl.mesh) {
        forGl.mesh = new Program(gl, {
            vertex: plyMeshVs,
            fragment: plyMeshFs,
            uniforms: {},
            transparent: false,
            cullFace: gl.BACK,
            depthTest: true,
            depthWrite: true,
        });
    }
    return forGl.mesh;
}

function hasUsableVertexColors(attr: PlyAttribute | undefined, vertexCount: number): boolean {
    if (!attr?.value) return false;
    const perVertex = attr.size > 0 ? attr.size : 3;
    return attr.value.length >= vertexCount * perVertex;
}

function readColorComponent(src: ArrayLike<number>, idx: number): number {
    const raw = Number(src[idx]);
    if (src instanceof Uint8Array) {
        return raw / 255;
    }
    return raw;
}

/**
 * One RGB triplet per vertex as Float32 (shader uses non-normalized float attributes).
 */
function buildPerVertexColors(
    data: PlyMeshData,
    vertexCount: number,
    colorMode: PlyColorMode,
    uniformColor: Readonly<[number, number, number]>,
): Float32Array {
    const out = new Float32Array(vertexCount * 3);
    const c0 = data.attributes.COLOR_0;
    const fileOk = hasUsableVertexColors(c0, vertexCount);
    const wantFile = fileOk && (colorMode === 'vertex' || colorMode === 'auto');

    if (wantFile && c0) {
        const src = c0.value;
        const stride = c0.size >= 3 ? c0.size : 3;
        for (let i = 0; i < vertexCount; i++) {
            const base = i * stride;
            out[i * 3] = readColorComponent(src, base);
            out[i * 3 + 1] = readColorComponent(src, base + 1);
            out[i * 3 + 2] = readColorComponent(src, base + 2);
        }
    } else {
        const [r, g, b] = uniformColor;
        for (let i = 0; i < vertexCount; i++) {
            out[i * 3] = r;
            out[i * 3 + 1] = g;
            out[i * 3 + 2] = b;
        }
    }
    return out;
}

function buildDefaultNormals(vertexCount: number): Float32Array {
    const out = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
        out[i * 3] = 0;
        out[i * 3 + 1] = 1;
        out[i * 3 + 2] = 0;
    }
    return out;
}

function copyNormalsFromFile(data: PlyMeshData, vertexCount: number): Float32Array {
    const n = data.attributes.NORMAL;
    const out = buildDefaultNormals(vertexCount);
    if (!hasUsableVertexColors(n, vertexCount)) {
        return out;
    }
    const src = n!.value;
    const stride = n!.size >= 3 ? n!.size : 3;
    for (let i = 0; i < vertexCount; i++) {
        const base = i * stride;
        out[i * 3] = Number(src[base]);
        out[i * 3 + 1] = Number(src[base + 1]);
        out[i * 3 + 2] = Number(src[base + 2]);
    }
    return out;
}

function toUint32IndexArray(indices: { value: ArrayLike<number>; size: number }): Uint32Array {
    const { value, size } = indices;
    const n = value.length / Math.max(size, 1);
    const out = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
        out[i] = Math.max(0, Math.floor(Number(value[i * size])));
    }
    return out;
}

function stripLeadingUtf8Bom(ab: ArrayBuffer): ArrayBuffer {
    const u8 = new Uint8Array(ab);
    if (u8.byteLength >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
        return ab.slice(3);
    }
    return ab;
}

/** True if buffer begins (after optional UTF-8 BOM) with ASCII "ply". */
function isPlyMagic(ab: ArrayBuffer): boolean {
    const u8 = new Uint8Array(ab);
    let o = 0;
    if (u8.byteLength >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
        o = 3;
    }
    return (
        u8.byteLength - o >= 3 &&
        u8[o] === 0x70 &&
        u8[o + 1] === 0x6c &&
        u8[o + 2] === 0x79
    );
}

function firstBytesHex(ab: ArrayBuffer, n: number): string {
    const u8 = new Uint8Array(ab, 0, Math.min(n, ab.byteLength));
    return Array.from(u8)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
}

export class MyPLYLoader {
    /**
     * Load a PLY file into OGL geometry suitable for point or triangle rendering.
     * Point clouds use `gl.POINTS`; triangle meshes use indexed `gl.TRIANGLES` when the PLY defines faces.
     */
    static async loadDisplayGeometry(
        gl: OGLRenderingContext,
        url: string,
        options: PlyLoadOptions = {},
    ): Promise<LoadedPlyDisplay | null> {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`PLY load: HTTP ${res.status} for ${url}`);
            return null;
        }
        const rawAb = await res.arrayBuffer();
        const ab = stripLeadingUtf8Bom(rawAb);
        if (ab.byteLength < 12) {
            console.error(`PLY load: empty or truncated body for ${url} (${ab.byteLength} bytes)`);
            return null;
        }
        if (!isPlyMagic(ab)) {
            console.error(
                `PLY load: ${url} is not PLY data (expected header "ply"). Often means a missing static file (HTML fallback) or wrong URL. First bytes (hex): ${firstBytesHex(ab, 24)}`,
            );
            return null;
        }
        const data = (await parse(ab, PLYLoader, { worker: false })) as PlyMeshData;

        if (data == null) {
            return null;
        }

        const posAttr = data.attributes.POSITION;
        if (!posAttr?.value || posAttr.size < 3) {
            return null;
        }
        const vertexCount = posAttr.value.length / posAttr.size;
        if (vertexCount < 1) {
            return null;
        }

        const colorMode: PlyColorMode = options.colorMode ?? 'auto';
        const uniformColor: Readonly<[number, number, number]> = options.uniformColor
            ? ([options.uniformColor[0], options.uniformColor[1], options.uniformColor[2]] as const)
            : DEFAULT_UNIFORM_COLOR;

        const positionData =
            posAttr.value instanceof Float32Array
                ? posAttr.value
                : Float32Array.from(posAttr.value as ArrayLike<number>);

        const vertexColors = buildPerVertexColors(data, vertexCount, colorMode, uniformColor);

        const idx = data.indices;
        const indexCount = idx?.value ? idx.value.length / Math.max(idx.size || 1, 1) : 0;
        const isMesh = indexCount > 0;

        try {
            if (isMesh) {
                const indexAttr = toUint32IndexArray(idx!);
                const normals = copyNormalsFromFile(data, vertexCount);
                const geometry = new Geometry(gl, {
                    position: { size: 3, data: positionData },
                    vertexColor: { size: 3, data: vertexColors },
                    normal: { size: 3, data: normals },
                    index: { data: indexAttr },
                });
                return { geometry, mode: gl.TRIANGLES, primitive: 'triangles' };
            }

            const geometry = new Geometry(gl, {
                position: { size: 3, data: positionData },
                vertexColor: { size: 3, data: vertexColors },
            });
            return { geometry, mode: gl.POINTS, primitive: 'points' };
        } catch {
            return null;
        }
    }
}
