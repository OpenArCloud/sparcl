/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * Neutral primitive shape ids shared by SCR {@link import("./objectDescription").ObjectDescription}
 * and all {@link RenderingEngine} implementations.
 */

/** Supported procedural / placeholder primitive shapes (engine-agnostic string ids). */
export const PRIMITIVES = Object.freeze({
    box: 'box',
    sphere: 'sphere',
    /** Often omitted from random placeholders (can be invisible edge-on). */
    plane: 'plane',
    cylinder: 'cylinder',
    cone: 'cone',
    torus: 'torus',
});

export type PrimitiveShape = (typeof PRIMITIVES)[keyof typeof PRIMITIVES];
