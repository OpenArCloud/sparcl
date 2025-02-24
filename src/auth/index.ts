import auth0 from "./auth0Service.js";
import { isLoggedIn, showLogin, showDashboard } from '../stateStore';

/////////////////////////////////// Signout Configuration ///////////////////////////////////

// Function to handle sign-out
export async function signOut() {
    try {
        // Manually update the Svelte stores to show the login page
        isLoggedIn.set(false);
        showLogin.set(true);
        showDashboard.set(false);

         // Safely parse localStorage values
        let isAuthenticatedAuth0 = false;
        let auth0Client = null;
        let currentLoggedUser = null;

        try {
            isAuthenticatedAuth0 = JSON.parse(localStorage.getItem('isAuthenticatedAuth0') || 'null');
            auth0Client = JSON.parse(localStorage.getItem('auth0Client') || 'null');
            currentLoggedUser = JSON.parse(localStorage.getItem('currentLoggedInUser') || 'null');
        } catch (err) {
            console.error('Error parsing localStorage values:', err);
        }

        // for Auth0
        if(isAuthenticatedAuth0){
            auth0.logoutAuth0(auth0Client);
        } 

    } catch (error) {
        console.error('Logout failed:', error);
    }
}

