<script lang="ts">
    import { setContext } from 'svelte';
    import { writable, type Writable } from 'svelte/store';
    import ArCloudOverlay from '@components/dom-overlays/ArCloudOverlay.svelte';
    import Parent from '@components/Viewer.svelte';
    import type webxr from '../../../core/engines/webxr';
    import type { RenderingEngine } from '@core/engines/RenderingEngine';
    import type { Geopose } from '@oarc/scd-access';
    import Overlay from './Overlay.svelte';
    import { getCurrentLocation } from '@src/core/locationTools';
    import * as worldAlignment from '@core/worldAlignment';
    import { initialLocation } from '@src/stateStore';

    let parentInstance: Parent;
    let xrEngine: webxr;
    let tdEngine: RenderingEngine;
    let settings: Writable<Record<string, unknown>> = writable({});

    let searchEnabled = true;

    let parentState = writable();
    setContext('state', parentState);

    let currentGeopose: Geopose | undefined = undefined;

    // Set the PoI search baseURL in the env file
    const baseUrl = import.meta.env.VITE_POI_SEARCH_BASEURL || undefined;

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     * @param options  { settings }       Options provided by the app. Currently contains the settings from the Dashboard
     */
    export function startAr(thisWebxr: webxr, this3dEngine: RenderingEngine, options?: { settings?: Writable<Record<string, unknown>> }) {
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
     * @param xrViewerPose The pose of the device as reported by the XRFrame
     */
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose) {
        parentInstance.onXrFrameUpdate(time, frame, xrViewerPose);

        if (worldAlignment.hasActiveWorldAlignment()) {
            // store the viewer geopose for later use
            currentGeopose = worldAlignment.convertCameraWebXrPoseToGeoposeFromActive(
                xrViewerPose.transform.position, xrViewerPose.transform.orientation
            );
        } else {
            currentGeopose = undefined;
        }

        xrEngine.setViewportForView(xrViewerPose.views[0]);
        tdEngine.render(time, xrViewerPose.views[0]);
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
     * @param xrViewerPose  XRPose     The pose of the device as reported by the XRFrame
     */
    function onXrNoPose(time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose) {
        parentInstance.onXrNoPose(time, frame, xrViewerPose);
    }

    function placePOI(name: string, lat: number, lon: number) {
        if (name === undefined || lat === undefined || lon === undefined) {
            console.log('Undefined values in POI data');
            return;
        }
        const featureName = name;
        const featureGeopose = {
            position: { lat: lat, lon: lon, h: 0 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 },
        };
        const pinPose = worldAlignment.convertGeoPoseToLocalPose(featureGeopose);
        const modelNodeId = tdEngine.addModelWithRigidPose('/media/models/map_pin.glb', pinPose, [2, 2, 2], (_meshNodeId) => {
            console.log('POI ' + featureName + ' added.');
        });
        tdEngine.setVerticallyRotating(modelNodeId);

        const textMesh = tdEngine.addTextObjectWithRigidPose(pinPose, featureName, {
            textColor: [0.063, 0.741, 1.0],
            positionOffset: [0, 3, 0],
        });
        textMesh.then((node) => {
            tdEngine.setTowardsCameraRotating(node);
        });
    }

    function relocalize() {
        parentInstance.relocalize();
    }

    async function getPlaces(query: String) {
        if (searchEnabled) {
            // reset 3D engine to remove old POI markers
            worldAlignment.clearActiveGeoPoseAlignment();
            worldAlignment.clearActiveFramedPoseAlignment();
            tdEngine.reinitialize();

            // use initial location as fallback
            let lat = $initialLocation.lat;
            let lon = $initialLocation.lon;
            if (currentGeopose !== undefined) {
                // If avaialable, use the last known geopose from visual localization and tracking
                const myFineLocation = currentGeopose;
                lat = myFineLocation?.position.lat;
                lon = myFineLocation?.position.lon;
            } else {
                // as fallback, query the GPS. slow and inaccurate
                const myCoarseLocation = await getCurrentLocation();
                lat = myCoarseLocation.lat;
                lon = myCoarseLocation.lon;
            }

            if (!baseUrl) {
                console.error('baseUrl is not defined!');
                return;
            }
            const url = baseUrl + '?lat=' + lat + '&lng=' + lon + '&textQuery=' + query;

            try {
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const data = await response.json();
                console.log(data.features);
                data.features.forEach(function (place: any) {
                    placePOI(place.name.name, place.geometry.coordinates[0], place.geometry.coordinates[1]);
                });
            } catch (error) {
                console.error('Error fetching data:', error);
            }
            searchEnabled = false;

            setTimeout(() => {
                searchEnabled = true;
            }, 3000);
        }
    }

    function getRecievedText(event: any) {
        getPlaces(event.detail);
        console.log(event.detail);
    }

    function basicSearch(event: any) {
        getPlaces(event.detail);
        console.log(event.detail);
    }
</script>

<!-- <div style="position:fixed; top:0; left: 0; width:50%; height:50%; background:black; color: white;">Test</div> -->
<Parent bind:this={parentInstance} on:arSessionEnded on:worldAlignmentEstablished on:worldAlignmentCleared>
    <svelte:fragment slot="overlay" let:isLocalizing let:isLocalized let:isLocalisationDone let:firstPoseReceived>
        {#if $settings.localisation && !isLocalisationDone}
            <ArCloudOverlay hasPose={firstPoseReceived} {isLocalizing} {isLocalized} on:startLocalisation={() => parentInstance.startLocalisation()} />
        {:else}
            <Overlay on:relocalize={() => relocalize()} on:textInput={getRecievedText} on:categorySelected={basicSearch} />
        {/if}
    </svelte:fragment>
</Parent>
