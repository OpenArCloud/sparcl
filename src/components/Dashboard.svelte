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
    import { supportedCountries, type Service } from '@oarc/ssd-access';

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
        recentLocalisation,
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
        enableCameraPoseSharing,
        showOtherCameras,
        enableReticlePoseSharing,
        showOtherReticles,
    } from '@src/stateStore';

    import { lockScreenOrientation, unlockScreenOrientation } from '@core/sensors';

    import { testRmqConnection } from '@src/core/rmqnetwork';
    import Select from './dom-overlays/Select.svelte';

    import { ARMODES, CREATIONTYPES, PLACEHOLDERSHAPES } from '@core/common';

    import Selector from '@experiments/Selector.svelte';
    import MessageBrokerSelector from './dom-overlays/MessageBrokerSelector.svelte';
    import { setInitialLocationAndServices } from '../core/locationTools';
    import P2PServiceSelector from './dom-overlays/P2PServiceSelector.svelte';

    import Navbar from './Navbar.svelte';

    // Used to dispatch events to parent
    const dispatch = createEventDispatcher();
    const userWithoutAuth = import.meta.env.VITE_NOAUTH === 'true';

    let experimentDetail: { settings: Promise<{ default: ComponentType }> | null; viewer: Promise<{ default: ComponentType }> | null; key: string } | null = null;
    let overrideGeoposePromise: Promise<void>;
    const serviceUrlFontSizePx = 8;

    let rmqTestPromise: Promise<void>;
    onMount(() => {
        if ($allowMessageBroker && $selectedMessageBrokerService?.url && $messageBrokerAuth?.[$selectedMessageBrokerService?.guid]?.username != null)
            rmqTestPromise = testRmqConnection({ url: $selectedMessageBrokerService.url, ...$messageBrokerAuth[$selectedMessageBrokerService?.guid] });
    });

    function handleContentServiceSelection(event: Event & { currentTarget: EventTarget & HTMLInputElement }, service: Service) {
        if (!$selectedContentServices[service.id]) {
            $selectedContentServices[service.id] = { isSelected: event.currentTarget.checked, selectedTopic: '' };
        }

        $selectedContentServices[service.id].isSelected = event.currentTarget.checked;
    }

    function handleContentServiceTopicSelection(service: Service, topic: string) {
        $selectedContentServices[service.id].selectedTopic = topic;
    }

    // Retrieve user details from logged in state
    onMount(() => {
        const userDetailsString = $currentLoggedInUser;

        try {
            const userDetailsObject = JSON.parse(userDetailsString);

            if (userWithoutAuth) {
                // Check if the user entered without auth
                isAgentNameReadonly.set(false);
                myAgentName.set($myAgentName);
            } else if (userDetailsObject.email !== import.meta.env.VITE_AUTH_ADMIN_USERID && userDetailsObject.username !== import.meta.env.VITE_AUTH_ADMIN_USERNAME) {
                // Check if the user is not admin username

                // Extract the first name from username
                const userName = userDetailsObject.email.split('@')[0].replace(/\./g, '_');
                myAgentName.set(userName); // Set the input value to the first name
                isAgentNameReadonly.set(true);
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
        // NOTE: screen orientation cannot be changed between user clicks the go-immersive-button and WebXR startSession,
        // and it cannot be changed after the XR Session started, so the only place to change it is here
        if ($debug_useGeolocationSensors) {
            lockScreenOrientation('landscape-primary');
        } else {
            unlockScreenOrientation();
        }
    }
</script>

<div id="dashboard-elements">
    <Navbar />

    <div id="sepeator"></div>

    <button id="go-immersive-button" on:click={() => dispatch('okClicked')} on:keydown={() => dispatch('okClicked')}> Go immersive </button>

    <div>
        <input id="showagain" type="checkbox" bind:checked={$showDashboard} />
        <label for="showagain">Show Dashboard next time</label>
    </div>

    <details class="dashboard" bind:open={$dashboardDetail.state}>
        <summary>Application state</summary>
        <dl>
            <dt>Location access</dt>
            <dd>{$isLocationAccessAllowed ? 'Allowed' : 'Not allowed'}</dd>
            {#if !isLocationAccessAllowed}
                <dd>Request access</dd>
            {/if}
        </dl>

        <dl>
            <dt>H3Index</dt>
            <dd>{$initialLocation.h3Index}</dd>
            <dt>Country</dt>
            <dd>{$initialLocation.countryCode}</dd>
            <dt>OSCP Region</dt>
            <!--  TODO: Might make sense to do some validation here  -->
            <dd class="list">
                <input list="supported-countries" bind:value={$initialLocation.regionCode} />
            </dd>
        </dl>

        <dl class="radio connected">
            <dt>AR mode</dt>
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

        {#if $arMode === ARMODES.marker}
            <dl>
                <dt>Marker image</dt>
                <dd>{$currentMarkerImage}</dd>
                <dt><label for="markerwidth">Width</label></dt>
                <dd class="unitinput">
                    <input id="markerwidth" type="number" bind:value={$currentMarkerImageWidth} />m
                </dd>
            </dl>
        {/if}

        {#if $arMode === ARMODES.create}
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
        {/if}

        {#if $arMode === ARMODES.experiment}
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
        {/if}

        <dl>
            <dt><label for="geoposeServer">GeoPose Services</label></dt>
            <dd class="select">
                <select id="geoposeServer" bind:value={$selectedGeoPoseService}>
                    {#if $availableGeoPoseServices.length === 0}
                        <option value={null} disabled selected>Device sensors (no VPS available)</option>
                        <!--{debug_useGeolocationSensors.set(true)}-->
                    {:else}
                        {#each $availableGeoPoseServices as service}
                            <option value={service}>{service.title}</option>
                        {/each}
                        <!--{debug_useGeolocationSensors.set(false)}-->
                    {/if}
                </select>
            </dd>
            <pre class="serviceurl">
            <label for="geoposeServer">{$selectedGeoPoseService?.url || ''}</label>
        </pre>
        </dl>

        <dl>
            <dt>Recent GeoPose</dt>
            <dd class="autoheight">
                <pre>{JSON.stringify($recentLocalisation.geopose, null, 2)}</pre>
            </dd>
        </dl>

        <dl class="nested">
            <dt>
                <!-- svelte-ignore a11y-label-has-associated-control -->
                <label> Content Services </label>
            </dt>

            {#if $availableContentServices.length > 0}
                {#each $availableContentServices as service}
                    <dd>
                        <input
                            id="selectedContentService_{service.id}"
                            type="checkbox"
                            checked={$selectedContentServices[service.id]?.isSelected}
                            on:change={(event) => handleContentServiceSelection(event, service)}
                        />
                        <label for="selectedContentService_{service.id}">{service.title}</label>
                        <p class="serviceurl">
                            <label for="selectedContentService_{service.id}">{service.url || ''}</label>
                        </p>

                        {#if service?.properties}
                            <ul>
                                {#each service.properties as property}
                                    {#if property.type === 'topics'}
                                        {#each property.value.split(',') as topic}
                                            <li>
                                                <input
                                                    id="contenttopic"
                                                    type="radio"
                                                    name={service.id}
                                                    disabled={!$selectedContentServices[service.id]?.isSelected}
                                                    checked={$selectedContentServices[service.id]?.selectedTopic === topic}
                                                    on:change={(event) => handleContentServiceTopicSelection(service, topic)}
                                                />
                                                <label for="contenttopic">{topic}</label>
                                            </li>
                                        {/each}
                                    {/if}
                                {/each}
                            </ul>
                        {:else}
                            <p>No Topics</p>
                        {/if}
                    </dd>
                {/each}
            {:else}
                <p class="no-services">No Content Services available</p>
            {/if}
        </dl>
    </details>

    <details class="dashboard" bind:open={$dashboardDetail.multiplayer}>
        <summary>Multiplayer</summary>
        <dl>
            <dt>Choose your name</dt>
            <dd class="list">
                <input placeholder="Type your name here" id="agentName" bind:value={$myAgentName} readonly={$isAgentNameReadonly} />
            </dd>
        </dl>
        <ColorPicker bind:rgb={$myAgentColor} label="Choose your color" />

        <MessageBrokerSelector
            onSubmit={testRmqConnection}
            submitButtonLabel="Test Authentication"
            submitFailureMessage="Authentication unsuccessful. Reason:"
            submitSuccessMessage="Authentication successful"
        ></MessageBrokerSelector>

        <dl>
            <table style="width:100%">
                <tr>
                    <td style="width:50%" align="left">
                        <label
                            ><input name="dashboard-share-camera-pose-checkbox" id="dashboard-share-camera-pose-checkbox" type="checkbox" bind:checked={$enableCameraPoseSharing} /> Share camera pose
                        </label>
                    </td>
                    <td style="width:50%" align="left">
                        <label
                            ><input name="dashboard-share-reticle-pose-checkbox" id="dashboard-share-reticle-pose-checkbox" type="checkbox" bind:checked={$enableReticlePoseSharing} /> Share reticle</label
                        >
                    </td>
                </tr>
                <tr>
                    <td style="width:50%" align="left">
                        <label
                            ><input name="dashboard-show-other-cameras-checkbox" id="dashboard-show-other-cameras-checkbox" type="checkbox" bind:checked={$showOtherCameras} /> Show other cameras
                        </label>
                    </td>
                    <td style="width:50%" align="left">
                        <label
                            ><input name="dashboard-show-other-reticles-checkbox" id="dashboard-show-other-reticles-checkbox" type="checkbox" bind:checked={$showOtherReticles} /> Show other reticles
                        </label>
                    </td>
                </tr>
            </table>
        </dl>

        <P2PServiceSelector on:broadcast={(event) => dispatch('broadcast', event.detail)} {serviceUrlFontSizePx} />
    </details>

    <details class="dashboard" bind:open={$dashboardDetail.debug}>
        <summary>Debug settings</summary>
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
                <button on:click={() => (overrideGeoposePromise = setInitialLocationAndServices())}>Use position</button>
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

{@html supportedCountries}

<style>
    h2,
    summary {
        margin-top: 60px;
        margin-bottom: 15px;
        color: var(--theme-highlight);

        font-size: 1.5em;
        font-weight: bold;
    }

    legend h4 {
        margin-bottom: 0;
    }

    #go-immersive-button {
        width: 100%;
        height: 50px;

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

    :global(.dashboard dt),
    .label {
        height: 20px;

        margin-bottom: 6px;

        font-weight: bold;
        text-align: left;
    }

    :global(.dashboard dd),
    .value {
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

    pre {
        margin: 5px;
    }

    #showagain {
        margin-top: 20px;
        margin-bottom: 26px;
    }

    .autoheight {
        height: initial;

        padding: 0;
    }

    .serviceurl {
        font-size: calc(var(--serviceUrlFontSizePx) * 1px);
        direction: ltr;
        text-align: left;
        padding-bottom: 10px;
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
