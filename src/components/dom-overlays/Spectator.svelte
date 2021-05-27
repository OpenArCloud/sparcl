<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Content shown to non AR devices.
-->

<script>
    import { allowP2pNetwork, selectedP2pService, availableP2pServices, p2pNetworkState } from '@src/stateStore';

    import L from 'leaflet';

    export let isHeadless = false;


    let map;


    export function updateReceived(data) {
        L.circle([51.505, -0.09], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.5,
            radius: 1
        }).addTo(map);
    }

    function mapAction(container) {
        map = L.map(container, {
            center: [51.505, -0.09],
            zoom: 20
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: `&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>,
                                &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>`,
            subdomains: 'abcd',
            maxZoom: 30
        }).addTo(map);

        return {
            destroy: () => {
                map.remove();
                map = null;
            },
        };
    }

    function resizeMap() {
        if(map) { map.invalidateSize(); }
    }
</script>


<style>
    html, body, #map {
        margin: 0;
        padding: 0;
    }

    details {
        position: absolute;
        right: 10px;
        top: 120px;
        padding: 10px;
        border: 1px solid black;
        border-radius: 21px;
        background-color: white;
        z-index: 10000;
    }

    dd {
        margin-left: 0;
    }

    select {
        width: 100%;
        height: 30px;
    }

    #map {
        position: absolute;
        left: 0;
        top: 110px;
        margin: 0;
        padding: 0;
        width: 100vw;
        height: calc(100vh - 110px);
    }

    .note {
        color: red;
        margin-top: -15px;
    }
</style>


<details>
    <summary>Multiplayer</summary>

    <div class="inline">
        <input id="allowP2p" type="checkbox" bind:checked={$allowP2pNetwork} />
        <label for="allowP2p">Connect to p2p network</label>
    </div>

    <dl>
        <dt><label for="p2pserver">P2P Service</label></dt>
        <dd class="select"><select id="p2pserver" bind:value={$selectedP2pService}
                                   disabled="{$availableP2pServices.length < 2  || $allowP2pNetwork === false}">
            {#if $availableP2pServices.length === 0}
                <option>None</option>
            {:else}
                {#each $availableP2pServices as service}
                    <option value={service.id}>{service.title}</option>
                {/each}
            {/if}
        </select></dd>
    </dl>

    <p class="note">Change active after reload</p>

    <dl>
        <dt>Connection status</dt>
        <dd>{$p2pNetworkState}</dd>
    </dl>
</details>

<div id="map" use:mapAction></div>


<svelte:window on:resize={resizeMap} />

<svelte:head>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.6.0/dist/leaflet.css"
          integrity="sha512-xwE/Az9zrjBIphAcBb3F6JVqxf46+CDLwfLMHloNu6KEQCAWi6HcDUbeOfBIptF7tcCzusKFjFw2yuvEpDL9wQ=="
          crossorigin=""/>
</svelte:head>
