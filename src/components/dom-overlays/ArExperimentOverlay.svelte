<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Content of the experiment overlay.
-->

<script>
    import { createEventDispatcher } from 'svelte';

    import { experimentModeSettings } from '@src/stateStore';

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    let prevFrameTime = 0;
    let hasPassedMaxSlow = false;
    let objectsPlacedCount = 0;
    let objectsReceivedCount = 0;

    /**
     * Receives timing data from the WebGL frame.
     *
     * @param frameTime  integer        Duration of the previous frame
     * @param passedMaxSlow  boolean        Max number of slow frames passed
     */
    export function setPerformanceValues(frameTime, passedMaxSlow) {
        prevFrameTime = frameTime;
        hasPassedMaxSlow = passedMaxSlow;
    }

    export function objectPlaced() {
        objectsPlacedCount++;
    }

    export function objectReceived() {
        objectsReceivedCount++;
    }
</script>

{#if $experimentModeSettings.game.showstats}
    <p>Objects placed: {objectsPlacedCount}</p>
    <!--<p>Objects received: {objectsReceivedCount}</p>-->
    <p>ISMAR 2021 demo</p>
    <!--<p>Frame time: {prevFrameTime}</p>-->
    <!--<p>Max slow passed: {hasPassedMaxSlow}</p>-->
    <button class="prime" on:click={() => dispatch('toggleAutoPlacement')}>Toggle placement</button>
    {#if $experimentModeSettings.game.localisation}
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
