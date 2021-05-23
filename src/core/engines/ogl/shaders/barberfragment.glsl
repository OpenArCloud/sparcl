/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

precision highp float;

uniform vec2 uResolution;
uniform int uTime;


float stripe(vec2 uv) {
    return cos(uv.x * 20. - time + uv.y * -30.);
}

float glass(vec2 uv) {
    return cos(dot(uv.xy, vec2(12.41234, 2442.123)) * cos(uv.y));
}


void main() {
    vec2 uv = fragCoord.xy / uResolution.xy;
    float a = uResolution.x / uResolution.y;
    uv.x *= a;

    float g = stripe(uv);
    vec3 col = vec3(smoothstep(0., .2, g));

    col.r = .8;
    col /= (pow(glass(vec2(uv.x * 30., uv.y)), 2.))+.5;

    fragColor = vec4(col, 1.0);
}
