/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import * as A from '@automerge/automerge';
import { type PeerJSOption } from 'peerjs';
import { get, writable } from 'svelte/store';
import { availableP2pServices, selectedP2pService, automergeDocumentUrl } from '@src/stateStore';
import { DocHandle, Repo, isValidAutomergeUrl, type DocHandleChangePayload } from '@automerge/automerge-repo';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';
import { PeerjsNetworkAdapter } from './peer-js-network-adapter';

let peerjsNetworkAdapter: PeerjsNetworkAdapter | undefined;
let repo: Repo;
let updateFunction: ((data: any) => void) | undefined = undefined;
const initialChange = new Uint8Array([
    133, 111, 74, 131, 158, 11, 218, 167, 0, 116, 1, 16, 188, 182, 25, 75, 54, 26, 64, 161, 176, 164, 163, 83, 8, 249, 178, 42, 1, 165, 247, 201, 246, 71, 190, 115, 239, 165, 79, 202, 242, 119, 253,
    73, 233, 237, 230, 120, 13, 243, 127, 164, 232, 145, 20, 201, 137, 159, 115, 185, 75, 7, 1, 2, 3, 2, 19, 3, 35, 2, 64, 3, 67, 2, 86, 2, 7, 21, 6, 33, 2, 35, 2, 52, 1, 66, 2, 86, 2, 128, 1, 2, 2,
    0, 2, 1, 126, 0, 1, 2, 0, 126, 0, 1, 127, 0, 2, 7, 127, 4, 100, 97, 116, 97, 127, 0, 127, 1, 1, 127, 2, 127, 0, 127, 0, 1,
]); // hard coded the initial change, which is: { data: [] }. This is needed, because we need a common ancestor for each document in order to be able to merge them correctly. See: https://automerge.org/docs/cookbook/modeling-data/#setting-up-an-initial-document-structure for details

const documentHandleStore = writable<DocHandle<{ data: any[] }> | undefined>();
documentHandleStore.subscribe((documentHandle) => {
    documentHandle?.on('change', onDocumentChange);
});

/**
 * Connects to the signaling server, to allow other devices to connect to this one.
 *
 * A headless client just registers itself at the signaling server, regular clients also connect to the headless client
 * when allowed by respective global setting.
 *
 * @param headlessPeerId  String        The peer ID of the headless client
 * @param isHeadless  boolean       true when the current device should be set up as headless client
 * @param updateftn  Function       Function to call when updated values arrived
 */
export function connectFromStateStore(updateftn: (data: any) => void) {
    updateFunction = updateftn;
    const selected = get(selectedP2pService);
    const service = get(availableP2pServices).find((service) => service.id === selected?.id);
    const port = service?.properties?.reduce((result, prop) => (prop.type === 'port' ? prop.value : result), '');
    const path = service?.properties?.find((prop) => prop.type === 'path')?.value;
    const actualPort = port ? parseInt(port) : null;
    setupAutomergeRepo({ url: service?.url, port: actualPort, path });
}

export function connectWithExplicitUrl({ url, port, path, updateftn }: { url: string | null | undefined; port: number | null | undefined; path?: string; updateftn: (data: any) => void }) {
    updateFunction = updateftn;
    setupAutomergeRepo({ url, port, path });
}

/**
 * Disconnect the device from the peer to peer network.
 */
export function disconnect() {
    peerjsNetworkAdapter?.disconnect();
    repo?.removeAllListeners();
}

/**
 * Send data out to other connected devices.
 *
 * @param data      The data as Javascript types to send out. Will be stringified later
 */
export async function send(data: { event: any; value: any }) {
    // initialize on click, if we do not have any repos set up
    if (Object.keys(repo.handles).length === 0) {
        initializeRepo();
    }
    const documentHandle = get(documentHandleStore);
    if (!documentHandle) {
        return;
    }
    const whenReadyPromise = documentHandle.whenReady();
    await rejectPromiseAfterTimeout(whenReadyPromise, 4000);
    documentHandle.change((d) => d.data.push(data.value));
}

function setupAutomergeRepo({ url, port, path }: { url: string | null | undefined; port: number | null | undefined; path?: string }) {
    const options: PeerJSOption =
        url && port
            ? {
                  host: url.split('https://').slice(1).join('https://'), // delete leading https:// if exists
                  secure: true,
                  port: port,
                  ...(path ? { path } : {}),
              }
            : {};

    console.log('Creating P2P network:');
    console.log('  Server URL: ' + (options?.host || 'PeerJS default'));
    console.log('  Server port: ' + (options?.port || 'PeerJS default'));

    peerjsNetworkAdapter = new PeerjsNetworkAdapter(options);
    repo = new Repo({
        network: [peerjsNetworkAdapter],
        storage: new IndexedDBStorageAdapter(),
    });
    repo.on('document', async (document) => {
        // This fires on a successful repo.find call, or if somebody connected to us who already has a document set up.
        const documentHandle = get(documentHandleStore);
        if (!documentHandle) {
            // if we don't have our own document, simply use theirs
            documentHandleStore.set(document.handle);
        } else {
            // If we do have our own document, merge the two and unambiguously decide which one to keep using. Both peers should settle to use the same document
            await document.handle.whenReady();
            await documentHandle.whenReady();
            documentHandle.merge(document.handle);
            if (shouldSwitchDocument(documentHandle, document.handle)) {
                documentHandle.removeAllListeners();
                automergeDocumentUrl.set(document.handle.url);
                documentHandleStore.set(document.handle);
            }
        }
    });

    const automergeUrl = get(automergeDocumentUrl);
    if (isValidAutomergeUrl(automergeUrl)) {
        // Don't need to set documentHandleStore here, because repo.find emits a `document` event. We listen on that event above, and set the store there.
        // Setting the store here would cause the store to be set twice, and the subscribe function to run twice, which would be erronous
        repo.find(automergeUrl);
    }
}

const shouldSwitchDocument = (currentDocumentHandle: DocHandle<{ data: any[] }>, newDocumentHandle: DocHandle<{ data: any[] }>) => {
    // This comparison is arbitrary. The only thing that's important is that this comparison should be deterministic, so that all peers can agree on the same master document
    // The url is basically a uuid, so this comparison should yield the same result for each peer
    return currentDocumentHandle.url > newDocumentHandle.url;
};

const onDocumentChange = (document: DocHandleChangePayload<any>) => {
    const dataToRender = document.patchInfo.after?.data?.slice(document.patchInfo.before?.data?.length) || [];
    // TODO: This is a naiive approach for getting which objects to render, it only works for new data that is appended to the end of the data list. However, when a merge occurs the data might not be appended to the end, but spliced to the middle.
    // A better approach would be to use the document.patch object to apply those patches on the document somehow.
    // See this github issue for a discussion: https://github.com/automerge/automerge-repo/issues/302
    if (updateFunction) {
        for (const data of dataToRender) {
            updateFunction({ object_created: data });
        }
    }
};

const initializeRepo = () => {
    documentHandleStore.set(repo.create<{ data: any[] }>());
    const initialDoc = A.next.load<{ data: any[] }>(initialChange);
    const documentHandle = get(documentHandleStore);
    documentHandle?.update(() => initialDoc);
    automergeDocumentUrl.set(documentHandle?.url || null);
};

export const getAutomergeDocumentData = () => {
    const documentHandle = get(documentHandleStore);
    return documentHandle?.docSync()?.data;
};

const rejectPromiseAfterTimeout = async <T>(promise: Promise<T>, timeout: number): Promise<T> => {
    return new Promise((resolve, reject) => {
        const rejectTimeout = setTimeout(() => reject(new Error(`Promise timed out after ${timeout} ms`)), timeout);
        promise.then((value) => {
            clearTimeout(rejectTimeout);
            resolve(value);
        });
    });
};
