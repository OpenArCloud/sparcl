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
    import { infoGreeting, info, introGreeting, intro, arOkMessage, noArMessage,
        startedOkLabel } from '@src/contentStore';

    export let withOkFooter = true;


    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();
</script>


<style>
    h3 {
        margin-top: 0;

        font-size: 30px;
        color: var(--theme-highlight);
    }

    button {
        width: var(--button-width);
        height: var(--button-height);

        border: 2px solid var(--theme-color);

        background-color: white;

        font-size: 25px;
        text-transform: uppercase;
    }

    :global(.swipeable)  {
        position: relative;
        height: 300px !important;
        overflow-x: hidden;
    }

    :global(.prev), :global(.next) {
        display: none;
    }
</style>


{#if $hasIntroSeen}
    <h3>{$infoGreeting}</h3>
    <div>{@html $info}</div>
{:else if $arIsAvailable}
    <Swipeable>
        <Screen>
            <h3>{$introGreeting}</h3>
            <div>{@html $intro}</div>
        </Screen>
        <Screen>
            {#if !$isLocationAccessAllowed}
            <h4>Location access required.</h4>
            <p>It is needed to define the initial area for localisation.</p>
            <button on:click={() => dispatch('requestLocation')}>Allow</button>
            {:else}
            <h4>Location access granted.</h4>
            {/if}
        </Screen>
        <Screen>
            <div>{@html $arOkMessage}</div>
            {#if withOkFooter}
                <button disabled="{!$isLocationAccessAllowed}" on:click={() => dispatch('okAction')}>{$startedOkLabel}</button>
            {/if}
        </Screen>

        <Controls />
    </Swipeable>
{:else}
    <div>{@html $noArMessage}</div>
{/if}
