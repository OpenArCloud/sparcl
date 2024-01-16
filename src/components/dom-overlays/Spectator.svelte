<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<!--
    Content shown to non AR devices.
-->

<script lang="ts">
    import { allowP2pNetwork, selectedP2pService, availableP2pServices, p2pNetworkState } from '@src/stateStore';

    import L, { Map } from 'leaflet';
    let map: Map | null;

    function placeMarker(lat: number, lon: number, color: string) {
        if (map) {
            L.circle([lat, lon], {
                color: color,
                fillColor: color,
                fillOpacity: 0.5,
                radius: 1,
            }).addTo(map);
        }
    }

    /**
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events: any) {
        // Simply print any other events and return
        if (!('message_broadcasted' in events) && !('object_created' in events)) {
            console.log('Spectator: Unknown event received:');
            console.log(events);
            return;
        }

        // Log the messages received form others
        if ('message_broadcasted' in events) {
            let data = events.message_broadcasted;
            //            if (data.sender != $peerIdStr) { // ignore own messages which are also delivered
            if ('message' in data && 'sender' in data) {
                console.log('message from ' + data.sender + ': \n  ' + data.message);
            }
            //            }
        }

        // Place markers on a 2D map where others have created objects. Use the same color!
        if ('object_created' in events) {
            let data = events.object_created;
            //            if (data.sender != $peerIdStr) { // ignore own messages which are also delivered
            if ('scr' in data) {
                data = data.scr;
                if ('tenant' in data && data.tenant == 'ISMAR2021demo') {
                    const markerLat = data.content.geopose.position.lat;
                    const markerLon = data.content.geopose.position.lon;
                    const r = Math.round(255 * data.content.object_description.color[0]);
                    const g = Math.round(255 * data.content.object_description.color[1]);
                    const b = Math.round(255 * data.content.object_description.color[2]);
                    const markerColor = 'rgb(' + r + ',' + g + ',' + b + ')';
                    placeMarker(markerLat, markerLon, markerColor);
                }
            }
            //            }
        }
    }

    function mapAction(container: HTMLElement) {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    map = L.map(container, {
                        center: [position.coords.latitude, position.coords.longitude],
                        zoom: 20,
                    });

                    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                        attribution: `&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>,
                                &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>`,
                        subdomains: 'abcd',
                        maxZoom: 30,
                    }).addTo(map);

                    return {
                        destroy: () => {
                            map?.remove();
                            map = null;
                        },
                    };
                },
                (error) => {
                    console.log(`Location request failed: ${error}`);
                },
                {
                    enableHighAccuracy: false,
                },
            );
        }
    }

    function resizeMap() {
        if (map) {
            map.invalidateSize();
        }
    }
</script>

<details>
    <summary>Multiplayer</summary>

    <div class="inline">
        <input id="allowP2p" type="checkbox" bind:checked={$allowP2pNetwork} />
        <label for="allowP2p">Connect to p2p network</label>
    </div>

    <dl>
        <dt><label for="p2pserver">P2P Service</label></dt>
        <dd class="select">
            <select id="p2pserver" bind:value={$selectedP2pService} disabled={$availableP2pServices.length < 2 || $allowP2pNetwork === false}>
                {#if $availableP2pServices.length === 0}
                    <option>None</option>
                {:else}
                    {#each $availableP2pServices as service}
                        <option value={service}>{service.title}</option>
                    {/each}
                {/if}
            </select>
        </dd>
        <pre class="serviceurl">
            <label>URL: {$selectedP2pService?.url || 'no url'}</label>
            {#if $selectedP2pService?.properties != undefined && $selectedP2pService.properties.length != 0}
                {#each $selectedP2pService.properties as prop}
                    <label>{prop.type}: {prop.value}<br /></label>
                {/each}
            {/if}
        </pre>
        <p class="note">Change active after reload</p>
    </dl>

    <dl>
        <dt>Connection status</dt>
        <dd>{$p2pNetworkState}</dd>
    </dl>
</details>

<div id="map" use:mapAction></div>

<svelte:window on:resize={resizeMap} />

<svelte:head>
    <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.6.0/dist/leaflet.css"
        integrity="sha512-xwE/Az9zrjBIphAcBb3F6JVqxf46+CDLwfLMHloNu6KEQCAWi6HcDUbeOfBIptF7tcCzusKFjFw2yuvEpDL9wQ=="
        crossorigin=""
    />
</svelte:head>

<style>
    html,
    body,
    #map {
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
