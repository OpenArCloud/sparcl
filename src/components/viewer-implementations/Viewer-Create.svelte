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

    import { debug_showLocalAxes, creatorModeSettings } from '@src/stateStore';
    import { CREATIONTYPES } from '@core/common';
    import type webxr from '@src/core/engines/webxr';
    import type ogl from '@src/core/engines/ogl/ogl';
    import { Vec3, Mesh, Transform, Quat } from 'ogl';

    let parentInstance: Parent;
    let xrEngine: webxr;
    let tdEngine: ogl;

    let firstPoseReceived = false;
    let showFooter = false;

    let creatorObject: Transform | Mesh | null = null;

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     */
    export function startAr(thisWebxr: webxr, this3dEngine: ogl) {
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
     * @param floorPose The pose of the device as reported by the XRFrame
     */
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose) {
        showFooter = false;

        if (firstPoseReceived === false) {
            firstPoseReceived = true;

            // TODO: Fails for some reason
            // xrEngine.createRootAnchor(frame, tdEngine.getRootSceneUpdater());

            if ($debug_showLocalAxes) {
                tdEngine.addAxes();
            }
        }

        if (!creatorObject) {
            const position = new Vec3(0, 0, -2);
            const orientation = new Quat(0, 0, 0, 1);

            if ($creatorModeSettings.type === CREATIONTYPES.placeholder) {
                creatorObject = tdEngine.addPlaceholder($creatorModeSettings.shape, position, orientation);
            } else if ($creatorModeSettings.type === CREATIONTYPES.model) {
                creatorObject = tdEngine.addModel($creatorModeSettings.modelurl, position, orientation).transform;
            } else if ($creatorModeSettings.type === CREATIONTYPES.scene) {
                const experiencePlaceholderObject = tdEngine.addExperiencePlaceholder(position, orientation);
                creatorObject = experiencePlaceholderObject;
                tdEngine.addClickEvent(experiencePlaceholderObject, () => parentInstance.experienceLoadHandler(experiencePlaceholderObject, position, orientation, $creatorModeSettings.sceneurl));
            } else {
                console.log('unknown creator type');
            }
        }

        xrEngine.handleAnchors(frame);
        for (let view of floorPose.views) {
            xrEngine.setViewportForView(view);
            parentInstance.handleExternalExperience(view);
            tdEngine.render(time, view);
        }
    }
</script>

<Parent bind:this={parentInstance} on:arSessionEnded on:broadcast />
