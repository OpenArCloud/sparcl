/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

import { Renderer, Camera, Transform, Program, Mesh, Plane, Sphere, Box, Cylinder, Orbit } from 'ogl';

import { createModel, createDefaultPlaceholder, createAxes } from '@core/modelTemplates';


let scene, camera, renderer;


export default class ogl {
    init() {
        renderer = new Renderer({
            alpha: true,
            webgl: 2,
            canvas: document.querySelector('#application')
        });

        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);

        scene = new Transform();

        function resize() {
            renderer.setSize(window.innerWidth, window.innerHeight);
            camera.perspective({aspect: gl.canvas.width / gl.canvas.height});
        }

        window.addEventListener('resize', resize, false);
        resize();
    }

    /**
     * Set up the 3D environment as required according to the current real environment.*
     */
    setupEnvironment() {
        camera = new Camera(gl, {fov: 35});
        camera.position.set(0, 1, 7);
        camera.lookAt([0, 0, 0]);

        // TODO: Add light
        // TODO: Use environmental lighting?!
    }

    createPlaceholder(keywords, position, orienttion) {
        const placeholder = createDefaultPlaceholder();

        // TODO: Add placeholder to scene at provided position / orientation
    }

    render(pose) {
        // TODO: Move the camera to pose

        renderer.render({scene, camera});
    }
}
