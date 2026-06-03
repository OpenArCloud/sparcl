/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import {
    Camera,
    Euler,
    GLTFLoader,
    Mat4,
    Raycast,
    Renderer,
    Transform,
    Vec2,
    AxesHelper,
    Mesh,
    Plane,
    Geometry,
    Program,
    Quat,
    Vec3,
    Polyline,
    Color,
    type OGLRenderingContext,
    Mat3,
    type GLTF,
    type GLTFDescription,
} from 'ogl';

import { createSimpleGltfProgram } from '@core/engines/ogl/oglGltfHelper';
import { getPlyMeshProgram, getPlyPointsProgram, MyPLYLoader } from '@core/engines/ogl/oglPlyHelper';
import type { PlyLoadOptions } from '@core/contents/pointcloud';
import { pointCloudFormatFromRef } from '@core/contents/contentFormats';
import { loadLogoTexture, createLogoProgram } from '@core/engines/ogl/oglLogoHelper';
import { loadTextMesh } from '@core/engines/ogl/oglTextHelper';
import * as videoHelper from '@core/engines/ogl/oglVideoHelper';

import {
    createAxesBoxPlaceholder,
    createModel,
    createProgram,
    createWaitingProgram,
    getAxes,
    getDefaultMarkerObject,
    getDefaultPlaceholder,
    getExperiencePlaceholder,
} from '@core/engines/ogl/oglPrimitives';
import { createRandomObjectDescription, type ObjectDescription } from '@core/contents/objectDescription';
import { PRIMITIVES, type PrimitiveShape } from '@core/contents/primitives';
import type { SceneRootMatrix } from '../../../types/xr';
import type { ModelName, RenderingEngine, SceneNodeId } from '@core/engines/RenderingEngine';
import type { ParticleSystem } from '@core/contents/particleSystem';
import {
    clearRegisteredParticleSystems,
    createParticleSystem,
    getParticleIntensity,
    isRegisteredParticleSystem,
    registerParticleSystem,
    setParticleIntensity,
    unregisterParticleSystem,
    updateParticles,
} from '@core/engines/ogl/oglParticleHelper';
import { OglSceneNodeRegistry } from '@core/engines/ogl/oglSceneNodeRegistry';

import { checkGLError } from '@core/devTools';
import { getExternalCameraParametersForExperience, type ExternalCameraParameters } from '@core/engines/externalCameraPose';

import { mat4, vec3, quat, type ReadonlyMat4, type ReadonlyQuat, type ReadonlyVec3 } from 'gl-matrix';
import type { RigidPose } from '@core/frameTransforms';

let gl: OGLRenderingContext;
let renderer: Renderer;
let lastRenderTime = 0;
let scene: Transform;
let camera: Camera;
let axesHelper;
let updateHandlers: Record<string, () => number> = {};
let eventHandlers: Record<string, { model: Mesh; handler: () => void }> = {};
let uniforms = { time: [] as Mesh<Geometry, Program>[] };

let experimentTapHandler: null | ((e: { x: number; y: number }) => void) = null;

let dynamic_objects_descriptions: Record<string, ObjectDescription> = {};
let dynamic_objects_meshes: Record<string, Mesh> = {};

let gltf_objects_transforms: Record<ModelName, Transform> = {};

let towardsCameraRotatingNodes: Transform[] = [];
let verticallyRotatingNodes: Transform[] = [];

let gltfCache: Record<string, GLTFDescription> = {};

// whether to print verbose logs in the console
const debugOgl = false;

/** Maps a neutral {@link RigidPose} to OGL vec types (internal to this engine). */
function oglTrsFromRigidPose(pose: RigidPose): { position: Vec3; quaternion: Quat } {
    return {
        position: new Vec3(pose.position.x, pose.position.y, pose.position.z),
        quaternion: new Quat(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w),
    };
}

function oglVec3(v: ReadonlyVec3): Vec3 {
    return new Vec3(v[0], v[1], v[2]);
}

function oglQuat(q: ReadonlyQuat): Quat {
    return new Quat(q[0], q[1], q[2], q[3]);
}

/**
 * Implementation of the 3D features required by sparcl using ogl.
 * https://github.com/oframe/ogl
 */
export default class ogl implements RenderingEngine {
    private readonly sceneNodes = new OglSceneNodeRegistry();

    getNodePose(
        nodeId: SceneNodeId,
        outPosition: vec3,
        outOrientation: quat,
        outScale?: vec3
    ): void {
        const native = this.sceneNodes.get(nodeId);
        vec3.set(outPosition, native.position[0], native.position[1], native.position[2]);
        quat.set(outOrientation, native.quaternion[0], native.quaternion[1], native.quaternion[2], native.quaternion[3]);
        if (outScale) {
            vec3.set(outScale, native.scale[0], native.scale[1], native.scale[2]);
        }
    }

    setNodePose(
        nodeId: SceneNodeId,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        scale?: ReadonlyVec3
    ): void {
        const native = this.sceneNodes.get(nodeId);
        native.position.copy(oglVec3(position));
        native.quaternion.copy(oglQuat(orientation));
        if (scale) {
            native.scale.copy(oglVec3(scale));
        }
    }

    translateNode(nodeId: SceneNodeId, dx: number, dy: number, dz: number) {
        const native = this.sceneNodes.get(nodeId);
        native.position.x += dx;
        native.position.y += dy;
        native.position.z += dz;
    }

    setNodeUniformScale(nodeId: SceneNodeId, scale: number) {
        const native = this.sceneNodes.get(nodeId);
        native.scale.set(scale, scale, scale);
    }

    setNodeVisible(nodeId: SceneNodeId, visible: boolean) {
        this.sceneNodes.get(nodeId).visible = visible;
    }

    isNodeVisible(nodeId: SceneNodeId) {
        return this.sceneNodes.get(nodeId).visible;
    }

    getNodeWorldMatrix(nodeId: SceneNodeId, out: mat4) {
        const native = this.sceneNodes.get(nodeId);
        native.updateMatrixWorld(true);
        mat4.copy(out, native.matrix as unknown as mat4);
    }

    /**
     * Initialize ogl for use with WebXR.
     */
    init() {
        renderer = new Renderer({
            alpha: true,
            canvas: document.querySelector('#application') as HTMLCanvasElement,
            dpr: window.devicePixelRatio,
            webgl: 2,
        });

        gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);

        scene = new Transform();

        camera = new Camera(gl);
        camera.position.set(0, 0, 0);
        camera.quaternion.set(0, 0, 0, 1);

        this.initScene();

        window.addEventListener('resize', () => this.resize(), false);
        this.resize();

        document.addEventListener('click', this._handleEvent);

        checkGLError(gl, 'OGL init end');
    }

    /**
     * Initialize the virtual environment
     */
    initScene() {
        if (debugOgl) console.log('OGL initScene');

        if (!gl) {
            console.log('OGL WARNING: GL is not initilized yet!');
            return;
        }

        // Visualize axes
        axesHelper = new AxesHelper(gl, { size: 1, symmetric: false });
        axesHelper.setParent(scene);

        // Our camera images are captured into texture 0, and therefore the first loaded textured object (that normally gets text id 0)
        // in the scene sometimes is painted not from its own texture but from the camera image texture.
        // To overcome this problem, we create an OGL texture here which we will never use but it reserves ID 0 in view of OGL.
        loadLogoTexture(gl, '/media/icons/icon_x48.png').then((texture) => {
            if (texture === undefined) {
                console.log('OGL ERROR: logo texture ID is undefined!');
                return;
            }
            if(debugOgl) console.log('OGL Dummy TEXTURE ID: ' + texture.id);
            const dummyProgram = createLogoProgram(gl, texture);
            const dummyGeometry = new Plane(gl, { width: 0.1, height: 0.1 });
            const dummyMesh = new Mesh(gl, {
                geometry: dummyGeometry,
                program: dummyProgram,
                frustumCulled: false,
            });
            dummyMesh.setParent(scene);
        });

        // TODO: Add light
        // TODO: Use environmental lighting?!
    }

    /**
     * Add a general placeholder to the scene.
     *
     * @param keywords - Defines the kind of placeholder to create
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param orientation - Scene orientation ({@link ReadonlyQuat})
     * @returns Opaque {@link SceneNodeId} for the placeholder root
     */
    addPlaceholder(
        keywords: string | string[] | undefined,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
    ) {
        if (debugOgl) console.log('OGL addPlaceholder');
        const placeholder = getDefaultPlaceholder(gl);
        placeholder.position.copy(oglVec3(position));
        placeholder.quaternion.copy(oglQuat(orientation));
        placeholder.setParent(scene);
        return this.sceneNodes.add(placeholder);
    }

    /**
     * Add a general 3D polyline to the scene.
     *
     * @param points - Polyline vertices ({@link ReadonlyVec3}[])
     * @param hexColor - CSS-style hex color string
     * @returns {@link SceneNodeId} for the polyline mesh
     */
    addPolyline(
        points: ReadonlyVec3[],
        hexColor: string
    ) {
        const polyline = new Polyline(gl, {
            points: points.map((p) => oglVec3(p)),
            uniforms: {
                uColor: { value: new Color(hexColor) },
                uThickness: { value: 5 },
            },
        });
        const mesh = new Mesh(gl, { geometry: polyline.geometry, program: polyline.program });
        mesh.setParent(scene);
        return this.sceneNodes.add(mesh);
    }

    /**
     * Create a primitive placeholder with custom shader/options (experiments).
     *
     * @param shape - Primitive shape id
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param orientation - Scene orientation ({@link ReadonlyQuat})
     * @param color - RGBA color or `undefined` for random
     * @param fragmentShader - Optional fragment shader source
     * @param options - Shape-specific constructor options
     * @returns {@link SceneNodeId} for the placeholder mesh
     */
    addPlaceholderWithOptions(
        shape: PrimitiveShape,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        color: [number, number, number, number] | undefined,
        fragmentShader: string | undefined,
        options: any = {},
    ) {
        if (color === undefined) {
            color = [Math.random(), Math.random(), Math.random(), 1];
        }
        const placeholder = createModel(gl, shape, color!, false, options);
        placeholder.position.copy(oglVec3(position));
        placeholder.quaternion.copy(oglQuat(orientation));
        placeholder.setParent(scene);
        if (fragmentShader !== undefined) {
            placeholder.program = createProgram(gl, {
                fragment: fragmentShader,
                uniforms: {
                    uTime: { value: 0.0 },
                },
            });
            uniforms.time[placeholder.id] = placeholder;
        }
        return this.sceneNodes.add(placeholder);
    }

    /**
     * Add a GLTF/GLB model to the scene.
     *
     * @param url - Model URL
     * @param position - Root position ({@link ReadonlyVec3})
     * @param orientation - Root orientation ({@link ReadonlyQuat})
     * @param scale - Root uniform/non-uniform scale ({@link ReadonlyVec3})
     * @param callback - Called once per loaded mesh leaf with its {@link SceneNodeId}
     * @param name - Optional {@link ModelName} for {@link getModel} / {@link removeModel}
     * @returns {@link SceneNodeId} for the GLTF root transform
     */
    addModel(
        url: string,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        scale: ReadonlyVec3 = [1.0, 1.0, 1.0],
        callback?: (mesh: SceneNodeId) => void,
        name?: ModelName,
    ): SceneNodeId {
        if (debugOgl) {
            console.log('OGL addModel: ' + url);
        }
        const gltfScene = new Transform();
        gltfScene.position.copy(oglVec3(position));
        gltfScene.quaternion.copy(oglQuat(orientation));
        gltfScene.scale.copy(oglVec3(scale));
        gltfScene.setParent(scene);

        const engine = this;
        function afterLoad(gltf: GLTF) {
            const loadedMeshes: SceneNodeId[] = [];
            const s = (gltf.scene || gltf.scenes[0]) as Transform[]; // WARNING: we handle a single scene per GLTF only
            s.forEach((root) => {
                root.setParent(gltfScene);
                root.traverse((node) => {
                    if ((node as Mesh).program) {
                        // TODO: cast node to Mesh
                        // HACK: the types suggest that program cannot exist on node. If this is true this if block should be removed altogether. If it's not true, PR needs to be created to update the ogl types.
                        (node as Mesh).program = createSimpleGltfProgram(node as Mesh);
                        loadedMeshes.push(engine.sceneNodes.add(node as Mesh));
                    }
                });
            });
            if (callback) {
                for (const mesh of loadedMeshes) {
                    callback(mesh);
                }
            }
            scene.updateMatrixWorld();
        }

        if (Object.keys(gltfCache).includes(url)) {
            if(debugOgl) console.log('OGL loading from cache: ', url);
            const dir = url.split('/').slice(0, -1).join('/') + '/';
            void GLTFLoader.parse(gl, gltfCache[url], dir).then((gltf) => {
                afterLoad(gltf);
            });
        } else {
            if(debugOgl) console.log('OGL loading from Web: ' + url);
            void GLTFLoader.load(gl, url)
                .then((gltf) => {
                    if (url.match(/\.glb/)) {
                        // TODO also cache .gltf
                        fetch(url)
                            .then((res) => res.arrayBuffer())
                            .then((glb) => (gltfCache[url] = GLTFLoader.unpackGLB(glb)));
                    }
                    afterLoad(gltf);
                })
                .catch((error) => {
                    console.error('OGL ERROR: ' + error);
                    console.log('Unable to load model from URL: ' + url);
                    console.log('Adding placeholder box instead');
                    let gltfPlaceholder = createAxesBoxPlaceholder(gl, [1.0, 0.0, 0.0, 0.5], false); // red
                    gltfScene.addChild(gltfPlaceholder);
                    scene.updateMatrixWorld();
                });
        }

        if (name) {
            gltf_objects_transforms[name] = gltfScene;
        }
        return this.sceneNodes.add(gltfScene);
    }

    /**
     * @param pose - Content pose in scene space ({@link RigidPose})
     * @returns {@link SceneNodeId} for the GLTF root (delegates to {@link addModel})
     */
    addModelWithRigidPose(
        url: string,
        pose: RigidPose,
        scale: [number, number, number] = [1, 1, 1],
        callback?: (nodeId: SceneNodeId) => void,
        name?: ModelName,
    ): SceneNodeId {
        const { position, quaternion } = oglTrsFromRigidPose(pose);
        const scaleVec3 = new Vec3().set(scale[0], scale[1], scale[2]);
        return this.addModel(url, position, quaternion, scaleVec3, callback, name);
    }

    /**
     * @param name - {@link ModelName} passed to {@link addModel}
     * @returns {@link SceneNodeId} of the GLTF root, or `null` if not cached
     */
    getModel(name: ModelName): SceneNodeId | null {
        const native = gltf_objects_transforms[name];
        if (!native) {
            return null;
        }
        return this.sceneNodes.getId(native);
    }

    /**
     * Removes a cached GLTF root by {@link ModelName}.
     *
     * @param name - Key passed to {@link addModel}
     */
    removeModel(name: ModelName) {
        const native = gltf_objects_transforms[name];
        if (!native) {
            return;
        }
        const nodeId = this.sceneNodes.getId(native);
        if (nodeId !== null) {
            this.sceneNodes.setNative(nodeId, native);
            this.remove(nodeId);
        }
        delete gltf_objects_transforms[name];
    }

    /**
     * Add placeholder for loadable scene.
     *
     * Indicates visually that the placeholder can load a scene.
     *
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param orientation - Scene orientation ({@link ReadonlyQuat})
     * @returns {@link SceneNodeId} for the spinning placeholder
     */
    addExperiencePlaceholder(
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
    ): SceneNodeId {
        const placeholder = getExperiencePlaceholder(gl);
        placeholder.position.copy(oglVec3(position));
        placeholder.quaternion.copy(oglQuat(orientation));
        placeholder.setParent(scene);
        const nodeId = this.sceneNodes.add(placeholder);
        updateHandlers[nodeId] = () => (placeholder.rotation.y += 0.01);
        return nodeId;
    }

    /**
     * Add object to be placed on top of marker image.
     *
     * Used for some experiments before, not currently used.
     * How to properly handle markers is undecided.
     *
     * @returns {@link SceneNodeId} for the marker object
     */
    addMarkerObject() {
        const object = getDefaultMarkerObject(gl);
        object.setParent(scene);
        return this.sceneNodes.add(object);
    }

    /**
     * Add reticle to display successful hit test location.
     *
     * @returns {@link SceneNodeId} for the reticle root (GLTF subtree)
     */
    addReticle() {
        return this.addModel('/media/models/reticle.gltf', vec3.fromValues(0, 0, 0), quat.fromValues(0, 0, 0, 1));
    }

    /** @param orientation - Scene orientation ({@link ReadonlyQuat}) */
    isHorizontal(orientation: ReadonlyQuat) {
        const euler = new Euler().fromQuaternion(oglQuat(orientation));
        return Math.abs(euler.x) < Number.EPSILON;
    }

    /**
     * Create object with random shape, color, size and add it to the scene at the given pose.
     *
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param orientation - Scene orientation ({@link ReadonlyQuat})
     * @returns {@link SceneNodeId} for the created primitive mesh
     */
    addRandomObject(
        position: ReadonlyVec3,
        orientation: ReadonlyQuat
    ) {
        let object_description = createRandomObjectDescription();
        return this.addObject(position, orientation, object_description);
    }

    /**
     * Create object with given properties at the given pose.
     *
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param orientation - Scene orientation ({@link ReadonlyQuat})
     * @param object_description - Primitive shape, color, scale, etc.
     * @returns {@link SceneNodeId} for the created mesh
     */
    addObject(
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        object_description: ObjectDescription
    ) {
        if (debugOgl) {
            console.log('OGL addObject: ' + object_description);
        }
        const mesh = createModel(gl, object_description.shape, object_description.color, object_description.transparent, object_description.options, object_description.scale);
        mesh.position.copy(oglVec3(position));
        mesh.quaternion.copy(oglQuat(orientation));
        scene.addChild(mesh);
        return this.sceneNodes.add(mesh);
    }

    /**
     * Add a GPU particle system.
     *
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param orientation - Scene orientation ({@link ReadonlyQuat})
     * @param particleSystem - Shape, color, point size, counts, and motion (see {@link ParticleSystem})
     * @returns {@link SceneNodeId} for the particle point mesh
     */
    addParticleSystem(position: ReadonlyVec3, orientation: ReadonlyQuat, particleSystem: ParticleSystem): SceneNodeId {
        if (debugOgl) {
            console.log('OGL addParticleSystem');
        }
        const psMesh = createParticleSystem(gl, particleSystem);
        psMesh.position.copy(oglVec3(position));
        psMesh.quaternion.copy(oglQuat(orientation));
        scene.addChild(psMesh);
        const sceneNodeId = this.sceneNodes.add(psMesh);
        registerParticleSystem(sceneNodeId, {
            mesh: psMesh,
            shape: particleSystem.shape,
            systemSize: particleSystem.systemSize,
            speed: particleSystem.speed,
        });
        return sceneNodeId;
    }

    updateParticleIntensity(sceneNodeId: SceneNodeId, calculate: (oldValue: number) => number) {
        const oldIntensity = getParticleIntensity(sceneNodeId);
        if (oldIntensity <= 0) {
            console.error('OGL Tried to modify missing particle system!');
            return -1;
        }
        const newIntensity = calculate(oldIntensity);
        setParticleIntensity(sceneNodeId, newIntensity);
        return newIntensity;
    }

    updateParticleSystem(sceneNodeId: SceneNodeId): void {
        updateParticles(sceneNodeId);
    }

    /**
     * Create a dynamic object with given properties at the given pose.
     *
     * @param object_id - User-specified unique id (also used with {@link getDynamicObjectNodeId})
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param orientation - Scene orientation ({@link ReadonlyQuat})
     * @param object_description - Primitive description, or `null` for default sphere
     * @returns {@link SceneNodeId} for the dynamic object mesh
     */
    addDynamicObject(
        object_id: string,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        object_description: ObjectDescription | null = null
    ) {
        if (debugOgl) console.log('OGL addDynamicObject: ' + object_id);
        let description = object_description || {
            version: 2,
            color: [1.0, 1.0, 1.0, 0.5],
            shape: PRIMITIVES.sphere,
            scale: [0.25, 0.25, 0.25],
            transparent: true,
            options: {},
        };
        const mesh = createModel(gl, description.shape, description.color, description.transparent, description.options, description.scale);
        mesh.position.copy(oglVec3(position));
        mesh.quaternion.copy(oglQuat(orientation));
        scene.addChild(mesh);
        dynamic_objects_descriptions[object_id] = description;
        dynamic_objects_meshes[object_id] = mesh;
        return this.sceneNodes.add(mesh);
    }

    /** @returns {@link SceneNodeId} (delegates to {@link addDynamicObject}) */
    addDynamicObjectWithRigidPose(
        object_id: string,
        pose: RigidPose,
        object_description: ObjectDescription | null = null,
    ) {
        const { position, quaternion } = oglTrsFromRigidPose(pose);
        return this.addDynamicObject(object_id, position, quaternion, object_description);
    }

    /**
     * Update a dynamic object with given properties at the given pose.
     *
     * @param object_id - User-specified unique id
     * @param position - New position ({@link ReadonlyVec3}) or `null` to keep current
     * @param orientation - New orientation ({@link ReadonlyQuat}) or `null` to keep current
     * @param object_description - New description, or `null` to keep current
     * @returns Whether the update succeeded
     */
    updateDynamicObject(
        object_id: string,
        position: ReadonlyVec3 | null = null,
        orientation: ReadonlyQuat | null = null,
        object_description: ObjectDescription | null = null
    ) {
        //console.log("OGL updateDynamicObject: " + object_id);
        if (!(object_id in dynamic_objects_descriptions)) {
            console.log('OGL WARNING: object_id ' + object_id + ' is is not in the scene, cannot update object');
            return false;
        }
        const old_position = dynamic_objects_meshes[object_id].position;
        let new_position = oglVec3(old_position);
        if (position != null) {
            new_position = oglVec3(position);
        }
        dynamic_objects_meshes[object_id].position = new_position;

        const old_orientation = dynamic_objects_meshes[object_id].quaternion;
        let new_orientation = oglQuat(old_orientation);
        if (orientation != null) {
            new_orientation = oglQuat(orientation);
        }
        dynamic_objects_meshes[object_id].quaternion = new_orientation;

        // check whether anything changed in the description
        const old_object_description = dynamic_objects_descriptions[object_id];
        if (JSON.stringify(old_object_description) === JSON.stringify(object_description)) {
            // nothing to do
            return true;
        }
        let new_object_description = object_description ? { ...object_description } : null;

        // as the Mesh properties cannot be changed, we need to delete the mesh and recreate a new one with the new description
        // if there was an event handler on the old object, we transfer that to the new object (currently only one event handler is supported)
        const eventHandler = this.getClickEvent(object_id);
        this.removeDynamicObject(object_id);
        const newObject = this.addDynamicObject(object_id, new_position, new_orientation, new_object_description);
        if (eventHandler) {
            this.addClickEvent(newObject, eventHandler);
        }
        //console.log('OGL dynamic object has changed: ' + object_id);
        return true;
    }

    /** @returns Whether the update succeeded (delegates to {@link updateDynamicObject}) */
    updateDynamicObjectWithRigidPose(
        object_id: string,
        pose: RigidPose,
        object_description: ObjectDescription | null = null,
    ) {
        const { position, quaternion } = oglTrsFromRigidPose(pose);
        return this.updateDynamicObject(object_id, position, quaternion, object_description);
    }

    /**
     * Query the description of a dynamic object
     *
     * @param object_id  string     User-specified unique ID in the scene
     * @returns {*}     Key-value pairs of object properties
     */
    getDynamicObjectDescription(object_id: string) {
        if (object_id in dynamic_objects_descriptions) {
            return dynamic_objects_descriptions[object_id];
        }
        return null;
    }

    /**
     * Query the scene node of a dynamic object.
     *
     * @param object_id - User-specified unique id
     * @returns {@link SceneNodeId} or `null` if not in the scene
     */
    getDynamicObjectNodeId(object_id: string) {
        if (object_id in dynamic_objects_meshes) {
            return this.sceneNodes.getId(dynamic_objects_meshes[object_id]);
        }
        return null;
    }

    /**
     * Updates the marker object according the provided position and orientation.
     *
     * Called when marker movement was detected, for example.
     *
     * @param object - {@link SceneNodeId} from {@link addMarkerObject}
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param orientation - Scene orientation ({@link ReadonlyQuat})
     */
    updateMarkerObjectPosition(
        objectNodeId: SceneNodeId,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
    ) {
        const native = this.sceneNodes.get(objectNodeId);
        native.position.copy(oglVec3(position));
        native.quaternion.copy(oglQuat(orientation));
    }

    /**
     * Update the position of the reticle to the provided position and orientation.
     *
     * @param reticle - {@link SceneNodeId} from {@link addReticle}
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param orientation - Scene orientation ({@link ReadonlyQuat})
     * @param scale - Optional root scale ({@link ReadonlyVec3})
     */
    updateReticlePose(
        reticle: SceneNodeId,
        position: ReadonlyVec3,
        orientation: ReadonlyQuat,
        scale: ReadonlyVec3 = [0.2, 0.2, 0.2],
    ) {
        const native = this.sceneNodes.get(reticle);
        native.position.copy(oglVec3(position));
        native.quaternion.copy(oglQuat(orientation));
        native.scale.copy(oglVec3(scale));
    }

    /**
     * Add x, y, z axes to visualize them during development.
     *
     * @returns {@link SceneNodeId} for the axes helper
     */
    addAxes() {
        const axes = getAxes(gl);
        axes.position.set(0, 0, 0);
        axes.setParent(scene);
        return this.sceneNodes.add(axes);
    }

    /**
     * Load a PLY (point cloud or indexed triangle mesh) and add it to the scene.
     *
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param quaternion - Scene orientation ({@link ReadonlyQuat})
     * @returns {@link SceneNodeId} or `null` if loading or parsing failed
     */
    async addPlyObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        plyOptions?: PlyLoadOptions,
    ): Promise<SceneNodeId | null> {
        if (debugOgl) console.log('OGL addPlyObject ' + url);
        try {
            const loaded = await MyPLYLoader.loadDisplayGeometry(gl, url, plyOptions ?? {});
            if (loaded == null) {
                console.error(`OGL: failed to load PLY from ${url} (no usable geometry)`);
                return null;
            }
            const program =
                loaded.primitive === 'triangles' ? getPlyMeshProgram(gl) : getPlyPointsProgram(gl);
            const pclMesh = new Mesh(gl, {
                mode: loaded.mode,
                geometry: loaded.geometry,
                program,
                frustumCulled: loaded.primitive === 'triangles',
            });
            pclMesh.position.copy(oglVec3(position));
            pclMesh.quaternion.copy(oglQuat(quaternion));
            pclMesh.setParent(scene); // this is very slow
            return this.sceneNodes.add(pclMesh);
        } catch (error) {
            console.error(`OGL: failed to load PLY from ${url}`, error);
            return null;
        }
    }

    /**
     * Place spatial point-cloud content. Supported formats are resolved from URL path and MIME type
     * (today: PLY via {@link addPlyObject}); unknown combinations log a warning and return `null`.
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param quaternion - Scene orientation ({@link ReadonlyQuat})
     * @returns {@link SceneNodeId} or `null` if unsupported or load failed
     */
    async addPointCloudObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        options?: PlyLoadOptions & { contentType?: string; scrContentType?: string },
    ): Promise<SceneNodeId | null> {
        const { contentType = '', scrContentType, ...plyOpts } = options ?? {};
        const fmt = pointCloudFormatFromRef(url, contentType, scrContentType);
        if (fmt === 'ply') {
            const plyOnly = Object.keys(plyOpts).length > 0 ? (plyOpts as PlyLoadOptions) : undefined;
            return this.addPlyObject(url, position, quaternion, plyOnly);
        }
        console.warn(
            `OGL addPointCloudObject: no point-cloud loader for this ref (supported: .ply path or MIME containing "ply"): ${url} (MIME: ${contentType || 'none'}, SCR type: ${scrContentType ?? 'unspecified'})`,
        );
        return null;
    }

    /**
     * Add a logo image on a billboard plane (async texture load).
     *
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param quaternion - Scene orientation ({@link ReadonlyQuat})
     */
    async addLogoObject(
        url: string,
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        width = 1.0,
        height = 1.0,
    ) {
        if(debugOgl) console.log('OGL addLogoObject ' + url);
        loadLogoTexture(gl, url).then((texture) => {
            const logoProgram = createLogoProgram(gl, texture);
            const planeGeometry = new Plane(gl, {
                width: width,
                height: height,
            }); // by default, the normal vector of the plane is axis Z
            const plane = new Mesh(gl, {
                geometry: planeGeometry,
                program: logoProgram,
                frustumCulled: false,
            });
            plane.position.copy(oglVec3(position));
            plane.quaternion.copy(oglQuat(quaternion));
            plane.setParent(scene);
            return plane;
        });
    }

    /**
     * Add 3D text at the given pose.
     *
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param quaternion - Scene orientation ({@link ReadonlyQuat})
     * @param textColor - RGB ({@link ReadonlyVec3})
     * @returns {@link SceneNodeId} for the text mesh
     */
    async addTextObject(
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        string: string,
        textColor: ReadonlyVec3 = [1.0, 1.0, 1.0],
    ) {
        if (debugOgl) console.log('OGL addTextOject: ' + string);
        const fontName = 'MgOpenModernaRegular';
        const textMesh: Mesh = await loadTextMesh(
            gl,
            fontName,
            string,
            oglVec3(textColor)
        );
        textMesh.position.copy(oglVec3(position));
        textMesh.quaternion.copy(oglQuat(quaternion));
        textMesh.setParent(scene);
        return this.sceneNodes.add(textMesh);
    }

    /**
     * @param pose - Content pose ({@link RigidPose})
     * @returns {@link SceneNodeId} for the text mesh
     */
    async addTextObjectWithRigidPose(
        pose: RigidPose,
        string: string,
        options?: { textColor?: [number, number, number]; positionOffset?: [number, number, number] },
    ) {
        const ox = options?.positionOffset?.[0] ?? 0;
        const oy = options?.positionOffset?.[1] ?? 0;
        const oz = options?.positionOffset?.[2] ?? 0;
        const position = new Vec3(pose.position.x + ox, pose.position.y + oy, pose.position.z + oz);
        const quaternion = new Quat(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w);
        const tc = options?.textColor
            ? new Vec3(options.textColor[0], options.textColor[1], options.textColor[2])
            : new Vec3(1.0, 1.0, 1.0);
        return this.addTextObject(position, quaternion, string, tc);
    }

    /**
     * Add a video billboard with click-to-toggle playback.
     *
     * @param position - Scene position ({@link ReadonlyVec3})
     * @param quaternion - Scene orientation ({@link ReadonlyQuat})
     */
    async addVideoObject(
        position: ReadonlyVec3,
        quaternion: ReadonlyQuat,
        videoUrl: string,
    ) {
        if (debugOgl) console.log('OGL addVideoObject: ' + videoUrl);
        const videoInfo = await videoHelper.loadVideo(videoUrl);
        const videoBox = videoHelper.createVideoBox(gl, scene,
            oglVec3(position),
            oglQuat(quaternion),
            videoInfo.videoId
        );
        this.addClickEvent(this.sceneNodes.add(videoBox), () => {
            videoHelper.togglePlayback(videoInfo.videoId);
        });
    }

    setVerticallyRotating(node: SceneNodeId) {
        verticallyRotatingNodes.push(this.sceneNodes.get(node));
    }

    setTowardsCameraRotating(node: SceneNodeId) {
        towardsCameraRotatingNodes.push(this.sceneNodes.get(node));
    }

    /**
     * Make the provided scene node clickable.
     *
     * @param modelId - {@link SceneNodeId} to receive taps
     * @param handler - Callback when the node is hit
     */
    addClickEvent(modelId: SceneNodeId, handler: () => void) {
        const native = this.sceneNodes.get(modelId) as Mesh;
        eventHandlers[modelId] = {
            model: native,
            handler,
        };
    }

    /**
     * Return the event handler of the model given by id
     *
     * @param modelId  string       The model id
     */
    getClickEvent(modelId: string) {
        if (eventHandlers[modelId]) {
            return eventHandlers[modelId].handler;
        }
        const nodeId = this.getDynamicObjectNodeId(modelId);
        if (nodeId && eventHandlers[nodeId]) {
            return eventHandlers[nodeId].handler;
        }
        return undefined;
    }

    /**
     * Builds {@link ExternalCameraParameters} (projection + camera pose) for iframe / external WebGL experiences.
     *
     * @param view  XRView      The current view
     * @param experienceMatrix  Column-major 4×4 of the experience root in WebXR space
     */
    getExternalCameraParameters(view: XRView, experienceMatrix: ReadonlyMat4): ExternalCameraParameters {
        return getExternalCameraParametersForExperience(view, experienceMatrix);
    }

    /**
     * Allows to set the zero point of the scene.
     *
     * Used by WebXR when the WebXR anchor the scene is added to changes.
     *
     * @returns {function}
     */
    getRootSceneUpdater() {
        const out = mat4.create();
        return (matrix: SceneRootMatrix) => {
            scene.matrix = new Mat4().fromArray(matrix);
            mat4.copy(out, scene.matrix as unknown as mat4);
            return out;
        };
    }

    /**
     * Adds a visual cue to the provided node to indicate its state (e.g. loading).
     *
     * @param modelId - {@link SceneNodeId} to animate
     */
    setWaiting(modelId: SceneNodeId) {
        const native = this.sceneNodes.get(modelId) as Mesh;
        native.program = createWaitingProgram(gl, [1, 1, 0], [0, 1, 0]);
        uniforms.time[native.id] = native;
    }

    /**
     * Registers a general tap handler. Gets called when no hits where found for a tap.
     *
     * Currently exclusively for experiments. Don't use otherwise.
     *
     * @param callback  Function        The function to call
     */
    setExperimentTapHandler(callback: (e: { x: number; y: number }) => void) {
        experimentTapHandler = callback;
    }

    /**
     * Resize the canvas to full screen.
     */
    resize() {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.perspective({ aspect: gl.canvas.width / gl.canvas.height, near: 0.01, far: 1000 });
    }

    removeDynamicObject(object_id: string) {
        if(debugOgl) console.log('OGL removeDynamicObject: ' + object_id);
        if (!(object_id in dynamic_objects_meshes)) {
            console.log('WARNING: tried to delete object ' + object_id + ' which is not in the scene');
            return;
        }
        const mesh = dynamic_objects_meshes[object_id];
        const nodeId = this.sceneNodes.getId(mesh);
        if (nodeId !== null) {
            this.sceneNodes.setNative(nodeId, mesh);
            this.remove(nodeId);
        }
        delete dynamic_objects_meshes[object_id];
        delete dynamic_objects_descriptions[object_id];
    }

    /**
     *  Removes all objects and reinits the scene.
     */
    reinitialize() {
        this.cleanup();

        this.initScene(); // but do any neccessary minimal environment setup
    }

    /**
     *  Removes everything from the scene (including the camera)
     */
    cleanup() {
        if(debugOgl) console.log('OGL cleanup');

        // remove event handlers
        updateHandlers = {};
        eventHandlers = {};
        uniforms = { time: [] };

        // dynamic objects
        for (const object_id in dynamic_objects_descriptions) {
            this.removeDynamicObject(object_id);
        }

        // cached gltf objects
        for (const object_id in gltf_objects_transforms) {
            this.removeModel(object_id);
        }

        // Note: no need to clean gltfCache

        // clean animations
        towardsCameraRotatingNodes = [];
        verticallyRotatingNodes = [];

        // normal models
        while (scene.children.length > 0) {
            let child: Transform | null = scene.children[0];
            scene.removeChild(child);
            child = null;
        }

        clearRegisteredParticleSystems();
        this.sceneNodes.clear();
    }

    /**
     * Removes the node by the given ID from the scene and clears its handlers.
     *
     * @param modelId - {@link SceneNodeId} to remove
     */
    remove(modelId: SceneNodeId) {
        if (isRegisteredParticleSystem(modelId)) {
            unregisterParticleSystem(modelId);
        }

        const native = this.sceneNodes.get(modelId);
        scene.removeChild(native);
        this.sceneNodes.delete(modelId);

        if (native instanceof Mesh) {
            delete updateHandlers[modelId];
            delete eventHandlers[modelId];
        }
    }

    /**
     * 3D engine isn't needed anymore.
     */
    stop() {
        window.removeEventListener('resize', this.resize, false);
        experimentTapHandler = null;
    }

    /**
     * This recursively updates the whole scene graph after all SCRs are placed
     */
    updateMatrixWorld() {
        scene.updateMatrixWorld(true);
    }

    /**
     * Render loop.
     *
     * @param time  Number      Provided by WebXR
     * @param view  XRView      Provided by WebXR
     */
    render(time: DOMHighResTimeStamp, view: XRView) {
        checkGLError(gl, 'OGL render() begin');

        const position = view.transform.position;
        const orientation = view.transform.orientation;

        camera.projectionMatrix.copy(new Mat4().fromArray(view.projectionMatrix));
        camera.position.set(position.x, position.y, position.z);
        camera.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);

        Object.values(updateHandlers).forEach((handler) => handler());

        const relTime = time - lastRenderTime;
        lastRenderTime = time;
        uniforms.time.forEach((model) => (model.program.uniforms.uTime.value = time * 0.001)); // Time in seconds

        // rotate all user facing labels to face the current camera position
        verticallyRotatingNodes.forEach((node) => {
            node.rotation.y += 0.01;
        });

        // rotate all text labels to face the current camera position
        towardsCameraRotatingNodes.forEach((node) => {
            const orientationMatrix = new Mat4().lookAt(camera.position, node.position, new Vec3(0, 1, 0));
            node.quaternion.fromMatrix3(new Mat3().fromMatrix4(orientationMatrix));
        });

        videoHelper.onPreRender(time);
        renderer.render({ scene, camera });

        checkGLError(gl, 'OGL render() end');
    }

    /**
     * @private
     * Event handler for interactive objects.
     *
     * Handles currently taps on 3D objects.
     * Handles temporarily also taps on floor.
     *
     * @param event  Event      Javascript event object
     */
    _handleEvent(event: { x: number; y: number }) {
        const mouse = new Vec2();
        mouse.set(2.0 * (event.x / renderer.width) - 1.0, 2.0 * (1.0 - event.y / renderer.height) - 1.0);

        const raycast = new Raycast();
        raycast.castMouse(camera, mouse);

        const eventMeshes = Object.values(eventHandlers).map((handler) => handler.model);
        const hits = raycast.intersectBounds(eventMeshes);

        // if an OGL object is hit, execute its handler
        hits.forEach((hit) => {
            eventHandlers[String(hit.id)].handler();
        });

        // if no OGL object is hit, forward the event to the base tap handler
        if (hits.length === 0 && experimentTapHandler) {
            experimentTapHandler(event);
        }
    }

    /**
     * Draws a small axis placeholder mesh with the given **world** column-major `mat4` (e.g. from `@core/worldAlignment` debug helpers).
     *
     * @returns {@link SceneNodeId} for the debug axes node
     */
    addDebugAxesAtWorldMatrix(worldMatrix: ReadonlyMat4, color: [number, number, number, number], showAxes: boolean = false): SceneNodeId {
        const node = createAxesBoxPlaceholder(gl, color, showAxes);
        scene.addChild(node);
        node.matrixAutoUpdate = false;
        for (let i = 0; i < 16; i++) {
            node.matrix[i] = worldMatrix[i]!;
        }
        node.decompose();
        node.updateMatrixWorld(true);
        return this.sceneNodes.add(node);
    }

    /**
     * This recursively updates the world matrices in the whole scene graph
     */
    updateSceneGraphTransforms() {
        scene.updateMatrixWorld(true);
    }

}
