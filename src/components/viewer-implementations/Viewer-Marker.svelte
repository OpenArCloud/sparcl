<!-- WARNING: this code is left behind from refactoring. do not use it -->

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
    import { debounce, type DebouncedFunc } from 'lodash';

    import { getContentsAtLocation, type Geopose, type SCR } from '@oarc/scd-access';

    import { handlePlaceholderDefinitions } from '@core/definitionHandlers';

    import {
        availableContentServices,
        currentMarkerImage,
        currentMarkerImageWidth,

        initialLocation,
        receivedScrs,
        recentLocalisation,
        selectedContentServices,
    } from '@src/stateStore';

    import ArMarkerOverlay from '@components/dom-overlays/ArMarkerOverlay.svelte';

    import { wait } from '@core/common';
    import type webxr from '../../core/engines/webxr';
    import type ogl from '../../core/engines/ogl/ogl';
    import { Mat4, Transform, type Mesh } from 'ogl';

    const message = (msg: string) => console.log(msg);

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    let canvas: HTMLCanvasElement;
    let overlay: HTMLElement;
    let externalContent: HTMLIFrameElement;
    let closeExperience: HTMLImageElement;
    let xrEngine: webxr;
    let tdEngine: ogl;

    let doCaptureImage = false;
    let showFooter = false;
    let experienceLoaded = false;
    let firstPoseReceived = false;
    let isLocalized = false;
    let hasLostTracking = false;
    let unableToStartSession = false;
    let experimentIntervallId: ReturnType<typeof setInterval> | undefined = undefined;

    let trackedImageObject: Mesh;
    let poseFoundHeartbeat: DebouncedFunc<() => boolean> | undefined;

    let receivedContentTitles: string[] = [];

    // TODO: Setup event target array, based on info received from SCD

    onDestroy(() => {
        tdEngine.stop();
    });

    /**
     * Verifies that AR is available as required by the provided configuration data, and starts the session.
     */
    export function startAr(thisWebxr: webxr, this3dEngine: ogl) {
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;

        // give the component some time to set up itself
        wait(1000).then(() => (showFooter = true));

        startSession();
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
        const promise = xrEngine.startMarkerSession(canvas, handleMarker, options);

        if (promise) {
            promise
                .then(() => {
                    xrEngine.setCallbacks(onXrSessionEnded, onXrNoPose);
                    tdEngine.init();
                })
                .catch((error: any) => {
                    unableToStartSession = true;
                    message('WebXR Immersive AR failed to start: ' + error);
                });
        } else {
            message('AR session was started with unknown mode');
            throw new Error('AR session was started with unknown mode');
        }
    }

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

        if (experimentIntervallId) {
            clearInterval(experimentIntervallId);
            experimentIntervallId = undefined;
        }

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
     * @param frameDuration  integer        The duration of the previous frame
     * @param passedMaxSlow  boolean        Max number of slow frames passed
     */
    function onXrNoPose(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, frameDuration: number | undefined, passedMaxSlow: boolean | undefined) {
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
    function handleMarker(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, localPose: XRPose, trackedImage: XRImageTrackingResult) {
        handlePoseHeartbeat();

        firstPoseReceived = true;
        showFooter = false;

        xrEngine.setViewPort();

        if (trackedImage && trackedImage.trackingState === 'tracked') { // TODO: use XRImageTrackingState.tracked
            if (!trackedImageObject) {
                trackedImageObject = tdEngine.addMarkerObject();
            }

            const position = localPose.transform.position;
            const orientation = localPose.transform.orientation;
            tdEngine.updateMarkerObjectPosition(trackedImageObject, position, orientation);
            isLocalized = true;
        }

        tdEngine.render(time, floorPose.views[0]);
    }

    /*
     * @param localPose XRPose      The pose of the camera when localisation was started in local reference space
     * @param globalPose  GeoPose       The global camera GeoPose as returned from the GeoPose service
     */
    export function onLocalizationSuccess(localPose: XRPose, globalPose: Geopose) {
        let localImagePose = localPose.transform;
        let globalImagePose = globalPose;
        tdEngine.updateGeoAlignment(localImagePose, globalImagePose);
    }

    /**
     * Show ui for localisation again.
     */
    function relocalize() {
        isLocalized = false;
        receivedContentTitles = [];

        tdEngine.clearScene();

        showFooter = true;
    }

    /**
     * Request content from SCD available around the current location.
     */
    function getContentsInH3Cell() {
        const servicePromises = $availableContentServices.reduce<Promise<SCR[]>[]>((result, service) => {
            if ($selectedContentServices[service.id]?.isSelected) {
                result.push(getContentsAtLocation(service.url, 'history', $initialLocation.h3Index));
            }
            return result;
        }, []);

        return Promise.all(servicePromises);
    }

    /**
     *  Places the content provided by a call to Spacial Content Discovery providers.
     *
     * @param scr  [SCR]        Content Records with the result from the selected content services
     */
    function placeContent(scr: SCR[][]) {
        scr.forEach((response) => {
            console.log('Number of content items received: ', response.length);

            response.forEach((record) => {
                $receivedScrs.push(record);
                receivedContentTitles.push(record.content.title);

                // TODO: this method could handle any type of content:
                //tdEngine.addSpatialContentRecord(globalObjectPose, record.content)

                // Difficult to generalize, because there are no types defined yet.
                switch (record.content.type) {
                    case 'MODEL_3D':
                    case '3D': // TODO: should be removed // AC added it in Nov.2022
                    case 'placeholder': // TODO: should be removed // AC removed it in Nov.2022
                        let globalObjectPose = record.content.geopose;
                        let localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);
                        let position = localObjectPose.position;
                        let orientation = localObjectPose.quaternion;

                        // DEPRECATED
                        // Augmented City proprietary structure (has no refs, has type infosticker and has custom_data fieds)
                        // kept for backward compatibility and will be removed
                        //if (record.content.custom_data?.sticker_type.toLowerCase() === 'other') { // sticker_type was removed in Nov.2021
                        // if (record.content.custom_data?.sticker_subtype != undefined) {
                        //     const subtype = record.content.custom_data.sticker_subtype.toLowerCase();
                        //     const url = record.content.custom_data.path;

                        //     // TODO: Receive list of events to register to from SCD and register them here
                        //     switch (subtype) {
                        //         case 'scene':
                        //             const experiencePlaceholder = tdEngine.addExperiencePlaceholder(position, orientation);
                        //             tdEngine.addClickEvent(experiencePlaceholder, () => experienceLoadHandler(experiencePlaceholder, position, orientation, url));
                        //             break;
                        //         case 'gltf':
                        //             tdEngine.addModel(position, orientation, url);
                        //             break;
                        //         default:
                        //             console.log('Error: unexpected sticker subtype: ' + subtype);
                        //             break;
                        //     }
                        // we cannot load anything else but AC-compliant 3D models
                        // so draw a placeholder instead
                        const placeholder = tdEngine.addPlaceholder(record.content.keywords, position, orientation);
                        handlePlaceholderDefinitions(tdEngine, placeholder /* record.content.definition */);
                        break;

                    default:
                        console.log(record.content.title + ' has unexpected content type: ' + record.content.type);
                        console.log(record.content);
                        break;
                }

                //wait(1000).then(() => receivedContentTitles = []); // clear the list after a timer

                // TODO: Anchor placeholder for better visual stability?!
            });
        });

        tdEngine.endSpatialContentRecords();
    }

</script>

<canvas id="application" bind:this={canvas}></canvas>

<aside bind:this={overlay} on:beforexrselect={(event) => event.preventDefault()}>
    <iframe class:hidden={!experienceLoaded} bind:this={externalContent} src=""></iframe>
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
