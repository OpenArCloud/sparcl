---
layout: default
title: Creating an experiment
parent: Working with code
nav_order: 30
---

# Setting up a new experiment

The main aim of sparcl is to consume content from the AR Cloud. To make this as easy and enjoyable as possible for the end user is clearly the highest priority for the development process of sparcl.

One important requirement for this is, to make sure the content received from an AR Cloud provider is displayed correctly, and it can be used as intendet. For this, sparcl offers separate modes to help with content creation and development. While we think that these modes are quite useful as they are, because they take away any dependency on a correctly set up server configuration, they might be somewhat inflexible for some requirements.

This is why sparcl also offers the possibility to write experiments, which remove any restrictions. The developer can use the functionality sparcl offers or create something completely new, even replacing the XR or 3D engine.

This guide wants to get you started quickly with a new experiment. Feel free to have a look at the [description of the architecture](https://openarcloud.github.io/sparcl/architecture/experiments.html) behind this functionality.

## Quick steps

- Fork [sparcl](https://github.com/OpenArCloud/sparcl) and clone it
- Create repository for experiment and add it as a submodule to the clone above
- [Register](https://openarcloud.github.io/sparcl/guides/createexperiment.html#register-the-experiment) the experiment
- [Create](https://openarcloud.github.io/sparcl/guides/createexperiment.html#add-settings-and-viewer-component-files) `Settings` (when needed) and `Viewer` source files
- [Provide](https://openarcloud.github.io/sparcl/guides/createexperiment.html#provide-settings) `Settings` HTML
- [Implement](https://openarcloud.github.io/sparcl/guides/createexperiment.html#implement-the-viewer) the `Viewer`

## Create and add the submodule of the experiment

Source code of an experiment has to come from a separate repository. [Git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) look like a perfect fit for this requirement. While they seem to have a bit of a negative reputation in the community, the positives outweight the negatives in the way we're using them here. Maybe the article ['Working with submodules'](https://github.blog/2016-02-01-working-with-submodules/) helps to get comfortable with them.

- Create a fork of sparcl's repository and clone it (replace `<user>` with your Git username)

    `git clone https://github.com/<user>/sparcl`

- Create a new repository for your experiment
- Open a terminal with the path set to sparcl's project folder and add the submodule

    `git submodule add https://github.com/<user>/<repository> src/experiments/<shorthand>`

Let's use 'oarc', 'sparcl_experiment' and 'arc' as values for this guide:

    `git submodule add https://github.com/oarc/sparcl_experiments src/experiments/arc`

This creates the submodule in the folder `/src/experiments/arc`. This is the folder where the experiments can be implemented. Feel free to choose any unique shorthand for your submodule. That way you can also add experiment submodules from others.

The submodule command creates 2 new files: .gitmodules and a file representing your experiment repository. Feel free to save these files to your fork if you wish. But these files should not be pushed to the original sparcl repository.

## Register the experiment

The experiment to run is selected in the [Dashboard](https://openarcloud.github.io/sparcl/glossary.html#dashboard). sparcl comes with `/src/experiments/Selector.svelte`, an example component for the dashboard to choose an experiment using a select HTML element. You're free to change this file in any way you wish, as long as `Promises` of svelte components are sent back to the dashboard.

When using the provided `Selector.svelte`, add your experiment to the `EXPERIMENTTYPES` object. Let's say the name of the new experiment is 'Particle':

```svelte
const EXPERIMENTTYPES = {
    // TODO: Enter a key/value pairs for experiments.
    particle: 'Particle'
};
```

When opening the dashboard, the experiment entry is displayed when selecting AR mode `Experiment`

![image](https://user-images.githubusercontent.com/231274/122954595-ddc64d00-d37f-11eb-9c5f-7cd7cc9bc549.png)

## Add `Settings` and `Viewer` component files

The next step is to define settings for the experiment. The Javascript framework used for sparcl is [svelte](https://svelte.dev/). While there is an intention to use plain Web Components in sparcl in the future for components like this, for now a svelte component is needed to define the settings. This file needs to be added to `src/experiments/<shorthand>/<experimentid>`. With the value of 'arc' for `<shorthand>` and 'particle' for the `<experimentid>`, the full path for the file looks like this:

    `/src/experiments/arc/particle/Settings.svelte`

This is a good time to also create the `Viewer` component, which provides the entrypoint into the experiment. It can extend the functionality of the built in `Viewer` component of sparcl through composition. More info about this. For now, just create this file:

     `/src/experiments/arc/particle/Viewer.svelte`

This should be the resulting file structure:

![image](https://user-images.githubusercontent.com/231274/123080645-719a2680-d41d-11eb-82fb-c6347d1e628b.png)

These files are loaded dynamically into sparcl by the function `importExperiment()` in the `Selector`. Unfortunately, the links to the files need to be string literals, which means the links need to be added manually to this function.

When using the provided `Selector`, this is done by adding a case statement like this to the function `importExperiment()` (replace all the placeholders with the values of your actual experiment):

```svelte
case <experimentkey>:
    // TODO: Enter the paths to the experiment entry points
    // The urls have to be a string literals
    settings = import('@experiments/<subroot>/<experimentname>/Settings');
    viewer = import('@experiments/<subroot>/<experimentname>/Viewer');
    break;
```

With the values for the placeholders as defined above, this results in this line for the `Viewer` for example:

    viewer = import('@experiments/arc/particle/Viewer');

When no settings are needed, the respective line for settings above isn't required.

## Provide settings

A simple settings component could look like this for example:

![image](https://user-images.githubusercontent.com/231274/123107439-d794a700-d439-11eb-9cd0-64a0a66bbd7c.png)

sparcl handles the actual settings automatically. To take advantage of this, the settings component can receive the settings for the specific experiment simply by exporting a field called settings and binding it to the form elements. As a bonus, feel free to define defaults for your settings.

```
<script>
    export let settings;

    if (Object.keys(settings).length === 0) {
        settings.lifetime = '500';
        settings.translucent = false;
    }
</script>

<dl class="radio">
    <dt>Lifetime</dt>
    <dd>
        <input id="lt5" type="radio" bind:group={settings.lifetime} value="500" />
        <label for="lt5">500ms</label>
    </dd>
    <dd>
        <input id="lt10" type="radio" bind:group={settings.lifetime} value="1000" />
        <label for="lt10">1000ms</label>
    </dd>

    <dt>
        <input id="translucent" type="checkbox" bind:checked={settings.translucent} />
        <label for="translucent">Translucent</label>
    </dt>
</dl>
```

Changes are persisted automatically. No need for a save button.

The structure of the HTML snippet above mirrors the structure of the dashboard and uses the styles defined there. But you're free to structure the HTML as you wish.

## Implement the viewer

The central part of the experiment is the `Viewer`. As with the `Settings` this needs to be a svelte component for now. The intention to allow it to be implemented as a standard Web Component exists.

Other than that, you're free to implement the `Viewer` in any way it's necessary for your experiment. You can take the [implementations for the default AR modes](src/components/viewer-implementations) as guides if you wish.

The base `Viewer` implementation from sparcl can be extented though composition

        import Parent from '@components/Viewer';
        <Parent bind:this={parentInstance} on:arSessionEnded />


When doing so, the lifecycle functions of the component and their minimal implementation looks like this:

- Entry point

          export function startAr(thisWebxr, this3dEngine, options) {
              parentInstance.startAr(thisWebxr, this3dEngine);

              // Add initialisation code for your implementation here

              // Store the 3D and XR engines locally when you want to use them for this experiment
              xrEngine = thisWebxr;
              tdEngine = this3dEngine;

              // To access the settings as defined in the Dashboard
              settings = options?.settings || {};

              startSession();
          }

- AR session startup

          function startSession() {
              parentInstance.startSession(<xrFrameUpdateCallback>, xrSessionEndedCallback, xrNoposeCallback,
                  setupFunction(),
                  [<requiredfeatures>],
                  [<optionalfeatures>]
              );
          }

- Animation loop

          function onXrFrameUpdate(time, frame, floorPose) {
              // Update your 3D models according the pose provided in the frame
          }

- No pose available handling

          function onXrNoPose(time, frame, floorPose) {
              // Use to inform user that the XR implementation couldn't determin a pose
          }

- AR session end

          function onXrSessionEnded() {
              // Free all the resources created before

              parentInstance.onXrSessionEnded();
          }

### State

When using the base `Viewer` it might be helpful to have access to some state. This is made avalable as svelte context. When adding the lines below to your `Viewer`, the context will be populated by some parent state.

```svelte
import { setContext } from 'svelte';
import { writable } from 'svelte/store';

let parentState = writable();
setContext('state', parentState);
```

For now, these states are added:

- showFooter
    - Boolean, show / hide the overlay
- isLocalisationDone
    - Boolean, was localisation done
- isLocalized
    - Boolean, localisation was done successfully when true
- isLocalizing
    - Boolean, localisation is in progress when true

## Finally

Following the steps above should give you an empty experiment to get you started.

The next steps would be to understand what features of the default 3D, XR engine and the overlay can be used. For now the implementations of the provided AR modes in `src/components/viewer-implementations` help to give you an idea. Propper guides will follow.
