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

export type XrFrameUpdateCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose, xrReferenceSpace: XRReferenceSpace | XRBoundedReferenceSpace) => void;
export type XrMarkerFrameUpdateCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose, markerPose: XRPose, trackedImage: XRImageTrackingResult) => void;
export type XrNoPoseCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose, frameDuration?: number, passedMaxSlow?: boolean) => void;

/** WebGL2 context bound to the WebXR session canvas (`webgl2`, `xrCompatible`). */
export type XrWebGL2Context = WebGL2RenderingContext;

/**
 * 4×4 column-major rigid transform from WebXR (e.g. `XRPose.transform.matrix`).
 * Used when applying anchored scene-root updates; kept separate from any specific renderer.
 */
export type SceneRootMatrix = Float32Array | number[];

export type SetupFunction = (xr: webxr, xrSession: XRSession, gl: XrWebGL2Context | null) => void;
export type XrFeature = string;

export type ExperimentsViewers = Ismar2021SignPostViewer | Ismar2021MultiViewer | Ismar2021PerformanceViewer;
