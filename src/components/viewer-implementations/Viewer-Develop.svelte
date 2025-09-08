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
    import { Quat, Vec3 } from 'ogl';
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
     * Special mode for sparcl development
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose     The pose of the device as reported by the XRFrame
     */
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose) {
        if (firstPoseReceived === false) {
            firstPoseReceived = true;

            // TODO: Fails for some reason
            // xrEngine.createRootAnchor(frame, tdEngine.getRootSceneUpdater());

            if ($debug_showLocalAxes) {
                tdEngine.addAxes();
            }

            for (let view of floorPose.views) {
                console.log('fake localisation');
                const geoPose = fakeLocationResult.geopose.geopose;
                onLocalizationSuccess(floorPose, geoPose);
                isLocalized = true;

                wait(1000).then(() => (showFooter = false));

                let data = fakeLocationResult.scrs;
                parentInstance.placeContent([data]);
            }
        }

        xrEngine.handleAnchors(frame);
        xrEngine.setViewportForView(floorPose.views[0]);
        parentInstance.handleExternalExperience(floorPose.views[0]);
        updateSensorVisualization();
        tdEngine.render(time, floorPose.views[0]);
    }
</script>

<Parent bind:this={parentInstance} on:arSessionEnded on:broadcast />
