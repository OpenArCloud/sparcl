/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { vec3 } from 'gl-matrix';

export enum ParticleShape {
    RANDOM = 'random',
    SPHERE = 'sphere',
    CONE = 'cone',
}

/** Parameters for a GPU particle system (pose is supplied separately to the engine). */
export interface ParticleSystem {
    shape: ParticleShape;
    baseColor: vec3;
    pointSize: number;
    intensity: number;
    systemSize: number;
    speed: number;
}
