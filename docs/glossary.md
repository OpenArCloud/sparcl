---
layout: default
title: Glossary
nav_order: 100
---

# Definitions of terms often used in the context of sparcl and Open Spatial Computing Platform.

### [Open AR Cloud](https://www.openarcloud.org/) (OARC)

Open AR Cloud's mission is to drive the development of open and interoperable spatial computing technology, data and standards to connect the physical and digital worlds for the benefit of all.

### [Open Spatial Computing Platform](https://www.openarcloud.org/oscp) (OSCP)

Open architecture for a spatial computing platform defined by OARC.

### GeoPose

GeoPose is an upcoming standard from Open Geospatial Consortium (OGC), currently released as [draft](https://github.com/opengeospatial/GeoPose), for geographically-anchored pose (GeoPose) with six degrees of freedom referenced to one or more standardized Coordinate Reference Systems (CRSs). The proposed standard will provide an interoperable way to seamlessly express, record, and share the GeoPose of objects in an entirely consistent manner across different applications, users, devices, services, and platforms which adopt the standard or are able to translate/exchange the GeoPose into another CRS (cited from the GeoPose site).

### Spatial Service Discovery (SSD)

Distributed online [service](<(https://github.com/OpenArCloud/oscp-spatial-service-discovery)>) that allows to request available services at a certain location. Defined by OARC as part of OSCP

### Spatial Services Record (SSR)

Response in [JSON format](https://github.com/OpenArCloud/oscp-spatial-service-discovery) returned from a SSD request. It contains a list of spatial services available at the queried location.

### Spatial Content Discovery (SCD)

Distributed online [service](https://github.com/OpenArCloud/oscp-spatial-content-discovery) that allow to request available content around a certain location. Defined by OARC as part of OSCP.

### Spatial Content Record (SCR)

Response in [JSON format](https://github.com/OpenArCloud/oscp-spatial-content-discovery) returned from a SCD request. It contains a list of geo-located content available around the queried location.

### spARcl

Short for `SPatial AR CLoud <viewer>`, a proof of concept for an AR Cloud client application. Its main purpose is to serve as an experimentation platform for OSCP and a base for specialized applications.

### Dashboard

Page inside sparcl allowing access to some internal settings. It is a termporal solution until it is better understood to which of these settings is actually access needed, and better UX for access is found. Currently, the Dashboard can be opened via an invisible button in the upper right corner of the initial page, or by checking the `show dashboard` option after the AR session ends.

### AR modes

Sparcl offers multiple modes of AR for development purposes. By default, the OSCP mode should be used. However, the OSCP mode uses online services that need to be available and configured before first use. To lower this barrier, there are two special AR modes: [content creation](/sparcl/guides/creationmode.html) and [development](/sparcl/guides/developmentmode.html), both of these work locally, removing the need for setting up online services.

### OSCP mode

The regular usage mode of sparcl, using all the online services of OSCP, like localisation and content discovery.

### Content creation mode

The [Creation mode](/sparcl/guides/creationmode.html) mode is for easy content creation without access to OSCP services. This mode makes very easy to see the content in an AR environment. In this mode, sparcl can be served from a local server, offering a text field for the URL of the content to display.

### Development mode

The [Development mode](/sparcl/guides/developmentmode.html) is targeted at deveopment of sparcl itself. Instead of requesting data from an online service, data (such as localization response) stored in the application itself can be used, making it fast to access and easy to change dependent features.

### Experiment mode

The [Experiement mode](/sparcl/architecture/experiments.md) allows to quickly create multiple new experiments that can be defined as submodules of the Sparcl repository.

### Placeholder

One of the content type of sparcl, instead of requiring a 3D model to be downloaded for display, the model is defined by a JSON structure (called spatial content record). This record is then interpreted by sparcl and a 3D model generated according to its content.
