/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { Mesh, Transform } from 'ogl';
import type { SceneNodeId } from '@core/engines/RenderingEngine';

/**
 * Opaque {@link SceneNodeId} assignment and lookup for OGL {@link Transform} / {@link Mesh} nodes.
 * Mirrors the role of the Three.js `ThreeSceneNodeRegistry` on the Three backend.
 */
export class OglSceneNodeRegistry {
    private readonly nodesById = new Map<SceneNodeId, Transform | Mesh>();

    /** OGL {@link Transform} has no `.id`; only {@link Mesh} does — assign stable ids per native object. */
    private readonly nativeToSceneNodeId = new WeakMap<Transform | Mesh, SceneNodeId>();
    private nextTransformSceneNodeId = 0;

    /** Returns the {@link SceneNodeId} for a native already registered via {@link OglSceneNodeRegistry.add | add}. */
    getId(native: Transform | Mesh): SceneNodeId | null {
        return this.nativeToSceneNodeId.get(native) ?? null;
    }

    /**
     * Registers (or refreshes) a native in the id map and returns its stable {@link SceneNodeId}.
     */
    add(native: Transform | Mesh): SceneNodeId {
        let id = this.getId(native);
        if (!id) {
            if (typeof native.id === 'number' && Number.isFinite(native.id)) {
                id = String(native.id);
            } else {
                id = `tn_${++this.nextTransformSceneNodeId}`;
            }
            this.nativeToSceneNodeId.set(native, id);
        }
        this.nodesById.set(id, native);
        return id;
    }

    get(nodeId: SceneNodeId): Transform | Mesh {
        const native = this.nodesById.get(nodeId);
        if (!native) {
            throw new Error(`OGL: unknown scene node id ${nodeId}`);
        }
        return native;
    }

    delete(nodeId: SceneNodeId): void {
        this.nodesById.delete(nodeId);
    }

    /**
     * Sets the native stored for an existing id without changing the WeakMap binding.
     * Used when the map must be refreshed before {@link delete} (e.g. model / dynamic object removal).
     */
    setNative(nodeId: SceneNodeId, native: Transform | Mesh): void {
        this.nodesById.set(nodeId, native);
    }

    /** Clears id tables after tearing down the scene (natives are dropped separately). */
    clear(): void {
        this.nodesById.clear();
        this.nextTransformSceneNodeId = 0;
    }
}
