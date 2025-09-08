---
layout: default
title: UI during AR session
parent: Working with code
nav_order: 40
---

# Display UI elements during AR session

There are two types of UI elements that can be used for AR experiences - 2D and 3D. 2D UI is usually more convenient for mobile AR scenarios, while 3D UI is more appropriate when AR glasses are used. As none of the sparcl contributors has AR glasses available yet (and it is not clear if any AR glasses available today would be able to run sparcl), there was no work done on 3D UI so far. As soon as there are AR glasses available that can run sparcl in some way, we will definitely be working on ideas for 3D UI.

2D UI has its own implications, as an active WebXR AR session always paints on top of everything else on the page. To make 2D UI possible, a so called [DOM-overlay](https://github.com/immersive-web/dom-overlays/blob/master/explainer.md) needs to be used. This allows to specifiy a container element at AR session initialisation whose contents are overlayed on top of the AR display.

Such a DOM-overlay is very easy to use, for exampe by extending the default `Viewer` implementation through composition, following the steps described below.

## Import the default Viewer

The default `Viewer` needs to be imported:

```
import Parent from '@components/Viewer';
```

## Require DOM-overlay feature

When initializing the XR session, the DOM-overlay feature needs to be requested - either as required or optional. This is done by calling the function `startSession()` of the parent. sparcl provides and registers the overlay container.

```svelte
function startSession() {
    parentInstance.startSession(onXrFrameUpdate, onXrSessionEnded, onXrNoPose,
        () => {},
        ['dom-overlay', ...]
    );
}
```

## Define the UI

sparcl uses [svelte]() https://svelte.dev/ to make development much easier than with plain Javascript, and to get away from the intricacies of other Javascript frameworks. Layout compositing features of svelte allows to use the default `Viewer` as an HTML base, and add your own HTML layout inside of it. To use it, add this at the bottom of your `Viewer` source file:

```svelte
<svelte:fragment slot="overlay" ...>
  <p>Space for your UI elements</p>
</svelte:fragment>
```

The important part above is the `slot="overlay"` attribute. It defines where the content of the `svelte:fragment` should be inserted in. Right now, `overlay` is the only slot available, but there might be more available in the future.

## Display the UI

The default `Viewer` needs to know when you want to show or hide the UI defined above. To do so, you need to define a context where the default `Viewer` can store its state. This is done as follows somewhere at the start of the script:

```svelte
import { setContext } from 'svelte';
import { writable } from 'svelte/store';

let parentState = writable();
setContext('state', parentState);
```

[writable](https://svelte.dev/tutorial/writable-stores) is a so called Svelte store, a simple writable state container, and setContext()](https://svelte.dev/tutorial/context-api) sets the container for state that is made available to all children of the parent where the context was defined.

With this done, show/hide the overlay like this:

```
$parentState.showFooter = <true/false>;
```

## Done

This should get you started easily. What is missing? A list of the complete context made available by the default `Viewer` and the variables made available by the `svelte:fragment`? Yes, this will be shared in another document (TBD).

As always, please share you feedback with us. Pull requests are more than welcome.
