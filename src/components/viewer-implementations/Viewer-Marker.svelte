<!-- WARNING: this code is left behind from refactoring. do not use it -->

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

    import {sendRequest, validateRequest} from '@oarc/gpp-access';
    import GeoPoseRequest from '@oarc/gpp-access/request/GeoPoseRequest.js';
    import ImageOrientation from '@oarc/gpp-access/request/options/ImageOrientation.js';
    import {IMAGEFORMAT} from '@oarc/gpp-access/GppGlobals.js';

    import { getContentsAtLocation } from '@oarc/scd-access';

    import { handlePlaceholderDefinitions } from "@core/definitionHandlers";

    import { arMode, availableContentServices, creatorModeSettings, currentMarkerImage, currentMarkerImageWidth,
            debug_appendCameraImage, debug_showLocalAxes, experimentModeSettings, initialLocation, receivedScrs, recentLocalisation,
            selectedContentServices, selectedGeoPoseService, peerIdStr } from '@src/stateStore';

    import { ARMODES, CREATIONTYPES, debounce, wait } from "@core/common";
    import { fakeLocationResult, printOglTransform} from '@core/devTools';

    import ArCloudOverlay from "@components/dom-overlays/ArCloudOverlay.svelte";
    import ArMarkerOverlay from "@components/dom-overlays/ArMarkerOverlay.svelte";
    import ArExperimentOverlay from '@components/dom-overlays/ArExperimentOverlay.svelte';
    import {PRIMITIVES} from "@core/engines/ogl/modelTemplates";

    // TODO: this is specific to OGL engine, but we only need a generic object description structure
    import { createRandomObjectDescription } from '@core/engines/ogl/modelTemplates';


    const message = (msg) => console.log(msg);

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    let canvas, overlay, externalContent, closeExperience, experimentOverlay;
    let xrEngine, tdEngine;

    let doCaptureImage = false, doExperimentAutoPlacement;
    let showFooter = false, experienceLoaded = false, experienceMatrix = null;
    let firstPoseReceived = false, isLocalizing = false, isLocalized = false, isLocalisationDone = false, hasLostTracking = false;
    let unableToStartSession = false, experimentIntervallId = null;

    let trackedImageObject, creatorObject, reticle;
    let poseFoundHeartbeat = null;

    let receivedContentTitles = [];


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
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events) {
        // Viewer-Marker cannot handle any events currently    
        console.log('Viewer-Marker: Unknown event received:');
        console.log(events);
        // pass on to parent
        return parentInstance.onNetworkEvent(events);
    }


    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        let promise;

        if ($arMode === ARMODES.experiment) {
            promise = xrEngine.startExperimentSession(canvas, handleExperiment, {
                requiredFeatures: ['dom-overlay', 'camera-access', 'anchors', 'hit-test', 'local-floor'],
                domOverlay: {root: overlay}
            })

            tdEngine.setExperimentTapHandler(experimentTapHandler);
        } else if ($arMode === ARMODES.develop) {
            promise = xrEngine.startDevSession(canvas, handleDevelopment, {
                requiredFeatures: ['dom-overlay', 'anchors', 'local-floor'],
                domOverlay: {root: overlay}
            });
        } else if ($arMode === ARMODES.create) {
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
                    xrEngine.setCallbacks(onSessionEnded, onNoExperimentResult);
                    tdEngine.init();
                })
                .catch(error => {
                    unableToStartSession = true;
                    message("WebXR Immersive AR failed to start: " + error);
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

        if (experimentIntervallId) {
            clearInterval(experimentIntervallId);
            experimentIntervallId = null;
        }

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
     * Special mode for experiments.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame  XRFrame        The XRFrame provided to the update loop
     * @param floorPose  XRPose     The pose of the device as reported by the XRFrame
     * @param reticlePose  XRPose       The pose for the reticle
     * @param frameDuration  integer        The duration of the previous frame
     * @param passedMaxSlow  boolean        Max number of slow frames passed
     */
    function handleExperiment(time, frame, floorPose, reticlePose, frameDuration, passedMaxSlow) {
        if ($experimentModeSettings.game.localisation && !isLocalized) {
            handleOscp(time, frame, floorPose);
        } else {
            handlePoseHeartbeat();

            showFooter = $experimentModeSettings.game.showstats
                || ($experimentModeSettings.game.localisation && !isLocalisationDone);

            xrEngine.setViewPort();

            if (!reticle) {
                reticle = tdEngine.addReticle();
            }

            const position = reticlePose.transform.position;
            const orientation = reticlePose.transform.orientation;
            tdEngine.updateReticlePose(reticle, position, orientation);

            experimentOverlay?.setPerformanceValues(frameDuration, passedMaxSlow);

            tdEngine.render(time, floorPose.views[0]);
        }
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
    function onNoExperimentResult(time, frame, floorPose, frameDuration, passedMaxSlow) {
        experimentOverlay?.setPerformanceValues(frameDuration, passedMaxSlow);
        tdEngine.render(time, floorPose.views[0]);
    }

    /**
     * There might be the case that a tap handler for off object taps. This is the place to handle that.
     *
     * Not meant for other usage than that.
     *
     * @param event  Event      The Javascript event object
     * @param auto  boolean     true when called from automatic placement interval
     */
    function experimentTapHandler(event, auto = false) {

        if (!hasLostTracking && reticle && ($experimentModeSettings.game.add === 'manually' || auto)) {
            const index = Math.floor(Math.random() * 5);
            const shape = Object.values(PRIMITIVES)[index];

            const options = {attributes: {}};
            const isHorizontal = tdEngine.isHorizontal(reticle);

            let offsetY = 0, offsetZ = 0;
            let fragmentShader;

            switch (shape) {
                case PRIMITIVES.box:
                    if (isHorizontal) {
                        options.width = 0.3;
                        options.depth = 0.3;
                        options.height = 2;

                        offsetY = 1;
                    } else {
                        options.width = 2;
                        options.depth = 0.1;
                        options.height = 0.3;

                        offsetZ = -0.05;
                    }

                    fragmentShader = 'colorfulfragment';
                    break;

                case PRIMITIVES.plane:
                    if (isHorizontal) {
                        options.width = 0.5;
                        options.height = 1;
                    } else {
                        options.width = 2;
                        options.height = 1;
                    }

                    fragmentShader = 'dotfragment';
                    break;

                case PRIMITIVES.sphere:
                    options.thetaLength = Math.PI / 2;
                    fragmentShader = 'columnfragment';
                    break;

                case PRIMITIVES.cylinder:
                    if (isHorizontal) {
                        options.radiusTop = 0.3;
                        options.radiusBottom = 0.3;
                        options.height = 2;

                        offsetY = 1;
                    } else {
                        options.radiusTop = 0.5;
                        options.radiusBottom = 0.5;
                        options.height = 0.1;

                        offsetZ = -0.05;
                    }

                    fragmentShader = 'barberfragment';
                    break;

                case PRIMITIVES.cone:
                    options.radiusBottom = 0.3;
                    options.height = 0.5;

                    offsetY = 0.25;
                    offsetZ = -0.25;

                    fragmentShader = 'voronoifragment';
                    break;
            }

            const scale = 1;
            const placeholder = tdEngine.addPlaceholderWithOptions(shape,
                reticle.position, reticle.quaternion, fragmentShader, options);
            placeholder.scale.set(scale);
            placeholder.position.y += offsetY * scale;
            placeholder.position.z += offsetZ * scale;
            experimentOverlay.objectPlaced();

        }
    }

    /**
     * Toggle automatic placement of placeholders for experiment mode.
     */
    function toggleExperimentalPlacement() {
        doExperimentAutoPlacement = !doExperimentAutoPlacement;

        if (doExperimentAutoPlacement) {
            experimentIntervallId = setInterval(() => experimentTapHandler(null, true), 1000);
        } else {
            clearInterval(experimentIntervallId);
        }
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

            // TODO: Fails for some reason
            // xrEngine.createRootAnchor(frame, tdEngine.getRootSceneUpdater());

            if ($debug_showLocalAxes) {
                tdEngine.addAxes();
            }

            for (let view of floorPose.views) {
                xrEngine.setViewportForView(view);

                console.log('fake localisation');

                isLocalized = true;
                wait(1000).then(showFooter = false);

                let geoPose = fakeLocationResult.geopose.pose;
                let data = fakeLocationResult.scrs;
                placeContent(floorPose, geoPose, [data]);
            }
        }

        if (experienceLoaded === true) {
            externalContent.contentWindow.postMessage(
                tdEngine.getExternalCameraPose(floorPose.views[0], experienceMatrix), '*');
        }

        xrEngine.handleAnchors(frame);
        tdEngine.render(time, floorPose.views[0]);
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

            // TODO: Fails for some reason
            // xrEngine.createRootAnchor(frame, tdEngine.getRootSceneUpdater());

            if ($debug_showLocalAxes) {
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

        tdEngine.render(time, floorPose.views[0]);
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

            if ($debug_showLocalAxes) {
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
                //cameraTexture = xrEngine.getCameraTexture(frame, view); // old Chrome 91
                cameraTexture = xrEngine.getCameraTexture2(view); // new Chrome 92
            }

            if (doCaptureImage) {
                doCaptureImage = false;

                //const imageWidth = viewport.width; // old Chrome 91
                //const imageHeight = viewport.height; // old Chrome 91
                const imageWidth = view.camera.width; // new Chrome 92
                const imageHeight = view.camera.height; // new Chrome 92

                const image = xrEngine.getCameraImageFromTexture(cameraTexture, imageWidth, imageHeight);

                // Append captured camera image to body to verify if it was captured correctly
                if ($debug_appendCameraImage) {
                    const img = new Image();
                    img.src = image;
                    document.body.appendChild(img);
                }

                localize(image, imageWidth, imageHeight)
                    .then(([geoPose, optionalScrs]) => {
                        // Save the local pose and the global pose of the image for alignment in a later step
                        $recentLocalisation.geopose = geoPose;
                        $recentLocalisation.floorpose = floorPose;

                        // There are GeoPose services (ex. Augmented City) that also return content (an array of SCRs) in the localization response.
                        // We could return those as [optionalScrs], however, this means all other content services are ignored...
                        if (optionalScrs) {
                            return [optionalScrs];
                        } else {
                            return getContent();
                        }
                    })
                    .then(scrs => {
                        // NOTE: the next step expects an array of array of SCRs in the scrs variable
                        console.log("Received " + scrs.length + " SCRs");
                        placeContent($recentLocalisation.floorpose, $recentLocalisation.geopose, scrs);
                    })
            }

            tdEngine.render(time, view);
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
            //TODO: check ImageOrientation!
            const geoPoseRequest = new GeoPoseRequest(uuidv4())
                .addCameraData(IMAGEFORMAT.JPG, [width, height], image.split(',')[1], 0, new ImageOrientation(false, 0))
                .addLocationData($initialLocation.lat, $initialLocation.lon, 0, 0, 0, 0, 0);

            // Services haven't implemented recent changes to the protocol yet
            validateRequest(false);

            sendRequest($selectedGeoPoseService.url, JSON.stringify(geoPoseRequest))
                .then(data => {
                    isLocalizing = false;
                    isLocalized = true;
                    wait(4000).then(() => {
                        showFooter = false;
                        isLocalisationDone = true;
                    });

                    // TODO: data.pose from AugmentedCity is deprecated
                    resolve([data.geopose || data.pose, data.scrs]);
                })
                .catch(error => {
                    // TODO: Inform user
                    isLocalizing = false;
                    console.error(error);
                    reject(error);
                });
        });
    }

    /**
     * Show ui for localisation again.
     */
    function relocalize() {
        isLocalized = false;
        isLocalisationDone = false;
        receivedContentTitles = [];

        tdEngine.clearScene();
        reticle = null; // TODO: we should store the reticle inside tdEngine to avoid the need for explicit deletion here.

        showFooter = true;
    }

    /**
     * Request content from SCD available around the current location.
     */
    function getContent() {
        const servicePromises = $availableContentServices.reduce((result, service) => {
            if ($selectedContentServices[service.id]?.isSelected) {
                result.push(getContentsAtLocation(service.url, 'history', $initialLocation.h3Index));
            }

            return result
        }, [])

        return Promise.all(servicePromises);
    }

    /**
     *  Places the content provided by a call to Spacial Content Discovery providers.
     *
     * @param localPose XRPose      The pose of the device when localisation was started in local reference space
     * @param globalPose  GeoPose       The global GeoPose as returned from GeoPose service
     * @param scr  [SCR]        Content Records with the result from the selected content services
     */
    function placeContent(localPose, globalPose, scr) {
        let localImagePose = localPose.transform
        let globalImagePose = globalPose

        tdEngine.beginSpatialContentRecords(localImagePose, globalImagePose)

        scr.forEach(response => {
            console.log('Number of content items received: ', response.length);

            response.forEach(record => {
                $receivedScrs.push(record);
                receivedContentTitles.push(record.content.title);

                // TODO: this method could handle any type of content:
                //tdEngine.addSpatialContentRecord(globalObjectPose, record.content)

                // Difficult to generalize, because there are no types defined yet.
                if (record.content.type === 'placeholder') {

                    let globalObjectPose = record.content.geopose;
                    let localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);
                    let position = localObjectPose.position;
                    let orientation = localObjectPose.quaternion;

                    // Augmented City proprietary structure
                    //if (record.content.custom_data?.sticker_type.toLowerCase() === 'other') { // sticker_type was removed in Nov.2021
                    if (record.content.custom_data?.sticker_subtype != undefined) {
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
                                tdEngine.addModel(position, orientation, url);
                                break;
                            default:
                                console.log("Error: unexpected sticker subtype: " + subtype);
                                break;
                        }
                    } else {
                        const placeholder = tdEngine.addPlaceholder(record.content.keywords, position, orientation);
                        handlePlaceholderDefinitions(tdEngine, placeholder, /* record.content.definition */);
                    }
                }

                //wait(1000).then(() => receivedContentTitles = []); // clear the list after a timer

                // TODO: Anchor placeholder for better visual stability?!
            })
        })

        tdEngine.endSpatialContentRecords();
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
            {#if unableToStartSession}
                <h4>Couldn't start AR</h4>
                <p>
                    sparcl needs some <a href="https://openarcloud.github.io/sparcl/guides/incubationflag.html">
                    experimental flags</a> to be enabled.
                </p>
            {:else if $arMode === ARMODES.oscp}
                <ArCloudOverlay hasPose="{firstPoseReceived}" isLocalizing="{isLocalizing}" isLocalized="{isLocalized}"
                        on:startLocalisation={startLocalisation} />
            {:else if $arMode === ARMODES.marker}
                <ArMarkerOverlay />
            {:else if $arMode === ARMODES.create}
                <!-- TODO: Add creator mode ui -->
            {:else if $arMode === ARMODES.develop}
                <!--TODO: Add development mode ui -->
            {:else if $arMode === ARMODES.experiment}
                {#if $experimentModeSettings.game.localisation && !isLocalisationDone}
                    <ArCloudOverlay
                        hasPose="{firstPoseReceived}"
                        isLocalizing="{isLocalizing}"
                        isLocalized="{isLocalized}"
                        receivedContentTitles="{receivedContentTitles}"
                        on:startLocalisation={startLocalisation}
                    />
                {:else}
                    <ArExperimentOverlay
                        bind:this={experimentOverlay}
                        on:toggleAutoPlacement={toggleExperimentalPlacement}
                        on:relocalize={relocalize}
                    />
                {/if}
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
