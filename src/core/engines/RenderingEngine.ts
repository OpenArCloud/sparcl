/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * Renderer-agnostic contract for the 3D engine used by sparcl viewers.
 * The OGL implementation is the reference; Three.js and others should implement this surface.
 */

import type { ReadonlyMat4 } from 'gl-matrix';
import type { Mesh, Transform, Vec3, Quat, Mat4 } from 'ogl';

import type { ObjectDescription } from '../../types/xr';
import type { RigidPose } from '@core/frameTransforms';
import type { PlyLoadOptions } from '@core/engines/ogl/oglPlyHelper';
import type { ParticleShape, ParticleSystem } from '@core/engines/ogl/oglParticleHelper';
import type { PrimitiveShape } from '@core/engines/ogl/modelTemplates';

/** Result of loading a GLTF (or placeholder subtree) into the scene. */
export interface GltfImportResult {
    meshes: Promise<Mesh[]>;
    transform: Transform;
}

export interface RenderingEngine {
    init(): void;
    initScene(): void;

    addPlaceholder(keywords: string | string[] | undefined, position: Vec3, orientation: Quat): Mesh;
    addPolyline(points: Vec3[], hexColor: string): Mesh;
    addPlaceholderWithOptions(
        shape: PrimitiveShape,
        position: Vec3,
        orientation: Quat,
        color: [number, number, number, number] | undefined,
        fragmentShader: string | undefined,
        options?: unknown,
    ): Mesh;

    addModel(
        url: string,
        position: Vec3,
        orientation: Quat,
        scale?: Vec3,
        callback?: (mesh: Mesh) => void,
        id?: string,
    ): GltfImportResult;
    getModel(id: string): Transform;
    removeModel(id: string): void;

    addExperiencePlaceholder(position: Vec3, orientation: Quat): Mesh;
    addMarkerObject(): Mesh;
    addReticle(): Transform;
    isHorizontal(object: { quaternion: Quat }): boolean;

    addRandomObject(position: Vec3, orientation: Quat): Mesh;
    addObject(position: Vec3, orientation: Quat, object_description: ObjectDescription): Mesh;

    addParticleObject(
        position: Vec3,
        orientation: Quat,
        shape: ParticleShape,
        baseColor: string,
        pointSize: number,
        intensity: number,
        systemSize: number,
        speed: number,
    ): ParticleSystem;
    setParticleIntensity(particles: ParticleSystem, calculate: (oldValue: number) => number): number;

    addDynamicObject(
        object_id: string,
        position: Vec3,
        orientation: Quat,
        object_description?: ObjectDescription | null,
    ): Mesh;
    updateDynamicObject(
        object_id: string,
        position?: Vec3 | null,
        orientation?: Quat | null,
        object_description?: ObjectDescription | null,
    ): boolean;
    getDynamicObjectDescription(object_id: string): ObjectDescription | null;
    getDynamicObjectMesh(object_id: string): Mesh | null;
    removeDynamicObject(object_id: string): void;

    updateMarkerObjectPosition(object: Mesh, position: Vec3, orientation: Quat): void;
    updateReticlePose(
        reticle: Transform,
        position: Vec3,
        orientation: Quat,
        scale?: Vec3,
    ): void;

    addAxes(): Transform;

    addPlyObject(url: string, position: Vec3, quaternion: Quat, plyOptions?: PlyLoadOptions): Promise<Mesh | null>;
    addPointCloudObject(
        url: string,
        position: Vec3,
        quaternion: Quat,
        options?: PlyLoadOptions & { contentType?: string; scrContentType?: string },
    ): Promise<Mesh | null>;
    addLogoObject(url: string, position: Vec3, quaternion: Quat, width?: number, height?: number): Promise<void>;
    addTextObject(
        position: Vec3,
        quaternion: Quat,
        string: string,
        textColor?: Vec3,
    ): Promise<Mesh>;
    addVideoObject(position: Vec3, quaternion: Quat, videoUrl: string): Promise<void>;

    setVerticallyRotating(node: Transform): void;
    setTowardsCameraRotating(node: Transform): void;

    addClickEvent(model: Mesh, handler: () => void): void;
    getClickEvent(modelId: string): (() => void) | undefined;

    getExternalCameraPose(view: XRView, experienceMatrix: Mat4): { projection: XRView['projectionMatrix']; camerapose: Mat4 };
    getRootSceneUpdater(): (matrix: number[]) => Mat4;

    setWaiting(model: Mesh): void;
    setExperimentTapHandler(callback: (e: { x: number; y: number }) => void): void;

    resize(): void;
    reinitialize(): void;
    cleanup(): void;
    remove(model: Mesh | Transform): void;
    stop(): void;

    updateMatrixWorld(): void;
    render(time: DOMHighResTimeStamp, view: XRView): void;

    addDebugAxesAtWorldMatrix(
        worldMatrix: ReadonlyMat4,
        color: [number, number, number, number],
        showAxes?: boolean,
    ): Transform;
    updateSceneGraphTransforms(): void;
    transformFromRigidPose(rp: RigidPose): Transform;
}
