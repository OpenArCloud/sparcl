<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Handles and coordinates all global aspects of the app.
-->
<script>
    import {onMount, tick} from "svelte";

    import { getCurrentLocation, locationAccessOptions } from '@src/core/locationTools'

    import Dashboard from '@components/Dashboard.svelte';
    import Viewer from '@components/Viewer.svelte';

    import WelcomeOverlay from "@components/dom-overlays/WelcomeOverlay.svelte";
    import OutroOverlay from "@components/dom-overlays/OutroOverlay.svelte";

    import { arIsAvailable, showDashboard, hasIntroSeen, initialLocation, ssr, allowP2pNetwork,
        availableP2pServices, isLocationAccessAllowed } from './stateStore';


    let showWelcome, showOutro;
    let dashboard, viewer;
    let shouldShowDashboard, shouldShowUnavailableInfo;

    let isLocationAccessRefused = false;
    let isHeadless = false;
    let currentSharedValues = {};
    let p2p;

    // TODO: Find solution for this quick fix to prevent continuous service requests.
    let haveReceivedServices = false;


    /**
     * Reactive function to define if the AR viewer can be shown.
     */
    $: showAr = $arIsAvailable && !showWelcome && !shouldShowDashboard && !showOutro;

    /**
     * Reactive function to setup AR modes.
     *
     * Will be called everytime the value in arIsAvailable changes
     */
    $: {
        if ($arIsAvailable && $isLocationAccessAllowed && !haveReceivedServices) {
            window.requestIdleCallback(() => {
                getCurrentLocation()
                    .then((currentLocation) => {
                        $initialLocation = currentLocation;
                        return import('ssd-access');
                    })
                    .then(ssdModule => {
                        return ssdModule.getServicesAtLocation($initialLocation.regionCode, $initialLocation.h3Index)
                    })
                    .then(services => {
                        haveReceivedServices = true;
                        $ssr = services;

                        if (services.length === 0) {
                            shouldShowUnavailableInfo = true;
                        }
                    })
                    .catch(error => {
                        // TODO: Inform user
                        console.log(error);
                    });
            })
        }
    }

    /**
     * Switch p2p network connection on/off depending on dashboard setting.
     */
    $: {
        if ($allowP2pNetwork && $availableP2pServices.length > 0) {
            import('@src/core/p2pnetwork')
                .then(p2pModule => {
                    if (!p2p) {
                        p2p = p2pModule;

                        const headlessPeerId = $availableP2pServices[0].properties
                            .reduce((result, property) => property.type === 'peerid' ? property.value : result, null);

                        if (headlessPeerId && !headlessPeerId?.empty) {
                            p2p.connect(headlessPeerId, false, (data) => viewer?.updateReceived(data));
                        }
                    }
                });
        } else if (!isHeadless) {
            p2p?.disconnect();
            p2p = null;
        }
    }


    /**
     * Initial setup of the viewer. Called after the component is first rendered to the DOM.
     */
    onMount(() => {
        const urlParams = new URLSearchParams(location.search);

        if (urlParams.has('peerid')) {
            // Start as headless client
            isHeadless = true;
            $allowP2pNetwork = true;

            import('@src/core/p2pnetwork')
                .then(p2pModule => {
                    p2p = p2pModule;

                    p2pModule.initialSetup();
                    p2pModule.connect(urlParams.get('peerid'), true, (data) => {
                        // Just for development
                        currentSharedValues = data;
                    });
                })
        } else {
            // Start as AR client
            // AR sessions need to be started by user action, so welcome dialog (or the dashboard) is always needed
            showWelcome = true;
            showOutro = false;

            // Delay close of dashboard until next request
            shouldShowDashboard = $showDashboard;

            if ('serviceWorker' in navigator) {
                () => navigator.serviceWorker.register('/service-worker.js');
            }
        }
    })

    /**
     * Decides what's next after the intro is closed by the user.
     *
     * When discovery services are available at the current location of the user, AR will start or the dashboard is
     * shown.
     *
     * When there are no discovery services available, another dialog is shown, informing the user about the marker
     * alternative.
     */
    function closeIntro(openDashboard) {
        $hasIntroSeen = true;
        showWelcome = false;
        showOutro = false;
        shouldShowDashboard = openDashboard || shouldShowDashboard

        if (!shouldShowDashboard) {
            startAr();
        }
    }

    /**
     * Initiate start of AR session
     */
    async function startAr() {
        shouldShowDashboard = false;
        showOutro = false;

        const ogl = await import('@core/engines/ogl/ogl');
        const webxr = await import('@core/engines/webxr');

        tick().then(() => viewer.startAr(new webxr.default(), new ogl.default()));
    }

    /**
     * AR session was closed by 'go to previous page' action.
     *
     * Show dashboard if requested and show dialog to reenter AR session.
     */
    function sessionEnded() {
        showOutro = true;
        shouldShowDashboard = $showDashboard;
    }

    /**
     * Handles broadcast events from other components.
     *
     * @param event  Event      Svelte event type, contains values to broadcast in the detail property
     */
    function handleBroadcast(event) {
        p2p?.send(event.detail);
    }

    /**
     * Triggers location access. Don't need to handle the result here, as it will be caught in the
     * {@link isLocationAccessAllowed} store.
     */
    function requestLocationAccess() {
        navigator.geolocation.getCurrentPosition(() => {}, (error) => {
            isLocationAccessRefused = true;
        }, locationAccessOptions);
    }
</script>


<style>
    header {
        width: 100vw;
        height: 110px;

        margin-bottom: 63px;

        background: transparent linear-gradient(2deg, var(--theme-color) 0%, #293441 31%, #242428 72%, #231F20 98%) 0 0 no-repeat padding-box;
    }

    main {
        max-width: 100vw;
        overflow-x: hidden;

        margin: 0 48px 90px;

        font: normal 18px/24px Trebuchet, Arial, sans-serif;
        color: var(--theme-color);
    }

    aside {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: rgba(128 128 128 / 60%)
    }

    #frame {
        width: calc(100vw - 2 * var(--ui-margin));
        max-width: var(--ui-max-width);
        max-height: var(--ui-max-height);

        text-align: center;

        box-shadow: 0 3px 6px #00000029;
        border: 2px solid var(--theme-color);

        background-color: white;
    }

    #logo {
        position: absolute;
        top: 35px;
        left: 204px;
        width: 158px;
        height: 40px;
        opacity: 1;
    }

    #showdashboard {
        position: absolute;
        top: 0;
        right: 0;
        width: 50px;
        height: 50px;
        z-index: 100;
    }
</style>


<header>
    <img id="logo" alt="OARC logo" src="/media/OARC_Logo_without_BG.png" />
</header>

<main>
{#if !isHeadless}
    {#if shouldShowDashboard && $arIsAvailable}
        <Dashboard bind:this={dashboard} on:okClicked={startAr} />
    {/if}

    {#if showWelcome || showOutro}
    <aside>
        <div id="frame">
        {#if showWelcome}
            <WelcomeOverlay withOkFooter="{$arIsAvailable}" {shouldShowDashboard} {shouldShowUnavailableInfo}
                            {isLocationAccessRefused}
                            on:okAction={() => closeIntro(false)}
                            on:dashboardAction={() => closeIntro(true)}
                            on:requestLocation={requestLocationAccess} />

        {:else if showOutro}
            <OutroOverlay {shouldShowDashboard} on:okAction={closeIntro} />
        {/if}
        </div>
    </aside>
    {/if}

{:else}
    <!-- Just for development to verify some internal values -->
    <h1>Headless Mode</h1>
    <pre>{JSON.stringify(currentSharedValues, null, 2)}</pre>
{/if}
</main>

{#if showAr}
<Viewer bind:this={viewer} on:arSessionEnded={sessionEnded} on:broadcast={handleBroadcast} />
{/if}

<div id="showdashboard" on:click={() => shouldShowDashboard = true}>&nbsp;</div>
