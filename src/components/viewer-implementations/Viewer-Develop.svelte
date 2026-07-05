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
    import type { RenderingEngine } from '@core/engines/RenderingEngine';
    import type { Geopose } from '@oarc/scd-access';
    import type { WebXrRigidPose } from '@core/frameTransforms';

    let parentInstance: Parent;
    let xrEngine: webxr;
    let tdEngine: RenderingEngine;

    let firstPoseReceived = false;
    let showFooter = false;
    let isLocalized = false;

    /**
     * Verifies that AR is available as required by the provided configuration data, and starts the session.
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
     * @param localImagePose Camera image pose in local WebXR coordinates at the time of capture (from {@link XRView.transform}).
     * @param globalImagePose GeoPose of the image from the Visual Positioning Service
     */
    export function onGeoPoseLocalizationSuccess(localImagePose: WebXrRigidPose, globalImagePose: Geopose) {
        parentInstance.onGeoPoseLocalizationSuccess(localImagePose, globalImagePose);
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

            // Use the primary view (views[0]) for localImagePose and this is assumed to match the fake GeoPose
            // Using the same GeoPose for each view.transform would mis-align other eyes in rig mode.
            const imageView = xrViewerPose.views[0];
            if (imageView) {
                console.log('fake localisation');
                const fakeGeoPose = fakeLocationResult.geopose.geopose;
                const t = imageView.transform;
                const localImagePose: WebXrRigidPose = {
                    position: { x: t.position.x, y: t.position.y, z: t.position.z },
                    orientation: { x: t.orientation.x, y: t.orientation.y, z: t.orientation.z, w: t.orientation.w },
                };
                onGeoPoseLocalizationSuccess(localImagePose, fakeGeoPose);
                isLocalized = true;

                wait(1000).then(() => (showFooter = false));

                let data = fakeLocationResult.scrs;
                parentInstance.placeContent([data]);
            }
        }

        xrEngine.handleAnchors(frame);
        xrEngine.setViewportForView(xrViewerPose.views[0]);
        parentInstance.handleExternalExperience(xrViewerPose.views[0]);
        tdEngine.render(time, xrViewerPose.views[0]);
    }
</script>

<Parent
    bind:this={parentInstance}
    on:arSessionEnded
    on:broadcast
    on:worldAlignmentEstablished
    on:worldAlignmentCleared
/>
