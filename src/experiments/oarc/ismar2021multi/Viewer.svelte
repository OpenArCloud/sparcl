<script>
    import { setContext } from 'svelte';
    import { writable } from 'svelte/store';

    import Parent from '@components/Viewer.svelte';

    import ArCloudOverlay from "@components/dom-overlays/ArCloudOverlay.svelte";
    import ArExperimentOverlay from '@experiments/oarc/ismar2021multi/ArExperimentOverlay.svelte';
    import { PRIMITIVES } from "@core/engines/ogl/modelTemplates";

    let parentInstance, xrEngine, tdEngine;
    let hitTestSource, reticle, hasLostTracking = true
    let settings;
    let experimentOverlay;

    let parentState = writable();
    setContext('state', parentState);

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     * @param options  { settings }       Options provided by the app. Currently contains the settings from the Dashboard
     */
     export function startAr(thisWebxr, this3dEngine, options) {
        parentInstance.startAr(thisWebxr, this3dEngine);
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;

        settings = options?.settings || {};

        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    function startSession() {
        parentInstance.startSession(update, onSessionEnded, onNoPose,
            (xr, result, gl) => {
                xr.glBinding = new XRWebGLBinding(result, gl);
                xr.initCameraCapture(gl);

                result.requestReferenceSpace('viewer')
                    .then(refSpace => result.requestHitTestSource({ space: refSpace }))
                    .then(source => hitTestSource = source);
            },
            ['dom-overlay', 'camera-access', 'anchors', 'hit-test', 'local-floor'],
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
     function update(time, frame, floorPose, floorSpaceReference) {
        console.log("update()")
        hasLostTracking = false;

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0) {
                const reticlePose = hitTestResults[0].getPose(floorSpaceReference);

                if ($settings.localisation && !$parentState.isLocalized) {
                    parentInstance.update(time, frame, floorPose);
                } else {
                    $parentState.showFooter = $settings.showstats
                        || ($settings.localisation && !$parentState.isLocalisationDone);

                    xrEngine.setViewPort();

                    if (!reticle) {
                        reticle = tdEngine.addReticle();
                    }

                    const position = reticlePose.transform.position;
                    const orientation = reticlePose.transform.orientation;
                    tdEngine.updateReticlePose(reticle, position, orientation);
                    tdEngine.render(time, floorPose.views[0]);
                }
            } else {
                tdEngine.render(time, floorPose.views[0]);
            }
        }
    }

    /**
     * Let's the app know that the XRSession was closed.
     */
     function onSessionEnded() {
        if (hitTestSource) {
            hitTestSource.cancel();
            hitTestSource = null;
        }
        parentInstance.onSessionEnded();
    }

    /**
     * Called when no pose was reported from WebXR.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame  XRFrame        The XRFrame provided to the update loop
     * @param floorPose  XRPose     The pose of the device as reported by the XRFrame
     */
     function onNoPose(time, frame, floorPose) {
        parentInstance.onNoPose(time, frame, floorPose);
        hasLostTracking = true;
    }

//////////////////////////////////
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
/*
    function handleExperiment(time, frame, floorPose, reticlePose, frameDuration, passedMaxSlow) {
        if ($settings.localisation && !isLocalized) {
            handleOscp(time, frame, floorPose);
        } else {
            handlePoseHeartbeat();
            showFooter = $settings.showstats
                || ($settings.localisation && !$parentState.isLocalisationDone);
            xrEngine.setViewPort();
            if (!reticle) {
                reticle = tdEngine.addReticle();
            }
            const position = reticlePose.transform.position;
            const orientation = reticlePose.transform.orientation;
            tdEngine.updateReticlePose(reticle, position, orientation);
            tdEngine.render(time, floorPose.views[0]);
        }
    }
*/

    /**
     * There might be the case that a tap handler for off object taps. This is the place to handle that.
     *
     * Not meant for other usage than that.
     *
     * @param event  Event      The Javascript event object
     * @param auto  boolean     true when called from automatic placement interval
     */
    function experimentTapHandler(event) {
        console.log("tapped!");
        if (!hasLostTracking && reticle) {
            //const index = Math.floor(Math.random() * 5);
            //const shape = Object.values(PRIMITIVES)[index];
            //const options = {attributes: {}};
            //const isHorizontal = tdEngine.isHorizontal(reticle);

            //NOTE: ISMAR2021 experiment:
            // keep track of last localization (global and local)
            // when tapped, determine the global position of the tap, and save the global location of the object
            // create SCR from the object and share it with the others
            // when received, place the same way as a downloaded SCR.
            if ($parentState.isLocalisationDone) {
                shareMessage("Hello from " + $parentState.peerIdStr + " sent at " + new Date().getTime());
                let object_description = createRandomObjectDescription();

                tdEngine.addObject(reticle.position, reticle.quaternion, object_description);

                //shareObject(object_description, reticle.position, reticle.quaternion);
                //shareCamera(tdEngine.getCamera().position, tdEngine.getCamera().quaternion);

                experimentOverlay?.objectPlaced();
            }
        }
    }

    function shareCamera(position, quaternion) {
        let object_description = {
            'version': 2,
            'color': [1.0, 1.0, 0.0, 0.2],
            'shape': PRIMITIVES.box,
            'scale': [0.05, 0.05, 0.05],
            'transparent': true,
            'options': {}
        };
        shareObject(object_description, position, quaternion);
    }

    function shareMessage(str) {
        let message_body = {
            "message": str,
            "sender": $parentState.peerIdStr,
            "timestamp": new Date().getTime()
        }
        dispatch('broadcast', {
                event: 'message_broadcasted',
                value: message_body
            });
        console.log("Message sent: " + message_body)
    }

    function shareObject(object_description, position, quaternion) {
        let latestGlobalPose = $parentState.recentLocalisation.geopose;
        let latestLocalPose = $parentState.recentLocalisation.floorpose;
        if (latestGlobalPose === undefined || latestLocalPose === undefined) {
            console.log("There was no successful localization yet, cannot share object");
            return;
        }
        // Now calculate the global pose of the reticle
        let globalObjectPose = tdEngine.convertLocalPoseToGeoPose(position, quaternion);
        let geoPose = {
            "longitude": globalObjectPose.longitude,
            "latitude": globalObjectPose.latitude,
            "ellipsoidHeight": globalObjectPose.ellipsoidHeight,
            "quaternion": {
                "x": globalObjectPose.quaternion.x,
                "y": globalObjectPose.quaternion.y,
                "z": globalObjectPose.quaternion.z,
                "w": globalObjectPose.quaternion.w
            }
        }
        let content = {
            "id": "",
            "type": "", //high-level OSCP type
            "title": object_description.shape,
            "refs": [],
            "geopose": geoPose,
            "object_description": object_description
        }
        let timestamp = new Date().getTime();
        // We create a new spatial content record just for sharing over the P2P network, not registering in the platform
        let object_id = $parentState.peerIdStr + '_' +  uuidv4(); // TODO: only a proposal: the object id is the creator id plus a new uuid
        let scr = {
            "content": content,
            "id": object_id,
            "tenant": "ISMAR2021demo",
            "type": "scr-ephemeral",
            "timestamp": timestamp
        }
        let message_body = {
            "scr": scr,
            "sender": $parentState.peerIdStr,
            "timestamp": new Date().getTime()
        }
        // share over P2P network
        // NOTE: the dispatch method is part of Svelte's event system which takes one key-value pair
        // and the value will be forwarded to the p2pnetwork.js
        dispatch('broadcast', {
                event: 'object_created', // TODO: should be unique to the object instance or just to the creation event?
                value: message_body
            });
    }

</script>

<Parent bind:this={parentInstance} on:arSessionEnded>
    <svelte:fragment slot="overlay" let:isLocalizing let:isLocalized
                     let:isLocalisationDone let:receivedContentNames let:firstPoseReceived>
        {#if $settings.localisation && !isLocalisationDone}
            <p>{receivedContentNames.join()}</p>
            <ArCloudOverlay hasPose="{firstPoseReceived}" {isLocalizing} {isLocalized}
                            on:startLocalisation={() => parentInstance.startLocalisation()} />
        {:else}
            <p>{receivedContentNames.join()}</p>
            <ArExperimentOverlay bind:this={experimentOverlay} {settings}
                                 on:relocalize={() => parentInstance.relocalize()} />
        {/if}
    </svelte:fragment>
</Parent>
