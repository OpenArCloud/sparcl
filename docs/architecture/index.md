---
layout: default
title: Architecture
has_children: true
nav_order: 2
---

# Overall Architecture of sparcl

Note that sparcl is a proof of concept and experimentation application, a reference client for the OSCP which is never meant to become a product. It is Web-based so that it can be used in a wide range of devices. To implement sparcl, the following main elements were chosen:

* [Svelte](https://svelte.dev/) Web app framework with [vite](https://vitejs.dev/).

* [WebXR](https://www.w3.org/TR/webxr/) AR-engine
Tests of the AR features of WebXR have been working very well for us already, so there was no question to go ahead using it for sparcl, even when the specs are still very experimental. Especially after we could make camera access work in some way (definitely needs improvement).

* [ogl](https://www.npmjs.com/package/ogl) 3D engine
OGL is a very small 3D engine on top of WebGL.

* [automerge](https://www.npmjs.com/package/automerge), [perge](https://www.npmjs.com/package/perge), [peerjs](https://www.npmjs.com/package/peerjs) for multi-user communicaton. Adding peer-to-peer communication was not as easy as expected, and the synchronisation between peers is not fully working yet. But the general functionality is there, for more information see the [respective guide](/sparcl/guides/multiuser).

* [geodesy](https://www.npmjs.com/package/geodesy)
Very helpful package for geodesic calculations.
