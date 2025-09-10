---
layout: default
title: Content
nav_order: 20
has_children: true
---

# Details about the content types handled by sparcl

sparcl supports different content with different functionality and levels of difficulty to prepare.

The simplest content type are the **placeholders**. So called because the record in the content discovery doesn't link to an actual 3D object, but defines it. The actual 3D object is generated client side by sparcl.

The next step up in terms of visual quality are 3D models in **gltf** format. They loose interactivity, though.

Imported **3D scenes** can have any functionality possible with the 3D framework they're created, as long as it is possible within a sandboxed iframe element.
