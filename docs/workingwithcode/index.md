---
layout: default
title: Working with code
nav_order: 30
has_children: true
---

# Working with the source code of spARcl

Contributions to sparcl are very welcome. Getting started to do so might look pretty difficult to do, as there are so many dependencies and concepts combined. Experiment mode might be the easy way in, at least when the template is set up correctly (not done, yet). The [full explanation](https://openarcloud.github.io/sparcl/workingwithcode/createexperiment.html) of the experiment setup looks difficult, but it is much easier to do than write, I think. If not, please let us know what's too difficult to do.

What makes experiment mode useful is that all the main functionality of sparcl is easily available, so you can concentrate on your code and don't need to care about the nitty gritty detail of XR and 3D engines - at least this is what we're aiming for. The default modes are implemented using the same mechanics, so experiment mode is a regular part of the application.


![image](https://user-images.githubusercontent.com/231274/124287222-102a3400-db50-11eb-9347-541f5820101b.png)

Right now [WebXR](https://www.w3.org/TR/webxr/) is used as the XR engine, but it should be easy to replace it. A potential use case could be, that WebXR is used where available, and another XR engine is used as a fallback where WebXR isn't available - like iOS right now. This would extend the usability of sparcl enormously, in case someone wants to use it for a end user facing experience. More info in ['Using the XR engine'](https://openarcloud.github.io/sparcl/workingwithcode/usingXRengine.html).


![image](https://user-images.githubusercontent.com/231274/124287057-e1ac5900-db4f-11eb-812b-31d846ad2b14.png)

The 3D engine in use right now is [OGL](https://github.com/oframe/ogl), because it is very lightweight but covers the naugty details of WebGL very well. As it's the case with WebXR, we aim to make OGL easily replaceable so we can react on new requirements easily or you can just use the engine you're comfortable with. More info in ['Using the 3D engine'](https://openarcloud.github.io/sparcl/workingwithcode/use3dengine.html).
