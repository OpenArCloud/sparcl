<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<!-- DOM-overlay on top of AR canvas AR mode is OSCP -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { isLocalizingMessage, isLocalizedMessage, localizeMessage, localizeLabel, movePhoneMessage, resetLabel } from '@src/contentStore';

    export let hasPose = false;
    export let isLocalizing = false;
    export let isLocalized = false;
    let showIsLocalizedMessage: boolean = false;
    $: {
        if (isLocalized) {
            showIsLocalizedMessage = true;
            setTimeout(() => {
                showIsLocalizedMessage = false;
            }, 3000);
        }
    }
    export let receivedContentTitles: string[] = [];

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();
</script>

{#if !hasPose}
    <p>{$movePhoneMessage}</p>
{:else if isLocalizing}
    <img class="spinner" alt="Waiting spinner" src="/media/spinner.svg" />
    <p>{$isLocalizingMessage}</p>
{:else if hasPose && !isLocalized}
    <p>{$localizeMessage}</p>
    <button on:click={() => dispatch('startLocalisation')}>{$localizeLabel}</button>
{:else if isLocalized}
    <div style="padding-top: 10px;"></div>
    {#if showIsLocalizedMessage}
        <p>{$isLocalizedMessage}</p>
    {/if}
    <button on:click={() => dispatch('relocalize')}>{$resetLabel}</button>
    {#if receivedContentTitles.length > 0}
        <div align="left">
            <p>Received objects(s):</p>
            {#each receivedContentTitles as title, i}
                <li>[{i}] {title}</li>
            {/each}
        </div>
    {/if}
    <div style="padding-top: 10px"></div>
{/if}

<style>
    .spinner {
        height: 50px;
    }

    button {
        width: 100%;
        height: 49px;

        margin-top: 10px;
        margin-bottom: 10px;

        font-size: 18px;
        font-weight: bold;

        background-color: white;
        border: 2px solid #2e4458;
        border-radius: var(--ui-radius);
    }
</style>
