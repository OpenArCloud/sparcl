<script lang="ts">
    import { setContext } from 'svelte';
    import { tweened } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';
    import { writable } from 'svelte/store';

    export let current = 0;
    export let swipeLabel = '';

    let clientWidth = 0;

    let dragging = false;
    let lastPosition = 0;
    let draggedPixels = 0;
    let draggedBack = false;

    const progress = tweened(current, {
        duration: 400,
        easing: cubicOut,
    });

    const context = writable({
        progress,
        numScreens: 0,
    });

    setContext('intro-carousel', context);

    $: current = Math.floor($progress + 0.5);
    $: maxSlideIndex = $context.numScreens - 1;
    $: size = clientWidth;

    let hasWidth = false;

    $: if (clientWidth > 0 && !hasWidth) {
        hasWidth = true;
        draggedPixels = $progress * clientWidth;
    }

    function startMove(startPosition: number) {
        draggedPixels = $progress * size;
        dragging = true;
        lastPosition = startPosition;
    }

    function move(position: number) {
        if (!dragging) return;

        const delta = position - lastPosition;
        lastPosition = position;
        draggedPixels -= delta;
        if (draggedPixels < 0) draggedPixels = 0;
        if (draggedPixels > maxSlideIndex * size) draggedPixels = maxSlideIndex * size;
        draggedBack = delta < 0;
        $progress = draggedPixels / size || 0;
    }

    let stopTimeout: ReturnType<typeof setTimeout> | null = null;

    function stopMove() {
        if (draggedBack) draggedPixels = Math.ceil(draggedPixels / size) * size;
        else draggedPixels = Math.floor(draggedPixels / size) * size;
        dragging = false;
        clearTimeout(stopTimeout ?? undefined);
        $progress = draggedPixels / size || 0;
    }

    function mousedown(event: MouseEvent) {
        startMove(event.pageX);
    }

    function mouseup() {
        stopMove();
    }

    function mousemove(event: MouseEvent) {
        event.preventDefault();
        if (stopTimeout) return;
        move(event.pageX);
    }

    function touchstart(event: TouchEvent) {
        startMove(event.changedTouches[0].pageX);
    }

    function touchend() {
        stopMove();
    }

    function touchmove(event: TouchEvent) {
        move(event.changedTouches[0].pageX);
    }

    function pointercancel() {
        dragging = false;
    }

    function click(event: MouseEvent) {
        event.stopPropagation();
    }

    function wheel(event: WheelEvent) {
        const delta = -event.deltaX;
        if (delta !== 0) event.preventDefault();
        startMove(0);
        move(delta);
        clearTimeout(stopTimeout ?? undefined);
        stopTimeout = setTimeout(stopMove, 100);
    }
</script>

<div
    bind:clientWidth
    on:pointercancel={pointercancel}
    on:touchstart={touchstart}
    on:touchmove={touchmove}
    on:touchend={touchend}
    on:mousedown={mousedown}
    on:mousemove={mousemove}
    on:mouseup={mouseup}
    on:wheel={wheel}
    on:click={click}
    class="intro-carousel"
>
    <slot {current} progress={$progress} />

    {#if $context.numScreens > 1}
        <div class="intro-carousel-footer" aria-hidden="true">
            {#if swipeLabel && current === 0}
                <p class="swipe-hint">{swipeLabel} →</p>
            {/if}
            <div class="dots">
                {#each Array($context.numScreens) as _, index (index)}
                    <span class="dot"></span>
                {/each}
                <span class="dot active" style:left="{current * 26}px"></span>
            </div>
        </div>
    {/if}
</div>

<style>
    .intro-carousel {
        position: relative;
        width: 100%;
        height: 385px;
        color: white;
        background-color: var(--theme-background);
        overflow: hidden;
        touch-action: pan-y;
    }

    .intro-carousel-footer {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 1;
        pointer-events: none;
        text-align: center;
    }

    .swipe-hint {
        margin: 0 0 4px;
        font-size: 14px;
        font-weight: normal;
        opacity: 0.85;
    }

    .dots {
        position: relative;
        display: inline-block;
        margin-bottom: 12px;
        white-space: nowrap;
    }

    .dot {
        display: inline-block;
        box-sizing: border-box;
        width: 14px;
        height: 14px;
        margin: 6px;
        border: 1px solid #e5e5e5af;
        border-radius: 12px;
        background-color: rgba(40, 41, 48, 0.8);
    }

    .dot.active {
        position: absolute;
        top: 0;
        left: 0;
        border: none;
        background-color: #e5e5e5;
        transition: left 0.3s;
    }
</style>
