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
    import { get } from 'svelte/store';
    import Parent from '@components/Viewer.svelte';
    import ArCloudOverlay from '@components/dom-overlays/ArCloudOverlay.svelte';
    import { PRIMITIVES } from '../../core/engines/ogl/modelTemplates';
    import type webxr from '@core/engines/webxr';
    import type ogl from '@core/engines/ogl/ogl';
    import { Quat, type OGLRenderingContext, type Transform, Vec3, Mesh } from 'ogl';
    import type { ObjectDescription, XrFeature } from '../../types/xr';
    import { checkGLError } from '@core/devTools';
    import { myAgentName, myAgentId, myAgentColor, recentLocalisation, enableReticlePoseSharing, showOtherReticles } from '@src/stateStore';
    import { createEventDispatcher } from 'svelte';
    import type { Geopose } from '@oarc/scd-access';

    let parentInstance: Parent;

    let myGl: OGLRenderingContext | null = null;

    let useReticle = true; // TODO: make selectable on the GUI
    let hitTestSource: XRHitTestSource | undefined;
    let reticle: Transform | null = null; // TODO: should be Mesh
    let agentReticles: string[] = [];
    const dispatcher = createEventDispatcher();

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     */
    export function startAr(thisWebxr: webxr, this3dEngine: ogl) {
        parentInstance.startAr(thisWebxr, this3dEngine);
        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        let requiredXrFeatures: XrFeature[] = ['dom-overlay', 'camera-access', 'anchors', 'local-floor'];
        let optionalXrFeatures: XrFeature[] = [];

        // TODO: do we need anchors at all?

        // TODO: move the whole reticle and tap handler stuff into the base Viewer
        if (useReticle) {
            requiredXrFeatures.push('hit-test');
            // our callback for hit test results (event handler for screen tap)
        }

        await parentInstance.startSession(
            onXrFrameUpdate,
            onXrSessionEnded,
            onXrNoPose,
            (xr: webxr, session: XRSession, gl: OGLRenderingContext | null) => {
                if (!gl) {
                    throw new Error('gl is undefined');
                }
                xr.glBinding = new XRWebGLBinding(session, gl);
                xr.initCameraCapture(gl);
                myGl = gl;
                if (useReticle) {
                    // request hit testing
                    session
                        .requestReferenceSpace('viewer')
                        .then((refSpace) => session.requestHitTestSource?.({ space: refSpace }))
                        .then((source) => (hitTestSource = source));
                }
            },
            requiredXrFeatures,
            optionalXrFeatures,
        );
    }

    function drawReticle({ localTargetPose, targetAgentId, color }: { localTargetPose: Transform; targetAgentId: string; color: [number, number, number, number] }) {
        const id = `${targetAgentId}_reticle`;
        const mesh = parentInstance.getRenderer().getDynamicObjectMesh(id);
        const xrQuatCorrection = new Quat().fromAxisAngle(new Vec3(1, 0, 0), Math.PI / 2); // to make the torus flat on the surface
        const torusQuaternion = new Quat().copy(localTargetPose.quaternion).multiply(xrQuatCorrection);
        if (mesh) {
            mesh.position.copy(localTargetPose.position);
            mesh.quaternion.copy(torusQuaternion);
        } else {
            const description: ObjectDescription = {
                version: 2,
                color,
                shape: PRIMITIVES.torus,
                scale: [0.05, 0.05, 0.05],
                transparent: false,
                options: {},
            };
            const node = parentInstance.getRenderer().addDynamicObject(id, localTargetPose.position, torusQuaternion, description);
            agentReticles.push(id);
        }
    }

    function removeReticle(targetAgentId: string) {
        const id = `${targetAgentId}_reticle`;
        if (agentReticles.includes(id)) {
            parentInstance.getRenderer().removeDynamicObject(id);
            agentReticles = agentReticles.filter((r) => r !== id);
        }
    }

    /**
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events: any) {
        // Simply print any other events and return
        if (!('agent_geopose_updated' in events) && !('reticle_update' in events)) {
            console.log('Viewer-Oscp: Unknown event received:');
            console.log(events);
            // pass on to parent
            return parentInstance.onNetworkEvent(events);
        }

        if (get(recentLocalisation)?.geopose?.position == undefined) {
            // we need to localize at least once to be able to do anything
            //console.log('Network event received but we are not localized yet!');
            //console.log(events);
            return;
        }

        if ('agent_geopose_updated' in events) {
            // this event must be passed to the main Viewer
            parentInstance.onNetworkEvent(events);
        }

        if ('reticle_update' in events) {
            if (!$showOtherReticles) {
                return;
            }

            if (events.reticle_update.active === false) {
                removeReticle(events.reticle_update.agent_id);
            }

            const msg: { agent_id: string; geopose: Geopose; color: [number, number, number, number] } = events.reticle_update;
            const targetAgentId = msg.agent_id;
            const globalTargetPose = msg.geopose;
            const localTargetPose = parentInstance.getRenderer().convertGeoPoseToLocalPose(globalTargetPose);
            const color = msg.color;
            drawReticle({ localTargetPose, targetAgentId, color });
        }
    }

    function shareReticlePose() {
        const timestamp = Date.now();
        let curReticleGeoPose: Geopose;
        if (reticle && reticle.visible) {
            let curReticleLocalPose: { position: Vec3; quaternion: Quat };
            curReticleLocalPose = { position: reticle.position, quaternion: reticle.quaternion };
            curReticleGeoPose = parentInstance.getRenderer().convertLocalPoseToGeoPose(curReticleLocalPose.position, curReticleLocalPose.quaternion);
        } else {
            // If the reticle did not find a hitpoint, do not share anything
            return;
        }

        let message_body;
        if ($enableReticlePoseSharing) {
            message_body = {
                agent_id: $myAgentId,
                avatar: {
                    name: $myAgentName,
                    color: $myAgentColor || { r: 0, g: 0, b: 0, a: 0 },
                },
                active: true,
                geopose: curReticleGeoPose,
                timestamp: timestamp,
            };
        } else {
            // TODO send only a single remove message
            message_body = {
                agent_id: $myAgentId,
                active: false,
            };
        }

        const rmq_topic_reticle_update = import.meta.env.VITE_RMQ_TOPIC_RETICLE_UPDATE;
        if (!rmq_topic_reticle_update) {
            console.error('rmq_topic_reticle_update is not defined!');
            return;
        }
        const routing_key = rmq_topic_reticle_update + '.' + String($myAgentId);
        dispatcher('broadcast', {
            event: 'publish_reticle_pose',
            value: message_body,
            routing_key: routing_key,
        });
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
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, floorSpaceReference: XRReferenceSpace | XRBoundedReferenceSpace) {
        if (useReticle && myGl) {
            checkGLError(myGl, 'before creating reticle');
            if (reticle == undefined || reticle == null) {
                reticle = parentInstance.getRenderer().addReticle();
            }
            checkGLError(myGl, 'after creating reticle');

            if (hitTestSource === undefined) {
                console.log('HitTestSource is invalid! Cannot use reticle');
                reticle.visible = false;
            } else {
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length > 0) {
                    const reticlePose = hitTestResults[0].getPose(floorSpaceReference);
                    const position = reticlePose?.transform.position;
                    const orientation = reticlePose?.transform.orientation;
                    if (position && orientation) {
                        parentInstance.getRenderer().updateReticlePose(reticle, new Vec3(position.x, position.y, position.z), new Quat(orientation.x, orientation.y, orientation.z, orientation.w));
                        reticle.visible = true;
                    }
                } else {
                    reticle.visible = false;
                }
            }

            // hide if there was no localization yet
            if ($recentLocalisation.geopose?.position === undefined) {
                reticle.visible = false;
            }

            if ($enableReticlePoseSharing) {
                shareReticlePose();
            }
        } // useReticle

        // Call parent Viewer's onXrFrameUpdate which performs localization and rendering
        parentInstance.onXrFrameUpdate(time, frame, floorPose); // this renders scene and captures the camera image for localization
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

    /**
     * Called when the XRSession was closed.
     */
    function onXrSessionEnded() {
        if (hitTestSource != undefined) {
            hitTestSource.cancel();
            hitTestSource = undefined;
        }
        parentInstance.onXrSessionEnded();
    }

    function onRelocalize() {
        reticle = null; // TODO: we should store the reticle inside tdEngine to avoid the need for explicit deletion here.
        parentInstance.relocalize();
    }

    function onShowOtherReticlesCheckboxChange(event: CustomEvent<any>) {
        // remove any reticle models from the scene (if any)
        if (!event.detail.checked) {
            for (const id of agentReticles) {
                parentInstance.getRenderer().removeDynamicObject(id);
            }
        }
    }

    function onShowOtherCamerasCheckboxChange(event: CustomEvent<any>) {
        // remove any agent models from the scene (if any)
        if (!event.detail.checked) {
            for (const agentId in parentInstance.getAgentInfo()) {
                // remove dynamic object representation (if exists)
                let model1 = parentInstance.getRenderer().getDynamicObjectMesh(agentId);
                if (model1) {
                    console.log('removed agent dynamic object ' + agentId);
                    parentInstance.getRenderer().removeDynamicObject(agentId);
                }
                // remove GLTF representation (if exists)
                let model2 = parentInstance.getRenderer().getModel(agentId);
                if (model2) {
                    console.log('removed agent GLTF ' + agentId);
                    parentInstance.getRenderer().removeModel(agentId);
                }
            }
        }
    }
</script>

<Parent bind:this={parentInstance} on:arSessionEnded on:broadcast>
    <svelte:fragment slot="overlay" let:isLocalizing let:isLocalized let:isLocalisationDone let:firstPoseReceived let:receivedContentTitles>
        <ArCloudOverlay
            hasPose={firstPoseReceived}
            {isLocalizing}
            {isLocalized}
            {receivedContentTitles}
            on:startLocalisation={() => parentInstance.startLocalisation()}
            on:showOtherReticlesCheckboxChange={(event) => onShowOtherReticlesCheckboxChange(event)}
            on:relocalize={() => onRelocalize()}
        />
    </svelte:fragment>
</Parent>
