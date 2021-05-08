<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    This component displays the internals of the app, and allows to change them when possible.
    Temporary until better UX is found for the settings.
-->
<script>
    import { createEventDispatcher } from 'svelte';

    import { supportedCountries} from 'ssd-access';

    import { showDashboard, initialLocation, availableGeoPoseServices, availableContentServices,
        availableP2pServices, selectedGeoPoseService, selectedContentService, selectedP2pService, arMode,
        currentMarkerImage, currentMarkerImageWidth, recentLocalisation, debug_appendCameraImage,
        debug_showLocationAxis, allowP2pNetwork, p2pNetworkState, isLocationAccessAllowed,
        creatorModeSettings, experimentModeSettings, dashboardDetail } from '@src/stateStore';

    import { ARMODES, CREATIONTYPES, EXPERIMENTTYPES, PLACEHOLDERSHAPES } from '@core/common';


    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();
</script>


<style>
    h2, summary {
        margin-top: 60px;
        margin-bottom: 15px;
        color: var(--theme-highlight);


        font-size: 1.5em;
        font-weight: bold;
    }

    legend h4 {
        margin-bottom: 0;
    }

    button {
        width: 100%;
        height: 50px;

        border: 2px solid var(--theme-color);

        text-transform: uppercase;
        font-weight: bold;
        font-size: 25px;
        letter-spacing: 0;

        background-color: white;
    }

    dt, .label {
        height: 20px;

        margin-bottom: 6px;

        font-weight: bold;
        text-align: left;
    }

    dd, .value {
        display: flex;
        align-items: center;

        margin-left: 0;
        margin-bottom: 20px;
        padding-left: 40px;

        height: 39px;
        border: 1px solid var(--theme-color);
    }

    dd.area {
        display: block;
        height: auto;
        padding: 0;
    }

    dd.area textarea {
        display: block;
        width: -webkit-fill-available;
        height: 75px;
        border: 0;
        resize: none;
    }

    dd.list {
        border: 0;
        padding: 0;
    }

    dd.list input {
        width: 100%;
        height: 39px;

        margin-top: 6px;
        padding-left: 40px;

        font-size: 18px;
    }

    dd.unitinput {
        padding: 3px;
    }

    dd.unitinput input {
        width: 100%;
        height: 37px;

        padding-left: 40px;

        border: 0;
    }

    dl.radio {
        margin-top: 35px;
        margin-bottom: 60px;
    }

    dl.radio dd {
        height: 22px;

        padding-left: 0;
        border: 0;
    }

    dl.radio.connected {
        margin-top: 7px;
        margin-bottom: 30px;
    }

    dd.select {
        border: 0;
        padding: 0;
    }

    fieldset {
        margin: 0;
        padding: 0;
        border: 0;
    }

    input[type=checkbox] {
        margin-bottom: 14px;
    }

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

    pre {
        margin: 5px;
    }

    #showagain {
        margin-top: 20px;
        margin-bottom: 26px;
    }

    .autoheight {
        height: initial;

        padding: 0;
    }
</style>


<button on:click={() => dispatch('okClicked')}>Go immersive</button>

<details bind:open="{$dashboardDetail.state}">
    <summary>Application state</summary>

    <div>
        <input id="showagain" type="checkbox" bind:checked={$showDashboard} />
        <label for="showagain">Show Dashboard next time</label>
    </div>

    <dl>
        <dt>Location access</dt>
        <dd>{$isLocationAccessAllowed ? 'Allowed' : 'Not allowed'}</dd>
        {#if !isLocationAccessAllowed}
            <dd>Request access</dd>
        {/if}
    </dl>

    <dl>
        <dt>H3Index</dt>
        <dd>{$initialLocation.h3Index}</dd>
        <dt>Country</dt>
        <dd>{$initialLocation.countryCode}</dd>
        <dt>OSCP Region</dt>
        <!--  TODO: Might make sense to do some validation here  -->
        <dd class="list"><input list="supported-countries" bind:value={$initialLocation.regionCode} /></dd>
    </dl>

    <dl class="radio connected">
        <dt>AR mode</dt>
        <dd>
            <input id="armodeoscp" type="radio" bind:group={$arMode} value="{ARMODES.oscp}"
                   class:disabled="{$availableGeoPoseServices.length === 0  || null}"/>
            <label for="armodeoscp">{ARMODES.oscp}</label>
        </dd>
        <dd>
            <input id="armodecreator" type="radio" bind:group={$arMode} value="{ARMODES.creator}" />
            <label for="armodecreator">{ARMODES.creator}</label>
        </dd>
        <dd>
            <input id="armodedev" type="radio" bind:group={$arMode} value="{ARMODES.dev}" />
            <label for="armodedev">{ARMODES.dev}</label>
        </dd>
        <dd>
            <input id="armodetest" type="radio" bind:group={$arMode} value="{ARMODES.experiment}" />
            <label for="armodetest">{ARMODES.experiment}</label>
        </dd>
    </dl>

    {#if $arMode === ARMODES.oscp}
    <dl>
        <dt><label for="geoposeServer">GeoPose Server</label></dt>
        <dd class="select"><select id="geoposeServer" bind:value={$selectedGeoPoseService}
                                   class:disabled="{$availableGeoPoseServices.length < 2  || null}">
            {#if $availableGeoPoseServices.length === 0}
                <option>None</option>
            {:else}
                {#each $availableGeoPoseServices as service}
                    <option value={service}>{service.title}</option>
                {/each}
            {/if}
        </select></dd>
    </dl>

    <dl>
        <dt>Recent GeoPose</dt>
        <dd class="autoheight"><pre>{JSON.stringify($recentLocalisation.geopose, null, 2)}</pre></dd>
    <!--    TODO: Values aren't displayed for some reason. Fix. -->
    <!--    <dt>at</dt>-->
    <!--    <dd><pre>{JSON.stringify($recentLocalisation.floorpose, null, 2)}</pre></dd>-->
    </dl>

    <dl>
        <dt><label for="contentserver">Content Server</label></dt>
        <dd class="select"><select id="contentserver" bind:value={$selectedContentService}
                                   class:disabled="{$availableContentServices.length < 2  || null}">
            {#if $availableContentServices.length === 0}
                <option>None</option>
            {:else}
                {#each $availableContentServices as service}
                    <option value={service}>{service.title}</option>
                {/each}
            {/if}
        </select></dd>
    </dl>

    <dl>
        <dt><label for="p2pserver">P2P Service</label></dt>
        <dd class="select"><select id="p2pserver" bind:value={$selectedP2pService}
                                   class:disabled="{$availableP2pServices.length < 2  || null}">
            {#if $availableP2pServices.length === 0}
                <option>None</option>
            {:else}
                {#each $availableP2pServices as service}
                    <option value={service}>{service.title}</option>
                {/each}
            {/if}
        </select></dd>
    </dl>
    {/if}

    {#if $arMode === ARMODES.marker}
    <dl>
        <dt>Marker image</dt>
        <dd>{$currentMarkerImage}</dd>
        <dt><label for="markerwidth">Width</label></dt>
        <dd class="unitinput"><input id="markerwidth" type="number" bind:value={$currentMarkerImageWidth} />m</dd>
    </dl>
    {/if}

    {#if $arMode === ARMODES.creator}
    <dl>
        <dt><label for="creatortype">Content Type</label></dt>
        <dd class="select"><select id="creatortype" bind:value={$creatorModeSettings.type}>
            {#each Object.values(CREATIONTYPES) as type}
            <option value="{type}">{type}</option>
            {/each}
        </select></dd>

        {#if $creatorModeSettings.type === CREATIONTYPES.placeholder}
        <dt><label for="creatorshape">Content Shape</label></dt>
        <dd class="select"><select id="creatorshape" bind:value={$creatorModeSettings.shape}>
            {#each Object.values(PLACEHOLDERSHAPES) as shape}
            <option value="{shape}">{shape}</option>
            {/each}
        </select></dd>

        {:else if $creatorModeSettings.type === CREATIONTYPES.model}
        <dt><label for="modelurl">URL</label></dt>
        <dd class="area"><textarea id="modelurl" bind:value={$creatorModeSettings.modelurl}></textarea></dd>

        {:else}
        <dt><label for="sceneurl">URL</label></dt>
        <dd class="area"><textarea id="sceneurl" bind:value={$creatorModeSettings.sceneurl}></textarea></dd>
        {/if}
    </dl>
    {/if}

    {#if $arMode === ARMODES.experiment}
        <dl>
            <dt><label for="experimenttype">Type</label></dt>
            <dd class="select"><select id="experimenttype" bind:value={$experimentModeSettings.type}>
                {#each Object.values(EXPERIMENTTYPES) as type}
                    <option value="{type}">{type}</option>
                {/each}
            </select></dd>
        </dl>

        {#if $experimentModeSettings.type === EXPERIMENTTYPES.game}
            <dl class="radio">
                <dt>Add placeholders</dt>
                <dd>
                    <input id="addmanually" type="radio"
                           bind:group={$experimentModeSettings.game.add} value="manually" />
                    <label for="addmanually">Manually</label>
                </dd>
                <dd>
                    <input id="addautomatically" type="radio"
                           bind:group={$experimentModeSettings.game.add} value="automatically" />
                    <label for="addautomatically">Automatically</label>
                </dd>

                <dt>Keep elements</dt>
                <dd>
                    <input id="keepall" type="radio" bind:group={$experimentModeSettings.game.keep} value="all" />
                    <label for="keepall">All</label>
                </dd>
                <dd>
                    <input id="keepupto" type="radio" bind:group={$experimentModeSettings.game.keep} value="upto" />
                    <label for="keepupto">Up to 20m</label>
                </dd>

                <dt>
                    <input id="showstats" type="checkbox" bind:checked={$experimentModeSettings.game.showstats} />
                    <label for="showstats">Show stats</label>
                </dt>
            </dl>
        {/if}
    {/if}
</details>

<details bind:open="{$dashboardDetail.multiplayer}">
    <summary>Multiplayer</summary>
    <div>
        <input id="allowP2p" type="checkbox" bind:checked={$allowP2pNetwork} />
        <label for="allowP2p">Connect to p2p network</label>
    </div>

    <dl>
        <dt>Connection status</dt>
        <dd>{$p2pNetworkState}</dd>
    </dl>
</details>



<details bind:open="{$dashboardDetail.debug}">
    <summary>Debug settings</summary>
    <div>
        <input id="appendcameraimage" type="checkbox" bind:checked={$debug_appendCameraImage} />
        <label for="appendcameraimage">Append captured image</label>
    </div>

    <div>
        <input id="showlocationaxis" type="checkbox" bind:checked={$debug_showLocationAxis} />
        <label for="showlocationaxis">Show local zero point markers</label>
    </div>
</details>


{@html supportedCountries}
