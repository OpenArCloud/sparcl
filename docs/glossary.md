---
layout: default
title: Glossary
nav_order: 100
---

# Definitions of terms often used in the context of sparcl and Open Spatial Computing Platform.

### AR modes
sparcl's functionality depends on online services to be available and configured before it can be useful. To lower this barrier there are specific modes for 2 use cases: [content creation](/sparcl/guides/creationmode.html) and [development](/sparcl/guides/developmentmode.html). Both work locally, removing the need for online services availability.

### Content creation mode
[Special mode](/sparcl/guides/creationmode.html) for use during content creation, to make it very easy to see the content in an AR environment. In this mode sparcl is served from a local server, offering a text field for the URL of the content to display.

### Dashboard
Page inside sparcl allowing access to some internal settings. It is a termporal solution, until it is better understood to which of these settings is actually access needed, and better UX for access is found. Currently, it is accessed through an invisible button in the uppoer right corner of the initial page.

### Development mode
The [second mode](/sparcl/guides/developmentmode.html) targeted at deveopment of sparcl itself. Instead of requesting data from an online service, data stored in the application itself is used, making it fast to access and easy to change.

### GeoPose
[Taken from GeoPose SWG site] An upcoming standard from Open Geospatial Consortium (OGC), currently [released as draft](https://github.com/opengeospatial/GeoPose), for geographically-anchored pose (GeoPose) with 6 degrees of freedom referenced to one or more standardized Coordinate Reference Systems (CRSs). The proposed standard will provide an interoperable way to seamlessly express, record, and share the GeoPose of objects in an entirely consistent manner across different applications, users, devices, services, and platforms which adopt the standard or are able to translate/exchange the GeoPose into another CRS.

### [Open AR Cloud](https://www.openarcloud.org/) (OARC)
Open AR Cloud's mission is to drive the development of open and interoperable spatial computing technology, data and standards to connect the physical and digital worlds for the benefit of all.

### [Open Spatial Computing Platform](https://www.openarcloud.org/oscp) (OSCP)
Open architecture for a spatial computing platform defined by OARC.

### OSCP mode
The regular usage mode of sparcl, using all the online services of OSCP, like localisation and content discovery.

### Placeholder
One of the content type of sparcl, which will probably used most of the time. Instead of requiring a 3D model to be downloaded for display, the model is defined by a JSON structure (called spatial content record). This record is then interpreted by sparcl and a 3D model generated according to its content.

### spARcl
Short for `SPatial AR CLoud <viewer>`, a proof of concept for an AR Cloud client application. Its main purpose is to serve as an experimentation platform for OSCP and a base for specialiced, commercial applications. 

### Spatial Service Discovery (SSD)
Distributed online [service]((https://github.com/OpenArCloud/oscp-spatial-service-discovery)) that allows to request available services at a certain location. Defined by OARC as part of OSCP

### spatial services record (ssr)
Response in [JSON format](https://github.com/OpenArCloud/oscp-spatial-service-discovery) returned from a SSD request. It contains a list of spatial services available at the queried location.

### Spatial Content Discovery (SCD)
Distributed online [service](https://github.com/OpenArCloud/oscp-spatial-content-discovery) that allow to request available content around a certain location. Defined by OARC as part of OSCP.

### spatial content record (scr)
Response in [JSON format](https://github.com/OpenArCloud/oscp-spatial-content-discovery) returned from a SCD request. It contains a list of geo located content available around the queried location.
