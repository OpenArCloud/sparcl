<!--
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import "@fortawesome/fontawesome-free/css/all.min.css";
  import { navigate } from 'svelte-routing';
  import auth0 from "./auth0Service";
  import { createAuth0Client, Auth0Client } from '@auth0/auth0-spa-js';

  import { isLoggedIn, isAuthenticatedAuth0} from '../stateStore';

/////////////////////////////////// Handle Auth0 Login ///////////////////////////////////

let auth0Client: Auth0Client;

onMount(async () => {
    try {
      // Initialize Auth0 client with configuration
      auth0Client = await createAuth0Client({
        domain: import.meta.env.VITE_AUTH_AUTH0_DOMAIN,
        clientId: import.meta.env.VITE_AUTH_AUTH0_CLIENTID,
        authorizationParams: {
          redirect_uri: import.meta.env.VITE_AUTH_REDIRECT_URI, // Match Allowed Callback URLs
          scope: 'openid profile email',
        },
      });

      // Check if the user is authenticated
      const authenticated = await auth0Client.isAuthenticated();
      isAuthenticatedAuth0.set(authenticated);

      // Store auth 0 client value in the localStorage
        localStorage.setItem('auth0Client', JSON.stringify(auth0Client));
        console.log('auth0Client saved to localStorage.');

    } catch (err) {
      console.error('Error initializing Auth0 client:', err);
    }
  });


  function handleAuth0Login() {
    auth0.loginWithPopup(auth0Client);
  }

</script>


<div class="login-card">

    <h1>Sign in to AR CLOUD</h1>

    <button class="user-login-btn auth0" on:click={handleAuth0Login}>
        <img class="button-icon auth0-img"  alt="Auth0 Logo" src="../media/auth0.png" />

        <span> Login with Auth0 </span>
    </button>
</div>


<style>
    .login-card {
        background-color: #262c34;
        padding: 40px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        text-align: center;
        color: white;
        width: 100%;
        max-width: 400px;
        margin: 120px auto;
    }

    h1 {
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 30px;
        color: white;
    }

    .user-login-btn{
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 15px;
        border: none;
        border-radius: 5px;
        font-size: 1rem;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s ease;
        padding: 12px 70px;
        margin-top: 20px;
        padding: 12px 70px;
        width: 100%;
    }

    .button-icon {
    width: 24px;
    margin-right: 10px;
    }

    .auth0 {
        background-color: #0078d4;
    }

    .auth0:hover {
        background-color: #005a9e;
    }

    .auth0-img{
        font-size: 1rem;
        margin-left: -20px;
    }

 /* Mobile responsiveness */

/* For screens 1200 wide or smaller */
 @media (min-width: 1200px) {
        .login-card {
            max-width: 450px;
        }

        h1 {
            font-size: 1.7rem;
        }
    }

/* For screens 600px wide or smaller */
@media (max-width: 600px) {
    .login-card {
        padding: 10px 10px;
        width: 95%;
        margin: 0 auto;
    }

    h1 {
        font-size: 1rem;
        margin-bottom: 15px;
    }

    .user-login-btn {
        font-size: 0.75rem;
        padding: 6px 10px;
    }
}


/* For screens 400px wide or smaller */
@media (max-width: 400px) {
    .login-card {
        padding: 8px;
        width: 90%;
        max-width: 280px;
        margin: 20px auto;
    }

    h1 {
        font-size: 1rem;
        margin-bottom: 15px;
    }

    .user-login-btn {
        font-size: 0.7rem;
        padding: 8px 5px;
        justify-content: center;
    }

    .button-icon {
        width: 20px;
        margin-right: 8px;
    }
}


</style>
