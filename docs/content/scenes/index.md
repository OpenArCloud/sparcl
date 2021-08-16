---
layout: default
title: Scenes
nav_order: 30
parent: Content
has_children: true
---

# WebGL scenes

sparcl can import 3D scenes created with 3D frameworks and game engines exported to WebGL. 
They are loaded into an iframe, placed on top of the WebXR canvas. 

An important factor for such scenes is how fast they load. This depends of course heavily 
on the file size of the assets used in the scene. But already the size of the selected engine
to create the scene has a big influence. 

## Game engines

| name          | base size   | version   | taken from                  |
|:--------------|:------------|:----------|:----------------------------|
|       Godot   |  17.6MB     |   3.3     |  [tutorial project](https://github.com/GDQuest/godot-3d-dodge-the-creeps/releases/tag/1.1.0)           |
|       Unity   |  21.6MB     |    ?      |  [WebGL export sample](https://de-panther.github.io/unity-webxr-export/Build/)        |
|      Unreal   |    ?        |   4.24    |  [Community project](https://github.com/UnrealEngineHTML5/Documentation)          |


## Frameworks

| name          | base size   | version   | taken from                  |
|:--------------|:------------|:----------|:----------------------------|
|     A-Frame   |  1.83MB*    |   1.2     |  [Build folder](https://github.com/aframevr/aframe/blob/master/dist/aframe-v1.2.0.min.js)               |
|   babylonjs   |   3.4MB     |   4.2     |  [Tutorial 2](https://doc.babylonjs.com/webpages/app2)                 |
|        p5js   |   794KB     |  v1.3.1   |  [Github tag](https://github.com/processing/p5.js/releases/tag/v1.3.1)                 |
|     threejs   |   597KB     |  r129     |  [Build folder](https://github.com/mrdoob/three.js/tree/dev/build)               |

* including threejs

## Online services

| name          | base size   | version   | taken from                  |
|:--------------|:------------|:----------|:----------------------------|
| CopperLicht   |    90KB     |  v1.15    |  Export from CopperCube     |
|  Playcanvas (no physics)   |   350KB     |   1.41.2  |  Export of Tutorial         |
|  Wonderland   |   1.3MB     |   0.8.4   |  Export from First Project  |
|      Zappar   |     5MB     |   0.3.6   |  Tutorial project           |




## Preparations
To make this work, only some simple preparations need to be made:
* the html containing it needs to have transparent backgrounds
* sending an event of type 'loaded' to sparcl
```javascript
// Sending a message to the parent window
window.parent.postMessage({type:"loaded"},"*");
```
* receiving an event of type 'pose' to receive the current camera position from sparcl
```javascript
// Receiving messages from the parent window
window.addEventListener("message", msg => {
    console.log(msg.data);
});
```

The pose sparcl sends to the scene is prepared like this. `experienceMatrix` represents the location and orientation of the scene in the WebXR canvas:
```javascript
const cameraMatrix = new Mat4();
cameraMatrix.copy(experienceMatrix).inverse().multiply(view.transform.matrix);

return {
    projection: view.projectionMatrix,
    camerapose: cameraMatrix
}
```

The complete flow between sparcl and the imported scene looks like this:
![image](https://user-images.githubusercontent.com/231274/116106498-727b3a00-a6b2-11eb-8367-615c423f7c31.png)

The lower part of the diagram above shows how an imported scene can send events to sparcl, and sparcl distributes them over a P2P network using automerge.

To make this work, the P2P network needs to be registered with the [service discovery](/sparcl/glossary.html#spatial-service-discovery-ssd), containing the peer ID of an headless client. When sparcl sees that an headless client is available, it connects to it and uses it to distributes the events received from the imported scene. To which events to listen to is announced to sparcl throught the [content record](https://openarcloud.github.io/sparcl/glossary.html#spatial-content-record-scr) of the imported scene.

This will be easy to understand with a sample. Please see the [guide](/sparcl/guides/multiuser.md) for more info. 


