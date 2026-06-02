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
    import Parent from '@components/Viewer.svelte';
    import ArCloudOverlay from '@components/dom-overlays/ArCloudOverlay.svelte';
    import { PRIMITIVES } from '@core/contents/primitives';
    import type webxr from '@core/engines/webxr';
    import type { RenderingEngine } from '@core/engines/RenderingEngine';
    import type { RigidPose } from '@core/frameTransforms';
    import { quat, vec3 } from 'gl-matrix';
    import type { SceneNodeId } from '@core/engines/RenderingEngine';
    import type { ObjectDescription } from '../../core/contents/objectDescription';
    import type { XrFeature } from '../../types/xr';
    import { checkGLError } from '@core/devTools';
    import { myAgentName, myAgentId, myAgentColor, enableReticlePoseSharing, showOtherReticles } from '@src/stateStore';
    import { createEventDispatcher } from 'svelte';
    import type { Geopose } from '@oarc/scd-access';
    import * as worldAlignment from '@core/worldAlignment';

    let parentInstance: Parent;

    let myGl: WebGL2RenderingContext | null = null;

    let useReticle = true; // TODO: make selectable on the GUI
    let hitTestSource: XRHitTestSource | undefined;
    let reticleNodeId: SceneNodeId | null = null;
    let agentReticles: string[] = [];
    const dispatcher = createEventDispatcher();

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     */
    export function startAr(thisWebxr: webxr, this3dEngine: RenderingEngine) {
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
            (xr: webxr, session: XRSession, gl: WebGL2RenderingContext | null) => {
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

    function drawReticle({ localTargetPose, targetAgentId, color }: { localTargetPose: RigidPose; targetAgentId: string; color: [number, number, number, number] }) {
        const id: string = `${targetAgentId}_reticle`;
        const renderer = parentInstance.getRenderer();
        const nodeId: SceneNodeId | null = renderer.getDynamicObjectNodeId(id);
        const base = quat.fromValues(
            localTargetPose.orientation.x,
            localTargetPose.orientation.y,
            localTargetPose.orientation.z,
            localTargetPose.orientation.w,
        );
        const correction = quat.setAxisAngle(quat.create(), [1, 0, 0], Math.PI / 2);
        const torusQ = quat.multiply(quat.create(), base, correction);
        const correctedPose: RigidPose = {
            position: localTargetPose.position,
            orientation: { x: torusQ[0], y: torusQ[1], z: torusQ[2], w: torusQ[3] },
        };
        if (nodeId) {
            renderer.updateDynamicObjectWithRigidPose(id, correctedPose);
        } else {
            const description: ObjectDescription = {
                version: 2,
                color,
                shape: PRIMITIVES.torus,
                scale: [0.05, 0.05, 0.05],
                transparent: false,
                options: {},
            };
            renderer.addDynamicObjectWithRigidPose(id, correctedPose, description);
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

        if (!worldAlignment.hasActiveWorldAlignment()) {
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
                return;
            }

            const msg: { agent_id: string; geopose: Geopose; color: [number, number, number, number] } = events.reticle_update;
            const targetAgentId = msg.agent_id;
            const globalTargetPose = msg.geopose;
            const localTargetPose = worldAlignment.convertGeoPoseToLocalPose(globalTargetPose);
            const color = msg.color;
            drawReticle({ localTargetPose, targetAgentId, color });
        }
    }

    function shareReticlePose() {
        if (!$enableReticlePoseSharing || !worldAlignment.hasActiveWorldAlignment()) {
            return;
        }

        let message_body;
        const timestamp = Date.now();
        const tdEngine = parentInstance.getRenderer();
        if (reticleNodeId === null || !tdEngine.isNodeVisible(reticleNodeId)) {
            // If the reticle did not find a hitpoint, send a remove message
            // TODO: send 1 remove message, but not at every frame!
            message_body = {
                agent_id: $myAgentId,
                active: false,
                timestamp: timestamp,
            };
        } else {
            const reticlePosition = vec3.create();
            const reticleOrientation = quat.create();
            tdEngine.getNodePose(reticleNodeId, reticlePosition, reticleOrientation);
            const curReticleGeoPose = worldAlignment.convertScenePoseToGeoposeFromActive(
                { x: reticlePosition[0], y: reticlePosition[1], z: reticlePosition[2] },
                { x: reticleOrientation[0], y: reticleOrientation[1], z: reticleOrientation[2], w: reticleOrientation[3] },
            );
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
     * @param xrViewerPose The pose of the device as reported by the XRFrame
     * @param xrReferenceSpace
     */
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose, xrReferenceSpace: XRReferenceSpace | XRBoundedReferenceSpace) {
        if (useReticle && myGl) {
            const tdEngine = parentInstance.getRenderer();
            checkGLError(myGl, 'before creating reticle');
            if (reticleNodeId === null) {
                reticleNodeId = tdEngine.addReticle();
            }
            checkGLError(myGl, 'after creating reticle');

            if (hitTestSource === undefined) {
                console.log('HitTestSource is invalid! Cannot use reticle');
                tdEngine.setNodeVisible(reticleNodeId, false);
            } else {
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length > 0) {
                    const reticlePose = hitTestResults[0].getPose(xrReferenceSpace);
                    const position = reticlePose?.transform.position;
                    const orientation = reticlePose?.transform.orientation;
                    if (position && orientation) {
                        tdEngine.updateReticlePose(
                            reticleNodeId,
                            vec3.fromValues(position.x, position.y, position.z),
                            quat.fromValues(orientation.x, orientation.y, orientation.z, orientation.w)
                        );
                        tdEngine.setNodeVisible(reticleNodeId, true);
                    }
                } else {
                    tdEngine.setNodeVisible(reticleNodeId, false);
                }
            }

            // hide if there was no localization yet
            if (!worldAlignment.hasActiveWorldAlignment()) {
                tdEngine.setNodeVisible(reticleNodeId, false);
            }

            if ($enableReticlePoseSharing) {
                shareReticlePose();
            }
        } // useReticle

        // Call parent Viewer's onXrFrameUpdate which performs localization and rendering
        parentInstance.onXrFrameUpdate(time, frame, xrViewerPose); // this renders scene and captures the camera image for localization
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
        reticleNodeId = null; // TODO: we should store the reticle inside tdEngine to avoid the need for explicit deletion here.
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
                let model1 = parentInstance.getRenderer().getDynamicObjectNodeId(agentId);
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

<Parent
    bind:this={parentInstance}
    on:arSessionEnded
    on:broadcast
    on:worldAlignmentEstablished
    on:worldAlignmentCleared
>
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
