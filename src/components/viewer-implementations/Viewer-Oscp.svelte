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
    import type webxr from '@core/engines/webxr';
    import type ogl from '@core/engines/ogl/ogl';
    import type { XrFeatures } from '../../types/xr';
    import { Quat, type OGLRenderingContext, type Transform, Vec3 } from 'ogl';
    import { checkGLError } from '@core/devTools';
    import { recentLocalisation } from '@src/stateStore';

    let parentInstance: Parent;

    let myGl: OGLRenderingContext | null = null;

    let useReticle = true; // TODO: make selectable on the GUI
    let hitTestSource: XRHitTestSource | undefined;
    let reticle: Transform | null = null; // TODO: should be Mesh

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     */
    export function startAr(thisWebxr: webxr, this3dEngine: ogl) {
        parentInstance.startAr(thisWebxr, this3dEngine);
        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        let requiredXrFeatures: XrFeatures[] = ['dom-overlay', 'camera-access', 'anchors', 'local-floor'];
        let optionalXrFeatures: XrFeatures[] = [];

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
            (xr: webxr, session: XRSession, gl: OGLRenderingContext | null) => {
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
    /**
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events: any) {
        // Viewer-Oscp cannot handle any events currently
        console.log('Viewer-Oscp: Unknown event received:');
        console.log(events);
        // pass on to parent
        return parentInstance.onNetworkEvent(events);
    }

    /**
     * Handles update loop when AR Cloud mode is used.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame     The XRFrame provided to the update loop
     * @param floorPose The pose of the device as reported by the XRFrame
     * @param floorSpaceReference
     */
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, floorSpaceReference: XRReferenceSpace | XRBoundedReferenceSpace) {
        if (useReticle && myGl) {
            checkGLError(myGl, 'before creating reticle');
            if (reticle == undefined || reticle == null) {
                reticle = parentInstance.getRenderer().addReticle();
            }
            checkGLError(myGl, 'after creating reticle');

            if (hitTestSource === undefined) {
                console.log('HitTestSource is invalid! Cannot use reticle');
                reticle.visible = false;
            } else {
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length > 0) {
                    const reticlePose = hitTestResults[0].getPose(floorSpaceReference);
                    const position = reticlePose?.transform.position;
                    const orientation = reticlePose?.transform.orientation;
                    if (position && orientation) {
                        parentInstance.getRenderer().updateReticlePose(reticle,
                                new Vec3(position.x, position.y, position.z),
                                new Quat(orientation.x, orientation.y, orientation.z, orientation.w));
                        reticle.visible = true;
                    }
                } else {
                    reticle.visible = false;
                }
            }

            // hide if there was no localization yet
            if ($recentLocalisation.geopose?.position === undefined) {
                reticle.visible = false;
            }
        } // useReticle

        // Call parent Viewer's onXrFrameUpdate which updates performs localization and rendering
        parentInstance.onXrFrameUpdate(time, frame, floorPose); // this renders scene and captures the camera image for localization
    }

    /**
     * Called when no pose was reported from WebXR.
     *
     * @param time  DOMHighResTimeStamp     time offset at which the updated
     *      viewer state was received from the WebXR device.
     * @param frame  XRFrame        The XRFrame provided to the update loop
     * @param floorPose  XRPose     The pose of the device as reported by the XRFrame
     */
    function onXrNoPose(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose) {
        parentInstance.onXrNoPose(time, frame, floorPose);
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
</script>

<Parent bind:this={parentInstance} on:arSessionEnded on:broadcast>
    <svelte:fragment slot="overlay" let:isLocalizing let:isLocalized let:isLocalisationDone let:firstPoseReceived let:receivedContentTitles>
        <ArCloudOverlay
            hasPose={firstPoseReceived}
            {isLocalizing}
            {isLocalized}
            {receivedContentTitles}
            on:startLocalisation={() => parentInstance.startLocalisation()}
            on:relocalize={() => {
                reticle = null; // TODO: we should store the reticle inside tdEngine to avoid the need for explicit deletion here.
                parentInstance.relocalize();
            }}
        />
    </svelte:fragment>
</Parent>
