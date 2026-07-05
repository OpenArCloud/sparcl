/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { RenderingEngine } from './RenderingEngine';

/** Built-in {@link RenderingEngine} implementations. */
export type RenderingEngineId = 'ogl';

const DEFAULT_ENGINE_ID: RenderingEngineId = 'ogl';

/**
 * Instantiates a 3D rendering engine by id (dynamic import keeps optional backends out of the main bundle).
 */
export async function createRenderingEngine(id: RenderingEngineId = DEFAULT_ENGINE_ID): Promise<RenderingEngine> {
    switch (id) {
        case 'ogl': {
            const { default: OglEngine } = await import('./ogl/ogl');
            return new OglEngine();
        }
        default: {
            const _exhaustive: never = id;
            throw new Error(`Unknown rendering engine: ${_exhaustive}`);
        }
    }
}
