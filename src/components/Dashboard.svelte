<!--
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
-->

<!--
    This component displays the internals of the app, and allows to change them when possible.
    Temporary until better UX is found for the settings.
-->
<script lang="ts">
    import ColorPicker from 'svelte-awesome-color-picker';
    import { createEventDispatcher, onMount, type ComponentType } from 'svelte';
    import { getSupportedTopics } from '@oarc/scd-access';
    import { getSupportedCountries, type Service } from '@oarc/ssd-access';

    import {
        showDashboard,
        initialLocation,
        availableGeoPoseServices,
        availableContentServices,
        availableP2pServices,
        selectedGeoPoseService,
        selectedContentServices,
        selectedP2pService,
        arMode,
        currentMarkerImage,
        currentMarkerImageWidth,
        allowP2pNetwork,
        p2pNetworkState,
        isLocationAccessAllowed,
        dashboardDetail,
        creatorModeSettings,
        experimentModeSettings,
        debug_showLocalAxes,
        debug_useGeolocationSensors,
        debug_saveCameraImage,
        debug_loadCameraImage,
        debug_enablePointCloudContents,
        debug_enableOGCPoIContents,
        myAgentColor,
        myAgentName,
        isAgentNameReadonly,
        currentLoggedInUser,
        activeExperiment,
        selectedMessageBrokerService,
        messageBrokerAuth,
        debug_useOverrideGeopose,
        debug_overrideGeopose,
        allowMessageBroker,
        userName,
    } from '@src/stateStore';

    import { lockScreenOrientation, unlockScreenOrientation } from '@core/sensors';

    import { testRmqConnection } from '@src/core/rmqnetwork';
    import Select from './dom-overlays/Select.svelte';

    import { ARMODES, CREATIONTYPES, PLACEHOLDERSHAPES } from '@core/common';

    import Selector from '@experiments/Selector.svelte';
    import MessageBrokerSelector from './dom-overlays/MessageBrokerSelector.svelte';
    import { determineCurrentLocation, locationQueryStatus } from '../core/locationTools';
    import { configuredSsdBaseUrl, regionCode, regionCodeForCountry, retrieveServicesAtLocation } from '../core/serviceDiscovery';
    import P2PServiceSelector from './dom-overlays/P2PServiceSelector.svelte';
    import {
        getPersistedRenderingEngineId,
        setPersistedRenderingEngineId,
        RENDERING_ENGINE_STORAGE_KEY,
        type RenderingEngineId,
    } from '@core/engines/createRenderingEngine';

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();
    const userWithoutAuth = import.meta.env.VITE_NOAUTH === 'true';

    let supportedCountryCodes: string[] = [];
    let topicsByServiceId: Record<string, { status: 'loading' } | { status: 'ready'; topics: string[] } | { status: 'unavailable' }> = {};
    const topicRequests = new Set<string>();
    let supportedRegionsStatus: 'loading' | 'ready' | 'unavailable' = 'loading';
    const ssdUrl = configuredSsdBaseUrl() ?? '';
    let experimentDetail: { settings: Promise<{ default: ComponentType }> | null; viewer: Promise<{ default: ComponentType }> | null; key: string } | null = null;
    let overrideGeoposePromise: Promise<void>;
    const serviceUrlFontSizePx = 9;

    let rmqTestPromise: Promise<void>;
    /** Default 3D backend for the next AR session (URL `?engine=` overrides for one load). */
    let persistedRenderingEngine: RenderingEngineId = 'ogl';

    onMount(() => {
        if ($allowMessageBroker && $selectedMessageBrokerService?.url && $messageBrokerAuth?.[$selectedMessageBrokerService?.guid]?.username != null) {
            rmqTestPromise = testRmqConnection({ url: $selectedMessageBrokerService.url, ...$messageBrokerAuth[$selectedMessageBrokerService?.guid] });
        }
    });

    onMount(async () => {
        try {
            const countries = await getSupportedCountries();
            supportedCountryCodes = [...countries].sort((a, b) => a.localeCompare(b));
            supportedRegionsStatus = 'ready';
        } catch (error) {
            supportedRegionsStatus = 'unavailable';
            console.error('Could not load supported countries', error);
        }
    });

    $: {
        for (const service of $availableContentServices) {
            const url = service.url?.trim();
            if (!url || topicRequests.has(service.id)) {
                continue;
            }
            topicRequests.add(service.id);
            topicsByServiceId = { ...topicsByServiceId, [service.id]: { status: 'loading' } };
            getSupportedTopics(url)
                .then((topics) => {
                    topicsByServiceId = {
                        ...topicsByServiceId,
                        [service.id]: { status: 'ready', topics: [...topics].sort((a, b) => a.localeCompare(b)) },
                    };
                })
                .catch((error) => {
                    console.error(`Could not load topics from ${url}`, error);
                    topicsByServiceId = { ...topicsByServiceId, [service.id]: { status: 'unavailable' } };
                });
        }
    }

    function topicsFromProperties(service: Service): string[] {
        const topics = new Set<string>();
        for (const property of service.properties ?? []) {
            if (property.type !== 'topics') {
                continue;
            }
            for (const topic of property.value.split(',')) {
                const trimmed = topic.trim();
                if (trimmed !== '') {
                    topics.add(trimmed);
                }
            }
        }
        return [...topics];
    }

    /** Topics to offer as checkboxes. `/topics` wins when the SCD provides it; otherwise the service record is used. */
    function topicChoices(service: Service): string[] {
        const entry = topicsByServiceId[service.id];
        if (entry?.status === 'ready') {
            return entry.topics;
        }
        return topicsFromProperties(service);
    }

    function isTopicSelected(serviceId: string, topic: string): boolean {
        const selected = $selectedContentServices[serviceId]?.selectedTopics ?? [];
        return selected.some((item) => item.toLowerCase() === topic.toLowerCase());
    }

    function canonicalRegion(code: string): string {
        return supportedCountryCodes.find((country) => country.toLowerCase() === code.toLowerCase()) ?? code;
    }

    async function useOverridePosition() {
        const currentLocation = await determineCurrentLocation();
        if (currentLocation) {
            $regionCode = await regionCodeForCountry(currentLocation.countryCode);
            await retrieveServicesAtLocation($regionCode, currentLocation.h3Index);
        }
    }

    function handleContentServiceSelection(event: Event & { currentTarget: EventTarget & HTMLInputElement }, service: Service) {
        if (!$selectedContentServices[service.id]) {
            $selectedContentServices[service.id] = { isSelected: event.currentTarget.checked, selectedTopics: [] };
        }

        $selectedContentServices[service.id].isSelected = event.currentTarget.checked;
    }

    function handleGeoPoseServiceSelection(event: Event) {
        const id = (event.currentTarget as HTMLSelectElement).value;
        const match = $availableGeoPoseServices.find((service) => String(service.id) === id);
        if (match) {
            $selectedGeoPoseService = match;
        }
    }

    function handleContentServiceTopicSelection(service: Service, topic: string, checked: boolean) {
        if (!$selectedContentServices[service.id]) {
            $selectedContentServices[service.id] = { isSelected: false, selectedTopics: [] };
        }
        const selectedTopics = $selectedContentServices[service.id].selectedTopics.filter((item) => item !== topic);
        if (checked) {
            selectedTopics.push(topic);
        }
        $selectedContentServices[service.id].selectedTopics = selectedTopics;
    }

    // Retrieve user details from logged in state
    onMount(() => {
        persistedRenderingEngine = getPersistedRenderingEngineId();
        const userDetailsString = $currentLoggedInUser;

        try {
            const userDetailsObject = JSON.parse(userDetailsString);

            if (userWithoutAuth) {
                // Check if the user entered without auth
                isAgentNameReadonly.set(false);
                myAgentName.set($myAgentName);
            } else if (userDetailsObject && userDetailsObject.email) {
                // Extract the first name from email
                const firstName = userDetailsObject.email.split('@')[0].replace(/\./g, '_');
                myAgentName.set(firstName);
                isAgentNameReadonly.set(true);
            } else {
                myAgentName.set('anonymous');
                isAgentNameReadonly.set(false);
            }
        } catch (error) {
            console.error('Failed to parse userDetailsObject:', error);
            myAgentName.subscribe((name) => userName.set(name)); // if error, set username from agent name text field
            isAgentNameReadonly.set(false); // Make it editable
        }
    });

    $: {
        // NOTE: when using device GPS and compass, the Sensor coordinate system returns values that match the landscape-primary orientation of the device
        // Therefore, we enforce landscape view when device sensors are used. (Alternatively, we could do the math for all possible orientations)
        // NOTE: locking the screen orientation requires going fullscreen first.
        // NOTE: screen orientation cannot be changed between user clicks the start-ar-button and WebXR startSession,
        // and it cannot be changed after the XR Session started, so the only place to change it is here
        if ($debug_useGeolocationSensors) {
            lockScreenOrientation('landscape-primary');
        } else {
            unlockScreenOrientation();
        }
    }
</script>

<div id="dashboard-elements">
    <div id="sepeator"></div>

    <button id="start-ar-button" on:click={() => dispatch('startArButtonClicked')} on:keydown={() => dispatch('startArButtonClicked')}> Start AR </button>

    <div>
        <input id="showagain" type="checkbox" bind:checked={$showDashboard} />
        <label for="showagain">Show Dashboard next time</label>
    </div>

    <details class="dashboard" bind:open={$dashboardDetail.state}>
        <summary>Application state</summary>
        <section class="dashboard-block">
            <h2 class="block-title">Location</h2>
            <p class="location-field">Location access: {$isLocationAccessAllowed ? 'Allowed' : 'Not allowed'}</p>
            <p class="location-field">Location query: {$locationQueryStatus}</p>
            {#if !isLocationAccessAllowed}
                <p class="location-field">Request access</p>
            {/if}
            <p class="location-field">H3 index: {$initialLocation.h3Index}</p>
            <p class="location-field">Country: {$initialLocation.countryCode}</p>
        </section>

        <section class="dashboard-block">
            <h2 class="block-title">Service discovery</h2>
            <div class="url-line">
                <span class="url-line-label">SSD URL:</span>
                <span id="ssd-url" class="url-line-value">{ssdUrl || 'Not configured'}</span>
            </div>
            <p class="location-field">
                Supported regions:
                {#if supportedRegionsStatus === 'loading'}
                    Loading regions…
                {:else if supportedRegionsStatus === 'unavailable'}
                    This SSD does not list supported regions.
                {:else}
                    {supportedCountryCodes.join(', ')}
                {/if}
            </p>
            <p class="location-field">
                <label for="oscp-region">OSCP region:</label>
                {#if supportedCountryCodes.length > 0}
                    <!-- Region choice stays visible but inactive; the app still chooses the region from the device country. -->
                    <select
                        id="oscp-region"
                        class="inline-select"
                        disabled
                        value={canonicalRegion($regionCode)}
                        on:change={(event) => {
                            $regionCode = event.currentTarget.value;
                        }}
                    >
                        {#if $regionCode === ''}
                            <option value=""></option>
                        {:else if !supportedCountryCodes.some((country) => country.toLowerCase() === $regionCode.toLowerCase())}
                            <option value={$regionCode}>{$regionCode}</option>
                        {/if}
                        {#each supportedCountryCodes as country}
                            <option value={country}>{country}</option>
                        {/each}
                    </select>
                {:else}
                    <span id="oscp-region">{$regionCode || '—'}</span>
                {/if}
            </p>
            <p class="unimplemented-note">Manual region selection is not implemented</p>
        </section>

        <section class="dashboard-block catalog-block">
            <h2 class="block-title">GeoPose Services</h2>
            <p class="topic-note">Available GeoPose services:</p>
            <dl class="nested">
            <dd class="select">
                <select id="geoposeService" value={$selectedGeoPoseService?.id != null ? String($selectedGeoPoseService.id) : ''} on:change={handleGeoPoseServiceSelection}>
                    {#if $availableGeoPoseServices.length === 0}
                        <option value="" disabled>Device sensors (no VPS available)</option>
                    {:else}
                        {#each $availableGeoPoseServices as service}
                            <option value={String(service.id)}>{service.title}</option>
                        {/each}
                    {/if}
                </select>
            </dd>
            {#if $availableGeoPoseServices.length > 0}
                <p class="topic-note">Selected GeoPose service:</p>
                <dd>
                    <label class="selected-service-name" for="geoposeServiceTitle">{$selectedGeoPoseService?.title || ''}</label>

                    <div class="url-line">
                        <span class="url-line-label">GPP URL:</span>
                        <span class="url-line-value">{$selectedGeoPoseService?.url || ''}</span>
                    </div>
                </dd>
            {/if}
            </dl>
        </section>

        <section class="dashboard-block catalog-block">
            <h2 class="block-title">Content Services</h2>
            <p class="topic-note">Available content services:</p>
            <dl class="nested">
            {#if $availableContentServices.length > 0}
                {#each $availableContentServices as service}
                    <dd class="content-service">
                        <div class="content-service-title">
                            <input
                                id="selectedContentService_{service.id}"
                                type="checkbox"
                                checked={$selectedContentServices[service.id]?.isSelected}
                                on:change={(event) => handleContentServiceSelection(event, service)}
                            />
                            <label for="selectedContentService_{service.id}">{service.title}</label>
                        </div>
                        <div class="content-service-detail">
                        <div class="url-line">
                            <span class="url-line-label">SCD URL:</span>
                            <span class="url-line-value">{service.url || ''}</span>
                        </div>

                        {#if topicsByServiceId[service.id]?.status === 'loading'}
                            <p class="topic-note">Loading topics…</p>
                        {:else if topicChoices(service).length > 0}
                            <p class="topic-note">Supported topics:</p>
                            <ul class="topic-list">
                                {#each topicChoices(service) as topic}
                                    <li>
                                        <!-- Topic choice stays visible but inactive; demos request the history topic only. -->
                                        <input
                                            id="contenttopic_{service.id}_{topic}"
                                            type="checkbox"
                                            disabled
                                            checked={isTopicSelected(service.id, topic)}
                                            on:change={(event) => handleContentServiceTopicSelection(service, topic, event.currentTarget.checked)}
                                        />
                                        <label for="contenttopic_{service.id}_{topic}">{topic}</label>
                                    </li>
                                {/each}
                            </ul>
                        {:else if topicsByServiceId[service.id]?.status === 'unavailable'}
                            <p class="topic-note">Supported topics:</p>
                            <p class="topic-note">This SCD does not list supported topics.</p>
                        {:else if topicsByServiceId[service.id]?.status === 'ready'}
                            <p class="topic-note">Supported topics:</p>
                            <p class="topic-note">none</p>
                        {/if}
                        <p class="unimplemented-note">Manual topic selection is not implemented</p>
                        </div>
                    </dd>
                {/each}
            {:else}
                <p class="no-services">No Content Services available</p>
            {/if}
            </dl>
        </section>
    </details>

    <details class="dashboard" bind:open={$dashboardDetail.multiplayer}>
        <summary>Multiplayer</summary>
        <section class="dashboard-block">
            <h2 class="block-title">Avatar</h2>
            <div class="avatar-row">
                <label for="agentName">Name:</label>
                <input placeholder="Type your name here" id="agentName" bind:value={$myAgentName} readonly={$isAgentNameReadonly} />
            </div>
            <div class="avatar-row">
                <span>Color:</span>
                <ColorPicker bind:rgb={$myAgentColor} label="" />
            </div>
        </section>

        <section class="dashboard-block">
            <h2 class="block-title">Message Broker Services</h2>
            <MessageBrokerSelector
                onSubmit={testRmqConnection}
                submitButtonLabel="Test Authentication"
                submitFailureMessage="Authentication unsuccessful. Reason:"
                submitSuccessMessage="Authentication successful"
                {serviceUrlFontSizePx}
                showHeading={false}
            ></MessageBrokerSelector>
        </section>

        <section class="dashboard-block">
            <h2 class="block-title">P2P Services</h2>
            <P2PServiceSelector on:broadcast={(event) => dispatch('broadcast', event.detail)} {serviceUrlFontSizePx} showHeading={false} />
        </section>
    </details>

    <details class="dashboard" bind:open={$dashboardDetail.arMode}>
        <summary>AR mode</summary>
        <section class="dashboard-block">
            <dl class="radio connected">
            <dd>
                <input id="armodeoscp" type="radio" bind:group={$arMode} value={ARMODES.oscp} />
                <label for="armodeoscp">{ARMODES.oscp}</label>
            </dd>
            <dd>
                <input id="marker" type="radio" bind:group={$arMode} value={ARMODES.marker} />
                <label for="marker">{ARMODES.marker}</label>
            </dd>
            <dd>
                <input id="armodecreator" type="radio" bind:group={$arMode} value={ARMODES.create} />
                <label for="armodecreator">{ARMODES.create}</label>
            </dd>
            <dd>
                <input id="armodedev" type="radio" bind:group={$arMode} value={ARMODES.develop} />
                <label for="armodedev">{ARMODES.develop}</label>
            </dd>
            <dd>
                <input id="armodeexperiment" type="radio" bind:group={$arMode} value={ARMODES.experiment} />
                <label for="armodeexperiment">{ARMODES.experiment}</label>
            </dd>
        </dl>
        </section>

        <section class="dashboard-block">
            <h2 class="block-title">{$arMode} Mode Settings</h2>

        {#if $arMode === ARMODES.marker}
            <div class="avatar-row">
                <span>Marker image:</span>
                <span class="marker-value">{$currentMarkerImage}</span>
            </div>
            <div class="avatar-row">
                <label for="markerwidth">Width:</label>
                <input id="markerwidth" class="marker-width" type="number" bind:value={$currentMarkerImageWidth} />
                <span>m</span>
            </div>
        {:else if $arMode === ARMODES.create}
            <dl>
                <dt><label for="creatortype">Content Type</label></dt>
                <dd class="select">
                    <select id="creatortype" bind:value={$creatorModeSettings.type}>
                        {#each Object.values(CREATIONTYPES) as type}
                            <option value={type}>{type}</option>
                        {/each}
                    </select>
                </dd>

                {#if $creatorModeSettings.type === CREATIONTYPES.placeholder}
                    <dt><label for="creatorshape">Content Shape</label></dt>
                    <dd class="select">
                        <select id="creatorshape" bind:value={$creatorModeSettings.shape}>
                            {#each Object.values(PLACEHOLDERSHAPES) as shape}
                                <option value={shape}>{shape}</option>
                            {/each}
                        </select>
                    </dd>
                {:else if $creatorModeSettings.type === CREATIONTYPES.model}
                    <dt><label for="modelurl">URL</label></dt>
                    <dd class="area">
                        <textarea id="modelurl" bind:value={$creatorModeSettings.modelurl}></textarea>
                    </dd>
                {:else}
                    <dt><label for="sceneurl">URL</label></dt>
                    <dd class="area">
                        <textarea id="sceneurl" bind:value={$creatorModeSettings.sceneurl}></textarea>
                    </dd>
                {/if}
            </dl>
        {:else if $arMode === ARMODES.experiment}
            <dl>
                <dt><label for="experimentselector">Type</label></dt>
                <dd class="select" id="experimentselector">
                    <Selector
                        on:change={(event) => {
                            experimentDetail = event.detail;

                            if ($experimentModeSettings === null) {
                                $experimentModeSettings = {};
                            }

                            $activeExperiment = experimentDetail.key;
                            if ($experimentModeSettings[experimentDetail.key] === undefined) $experimentModeSettings[experimentDetail.key] = {};
                        }}
                    />
                </dd>
            </dl>

            {#await experimentDetail?.settings}
                <p>Loading...</p>
            {:then setting}
                {#if experimentDetail?.key && $experimentModeSettings}
                    <svelte:component this={setting?.default} bind:settings={$experimentModeSettings[experimentDetail.key]} />
                {/if}
            {/await}
        {:else}
            <p class="location-field">None</p>
        {/if}
        </section>
    </details>

    <details class="dashboard" bind:open={$dashboardDetail.debug}>
        <summary>Debug settings</summary>
        <div>
            <label for="renderingengineselect">Rendering engine (next AR session; URL <code>?engine=</code> overrides once)</label>
            <select
                id="renderingengineselect"
                bind:value={persistedRenderingEngine}
                on:change={() => setPersistedRenderingEngineId(persistedRenderingEngine)}
            >
                <option value="ogl">OGL (default)</option>
                <option value="three">Three.js (experimental)</option>
            </select>
            <p class="rendering-engine-hint">
                Stored under <code>{RENDERING_ENGINE_STORAGE_KEY}</code>. Reload or restart AR after changing.
            </p>
        </div>

        <div>
            <input id="showlocalaxes" type="checkbox" bind:checked={$debug_showLocalAxes} />
            <label for="showlocalaxes">Show local coordinate axes</label>
        </div>

        <div>
            <input id="savecameraimage" type="checkbox" bind:checked={$debug_saveCameraImage} />
            <label for="savecameraimage">Save captured localization image</label>
        </div>

        <div>
            <input id="loadcameraimage" type="checkbox" bind:checked={$debug_loadCameraImage} />
            <label for="loadcameraimage">Load an existing localization image</label>
        </div>

        <div>
            <input id="useGeolocationSensors" type="checkbox" bind:checked={$debug_useGeolocationSensors} />
            <label for="useGeolocationSensors">Use geolocation sensors instead of VPS (requires landscape screen orientation)</label>
        </div>

        <div>
            <input id="enablePointCloudContents" type="checkbox" bind:checked={$debug_enablePointCloudContents} />
            <label for="enablePointCloudContents">Enable point cloud contents</label>
        </div>

        <div>
            <input id="enableOGCPoIContents" type="checkbox" bind:checked={$debug_enableOGCPoIContents} />
            <label for="enableOGCPoIContents">Enable OGC PoI contents</label>
        </div>

        <div>
            <input id="overrideGeopose" type="checkbox" bind:checked={$debug_useOverrideGeopose} />
            <label for="overrideGeopose">Override geopose</label>
        </div>
        {#if $debug_useOverrideGeopose}
            <form class="geopose-form">
                <label class="geopose-label" for="lat">Latitude</label>
                <input class="geopose-input" name="lat" type="text" bind:value={$debug_overrideGeopose.position.lat} />

                <label class="geopose-label" for="lon">Longitude</label>
                <input class="geopose-input" name="lon" type="text" bind:value={$debug_overrideGeopose.position.lon} />

                <label class="geopose-label" for="height">Height</label>
                <input class="geopose-input" name="height" type="text" bind:value={$debug_overrideGeopose.position.h} />
            </form>
            <div style="padding-top: 1rem;">
                <button on:click={() => (overrideGeoposePromise = useOverridePosition())}>Use position</button>
            </div>
            {#if overrideGeoposePromise}
                {#await overrideGeoposePromise}
                    <img class="spinner center-img" style="padding-top: 1rem;" alt="Waiting spinner" src="/media/spinner.svg" />
                {:then}
                    <p class="center" style="color: green">Successfully set geoposition</p>
                {:catch error}
                    <p class="center" style="color: red">Could not set geoposition. Reason: {error}</p>
                {/await}
            {/if}
        {/if}
    </details>
</div>

<style>
    .rendering-engine-hint {
        margin: 0.35rem 0 0;
        font-size: 0.85em;
        color: var(--theme-muted, #888);
    }

    summary {
        margin-top: 24px;
        margin-bottom: 15px;
        color: var(--theme-highlight);

        font-size: 1.5em;
        font-weight: bold;
    }

    .dashboard-block {
        padding-bottom: 0.85rem;
        border-bottom: 1px solid #c8c8c8;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.25;
        color: #000;
    }

    :global(.dashboard .catalog-block > dl.nested) {
        margin-top: 0;
    }

    :global(.dashboard .catalog-block dl.nested > dd:not(.select)) {
        padding-left: 1rem;
        padding-right: 1rem;
    }

    .block-title {
        margin: 1.25rem 0 0.75rem;
        padding: 1rem 2rem;
        background-color: #f0f0f0;
        color: #333;
        font-size: 1.35rem;
        font-weight: bold;
        line-height: 1.2;
    }

    .location-field {
        margin: 0.2rem 0;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.25;
        color: #000;
        overflow-wrap: anywhere;
    }

    .location-field label {
        font-weight: normal;
    }

    .avatar-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0.35rem 0;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.25;
        color: #000;
    }

    .avatar-row input {
        flex: 1;
        min-width: 0;
        height: 2rem;
        margin: 0;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--theme-color);
        font-size: 1rem;
        font-weight: normal;
    }

    .avatar-row input.marker-width {
        flex: 0 0 6rem;
    }

    .marker-value {
        font-weight: normal;
        overflow-wrap: anywhere;
    }

    .inline-select {
        width: auto;
        height: auto;
        margin: 0;
        padding: 0;
        border: 0;
        font-size: inherit;
        font-weight: normal;
        color: #000;
        background: transparent;
    }

    .inline-select:disabled {
        color: #000;
        background: transparent;
        opacity: 1;
    }

    #start-ar-button {
        width: 100%;
        height: 64px;

        border: 2px solid var(--theme-color);

        text-transform: uppercase;
        font-weight: bold;
        font-size: 25px;
        letter-spacing: 0;

        background-color: white;
    }

    .center {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    button {
        border: 2px solid var(--theme-color);
        border-radius: 0.5rem;
        font-size: 1.125rem;
        line-height: 1.75rem;
        background-color: white;
    }

    :global(.dashboard .dashboard-block dt) {
        height: auto;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.25;
    }

    :global(.dashboard dt) {
        height: 20px;

        margin-bottom: 6px;

        font-weight: bold;
        text-align: left;
    }

    :global(.dashboard dd) {
        display: flex;
        align-items: center;

        margin-left: 0;
        margin-bottom: 20px;
        padding-left: 40px;

        height: 39px;
        border: 1px solid var(--theme-color);
    }

    :global(.dashboard dd.area) {
        display: block;
        height: auto;
        padding: 0;
    }

    :global(.dashboard dd.area textarea) {
        display: block;
        width: -webkit-fill-available;
        height: 75px;
        border: 0;
        resize: none;
    }

    :global(.dashboard dd.list) {
        border: 0;
        padding: 0;
    }

    :global(.dashboard dd.list input) {
        width: 100%;
        height: 39px;

        margin-top: 6px;
        padding-left: 40px;

        font-size: 18px;
    }

    :global(.dashboard dd.unitinput) {
        padding: 3px;
    }

    :global(.dashboard dd.unitinput input) {
        width: 100%;
        height: 37px;

        padding-left: 40px;

        border: 0;
    }

    :global(.dashboard dl.radio) {
        margin-top: 35px;
        margin-bottom: 60px;
    }

    :global(.dashboard dl.radio dd) {
        height: 22px;

        padding-left: 0;
        border: 0;
    }

    :global(.dashboard dl.radio.connected) {
        margin-top: 7px;
        margin-bottom: 30px;
    }

    :global(.dashboard dl.nested dd) {
        display: block;
        height: auto;
        padding-top: 10px;
        padding-bottom: 10px;
    }

    :global(.dashboard dl.nested p) {
        margin: 0;
    }

    :global(.dashboard dl.nested ul) {
        margin: 0;
        list-style: none;
        padding: 0;
    }

    :global(.dashboard dd.select) {
        border: 0;
        padding: 0;
    }

    :global(.dashboard fieldset) {
        margin: 0;
        padding: 0;
        border: 0;
    }

    :global(.dashboard input[type='checkbox']) {
        margin-bottom: 14px;
    }

    .content-service-title {
        margin-left: 0;
        font-weight: bold;
    }

    .selected-service-name {
        font-weight: bold;
    }

    .content-service-detail {
        max-width: 100%;
        min-width: 0;
    }

    .topic-note {
        margin: 0.15rem 0 0.25rem;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.25;
    }

    :global(.dashboard) .unimplemented-note {
        margin: 0.1rem 0 0.35rem;
        font-size: 0.7rem;
        font-weight: normal;
        line-height: 1.2;
        color: #000;
    }

    .topic-list {
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.25;
    }

    .topic-list li {
        margin: 0;
    }

    .topic-list input[type='checkbox'] {
        width: 0.85rem;
        height: 0.85rem;
        margin: 0 0.35rem 0.15rem 0;
        vertical-align: middle;
    }

    :global(.dashboard select) {
        width: 100%;
        height: 39px;

        margin: 0;
        padding-left: 30px;

        border: 0;

        font-size: 18px;
        color: white;

        background: var(--theme-color) 0 0 no-repeat padding-box;
    }

    :global(.dashboard select:disabled) {
        background: #8e9ca9 0 0 no-repeat padding-box;
    }

    #showagain {
        margin-top: 20px;
        margin-bottom: 26px;
    }

    .url-line {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        max-width: 100%;
        min-width: 0;
        margin: 0.15rem 0 0.35rem;
    }

    .url-line-label {
        flex: 0 0 auto;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.25;
    }

    .url-line-value {
        flex: 1 1 0;
        min-width: 0;
        overflow-x: auto;
        white-space: nowrap;
        font-family: monospace;
        font-size: 1rem;
        line-height: 1.25;
        padding: 0.15rem 0.4rem;
        border: 1px solid var(--theme-color);
    }

    .center-img {
        display: block;
        margin-left: auto;
        margin-right: auto;
        width: 50%;
    }

    .spinner {
        height: 50px;
    }
    #sepeator {
        margin-top: 30px;
        margin-bottom: 30px;
    }

    .no-services {
        text-align: center;
        color: #ff4d4d;
        font-size: 16px;
        font-weight: bold;
        padding: 10px;
        background-color: #ffe6e6;
        border: 1px solid #ff9999;
        border-radius: 5px;
        margin: 15px 0;
    }

    .geopose-form {
        margin-top: 5px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 220px;
    }

    .geopose-label {
        margin-bottom: 2px;
    }

    .geopose-input {
        padding: 6px;
        border: 1px solid #ccc;
        border-radius: 4px;
        outline: none;
        transition: border-color 0.2s ease-in-out;
    }

    .geopose-input:focus {
        border-color: #007bff;
        box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
    }
</style>
