<script>
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();
    const EXPERIMENTTYPES = {
        // key: value
    };

    async function loadSettings(event) {
        let settings, viewer;

        switch (event.target.value) {
            case EXPERIMENTTYPES.key:
                settings = await import('@experiments/mv/performance/Settings')
                viewer = import('@experiments/mv/performance/Viewer');
                break;
            default:
                settings = null;
        }

        dispatch('change', [settings?.default, viewer]);
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
</style>


<select id="experimenttype" on:change={loadSettings} disabled="{Object.keys(EXPERIMENTTYPES).length === 0}">
    <option value="none">None</option>
    {#each Object.entries(EXPERIMENTTYPES) as [key, value]}
        <option value="{key}">{value}</option>
    {/each}
</select>

