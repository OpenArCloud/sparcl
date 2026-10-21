/*
  (c) 2026 Open AR Cloud / contributors
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mat4, quat, vec3 } from 'gl-matrix';

import {
    isLikelyAudioRef,
    isScrSoundContentType,
    soundUrlFromScrRef,
    SCR_SOUND_TYPE,
} from '@core/contents/sound';

describe('sound SCR helpers', () => {
    it('recognizes SOUND content type', () => {
        assert.equal(isScrSoundContentType(SCR_SOUND_TYPE), true);
        assert.equal(isScrSoundContentType('VIDEO'), false);
    });

    it('extracts URL from ref', () => {
        assert.equal(soundUrlFromScrRef({ url: '/media/audio/mosquito.mp3' }), '/media/audio/mosquito.mp3');
        assert.equal(soundUrlFromScrRef(undefined), '');
        assert.equal(soundUrlFromScrRef({ url: '  ' }), '');
    });

    it('detects likely audio refs', () => {
        assert.equal(isLikelyAudioRef('/x/bird.wav', ''), true);
        assert.equal(isLikelyAudioRef('/x/track', 'audio/mpeg'), true);
        assert.equal(isLikelyAudioRef('/x/model.glb', 'model/gltf-binary'), false);
    });
});

/** Mirrors {@link audio.ts} WebXR → Resonance pose math (not imported: resonance-audio needs `window`). */
describe('audio listener pose (WebXR / Resonance axes)', () => {
    const viewerForward = vec3.fromValues(0, 0, -1);
    const viewerUp = vec3.fromValues(0, 1, 0);

    it('identity view pose translation and default forward/up', () => {
        const m = mat4.fromRotationTranslation(
            mat4.create(),
            quat.create(),
            vec3.fromValues(1, 2, 3),
        );
        assert.equal(m[12], 1);
        assert.equal(m[13], 2);
        assert.equal(m[14], 3);

        const forward = vec3.create();
        const up = vec3.create();
        vec3.transformQuat(forward, viewerForward, quat.create());
        vec3.transformQuat(up, viewerUp, quat.create());
        assert.ok(vec3.equals(forward, viewerForward));
        assert.ok(vec3.equals(up, viewerUp));
    });

    it('forward/up stay orthonormal under yaw', () => {
        const q = quat.fromValues(0, 0.70710678, 0, 0.70710678);
        const forward = vec3.create();
        const up = vec3.create();
        vec3.transformQuat(forward, viewerForward, q);
        vec3.transformQuat(up, viewerUp, q);
        assert.ok(Math.abs(vec3.dot(forward, up)) < 1e-5);
        assert.ok(Math.abs(vec3.length(forward) - 1) < 1e-5);
        assert.ok(Math.abs(vec3.length(up) - 1) < 1e-5);
    });
});
