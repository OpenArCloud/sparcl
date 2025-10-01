<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<!-- DOM-overlay on top of AR canvas AR mode is OSCP -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { isLocalizingMessage, isLocalizedMessage, localizeMessage, localizeLabel, movePhoneMessage, resetLabel } from '@src/contentStore';
    import { enableCameraPoseSharing, showOtherCameras, enableReticlePoseSharing, showOtherReticles } from '@src/stateStore';

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

    function onShowOtherReticlesCheckboxChange(event: Event) {
        dispatch('showOtherReticlesCheckboxChange', { checked: (event.target as HTMLInputElement).checked });
    }

    function onShowOtherCamerasCheckboxChange(event: Event) {
        dispatch('showOtherCamerasCheckboxChange', { checked: (event.target as HTMLInputElement).checked });
    }

    onMount(() => {
        const showOtherReticlesCheckbox = document.getElementById('show-other-reticles-checkbox') as HTMLInputElement;
        showOtherReticlesCheckbox.addEventListener('change', onShowOtherReticlesCheckboxChange);
        const showOtherCamerasCheckbox = document.getElementById('show-other-cameras-checkbox') as HTMLInputElement;
        showOtherCamerasCheckbox.addEventListener('change', onShowOtherCamerasCheckboxChange);
    });

    let controllersOpened = false;

    function toggleControllers() {
        controllersOpened = !controllersOpened;
    }
</script>

<div id="controllers" class={controllersOpened ? 'opened' : 'closed'}>
    <h2>Multiplayer streaming</h2>
    <table style="width:100%">
        <tr>
            <td style="width:50%" align="left">
                <label><input name="share-camera-pose-checkbox" id="share-camera-pose-checkbox" type="checkbox" bind:checked={$enableCameraPoseSharing} /> Share camera pose </label>
            </td>
            <td style="width:50%" align="left">
                <label><input name="share-reticle-pose-checkbox" id="share-reticle-pose-checkbox" type="checkbox" bind:checked={$enableReticlePoseSharing} /> Share reticle</label>
            </td>
        </tr>
        <tr>
            <td style="width:50%" align="left">
                <label><input name="show-other-cameras-checkbox" id="show-other-cameras-checkbox" type="checkbox" bind:checked={$showOtherCameras} /> Show other cameras </label>
            </td>

            <td style="width:50%" align="left">
                <label><input name="show-other-reticles-checkbox" id="show-other-reticles-checkbox" type="checkbox" bind:checked={$showOtherReticles} /> Show other reticles </label>
            </td>
        </tr>
        <tr>
            <td style="width:50%"></td>
            <td style="width:50%">
                <button on:click={() => dispatch('saveReticle')}>Save reticle pose</button>
            </td>
        </tr>
    </table>
</div>
<button on:click={toggleControllers}>{controllersOpened ? 'Close' : 'Open Controllers'}</button>
{#if !hasPose}
    <p>{$movePhoneMessage}</p>
{:else if !isLocalizing && !isLocalized}
    <p>{$localizeMessage}</p>
    <button on:click={() => dispatch('startLocalisation')}>{$localizeLabel}</button>
{:else if isLocalizing && !isLocalized}
    <img class="spinner" alt="Waiting spinner" src="/media/spinner.svg" />
    <p>{$isLocalizingMessage}</p>
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

    #controllers.opened {
        display: block;
    }

    #controllers.closed {
        display: none;
    }
</style>
