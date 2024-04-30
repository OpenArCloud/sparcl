<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { availableP2pServices, allowP2pNetwork, selectedP2pService, p2pNetworkState } from '../../stateStore';
    export let serviceUrlFontSizePx: number | undefined = undefined;
    const dispatch = createEventDispatcher<{ broadcast: { event: string; value?: any, routing_key?: string } }>();
</script>

{#if $availableP2pServices.length > 0}
    <label for="p2p-server">P2P Services</label>
    <div class="inline">
        <input id="allowP2p" type="checkbox" bind:checked={$allowP2pNetwork} />
        <label for="allowP2p">Connect to p2p network</label>
    </div>
    {#if $allowP2pNetwork}
        <dl>
            <dt><label for="p2pserver">P2P Service</label></dt>
            <dd class="select">
                <select id="p2pserver" bind:value={$selectedP2pService} disabled={$availableP2pServices.length < 2}>
                    {#if $availableP2pServices.length === 0}
                        <option>None</option>
                    {:else}
                        {#each $availableP2pServices as service}
                            <option value={service}>{service.title}</option>
                        {/each}
                    {/if}
                </select>
            </dd>
            <pre class="serviceurl" style={serviceUrlFontSizePx ? `font-size: ${serviceUrlFontSizePx}px;` : undefined}>
                    <label>URL: {$selectedP2pService?.url || 'no url'}</label>
                    {#if $selectedP2pService?.properties != undefined && $selectedP2pService.properties.length != 0}
                    {#each $selectedP2pService.properties as prop}
                        <label>{prop.type}: {prop.value}<br /></label>
                    {/each}
                {/if}
                </pre>
        </dl>
        <button
            on:click={() => {
                dispatch('broadcast', {
                    event: 'clear_session',
                });
            }}>Clear p2p session history</button
        >
        <dl>
            <dt>Connection status</dt>
            <dd>{$p2pNetworkState}</dd>
        </dl>
    {/if}
{/if}

<style>
    dd {
        margin-left: 0;
    }

    pre {
        margin: 5px;
    }

    select {
        width: 100%;
        height: 30px;
    }

    select:disabled {
        background: #8e9ca9 0 0 no-repeat padding-box;
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

    dd.select {
        border: 0;
        padding: 0;
    }
</style>
