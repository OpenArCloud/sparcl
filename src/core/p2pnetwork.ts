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
import { availableP2pServices, selectedP2pService, automergeDocumentUrl, initialLocation } from '@src/stateStore';
import { DocHandle, Repo, isValidAutomergeUrl, type DocHandleChangePayload } from '@automerge/automerge-repo';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';
import { PeerjsNetworkAdapter } from './peer-js-network-adapter';

type DocumentData = { data: Record<string, any[]> };

const alreadyRenderedContentIds: number[] = [];

let peerjsNetworkAdapter: PeerjsNetworkAdapter | undefined;
let repo: Repo | undefined;
let updateFunction: ((data: any) => void) | undefined = undefined;
const initialChange = new Uint8Array([
    133, 111, 74, 131, 35, 109, 208, 196, 0, 110, 1, 16, 211, 221, 129, 53, 250, 36, 72, 54, 159, 184, 92, 95, 183, 47, 1, 174, 1, 184, 31, 164, 118, 162, 144, 36, 110, 82, 86, 198, 20, 235, 253, 208,
    201, 52, 235, 224, 15, 245, 3, 137, 145, 66, 251, 207, 178, 63, 49, 91, 89, 6, 1, 2, 3, 2, 19, 2, 35, 2, 64, 2, 86, 2, 7, 21, 6, 33, 2, 35, 2, 52, 1, 66, 2, 86, 2, 128, 1, 2, 127, 0, 127, 1, 127,
    1, 127, 0, 127, 0, 127, 7, 127, 4, 100, 97, 116, 97, 127, 0, 127, 1, 1, 127, 0, 127, 0, 127, 0, 0,
]); // hard coded the initial change, which is: { data: {} }. This is needed, because we need a common ancestor for each document in order to be able to merge them correctly. See: https://automerge.org/docs/cookbook/modeling-data/#setting-up-an-initial-document-structure for details

const documentHandleStore = writable<DocHandle<DocumentData> | undefined>();
documentHandleStore.subscribe((documentHandle) => {
    documentHandle?.on('change', onDocumentChange);
});

const getH3Index = () => {
    return get(initialLocation).h3Index;
};

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
export async function send(data: { event: any; value?: any }) {
    // initialize on click, if we do not have any repos set up
    if (repo?.handles && Object.keys(repo.handles).length === 0) {
        initializeRepo();
    }
    const documentHandle = get(documentHandleStore);
    if (!documentHandle) {
        return;
    }
    const whenReadyPromise = documentHandle.whenReady();
    await rejectPromiseAfterTimeout(whenReadyPromise, 4000);
    const h3Index = getH3Index();
    if (data.event === 'clear_session') {
        documentHandle.change((d) => {
            d.data[h3Index] = [];
        });
        console.log('Cleared all ephemeral objects');
        return;
    }
    documentHandle.change((d) => {
        if (d.data[h3Index]) {
            d.data[h3Index].push(data.value);
        } else {
            d.data[h3Index] = [data.value];
        }
    });
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
    repo.on('document', async (otherDocument) => {
        // This fires on a successful repo.find call, or if somebody connected to us who already has a document set up.
        const myDocumentHandle = get(documentHandleStore);
        if (!myDocumentHandle) {
            // if we don't have our own document, simply use theirs
            documentHandleStore.set(otherDocument.handle);
        } else {
            // If we do have our own document, merge the two and unambiguously decide which one to keep using. Both peers should settle to use the same document
            await otherDocument.handle.whenReady();
            await myDocumentHandle.whenReady();
            myDocumentHandle.merge(otherDocument.handle);
            if (shouldSwitchDocument(myDocumentHandle, otherDocument.handle)) {
                myDocumentHandle.removeAllListeners();
                automergeDocumentUrl.set(otherDocument.handle.url);
                documentHandleStore.set(otherDocument.handle);
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

const shouldSwitchDocument = (currentDocumentHandle: DocHandle<DocumentData>, newDocumentHandle: DocHandle<DocumentData>) => {
    // This comparison is arbitrary. The only thing that's important is that this comparison should be deterministic, so that all peers can agree on the same master document
    // The url is basically a uuid, so this comparison should yield the same result for each peer
    return currentDocumentHandle.url > newDocumentHandle.url;
};

const onDocumentChange = (document: DocHandleChangePayload<DocumentData>) => {
    const h3Index = getH3Index();
    const dataToRender = [];
    for (const data of document.patchInfo.after?.data?.[h3Index] || []) {
        const contentId = data.scr.content.id;
        if (!alreadyRenderedContentIds.includes(contentId)) {
            dataToRender.push(data);
            alreadyRenderedContentIds.push(contentId);
        }
    }
    // TODO: This approach for rendering content is not the best, but it's OK.
    // A better approach would be to use the document.patch object to apply those patches on the document somehow.
    // See this github issue for a discussion: https://github.com/automerge/automerge-repo/issues/302
    if (updateFunction) {
        for (const data of dataToRender) {
            updateFunction({ object_created: data });
        }
    }
};

const initializeRepo = () => {
    documentHandleStore.set(repo?.create<DocumentData>());
    const initialDoc = A.next.load<DocumentData>(initialChange);
    const documentHandle = get(documentHandleStore);
    documentHandle?.update(() => initialDoc);
    automergeDocumentUrl.set(documentHandle?.url || null);
};

export const getAutomergeDocumentData = () => {
    const h3Index = getH3Index();
    const documentHandle = get(documentHandleStore);
    return documentHandle?.docSync()?.data[h3Index];
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
