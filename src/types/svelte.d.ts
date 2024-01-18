/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import 'svelte/elements';

declare module 'svelte/elements' {
    export interface DOMAttributes<T extends EventTarget> {
        'on:beforexrselect'?: EventHandler<Event, T> | undefined | null;
    }
    export interface HTMLAttributes<T extends EventTarget> extends AriaAttributes, DOMAttributes<T> {
        align?: 'left' | 'right' | 'justify' | 'center';
    }
}
