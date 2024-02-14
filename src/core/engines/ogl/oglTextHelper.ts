/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

// Code adapted from https://github.com/oframe/ogl/blob/master/examples/msdf-text.html
/*
    Instructions to generate necessary MSDF assets

    Install msdf-bmfont https://github.com/soimy/msdf-bmfont-xml
    `npm install msdf-bmfont-xml -g`

    Then, using a font .ttf file, run the following (using 'FiraSans-Bold.ttf' as example)

    `msdf-bmfont -f json -m 512,512 -d 2 --pot --smart-size FiraSans-Bold.ttf`

    Outputs a .png bitmap spritesheet and a .json with character parameters.
*/


import { Geometry, Texture, Program, Mesh, Text, Vec3, Transform, type OGLRenderingContext } from 'ogl';

const vertex = /* glsl */ `
    attribute vec2 uv;
    attribute vec3 position;

    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    varying vec2 vUv;

    void main() {
        vUv = uv;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragment = /* glsl */ `
    uniform sampler2D tMap;

    varying vec2 vUv;

    void main() {
        vec3 tex = texture2D(tMap, vUv).rgb;
        float signedDist = max(min(tex.r, tex.g), min(max(tex.r, tex.g), tex.b)) - 0.5;
        float d = fwidth(signedDist);
        float alpha = smoothstep(-d, d, signedDist);

        if (alpha < 0.01) discard;

        gl_FragColor.rgb = vec3(0.0);
        gl_FragColor.a = alpha;
    }
`;

const vertex300 =
    /* glsl */ `#version 300 es
    #define attribute in
    #define varying out
` + vertex;

const fragment300 =
    /* glsl */ `#version 300 es
    precision highp float;
    #define varying in
    #define texture2D texture
    #define gl_FragColor FragColor
    out vec4 FragColor;
` + fragment;

export async function loadTextMesh(gl: OGLRenderingContext, fontName:string, string:string) {

    const font = await (await fetch('media/fonts/' + fontName + '.json')).json();

    const texture = new Texture(gl, {
        generateMipmaps: false,
    });
    const img = new Image();
    img.onload = () => (texture.image = img);
    img.src = 'media/fonts/' + fontName + '.png';

    const program = new Program(gl, {
        vertex: vertex300,
        fragment: fragment300,
        uniforms: {
            tMap: { value: texture },
        },
        transparent: true,
        cullFace: false,
        depthWrite: false,
    });

    const text = new Text({
        font,
        text: string,
        width: 6,
        align: 'center',
        letterSpacing: -0.05,
        size: 1,
        lineHeight: 1.1,
    });

    // Pass the generated buffers into a geometry
    const geometry = new Geometry(gl, {
        position: { size: 3, data: text.buffers.position },
        uv: { size: 2, data: text.buffers.uv },
        // id provides a per-character index, for effects that may require it
        id: { size: 1, data: text.buffers.id },
        index: { data: text.buffers.index },
    });

    const mesh = new Mesh(gl, { geometry, program });

    // Use the height value to position text vertically. Here it is centered.
    mesh.position.y = text.height * 0.5;
    return mesh;
}
