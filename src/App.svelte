<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
-->

<!--
    Handles and coordinates all global aspects of the app.
-->
<script>
    import {onMount, tick} from "svelte";

    import {getServicesAtLocation} from 'ssd-access';

    import {ARMODES} from '@src/core/common'
    import {getCurrentLocation} from '@src/core/locationTools'
    import * as P2p from '@src/core/p2pnetwork'

    import Dashboard from '@components/Dashboard.svelte';
    import Viewer from '@components/Viewer.svelte';

    import WelcomeOverlay from "@components/dom-overlays/WelcomeOverlay.svelte";
    import OutroOverlay from "@components/dom-overlays/OutroOverlay.svelte";
    import MarkerOverlay from "@components/dom-overlays/MarkerOverlay.svelte";

    import { arIsAvailable, showDashboard, hasIntroSeen, initialLocation, ssr, arMode, allowP2pNetwork,
        availableP2pServices } from './stateStore';


    let showWelcome, showOutro, showMarkerInfo;
    let dashboard, viewer;
    let shouldShowDashboard, shouldShowMarkerInfo, activeArMode;

    let isHeadless = false;
    let currentSharedValues = {};


    /**
     * Reactive function to define if the AR viewer can be shown.
     */
    $: showAr = $arIsAvailable && !showWelcome && !shouldShowDashboard && !shouldShowMarkerInfo && !showOutro;

    /**
     * Reactive function to setup AR modes.
     *
     * Will be called everytime the value in arIsAvailable changes
     */
    $: {
        if ($arIsAvailable) {
            getCurrentLocation()
                .then((currentLocation) => {
                    $initialLocation = currentLocation;
                    return getServicesAtLocation(currentLocation.regionCode, currentLocation.h3Index)
                })
                .then(services => {
                    if ($arMode === ARMODES.auto) {
                        if (services.length !== 0) {
                            $ssr = services;
                            activeArMode = ARMODES.oscp;
                        } else {
                            activeArMode = ARMODES.marker
                            shouldShowMarkerInfo = true;
                        }
                    } else {
                        activeArMode = $arMode;
                    }
                })
                .catch(error => {
                    // TODO: Inform user
                    console.log(error);
                });
        }
    }

    /**
     * Switch p2p network connection on/off depending on dashboard setting.
     */
    $: {
        if ($allowP2pNetwork && $availableP2pServices.length > 0) {
            const headlessPeerId = $availableP2pServices[0].description;
            P2p.connect(headlessPeerId, false, (data) => {
                viewer.updateReceived(data);
            });
        } else if (!isHeadless) {
            P2p.disconnect();
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

            P2p.initialSetup();
            P2p.connect(urlParams.get('peerid'), true, (data) => {
                // Just for development
                currentSharedValues = data;
            });
        } else {
            // Start as AR client
            // AR sessions need to be started by user action, so welcome dialog (or the dashboard) is always needed
            showWelcome = true;
            showOutro = false;

            // Delay close of dashboard until next request
            shouldShowDashboard = $showDashboard;
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
    function closeIntro() {
        $hasIntroSeen = true;
        showWelcome = false;
        showOutro = false;
        showMarkerInfo = shouldShowMarkerInfo;

        if (!shouldShowDashboard && !showMarkerInfo) {
            startAr();
        }
    }

    /**
     * Handles closing the dialog with information about how to use markers.
     */
    function closeMarker() {
        shouldShowMarkerInfo = false;
        closeIntro();
    }

    /**
     * Initiate start of AR session
     */
    function startAr() {
        // TODO: Start initialisation of the viewer
        shouldShowDashboard = false;
        showOutro = false;

        tick().then(() => viewer.startAr());
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
        P2p.send(event.detail);
    }
</script>


<style>
    header {
        width: 100vw;
        height: 110px;

        margin-bottom: 63px;

        background: transparent linear-gradient(2deg, var(--theme-color) 0%, #293441 31%, #242428 72%, #231F20 98%) 0% 0% no-repeat padding-box;
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
        width: calc(100vw - 3 * var(--ui-margin));
        max-width: var(--ui-max-width);
        max-height: var(--ui-max-height);

        text-align: center;

        box-shadow: 0 3px 6px #00000029;
        border: 2px solid var(--theme-color);
        padding: var(--ui-margin);

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
</style>


<header>
    <img id="logo" src="/media/OARC_Logo_without_BG.png" />
</header>

<main>
{#if !isHeadless}
    {#if shouldShowDashboard && $arIsAvailable}
        <Dashboard bind:this={dashboard} on:okClicked={startAr} />
    {/if}

    {#if showWelcome || showOutro || shouldShowMarkerInfo }
    <aside>
        <div id="frame">
        {#if showWelcome}
            <WelcomeOverlay withOkFooter="{$arIsAvailable && activeArMode !== ARMODES.auto}" on:okAction={closeIntro} />

        {:else if showOutro}
            <OutroOverlay on:okAction={closeIntro} />

        {:else if shouldShowMarkerInfo}
            <MarkerOverlay on:okAction={closeMarker} />
        {/if}
        </div>
    </aside>

    {:else if showAr}
        <Viewer bind:this={viewer} activeArMode="{activeArMode}"
                on:arSessionEnded={sessionEnded} on:broadcast={handleBroadcast} />
    {/if}
{:else}
    <!-- Just for development to verify some internal values -->
    <h1>Headless Mode</h1>
    <pre>{JSON.stringify(currentSharedValues, null, 2)}</pre>
{/if}
</main>
