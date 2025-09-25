/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/* Provides models for generic content, provided by the content discovery */

import { Box, Cylinder, Mesh, Plane, Program, Sphere, Torus, Transform, Vec4, type OGLRenderingContext } from 'ogl';

import defaultFragment from '@shaders/defaultfragment.glsl';
import defaultVertex from '@shaders/defaultvertex.glsl';
import waitingFragment from '@shaders/waitingfragment.glsl';
import { randomInteger } from '@src/core/common';
import type { ObjectDescription, ValueOf } from '../../../types/xr';

/**
 * The supported WebGL primitives.
 */
export const PRIMITIVES = Object.freeze({
    box: 'box',
    sphere: 'sphere',
    //plane: 'plane', // do not draw planes, they are invisible from one side
    cylinder: 'cylinder',
    cone: 'cone',
    torus: 'torus',
});

export let createProgram = (gl: OGLRenderingContext, { vertex = defaultVertex, fragment = defaultFragment, uniforms = {} }: { vertex?: string; fragment?: string; uniforms?: Record<string, any> }) =>
    new Program(gl, {
        vertex,
        fragment,
        uniforms,
    });

/**
 * General use GLSL program.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @param color  Color      Color array
 * @param transparent  Boolean      true to draw translucent according to alpha value in color
 * @returns {Program}
 */
export let createDefaultProgram = (gl: OGLRenderingContext, color: number[], transparent: boolean) =>
    new Program(gl, {
        vertex: defaultVertex,
        fragment: defaultFragment,
        transparent: transparent,
        uniforms: {
            uColor: { value: new Vec4(...color) },
        },
    });

/**
 * GLSL program used for objects offering an interactive feature.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @param color  Color      Color array
 * @param altColor  Color       Alternative color for color animation
 * @returns {Program}
 */
export let createWaitingProgram = (gl: OGLRenderingContext, color: number[], altColor: number[]) =>
    new Program(gl, {
        vertex: defaultVertex,
        fragment: waitingFragment,
        uniforms: {
            uColor: { value: new Vec4(...color) },
            uAltColor: { value: new Vec4(...altColor) },
            uTime: { value: 0.0 },
        },
    });

/**
 * Simple sample model to place for tests.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @param type  String      One of the supported object types
 * @param color  Color      Color array
 * @param translucent  Boolean      true to draw translucent according to alpha value in color
 * @param options  Object       Optional settings for created object
 * @param scale  number[]       Scale of the model
 * @returns {Mesh}
 */
export function createModel(
    gl: OGLRenderingContext,
    type: ValueOf<typeof PRIMITIVES> = PRIMITIVES.box,
    color: [number, number, number, number] = [0.2, 0.8, 1.0, 1.0],
    translucent = false,
    options: any = {},
    scale: [number, number, number] = [1.0, 1.0, 1.0],
) {
    let geometry;

    switch (type) {
        case PRIMITIVES.cone:
            geometry = new Cylinder(gl, {
                radiusTop: 0,
                ...options,
            });
            break;
        case PRIMITIVES.cylinder:
            geometry = new Cylinder(gl, options);
            break;
        case PRIMITIVES.plane:
            geometry = new Plane(gl, options);
            break;
        case PRIMITIVES.sphere:
            geometry = new Sphere(gl, options);
            break;
        case PRIMITIVES.torus:
            geometry = new Torus(gl, options);
            break;
        default:
            geometry = new Box(gl, options);
    }

    const program = createDefaultProgram(gl, color, translucent);
    const mesh = new Mesh(gl, {
        geometry: geometry,
        program: program,
        frustumCulled: false,
    });
    mesh.scale.set(...scale);
    return mesh;
}

/**
 * Creates a box with size X=0.1, Y=0.2, Z=0.3 and given color
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @param color  Color      Color array
 * @param showaxes  boolean     show local coordinate system access when true
 * @returns {Mesh}
 */
export function createAxesBoxPlaceholder(gl: OGLRenderingContext, color: [number, number, number, number], showaxes: boolean = true) {
    const placeholder = createModel(gl, PRIMITIVES.box, color, true);
    placeholder.scale.set(0.1, 0.2, 0.3);
    if (!showaxes) {
        return placeholder;
    }
    const xAxis = createModel(gl, PRIMITIVES.cone, [1.0, 0.0, 0.0, 0.7], true);
    xAxis.position.set(1.0, 0.0, 0.0);
    //xAxis.scale.set(0.1, 0.1/2.0, 0.1/3.0);
    xAxis.quaternion.set(0.0, 0.0, -0.7071, 0.7071);
    placeholder.addChild(xAxis);
    const yAxis = createModel(gl, PRIMITIVES.cone, [0.0, 1.0, 0.0, 0.7], true);
    yAxis.position.set(0.0, 1.0, 0.0);
    //yAxis.scale.set(0.1, 0.1/2.0, 0.1/3.0);
    yAxis.quaternion.set(0.0, 0.0, 0.0, 1.0);
    placeholder.addChild(yAxis);
    const zAxis = createModel(gl, PRIMITIVES.cone, [0.0, 0.0, 1.0, 0.7], true);
    zAxis.position.set(0.0, 0.0, 1.0);
    //zAxis.scale.set(0.1, 0.1/2.0, 0.1/3.0);
    zAxis.quaternion.set(0.7071, 0.0, 0.0, 0.7071);
    placeholder.addChild(zAxis);
    return placeholder;
}

/**
 * Creates a model for content type 'placeholder', based on optionally provided keywords.
 *
 * Positioning of the model needs to be done by the caller.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @returns {Mesh}
 */
export function getDefaultPlaceholder(gl: OGLRenderingContext) {
    const placeholder = createModel(gl, PRIMITIVES.sphere);
    placeholder.scale.set(0.5);
    return placeholder;
}

/**
 * Creates properties struct with random shape (out of predefined shapes), color, scale.
 */
export function createRandomObjectDescription(): ObjectDescription {
    const getRandomScaleValue = () => randomInteger(1, 10) / 50.0;
    const kNumPrimitives = Object.keys(PRIMITIVES).length;
    let shape_idx = Math.floor(Math.random() * kNumPrimitives);
    const primitiveKeys = Object.keys(PRIMITIVES) as Array<keyof typeof PRIMITIVES>;
    let shape = PRIMITIVES[primitiveKeys[shape_idx]];
    let color: [number, number, number, number] = [Math.random(), Math.random(), Math.random(), 1.0];
    //let scale = randomInteger(1,10)/10.0; // random scale out of 10 different values betwwen 0.1 and 1.0 (for outdoor)
    let scale: [number, number, number] = [getRandomScaleValue(), getRandomScaleValue(), getRandomScaleValue()]; // random scale out of 10 different values betwwen 0.02 and 0.2 (small for desktop debugging)
    let object_description: ObjectDescription = {
        version: 2,
        color,
        shape,
        scale,
        transparent: false,
        options: {},
    };
    return object_description;
}

/** Creates a Mesh with random shape (out of predefined shapes) and random color and size
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @returns {Mesh}
 */
export function createRandomObject(gl: OGLRenderingContext) {
    let object_description = createRandomObjectDescription();
    return createModel(gl, object_description.shape, object_description.color, object_description.transparent, object_description.options, object_description.scale);
}

/**
 * Generates a placeholder used for content of type scene.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @returns {Mesh}
 */
export function getExperiencePlaceholder(gl: OGLRenderingContext) {
    const placeholder = createModel(gl, PRIMITIVES.box, [1, 1, 0, 1]);
    placeholder.scale.set(0.5);
    return placeholder;
}

/**
 * Used when no specific object was declared for a marker.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @returns {Mesh}
 */
export function getDefaultMarkerObject(gl: OGLRenderingContext) {
    const object = createModel(gl, PRIMITIVES.box, [0.75, 0.0, 0.0, 1.0]);
    object.scale.set(0.02);
    return object;
}

/**
 * Add axes at the zero point of the local coordinate system.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @returns {Transform}
 */
export function getAxes(gl: OGLRenderingContext) {
    const container = new Transform();

    // add something small at the positive X, Y, Z:
    const xAxis = createModel(gl, PRIMITIVES.box, [1, 0, 0, 1]);
    xAxis.position.set(1, 0.05, 0);
    xAxis.scale.set(0.1);
    xAxis.setParent(container);

    const yAxis = createModel(gl, PRIMITIVES.sphere, [0, 1, 0, 1]);
    yAxis.position.set(0, 1, 0);
    yAxis.scale.set(0.1);
    yAxis.setParent(container);

    const zAxis = createModel(gl, PRIMITIVES.cone, [0, 0, 1, 1]);
    zAxis.position.set(0, 0.05, 1);
    zAxis.scale.set(0.1);
    zAxis.setParent(container);

    const zero = createModel(gl, PRIMITIVES.box, [1, 1, 1, 1]);
    zero.scale.set(0.05);
    zero.setParent(container);

    const xzPlane = createModel(gl, PRIMITIVES.plane, [1, 1, 1, 0.5], true);
    xzPlane.rotation.x = -Math.PI / 2;
    xzPlane.position.set(0.5, 0, 0.5);
    xzPlane.setParent(container);

    return container;
}

/**
 * Reticle used for hit testing.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @returns {Mesh}
 */
export function getReticle(gl: OGLRenderingContext) {
    const placeholder = new Sphere(gl, {
        radius: 0.3,
        thetaLength: Math.PI / 2,
    });

    const program = createDefaultProgram(gl, [1, 1, 1, 1], false);
    return new Mesh(gl, {
        geometry: placeholder,
        program: program,
        frustumCulled: false,
    });
}
