/*
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import auth0 from './auth0Service';
import { isLoggedIn, showLogin, showDashboard } from '../stateStore';

/////////////////////////////////// Signout Configuration ///////////////////////////////////

// Function to handle sign-out
export async function signOut() {
    try {
        // Manually update the Svelte stores to show the login page
        isLoggedIn.set(false);
        showLogin.set(true);
        showDashboard.set(false);
        localStorage.setItem('myAgentName', '');

        // Safely parse localStorage values
        let isAuthenticatedAuth0 = false;
        let currentLoggedUser = null;

        try {
            isAuthenticatedAuth0 = JSON.parse(localStorage.getItem('isAuthenticatedAuth0') || 'null');
            currentLoggedUser = JSON.parse(localStorage.getItem('currentLoggedInUser') || 'null');
        } catch (err) {
            console.error('Error parsing localStorage values:', err);
        }

        // for Auth0
        if (isAuthenticatedAuth0) {
            auth0.logoutAuth0(auth0.getAuth0Client());
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}
