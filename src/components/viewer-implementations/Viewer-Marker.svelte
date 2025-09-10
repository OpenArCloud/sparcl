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
    import { createEventDispatcher, onDestroy } from 'svelte';
    import { debounce, type DebouncedFunction } from 'es-toolkit';
    import { Mesh, Quat, Vec3 } from 'ogl';

    import { currentMarkerImage, currentMarkerImageWidth } from '@src/stateStore';

    import ArMarkerOverlay from '@components/dom-overlays/ArMarkerOverlay.svelte';
    import { wait } from '@core/common';
    import type webxr from '../../core/engines/webxr';
    import type ogl from '../../core/engines/ogl/ogl';

    let canvas: HTMLCanvasElement;
    let overlay: HTMLElement;
    let externalContent: HTMLIFrameElement;
    let closeExperience: HTMLImageElement;
    let xrEngine: webxr;
    let tdEngine: ogl;

    let showFooter = false;
    let experienceLoaded = false;
    let firstPoseReceived = false;
    let isLocalized = false;
    let hasLostTracking = false;
    let unableToStartSession = false;

    let trackedImageObject: Mesh;
    let poseFoundHeartbeat: DebouncedFunction<() => boolean> | undefined;

    const message = (msg: string) => console.log(msg);

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     */
    export function startAr(thisWebxr: webxr, this3dEngine: ogl) {
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;

        // give the component some time to set up itself
        wait(1000).then(() => (showFooter = true));

        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        const bitmap = await loadDefaultMarker();
        const options = {
            requiredFeatures: ['dom-overlay', 'image-tracking', 'anchors', 'local-floor'],
            domOverlay: { root: overlay },
            // hack to circumvent exhaustive type checking of object literals, because trackedImages does not exist on XRSessionInit
            trackedImages: [
                {
                    image: bitmap,
                    widthInMeters: $currentMarkerImageWidth,
                },
            ],
        };

        try {
            await xrEngine.startMarkerSession(canvas, onXrMarkerFrameUpdateCallback, options);
        } catch (error) {
            unableToStartSession = true;
            message('WebXR Immersive AR failed to start: ' + error);
            return;
        }

        xrEngine.setCallbacks(onXrSessionEnded, onXrNoPose);
        tdEngine.init();
    }

    onDestroy(() => {
        tdEngine.stop();
    });

    // TODO: Setup target array based on info received from SCD
    /**
     * Load marker and configure marker tracking.
     *
     * In the future, markers can be provided by the user or SCD.
     * Leaving this function here for now, as the marker system needs some bigger rework anyway.
     */
    async function loadDefaultMarker() {
        const response = await fetch(`/media/${$currentMarkerImage}`);
        const blob = await response.blob();
        return await createImageBitmap(blob);
    }

    /**
     * Let's the app know that the XRSession was closed.
     */
    function onXrSessionEnded() {
        firstPoseReceived = false;
        dispatch('arSessionEnded');
    }

    /**
     * Handles a pose found heartbeat. When it's not triggered for a specific time (300ms as default) an indicator
     * is shown to let the user know that the tracking was lost.
     */
    function handlePoseHeartbeat() {
        hasLostTracking = false;
        if (poseFoundHeartbeat === undefined) {
            poseFoundHeartbeat = debounce(() => (hasLostTracking = true), 300);
        }

        poseFoundHeartbeat();
    }

    /**
     * Called when an AR feature used in experiment mode doesn't return a result.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame  XRFrame        The XRFrame provided to the update loop
     * @param floorPose  XRPose     The pose of the device as reported by the XRFrame
     */
    function onXrNoPose(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose) {
        hasLostTracking = true;
        tdEngine.render(time, floorPose.views[0]);
    }

    /**
     * Handles update loop when marker mode is used.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose  The pose relative to the floor
     * @param localPose The pose relative to the center of the marker
     * @param trackedImage
     */
    function onXrMarkerFrameUpdateCallback(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, localPose: XRPose, trackedImage: XRImageTrackingResult) {
        handlePoseHeartbeat();

        showFooter = false;
        if (trackedImage && trackedImage.trackingState === 'tracked') {
            // TODO: use XRImageTrackingState.tracked
            if (!trackedImageObject) {
                trackedImageObject = tdEngine.addMarkerObject();
            }

            const localPos = localPose.transform.position;
            const localOri = localPose.transform.orientation;
            const position = new Vec3(localPos.x, localPos.y, localPos.z);
            const orientation = new Quat(localOri.x, localOri.y, localOri.z, localOri.w);
            tdEngine.updateMarkerObjectPosition(trackedImageObject, position, orientation);
            isLocalized = true;
        }

        xrEngine.setViewportForView(floorPose.views[0]);
        tdEngine.render(time, floorPose.views[0]);
    }

    /**
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events: any) {
        // Viewer-Marker cannot handle any events currently
        console.log('Viewer-Marker: Unknown event received:');
        console.log(events);
    }
</script>

<canvas id="application" bind:this={canvas}></canvas>

<aside bind:this={overlay} on:beforexrselect={(event) => event.preventDefault()}>
    <iframe title="externalcontentiframe" class:hidden={!experienceLoaded} bind:this={externalContent} src=""></iframe>
    <img id="experienceclose" class:hidden={!experienceLoaded} alt="close button" src="/media/close-cross.svg" bind:this={closeExperience} />

    <!--  Space for UI elements  -->
    {#if showFooter}
        <footer>
            {#if unableToStartSession}
                <h4>Couldn't start AR</h4>
                <p>
                    sparcl needs some <a href="https://openarcloud.github.io/sparcl/guides/incubationflag.html"> experimental flags</a> to be enabled.
                </p>
            {:else}
                <ArMarkerOverlay />
            {/if}
        </footer>
    {/if}

    {#if hasLostTracking}
        <div id="trackinglostindicator"></div>
    {/if}
</aside>

<style>
    aside footer {
        position: absolute;
        bottom: 0;

        margin: var(--ui-margin);
        padding: 0 27px;

        width: calc(100vw - 4 * var(--ui-margin));

        border: 1px solid black;
        border-radius: var(--ui-radius);
        font-size: 16px;
        font-weight: bold;
        text-align: center;

        background: #ffffff 0 0 no-repeat padding-box;

        opacity: 0.7;
    }

    canvas,
    iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
    }

    iframe {
        background-color: transparent;
    }

    #experienceclose {
        position: absolute;
        margin: 10px;
    }

    #trackinglostindicator {
        position: absolute;
        right: 10px;
        bottom: 10px;

        width: 2em;
        height: 2em;

        background-color: red;

        border-radius: 50%;
    }

    .hidden {
        display: none;
    }
</style>
