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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mat4, quat, vec3, type ReadonlyMat4, type ReadonlyQuat, type ReadonlyVec3 } from 'gl-matrix';

import { getExternalCameraParametersForExperience, type ExternalCameraParameters } from '@core/engines/externalCameraPose';
import { pointCloudFormatFromRef } from '@core/contents/contentFormats';
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
import {
    clearRegisteredThreeParticleSystems,
    createThreeParticlePoints,
    getThreeParticleIntensity,
    isRegisteredThreeParticleSystem,
    registerThreeParticleSystem,
    setThreeParticleIntensity,
    unregisterThreeParticleSystem,
    updateThreeParticles,
} from './threeParticleHelper';
import { loadThreePlyFromUrl } from './threePlyHelper';

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
    private readonly gltfLoader = new GLTFLoader();

    private readonly sceneNodes = new ThreeSceneNodeRegistry();
    private readonly rootEntry = this.sceneNodes.register(this.scene);
    private readonly objectsById = new Map<SceneNodeId, ThreeSceneObject>();

    private experimentTapHandler: ((tap: { x: number; y: number }) => void) | null = null;
    private readonly eventHandlers: Record<string, { handler: () => void }> = {};
    private readonly updateHandlers: Record<string, () => number> = {};
    private readonly verticallyRotatingNodes: ThreeSceneObject[] = [];
    private readonly towardsCameraRotatingNodes: ThreeSceneObject[] = [];
    private readonly dynamicDescriptions: Record<string, ObjectDescription> = {};
    private readonly dynamicMeshes: Record<string, ThreeSceneObject> = {};
    private readonly gltfRoots: Record<ModelName, ThreeSceneObject> = {};

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
        scale: ReadonlyVec3 = unitScale,
        callback?: (nodeId: SceneNodeId) => void,
        name?: ModelName,
    ): SceneNodeId {
        const root = this.sceneNodes.register(new THREE.Group());
        this.sceneNodes.applyTrs(root, position, orientation, scale);
        this.rootEntry.three.add(root.three);

        void this.gltfLoader.loadAsync(url).then(
            (gltf) => {
                const loaded: SceneNodeId[] = [];
                gltf.scene.traverse((childObject: THREE.Object3D) => {
                    if ((childObject as THREE.Mesh).isMesh) {
                        loaded.push(this.track(this.sceneNodes.register(childObject)));
                    }
                });
                root.three.add(gltf.scene);
                root.three.updateMatrixWorld(true);
                if (callback) {
                    for (const nodeId of loaded) {
                        callback(nodeId);
                    }
                }
            },
            (error: unknown) => {
                console.error('ThreeEngine: GLTF load failed', error);
                const fallback = createPrimitiveNode(this.sceneNodes, PRIMITIVES.box, [1, 0, 0, 0.5], true);
                root.three.add(fallback.three);
            },
        );

        if (name) {
            this.gltfRoots[name] = root;
        }
        return this.track(root);
    }

    addModelWithRigidPose(
        url: string,
        pose: RigidPose,
        scale: ReadonlyVec3 = unitScale,
        callback?: (nodeId: SceneNodeId) => void,
        name?: ModelName,
    ): SceneNodeId {
        return this.addModel(
            url,
            vec3.fromValues(pose.position.x, pose.position.y, pose.position.z),
            quat.fromValues(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w),
            scale,
            callback,
            name,
        );
    }

    getModel(name: ModelName): SceneNodeId | null {
        const root = this.gltfRoots[name];
        if (!root) {
            return null;
        }
        return this.sceneNodes.sceneNodeRef(root);
    }

    removeModel(name: ModelName): void {
        const root = this.gltfRoots[name];
        if (root) {
            this.remove(this.sceneNodes.sceneNodeRef(root));
            delete this.gltfRoots[name];
        }
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
        const points = createThreeParticlePoints(particleSystem);
        points.position.set(position[0], position[1], position[2]);
        points.quaternion.set(orientation[0], orientation[1], orientation[2], orientation[3]);
        this.rootEntry.three.add(points);
        const entry = this.sceneNodes.register(points);
        const nodeId = this.track(entry);
        registerThreeParticleSystem(nodeId, {
            points,
            shape: particleSystem.shape,
            systemSize: particleSystem.systemSize,
            speed: particleSystem.speed,
        });
        return nodeId;
    }

    updateParticleIntensity(sceneNodeId: SceneNodeId, calculate: (oldValue: number) => number): number {
        const oldIntensity = getThreeParticleIntensity(sceneNodeId);
        if (oldIntensity <= 0) {
            console.error('ThreeEngine: tried to modify missing particle system');
            return -1;
        }
        const newIntensity = Math.max(1, Math.round(calculate(oldIntensity)));
        setThreeParticleIntensity(sceneNodeId, newIntensity);
        return newIntensity;
    }

    updateParticleSystem(sceneNodeId: SceneNodeId): void {
        if (!isRegisteredThreeParticleSystem(sceneNodeId)) {
            return;
        }
        updateThreeParticles(sceneNodeId);
    }

    addDynamicObject(
        objectId: string,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        objectDescription: ObjectDescription | null = null,
    ): SceneNodeId {
        const description =
            objectDescription ??
            ({
                version: 2,
                color: [1, 1, 1, 0.5],
                shape: PRIMITIVES.sphere,
                scale: [0.25, 0.25, 0.25],
                transparent: true,
                options: {},
            } satisfies ObjectDescription);
        const entry = createObjectDescriptionNode(this.sceneNodes, description);
        this.sceneNodes.applyTrs(entry, position, orientation);
        this.rootEntry.three.add(entry.three);
        this.dynamicDescriptions[objectId] = description;
        this.dynamicMeshes[objectId] = entry;
        return this.track(entry);
    }

    addDynamicObjectWithRigidPose(
        objectId: string,
        pose: RigidPose,
        objectDescription: ObjectDescription | null = null,
    ): SceneNodeId {
        return this.addDynamicObject(
            objectId,
            vec3.fromValues(pose.position.x, pose.position.y, pose.position.z),
            quat.fromValues(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w),
            objectDescription,
        );
    }

    updateDynamicObject(
        objectId: string,
        position: ReadonlyVec3 | null = null,
        orientation: ReadonlyQuat | null = null,
        objectDescription: ObjectDescription | null = null,
    ): boolean {
        const entry = this.dynamicMeshes[objectId];
        if (!entry) {
            return false;
        }
        if (position && orientation) {
            this.sceneNodes.applyTrs(entry, position, orientation);
        } else if (position) {
            this.sceneNodes.applyTrs(entry, position, [
                entry.three.quaternion.x,
                entry.three.quaternion.y,
                entry.three.quaternion.z,
                entry.three.quaternion.w,
            ]);
        } else if (orientation) {
            this.sceneNodes.applyTrs(
                entry,
                [entry.three.position.x, entry.three.position.y, entry.three.position.z],
                orientation,
            );
        }

        const oldDesc = this.dynamicDescriptions[objectId];
        if (objectDescription && JSON.stringify(oldDesc) !== JSON.stringify(objectDescription)) {
            const handler = this.getClickEvent(objectId);
            const savedPosition =
                position ??
                vec3.fromValues(entry.three.position.x, entry.three.position.y, entry.three.position.z);
            const savedOrientation =
                orientation ??
                quat.fromValues(
                    entry.three.quaternion.x,
                    entry.three.quaternion.y,
                    entry.three.quaternion.z,
                    entry.three.quaternion.w,
                );
            this.removeDynamicObject(objectId);
            const created = this.addDynamicObject(objectId, savedPosition, savedOrientation, objectDescription);
            if (handler) {
                this.addClickEvent(created, handler);
            }
        }
        return true;
    }

    updateDynamicObjectWithRigidPose(
        objectId: string,
        pose: RigidPose,
        objectDescription: ObjectDescription | null = null,
    ): boolean {
        return this.updateDynamicObject(
            objectId,
            vec3.fromValues(pose.position.x, pose.position.y, pose.position.z),
            quat.fromValues(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w),
            objectDescription,
        );
    }

    getDynamicObjectDescription(objectId: string): ObjectDescription | null {
        return this.dynamicDescriptions[objectId] ?? null;
    }

    getDynamicObjectNodeId(objectId: string): SceneNodeId | null {
        const entry = this.dynamicMeshes[objectId];
        return entry ? this.sceneNodes.sceneNodeRef(entry) : null;
    }

    removeDynamicObject(objectId: string): void {
        const entry = this.dynamicMeshes[objectId];
        if (!entry) {
            return;
        }
        this.remove(this.sceneNodes.sceneNodeRef(entry));
        delete this.dynamicMeshes[objectId];
        delete this.dynamicDescriptions[objectId];
    }

    updateMarkerObjectPosition(object: SceneNodeId, position: ReadonlyVec3, orientation: ReadonlyQuat): void {
        this.sceneNodes.applyTrs(this.resolve(object), position, orientation);
    }

    updateReticlePose(
        reticle: SceneNodeId,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        scale: ReadonlyVec3 = defaultReticleScale,
    ): void {
        this.sceneNodes.applyTrs(this.resolve(reticle), position, orientation, scale);
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
        try {
            const loaded = await loadThreePlyFromUrl(url, plyOptions ?? {});
            if (!loaded) {
                console.error(`ThreeEngine: failed to load PLY from ${url}`);
                return null;
            }
            let meshLike: THREE.Object3D;
            if (loaded.primitive === 'triangles') {
                const material = new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    metalness: 0.2,
                    roughness: 0.8,
                });
                meshLike = new THREE.Mesh(loaded.geometry, material);
            } else {
                const material = new THREE.PointsMaterial({
                    size: 0.02,
                    vertexColors: true,
                    sizeAttenuation: true,
                });
                meshLike = new THREE.Points(loaded.geometry, material);
            }
            meshLike.position.set(position[0], position[1], position[2]);
            meshLike.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
            this.rootEntry.three.add(meshLike);
            const entry = this.sceneNodes.register(meshLike);
            return this.track(entry);
        } catch (error) {
            console.error(`ThreeEngine: PLY load error for ${url}`, error);
            return null;
        }
    }

    async addPointCloudObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        options?: PlyLoadOptions & { contentType?: string; scrContentType?: string },
    ): Promise<SceneNodeId | null> {
        const { contentType = '', scrContentType, ...plyOpts } = options ?? {};
        const format = pointCloudFormatFromRef(url, contentType, scrContentType);
        if (format === 'ply') {
            return this.addPlyObject(
                url,
                position,
                quaternion,
                Object.keys(plyOpts).length > 0 ? (plyOpts as PlyLoadOptions) : undefined,
            );
        }
        console.warn(
            `ThreeEngine addPointCloudObject: unsupported format for ${url} (MIME: ${contentType || 'none'}, SCR: ${scrContentType ?? 'unspecified'})`,
        );
        return null;
    }

    async addLogoObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        width = 1.0,
        height = 1.0,
    ): Promise<void> {
        const textureLoader = new THREE.TextureLoader();
        try {
            const texture = await textureLoader.loadAsync(url);
            texture.colorSpace = THREE.SRGBColorSpace;
            const geometry = new THREE.PlaneGeometry(width, height);
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
            const plane = new THREE.Mesh(geometry, material);
            plane.position.set(position[0], position[1], position[2]);
            plane.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
            this.rootEntry.three.add(plane);
        } catch (error) {
            console.error('ThreeEngine: addLogoObject failed', error);
        }
    }

    async addTextObject(
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        text: string,
        textColor?: ReadonlyVec3,
    ): Promise<SceneNodeId> {
        void text;
        const rgb: [number, number, number, number] = textColor
            ? [textColor[0], textColor[1], textColor[2], 0.3]
            : [1, 1, 1, 0.3];
        const entry = createPrimitiveNode(this.sceneNodes, PRIMITIVES.box, rgb, true, [0.2, 0.05, 0.05]);
        this.sceneNodes.applyTrs(entry, position, quaternion);
        this.rootEntry.three.add(entry.three);
        return this.track(entry);
    }

    async addTextObjectWithRigidPose(
        pose: RigidPose,
        text: string,
        options?: { textColor?: [number, number, number]; positionOffset?: [number, number, number] },
    ): Promise<SceneNodeId> {
        const ox = options?.positionOffset?.[0] ?? 0;
        const oy = options?.positionOffset?.[1] ?? 0;
        const oz = options?.positionOffset?.[2] ?? 0;
        const position = vec3.fromValues(pose.position.x + ox, pose.position.y + oy, pose.position.z + oz);
        const orientation = quat.fromValues(
            pose.orientation.x,
            pose.orientation.y,
            pose.orientation.z,
            pose.orientation.w,
        );
        const textColor = options?.textColor
            ? vec3.fromValues(options.textColor[0], options.textColor[1], options.textColor[2])
            : vec3.fromValues(1, 1, 1);
        return this.addTextObject(position, orientation, text, textColor);
    }

    async addVideoObject(position: ReadonlyVec3, quaternion: ReadonlyQuat, videoUrl: string): Promise<void> {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        try {
            await video.play();
        } catch {
            /* autoplay may require gesture; texture still updates when playing */
        }
        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        const geometry = new THREE.PlaneGeometry(1.6, 0.9);
        const material = new THREE.MeshBasicMaterial({ map: videoTexture, transparent: true, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position[0], position[1], position[2]);
        mesh.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
        mesh.userData.threeVideoElement = video;
        this.rootEntry.three.add(mesh);
    }

    setVerticallyRotating(node: SceneNodeId): void {
        this.verticallyRotatingNodes.push(this.resolve(node));
    }

    setTowardsCameraRotating(node: SceneNodeId): void {
        this.towardsCameraRotatingNodes.push(this.resolve(node));
    }

    addClickEvent(modelId: SceneNodeId, handler: () => void): void {
        this.eventHandlers[modelId] = { handler };
    }

    getClickEvent(modelId: string): (() => void) | undefined {
        if (this.eventHandlers[modelId]) {
            return this.eventHandlers[modelId].handler;
        }
        const nodeId = this.getDynamicObjectNodeId(modelId);
        if (nodeId && this.eventHandlers[nodeId]) {
            return this.eventHandlers[nodeId].handler;
        }
        return undefined;
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
        const entry = this.resolve(modelId);
        const root = entry.three;
        root.traverse((child: THREE.Object3D) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) {
                return;
            }
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const material of materials) {
                if (!material) continue;
                if ('emissive' in material && (material as THREE.MeshStandardMaterial).emissive) {
                    (material as THREE.MeshStandardMaterial).emissive.set(1, 1, 0);
                    if ('emissiveIntensity' in material) {
                        (material as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(
                            (material as THREE.MeshStandardMaterial).emissiveIntensity ?? 1,
                            0.6,
                        );
                    }
                } else if ('color' in material && (material as THREE.MeshBasicMaterial).color) {
                    (material as THREE.MeshBasicMaterial).color.set(1, 1, 0);
                }
            }
        });
        this.updateHandlers[modelId] = () => {
            root.rotation.y += 0.02;
            return root.rotation.y;
        };
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
        clearRegisteredThreeParticleSystems();
        for (const key of Object.keys(this.updateHandlers)) {
            delete this.updateHandlers[key];
        }
        for (const id of Object.keys(this.dynamicMeshes)) {
            this.removeDynamicObject(id);
        }
        for (const id of Object.keys(this.gltfRoots)) {
            this.removeModel(id);
        }
        while (this.scene.children.length > 0) {
            const child = this.scene.children[0];
            child.traverse((node: THREE.Object3D) => {
                const video = node.userData?.threeVideoElement as HTMLVideoElement | undefined;
                if (video) {
                    video.pause();
                    video.src = '';
                }
            });
            this.scene.remove(child);
            disposeThreeSubtree(child);
        }
        this.verticallyRotatingNodes.length = 0;
        this.towardsCameraRotatingNodes.length = 0;
        this.objectsById.clear();
        for (const key of Object.keys(this.eventHandlers)) {
            delete this.eventHandlers[key];
        }
    }

    remove(modelId: SceneNodeId): void {
        if (isRegisteredThreeParticleSystem(modelId)) {
            unregisterThreeParticleSystem(modelId);
        }
        const entry = this.resolve(modelId);
        disposeThreeSubtree(entry.three);
        entry.three.removeFromParent();
        this.objectsById.delete(modelId);
        delete this.updateHandlers[modelId];
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

        Object.values(this.updateHandlers).forEach((handler) => handler());

        for (const entry of this.verticallyRotatingNodes) {
            entry.three.rotation.y += 0.01;
        }

        for (const entry of this.towardsCameraRotatingNodes) {
            entry.three.lookAt(this.camera.position);
        }

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
