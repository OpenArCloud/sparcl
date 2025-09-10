---
layout: default
title: External scene import
parent: Architecture
nav_order: 10
---

# Loading 3D scenes into sparcl

OSCP client applications enable users to browse and engage with AR content attached to geographic locations around them. Such content is indexed and addressed within the Spatial Content Discovery (SCD) service.

One of the content types available to use with sparcl is to load a 3D scene created with game engines like Unity or with 3D frameworks like threejs. There are several ways to implement this.

Spoiler: sparcl implements loading of external scenes with an iframe.

## Link Out

For what is perhaps the simplest solution, the SCD contains a URL to a web page or mobile app that provides the AR experience. When users tap on a placeholder 3D element within the client application they are redirected to the URL in their browser to engage with the AR experience, or to install the necessary app.

### Pros

Simple solution to implement within OSCP client applications
AR content built with any existing AR tool should be supported
The content experience is responsible for all 3D rendering and interactivity, resulting in the highest level of flexibility
All existing web APIs are available for use by content experiences, as are emerging APIs as they're supported by web browsers
Existing content development environments and ecosystems that target the web can be leveraged
Operating systems and browsers provide strong process isolation mechanisms for web sites and apps such that content experiences are fully isolated from each other and the client application

### Cons

Users leave the client application when they launch the content and must find their own way back should they wish to return
Once a user has left the client application any AR session within it may be lost
Users will have to separately grant camera and device motion access permissions to each content experience
Content experiences must perform their own localisation and tracking, and a mechanism for the client application to communicate the content's origin in 3D space must be defined

## Embedded Content Platform

With this solution, OSCP client applications provide a runtime environment for content directly within the application. This may be as simple as supporting a set of 3D model formats, or may involve the definition of a broader content platform. The content record served from the SCD service contains already all the necessary data, or a URL pointing to content, for example a WebGL export from Unity.

### Pros

Users remain within the client application while engaging with AR content
AR session is maintained between content experiences and client application
The client application handles localisation and tracking on behalf of the content
Users only have to provide camera and device motion access permissions once

### Cons

Content possibilities are limited to the constraints of the content platform defined and implemented by client applications. As an example, content must use the 3D lighting model provided by the client application, unless the platform allows content developers to specify a full shader pipeline.
To support scripted or stateful/interactive content, the platform must define and provide a code execution environment, and must implement a sandbox to isolate content experiences from each other and the client application. This is non-trivial without cooperation from the underlying operating system or web browser.
A data-only content platform (i.e. without scripting or code execution) is potentially vulnerable to any exploits within its asset loading libraries
Special exporters from 3D platforms like Unity and Unreal are necessary to free content creators from manual adaptations to the loading scripts.

## Isolated Frame

With this solution, content experiences are web pages that are referenced from the SCD service by URL. To present a given experience to a user, a client application loads the web page within a transparent frame (e.g. an iframe for web client applications, WKWebView for iOS native clients, or WebView for Android native clients) and displays that frame over the camera background. At 30 FPS (or higher), the client application sends camera projection and 3D pose matrices for the current tracked origin where the content should appear into the content experience via a message passing channel. Content experiences apply that data to whichever 3D platform / camera abstraction they choose to use.

In some ways this is a combination of the two other alternatives. As with an embedded platform approach, the user stays within the client application; however like the link out option, the web is leveraged as the underlying runtime environment for content. This proposal therefore defines a communication channel (to message data into and out of content experiences) rather than a new runtime environment itself.

### Pros

Users remain within the client application while engaging with AR content and thus AR sessions are maintained between content experiences and client applications
The client application handles localisation and tracking on behalf of content
Users only have to provide camera and device motion access permissions once
The content experience is responsible for all 3D rendering (with the exception of the camera) and interactivity, resulting in a high level of flexibility
All existing web APIs are available for use by content experiences, as are emerging APIs as they're supported by the web browser.
Operating systems and browsers provide strong process isolation mechanisms for frames such that content experiences are fully isolated from each other and the client application
Existing content development environments and ecosystems that target the web can be leveraged
Content experiences can use normal HTML/CSS for additional UI should they wish to

### Cons

Message passing channels are asynchronous so there may be latency/lag between the camera image and the content. There may be ways to mitigate this.
Since the client application is still responsible for rendering the camera, experiences that apply effects to the camera image itself are not possible
Plugins or libraries for the 3D platforms leveraged by content experiences are necessary in order to listen for projection/pose messages and apply those to the platform's camera abstraction. It may be possible to implement this as a WebXR polyfill.
