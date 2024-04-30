/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import { Program, Geometry, Transform, Sphere, type OGLRenderingContext } from 'ogl';

import { PLYLoader } from '@loaders.gl/ply';
import { load } from '@loaders.gl/core';

import vs from '@shaders/pointcloudvertex.glsl';
import fs from '@shaders/pointcloudfragment.glsl';

export function createSimplePointCloudProgram(gl: OGLRenderingContext) {
    const program = new Program(gl, {
        vertex: vs,
        fragment: fs,
        uniforms: {},
        transparent: false,
        cullFace: gl.NONE,
        depthTest: false,
        depthWrite: false,
    });
    return program;
}

export class MyPLYLoader {
    static async load(gl: OGLRenderingContext, url: string) {
        // Load PLY using loaders.gl
        // Note: this loader can also load point clouds without triangles
        const options = {};
        const data = await load(url, PLYLoader, options);

        let attributes: {
            position?: { size: 3; data: any };
            normal?: { size: 3; data: any };
            color?: { size: 3; data: any };
        } = {};
        if (data.attributes.POSITION != undefined) {
            attributes['position'] = { size: 3, data: data.attributes.POSITION.value };
        }
        if (data.attributes.NORMAL != undefined) {
            attributes['normal'] = { size: 3, data: data.attributes.NORMAL.value };
        }
        if (data.attributes.COLOR_0 != undefined) {
            attributes['color'] = { size: 3, data: data.attributes.COLOR_0.value };
        }
        const geometry = new Geometry(gl, attributes);
        return geometry;
    }
}
