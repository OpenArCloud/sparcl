<!--
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<script lang="ts"></script>

<header>
    <img class="logo" id="logo" alt="OARC logo" src="../media/OARC_Logo_without_BG.png" />
</header>


<style>

header {
        width: 100vw;
        height: 110px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 63px;

        background: transparent linear-gradient(2deg, var(--theme-color) 0%, #293441 31%, #242428 72%, #231f20 98%) 0 0 no-repeat padding-box;
    }


.logo {
    width: 138px;
    padding-left: 20px;
    padding-right: 20px;
    opacity: 1;
}

/* Mobile responsiveness */

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
}

</style>
