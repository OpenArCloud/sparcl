---
layout: default
title: Integrating Experiments
parent: Architecture
nav_order: 20
---

# Integrating Experiments

The main goal of sparcl is, to serve as a proof of concept and as an experimentation platform around the AR Cloud in general, specifically the Open Spatial Computing Platform as defined by Open AR Cloud association. This document outlines how experiments can be integrated into sparcl. An important pre-requisite is, that the experiments source needs to be integrated into the sparcl project from a separate repository. This makes it possible that many developers can work on experiments, without stepping on each others toes.

There are several ways to do so and everyone is free to choose the way that fits best to their own way of working. The example here uses Git submodules.


## Provided files from sparcl
Experiments should be added to the folder `/src/experiments`. sparcl provides by default 2 files in this folder to help getting started quickly.

- **Readme**: General information around experiments and links to further information
- **'Empty' Selector component**: Complete select element to choose an experiment in the dashboard

The Selector is loaded by sparcl into the dashboard automatically. It is the main registration point for an experiment. In its provided form it contains all the HTML and (empty) data structures required:
- Provides the UI to select an experiment
- Dynamically loads the settings and viewer files for the experiment

There are many ways to implement the Selector. The provided implementation serves just as a sample to help getting started eaily. It provides a select html element to choose an experiment as an example. A list, radio boxes can also be used. 

To regiter an experiment with sparcl, and to make it selectable in the dashboard, just fill in key/value pairs into the object `EXPERIMENTTYPES` for your experiments. In the sample selector, these entries are then filled into the select element automatically.

```svelte
const EXPERIMENTTYPES = {
    // key: value
};
```

The important function the Selector serves is to dynamically load the settings component (when needed) and viewer implementation (as a ```Promise```) of the experiment. This functionality is provided by the functions `loadSettings` and `loadViewer`. 

The settings will then be automatically displayed right below the selector when the experiment is selected. The viewer implementation for the experiment is returned as a promise that will be resolved when the AR session is started. 


## Required files for experiment
There are 2 required files to implement for an experiment

- Settings
  - Defines the UI for the settings to be displayed in the dashboard
- Viewer
  - The entry point to your experiments code

### Settings
No special requirements need to be taken into account for the settings. Very basic component is sufficient. Currently it needs to be a Svelte component, changing this to be a web component is possible. There will be a separate guide on how to get the default styling of the dashboard applied.

![image](https://user-images.githubusercontent.com/231274/122668779-07357c00-d1ba-11eb-8d75-a24cbdff37a6.png)

As shown in the image above, sparcl provides a `settings` object where the selected settings can be stored. sparcl cares to persist them and provide them to your viewer implementation. All you need to do is to bind this `settings` object to the values of the form objects used.

### Viewer

The viewer file contains the main source for the experiment. When the AR session is started, the function `startAr()` is called. As parameters, sparcl's default implementations for XR and 3D engine are provided. Through them, the complete default functionality of sparcl is available to the experiment. Hopefully this makes it possible to implement the experiment quickly and easily. Viewer functionality as such is available through the imported base `Viewer` component. Its functions are available through the variable `parentInstance`.

While the default XR and 3D engine implementations are provided to the function, feel free to use any other frameworks. Like using Zappar instead to make sparcl work with phone without WebXR compatibility.

Below is kind of a 'hello world' implementation of the viewer. It is the source of the default mode of sparcl, which is completely implemented in the parent viewer. 

The lifecycle functions are:
- startAR()
  - Initialisation of the experiment implementation
- startSession()
  - Initialisation of WebXR, when used, respectively your own implementation for XR
- update()
  - animation loop call, use to update the 3D scene
- noPose();
  - WebXR hasn't found a valid pose for the device
- sessionEnded()
  - Use to release resources

![image](https://user-images.githubusercontent.com/231274/122675675-d154bf80-d1da-11eb-9eb0-e6975eb548bd.png)


When adding the `App/Viewer` component to the experiments viewer, the dom overlay implemented in the parent viewer is displayed. How to use this for an experiment will be introduced in an upcoming guide.
