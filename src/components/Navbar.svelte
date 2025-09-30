<!--
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<script lang="ts">
    import { signOut } from '../auth/index';
    import { currentLoggedInUser } from '@src/stateStore';

    // check status of Auth
    const userWithoutAuth = import.meta.env.VITE_NOAUTH === 'true';

    // User SignedIn details
    const userDetailsString = $currentLoggedInUser;
    let username = 'anonymous';
    const userDetailsObject = JSON.parse(userDetailsString);
    if (userDetailsObject.name) {
        username = userDetailsObject.name.split(' ')[0];
    } else if (userDetailsObject.email) {
        username = userDetailsObject.email.split('@')[0].replace(/\./g, '_');
    }

    let isMenuActive = false;

    const toggleMobileMenu = () => {
        isMenuActive = !isMenuActive;
    };
</script>

<!-- Navbar Component -->
<nav class="navbar">
    <div class="navbar-left">
        <a href="/" class="nav-link">Dashboard</a>
    </div>

    {#if !userWithoutAuth}
        <div class="navbar-right">
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="hamburger" on:click={toggleMobileMenu}>
                <div class="bar"></div>
                <div class="bar"></div>
                <div class="bar"></div>
            </div>

            <div class="mobile-menu {isMenuActive ? 'active' : ''}">
                <span class="mobile-welcome-message">Welcome, {username}!</span>
                <a href="/login" class="mobile-nav-link" on:click={signOut}>Logout</a>
            </div>
            <span class="welcome-message">Welcome, {username}!</span>
            <a href="/login" class="nav-link" on:click={signOut}>Logout</a>
        </div>
    {/if}
</nav>

<style>
    .navbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #f0f0f0;
        padding: 1rem 2rem;
        position: relative;
        width: auto;
    }

    .nav-link {
        text-decoration: none;
        color: #333;
        font-weight: 500;
        transition: color 0.3s;
    }

    .nav-link:hover {
        color: #007bff;
    }

    .welcome-message {
        margin-right: 1rem;
        font-weight: 600;
        color: #555;
    }

    .hamburger {
        display: none;
        flex-direction: column;
        cursor: pointer;
    }

    .hamburger .bar {
        width: 25px;
        height: 3px;
        background-color: #333;
        margin: 4px 0;
        transition: 0.3s;
    }

    .mobile-menu {
        display: none;
        flex-direction: column;
        position: absolute;
        top: 70px;
        right: 0;
        background-color: #f0f0f0;
        width: 100%;
        padding: 1rem 0;
        text-align: center;
    }

    .mobile-menu.active {
        display: flex;
    }

    .mobile-nav-link {
        margin: 0.5rem 0;
        text-decoration: none;
        color: #333;
        font-weight: 500;
        transition: color 0.3s;
    }

    .mobile-nav-link:hover {
        color: #007bff;
    }

    .mobile-welcome-message {
        margin-bottom: 1rem;
        font-weight: 600;
        color: #555;
    }

    /* Responsive styling */
    @media (max-width: 768px) {
        .hamburger {
            display: flex;
        }

        .navbar-left {
            flex: 1;
            text-align: left;
        }

        .navbar-right {
            text-align: right;
        }

        .welcome-message,
        .nav-link:not(:first-child) {
            display: none;
        }

        .navbar {
            flex-direction: row;
            align-items: center;
        }

        .nav-link:first-child {
            display: inline-block;
        }
    }
</style>
