/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { mat4, quat, ReadonlyMat4, ReadonlyQuat, ReadonlyVec3, vec3 } from 'gl-matrix';

import type { ExternalCameraParameters } from '@core/engines/externalCameraPose';
import type { ObjectDescription } from '@core/contents/objectDescription';
import type { SceneRootMatrix } from '../../../types/xr';
import type { RigidPose } from '@core/frameTransforms';
import type { PlyLoadOptions } from '@core/contents/pointcloud';
import type { ParticleSystem } from '@core/contents/particleSystem';
import type { PrimitiveShape } from '@core/contents/primitives';
import type { ModelName, RenderingEngine, SceneNodeId } from '@core/engines/RenderingEngine';

function notImplemented(feature: string): never {
    throw new Error(`ThreeEngine stub: ${feature} is not implemented`);
}

/** Temporary stub: same public surface and method order as `threeEngine_NEW.ts`. */
export default class ThreeEngine implements RenderingEngine {
    getNodePose(nodeId: SceneNodeId, outPosition: vec3, outOrientation: quat, outScale?: vec3): void {
        notImplemented('getNodePose');
    }

    setNodePose(nodeId: SceneNodeId, position: ReadonlyVec3, orientation: ReadonlyQuat, scale?: ReadonlyVec3): void {
        notImplemented('setNodePose');
    }

    translateNode(nodeId: SceneNodeId, dx: number, dy: number, dz: number): void {
        notImplemented('translateNode');
    }

    setNodeUniformScale(nodeId: SceneNodeId, scale: number): void {
        notImplemented('setNodeUniformScale');
    }

    setNodeVisible(nodeId: SceneNodeId, visible: boolean): void {
        notImplemented('setNodeVisible');
    }

    isNodeVisible(nodeId: SceneNodeId): boolean {
        notImplemented('isNodeVisible');
    }

    getNodeWorldMatrix(node: SceneNodeId, out: mat4): void {
        notImplemented('getNodeWorldMatrix');
    }

    init(): void {
        notImplemented('init');
    }

    initScene(): void {
        notImplemented('initScene');
    }

    addPlaceholder(
        keywords: string | string[] | undefined,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
    ): SceneNodeId {
        notImplemented('addPlaceholder');
    }

    addPolyline(points: ReadonlyVec3[], hexColor: string): SceneNodeId {
        notImplemented('addPolyline');
    }

    addPlaceholderWithOptions(
        shape: PrimitiveShape,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        color: [number, number, number, number] | undefined,
        fragmentShader: string | undefined,
        options?: unknown,
    ): SceneNodeId {
        notImplemented('addPlaceholderWithOptions');
    }

    addModel(
        url: string,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        scale?: ReadonlyVec3,
        callback?: (nodeId: SceneNodeId) => void,
        name?: ModelName,
    ): SceneNodeId {
        notImplemented('addModel');
    }

    addModelWithRigidPose(
        url: string,
        pose: RigidPose,
        scale?: ReadonlyVec3,
        callback?: (nodeId: SceneNodeId) => void,
        name?: ModelName,
    ): SceneNodeId {
        notImplemented('addModelWithRigidPose');
    }

    getModel(name: ModelName): SceneNodeId | null {
        notImplemented('getModel');
    }

    removeModel(name: ModelName): void {
        notImplemented('removeModel');
    }

    addExperiencePlaceholder(position: ReadonlyVec3, orientation: ReadonlyQuat): SceneNodeId {
        notImplemented('addExperiencePlaceholder');
    }

    addMarkerObject(): SceneNodeId {
        notImplemented('addMarkerObject');
    }

    addReticle(): SceneNodeId {
        notImplemented('addReticle');
    }

    isHorizontal(orientation: ReadonlyQuat): boolean {
        notImplemented('isHorizontal');
    }

    addRandomObject(position: ReadonlyVec3, orientation: ReadonlyQuat): SceneNodeId {
        notImplemented('addRandomObject');
    }

    addObject(
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        objectDescription: ObjectDescription,
    ): SceneNodeId {
        notImplemented('addObject');
    }

    addParticleSystem(
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        particleSystem: ParticleSystem,
    ): SceneNodeId {
        notImplemented('addParticleSystem');
    }

    updateParticleIntensity(sceneNodeId: SceneNodeId, calculate: (oldValue: number) => number): number {
        notImplemented('updateParticleIntensity');
    }

    updateParticleSystem(sceneNodeId: SceneNodeId): void {
        notImplemented('updateParticleSystem');
    }

    addDynamicObject(
        objectId: string,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        objectDescription?: ObjectDescription | null,
    ): SceneNodeId {
        notImplemented('addDynamicObject');
    }

    addDynamicObjectWithRigidPose(
        objectId: string,
        pose: RigidPose,
        objectDescription?: ObjectDescription | null,
    ): SceneNodeId {
        notImplemented('addDynamicObjectWithRigidPose');
    }

    updateDynamicObject(
        objectId: string,
        position?: ReadonlyVec3 | null,
        orientation?: ReadonlyQuat | null,
        objectDescription?: ObjectDescription | null,
    ): boolean {
        notImplemented('updateDynamicObject');
    }

    updateDynamicObjectWithRigidPose(
        objectId: string,
        pose: RigidPose,
        objectDescription?: ObjectDescription | null,
    ): boolean {
        notImplemented('updateDynamicObjectWithRigidPose');
    }

    getDynamicObjectDescription(objectId: string): ObjectDescription | null {
        notImplemented('getDynamicObjectDescription');
    }

    getDynamicObjectNodeId(objectId: string): SceneNodeId | null {
        notImplemented('getDynamicObjectNodeId');
    }

    removeDynamicObject(objectId: string): void {
        notImplemented('removeDynamicObject');
    }

    updateMarkerObjectPosition(object: SceneNodeId, position: ReadonlyVec3, orientation: ReadonlyQuat): void {
        notImplemented('updateMarkerObjectPosition');
    }

    updateReticlePose(
        reticle: SceneNodeId,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        scale?: ReadonlyVec3,
    ): void {
        notImplemented('updateReticlePose');
    }

    addAxes(): SceneNodeId {
        notImplemented('addAxes');
    }

    async addPlyObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        plyOptions?: PlyLoadOptions,
    ): Promise<SceneNodeId | null> {
        notImplemented('addPlyObject');
    }

    async addPointCloudObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        options?: PlyLoadOptions & { contentType?: string; scrContentType?: string },
    ): Promise<SceneNodeId | null> {
        notImplemented('addPointCloudObject');
    }

    async addLogoObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        width?: number,
        height?: number,
    ): Promise<void> {
        notImplemented('addLogoObject');
    }

    async addTextObject(
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        text: string,
        textColor?: ReadonlyVec3,
    ): Promise<SceneNodeId> {
        notImplemented('addTextObject');
    }

    async addTextObjectWithRigidPose(
        pose: RigidPose,
        text: string,
        options?: { textColor?: [number, number, number]; positionOffset?: [number, number, number] },
    ): Promise<SceneNodeId> {
        notImplemented('addTextObjectWithRigidPose');
    }

    async addVideoObject(position: ReadonlyVec3, quaternion: ReadonlyQuat, videoUrl: string): Promise<void> {
        notImplemented('addVideoObject');
    }

    setVerticallyRotating(node: SceneNodeId): void {
        notImplemented('setVerticallyRotating');
    }

    setTowardsCameraRotating(node: SceneNodeId): void {
        notImplemented('setTowardsCameraRotating');
    }

    addClickEvent(modelId: SceneNodeId, handler: () => void): void {
        notImplemented('addClickEvent');
    }

    getClickEvent(modelId: string): (() => void) | undefined {
        notImplemented('getClickEvent');
    }

    getExternalCameraParameters(view: XRView, experienceMatrix: ReadonlyMat4): ExternalCameraParameters {
        notImplemented('getExternalCameraParameters');
    }

    getRootSceneUpdater(): (matrix: SceneRootMatrix) => mat4 {
        return (matrix: SceneRootMatrix) => notImplemented('getRootSceneUpdater() callback');
    }

    setWaiting(modelId: SceneNodeId): void {
        notImplemented('setWaiting');
    }

    setExperimentTapHandler(callback: (e: { x: number; y: number }) => void): void {
        notImplemented('setExperimentTapHandler');
    }

    resize(): void {
        notImplemented('resize');
    }

    reinitialize(): void {
        notImplemented('reinitialize');
    }

    cleanup(): void {
        notImplemented('cleanup');
    }

    remove(modelId: SceneNodeId): void {
        notImplemented('remove');
    }

    stop(): void {
        notImplemented('stop');
    }

    updateMatrixWorld(): void {
        notImplemented('updateMatrixWorld');
    }

    render(time: DOMHighResTimeStamp, view: XRView): void {
        notImplemented('render');
    }

    addDebugAxesAtWorldMatrix(
        worldMatrix: ReadonlyMat4,
        color: [number, number, number, number],
        showAxes?: boolean,
    ): SceneNodeId {
        notImplemented('addDebugAxesAtWorldMatrix');
    }

    updateSceneGraphTransforms(): void {
        notImplemented('updateSceneGraphTransforms');
    }
}
