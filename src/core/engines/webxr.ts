/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import { initCameraCaptureScene, drawCameraCaptureScene, createImageFromTexture, getCameraIntrinsics } from '@core/cameraCapture';
import { XR_DEPTH_FAR, XR_DEPTH_NEAR } from '@core/common';
import { checkGLError } from '@core/devTools';
import type {
    StartImmersiveArOptions,
    SceneRootMatrix,
    XrFrameUpdateCallbackType,
    XrMarkerFrameUpdateCallbackType,
    XrNoPoseCallbackType,
    XrReferenceSpaceResetCallbackType,
    XrSessionEndedCallbackType,
} from '../../types/xr';

// TODO(soeroesg): coordinate system reset must be handled
// See https://immersive-web.github.io/webxr/spatial-tracking-explainer.html#reference-space-reset-event

/**
 * WebXR implementation of the AR engine.
 */
export default class webxr {
    private session: XRSession | null = null;
    private glBinding: XRWebGLBinding | undefined;
    private gl: WebGL2RenderingContext | null = null;
    private referenceSpacesReady: Promise<void> = Promise.resolve();

    private xrFrameUpdateCallback: XrFrameUpdateCallbackType | null = null;
    private xrMarkerFrameUpdateCallback: XrMarkerFrameUpdateCallbackType | null = null;
    private xrSessionEndedCallback: XrSessionEndedCallbackType | null = null;
    private xrNoPoseCallback: XrNoPoseCallbackType | null = null;
    private xrReferenceSpaceResetCallback: XrReferenceSpaceResetCallbackType | null = null;

    private localFloorWebXrReferenceSpace: XRReferenceSpace | null = null;
    private localWebXrReferenceSpace: XRReferenceSpace | null = null;
    private anchorsAccessFailed = false;
    private frameCallbackFailed = false;

    /**
     * Start an immersive AR session: request session, create XR-compatible GL context,
     * optional `onXrGlContextReady` / `onXrSessionSetup`, then create the XR layer and RAF loop.
     * @param options  StartImmersiveArOptions The options to use
     * @returns void
     */
    async startImmersiveAr(options: StartImmersiveArOptions): Promise<void> {
        if (this.session) {
            throw new Error('startImmersiveAr: an immersive AR session is already active');
        }

        if (!navigator.xr) {
            throw new Error('WebXR not available');
        }

        const {
            canvas,
            xrSessionOptions,
            onXrGlContextReady,
            onXrSessionSetup,
            onXrFrameUpdate,
            onXrMarkerFrameUpdate,
            onXrSessionEnded,
            onXrNoPose,
        } = options;

        this.xrFrameUpdateCallback = onXrFrameUpdate ?? null;
        this.xrMarkerFrameUpdateCallback = onXrMarkerFrameUpdate ?? null;
        this.xrSessionEndedCallback = onXrSessionEnded ?? null;
        this.xrNoPoseCallback = onXrNoPose ?? null;

        const xrSession = await navigator.xr.requestSession('immersive-ar', xrSessionOptions);
        await this.createXrCompatibleContext(canvas, xrSession);

        await onXrGlContextReady?.(this.gl!);
        onXrSessionSetup?.(this, xrSession, this.gl);

        await this.createXrLayerAndStartLoop();
    }

    /**
     * @private
     * Creates an XR-compatible WebGL2 context and reference spaces.
     * @param canvas  HTMLCanvasElement The canvas to use
     * @param xrSession  XRSession The session to use
     * @returns void
     */
    private async createXrCompatibleContext(canvas: HTMLCanvasElement, xrSession: XRSession): Promise<void> {
        this.session = xrSession;
        this.session.addEventListener('end', this._onXrSessionEnded);

        this.gl = canvas.getContext('webgl2', { xrCompatible: true }) as WebGL2RenderingContext | null;
        if (!this.gl) {
            throw new Error('Could not create an XR-compatible WebGL context!');
        }

        // See https://immersive-web.github.io/webxr/spatial-tracking-explainer.html#reference-spaces
        this.referenceSpacesReady = Promise.all([
            this.session.requestReferenceSpace('local-floor'),
            this.session.requestReferenceSpace('local'),
        ]).then((values) => {
            this.localFloorWebXrReferenceSpace = values[0];
            this.localWebXrReferenceSpace = values[1];
            this.localFloorWebXrReferenceSpace.addEventListener('reset', this._onXrReferenceSpaceReset);
            this.localWebXrReferenceSpace.addEventListener('reset', this._onXrReferenceSpaceReset);
        });
    }

    /**
     * @private
     * Create the XRWebGLLayer after the canvas drawing buffer has been sized, then start the XR animation loop.
     */
    private async createXrLayerAndStartLoop(): Promise<void> {
        if (!this.session || !this.gl) {
            throw new Error('createXrLayerAndStartLoop: session or GL context missing');
        }

        // Widen depth clip vs tight UA defaults so near/far clipping is less aggressive while moving (meters).
        this.session.updateRenderState({
            baseLayer: new XRWebGLLayer(this.session, this.gl),
            depthNear: XR_DEPTH_NEAR,
            depthFar: XR_DEPTH_FAR,
        });

        if (this.xrMarkerFrameUpdateCallback) {
            this.session.getTrackedImageScores?.()
                .then((scores) => {
                    if (scores && scores.length > 0) {
                        console.log('Marker score: ', scores[0]);
                    }
                })
                .catch((error) => {
                    console.warn('getTrackedImageScores failed (non-fatal):', error);
                });
        }

        await this.referenceSpacesReady;
        this.session.requestAnimationFrame(this._onXrFrameUpdate);
    }

    /**
     * Set the default viewport of the WebGL context.
     * @returns void
     */
    setViewPort() {
        this.gl?.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }

    /**
     * Set the viewport according to provided view.
     * @param view  XRView The view to use
     * @returns XRViewport
     */
    setViewportForView(view: XRView) {
        const viewport = this.session?.renderState?.baseLayer?.getViewport(view);
        if (viewport) {
            this.gl?.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
            getCameraIntrinsics(view.projectionMatrix, viewport);
        } else {
            this.setViewPort();
        }
        return viewport;
    }

    /**
     * Requires `camera-access` on the session. Creates `XRWebGLBinding` and the GL blit scene for `getCameraTexture2`.
     * @param gl  WebGL2RenderingContext The WebGL context to use
     * See https://immersive-web.github.io/webxr/camera-access-explainer.html#session-init
     */
    initCameraCapture(gl: WebGL2RenderingContext) {
        if (!this.session) {
            throw new Error('initCameraCapture: no active XR session');
        }
        this.glBinding = new XRWebGLBinding(this.session, gl);
        initCameraCaptureScene(gl);
    }

    /**
     * Current best effort to get the camera image from the WebXR session.
     * @param frame XRFrame The current frame to get the image for
     * @param view  XRView  The view to use
     * @returns WebGLTexture
     */
    getCameraTexture(frame: XRFrame, view: XRView) {
        // NOTE: if we do not draw anything on pose update for more than 5 frames, Chrome's WebXR sends warnings
        // See OnFrameEnd() in https://chromium.googlesource.com/chromium/src/third_party/+/master/blink/renderer/modules/xr/xr_webgl_layer.cc

        // We want to capture the camera image, however, it is not directly available here,
        // but only as a GPU texture. We draw something textured with the camera image at every frame,
        // so that the texture is kept in GPU memory. We can then capture it below.
        if (!this.gl || !view.camera) {
            return;
        }
        const cameraTexture = this.glBinding?.getCameraImage(view.camera); // note: this returns a WebGlTexture
        if (!cameraTexture) {
            return;
        }
        drawCameraCaptureScene(this.gl, cameraTexture);
        checkGLError(this.gl, 'getCameraTexture() end');
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
            if (!this.gl || !cameraTexture) {
                throw new Error('gl or cameraTexture is null!');
            }
            drawCameraCaptureScene(this.gl, cameraTexture);
            checkGLError(this.gl, 'getCameraTexture2() end');

            return {
                cameraTexture: cameraTexture,
                cameraIntrinsics: cameraIntrinsics,
                cameraViewport: cameraViewport,
            };
        }
    }

    /**
     * Convert WebGL texture to actual image to use for localisation.
     * @param texture  WebGLTexture     The texture to convert
     * @param width  Number     Width of the texture
     * @param height  Number Height of the texture
     * @returns base64 encoded image
     */
    getCameraImageFromTexture(texture: WebGLTexture, width: number, height: number) {
        if (!this.gl) {
            throw new Error('gl is undefined!');
        }
        return createImageFromTexture(this.gl, texture, width, height);
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
     * Create anchor for origin point of WebXR coordinate system to fix the 3D engine to it.
     * @param frame  XRFrame The current frame to base the anchor on
     * @param rootUpdater  function Callback into the 3D engine to adopt changes when anchor is moved
     */
    createRootAnchor(frame: XRFrame, rootUpdater: (matrix: SceneRootMatrix) => void) {
        if (!this.localFloorWebXrReferenceSpace) {
            return;
        }
        if (frame.createAnchor) {
            const anchorPromise = frame.createAnchor(new XRRigidTransform(), this.localFloorWebXrReferenceSpace);
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
     * Handles a single anchor right now. Needs to be extended when more anchors are used.
     * @param frame  XRFrame The current frame to get the image for
     */
    handleAnchors(frame: XRFrame) {
        if (!this.localFloorWebXrReferenceSpace) {
            return;
        }

        // The getter throws InvalidStateError when the anchors feature is not enabled.
        // Optional chaining does not catch that, and Create/Develop call this every frame.
        let anchors: XRAnchorSet | undefined;
        try {
            anchors = frame.trackedAnchors;
        } catch (error) {
            this.logAnchorsFailure('WebXR trackedAnchors is unavailable:', error);
            return;
        }
        if (!anchors) {
            return;
        }

        anchors.forEach((anchor) => {
            try {
                const anchorPose = frame.getPose(anchor.anchorSpace, this.localFloorWebXrReferenceSpace!);
                if (anchorPose) {
                    anchor.context?.rootUpdater(anchorPose.transform.matrix);
                }
            } catch (error) {
                this.logAnchorsFailure('WebXR anchor pose failed:', error);
            }
        });
    }

    private logAnchorsFailure(message: string, error: unknown) {
        if (this.anchorsAccessFailed) {
            return;
        }
        this.anchorsAccessFailed = true;
        console.error(message, error);
    }

    /**
     * Main XR frame update callback.
     * @param time  DOMHighResTimeStamp The time of the frame
     * @param xrFrame  XRFrame The current frame
     */
    private _onXrFrameUpdate = (time: DOMHighResTimeStamp, xrFrame: XRFrame) => {
        const session = xrFrame.session;
        if (!this.session || session !== this.session) {
            return;
        }

        session.requestAnimationFrame(this._onXrFrameUpdate);

        this.gl?.bindFramebuffer(this.gl.FRAMEBUFFER, session.renderState?.baseLayer?.framebuffer || null);

        if (!this.localFloorWebXrReferenceSpace) {
            return;
        }

        // NOTE(soeroesg): we could query the pose in multiple reference frames and trigger respective callbacks

        const xrViewerPose = xrFrame.getViewerPose(this.localFloorWebXrReferenceSpace);
        if (xrViewerPose) {
            try {
                this.xrFrameUpdateCallback?.(time, xrFrame, xrViewerPose, this.localFloorWebXrReferenceSpace);

                if (this.xrMarkerFrameUpdateCallback) {
                    const results = xrFrame.getImageTrackingResults();
                    if (results.length > 0) {
                        // TODO(soeroesg): markerPose is actually the pose of image space relative to the localFloor reference space
                        // but the name suggests it is the camera pose w.r.t the marker
                        const markerPose = xrFrame.getPose(results[0].imageSpace, this.localFloorWebXrReferenceSpace);
                        if (markerPose) {
                            this.xrMarkerFrameUpdateCallback(time, xrFrame, xrViewerPose, markerPose, results[0]);
                        }
                    }
                }
            } catch (error) {
                // An exception here used to repeat on every animation frame and skip the GL draw,
                // which hides the camera passthrough and leaves the tracking indicator red.
                if (!this.frameCallbackFailed) {
                    this.frameCallbackFailed = true;
                    console.error('XR frame update failed:', error);
                }
            }
        } else {
            this.xrNoPoseCallback?.(time, xrFrame);
        }
    };

    /**
     * Handler for session ended event. Used to clean up allocated memory and handler.
     */
    private _onXrSessionEnded = () => {
        this.xrSessionEndedCallback?.();

        if (this.session) {
            this.session.removeEventListener('end', this._onXrSessionEnded);
        }
        this.session = null;
        if (this.gl && !this.gl.isContextLost()) {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        }
        this.gl = null;
        this.glBinding = undefined;
        this.localFloorWebXrReferenceSpace = null;
        this.localWebXrReferenceSpace = null;
        this.xrFrameUpdateCallback = null;
        this.xrMarkerFrameUpdateCallback = null;
        this.xrNoPoseCallback = null;
        this.xrReferenceSpaceResetCallback = null;
        this.xrSessionEndedCallback = null;
        this.anchorsAccessFailed = false;
        this.frameCallbackFailed = false;
    };

    /**
     * Handler for reference space reset event.
     * @param xrReferenceSpaceEvent  XRReferenceSpaceEvent The event to handle
     * See https://immersive-web.github.io/webxr/spatial-tracking-explainer.html#reference-space-reset-event
     */
    private _onXrReferenceSpaceReset = (xrReferenceSpaceEvent: XRReferenceSpaceEvent) => {
        console.log('Reference space reset happened!');
        // Check for the transformation between the previous origin and the current origin
        // This will not always be available, but if it is, developers may choose to use it
        const transform = xrReferenceSpaceEvent.transform;
        if (this.xrReferenceSpaceResetCallback != undefined && transform) {
            this.xrReferenceSpaceResetCallback(transform);
        }
    };
}
