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

    import { creatorModeSettings } from '@src/stateStore';
    import { movePhoneMessage } from '@src/contentStore';
    import { CREATIONTYPES } from '@core/common';
    import type webxr from '@src/core/engines/webxr';
    import type { RenderingEngine } from '@core/engines/RenderingEngine';
    import type { SceneNodeId } from '@core/engines/RenderingEngine';
    import { quat, vec3 } from 'gl-matrix';

    let parentInstance: Parent;
    let xrEngine: webxr;
    let tdEngine: RenderingEngine;

    let creatorObjectNodeId: SceneNodeId | null = null;
    let frameSetupErrorLogged = false;

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     */
    export function startAr(thisWebxr: webxr, this3dEngine: RenderingEngine) {
        parentInstance.startAr(thisWebxr, this3dEngine);
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;
        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        await parentInstance.startSession(onXrFrameUpdate, parentInstance.onXrSessionEnded, parentInstance.onXrNoPose, () => {}, ['dom-overlay', 'anchors', 'local-floor'], []);
    }

    /**
     * Special mode for content creators.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param xrViewerPose The pose of the device as reported by the XRFrame
     */
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose) {
        // Must run before mode-specific work. A throw later in this callback used to skip it,
        // which left the tracking-lost indicator red for the whole session.
        parentInstance.handlePoseHeartbeat();

        try {
            if (!creatorObjectNodeId) {
                const position = vec3.fromValues(0, 0, -2);
                const orientation = quat.create();

                if ($creatorModeSettings.type === CREATIONTYPES.placeholder) {
                    creatorObjectNodeId = tdEngine.addPlaceholder($creatorModeSettings.shape, position, orientation);
                } else if ($creatorModeSettings.type === CREATIONTYPES.model) {
                    creatorObjectNodeId = tdEngine.addModel($creatorModeSettings.modelurl, position, orientation);
                } else if ($creatorModeSettings.type === CREATIONTYPES.scene) {
                    const experiencePlaceholderObject = tdEngine.addExperiencePlaceholder(position, orientation);
                    creatorObjectNodeId = experiencePlaceholderObject;
                    tdEngine.addClickEvent(experiencePlaceholderObject, () => parentInstance.experienceLoadHandler(experiencePlaceholderObject, position, orientation, $creatorModeSettings.sceneurl));
                } else if (!frameSetupErrorLogged) {
                    frameSetupErrorLogged = true;
                    console.error('Unknown creator type:', $creatorModeSettings.type);
                }
            }

            xrEngine.handleAnchors(frame);
        } catch (error) {
            if (!frameSetupErrorLogged) {
                frameSetupErrorLogged = true;
                console.error('Create mode frame setup failed:', error);
            }
        }

        for (const view of xrViewerPose.views) {
            xrEngine.setViewportForView(view);
            parentInstance.handleExternalExperience(view);
            tdEngine.render(time, view);
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
    <svelte:fragment slot="overlay" let:firstPoseReceived>
        {#if !firstPoseReceived}
            <p>{$movePhoneMessage}</p>
        {:else}
            <p>Content creation · {$creatorModeSettings.type}</p>
        {/if}
    </svelte:fragment>
</Parent>
