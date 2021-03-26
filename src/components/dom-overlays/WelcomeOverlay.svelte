<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Content of the introduction overlay.
-->

<script>
    import { createEventDispatcher } from 'svelte';

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
</style>


<h3>{$hasIntroSeen ? $infoGreeting : $introGreeting}</h3>
<div>{@html $hasIntroSeen ? $info : $intro}</div>
<div>{@html $arIsAvailable ? $arOkMessage : $noArMessage}</div>

{#if withOkFooter}
<footer>
    <button on:click={() => dispatch('okAction')}>{$startedOkLabel}</button>
</footer>
{/if}
