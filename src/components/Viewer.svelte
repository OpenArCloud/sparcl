<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Initializes and runs the AR session. Configuration will be according the data provided by the parent.
-->
<script>
    import { createEventDispatcher, onDestroy, getContext } from 'svelte';

    import { v4 as uuidv4 } from 'uuid';

    import { sendRequest, validateRequest } from 'gpp-access';
    import GeoPoseRequest from 'gpp-access/request/GeoPoseRequest.js';
    import ImageOrientation from 'gpp-access/request/options/ImageOrientation.js';
    import { IMAGEFORMAT } from 'gpp-access/GppGlobals.js';

    import { getContentAtLocation } from 'scd-access';

    import { handlePlaceholderDefinitions } from "@core/definitionHandlers";

    import { arMode, availableContentServices, debug_appendCameraImage, debug_showLocalAxes,
        initialLocation, recentLocalisation, selectedContentServices, selectedGeoPoseService } from '@src/stateStore';

    import { ARMODES, wait } from "@core/common";
    import { printOglTransform } from '@core/devTools';

    import ArMarkerOverlay from "@components/dom-overlays/ArMarkerOverlay.svelte";

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    export let settings;


    const message = (msg) => console.log(msg);

    let canvas, overlay, externalContent, closeExperience;
    let xrEngine, tdEngine;

    let doCaptureImage = false;
    let showFooter = false, experienceLoaded = false, experienceMatrix = null;
    let firstPoseReceived = false, isLocalizing = false, isLocalized = false, isLocalisationDone = false, hasLostTracking = false;
    let unableToStartSession = false;

    let receivedContentNames = [];


    // TODO: Setup event target array, based on info received from SCD

    const context = getContext('state');
    $context = {
        showFooter, isLocalized, isLocalizing, isLocalisationDone,
    }

    onDestroy(() => {
        tdEngine.stop();
    })

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     */
    export function startAr(thisWebxr, this3dEngine, options) {
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;

        // give the component some time to set up itself
        wait(1000).then(() => showFooter = true);
    }

    /**
     * Receives data from the application to be applied to current scene.
     */
    export function updateReceived(events) {
        // NOTE: sometimes multiple events are bundled!
        console.log('Viewer event received:');
        console.log(events);

        if ('message_broadcasted' in events) {
            let data = events.message_broadcasted;
//            if (data.sender != $peerIdStr) { // ignore own messages which are also delivered
                if ('message' in data && 'sender' in data) {
                    console.log("message from " + data.sender + ": \n  " + data.message);
                }
//            }
        }

        if ('object_created' in events) {
            let data = events.object_created;
//            if (data.sender != $peerIdStr) { // ignore own messages which are also delivered
                data = data.scr;
                if ('tenant' in data && data.tenant == 'ISMAR2021demo') {
                    // experimentOverlay?.objectReceived();
                    let latestGlobalPose = $recentLocalisation.geopose;
                    let latestLocalPose = $recentLocalisation.floorpose;
                    placeContent(latestLocalPose, latestGlobalPose, [[data]]); // WARNING: wrap into an array
                }
//            }
        }

        // TODO: Receive list of events to fire from SCD
        if ('setrotation' in events) {
            //let data = events.setrotation;
            // todo app.fire('setrotation', data);
        }

        if ('setcolor' in events) {
            //let data = events.setcolor;
            // todo app.fire('setcolor', data);
        }
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
                                 setup, requiredFeatures = [], optionalFeatures = []) {
        const options = {
            requiredFeatures: requiredFeatures,
            optionalFeatures: optionalFeatures,
        }

        if (requiredFeatures.includes('dom-overlay') || optionalFeatures.includes('dom-overlay')) {
            options.domOverlay = {root: overlay};
        }

        xrEngine.startSession(canvas, updateCallback, options, setup)
            .then(() => {
                xrEngine.setCallbacks(endedCallback, noPoseCallback);
                tdEngine.init();
            })
            .catch(error => {
                unableToStartSession = true;
                message("WebXR Immersive AR failed to start: " + error);
            });
    }

    /**
     * Let's the app know that the XRSession was closed.
     */
    export function onSessionEnded() {
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
                    .then(([geoPose, scr]) => {
                        $recentLocalisation.geopose = geoPose;
                        $recentLocalisation.floorpose = floorPose;

                        // There are GeoPose services that return directly content
                        // TODO: Request content even when there is already content provided from GeoPose call. Not sure how...
                        if (scr) {
                            return [scr];
                        } else {
                            return getContent();
                        }
                    })
                    .then(scrs => {
                        placeContent($recentLocalisation.floorpose, $recentLocalisation.geopose, scrs);
                    })
            }

            tdEngine.render(time, view);
        }
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
    export function relocalize() {
        isLocalized = false;
        isLocalisationDone = false;
        receivedContentNames = [];

        tdEngine.clearScene();

        showFooter = true;
    }

    /**
     * Request content from SCD available around the current location.
     */
    export function getContent() {
        const servicePromises = $availableContentServices.reduce((result, service) => {
            if ($selectedContentServices[service.id]?.isSelected) {
                result.push(getContentAtLocation(service.url, 'history', $initialLocation.h3Index));
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
    export function placeContent(localPose, globalPose, scr) {
        let localImagePose = localPose.transform
        let globalImagePose = globalPose

        tdEngine.beginSpatialContentRecords(localImagePose, globalImagePose)

        receivedContentNames = ["New objects(s): "];
        scr.forEach(response => {
            console.log('Number of content items received: ', response.length);

            response.forEach(record => {
                receivedContentNames.push(record.content.title);

                // TODO: this method could handle any type of content:
                //tdEngine.addSpatialContentRecord(globalObjectPose, record.content)

                // Difficult to generalize, because there are no types defined yet.
                if (record.content.type === 'placeholder') {

                    let globalObjectPose = record.content.geopose;
                    let localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);
                    let position = localObjectPose.position;
                    let orientation = localObjectPose.quaternion;

                    // Augmented City proprietary structure
                    if (record.content.custom_data?.sticker_type.toLowerCase() === 'other') {
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
                        const placeholder = tdEngine.addPlaceholder(record.content.keywords, position, orientation);
                        handlePlaceholderDefinitions(tdEngine, placeholder, /* record.content.definition */);
                    }
                }

                if (record.tenant === 'ISMAR2021demo') {
                    console.log("ISMAR2021demo object received!")
                    let object_description = record.content.object_description;
                    let globalObjectPose = record.content.geopose;
                    let localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);
                    printOglTransform("localObjectPose", localObjectPose);
                    tdEngine.addObject(localObjectPose.position, localObjectPose.quaternion, object_description);
                }

                //wait(1000).then(() => receivedContentNames = []); // clear the list after a timer

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
            {:else if Object.values(ARMODES).includes($arMode)}
                <slot name="overlay" {isLocalisationDone} {receivedContentNames} />
            {:else if $arMode === ARMODES.marker}
                <ArMarkerOverlay />
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
