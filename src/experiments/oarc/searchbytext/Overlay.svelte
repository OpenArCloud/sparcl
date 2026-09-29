<script lang="ts">
    let inputText = '';
    import { createEventDispatcher } from 'svelte';
    import { experimentModeSettings } from '@src/stateStore';

    export let searching = false;
    export let searchFailed = false;

    const dispatch = createEventDispatcher();

    function sendText() {
        if (searching) {
            return;
        }
        dispatch('textInput', inputText);
    }

    function handleCategoryClick(category: string) {
        if (searching) {
            return;
        }
        dispatch('categorySelected', category);
    }
</script>

{#if $experimentModeSettings?.searchbytext.showstats && $experimentModeSettings.searchbytext.localisation}
    <div class="top-controls">
        <button class="secondary" on:click={() => dispatch('relocalize')}>
            <img src="/media/refresh.svg" alt="refresh icon" />
        </button>
        <input type="text" bind:value={inputText} placeholder="Type something..." disabled={searching} />
        <button on:click={sendText} disabled={searching} aria-busy={searching}>Search</button>
        {#if searching}
            <span class="search-status" role="status">
                <img class="search-spinner" alt="" src="/media/spinner.svg" />
                <span class="visually-hidden">Searching</span>
            </span>
        {:else if searchFailed}
            <span class="search-status search-failed" role="alert" title="Search failed">
                <svg class="fail-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"></circle>
                    <path d="M12 7v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                    <circle cx="12" cy="17" r="1.2" fill="currentColor"></circle>
                </svg>
                Failed
            </span>
        {/if}
    </div>

    <div class="category-buttons-container">
        <button on:click={() => handleCategoryClick('restaurant')} disabled={searching}>
            <img src="https://cdn-icons-png.flaticon.com/512/2771/2771401.png" alt="Restaurant" />
            Restaurant
        </button>
        <button on:click={() => handleCategoryClick('shop')} disabled={searching}>
            <img src="https://cdn-icons-png.flaticon.com/512/3443/3443338.png" alt="Shop" />
            Shop
        </button>
    </div>
{/if}

<style>
    .top-controls {
        position: fixed;
        top: env(safe-area-inset-top, 20px);
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background-color: white;
        z-index: 1000;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }

    input[type='text'] {
        flex: 1;
        padding: 10px;
        font-size: 16px;
        border: 1px solid #ccc;
        border-radius: 6px;
    }

    button {
        padding: 10px 12px;
        font-size: 16px;
        border: none;
        border-radius: 6px;
        background-color: #007bff;
        color: white;
    }

    button:disabled,
    input:disabled {
        opacity: 0.55;
        cursor: default;
    }

    .search-status {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        font-size: 14px;
        font-weight: 600;
    }

    .search-spinner {
        width: 28px;
        height: 28px;
    }

    .search-failed {
        color: #c62828;
    }

    .fail-icon {
        width: 22px;
        height: 22px;
        flex-shrink: 0;
    }

    .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .secondary {
        width: 40px;
        height: 40px;
        background: none;
        border: none;
        padding: 0;
    }

    .secondary img {
        width: 24px;
        height: 24px;
    }

    .category-buttons-container {
        position: fixed;
        top: calc(env(safe-area-inset-top, 20px) + 70px);
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-around;
        padding: 10px;
        background-color: transparent;
        z-index: 999;
    }

    .category-buttons-container button {
        background-color: #f0f0f0;
        color: black;
        border-radius: 12px;
        border: 1px solid #ccc;
        padding: 10px 14px;
        font-size: 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        flex: 1;
        margin: 0 5px;
    }

    .category-buttons-container img {
        width: 24px;
        height: 24px;
    }
</style>
