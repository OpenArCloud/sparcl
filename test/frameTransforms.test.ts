/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mat4, quat, vec3 } from 'gl-matrix';
import { isRigidTransformMat4, mat4FromRigidPose, mat4ToRigidPose } from '@core/frameTransforms';

describe('frameTransforms', () => {
    it('isRigidTransformMat4: identity', () => {
        assert.ok(isRigidTransformMat4(mat4.create()));
    });

    it('isRigidTransformMat4: arbitrary rotation + translation', () => {
        const q = quat.fromValues(0.35, 0.2, -0.15, 0.9);
        quat.normalize(q, q);
        const pose = {
            position: { x: 0.5, y: -1.2, z: 0.03 },
            orientation: { x: q[0], y: q[1], z: q[2], w: q[3] },
        };
        const m = mat4FromRigidPose(pose);
        assert.ok(isRigidTransformMat4(m));
    });

    it('isRigidTransformMat4: rejects uniform scale', () => {
        const m = mat4.create();
        mat4.fromScaling(m, vec3.fromValues(2, 2, 2));
        assert.equal(isRigidTransformMat4(m), false);
    });

    it('mat4ToRigidPose round-trips mat4FromRigidPose', () => {
        const pose = {
            position: { x: 1, y: 2, z: 3 },
            orientation: { x: 0, y: 0, z: 0, w: 1 },
        };
        const m = mat4FromRigidPose(pose);
        const back = mat4ToRigidPose(m, true);
        assert.ok(Math.abs(back.position.x - 1) < 1e-6);
        assert.ok(Math.abs(back.position.y - 2) < 1e-6);
        assert.ok(Math.abs(back.position.z - 3) < 1e-6);
        assert.ok(Math.abs(back.orientation.w - 1) < 1e-6);
    });

    it('mat4ToRigidPose requireRigid throws on scaled matrix', () => {
        const m = mat4.create();
        mat4.fromScaling(m, vec3.fromValues(2, 2, 2));
        assert.throws(() => mat4ToRigidPose(m, true), /expected a rigid transform/);
    });
});
