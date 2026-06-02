/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { PrimitiveShape } from './primitives';
import { PRIMITIVES } from './primitives';
import { randomInteger } from '@src/core/common';

/** Union of an object type’s property value types (e.g. {@link PrimitiveShape} from `typeof PRIMITIVES`). */
export type ValueOf<T> = T[keyof T];

/**
 * Textual / JSON-friendly description of a simple procedural object (shape, color, scale),
 * used for SCR payloads and dynamic scene objects across rendering engines.
 */
export type ObjectDescription = {
    version: number;
    color: [number, number, number, number];
    shape: PrimitiveShape;
    scale: [number, number, number];
    transparent: boolean;
    options: {};
};

/**
 * Random {@link ObjectDescription} for demos (shape from {@link PRIMITIVES}, excluding `plane`).
 */
export function createRandomObjectDescription(): ObjectDescription {
    const getRandomScaleValue = () => randomInteger(1, 10) / 50.0;
    const primitiveKeys = (Object.keys(PRIMITIVES) as Array<keyof typeof PRIMITIVES>).filter((k) => k !== 'plane');
    const kNumPrimitives = primitiveKeys.length;
    const shape_idx = Math.floor(Math.random() * kNumPrimitives);
    const shape = PRIMITIVES[primitiveKeys[shape_idx]];
    const color: [number, number, number, number] = [Math.random(), Math.random(), Math.random(), 1.0];
    const scale: [number, number, number] = [getRandomScaleValue(), getRandomScaleValue(), getRandomScaleValue()];
    return {
        version: 2,
        color,
        shape,
        scale,
        transparent: false,
        options: {},
    };
}
