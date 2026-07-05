/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * GPU teardown for OGL scene nodes. OGL exposes {@link Geometry.remove} and {@link Program.remove};
 * WebGL textures from {@link Program.uniforms} must be {@link WebGL2RenderingContext.deleteTexture | deleted} explicitly.
 *
 * {@link disposeOglGpuResourcesForDetachedSubtree} only removes GPU resources that are **not** still referenced
 * by another mesh under `sceneRoot` (so shared GLTF programs/geometries stay valid).
 */

import { Mesh, Transform, type OGLRenderingContext } from 'ogl';

type UniformEntry = { value: unknown };

function isGlTexture(gl: OGLRenderingContext, value: unknown): value is WebGLTexture {
    return typeof value === 'object' && value !== null && gl.isTexture(value as WebGLTexture);
}

/** Delete 2D (and similar) textures referenced by sampler uniforms (deduped by GL texture object). */
function deleteTexturesFromUniforms(
    gl: OGLRenderingContext,
    uniforms: Record<string, UniformEntry>,
    deletedGlTextures: Set<WebGLTexture>,
): void {
    for (const key of Object.keys(uniforms)) {
        const uniform = uniforms[key];
        if (!uniform?.value) continue;
        const value = uniform.value as { texture?: WebGLTexture } | unknown[];

        if (!Array.isArray(value) && typeof value === 'object' && value !== null && 'texture' in value) {
            const tex = (value as { texture?: WebGLTexture }).texture;
            if (tex && isGlTexture(gl, tex) && !deletedGlTextures.has(tex)) {
                deletedGlTextures.add(tex);
                gl.deleteTexture(tex);
            }
            (value as { texture?: WebGLTexture }).texture = undefined;
            continue;
        }

        if (Array.isArray(value)) {
            for (const element of value) {
                if (element && typeof element === 'object' && 'texture' in element) {
                    const tex = (element as { texture?: WebGLTexture }).texture;
                    if (tex && isGlTexture(gl, tex) && !deletedGlTextures.has(tex)) {
                        deletedGlTextures.add(tex);
                        gl.deleteTexture(tex);
                    }
                    (element as { texture?: WebGLTexture }).texture = undefined;
                }
            }
        }
    }
}

interface GeometryWithId {
    id: number;
    remove?: () => void;
}

interface ProgramWithId {
    id: number;
    uniforms: Record<string, UniformEntry>;
    remove?: () => void;
}

function collectMeshesUnder(root: Transform): Mesh[] {
    const meshes: Mesh[] = [];
    root.traverse((node: Transform) => {
        if (node instanceof Mesh) {
            meshes.push(node);
        }
    });
    return meshes;
}

function countGeometryUsage(meshes: Mesh[]): Map<number, number> {
    const map = new Map<number, number>();
    for (const mesh of meshes) {
        const geometry = mesh.geometry as GeometryWithId | undefined;
        if (!geometry) continue;
        map.set(geometry.id, (map.get(geometry.id) ?? 0) + 1);
    }
    return map;
}

function countProgramUsage(meshes: Mesh[]): Map<number, number> {
    const map = new Map<number, number>();
    for (const mesh of meshes) {
        const program = mesh.program as ProgramWithId | undefined;
        if (!program) continue;
        map.set(program.id, (map.get(program.id) ?? 0) + 1);
    }
    return map;
}

/**
 * Dispose GPU resources for meshes under `detachedRoot` only when each {@link Geometry} / {@link Program}
 * is used **solely** by that subtree (compared to usage under `sceneRoot`). Call **before** detaching
 * `detachedRoot` from `sceneRoot`.
 */
export function disposeOglGpuResourcesForDetachedSubtree(detachedRoot: Transform, sceneRoot: Transform): void {
    const sceneMeshes = collectMeshesUnder(sceneRoot);
    const detachedMeshes = collectMeshesUnder(detachedRoot);
    const sceneGeometryCounts = countGeometryUsage(sceneMeshes);
    const detachedGeometryCounts = countGeometryUsage(detachedMeshes);
    const sceneProgramCounts = countProgramUsage(sceneMeshes);
    const detachedProgramCounts = countProgramUsage(detachedMeshes);

    const geometryDisposed = new Set<number>();
    for (const mesh of detachedMeshes) {
        const geometry = mesh.geometry as GeometryWithId | undefined;
        if (!geometry || typeof geometry.remove !== 'function') {
            continue;
        }
        if (geometryDisposed.has(geometry.id)) {
            continue;
        }
        const inScene = sceneGeometryCounts.get(geometry.id) ?? 0;
        const inDetached = detachedGeometryCounts.get(geometry.id) ?? 0;
        if (inScene === inDetached) {
            geometryDisposed.add(geometry.id);
            geometry.remove();
        }
    }

    const deletedGlTextures = new Set<WebGLTexture>();
    const programDisposed = new Set<number>();
    for (const mesh of detachedMeshes) {
        const program = mesh.program as ProgramWithId | undefined;
        if (!program || typeof program.remove !== 'function') {
            continue;
        }
        if (programDisposed.has(program.id)) {
            continue;
        }
        const inScene = sceneProgramCounts.get(program.id) ?? 0;
        const inDetached = detachedProgramCounts.get(program.id) ?? 0;
        if (inScene === inDetached) {
            programDisposed.add(program.id);
            deleteTexturesFromUniforms(mesh.gl, program.uniforms, deletedGlTextures);
            program.remove();
        }
    }
}

/**
 * Full teardown of every mesh under `root` (e.g. scene root at {@link cleanup} time). Equivalent to
 * Equivalent to `disposeOglGpuResourcesForDetachedSubtree(root, root)`.
 */
export function disposeOglGpuResourcesUnder(root: Transform): void {
    disposeOglGpuResourcesForDetachedSubtree(root, root);
}
