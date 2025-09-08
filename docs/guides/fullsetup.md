---
layout: default
title: Full Setup
parent: Guides
nav_order: 1
---

# Full setup for [spARcl](https://openarcloud.github.io/sparcl/dictionary.html#sparcl) in [OSCP](https://openarcloud.github.io/sparcl/dictionary.html#oscp-mode) mode.

## Preparation

### Choose [GeoPose](/sparcl/dictionary.html#geopose) (localisation) service

To make it possible to precisely localize a device, the surrounding of location needs to be scanned, for example with tools from a visual positioning system (VPS), called GeoPose service in the context of OSCP. Currently there is only [Augmented City](https://www.augmented.city/) available for this, but support from [Immersal](https://immersal.com/) is very close, and support from [ARWAY](https://medium.com/arway/building-the-worlds-spatial-index-with-arwaykit-c97d40f31528) was announced recently. Hopefully others will soon join the family :)

### Scan and register area in [Spatial Service Discovery](/sparcl/dictionary.html#spatial-service-discovery-ssd) (SSD)

Use the tools provided from the selected service provider and scan the area of interest.

When the scan is successfully processed, the area covered by the scan needs to be added to the spatial service discovery (SSD) service. Ideally, this should be done by the service providers automatically, but it is currently not done yet. To make sure, please contact your selected service provider about it.

### Register content in [Spatial Content Discovery](/sparcl/dictionary.html#spatial-service-discovery-ssd) (SCD)

Content to be displayed in AR needs to be registered within a spatial content discovery (SCD) service. This includes a GeoPose and an URL to the actual content.

Again, [Augmented City](https://www.augmented.city/) is the only SCD available right now.
A special thing to note is that the AugmentedCity API allows to query the camera pose and the available contents around it in a single request, which is implemented in sparcl. This does not conform the original OSCP design but it spares one request and this joint request will likely be added to the OSCP specification soon.

## In sparcl

### Open the [dashboard](/sparcl/dictionary.html#dashboard) and make sure that AR Mode `OSCP` is selected

OSCP (full) mode is active by default. So when you never changed it, it should already be set.

### Tap button `Go Immersive`

This starts the WebXR immersive AR session.

### Move device slowly left and right until button `Localize` is shown

To give WebXR a chance to do the local localisation.

### Tap button `Localize` by pointing the camera towards a scanned space until localisation is successful

This starts the geo localisation using the selected GeoPose service. When unsuccessful, the button `Localize` is shown again.

### Look around and see your content

When all went well, your content placed around you should be visible through sparcl.

**Note**: The GeoPose we receive from Augmented City is cm-accurate in good maps, but it might be even a few meters off in lower-quality maps. The height of the camera is often estimated incorrectly if the local map is not properly registered with the world map.
