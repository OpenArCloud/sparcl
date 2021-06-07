<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Content of the introduction overlay.
-->

<script>
    import { createEventDispatcher } from 'svelte';

    import { Swipeable, Screen, Controls } from 'buhrmi';

    import { hasIntroSeen, arIsAvailable, isLocationAccessAllowed, arMode } from '@src/stateStore';
    import { infoGreeting, info, introGreeting, intro, arOkMessage, dashboardOkLabel,
        startedOkLabel, unavailableInfo, allowLocationLabel, locationaccessgranted, locationaccessrequired,
        locationaccessinfo, noservicesavailable } from '@src/contentStore';
    import { ARMODES } from "@core/common";

    export let withOkFooter = true;
    export let shouldShowDashboard;
    export let shouldShowUnavailableInfo;
    export let isLocationAccessRefused = false;


    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();
</script>


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

    #locationgranted, #staysafe {
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
        background: url("/media/overlay/welcome.svg") no-repeat;
    }

    #welcomebackwrapper {
        background: url("/media/overlay/welcomeback.svg") no-repeat;
    }

    #welcomebackwrapper h3 {
        margin-top: 97px;
    }

    .subheader {
        margin-top: 0;
        margin-bottom: 100px
    }

    :global(.swipeable)  {
        position: relative;
        height: 385px !important;

        color: white;
        background-color: var(--theme-background);
        overflow-x: hidden;
    }

    :global(.prev), :global(.next) {
        display: none;
    }
</style>


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
            <button disabled="{isLocationAccessRefused}" on:click={() => dispatch('requestLocation')}>
                {$allowLocationLabel}
            </button>
            {:else}
            <button disabled="{!$isLocationAccessAllowed}" on:click={() => dispatch('okAction')}>
                {shouldShowDashboard ? $dashboardOkLabel : $startedOkLabel}
            </button>
            {/if}
        {/if}
    </div>
{:else if $arIsAvailable}
    <Swipeable>
        <Screen>
            <div id="welcomewrapper">
                <h3>{$introGreeting}</h3>
                <div>{@html $intro}</div>
            </div>
        </Screen>
<!--
        TODO: Needs some styling
        <Screen>
            <h4 id="staysafe">Stay safe</h4>
            <p>Always be aware of your surroundings.</p>
        </Screen>
-->
        <Screen>
            {#if !$isLocationAccessAllowed}
            <h4>{$locationaccessrequired}</h4>
            <p>{@html $locationaccessinfo}</p>
            <img src="/media/overlay/marker.svg" alt="location marker" />
            <button on:click={() => dispatch('requestLocation')}>{$allowLocationLabel}</button>
            {:else}
            <h4 id="locationgranted">{$locationaccessgranted}</h4>
            <img src="/media/overlay/marker.svg" alt="location marker" />
            {/if}
        </Screen>
        <Screen>
            {#if shouldShowUnavailableInfo && $arMode !== ARMODES.dev && $arMode !== ARMODES.creator}
            <h4>{$noservicesavailable}</h4>
            <div>{$unavailableInfo}</div>
                {#if withOkFooter}
                <button disabled="{!$isLocationAccessAllowed}" on:click={() => dispatch('dashboardAction')}>
                    {$dashboardOkLabel}
                </button>
                {/if}

            {:else}
            <div>{@html $arOkMessage}</div>
            <img src="/media/overlay/ready.svg" alt="Ready icon showing phone" />
                {#if $arMode !== ARMODES.oscp}
                    <p>{$arMode} mode active</p>
                {/if}

                {#if withOkFooter}
                <button disabled="{!$isLocationAccessAllowed}" on:click={() => dispatch('okAction')}>
                    {shouldShowDashboard ? $dashboardOkLabel : $startedOkLabel}
                </button>
                {/if}

            {/if}
        </Screen>

        <Controls />
    </Swipeable>
{/if}
