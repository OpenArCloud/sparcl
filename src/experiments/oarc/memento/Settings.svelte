<script context="module" lang="ts">
    export const DEFAULT_MEMENTO_SCD_URL = 'https://scd.orbit-lab.org';
    export const DEFAULT_MEMENTO_TOPIC = 'history';

    export type MementoExperimentSettings = {
        scdUrl?: string;
        topic?: string;
    };

    export function applyMementoSettingsDefaults(settings: MementoExperimentSettings): void {
        if (!settings.scdUrl?.trim()) {
            settings.scdUrl = DEFAULT_MEMENTO_SCD_URL;
        }
        settings.topic = DEFAULT_MEMENTO_TOPIC;
    }
</script>

<script lang="ts">
    import { onMount } from 'svelte';
    import scdAuth0 from './scdAuth0Service';
    import { isAuthenticatedScdAuth0 } from './mementoState';
    import { popupOpen } from '@src/stateStore';
    import type { Auth0Client } from '@auth0/auth0-spa-js';

    export let settings: MementoExperimentSettings;
    applyMementoSettingsDefaults(settings);

    const scdAuthConfigured = scdAuth0.isScdAuthConfigured();
    let scdClient: Auth0Client | null = null;
    let scdAuthError = '';

    onMount(async () => {
        if (!scdAuthConfigured) {
            return;
        }
        try {
            scdClient = await scdAuth0.initScdAuth0Client();
            const authenticated = await scdClient.isAuthenticated();
            isAuthenticatedScdAuth0.set(authenticated);
            if (authenticated) {
                await scdAuth0.syncScdUserProfile(scdClient);
            }
        } catch (error) {
            console.error(error);
            scdAuthError = 'Could not initialize SCD Auth0 client.';
        }
    });

    async function handleScdLogin() {
        scdAuthError = '';
        try {
            scdClient = scdClient ?? (await scdAuth0.initScdAuth0Client());
            await scdAuth0.loginWithPopup(scdClient);
        } catch {
            scdAuthError = 'SCD sign-in failed or was cancelled.';
        }
    }

    async function handleScdLogout() {
        scdAuthError = '';
        await scdAuth0.logoutScdAuth0(scdClient ?? scdAuth0.getScdAuth0Client());
        scdClient = null;
    }
</script>

<p class="engine-note">
    Memento is supported only with the Three.js rendering engine. OGL is not supported for the bundled GLB models.
</p>

<dl class="radio">
    <dt>SCD URL</dt>
    <dd>
        <input id="memento-scd-url" type="url" bind:value={settings.scdUrl} />
    </dd>
    <dt>Topic</dt>
    <dd>
        <input
            id="memento-topic"
            type="text"
            bind:value={settings.topic}
            disabled
            title="Topic is fixed to history for Memento."
        />
    </dd>
    <dt>SCD access</dt>
    <dd class="scd-auth">
        {#if !scdAuthConfigured}
            <p class="scd-hint">
                Set <code>VITE_SCD_AUTH_AUTH0_DOMAIN</code>, <code>VITE_SCD_AUTH_AUTH0_CLIENTID</code>, and
                <code>VITE_SCD_AUTH_AUTH0_AUDIENCE</code> to enable SCD sign-in.
            </p>
        {:else if $isAuthenticatedScdAuth0}
            <p class="scd-status">Signed in to SCD (separate from app login).</p>
            <button type="button" class="scd-btn" disabled={$popupOpen} on:click={handleScdLogout}>Sign out of SCD</button>
        {:else}
            <p class="scd-hint">Memento needs an SCD token with <code>create:scrs</code>. This is not the same as signing in to the app.</p>
            <button type="button" class="scd-btn primary" disabled={$popupOpen} on:click={handleScdLogin}>Sign in to SCD</button>
        {/if}
        {#if scdAuthError}
            <p class="scd-error">{scdAuthError}</p>
        {/if}
    </dd>
</dl>

<style>
    .engine-note {
        margin: 0 0 0.75rem;
        font-size: 0.9rem;
        line-height: 1.35;
    }

    input[type='url'],
    input[type='text'] {
        width: 100%;
        box-sizing: border-box;
    }

    .scd-auth {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .scd-hint,
    .scd-status {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.9;
    }

    .scd-error {
        margin: 0;
        font-size: 0.85rem;
        color: #f88;
    }

    .scd-btn {
        align-self: flex-start;
        padding: 0.4rem 0.75rem;
        cursor: pointer;
    }

    .scd-btn.primary {
        font-weight: 600;
    }

    .scd-btn:disabled,
    input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    code {
        font-size: 0.8em;
    }
</style>
