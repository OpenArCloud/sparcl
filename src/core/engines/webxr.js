/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

import { initCameraCaptureScene, drawCameraCaptureScene, createImageFromTexture } from '@core/cameraCapture';


let endedCallback, creativeFrameCallback, oscpFrameCallback, markerFrameCallback, onFrameUpdate;

let floorSpaceReference, localSpaceReference, gl;


export default class webxr {
    startCreativeSession(canvas, callback, options) {
        creativeFrameCallback = callback;

        return navigator.xr.requestSession('immersive-ar', options)
            .then((result) => {
                this._initSession(canvas, result);
            })
    }

    startOscpSession(canvas, callback, options) {
        oscpFrameCallback = callback;

        return navigator.xr.requestSession('immersive-ar', options)
            .then((result) => {
                this._initSession(canvas, result);

                this.glBinding = new XRWebGLBinding(result, gl);
                initCameraCaptureScene(gl);
            })
    }

    startMarkerSession(canvas, callback, options) {
        markerFrameCallback = callback;

        return navigator.xr.requestSession('immersive-ar', options)
            .then((result) => {
                this._initSession(canvas, result);

                return this.session.getTrackedImageScores();
            })
            .then(scores => {
                // Simplified handling for a single marker image
                if (scores.length > 0) {
                    // When marker image provided by user or server, inform user that marker can't be tracked
                    console.log('Marker score: ', scores[0]);
                }
            });
    }

    setViewPort() {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }

    setViewportForView(view) {
        const viewport = this.session.renderState.baseLayer.getViewport(view);
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

        return viewport;
    }

    getCameraTexture(frame, view) {
        // NOTE: if we do not draw anything on pose update for more than 5 frames, Chrome's WebXR sends warnings
        // See OnFrameEnd() in https://chromium.googlesource.com/chromium/src/third_party/+/master/blink/renderer/modules/xr/xr_webgl_layer.cc

        // We want to capture the camera image, however, it is not directly available here,
        // but only as a GPU texture. We draw something textured with the camera image at every frame,
        // so that the texture is kept in GPU memory. We can then capture it below.
        const cameraTexture = this.glBinding.getCameraImage(frame, view);
        drawCameraCaptureScene(gl, cameraTexture);

        return cameraTexture;
    }

    getCameraImageFromTexture(texture, width, height) {
        return createImageFromTexture(gl, texture, width, height);
    }

    onEndSession(session) {
        session.end();
    }

    setSessionEndedCallback(callback) {
        endedCallback = callback;
    }

    onSessionEnded() {
        this.session = null;
        gl = null;

        if (endedCallback) {
            endedCallback();
        }
    }

    _initSession(canvas, result) {
        this.session = result;

        onFrameUpdate = this._onFrameUpdate;

        gl = canvas.getContext('webgl2', { xrCompatible: true });

        this.session.addEventListener('end', this.onSessionEnded);
        this.session.updateRenderState({ baseLayer: new XRWebGLLayer(this.session, gl) });

        Promise.all(
            [this.session.requestReferenceSpace('local-floor'), this.session.requestReferenceSpace('local')])
            .then((values => {
                floorSpaceReference = values[0];
                localSpaceReference = values[1];
                this.session.requestAnimationFrame(this._onFrameUpdate);
            }));
    }

    _onFrameUpdate(time, frame) {
        const session = frame.session;
        session.requestAnimationFrame(onFrameUpdate);

        gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

        const floorPose = frame.getViewerPose(floorSpaceReference);

        if (floorPose) {
            if (creativeFrameCallback) {
                creativeFrameCallback(time, frame, floorPose);
            }

            if (oscpFrameCallback) {
                oscpFrameCallback(time, frame, floorPose);
            }

            if (markerFrameCallback) {
                const results = frame.getImageTrackingResults();
                if (results.length > 0) {
                    const localPose = frame.getPose(results[0].imageSpace, localSpaceReference);
                    markerFrameCallback(time, frame, localPose, results[0]);
                }
            }
        }
    }
}
