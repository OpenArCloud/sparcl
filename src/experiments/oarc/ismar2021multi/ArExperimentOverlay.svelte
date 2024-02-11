<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<!--
    Content of the experiment overlay.
-->

<script>
    import { createEventDispatcher } from 'svelte';
    import { experimentModeSettings } from '@src/stateStore';

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    let objectsSentCount = 0;
    let objectsReceivedCount = 0;

    export function objectSent() {
        objectsSentCount++;
    }

    export function objectReceived() {
        objectsReceivedCount++;
    }
</script>

{#if $experimentModeSettings?.ismar2021multi.showstats}
    <p>Objects sent: {objectsSentCount}</p>
    <p>Objects received: {objectsReceivedCount}</p>
    <p>ISMAR 2021 demo</p>
    <button class="prime" on:click={() => dispatch('toggleAutoPlacement')}>Toggle autospawn</button>
    {#if $experimentModeSettings.ismar2021multi.localizationRequired}
        <button class="secondary" on:click={() => dispatch('relocalize')}>
            <img src="/media/refresh.svg" alt="refresh icon" />
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
