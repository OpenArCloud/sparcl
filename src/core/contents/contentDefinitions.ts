/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { RenderingEngine, SceneNodeId } from '@core/engines/RenderingEngine';

/**
 * SCR `definitions` that animate any placed MODEL_3D root (GLTF scene transform, PLY mesh, etc.).
 */
export function applyModel3dDefinitionAnimations(
    engine: RenderingEngine,
    nodeId: SceneNodeId,
    definitions: Record<string, string>,
) {
    const animation = definitions['animation'];
    if (animation == undefined) {
        return;
    }
    switch (animation) {
        case 'SPIN_UP':
            engine.setVerticallyRotating(nodeId);
            break;
        default:
            break;
    }
}

/**
 * Interpret and apply the provided definitions to a placeholder placed when a model cannot be loaded.
 *
 * @param tdEngine  Rendering engine
 * @param placeholder  Scene node of the placeholder
 * @param definitions  SCR `content.definitions` flattened to a type → value map
 */
export function handlePlaceholderDefinitions(
    tdEngine: RenderingEngine,
    placeholder: SceneNodeId,
    definitions: Record<string, string>,
) {
    console.log(`Placeholder ${placeholder} definitions:`, definitions);
}
