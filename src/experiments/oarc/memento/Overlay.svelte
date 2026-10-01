<script context="module" lang="ts">
    export type ModelCatalogEntry = { file: string; label: string };
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let catalog: ModelCatalogEntry[] = [];
    export let selectedFile = '';
    export let canPlace = false;
    export let persisting = false;
    export let persistError = '';

    const dispatch = createEventDispatcher<{ place: void; relocalize: void }>();

    function select(file: string) {
        if (persisting) {
            return;
        }
        selectedFile = file;
    }
</script>

<div class="memento-panel">
    {#if persisting}
        <div class="persist-status" role="status">
            <img class="spinner" alt="" src="/media/spinner.svg" />
            <span>persisting your memento...</span>
        </div>
    {:else if persistError}
        <div class="persist-status error" role="alert">{persistError}</div>
    {/if}

    <div class="toolbar">
        <button class="secondary" type="button" on:click={() => dispatch('relocalize')} disabled={persisting}>
            <img src="/media/refresh.svg" alt="Relocalize" />
        </button>
        <button type="button" disabled={!canPlace || persisting || !selectedFile} on:click={() => dispatch('place')}>
            Place here
        </button>
    </div>

    <div class="model-browser" role={catalog.length > 0 ? 'listbox' : undefined} aria-label="Memento models">
        {#if catalog.length === 0}
            <p class="no-models" role="status">No models are available.</p>
        {:else}
            {#each catalog as entry (entry.file)}
                <button
                    type="button"
                    class:selected={selectedFile === entry.file}
                    disabled={persisting}
                    on:click={() => select(entry.file)}
                    title={entry.label}
                >
                    <span class="thumb-label">{entry.label}</span>
                </button>
            {/each}
        {/if}
    </div>

    <p class="attribution">
        Models from
        <a href="https://github.com/wangyz1999/3d-emoji-assets-generator" target="_blank" rel="noopener noreferrer">
            3d-emoji-assets-generator
        </a>
        (CC-BY-4.0)
    </p>
</div>

<style>
    .memento-panel {
        position: fixed;
        left: 0;
        right: 0;
        bottom: env(safe-area-inset-bottom, 0);
        padding: 12px;
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.12);
        z-index: 1000;
    }

    .toolbar {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
    }

    .toolbar button.secondary {
        padding: 8px 12px;
    }

    .toolbar button.secondary img {
        width: 20px;
        height: 20px;
    }

    .persist-status {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 14px;
    }

    .persist-status.error {
        color: #b00020;
    }

    .spinner {
        width: 20px;
        height: 20px;
    }

    .model-browser {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
        min-height: 56px;
        align-items: center;
    }

    .no-models {
        margin: 0;
        padding: 8px 4px;
        font-size: 13px;
        color: #555;
    }

    .model-browser button {
        flex: 0 0 auto;
        min-width: 56px;
        max-width: 88px;
        height: 56px;
        padding: 4px;
        border: 2px solid transparent;
        border-radius: 8px;
        background: #f0f0f0;
        font-size: 10px;
        line-height: 1.2;
    }

    .thumb-label {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .model-browser button.selected {
        border-color: var(--theme-color, #0078d4);
    }

    .attribution {
        margin: 8px 0 0;
        font-size: 11px;
        color: #555;
        text-align: center;
    }

    .attribution a {
        color: inherit;
        text-decoration: underline;
    }
</style>
