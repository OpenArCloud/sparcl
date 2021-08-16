---
layout: default
title: Development Mode
parent: Guides
nav_order: 3
---

# Setup needed to use the development mode to simplify usage of spARcl during development

During development it can become pretty annoying when relocalisation of the device is needed after every reload of the app. While it's fast over Wifi, but it's a repitive task taht gets boring fast. The need to use the tools of the discovery services in use definitely kills the development flow.

The development mode gets rid of both requirements. As there is no localisation done, content is automatically placed around the first pose reported from WebXR.

Setup is pretty easy:

### Open Dashboard with a tap at the top right corner of the screen (there will be a more obvious way to do so in the future)
![image](https://user-images.githubusercontent.com/231274/115959182-440f2a80-a50b-11eb-82ea-65e6521b6c84.png)

### Find setting for `ARMode` in `Application state` and select `Development`
![image](https://user-images.githubusercontent.com/231274/115959287-c566bd00-a50b-11eb-883d-ac5910516de6.png)

### Setup Chrome remote debugging
I use [port forwarding](https://developer.chrome.com/docs/devtools/remote-debugging/local-server/) found in the [chrome inspect](https://developer.chrome.com/docs/devtools/remote-debugging/) page using localhost URLs over http. This has the advantages that no certificates are needed, and all features that regularily need secure context can be used without problems.


That's it.

The content record that is used in this mode can be found in the source file `src/core/locationTools.js`. The constant to look for is `fakeLocationResult`.

The format of the content record is defined in the OSCP [Spatial Content Discovery repository](https://github.com/OpenArCloud/oscp-spatial-content-discovery).

Happy coding :)
