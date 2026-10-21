/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  Renderer-agnostic spatial audio (Google Resonance Audio + HTMLAudioElement).
  Logical sound nodes use SceneNodeId values with the `sound:` prefix; they are not OGL/THREE meshes.

  WebXR viewer space is right-handed (+X right, +Y up, +Z backward; look = local −Z). Resonance matches
  OpenGL/Three.js defaults; `setListenerFromMatrix` expects the same column-major layout as THREE.Matrix4.
  SCR positions and XRView transforms are already in that scene frame (no extra axis conversion).
*/

import ResonanceAudioImport from 'resonance-audio';
import { mat4, quat, vec3, type ReadonlyQuat, type ReadonlyVec3 } from 'gl-matrix';

import type { SceneNodeId } from '@core/engines/RenderingEngine';

const SOUND_NODE_PREFIX = 'sound:';

type ResonanceScene = {
    output: { connect: (destination: AudioDestinationNode) => void };
    setRoomProperties: (
        dimensions: { width: number; height: number; depth: number },
        materials: {
            left: string;
            right: string;
            up: string;
            down: string;
            front: string;
            back: string;
        },
    ) => void;
    createSource: () => ResonanceSource;
    setListenerPosition: (x: number, y: number, z: number) => void;
    setListenerOrientation: (
        forwardX: number,
        forwardY: number,
        forwardZ: number,
        upX: number,
        upY: number,
        upZ: number,
    ) => void;
    /** Column-major 4×4, same layout as `THREE.Matrix4.elements` (WebXR view pose). */
    setListenerFromMatrix(matrix: { elements: ArrayLike<number> }): void;
};

type ResonanceSource = {
    input: AudioNode;
    setPosition: (x: number, y: number, z: number) => void;
    setOrientation: (
        forwardX: number,
        forwardY: number,
        forwardZ: number,
        upX: number,
        upY: number,
        upZ: number,
    ) => void;
};

type SoundEntry = {
    audioElement: HTMLAudioElement;
    mediaElementSource: MediaElementAudioSourceNode;
    resonanceSource: ResonanceSource;
    url: string;
};

let audioContext: AudioContext | null = null;
let resonanceScene: ResonanceScene | null = null;
let audioReadyPromise: Promise<void> | null = null;
let lastAudioListenerUpdateTime = 0;
let nextSoundId = 1;

const soundRegistry: Record<SceneNodeId, SoundEntry> = {};

/**
 * Default acoustic room for outdoor / urban spARcl use.
 *
 * Dimensions are in meters (width × height × depth). The SDK examples use presets up to
 * “huge” (20 × 10 × 20 m); a large volume avoids an overly dry, small-room sound when
 * content is spread across a city block.
 *
 * @see [Add a room (Web getting started)](https://resonance-audio.github.io/resonance-audio/develop/web/getting-started#add-a-room-to-the-scene)
 * @see [`setRoomProperties`](https://resonance-audio.github.io/resonance-audio/reference/web/ResonanceAudio.html#setRoomProperties)
 */
const DEFAULT_ROOM_DIMENSIONS = {
    width: 20,
    height: 10,
    depth: 20,
};

/**
 * Open sky: transparent walls/ceiling; paved ground (`polished-concrete-or-tile`, the SDK’s concrete/pavement preset).
 * Material names must match `Utils.ROOM_MATERIAL_COEFFICIENTS` in the Resonance Web SDK.
 *
 * @see [Room materials (Web getting started)](https://resonance-audio.github.io/resonance-audio/develop/web/getting-started#add-a-room-to-the-scene)
 * @see [Supported material names (`Utils.ROOM_MATERIAL_COEFFICIENTS`)](https://resonance-audio.github.io/resonance-audio/reference/web/Utils.html#ROOM_MATERIAL_COEFFICIENTS)
 */
const DEFAULT_ROOM_MATERIALS = {
    left: 'transparent',
    right: 'transparent',
    up: 'transparent',
    down: 'polished-concrete-or-tile',
    front: 'transparent',
    back: 'transparent',
};

type ResonanceAudioConstructor = new (
    context: AudioContext,
    options: { ambisonicOrder: number },
) => ResonanceScene;

/**
 * `resonance-audio` is `export = ResonanceAudio` (CJS). Namespace import + `.default` can yield a
 * non-constructor and break `new` (`this` undefined → `_ambisonicOrder` TypeError).
 */
function resonanceAudioConstructor(): ResonanceAudioConstructor {
    const mod = ResonanceAudioImport as unknown as
        | ResonanceAudioConstructor
        | { ResonanceAudio?: ResonanceAudioConstructor; default?: ResonanceAudioConstructor | { ResonanceAudio?: ResonanceAudioConstructor } };

    let ctor: ResonanceAudioConstructor | undefined;
    if (typeof mod === 'function') {
        ctor = mod;
    } else if (mod && typeof mod === 'object') {
        if (typeof mod.ResonanceAudio === 'function') {
            ctor = mod.ResonanceAudio;
        } else if (typeof mod.default === 'function') {
            ctor = mod.default;
        } else if (mod.default && typeof mod.default === 'object' && typeof mod.default.ResonanceAudio === 'function') {
            ctor = mod.default.ResonanceAudio;
        }
    }

    // #region agent log
    fetch('http://127.0.0.1:7583/ingest/fd927d7e-e9d8-4fa7-a74f-1e0225946505', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fbe18c' },
        body: JSON.stringify({
            sessionId: 'fbe18c',
            hypothesisId: 'H1',
            location: 'audio.ts:resonanceAudioConstructor',
            message: 'Resolved ResonanceAudio ctor',
            data: {
                typeofImport: typeof ResonanceAudioImport,
                ctorType: typeof ctor,
                hasSetRoomProperties: Boolean(ctor && 'prototype' in ctor && ctor.prototype && 'setRoomProperties' in ctor.prototype),
            },
            timestamp: Date.now(),
        }),
    }).catch(() => {});
    // #endregion

    if (!ctor || typeof ctor.prototype?.setRoomProperties !== 'function') {
        throw new Error('SpatialAudio: ResonanceAudio constructor not found in resonance-audio package');
    }
    return ctor;
}

function createResonanceScene(context: AudioContext): ResonanceScene {
    const Ctor = resonanceAudioConstructor();
    const scene = new Ctor(context, { ambisonicOrder: 1 });
    // #region agent log
    fetch('http://127.0.0.1:7583/ingest/fd927d7e-e9d8-4fa7-a74f-1e0225946505', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fbe18c' },
        body: JSON.stringify({
            sessionId: 'fbe18c',
            hypothesisId: 'H1',
            location: 'audio.ts:createResonanceScene',
            message: 'Resonance scene constructed',
            data: { hasOutput: Boolean(scene?.output) },
            timestamp: Date.now(),
        }),
    }).catch(() => {});
    // #endregion
    return scene;
}

function waitForMediaReady(element: HTMLMediaElement, timeoutMs = 8000): Promise<void> {
    if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const onReady = () => {
            clearTimeout(timer);
            element.removeEventListener('canplaythrough', onReady);
            element.removeEventListener('error', onError);
            resolve();
        };
        const onError = () => {
            clearTimeout(timer);
            element.removeEventListener('canplaythrough', onReady);
            element.removeEventListener('error', onError);
            reject(new Error(`SpatialAudio: failed to load ${element.src}`));
        };
        const timer = setTimeout(() => {
            element.removeEventListener('canplaythrough', onReady);
            element.removeEventListener('error', onError);
            reject(new Error(`SpatialAudio: timed out loading ${element.src}`));
        }, timeoutMs);
        element.addEventListener('canplaythrough', onReady, { once: true });
        element.addEventListener('error', onError, { once: true });
    });
}

const listenerWorldMatrix = mat4.create();
const viewerForwardLocal = vec3.fromValues(0, 0, -1);
const viewerUpLocal = vec3.fromValues(0, 1, 0);
const scratchListenerQuat = quat.create();

function resonanceListenerMatrixFromXrView(view: XRView, out: mat4): mat4 {
    const t = view.transform;
    quat.set(scratchListenerQuat, t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
    const position = vec3.fromValues(t.position.x, t.position.y, t.position.z);
    return mat4.fromRotationTranslation(out, scratchListenerQuat, position);
}

function resonanceForwardUpFromSceneOrientation(
    orientation: ReadonlyQuat,
    outForward: vec3,
    outUp: vec3,
): { forward: vec3; up: vec3 } {
    vec3.transformQuat(outForward, viewerForwardLocal, orientation);
    vec3.transformQuat(outUp, viewerUpLocal, orientation);
    return { forward: outForward, up: outUp };
}

export function isSoundNodeId(nodeId: SceneNodeId): boolean {
    return nodeId.startsWith(SOUND_NODE_PREFIX);
}

function applyOrientationToResonanceSource(resonanceSource: ResonanceSource, orientation: ReadonlyQuat): void {
    const forward = vec3.create();
    const up = vec3.create();
    resonanceForwardUpFromSceneOrientation(orientation, forward, up);
    resonanceSource.setOrientation(forward[0], forward[1], forward[2], up[0], up[1], up[2]);
}

/**
 * Lazily creates AudioContext and Resonance room graph; resumes context when allowed.
 */
export async function ensureAudioReady(): Promise<void> {
    if (audioReadyPromise) {
        return audioReadyPromise;
    }
    audioReadyPromise = (async () => {
        try {
            if (!audioContext) {
                audioContext = new AudioContext();
            }
            if (!resonanceScene) {
                resonanceScene = createResonanceScene(audioContext);
                resonanceScene.output.connect(audioContext.destination);
                resonanceScene.setRoomProperties(DEFAULT_ROOM_DIMENSIONS, DEFAULT_ROOM_MATERIALS);
            }
            await resumeAudioContextIfNeeded();
            // #region agent log
            fetch('http://127.0.0.1:7583/ingest/fd927d7e-e9d8-4fa7-a74f-1e0225946505', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fbe18c' },
                body: JSON.stringify({
                    sessionId: 'fbe18c',
                    hypothesisId: 'H2',
                    location: 'audio.ts:ensureAudioReady',
                    message: 'ensureAudioReady ok',
                    data: { audioContextState: audioContext.state },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion
        } catch (error) {
            audioReadyPromise = null;
            // #region agent log
            fetch('http://127.0.0.1:7583/ingest/fd927d7e-e9d8-4fa7-a74f-1e0225946505', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fbe18c' },
                body: JSON.stringify({
                    sessionId: 'fbe18c',
                    hypothesisId: 'H1',
                    location: 'audio.ts:ensureAudioReady',
                    message: 'ensureAudioReady failed',
                    data: { error: String(error) },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion
            throw error;
        }
    })();
    return audioReadyPromise;
}

/** Resume Web Audio after XR / user activation (safe to call every frame). */
export async function resumeAudioContextIfNeeded(): Promise<void> {
    if (!audioContext || audioContext.state !== 'suspended') {
        return;
    }
    try {
        await audioContext.resume();
    } catch (error) {
        console.warn('SpatialAudio: AudioContext.resume() failed', error);
    }
}

export interface AddSoundObjectOptions {
    loop?: boolean;
    /** Used in logs when playback starts. */
    label?: string;
}

/**
 * @returns Logical {@link SceneNodeId} for {@link removeSoundObject}; not a visible scene-graph node.
 */
export async function addSoundObject(
    position: ReadonlyVec3,
    orientation: ReadonlyQuat,
    url: string,
    options?: AddSoundObjectOptions,
): Promise<SceneNodeId> {
    await ensureAudioReady();
    if (!audioContext || !resonanceScene) {
        throw new Error('SpatialAudio: audio graph not initialized');
    }

    const loop = options?.loop ?? true;
    const label = options?.label ?? url;

    const audioElement = document.createElement('audio');
    audioElement.src = url;
    audioElement.crossOrigin = 'anonymous';
    audioElement.loop = loop;
    audioElement.preload = 'auto';
    audioElement.setAttribute('playsinline', '');
    audioElement.load();

    try {
        await waitForMediaReady(audioElement);
    } catch (error) {
        console.warn('SpatialAudio: media not ready, attempting play anyway', error);
    }

    const mediaElementSource = audioContext.createMediaElementSource(audioElement);
    const resonanceSource = resonanceScene.createSource();
    mediaElementSource.connect(resonanceSource.input);

    resonanceSource.setPosition(position[0], position[1], position[2]);
    applyOrientationToResonanceSource(resonanceSource, orientation);

    const nodeId: SceneNodeId = `${SOUND_NODE_PREFIX}${nextSoundId++}`;
    soundRegistry[nodeId] = {
        audioElement,
        mediaElementSource,
        resonanceSource,
        url,
    };

    console.log(`SpatialAudio: added ${nodeId} (${label}) at`, position[0], position[1], position[2]);

    await resumeAudioContextIfNeeded();
    try {
        await audioElement.play();
    } catch (error) {
        console.warn(`SpatialAudio: play() rejected for ${nodeId} (${label})`, error);
    }

    return nodeId;
}

/** Updates Resonance listener from the primary XR view (throttled to ~10 Hz). */
export function updateListenerFromXrView(view: XRView): void {
    if (!resonanceScene || !audioContext) {
        return;
    }
    void resumeAudioContextIfNeeded();

    const now = Date.now();
    if (now - lastAudioListenerUpdateTime < 100) {
        return;
    }
    lastAudioListenerUpdateTime = now;

    resonanceListenerMatrixFromXrView(view, listenerWorldMatrix);
    resonanceScene.setListenerFromMatrix({ elements: listenerWorldMatrix });
}

export function setSoundObjectPosition(nodeId: SceneNodeId, position: ReadonlyVec3): void {
    const entry = soundRegistry[nodeId];
    if (!entry) {
        return;
    }
    entry.resonanceSource.setPosition(position[0], position[1], position[2]);
}

export function removeSoundObject(nodeId: SceneNodeId): void {
    const entry = soundRegistry[nodeId];
    if (!entry) {
        return;
    }

    entry.audioElement.pause();
    entry.audioElement.src = '';
    try {
        entry.mediaElementSource.disconnect();
    } catch {
        // already disconnected
    }
    try {
        entry.resonanceSource.input.disconnect();
    } catch {
        // ignore
    }
    delete soundRegistry[nodeId];
    console.log(`SpatialAudio: removed ${nodeId}`);
}

export function disposeAllSounds(): void {
    for (const nodeId of Object.keys(soundRegistry)) {
        removeSoundObject(nodeId);
    }
    lastAudioListenerUpdateTime = 0;
}
