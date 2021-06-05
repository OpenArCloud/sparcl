<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Initializes and runs the AR session. Configuration will be according the data provided by the parent.
-->
<script>
    import Parent from '@components/Viewer';


    const message = (msg) => console.log(msg);

    let parentInstance;


    /**
     * Initial setup.
     */
    export function startAr(thisWebxr, this3dEngine) {
        parentInstance.startAr(thisWebxr, this3dEngine);

        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        parentInstance.startSession(update, onSessionEnded, onNoPose,
            (xr, result, gl) => {
                xr.glBinding = new XRWebGLBinding(result, gl);
                xr.initCameraCapture(gl);
            },
            ['dom-overlay', 'camera-access', 'anchors', 'local-floor'],
        );
    }

    /**
     * Handles update loop when AR Cloud mode is used.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     */
    function update(time, frame, floorPose) {
        parentInstance.update(time, frame, floorPose);
    }

    /**
     * Called when no pose was reported from WebXR.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame  XRFrame        The XRFrame provided to the update loop
     * @param floorPose  XRPose     The pose of the device as reported by the XRFrame
     */
    function onNoPose(time, frame, floorPose) {
        parentInstance.onNoPose(time, frame, floorPose);
    }

    /**
     * Let's the app know that the XRSession was closed.
     */
    function onSessionEnded() {
        parentInstance.onSessionEnded();
    }
</script>

<Parent bind:this={parentInstance} on:arSessionEnded on:brbroadcast />
