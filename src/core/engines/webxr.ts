/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import { initCameraCaptureScene, drawCameraCaptureScene, createImageFromTexture, getCameraIntrinsics } from '@core/cameraCapture';
import { checkGLError } from '@core/devTools';
import type { SetupFunction, XrFrameUpdateCallbackType, XrMarkerFrameUpdateCallbackType, XrNoPoseCallbackType } from '../../types/xr';
import type { AttributeData, Mat4, OGLRenderingContext } from 'ogl';

// TODO(soeroesg): xrNoPoseCallback does not seem to be triggered ever

// TODO(soeroesg): coordinate system reset must be handled https://immersive-web.github.io/webxr/spatial-tracking-explainer.html#reference-space-reset-event

let xrSessionEndedCallback: (() => void) | null = null;
let xrFrameUpdateCallback: XrFrameUpdateCallbackType | null = null;
let xrMarkerFrameUpdateCallback: XrMarkerFrameUpdateCallbackType;
let xrReferenceSpaceResetCallback: (transform: XRRigidTransform) => void;
let xrNoPoseCallback: XrNoPoseCallbackType | null;
let animationFrameCallback: (time: DOMHighResTimeStamp, xrFrame: XRFrame) => void;
let floorSpaceReference: XRReferenceSpace | XRBoundedReferenceSpace;
let localSpaceReference: XRReferenceSpace | XRBoundedReferenceSpace;
let gl: OGLRenderingContext | null;

/**
 * WebXR implementation of the AR engine.
 */
export default class webxr {
    private session: XRSession | null = null;
    public glBinding: XRWebGLBinding | undefined;
    /**
     * Setup regular use session.
     *
     * @param canvas  Canvas        The element to use
     * @param onXrFrameUpdateCallback  function        Callback to call for every frame
     * @param options  {}       Settings to use to setup the AR session
     * @param setup  function       Allows to execute setup functions for session
     * @returns {Promise}
     */
    startSession(canvas: HTMLCanvasElement, onXrFrameUpdateCallback: XrFrameUpdateCallbackType, options: XRSessionInit, setup: SetupFunction = () => {}) {
        xrFrameUpdateCallback = onXrFrameUpdateCallback;

        return navigator.xr?.requestSession('immersive-ar', options).then((result) => {
            this._initSession(canvas, result);

            setup(this, result, gl);
        });
    }

    /**
     * Setup specific session for marker handling.
     *
     * @param canvas  Canvas        The element to use
     * @param callback  function        Callback to call for every frame
     * @param options  {}       Settings to use to setup the AR session
     * @returns {Promise}
     */
    startMarkerSession(canvas: HTMLCanvasElement, onXrMarkerFrameUpdateCallback: XrMarkerFrameUpdateCallbackType, options: XRSessionInit) {
        xrMarkerFrameUpdateCallback = onXrMarkerFrameUpdateCallback;

        return navigator.xr
            ?.requestSession('immersive-ar', options)
            .then((result) => {
                this._initSession(canvas, result);

                return this.session?.getTrackedImageScores();
            })
            .then((scores) => {
                // Simplified handling for a single marker image
                if (scores && scores.length > 0) {
                    // When marker image provided by user or server, inform user that marker can't be tracked
                    console.log('Marker score: ', scores[0]);
                }
            });
    }

    /**
     * Set the default viewport of the WebGL context.
     */
    setViewPort() {
        gl?.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }

    /**
     * Set the viewport according to provided view.
     *
     * @param view  XRView      The view to make the settings for
     * @returns {XRViewport}
     */
    setViewportForView(view: XRView) {
        const viewport = this.session?.renderState?.baseLayer?.getViewport(view);
        if (viewport) {
            gl?.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

            // For an application working in viewport space, get the camera intrinsics
            // based on the viewport dimensions:
            getCameraIntrinsics(view.projectionMatrix, viewport);
        } else {
            this.setViewPort();
        }
        return viewport;
    }

    initCameraCapture(gl: OGLRenderingContext) {
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
    getCameraTexture(frame: XRFrame, view: XRView) {
        // NOTE: if we do not draw anything on pose update for more than 5 frames, Chrome's WebXR sends warnings
        // See OnFrameEnd() in https://chromium.googlesource.com/chromium/src/third_party/+/master/blink/renderer/modules/xr/xr_webgl_layer.cc

        // We want to capture the camera image, however, it is not directly available here,
        // but only as a GPU texture. We draw something textured with the camera image at every frame,
        // so that the texture is kept in GPU memory. We can then capture it below.
        if (!gl || !view.camera) {
            return;
        }
        const cameraTexture = this.glBinding?.getCameraImage(view.camera); // note: this returns a WebGlTexture
        if (!cameraTexture) {
            return;
        }
        drawCameraCaptureScene(gl, cameraTexture);
        checkGLError(gl, 'getCameraTexture() end');
        return cameraTexture;
    }
    // NOTE: since Chrome update in June 2021, the getCameraImage(frame, view) method is not available anymore
    // Instead we can call getCameraImage(XRCamera)
    // See https://source.chromium.org/chromium/chromium/src/+/master:third_party/webxr_test_pages/webxr-samples/proposals/camera-access-barebones.html;bpv=0

    /**
     * Get camera image as a texture from the WebXR session.
     * We want to capture the camera image, however, it is not directly available here,
     * but only as a GPU texture. We draw something textured with the camera image at every frame,
     * so that the texture is kept in GPU memory. We can then capture it below.
     */
    getCameraTexture2(view: XRView) {
        // For an application working in camera texture space, get the camera
        // intrinsics based on the camera texture width/height which may be
        // different from the XR framebuffer width/height.
        //
        // Note that the camera texture has origin at bottom left, and the
        // returned intrinsics are based on that convention. If a library
        // has a different coordinate convention, the coordinates would
        // need to be adjusted, for example mirroring the Y coordinate if
        // the origin needs to be at the top left.
        if (view.camera) {
            const cameraViewport = {
                width: view.camera.width,
                height: view.camera.height,
                x: 0,
                y: 0,
            };
            const cameraIntrinsics = getCameraIntrinsics(view.projectionMatrix, cameraViewport);
            const cameraTexture = this.glBinding?.getCameraImage(view.camera); // note: this returns a WebGlTexture

            // NOTE: if we do not draw anything on pose update for more than 5 frames, Chrome's WebXR sends warnings
            // See OnFrameEnd() in https://chromium.googlesource.com/chromium/src/third_party/+/master/blink/renderer/modules/xr/xr_webgl_layer.cc
            if (!gl || !cameraTexture) {
                throw new Error('gl or cameraTexture is null!');
            }
            drawCameraCaptureScene(gl, cameraTexture);

            checkGLError(gl, 'getCameraTexture2() end');

            return {
                cameraTexture: cameraTexture,
                cameraIntrinsics: cameraIntrinsics,
                cameraViewport: cameraViewport,
            };
        }
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
    getCameraImageFromTexture(texture: WebGLTexture, width: number, height: number) {
        if (!gl) {
            throw new Error('gl is undefined!');
        }
        return createImageFromTexture(gl, texture, width, height);
    }

    /**
     * End provided session.
     *
     * @param session  XRSession        The session to end
     */
    endSession(session: XRSession) {
        session.end();
    }

    /**
     * Set callbacks that should be called for certain situations.
     *
     * @param onXrSessionEndedCallback  function       The function to call when session ends
     * @param onXrNoPoseCallback  function      The function to call when no pose was reported for experiment mode
     */
    setCallbacks(onXrSessionEndedCallback: () => void, onXrNoPoseCallback: XrNoPoseCallbackType) {
        xrSessionEndedCallback = onXrSessionEndedCallback;
        xrNoPoseCallback = onXrNoPoseCallback;
    }

    /**
     * Create anchor for origin point of WebXR coordinate system to fix the 3D engine to it.
     *
     * @param frame  XRFrame        The current frame to base the anchor on
     * @param rootUpdater  function     Callback into the 3D engine to adopt changes when anchor is moved
     */
    createRootAnchor(frame: XRFrame, rootUpdater: (matrix: number[] | AttributeData) => Mat4) {
        if (frame.createAnchor) {
            const anchorPromise = frame.createAnchor(new XRRigidTransform(), floorSpaceReference);
            if (anchorPromise) {
                anchorPromise
                    .then((anchor) => {
                        anchor.context = { rootUpdater };
                        return anchor;
                    })
                    .catch((error) => {
                        console.error('Anchor failed to create: ', error);
                    });
            }
        }
    }

    /**
     * Check if anchor has moved and trigger 3D engine to adapt to this change.
     *
     * Handles a single anchor right now. Needs to be extended when more anchors are used.
     *
     * @param frame  XRFrame        The current frame to get the image for
     */
    handleAnchors(frame: XRFrame) {
        frame.trackedAnchors?.forEach((anchor) => {
            const anchorPose = frame.getPose(anchor.anchorSpace, floorSpaceReference);
            if (anchorPose) {
                anchor.context?.rootUpdater(anchorPose.transform.matrix);
            }
        });
    }

    /**
     * @private
     * Initializes a new session.
     *
     * @param canvas  Canvas        The canvas element to use
     * @param xrSession  XRSession     The session created by caller
     */
    _initSession(canvas: HTMLCanvasElement, xrSession: XRSession) {
        this.session = xrSession;
        animationFrameCallback = this._onXrFrameUpdate; // NOTE: recursion of _onXrFrameUpdate alone seems invalid, so we store a reference to it

        gl = canvas.getContext('webgl2', { xrCompatible: true }) as OGLRenderingContext;
        if (!gl) {
            throw new Error('gl is undefined!');
        }

        this.session.addEventListener('end', this._onXrSessionEnded);
        this.session.updateRenderState({ baseLayer: new XRWebGLLayer(this.session, gl) });

        // See https://immersive-web.github.io/webxr/spatial-tracking-explainer.html#reference-spaces
        // Note: reference spaces viewer, local, and local-floor are always available, but others may not
        // See https://immersive-web.github.io/webxr/spatial-tracking-explainer.html#ensuring-hardware-compatibility
        Promise.all([this.session.requestReferenceSpace('local-floor'), this.session.requestReferenceSpace('local')]).then((values) => {
            floorSpaceReference = values[0];
            localSpaceReference = values[1];
            // TODO: use unbounded space, if available
            floorSpaceReference.addEventListener('reset', this._onXrReferenceSpaceReset); // TODO: handle properly
            localSpaceReference.addEventListener('reset', this._onXrReferenceSpaceReset); // TODO: handle properly
            this.session?.requestAnimationFrame(animationFrameCallback);
        });
    }

    /**
     * @private
     * Animation loop for WebXR.
     *
     * @param time  DOMHighResTimeStamp      indicates the time at which the frame was scheduled for rendering
     * @param xrFrame  XRFrame        The frame to handle
     */
    _onXrFrameUpdate(time: DOMHighResTimeStamp, xrFrame: XRFrame) {
        const session = xrFrame.session; // NOTE: session of the frame (should be the same as this.session)

        session.requestAnimationFrame(animationFrameCallback);

        gl?.bindFramebuffer(gl.FRAMEBUFFER, session?.renderState?.baseLayer?.framebuffer || null);

        // TODO(soeroesg): we could query the pose in multiple reference frames and trigger respective callbacks
        const floorPose = xrFrame.getViewerPose(floorSpaceReference);
        if (floorPose) {
            if (xrFrameUpdateCallback) {
                xrFrameUpdateCallback(time, xrFrame, floorPose, floorSpaceReference);
            }

            if (xrMarkerFrameUpdateCallback) {
                const results = xrFrame.getImageTrackingResults();
                if (results.length > 0) {
                    const localPose = xrFrame.getPose(results[0].imageSpace, floorSpaceReference);
                    if (localPose) {
                        xrMarkerFrameUpdateCallback(time, xrFrame, floorPose, localPose, results[0]);
                    }
                }
            }
        }
    }

    /**
     * Handler for session ended event. Used to clean up allocated memory and handler.
     */
    _onXrSessionEnded() {
        this.session = null;
        gl = null;

        if (xrSessionEndedCallback) {
            xrSessionEndedCallback();
        }
    }

    _onXrReferenceSpaceReset(xrReferenceSpaceEvent: XRReferenceSpaceEvent) {
        // See https://immersive-web.github.io/webxr/spatial-tracking-explainer.html#reference-space-reset-event
        console.log('Reference space reset happened!');
        // Check for the transformation between the previous origin and the current origin
        // This will not always be available, but if it is, developers may choose to use it
        const transform = xrReferenceSpaceEvent.transform;
        if (xrReferenceSpaceResetCallback != undefined && transform) {
            xrReferenceSpaceResetCallback(transform);
        }
    }
}
