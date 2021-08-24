/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

/* Provides models for generic content, provided by the content discovery */


import {Box, Cylinder, Mesh, Plane, Program, Sphere, Torus, Transform, Vec4} from 'ogl';

import defaultFragment from '@shaders/defaultfragment.glsl';
import defaultVertex from '@shaders/defaultvertex.glsl';
import waitingFragment from '@shaders/waitingfragment.glsl';
import {randomInteger} from '@src/core/common';


/**
 * The supported WebGL primitives.
 *
 * @type {Readonly<{plane: string, sphere: string, box: string, cylinder: string, cone: string, torus: string}>}
 */
export const PRIMITIVES = Object.freeze({
    box: 'box',
    sphere: 'sphere',
    plane: 'plane',
    cylinder: 'cylinder',
    cone: 'cone',
    torus: 'torus'
});

export let createProgram = (gl, {vertex = defaultVertex, fragment = defaultFragment, uniforms = {}}) => new Program(gl, {
    vertex, fragment, uniforms
})

/**
 * General use GLSL program.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @param color  Color      Color array
 * @param transparent  Boolean      true to draw translucent according to alpha value in color
 * @returns {Program}
 */
export let createDefaultProgram = (gl, color, transparent) => new Program(gl, {
    vertex: defaultVertex,
    fragment: defaultFragment,
    transparent: transparent,
    uniforms: {
        uColor: {value: new Vec4(...color)}
    }
})

/**
 * GLSL program used for objects offering an interactive feature.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @param color  Color      Color array
 * @param altColor  Color       Alternative color for color animation
 * @returns {Program}
 */
export let createWaitingProgram = (gl, color, altColor) => new Program(gl, {
    vertex: defaultVertex,
    fragment: waitingFragment,
    uniforms: {
        uColor: {value: new Vec4(...color)},
        uAltColor: {value: new Vec4(...altColor)},
        uTime: {value: 0.0}
    }
})

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
export function createModel(gl,
                            type = PRIMITIVES.box,
                            color = [0.2, 0.8, 1.0, 1.0],
                            translucent = false,
                            options = {},
                            scale = [1.0, 1.0, 1.0]) {
    let geometry;

    switch (type) {
        case PRIMITIVES.cone:
            geometry = new Cylinder(gl, {
                radiusTop: 0,
                ...options
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
    const mesh = new Mesh(gl, { geometry: geometry, program });
    mesh.scale.set(scale);
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
export function createAxesBoxPlaceholder(gl, color, showaxes=true) {
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
export function getDefaultPlaceholder(gl) {
    const placeholder = createModel(gl, PRIMITIVES.sphere);
    placeholder.scale.set(.5);
    return placeholder;
}

/**
 * Creates properties struct with random shape (out of predefined shapes), color, scale.
 *
 * @returns {{color: (number|number)[], shape, options: {}, scale: number, version: number, transparent: boolean}}
 */
export function createRandomObjectDescription() {
    const kNumPrimitives = Object.keys(PRIMITIVES).length;
    let shape_idx = Math.floor(Math.random() * kNumPrimitives);
    let shape = PRIMITIVES[Object.keys(PRIMITIVES)[shape_idx]];
    let color = [Math.random(), Math.random(), Math.random(), 1.0];
    //let scale = randomInteger(1,10)/10.0; // random scale out of 10 different values betwwen 0.1 and 1.0 (for outdoor)
    let scale = randomInteger(1,10)/50.0; // random scale out of 10 different values betwwen 0.02 and 0.2 (small for desktop debugging)
    let object_description = {
        'version': 2,
        'color': color,
        'shape': shape,
        'scale': scale,
        'transparent': false,
        'options': {}
    };
    return object_description
}

/** Creates a Mesh with random shape (out of predefined shapes) and random color and size
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @returns {Mesh}
*/
export function createRandomObject(gl) {
    let object_description = createRandomObjectDescription();
    return createModel(gl, object_description.shape, object_description.color,
        object_description.transparent, object_description.options, object_description.scale);
}

/**
 * Generates a placeholder used for content of type scene.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @returns {Mesh}
 */
export function getExperiencePlaceholder(gl) {
    const placeholder = createModel(gl, PRIMITIVES.box, [1, 1, 0, 1]);
    placeholder.scale.set(.5);
    return placeholder;
}


/**
 * Used when no specific object was declared for a marker.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @returns {Mesh}
 */
export function getDefaultMarkerObject(gl) {
    const object = createModel(gl, PRIMITIVES.box, [.5, 1, 0]);
    object.scale.set(0.1);
    return object;
}


/**
 * Add axes at the zero point of the local coordinate system.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @returns {Transform}
 */
export function getAxes(gl) {
    const container = new Transform();

    // add something small at the positive X, Y, Z:
    const xAxis = createModel(gl, PRIMITIVES.box, [1, 0, 0, 1]);
    xAxis.position.set( 1, 0.05, 0);
    xAxis.scale.set(0.1);
    xAxis.setParent(container);

    const yAxis = createModel(gl,PRIMITIVES.sphere, [0, 1, 0, 1]);
    yAxis.position.set(0, 1, 0);
    yAxis.scale.set(0.1);
    yAxis.setParent(container);

    const zAxis = createModel(gl,PRIMITIVES.cone, [0, 0, 1, 1]);
    zAxis.position.set(0, 0.05, 1);
    zAxis.scale.set(0.1);
    zAxis.setParent(container);

    const zero = createModel(gl,PRIMITIVES.box, [1, 0, 0, 1]);
    zero.scale.set(0.05);
    zero.setParent(container);

    const xzPlane = createModel(gl, PRIMITIVES.plane, [1, 1, 1, 0.5], true)
    xzPlane.rotation.x = (-Math.PI / 2);
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
export function getReticle(gl) {
    const placeholder = new Sphere(gl, {
        radius: 0.3,
        thetaLength: Math.PI / 2
    });

    const program = createDefaultProgram(gl, [1, 1, 1, 1], false);
    return new Mesh(gl, { geometry: placeholder, program });
}
