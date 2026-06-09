/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * Three.js {@link RenderingEngine}: WebGL2 context, scene graph, SCR placement, PLY, GPU particles, and XR rendering.
 */

import * as THREE from 'three';
import { mat4, quat, vec3, type ReadonlyMat4, type ReadonlyQuat, type ReadonlyVec3 } from 'gl-matrix';

import { getExternalCameraParametersForExperience, type ExternalCameraParameters } from '@core/engines/externalCameraPose';
import { createRandomObjectDescription, type ObjectDescription } from '@core/contents/objectDescription';
import type { RigidPose } from '@core/frameTransforms';
import type { ModelName, RenderingEngine, SceneNodeId } from '@core/engines/RenderingEngine';
import type { SceneRootMatrix } from '../../../types/xr';
import type { PlyLoadOptions } from '@core/contents/pointcloud';
import type { ParticleSystem } from '@core/contents/particleSystem';
import type { PrimitiveShape } from '@core/contents/primitives';
import { PRIMITIVES } from '@core/contents/primitives';

import { ThreeSceneNodeRegistry, type ThreeSceneObject } from './threeSceneNodeRegistry';
import { createObjectDescriptionNode, createPrimitiveNode } from './threePrimitives';
const unitScale: ReadonlyVec3 = [1, 1, 1] as const;
const defaultReticleScale: ReadonlyVec3 = [0.2, 0.2, 0.2] as const;

function disposeMaterial(material: THREE.Material | undefined): void {
    if (!material) return;
    const withMap = material as THREE.MeshBasicMaterial & { map?: THREE.Texture | null };
    withMap.map?.dispose();
    material.dispose();
}

function notImplemented(feature: string): never {
    throw new Error(`ThreeEngine (minimal): ${feature} is not implemented yet`);
}

function disposeThreeSubtree(root: THREE.Object3D): void {
    root.traverse((node: THREE.Object3D) => {
        const drawable = node as THREE.Mesh & THREE.Points & THREE.Line;
        if (!drawable.geometry) {
            return;
        }
        drawable.geometry.dispose();
        if (Array.isArray(drawable.material)) {
            drawable.material.forEach((material: THREE.Material) => disposeMaterial(material));
        } else {
            disposeMaterial(drawable.material as THREE.Material);
        }
    });
}

function parseHexColor(hexColor: string): [number, number, number] {
    const hex = hexColor.replace(/^#/, '');
    if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        return [r, g, b];
    }
    return [1, 1, 1];
}

export default class ThreeEngine implements RenderingEngine {
    private renderer: THREE.WebGLRenderer | null = null;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(75, 1, 0.01, 1000);

    private readonly sceneNodes = new ThreeSceneNodeRegistry();
    private readonly rootEntry = this.sceneNodes.register(this.scene);
    private readonly objectsById = new Map<SceneNodeId, ThreeSceneObject>();

    private experimentTapHandler: ((tap: { x: number; y: number }) => void) | null = null;
    private readonly eventHandlers: Record<string, { handler: () => void }> = {};

    private listenersAttached = false;
    private readonly boundResize = () => this.resize();
    private readonly boundClick = (event: MouseEvent) => this.handleClick(event);

    private track(entry: ThreeSceneObject): SceneNodeId {
        const nodeId = this.sceneNodes.sceneNodeRef(entry);
        this.objectsById.set(nodeId, entry);
        return nodeId;
    }

    private resolve(nodeId: SceneNodeId): ThreeSceneObject {
        const entry = this.objectsById.get(nodeId);
        if (!entry) {
            throw new Error(`ThreeEngine: unknown scene node id ${nodeId}`);
        }
        return entry;
    }

    getNodePose(nodeId: SceneNodeId, outPosition: vec3, outOrientation: quat, outScale?: vec3): void {
        const entry = this.resolve(nodeId);
        const p = entry.three.position;
        const q = entry.three.quaternion;
        vec3.set(outPosition, p.x, p.y, p.z);
        quat.set(outOrientation, q.x, q.y, q.z, q.w);
        if (outScale) {
            const s = entry.three.scale;
            vec3.set(outScale, s.x, s.y, s.z);
        }
    }

    setNodePose(nodeId: SceneNodeId, position: ReadonlyVec3, orientation: ReadonlyQuat, scale?: ReadonlyVec3): void {
        this.sceneNodes.applyTrs(this.resolve(nodeId), position, orientation, scale);
    }

    translateNode(nodeId: SceneNodeId, dx: number, dy: number, dz: number): void {
        const entry = this.resolve(nodeId);
        entry.three.position.x += dx;
        entry.three.position.y += dy;
        entry.three.position.z += dz;
    }

    setNodeUniformScale(nodeId: SceneNodeId, scale: number): void {
        this.resolve(nodeId).three.scale.setScalar(scale);
    }

    setNodeVisible(nodeId: SceneNodeId, visible: boolean): void {
        this.resolve(nodeId).three.visible = visible;
    }

    isNodeVisible(nodeId: SceneNodeId): boolean {
        return this.resolve(nodeId).three.visible;
    }

    getNodeWorldMatrix(nodeId: SceneNodeId, out: mat4): void {
        const entry = this.resolve(nodeId);
        entry.three.updateMatrixWorld(true);
        mat4.copy(out, entry.three.matrixWorld.elements as ReadonlyMat4);
    }

    init(): void {
        const canvas = document.querySelector('#application') as HTMLCanvasElement;
        const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
        if (!gl) {
            throw new Error('ThreeEngine: webgl2 context not available on #application canvas');
        }

        if (!this.renderer) {
            this.renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
            this.renderer.autoClear = true;
            this.renderer.setClearColor(0x000000, 0);
        }

        this.initScene();

        if (!this.listenersAttached) {
            window.addEventListener('resize', this.boundResize, false);
            document.addEventListener('click', this.boundClick);
            this.listenersAttached = true;
        }
        this.resize();
    }

    initScene(): void {
        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }
        this.scene.matrix.identity();
        this.scene.matrixAutoUpdate = true;

        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(1, 2, 1);
        this.scene.add(directionalLight);
    }

    addPlaceholder(
        keywords: string | string[] | undefined,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
    ): SceneNodeId {
        void keywords;
        const entry = createPrimitiveNode(this.sceneNodes, PRIMITIVES.box, [0.5, 0.5, 0.5, 0.8], true);
        this.sceneNodes.applyTrs(entry, position, orientation);
        this.rootEntry.three.add(entry.three);
        return this.track(entry);
    }

    addPolyline(points: ReadonlyVec3[], hexColor: string): SceneNodeId {
        if (points.length < 2) {
            const entry = createPrimitiveNode(this.sceneNodes, PRIMITIVES.box, [1, 1, 1, 1], false, [0.01, 0.01, 0.01]);
            this.rootEntry.three.add(entry.three);
            return this.track(entry);
        }
        const flat = new Float32Array(points.length * 3);
        for (let i = 0; i < points.length; i++) {
            flat[i * 3] = points[i][0];
            flat[i * 3 + 1] = points[i][1];
            flat[i * 3 + 2] = points[i][2];
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(flat, 3));
        const [r, g, b] = parseHexColor(hexColor);
        const material = new THREE.LineBasicMaterial({ color: new THREE.Color(r, g, b) });
        const line = new THREE.Line(geometry, material);
        const entry = this.sceneNodes.register(line);
        this.rootEntry.three.add(line);
        return this.track(entry);
    }

    addPlaceholderWithOptions(
        shape: PrimitiveShape,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        color: [number, number, number, number] | undefined,
        fragmentShader: string | undefined,
        options?: unknown,
    ): SceneNodeId {
        void fragmentShader;
        void options;
        const rgba = color ?? [Math.random(), Math.random(), Math.random(), 1];
        const entry = createPrimitiveNode(this.sceneNodes, shape, rgba, rgba[3] < 1);
        this.sceneNodes.applyTrs(entry, position, orientation);
        this.rootEntry.three.add(entry.three);
        return this.track(entry);
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
        return null;
    }

    removeModel(name: ModelName): void {
        /* no-op — no named models in minimal engine */
    }

    addExperiencePlaceholder(position: ReadonlyVec3, orientation: ReadonlyQuat): SceneNodeId {
        const entry = createPrimitiveNode(this.sceneNodes, PRIMITIVES.sphere, [0, 1, 1, 0.9], true, [0.2, 0.2, 0.2]);
        this.sceneNodes.applyTrs(entry, position, orientation);
        this.rootEntry.three.add(entry.three);
        const nodeId = this.track(entry);
        this.updateHandlers[nodeId] = () => {
            entry.three.rotation.y += 0.01;
            return entry.three.rotation.y;
        };
        return nodeId;
    }

    addMarkerObject(): SceneNodeId {
        const entry = createPrimitiveNode(this.sceneNodes, PRIMITIVES.box, [0.75, 0, 0, 1], false);
        this.rootEntry.three.add(entry.three);
        return this.track(entry);
    }

    addReticle(): SceneNodeId {
        return this.addModel('/media/models/reticle.gltf', [0, 0, 0], [0, 0, 0, 1]);
    }

    /** Matches OGL `isHorizontal`: pitch (Euler x) ≈ 0 for floor alignment. */
    isHorizontal(orientation: ReadonlyQuat): boolean {
        const euler = new THREE.Euler().setFromQuaternion(
            new THREE.Quaternion(orientation[0], orientation[1], orientation[2], orientation[3]),
            'XYZ',
        );
        return Math.abs(euler.x) < Number.EPSILON;
    }

    addRandomObject(position: ReadonlyVec3, orientation: ReadonlyQuat): SceneNodeId {
        return this.addObject(position, orientation, createRandomObjectDescription());
    }

    addObject(position: ReadonlyVec3, orientation: ReadonlyQuat, objectDescription: ObjectDescription): SceneNodeId {
        const entry = createObjectDescriptionNode(this.sceneNodes, objectDescription);
        this.sceneNodes.applyTrs(entry, position, orientation);
        this.rootEntry.three.add(entry.three);
        return this.track(entry);
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
        return null;
    }

    getDynamicObjectNodeId(objectId: string): SceneNodeId | null {
        return null;
    }

    removeDynamicObject(objectId: string): void {
        /* no-op */
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
        const axes = new THREE.AxesHelper(1);
        const entry = this.sceneNodes.register(axes);
        this.rootEntry.three.add(axes);
        return this.track(entry);
    }

    async addPlyObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        plyOptions?: PlyLoadOptions,
    ): Promise<SceneNodeId | null> {
        console.warn('ThreeEngine (minimal): addPlyObject not implemented');
        return null;
    }

    async addPointCloudObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        options?: PlyLoadOptions & { contentType?: string; scrContentType?: string },
    ): Promise<SceneNodeId | null> {
        console.warn('ThreeEngine (minimal): addPointCloudObject not implemented');
        return null;
    }

    async addLogoObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        width?: number,
        height?: number,
    ): Promise<void> {
        console.warn('ThreeEngine (minimal): addLogoObject not implemented');
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
        console.warn('ThreeEngine (minimal): addVideoObject not implemented');
    }

    setVerticallyRotating(node: SceneNodeId): void {
        notImplemented('setVerticallyRotating');
    }

    setTowardsCameraRotating(node: SceneNodeId): void {
        notImplemented('setTowardsCameraRotating');
    }

    addClickEvent(modelId: SceneNodeId, handler: () => void): void {
        this.eventHandlers[modelId] = { handler };
    }

    getClickEvent(modelId: string): (() => void) | undefined {
        return this.eventHandlers[modelId]?.handler;
    }

    getExternalCameraParameters(view: XRView, experienceMatrix: ReadonlyMat4): ExternalCameraParameters {
        return getExternalCameraParametersForExperience(view, experienceMatrix);
    }

    getRootSceneUpdater(): (matrix: SceneRootMatrix) => mat4 {
        const out = mat4.create();
        return (matrix: SceneRootMatrix) => {
            this.scene.matrix.fromArray(matrix as number[]);
            this.scene.matrixAutoUpdate = false;
            this.scene.updateMatrixWorld(true);
            mat4.copy(out, this.scene.matrixWorld.elements as mat4);
            return out;
        };
    }

    setWaiting(modelId: SceneNodeId): void {
        notImplemented('setWaiting');
    }

    setExperimentTapHandler(callback: (tap: { x: number; y: number }) => void): void {
        this.experimentTapHandler = callback;
    }

    resize(): void {
        if (!this.renderer) {
            return;
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    reinitialize(): void {
        this.cleanup();
        this.initScene();
    }

    cleanup(): void {
        while (this.scene.children.length > 0) {
            const child = this.scene.children[0];
            this.scene.remove(child);
            child.traverse((threeObject: THREE.Object3D) => {
                const mesh = threeObject as THREE.Mesh;
                if (mesh.isMesh) {
                    mesh.geometry?.dispose();
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach((material: THREE.Material) => material.dispose());
                    } else {
                        mesh.material?.dispose();
                    }
                }
            });
        }
        this.objectsById.clear();
        for (const key of Object.keys(this.eventHandlers)) {
            delete this.eventHandlers[key];
        }
    }

    remove(modelId: SceneNodeId): void {
        const entry = this.resolve(modelId);
        entry.three.removeFromParent();
        this.objectsById.delete(modelId);
        delete this.eventHandlers[modelId];
    }

    stop(): void {
        if (this.listenersAttached) {
            window.removeEventListener('resize', this.boundResize, false);
            document.removeEventListener('click', this.boundClick);
            this.listenersAttached = false;
        }
        this.experimentTapHandler = null;
    }

    updateMatrixWorld(): void {
        this.scene.updateMatrixWorld(true);
    }

    render(time: DOMHighResTimeStamp, view: XRView): void {
        void time;
        if (!this.renderer) {
            return;
        }

        const t = view.transform;
        this.camera.projectionMatrix.fromArray(view.projectionMatrix as unknown as number[]);
        this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
        this.camera.position.set(t.position.x, t.position.y, t.position.z);
        this.camera.quaternion.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
        this.camera.updateMatrixWorld();

        this.renderer.render(this.scene, this.camera);
    }

    addDebugAxesAtWorldMatrix(
        worldMatrix: ReadonlyMat4,
        color: [number, number, number, number],
        showAxes = false,
    ): SceneNodeId {
        const group = new THREE.Group();
        const box = createPrimitiveNode(this.sceneNodes, PRIMITIVES.box, color, color[3] < 1, [0.05, 0.05, 0.05]);
        group.add(box.three);
        if (showAxes) {
            group.add(new THREE.AxesHelper(0.2));
        }
        const entry = this.sceneNodes.register(group);
        group.matrix.fromArray(worldMatrix as unknown as number[]);
        group.matrixAutoUpdate = false;
        group.updateMatrixWorld(true);
        this.rootEntry.three.add(group);
        return this.track(entry);
    }

    updateSceneGraphTransforms(): void {
        this.scene.updateMatrixWorld(true);
    }

    private handleClick(event: MouseEvent): void {
        if (!this.renderer) {
            return;
        }
        const rect = this.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            (2 * (event.clientX - rect.left)) / rect.width - 1,
            1 - (2 * (event.clientY - rect.top)) / rect.height,
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(ndc, this.camera);
        const roots = Object.keys(this.eventHandlers).map((nodeId) => this.resolve(nodeId).three);
        const hits = raycaster.intersectObjects(roots, true);
        if (hits.length > 0) {
            let threeObject: THREE.Object3D | null = hits[0].object;
            while (threeObject) {
                const hitEntry = threeObject.userData.threeSceneObject as ThreeSceneObject | undefined;
                if (hitEntry) {
                    const nodeId = this.sceneNodes.sceneNodeRef(hitEntry);
                    if (this.eventHandlers[nodeId]) {
                        this.eventHandlers[nodeId].handler();
                        return;
                    }
                }
                threeObject = threeObject.parent;
            }
        }
        if (this.experimentTapHandler) {
            this.experimentTapHandler({ x: event.clientX, y: event.clientY });
        }
    }
}
