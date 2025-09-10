---
layout: default
title: Welcome to spARcl
nav_order: 1
---

# Welcome to spARcl

spARcl is a proof-of-concept WebXR-based client application for the Open Spatial Computing platform (OSCP) defined by the [Open AR Cloud association](https://www.openarcloud.org/).

## OSCP

The open spatial computing platform (abbreviated OSCP) defines the major components and most important interfaces required to deliver AR Cloud experiences. The [project](https://github.com/openarcloud) includes a protocol describing the pose of objects w.r.t the Earth, a protocol for image-based localization, and protocols for spatial service and spatial content discovery. Currently, there exist reference implementations for Spatial Service Discovery (SSD), Spatial Content Discovery (SCD), wrappers for third-party visual positioning services, and _sparcl_ as a reference client using WebXR.

The main components of the OSCP and the interaction flow between a client and the platform components are illustrated below.

- (1) The mobile client first queries the SSD for spatial services in the vicinity, similar to a domain name service with spatial context.
- (2) The client sends a photo to a visual localization service and receives back its estimated 6DoF GeoPose [2]. This allows to align the client’s own pose tracking algorithm with the common global coordinate system.
- (3) Given the client’s global pose, the SCD helps to discover relevant spatial content available to the client at the current location. The content can be 2D or 3D assets or entry points to richer spatial experiences. The SCD provides metadata, references to external content, and corresponding GeoPoses, organized within lightweight spatial content records (SCRs). It is important to note that the OSCP does not store content, it merely connects users to resources operated by content providers.
- (4) Finally (though not implemented yet), the client can query stored world models that allow features like occlusion and semantics.
- Further third-party XR services like complex experiences and cloud rendering can be integrated in the future.

![01__ 2021 __ Open AR Cloud Europe English](https://user-images.githubusercontent.com/231274/115872403-0eead580-a442-11eb-8989-91e462c64cfd.png)

## sparcl

spARcl is a basic 3D augmented reality viewer application, specialized for the requirements of an AR Cloud environment. spARcl can be used anywhere where OSCP-compliant services are available. The main parts providing spARcl's functionality are:

- [GeoPose](https://github.com/opengeospatial/GeoPose), an approved standard in the Open Geospatial Consortium that permits components and services to obtain, save/record, share and communicate geospatial position and orientation of any real or virtual objects with 6 degrees of freedom in a consistent fashion.
- [GeoPose Protocol](https://github.com/OpenArCloud/oscp-geopose-protocol) is a protocol for visual positioning services in the OSCP
- [Spatial Discovery Services](https://www.openarcloud.org/oscp) which, through a local listing of references in a “Spatial Discovery Service” will provide seamless access to content, services, application communication channels that are available in a user’s location. It is conceptually similar DNS, but operating in a more distributed way by focusing on referencing local resources. Currently, [Augmented City](https://www.augmented.city/) is the only service provider supporting OSCP, but other service providers are most welcome to interface with it.
- [automerge](https://github.com/automerge/automerge), and [perge](https://github.com/sammccord/perge), handling the synchronization of data between devices over a local peer-to-peer network.
- [ogl](https://github.com/oframe/ogl), a small, effective WebGL library with minimal layers of abstraction.
- Several features of the AR-module of WebXR. These are currently avalaible in pre-release form behind the flag 'WebXR incubations' in Google Chrome.

Using OSCP makes it possible to use spARcl in a wide range of use cases. The downside is that everything needs to be set up correctly before it can be used. The prerequisites are:

- For exact localisation of the client device, the area around needs to have been scanned by a (visual) localization service.
- The positioning service and the scanned area needs to be registered with the OSCP Spatial Services Discovery (SSD).
- Content available around the current location needs to be registered with the OSCP Spatial Content Discovery (SCD).

Note that the platform is still in early prototype phase and setting up the services is not very user-friendly.
To make spARcl development and content creation easier, specific _development_ and _experiment_ modes are available which remove these requirements and place some content near the latest localization point.

We hope this quick overview got you interested to learn more and even try it out. You're very welcome to do so. Further documentation is upcoming, and the current version of the can be tested at [https://sparcl.cloudpose.io/](https://sparcl.cloudpose.io/) (currently only with Android Chrome).

## References

```
@INPROCEEDINGS{9974229,
  author={Sörös, Gábor and Nilsson, John and Wu, Nan and Shane, Jennifer and Kadlubsky, Alina},
  booktitle={2022 IEEE International Symposium on Mixed and Augmented Reality Adjunct (ISMAR-Adjunct)},
  title={Demo: End-to-end open-source location-based augmented reality in 5G},
  year={2022},
  volume={},
  number={},
  pages={897-898},
  doi={10.1109/ISMAR-Adjunct57072.2022.00194}}
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
  doi={10.1109/ISMAR-Adjunct54149.2021.00117}}
```
