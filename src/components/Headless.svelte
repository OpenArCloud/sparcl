<!--
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { createEventDispatcher } from 'svelte';

    // P2P headless mode variables
    import { allowP2pNetwork } from '../stateStore';

    export let urlParams: URLSearchParams;

    let currentSharedValues = {};
    let p2p: typeof import('@src/core/p2pnetwork') | null = null; // PeerJS module (optional)

    const dispatch = createEventDispatcher<{ broadcast: { event: string; value?: any; routing_key?: string } }>();

    onMount(() => {
        console.log('Headless.svelte'); ///
        console.log('URL parameters: ' + urlParams?.toString() || 'none');

        allowP2pNetwork.set(true);
        import('@src/core/p2pnetwork').then((p2pModule) => {
            p2p = p2pModule;

            // NOTE: these are only used in the headless client.
            // normal clients take them from an SSR instead
            const headlessPeerId = urlParams.get('peerid');
            const url = urlParams.get('signal');
            const port = urlParams.get('port');
            const path = urlParams.get('path') || undefined;

            console.log('Starting headless client...');
            console.log('  peerid: ' + headlessPeerId);
            console.log('  signal: ' + (url ? url : 'PeerJS default'));
            console.log('  port: ' + (port ? port : 'PeerJS default'));
            console.log('  path: ' + (path ? path : 'PeerJS default'));

            if (headlessPeerId) {
                const portToUse = port ? parseInt(port) : null;
                p2p.connectWithExplicitUrl({
                    url: url,
                    port: portToUse,
                    path: path,
                    // TODO: pass peerid !!!
                    updateftn: (data: any) => {
                        // DEBUG
                        console.log(data);
                        currentSharedValues = data;
                    },
                });
            }
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
<pre>{JSON.stringify(currentSharedValues, null, 2)}</pre>
