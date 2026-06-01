/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { PrimitiveShape } from './primitives';

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
