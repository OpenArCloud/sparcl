<script lang="ts">
    import { setContext } from 'svelte';
    import { writable, type Writable } from 'svelte/store';
    import ArCloudOverlay from '@components/dom-overlays/ArCloudOverlay.svelte';
    import Parent from '@components/Viewer.svelte';
    import type webxr from '../../../core/engines/webxr';
    import type ogl from '../../../core/engines/ogl/ogl';
    let parentInstance: Parent;
    let xrEngine: webxr;
    let tdEngine: ogl;
    let settings: Writable<Record<string, unknown>> = writable({});

    let parentState = writable();
    setContext('state', parentState);

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     * @param options  { settings }       Options provided by the app. Currently contains the settings from the Dashboard
     */
    export function startAr(thisWebxr: webxr, this3dEngine: ogl, options?: { settings?: Writable<Record<string, unknown>> }) {
        parentInstance.startAr(thisWebxr, this3dEngine);
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;

        if (options?.settings) {
            settings = options?.settings;
        }

        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        await parentInstance.startSession(
            onXrFrameUpdate,
            onXrSessionEnded,
            onXrNoPose,
            (xr, session, gl) => {
                if (gl) {
                    xr.glBinding = new XRWebGLBinding(session, gl);
                    xr.initCameraCapture(gl);
                }
                session.requestReferenceSpace('viewer');
            },
            ['dom-overlay', 'camera-access', 'local-floor'],
        );
    }

    /**
     * Handles update loop when AR Cloud mode is used.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     */
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose) {
        parentInstance.onXrFrameUpdate(time, frame, floorPose);
    }

    /**
     * Let's the app know that the XRSession was closed.
     */
    function onXrSessionEnded() {
        parentInstance.onXrSessionEnded();
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
</script>

<!-- <div style="position:fixed; top:0; left: 0; width:50%; height:50%; background:black; color: white;">Test</div> -->
<Parent bind:this={parentInstance} on:arSessionEnded>
    <svelte:fragment slot="overlay" let:isLocalizing let:isLocalized let:isLocalisationDone let:firstPoseReceived>
        {#if $settings.localisation && !isLocalisationDone}
            <ArCloudOverlay hasPose={firstPoseReceived} {isLocalizing} {isLocalized} on:startLocalisation={() => parentInstance.startLocalisation()} />
        {/if}
    </svelte:fragment>
</Parent>
