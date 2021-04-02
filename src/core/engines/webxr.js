/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

import { initCameraCaptureScene, drawCameraCaptureScene, createImageFromTexture } from '@core/cameraCapture';


let session, gl, refSpace, glBinding;
let endedCallback, oscpFrameCallback, markerFrameCallback;

let onFrameUpdate;


export default class webxr {
    startOscpSession(canvas, callback, options) {
        oscpFrameCallback = callback;

        // TODO: Verify that session doesn't leak out
        return navigator.xr.requestSession('immersive-ar', options)
            .then((result) => {
                this._initSession(canvas, result);

                glBinding = new XRWebGLBinding(result, gl);
                initCameraCaptureScene(gl);
            })
    }

    startMarkerSession(canvas, callback, options) {
        markerFrameCallback = callback;

        return navigator.xr.requestSession('immersive-ar', options)
            .then((result) => {
                this._initSession(canvas, result);
            })
    }

    setViewportForView(view) {
        const viewport = session.renderState.baseLayer.getViewport(view);
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

        return viewport;
    }

    getCameraTexture(frame, view) {
        // NOTE: if we do not draw anything on pose update for more than 5 frames, Chrome's WebXR sends warnings
        // See OnFrameEnd() in https://chromium.googlesource.com/chromium/src/third_party/+/master/blink/renderer/modules/xr/xr_webgl_layer.cc

        // We want to capture the camera image, however, it is not directly available here,
        // but only as a GPU texture. We draw something textured with the camera image at every frame,
        // so that the texture is kept in GPU memory. We can then capture it below.
        const cameraTexture = glBinding.getCameraImage(frame, view);
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
        session = null;
        gl = null;

        if (endedCallback) {
            endedCallback();
        }
    }

    _initSession(canvas, result) {
        session = result;

        onFrameUpdate = this._onFrameUpdate;

        gl = canvas.getContext('webgl2', { xrCompatible: true });

        session.addEventListener('end', this.onSessionEnded);

        session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
        session.requestReferenceSpace('local').then((result) => {
            refSpace = result;
            session.requestAnimationFrame(this._onFrameUpdate);
        });
    }

    _onFrameUpdate(time, frame) {
        const session = frame.session;
        session.requestAnimationFrame(onFrameUpdate);

        const localPose = frame.getViewerPose(refSpace);

        if (localPose) {
            if (oscpFrameCallback) {
                oscpFrameCallback(time, frame, localPose);
            }

            if (markerFrameCallback) {
                markerFrameCallback(time, frame, localPose, /*trackedImage*/);
            }
        }
    }
}
