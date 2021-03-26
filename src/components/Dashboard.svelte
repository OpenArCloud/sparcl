<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    This component displays the internals of the app, and allows to change them when possible.
-->
<script>
    import { createEventDispatcher } from 'svelte';

    import { supportedCountries} from 'ssd-access';

    import { showDashboard, initialLocation, availableGeoPoseServices, availableContentServices,
        availableP2pServices, selectedGeoPoseService, selectedContentService, selectedP2pService, arMode,
        currentMarkerImage, currentMarkerImageWidth, recentLocalisation, debug_appendCameraImage,
        debug_showLocationAxis, debug_useLocalServerResponse, allowP2pNetwork, p2pNetworkState
        } from '@src/stateStore';

    import { ARMODES } from '@core/common';


    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();
</script>


<style>
    h2 {
        margin-top: 60px;
        color: var(--theme-highlight);
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

    dd.select {
        border: 0;
        padding: 0;
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


<!-- TODO: Extract strings to contentStore -->


<button on:click={() => dispatch('okClicked')}>Go immersive</button>


<h2>Application state</h2>

<div>
    <input id="showagain" type="checkbox" bind:checked={$showDashboard} />
    <label for="showagain">Show Dashboard next time</label>
</div>

<dl>
    <dt>H3Index</dt>
    <dd>{$initialLocation.h3Index}</dd>
    <dt>Country</dt>
    <dd>{$initialLocation.countryCode}</dd>
    <dt>OSCP Region</dt>
    <!--  TODO: Might make sense to do some validation here  -->
    <dd class="list"><input list="supported-countries" bind:value={$initialLocation.regionCode} /></dd>
</dl>

<dl class="radio">
    <dt>AR mode</dt>
    <dd>
        <input id="armodeoscp" type="radio" bind:group={$arMode} value="{ARMODES.oscp}"
               disabled="{$availableGeoPoseServices.length === 0  || null}"/>
        <label for="armodeoscp">{ARMODES.oscp}</label>
    </dd>
    <dd>
        <input id="armodemarker" type="radio" bind:group={$arMode} value="{ARMODES.marker}" />
        <label for="armodemarker">{ARMODES.marker}</label>
    </dd>
    <dd>
        <input id="armodeauto" type="radio" bind:group={$arMode} value="{ARMODES.auto}" />
        <label for="armodeauto">{ARMODES.auto}</label>
    </dd>
</dl>

<dl>
    <dt>GeoPose Server</dt>
    <dd class="select"><select bind:value={$selectedGeoPoseService} disabled="{$availableGeoPoseServices.length < 2  || null}">
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
<!--    <dd><pre>{JSON.stringify($recentLocalisation.localpose, null, 2)}</pre></dd>-->
</dl>

<dl>
    <dt>Content Server</dt>
    <dd class="select"><select bind:value={$selectedContentService} disabled="{$availableContentServices.length < 2  || null}">
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
    <dt>P2P Service</dt>
    <dd class="select"><select bind:value={$selectedP2pService} disabled="{$availableP2pServices.length < 2  || null}">
        {#if $availableP2pServices.length === 0}
            <option>None</option>
        {:else}
            {#each $availableP2pServices as service}
                <option value={service}>{service.title}</option>
            {/each}
        {/if}
    </select></dd>
</dl>

<dl>
    <dt>Marker image</dt>
    <dd>{$currentMarkerImage}</dd>
    <dt>Width</dt>
    <dd class="unitinput"><input type="number" bind:value={$currentMarkerImageWidth} />m</dd>
</dl>

<h2>Multiplayer</h2>
<div>
    <input id="allowP2p" type="checkbox" bind:checked={$allowP2pNetwork} />
    <label for="allowP2p">Connect to p2p network</label>
</div>

<dl>
    <dt>Connection status</dt>
    <dd>{$p2pNetworkState}</dd>
</dl>



<h2>Debug settings</h2>

<div>
    <input id="appendcameraimage" type="checkbox" bind:checked={$debug_appendCameraImage} />
    <label for="appendcameraimage">Append captured image</label>
</div>

<div>
    <input id="showlocationaxis" type="checkbox" bind:checked={$debug_showLocationAxis} />
    <label for="showlocationaxis">Show local zero point markers</label>
</div>

<div>
    <input id="uselocalserverresponse" type="checkbox" bind:checked={$debug_useLocalServerResponse} />
    <label for="uselocalserverresponse">Use local server response</label>
</div>


{@html supportedCountries}
