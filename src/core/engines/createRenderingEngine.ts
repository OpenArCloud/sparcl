/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { RenderingEngine } from './RenderingEngine';

/** Built-in {@link RenderingEngine} implementations. */
export type RenderingEngineId = 'ogl' | 'three';

const DEFAULT_ENGINE_ID: RenderingEngineId = 'ogl';

/** `localStorage` key used by {@link setPersistedRenderingEngineId} / {@link getPersistedRenderingEngineId}. */
export const RENDERING_ENGINE_STORAGE_KEY = 'sparcl.renderingEngine';

/**
 * Reads the persisted engine id only (ignores URL). Defaults to `ogl` when unset or invalid.
 */
export function getPersistedRenderingEngineId(): RenderingEngineId {
    if (typeof localStorage === 'undefined') {
        return DEFAULT_ENGINE_ID;
    }
    const id = localStorage.getItem(RENDERING_ENGINE_STORAGE_KEY);
    if (id === 'ogl' || id === 'three') {
        return id;
    }
    return DEFAULT_ENGINE_ID;
}

/** Persists the default engine for the next load. URL `?engine=` still overrides until removed. */
export function setPersistedRenderingEngineId(id: RenderingEngineId): void {
    if (typeof localStorage === 'undefined') {
        return;
    }
    localStorage.setItem(RENDERING_ENGINE_STORAGE_KEY, id);
}

/**
 * Resolves which engine to use: `?engine=ogl|three` overrides `localStorage` ({@link RENDERING_ENGINE_STORAGE_KEY}).
 */
export function resolveRenderingEngineId(): RenderingEngineId {
    if (typeof window === 'undefined') {
        return DEFAULT_ENGINE_ID;
    }
    const fromUrl = new URLSearchParams(window.location.search).get('engine');
    const fromStorage = localStorage.getItem(RENDERING_ENGINE_STORAGE_KEY);
    const id = (fromUrl ?? fromStorage ?? DEFAULT_ENGINE_ID) as RenderingEngineId;
    if (id === 'ogl' || id === 'three') {
        return id;
    }
    console.warn(`Unknown rendering engine "${id}", using "${DEFAULT_ENGINE_ID}"`);
    return DEFAULT_ENGINE_ID;
}

/**
 * Instantiates a 3D rendering engine by id (dynamic import keeps optional backends out of the main bundle).
 */
export async function createRenderingEngine(id: RenderingEngineId = resolveRenderingEngineId()): Promise<RenderingEngine> {
    switch (id) {
        case 'ogl': {
            const { default: OglEngine } = await import('./ogl/ogl');
            return new OglEngine();
        }
        case 'three': {
            const { default: ThreeEngine } = await import('./three/threeEngine');
            return new ThreeEngine();
        }
        default: {
            const _exhaustive: never = id;
            throw new Error(`Unknown rendering engine: ${_exhaustive}`);
        }
    }
}
