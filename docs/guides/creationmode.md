---
layout: default
title: Content Creation Mode
parent: Guides
nav_order: 2
---


# Setup needed to use the Creation mode to simplify usage of spARcl for content creation

As already explained, sparcl uses a lot of online services to do its job. This makes it very powerful, but needs many bits and pieces to be set up correctly. While this problem will go away when OSCP services are utilized more widely in the future, it makes it hard to use sparcl quickly if no services have been defined yet in your location.

To mitigate this, a special usage mode was introduced - the `content creation` mode. It ignores all the discovery and localisation services and allows to access content directly by URL. The main use of this mode is content creation, to make it very easy to see content you are currently authoring in AR without any complex setup.

Setting up the creator mode looks like this:

### Open the dashboard
![image](https://user-images.githubusercontent.com/231274/115959182-440f2a80-a50b-11eb-82ea-65e6521b6c84.png)

### Select Content creation mode
![image](https://user-images.githubusercontent.com/231274/115960840-e8956a80-a513-11eb-8efc-6eefe8d0fc0d.png)

### Select the content type and enter the URL to the content when necessary
![image](https://user-images.githubusercontent.com/231274/115960806-bdab1680-a513-11eb-8027-498b79159a19.png)

**Placeholder**: This places generated content in the scene. In the future it will be possible to add styling to this content. For now, GLSL shaders used for a placeholder can be tested

**Model**: Allow to place a 3D model in gltf or glb format

**Scene**: Loads a scene created in all kinds of game engine and 3D platforms into sparcl

The URL to enter for Model and Scene will likely look something like this:

https://192.168.x.x:port/folder/file.name


### Start a local https server on your computer to give sparcl access to your content
The absolutely easiest way we found to set up a server on your computer is called [Servez](https://greggman.github.io/servez/). No setup needed at all. [Zappar CLI](https://docs.zap.works/universal-ar/zapworks-cli/) is another option, usable from the command line. But feel free to use any server you are comfortable with. The important detail is that you need to serve over HTTPS and set CORS headers.

### Set the root directory of the server to the folder you saved your content in

Example settings:
![image](https://user-images.githubusercontent.com/231274/121038150-576f1000-c7b0-11eb-8440-c131db5397f2.png)


### Allow self-signed certificates on local network

The final step is to allow Chrome to load content over HTTPS request from server using a self-signed certificate. For this. open the [Chrome experiments page](chrome://flags/#allow-insecure-localhost) and enable allow insecure localhost.

Now, make sure your computer and your phone are connected to the same network, and enter the IP address of your computer in the Chrome browser.

Make sure that you have 'WebXR incubation' features [activated in Chrome](https://www.howtogeek.com/703039/how-to-enable-google-chrome-flags-to-test-beta-features/).
