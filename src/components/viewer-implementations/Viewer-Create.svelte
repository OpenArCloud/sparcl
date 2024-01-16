<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Initializes and runs the AR session. Configuration will be according the data provided by the parent.
-->
<script>
    import Parent from '@components/Viewer.svelte';

    import { debug_showLocalAxes, creatorModeSettings } from '@src/stateStore';
    import { CREATIONTYPES } from '@core/common';


    let parentInstance, xrEngine, tdEngine;

    let firstPoseReceived = false;
    let showFooter = false;

    let creatorObject = null;

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
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
        await parentInstance.startSession(onXrFrameUpdate, parentInstance.onXrSessionEnded, parentInstance.onXrNoPose,
            () => {},
            ['dom-overlay', 'anchors', 'local-floor'],
        );
    }

    /**
     * Special mode for content creators.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     */
    function onXrFrameUpdate(time, frame, floorPose) {
        showFooter = false;

        xrEngine.setViewPort();

        if (firstPoseReceived === false) {
            firstPoseReceived = true;

            // TODO: Fails for some reason
            // xrEngine.createRootAnchor(frame, tdEngine.getRootSceneUpdater());

            if ($debug_showLocalAxes) {
                tdEngine.addAxes();
            }
        }

        if (!creatorObject) {
            const position = {x: 0, y: 0, z: -2};
            const orientation = {x: 0, y: 0, z: 0, w: 1};

            if ($creatorModeSettings.type === CREATIONTYPES.placeholder) {
                creatorObject = tdEngine.addPlaceholder($creatorModeSettings.shape, position, orientation);
            } else if ($creatorModeSettings.type === CREATIONTYPES.model) {
                creatorObject = tdEngine.addModel(position, orientation, $creatorModeSettings.modelurl);
            } else if ($creatorModeSettings.type === CREATIONTYPES.scene) {
                creatorObject = tdEngine.addExperiencePlaceholder(position, orientation);
                tdEngine.addClickEvent(creatorObject,
                    () => parentInstance.experienceLoadHandler(creatorObject, position, orientation, $creatorModeSettings.sceneurl));
            } else {
                console.log('unknown creator type');
            }
        }

        for (let view of floorPose.views) {
            xrEngine.setViewportForView(view);
            parentInstance.handleExternalExperience(view);
        }

        xrEngine.handleAnchors(frame);
        tdEngine.render(time, floorPose.views[0]);
    }
</script>

<!-- TODO: showFooter is not passed correctly -->
<Parent bind:this={parentInstance}
    {showFooter}
    on:arSessionEnded
    on:broadcast
/>
