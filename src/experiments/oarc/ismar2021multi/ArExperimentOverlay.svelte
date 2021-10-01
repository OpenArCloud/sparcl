<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Content of the experiment overlay.
-->

<script>
    import { createEventDispatcher } from 'svelte';
    import { experimentModeSettings} from "@src/stateStore";

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    let objectsPlacedCount = 0;
    let objectsReceivedCount = 0;

    export function objectPlaced() {
        objectsPlacedCount++;
    }

    export function objectReceived() {
        objectsReceivedCount++;
    }
</script>


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


{#if $experimentModeSettings[$experimentModeSettings.active].showstats}
    <p>Objects placed: {objectsPlacedCount}</p>
    <p>Objects received: {objectsReceivedCount}</p>
    <p>ISMAR 2021 demo</p>
    <button class="prime" on:click={() => dispatch('toggleAutoPlacement')}>Toggle placement</button>
    {#if $experimentModeSettings[$experimentModeSettings.active].localisation}
    <button class="secondary" on:click={() => dispatch('relocalize')}>
        <img src="/media/refresh.svg" />
    </button>
    {/if}
{/if}
