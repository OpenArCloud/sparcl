/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type webxr from '@core/engines/webxr';
import type Ismar2021SignPostViewer from '@experiments/oarc/ismar2021signpost/Viewer.svelte';
import type Ismar2021MultiViewer from '@experiments/oarc/ismar2021multi/Viewer.svelte';
import type Ismar2021PerformanceViewer from '@experiments/oarc/performance/Viewer.svelte';

export type XrFeature = string;

export type XrFrameUpdateCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose, xrReferenceSpace: XRReferenceSpace | XRBoundedReferenceSpace) => void;

export type XrMarkerFrameUpdateCallbackType = (
    time: DOMHighResTimeStamp,
    frame: XRFrame,
    xrViewerPose: XRViewerPose,
    markerPose?: XRPose,
    trackedImage?: XRImageTrackingResult,
) => void;

export type XrNoPoseCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame) => void;

/** Invoked after the xrCompatible GL context exists, before `XRWebGLLayer` creation. */
export type XrGlContextReadyCallbackType = (gl: XrWebGL2Context) => void | Promise<void>;

/** Invoked after {@link onXrGlContextReady}, before `XRWebGLLayer` creation. */
export type XrSessionSetupCallbackType = (xr: webxr, xrSession: XRSession, gl: XrWebGL2Context | null) => void;

export type XrSessionEndedCallbackType = () => void;

export type XrReferenceSpaceResetCallbackType = (transform: XRRigidTransform) => void;

/** WebGL2 context bound to the WebXR session canvas (`webgl2`, `xrCompatible`). */
export type XrWebGL2Context = WebGL2RenderingContext;

/**
 * 4×4 column-major rigid transform from WebXR (e.g. `XRPose.transform.matrix`).
 * Used when applying anchored scene-root updates; kept separate from any specific renderer.
 */
export type SceneRootMatrix = Float32Array | number[];

export type ExperimentsViewers = Ismar2021SignPostViewer | Ismar2021MultiViewer | Ismar2021PerformanceViewer;

/** Options for {@link webxr.startImmersiveAr}. */
export type StartImmersiveArOptions = {
    canvas: HTMLCanvasElement;

    /**
     * Passed through to `navigator.xr.requestSession('immersive-ar', xrSessionOptions)`.
     * Values this app uses:
     * - `requiredFeatures` / `optionalFeatures`: `'dom-overlay' | 'camera-access' | 'anchors' |
     *   'local-floor' | 'hit-test' | 'image-tracking'`
     * - `domOverlay: { root }` when DOM overlay is requested (the HTML overlay root)
     * - `trackedImages: [{ image: ImageBitmap, widthInMeters }]` for Marker / image-tracking
     * Other XRSessionInit fields (depthSensing, etc.) are valid WebXR but unused here.
     */
    xrSessionOptions: XRSessionInit;

    /**
     * Attach/resize the rendering engine on the xrCompatible context (e.g. `tdEngine.init()`).
     * Runs after the GL context and reference spaces are created, before `onXrSessionSetup`.
     */
    onXrGlContextReady?: XrGlContextReadyCallbackType;

    /**
     * Per-session XR feature wiring — e.g. `initCameraCapture(gl)`, hit-test.
     * Runs after `onXrGlContextReady`, before `XRWebGLLayer` creation.
     */
    onXrSessionSetup?: XrSessionSetupCallbackType;

    onXrFrameUpdate?: XrFrameUpdateCallbackType;

    onXrMarkerFrameUpdate?: XrMarkerFrameUpdateCallbackType;

    onXrSessionEnded?: XrSessionEndedCallbackType;

    onXrNoPose?: XrNoPoseCallbackType;
};
