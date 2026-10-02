<script lang="ts">
    import { setContext } from 'svelte';
    import { writable, type Writable } from 'svelte/store';
    import { v4 as uuidv4 } from 'uuid';
    import { quat, vec3 } from 'gl-matrix';
    import type { QuatLike, Vec3Like } from '@core/spatial';
    import Parent from '@components/Viewer.svelte';
    import ArCloudOverlay from '@components/dom-overlays/ArCloudOverlay.svelte';
    import Overlay, { type ModelCatalogEntry } from './Overlay.svelte';
    import { uniformScaleFromScrContentSize, uniformScaleVec3FromScrContentSize } from '@core/contents/contentDefinitions';
    import { applyMementoSettingsDefaults, type MementoExperimentSettings } from './Settings.svelte';
    import type webxr from '../../../core/engines/webxr';
    import type { RenderingEngine, SceneNodeId } from '@core/engines/RenderingEngine';
    import type { Geopose, SCRnoId } from '@oarc/scd-access';
    import { postContent } from '@oarc/scd-access';
    import * as worldAlignment from '@core/worldAlignment';
    import scdAuth0 from './scdAuth0Service';
    import { currentScdLoggedInUser, isAuthenticatedScdAuth0 } from './mementoState';

    /** Matches `content.size` on posted MODEL_3D SCRs (25 = quarter of default GLB scale). */
    const kMementoModelSizePercent = 25;
    const kPreviewScale = uniformScaleVec3FromScrContentSize(kMementoModelSizePercent);
    /** Matches `content.size` on posted TEXT SCRs (20 = one-fifth of default label scale). */
    const kMementoTextSizePercent = 20;
    /**
     * All memento emoji GLBs share the same layout: origin at mesh center, AABB min Y below origin.
     * Distance from origin to bounding-box bottom at SCR size 100%; geopose `h` is boosted by this × `content.size` scale on place.
     */
    const kMementoModelOriginToBottomModelUnits = 3.512132;
    // Non-standard: TEXT SCRs usually point at real text assets on CDN; 
    // this local placeholder ref is only used in the Memento demo.
    const kInlineTextRefUrl = '/media/texts/inline.txt';

    let parentInstance: Parent;
    let xrEngine: webxr;
    let tdEngine: RenderingEngine;
    let hitTestSource: XRHitTestSource | undefined;
    let reticleNodeId: SceneNodeId | null = null;
    let previewNodeId: SceneNodeId | null = null;
    let previewModelUrl = '';

    let settings: Writable<MementoExperimentSettings> = writable({});
    const kMementoModelsCatalogUrl = '/media/models/memento/catalog.json';
    const kMementoModelsBasePath = '/media/models/memento/';

    let catalog: ModelCatalogEntry[] = [];
    let selectedFile = '';
    let reticleGeoPose: Geopose | undefined;
    let persisting = false;
    let persistError = '';
    const kTextHeightOffsetM = 2.5;

    let parentState = writable();
    setContext('state', parentState);

    $: scdAuthReady = !scdAuth0.isScdAuthConfigured() || $isAuthenticatedScdAuth0;

    function mementoOriginToBottomHeightBoost(sizePercent: number): number {
        return kMementoModelOriginToBottomModelUnits * uniformScaleFromScrContentSize(sizePercent);
    }

    function geoposeWithRaisedH(base: Geopose, deltaH: number): Geopose {
        return {
            ...base,
            position: {
                ...base.position,
                h: base.position.h + deltaH,
            },
        };
    }

    function mementoModelGeoposeFromScenePose(position: Vec3Like, orientation: QuatLike): Geopose {
        const base = worldAlignment.convertScenePoseToGeoposeFromActive(position, orientation);
        return geoposeWithRaisedH(base, mementoOriginToBottomHeightBoost(kMementoModelSizePercent));
    }

    function scenePoseFromMementoModelGeopose(modelGeopose: Geopose): { position: vec3; orientation: quat } {
        const rigid = worldAlignment.convertGeoPoseToLocalPose(modelGeopose);
        return {
            position: vec3.fromValues(rigid.position.x, rigid.position.y, rigid.position.z),
            orientation: quat.fromValues(
                rigid.orientation.x,
                rigid.orientation.y,
                rigid.orientation.z,
                rigid.orientation.w,
            ),
        };
    }

    $: canPlace =
        !persisting &&
        selectedFile !== '' &&
        reticleGeoPose !== undefined &&
        reticleNodeId !== null &&
        worldAlignment.hasActiveWorldAlignment() &&
        scdAuthReady;

    function textGeoposeAboveModel(modelGeopose: Geopose): Geopose {
        if (reticleNodeId === null) {
            return modelGeopose;
        }
        const position = vec3.create();
        const orientation = quat.create();
        tdEngine.getNodePose(reticleNodeId, position, orientation);
        position[1] += kTextHeightOffsetM;
        return worldAlignment.convertScenePoseToGeoposeFromActive(
            { x: position[0], y: position[1], z: position[2] },
            { x: orientation[0], y: orientation[1], z: orientation[2], w: orientation[3] },
        );
    }

    function syncContentQueryTopicFromSettings() {
        applyMementoSettingsDefaults($settings);
        const topic = $settings.topic?.trim().toLowerCase();
        if (topic) {
            parentInstance.setContentQueryTopic(topic);
        }
    }

    export function startAr(thisWebxr: webxr, this3dEngine: RenderingEngine, options?: { settings?: Writable<Record<string, unknown>> }) {
        parentInstance.startAr(thisWebxr, this3dEngine);
        parentInstance.setEnableContentZoneRequery(true);
        xrEngine = thisWebxr;
        tdEngine = this3dEngine;

        if (options?.settings) {
            settings = options.settings as Writable<MementoExperimentSettings>;
        }
        settings.update((value) => {
            applyMementoSettingsDefaults(value);
            return value;
        });
        syncContentQueryTopicFromSettings();

        void loadModelCatalog();
        void syncScdUserProfileIfNeeded();
        startSession();
    }

    async function syncScdUserProfileIfNeeded() {
        if (!scdAuth0.isScdAuthConfigured()) {
            return;
        }
        try {
            const client = await scdAuth0.initScdAuth0Client();
            if (await client.isAuthenticated()) {
                isAuthenticatedScdAuth0.set(true);
                await scdAuth0.syncScdUserProfile(client);
            }
        } catch (error) {
            console.error(error);
        }
    }

    function normalizeModelCatalog(data: unknown): ModelCatalogEntry[] {
        if (!Array.isArray(data)) {
            return [];
        }
        return data.filter(
            (entry): entry is ModelCatalogEntry =>
                entry != null &&
                typeof entry === 'object' &&
                typeof (entry as ModelCatalogEntry).file === 'string' &&
                (entry as ModelCatalogEntry).file.trim() !== '' &&
                typeof (entry as ModelCatalogEntry).label === 'string',
        );
    }

    async function loadModelCatalog() {
        catalog = [];
        selectedFile = '';
        try {
            const response = await fetch(kMementoModelsCatalogUrl);
            if (!response.ok) {
                console.warn(`Memento model catalog unavailable (HTTP ${response.status}).`);
                return;
            }
            const text = (await response.text()).trim();
            if (!text) {
                return;
            }
            const parsed: unknown = JSON.parse(text);
            const data = normalizeModelCatalog(parsed);
            catalog = data;
            if (data.length > 0) {
                selectedFile = data[0].file;
            }
        } catch (error) {
            console.error('Failed to load Memento model catalog', error);
            catalog = [];
            selectedFile = '';
        }
    }

    async function startSession() {
        await parentInstance.startSession(
            onXrFrameUpdate,
            onXrSessionEnded,
            onXrNoPose,
            (xr, session, gl) => {
                if (gl) {
                    xr.initCameraCapture(gl);
                }
                session
                    .requestReferenceSpace('viewer')
                    .then((refSpace) => session.requestHitTestSource?.({ space: refSpace }))
                    .then((source) => (hitTestSource = source));
            },
            ['dom-overlay', 'camera-access', 'hit-test', 'local-floor'],
        );
    }

    function syncPreviewModel() {
        if (!selectedFile || reticleNodeId === null || persisting) {
            return;
        }
        const modelUrl = `${kMementoModelsBasePath}${selectedFile}`;
        if (previewModelUrl === modelUrl && previewNodeId !== null) {
            return;
        }
        if (previewNodeId !== null) {
            try {
                tdEngine.remove(previewNodeId);
            } catch {
                // Preview node may already be gone.
            }
            previewNodeId = null;
        }
        previewModelUrl = modelUrl;
        const position = vec3.create();
        const orientation = quat.create();
        tdEngine.getNodePose(reticleNodeId, position, orientation);
        const modelGeopose = mementoModelGeoposeFromScenePose(
            { x: position[0], y: position[1], z: position[2] },
            { x: orientation[0], y: orientation[1], z: orientation[2], w: orientation[3] },
        );
        const modelScenePose = scenePoseFromMementoModelGeopose(modelGeopose);
        previewNodeId = tdEngine.addModel(
            modelUrl,
            modelScenePose.position,
            modelScenePose.orientation,
            kPreviewScale,
        );
    }

    function updateReticleGeoPose() {
        if (reticleNodeId === null || !worldAlignment.hasActiveWorldAlignment()) {
            reticleGeoPose = undefined;
            return;
        }
        const position = vec3.create();
        const orientation = quat.create();
        tdEngine.getNodePose(reticleNodeId, position, orientation);
        reticleGeoPose = worldAlignment.convertScenePoseToGeoposeFromActive(
            { x: position[0], y: position[1], z: position[2] },
            { x: orientation[0], y: orientation[1], z: orientation[2], w: orientation[3] },
        );
    }

    function onXrFrameUpdate(time: DOMHighResTimeStamp, frame: XRFrame, xrViewerPose: XRViewerPose, xrReferenceSpace: XRReferenceSpace) {
        parentInstance.handlePoseHeartbeat();

        if (!hitTestSource) {
            parentInstance.onXrFrameUpdate(time, frame, xrViewerPose);
            xrEngine.setViewportForView(xrViewerPose.views[0]);
            tdEngine.render(time, xrViewerPose.views[0]);
            return;
        }

        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0 && worldAlignment.hasActiveWorldAlignment()) {
            const reticlePose = hitTestResults[0].getPose(xrReferenceSpace);
            const position = reticlePose?.transform.position;
            const orientation = reticlePose?.transform.orientation;
            if (position && orientation) {
                if (reticleNodeId === null) {
                    reticleNodeId = tdEngine.addReticle();
                }
                tdEngine.setNodePose(
                    reticleNodeId!,
                    vec3.fromValues(position.x, position.y, position.z),
                    quat.fromValues(orientation.x, orientation.y, orientation.z, orientation.w),
                );
                updateReticleGeoPose();
                if (!persisting && previewNodeId !== null) {
                    const modelGeopose = mementoModelGeoposeFromScenePose(
                        { x: position.x, y: position.y, z: position.z },
                        { x: orientation.x, y: orientation.y, z: orientation.z, w: orientation.w },
                    );
                    const modelScenePose = scenePoseFromMementoModelGeopose(modelGeopose);
                    tdEngine.setNodePose(previewNodeId, modelScenePose.position, modelScenePose.orientation);
                } else if (!persisting) {
                    syncPreviewModel();
                }
            }
        }

        parentInstance.onXrFrameUpdate(time, frame, xrViewerPose);
        xrEngine.setViewportForView(xrViewerPose.views[0]);
        tdEngine.render(time, xrViewerPose.views[0]);
    }

    function onXrNoPose(time: DOMHighResTimeStamp, frame: XRFrame) {
        parentInstance.onXrNoPose(time, frame);
    }

    function onXrSessionEnded() {
        if (hitTestSource !== undefined) {
            hitTestSource.cancel();
            hitTestSource = undefined;
        }
        if (previewNodeId !== null) {
            try {
                tdEngine.remove(previewNodeId);
            } catch {
                // ignore
            }
            previewNodeId = null;
        }
        reticleNodeId = null;
        parentInstance.setEnableContentZoneRequery(false);
        parentInstance.onXrSessionEnded();
    }

    function toAsciiRenderableText(raw: string): string {
        return raw
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\x20-\x7E]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function displayName(): string {
        try {
            const details = JSON.parse($currentScdLoggedInUser) as Record<string, unknown>;
            const fullName =
                (typeof details.name === 'string' && details.name.trim()) ||
                [details.given_name, details.family_name]
                    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
                    .join(' ')
                    .trim() ||
                (typeof details.username === 'string' && details.username.trim()) ||
                (typeof details.email === 'string' && details.email.trim()) ||
                '';
            const ascii = toAsciiRenderableText(fullName);
            return ascii || 'Anonymous';
        } catch {
            return 'Anonymous';
        }
    }

    function catalogLabel(file: string): string {
        return catalog.find((entry) => entry.file === file)?.label ?? file;
    }

    async function placeMemento() {
        if (!canPlace || !reticleGeoPose) {
            return;
        }

        persistError = '';
        persisting = true;

        if (previewNodeId !== null) {
            try {
                tdEngine.remove(previewNodeId);
            } catch {
                // ignore
            }
            previewNodeId = null;
            previewModelUrl = '';
        }

        applyMementoSettingsDefaults($settings);
        syncContentQueryTopicFromSettings();
        const scdUrl = $settings.scdUrl!.trim().replace(/\/$/, '');
        const topic = $settings.topic!.trim().toLowerCase();

        const name = displayName();
        const modelLabel = catalogLabel(selectedFile);
        const modelUrl = `${kMementoModelsBasePath}${selectedFile}`;
        const geopose = geoposeWithRaisedH(
            reticleGeoPose,
            mementoOriginToBottomHeightBoost(kMementoModelSizePercent),
        );

        let token: string | undefined;
        try {
            if (!scdAuth0.isScdAuthConfigured()) {
                throw new Error('SCD Auth0 is not configured.');
            }
            token = await scdAuth0.getScdAccessToken();
        } catch (error) {
            console.error(error);
            persisting = false;
            persistError = 'Could not get SCD access token. Sign in to SCD in Memento settings on the dashboard.';
            return;
        }

        if (!token) {
            persisting = false;
            persistError = 'Missing SCD access token. Sign in to SCD in Memento settings.';
            return;
        }

        const modelContentId = uuidv4();
        const textContentId = uuidv4();

        const modelScr: SCRnoId = {
            type: 'scr',
            content: {
                id: modelContentId,
                type: 'MODEL_3D',
                title: `${name}'s memento`,
                description: modelLabel,
                keywords: ['memento', modelLabel, name],
                refs: [{ url: modelUrl, contentType: 'model/gltf-binary' }],
                size: kMementoModelSizePercent,
                definitions: [{ type: 'animation', value: 'SPIN_UP' }],
                geopose,
            },
        };

        const textScr: SCRnoId = {
            type: 'scr',
            content: {
                id: textContentId,
                type: 'TEXT',
                title: name,
                description: name,
                keywords: ['memento', name],
                refs: [{ url: kInlineTextRefUrl, contentType: 'text/plain' }],
                size: kMementoTextSizePercent,
                geopose: textGeoposeAboveModel(geopose),
            },
        };

        try {
            await postContent(scdUrl, topic, modelScr, token);
            await postContent(scdUrl, topic, textScr, token);
            void parentInstance.refreshContentAtCurrentLocation();
            persisting = false;
        } catch (error) {
            console.error(error);
            persisting = false;
            persistError = 'Failed to persist memento to SCD.';
        }
    }

    $: if (selectedFile && reticleNodeId !== null && !persisting) {
        syncPreviewModel();
    }
</script>

<Parent bind:this={parentInstance} on:arSessionEnded on:worldAlignmentEstablished on:worldAlignmentCleared>
    <svelte:fragment slot="overlay" let:isLocalizing let:isLocalized let:isLocalisationDone let:firstPoseReceived>
        {#if !isLocalisationDone}
            <ArCloudOverlay hasPose={firstPoseReceived} {isLocalizing} {isLocalized} on:startLocalisation={() => parentInstance.startLocalisation()} />
        {:else}
            <Overlay
                {catalog}
                bind:selectedFile
                {canPlace}
                {persisting}
                {persistError}
                on:place={placeMemento}
                on:relocalize={() => parentInstance.relocalize()}
            />
        {/if}
    </svelte:fragment>
</Parent>
