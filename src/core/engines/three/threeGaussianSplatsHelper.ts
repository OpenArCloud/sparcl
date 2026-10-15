/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * Spark (@sparkjsdev/spark) integration for the Three.js engine: scene-level renderer + SplatMesh loading.
 */

import type * as THREE from 'three';
import type { ReadonlyQuat, ReadonlyVec3 } from 'gl-matrix';

import type { GaussianSplatsSourceFormat } from '@core/contents/gaussianSplats';
import { getUrlExtension } from '@core/contents/contentFormats';

type SparkModule = typeof import('@sparkjsdev/spark');
type SparkSplatMesh = InstanceType<SparkModule['SplatMesh']>;
type SparkRendererInstance = InstanceType<SparkModule['SparkRenderer']>;

let sparkModulePromise: Promise<SparkModule> | null = null;

function loadSparkModule(): Promise<SparkModule> {
    if (!sparkModulePromise) {
        sparkModulePromise = import('@sparkjsdev/spark');
    }
    return sparkModulePromise;
}

let sparkRenderer: SparkRendererInstance | null = null;
let sparkRendererScene: THREE.Scene | null = null;

/** Spark rejects in-flight worker/sort promises during dispose; ignore during our teardown window. */
const SPARK_TEARDOWN_REJECTION_MESSAGES = new Set(['Worker terminate', 'No target', 'No renderer']);

function sparkFileTypeForFormat(
    spark: SparkModule,
    format: GaussianSplatsSourceFormat,
    url: string,
): (typeof spark.SplatFileType)[keyof typeof spark.SplatFileType] | undefined {
    switch (format) {
        case 'ply':
            return spark.SplatFileType.PLY;
        case 'spz':
            return spark.SplatFileType.SPZ;
        case 'splat':
            return spark.SplatFileType.SPLAT;
        case 'ksplat':
            return spark.SplatFileType.KSPLAT;
        case 'sog': {
            const ext = getUrlExtension(url);
            if (ext === 'zip') {
                return spark.SplatFileType.PCSOGSZIP;
            }
            return spark.SplatFileType.PCSOGS;
        }
        default:
            return undefined;
    }
}

/**
 * Ensures a single {@link SparkRenderer} exists on `scene` for the given Three `WebGLRenderer`.
 */
function isSparkRendererInstanceUsable(instance: SparkRendererInstance): boolean {
    return (instance as { isDisposed?: boolean }).isDisposed !== true;
}

export async function ensureSparkRenderer(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
): Promise<SparkRendererInstance> {
    const spark = await loadSparkModule();
    if (sparkRenderer && sparkRendererScene === scene && isSparkRendererInstanceUsable(sparkRenderer)) {
        if (sparkRenderer.parent !== scene) {
            scene.add(sparkRenderer);
        }
        return sparkRenderer;
    }
    disposeSparkRenderer();
    sparkRenderer = new spark.SparkRenderer({ renderer, preUpdate: false });
    scene.add(sparkRenderer);
    sparkRendererScene = scene;
    return sparkRenderer;
}

export function disposeAllGaussianSplatsInScene(scene: THREE.Scene): void {
    const splatMeshes: THREE.Object3D[] = [];
    scene.traverse((node) => {
        if (isSparkSplatMesh(node)) {
            splatMeshes.push(node);
        }
    });
    for (const mesh of splatMeshes) {
        disposeGaussianSplatsMesh(mesh);
        mesh.removeFromParent();
    }
}

function withSparkTeardownRejectionGuard(run: () => void): void {
    const onRejection = (event: PromiseRejectionEvent) => {
        const message =
            event.reason instanceof Error ? event.reason.message : String(event.reason ?? '');
        if (SPARK_TEARDOWN_REJECTION_MESSAGES.has(message)) {
            event.preventDefault();
        }
    };
    window.addEventListener('unhandledrejection', onRejection);
    try {
        run();
    } finally {
        window.setTimeout(() => window.removeEventListener('unhandledrejection', onRejection), 500);
    }
}

/** Relocalize / engine reinitialize: drop splat meshes, keep Spark alive for the same WebGL session. */
export function resetGaussianSplatsForRelocalize(scene: THREE.Scene): void {
    sparkRenderer?.removeFromParent();
    disposeAllGaussianSplatsInScene(scene);
}

/**
 * XR session end: dispose Spark (clears pending sort workers) then splat meshes. Spark schedules
 * updates with `setTimeout` while presenting; do not dispose splat GPU targets before this runs.
 */
export function disposeGaussianSplatsAtSessionEnd(scene: THREE.Scene): void {
    disposeSparkRenderer();
    disposeAllGaussianSplatsInScene(scene);
}

export function disposeSparkRenderer(): void {
    if (!sparkRenderer) {
        return;
    }
    withSparkTeardownRejectionGuard(() => {
        const renderer = sparkRenderer;
        if (!renderer) {
            return;
        }
        sparkRenderer = null;
        sparkRendererScene = null;
        renderer.removeFromParent();
        try {
            renderer.dispose();
        } catch (error) {
            console.warn('SparkRenderer.dispose failed', error);
        }
    });
}

export function isSparkSplatMesh(object: THREE.Object3D): object is SparkSplatMesh {
    return typeof (object as SparkSplatMesh).dispose === 'function' && 'packedSplats' in object;
}

export function disposeGaussianSplatsMesh(mesh: THREE.Object3D): void {
    if (!isSparkSplatMesh(mesh)) {
        return;
    }
    try {
        mesh.dispose();
    } catch (error) {
        console.warn('SplatMesh.dispose failed', error);
    }
}

export type LoadGaussianSplatsOptions = {
    url: string;
    format: GaussianSplatsSourceFormat;
    position: ReadonlyVec3;
    orientation: ReadonlyQuat;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
};

/**
 * Loads a Gaussian splat asset and parents it under `scene` (pose applied on the returned mesh).
 */
export async function loadGaussianSplatsMesh(options: LoadGaussianSplatsOptions): Promise<SparkSplatMesh | null> {
    const { url, format, position, orientation, renderer, scene } = options;
    try {
        const spark = await loadSparkModule();
        await ensureSparkRenderer(renderer, scene);

        const fileType = sparkFileTypeForFormat(spark, format, url);
        const pathForName = url.split(/[?#]/)[0] ?? url;
        const fileName = pathForName.includes('/') ? pathForName.slice(pathForName.lastIndexOf('/') + 1) : pathForName;

        const splatMesh = new spark.SplatMesh({
            url,
            ...(fileType !== undefined ? { fileType, fileName } : { fileName }),
        });
        splatMesh.position.set(position[0], position[1], position[2]);
        splatMesh.quaternion.set(orientation[0], orientation[1], orientation[2], orientation[3]);
        scene.add(splatMesh);
        await splatMesh.initialized;
        return splatMesh;
    } catch (error) {
        console.error(`ThreeEngine: failed to load Gaussian splats from ${url}`, error);
        return null;
    }
}
