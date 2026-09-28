<!--
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<script lang="ts">
    import { signOut } from '../auth/index';
    import { currentLoggedInUser, isLoggedIn } from '@src/stateStore';

    const userWithoutAuth = import.meta.env.VITE_NOAUTH === 'true';

    const userDetailsString = $currentLoggedInUser;
    let username = 'anonymous';
    const userDetailsObject = JSON.parse(userDetailsString);
    if (userDetailsObject.name) {
        username = userDetailsObject.name.split(' ')[0];
    } else if (userDetailsObject.email) {
        username = userDetailsObject.email.split('@')[0].replace(/\./g, '_');
    }

    let isMenuActive = false;

    const toggleAccountMenu = () => {
        isMenuActive = !isMenuActive;
    };
</script>

<header>
    <img class="logo" id="logo" alt="OARC logo" src="../media/OARC_Logo_without_BG.png" />

    {#if !userWithoutAuth && $isLoggedIn}
        <div class="account-menu">
            <button class="hamburger" type="button" aria-label="Account menu" aria-expanded={isMenuActive} on:click={toggleAccountMenu}>
                <span></span>
                <span></span>
                <span></span>
            </button>
            {#if isMenuActive}
                <div class="menu">
                    <span class="welcome-message">Welcome, {username}!</span>
                    <a href="/login" class="menu-link" on:click={signOut}>Logout</a>
                </div>
            {/if}
        </div>
    {/if}
</header>

<style>
    header {
        width: 100%;
        height: 110px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 63px;
        position: relative;

        background: transparent linear-gradient(2deg, var(--theme-color) 0%, #293441 31%, #242428 72%, #231f20 98%) 0 0 no-repeat padding-box;
    }

    .logo {
        width: 138px;
        padding-left: 20px;
        padding-right: 20px;
        opacity: 1;
    }

    .account-menu {
        position: relative;
        margin-right: 20px;
    }

    .hamburger {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 5px;
        width: 44px;
        height: 44px;
        padding: 8px;
        border: 0;
        background: transparent;
        cursor: pointer;
    }

    .hamburger span {
        display: block;
        width: 24px;
        height: 3px;
        background-color: #fff;
    }

    .menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 20;
        min-width: 180px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.75rem;
        background-color: #f0f0f0;
        font:
            normal 18px/24px Trebuchet,
            Arial,
            sans-serif;
    }

    .welcome-message {
        font-weight: 600;
        color: #555;
    }

    .menu-link {
        text-decoration: none;
        color: #333;
        font-weight: 500;
    }

    .menu-link:hover {
        color: #007bff;
    }

    /* For screens 400px wide or smaller */
    @media (max-width: 400px) {
        header {
            height: 80px;
            margin-bottom: 40px;
        }

        .logo {
            width: 100px;
            padding-left: 10px;
            padding-right: 10px;
        }

        .account-menu {
            margin-right: 10px;
        }
    }
</style>
