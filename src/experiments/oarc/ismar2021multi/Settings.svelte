<script lang="ts">
    export let settings: { localizationRequired?: boolean; showstats?: boolean };
    if (Object.keys(settings).length === 0) {
        settings.localizationRequired = true;
        settings.showstats = true;
    }
</script>

<dl class="radio">
    <dt>
        <input id="xlocalisation" type="checkbox" bind:checked={settings.localizationRequired} />
        <label for="xlocalisation">Localization required</label>
    </dt>
    <dt>
        <input id="showstats" type="checkbox" bind:checked={settings.showstats} />
        <label for="showstats">Show stats</label>
    </dt>
</dl>
