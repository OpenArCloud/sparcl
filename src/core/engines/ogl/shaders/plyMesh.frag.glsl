/*
  (c) 2023 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

precision highp float;

varying vec3 vColor;
varying vec3 vNormal;

void main() {
    vec3 L = normalize(vec3(0.35, 0.85, 0.4));
    float ndl = max(dot(normalize(vNormal), L), 0.22);
    gl_FragColor = vec4(vColor * ndl, 1.0);
}
