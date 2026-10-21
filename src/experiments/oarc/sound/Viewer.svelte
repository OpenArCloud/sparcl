<script lang="ts">
    import { setContext } from 'svelte';
    import { writable } from 'svelte/store';
    import { quat, vec3 } from 'gl-matrix';

    import Parent from '@components/Viewer.svelte';
    import Overlay from '@experiments/oarc/sound/Overlay.svelte';

    import { fakeContentWithFramedPoseSound } from '@core/devTools';
    import { soundUrlFromScrRef } from '@core/contents/sound';
    import { PRIMITIVES } from '@core/contents/primitives';
    import { ensureAudioReady } from '@core/engines/audio';
    import type { SceneNodeId } from '@core/engines/RenderingEngine';
    import type webxr from '@core/engines/webxr';
    import type { RenderingEngine } from '@core/engines/RenderingEngine';

    const ORBIT_PERIOD_S = 16;
    const WORLD_ORBIT_CENTER = vec3.fromValues(0, 2, 0);
    const WORLD_ORBIT_RADIUS_M = 2;
    /** θ = π/2 → start at (2, 2, 0); θ = 0 → +Z at (0, 2, 2). */
    const WORLD_ORBIT_INITIAL_ANGLE_RAD = Math.PI / 2;
    /** World-space marker diameter (meters). */
    const MARKER_SPHERE_SCALE = 0.2;

    function setWorldCwOrbitPosition(
        center: vec3,
        radiusM: number,
        angleRad: number,
        out: vec3,
    ): void {
        out[0] = center[0] + radiusM * Math.sin(angleRad);
        out[1] = center[1];
        out[2] = center[2] + radiusM * Math.cos(angleRad);
    }
    let parentInstance: Parent;
    let xrEngine: webxr;
    let tdEngine: RenderingEngine;

    let soundNodeId: SceneNodeId | null = null;
    let markerNodeId: SceneNodeId | null = null;
    let soundPlacementInFlight = false;
    const orbitCenter = vec3.create();
    const soundPosition = vec3.create();
    const markerOrientation = quat.create();
    let orbitAngleRad = 0;
    let lastFrameTimeSec = 0;

    const soundUrl = soundUrlFromScrRef(fakeContentWithFramedPoseSound.content.refs?.[0]);
    const soundLabel = fakeContentWithFramedPoseSound.content.title ?? 'Sound experiment';

    let parentState = writable({
        hasLostTracking: false,
        isLocalized: false,
        localisation: false,
        isLocalisationDone: true,
        showFooter: true,
    });
    setContext('state', parentState);

    export function startAr(thisWebxr: webxr, this3dEngine: RenderingEngine) {
        parentInstance.startAr(thisWebxr, this3dEngine);
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;
        startSession();
    }

    async function startSession() {
        if (soundUrl === '') {
            console.error('Sound experiment: fakeContentWithFramedPoseSound has no audio URL');
        }
        await parentInstance.startSession(
            onXrFrameUpdate,
            onXrSessionEnded,
            onXrNoPose,
            () => {
                void ensureAudioReady();
            },
            ['local-floor', 'dom-overlay'],
        );
    }

    async function ensureOrbitingSound() {
        if (soundPlacementInFlight || soundNodeId !== null || soundUrl === '') {
            return;
        }
        soundPlacementInFlight = true;
        try {
            vec3.copy(orbitCenter, WORLD_ORBIT_CENTER);
            orbitAngleRad = WORLD_ORBIT_INITIAL_ANGLE_RAD;
            setWorldCwOrbitPosition(orbitCenter, WORLD_ORBIT_RADIUS_M, orbitAngleRad, soundPosition);

            soundNodeId = await tdEngine.addSoundObject(soundPosition, markerOrientation, soundUrl, {
                label: soundLabel,
                loop: true,
            });
            if (soundNodeId === null) {
                console.error('Sound experiment: addSoundObject failed');
                // #region agent log
                fetch('http://127.0.0.1:7583/ingest/fd927d7e-e9d8-4fa7-a74f-1e0225946505', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fbe18c' },
                    body: JSON.stringify({
                        sessionId: 'fbe18c',
                        hypothesisId: 'H3',
                        location: 'sound/Viewer.svelte:ensureOrbitingSound',
                        message: 'addSoundObject returned null',
                        data: { soundUrl },
                        timestamp: Date.now(),
                    }),
                }).catch(() => {});
                // #endregion
                return;
            }
            markerNodeId = tdEngine.addPlaceholderWithOptions(
                PRIMITIVES.sphere,
                soundPosition,
                markerOrientation,
                [1, 0.85, 0.1, 0.95],
                undefined,
                { radius: 0.1, widthSegments: 16, heightSegments: 12 },
            );
            tdEngine.setNodeUniformScale(markerNodeId, MARKER_SPHERE_SCALE);
            // #region agent log
            fetch('http://127.0.0.1:7583/ingest/fd927d7e-e9d8-4fa7-a74f-1e0225946505', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fbe18c' },
                body: JSON.stringify({
                    sessionId: 'fbe18c',
                    hypothesisId: 'H4',
                    location: 'sound/Viewer.svelte:ensureOrbitingSound',
                    message: 'sound and marker placed',
                    data: { soundNodeId, markerNodeId },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion
        } finally {
            soundPlacementInFlight = false;
        }
    }

    function updateOrbit(deltaSec: number) {
        if (!soundNodeId) {
            return;
        }
        const angularSpeed = (2 * Math.PI) / ORBIT_PERIOD_S;
        orbitAngleRad += angularSpeed * deltaSec;
        setWorldCwOrbitPosition(orbitCenter, WORLD_ORBIT_RADIUS_M, orbitAngleRad, soundPosition);

        tdEngine.setSoundObjectPosition(soundNodeId, soundPosition);
        if (markerNodeId !== null) {
            tdEngine.setNodePose(markerNodeId, soundPosition, markerOrientation);
        }
    }

    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose) {
        parentInstance.handlePoseHeartbeat();

        const view = xrViewerPose.views[0];
        const timeSec = time * 0.001;
        const deltaSec = lastFrameTimeSec > 0 ? timeSec - lastFrameTimeSec : 0;
        lastFrameTimeSec = timeSec;

        if (soundNodeId === null && !soundPlacementInFlight) {
            void ensureOrbitingSound();
        } else {
            updateOrbit(deltaSec);
        }

        xrEngine.setViewportForView(view);
        tdEngine.render(time, view);
    }

    function onXrNoPose(time: DOMHighResTimeStamp, frame: XRFrame) {
        parentInstance.onXrNoPose(time, frame);
    }

    function onXrSessionEnded() {
        if (soundNodeId) {
            tdEngine.remove(soundNodeId);
            soundNodeId = null;
        }
        if (markerNodeId !== null) {
            tdEngine.remove(markerNodeId);
            markerNodeId = null;
        }
        soundPlacementInFlight = false;
        lastFrameTimeSec = 0;
        parentInstance.onXrSessionEnded();
    }
</script>

<Parent bind:this={parentInstance} on:arSessionEnded on:worldAlignmentEstablished on:worldAlignmentCleared>
    <svelte:fragment slot="overlay">
        <Overlay />
    </svelte:fragment>
</Parent>
