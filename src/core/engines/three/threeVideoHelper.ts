/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * Video billboards for Three.js, mirroring {@link oglVideoHelper} (toggle playback, scale cue, pre-render).
 */

import * as THREE from 'three';
import type { ReadonlyQuat, ReadonlyVec3 } from 'gl-matrix';

export interface ThreeVideoInfo {
    videoId: number;
    videoUrl: string;
    videoElement: HTMLVideoElement;
}

const PLAYING_SCALE = 0.25;
const PAUSED_SCALE = 0.1;
const INITIAL_SCALE = 0.2;

let numVideos = 0;
const videoInfos: Record<number, ThreeVideoInfo> = {};
const videoMeshes: Record<number, THREE.Mesh> = {};

export function loadVideo(videoUrl: string): ThreeVideoInfo {
    const videoElement = document.createElement('video');
    videoElement.crossOrigin = 'anonymous';
    videoElement.src = videoUrl;
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    void videoElement.play().catch(() => {
        /* autoplay may require gesture; texture still updates when playing */
    });

    numVideos += 1;
    const videoId = numVideos;
    const videoInfo: ThreeVideoInfo = { videoId, videoUrl, videoElement };
    videoInfos[videoId] = videoInfo;
    return videoInfo;
}

export function togglePlayback(videoId: number): void {
    const info = videoInfos[videoId];
    if (!info) {
        return;
    }
    if (info.videoElement.paused) {
        playVideo(videoId);
    } else {
        pauseVideo(videoId);
    }
}

export function playVideo(videoId: number): void {
    const info = videoInfos[videoId];
    const mesh = videoMeshes[videoId];
    if (!info || !mesh) {
        return;
    }
    void info.videoElement.play().catch(() => {});
    mesh.scale.set(PLAYING_SCALE, PLAYING_SCALE, PLAYING_SCALE);
}

export function pauseVideo(videoId: number): void {
    const info = videoInfos[videoId];
    const mesh = videoMeshes[videoId];
    if (!info || !mesh) {
        return;
    }
    info.videoElement.pause();
    mesh.scale.set(PAUSED_SCALE, PAUSED_SCALE, PAUSED_SCALE);
}

function registerVideoMesh(videoId: number, mesh: THREE.Mesh): void {
    videoMeshes[videoId] = mesh;
    mesh.scale.set(INITIAL_SCALE, INITIAL_SCALE, INITIAL_SCALE);
}

export function createVideoMesh(
    videoInfo: ThreeVideoInfo,
    position: ReadonlyVec3,
    quaternion: ReadonlyQuat,
): THREE.Mesh {
    const videoTexture = new THREE.VideoTexture(videoInfo.videoElement);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.PlaneGeometry(1.6, 0.9);
    const material = new THREE.MeshBasicMaterial({
        map: videoTexture,
        transparent: true,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
    mesh.userData.threeVideoElement = videoInfo.videoElement;
    mesh.userData.threeVideoId = videoInfo.videoId;
    registerVideoMesh(videoInfo.videoId, mesh);
    return mesh;
}

export function onPreRender(): void {
    for (const videoIdStr of Object.keys(videoInfos)) {
        const mesh = videoMeshes[Number(videoIdStr)];
        if (mesh) {
            mesh.rotation.y += 0.003;
        }
    }
}

export function disposeVideo(videoId: number): void {
    const info = videoInfos[videoId];
    if (info?.videoElement) {
        info.videoElement.pause();
        info.videoElement.removeAttribute('src');
        info.videoElement.load();
    }
    delete videoInfos[videoId];
    delete videoMeshes[videoId];
}

/** Pause and strip all video elements; clear module maps (call from engine {@link cleanup}). */
export function disposeAllVideoResources(): void {
    for (const videoIdStr of Object.keys(videoInfos)) {
        disposeVideo(Number(videoIdStr));
    }
    numVideos = 0;
}

export function getVideoIdFromObject(object: THREE.Object3D): number | undefined {
    const id = object.userData?.threeVideoId;
    return typeof id === 'number' ? id : undefined;
}
