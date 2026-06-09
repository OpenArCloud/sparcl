/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * GPU-style particles for Three.js, mirroring {@link oglParticleHelper} semantics
 * ({@link ParticleSystem.intensity} = point count, shader time step in {@link updateThreeParticles}).
 */

import * as THREE from 'three';
import { ParticleShape, type ParticleSystem } from '@core/contents/particleSystem';
import type { SceneNodeId } from '@core/engines/RenderingEngine';

export interface ThreeParticleSystemState {
    points: THREE.Points;
    shape: ParticleShape;
    systemSize: number;
    speed: number;
}

const particleSystemStateBySceneNodeId = new Map<SceneNodeId, ThreeParticleSystemState>();

let particleAnimationTime = 0;

const particleVertexShader = /* glsl */ `
attribute vec3 velocity;
uniform float uTime;
uniform float uPointSize;

void main() {
    vec3 pos = position + velocity * uTime;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uPointSize / max(length(mvPosition.xyz), 1e-4);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const particleFragmentShader = `
uniform float uTime;
uniform vec3 uBaseColor;

void main() {
    vec2 uv = gl_PointCoord.xy;
    float circle = smoothstep(0.5, 0.4, length(uv - 0.5)) * 0.8;
    vec3 tint = 0.8 + 0.2 * sin(vec3(uv.x + uTime, uv.y + uTime * 0.7, uTime)) + uBaseColor;
    gl_FragColor = vec4(tint, circle);
}
`;

function generatePosition(shape: ParticleShape, systemSize: number): THREE.Vector3 {
    let position: THREE.Vector3;
    switch (shape) {
        case ParticleShape.CONE:
            position = new THREE.Vector3(Math.random(), Math.random(), Math.random());
            break;
        case ParticleShape.SPHERE:
        case ParticleShape.RANDOM:
        default:
            position = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
            break;
    }
    return position.multiplyScalar(systemSize);
}

function generateVelocity(shape: ParticleShape, position: THREE.Vector3, speed: number): THREE.Vector3 {
    let velocity: THREE.Vector3;
    switch (shape) {
        case ParticleShape.CONE:
        case ParticleShape.SPHERE:
            velocity = position.clone().multiplyScalar(-1).normalize();
            break;
        case ParticleShape.RANDOM:
        default:
            velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
            break;
    }
    return velocity.multiplyScalar(speed);
}

export function createThreeParticlePoints(particleSystem: ParticleSystem): THREE.Points {
    const { shape, baseColor, pointSize, systemSize, speed } = particleSystem;
    const intensity = Math.max(1, Math.floor(Number(particleSystem.intensity)) || 1);
    const positions = new Float32Array(intensity * 3);
    const velocities = new Float32Array(intensity * 3);

    for (let i = 0; i < intensity; i++) {
        const position = generatePosition(shape, systemSize);
        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;
        const velocity = generateVelocity(shape, position, speed);
        velocities[i * 3] = velocity.x;
        velocities[i * 3 + 1] = velocity.y;
        velocities[i * 3 + 2] = velocity.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uPointSize: { value: pointSize },
            uBaseColor: { value: new THREE.Vector3(baseColor[0], baseColor[1], baseColor[2]) },
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        depthTest: false,
    });

    return new THREE.Points(geometry, material);
}

export function registerThreeParticleSystem(sceneNodeId: SceneNodeId, state: ThreeParticleSystemState): void {
    if (particleSystemStateBySceneNodeId.has(sceneNodeId)) {
        throw new Error(`Three particles: particle system already registered for scene node ${sceneNodeId}`);
    }
    particleSystemStateBySceneNodeId.set(sceneNodeId, state);
}

export function unregisterThreeParticleSystem(sceneNodeId: SceneNodeId): void {
    particleSystemStateBySceneNodeId.delete(sceneNodeId);
}

export function clearRegisteredThreeParticleSystems(): void {
    particleSystemStateBySceneNodeId.clear();
}

export function isRegisteredThreeParticleSystem(sceneNodeId: SceneNodeId): boolean {
    return particleSystemStateBySceneNodeId.has(sceneNodeId);
}

function getParticleSystemState(sceneNodeId: SceneNodeId): ThreeParticleSystemState {
    const state = particleSystemStateBySceneNodeId.get(sceneNodeId);
    if (!state) {
        throw new Error(`Three particles: no particle system for scene node ${sceneNodeId}`);
    }
    return state;
}

export function getThreeParticleIntensity(sceneNodeId: SceneNodeId): number {
    const state = particleSystemStateBySceneNodeId.get(sceneNodeId);
    if (!state) {
        return 0;
    }
    const attribute = state.points.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    return attribute ? attribute.count : 0;
}

export function setThreeParticleIntensity(sceneNodeId: SceneNodeId, newIntensity: number): void {
    const { points, shape, systemSize, speed } = getParticleSystemState(sceneNodeId);
    const positionAttribute = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const velocityAttribute = points.geometry.getAttribute('velocity') as THREE.BufferAttribute;
    const previousIntensity = positionAttribute.count;

    const n = Math.max(1, Math.floor(Number(newIntensity)) || 1);
    const newPositions = new Float32Array(n * 3);
    const newVelocities = new Float32Array(n * 3);
    const oldPositions = positionAttribute.array as Float32Array;
    const oldVelocities = velocityAttribute.array as Float32Array;

    for (let i = 0; i < n; i++) {
        const base = i * 3;
        if (i < previousIntensity) {
            newPositions[base] = oldPositions[base];
            newPositions[base + 1] = oldPositions[base + 1];
            newPositions[base + 2] = oldPositions[base + 2];
            newVelocities[base] = oldVelocities[base];
            newVelocities[base + 1] = oldVelocities[base + 1];
            newVelocities[base + 2] = oldVelocities[base + 2];
        } else {
            const position = generatePosition(shape, systemSize);
            newPositions[base] = position.x;
            newPositions[base + 1] = position.y;
            newPositions[base + 2] = position.z;
            const velocity = generateVelocity(shape, position, speed);
            newVelocities[base] = velocity.x;
            newVelocities[base + 1] = velocity.y;
            newVelocities[base + 2] = velocity.z;
        }
    }

    points.geometry.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(newVelocities, 3));
    points.geometry = geometry;
}

export function updateThreeParticles(sceneNodeId: SceneNodeId): void {
    particleAnimationTime += 1 / 60;
    const state = getParticleSystemState(sceneNodeId);
    const material = state.points.material as THREE.ShaderMaterial;
    material.uniforms.uTime.value = particleAnimationTime;
}
