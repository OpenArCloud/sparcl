// https://www.shadertoy.com/view/MsjXDm#


precision highp float;


uniform float uTime;

varying vec2 vUv;


float stripe(vec2 uv) {
    return cos(uv.x * 20. - uTime * 5. + uv.y * -30.);
}

float glass(vec2 uv) {
    return cos(dot(uv.xy, vec2(12.41234, 2442.123)) * cos(uv.y));
}


void main() {
    float g = stripe(vUv);
    vec3 col = vec3(smoothstep(0., .2, g));

    col.r = .8;
    col /= (pow(glass(vec2(vUv.x * 30., vUv.y)), 2.)) + .5;

    gl_FragColor = vec4(col, 1.0);
}
