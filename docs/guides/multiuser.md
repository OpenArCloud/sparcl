---
layout: default
title: Multi User
parent: Guides
nav_order: 10
---

# Multiuser setup

This is a quick rundown on how to use the multi-user features of sparcl. It can be used to offer a collective interactive experience with an imported scene. 

A simple use case: You're visiting a world heritage site with your friends. An interactive AR experience is available there, visualizing the mechanics of a historic machinery. Without multi user feature, the machine would be seen differently on every device. With multi user feature, the machine is shown in the same state on every device connected to the service. Exactly as it would be when the actual machine would stay at that location.

We provide a simpler example in the repository. The `ismar2021multi` experiment implements random object spawning on user tap, and the spawned objects are synchornized between connected clients so that everyone sees the same objects at the same locations. Optionally, a headless client that runs longer can also join the network and save the history so that newly connected peers can also get the objects previously placed in the scene.


# Prerequisites

## Technologies used

The application implements data synchronisation using automerge over p2p network using [peerjs]https://peerjs.com/). The applications discovers locally registered p2p networks via the SSD, and the user can select one network on the dashboard. After entering the AR mode, the clients connect to the selected p2p network automatically when allowed by the user.

The inspiration for the multiuser architecture of sparcl came from an article titled [`A web application with no web server?`](https://medium.com/all-the-things/a-web-application-with-no-web-server-61000a6aed8f#e135) by [Ink & Switch](https://www.inkandswitch.com/).


## PeerJS server
We recommend to run your own [peerjs-server](https://github.com/peers/peerjs-server) under your domain. It can be easily set up via docker:
```
docker run \
  --network host \
  --publish YOUR_EXTERNAL_PORT:9000
  --detach \
  --restart unless-stopped \
  peerjs/peerjs-server \
  --port 9000 \
  --allow_discovery true \
  --key peerjs \
  --alive_timeout 60000 \
  --proxied true \
  --path /sparcl
```

## Register your PeerJS server with [SSD](https://openarcloud.github.io/sparcl/glossary.html#spatial-service-discovery-ssd)
How to do this, depends on the service provider you use. Add to the service properties the following key-value pairs:
```
port: YOUR_PEERJS_SERVER_PORT
path: /sparcl
key: peerjs
```
(The `URL:YOUR_PEERJS_SERVER_URL` is a separate property of the service)

NOTE: ~~Also add the peer ID (`persistent_peer_id`) of the headless client to the field description.~~ In our formerly used public PeerJS servers, it was not possible to query the list of currently connected peers, therefore we needed to use a dedicated peer (P2P-master) with a pre-shared peer ID, and everybody would connect to this one, so the contents would get synchronized over it. This is obviously against the P2P design. Starting sparcl in headless mode with a dedicated peerID was possible by adding `?peerid=<persistent_peer_id>` in the URL (this no no longer so). Without having any better alternative, this `persistent_peer_id` ID was listed as a property of the service. Since we can run our own `peerjs-server` with  `allow_discovery=true`, clients can query the list of connected peers, so there is no need for a dedicated client anymore.

## History

Newly joining mobile clients will automatically get the full history from the others on the network.

Deleting the shared history is possible by pressing "Clear P2P history" on _every_ client that was part of the network.

## Headless client

If there is need to persist the history of events (or the created scene) longer than the players are present, one can run a headless client (for example in the edge cloud) which will save the history in its local storage. 

Starting sparcl in headless mode is possible by adding `?headless=true` in the URL. It is not truly headless because it does have a very simple graphical user interface which prints the properties of the P2P service and also prints the last shared message. 

In our current implementation, the automerge documents are split up based on the physical area they are responsible for, specifically based on H3 indices.
Without having any better alternative, the "location" (H3 index) of the headless client needs to be specified manually as a URL parameter. Based on this provided H3 index, the headless sparcl will query the SSD for available services. Without a GUI, we can only select a service manually as a URL parameter. A full headless client URL is shown below:
```
https://YOUR_SPARCL_URL:YOUR_SPARCL_PORT/?headless=true&signal=YOUR_PEERJS_SERVER_URL&port=YOUR_PEERJS_SERVER_PORT&path=/sparcl&key=peerjs&h3index=YOUR_H3_INDEX
```


## Mobile clients
Open the dashboard:

![image](https://user-images.githubusercontent.com/231274/115959182-440f2a80-a50b-11eb-82ea-65e6521b6c84.png)

Activate P2P connectivity:

![image](https://user-images.githubusercontent.com/231274/116231290-f4be3980-a758-11eb-87bd-1652e648ec46.png)

Restart sparcl to connect to the headless client


# Content, experiences, events

The interactivity needs to be implemented in the scene itself. The only thing to add for multi user functionality is to send events. The format and content of the events can be defined by the developer, sparcl doesn't interpret these events, but forwards them over PeerJS to distribute them to all connected peers. The events (including the own events) received are written into every client's own automerge document. Automerge makes sure that there are no conflicts. Changes in the automerge document trigger actions in sparcl, for example newly received objects get added to the renderer (see `Viewer.onNetworkEvent()`).

### Register your scene with [SCD](https://openarcloud.github.io/sparcl/glossary.html#spatial-content-discovery-scd)

How to do this, depends on the service provider you use.

### Add the names of the events to the record created with the previous step.

This is the part that is still a bit difficult. That's why we used for samples some hardcoded events. An appropriate property to add this info to an SCR is a pending feature request and should arrive soon-ish on the SCD from Open AR Cloud. Will likely take a little bit more time for commercial providers.

### Add the events to the scene

The `postMessage` event is used for the communication between the iframe and sparcl.

```javascript
// Sending a message to the parent window
window.parent.postMessage(msg, '*');

// Receiving messages from the parent window
window.addEventListener('message', (msg) => {
    console.log(msg.data);
});
```

A concrete sample to illustrate this feature is in the works. When available, the implementation and this guide will be finished.
