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
    import { createEventDispatcher, getContext, onDestroy } from 'svelte';
    import { writable, type Writable } from 'svelte/store';
    import { type OldFormatGeopose, type Orientation, type Position, type SetupFunction, type XrFeatures, type XrFrameUpdateCallbackType, type XrNoPoseCallbackType } from '../types/xr';

    import { v4 as uuidv4 } from 'uuid';

    import { sendRequest, validateRequest, type GeoposeResponseType } from '@oarc/gpp-access';
    import { GeoPoseRequest } from '@oarc/gpp-access';
    import { ImageOrientation } from '@oarc/gpp-access';
    import { CameraParam, CAMERAMODEL } from '@oarc/gpp-access';
    import { IMAGEFORMAT } from '@oarc/gpp-access';

    import { getContentsAtLocation, type Geopose, type SCR } from '@oarc/scd-access';

    import { handlePlaceholderDefinitions } from '@core/definitionHandlers';

    import {
        arMode,
        availableContentServices,
        debug_showLocalAxes,
        debug_useGeolocationSensors,
        debug_saveCameraImage,
        debug_loadCameraImage,
        debug_enablePointCloudContents,
        initialLocation,
        receivedScrs,
        recentLocalisation,
        selectedContentServices,
        selectedGeoPoseService,
    } from '@src/stateStore';

    import { ARMODES, wait } from '@core/common';
    import { loadImageBase64, saveImageBase64, saveText } from '@core/devTools';
    import { upgradeGeoPoseStandard } from '@core/locationTools';
    import { getSensorEstimatedGeoPose, lockScreenOrientation, startOrientationSensor, stopOrientationSensor, unlockScreenOrientation } from '@core/sensors';

    import ArMarkerOverlay from '@components/dom-overlays/ArMarkerOverlay.svelte';
    import type webxr from '../core/engines/webxr';
    import type ogl from '../core/engines/ogl/ogl';
    import type { Mat4, Mesh, Quat, Vec3 } from 'ogl';

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher<{ arSessionEnded: undefined }>();

    const message = (msg: string) => console.log(msg);

    let canvas: HTMLCanvasElement;
    let overlay: HTMLElement;
    let externalContent: HTMLIFrameElement;
    let closeExperience: HTMLImageElement;
    let xrEngine: webxr;
    let tdEngine: ogl;

    let doCaptureImage = false;
    let experienceLoaded = false;
    let experienceMatrix: Mat4 | null = null;
    let firstPoseReceived = false,
        hasLostTracking = false; // TODO: init true, set to false in onXrFrameUpdate(), move into context.
    let unableToStartSession = false;

    // TODO: Setup event target array, based on info received from SCD

    const context: Writable<{ showFooter: boolean; isLocalized: boolean; isLocalizing: boolean; isLocalisationDone: boolean; receivedContentTitles: any[] }> = getContext('state') || writable();
    context.set({
        showFooter: false,
        isLocalized: false,
        isLocalizing: false, // while waiting for GeoPose service localization
        isLocalisationDone: false, // whether to show the dom-overlay with 'localize' button
        receivedContentTitles: [],
    });

    onDestroy(() => {
        tdEngine.stop();
    });

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
        wait(1000).then(() => ($context.showFooter = true));
    }

    /**
     * Setup required AR features and start the XRSession.
     *
     * @param xrFrameUpdateCallback  function      Will be called from animation loop
     * @param xrSessionEndedCallback  function     Will be called when AR session ends
     * @param xrNoPoseCallback  function           Will be called when no pose was found
     * @param setup  function               Specific setup for AR mode or experiment
     * @param requiredFeatures  Array       Required features for the AR session
     * @param optionalFeatures  Array       Optional features for the AR session
     */
    export async function startSession(
        xrFrameUpdateCallback: XrFrameUpdateCallbackType,
        xrSessionEndedCallback: () => void,
        xrNoPoseCallback: XrNoPoseCallbackType,
        setup: SetupFunction = () => {},
        requiredFeatures: XrFeatures[] = [],
        optionalFeatures: XrFeatures[] = [],
    ) {
        const options: { requiredFeatures: XrFeatures[]; optionalFeatures: XrFeatures[]; domOverlay?: { root: HTMLElement } } = {
            requiredFeatures: requiredFeatures,
            optionalFeatures: optionalFeatures,
        };

        if (requiredFeatures.includes('dom-overlay') || optionalFeatures.includes('dom-overlay')) {
            options.domOverlay = { root: overlay };
        }

        let promise = xrEngine.startSession(canvas, xrFrameUpdateCallback, options, setup);

        // NOTE: screen orientation cannot be changed between user click and WebXR startSession,
        // and it cannot be changed after the XR Session started, so the only place to change it is here
        if ($debug_useGeolocationSensors) {
            lockScreenOrientation('landscape-primary');
            startOrientationSensor();
        }

        if (promise) {
            promise
                .then(() => {
                    xrEngine.setCallbacks(xrSessionEndedCallback, xrNoPoseCallback);
                    tdEngine.init();
                })
                .catch((error) => {
                    unableToStartSession = true;
                    message('WebXR Immersive AR failed to start: ' + error);
                });
        }
    }

    /**
     * Handles update loop when AR Cloud mode is used.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     */
    export function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose) {
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
            let cameraTexture: WebGLTexture | undefined | null | undefined = null;
            let cameraIntrinsics: { fx: number; fy: number; cx: number; cy: number; s: number } | null | undefined = null;
            let cameraViewport: { width: number; height: number; x: number; y: number } | null | undefined = null;
            if (!$context.isLocalized) {
                //cameraTexture = xrEngine.getCameraTexture(frame, view); // old Chrome 91
                const res = xrEngine.getCameraTexture2(view); // new Chrome 92
                cameraTexture = res?.cameraTexture;
                cameraIntrinsics = res?.cameraIntrinsics;
                cameraViewport = res?.cameraViewport;
            }

            if (doCaptureImage) {
                doCaptureImage = false;

                //const imageWidth = viewport.width; // old Chrome 91
                //const imageHeight = viewport.height; // old Chrome 91
                //const imageWidth = view.camera.width; // new Chrome 92
                //const imageHeight = view.camera.height; // new Chrome 92
                const imageWidth = cameraViewport?.width;
                const imageHeight = cameraViewport?.height;

                let image: Promise<string> | null = null; // base64 encoded
                if ($debug_loadCameraImage) {
                    // This is only for development while running your own Sparcl server.
                    // TODO: intrinsics could be also loaded separately
                    const debug_CameraImageUrl = '/photos/your_photo.jpg'; // place the photo into the public/photos subfolder
                    image = loadImageBase64(debug_CameraImageUrl);
                } else if (cameraTexture && imageWidth && imageHeight) {
                    image = Promise.resolve(xrEngine.getCameraImageFromTexture(cameraTexture, imageWidth, imageHeight));
                }

                // Save image and append captured camera image to body to verify if it was captured correctly
                if ($debug_saveCameraImage) {
                    const docImage = new Image();
                    if (image) {
                        image.then((img) => {
                            docImage.src = img;
                            document.body.appendChild(docImage);
                            saveImageBase64(img, 'your_photo');
                            saveText(JSON.stringify(cameraIntrinsics), 'your_photo_intrinsics');
                            saveText(JSON.stringify(cameraViewport), 'your_photo_viewport');
                        });
                    }
                }

                if (image != null && imageWidth != null && imageHeight != null && cameraIntrinsics != null) {
                    image
                        .then((img) => {
                            return localize(img, imageWidth, imageHeight, cameraIntrinsics!);
                        })
                        .then(({ cameraGeoPose, optionalScrs }) => {
                            // Save the local pose and the global pose of the image for alignment in a later step
                            $recentLocalisation.geopose = cameraGeoPose;
                            $recentLocalisation.floorpose = floorPose;
                            onLocalizationSuccess(floorPose, cameraGeoPose);

                            // There are GeoPose services (ex. Augmented City) that can also return content (an array of SCRs) inside the localization response.
                            // We could return only those as [optionalScrs], however, this means all other content services are ignored...
                            //if (optionalScrs) {
                            //return [optionalScrs];
                            //}
                            // TODO: do this properly: use async here and pass optionalScrs together with scrsPromises

                            // We request content from all available content services
                            // (which means the AC service must be registered both as geopose as well as content-discovery service in the SSD)
                            let scrsPromises = getContentsInH3Cell();
                            return scrsPromises;
                        })
                        .then((scrs) => {
                            // NOTE: the next step expects an array of array of SCRs in the scrs variable
                            console.log(`Received scrs from ${scrs.length} servers`);
                            scrs.forEach((scr) => {
                                console.log(`Received ${scr.length} scrs from this server`);
                            });
                            placeContent(scrs);
                        });
                }
            }

            tdEngine.render(time, view);
        }
    }

    /**
     * Let's the app know that the XRSession was closed.
     */
    export function onXrSessionEnded() {
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
     * @param time time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     */
    export function onXrNoPose(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose) {
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
     * Send the required information to an external experience, to allow it to stay in sync with the local one.
     *
     * @param view The view to use
     */
    export function handleExternalExperience(view: XRView) {
        if (experienceLoaded === true) {
            if (experienceMatrix == null) {
                throw new Error('experienceMatrix is null!');
            }
            externalContent?.contentWindow?.postMessage(tdEngine.getExternalCameraPose(view, experienceMatrix), '*');
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
     * @param cameraIntrinsics JSON     Camera intrinsics: fx, fy, cx, cy, s
     */
    export function localize(image: string, width: number, height: number, cameraIntrinsics: { fx: number; fy: number; cx: number; cy: number; s: number }) {
        return new Promise<{ cameraGeoPose: GeoposeResponseType['geopose']; optionalScrs: SCR[] }>((resolve, reject) => {
            if ($selectedGeoPoseService === undefined || $selectedGeoPoseService === null) {
                console.warn('There is no available GeoPose service. Trying to use the on-board sensors instead.');
            }

            if ($debug_useGeolocationSensors) {
                getSensorEstimatedGeoPose().then((selfEstimatedGeoPose) => {
                    $context.isLocalizing = false;
                    $context.isLocalized = true;
                    // allow relocalization after a few seconds
                    wait(4000).then(() => {
                        $context.showFooter = false;
                        $context.isLocalisationDone = true;
                    });
                    console.log('SENSOR GeoPose:');
                    console.log(selfEstimatedGeoPose);
                    resolve({ cameraGeoPose: selfEstimatedGeoPose, optionalScrs: [] });
                });
                return;
            }

            let cameraParams = new CameraParam();
            cameraParams.model = CAMERAMODEL.PINHOLE;
            cameraParams.modelParams = [cameraIntrinsics.fx, cameraIntrinsics.fx, cameraIntrinsics.cx, cameraIntrinsics.cy];

            //TODO: check ImageOrientation!
            //TODO: pass width and height as numbers
            //TODO: add width and height into CameraParams (too)
            const geoPoseRequest = new GeoPoseRequest(uuidv4())
                .addCameraData(IMAGEFORMAT.JPG, [width, height], image.split(',')[1], 0, new ImageOrientation(false, 0), cameraParams)
                .addLocationData($initialLocation.lat, $initialLocation.lon, 0, 0, 0, 0, 0);

            // Services haven't implemented recent changes to the protocol yet
            validateRequest(false);

            if ($selectedGeoPoseService?.url) {
                sendRequest($selectedGeoPoseService?.url, JSON.stringify(geoPoseRequest))
                    .then((data) => {
                        $context.isLocalizing = false;
                        $context.isLocalized = true;
                        wait(4000).then(() => {
                            $context.showFooter = false;
                            $context.isLocalisationDone = true;
                        });
                        console.log('GPP response:');
                        console.log(data);

                        // GeoPoseResp
                        // https://github.com/OpenArCloud/oscp-geopose-protocol
                        let cameraGeoPose = null;
                        // NOTE: AugmentedCity also can also return neighboring objects in the GPP response
                        let optionalScrs: SCR[] = [];
                        if (data.geopose != undefined && (data as any).scrs != undefined && (data.geopose as any).geopose != undefined) {
                            // data is AugmentedCity format which contains other entries too
                            // (for example AC /geopose_objs endpoint)
                            cameraGeoPose = (data.geopose as any).geopose;
                            optionalScrs = (data as any).scrs;
                            console.log('GPP response also contains ' + optionalScrs.length + ' SCRs.');
                        } else if (data.geopose != undefined) {
                            // data is GeoPoseResp
                            // (for example AC /geopose endpoint)
                            cameraGeoPose = data.geopose;
                        } else {
                            const errorMessage = 'GPP response has no geopose field';
                            console.log(errorMessage);
                            throw errorMessage;
                        }

                        console.log('IMAGE GeoPose:');
                        console.log(cameraGeoPose);

                        resolve({ cameraGeoPose, optionalScrs });
                    })
                    .catch((error) => {
                        // TODO: Inform user
                        $context.isLocalizing = false;
                        console.error('Could not localize. Error: ' + error);
                        reject(error);
                    });
            }
        });
    }

    /**
     * Show ui for localisation again.
     */
    export function relocalize() {
        $context.isLocalized = false;
        $context.isLocalizing = false;
        $context.isLocalisationDone = false;
        $recentLocalisation.geopose = {};
        $recentLocalisation.floorpose = {};

        $receivedScrs = [];
        $context.receivedContentTitles = [];

        tdEngine.clearScene();

        $context.showFooter = true;
    }

    /**
     * Request content from SCD available around the current location.
     */
    export function getContentsInH3Cell() {
        const servicePromises = $availableContentServices.reduce<Promise<SCR[]>[]>((result, service) => {
            if ($selectedContentServices[service.id]?.isSelected) {
                // TODO: H3 cell ID and topic should be be customizable
                let scrs_ = getContentsAtLocation(service.url, 'history', $initialLocation.h3Index);
                result.push(scrs_);
            }
            return result;
        }, []);

        return Promise.all(servicePromises);
    }

    /**
     *  Places the contents provided by Spacial Content Discovery providers.
     * @param scrs  [[SCR]]      Content Records with the result from the selected content services (array of array of SCRs. One array of SCRs by content provider)
     */
    export function placeContent(scrs: SCR[][]) {
        let showContentsLog = false;
        scrs.forEach((response) => {
            //console.log('Number of content items received: ', response.length);

            response.forEach((record) => {
                // TODO: validate here whether we received a proper SCR
                // TODO: we can check here whether we have received this content already and break if yes.
                // TODO: first save the records and then start to instantiate the objects
                if (record.content.type === 'placeholder' || record.content.type === '3D' || record.content.type === 'MODEL_3D' || record.content.type === 'ICON') {
                    // only list the 3D models and not ephemeral objects nor stream objects
                    $receivedScrs.push(record);
                    $context.receivedContentTitles.push(record.content.title);
                }

                // HACK: we fix up the geopose entries of records that still use the old GeoPose standard.
                record.content.geopose = upgradeGeoPoseStandard(record.content.geopose);

                const content_definitions: Record<string, string> = {};
                if (record.content.definitions != undefined) {
                    const d_entries = record.content.definitions.entries();
                    //console.log(" -definitions:")
                    for (let d_entry of d_entries) {
                        const d = d_entry[1];
                        //console.log("  -" + d.type + ": " + d.value);
                        content_definitions[d.type] = d.value;
                    }
                }

                // TODO: this method could handle any type of content:
                //tdEngine.addSpatialContentRecord(globalObjectPose, record.content)

                // Difficult to generalize, because there are no types defined yet.
                switch (record.content.type) {
                    case 'MODEL_3D':
                    case '3D': // NOTE: AC-specific type 3D is the same as OSCP MODEL_3D // AC added it in Nov.2022
                    case 'placeholder': {
                        // NOTE: placeholder is a temporary type we use in all demos until we come up with a good list // AC removed it in Nov.2022
                        showContentsLog = true; // show log if at least one 3D object was received

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
                        if (record.content.refs != undefined && record.content.refs.length > 0) {
                            // OSCP-compliant 3D content structure
                            // TODO load all, not only first reference
                            const contentType = record.content.refs[0].contentType;
                            const url = record.content.refs[0].url;
                            if (contentType.includes('gltf')) {
                                tdEngine.addModel(position, orientation, url);
                            } else {
                                // we cannot load anything else but GLTF
                                // so draw a placeholder instead
                                const placeholder = tdEngine.addPlaceholder(record.content.keywords, position, orientation);
                                handlePlaceholderDefinitions(tdEngine, placeholder /* record.content.definition */);
                            }
                        } else {
                            // we cannot load anything else but OSCP-compliant and AC-compliant 3D models
                            // so draw a placeholder instead
                            const placeholder = tdEngine.addPlaceholder(record.content.keywords, position, orientation);
                            handlePlaceholderDefinitions(tdEngine, placeholder /* record.content.definition */);
                        }
                        break;
                    }

                    case 'ephemeral': {
                        // ISMAR2021 demo
                        if (record.tenant === 'ISMAR2021demo') {
                            console.log('ISMAR2021demo object received!');
                            // TODO: the object_description is not standard data; it is only used for the ismar2021 demo
                            let object_description = (record.content as any).object_description;
                            let globalObjectPose = record.content.geopose;
                            let localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);
                            tdEngine.addObject(localObjectPose.position, localObjectPose.quaternion, object_description);
                        }
                        break;
                    }
                    case 'POINTCLOUD': {
                        if ($debug_enablePointCloudContents) {
                            const globalObjectPose = record.content.geopose;
                            const localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);
                            const position = localObjectPose.position;
                            const orientation = localObjectPose.quaternion;
                            let url = '';
                            if (content_definitions['url'] != undefined) {
                                url = content_definitions['url'];
                            } else {
                                url = record.content.refs ? record.content.refs[0].url : '';
                            }
                            tdEngine.addPointCloud(url, position, orientation);
                        } else {
                            console.log('A POINTCLOUD content was received but this type is disabled');
                        }
                        break;
                    }

                    case 'ICON': {
                        const globalObjectPose = record.content.geopose;
                        const localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);
                        const localPosition = localObjectPose.position;
                        const localQuaternion = localObjectPose.quaternion;
                        let url = '';
                        if (content_definitions['url'] != undefined) {
                            url = content_definitions['url'];
                        } else {
                            url = record.content.refs ? record.content.refs[0].url : '';
                        }
                        let width = 1.0;
                        if (content_definitions['width'] != undefined) {
                            width = parseFloat(content_definitions['width']);
                        }
                        let height = 1.0;
                        if (content_definitions['height'] != undefined) {
                            height = parseFloat(content_definitions['height']);
                        }
                        tdEngine.addLogoObject(url, localPosition, localQuaternion, width, height);
                        break;
                    }
                    default: {
                        console.log(record.content.title + ' has unexpected content type: ' + record.content.type);
                        console.log(record.content);
                    }
                }
            });
        });

        // DEBUG
        if (showContentsLog) {
            console.log('Received contents: ');
            $receivedScrs.forEach((record) => {
                console.log('  ' + record.content.title);
            });
        }

        tdEngine.updateSceneGraphTransforms();

        wait(3000).then(() => ($context.receivedContentTitles = [])); // clear the list after a timer
    }

    /**
     * Handler to load and unload external experiences.
     *
     * @param placeholder  Model        The initial placeholder placed into the 3D scene
     * @param position  Position        The position the experience should be placed
     * @param orientation  Orientation      The orientation of the experience
     * @param url  String       The URL to load the experience from
     */
    export function experienceLoadHandler(placeholder: Mesh, position: Position, orientation: Orientation, url: string) {
        tdEngine.setWaiting(placeholder);

        externalContent.src = url;
        window.addEventListener(
            'message',
            (event) => {
                if (event.data.type === 'loaded') {
                    tdEngine.remove(placeholder);
                    experienceLoaded = true;
                    experienceMatrix = placeholder.matrix;

                    closeExperience.addEventListener(
                        'click',
                        () => {
                            experienceLoaded = false;
                            experienceMatrix = null;
                            externalContent.src = '';

                            const nextPlaceholder = tdEngine.addExperiencePlaceholder(position, orientation);
                            tdEngine.addClickEvent(nextPlaceholder, () => experienceLoadHandler(nextPlaceholder, position, orientation, url));
                        },
                        { once: true },
                    );
                }
            },
            { once: true },
        );
    }

    export function getRenderer() {
        return tdEngine;
    }

    // TODO: rename to onEventReceived()
    /**
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events: any) {
        // simply print for now
        console.log('Viewer: event received:');
        console.log(events);
    }
</script>

<canvas id="application" bind:this={canvas}></canvas>

<aside bind:this={overlay} on:beforexrselect={(event) => event.preventDefault()}>
    <iframe class:hidden={!experienceLoaded} bind:this={externalContent} src=""></iframe>
    <img id="experienceclose" class:hidden={!experienceLoaded} alt="close button" src="/media/close-cross.svg" bind:this={closeExperience} />

    <!--  Space for UI elements -->
    {#if $context.showFooter || true}
        <!-- always show footer now for demo purposes -->
        <footer>
            {#if unableToStartSession}
                <h4>Couldn't start AR</h4>
                <p>
                    sparcl needs some <a href="https://openarcloud.github.io/sparcl/help/incubationflag.html"> experimental flags</a> to be enabled.
                </p>
            {:else if Object.values(ARMODES).includes($arMode)}
                <slot
                    name="overlay"
                    {firstPoseReceived}
                    isLocalized={$context.isLocalized}
                    isLocalisationDone={$context.isLocalisationDone}
                    isLocalizing={$context.isLocalizing}
                    receivedContentTitles={$context.receivedContentTitles}
                />
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
