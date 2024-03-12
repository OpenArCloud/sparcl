<script lang="ts">
    import { onMount, setContext } from 'svelte';
    import { createEventDispatcher } from 'svelte';
    import { get, writable, type Writable } from 'svelte/store';
    import { v4 as uuidv4 } from 'uuid';
    import { Vec3, Quat, type Transform } from 'ogl';

    import Parent from '@components/Viewer.svelte';
    import ArCloudOverlay from '@components/dom-overlays/ArCloudOverlay.svelte';
    import ArExperimentOverlay from '@experiments/oarc/ismar2021multi/ArExperimentOverlay.svelte';
    // TODO: this is specific to OGL engine, but we only need a generic object description structure
    import { createRandomObjectDescription } from '../../../core/engines/ogl/modelTemplates';
    import { peerIdStr, recentLocalisation, globalIsLocalized } from '../../../stateStore';
    import type webxr from '../../../core/engines/webxr';
    import type ogl from '../../../core/engines/ogl/ogl';
    import type { ObjectDescription } from '../../../types/xr';
    import { getAutomergeDocumentData } from '../../../core/p2pnetwork';

    let parentInstance: Parent;
    let xrEngine: webxr;
    let tdEngine: ogl;
    let hitTestSource: XRHitTestSource | undefined;
    let reticle: Transform | null = null; // TODO: Mesh instead of Transform

    let experimentIntervalId: ReturnType<typeof setInterval> | undefined;
    let doExperimentAutoPlacement = false;
    let experimentOverlay: ArExperimentOverlay;
    let settings: Writable<Record<string, unknown>> = writable({});

    let parentState = writable<{ hasLostTracking: boolean; isLocalized: boolean; localisation: boolean; isLocalisationDone: boolean; showFooter: boolean }>();
    setContext('state', parentState);

    $: {
        if ($globalIsLocalized && $recentLocalisation?.geopose?.position) {
            const assets = getAutomergeDocumentData();
            if (assets) {
                for (const asset of assets) {
                    onNetworkEvent({ object_created: asset });
                }
            }
        }
    }
    // Used to dispatch events to parent
    const dispatch = createEventDispatcher<{ broadcast: { event: string; value: any; routing_key?: string } }>();

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
            (xr, result, gl) => {
                if (gl) {
                    xr.glBinding = new XRWebGLBinding(result, gl);
                    xr.initCameraCapture(gl);
                }

                result
                    .requestReferenceSpace('viewer')
                    .then((refSpace) => result.requestHitTestSource?.({ space: refSpace }))
                    .then((source) => (hitTestSource = source));
            },
            ['dom-overlay', 'camera-access', 'anchors', 'hit-test', 'local-floor'],
            [],
        );

        tdEngine.setExperimentTapHandler(experimentTapHandler);
    }

    /**
     * Handles update loop when AR Cloud mode is used.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     * @param floorSpaceReference
     */
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, floorSpaceReference: XRSpace) {
        parentInstance.handlePoseHeartbeat();

        if (!hitTestSource) {
            parentInstance.onXrFrameUpdate(time, frame, floorPose);
            return;
        }

        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
            if ($settings.localizationRequired && !$parentState.isLocalized) {
                parentInstance.onXrFrameUpdate(time, frame, floorPose);
            } else {
                $parentState.showFooter = ($settings.showstats || ($settings.localizationRequired && !$parentState.isLocalisationDone)) as boolean;
                if (reticle === null) {
                    reticle = tdEngine.addReticle();
                }
                const reticlePose = hitTestResults[0].getPose(floorSpaceReference);
                const position = reticlePose?.transform.position;
                const orientation = reticlePose?.transform.orientation;
                if (position && orientation) {
                    tdEngine.updateReticlePose(reticle, new Vec3(position.x, position.y, position.z), new Quat(orientation.x, orientation.y, orientation.z, orientation.w));
                }
            }
        }

        xrEngine.setViewportForView(floorPose.views[0]);
        tdEngine.render(time, floorPose.views[0]);
    }

    /**
     * Let's the app know that the XRSession was closed.
     */
    function onXrSessionEnded() {
        if (hitTestSource != undefined) {
            hitTestSource.cancel();
            hitTestSource = undefined;
        }
        if (experimentIntervalId) {
            clearInterval(experimentIntervalId);
            experimentIntervalId = undefined;
        }
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

    function relocalize() {
        parentInstance.relocalize();
        reticle = null; // TODO: we should store the reticle inside tdEngine to avoid the need for explicit deletion here.
    }

    /**
     * There might be the case that a tap handler for off object taps. This is the place to handle that.
     *
     * Not meant for other usage than that.
     *
     * @param event  Event      The Javascript event object
     * @param auto  boolean     true when called from automatic placement interval
     */
    function experimentTapHandler() {
        if (reticle == null) {
            return;
        }
        if ($parentState.hasLostTracking) {
            return;
        }
        if ($settings.localizationRequired && !$parentState.isLocalisationDone) {
            return;
        }

        //NOTE: ISMAR2021 experiment:
        // keep track of last localization (global and local)
        // when tapped, determine the global position of the tap, and save the global location of the object
        // create SCR from the object and share it with the others
        // when received, place the same way as a downloaded SCR.
        const object_description = createRandomObjectDescription();
        shareObject(object_description, reticle.position, reticle.quaternion);
        experimentOverlay?.objectSent();
    }

    /**
     * Toggle automatic placement of placeholders for experiment mode.
     */
    function toggleExperimentalPlacement() {
        doExperimentAutoPlacement = !doExperimentAutoPlacement;

        if (doExperimentAutoPlacement) {
            experimentIntervalId = setInterval(() => experimentTapHandler(), 1000);
        } else {
            clearInterval(experimentIntervalId);
        }
    }

    function shareMessage(str: string) {
        let message_body = {
            message: str,
            sender: $peerIdStr,
            timestamp: new Date().getTime(),
        };
        dispatch('broadcast', {
            event: 'message_broadcasted',
            value: message_body,
        });
        console.log('Message sent: ' + message_body);
    }

    function shareObject(object_description: ObjectDescription, position: Vec3, quaternion: Quat) {
        const latestGlobalPose = $recentLocalisation.geopose;
        const latestLocalPose = $recentLocalisation.floorpose;
        if (latestGlobalPose === undefined || latestLocalPose === undefined) {
            console.log('There was no successful localization yet, cannot share object');
            return;
        }
        // Now calculate the global pose of the reticle
        const globalObjectPose = tdEngine.convertLocalPoseToGeoPose(position, quaternion);
        const geoPose = {
            position: {
                lat: globalObjectPose.position.lat,
                lon: globalObjectPose.position.lon,
                h: globalObjectPose.position.h,
            },
            quaternion: {
                x: globalObjectPose.quaternion.x,
                y: globalObjectPose.quaternion.y,
                z: globalObjectPose.quaternion.z,
                w: globalObjectPose.quaternion.w,
            },
        };
        // We create a new spatial content record just for sharing over the P2P network, not registering in the platform
        const object_id = $peerIdStr + '_' + uuidv4(); // TODO: only a proposal: the object id is the creator id plus a new uuid
        const scr_id = object_id;
        const content = {
            id: object_id,
            type: 'ephemeral', //high-level OSCP type
            title: object_description.shape,
            refs: [],
            geopose: geoPose,
            object_description: object_description,
        };
        const timestamp = new Date().getTime();
        const scr = {
            content: content,
            id: scr_id,
            tenant: 'ISMAR2021demo',
            type: 'scr',
            timestamp: timestamp,
        };
        const message_body = {
            scr: scr,
            sender: $peerIdStr,
            timestamp: new Date().getTime(),
        };
        // share over P2P network
        // NOTE: the dispatch method is part of Svelte's event system which takes one key-value pair
        // and the value will be forwarded to the p2pnetwork.js
        dispatch('broadcast', {
            event: 'object_created', // TODO: should be unique to the object instance or just to the creation event?
            value: message_body,
        });
    }

    /**
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events: any) {
        if (!('message_broadcasted' in events) && !('object_created' in events)) {
            console.log('Viewer-ISMAR2021Multi: Unknown event received:');
            console.log(events);
            // pass on to parent
            return parentInstance.onNetworkEvent(events);
        }

        if (get(recentLocalisation)?.geopose?.position == undefined) {
            // we need to localize at least once to be able to do anything
            console.log('Network event received but we are not localized yet!');
            console.log(events);
            return;
        }

        if ('message_broadcasted' in events) {
            const data = events.message_broadcasted;
            //if (data.sender != $peerIdStr) { // ignore own messages which are also delivered
            if ('message' in data && 'sender' in data) {
                console.log('message from ' + data.sender + ': \n  ' + data.message);
            }
            //}
        }

        if ('object_created' in events) {
            const data = events.object_created;
            //if (data.sender != $peerIdStr) { // ignore own messages which are also delivered
            const scr = data.scr;
            if ('tenant' in scr && scr.tenant === 'ISMAR2021demo') {
                parentInstance.placeContent([[scr]]); // WARNING: wrap into an array
                experimentOverlay?.objectReceived();
            }
            //}
        }
    }
</script>

<Parent bind:this={parentInstance} on:arSessionEnded>
    <svelte:fragment slot="overlay" let:isLocalizing let:isLocalized let:isLocalisationDone let:receivedContentTitles let:firstPoseReceived>
        {#if $settings.localizationRequired && !isLocalisationDone}
            <p>{receivedContentTitles.join()}</p>
            <ArCloudOverlay hasPose={firstPoseReceived} {isLocalizing} {isLocalized} on:startLocalisation={() => parentInstance.startLocalisation()} />
        {:else}
            <p>{receivedContentTitles.join()}</p>
            <ArExperimentOverlay bind:this={experimentOverlay} on:toggleAutoPlacement={() => toggleExperimentalPlacement()} on:relocalize={() => relocalize()} />
        {/if}
    </svelte:fragment>
</Parent>
