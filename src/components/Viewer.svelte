<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Initializes and runs the AR session. Configuration will be according the data provided by the parent.
-->
<script>
    import { createEventDispatcher, onDestroy } from 'svelte';

    import '@thirdparty/playcanvas.min.js';
    import {v4 as uuidv4} from 'uuid';

    import { sendRequest, objectEndpoint, validateRequest } from 'gpp-access';
    import GeoPoseRequest from 'gpp-access/request/GeoPoseRequest.js';
    import ImageOrientation from 'gpp-access/request/options/ImageOrientation.js';
    import { IMAGEFORMAT } from 'gpp-access/GppGlobals.js';

    import { initialLocation, availableContentServices, currentMarkerImage,
        currentMarkerImageWidth, recentLocalisation,
        debug_appendCameraImage, debug_showLocationAxis, debug_useLocalServerResponse} from '@src/stateStore';
    import { wait, ARMODES, debounce, loadAdditionalScript, removeAdditionalScripts } from "@core/common";
    import { createModel, createPlaceholder, addAxes } from '@core/modelTemplates';
    import { calculateDistance, fakeLocationResult, calculateRotation } from '@core/locationTools';

    import { initCameraCaptureScene, drawCameraCaptureScene, createImageFromTexture } from '@core/cameraCapture';
    import ArCloudOverlay from "@components/dom-overlays/ArCloudOverlay.svelte";
    import ArMarkerOverlay from "@components/dom-overlays/ArMarkerOverlay.svelte";

    export let activeArMode;


    const message = (msg) => console.log(msg);

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    let canvas, overlay;
    $: window.canvas = canvas;

    let app;

    let doCaptureImage = false;
    let showFooter = false, firstPoseReceived = false, isLocalizing = false, isLocalized = false, hasLostTracking = false;

    let xrRefSpace = null, gl = null, glBinding = null;
    let trackedImage, trackedImageObject;
    let poseFoundHeartbeat = null;

    let loadPlaycanvasScene = false;

    // TODO: Setup event target array, based on info received from SCD


    /**
     * Setup default content of scene that should be created when WebXR reports the first successful pose
     */
    $: {
        if (firstPoseReceived) {
            if ($debug_showLocationAxis) {
                // TODO: Don't provide app to function. Return objects and add them here to the scene
                addAxes(app);
            }
        }
    }


    /**
     * Verifies that AR is available as required by the provided configuration data, and starts the session.
     */
    export function startAr() {
        showFooter = true;

        app = window.app = new pc.Application(canvas, {
            mouse: new pc.Mouse(canvas),
            touch: new pc.TouchDevice(canvas),
            elementInput: new pc.ElementInput(canvas),
            graphicsDeviceOptions: {alpha: true}
        });

        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);
        app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
        app.start();

        app.xr.on('start', () => {
            message("Immersive AR session has started");
        });

        app.xr.on('update', (frame) => {
            onUpdate(frame);
        })

        app.xr.on('end', () => {
            message("Immersive AR session has ended");

            app = null;
            firstPoseReceived = false;
            dispatch('arSessionEnded');
        });

        app.xr.on('available:' + pc.XRTYPE_AR, (available) => {
            message("Immersive AR is " + (available ? 'available' : 'unavailable'));
            if (available && !app.xr.active) {
                const camera = setupEnvironment();
                startSession(camera);
            }
        });

        window.addEventListener("resize", () => {
            if (app) app.resizeCanvas(canvas.width, canvas.height);
        });
    }

    /**
     * Set up the 3D environment as required according to the current real environment.*
     */
    function setupEnvironment() {
        // TODO: Use environmental lighting?!

        // create camera
        const camera = new pc.Entity();
        camera.addComponent('camera', {
            clearColor: new pc.Color(0, 0, 0, 0),
            farClip: 10000
        });
        app.root.addChild(camera);

        const light = new pc.Entity();
        light.addComponent("light", {
            type: "spot",
            range: 30
        });
        light.translate(0, 10, 0);
        app.root.addChild(light);

        app.scene.ambientLight = new pc.Color(0.5, 0.5, 0.5);

        return camera.camera;
    }

    /**
     * Receives data from the application to be applied to current scene.
     */
    export function updateReceived(data) {
        console.log('viewer update received');

        // TODO: Set the data to the respective objects
    }


    /**
     * Setup required AR features and start the XRSession.
     */
    function startSession(camera) {
        app.xr.domOverlay.root = overlay;

        if (activeArMode === ARMODES.oscp) {
            camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                requiredFeatures: ['dom-overlay', 'camera-access'],
                callback: onXRSessionStartedOSCP
            });
        } else if (activeArMode === ARMODES.marker) {
            setupMarkers()
                .then(() => camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                        requiredFeatures: ['image-tracking'],
                        imageTracking: true,
                        callback: onXRSessionStartedMarker
                    }
                ));
        }
    }

    /**
     * Load marker and configure marker tracking.
     */
    function setupMarkers() {
        return fetch(`/media/${$currentMarkerImage}`)
            .then(response => response.blob())
            .then(blob => {
                trackedImage = app.xr.imageTracking.add(blob, $currentMarkerImageWidth);
            })
            .catch(error => console.log(error));
    }

    /**
     * Executed when XRSession was successfully created for AR mode 'marker'.
     */
    function onXRSessionStartedMarker(error) {
        if (error) {
            message("WebXR Immersive AR failed to start: " + error.message);
            throw new Error(error.message);
        }

        app.xr.session.requestReferenceSpace('local').then((refSpace) => {
            xrRefSpace = refSpace;
        });
    }

    /**
     * Executed when XRSession was successfully created for AR mode 'oscp'.
     */
    function onXRSessionStartedOSCP(error) {
        if (error) {
            message("WebXR Immersive AR failed to start: " + error.message);
            throw new Error(error.message);
        }

        gl = canvas.getContext('webgl2', {xrCompatible: true}); // NOTE: preserveDrawingBuffer: true seems to have no effect
        glBinding = new XRWebGLBinding(app.xr.session, gl);

        app.xr.session.updateRenderState({baseLayer: new XRWebGLLayer(app.xr.session, gl)});
        app.xr.session.requestReferenceSpace('local').then((refSpace) => {
            xrRefSpace = refSpace;
        });

        initCameraCaptureScene(gl);
    }

    /**
     * Trigger localisation of the device globally using a GeoPose service.
     */
    function startLocalisation() {
        doCaptureImage = true;
        isLocalizing = true;
    }

    /**
     * Animation loop.
     *
     * @param frame
     */
    function onUpdate(frame) {
        const localPose = frame.getViewerPose(xrRefSpace);

        if (localPose) {
            handlePoseHeartbeat();

            if (activeArMode === ARMODES.oscp) {
                firstPoseReceived = true;
                handlePose(localPose, frame);
            } else if (activeArMode === ARMODES.marker) {
                handleMarker();
            }
        }
    }

    /**
     * Handles a pose found heartbeat. When it's not triggered for a specific time (300ms as default) an indicator
     * is shown to let the user know that the tracking was lost.
     */
    function handlePoseHeartbeat() {
        hasLostTracking = false;
        if (poseFoundHeartbeat === null) {
            poseFoundHeartbeat = debounce(() => hasLostTracking = true);
        }

        poseFoundHeartbeat();
    }

    /**
     * Handles update loop when marker mode is used.
     */
    function handleMarker() {
        if (trackedImage && trackedImage.tracking) {
            if (!trackedImageObject) {
                trackedImageObject = createModel();
                app.root.addChild(trackedImageObject);
            }

            trackedImageObject.setPosition(trackedImage.getPosition());
            trackedImageObject.setRotation(trackedImage.getRotation());
        }
    }

    /**
     * Handles update loop when AR Cloud mode is used.
     *
     * @param localPose The pose of the device as reported by the XRFrame
     * @param frame     The XRFrame provided to the update loop
     */
    function handlePose(localPose, frame) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, app.xr.session.renderState.baseLayer.framebuffer);

        // TODO: Correctly handle multiple views. No need to localize twice for glasses.
        for (let view of localPose.views) {
            let viewport = app.xr.session.renderState.baseLayer.getViewport(view);
            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

            // NOTE: if we do not draw anything on pose update for more than 5 frames, Chrome's WebXR sends warnings
            // See OnFrameEnd() in https://chromium.googlesource.com/chromium/src/third_party/+/master/blink/renderer/modules/xr/xr_webgl_layer.cc

            // We want to capture the camera image, however, it is not directly available here,
            // but only as a GPU texture. We draw something textured with the camera image at every frame,
            // so that the texture is kept in GPU memory. We can then capture it below.
            let cameraTexture = null;
            if (!isLocalized) {
                cameraTexture = glBinding.getCameraImage(frame, view);
                drawCameraCaptureScene(gl, cameraTexture);
            }

            if (doCaptureImage) {
                doCaptureImage = false;

                // TODO: try to queue the camera capture code on XRSession.requestAnimationFrame()

                const image = createImageFromTexture(gl, cameraTexture, viewport.width, viewport.height);

                if ($debug_appendCameraImage) {
                    // DEBUG: verify if the image was captured correctly
                    const img = new Image();
                    img.src = image;
                    document.body.appendChild(img);
                }

                localize(localPose, image, viewport.width, viewport.height)
                    // When localisation didn't already provide content, needs to be requested here
                    .then(([geoPose, data]) => {
                        $recentLocalisation.geopose = geoPose;
                        $recentLocalisation.localpose = localPose.transform;

                        placeContent(localPose, geoPose, data);
                    });
            }
        }
    }

    /**
     * Does the actual localisation with the image shot before and the preselected GeoPose service.
     *
     * When request is successful, content reported from the content discovery server will be placed. When
     * request is unsuccessful, user is offered to localize again or use a marker image as an alternative.
     *
     * @param localPose  XRPose      Pose of the device as reported by the XRFrame
     * @param image  string     Camera image to use for localisation
     * @param width  Number     Width of the camera image
     * @param height  Number    Height of the camera image
     */
    function localize(localPose, image, width, height) {
        return new Promise((resolve, reject) => {
            if (!$debug_useLocalServerResponse) {
                const geoPoseRequest = new GeoPoseRequest(uuidv4())
                    .addCameraData(IMAGEFORMAT.JPG, [width, height], image.split(',')[1], 0, new ImageOrientation(false, 0))
                    .addLocationData($initialLocation.lat, $initialLocation.lon, 0, 0, 0, 0, 0);

                // Services haven't implemented recent changes to the protocol yet
                validateRequest(false);

                sendRequest(`${$availableContentServices[0].url}/${objectEndpoint}`, JSON.stringify(geoPoseRequest))
                    .then(data => {
                        isLocalizing = false;
                        isLocalized = true;
                        wait(1000).then(() => showFooter = false);

                        if ('scrs' in data) {
                            resolve([data.geopose.pose, data.scrs]);
                        }
                    })
                    .catch(error => {
                        // TODO: Offer marker alternative
                        isLocalizing = false;
                        console.error(error);
                        reject(error);
                    });
            } else {
                // Stored SCD response for development
                console.log('fake localisation');
                isLocalized = true;
                wait(1000).then(showFooter = false);
                resolve([fakeLocationResult.geopose.pose, fakeLocationResult.scrs])
            }
        });
    }

    /**
     *  Places the content provided by a call to a Spacial Content Discovery server.
     *
     * @param localPose XRPose      The pose of the device when localisation was started in local reference space
     * @param globalPose  GeoPose       The global GeoPose as returned from GeoPose service
     * @param scr  SCR Spatial      Content Record with the result from the server request
     */
    function placeContent(localPose, globalPose, scr) {
        const localPosition = localPose.transform.position;

        console.log('Number of content items received: ', scr.length);

        scr.forEach(record => {
            const container = new pc.Entity();
            container.setPosition(localPosition.x, localPosition.y, localPosition.z);
            app.root.addChild(container);

            // Augmented City special path for the GeoPose. Should be just 'record.content.geopose'
            const objectPose = record.content.geopose.pose;

            // Difficult to generalize, because there are no types defined yet.
            if (record.content.type === 'placeholder') {
                let placeholder;

                if (record.content.custom_data.sticker_type === 'other' &&
                        record.content.custom_data.sticker_subtype === 'Playcanvas') {
                    const path = record.content.custom_data.path;
                    placeholder = new pc.Entity();
                    placeholder.name = 'playcanvasparent';

                    loadAdditionalScript(`${path}__settings__.js`, () => {
                        loadAdditionalScript(`${path}__start__.js`);
                    });

/*
                    // Usually, this should probably work...
                    app.scenes.loadSceneHierarchy('Scene/1119478.json', function (err, loadedSceneRootEntity) {
                        if (err) {
                            console.error(err);
                        } else {
                            loadedSceneRootEntity.reparent(placeholder);
                        }
                    });
*/
                } else {
                    placeholder = createPlaceholder(record.content.keywords);
                }

                container.addChild(placeholder);

                const contentPosition = calculateDistance(globalPose, objectPose);
                placeholder.setPosition(contentPosition.x + localPosition.x,
                                        contentPosition.y + localPosition.y,
                                        contentPosition.z + localPosition.z);

                const rotation = calculateRotation(globalPose.quaternion, localPose.transform.orientation);
                container.setRotation(rotation[0], rotation[1], rotation[2], rotation[3]);
            }
        })
    }

    onDestroy(() => {
        removeAdditionalScripts()
    })
</script>


<style>
    aside footer {
        position: absolute;
        bottom: 0;

        margin: var(--ui-margin);
        padding: 0 27px;

        width: calc(100vw - 4 * var(--ui-margin));

        border: 1px solid black;
        border-radius: var(--ui-radius);
        font-size: 16px;
        font-weight: bold;
        text-align: center;

        background: #FFFFFF 0% 0% no-repeat padding-box;

        opacity: 0.7;
    }

    #trackinglostindicator {
        position: absolute;
        right: 10px;
        bottom: 10px;

        width: 2em;
        height: 2em;

        background-color: red;

        border-radius: 50%;
    }
</style>


<canvas id='application' bind:this={canvas}></canvas>

<aside bind:this={overlay} on:beforexrselect={(event) => event.preventDefault()}>
    <!--  Space for UI elements  -->
    {#if showFooter}
        <footer>
            {#if activeArMode === ARMODES.oscp}
                <ArCloudOverlay hasPose="{firstPoseReceived}" isLocalizing="{isLocalizing}" isLocalized="{isLocalized}"
                        on:startLocalisation={startLocalisation} />
            {:else if activeArMode === ARMODES.marker}
                <ArMarkerOverlay />
            {:else}
                <p>Somethings wrong...</p>
                <p>Apologies.</p>
            {/if}
        </footer>
    {/if}

    {#if hasLostTracking}
        <div id="trackinglostindicator"></div>
    {/if}
</aside>
