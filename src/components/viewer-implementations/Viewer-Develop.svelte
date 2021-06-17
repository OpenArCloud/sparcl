<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Initializes and runs the AR session. Configuration will be according the data provided by the parent.
-->
<script>
    import Parent from '@components/Viewer';

    import { fakeLocationResult } from "@core/devTools";
    import { wait } from "@core/common";
    import { debug_showLocalAxes } from '@src/stateStore';


    let parentInstance, xrEngine, tdEngine;
    let firstPoseReceived = false, showFooter = false, isLocalized = false;


    /**
     * Verifies that AR is available as required by the provided configuration data, and starts the session.
     */
    export function startAr(thisWebxr, this3dEngine) {
        parentInstance.startAr(thisWebxr, this3dEngine);
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;

        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        parentInstance.startSession(update, parentInstance.onSessionEnded, parentInstance.onNoPose,
            () => {},
            ['dom-overlay', 'anchors', 'local-floor'],
        );
    }

    /**
     * Special mode for sparcl development
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose     The pose of the device as reported by the XRFrame
     */
    function update(time, frame, floorPose) {
        xrEngine.setViewPort();

        if (firstPoseReceived === false) {
            firstPoseReceived = true;

            // TODO: Fails for some reason
            // xrEngine.createRootAnchor(frame, tdEngine.getRootSceneUpdater());

            if ($debug_showLocalAxes) {
                tdEngine.addAxes();
            }

            for (let view of floorPose.views) {
                console.log('fake localisation');

                isLocalized = true;
                wait(1000).then(showFooter = false);

                let geoPose = fakeLocationResult.geopose.pose;
                let data = fakeLocationResult.scrs;
                parentInstance.placeContent(floorPose, geoPose, [data]);
            }
        }

        xrEngine.setViewportForView(floorPose.views[0]);
        parentInstance.handleExternalExperience(floorPose.views[0]);

        xrEngine.handleAnchors(frame);
        tdEngine.render(time, floorPose.views[0]);
    }
</script>

<Parent bind:this={parentInstance} {showFooter} {isLocalized} on:arSessionEnded on:brbroadcast />
