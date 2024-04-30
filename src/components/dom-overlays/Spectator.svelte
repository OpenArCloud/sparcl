<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<!--
    Spectator view is the content shown on non-AR-capable devices.
-->
<script lang="ts">
    import { allowP2pNetwork, selectedP2pService, availableP2pServices, p2pNetworkState, peerIdStr, availableMessageBrokerServices } from '@src/stateStore';
    import { v4 as uuidv4 } from 'uuid';

    import L from 'leaflet';

    import { createRandomObjectDescription } from '@core/engines/ogl/modelTemplates';
    import { type ObjectDescription } from '../../types/xr';
    import { createEventDispatcher } from 'svelte';
    import { connectWithReceiveCallback, testRmqConnection } from '../../core/rmqnetwork';
    import MessageBrokerSelector from './MessageBrokerSelector.svelte';
    import P2PServiceSelector from './P2PServiceSelector.svelte';
    import { type SCR } from '@oarc/scd-access'

    let map: L.Map | null;
    let shouldPlaceRandomObjects = false;

    const ephemeral_markers: {[id:string]: L.Layer} = {};
    const ephemeral_scrs: {[id:string]: SCR} = {};

    const dispatch = createEventDispatcher<{ broadcast: { event: string; value?: any; routing_key?: string } }>();

    function shareObject({ lat, lon, objectDescription }: { lat: number; lon: number; objectDescription: ObjectDescription }) {
        // We create a new spatial content record just for sharing over the P2P network, not registering in the platform
        const object_id = $peerIdStr + '_' + uuidv4(); // TODO: only a proposal: the object id is the creator id plus a new uuid
        const scr_id = object_id;
        const timestamp = new Date().getTime();
        const message_body = {
            scr: {
                content: {
                    id: object_id,
                    type: 'ephemeral', // high-level OSCP type
                    title: objectDescription.shape,
                    refs: [],
                    geopose: {
                        position: {
                            lat,
                            lon,
                            h: 0,
                        },
                        quaternion: {
                            x: 0,
                            y: 0,
                            z: 0,
                            w: 1,
                        },
                    },
                    object_description: objectDescription,
                },
                id: scr_id,
                tenant: 'ISMAR2021demo',
                type: 'scr',
                timestamp: timestamp,
            },
            sender: $peerIdStr,
            timestamp: timestamp,
        };
        dispatch('broadcast', {
            event: 'object_created',
            value: message_body,
        });
    }

    function placeMarker(id: string, lat: number, lon: number, color: string) {
        if (map == null) {
            return;
        }
        const marker = L.circle([lat, lon], {
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
            radius: 1,
        })
        marker.addTo(map);
        ephemeral_markers[id] = marker;
    }

    /**
     * Handle events from the application or from the P2P network
     * NOTE: sometimes multiple events are bundled using different keys!
     */
    export function onNetworkEvent(events: any) {
        // Simply print any other events and return
        if (!('message_broadcasted' in events) &&
            !('object_created' in events) &&
            !('clear_session' in events))
        {
            console.log('Spectator: Unknown event received:');
            console.log(events);
            return;
        }

        // Log the messages received form others
        if ('message_broadcasted' in events) {
            let data = events.message_broadcasted;
            ///if (data.sender != $peerIdStr) { // ignore own messages which are also delivered
            if ('message' in data && 'sender' in data) {
                console.log('message from ' + data.sender + ': \n  ' + data.message);
            }
            ///}
        }

        // Place markers on a 2D map where others have created objects. Use the same color!
        if ('object_created' in events) {
            let data = events.object_created;
            ///if (data.sender != $peerIdStr) { // ignore own messages which are also delivered
            if ('scr' in data) {
                data = data.scr;
                if ('tenant' in data && data.tenant == 'ISMAR2021demo') {
                    const markerLat = data.content.geopose.position.lat;
                    const markerLon = data.content.geopose.position.lon;
                    const r = Math.round(255 * data.content.object_description.color[0]);
                    const g = Math.round(255 * data.content.object_description.color[1]);
                    const b = Math.round(255 * data.content.object_description.color[2]);
                    const markerColor = 'rgb(' + r + ',' + g + ',' + b + ')';
                    const id = data.id as string;
                    placeMarker(id, markerLat, markerLon, markerColor);
                    ephemeral_scrs[id] = data;
                }
            }
            ///}
        }

        if ('clear_session' in events) {
            if (map) {
                for (let id in ephemeral_markers) {
                    ephemeral_markers[id].removeFrom(map);
                    delete ephemeral_markers[id];
                }
            }
            for (let id in ephemeral_scrs) {
                delete ephemeral_scrs[id];
            }
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

                    map.on('click', (event) => {
                        if (shouldPlaceRandomObjects) {
                            const objectDescription = createRandomObjectDescription();
                            shareObject({ objectDescription, lat: event.latlng.lat, lon: event.latlng.lng });
                        }
                    });

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

    async function messageBrokerSubmit({ url, username, password }: { url: string; username: string; password: string }) {
        await testRmqConnection({ url, username, password });
        connectWithReceiveCallback({ url, username, password, updateFunction: onNetworkEvent });
    }
</script>

<div id="place-random-object">
    <label for="place-random-object-checkbox">Place random object by clicking on map</label>
    <input bind:checked={shouldPlaceRandomObjects} type="checkbox" id="place-random-object-checkbox" name="place-random-object-checkbox" />
</div>

<details>
    <summary>Multiplayer</summary>
    {#if $availableP2pServices.length === 0 && $availableMessageBrokerServices.length === 0}
        <p>No multiplayer services are available</p>
    {/if}

    <P2PServiceSelector on:broadcast={(event) => {
            if ('clear_session' == event.detail.event) {
                onNetworkEvent({clear_session: {}}) // process here to clean the map view
            }
            dispatch('broadcast', event.detail); // forward to App (to Automerge)
        }
    } />


    <MessageBrokerSelector
        onSubmit={messageBrokerSubmit}
        submitButtonLabel="Connect to message broker service"
        submitFailureMessage="Failed to connect to message broker. Reason:"
        submitSuccessMessage="Succesfully connected to message broker service"
    ></MessageBrokerSelector>
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
        top: 180px;
        padding: 10px;
        border: 1px solid black;
        border-radius: 21px;
        background-color: white;
        z-index: 10000;
    }
    #place-random-object {
        border: 1px solid black;
        border-radius: 21px;
        display: flex;
        gap: 5px;
        position: absolute;
        right: 10px;
        top: 120px;
        padding: 10px;
        background-color: white;
        z-index: 10000;
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
</style>
