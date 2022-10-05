<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Initializes and runs the AR session. Configuration will be according the data provided by the parent.
-->
<script>
    import Parent from '@components/Viewer';
    import ArCloudOverlay from '@components/dom-overlays/ArCloudOverlay';

    let parentInstance;


    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     */
    export function startAr(thisWebxr, this3dEngine) {
        parentInstance.startAr(thisWebxr, this3dEngine);

        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        parentInstance.startSession(parentInstance.update, parentInstance.onSessionEnded, parentInstance.onNoPose,
            (xr, result, gl) => {
                xr.glBinding = new XRWebGLBinding(result, gl);
                xr.initCameraCapture(gl);
            },
            ['dom-overlay', 'camera-access', 'anchors', 'local-floor'],
        );
    }
    /**
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events) {
        // Viewer-Marker cannot handle any events currently
        console.log('Viewer-Oscp: Unknown event received:');
        console.log(events);
        // pass on to parent
        return parentInstance.onNetworkEvent(events);
    }

</script>

<Parent 
    bind:this={parentInstance}
    on:arSessionEnded
    on:broadcast>

    <svelte:fragment slot="overlay"
        let:isLocalizing
        let:isLocalized
        let:isLocalisationDone
        let:firstPoseReceived
        let:receivedContentTitles
        >
        <ArCloudOverlay
            hasPose="{firstPoseReceived}"
            isLocalizing="{isLocalizing}"
            isLocalized="{isLocalized}"
            receivedContentTitles="{receivedContentTitles}"
            on:startLocalisation={() => parentInstance.startLocalisation()}
            on:relocalize={() => parentInstance.relocalize()}
        />
    </svelte:fragment>
</Parent>
