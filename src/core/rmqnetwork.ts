import { get } from 'svelte/store';
import { myAgentId } from '@src/stateStore';
import { throttle } from 'es-toolkit';
import { Client as StompClient, StompConfig, type IFrame, type messageCallbackType } from '@stomp/stompjs';

const rmq_topic_geopose_update = import.meta.env.VITE_RMQ_TOPIC_GEOPOSE_UPDATE + '.#'; // subscribe to all subtopics
const rmq_topic_reticle_update = import.meta.env.VITE_RMQ_TOPIC_RETICLE_UPDATE + '.#'; // subscribe to all subtopics
const rmq_topic_object_created = import.meta.env.VITE_RMQ_TOPIC_OBJECT_CREATED;
const rmq_topic_sensor_update = import.meta.env.VITE_RMQ_TOPIC_SENSOR_UPDATE;

let rmqClient: StompClient | null = null;

export async function testRmqConnection({ url, username, password }: { url: string; username: string; password: string }) {
    return await new Promise<void>((resolve, reject) => {
        const stompConfig = new StompConfig();
        stompConfig.brokerURL = url;
        stompConfig.reconnectDelay = 0;
        stompConfig.connectHeaders = {
            login: username,
            passcode: password,
        };

        const onConnect = () => {
            rmq.deactivate();
            resolve(undefined);
        };
        const onStompError = (frame: IFrame) => {
            rmq.deactivate();
            console.log('err', frame.body);
            reject(frame.body);
        };

        const rmq = new StompClient(stompConfig);
        rmq.onConnect = onConnect;
        rmq.onStompError = onStompError;
        rmq.activate();
    });
}

export function connectWithReceiveCallback({ updateFunction, url, username, password }: { updateFunction: (data: any) => void; url: string; username: string; password: string }) {
    // disconnect first if there already was a connection established
    rmqDisconnect();
    const throttledUpdateFunction = throttle((data: any) => {
        if (updateFunction) {
            updateFunction(data);
        }
    }, 0);

    // We use STOMP.js for RabbitMQ connection
    // See https://www.rabbitmq.com/stomp.html
    console.log('Connecting to RMQ ' + url);
    const stompConfig = new StompConfig();
    stompConfig.brokerURL = url;
    stompConfig.reconnectDelay = 1000;
    stompConfig.connectHeaders = {
        login: username,
        passcode: password,
    };
    stompConfig.debug = function (str) {
        // for debugging, we can print all received messages to the console (or even to a separate HTML view)
        //console.log(str + "\n");
    };
    const onConnect = function () {
        if (!rmqClient) {
            console.error('RMQ client disappeared after successful connection');
            return;
        }
        console.log('RMQ connection successful!');

        // Now we can subscribe to topics.
        // Note: Stomp subscribe for a destination of the form /exchange/<name>[/<pattern>] does 3 things:
        // 1. creates an exclusive, auto-delete queue on <name> exchange;
        // 2. if <pattern> is supplied, binds the queue to <name> exchange using <pattern>; and
        // 3. registers a subscription against the queue, for the current STOMP session.

        ////////////////////////////////////////////////////////
        //   subscription topics
        ////////////////////////////////////////////////////////

        console.log('Subscribing to topic ' + rmq_topic_geopose_update);
        rmqClient.subscribe(rmq_topic_geopose_update, function (d) {
            const msg = JSON.parse(d.body);
            //console.log(msg);

            const agentId = msg.agent_id || '';
            if (agentId == '' || agentId == get(myAgentId)) {
                return;
            }

            const timestamp = msg.timestamp || Date.now();
            const agentGeopose = msg.geopose;
            const agentName = msg.avatar.name || '';
            const data = {
                agent_geopose_updated: {
                    agent_id: agentId,
                    agent_name: agentName,
                    geopose: agentGeopose,
                    color: msg.avatar.color,
                    timestamp: timestamp,
                },
            };
            throttledUpdateFunction(data);
        });

        console.log('Subscribing to topic ' + rmq_topic_reticle_update);
        rmqClient.subscribe(rmq_topic_reticle_update, function (d) {
            const msg = JSON.parse(d.body);
            //console.log(msg);

            const agentId = msg.agent_id || '';
            if (agentId == '' || agentId == get(myAgentId)) {
                return;
            }

            if (msg.active === false) {
                updateFunction({ reticle_update: msg });
                return;
            }

            const timestamp = msg.timestamp || Date.now();
            const agentGeopose = msg.geopose;
            const agentName = msg.avatar.name || '';
            const color = [msg.avatar.color.r / 255, msg.avatar.color.g / 255, msg.avatar.color.b / 255, msg.avatar.color.a];
            const data = {
                reticle_update: {
                    agent_id: agentId,
                    active: msg.active,
                    agent_name: agentName,
                    geopose: agentGeopose,
                    color: color,
                    timestamp: timestamp,
                },
            };
            updateFunction(data);
        });

        console.log('Subscribing to topic ' + rmq_topic_object_created);
        rmqClient.subscribe(rmq_topic_object_created, function (d) {
            const msg = JSON.parse(d.body);
            const data = {
                object_created: {
                    timestamp: msg.timestamp || Date.now(),
                    ...msg,
                },
            };
            throttledUpdateFunction(data);
        });
    };

    const onError = function (frame: IFrame) {
        console.log('Error: RMQ disconnected', frame.body);
    };

    rmqClient = new StompClient(stompConfig);
    rmqClient.onConnect = onConnect;
    rmqClient.onStompError = onError;
    rmqClient.activate();
}

export function subscribeToSensor(topic: string, callback: messageCallbackType) {
    console.log('Subscribing to ', topic);
    rmqClient?.subscribe(topic, callback);
}

export const rmqDisconnect = () => {
    rmqClient?.deactivate();
};

export function send(routing_key: string, headers: Record<string, any>, data: any) {
    // Note: Stomp SEND to a destination of the form /exchange/<name>[/<routing-key>] sends to exchange <name> with the routing key <routing-key>.
    rmqClient?.publish({ destination: routing_key, headers, body: JSON.stringify(data) });
}

export function isConnected() {
    return rmqClient != null && rmqClient.connected === true;
}
