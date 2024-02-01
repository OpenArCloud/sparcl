<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Content of the experiment overlay.
-->

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { experimentModeSettings } from '@src/stateStore';

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    let prevFrameTime = 0;
    let hasPassedMaxSlow = false;
    let objectsPlacedCount = 0;

    /**
     * Receives timing data from the WebGL frame.
     *
     * @param frameTime  integer        Duration of the previous frame
     * @param passedMaxSlow  boolean    Max number of slow frames passed
     */
    export function setPerformanceValues(frameTime: number, passedMaxSlow: boolean) {
        prevFrameTime = frameTime;
        hasPassedMaxSlow = passedMaxSlow;
    }

    export function objectPlaced() {
        objectsPlacedCount++;
    }
</script>

{#if $experimentModeSettings?.performance.showstats}
    <p>Objects placed: {objectsPlacedCount}</p>
    <p>Performance experiment</p>
    <p>Frame time: {prevFrameTime}</p>
    <p>Max slow passed: {hasPassedMaxSlow}</p>
    <button class="prime" on:click={() => dispatch('toggleAutoPlacement')}>Toggle placement</button>
    {#if $experimentModeSettings.performance.localisation}
        <button class="secondary" on:click={() => dispatch('relocalize')}>
            <img src="/media/refresh.svg" />
        </button>
    {/if}
{/if}

<style>
    button {
        height: var(--button-height);
    }
    .prime {
        width: 200px;
    }
    .secondary {
        width: 50px;
    }
    .secondary img {
        width: 20px;
    }
</style>
