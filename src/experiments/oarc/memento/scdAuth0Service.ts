/*
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { Auth0Client, PopupLoginOptions } from '@auth0/auth0-spa-js';
import { createAuth0Client } from '@auth0/auth0-spa-js';
import { popupOpen } from '@src/stateStore';
import { currentScdLoggedInUser, isAuthenticatedScdAuth0 } from './mementoState';

let scdAuth0Client: Auth0Client | null = null;

function requireScdAuthEnv(name: string, value: string | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) {
        throw new Error(`${name} is required for SCD / Memento Auth0.`);
    }
    return trimmed;
}

function assertScdAuthEnvConfigured(): {
    domain: string;
    clientId: string;
    audience: string;
    redirectUri: string;
    scope: string;
} {
    return {
        domain: requireScdAuthEnv('VITE_SCD_AUTH_AUTH0_DOMAIN', import.meta.env.VITE_SCD_AUTH_AUTH0_DOMAIN),
        clientId: requireScdAuthEnv('VITE_SCD_AUTH_AUTH0_CLIENTID', import.meta.env.VITE_SCD_AUTH_AUTH0_CLIENTID),
        audience: requireScdAuthEnv('VITE_SCD_AUTH_AUTH0_AUDIENCE', import.meta.env.VITE_SCD_AUTH_AUTH0_AUDIENCE),
        redirectUri: requireScdAuthEnv('VITE_AUTH_REDIRECT_URI', import.meta.env.VITE_AUTH_REDIRECT_URI),
        scope: requireScdAuthEnv('VITE_SCD_AUTH_AUTH0_SCOPE', import.meta.env.VITE_SCD_AUTH_AUTH0_SCOPE),
    };
}

export function isScdAuthConfigured(): boolean {
    try {
        assertScdAuthEnvConfigured();
        return true;
    } catch {
        return false;
    }
}

export function scdAuthAudience(): string {
    return requireScdAuthEnv('VITE_SCD_AUTH_AUTH0_AUDIENCE', import.meta.env.VITE_SCD_AUTH_AUTH0_AUDIENCE);
}

export function scdAuthScope(): string {
    return requireScdAuthEnv('VITE_SCD_AUTH_AUTH0_SCOPE', import.meta.env.VITE_SCD_AUTH_AUTH0_SCOPE);
}

export async function initScdAuth0Client(): Promise<Auth0Client> {
    if (scdAuth0Client) {
        return scdAuth0Client;
    }

    const { domain, clientId, audience, redirectUri, scope } = assertScdAuthEnvConfigured();

    scdAuth0Client = await createAuth0Client({
        domain,
        clientId,
        authorizationParams: {
            redirect_uri: redirectUri,
            audience,
            scope,
        },
    });

    return scdAuth0Client;
}

export function getScdAuth0Client(): Auth0Client | null {
    return scdAuth0Client;
}

export async function syncScdUserProfile(client: Auth0Client): Promise<void> {
    const userData = await client.getUser();
    const userDetails = {
        email: userData?.email,
        username: userData?.given_name,
        name: userData?.name,
        given_name: userData?.given_name,
        family_name: userData?.family_name,
    };
    currentScdLoggedInUser.set(JSON.stringify(userDetails));
}

export async function getScdAccessToken(): Promise<string | undefined> {
    const client = scdAuth0Client ?? (await initScdAuth0Client());
    return client.getTokenSilently({
        authorizationParams: {
            audience: scdAuthAudience(),
            scope: scdAuthScope(),
        },
    });
}

async function loginWithPopup(client: Auth0Client, options?: PopupLoginOptions) {
    popupOpen.set(true);
    try {
        await client.loginWithPopup(options);
        const authenticated = await client.isAuthenticated();
        isAuthenticatedScdAuth0.set(authenticated);
        if (authenticated) {
            await syncScdUserProfile(client);
        }
    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        popupOpen.set(false);
    }
}

function logoutScdAuth0(client: Auth0Client | null) {
    isAuthenticatedScdAuth0.set(false);
    currentScdLoggedInUser.set('{}');
    scdAuth0Client = null;
    if (!client) {
        return Promise.resolve();
    }
    return client.logout();
}

const scdAuth0 = {
    initScdAuth0Client,
    getScdAuth0Client,
    getScdAccessToken,
    syncScdUserProfile,
    loginWithPopup,
    logoutScdAuth0,
    isScdAuthConfigured,
};

export default scdAuth0;
