/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

precision highp float;

varying vec3 vNormal;

uniform vec4 uColor;

void main() {
    vec3 normal = normalize(vNormal);
    float lighting = dot(normal, normalize(vec3(-0.3, 0.8, 0.6)));
    gl_FragColor.rgb = uColor.rgb + lighting * 0.1;
    gl_FragColor.a = uColor.a;
}
