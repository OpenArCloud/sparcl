# SPatial AR CLoud `<viewer>` - spARcl

(pronounced like sparkle)

This application started as a technology preview for the IEEE VR 2021 workshop from the Open AR Cloud association. The ideas behind this preview have been received positively, so development will continue.

The general idea is to create a generic client application, providing all the basic functionality needed to offer entertaining and inspiring AR experiences. It uses the concepts defined by Open AR Cloud to find available services and content at the current location of the user. The AR content can be text, icons, GLTF 3D models, videos, point clouds, IoT sensor streams, OGC Points of interest, etc.

Loads of ideas for additional base functionalities are available. All of this is easily available to AR scenes created with any 3D platform or game engine that exports to WebXR. Please check out the [documentation](https://openarcloud.github.io/sparcl/) for more detailed information.

The current version is deployed and can be tested at [https://sparcl.orbit-lab.org](https://sparcl.orbit-lab.org) (currently only with Android Chrome).

**Any Feedback, recommendations and contributions of any kind are very welcome**

## Development
Steps to setup the project:

- clone this repository
- run `npm install` in the project folder to download the dependencies
- Create an `.env` file as described below.
- Optionally, adjust the port number in `package.json`
- For local development, uncomment the line containing `//basicSsl(),` in `vite.config.js`. This enables https when running the service locally using `npm run dev`
- For deployment, add your domain name to the `allowedHosts` list in `vite.config.js`

- run `npm run dev`
- note the URL shown in the terminal after the server started (note http or https!)
- open Chrome on an AR capable device, enter `chrome://flags` and enable _WebXR Incubations_

- set up [remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging/) for debugging with cable
- optionally, set up [port forwarding](https://developer.chrome.com/docs/devtools/remote-debugging/local-server/) for debugging wirelessly (only http now)

- enter the URL shown in the terminal in the browser on the device



## Production

Create `.env` file containing the URL to OSCP SSD

```js
VITE_SSD_ROOT_URL = `YOUR_SSD_ROOT_URL`;
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

### Authentication:

- If needed, authentication can be disabled by setting `VITE_NOAUTH=true`, so that users can bypass authentication and access AR mode directly without logging in. 

- The app integrates with Auth0, allowing users to log in with connected OAuth2.0 providers (currently Google). To enable this, add the following variables to your .env file:

```js
## Spatial Service Discovery Root
VITE_SSD_ROOT_URL="YOUR_SSD_ROOT_URL"

## Redirection URI (during authentication)
VITE_AUTH_REDIRECT_URI="YOUR_APP_REDIRECTION_URI"

## Auth0 Login
VITE_AUTH_AUTH0_DOMAIN="AUTH0_DOMAIN"
VITE_AUTH_AUTH0_CLIENTID="AUTH0_CLIENT_ID"

## Here you can disable authentication (for development)
VITE_NOAUTH=false // false if you want Auth0 authentication
VITE_NOAUTH_USER_NAME="DUMMY_USERNAME"
VITE_NOAUTH_USER_EMAIL="DUMMY_EMAIL"

## RabbitMQ topics for sharing agent poses (replace ngi_search with your own)
VITE_RMQ_TOPIC_GEOPOSE_UPDATE="/exchange/ngi_search/geopose_update"
VITE_RMQ_TOPIC_RETICLE_UPDATE="/exchange/ngi_search/reticle_update"
VITE_RMQ_TOPIC_OBJECT_CREATED="/exchange/ngi_search/object_created"

## PoI Search (optional, see OSCP PoI search service)
VITE_POI_SEARCH_BASEURL=""
```

# References

```
@INPROCEEDINGS{10740111,
  author={Gábor Sörös and Andor Kovács and Dénes Bisztray and Asmaa Thabet and Balázs Ladjánszki and James Jackson and Christine Perey and Alina Kadlubsky},
  booktitle={Companion of the the 2025 ACM International Joint Conference on Pervasive and Ubiquitous Computing (UbiComp Companion ’25)},
  title={Demo: Open Visual Positioning and Discovery Services for Location-based Augmented Reality},
  year={2025},
  keywords={Location awareness;Visualization;Cloud computing;Protocols;Metaverse;Collaboration;Cameras;User experience;Spatial computing;Web sites;Mixed/augmented reality;Ubiquitous and mobile computing systems and tools;Location based services},
  doi={10.1145/3714394.3754430}
}
```

```
@INPROCEEDINGS{10740111,
  author={Sörös, Gábor and Jackson, James and Vogt, Michael and Salazar, Mikel and Kadlubsky, Alina and Vinje, Jan-Erik},
  booktitle={2024 IEEE International Conference on Metaverse Computing, Networking, and Applications (MetaCom)},
  title={An Open Spatial Computing Platform},
  year={2024},
  volume={},
  number={},
  pages={239-246},
  keywords={Location awareness;Visualization;Cloud computing;Protocols;Metaverse;Collaboration;Cameras;User experience;Spatial computing;Web sites;Mixed/augmented reality;Ubiquitous and mobile computing systems and tools;Location based services},
  doi={10.1109/MetaCom62920.2024.00046}
}
```

```
@INPROCEEDINGS{9974229,
  author={Sörös, Gábor and Nilsson, John and Wu, Nan and Shane, Jennifer and Kadlubsky, Alina},
  booktitle={2022 IEEE International Symposium on Mixed and Augmented Reality Adjunct (ISMAR-Adjunct)},
  title={Demo: End-to-end open-source location-based augmented reality in 5G},
  year={2022},
  volume={},
  number={},
  pages={897-898},
  doi={10.1109/ISMAR-Adjunct57072.2022.00194}
}
```

```
@INPROCEEDINGS{9585798,
  author={Jackson, James and Vogt, Michael and Sörös, Gábor and Salazar, Mikel and Fedorenko, Sergey},
  booktitle={2021 IEEE International Symposium on Mixed and Augmented Reality Adjunct (ISMAR-Adjunct)},
  title={Demo: The First Open AR Cloud Testbed},
  year={2021},
  volume={},
  number={},
  pages={495-496},
  doi={10.1109/ISMAR-Adjunct54149.2021.00117}
}
```
