/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * Placeholder primitives with optional OGL-style custom fragment shaders for Three.js.
 */

import * as THREE from 'three';
import type { PrimitiveShape } from '@core/contents/primitives';
import { geometryForShapeWithOptions, type PrimitiveGeometryOptions } from './threePrimitives';

// Three.js ShaderMaterial prepends built-in attributes (position, normal, uv) and
// standard uniforms (modelViewMatrix, projectionMatrix, normalMatrix, …). With
// glslVersion GLSL3, the prefix uses `attribute` which is #defined to `in`.
// Do NOT redeclare position / normal / uv here — that causes GLSL redefinition errors.
const placeholderVertexShader = /* glsl */ `
out vec2 vUv;
out vec3 vNormal;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Adapt GLSL1 OGL experiment fragments (varying / gl_FragColor) to WebGL2 for Three. */
export function adaptOglFragmentForThree(fragment: string): string {
    let src = fragment.trim();
    if (!/\bprecision\s+/.test(src)) {
        src = `precision highp float;\n\n${src}`;
    }
    src = src.replace(/\bvarying\s+vec2\s+vUv\s*;/g, 'in vec2 vUv;');
    src = src.replace(/\bvarying\s+vec3\s+vNormal\s*;/g, 'in vec3 vNormal;');
    if (!/\bout\s+vec4\s+fragColor\s*;/.test(src)) {
        src = src.replace(/^precision highp float;\s*/m, (match) => `${match}out vec4 fragColor;\n\n`);
    }
    return src.replace(/\bgl_FragColor\b/g, 'fragColor');
}

export type PlaceholderMeshResult = {
    mesh: THREE.Mesh;
    /** When set, {@link ThreeEngine} should drive `uniforms.uTime` each frame. */
    timedMaterial: THREE.ShaderMaterial | null;
};

export function createPlaceholderMesh(
    shape: PrimitiveShape,
    color: [number, number, number, number],
    fragmentShader: string | undefined,
    options: PrimitiveGeometryOptions = {},
): PlaceholderMeshResult {
    const geometry = geometryForShapeWithOptions(shape, options);
    geometry.computeVertexNormals();

    if (fragmentShader !== undefined) {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
            },
            vertexShader: placeholderVertexShader,
            fragmentShader: adaptOglFragmentForThree(fragmentShader),
            glslVersion: THREE.GLSL3,
            side: THREE.DoubleSide,
        });
        material.userData.threeTimedShader = true;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        return { mesh, timedMaterial: material };
    }

    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color[0], color[1], color[2]),
        opacity: color[3],
        transparent: color[3] < 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    return { mesh, timedMaterial: null };
}
