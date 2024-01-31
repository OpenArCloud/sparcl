<script lang="ts">
    export let settings: { localisation?: boolean; showstats?: boolean };
    if (Object.keys(settings).length === 0) {
        settings.localisation = true;
        settings.showstats = true;
    }
</script>

<dl class="radio">
    <dt>
        <input id="xlocalisation" type="checkbox" bind:checked={settings.localisation} />
        <label for="xlocalisation">Localization required</label>
    </dt>
    <dt>
        <input id="showstats" type="checkbox" bind:checked={settings.showstats} />
        <label for="showstats">Show stats</label>
    </dt>
</dl>
