import { DOMAttributes, HTMLProps, HTMLAttributes, AriaAttributes } from 'svelte/elements';

declare module 'svelte/elements' {
    export interface DOMAttributes<T extends EventTarget> {
        'on:beforexrselect'?: EventHandler<Event, T> | undefined | null;
    }
    export interface HTMLAttributes<T extends EventTarget> extends AriaAttributes, DOMAttributes<T> {
        align?: 'left' | 'right' | 'justify' | 'center';
    }
}
