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
    import { onMount, tick, type ComponentType, SvelteComponent } from 'svelte';
    import { writable, type Writable } from 'svelte/store';

    import { locationAccessOptions, setInitialLocationAndServices } from '@src/core/locationTools';

    import Dashboard from '@components/Dashboard.svelte';
    import WelcomeOverlay from '@components/dom-overlays/WelcomeOverlay.svelte';
    import OutroOverlay from '@components/dom-overlays/OutroOverlay.svelte';
    import Spectator from '@components/dom-overlays/Spectator.svelte';

    import Selector from '@experiments/Selector.svelte';

    import {
        activeExperiment,
        allowP2pNetwork,
        arIsAvailable,
        arMode,
        availableP2pServices,
        experimentModeSettings,
        hasIntroSeen,
        initialLocation,
        isLocationAccessAllowed,
        selectedP2pService,
        showDashboard,
        ssr,
        allowMessageBroker,
        selectedMessageBrokerService,
        messageBrokerAuth,
        p2pNetworkState,
    } from './stateStore';
    import { ARMODES } from './core/common';
    import * as rmq from '@src/core/rmqnetwork';

    import { logToElement } from '@src/core/devTools';
    import type ViewerOscp from '@components/viewer-implementations/Viewer-Oscp.svelte';
    import type ViewerCreate from '@components/viewer-implementations/Viewer-Create.svelte';
    import type ViewerDevelop from '@components/viewer-implementations/Viewer-Develop.svelte';
    import type webxr from '@core/engines/webxr';
    import type ogl from '@core/engines/ogl/ogl';
    import type { ExperimentsViewers } from './types/xr';
    import ViewerMarker from '@components/viewer-implementations/Viewer-Marker.svelte';

    let showWelcome: boolean | null = null;
    let showOutro: boolean | null = null;
    let dashboard: Dashboard | null = null;
    let viewer: ComponentType<ViewerOscp | ViewerCreate | ViewerDevelop | ViewerMarker | ExperimentsViewers> | null | undefined;
    let viewerInstance: { startAr: (xrEngine: webxr, tdEngine: ogl, options: { settings?: Writable<Record<string, unknown>> }) => void; onNetworkEvent?: (data: any) => void } | null | undefined;
    let spectator: Spectator | null = null;
    let shouldShowDashboard: boolean;
    let shouldShowUnavailableInfo: boolean | null = null;

    let isLocationAccessRefused = false;
    let isHeadless = false;
    let currentSharedValues = {};
    let p2p: typeof import('@src/core/p2pnetwork') | null = null; // PeerJS module (optional)

    const getViewerInstance = () => viewerInstance;

    /**
     * Reactive function to define if the AR viewer can be shown.
     */
    $: showAr = $arIsAvailable && !showWelcome && !shouldShowDashboard && !showOutro;

    /**
     * Reactive function to query current location and ssr. This needs to run after isLocationAccessAllowed receives a value, that's why we use a reactive statement instead of simply using onMount
     */
    $: {
        if ($isLocationAccessAllowed) {
            setInitialLocationAndServices();
        }
    }

    $: {
        if ($ssr.length === 0) {
            shouldShowUnavailableInfo = true;
        } else {
            shouldShowUnavailableInfo = false;
        }
    }

    /**
     * Switch p2p network connection on/off depending on dashboard setting.
     */
    $: {
        if ($allowP2pNetwork && $availableP2pServices.length > 0) {
            if (!p2p) {
                import('@src/core/p2pnetwork').then((p2pModule) => {
                    p2p = p2pModule;
                });
            }
            if (p2p) {
                if ($p2pNetworkState === 'not connected') {
                    if (spectator) {
                        p2p!.connectFromStateStore((data: any) => {
                            spectator?.onNetworkEvent(data);
                        });
                    }
                    if (viewerInstance) {
                        p2p!.connectFromStateStore((data: any) => {
                            // getter is important in this callback, because the viewerInstance can get destroey and recreated, but the reference in the callback will stay the same. Therefore we need to have a getter that always gets the most recent viewerInstance
                            getViewerInstance()?.onNetworkEvent?.(data);
                        });
                    }
                }
            }
        } else if (!isHeadless) {
            p2p?.disconnect();
            p2p = null;
        }
    }

    /**
     * Initial setup of the viewer. Called after the component is first rendered to the DOM.
     */
    onMount(() => {
        logToElement(document.getElementById('logger')!);

        const urlParams = new URLSearchParams(location.search);

        if (urlParams.has('peerid')) {
            // Start as headless client
            isHeadless = true;
            $allowP2pNetwork = true;

            import('@src/core/p2pnetwork').then((p2pModule) => {
                p2p = p2pModule;

                // TODO: these are only used in the headless client.
                // normal clients take them from an SSR instead
                const headlessPeerId = urlParams.get('peerid');
                const url = urlParams.get('signal');
                const port = urlParams.get('port');
                const path = urlParams.get('path') || undefined;

                console.log('Starting headless client...');
                console.log('  peerid: ' + headlessPeerId);
                console.log('  signal: ' + (url ? url : 'PeerJS default'));
                console.log('  port: ' + (port ? port : 'PeerJS default'));
                console.log('  path: ' + (path ? path : 'PeerJS default'));

                if (headlessPeerId) {
                    const portToUse = port ? parseInt(port) : null;
                    p2p.connectWithExplicitUrl({
                        url,
                        port: portToUse,
                        path,
                        updateftn: (data: any) => {
                            // DEBUG
                            console.log(data);
                            currentSharedValues = data;
                        },
                    });
                }
            });
        } else {
            // Start as AR client
            // AR sessions need to be started by user action, so welcome dialog (or the dashboard) is always needed
            showWelcome = true;
            showOutro = false;

            // Delay close of dashboard until next request
            shouldShowDashboard = $showDashboard;

            if (urlParams.has('create')) {
                $arMode = ARMODES.create;
            } else if (urlParams.has('develop')) {
                $arMode = ARMODES.develop;
            } else if (urlParams.has('dashboard')) {
                shouldShowDashboard = true;
            }
        }
    });

    /**
     * Decides what's next after the intro is closed by the user.
     *
     * When discovery services are available at the current location of the user, AR will start or the dashboard is
     * shown.
     *
     * When there are no discovery services available, another dialog is shown, informing the user about the marker
     * alternative.
     */
    function closeIntro(openDashboard: boolean) {
        $hasIntroSeen = true;
        showWelcome = false;
        showOutro = false;
        shouldShowDashboard = openDashboard || shouldShowDashboard;

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

        let viewerImplementation: Promise<{ default: ComponentType<ViewerOscp | ViewerCreate | ViewerDevelop | ViewerMarker | ExperimentsViewers> }> | null = null;
        let options: { settings?: Writable<Record<string, unknown>> } = {};

        // Unfortunately, the import function does accept string literals only
        switch ($arMode) {
            case ARMODES.oscp:
                viewerImplementation = import('@components/viewer-implementations/Viewer-Oscp.svelte');
                break;
            case ARMODES.create:
                viewerImplementation = import('@components/viewer-implementations/Viewer-Create.svelte');
                break;
            case ARMODES.develop:
                viewerImplementation = import('@components/viewer-implementations/Viewer-Develop.svelte');
                break;
            case ARMODES.marker:
                viewerImplementation = import('@components/viewer-implementations/Viewer-Marker.svelte');
                break;
            case ARMODES.experiment:
                if ($activeExperiment) {
                    const selector = new Selector({ target: document.createElement('div') });
                    const { viewer, key } = selector.importExperiment($activeExperiment);
                    options.settings = writable($experimentModeSettings?.[key]);
                    viewerImplementation = viewer;
                    if (viewer === undefined) {
                        console.warn("The experiment's Viewer is undefined!");
                    }
                    if (viewer === null) {
                        console.warn("The experiment's Viewer is null!");
                    }
                }
                break;
            default:
                throw new Error(`Unknown AR mode: ${$arMode}`);
        }

        const values = await Promise.all([import('@core/engines/ogl/ogl'), import('@core/engines/webxr'), viewerImplementation]);
        const xrEngine = new values[1].default();
        const tdEngine = new values[0].default();
        viewer = values[2]?.default;
        await tick();
        if ($allowMessageBroker && $selectedMessageBrokerService && $messageBrokerAuth) {
            rmq.connectWithReceiveCallback({
                updateFunction: (data) => viewerInstance?.onNetworkEvent?.(data),
                url: $selectedMessageBrokerService.url,
                password: $messageBrokerAuth[$selectedMessageBrokerService.guid].password,
                username: $messageBrokerAuth[$selectedMessageBrokerService.guid].username,
            });
        }
        viewerInstance?.startAr(xrEngine, tdEngine, options);
    }

    /**
     * AR session was closed by 'go to previous page' action.
     *
     * Show dashboard if requested and show dialog to reenter AR session.
     */
    function sessionEnded() {
        showOutro = true;
        shouldShowDashboard = $showDashboard;

        viewer = null;
        rmq.rmqDisconnect();
    }

    /**
     * Handles broadcast events from other components.
     *
     * @param event  Event      Svelte event type, contains values to broadcast in the detail property
     */
    function handleBroadcast(
        event: CustomEvent<{
            event: string;
            value?: Record<string, any> | undefined;
            routing_key?: string | undefined;
        }>,
    ) {
        if (p2p != null) {
            p2p.send(event.detail);
        }

        if (event.detail.routing_key != undefined && event.detail.value) {
            rmq.send(event.detail.routing_key, event.detail.value);
        }
    }

    /**
     * Triggers location access. Don't need to handle the result here, as it will be caught in the
     * {@link isLocationAccessAllowed} store.
     */
    function requestLocationAccess() {
        navigator.geolocation.getCurrentPosition(
            () => {},
            (error) => {
                isLocationAccessRefused = true;
            },
            locationAccessOptions,
        );
    }
</script>

<header>
    <img class="logo" id="logo" alt="OARC logo" src="/media/OARC_Logo_without_BG.png" />
</header>

<main>
    {#if !isHeadless}
        {#if shouldShowDashboard && $arIsAvailable}
            <Dashboard bind:this={dashboard} on:broadcast={handleBroadcast} on:okClicked={startAr} />
        {/if}

        {#if (showWelcome || showOutro) && $arIsAvailable}
            <aside>
                <div id="frame">
                    {#if showWelcome}
                        <WelcomeOverlay
                            withOkFooter={$arIsAvailable}
                            {shouldShowDashboard}
                            {shouldShowUnavailableInfo}
                            {isLocationAccessRefused}
                            on:okAction={() => closeIntro(false)}
                            on:dashboardAction={() => closeIntro(true)}
                            on:requestLocation={requestLocationAccess}
                        />
                    {:else if showOutro}
                        <OutroOverlay {shouldShowDashboard} on:okAction={() => closeIntro(true)} />
                    {/if}
                </div>
            </aside>
        {:else if !$arIsAvailable}
            <Spectator bind:this={spectator} on:broadcast={handleBroadcast} />
        {/if}
    {:else}
        <!-- Just for development to verify some internal values -->
        <h1>Headless Mode</h1>
        <pre>{JSON.stringify(currentSharedValues, null, 2)}</pre>
    {/if}
</main>

{#if showAr && viewer}
    <svelte:component this={viewer} bind:this={viewerInstance} on:arSessionEnded={sessionEnded} on:broadcast={handleBroadcast} />
{:else if showAr && $arMode === ARMODES.experiment}
    <p>Settings not valid for {$arMode}. Unable to create viewer.</p>
    <button on:click={sessionEnded} on:keydown={sessionEnded}> Go back </button>
{/if}

<div id="showdashboard" role="button" tabindex="0" on:click={() => (shouldShowDashboard = true)} on:keydown={() => (shouldShowDashboard = true)}>&nbsp;</div>

<!-- logger widget (preformatted text), see devTools logToElement() -->
<pre id="logger"></pre>

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

    aside {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: rgba(128 128 128 / 60%);
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

    .logo {
        width: 138px;
        padding-left: 20px;
        padding-right: 20px;
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
