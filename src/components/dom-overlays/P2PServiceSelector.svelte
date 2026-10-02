<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { availableP2pServices, allowP2pNetwork, selectedP2pService, p2pNetworkState } from '../../stateStore';
    export let serviceUrlFontSizePx: number | undefined = undefined;
    export let showHeading = true;
    const dispatch = createEventDispatcher<{ broadcast: { event: string; value?: any; routing_key?: string } }>();

    $: serviceUrlBoxStyle =
        serviceUrlFontSizePx != null ? `--url-font-size: ${serviceUrlFontSizePx}px` : undefined;
</script>

{#if $availableP2pServices.length > 0}
    {#if showHeading}
        <dt><label for="p2p-server">P2P Services</label></dt>
    {/if}
    <div class="inline">
        <input id="allowP2p" type="checkbox" bind:checked={$allowP2pNetwork} />
        <label for="allowP2p">Connect to p2p network</label>
    </div>
    {#if $allowP2pNetwork}
        <dl>
            <p class="p2p-note">Available P2P services:</p>
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
            <p class="p2p-note">Selected P2P service:</p>
            <div class="p2p-box" style={serviceUrlBoxStyle}>
                <p class="selected-service-name">{$selectedP2pService?.title || ''}</p>
                <div class="url-line">
                    <span class="url-line-label">Rendezvous URL:</span>
                    <span class="url-line-value">{$selectedP2pService?.url || 'no url'}</span>
                </div>
                {#if $selectedP2pService?.properties != undefined && $selectedP2pService.properties.length != 0}
                    {#each $selectedP2pService.properties as prop}
                        <div class="url-line">
                            <span class="url-line-label">{prop.type}:</span>
                            <span class="url-line-value">{prop.value}</span>
                        </div>
                    {/each}
                {/if}
            </div>
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

    .selected-service-name {
        margin: 0 0 0.5rem;
        font-weight: bold;
    }

    :global(.dashboard) .selected-service-name {
        margin: 0 0 0.5rem;
    }

    .p2p-box {
        margin-top: 0.75rem;
        padding: 0.75rem;
        border: 1px solid var(--theme-color);
        max-width: 100%;
        min-width: 0;
    }

    .p2p-note {
        margin: 0 0 0.25rem;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.25;
    }

    :global(.dashboard) .p2p-note {
        margin: 0 0 0.25rem;
    }

    .url-line {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        max-width: 100%;
        min-width: 0;
        margin: 0.15rem 0 0.35rem;
    }

    .url-line-label {
        flex: 0 0 auto;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.25;
    }

    .url-line-value {
        flex: 1 1 0;
        min-width: 0;
        overflow-x: auto;
        white-space: nowrap;
        font-family: monospace;
        font-size: var(--url-font-size, 1rem);
        line-height: 1.25;
        padding: 0.15rem 0.4rem;
        border: 1px solid var(--theme-color);
    }
</style>
