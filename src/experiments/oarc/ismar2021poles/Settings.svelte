<script>
    export let settings;
    if (Object.keys(settings).length === 0) {
        settings.localisation = true;
    }
</script>

<dl class="radio">
    <dt>
        <input id="xlocalisation" type="checkbox" bind:checked={settings.localisation} />
        <label for="xlocalisation">Localization required</label>
    </dt>
</dl>
