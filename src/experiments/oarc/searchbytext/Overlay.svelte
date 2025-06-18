<script lang="ts">
    let inputText = "";
    import { createEventDispatcher } from 'svelte';
    import { experimentModeSettings } from '@src/stateStore';

    const dispatch = createEventDispatcher();

    function sendText() {
        dispatch("textInput", inputText);
    }

    function handleCategoryClick(category: string) {
        dispatch("categorySelected", category);
    }
</script>

{#if $experimentModeSettings?.searchbytext.showstats && $experimentModeSettings.searchbytext.localisation}
    <div class="top-controls">
        <button class="secondary" on:click={() => dispatch('relocalize')}>
            <img src="/media/refresh.svg" alt="refresh icon" />
        </button>
        <input type="text" bind:value={inputText} placeholder="Type something..." />
        <button on:click={sendText}>Search</button>
    </div>

    <div class="category-buttons-container">
        <button on:click={() => handleCategoryClick('restaurant')}>
            <img src="https://cdn-icons-png.flaticon.com/512/2771/2771401.png" alt="Restaurant" />
            Restaurant
        </button>
        <button on:click={() => handleCategoryClick('shop')}>
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

    input[type="text"] {
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
