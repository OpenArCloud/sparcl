<script lang="ts">
    import {
        availableMessageBrokerServices,
        allowMessageBroker,
        selectedMessageBrokerService,
        messageBrokerAuth,
        enableCameraPoseSharing,
        showOtherCameras,
        enableReticlePoseSharing,
        showOtherReticles,
    } from '../../stateStore';
    import Select from './Select.svelte';
    let rmqSubmitPromise: Promise<void>;
    export let onSubmit: ({ url, username, password }: { url: string; username: string; password: string }) => Promise<void>;
    export let submitButtonLabel: string;
    export let submitSuccessMessage: string;
    export let submitFailureMessage: string;
    export let serviceUrlFontSizePx: number | undefined = undefined;
    let passwordVisible = false;
</script>

{#if $availableMessageBrokerServices.length > 0}
    <dl>
        <dt><label for="message-broker-server">Message Broker Services</label></dt>
        <div>
            <input id="allowMessageBroker" type="checkbox" bind:checked={$allowMessageBroker} />
            <label for="allowMessageBroker">Connect to a message broker</label>
        </div>
        {#if $allowMessageBroker}
            <dd class="select">
                <Select bind:value={$selectedMessageBrokerService} displayFunc={(option) => option.description} options={Object.values($availableMessageBrokerServices)}></Select>
            </dd>
            <p class="serviceurl" style={serviceUrlFontSizePx ? `font-size: ${serviceUrlFontSizePx}px;` : undefined}>
                <label for="url">{$selectedMessageBrokerService?.url || '---'}</label>
            </p>
            {#if $selectedMessageBrokerService?.properties?.find((prop) => prop.type === 'authentication' && prop.value === 'password')}
                {#if $messageBrokerAuth?.[$selectedMessageBrokerService.guid]}
                    <form>
                        <div>
                            <label style="display: inline-block; min-width: 100px;" for="username">Username:</label>
                            <input type="text" bind:value={$messageBrokerAuth[$selectedMessageBrokerService.guid].username} name="username" />
                        </div>

                        <div>
                            <label style="display: inline-block; min-width: 100px;" for="password">Password:</label>
                            <div style="position: relative; display: inline-block;">
                                {#if passwordVisible}
                                    <input type="text" bind:value={$messageBrokerAuth[$selectedMessageBrokerService.guid].password} name="password" />
                                {:else}
                                    <input type="password" bind:value={$messageBrokerAuth[$selectedMessageBrokerService.guid].password} name="password" />
                                {/if}
                                <span on:click={() => (passwordVisible = !passwordVisible)} style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); cursor: pointer;">
                                    {passwordVisible ? '🙈' : '👁️'}
                                </span>
                            </div>
                        </div>
                    </form>
                    <div class="center" style="padding-top: 1rem;">
                        <button
                            id="test-rmq-auth-button"
                            on:click={() =>
                                (rmqSubmitPromise =
                                    $selectedMessageBrokerService && $messageBrokerAuth
                                        ? onSubmit({ url: $selectedMessageBrokerService?.url, ...$messageBrokerAuth[$selectedMessageBrokerService?.guid] })
                                        : Promise.reject('no message broker service selected'))}>{submitButtonLabel}</button
                        >
                    </div>
                    {#if rmqSubmitPromise != null}
                        {#await rmqSubmitPromise}
                            <img class="spinner center-img" style="padding-top: 1rem;" alt="Waiting spinner" src="/media/spinner.svg" />
                        {:then}
                            <p class="center" style="color: green">{submitSuccessMessage}</p>
                        {:catch error}
                            <p class="center" style="color: red">{submitFailureMessage} {error}</p>
                        {/await}
                    {/if}
                {:else}
                    <p>Internal error while handlind message broker state</p>
                {/if}
            {/if}

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
        {/if}
    </dl>
{/if}

<style>
    #test-rmq-auth-button {
        border: 2px solid var(--theme-color);
        border-radius: 0.5rem;
        font-size: 1.125rem;
        line-height: 1.75rem;
        background-color: white;
    }

    dd.select {
        border: 0;
        padding: 0;
    }

    .center {
        display: flex;
        align-items: center;
        justify-content: center;
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

    .serviceurl {
        font-size: var(--serviceUrlFontSizePx) px;
        font-family: monospace;
        direction: ltr;
        text-align: left;
        padding-bottom: 3px;
    }
</style>
