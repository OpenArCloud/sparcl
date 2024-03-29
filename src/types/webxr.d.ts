/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

// https://immersive-web.github.io/

declare interface XRWebGLBinding {
    getCameraImage(camera: XRCamera): WebGLTexture | null;
}

declare interface XRCamera {
    width: number;
    height: number;
}

declare interface XRView {
    camera?: XRCamera;
}

declare interface XRFrame {
    getImageTrackingResults: () => XRImageTrackingResult[];
}

declare interface XRImageTrackingResult {
    imageSpace: XRSpace;
    index: number;
    trackingState: XRImageTrackingState;
    measuredWidthInMeters: number;
}

declare type XRImageTrackingState = 'untracked' | 'tracked' | 'emulated'; // TODO: should be enum

declare interface XRAnchor {
    context?: { rootUpdater: rootUpdater };
}

declare interface XRSession {
    getTrackedImageScores: () => Promise<XRImageTrackingScore[]>;
}

declare enum XRImageTrackingScore {
    'untrackable',
    'trackable',
}
