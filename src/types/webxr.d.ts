// https://immersive-web.github.io/raw-camera-access/#idl-index

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

declare enum XRImageTrackingState {
    'untracked',
    'tracked',
    'emulated',
}

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
