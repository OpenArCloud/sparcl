import throttle from 'lodash/throttle';
import stomp, { type Client, type Frame } from 'stompjs';

let rmqClient: Client | null = null;

export async function testRmqConnection({ url, username, password }: { url: string; username: string; password: string }) {
    return await new Promise<boolean>((resolve, reject) => {
        const rmq = stomp.client(url);
        rmq.debug = () => {};
        const onConnect = () => {
            rmq.disconnect(() => {});
            resolve(true);
        };
        const onError = (err: Frame | string) => {
            rmq.disconnect(() => {});
            console.log('err', err);
            reject(err);
        };
        rmq.connect(username, password, onConnect, onError, '/');
    });
}

export function connectWithReceiveCallback({ updateFunction, url, username, password }: { updateFunction: (data: any) => void; url: string; username: string; password: string }) {
    const throttledUpdateFunction = throttle((data) => {
        if (updateFunction) {
            updateFunction(data);
        }
    }, 0);

    // We use STOMP.js for RabbitMQ connection
    // See https://www.rabbitmq.com/stomp.html
    console.log('Connecting to RMQ ' + url);
    console.log('url', url);
    rmqClient = stomp.client(url);
    rmqClient.debug = function (str) {
        // for debugging, we can print all received messages to the console (or even to a separate HTML view)
        //console.log(str + "\n");
    };
    const on_connect = function (x: any) {
        console.log('RMQ connection successful!');
    };

    const on_error = function (err: Frame | string) {
        console.log(`Error: rabbitmq connection disconnected, reason: ${err}. Trying to reconnect.`);
        setTimeout(rmqClient?.connect(username, password, on_connect, on_error, '/'), 1000);
    };

    rmqClient.connect(username, password, on_connect, on_error, '/');
}

export const rmqDisconnect = () => {
    rmqClient?.disconnect(() => {});
};

export function send(routing_key: string, data: any) {
    // Note: Stomp SEND to a destination of the form /exchange/<name>[/<routing-key>] sends to exchange <name> with the routing key <routing-key>.
    rmqClient?.send(routing_key, {}, JSON.stringify(data));
}
