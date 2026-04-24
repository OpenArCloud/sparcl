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

    import { fakeLocationResult2 as fakeLocationResult } from '@core/devTools';
    import { wait } from '@core/common';
    import { debug_showLocalAxes } from '@src/stateStore';
    import type webxr from '../../core/engines/webxr';
    import type ogl from '../../core/engines/ogl/ogl';
    import type { Geopose } from '@oarc/scd-access';
    import * as worldAlignment from '@core/worldAlignment';
    import { updateSensorVisualization } from '@src/features/sensor-visualizer';

    let parentInstance: Parent;
    let xrEngine: webxr;
    let tdEngine: ogl;

    let firstPoseReceived = false;
    let showFooter = false;
    let isLocalized = false;

    /**
     * Verifies that AR is available as required by the provided configuration data, and starts the session.
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

    /*
     * @param localImageXrPose XRPose      The pose of the camera when localisation was started in local reference space
     * @param globalImagePose  GeoPose       The global camera GeoPose as returned from the GeoPose service
     */
    export function onLocalizationSuccess(localImageXrPose: XRPose, globalImagePose: Geopose) {
        const localImagePose: WebXrRigidPose = {
            position: {
                x: localImageXrPose.transform.position.x,
                y: localImageXrPose.transform.position.y,
                z: localImageXrPose.transform.position.z,
            },
            orientation: {
                x: localImageXrPose.transform.orientation.x,
                y: localImageXrPose.transform.orientation.y,
                z: localImageXrPose.transform.orientation.z,
                w: localImageXrPose.transform.orientation.w,
            },
        };
        const mats = worldAlignment.setActiveGeoAlignmentFromCapture(localImagePose, globalImagePose);
        tdEngine.addDebugAxesAtWorldMatrix(worldAlignment.mat4LocalizationDebugArCamera(localImagePose), [1, 1, 0, 0.5]); // yellow
        tdEngine.addDebugAxesAtWorldMatrix(worldAlignment.mat4LocalizationDebugGeoCamera(globalImagePose, mats.tSceneFromRef), [0, 1, 1, 0.5]); // cyan
        tdEngine.addDebugAxesAtWorldMatrix(worldAlignment.mat4LocalizationDebugEnuAxes(globalImagePose, mats.tSceneFromRef), [1, 1, 1, 0.5]); // white
    }

    /**
     * Special mode for sparcl development
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param xrViewerPose     The pose of the device as reported by the XRFrame
     */
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose) {
        if (firstPoseReceived === false) {
            firstPoseReceived = true;

            // TODO: Fails for some reason
            // xrEngine.createRootAnchor(frame, tdEngine.getRootSceneUpdater());

            if ($debug_showLocalAxes) {
                tdEngine.addAxes();
            }

            for (let view of xrViewerPose.views) {
                console.log('fake localisation');
                const geoPose = fakeLocationResult.geopose.geopose;
                onLocalizationSuccess(xrViewerPose, geoPose);
                isLocalized = true;

                wait(1000).then(() => (showFooter = false));

                let data = fakeLocationResult.scrs;
                parentInstance.placeContent([data]);
            }
        }

        xrEngine.handleAnchors(frame);
        xrEngine.setViewportForView(xrViewerPose.views[0]);
        parentInstance.handleExternalExperience(xrViewerPose.views[0]);
        updateSensorVisualization();
        tdEngine.render(time, xrViewerPose.views[0]);
    }
</script>

<Parent bind:this={parentInstance} on:arSessionEnded on:broadcast />
