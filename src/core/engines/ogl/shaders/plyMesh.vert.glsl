/*
  (c) 2023 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

attribute vec3 position;
attribute vec3 vertexColor;
attribute vec3 normal;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

varying vec3 vColor;
varying vec3 vNormal;

void main() {
    vColor = vertexColor;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
