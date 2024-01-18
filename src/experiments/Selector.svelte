<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<script lang="ts">
    import { type ComponentType, createEventDispatcher } from 'svelte';
    import type { ExperimentsViewers } from '../types/xr';
    const dispatch = createEventDispatcher<{ change: { settings: Promise<{ default: ComponentType }> | null; viewer: Promise<{ default: ExperimentsViewers }> | null; key: string } }>();

    const EXPERIMENTTYPES: Record<string, string> = {
        //yourkey: 'yourvalue'
        performance: 'Performance',
        ismar2021multi: 'ISMAR 2021 Multi',
        ismar2021singpost: 'ISMAR 2021 Signpost',
    };

    export function importExperiment(key: string): { settings: Promise<{ default: ComponentType }> | null; viewer: Promise<{ default: ExperimentsViewers }> | null; key: string } {
        let settings = null;
        let viewer = null;
        switch (key) {
            //case 'yourkey':
            //    settings = import('@experiments/<subroot>/<experimentname>/Settings.svelte')
            //    viewer = import('@experiments/<subroot>/<experimentname>/Viewer.svelte');
            //    break;
            case 'ismar2021singpost':
                settings = import('@experiments/oarc/ismar2021singpost/Settings.svelte');
                viewer = import('@experiments/oarc/ismar2021singpost/Viewer.svelte');
                break;

            case 'ismar2021multi':
                settings = import('@experiments/oarc/ismar2021multi/Settings.svelte');
                viewer = import('@experiments/oarc/ismar2021multi/Viewer.svelte');
                break;
            case 'performance':
                settings = import('@experiments/oarc/performance/Settings.svelte');
                viewer = import('@experiments/oarc/performance/Viewer.svelte');
                break;
            default:
                settings = null;
                viewer = null;
                break;
        }
        // NOTE: The return value of import is only a Promise, which needs to be resolved later

        dispatch('change', { settings, viewer, key });
        return { settings, viewer, key };
    }
</script>

<select id="experimenttype" on:change={(event) => importExperiment(event.currentTarget.value)} disabled={Object.keys(EXPERIMENTTYPES).length === 0}>
    <!-- TODO: why is this none? -->
    <option value="none">None</option>
    {#each Object.entries(EXPERIMENTTYPES) as [key, value]}
        <option value={key}>{value}</option>
    {/each}
</select>

<style>
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
</style>
