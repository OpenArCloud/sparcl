/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import * as THREE from 'three';
import type { SceneNodeId } from '@core/engines/RenderingEngine';
import type { ReadonlyQuat, ReadonlyVec3 } from 'gl-matrix';

export interface ThreeSceneObject {
    readonly id: number;
    readonly three: THREE.Object3D;
}

/**
 * Per-engine {@link SceneNodeId} assignment for `THREE.Object3D`.
 * Mirrors `OglSceneNodeRegistry` on the OGL backend.
 */
export class ThreeSceneNodeRegistry {
    private nextNodeId = 1;

    register(object3d: THREE.Object3D): ThreeSceneObject {
        const existing = object3d.userData.threeSceneObject as ThreeSceneObject | undefined;
        if (existing) {
            return existing;
        }
        const entry: ThreeSceneObject = {
            id: this.nextNodeId++,
            three: object3d,
        };
        object3d.userData.threeSceneObject = entry;
        return entry;
    }

    sceneNodeRef(entry: ThreeSceneObject): SceneNodeId {
        return String(entry.id);
    }

    applyTrs(entry: ThreeSceneObject, position: ReadonlyVec3, orientation: ReadonlyQuat, scale?: ReadonlyVec3): void {
        entry.three.position.set(position[0], position[1], position[2]);
        entry.three.quaternion.set(orientation[0], orientation[1], orientation[2], orientation[3]);
        if (scale) {
            entry.three.scale.set(scale[0], scale[1], scale[2]);
        }
        entry.three.updateMatrix();
    }
}
