<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Initializes and runs the AR session. Configuration will be according the data provided by the parent.
-->
<script>
    import {createEventDispatcher, getContext, onDestroy} from 'svelte';
    import {writable} from 'svelte/store';

    import {v4 as uuidv4} from 'uuid';

    import {sendRequest, validateRequest} from '@oarc/gpp-access';
    import GeoPoseRequest from '@oarc/gpp-access/request/GeoPoseRequest.js';
    import ImageOrientation from '@oarc/gpp-access/request/options/ImageOrientation.js';
    import {IMAGEFORMAT} from '@oarc/gpp-access/GppGlobals.js';

    import {getContentsAtLocation} from '@oarc/scd-access';

    import {handlePlaceholderDefinitions} from "@core/definitionHandlers";

    import {arMode, availableContentServices, debug_appendCameraImage, debug_showLocalAxes, debug_useGeolocationSensors,
        initialLocation, receivedScrs, recentLocalisation, selectedContentServices, selectedGeoPoseService} from '@src/stateStore';

    import {ARMODES, wait} from "@core/common";
    import {printOglTransform} from '@core/devTools';
    import {upgradeGeoPoseStandard} from '@core/locationTools';
    import {getSensorEstimatedGeoPose, lockScreenOrientation, startOrientationSensor,
         stopOrientationSensor, unlockScreenOrientation} from "@core/sensors";

    import ArMarkerOverlay from "@components/dom-overlays/ArMarkerOverlay.svelte";


    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    const message = (msg) => console.log(msg);

    let canvas, overlay, externalContent, closeExperience;
    let xrEngine, tdEngine;

    let doCaptureImage = false;
    let experienceLoaded = false, experienceMatrix = null;
    let firstPoseReceived = false, hasLostTracking = false;
    let unableToStartSession = false;

    // TODO: Setup event target array, based on info received from SCD

    const context = getContext('state') || writable();
    $context = {
        showFooter: false,
        isLocalized: false,
        isLocalizing: false,      // while waiting for GeoPose service localization
        isLocalisationDone: false, // whether to show the dom-overlay with 'localize' button
        receivedContentTitles: []
    }

    onDestroy(() => {
        tdEngine.stop();
    })

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     * @param options  {*}       Options provided from caller. Currently settings for experiment mode
     */
    export function startAr(thisWebxr, this3dEngine, options) {
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;

        // give the component some time to set up itself
        wait(1000).then(() => $context.showFooter = true);
    }

    /**
     * Setup required AR features and start the XRSession.
     *
     * @param updateCallback  function      Will be called from animation loop
     * @param endedCallback  function       Will be called when AR session ends
     * @param noPoseCallback  function      Will be called when no pose was found
     * @param setup  function       Specific setup for AR mode or experiment
     * @param requiredFeatures  Array       Required features for the AR session
     * @param optionalFeatures  Array       Optional features for the AR session
     */
    export function startSession(updateCallback, endedCallback, noPoseCallback,
                                 setup = () => {}, requiredFeatures = [], optionalFeatures = []) {
        const options = {
            requiredFeatures: requiredFeatures,
            optionalFeatures: optionalFeatures,
        }

        if (requiredFeatures.includes('dom-overlay') || optionalFeatures.includes('dom-overlay')) {
            options.domOverlay = {root: overlay};
        }

        let promise = xrEngine.startSession(canvas, updateCallback, options, setup);

        // NOTE: screen orientation cannot be changed between user click and WebXR startSession,
        // and it cannot be changed after the XR Session started, so the only place to change it is here
        if ($debug_useGeolocationSensors) {
            lockScreenOrientation('landscape-primary');
            startOrientationSensor();
        }

        promise.then(() => {
                xrEngine.setCallbacks(endedCallback, noPoseCallback);
                tdEngine.init();
            })
            .catch(error => {
                unableToStartSession = true;
                message("WebXR Immersive AR failed to start: " + error);
            });
    }

    /**
     * Handles update loop when AR Cloud mode is used.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     */
    export function update(time, frame, floorPose) {
        if (firstPoseReceived === false) {
            firstPoseReceived = true;

            if ($debug_showLocalAxes) {
                tdEngine.addAxes();
            }
        }

        // TODO: Handle multiple views and the localisation correctly
        for (let view of floorPose.views) {
            let viewport = xrEngine.setViewportForView(view);

            handleExternalExperience(view);

            // Currently necessary to keep camera image capture alive.
            let cameraTexture = null;
            if (!$context.isLocalized) {
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
                        //if (optionalScrs) {
                        //    return [optionalScrs];
                        //}
                        
                        // Instead of returning [optionalScrs], we request content from all available content services
                        // (which means the AC service must be registered both as geopose as well as content-discovery service in the SSD)
                        let scrsPromises = getContentsInH3Cell();
                        return scrsPromises;
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
     * Let's the app know that the XRSession was closed.
     */
    export function onSessionEnded() {
        firstPoseReceived = false;

        if ($debug_useGeolocationSensors) {
            stopOrientationSensor();
            unlockScreenOrientation();
        }

        dispatch('arSessionEnded');
    }

    /**
     * Called when no pose was reported from WebXR.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame  XRFrame        The XRFrame provided to the update loop
     * @param floorPose  XRPose     The pose of the device as reported by the XRFrame
     */
    export function onNoPose(time, frame, floorPose) {
        hasLostTracking = true;
        tdEngine.render(time, floorPose.views[0]);
    }

    /**
     * Trigger localisation of the device globally using a GeoPose service.
     */
    export function startLocalisation() {
        doCaptureImage = true;
        $context.isLocalizing = true;
    }

    /**
     * Send the required information to an external experience, to allow it to stay in sync with the local one.
     *
     * @param view  XRView      The view to use
     */
    export function handleExternalExperience(view) {
        if (experienceLoaded === true) {
            externalContent.contentWindow.postMessage(
                tdEngine.getExternalCameraPose(view, experienceMatrix), '*');
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
    export function localize(image, width, height) {
        return new Promise((resolve, reject) => {
            if ($selectedGeoPoseService === undefined || $selectedGeoPoseService === null) {
                console.warn("There is no available GeoPose service. Trying to use the on-board sensors instead.")
            }

            if ($debug_useGeolocationSensors) {
                getSensorEstimatedGeoPose()
                    .then(selfEstimatedGeoPose => {
                        $context.isLocalizing = false;
                        $context.isLocalized = true; 
                        // allow relocalization after a few seconds
                        wait(4000).then(() => {
                            $context.showFooter = false;
                            $context.isLocalisationDone = true;
                        });
                        console.log("SENSOR GeoPose:");
                        console.log(selfEstimatedGeoPose);
                        resolve([selfEstimatedGeoPose]);
                    });
                return;
            }

            //TODO: check ImageOrientation!
            const geoPoseRequest = new GeoPoseRequest(uuidv4())
                .addCameraData(IMAGEFORMAT.JPG, [width, height], image.split(',')[1], 0, new ImageOrientation(false, 0))
                .addLocationData($initialLocation.lat, $initialLocation.lon, 0, 0, 0, 0, 0);

            // Services haven't implemented recent changes to the protocol yet
            validateRequest(false);

            sendRequest($selectedGeoPoseService.url, JSON.stringify(geoPoseRequest))
                .then(data => {
                    $context.isLocalizing = false;
                    $context.isLocalized = true;
                    wait(4000).then(() => {
                        $context.showFooter = false;
                        $context.isLocalisationDone = true;
                    });
                    console.log("GPP response:");
                    console.log(data);

                    // GeoPoseResp
                    // https://github.com/OpenArCloud/oscp-geopose-protocol
                    let cameraGeoPose = null
                    if (data.geopose != undefined && data.scrs != undefined && data.geopose.geopose != undefined) {
                        // data is AugmentedCity format which contains other entries too
                        // (for example AC /scrs/geopose_objs_local endpoint)
                        cameraGeoPose = data.geopose.geopose;
                    } else if (data.geopose != undefined) {
                        // data is GeoPoseResp
                        // (for example AC /scrs/geopose endpoint)
                        cameraGeoPose = data.geopose;
                    } else {
                        errorMessage = "GPP response has no geopose field";
                        console.log(errorMessage);
                        throw errorMessage;
                    }

                    console.log("IMAGE GeoPose:");
                    console.log(cameraGeoPose);

                    // NOTE: AugmentedCity also returns neighboring objects in the GPP response
                    let optionalScrs = undefined;
                    if (data.scrs != undefined) {
                        optionalScrs = data.scrs;
                        console.log("GPP response also contains " + optionalScrs.length + " SCRs.");
                    }

                    resolve([cameraGeoPose, optionalScrs]);
                })
                .catch(error => {
                    // TODO: Inform user
                    $context.isLocalizing = false;
                    console.error("Could not localize. Error: " + error);
                    reject(error);
                });
        });
    }

    /**
     * Show ui for localisation again.
     */
    export function relocalize() {
        $context.isLocalized = false;
        $context.isLocalisationDone = false;
        $receivedScrs = [];
        $context.receivedContentTitles = [];

        tdEngine.clearScene();

        $context.showFooter = true;
    }

    /**
     * Request content from SCD available around the current location.
     */
    export function getContentsInH3Cell() {
        const servicePromises = $availableContentServices.reduce((result, service) => {
            if ($selectedContentServices[service.id]?.isSelected) {
                // TODO: H3 cell ID and topic should be be customizable
                let scrs_ = getContentsAtLocation(service.url, 'history', $initialLocation.h3Index)
                result.push(scrs_);
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
     * @param scrs  [[SCR]]      Content Records with the result from the selected content services (array of array of SCRs. One array of SCRs by content provider)
     */
    export function placeContent(localPose, globalPose, scrs) {
        let localImagePose = localPose.transform
        let globalImagePose = globalPose

        tdEngine.beginSpatialContentRecords(localImagePose, globalImagePose)

        scrs.forEach(response => {
            console.log('Number of content items received: ', response.length);

            response.forEach(record => {
                // TODO: validate here whether we received a proper SCR

                // HACK: we fix up the geopose entries of records that still use the old GeoPose standard
                record.content.geopose = upgradeGeoPoseStandard(record.content.geopose);

                // TODO: we can check here whether we have received this content already and break if yes.
                // TODO: first save the records and then start to instantiate the objects

                $receivedScrs.push(record);
                $context.receivedContentTitles.push(record.content.title);

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
                    } else if (record.content.refs != undefined && record.content.refs.length > 0) { 
                        // Orbit custom data type
                        // TODO load all, not only first reference
                        const contentType = record.content.refs[0].contentType;
                        const url = record.content.refs[0].url;
                        if (contentType.includes("gltf")) {
                            tdEngine.addModel(position, orientation, url);
                        } else {
                            const placeholder = tdEngine.addPlaceholder(record.content.keywords, position, orientation);
                            handlePlaceholderDefinitions(tdEngine, placeholder, /* record.content.definition */);
                        }
                    } else {
                        const placeholder = tdEngine.addPlaceholder(record.content.keywords, position, orientation);
                        handlePlaceholderDefinitions(tdEngine, placeholder, /* record.content.definition */);
                    }
                } else {
                    console.log(record.content.title + " has unexpected content type: " + record.content.type);
                }

                if (record.tenant === 'ISMAR2021demo') {
                    console.log("ISMAR2021demo object received!")
                    let object_description = record.content.object_description;
                    let globalObjectPose = record.content.geopose;
                    let localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);
                    //printOglTransform("localObjectPose", localObjectPose);
                    tdEngine.addObject(localObjectPose.position, localObjectPose.quaternion, object_description);
                }

            })
        })

        // DEBUG
        console.log("Received contents: ");
        $receivedScrs.forEach(record => {
            console.log("  " + record.content.title);
        });

        tdEngine.endSpatialContentRecords();

        wait(3000).then(() => $context.receivedContentTitles = []); // clear the list after a timer
    }

    /**
     * Handler to load and unload external experiences.
     *
     * @param placeholder  Model        The initial placeholder placed into the 3D scene
     * @param position  Position        The position the experience should be placed
     * @param orientation  Orientation      The orientation of the experience
     * @param url  String       The URL to load the experience from
     */
    export function experienceLoadHandler(placeholder, position, orientation, url) {
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

    // TODO: rename to onEventReceived()
    /**
     * Receives data from the application to be applied to current scene.
     */
    export function updateReceived(events) {
        // NOTE: sometimes multiple events are bundled!
        console.log('Viewer event received:');
        console.log(events);
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

    <!--  Space for UI elements -->
    {#if $context.showFooter || true}  <!-- always show footer now for demo purposes -->
        <footer>
            {#if unableToStartSession}
                <h4>Couldn't start AR</h4>
                <p>
                    sparcl needs some <a href="https://openarcloud.github.io/sparcl/help/incubationflag.html">
                    experimental flags</a> to be enabled.
                </p>
            {:else if Object.values(ARMODES).includes($arMode)}
                <slot name="overlay"
                    {firstPoseReceived}
                    isLocalized={$context.isLocalized}
                    isLocalisationDone={$context.isLocalisationDone}
                    isLocalizing={$context.isLocalizing}
                    receivedContentTitles={$context.receivedContentTitles}
                />
            {:else if $arMode === ARMODES.marker}
                <ArMarkerOverlay/>
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
