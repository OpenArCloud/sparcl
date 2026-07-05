/*
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

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
    videoId: number;
    videoUrl: string;
    videoElement: HTMLVideoElement;
}

let numVideos = 0;
const videoInfos: Record<number, VideoInfo> = {};
const videoTextures: Record<number, Texture> = {};
const videoMeshes: Record<number, Mesh> = {};

export function loadVideo(videoUrl: string): VideoInfo {
    const videoElement: HTMLVideoElement = document.createElement('video');
    videoElement.crossOrigin = '*';
    videoElement.src = videoUrl;

    // Disclaimer: video autoplay is a confusing, constantly-changing browser feature.
    // The best approach is to never assume that it will work, and therefore prepare for a fallback.
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.setAttribute('playsinline', 'playsinline');
    videoElement.play();

    numVideos += 1;
    const videoId = numVideos;
    const videoInfo: VideoInfo = {
        videoId: videoId,
        videoUrl: videoUrl,
        videoElement: videoElement,
    };
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
    const videoGeometry = new Box(gl, { width: 16 / 9, height: 1, depth: 16 / 9 });

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

export function onPreRender(_time: DOMHighResTimeStamp) {
    for (const videoIdStr of Object.keys(videoInfos)) {
        const videoId = Number(videoIdStr);
        const videoElement = videoInfos[videoId]?.videoElement;
        const videoTexture = videoTextures[videoId];
        const videoMesh = videoMeshes[videoId];
        if (!videoElement || !videoTexture || !videoMesh) {
            continue;
        }
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

/** Pause and strip all video elements; clear module maps (call from engine {@link cleanup}). */
export function disposeAllVideoResources(): void {
    for (const videoIdStr of Object.keys(videoInfos)) {
        const videoId = Number(videoIdStr);
        const info = videoInfos[videoId];
        if (info?.videoElement) {
            info.videoElement.pause();
            info.videoElement.removeAttribute('src');
            info.videoElement.load();
        }
        delete videoInfos[videoId];
    }
    for (const videoIdStr of Object.keys(videoTextures)) {
        delete videoTextures[Number(videoIdStr)];
    }
    for (const videoIdStr of Object.keys(videoMeshes)) {
        delete videoMeshes[Number(videoIdStr)];
    }
    numVideos = 0;
}
