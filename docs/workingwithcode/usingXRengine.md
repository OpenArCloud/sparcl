---
layout: default
title: Using the XR engine
parent: Working with code
nav_order: 50
---

# Using the default XR engine

sparcl is currently built around the WebXR `immersive-ar` module. As this specification is still under development, sparcl can't currently be used for an end user facing application.

This is why we aim to keep WebXR specific code separate from the main code. The `Viewer` acts like a controller to make this work. A fallback XR engine for devices not supporting WebXR is already in sight. Work on this might start sooner or later.

So far, the separation is there, but there is no specific 'API' between the `Viewer` and an XR engine. This will likely be worked on when the fallback XR engine is available.

When you try this feature and run into problems, feel free to let us know.

As always, please share you feedback with us. Pull requests are more than welcome.

It is worth noting that WebXR requires a WebGL context with XR support (`WebGL2RenderingContext` with flag `{xrCompatible: true}`). As neither OGL nor ThreeJS uses this flag by default, we need to first create such a context ourselves (see `xrEngine._initSession()`). After this, we configure any custom callbacks on the XR session (`setXrCallbacks`). Next, we need to initialize the RenderingEngine and attach to the previously created context and resize the buffers (`tdEngine.init()` and `tdEngine.resize()`). Finally, we need to create an `XRWebGLLayer` with the already resized buffers and start the XR rendering loop with `requestAnimationFrame` in `xrEngine.startXrRenderLoop()`.
