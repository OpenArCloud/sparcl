/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

/* Provides models for generic content, provided by the content discovery */


import { Box, Cylinder, Mesh, Plane, Program, Sphere, Transform, Vec4 } from 'ogl';

export const PRIMITIVES = {
    box: 'box',
    sphere: 'sphere',
    plane: 'plane',
    cylinder: 'cylinder',
    cone: 'cone'
}


// TODO: Allow to set attributes from SCD, or even load shaders
const defaultVertex = /* glsl */ `
    attribute vec3 position;
    attribute vec3 normal;
    
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    uniform mat3 normalMatrix;

    varying vec3 vNormal;

    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
const defaultFragment = /* glsl */ `
    precision highp float;
    
    varying vec3 vNormal;
    
    uniform vec4 uColor;

    void main() {
        vec3 normal = normalize(vNormal);
        float lighting = dot(normal, normalize(vec3(-0.3, 0.8, 0.6)));
        gl_FragColor.rgb = uColor.rgb + lighting * 0.1;
        gl_FragColor.a = uColor.a;
    }
`;
const waitingFragment = /* glsl */ `
    precision highp float;
    
    varying vec3 vNormal;
    
    uniform vec4 uColor;
    uniform vec4 uAltColor;
    uniform float uTime;

    void main() {
        vec3 normal = normalize(vNormal);
        float lighting = dot(normal, normalize(vec3(-0.3, 0.8, 0.6)));
        
        gl_FragColor.rgb = smoothstep(uColor.rgb, uAltColor.rgb, vec3(sin(uTime))) + lighting * 0.1;
        gl_FragColor.a = uColor.a;
    }
`;

export let createDefaultProgram = (gl, color, transparent) => new Program(gl, {
    vertex: defaultVertex,
    fragment: defaultFragment,
    transparent: transparent,
    uniforms: {
        uColor: {value: new Vec4(...color)}
    }
})

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
 * @returns {Mesh}
 */
export function createModel(gl, type = PRIMITIVES.box,
                            color = [0.2, 0.8, 1.0, 1.0], translucent = false) {
    let geometry;

    switch (type) {
        case PRIMITIVES.cone:
            geometry = new Cylinder(gl, {
                radiusTop: 0
            });
            break;
        case PRIMITIVES.cylinder:
            geometry = new Cylinder(gl);
            break;
        case PRIMITIVES.plane:
            geometry = new Plane(gl);
            break;
        case PRIMITIVES.sphere:
            geometry = new Sphere(gl);
            break;
        default:
            geometry = new Box(gl);
    }

    const program = createDefaultProgram(gl, color, translucent);

    return new Mesh(gl, { geometry: geometry, program });
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
