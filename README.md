# WebXR client for IEEE workshop

This application started as a technology preview for the IEEE VR 2021 workshop from
the Open AR Cloud association. The ideas behind this preview have been received 
positively, so development will continue after the workshop.

The general idea is, to create a generic client application, providing all the basic
functionality needed to offer entertaining and inspiring AR experiences. It uses the
concepts defined by Open AR Cloud to find available services and content at the 
current location of the user.

As additional functionality, the application implements data synchronisation using
automerge over p2p network using peerjs and perge. The applications connect to 
the p2p network automatically when allowed by the user.

Loads of ideas for additional base functionalities are available. All of this is 
easily available to AR scenes created with any 3D platform that exports to WebXR's 
AR module or 3D libraries. How to get such integrations done will be the focus of 
development after the workshop.

**Feedback, recommendations and contributions of any kind are very welcome**

## Development

npm needs to be installed, because dependencies are handled with it. 

Steps to setup the project: 
* clone this repository
* run `npm install` to download the dependencies
* run `npx devcert-cli generate localhost` to create self-signed certificates
* rename certificates to _snowpack.key_ and _snowpack.crt_
* run `npm run start`
* note the URL shown in the terminal after the server started


* open Chrome on an AR capable device, enter `chrome://flags` and enable _WebXR Incubations_
* enter the ULR shown in the terminal in the browser on the device 
* click through the self-signed certificate warning

