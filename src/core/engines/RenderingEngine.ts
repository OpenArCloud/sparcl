/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * Renderer-agnostic contract for the 3D engine used by sparcl viewers.
 * Poses use gl-matrix ({@link ReadonlyVec3}, {@link ReadonlyQuat}, {@link mat4}); each engine converts internally.
 */
import type { mat4, quat, ReadonlyMat4, ReadonlyQuat, ReadonlyVec3, vec3 } from 'gl-matrix';

import type { ExternalCameraParameters } from './externalCameraPose';
import type { ObjectDescription } from '@core/contents/objectDescription';
import type { SceneRootMatrix } from '../../types/xr';
import type { RigidPose } from '@core/frameTransforms';
import type { PlyLoadOptions } from '@core/contents/pointcloud';
import type { ParticleSystem } from '@core/contents/particleSystem';
import type { PrimitiveShape } from '@core/contents/primitives';

/**
 * Opaque id for a node in a {@link RenderingEngine} scene graph.
 * Viewers must not use OGL `Mesh` / `Transform` or THREE `Object3D` — only this id and engine methods.
 */
export type SceneNodeId = string;

/**
 * Application-defined name for a cached GLTF root ({@link addModel} optional `name`).
 * Not the same as {@link SceneNodeId}: use this only to look up a model you registered with `name` at load time.
 */
export type ModelName = string;

export interface RenderingEngine {
    init(): void;
    initScene(): void;

    /** @returns {@link SceneNodeId} for the placeholder root */
    addPlaceholder(
        keywords: string | string[] | undefined,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat
    ): SceneNodeId;

    /** @returns {@link SceneNodeId} for the polyline mesh */
    addPolyline(
        points: ReadonlyVec3[],
        hexColor: string,
    ): SceneNodeId;

    /** @returns {@link SceneNodeId} for the configured primitive mesh */
    addPlaceholderWithOptions(
        shape: PrimitiveShape,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        color: [number, number, number, number] | undefined,
        fragmentShader: string | undefined,
        options?: unknown,
    ): SceneNodeId;

    /**
     * @param callback - Invoked per loaded GLTF mesh leaf with its {@link SceneNodeId}
     * @param name - Optional {@link ModelName} for {@link getModel} / {@link removeModel}
     * @returns {@link SceneNodeId} for the GLTF root transform
     */
    addModel(
        url: string,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        scale?: ReadonlyVec3,
        callback?: (nodeId: SceneNodeId) => void,
        name?: ModelName,
    ): SceneNodeId;

    /** @returns {@link SceneNodeId} for the GLTF root (pose converted to {@link ReadonlyVec3} / {@link ReadonlyQuat}) */
    addModelWithRigidPose(
        url: string,
        pose: RigidPose,
        scale?: ReadonlyVec3,
        callback?: (nodeId: SceneNodeId) => void,
        name?: ModelName,
    ): SceneNodeId;
    /**
     * Resolves a previously cached GLTF root. Prefer the return value of {@link addModel} when you can.
     *
     * @returns {@link SceneNodeId} of the GLTF root, or `null` if `name` was never registered
     */
    getModel(name: ModelName): SceneNodeId | null;

    /** Removes a GLTF root registered with the same {@link ModelName} passed to {@link addModel}. */
    removeModel(name: ModelName): void;

    /** @returns {@link SceneNodeId} for the experience placeholder */
    addExperiencePlaceholder(
        position: ReadonlyVec3,
        orientation: ReadonlyQuat
    ): SceneNodeId;

    /** @returns {@link SceneNodeId} for the marker tracking object */
    addMarkerObject(): SceneNodeId;

    /** @returns {@link SceneNodeId} for the hit-test reticle root */
    addReticle(): SceneNodeId;

    /** Whether the given orientation is roughly horizontal (floor-aligned). */
    isHorizontal(orientation: ReadonlyQuat): boolean;

    /** @returns {@link SceneNodeId} for a random primitive */
    addRandomObject(
        position: ReadonlyVec3,
        orientation: ReadonlyQuat
    ): SceneNodeId;

    /** @returns {@link SceneNodeId} for the described primitive mesh */
    addObject(
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        object_description: ObjectDescription
    ): SceneNodeId;

    /**
     * @param particleSystem - Particle appearance and simulation parameters ({@link ParticleSystem})
     * @returns {@link SceneNodeId} for the particle point mesh
     */
    addParticleSystem(
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        particleSystem: ParticleSystem,
    ): SceneNodeId;

    /** @param sceneNodeId - {@link SceneNodeId} from {@link addParticleSystem} */
    updateParticleIntensity(sceneNodeId: SceneNodeId, calculate: (oldValue: number) => number): number;

    /**
     * Advance simulation / uniforms for a particle system node (e.g. per frame).
     * @param sceneNodeId - {@link SceneNodeId} from {@link addParticleSystem}
     */
    updateParticleSystem(sceneNodeId: SceneNodeId): void;

    /** @param object_id - Stable id for updates and {@link getDynamicObjectNodeId} */
    addDynamicObject(
        object_id: string,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        object_description?: ObjectDescription | null,
    ): SceneNodeId;

    addDynamicObjectWithRigidPose(
        object_id: string,
        pose: RigidPose,
        object_description?: ObjectDescription | null
    ): SceneNodeId;

    updateDynamicObject(
        object_id: string,
        position?: ReadonlyVec3 | null,
        orientation?: ReadonlyQuat | null,
        object_description?: ObjectDescription | null,
    ): boolean;

    updateDynamicObjectWithRigidPose(
        object_id: string,
        pose: RigidPose,
        object_description?: ObjectDescription | null,
    ): boolean;

    getDynamicObjectDescription(object_id: string): ObjectDescription | null;

    /** @returns {@link SceneNodeId} for the dynamic mesh, or `null` */
    getDynamicObjectNodeId(object_id: string): SceneNodeId | null;

    removeDynamicObject(object_id: string): void;

    /** @param object - {@link SceneNodeId} from {@link addMarkerObject} */
    updateMarkerObjectPosition(
        object: SceneNodeId,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat
    ): void;

    /** @param reticle - {@link SceneNodeId} from {@link addReticle} */
    updateReticlePose(
        reticle: SceneNodeId,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        scale?: ReadonlyVec3
    ): void;

    /** Writes world-space TRS of `node` into the provided out parameters. */
    getNodePose(
        nodeId: SceneNodeId,
        outPosition: vec3,
        outOrientation: quat,
        outScale?: vec3
    ): void;

    /** Sets the pose of a node in the scene graph. */
    setNodePose(
        nodeId: SceneNodeId,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        scale?: ReadonlyVec3
    ): void;

    translateNode(nodeId: SceneNodeId, dx: number, dy: number, dz: number): void;
    setNodeUniformScale(nodeId: SceneNodeId, scale: number): void;

    setNodeVisible(nodeId: SceneNodeId, visible: boolean): void;
    isNodeVisible(nodeId: SceneNodeId): boolean;

    /** Column-major world matrix of `node`. */
    getNodeWorldMatrix(node: SceneNodeId, out: mat4): void;

    /** @returns {@link SceneNodeId} for the dev axes helper */
    addAxes(): SceneNodeId;

    addPlyObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        plyOptions?: PlyLoadOptions
    ): Promise<SceneNodeId | null>;

    addPointCloudObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        options?: PlyLoadOptions & { contentType?: string; scrContentType?: string },
    ): Promise<SceneNodeId | null>;

    addLogoObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        width?: number,
        height?: number
    ): Promise<void>;

    addTextObject(
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        string: string,
        textColor?: ReadonlyVec3,
    ): Promise<SceneNodeId>;

    addTextObjectWithRigidPose(
        pose: RigidPose,
        string: string,
        options?: { textColor?: [number, number, number]; positionOffset?: [number, number, number] },
    ): Promise<SceneNodeId>;

    addVideoObject(
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        videoUrl: string
    ): Promise<void>;

    setVerticallyRotating(node: SceneNodeId): void;
    setTowardsCameraRotating(node: SceneNodeId): void;

    /** @param modelId - {@link SceneNodeId} that should receive pointer/tap hits */
    addClickEvent(modelId: SceneNodeId, handler: () => void): void;

    getClickEvent(modelId: string): (() => void) | undefined;

    getExternalCameraParameters(view: XRView, experienceMatrix: ReadonlyMat4): ExternalCameraParameters;
    getRootSceneUpdater(): (matrix: SceneRootMatrix) => mat4;

    /** @param modelId - {@link SceneNodeId} to show loading / waiting visuals */
    setWaiting(modelId: SceneNodeId): void;

    setExperimentTapHandler(callback: (e: { x: number; y: number }) => void): void;

    resize(): void;

    reinitialize(): void;

    cleanup(): void;

    /** @param modelId - {@link SceneNodeId} to detach from the scene */
    remove(modelId: SceneNodeId): void;

    stop(): void;

    updateMatrixWorld(): void;
    render(time: DOMHighResTimeStamp, view: XRView): void;

    /** @returns {@link SceneNodeId} for debug axis geometry at `worldMatrix` */
    addDebugAxesAtWorldMatrix(
        worldMatrix: ReadonlyMat4,
        color: [number, number, number, number],
        showAxes?: boolean,
    ): SceneNodeId;
    updateSceneGraphTransforms(): void;
}
