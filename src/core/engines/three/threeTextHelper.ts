/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * MSDF text meshes for Three.js, matching {@link oglTextHelper} font assets and layout.
 */

import * as THREE from 'three';
import { Text } from 'ogl';
import type { ReadonlyVec3 } from 'gl-matrix';

const DEFAULT_FONT_NAME = 'MgOpenModernaRegular';

const textVertexShader = /* glsl */ `
// Note: 'position' and 'uv' are NOT declared here because Three.js automatically
// prepends them as built-in attribute declarations to every ShaderMaterial vertex shader.
// Redeclaring them would cause a GLSL "redefinition" compile error.
out vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const textFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D tMap;
uniform vec3 textColor;

in vec2 vUv;

out vec4 fragColor;

void main() {
    vec3 tex = texture(tMap, vUv).rgb;
    float signedDist = max(min(tex.r, tex.g), min(max(tex.r, tex.g), tex.b)) - 0.5;
    float d = fwidth(signedDist);
    float alpha = smoothstep(-d, d, signedDist);

    if (alpha < 0.01) {
        discard;
    }

    fragColor = vec4(textColor, alpha);
}
`;

type FontAssets = {
    font: Record<string, unknown>;
    texture: THREE.Texture;
};

const fontAssetsByName = new Map<string, Promise<FontAssets>>();

function fontBasePath(fontName: string): string {
    return `/media/fonts/${fontName}`;
}

async function loadFontAssets(fontName: string): Promise<FontAssets> {
    const cached = fontAssetsByName.get(fontName);
    if (cached) {
        return cached;
    }

    const promise = (async () => {
        const jsonResponse = await fetch(`${fontBasePath(fontName)}.json`);
        if (!jsonResponse.ok) {
            throw new Error(`Three text: failed to load font JSON ${fontName} (${jsonResponse.status})`);
        }
        const font = (await jsonResponse.json()) as Record<string, unknown>;

        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
            new THREE.TextureLoader().load(`${fontBasePath(fontName)}.png`, resolve, undefined, reject);
        });
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.colorSpace = THREE.NoColorSpace;
        texture.userData.sharedThreeFontAtlas = true;

        return { font, texture };
    })();

    fontAssetsByName.set(fontName, promise);
    return promise;
}

/**
 * Build an MSDF text {@link THREE.Mesh} using the same font atlas and layout parameters as OGL.
 */
export async function createThreeTextMesh(
    text: string,
    textColor: ReadonlyVec3 = [1, 1, 1],
    fontName: string = DEFAULT_FONT_NAME,
): Promise<THREE.Mesh> {
    const { font, texture } = await loadFontAssets(fontName);

    const layout = new Text({
        font,
        text,
        width: 6,
        align: 'center',
        letterSpacing: -0.05,
        size: 1,
        lineHeight: 1.1,
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(layout.buffers.position, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(layout.buffers.uv, 2));
    geometry.setIndex(new THREE.BufferAttribute(layout.buffers.index, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            tMap: { value: texture },
            textColor: { value: new THREE.Vector3(textColor[0], textColor[1], textColor[2]) },
        },
        vertexShader: textVertexShader,
        fragmentShader: textFragmentShader,
        glslVersion: THREE.GLSL3,
        transparent: true,
        depthWrite: true,
        side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    // Match OGL vertical centering (see oglTextHelper).
    mesh.position.y = layout.height * 0.5;
    return mesh;
}
