/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

declare module 'svelte-awesome-color-picker' {
    import type { SvelteComponent } from 'svelte';

    class ColorPicker extends SvelteComponent<{ rgb: { r: number; g: number; b: number; a: number } | null; label: string }> {}
    export = ColorPicker;
}
