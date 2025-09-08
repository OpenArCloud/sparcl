attribute vec3 position;
attribute vec3 velocity;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float pointSize;

varying vec4 vRandom;

void main() {
    vec3 distance = velocity * uTime;
    vec3 pos = mod((position + distance), position);

    // modelMatrix is one of the automatically attached uniforms when using the Mesh class
    vec4 mPos = modelMatrix * vec4(pos, 1.0);    

    // get the model view position so that we can scale the points off into the distance
    vec4 mvPos = viewMatrix * mPos;
    gl_PointSize = pointSize / length(mvPos.xyz) * (pos.z + 0.5);
    gl_Position = projectionMatrix * mvPos;
}
