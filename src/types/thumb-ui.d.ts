declare module 'thumb-ui' {
    import type { SvelteComponent } from 'svelte';

    class Swipeable extends SvelteComponent {}
    class Screen extends SvelteComponent<{ numScreens?: string }> {}
    class Controls extends SvelteComponent {}
}
