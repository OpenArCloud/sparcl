/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { Geopose } from '@oarc/scd-access';
import type { PRIMITIVES } from '../core/engines/ogl/modelTemplates';
import type webxr from '../core/engines/webxr';
import type { OGLRenderingContext } from 'ogl';
import type Ismar2021SignPostViewer from '../experiments/oarc/ismar2021signpost/Viewer.svelte';
import type Ismar2021MultiViewer from '../experiments/oarc/ismar2021multi/Viewer.svelte';
import type Ismar2021PerformanceViewer from '../experiments/oarc/performance/Viewer.svelte';

export type ValueOf<T> = T[keyof T];

export type XrFrameUpdateCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, floorSpaceReference: XRReferenceSpace | XRBoundedReferenceSpace) => void;
export type XrMarkerFrameUpdateCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, localPose: XRPose, trackedImage: XRImageTrackingResult) => void;
export type XrNoPoseCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, frameDuration?: number, passedMaxSlow?: boolean) => void;
export type SetupFunction = (xr: webxr, xrSession: XRSession, gl: OGLRenderingContext | null) => void;
export type XrFeatures = 'dom-overlay' | 'camera-access' | 'anchors' | 'local-floor' | 'hit-test';
export type ObjectDescription = {
    version: number;
    color: [number, number, number, number];
    shape: ValueOf<typeof PRIMITIVES>;
    scale: [number, number, number];
    transparent: boolean;
    options: {};
};

export type ExperimentsViewers = Ismar2021SignPostViewer | Ismar2021MultiViewer | Ismar2021PerformanceViewer;

export type Position = { x: number; y: number; z: number };
export type Orientation = { x: number; y: number; z: number; w: number };

export type OldFormatGeopose = Omit<Geopose, 'position'> & { latitude: number; longitude: number; ellipsoidHeight: number };
