/*
  (c) 2023 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

precision highp float;

varying vec3 vColor;

void main() {
    gl_FragColor = vec4(vColor, 1.0);
}
