/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import * as THREE from 'three';
import { PRIMITIVES, type PrimitiveShape } from '@core/contents/primitives';
import type { ObjectDescription } from '../../contents/objectDescription';
import type { ThreeSceneNodeRegistry, ThreeSceneObject } from './threeSceneNodeRegistry';

export type PrimitiveGeometryOptions = {
    width?: number;
    height?: number;
    depth?: number;
    radiusTop?: number;
    radiusBottom?: number;
    thetaLength?: number;
};

function geometryForShape(shape: PrimitiveShape): THREE.BufferGeometry {
    return geometryForShapeWithOptions(shape, {});
}

/** Shape geometry with optional dimensions (mirrors OGL {@link createModel} options). */
export function geometryForShapeWithOptions(
    shape: PrimitiveShape,
    options: PrimitiveGeometryOptions = {},
): THREE.BufferGeometry {
    switch (shape) {
        case PRIMITIVES.sphere: {
            const thetaLength = options.thetaLength ?? Math.PI * 2;
            return new THREE.SphereGeometry(0.5, 16, 16, 0, Math.PI * 2, 0, thetaLength);
        }
        case PRIMITIVES.cylinder:
            return new THREE.CylinderGeometry(
                options.radiusTop ?? 0.5,
                options.radiusBottom ?? 0.5,
                options.height ?? 1,
                16,
            );
        case PRIMITIVES.cone:
            return new THREE.CylinderGeometry(0, options.radiusBottom ?? 0.5, options.height ?? 1, 16);
        case PRIMITIVES.torus:
            return new THREE.TorusGeometry(0.4, 0.15, 12, 24);
        case PRIMITIVES.plane:
            return new THREE.PlaneGeometry(options.width ?? 1, options.height ?? 1);
        case PRIMITIVES.box:
        default:
            return new THREE.BoxGeometry(options.width ?? 1, options.height ?? 1, options.depth ?? 1);
    }
}

export function createPrimitiveNode(
    registry: ThreeSceneNodeRegistry,
    shape: PrimitiveShape,
    color: [number, number, number, number],
    transparent: boolean,
    scale: [number, number, number] = [1, 1, 1],
): ThreeSceneObject {
    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color[0], color[1], color[2]),
        opacity: color[3],
        transparent: transparent || color[3] < 1,
    });
    const mesh = new THREE.Mesh(geometryForShape(shape), material);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    return registry.register(mesh);
}

export function createObjectDescriptionNode(registry: ThreeSceneNodeRegistry, description: ObjectDescription): ThreeSceneObject {
    return createPrimitiveNode(registry, description.shape, description.color, description.transparent, description.scale);
}
