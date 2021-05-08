/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

import {Camera, GLTFLoader, Mat4, Raycast, Renderer, Transform, Vec2} from 'ogl';

import {getAxes, getDefaultPlaceholder, getExperiencePlaceholder} from '@core/engines/ogl/modelTemplates';
import {createWaitingProgram, getDefaultMarkerObject} from "./modelTemplates";


let scene, camera, renderer, gl;
let updateHandlers = {}, eventHandlers = {}, uniforms = { time: []};


/**
 * Implementation of the 3D features required by sparcl using ogl.
 * https://github.com/oframe/ogl
 */
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

    /**
     * Add a general placeholder to the scene.
     *
     * @param keywords  string[]        Defines the kind of placeholder to create
     * @param position  number{x, y, z}        3D position of the placeholder
     * @param orientation  number{x, y, z, w}     Orientation of the placeholder
     * @returns {Transform}
     */
    addPlaceholder(keywords, position, orientation) {
        const placeholder = getDefaultPlaceholder(gl);

        placeholder.position.set(position.x, position.y, position.z);
        placeholder.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
        placeholder.setParent(scene);

        return placeholder;
    }

    /**
     * Add 3D model of format gltf to the scene.
     *
     * @param position  number{x, y, z}        3D position of the placeholder
     * @param orientation  number{x, y, z, w}     Orientation of the placeholder
     * @param url  String       URL to load the model from
     * @returns {Transform}
     */
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

    /**
     * Add placeholder for loadable scene.
     *
     * Indicates visually that the placeholder can load a scene.
     *
     * @param position  number{x, y, z}        3D position of the placeholder
     * @param orientation  number{x, y, z, w}     Orientation of the placeholder
     * @returns {Transform}
     */
    addExperiencePlaceholder(position, orientation) {
        const placeholder = getExperiencePlaceholder(gl);

        placeholder.position.set(position.x, position.y, position.z);
        placeholder.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
        placeholder.setParent(scene);

        updateHandlers[placeholder.id] = () => placeholder.rotation.y += .01;

        return placeholder;
    }

    /**
     * Add object to be placed on top of marker image.
     *
     * Used for some experiments before, not currently used.
     * How to properly handle markers is undecided.
     *
     * @returns {Transform}
     */
    addMarkerObject() {
        const object = getDefaultMarkerObject(gl);
        object.setParent(scene);

        return object;
    }

    /**
     * Add reticle to display successful hit test location.
     *
     * @returns {Transform}
     */
    addReticle() {
        return this.addModel({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 0, w: 1}, '/media/models/reticle.gltf');
    }

    /**
     * Updates the marker object according the provided position and orientation.
     *
     * Called when marker movement was detected, for example.
     *
     * @param object  Mesh      The marker object
     * @param position  number{x, y, z}        3D position of the placeholder
     * @param orientation  number{x, y, z, w}     Orientation of the placeholder
     */
    updateMarkerObjectPosition(object, position, orientation) {
        object.position.set(position.x, position.y, position.z);
        object.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
    }

    /**
     * Update the position of the reticle to the provided position and orientation.
     *
     * @param reticle  Transform        The reticle to display
     * @param position  Ved3       The position to move the reticle to
     * @param orientation  Quaternion       The rotation to apply to the reticle
     */
    updateReticlePosition(reticle, position, orientation) {
        reticle.position.set(position.x, position.y, position.z);
        reticle.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
    }

    /**
     * Add x, y, z axes to visualize them during development.
     */
    addAxes() {
        const axes = getAxes(gl);
        axes.position.set(0, 0, 0);
        axes.setParent(scene);
    }

    /**
     * Make the provided model clickable.
     *
     * @param model  Mesh       The model to make interactive
     * @param handler  function     The function to execute after interaction
     */
    addClickEvent(model, handler) {
        eventHandlers[model.id] = {
            model, handler
        };
    }

    /**
     * Calculates the camera pose to send to scenes loaded into the iframe.
     *
     * @param view  XRView      The current view
     * @param experienceMatrix  Mat4        The matrix of the experience in WebR space
     * @returns {{camerapose: Mat4, projection: Mat4}}
     */
    getExternalCameraPose(view, experienceMatrix) {
        const cameraMatrix = new Mat4();
        cameraMatrix.copy(experienceMatrix).inverse().multiply(view.transform.matrix);

        return {
            projection: view.projectionMatrix,
            camerapose: cameraMatrix
        }
    }

    /**
     * Allows to set the zero point of the scene.
     *
     * Used by WebXR when the WebXR anchor the scene is added to changes.
     *
     * @returns {function}
     */
    getRootSceneUpdater() {
        return (matrix) => scene.matrix = new Mat4().fromArray(matrix);
    }

    /**
     * Adds a visual queue to the provided model to indicate its state.
     *
     * For example to indicate it is interactive.
     *
     * @param model     The model to change
     */
    setWaiting(model) {
        model.program = createWaitingProgram(gl, [1, 1, 0], [0, 1, 0]);
        uniforms.time[model.id] = model;
    }

    /**
     * Resize the canvas to full screen.
     */
    resize() {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.perspective({aspect: gl.canvas.width / gl.canvas.height});
    }

    /**
     * Removes the provided model from the scene and all the handlers it mit be registered with.
     *
     * @param model     The model to remove
     */
    remove(model) {
        scene.removeChild(model);

        delete updateHandlers[model.id];
        delete eventHandlers[model.id];
    }

    /**
     * 3D engine isn't needed anymore.
     */
    stop() {
        window.removeEventListener('resize', this.resize, false);
    }

    /**
     * Render loop.
     *
     * @param time  Number      Provided by WebXR
     * @param pose  XRPose      Provided by WebXR
     * @param view  XRView      Provided by WebXR
     */
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

    /**
     * @private
     * Event handler for interactive objects.
     *
     * Handles currently mouse clicks / taps.
     *
     * @param event  Event      Javascript event object
     */
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
