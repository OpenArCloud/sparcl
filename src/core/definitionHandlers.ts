/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { RenderingEngine } from './engines/RenderingEngine';
import type { SceneNodeId } from './engines/RenderingEngine';

/*
    Class to handle the definitions added to the content record for an entry of type placeholder.
 */

// definition property isn't yet added to the scr definition. Use this as stand in until it's done
// https://github.com/OpenArCloud/oscp-spatial-content-discovery/issues/19
const definition = [
    {
        key: 'value', // or a more descriptive format when needed
        color: '0.5, 1, 0', // For example
    },
];

/**
 * Interpret and apply the provided definitions to the provided placeholder object.
 *
 * @param tdEngine  Rendering engine (OGL today; swappable)
 * @param placeholder  {@link SceneNodeId}  3D object to apply the definitions to
 * @param definitions  String       The definitions to apply
 */
export function handlePlaceholderDefinitions(tdEngine: RenderingEngine, placeholder: SceneNodeId, definitions?: string) {}
