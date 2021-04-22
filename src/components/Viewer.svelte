<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Initializes and runs the AR session. Configuration will be according the data provided by the parent.
-->

<script>
    import {createEventDispatcher, onDestroy} from 'svelte';

    import {v4 as uuidv4} from 'uuid';

    import {objectEndpoint, sendRequest, validateRequest} from 'gpp-access';
    import GeoPoseRequest from 'gpp-access/request/GeoPoseRequest.js';
    import ImageOrientation from 'gpp-access/request/options/ImageOrientation.js';
    import {IMAGEFORMAT} from 'gpp-access/GppGlobals.js';

    import { arMode, availableContentServices, creatorModeSettings, currentMarkerImage, currentMarkerImageWidth,
        debug_appendCameraImage, debug_showLocationAxis, initialLocation,
        recentLocalisation } from '@src/stateStore';
    import { ARMODES, CREATIONTYPES, debounce, wait } from "@core/common";
    import { calculateDistance, calculateRotation, fakeLocationResult } from '@core/locationTools';

    import ArCloudOverlay from "@components/dom-overlays/ArCloudOverlay.svelte";
    import ArMarkerOverlay from "@components/dom-overlays/ArMarkerOverlay.svelte";


    const message = (msg) => console.log(msg);

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    let canvas, overlay, externalContent, closeExperience;
    let xrEngine, tdEngine;

    let doCaptureImage = false;
    let showFooter = false, experienceLoaded = false, experienceMatrix = null;
    let firstPoseReceived = false, isLocalizing = false, isLocalized = false, hasLostTracking = false;

    let trackedImageObject, creatorObject;
    let poseFoundHeartbeat = null;


    // TODO: Setup event target array, based on info received from SCD


    onDestroy(() => {
        tdEngine.stop();
    })


    /**
     * Verifies that AR is available as required by the provided configuration data, and starts the session.
     */
    export function startAr(thisWebxr, this3dEngine) {
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;

        // give the component some time to set up itself
        wait(1000).then(() => showFooter = true);

        startSession();
    }

    /**
     * Receives data from the application to be applied to current scene.
     */
    export function updateReceived(data) {
        // TODO: Receive list of events to fire from SCD

        if ('setrotation' in data) {
            // todo app.fire('setrotation', data.setrotation);
        }

        if ('setcolor' in data) {
            // todo app.fire('setcolor', data.setcolor);
        }
    }


    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        let promise;

        if ($arMode === ARMODES.dev) {
            promise = xrEngine.startDevSession(canvas, handleDevelopment, {
                requiredFeatures: ['dom-overlay', 'anchors', 'local-floor'],
                domOverlay: {root: overlay}
            });
        } else if ($arMode === ARMODES.creator) {
            promise = xrEngine.startCreativeSession(canvas, handleCreator, {
                requiredFeatures: ['dom-overlay', 'anchors', 'local-floor'],
                domOverlay: {root: overlay}
            });
        } else if ($arMode === ARMODES.oscp) {
            promise = xrEngine.startOscpSession(canvas, handleOscp, {
                requiredFeatures: ['dom-overlay', 'camera-access', 'anchors', 'local-floor'],
                domOverlay: {root: overlay}
            });
        } else if ($arMode === ARMODES.marker) {
            const bitmap = await loadDefaultMarker();
            promise = xrEngine.startMarkerSession(canvas, handleMarker, {
                requiredFeatures: ['dom-overlay', 'image-tracking', 'anchors', 'local-floor'],
                domOverlay: {root: overlay},
                trackedImages: [{
                    image: bitmap,
                    widthInMeters: $currentMarkerImageWidth
                }]
            });
        }

        if (promise) {
            promise
                .then(() => {
                    xrEngine.setSessionEndedCallback(onSessionEnded);
                    tdEngine.init();
                })
                .catch(error => {
                    message("WebXR Immersive AR failed to start: " + error);
                    throw new Error(error);
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
    function onSessionEnded() {
        firstPoseReceived = false;
        dispatch('arSessionEnded');
    }

    /**
     * Trigger localisation of the device globally using a GeoPose service.
     */
    function startLocalisation() {
        doCaptureImage = true;
        isLocalizing = true;
    }

    /**
     * Handles a pose found heartbeat. When it's not triggered for a specific time (300ms as default) an indicator
     * is shown to let the user know that the tracking was lost.
     */
    function handlePoseHeartbeat() {
        hasLostTracking = false;
        if (poseFoundHeartbeat === null) {
            poseFoundHeartbeat = debounce(() => hasLostTracking = true);
        }

        poseFoundHeartbeat();
    }

    /**
     * Special mode for sparcl development
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose     The pose of the device as reported by the XRFrame
     */
    function handleDevelopment(time, frame, floorPose) {
        handlePoseHeartbeat();

        xrEngine.setViewPort();

        if (firstPoseReceived === false) {
            firstPoseReceived = true;

            xrEngine.createRootAnchor(frame, tdEngine.getRootSceneUpdater());

            if ($debug_showLocationAxis) {
                tdEngine.addAxes();
            }

            for (let view of floorPose.views) {
                xrEngine.setViewportForView(view);

                console.log('fake localisation');

                isLocalized = true;
                wait(1000).then(showFooter = false);

                let geoPose = fakeLocationResult.geopose.pose;
                let data = fakeLocationResult.scrs;
                placeContent(floorPose, geoPose, data);
            }
        }

        if (experienceLoaded === true) {
            externalContent.contentWindow.postMessage(
                tdEngine.getExternalCameraPose(floorPose.views[0], experienceMatrix), '*');
        }

        xrEngine.handleAnchors(frame);
        tdEngine.render(time, floorPose, floorPose.views[0]);
    }

    /**
     * Special mode for content creators.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     */
    function handleCreator(time, frame, floorPose) {
        handlePoseHeartbeat();

        showFooter = false;

        xrEngine.setViewPort();

        if (firstPoseReceived === false) {
            firstPoseReceived = true;

            xrEngine.createRootAnchor(frame, tdEngine.getRootSceneUpdater());

            if ($debug_showLocationAxis) {
                tdEngine.addAxes();
            }
        }

        xrEngine.handleAnchors(frame);

        if (!creatorObject) {
            const position = {x: 0, y: 0, z: -4};
            const orientation = {x: 0, y: 0, z: 0, w: 1};

            if ($creatorModeSettings.type === CREATIONTYPES.placeholder) {
                creatorObject = tdEngine.addPlaceholder($creatorModeSettings.shape, position, orientation);
            } else if ($creatorModeSettings.type === CREATIONTYPES.model) {
                creatorObject = tdEngine.addModel(position, orientation, $creatorModeSettings.modelurl);
            } else if ($creatorModeSettings.type === CREATIONTYPES.scene) {
                creatorObject = tdEngine.addExperiencePlaceholder(position, orientation);
                tdEngine.addClickEvent(creatorObject,
                    () => experienceLoadHandler(creatorObject, position, orientation, $creatorModeSettings.sceneurl));
            } else {
                console.log('unknown creator type');
            }
        }

        for (let view of floorPose.views) {
            xrEngine.setViewportForView(view);

            if (experienceLoaded === true) {
                externalContent.contentWindow.postMessage(
                    tdEngine.getExternalCameraPose(view, experienceMatrix), '*');
            }
        }

        tdEngine.render(time, floorPose, floorPose.views[0]);
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
    function handleMarker(time, frame, floorPose, localPose, trackedImage) {
        handlePoseHeartbeat();

        firstPoseReceived = true;
        showFooter = false;

        xrEngine.setViewPort();

        if (trackedImage && trackedImage.trackingState === 'tracked') {
            if (!trackedImageObject) {
                trackedImageObject = tdEngine.addMarkerObject();
            }

            const position = localPose.transform.position;
            const orientation = localPose.transform.orientation;
            tdEngine.updateMarkerObjectPosition(trackedImageObject, position, orientation);
        }

        tdEngine.render(time, floorPose, floorPose.views[0]);
    }

    /**
     * Handles update loop when AR Cloud mode is used.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     */
    function handleOscp(time, frame, floorPose) {
        handlePoseHeartbeat();

        if (firstPoseReceived === false) {
            firstPoseReceived = true;

            if ($debug_showLocationAxis) {
                tdEngine.addAxes();
            }
        }

        // TODO: Handle multiple views and the localisation correctly
        for (let view of floorPose.views) {
            let viewport = xrEngine.setViewportForView(view);

            if (experienceLoaded === true) {
                externalContent.contentWindow.postMessage(
                    tdEngine.getExternalCameraPose(view, experienceMatrix), '*');
            }

            // Currently necessary to keep camera image capture alive.
            let cameraTexture = null;
            if (!isLocalized) {
                cameraTexture = xrEngine.getCameraTexture(frame, view);
            }

            if (doCaptureImage) {
                doCaptureImage = false;

                const image = xrEngine.getCameraImageFromTexture(cameraTexture, viewport.width, viewport.height);

                // Append captured camera image to body to verify if it was captured correctly
                if ($debug_appendCameraImage) {
                    const img = new Image();
                    img.src = image;
                    document.body.appendChild(img);
                }

                localize(image, viewport.width, viewport.height)
                    // When localisation didn't already provide content, needs to be requested here
                    .then(([geoPose, data]) => {
                        $recentLocalisation.geopose = geoPose;
                        $recentLocalisation.floorpose = floorPose.transform;

                        placeContent(floorPose, geoPose, data);
                    });
            }

            tdEngine.render(time, floorPose, view);
        }
    }

    /**
     * Does the actual localisation with the image shot before and the preselected GeoPose service.
     *
     * When request is successful, content reported from the content discovery server will be placed. When
     * request is unsuccessful, user is offered to localize again or use a marker image as an alternative.
     *
     * @param image  string     Camera image to use for localisation
     * @param width  Number     Width of the camera image
     * @param height  Number    Height of the camera image
     */
    function localize(image, width, height) {
        return new Promise((resolve, reject) => {
            const geoPoseRequest = new GeoPoseRequest(uuidv4())
                .addCameraData(IMAGEFORMAT.JPG, [width, height], image.split(',')[1], 0, new ImageOrientation(false, 0))
                .addLocationData($initialLocation.lat, $initialLocation.lon, 0, 0, 0, 0, 0);

            // Services haven't implemented recent changes to the protocol yet
            validateRequest(false);

            sendRequest(`${$availableContentServices[0].url}/${objectEndpoint}`, JSON.stringify(geoPoseRequest))
                .then(data => {
                    isLocalizing = false;
                    isLocalized = true;
                    wait(1000).then(() => showFooter = false);

                    if ('scrs' in data) {
                        resolve([data.geopose.pose, data.scrs]);
                    }
                })
                .catch(error => {
                    // TODO: Offer marker alternative
                    isLocalizing = false;
                    console.error(error);
                    reject(error);
                });
        });
    }

    /**
     *  Places the content provided by a call to a Spacial Content Discovery server.
     *
     * @param localPose XRPose      The pose of the device when localisation was started in local reference space
     * @param globalPose  GeoPose       The global GeoPose as returned from GeoPose service
     * @param scr  SCR Spatial      Content Record with the result from the server request
     */
    function placeContent(localPose, globalPose, scr) {

        console.log('Number of content items received: ', scr.length);

        scr.forEach(record => {
            // Augmented City special path for the GeoPose. Should be just 'record.content.geopose'
            const objectPose = record.content.geopose.pose;

            // Difficult to generalize, because there are no types defined yet.
            if (record.content.type === 'placeholder') {
                const position = calculateDistance(globalPose, objectPose);
                const orientation = calculateRotation(globalPose.quaternion, localPose.transform.orientation);

                // Augmented City proprietary structure
                if (record.content.custom_data.sticker_type.toLowerCase() === 'other') {
                    const subtype = record.content.custom_data.sticker_subtype.toLowerCase();
                    const url = record.content.custom_data.path;

                    // TODO: Receive list of events to register to from SCD and register them here

                    switch (subtype) {
                        case 'scene':
                            const experiencePlaceholder = tdEngine.addExperiencePlaceholder(position, orientation);
                            tdEngine.addClickEvent(experiencePlaceholder,
                                () => experienceLoadHandler(experiencePlaceholder, position, orientation, url));
                            break;
                        case 'gltf':
                            tdEngine.addModel(position, orientation, url)
                    }
                } else {
                    tdEngine.addPlaceholder(record.content.keywords, position, orientation);
                }

                // TODO: Anchor placeholder for better visual stability?!
            }
        })
    }

    /**
     * Handler to load and unload external experiences.
     *
     * @param placeholder  Model        The initial placeholder placed into the 3D scene
     * @param position  Position        The position the experience should be placed
     * @param orientation  Orientation      The orientation of the experience
     * @param url  String       The URL to load the experience from
     */
    function experienceLoadHandler(placeholder, position, orientation, url) {
        tdEngine.setWaiting(placeholder);

        externalContent.src = url;
        window.addEventListener('message', (event) => {
            if (event.data.type === 'loaded') {
                tdEngine.remove(placeholder);
                experienceLoaded = true;
                experienceMatrix = placeholder.matrix;

                closeExperience.addEventListener('click', () => {
                    experienceLoaded = false;
                    experienceMatrix = null;
                    externalContent.src = '';

                    const nextPlaceholder = tdEngine.addExperiencePlaceholder(position, orientation);
                    tdEngine.addClickEvent(nextPlaceholder,
                        () => experienceLoadHandler(nextPlaceholder, position, orientation, url));
                }, {once: true})
            }
        }, { once: true });
    }
</script>


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

        background: #FFFFFF 0 0 no-repeat padding-box;

        opacity: 0.7;
    }

    canvas, iframe {
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


<canvas id='application' bind:this={canvas}></canvas>

<aside bind:this={overlay} on:beforexrselect={(event) => event.preventDefault()}>
    <iframe class:hidden={!experienceLoaded} bind:this={externalContent} src=""></iframe>
    <img id="experienceclose" class:hidden={!experienceLoaded} alt="close button" src="/media/close-cross.svg"
         bind:this={closeExperience} />

    <!--  Space for UI elements  -->
    {#if showFooter}
        <footer>
            {#if $arMode === ARMODES.oscp}
                <ArCloudOverlay hasPose="{firstPoseReceived}" isLocalizing="{isLocalizing}" isLocalized="{isLocalized}"
                        on:startLocalisation={startLocalisation} />
            {:else if $arMode === ARMODES.marker}
                <ArMarkerOverlay />
            {:else if $arMode === ARMODES.creator}
                // TODO: Add creator mode ui
            {:else if $arMode === ARMODES.dev}
                // TODO: Add development mode ui
            {:else}
                <p>Somethings wrong...</p>
                <p>Apologies.</p>
            {/if}
        </footer>
    {/if}

    {#if hasLostTracking}
        <div id="trackinglostindicator"></div>
    {/if}
</aside>
