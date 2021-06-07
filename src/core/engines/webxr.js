/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

import { initCameraCaptureScene, drawCameraCaptureScene, createImageFromTexture } from '@core/cameraCapture';


let endedCallback, devFrameCallback, creativeFrameCallback, oscpFrameCallback, markerFrameCallback,
    experimentFrameCallback, noExperimentResultCallback, onFrameUpdate;
let floorSpaceReference, localSpaceReference, hitTestSource, gl;

let previousTime = performance.now();
let slowCount = 0;
let maxSlow = 10;
let maximumFrameTime = 1000/30; // 30 FPS


/**
 * WebXR implementation of the AR engine.
 */
export default class webxr {
    /**
     * Start specific session for experiment mode.
     *
     * @param canvas  Canvas        The element to use
     * @param callback  function        Callback to call for every frame
     * @param options  {}       Settings to use to setup the AR session
     * @returns {Promise}
     */
    startExperimentSession(canvas, callback, options) {
        experimentFrameCallback = callback;

        return navigator.xr.requestSession('immersive-ar', options)
            .then((result) => {
                this._initSession(canvas, result);

                result.requestReferenceSpace('viewer')
                    .then(refSpace => result.requestHitTestSource({ space: refSpace }))
                    .then(source => hitTestSource = source);

                this.glBinding = new XRWebGLBinding(result, gl);
                initCameraCaptureScene(gl);
            })
    }

    /**
     * Start specific session for development mode.
     *
     * @param canvas  Canvas        The element to use
     * @param callback  function        Callback to call for every frame
     * @param options  {}       Settings to use to setup the AR session
     * @returns {Promise}
     */
    startDevSession(canvas, callback, options) {
        devFrameCallback = callback;

        return navigator.xr.requestSession('immersive-ar', options)
            .then((result) => {
                this._initSession(canvas, result);
            })
    }

    /**
     * Setup regular use session.
     *
     * @param canvas  Canvas        The element to use
     * @param callback  function        Callback to call for every frame
     * @param options  {}       Settings to use to setup the AR session
     * @param setup  function       Allows to execute setup functions for session
     * @returns {Promise}
     */
    startSession(canvas, callback, options, setup = () => {}) {
        oscpFrameCallback = callback;

        return navigator.xr.requestSession('immersive-ar', options)
            .then((result) => {
                this._initSession(canvas, result);

                if (setup) {
                    setup(this, result, gl);
                }
            })
    }

    /**
     * Setup specific session for marker handling.
     *
     * @param canvas  Canvas        The element to use
     * @param callback  function        Callback to call for every frame
     * @param options  {}       Settings to use to setup the AR session
     * @returns {Promise}
     */
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

    /**
     * Set the default viewport of the WebGL context.
     */
    setViewPort() {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }

    /**
     * Set the viewport according to provided view.
     *
     * @param view  XRView      The view to make the settings for
     * @returns {XRViewport}
     */
    setViewportForView(view) {
        const viewport = this.session.renderState.baseLayer.getViewport(view);

        if (viewport) {
            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        } else {
            this.setViewPort()
        }
        return viewport;
    }

    initCameraCapture(gl) {
        initCameraCaptureScene(gl);
    }

    /**
     * Current best effort to get the camera image from the WebXR session.
     *
     * The implementation has recently changed in Chromium. Will adapt when available for Chrome (beta).
     *
     * @param frame  XRFrame        The current frame to get the image for
     * @param view  XRView      The view to use
     * @returns {WebGLTexture}
     */
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

    /**
     * Convert WebGL texture to actual image to use for localisation.
     *
     * The implementation for camera access has recently changed in Chromium. Will adapt when available for Chrome (beta).
     *
     * @param texture  WebGLTexture     The texture to convert
     * @param width  Number     Width of the texture
     * @param height  Number        Height of the texture
     * @returns {string}        base64 encoded image
     */
    getCameraImageFromTexture(texture, width, height) {
        return createImageFromTexture(gl, texture, width, height);
    }

    /**
     * End provided session.
     *
     * @param session  XRSession        The session to end
     */
    onEndSession(session) {
        if (hitTestSource) {
            hitTestSource.cancel();
            hitTestSource = null;
        }

        session.end();
    }

    /**
     * Set callbacks that should be called for certain situations.
     *
     * @param ended  function       The function to call when session ends
     * @param noPose  function      The function to call when no pose was reported for experiment mode
     */
    setCallbacks(ended, noPose) {
        endedCallback = ended;
        noExperimentResultCallback = noPose;
    }

    /**
     * Handler for session ended event. Used to clean up allocated memory and handler.
     */
    onSessionEnded() {
        this.session = null;
        gl = null;

        if (endedCallback) {
            endedCallback();
        }
    }

    /**
     * Create anchor for origin point of WebXR coordinate system to fix the 3D engine to it.
     *
     * @param frame  XRFrame        The current frame to base the anchor on
     * @param rootUpdater  function     Callback into the 3D engine to adopt changes when anchor is moved
     */
    createRootAnchor(frame, rootUpdater) {
        frame.createAnchor(new XRRigidTransform(), floorSpaceReference)
            .then((anchor) => {
                anchor.context = {rootUpdater: rootUpdater};
                return anchor;
            })
            .catch((error) => {
                console.error("Anchor failed to create: ", error);
            });
    }

    /**
     * Check if anchor has moved and trigger 3D engine to adapt to this change.
     *
     * Handles a single anchor right now. Needs to be extended when more anchors are used.
     *
     * @param frame  XRFrame        The current frame to get the image for
     */
    handleAnchors(frame) {
        frame.trackedAnchors.forEach(anchor => {
            const anchorPose = frame.getPose(anchor.anchorSpace, floorSpaceReference);
            if (anchorPose) {
                anchor.context.rootUpdater(anchorPose.transform.matrix);
            }
        });
    }

    /**
     * @private
     * Initializes a new session.
     *
     * @param canvas  Canvas        The canvas element to use
     * @param result  XRSession     The session created by caller
     */
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

    /**
     * @private
     * Animation loop for WebXR.
     *
     * @param time  DOMHighResTimeStamp      indicates the time at which the frame was scheduled for rendering
     * @param frame  XRFrame        The frame to handle
     */
    _onFrameUpdate(time, frame) {
        const session = frame.session;
        session.requestAnimationFrame(onFrameUpdate);

        gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

        const floorPose = frame.getViewerPose(floorSpaceReference);

        if (floorPose) {
            if (experimentFrameCallback && hitTestSource) {
                const t = performance.now();
                const elapsed = t - previousTime;
                previousTime = t;

                if (elapsed > maximumFrameTime) {
                    slowCount = Math.max(slowCount++, maxSlow);
                }

                const roundedElapsed = Math.ceil(elapsed);
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length > 0) {
                    const reticlePose = hitTestResults[0].getPose(floorSpaceReference);
                    experimentFrameCallback(time, frame, floorPose, reticlePose, roundedElapsed, slowCount >= maxSlow);
                } else {
                    noExperimentResultCallback(time, frame, floorPose, roundedElapsed, slowCount >= maxSlow)
                }
            }

            if (devFrameCallback) {
                devFrameCallback(time, frame, floorPose);
            }

            if (creativeFrameCallback) {
                creativeFrameCallback(time, frame, floorPose);
            }

            if (oscpFrameCallback) {
                oscpFrameCallback(time, frame, floorPose);
            }

            if (markerFrameCallback) {
                const results = frame.getImageTrackingResults();
                if (results.length > 0) {
                    const localPose = frame.getPose(results[0].imageSpace, floorSpaceReference);
                    markerFrameCallback(time, frame, floorPose, localPose, results[0]);
                }
            }
        }
    }
}
