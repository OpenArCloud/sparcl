<script lang="ts">
    import { getContext } from 'svelte';
    import type { Writable } from 'svelte/store';
    import type { Tweened } from 'svelte/motion';

    type IntroCarouselContext = Writable<{
        progress: Tweened<number>;
        numScreens: number;
    }>;

    const context = getContext<IntroCarouselContext>('intro-carousel');
    const progress = $context.progress;

    let index = 0;

    context.update((value) => {
        index = value.numScreens;
        return { ...value, numScreens: value.numScreens + 1 };
    });

    $: style = `left: ${(index - $progress) * 100}%;`;
</script>

<div class="screen" {style}>
    <slot />
</div>

<style>
    .screen {
        position: absolute;
        top: 0;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding-bottom: 48px;
        overflow: hidden;
    }
</style>
