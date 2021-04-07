/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

/* Provides models for generic content, provided by the content discovery */


import { Box, Color, Cylinder, Mesh, Plane, Program, Sphere, Transform } from 'ogl';

export const PRIMITIVES = {
    box: 'box',
    sphere: 'sphere',
    plane: 'plane',
    cylinder: 'cylinder',
    cone: 'cone'
}

// TODO: Allow to set attributes from SCD, or even load shaders
const vertex = /* glsl */ `
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
const fragment = /* glsl */ `
                precision highp float;
                
                varying vec3 vNormal;
                
                uniform vec3 uColor;

                void main() {
                    vec3 normal = normalize(vNormal);
                    float lighting = dot(normal, normalize(vec3(-0.3, 0.8, 0.6)));
                    gl_FragColor.rgb = uColor + lighting * 0.1;
                    gl_FragColor.a = 1.0;
                }
            `;


/**
 * Simple sample model to place for tests.
 *
 * @param gl  WebGLRenderingContextContext      Context of the WebXR canvas
 * @param type  String      One of the supported object types
 * @param color  Color      Playcanvas color object
 * @returns {Mesh}
 */
export function createModel(gl, type = PRIMITIVES.box, color = [0.2, 0.8, 1.0]) {
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

    const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
            uColor: { value: new Color(...color)  }
        }
    });

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


export function getDefaultMarkerObject(gl) {
    const object = createModel(gl, PRIMITIVES.box, [1, 1, 0]);
    object.scale.set(0.5);
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
    const xAxis = createModel(gl, PRIMITIVES.box, [1, 0, 0]);
    xAxis.position.set( 1, 0, 0);
    xAxis.scale.set(0.1);
    xAxis.setParent(container);

    const yAxis = createModel(gl,PRIMITIVES.sphere, [0, 1, 0]);
    yAxis.position.set(0, 1, 0);
    yAxis.scale.set(0.1);
    yAxis.setParent(container);

    const zAxis = createModel(gl,PRIMITIVES.cone, [0, 0, 1]);
    zAxis.position.set(0, 0, 1);
    zAxis.scale.set(0.1);
    zAxis.setParent(container);

    const zero = createModel(gl,PRIMITIVES.box, [1, 0, 0]);
    zAxis.position.set(0, 0, 0);
    zero.scale.set(0.05);
    zero.setParent(container);

    return container;
}
