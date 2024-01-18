<script>
    export let settings;
    if (Object.keys(settings).length === 0) {
        settings.localisation = false;
        settings.add = 'manually';
        settings.keep = 'all';
        settings.showstats = true;
    }
</script>

<dl class="radio">
    <dt>Localisation</dt>
    <dd>
        <input id="xlocalisation" type="checkbox" bind:checked={settings.localisation} />
        <label for="xlocalisation">Required</label>
    </dd>
    <dt>Add placeholders</dt>
    <dd>
        <input id="addmanually" type="radio" bind:group={settings.add} value="manually" />
        <label for="addmanually">Manually</label>
    </dd>
    <dd>
        <input id="addautomatically" type="radio" bind:group={settings.add} value="automatically" />
        <label for="addautomatically">Automatically</label>
    </dd>

    <dt>Keep elements</dt>
    <dd>
        <input id="keepall" type="radio" bind:group={settings.keep} value="all" />
        <label for="keepall">All</label>
    </dd>
    <dd>
        <input id="keepupto" type="radio" bind:group={settings.keep} value="upto" />
        <label for="keepupto">Up to 20m</label>
    </dd>

    <dt>
        <input id="showstats" type="checkbox" bind:checked={settings.showstats} />
        <label for="showstats">Show stats</label>
    </dt>
</dl>
