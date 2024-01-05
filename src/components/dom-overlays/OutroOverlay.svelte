<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Content of the outro overlay.
-->

<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    import { outroGreeting, outro, doitOkLabel, dashboardOkLabel } from '@src/contentStore';

    export let shouldShowDashboard: boolean | null = null;

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher<{ okAction: undefined }>();
</script>

<div class="swipeable">
    <h3>{$outroGreeting}</h3>
    <p>{@html $outro}</p>

    <footer>
        <button on:click={() => dispatch('okAction')}>
            {shouldShowDashboard === true ? $dashboardOkLabel : $doitOkLabel}
        </button>
    </footer>
</div>

<style>
    h3 {
        margin-top: 100px;
        margin-bottom: 5px;

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

    p {
        margin-top: 0;
        margin-bottom: 65px;
    }
</style>
