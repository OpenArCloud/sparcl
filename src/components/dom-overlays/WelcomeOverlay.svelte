<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<!--
    Content of the introduction overlay.
-->

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import ColorPicker from 'svelte-awesome-color-picker';

    import { Swipeable, Screen, Controls } from 'thumb-ui';

    import { hasIntroSeen, arIsAvailable, isLocationAccessAllowed, arMode, myAgentColor, myAgentName } from '@src/stateStore';

    import {
        infoGreeting,
        info,
        introGreeting,
        intro,
        arOkMessage,
        dashboardOkLabel,
        startedOkLabel,
        unavailableInfo,
        allowLocationLabel,
        PageRefreshRequired,
        locationaccessgranted,
        locationaccessrequired,
        locationaccessinfo,
        noservicesavailable,
        playerScreenTitle,
    } from '@src/contentStore';
    import { ARMODES } from '@core/common';

    export let withOkFooter = true;
    export let showDashboardRequested: boolean;
    export let showServicesUnavailableInfo: boolean;
    export let isLocationAccessRefused = false;

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();

    // check status of Auth
    const userWithoutAuth = import.meta.env.VITE_NOAUTH === 'true';
</script>

{#if $hasIntroSeen}
    <div class="swipeable" id="welcomebackwrapper">
        <h3>{$infoGreeting}</h3>
        <p class="subheader">{$info}</p>
        {#if isLocationAccessRefused}
            <p>Location access was refused.</p>
            <p>
                See <a href="https://openarcloud.github.io/sparcl/help/locationaccess.html">help</a>
                for more info
            </p>
        {:else if !$isLocationAccessAllowed}
            <p>{$locationaccessrequired}</p>
        {:else}
            <p>{$locationaccessgranted}</p>
        {/if}

        {#if $arMode !== ARMODES.oscp}
            <p>{$arMode} mode active</p>
        {/if}

        {#if withOkFooter}
            {#if !$isLocationAccessAllowed}
                <button disabled={isLocationAccessRefused} on:click={() => dispatch('requestLocation')} on:keydown={() => dispatch('requestLocation')}>
                    {$allowLocationLabel}
                </button>
                <p class="page-refresh-req">{$PageRefreshRequired}</p>
            {:else}
                <button disabled={!$isLocationAccessAllowed} on:click={() => dispatch('okAction')} on:keydown={() => dispatch('okAction')}>
                    {showDashboardRequested ? $dashboardOkLabel : $startedOkLabel}
                </button>
            {/if}
        {/if}
    </div>
{:else if $arIsAvailable}
    <Swipeable>
        <Screen numScreens="4">
            <div id="welcomewrapper">
                <h3>{$introGreeting}</h3>
                <div>{@html $intro}</div>
            </div>
        </Screen>
        <Screen>
            {#if !$isLocationAccessAllowed}
                <h4>{$locationaccessrequired}</h4>
                <p>{@html $locationaccessinfo}</p>
                <img src="/media/overlay/marker.png" alt="location marker" />

                <button on:click={() => dispatch('requestLocation')} on:keydown={() => dispatch('requestLocation')}>{$allowLocationLabel}</button>

                <p class="page-refresh-req">{$PageRefreshRequired}</p>
            {:else}
                <h4 id="locationgranted">{$locationaccessgranted}</h4>
                <img src="/media/overlay/marker.png" alt="location marker" />
            {/if}
        </Screen>
        {#if userWithoutAuth}
            <Screen>
                <h4 id="player-title">{$playerScreenTitle}</h4>

                <p id="player-username-text">Choose your name</p>
                <p id="player-username-input">
                    <input placeholder="Type your name here" id="agentName" bind:value={$myAgentName} required />
                </p>

                <div class="color-picker-container">
                    <ColorPicker bind:rgb={$myAgentColor} label="Choose your color" --picker-z-index="100" --picker-height="90px" --picker-width="120px" />
                </div>
            </Screen>
        {/if}
        <Screen>
            <h4 id="staysafe">Stay safe</h4>
            <img src="/media/overlay/ready.png" alt="Ready icon showing phone" />
            <p>Always keep aware of your surroundings.</p>
        </Screen>
        <Screen>
            {#if showServicesUnavailableInfo && $arMode !== ARMODES.develop && $arMode !== ARMODES.create}
                <h4>{$noservicesavailable}</h4>
                <div>{$unavailableInfo}</div>
                {#if withOkFooter}
                    <button disabled={!$isLocationAccessAllowed} on:click={() => dispatch('dashboardAction')} on:keydown={() => dispatch('dashboardAction')}>
                        {$dashboardOkLabel}
                    </button>
                {/if}
            {:else}
                <div>{@html $arOkMessage}</div>
                <img src="/media/overlay/ready.png" alt="Ready icon showing phone" />
                {#if $arMode !== ARMODES.oscp}
                    <p>{$arMode} mode active</p>
                {/if}
                {#if withOkFooter}
                    <button disabled={!$isLocationAccessAllowed} on:click={() => dispatch('okAction')} on:keydown={() => dispatch('okAction')}>
                        {showDashboardRequested ? $dashboardOkLabel : $startedOkLabel}
                    </button>
                {/if}
            {/if}
        </Screen>
        <Controls />
    </Swipeable>
{/if}

<style>
    a {
        color: var(--theme-linkcolor);
    }

    h3 {
        margin-top: 30px;
        margin-bottom: 5px;

        font-size: 32px;
    }

    h4 {
        margin-bottom: 5px;
    }

    p {
        margin-top: 0;
        margin-bottom: 0;
    }

    button {
        width: var(--button-width);
        height: var(--button-height);

        border: 2px solid var(--theme-color);

        background-color: white;

        font-size: 25px;
        font-weight: bold;
        text-transform: uppercase;
    }

    #locationgranted,
    #staysafe {
        margin-top: 80px;
        margin-bottom: 10px;
    }

    /* #flagswrapper {
        padding: var(--ui-margin);

        color: white;
        background-color: var(--theme-background);
    } */

    /* #flagswrapper a {
        color: var(--theme-linkcolor);
    } */

    #welcomewrapper {
        position: absolute;

        width: 100%;
        height: 100%;

        padding-top: 45px;

        font-weight: bold;
        background: url('/media/overlay/welcome.png') no-repeat;
    }

    #welcomebackwrapper {
        background: url('/media/overlay/welcomeback.jpg') no-repeat;
    }

    #welcomebackwrapper h3 {
        margin-top: 97px;
    }

    .subheader {
        margin-top: 0;
        margin-bottom: 100px;
    }

    #player-title {
        padding-bottom: 10px;
        font-size: 30px;
    }

    #player-username-input {
        margin-top: -10px;
        margin-bottom: -10px;
    }

    #player-username-input {
        width: 100px;
        height: 60px;
        line-height: 60px;
        padding: 5px 120px;
        font-size: 18px;
        border-radius: 8px;
        border: none;
        outline: none;
        color: #fff;
        text-align: center;
        transition: 0.3s ease-in-out;
        display: block;
    }

    /* Style the container */
    .color-picker-container {
        --cp-bg-color: #333;
        --cp-border-color: white;
        --cp-text-color: white;
        --cp-input-color: #555;
        --cp-button-hover-color: #777;
    }
    .page-refresh-req {
        font-size: 16px !important ;
        display: block;
    }

    :global(.swipeable) {
        position: relative;
        height: 385px !important;

        color: white;
        background-color: var(--theme-background);
        overflow-x: hidden;
    }

    :global(.prev),
    :global(.next) {
        display: none;
    }
</style>
