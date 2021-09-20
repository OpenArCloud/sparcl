---
layout: default
title: Multi User
parent: Guides
nav_order: 10
---

# Multi user setup

This is a quick rundown on how to use the multi user feature of sparcl. It can be used to offer a collective interactive experience with an imported scene.

A simple use case: You're visiting a world heritage site with your friends. On site an interactive AR experience is available, visualizing the mechanics of an historic machinery. Without multi user feature, the machine would be seen differently on every device. With multi user feature, the machine is shown in the same state on every device connected to the service. Exactly as it would be when the actual machine would stay at that location.

The inspiration for the multiuser architecture of sparcl came from an article titled [`A web application with no web server?`](https://medium.com/all-the-things/a-web-application-with-no-web-server-61000a6aed8f#e135) by [Ink & Switch](https://www.inkandswitch.com/).


## Preparation for sparcl
### Register an headless client with [SSD](https://openarcloud.github.io/sparcl/glossary.html#spatial-service-discovery-ssd)
How to do this, depends on the service provider you use. The important part here is to add the peer ID for the headless client to the field description - better place to add this info is requested. 

### Run the headless client
So far there is no publicly accessible headless client available. The idea is to run spacly behind a lambda function. How exactly this can be done is still unclear (to us). But we'll get there

  Until this is figured out, you can start sparcl by adding `?peerid=<peerid>`. `peerid` is the ID set in the step above.

### Open the dashboard
![image](https://user-images.githubusercontent.com/231274/115959182-440f2a80-a50b-11eb-82ea-65e6521b6c84.png)

### Activate P2P connectivity
![image](https://user-images.githubusercontent.com/231274/116231290-f4be3980-a758-11eb-87bd-1652e648ec46.png)

### Restart sparcl to connect to the headless client

## Preparation for the content

The complete interactivity needs to be implemented in the scene itself. The only thing to add for multi user functionality is to send events to sparcl. sparcl doesn't interpret these events, but just sends them out to the headless client, which in turn distributes them to all at that very moment to the headless client connected peers.

### Register scene with [SCD](https://openarcloud.github.io/sparcl/glossary.html#spatial-content-discovery-scd)
How to do this, depends on the service provider you use.

### Add the names of the events to the record created with the previous step.
This is the part that is still a bit difficult. That's why we used for samples some hardcoded events. An appropriate property to add this info to an scr is request and should arrive soonish on the SCD from Open AR Cloud. Will likely take a little bit more time for commercial providers.

### Add the events to the scene
The `postMessage` event is used for the communication between the iframe and sparcl.

```javascript
// Sending a message to the parent window
window.parent.postMessage(msg, "*");

// Receiving messages from the parent window
window.addEventListener("message", msg => {
	console.log(msg.data);
});

```

A concrete sample to show off this feature is in the works. When available, the implementation and this guide will be finished.
