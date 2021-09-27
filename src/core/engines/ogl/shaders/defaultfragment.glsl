/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

precision highp float;

varying vec3 vNormal;

uniform vec4 uColor;
uniform float uTime; // unused but kept for compatibility with other shaders

void main() {
    vec3 normal = normalize(vNormal);
    float lighting = dot(normal, normalize(vec3(-0.3, 0.8, 0.6)));
    vec3 color = uColor.rgb + lighting * 0.1;
    gl_FragColor.rgb = clamp(color, 0.0, 1.0);
    gl_FragColor.a = uColor.a;
}
