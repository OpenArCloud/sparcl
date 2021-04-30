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
    import { infoGreeting, info, introGreeting, intro, arOkMessage, noArMessage, dashboardOkLabel,
        startedOkLabel, unavailableInfo, locationaccessgranted, locationaccessrequired, locationaccessinfo,
        noservicesavailable } from '@src/contentStore';
    import { ARMODES } from "@core/common";

    export let withOkFooter = true;
    export let shouldShowDashboard;
    export let shouldShowUnavailableInfo;


    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();
</script>


<style>
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
        background: url("/media/overlay/welcome.png") no-repeat;
    }

    #welcomebackwrapper {
        background: url("/media/overlay/welcomeback.jpg") no-repeat;
    }

    #welcomebackwrapper h3 {
        margin-top: 97px;
    }

    #welcomebackwrapper p {
        margin-top: 0;
        margin-bottom: 115px
    }

    :global(.swipeable)  {
        position: relative;
        height: 369px !important;

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
        <p>{$info}</p>
        {#if withOkFooter}
            <button disabled="{!$isLocationAccessAllowed}" on:click={() => dispatch('okAction')}>
                {shouldShowDashboard ? $dashboardOkLabel : $startedOkLabel}
            </button>
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
            <img src="/media/overlay/marker.png" alt="location marker" />
            <button on:click={() => dispatch('requestLocation')}>Allow</button>
            {:else}
            <h4 id="locationgranted">{$locationaccessgranted}</h4>
            <img src="/media/overlay/marker.png" alt="location marker" />
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
            <img src="/media/overlay/ready.png" alt="Ready icon showing phone" />
                {#if withOkFooter}
                <button disabled="{!$isLocationAccessAllowed}" on:click={() => dispatch('okAction')}>
                    {shouldShowDashboard ? $dashboardOkLabel : $startedOkLabel}
                </button>
                {/if}

            {/if}
        </Screen>

        <Controls />
    </Swipeable>
{:else}
    <div id="flagswrapper">
        <p>{@html $noArMessage}</p>
        <p>
            Chrome with <a href="https://openarcloud.github.io/sparcl/guides/incubationflag.html">enabled WebXR incubation
            features</a> on an <a href="https://developers.google.com/ar/devices">AR capable device</a> required.
        </p>
    </div>
{/if}
