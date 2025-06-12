import { Mesh, Vec3, Quat, Program, Texture, Box, Transform, type OGLRenderingContext } from 'ogl';


const kVideoVertexShader = /* glsl */ `
attribute vec2 uv;
attribute vec3 position;
attribute vec3 normal;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const kVideoFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D tMap;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vec3 tex = texture2D(tMap, vUv).rgb;
    vec3 normal = normalize(vNormal);
    vec3 light = normalize(vec3(0.5, 1.0, -0.3));
    float shading = dot(normal, light) * 0.15;
    gl_FragColor.rgb = tex + shading;
    gl_FragColor.a = 1.0;
}
`;

export interface VideoInfo {
    videoId: number,
    videoUrl: string,
    videoElement: HTMLVideoElement,
}

let numVideos = 0;
const videoInfos: Record<number, VideoInfo> = {};
const videoTextures: Record<number, Texture> = {};
const videoMeshes: Record<number, Mesh> = {};


export function loadVideo(videoUrl: string): VideoInfo {
    const videoElement:HTMLVideoElement = document.createElement('video');
    videoElement.crossOrigin = '*';
    videoElement.src = videoUrl;

    // Disclaimer: video autoplay is a confusing, constantly-changing browser feature.
    // The best approach is to never assume that it will work, and therefore prepare for a fallback.
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.setAttribute('playsinline', 'playsinline');
    videoElement.play();

    numVideos = numVideos++;
    const videoId = numVideos;
    const videoInfo: VideoInfo = {
        videoId: videoId,
        videoUrl: videoUrl,
        videoElement: videoElement
    }
    videoInfos[videoId] = videoInfo;
    return videoInfo;
}

export function togglePlayback(videoId: number) {
    if (videoInfos[videoId].videoElement.paused) {
        playVideo(videoId);
    } else {
        pauseVideo(videoId);
    }
}

export function playVideo(videoId: number) {
    videoInfos[videoId].videoElement.play();
    videoMeshes[videoId].scale.set([0.25, 0.25, 0.25]);
}

export function pauseVideo(videoId: number) {
    videoInfos[videoId].videoElement.pause();
    videoMeshes[videoId].scale.set([0.1, 0.1, 0.1]);
}

export function createVideoBox(gl: OGLRenderingContext, scene: Transform, position: Vec3, orientation: Quat, videoId: number) {
    const videoGeometry = new Box(gl, { width: 16/9, height: 1, depth: 16/9 });

    // Init empty texture while source loading
    const videoTexture = new Texture(gl, {
        generateMipmaps: false,
        width: 1280,
        height: 720,
    });

    const videoProgram = new Program(gl, {
        vertex: kVideoVertexShader,
        fragment: kVideoFragmentShader,
        uniforms: {
            tMap: { value: videoTexture },
        },
        cullFace: false,
    });

    const videoMesh = new Mesh(gl, {
        geometry: videoGeometry,
        program: videoProgram,
    });

    videoMesh.position.set(position);
    videoMesh.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
    videoMesh.scale.set([0.2, 0.2, 0.2]);
    videoMesh.setParent(scene);

    videoTextures[videoId] = videoTexture;
    videoMeshes[videoId] = videoMesh;
    return videoMesh;
}

export function onPreRender(t: DOMHighResTimeStamp) {
    for (let videoId in videoInfos) {
        const videoElement = videoInfos[videoId].videoElement;
        const videoTexture = videoTextures[videoId];
        const videoMesh = videoMeshes[videoId];
        // Attach video and/or update texture when video is ready
        if (videoElement.readyState >= videoElement.HAVE_ENOUGH_DATA) {
            if (!videoTexture.image) {
                videoTexture.image = videoElement;
            }
            videoTexture.needsUpdate = true;
        }
        videoMesh.rotation.y += 0.003;
    }
}
