/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

import {Camera, GLTFLoader, Mat4, Raycast, Renderer, Transform, Vec2} from 'ogl';

import {getAxes, getDefaultPlaceholder, getExperiencePlaceholder} from '@core/engines/ogl/modelTemplates';
import {createWaitingProgram, getDefaultMarkerObject} from "./modelTemplates";


let scene, camera, renderer, gl;
let updateHandlers = {}, eventHandlers = {}, uniforms = { time: []};


export default class ogl {
    /**
     * Initialize ogl for use with WebXR.
     */
    init() {
        renderer = new Renderer({
            alpha: true,
            canvas: document.querySelector('#application'),
            dpr: window.devicePixelRatio,
            webgl: 2
        });

        gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);

        scene = new Transform();

        this.setupEnvironment(gl);

        window.addEventListener('resize', () => this.resize(gl), false);
        this.resize();

        document.addEventListener('click', this._handleEvent);
    }

    /**
     * Set up the 3D environment as required according to the current real environment.*
     */
    setupEnvironment(gl) {
        camera = new Camera(gl);
        camera.position.set(0, 0, 0);

        // TODO: Add light
        // TODO: Use environmental lighting?!
    }

    addPlaceholder(keywords, position, orientation) {
        const placeholder = getDefaultPlaceholder(gl);

        placeholder.position.set(position.x, position.y, position.z);
        placeholder.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
        placeholder.setParent(scene);
    }

    addModel(position, orientation, url) {
        const gltfScene = new Transform();
        gltfScene.position.set(position.x, position.y, position.z);
        gltfScene.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
        gltfScene.setParent(scene);

        GLTFLoader.load(gl, url)
            .then(gltf => {
                const s = gltf.scene || gltf.scenes[0];
                s.forEach(root => {
                    root.setParent(gltfScene);
                });
            });

        scene.updateMatrixWorld();
        return gltfScene;
    }

    addExperiencePlaceholder(position, orientation) {
        const placeholder = getExperiencePlaceholder(gl);

        placeholder.position.set(position.x, position.y, position.z);
        placeholder.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
        placeholder.setParent(scene);

        updateHandlers[placeholder.id] = () => placeholder.rotation.y += .01;

        return placeholder;
    }

    addMarkerObject() {
        const object = getDefaultMarkerObject(gl);
        object.setParent(scene);

        return object;
    }

    updateMarkerObjectPosition(object, position, orientation) {
        object.position.set(position.x, position.y, position.z);
        object.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
    }

    addAxes() {
        const axes = getAxes(gl);
        axes.position.set(0, 0, 0);
        axes.setParent(scene);
    }

    addClickEvent(model, handler) {
        eventHandlers[model.id] = {
            model, handler
        };
    }

    getExternalCameraPose(view, experienceMatrix) {
        const cameraMatrix = new Mat4();
        cameraMatrix.copy(experienceMatrix).inverse().multiply(view.transform.matrix);

        return {
            projection: view.projectionMatrix,
            camerapose: cameraMatrix
        }
    }

    getRootSceneUpdater() {
        return (matrix) => scene.matrix = new Mat4().fromArray(matrix);
    }

    setWaiting(model) {
        model.program = createWaitingProgram(gl, [1, 1, 0], [0, 1, 0]);
        uniforms.time[model.id] = model;
    }

    resize() {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.perspective({aspect: gl.canvas.width / gl.canvas.height});
    }

    remove(model) {
        scene.removeChild(model);

        delete updateHandlers[model.id];
        delete eventHandlers[model.id];
    }

    stop() {
        window.removeEventListener('resize', this.resize, false);
    }

    render(time, pose, view) {
        const position = view.transform.position;
        const orientation = view.transform.orientation;

        camera.projectionMatrix.copy(view.projectionMatrix);
        camera.position.set(position.x, position.y, position.z);
        camera.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);

        Object.values(updateHandlers).forEach(handler => handler());
        uniforms.time.forEach(model => model.program.uniforms.uTime.value = time * 0.001);  // Time in seconds

        renderer.render({scene, camera});
    }

    _handleEvent(event) {
        const mouse = new Vec2();
        mouse.set(2.0 * (event.x / renderer.width) - 1.0, 2.0 * (1.0 - event.y / renderer.height) - 1.0)

        const raycast = new Raycast(gl);
        raycast.castMouse(camera, mouse);

        const eventMeshes = Object.values(eventHandlers).map(handler => handler.model);
        const hits = raycast.intersectBounds(eventMeshes);

        hits.forEach((hit) => {
            eventHandlers[hit.id].handler();
        })
    }
}
