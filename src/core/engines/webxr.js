/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

import { initCameraCaptureScene, drawCameraCaptureScene, createImageFromTexture } from '@core/cameraCapture';


let endedCallback, oscpFrameCallback, markerFrameCallback, onFrameUpdate;

let refSpace, gl;


export default class webxr {
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
                if (scores.length !== 0 && scores[0] === 'untrackable') {
                    // When marker image provided by user or server, inform user that marker can't be tracked
                    console.log('Marker untrackable');
                }
            });
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
        this.session.requestReferenceSpace('local-floor').then((result) => {
            refSpace = result;
            this.session.requestAnimationFrame(this._onFrameUpdate);
        });
    }

    _onFrameUpdate(time, frame) {
        const session = frame.session;
        session.requestAnimationFrame(onFrameUpdate);

        gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

        const localPose = frame.getViewerPose(refSpace);

        if (localPose) {
            if (oscpFrameCallback) {
                oscpFrameCallback(time, frame, localPose);
            }

            if (markerFrameCallback) {
                const results = frame.getImageTrackingResults();
                for (const result of results) {
                    // The result's index is the image's position in the trackedImages array specified at session creation
                    const imageIndex = result.index;

                    // Get the pose of the image relative to a reference space.
                    const pose = frame.getPose(result.imageSpace, referenceSpace);

                    const state = result.trackingState;

                    if (state === "tracked") {
                        HighlightImage(imageIndex, pose);
                    } else if (state === "emulated") {
                        FadeImage(imageIndex, pose);
                    }
                }
                markerFrameCallback(time, frame, localPose, /*trackedImage*/);
            }
        }
    }
}
