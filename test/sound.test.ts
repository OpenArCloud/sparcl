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

/** Mirrors sound experiment orbit + {@link audio.ts} pose math (not imported from Svelte / resonance-audio). */
describe('audio listener pose (WebXR / Resonance axes)', () => {
    const WORLD_ORBIT_CENTER = vec3.fromValues(0, 2, 0);
    const WORLD_ORBIT_RADIUS_M = 2;
    const WORLD_ORBIT_INITIAL_ANGLE_RAD = Math.PI / 2;
    const WORLD_ORBIT_START_POSITION = vec3.fromValues(2, 2, 0);

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

    it('world orbit θ=0 is +Z side; fixed start (2,2,0) is θ=π/2', () => {
        const atZero = vec3.create();
        setWorldCwOrbitPosition(WORLD_ORBIT_CENTER, WORLD_ORBIT_RADIUS_M, 0, atZero);
        assert.equal(atZero[0], 0);
        assert.equal(atZero[1], 2);
        assert.equal(atZero[2], 2);

        const atStart = vec3.create();
        setWorldCwOrbitPosition(
            WORLD_ORBIT_CENTER,
            WORLD_ORBIT_RADIUS_M,
            WORLD_ORBIT_INITIAL_ANGLE_RAD,
            atStart,
        );
        assert.ok(vec3.equals(atStart, WORLD_ORBIT_START_POSITION));
    });

    it('world clockwise orbit: increasing θ moves +Z toward +X', () => {
        const R = 2;
        const p0 = vec3.create();
        const p1 = vec3.create();
        setWorldCwOrbitPosition(WORLD_ORBIT_CENTER, R, 0, p0);
        setWorldCwOrbitPosition(WORLD_ORBIT_CENTER, R, 0.01, p1);
        assert.equal(p0[2], 2);
        assert.ok(p1[0] > p0[0]);
        assert.ok(p1[2] < p0[2]);
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
