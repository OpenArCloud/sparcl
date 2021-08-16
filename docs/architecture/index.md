---
layout: default
title: Architecture
has_children: true
nav_order: 2
---

# Overall Architecture of sparcl 

The inspiration for the architecture of sparcl came from an article titled [`A web application with no web server?`](https://medium.com/all-the-things/a-web-application-with-no-web-server-61000a6aed8f#e135) by [Ink & Switch](https://www.inkandswitch.com/). Fits perfectly to an app like sparcl. 

To implement it, the following main elements were chosen:
* [Svelte](https://svelte.dev/) with [snowpack](https://www.snowpack.dev/) for development, with [rollup](https://rollupjs.org/guide/en/) for deployment (tbd)
Svete is a dream to work with, and the combination with snowpack for development makes it clearly unbeatble for Javascript client side application development. The combination is very new, so there are some features incomplete, but nothing that hinders the development process. 

  Until the snowpack bundler is done, rollup is the most likely one to be used in the meantime.

* WebXR ar-module
Tests of the AR features of WebXR have been working very well for us already, so there was no question to go ahead using it for sparcl, even when the specs are still very experimental (they say). Especially after we could make camera access work in some way (definitely needs improvement).

  sparcl being a proof of concept and experimentation platform, not meant to become a product, helped with this decision, of course.

* [ogl](https://www.npmjs.com/package/ogl) 3D engine
I spent a lot of time to find a suitable 3D engine, and ogl is the one we ended up using. It is small, still manages to turn WebGL into something quite usable.

* [automerge](https://www.npmjs.com/package/automerge), [perge](https://www.npmjs.com/package/perge), [peerjs](https://www.npmjs.com/package/peerjs)
Reading about AR Cloud, it's written everywhere that multi user is important. Seeing in the article above how easy it seems to be to implement this feature, it had to be in sparcl. 

  It wasn't as easy as it seemed, and the synchronisation between peers isn't working fully, yet. But the general functionality is there and is amazing. See the [respective guide](/sparcl/guides/multiuser) for set up info.

* [geodesy](https://www.npmjs.com/package/geodesy)
Very helpful for geodesic calculations.
