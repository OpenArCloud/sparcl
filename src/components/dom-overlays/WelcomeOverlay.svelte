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

    import { hasIntroSeen, arIsAvailable } from '@src/stateStore';
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
{:else}
    <Swipeable>
        <Screen>
            <h3>{$introGreeting}</h3>
            <div>{@html $intro}</div>
        </Screen>
        <Screen>
            <h4>Location access required.</h4>
            <button on:click={dispatch('requestLocation')}>Allow</button>
        </Screen>
        <Screen>
            <div>{@html $arIsAvailable ? $arOkMessage : $noArMessage}</div>
            {#if withOkFooter}
                <button on:click={() => dispatch('okAction')}>{$startedOkLabel}</button>
            {/if}
        </Screen>

        <Controls />
    </Swipeable>
{/if}
