/*
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type { Auth0Client, PopupLoginOptions } from '@auth0/auth0-spa-js';
import { navigate } from 'svelte-routing';
import { isAuthenticatedAuth0, popupOpen, showLogin, showDashboard, isLoggedIn, currentLoggedInUser } from '../stateStore';

async function loginWithPopup(client: Auth0Client, options?: PopupLoginOptions) {
    popupOpen.set(true);

    try {
        await client.loginWithPopup(options);

        const userData = await client.getUser();

        const userDetails = {
            email: userData?.email,
            username: userData?.given_name,
        };

        const userDetailsString = JSON.stringify(userDetails);
        currentLoggedInUser.set(userDetailsString);

        isAuthenticatedAuth0.set(true);
        isLoggedIn.set(true);
        showLogin.set(false);
        showDashboard.set(true);

        localStorage.setItem('isAuthenticatedAuth0', JSON.stringify(true));

        const link = import.meta.env.VITE_AUTH_REDIRECT_URI ?? window.location.origin;
        navigate(link);
    } catch (e) {
        console.error(e);
    } finally {
        popupOpen.set(false);
    }
}

function logoutAuth0(client: Auth0Client) {
    localStorage.removeItem('isAuthenticatedAuth0');
    localStorage.removeItem('auth0Client');

    return client.logout();
}

const auth0 = {
    loginWithPopup,
    logoutAuth0,
};

export default auth0;
