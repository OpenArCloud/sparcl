// https://www.shadertoy.com/view/sd2XWV

precision highp float;

uniform float uTime;

varying vec2 vUv;

void main(){
    vec2 uv = vUv;
    for(float i = 1.0; i < 10.0; i++){
        uv.x += 0.6 / i * cos(i * 2.5 * uv.y + uTime);
        uv.y += 0.6 / i * cos(i * 1.5 * uv.x + uTime);
    }
    vec3 col = 0.5 + 0.5 * sin(uTime + uv.xyx + vec3(0,2,4));
    gl_FragColor = vec4(col / (2.1 * abs(cos(uTime - uv.y - uv.x))), 1.0);
}
