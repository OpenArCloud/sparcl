/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/*
    Localizable (to different languages) storage for default content.
    Simple exports for now, will improve over time.
*/

import { readable } from 'svelte/store';

// Greets first time users with som background info about the app and its usage
export const introGreeting = readable('', (set) => {
    set('Welcome');
    return () => set('');
});

// Text shown on intro screen
export const intro = readable('', (set) => {
    set(`
        <div>Let's get started.</div>
    `);

    return () => set('');
});

// Title of overlay when user returns to start screen
export const outroGreeting = readable('', (set) => {
    set('Howdy');
    return () => set('');
});

// Text displayed when user returns to start screen
export const outro = readable('', (set) => {
    set(`How has it been? <br />Feel free to start again`);

    return () => set('');
});

// Title shown for repeat user on start screen
export const infoGreeting = readable('', (set) => {
    set('Welcome back');
    return () => set('');
});

// Text shown for repeat user on start screen
export const info = readable('', (set) => {
    set(`Glad to see you again`);
    return () => set('');
});

// Discovery services aren't available. Offering marker recognition instead for model placement
export const markerInfo = readable('', (set) => {
    set(`
        <h1>Marker info</h1>
        <p>Print marker to place model</p>
    `);
    return () => set('');
});

// Informs about unavailability of service coverage
export const unavailableInfo = readable('', (set) => {
    set(`
        No service coverage available in your current area.
        Open Dashboard to select developer or creator modes.
    `);
    return () => set('');
});

// Label for button to request location access
export const allowLocationLabel = readable('', (set) => {
    set('Allow location');
    return () => set('');
});

export const PageRefreshRequired= readable('', (set) => {
    set('please refresh the page afterwards')
    return () => set('');
})

// Title of location access request screen
export const locationaccessrequired = readable('', (set) => {
    set('Location access required.');
    return () => set('');
});

// Text of location access request when not granted
export const locationaccessinfo = readable('', (set) => {
    set('It is needed to define the <br/>initial area for localization.');
});

// Text of location access request when granted
export const locationaccessgranted = readable('', (set) => {
    set('Location access granted.');
    return () => set('');
});

// The device the app is running on is able to start an AR session
export const arOkMessage = readable('', (set) => {
    set(`<h4>AR is available</h4>`);
    return () => set('');
});

// The device the app is running on is unable to start an AR session with the given requirements
export const noArMessage = readable('', (set) => {
    set(`<h4>Sorry Dave, I can't do that.</h4>`);
    return () => set('');
});

// SSD didn't return any services
export const noservicesavailable = readable('', (set) => {
    set('No services available');
    return () => set('');
});

// OK-button label of the overlay / dialog
export const startedOkLabel = readable('', (set) => {
    set(`Let's get started`);
    return () => set('');
});

// OK-Button label for the outro overlay
export const doitOkLabel = readable('', (set) => {
    set(`Let's do it`);
    return () => set('');
});

// OK-Button label of the overlay to close it and display the dashboard
export const dashboardOkLabel = readable('', (set) => {
    set('Goto Dashboard');
    return () => set('');
});

// Button label in DOM-overlay to start localization
export const localizeLabel = readable('', (set) => {
    set('Localize');
    return () => set('');
});

// Button label in DOM-overlay for relocalization
export const resetLabel = readable('', (set) => {
    set('Reset');
    return () => set('');
});

// Message shown when AR session is started in mode 'oscp' to help device to localize locally
export const movePhoneMessage = readable('', (set) => {
    set('Move phone slowly left and right');
    return () => set('');
});

// Message shown when AR session is started in mode 'oscp' and global localization can be started
export const localizeMessage = readable('', (set) => {
    set('Press button to find your exact position');
    return () => set('');
});

// Message shown when AR session is started in mode 'oscp' during global localisation
export const isLocalizingMessage = readable('', (set) => {
    set(`localizing`);
    return () => set('');
});

// Message shown when AR session is started in mode 'oscp' and global localization was successful
export const isLocalizedMessage = readable('', (set) => {
    set(`successfully localized`);
    return () => set('');
});

// Message shown when AR session is started in mode 'marker' to ask user to point the device toward the marker
export const pointMarkerMessage = readable('', (set) => {
    set(`Point camera to marker for localisation.`);
});

// Texts for Multiplayers username and color screen
export const playerScreenTitle = readable('', (set) => {
    set(` User details `);
    return () => set('');
});
