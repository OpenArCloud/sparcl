/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

attribute vec3 position;
attribute vec3 normal;
//attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

varying vec3 vNormal;
//varying vec2 vUv;

void main() {
    vNormal = normalize(normalMatrix * normal);
    //vUv = uv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
