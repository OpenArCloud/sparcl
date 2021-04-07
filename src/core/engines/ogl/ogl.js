/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

import { Renderer, Camera, Transform } from 'ogl';

import { getDefaultPlaceholder,  getAxes } from '@core/engines/ogl/modelTemplates';
import {getDefaultMarkerObject} from "./modelTemplates";


let scene, camera, renderer, gl;


export default class ogl {
    init() {
        renderer = new Renderer({
            alpha: true,
            webgl: 2,
            canvas: document.querySelector('#application')
        });

        gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);

        scene = new Transform();

        this.setupEnvironment(gl);

        window.addEventListener('resize', () => this.resize(gl), false);
        this.resize();
    }

    /**
     * Set up the 3D environment as required according to the current real environment.*
     */
    setupEnvironment(gl) {
        camera = new Camera(gl, {fov: 35});
        camera.position.set(0, 1, 7);
        camera.lookAt([0, 0, 0]);

        // TODO: Add light
        // TODO: Use environmental lighting?!
    }

    addPlaceholder(keywords, position, orientation) {
        const placeholder = getDefaultPlaceholder(gl);

        placeholder.position.set(position.x, position.y, position.z);
        placeholder.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
        placeholder.setParent(scene);
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

    resize() {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.perspective({aspect: gl.canvas.width / gl.canvas.height});
    }

    stop() {
        window.removeEventListener('resize', this.resize, false);
    }

    render(pose) {
        const position = pose.transform.position;
        const orientation = pose.transform.orientation;

        camera.position.set(position.x, position.y -.1, position.z);
        camera.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);

        renderer.render({scene, camera});
    }
}
