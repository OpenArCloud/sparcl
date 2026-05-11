/*
  (c) 2023 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

attribute vec3 position;
attribute vec3 vertexColor;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

varying vec3 vColor;

void main() {
    vColor = vertexColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 10.0;
}
