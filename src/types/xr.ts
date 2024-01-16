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
import type ogl from '../core/engines/ogl/ogl';
import type { OGLRenderingContext } from 'ogl';

export type ValueOf<T> = T[keyof T];

export type XrFrameUpdateCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, floorSpaceReference: XRReferenceSpace | XRBoundedReferenceSpace) => void;
export type XrMarkerFrameUpdateCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, localPose: XRPose, trackedImage: XRImageTrackingResult) => void;
export type XrNoPoseCallbackType = (time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, frameDuration?: number, passedMaxSlow?: boolean) => void;
export type SetupFunction = (xr: webxr, xrSession: XRSession, gl: OGLRenderingContext | null) => void;
export type XrFeatures = 'dom-overlay' | 'camera-access' | 'anchors' | 'local-floor';
export type ObjectDescription = {
    version: number;
    color: [number, number, number, number];
    shape: ValueOf<typeof PRIMITIVES>;
    scale: [number, number, number];
    transparent: boolean;
    options: {};
};

export type ExperimentsViewers = never; // TODO: this needs to be a union type of all the possible experiment views, eg.: @experiments/<subroot>/<experimentname1>/Viewer.svelte | @experiments/<subroot>/<experimentname2>/Viewer.svelte

export type Position = { x: number; y: number; z: number };
export type Orientation = { x: number; y: number; z: number; w: number };

export type OldFormatGeopose = Omit<Geopose, 'position'> & { latitude: number; longitude: number; ellipsoidHeight: number };
