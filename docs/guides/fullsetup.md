---
layout: default
title: Full Setup
parent: Guides
nav_order: 1
---

# Full setup for [spARcl](https://openarcloud.github.io/sparcl/dictionary.html#sparcl) in [OSCP](https://openarcloud.github.io/sparcl/dictionary.html#oscp-mode) mode.

## Preparation
### Choose [GeoPose](/sparcl/dictionary.html#geopose) (localisation) service
To make it possible to precizely localize a device, the surrounding of the localizable location needs to be scanned, for example with tools from a visual positioning system (VPS), called GeoPose service in the context of OSCP. Currently there is only [Augmented City](https://www.augmented.city/) available for this, but support from [Immersal](https://immersal.com/) is very close, and support from [ARWAY](https://medium.com/arway/building-the-worlds-spatial-index-with-arwaykit-c97d40f31528) was announced recently. Hopefully others joyn in to grow the family :)

### Scan and register area in [Spatial Services Discovery](/sparcl/dictionary.html#spatial-service-discovery-ssd) (SSD)
Use the tools provided from the selected service provider and scan the area of interest. 


When the scan is successfully processed, the area covered by the scan needs to be added to the SSD. This should be done by the service providers automatically. But as far as I know, this isn't done, yet. To make sure, please contact your selected service provider about it.

### Register content in [Spatial Content Discovery](/sparcl/dictionary.html#spatial-service-discovery-ssd) (SCD)
Content to be displayed in AR needs to be registered with an SCD. This includes a GeoPose and an URL to the actual content.


Again, [Augmented City](https://www.augmented.city/) is the only SCD available right now.

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


**Note**: The GeoPose we receive from Augmented City isn't exactly as we need it to position the content at the exact location. They are aware of this and I'm sure working on fixing it.
