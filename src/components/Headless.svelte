<!--
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { createEventDispatcher } from 'svelte';

    // P2P headless mode variables
    import { allowP2pNetwork, initialLocation } from '../stateStore';

    // Note: a headless client is a client that does not render anything, but registers itself at the peer-to-peer signaling server
    // so that mobile clients also connect to the headless client and they share the P2P history with it.
    // The headless client can run for an extended amount of time and keeps the history of the P2P network alive
    // so that when mobile clients connect later, they also get the history.

    export let urlParams: URLSearchParams;

    let currentSharedValues = {};
    let p2p: typeof import('@src/core/p2pnetwork') | null = null; // PeerJS module (optional)

    const dispatch = createEventDispatcher<{ broadcast: { event: string; value?: any; routing_key?: string } }>();

    // NOTE: these are only used in the headless client.
    // normal clients take them from an SSR instead
    const url = urlParams.get('signal') || undefined;
    const port = urlParams.get('port') || undefined;
    const path = urlParams.get('path') || undefined;
    const h3Index = urlParams.get('h3index');

    onMount(() => {
        console.log('Headless.svelte'); ///
        console.log('URL parameters: ' + urlParams?.toString() || 'none');

        allowP2pNetwork.set(true);
        import('@src/core/p2pnetwork').then((p2pModule) => {
            p2p = p2pModule;
            if (!p2p) {
                console.error('Failed to load p2pnetwork module');
                return;
            }

            console.log('Starting headless client...');
            console.log('  signal: ' + (url ? url : 'PeerJS default'));
            console.log('  port: ' + (port ? port : 'PeerJS default'));
            console.log('  path: ' + (path ? path : 'PeerJS default'));
            console.log('  h3index: ' + h3Index);

            if (!h3Index) {
                return console.error('No h3index provided for headless client');
            }

            // set initial location for headless client given H3 index and arbitrary other values
            initialLocation.set({h3Index:h3Index, lat:0, lon:0, countryCode: 'us', regionCode: 'us'});

            const portToUse = port ? parseInt(port) : null;
            p2p.connectWithExplicitUrl({
                url: url,
                port: portToUse,
                path: path,
                updateftn: (data: any) => {
                    // DEBUG
                    //console.log(data);
                    currentSharedValues = data;
                },
            });
        });
    });

    onDestroy(() => {
        dispatch('broadcast', {
            event: 'clear_session',
        });
        if (p2p) {
            p2p.disconnect();
        }
    });
</script>

<!-- Just for development to verify some internal values -->
<h1>Headless Mode</h1>
Signaling server: {url ? url : 'PeerJS default'} <br />
Port: {port ? port : 'PeerJS default'} <br />
Path: {path ? path : 'PeerJS default'} <br />
H3 Index: {h3Index} <br />
<br />
Last shared value: <br />
<pre>{JSON.stringify(currentSharedValues, null, 2)}</pre>
