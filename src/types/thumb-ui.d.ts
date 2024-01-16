/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

declare module 'thumb-ui' {
    import type { SvelteComponent } from 'svelte';

    class Swipeable extends SvelteComponent {}
    class Screen extends SvelteComponent<{ numScreens?: string }> {}
    class Controls extends SvelteComponent {}
}
