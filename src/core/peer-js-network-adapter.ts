/**
 * A `NetworkAdapter` which uses [`MessageChannel`](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel)
 * to communicate with other peers. This is useful for communicating between
 * browser tabs and web workers (including shared workers).
 *
 * @module
 */
import { type NetworkAdapterInterface, type PeerId, type Message, type PeerMetadata, type NetworkAdapterEvents } from '@automerge/automerge-repo';
import { EventEmitter } from 'eventemitter3';
import { type DataConnection, Peer, type PeerJSOption } from 'peerjs';
import { p2pNetworkState } from '../stateStore';

export class PeerjsNetworkAdapter extends EventEmitter<NetworkAdapterEvents> implements NetworkAdapterInterface {
    constructor(public peerJsServerConfig: PeerJSOption) {
        super();
    }
    public peer?: Peer;
    public peerId?: PeerId;
    public peerMetadata?: PeerMetadata;
    public connections: DataConnection[] = [];
    connect(peerId: PeerId, peerMetadata?: PeerMetadata | undefined): void {
        this.peerId = peerId;
        this.peerMetadata = peerMetadata;
        this.peer = new Peer(peerId, this.peerJsServerConfig);
        this.peer.on('open', (id) => {
            console.log(`Connection to the PeerServer established. Peer ID ${id}`);
            p2pNetworkState.set('connected');
            this.connectToPeers();
            this.emit('ready', { network: this });
        });
        this.peer.on('close', () => {
            p2pNetworkState.set('not connected');
        });
        this.peer.on('connection', (connection) => {
            this.connections.push(connection);
            connection.on('open', () => {
                connection.send({
                    senderId: this.peerId,
                    type: 'welcome',
                    peerMetadata: this.peerMetadata,
                });
                connection.on('data', (data) => {
                    this.handleMessage(data as BroadcastChannelMessage);
                });
                connection.on('close', () => {
                    const connectionIndex = this.connections.findIndex((conn) => conn.label === connection.label);
                    if (connectionIndex !== -1) {
                        this.connections.splice(connectionIndex, 1);
                    }
                });
            });
        });
    }
    send(message: BroadcastChannelMessage): void {
        this.connections.forEach((connection) => {
            if (connection.open) {
                connection.send(message);
            }
        });
    }

    private handleMessage(message: BroadcastChannelMessage) {
        const { senderId, type } = message;
        switch (type) {
            case 'arrive':
                {
                    const { peerMetadata } = message as ArriveMessage;
                    this.send({
                        senderId: this.peerId!,
                        targetId: senderId,
                        type: 'welcome',
                        peerMetadata: this.peerMetadata!,
                    });
                    this.announceConnection(senderId, peerMetadata);
                }
                break;
            case 'welcome':
                {
                    const { peerMetadata } = message as WelcomeMessage;
                    this.announceConnection(senderId, peerMetadata);
                }
                break;
            default:
                if (!('data' in message)) {
                    this.emit('message', message);
                } else {
                    const data = message.data as ArrayBufferLike;
                    this.emit('message', {
                        ...message,
                        data: new Uint8Array(data),
                    });
                }
                break;
        }
    }

    disconnect(): void {
        this.connections.forEach((connection) => {
            connection.close();
        });
        this.peer?.disconnect();
        this.peer?.destroy();
    }

    private announceConnection(peerId: PeerId, peerMetadata: PeerMetadata) {
        this.emit('peer-candidate', { peerId, peerMetadata });
    }

    private connectToPeers() {
        this.peer?.listAllPeers((peerIds: string[]) => {
            peerIds.forEach((peerId) => {
                const connection = this.peer?.connect(peerId);
                if (connection) {
                    this.connections.push(connection);
                    connection.on('open', () => {
                        connection.send({
                            senderId: this.peerId,
                            type: 'arrive',
                            peerMetadata: this.peerMetadata,
                        });
                        connection.on('data', (data) => {
                            this.handleMessage(data as BroadcastChannelMessage);
                        });
                        connection.on('close', () => {
                            const connectionIndex = this.connections.findIndex((conn) => conn.label === connection.label);
                            if (connectionIndex !== -1) {
                                this.connections.splice(connectionIndex, 1);
                            }
                        });
                    });
                }
            });
        });
    }
}

/** Notify the network that we have arrived so everyone knows our peer ID */
type ArriveMessage = {
    type: 'arrive';
    /** The peer ID of the sender of this message */
    senderId: PeerId;
    /** The peer metadata of the sender of this message */
    peerMetadata: PeerMetadata;
    /** Arrive messages don't have a targetId */
    targetId: never;
};

/** Respond to an arriving peer with our peer ID */
type WelcomeMessage = {
    type: 'welcome';
    /** The peer ID of the recipient sender this message */
    senderId: PeerId;
    /** The peer metadata of the sender of this message */
    peerMetadata: PeerMetadata;
    /** The peer ID of the recipient of this message */
    targetId: PeerId;
};

type BroadcastChannelMessage = ArriveMessage | WelcomeMessage | Message;
