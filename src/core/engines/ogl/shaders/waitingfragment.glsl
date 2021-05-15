/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

precision highp float;

#define PI 3.141592653589793

varying vec3 vNormal;

uniform vec4 uColor;
uniform vec4 uAltColor;
uniform float uTime;

float sineInOut(float t) {
    return -0.5 * (cos(PI * t) - 1.0);
}

void main() {
    vec3 normal = normalize(vNormal);
    float lighting = dot(normal, normalize(vec3(-0.3, 0.8, 0.6)));

    float t = uTime * 0.5;
    float pct = sineInOut( abs(fract(t)*2.0-1.) );

    gl_FragColor = mix(uColor, uAltColor, pct) + lighting * 0.1;
}
