<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Content shown to non AR devices.
-->

<script>
    import { onMount } from 'svelte';

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


<div id="map" use:mapAction></div>


<svelte:window on:resize={resizeMap} />

<svelte:head>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.6.0/dist/leaflet.css"
          integrity="sha512-xwE/Az9zrjBIphAcBb3F6JVqxf46+CDLwfLMHloNu6KEQCAWi6HcDUbeOfBIptF7tcCzusKFjFw2yuvEpDL9wQ=="
          crossorigin=""/>
</svelte:head>
