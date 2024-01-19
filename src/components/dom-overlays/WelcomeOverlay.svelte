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

    import { Swipeable, Screen, Controls } from 'thumb-ui';

    import { hasIntroSeen, arIsAvailable, isLocationAccessAllowed, arMode } from '@src/stateStore';
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
        locationaccessgranted,
        locationaccessrequired,
        locationaccessinfo,
        noservicesavailable,
    } from '@src/contentStore';
    import { ARMODES } from '@core/common';

    export let withOkFooter = true;
    export let shouldShowDashboard: boolean;
    export let shouldShowUnavailableInfo: boolean | null;
    export let isLocationAccessRefused = false;

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();
</script>

{#if $hasIntroSeen}
    <div class="swipeable" id="welcomebackwrapper">
        <h3>{$infoGreeting}</h3>
        <p class="subheader">{$info}</p>
        {#if isLocationAccessRefused}
            <p>
                Location access was refused. See
                <a href="https://openarcloud.github.io/sparcl/help/locationaccess.html">help</a> for more info
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
                <button disabled={isLocationAccessRefused} on:click={() => dispatch('requestLocation')} on:keydown={() => dispatch('requestLocation')}
                    >>
                    {$allowLocationLabel}
                </button>
            {:else}
                <button disabled={!$isLocationAccessAllowed} on:click={() => dispatch('okAction')} on:keydown={() => dispatch('okAction')}>
                    {shouldShowDashboard ? $dashboardOkLabel : $startedOkLabel}
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
            {:else}
                <h4 id="locationgranted">{$locationaccessgranted}</h4>
                <img src="/media/overlay/marker.png" alt="location marker" />
            {/if}
        </Screen>
        <Screen>
            <h4 id="staysafe">Stay safe</h4>
            <img src="/media/overlay/ready.png" alt="Ready icon showing phone" />
            <p>Always keep aware of your surroundings.</p>
        </Screen>
        <Screen>
            {#if shouldShowUnavailableInfo && $arMode !== ARMODES.develop && $arMode !== ARMODES.create}
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
                        {shouldShowDashboard ? $dashboardOkLabel : $startedOkLabel}
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

    #flagswrapper {
        padding: var(--ui-margin);

        color: white;
        background-color: var(--theme-background);
    }

    #flagswrapper a {
        color: var(--theme-linkcolor);
    }

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
