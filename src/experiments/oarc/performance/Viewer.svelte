<script lang="ts">
    import { setContext } from 'svelte';
    import { writable, type Writable } from 'svelte/store';

    import Parent from '@components/Viewer.svelte';

    import ArCloudOverlay from '@components/dom-overlays/ArCloudOverlay.svelte';
    import ArExperimentOverlay from '@experiments/oarc/performance/ArExperimentOverlay.svelte';

    import { PRIMITIVES } from '@core/engines/ogl/modelTemplates';

    import colorfulFragment from '@shaders/colorfulfragment.glsl';
    import { Vec3, type Transform, Quat } from 'ogl';
    import type webxr from '../../../core/engines/webxr';
    import type ogl from '../../../core/engines/ogl/ogl';

    let parentInstance: Parent;
    let xrEngine: webxr;
    let tdEngine: ogl;
    let hitTestSource: XRHitTestSource | undefined;
    let reticle: Transform | null = null; // TODO: Mesh instead of Transform
    let experimentIntervalId: ReturnType<typeof setInterval> | undefined;
    let doExperimentAutoPlacement = false;
    let experimentOverlay: ArExperimentOverlay;
    let settings: Writable<Record<string, unknown>> = writable({});

    let previousTime = performance.now(),
        slowCount = 0,
        maxSlow = 10,
        maximumFrameTime = 1000 / 30; // 30 FPS

    let parentState = writable<{ hasLostTracking: boolean; isLocalized: boolean; localisation: boolean; isLocalisationDone: boolean; showFooter: boolean }>();
    setContext('state', parentState);

    /**
     * Initial setup.
     *
     * @param thisWebxr  class instance     Handler class for WebXR
     * @param this3dEngine  class instance      Handler class for 3D processing
     * @param options  { settings }       Options provided by the app. Currently contains the settings from the Dashboard
     */
    export function startAr(thisWebxr: webxr, this3dEngine: ogl, options?: { settings?: Writable<Record<string, unknown>> }) {
        parentInstance.startAr(thisWebxr, this3dEngine);
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;

        if (options?.settings) {
            settings = options?.settings;
        }

        startSession();
    }

    /**
     * Setup required AR features and start the XRSession.
     */
    async function startSession() {
        await parentInstance.startSession(
            onXrFrameUpdate,
            onXrSessionEnded,
            onXrNoPose,
            (xr, session, gl) => {
                if (gl) {
                    xr.glBinding = new XRWebGLBinding(session, gl);
                    xr.initCameraCapture(gl);
                }

                session
                    .requestReferenceSpace('viewer')
                    .then((refSpace) => session.requestHitTestSource?.({ space: refSpace }))
                    .then((source) => (hitTestSource = source));
            },
            ['dom-overlay', 'camera-access', 'anchors', 'hit-test', 'local-floor'],
        );

        tdEngine.setExperimentTapHandler(() => experimentTapHandler());
    }

    /**
     * There might be the case that a tap handler for off object taps. This is the place to handle that.
     *
     * Not meant for other usage than that.
     *
     * @param event  Event      The Javascript event object
     * @param auto  boolean     true when called from automatic placement interval
     */
    function experimentTapHandler(auto = false) {
        if ($parentState.hasLostTracking == false && reticle != null && ($settings.add === 'manually' || auto)) {
            const index = Math.floor(Math.random() * 5);
            const shape = Object.values(PRIMITIVES)[index];

            const options: any = { attributes: {} };
            const isHorizontal = tdEngine.isHorizontal(reticle);

            let offsetY = 0,
                offsetZ = 0;
            let fragmentShader = colorfulFragment;

            switch (shape) {
                case PRIMITIVES.box:
                    if (isHorizontal) {
                        options.width = 0.3;
                        options.depth = 0.3;
                        options.height = 2;
                        offsetY = 1;
                    } else {
                        options.width = 2;
                        options.depth = 0.1;
                        options.height = 0.3;
                        offsetZ = -0.05;
                    }
                    break;

                case PRIMITIVES.plane:
                    if (isHorizontal) {
                        options.width = 0.5;
                        options.height = 1;
                    } else {
                        options.width = 2;
                        options.height = 1;
                    }
                    break;

                case PRIMITIVES.sphere:
                    options.thetaLength = Math.PI / 2;
                    break;

                case PRIMITIVES.cylinder:
                    if (isHorizontal) {
                        options.radiusTop = 0.3;
                        options.radiusBottom = 0.3;
                        options.height = 2;
                        offsetY = 1;
                    } else {
                        options.radiusTop = 0.5;
                        options.radiusBottom = 0.5;
                        options.height = 0.1;
                        offsetZ = -0.05;
                    }
                    break;

                case PRIMITIVES.cone:
                    options.radiusBottom = 0.3;
                    options.height = 0.5;
                    offsetY = 0.25;
                    offsetZ = -0.25;
                    break;
            }

            const scale = 1;
            const color = undefined;
            const placeholder = tdEngine.addPlaceholderWithOptions(shape, reticle.position, reticle.quaternion, color, fragmentShader, options);
            // TODO: pass the whole program, not only the fragment shader code
            // because we only know here what kind of uniforms will be needed at render time
            // Accordingly, the render code will need to come back here and ask for updates
            placeholder.scale.set(scale);
            placeholder.position.y += offsetY * scale;
            placeholder.position.z += offsetZ * scale;
            experimentOverlay?.objectPlaced();
        }
    }

    /**
     * Toggle automatic placement of placeholders for experiment mode.
     */
    function toggleExperimentalPlacement() {
        doExperimentAutoPlacement = !doExperimentAutoPlacement;

        if (doExperimentAutoPlacement) {
            experimentIntervalId = setInterval(() => experimentTapHandler(true), 1000);
        } else {
            clearInterval(experimentIntervalId);
        }
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
    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, floorPose: XRViewerPose, floorSpaceReference: XRSpace) {
        parentInstance.handlePoseHeartbeat();

        if (!hitTestSource) {
            parentInstance.onXrFrameUpdate(time, frame, floorPose);
            return;
        }

        const t = performance.now();
        const elapsed = t - previousTime;
        previousTime = t;
        if (elapsed > maximumFrameTime) {
            slowCount = Math.max(slowCount++, maxSlow);
        }

        const roundedElapsed = Math.ceil(elapsed);
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
            if ($settings.localisation && !$parentState.isLocalized) {
                parentInstance.onXrFrameUpdate(time, frame, floorPose);
            } else {
                $parentState.showFooter = ($settings.showstats || ($settings.localisation && !$parentState.isLocalisationDone)) as boolean;
                if (reticle === null) {
                    reticle = tdEngine.addReticle();
                }
                const reticlePose = hitTestResults[0].getPose(floorSpaceReference);
                const position = reticlePose?.transform.position;
                const orientation = reticlePose?.transform.orientation;
                if (position && orientation) {
                    tdEngine.updateReticlePose(reticle, new Vec3(position.x, position.y, position.z), new Quat(orientation.x, orientation.y, orientation.z, orientation.w));
                }
            }
        }

        experimentOverlay?.setPerformanceValues(roundedElapsed, slowCount >= maxSlow);

        xrEngine.setViewportForView(floorPose.views[0]);
        tdEngine.render(time, floorPose.views[0]);
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
     * Let's the app know that the XRSession was closed.
     */
    function onXrSessionEnded() {
        if (hitTestSource != undefined) {
            hitTestSource.cancel();
            hitTestSource = undefined;
        }

        if (experimentIntervalId) {
            clearInterval(experimentIntervalId);
            experimentIntervalId = undefined;
        }

        parentInstance.onXrSessionEnded();
    }
</script>

<Parent bind:this={parentInstance} on:arSessionEnded>
    <svelte:fragment slot="overlay" let:isLocalizing let:isLocalized let:isLocalisationDone let:receivedContentTitles let:firstPoseReceived>
        {#if $settings.localisation && !isLocalisationDone}
            <p>{receivedContentTitles.join()}</p>
            <ArCloudOverlay hasPose={firstPoseReceived} {isLocalizing} {isLocalized} on:startLocalisation={() => parentInstance.startLocalisation()} />
        {:else}
            <p>{receivedContentTitles.join()}</p>
            <ArExperimentOverlay bind:this={experimentOverlay} on:toggleAutoPlacement={toggleExperimentalPlacement} on:relocalize={() => parentInstance.relocalize()} />
        {/if}
    </svelte:fragment>
</Parent>
