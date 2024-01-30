<script lang="ts">
    import { availableMessageBrokerServices, allowMessageBroker, selectedMessageBrokerService, messageBrokerAuth } from '../../stateStore';
    import Select from './Select.svelte';
    let rmqSubmitPromise: Promise<void>;
    export let onSubmit: ({ url, username, password }: { url: string; username: string; password: string }) => Promise<void>;
    export let submitButtonLabel: string;
    export let submitSuccessMessage: string;
    export let submitFailureMessage: string;
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
            {#if $selectedMessageBrokerService?.properties?.find((prop) => prop.type === 'authentication' && prop.value === 'password')}
                {#if $messageBrokerAuth?.[$selectedMessageBrokerService.guid]}
                    <form>
                        <div>
                            <label style="display: inline-block; min-width: 100px;" for="username">username:</label>
                            <input type="text" bind:value={$messageBrokerAuth[$selectedMessageBrokerService.guid].username} name="username" />
                        </div>
                        <div>
                            <label style="display: inline-block; min-width: 100px;" for="password">password:</label>
                            <input type="password" bind:value={$messageBrokerAuth[$selectedMessageBrokerService.guid].password} name="password" />
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
</style>
