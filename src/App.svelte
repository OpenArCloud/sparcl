<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<!--
    Handles and coordinates all global aspects of the app.
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { Router, Route, navigate} from 'svelte-routing';

    import Login from '@src/auth/Login.svelte';
    import Onboarding from '@src/components/Onboarding.svelte';
    import Header from '@components/Header.svelte';
    import { showLogin, showDashboard, isLoggedIn, currentLoggedInUser, userNoAuth, isAuthenticatedAuth0 } from "./stateStore";


   // handle external route if the user not signed in & try to enter some routes
   onMount(() => {
        if ((!$isLoggedIn && window.location.pathname !== '/login') ||
            (!$isLoggedIn && window.location.pathname !== '/loginAdmin') ) {
            navigate('/login', { replace: true });
        }
    });

    // handle un-valid routes
    onMount(() => {
        const validRoutes = ['/'];

        // Check if user is logged in and the route is invalid
        if ($isLoggedIn && !validRoutes.includes(window.location.pathname)) {
            navigate('/');
        }
    });

    // Read environment variable (Vite requires import.meta.env)
    const userWithoutAuth = import.meta.env.VITE_NOAUTH === 'true';

    onMount(() => {

    // If authentication is disabled, set localStorage
    if (userWithoutAuth) {
        isLoggedIn.set(true);
        userNoAuth.set(true);
        isAuthenticatedAuth0.set(false);
        showLogin.set(false);

        const userDetails = {
            email: import.meta.env.VITE_NOAUTH_USER_EMAIL,
            username: import.meta.env.VITE_NOAUTH_USER_NAME
        };

    // Save User Details: Convert the object to a JSON string
    const userDetailsString = JSON.stringify(userDetails);
    currentLoggedInUser.set(userDetailsString);

        navigate('/')
    }
  });


</script>

<!-- Added the Header Component -->
<Header />

<main>

    <Router>

        {#if $isLoggedIn }
            <!-- Define Routes -->
            <Route path="/" component={Onboarding} />

        {:else}
        <Route path="/login" component={Login} />
        {/if}

    </Router>

</main>

<style>
    main {
        max-width: 100vw;
        overflow-x: hidden;

        margin: 0 48px 90px;

        font:
            normal 18px/24px Trebuchet,
            Arial,
            sans-serif;
        color: var(--theme-color);
    }

</style>
