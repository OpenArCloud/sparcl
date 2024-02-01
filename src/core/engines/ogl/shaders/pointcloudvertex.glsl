/*
  (c) 2023 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

attribute vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 10.0; // only applicable for gl.POINTS draw mode
}
