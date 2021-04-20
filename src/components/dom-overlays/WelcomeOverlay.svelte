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

    import { hasIntroSeen, arIsAvailable, isLocationAccessAllowed } from '@src/stateStore';
    import { infoGreeting, info, introGreeting, intro, arOkMessage, noArMessage, dashboardOkLabel,
        startedOkLabel } from '@src/contentStore';

    export let withOkFooter = true;
    export let shouldShowDashboard;


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

    #locationgranted {
        margin-top: 80px;
        margin-bottom: 10px;
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
        background-color: #2A2C32;
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
        <Screen>
            {#if !$isLocationAccessAllowed}
            <h4>Location access required.</h4>
            <p>It is needed to define the <br/>initial area for localisation.</p>
            <img src="/media/overlay/marker.png" alt="location marker" />
            <button on:click={() => dispatch('requestLocation')}>Allow</button>
            {:else}
            <h4 id="locationgranted">Location access granted.</h4>
            <img src="/media/overlay/marker.png" alt="location marker" />
            {/if}
        </Screen>
        <Screen>
            <div>{@html $arOkMessage}</div>
            <img src="/media/overlay/ready.png" alt="Ready icon showing phone" />
            {#if withOkFooter}
                <button disabled="{!$isLocationAccessAllowed}" on:click={() => dispatch('okAction')}>
                    {shouldShowDashboard ? $dashboardOkLabel : $startedOkLabel}
                </button>
            {/if}
        </Screen>

        <Controls />
    </Swipeable>
{:else}
    <div>{@html $noArMessage}</div>
{/if}
