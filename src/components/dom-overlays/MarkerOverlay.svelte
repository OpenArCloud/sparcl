<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Content of the marker intro overlay.
-->

<script>
    import { createEventDispatcher } from 'svelte';

    import { markerInfo, startedOkLabel } from "@src/contentStore";

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();
</script>


<style>
    button {
        width: var(--button-width);
        height: var(--button-height);
        border-radius: var(--ui-radius);
    }
</style>


<div>{@html $markerInfo}</div>

<footer>
        <button on:click={() => dispatch('okAction')}>{$startedOkLabel}</button>
</footer>
