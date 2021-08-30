---
layout: default
title: Welcome to spARcl
nav_order: 1
---

# Welcome to spARcl

spARcl is a proof-of-concept WebXR-based client application for the Open Spatial Computing platform (OSCP) defined by the [Open AR Cloud association](https://www.openarcloud.org/). The main components of the OSCP and the interaction flow between a client and the platform components are illustrated below. spARcl can be used anywhere where OSCP-compliant services are available. 

![01__ 2021 __ Open AR Cloud Europe English](https://user-images.githubusercontent.com/231274/115872403-0eead580-a442-11eb-8989-91e462c64cfd.png)

spARcl is a basic 3D augmented reality viewer application, specialized for the requirements of an AR Cloud environment. The main parts providing spARcl's functionality are:

* [GeoPose](https://github.com/opengeospatial/GeoPose), an emerging standard under development in the Open Geospatial Consortium that when implemented will permit components and services to obtain, save/record, share and communicate geospatial position and orientation of any real or virtual objects with 6 degrees of freedom in a consistent fashion.
* [GeoPose Protocol](https://github.com/OpenArCloud/oscp-geopose-protocol) is a protocol for visual positioning services in the OSCP
* [Spatial Discovery Services](https://www.openarcloud.org/oscp) which, through a local listing of references in a “Spatial Discovery Service” will provide seamless access to content, services, application communication channels that are available in a user’s location. It is conceptually similar DNS, but operating in a more distributed way by focusing on referencing local resources. Currently, [Augmented City](https://www.augmented.city/) is the only service provider supporting OSCP, with [Immersal](https://immersal.com/) being very close, and [ARWAY](https://medium.com/arway/building-the-worlds-spatial-index-with-arwaykit-c97d40f31528) announced recently that they are working on it.
* [automerge](https://github.com/automerge/automerge), and [perge](https://github.com/sammccord/perge), handling the synchronisation of data between devices over a local p2p network.
* [ogl](https://github.com/oframe/ogl), a small, effective WebGL library with minimal layers of abstraction.
* Several features of the AR-module of WebXR. These are currently avalaible in prerelease form behind the flag 'WebXR incubations' in Google Chrome.

Using OSCP makes it possible to use spARcl in a wide array of use cases. The downside is that everything needs to be set up correctly before it can be used. The prerequisites are:

* For exact localisation of the client device, the area around needs to have been scanned by a localisation service.
* The scanned area needs to be registered with the OSCP Spatial Services Discovery (SSD).
* Content available around the current location needs to be registered with the OSCP Spatial Content Discovery (SCD)

None of this can be expected to be given in such an early state of the platform. To make spARcl development and content creation easier, specific *development* and *experiment* modes are available which remove these requirements and place the content near the local localisation point.

We hope this quick overview got you interested to learn more, and even try it out. You're very welcome to do so. Further documentation is upcoming, and the current version of the app is installed at [https://sparcl.cloudpose.io/](https://sparcl.cloudpose.io/)
