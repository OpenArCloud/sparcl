/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * PLY → {@link THREE.BufferGeometry} for the Three engine.
 */

import * as THREE from 'three';
import { PLYLoader } from '@loaders.gl/ply';
import { parse } from '@loaders.gl/core';

import type { PlyColorMode, PlyLoadOptions } from '@core/contents/pointcloud';

const defaultUniformColor: Readonly<[number, number, number]> = [0.9, 0.9, 0.0];

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

function buildPerVertexColors(
    data: PlyMeshData,
    vertexCount: number,
    colorMode: PlyColorMode,
    uniformColor: Readonly<[number, number, number]>,
): Float32Array {
    const out = new Float32Array(vertexCount * 3);
    const color0 = data.attributes.COLOR_0;
    const fileOk = hasUsableVertexColors(color0, vertexCount);
    const wantFile = fileOk && (colorMode === 'vertex' || colorMode === 'auto');

    if (wantFile && color0) {
        const src = color0.value;
        const stride = color0.size >= 3 ? color0.size : 3;
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
    const normalAttr = data.attributes.NORMAL;
    const out = buildDefaultNormals(vertexCount);
    if (!hasUsableVertexColors(normalAttr, vertexCount)) {
        return out;
    }
    const src = normalAttr!.value;
    const stride = normalAttr!.size >= 3 ? normalAttr!.size : 3;
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

function isPlyMagic(ab: ArrayBuffer): boolean {
    const u8 = new Uint8Array(ab);
    let offset = 0;
    if (u8.byteLength >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
        offset = 3;
    }
    return (
        u8.byteLength - offset >= 3 &&
        u8[offset] === 0x70 &&
        u8[offset + 1] === 0x6c &&
        u8[offset + 2] === 0x79
    );
}

function firstBytesHex(ab: ArrayBuffer, n: number): string {
    const u8 = new Uint8Array(ab, 0, Math.min(n, ab.byteLength));
    return Array.from(u8)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
}

export type LoadedThreePly = {
    geometry: THREE.BufferGeometry;
    primitive: 'points' | 'triangles';
};

/**
 * Fetch and parse PLY into a Three {@link THREE.BufferGeometry} (points or indexed mesh).
 */
export async function loadThreePlyFromUrl(url: string, options: PlyLoadOptions = {}): Promise<LoadedThreePly | null> {
    try {
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
                `PLY load: ${url} is not PLY data (expected header "ply"). First bytes (hex): ${firstBytesHex(ab, 24)}`,
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
            : defaultUniformColor;

        const positionData =
            posAttr.value instanceof Float32Array
                ? posAttr.value
                : Float32Array.from(posAttr.value as ArrayLike<number>);

        const vertexColors = buildPerVertexColors(data, vertexCount, colorMode, uniformColor);

        const idx = data.indices;
        const indexCount = idx?.value ? idx.value.length / Math.max(idx.size || 1, 1) : 0;
        const isMesh = indexCount > 0;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positionData, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));

        if (isMesh) {
            const indexArray = toUint32IndexArray(idx!);
            // Three r184 may store a bare TypedArray on `geometry.index` when using `setIndex(typedArray)`,
            // which has no `.array`; some WebGL paths expect a BufferAttribute. Wrap explicitly.
            geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
            const normals = copyNormalsFromFile(data, vertexCount);
            geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            return { geometry, primitive: 'triangles' };
        }

        return { geometry, primitive: 'points' };
    } catch (error) {
        console.error(`PLY load: failed for ${url}`, error);
        return null;
    }
}
