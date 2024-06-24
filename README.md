# SPatial AR CLoud `<viewer>` - spARcl
(pronounced like sparkle)

This application started as a technology preview for the IEEE VR 2021 workshop from the Open AR Cloud association. The ideas behind this preview have been received positively, so development will continue.

The general idea is to create a generic client application, providing all the basic functionality needed to offer entertaining and inspiring AR experiences. It uses the concepts defined by Open AR Cloud to find available services and content at the  current location of the user.

As additional functionality, the application implements data synchronisation using automerge over p2p network using peerjs and perge. The applications connect to the p2p network automatically when allowed by the user.

Loads of ideas for additional base functionalities are available. All of this is easily available to AR scenes created with any 3D platform or game engine that exports to WebXR. Please check out the [documentation](https://openarcloud.github.io/sparcl/) for more detailed information.

**Any Feedback, recommendations and contributions of any kind are very welcome**


## Access

The app can be used / installed as:
* [PWA](https://web.dev/progressive-web-apps/) from its [homepage](https://sparcl.app/)
* [TWA](https://developer.chrome.com/docs/android/trusted-web-activity/overview/) from [Play store](https://play.google.com/store/apps/details?id=app.sparcl.twa)


## Development

npm needs to be installed, because dependencies are handled with it.

Steps to setup the project:
* clone this repository
* run `npm install` in the project folder to download the dependencies
* run `npm run dev`
* note the URL shown in the terminal after the server started (note http or https!)
* open Chrome on an AR capable device, enter `chrome://flags` and enable _WebXR Incubations_

* set up [remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging/) for debugging with cable
* optionally, set up [port forwarding](https://developer.chrome.com/docs/devtools/remote-debugging/local-server/) for debugging wirelessly (only http now)

* enter the ULR shown in the terminal in the browser on the device

* For local development uncomment the line containing `//basicSsl(),` in `vite.config.js`. This enables https when running the service locally using `npm run dev`

## Production
Create `.env` file containing the URL to OSCP SSD
```
VITE_SSD_ROOT_URL=
```

### Build:
```
npm install
npm run build
```

### Start:
```
npm run start
```

## Docker build

To build a docker image run the `npm run build:docker` script. Make sure you have your `.env` file correctly set up before building. If you are unwilling or unable to create a `.env` file (eg.: because the build is happening in a CI pipeline), then an alternate solution is to add the following lines to the Dockerfile:

```Dockerfile
ARG VITE_SSD_ROOT_URL
ENV VITE_SSD_ROOT_URL=$VITE_SSD_ROOT_URL
```

and to run the docker build script with the following command line argument: `docker build --build-arg VITE_SSD_ROOT_URL=https://your-ssd-url-domain.com . -t sparcl`
