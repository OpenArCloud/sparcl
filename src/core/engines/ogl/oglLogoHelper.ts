/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import { Program, Geometry, Transform, Plane, Texture, TextureLoader, type OGLRenderingContext } from 'ogl';

export function createLogoProgram(gl: OGLRenderingContext, texture: Texture | undefined) {
    const vertex = /* glsl */ `
        attribute vec2 uv;
        attribute vec3 position;
        attribute vec3 normal;

        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform mat3 normalMatrix;

        varying vec2 vUv;
        varying vec3 vNormal;

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);

            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragment = /* glsl */ `
        precision highp float;

        uniform sampler2D tMap;

        varying vec2 vUv;
        varying vec3 vNormal;

        void main() {
            vec3 normal = normalize(vNormal);
            vec3 tex = texture2D(tMap, vUv).rgb;
            float a = texture2D(tMap, vUv).a;

            vec3 light = normalize(vec3(0.5, 1.0, -0.3));
            float shading = dot(normal, light) * 0.15;

            gl_FragColor.rgb = tex + shading;
            gl_FragColor.a = a;
        }
    `;
    const program = new Program(gl, {
        vertex,
        fragment,
        transparent: true,
        uniforms: {
            tMap: { value: texture },
        },
        cullFace: gl.NONE, // Don't cull faces so that plane is double sided - default is gl.BACK
    });
    return program;
}

export async function loadLogoTexture(gl: OGLRenderingContext, url: string, format = 'RGBA') {
    let glFormat: number = gl.RGBA;
    switch (format) {
        case 'RGB':
            glFormat = gl.RGB;
            break;
        case 'RGBA':
            glFormat = gl.RGBA;
            break;
        default:
            console.log('Unknown texture format: ' + format);
            return;
    }
    const texture = TextureLoader.load(gl, { src: url, format: glFormat });
    return texture;
}
