<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<!--
    Initializes and runs the AR session. Configuration will be according the data provided by the parent.
-->
<script lang="ts">
    import Parent from '@components/Viewer.svelte';
    import ArCloudOverlay from '@components/dom-overlays/ArCloudOverlay.svelte';
    import type webxr from '../../core/engines/webxr';
    import type ogl from '../../core/engines/ogl/ogl';
    import type { XrFeatures } from '../../types/xr';
    import type { OGLRenderingContext } from 'ogl';

    let parentInstance: Parent;

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     */
    export function startAr(thisWebxr: webxr, this3dEngine: ogl) {
        parentInstance.startAr(thisWebxr, this3dEngine);

        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        let requiredXrFeatures: XrFeatures[] = ['dom-overlay', 'camera-access', 'anchors', 'local-floor'];
        let optionalXrFeatures: XrFeatures[] = [];
        parentInstance.startSession(
            onXrFrameUpdate,
            onXrSessionEnded,
            onXrNoPose,
            (xr: webxr, result: XRSession, gl: OGLRenderingContext | null) => {
                if (!gl) {
                    throw new Error('gl is undefined');
                }
                xr.glBinding = new XRWebGLBinding(result, gl);
                xr.initCameraCapture(gl);
            },
            requiredXrFeatures,
            optionalXrFeatures,
        );
    }
    /**
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events: any) {
        // Viewer-Oscp cannot handle any events currently
        console.log('Viewer-Oscp: Unknown event received:');
        console.log(events);
        // pass on to parent
        return parentInstance.onNetworkEvent(events);
    }

    /**
     * Handles update loop when AR Cloud mode is used.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     * @param floorSpaceReference
     */
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose) {
        parentInstance.onXrFrameUpdate(time, frame, floorPose);
    }

    /**
     * Called when no pose was reported from WebXR.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame  XRFrame        The XRFrame provided to the update loop
     * @param floorPose  XRPose     The pose of the device as reported by the XRFrame
     */
    function onXrNoPose(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose) {
        parentInstance.onXrNoPose(time, frame, floorPose);
    }

    /**
     * Called when the XRSession was closed.
     */
    function onXrSessionEnded() {
        parentInstance.onXrSessionEnded();
    }
</script>

<Parent bind:this={parentInstance} on:arSessionEnded on:broadcast>
    <svelte:fragment slot="overlay" let:isLocalizing let:isLocalized let:isLocalisationDone let:firstPoseReceived let:receivedContentTitles>
        <ArCloudOverlay
            hasPose={firstPoseReceived}
            {isLocalizing}
            {isLocalized}
            {receivedContentTitles}
            on:startLocalisation={() => parentInstance.startLocalisation()}
            on:relocalize={() => parentInstance.relocalize()}
        />
    </svelte:fragment>
</Parent>
