/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

/*
    Store for application state
*/


import { readable, writable, derived } from 'svelte/store';

import { LOCATIONINFO, SERVICE, ARMODES } from "./core/common.js";


/**
 * Determines the availability of AR functions on the current device.
 *
 * @type {Readable<boolean>}    true when available, false otherwise
 */
export const arIsAvailable = readable(false, (set) => {
    if (navigator.xr !== undefined) {
        navigator.xr.isSessionSupported("immersive-ar")
            .then((result) => set(result));
    }

    return () => set(false);
});


/**
 * Reads and stores the setting whether or not to display the dashboard persistently.
 *
 * @type {boolean}  true when dashboard should be shown, false otherwise
 */
const storedShowDashboard = localStorage.getItem('showdashboard') === 'true';
export const showDashboard = writable(storedShowDashboard);
showDashboard.subscribe(value => {
    localStorage.setItem('showdashboard', value === true ? 'true' : 'false');
});


/**
 * Reads and stores the setting whether or not the user has already seen the intro.
 *
 * @type {boolean}  true when the intro was already seen, false otherwise
 */
const storedHasIntroSeen = localStorage.getItem('hasintroseen') === 'true';
export const hasIntroSeen = writable(storedHasIntroSeen);
hasIntroSeen.subscribe(value => {
    localStorage.setItem('hasintroseen', value === true ? 'true' : 'false');
})


/**
 * Reads and stores the setting which AR mode should be used.
 *
 * @type {string}
 */
const storedArMode = localStorage.getItem('storedarmode');
export const arMode = writable(storedArMode || ARMODES.auto);
arMode.subscribe(value => {
    localStorage.setItem('storedarmode', value);
})


/**
 * The rough location of the device when the application was started.
 *
 * @type {Writable<LOCATIONINFO>}
 */
export const initialLocation = writable({
    h3Index: 0,
    lat: 0,
    lon: 0,
    countryCode: '',
    regionCode: ''
});


/**
 * Currently valid ssr record, containing the last requested spatial services record.
 *
 * @type {Writable<{SSR[]}>}
 */
export const ssr = writable([]);


/**
 * Derived store of the ssr store for easy access of all contained GeoPose services.
 *
 * @type {Readable<SERVICE[]>}
 */
export const availableGeoPoseServices = derived(ssr, ($ssr, set) => {
    let geoposeServices = [];
    for (let record of $ssr) {
        geoposeServices.concat(record.services
            .forEach(service => {
                if(service.type === 'geopose')
                    geoposeServices.push(service);
            }));
    }
    set(geoposeServices);
}, []);


/**
 * Derived store of ssr store for easy access of all contained content services.
 *
 * @type {Readable<SERVICE[]>}
 */
export const availableContentServices = derived(ssr, ($ssr, set) => {
    let contentServices = [];
    for (let record of $ssr) {
        contentServices.concat(record.services
            .forEach(service => {
                if (service.type === 'content-discovery')
                    contentServices.push(service);
            }));
    }
    set(contentServices);
}, []);


/**
 * Derived store of ssr store for easy access of all contained p2pmaster services.
 *
 * @type {Readable<SERVICE[]>}
 */
export const availableP2pServices = derived(ssr, ($ssr, set) => {
    let p2pServices = [];
    for (let record of $ssr) {
        p2pServices.concat(record.services
            .forEach(service => {
                if (service.type === 'p2p-master')
                    p2pServices.push(service);
            }));
    }
    set(p2pServices);
}, []);


/**
 * The one of the returned GeoPose service to be used for localisation.
 *
 * @type {Writable<SERVICE>}
 */
export const selectedGeoPoseService = writable('none');


export const recentLocalisation = writable({
    geopose: {},
    floorpose: {}
})



/**
 * The one of the returned content services to be used to look for content around the current location.
 *
 * @type {Writable<SERVICE>}
 */
export const selectedContentService = writable('none');


/**
 * The one of the returned p2p services to be used to set up a local peer to peer network.
 *
 * @type {Writable<SERVICE>}
 */
export const selectedP2pService = writable('none');


/**
 * The marker image file to use for marker mode.
 *
 * @type {Writable<string>}
 */
export const currentMarkerImage = writable('marker.jpg');


/**
 * The width of the marker image in meters.
 *
 * @type {Writable<string>}
 */
export const currentMarkerImageWidth = writable('0.2');


/**
 * Defines whether or not p2p network connection is allowed by the user.
 *
 * @type {Writable<boolean>}
 */
const storedAllowP2pNetwork = localStorage.getItem('allowP2pNetwork') === 'true';
export const allowP2pNetwork = writable(storedAllowP2pNetwork);
allowP2pNetwork.subscribe(value => {
    localStorage.setItem('allowP2pNetwork', value === true ? 'true' : 'false');
})


/**
 * The current state of the peer to peer network connection.
 *
 * @type {Writable<string>}
 */
export const p2pNetworkState = writable('none');




/**
 * Appends the captured image used for localisation to the body an an image element.
 *
 * @type {Writable<boolean>}
 */
const storedDebug_appendCameraImage = localStorage.getItem('debug_appendCameraImage') === 'true';
export const debug_appendCameraImage = writable(storedDebug_appendCameraImage);
debug_appendCameraImage.subscribe(value => {
    localStorage.setItem('debug_appendCameraImage', value === true ? 'true' : 'false');
})

/**
 * Display axis markers for the local coordinate system.
 *
 * @type {Writable<boolean>}
 */
const storedDebug_showLocationAxis = localStorage.getItem('debug_showLocationAxis') === 'true';
export const debug_showLocationAxis = writable(storedDebug_showLocationAxis);
debug_showLocationAxis.subscribe(value => {
    localStorage.setItem('debug_showLocationAxis', value === true ? 'true' : 'false');
})

/**
 * Use locally stored server response instead requesting it from the server.
 *
 * @type {Writable<boolean>}
 */
const storedDebug_useLocalServerResponse = localStorage.getItem('debug_useLocalServerResponse') === 'true';
export const debug_useLocalServerResponse = writable(storedDebug_useLocalServerResponse);
debug_useLocalServerResponse.subscribe(value => {
    localStorage.setItem('debug_useLocalServerResponse', value === true ? 'true' : 'false');
})
