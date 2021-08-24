<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    export let settings;

    const EXPERIMENTTYPES = {
        // key: value
    };

    export async function loadSettings(key) {
        console.warn("loadSettings is not yet implemented!");
        /*
        let settings, viewerPromise;

        switch (key) {
            case EXPERIMENTTYPES.key:
                settings = await import('@experiments/<subroot>/<experimentname>/Settings')
                viewerPromise = import('@experiments/<subroot>/<experimentname>/Viewer');
                break;
            default:
                settings = null;
        }

        dispatch('change', {settings: settings?.default, viewerPromise, key});
        */
    }
</script>


<style>
    select {
        width: 100%;
        height: 39px;

        margin: 0;
        padding-left: 30px;

        border: 0;

        font-size: 18px;
        color: white;

        background: var(--theme-color) 0 0 no-repeat padding-box;
    }

    select:disabled {
        background: #8e9ca9 0 0 no-repeat padding-box;
    }
</style>


<select id="experimenttype"
        on:change={(event) => loadSettings(event.target.value)}
        disabled="{Object.keys(EXPERIMENTTYPES).length === 0}">
    <option value="none">None</option>
    {#each Object.entries(EXPERIMENTTYPES) as [key, value]}
        <option value="{key}">{value}</option>
    {/each}
</select>

