/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

/*
    Uses perge, peerjs and automerge to synchronize values between peers over a peer to peer network.
 */

import { v4 as uuidv4 } from 'uuid';
import Perge from '@thirdparty/perge.modern';
import Automerge, {change} from 'automerge'
import Peer from 'peerjs';
import { p2pNetworkState, peerIdStr } from '@src/stateStore';
import { get } from 'svelte/store';
import { availableP2pServices, selectedP2pService } from '@src/stateStore';


let instance;
const docSet = new Automerge.DocSet();

let updateFunction = undefined;
let unsubscribeFunction = undefined;

/**
 * Can be used to put initial values into the docset.
 */
export function initialSetup() {
    // TODO: Add initial values to the docset
}

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
export function connect(headlessPeerId, isHeadless = false, updateftn) {
    updateFunction = updateftn;

    const localPeerId = isHeadless ? headlessPeerId :uuidv4();

    setupPerge(localPeerId);
    setupPeerEvents(headlessPeerId, isHeadless);
}

export function connectWithUrl(headlessPeerId, isHeadless = true, url, port, updateftn) {
    updateFunction = updateftn;

    setupPergeWithUrl(headlessPeerId, url, port);
    setupPeerEvents(headlessPeerId, isHeadless);
}

/**
 * Disconnect the device from the peer to peer network.
 */
export function disconnect() {
    console.log('disconnect');

    // disconnect from Perge
    if (unsubscribeFunction) {
        unsubscribeFunction();
    }

    // disconnect from PeerJS
    if (instance && instance.peer) {
        // Close the connection to the server, leaving all existing data and media connections intact
        instance.peer.disconnect();

        // manually close the peer connections
        // see https://github.com/peers/peerjs/issues/636
        for (let conns in instance.peer.connections) {
            instance.peer.connections[conns].forEach((conn, index, array) => {
            console.log(`closing ${conn.connectionId} peerConnection (${index + 1}/${array.length})`, conn.peerConnection);
            conn.peerConnection.close();

            // close it using peerjs methods
            if (conn.close)
                conn.close();
            });
        }
    }
}

/**
 * Send data out to other connected devices.
 *
 * @param data      The data as Javascript types to send out. Will be stringified later
 */
export function send(data) {
    if (!instance) return;

    instance.select('event')(change, doc => {
        doc[data.event] = data.value;
    })
}

/**
 * Called when an update was received over the network.
 */
function updateReceived() {
    //console.log('Received', JSON.stringify(docSet.docs, null, 2));

    if (updateFunction) {
        // TODO: There has to be a better way to get to the content of a doc
        updateFunction(JSON.parse(JSON.stringify(docSet.docs)).event);
    }
}

/**
 * Set up Perge, which connects peerjs and automerge.
 *
 * @param peerId  String        The peer ID to register with on the signaling server
 */
function setupPerge(peerId) {
    const selected = get(selectedP2pService);
    const service = get(availableP2pServices).reduce((result, service) => service.id === selected.id ? service : result, {});
    const port = service?.properties?.reduce((result, prop) => prop.type === 'port' ? (prop.value) : result, '');

    setupPergeWithUrl(peerId, service?.url, port)
}

function setupPergeWithUrl(peerId, url, port) {
    //NOTE: servers in use:
    //{} // default, hosted by peerjs.com, see https://peerjs.com/peerserver.html
    //{host: 'peerjs-server.herokuapp.com', secure:true, port:443} // heroku server
    //{host: 'rtc.oscp.cloudpose.io', port: 5678, secure:true, key: 'peerjs-mvtest', path: '/', debug: 2} // hosted by OSCP

    const options = url && port ? {
        host: url,
        secure: true,
        port: port
        //,config: {
        //    iceServers: [
        //        { url: 'stun:stun.l.google.com:19302' },
        //        { url: 'stun:stun1.l.google.com:19302' },
        //        { url: 'stun:stun2.l.google.com:19302' },
        //    ]
        //}
    } : {};

    console.log("Creating P2P network:");
    console.log("  Server URL: " + (url!=null ? url : "PeerJS default"));
    console.log("  Server port: " + (port!=null ? port : "PeerJS default"));
    console.log("  PeerId: " + peerId);

    const peer = new Peer(peerId, options);
    instance = new Perge(peerId, {
        decode: JSON.parse, // msgpack or protobuf would also be a good option
        encode: JSON.stringify,
        peer: peer,
        docSet: docSet
    })

    // subscribe returns an unsubscribe function
    unsubscribeFunction = instance.subscribe(() => {
        //console.log('instance.subscribe');
        updateReceived();
    })
}

/**
 * Sets up all the available events of Peerjs.
 *
 * Currently only used to connect this device to an headless client
 *
 * @param headlessPeerId  String        The headless client to connect to
 * @param isHeadless  boolean       true when this client is an headless client, false otherwise
 */
function setupPeerEvents(headlessPeerId, isHeadless) {
    //Emitted when a connection to the PeerServer is established.
    instance.peer.on('open', (id) => {
        let msg = 'Connection to the PeerServer established. Peer ID ' + id;
        console.log(msg);
        p2pNetworkState.set(msg)
        peerIdStr.set(id);

        if (!isHeadless) {
            msg = 'Connecting to headless client: ' + headlessPeerId;
            console.log(msg);
            p2pNetworkState.set(msg);
            let dataConnection = instance.connect(headlessPeerId);
            // TODO: connect() is asynchronous, so this dataConnction should not be used yet
            if (dataConnection != null) {
                msg = 'Connected to headless client.\nMy PeerId: ' + id;
                console.log(msg);
                p2pNetworkState.set(msg);
            }
        }

        // Send heartbeat to keep the connection alive
        if (instance.peerServerHeartbeater === undefined) {
            instance.peerServerHeartbeater = new PeerJSHeartbeater(instance.peer);
            instance.peerServerHeartbeater.start();
        }
    });

    // Emitted when a new data connection is established from a remote peer.
    instance.peer.on('connection', (connection) => {
        let msg = 'Connection established with remote peer: ' + connection.peer;
        console.log(msg);
        p2pNetworkState.set(msg);

        connection.on('close', () => {
            console.log("Connection closed.");
        });
    });

    // Errors on the peer are almost always fatal and will destroy the peer.
    instance.peer.on('error', (error) => {
        let msg = error; // 'Error: ' is already prefixed to the incoming error message
        console.error(msg);
        p2pNetworkState.set(msg);
    })

    // Emitted when the peer is disconnected from the signalling server
    // either manually or because the connection to the signalling server was lost.
    // When a peer is disconnected, its existing connections will stay alive, 
    // but the peer cannot accept or create any new connections. 
    // You can reconnect to the server by calling peer.reconnect().
    instance.peer.on('disconnected', () => {
        let msg = 'Disconnected from PeerServer';
        console.log(msg);
        p2pNetworkState.set(msg);

        if (instance.peerServerHeartbeater != undefined) {
            instance.peerServerHeartbeater.stop();
            instance.peerServerHeartbeater = undefined;
        }
    });

    // Emitted when the peer is destroyed and can no longer accept or create any new connections
    // At this time, the peer's connections will all be closed.
    instance.peer.on('close', () => {
        let msg = "Connection closed";
        console.log(msg);
        p2pNetworkState.set(msg);
    });
}

// Code from https://github.com/peers/peerjs/issues/295
class PeerJSHeartbeater {
    constructor(peer) {
        this.peer = peer;
        //this.start();
    }
    start() {
        console.log("PeerJSHeartbeater start")
        if (this.timeoutID === undefined) {
            this.beat();
        }
    }
    stop() {
        console.log("PeerJSHeartbeater stop")
        clearTimeout(this.timeoutID);
        this.timeoutID = undefined;
    }
    beat() {
        console.log("PeerJS heartbeat from " + this.peer.id)
        this.timeoutID = setTimeout(() => {this.beat();}, 10000);
        if (this.peer.socket._wsOpen()) {
            this.peer.socket.send({ type: 'HEARTBEAT' });
        }
    }
}
