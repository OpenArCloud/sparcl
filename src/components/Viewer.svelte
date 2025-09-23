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
    import { writable, type Writable, get } from 'svelte/store';
    import { v4 as uuidv4 } from 'uuid';
    import { debounce, type DebouncedFunction } from 'es-toolkit';
    import { sendRequest, validateRequest, GeoPoseRequest, type GeoposeResponseType, Sensor, Privacy, ImageOrientation, IMAGEFORMAT, CameraParam, CAMERAMODEL, SENSORTYPE } from '@oarc/gpp-access';
    import { getContentsAtLocation, type Geopose, type SCR } from '@oarc/scd-access';
    import { handlePlaceholderDefinitions } from '@core/definitionHandlers';
    import { type SetupFunction, type XrFeature, type XrFrameUpdateCallbackType, type XrNoPoseCallbackType } from '../types/xr';
    import {
        arMode,
        availableContentServices,
        debug_showLocalAxes,
        debug_useGeolocationSensors,
        debug_saveCameraImage,
        debug_loadCameraImage,
        debug_enablePointCloudContents,
        debug_enableOGCPoIContents,
        initialLocation,
        receivedScrs,
        recentLocalisation,
        selectedContentServices,
        selectedGeoPoseService,
        debug_overrideGeopose,
        debug_useOverrideGeopose,
        myAgentName,
        myAgentId,
        myAgentColor,
        enableCameraPoseSharing,
        showOtherCameras,
    } from '@src/stateStore';
    import { PRIMITIVES } from '../core/engines/ogl/modelTemplates'; // just for drawing an agent
    import { rgbToHex, normalizeColor } from '@core/common'; // just for drawing an agent
    import { ARMODES, wait } from '@core/common';
    import { loadImageBase64, saveImageBase64, saveText } from '@core/devTools';
    import { getClosestH3Cells, upgradeGeoPoseStandard } from '@core/locationTools';
    import { getSensorEstimatedGeoPose, startOrientationSensor, stopOrientationSensor } from '@core/sensors';
    import ArMarkerOverlay from '@components/dom-overlays/ArMarkerOverlay.svelte';
    import type webxr from '../core/engines/webxr';
    import ogl from '../core/engines/ogl/ogl';
    import { Vec3, type Mat4, type Mesh, Quat } from 'ogl';
    import { createSensorVisualization, updateSensorFromMsg, updateSensorVisualization } from '@src/features/sensor-visualizer';
    import { subscribeToSensor } from '@src/core/rmqnetwork';

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher<{
        arSessionEnded: undefined;
        broadcast: {
            event: string;
            value?: any;
            routing_key?: string;
        };
    }>();

    const message = (msg: string) => console.log(msg);

    let canvas: HTMLCanvasElement;
    let overlay: HTMLElement;
    let externalContentIFrame: HTMLIFrameElement;
    let externalContentCloseButton: HTMLImageElement;
    let xrEngine: webxr;
    let tdEngine: ogl;

    let unableToStartSession = false;
    let startLocalizing = false;
    let experienceLoaded = false;
    let experienceMatrix: Mat4 | null = null;
    let firstPoseReceived = false;
    let poseFoundHeartbeat: DebouncedFunction<() => boolean> | undefined = undefined;

    let currentGeoPose: Geopose | undefined;
    let contentQueryInterval: NodeJS.Timeout | undefined = undefined;
    let loadedH3Indices: string[] = [];

    // spatial contents are organized into topics.
    const kDefaultOscpScdTopic = 'history';

    // Multiplayer: poses of others
    let agentInfo: Record<string, { hexColor: string; agentName: string; agentId: string }> = {};

    // TODO: Setup event target array, based on info received from SCD
    const context: Writable<{
        hasLostTracking: boolean;
        showFooter: boolean;
        isLocalized: boolean;
        isLocalizing: boolean;
        isLocalisationDone: boolean;
        receivedContentTitles: any[];
    }> = getContext('state') || writable();
    context.set({
        hasLostTracking: true,
        showFooter: false,
        isLocalized: false,
        isLocalizing: false, // while waiting for GeoPose service localization
        isLocalisationDone: false, // whether to show the dom-overlay with 'localize' button
        receivedContentTitles: [],
    });

    onDestroy(() => {
        tdEngine.stop();
        $recentLocalisation.geopose = {};
        $recentLocalisation.floorpose = {};
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
        wait(1000).then(() => {
            $context.showFooter = true;
        });
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
        requiredFeatures: XrFeature[] = [],
        optionalFeatures: XrFeature[] = [],
    ) {
        const options: { requiredFeatures: XrFeature[]; optionalFeatures: XrFeature[]; domOverlay?: { root: HTMLElement } } = {
            requiredFeatures: requiredFeatures,
            optionalFeatures: optionalFeatures,
        };

        if (requiredFeatures.includes('dom-overlay') || optionalFeatures.includes('dom-overlay')) {
            options.domOverlay = { root: overlay };
        }

        try {
            await xrEngine.startSession(canvas, xrFrameUpdateCallback, options, setup);
        } catch (error) {
            unableToStartSession = true;
            message('WebXR Immersive AR failed to start: ' + error);
            return;
        }

        xrEngine.setCallbacks(xrSessionEndedCallback, xrNoPoseCallback);
        tdEngine.init();

        if ($debug_useGeolocationSensors) {
            startOrientationSensor();
        }
    }

    /**
     * Handles a pose found heartbeat. When it's not triggered for a specific time (300ms as default) an indicator
     * is shown to let the user know that the tracking was lost.
     */
    export function handlePoseHeartbeat() {
        $context.hasLostTracking = false;
        if (poseFoundHeartbeat === undefined) {
            poseFoundHeartbeat = debounce(() => ($context.hasLostTracking = true), 300);
        }
        poseFoundHeartbeat();
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
        handlePoseHeartbeat();

        if (firstPoseReceived === false) {
            firstPoseReceived = true;

            if ($debug_showLocalAxes) {
                tdEngine.addAxes();
            }
        }

        // TODO: Handle multiple views and the localisation correctly
        for (let view of floorPose.views) {
            xrEngine.setViewportForView(view);

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

            if (startLocalizing) {
                startLocalizing = false;

                if ($debug_useOverrideGeopose) {
                    const getGeopose = async () => {
                        $context.isLocalizing = false;
                        $context.isLocalized = true;
                        // allow relocalization after a few seconds
                        wait(4000).then(() => {
                            $context.showFooter = false;
                            $context.isLocalisationDone = true;
                        });
                        return { cameraGeoPose: $debug_overrideGeopose };
                    };
                    doLocalization({ floorPose, getGeopose });
                } else {
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

                    const getGeopose = async () => {
                        if (!image || imageWidth == null || imageHeight == null || cameraIntrinsics == null) {
                            throw new Error('Expected image to exist but it didnt');
                        }
                        const img = await image;
                        return localize(img, imageWidth, imageHeight, cameraIntrinsics!);
                    };
                    doLocalization({ floorPose, getGeopose });
                }
            }

            updateSensorVisualization();

            // optionally share the camera pose with other players
            if ($enableCameraPoseSharing && $recentLocalisation.geopose?.position != undefined && $recentLocalisation.floorpose?.transform?.position != undefined) {
                try {
                    shareCameraPose(floorPose);
                    const localPos = new Vec3(floorPose.transform.position.x, floorPose.transform.position.y, floorPose.transform.position.z);
                    const localQuat = new Quat(floorPose.transform.orientation.x, floorPose.transform.orientation.y, floorPose.transform.orientation.z, floorPose.transform.orientation.w);
                    currentGeoPose = tdEngine.convertCameraLocalPoseToGeoPose(localPos, localQuat);
                } catch (error) {
                    // do nothing. we can expect some exceptions because the pose conversion is not yet possible in the first few frames.
                }
            }

            tdEngine.render(time, view);
        }
    }

    async function doLocalization({ floorPose, getGeopose }: { floorPose: XRViewerPose; getGeopose: () => Promise<{ cameraGeoPose: GeoposeResponseType['geopose']; optionalScrs?: SCR[] }> }) {
        console.log('doLocalization');

        // wait for the localization result, whichever method it comes from
        const { cameraGeoPose } = await getGeopose();
        $recentLocalisation.geopose = cameraGeoPose;
        $recentLocalisation.floorpose = floorPose;
        onLocalizationSuccess(floorPose, cameraGeoPose);

        // now get the contents from the SCD(s)
        retrieveAndPlaceContents(currentGeoPose);
        // and repeat periodically
        contentQueryInterval = setInterval(async () => {
            retrieveAndPlaceContents(currentGeoPose);
        }, 5000);
    }

    async function retrieveAndPlaceContents(queryGeoPose: Geopose | undefined) {
        console.log('retrieveAndPlaceContents');

        if (!queryGeoPose) {
            console.warn('No geopose available yet, cannot query contents');
            return;
        }
        const h3Indices = getClosestH3Cells(queryGeoPose.position.lat, queryGeoPose.position.lon);
        for (const h3Index of h3Indices) {
            // skip already loaded h3 indices
            // NOTE: disable to support dynamically created contents
            if (loadedH3Indices.includes(h3Index)) {
                continue;
            } else {
                loadedH3Indices.push(h3Index);
            }
            console.log('New h3 index', h3Index);
            const scrs = await getContentsInH3Cell(h3Index, kDefaultOscpScdTopic);
            placeContent(scrs);
        }
    }

    /**
     * Let's the app know that the XRSession was closed.
     */
    export function onXrSessionEnded() {
        console.log('Viewer.onXrSessionEnded');
        firstPoseReceived = false;
        if ($debug_useGeolocationSensors) {
            stopOrientationSensor();
        }
        clearInterval(contentQueryInterval);
        tdEngine.cleanup();
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
        $context.hasLostTracking = true;
        tdEngine.render(time, floorPose.views[0]);
    }

    /**
     * Trigger localisation of the device globally using a GeoPose service.
     */
    export function startLocalisation() {
        startLocalizing = true;
        $context.isLocalizing = true;
    }

    /*
     * @param localPose XRPose      The pose of the camera when localisation was started in local reference space
     * @param globalPose  GeoPose       The global camera GeoPose as returned from the GeoPose service
     */
    export function onLocalizationSuccess(localPose: XRPose, globalPose: Geopose) {
        let localImagePose = {
            position: new Vec3(localPose.transform.position.x, localPose.transform.position.y, localPose.transform.position.z),
            orientation: new Quat(localPose.transform.orientation.x, localPose.transform.orientation.y, localPose.transform.orientation.z, localPose.transform.orientation.w),
        };
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
            externalContentIFrame?.contentWindow?.postMessage(tdEngine.getExternalCameraPose(view, experienceMatrix), '*');
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
                .addSensor(new Sensor('gps', SENSORTYPE.geolocation))
                .addGeoLocationData($initialLocation.lat, $initialLocation.lon, 0, 0, 0, 0, 0, Date.now(), 'gps', new Privacy());
            console.log('GPP request:');
            console.log(JSON.stringify(geoPoseRequest));

            geoPoseRequest
                .addSensor(new Sensor('cam', SENSORTYPE.camera))
                .addCameraData(IMAGEFORMAT.JPG, [width, height], image.split(',')[1], 0, new ImageOrientation(false, 0), cameraParams, Date.now(), 'cam', new Privacy());

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
                        console.log(JSON.stringify(data));

                        // GeoPoseResp
                        // https://github.com/OpenArCloud/oscp-geopose-protocol
                        let cameraGeoPose = null;
                        // NOTE: AugmentedCity can also return neighboring objects in the GPP response
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
        clearInterval(contentQueryInterval);

        $context.isLocalized = false;
        $context.isLocalizing = false;
        $context.isLocalisationDone = false;
        $recentLocalisation.geopose = {};
        $recentLocalisation.floorpose = {};

        $receivedScrs = [];
        $context.receivedContentTitles = [];
        loadedH3Indices = [];

        tdEngine.reinitialize();

        $context.showFooter = true;
    }

    /**
     * Request content from SCD available around the current location.
     */
    export function getContentsInH3Cell(h3Index = $initialLocation.h3Index, topic = kDefaultOscpScdTopic) {
        const allScrPromises = $availableContentServices.reduce<Promise<SCR[]>[]>((result, service) => {
            if ($selectedContentServices[service.id]?.isSelected) {
                console.log(`Receiving scrs from ${service.url} for H3 cell ${h3Index} and topic ${topic}...`);
                let scrPromises = getContentsAtLocation(service.url, topic, h3Index); // returns Promise<SCR[]>
                result.push(scrPromises);
            }
            return result;
        }, []);

        return Promise.all(allScrPromises);
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
                if ($receivedScrs.map((scr) => scr.id).includes(record.id)) {
                    return;
                }
                // TODO: validate here whether we received a proper SCR
                // TODO: we can check here whether we have received this content already and break if yes.

                // DEBUG
                //console.log("Content");
                //console.log(" -id: " + record.content.id);
                //console.log(" -type: " + record.content.type);

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

                const globalObjectPose = record.content.geopose;
                const localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);
                const localPosition = localObjectPose.position;
                const localQuaternion = localObjectPose.quaternion;

                // TODO: this method could handle any type of content:
                //tdEngine.addSpatialContentRecord(globalObjectPose, record.content)

                // Difficult to generalize, because there are no types defined yet.
                switch (record.content.type) {
                    case 'MODEL_3D':
                    case '3D': // NOTE: AC-specific type 3D is the same as OSCP MODEL_3D // AC added it in Nov.2022
                    case 'placeholder': {
                        // NOTE: placeholder is a temporary type we use in all demos until we come up with a good list // AC removed it in Nov.2022
                        showContentsLog = true; // show log if at least one 3D object was received

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
                        //             tdEngine.addModel(url, position, orientation);
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
                                const nodeTransform = tdEngine.addModel(url, localPosition, localQuaternion).transform;
                                if (content_definitions['animation'] != undefined) {
                                    switch (content_definitions['animation']) {
                                        case 'SPIN_UP':
                                            tdEngine.setVerticallyRotating(nodeTransform);
                                            break;
                                        default:
                                            break;
                                    }
                                }
                            } else {
                                // we cannot load anything else but GLTF
                                // so draw a placeholder instead
                                const placeholder = tdEngine.addPlaceholder(record.content.keywords, localPosition, localQuaternion);
                                handlePlaceholderDefinitions(tdEngine, placeholder /* record.content.definition */);
                            }
                        } else {
                            // we cannot load anything else but OSCP-compliant and AC-compliant 3D models
                            // so draw a placeholder instead
                            const placeholder = tdEngine.addPlaceholder(record.content.keywords, localPosition, localQuaternion);
                            handlePlaceholderDefinitions(tdEngine, placeholder /* record.content.definition */);
                        }
                        break;
                    }

                    case 'ephemeral': {
                        // ISMAR2021 demo
                        if (record.tenant === 'ISMAR2021demo') {
                            //console.log('ISMAR2021demo object received!');
                            // TODO: the object_description is not standard data; it is only used for the ismar2021 demo
                            let object_description = (record.content as any).object_description;
                            tdEngine.addObject(localPosition, localQuaternion, object_description);
                        }
                        break;
                    }

                    case 'geopose_stream': {
                        // NGI Search 2025 demo on agent pose sharing
                        if (record.tenant === 'NGISearch2025' && $showOtherCameras) {
                            let globalObjectPose = record.content.geopose;
                            let localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);
                            let object_id = record.content.id;

                            let object_description = (record.content as any).object_description;
                            if (tdEngine.getDynamicObjectMesh(object_id) != null) {
                                tdEngine.updateDynamicObject(object_id, localObjectPose.position, localObjectPose.quaternion, object_description);
                            } else {
                                tdEngine.addDynamicObject(object_id, localObjectPose.position, localObjectPose.quaternion, object_description);
                            }
                        }
                        break;
                    }

                    case 'sensor_stream': {
                        // handle general sensor stream objects
                        let globalObjectPose = record.content.geopose;
                        let localObjectPose = tdEngine.convertGeoPoseToLocalPose(globalObjectPose);

                        const sensor_id = createSensorVisualization(tdEngine, localObjectPose.position, localObjectPose.quaternion, content_definitions);
                        if (sensor_id == undefined) {
                            console.error('ERROR: Unable to parse sensor content record! ' + record.content.id);
                            break;
                        }
                        if (content_definitions.rmqTopic) {
                            subscribeToSensor(content_definitions.rmqTopic, (d) => {
                                console.log(d.body);
                                updateSensorFromMsg(d.body, tdEngine);
                            });
                        } else {
                            console.error('Missing rmqTopic field for sensor');
                        }

                        break;
                    }

                    case 'POINTCLOUD': {
                        if ($debug_enablePointCloudContents) {
                            let url = '';
                            if (content_definitions['url'] != undefined) {
                                url = content_definitions['url'];
                            } else {
                                url = record.content.refs ? record.content.refs[0].url : '';
                            }
                            tdEngine.addPointCloud(url, localPosition, localQuaternion);
                        } else {
                            console.log('A POINTCLOUD content was received but this type is disabled');
                        }
                        break;
                    }

                    case 'ICON': {
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

                    case 'POI': {
                        if (!$debug_enableOGCPoIContents) {
                            console.log('A POI content was received but this type is disabled');
                            break;
                        }
                        const url = record.content.refs ? record.content.refs[0].url : '';
                        fetch(url)
                            .then((response) => {
                                if (response.ok) {
                                    return response.json();
                                } else {
                                    console.error('Could not retrieve POIs from ' + url);
                                    console.error(response.text());
                                }
                            })
                            .then((poidata) => {
                                const features = poidata.features;
                                features.forEach((feature: any) => {
                                    const featureName = feature.name.name; // WARNING: name.name is according to the OGC standard
                                    //console.log("POI received:");
                                    //console.log(featureName);
                                    const poiLat = feature.geometry.coordinates[0];
                                    const poiLon = feature.geometry.coordinates[1];
                                    let poiH = 0.0;
                                    if (feature.geometry.coordinates.length > 2) {
                                        poiH = feature.geometry.coordinates[2];
                                    }
                                    const featureGeopose = {
                                        // WARNING: now we need to harcode height because it is not part of OGC PoI
                                        position: { lat: poiLat, lon: poiLon, h: poiH },
                                        quaternion: { x: 0, y: 0, z: 0, w: 1 },
                                    };
                                    const localFeaturePose = tdEngine.convertGeoPoseToLocalPose(featureGeopose);
                                    const nodeTransform = tdEngine.addModel('/media/models/map_pin.glb', localFeaturePose.position, localFeaturePose.quaternion, new Vec3(2, 2, 2), (pinModel) => {
                                        //tdEngine.setVerticallyRotating(pinModel.parent!); // TODO: why does this not work?
                                        console.log('POI ' + featureName + ' added.');
                                    }).transform;
                                    tdEngine.setVerticallyRotating(nodeTransform);

                                    let localTextPosition = localFeaturePose.position.clone();
                                    localTextPosition.y += 3;
                                    const textColor = new Vec3(0.063, 0.741, 1.0); // light blue
                                    const textMesh = tdEngine.addTextObject(localTextPosition, localFeaturePose.quaternion, featureName, textColor);
                                    textMesh.then((node) => {
                                        tdEngine.setTowardsCameraRotating(node);
                                    });
                                });
                            })
                            .catch((error) => {
                                console.error('Error while processing POIs: ' + error);
                            });

                        break;
                    }

                    case 'TEXT': {
                        if (!$debug_enableOGCPoIContents) {
                            console.log('A TEXT content was received but this type is disabled');
                            break;
                        }
                        const url = record.content.refs ? record.content.refs[0].url : '';
                        fetch(url)
                            .then((response) => {
                                if (response.ok) {
                                    return response.text();
                                } else {
                                    console.error('Could not retrieve TEXT from ' + url);
                                    console.error(response.text());
                                }
                            })
                            .then((textdata) => {
                                //console.log("TEXT received:")
                                //console.log(textdata)
                                tdEngine.addTextObject(localPosition, localQuaternion, textdata!);
                            })
                            .catch((error) => {
                                console.error('Error while processing TEXT: ' + error);
                            });
                        break;
                    }

                    case 'VIDEO':
                        const videoUrl = record.content.refs ? record.content.refs[0].url : '';
                        tdEngine.addVideoObject(localPosition, localQuaternion, videoUrl);
                        break;

                    default: {
                        console.log(record.content.title + ' has unexpected content type: ' + record.content.type);
                        console.log(record.content);
                        break;
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
     * @param placeholder  Model    The initial placeholder placed into the 3D scene
     * @param position  Vec3        The position the experience should be placed
     * @param orientation  Quat     The orientation of the experience
     * @param url  String           The URL to load the experience from
     */
    export function experienceLoadHandler(placeholder: Mesh, position: Vec3, orientation: Quat, url: string) {
        tdEngine.setWaiting(placeholder);

        externalContentIFrame.src = url;
        window.addEventListener(
            'message',
            (event) => {
                if (event.data.type === 'loaded') {
                    tdEngine.remove(placeholder);
                    experienceLoaded = true;
                    experienceMatrix = placeholder.matrix;

                    externalContentCloseButton.addEventListener(
                        'click',
                        () => {
                            experienceLoaded = false;
                            experienceMatrix = null;
                            externalContentIFrame.src = '';

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

    function shareCameraPose(localPose: XRViewerPose) {
        const timestamp = Date.now();
        const localPos = new Vec3(localPose.transform.position.x, localPose.transform.position.y, localPose.transform.position.z);
        const localQuat = new Quat(localPose.transform.orientation.x, localPose.transform.orientation.y, localPose.transform.orientation.z, localPose.transform.orientation.w);
        const geoPose = tdEngine.convertCameraLocalPoseToGeoPose(localPos, localQuat);
        const message_body = {
            agent_id: $myAgentId,
            avatar: {
                name: $myAgentName,
                color: { r: $myAgentColor?.r, g: $myAgentColor?.g, b: $myAgentColor?.b, a: $myAgentColor?.a },
            },
            geopose: geoPose,
            timestamp: timestamp,
        };
        const rmq_topic = import.meta.env.VITE_RMQ_TOPIC_GEOPOSE_UPDATE + '.' + String($myAgentId); // send to subtopic with our agent ID
        dispatch('broadcast', {
            event: 'publish_camera_pose',
            value: message_body,
            routing_key: rmq_topic,
        });
    }

    /**
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events: any) {
        // Simply print any unknown events and return
        if (!('agent_geopose_updated' in events)) {
            console.log('Viewer: Unknown event received:');
            console.log(events);
            return;
        }

        if (get(recentLocalisation)?.geopose?.position == undefined) {
            // we need to localize at least once to be able to do anything
            //console.log('Network event received but we are not localized yet!');
            //console.log(events);
            return;
        }

        if ('agent_geopose_updated' in events) {
            let data = events.agent_geopose_updated;
            const agent_id = data.agent_id;
            const agent_name = data.agent_name;
            const agent_color = rgbToHex(data.color);
            agentInfo = { ...agentInfo, [agent_id]: { hexColor: agent_color, agentName: agent_name || agent_id, agentId: agent_id } };
            const timestamp = data.timestamp;
            const agent_geopose = data.geopose;
            // We create a new spatial content record just for placing this object
            let object_id = agent_id + '_' + timestamp; // just a proposal
            let object_description = {
                version: 2,
                color: [normalizeColor(data.color.r), normalizeColor(data.color.g), normalizeColor(data.color.b), normalizeColor(data.color.a)],
                shape: PRIMITIVES.sphere,
                scale: [0.05, 0.05, 0.05],
                transparent: false,
                options: {},
            };
            let content = {
                id: agent_id, // stream ID
                type: 'geopose_stream', //high-level OSCP type
                title: object_id, // datapoint ID = stream ID + timestamp
                refs: [],
                geopose: agent_geopose,
                object_description: object_description,
            };
            let scr = {
                content: content,
                id: object_id,
                tenant: 'NGISearch2025',
                type: 'geopose_stream',
                timestamp: timestamp,
            };
            placeContent([[scr]]); // WARNING: wrap into an array
        }
    }
</script>

<canvas id="application" bind:this={canvas}></canvas>

<aside bind:this={overlay} on:beforexrselect={(event) => event.preventDefault()}>
    <iframe title="externalcontentiframe" class:hidden={!experienceLoaded} bind:this={externalContentIFrame} src=""></iframe>
    <img id="experienceclose" class:hidden={!experienceLoaded} alt="close button" src="/media/close-cross.svg" bind:this={externalContentCloseButton} />

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

    {#if $context.hasLostTracking}
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
