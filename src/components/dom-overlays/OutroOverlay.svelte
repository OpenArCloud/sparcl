<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Content of the outro overlay.
-->

<script>
    import { createEventDispatcher } from 'svelte';

    import { outroGreeting, outro, doitOkLabel } from '@src/contentStore';


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

        margin-top: 23px;
        border: 2px solid var(--theme-color);

        background-color: white;

        font-size: 25px;
        text-transform: uppercase;
    }
</style>


<h3>{$outroGreeting}</h3>
<div>{@html $outro}</div>

<footer>
    <button on:click={() => dispatch('okAction')}>{$doitOkLabel}</button>
</footer>
