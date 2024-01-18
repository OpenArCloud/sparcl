/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/*
    Store for application state
*/

import { readable, writable, derived, get } from 'svelte/store';

import { LOCATIONINFO, SERVICE, ARMODES, CREATIONTYPES, PLACEHOLDERSHAPES } from './core/common.js';
import type { SSR, Service } from '@oarc/ssd-access';
import type { Geopose, SCR } from '@oarc/scd-access';

/**
 * Determines the availability of AR functions on the current device.
 *
 * @type {Readable<boolean>}    true when available, false otherwise
 */
export const arIsAvailable = readable(false, (set) => {
    if (navigator.xr !== undefined) {
        navigator.xr.isSessionSupported('immersive-ar').then((result) => set(result));
    }

    return () => set(false);
});

/**
 * Determines and keeps track of the state of the location permission.
 */
export const isLocationAccessAllowed = readable<boolean>(false, (set) => {
    let currentResult: PermissionStatus;
    const stateResult = (state: string) => state === 'granted';

    // NOTE: navigator.permissions is undefined on iOS
    if (navigator == undefined || navigator.permissions == undefined) {
        return () => set(false);
    }

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        currentResult = result;

        set(stateResult(result.state));
        result.onchange = () => set(stateResult(result.state));
    });

    return () => {
        if (currentResult) {
            currentResult.onchange = null;
        }
    };
});

/**
 * Reads and stores the setting whether or not to display the dashboard persistently.
 * true when dashboard should be shown, false otherwise
 */
const storedShowDashboard = localStorage.getItem('showdashboard') === 'true';
export const showDashboard = writable(storedShowDashboard);
showDashboard.subscribe((value) => {
    localStorage.setItem('showdashboard', value === true ? 'true' : 'false');
});

/**
 * Reads and stores the setting whether or not the user has already seen the intro.
 * true when the intro was already seen, false otherwise
 */
const storedHasIntroSeen = localStorage.getItem('hasintroseen') === 'true';
export const hasIntroSeen = writable(storedHasIntroSeen);
hasIntroSeen.subscribe((value) => {
    localStorage.setItem('hasintroseen', value === true ? 'true' : 'false');
});

/**
 * Reads and stores the setting which AR mode should be used.
 */
const storedArMode = localStorage.getItem('storedarmode');
export const arMode = writable(storedArMode || ARMODES.oscp);
arMode.subscribe((value) => {
    localStorage.setItem('storedarmode', value);
});

/**
 * Available settings for creator mode.
 */
const storedCreatorModeSettings = JSON.parse(localStorage.getItem('creatormodesettings') || 'null');
export const creatorModeSettings = writable<{ shape: string; style: []; type: string; modelurl: string; sceneurl: string }>(
    storedCreatorModeSettings || {
        type: CREATIONTYPES.placeholder,
        shape: PLACEHOLDERSHAPES.pole,
        style: [],
        modelurl: '',
        sceneurl: '',
    },
);
creatorModeSettings.subscribe((value) => {
    localStorage.setItem('creatormodesettings', JSON.stringify(value));
});

/**
 * Available settings for experiment mode.
 */
const storedExperimentModeSettings = JSON.parse(localStorage.getItem('experimentmodesettings') || '{}');
export const experimentModeSettings = writable<Record<string, Record<string, unknown>>>(storedExperimentModeSettings);
experimentModeSettings.subscribe((value) => {
    localStorage.setItem('experimentmodesettings', JSON.stringify(value));
});

const storedActiveExperiment = JSON.parse(localStorage.getItem('activeExperiment') || 'null');
export const activeExperiment = writable<string | null>(storedActiveExperiment);
activeExperiment.subscribe((value) => {
    localStorage.setItem('activeExperiment', JSON.stringify(value));
});

/**
 * The rough location of the device when the application was started.
 */
export const initialLocation = writable({
    h3Index: '',
    lat: 0,
    lon: 0,
    countryCode: '',
    regionCode: '',
});

/**
 * Currently valid ssr record, containing the last requested spatial services record.
 */
export const ssr = writable<SSR[]>([]);

/**
 * Derived store of the ssr store for easy access of all contained GeoPose services.
 */
export const availableGeoPoseServices = derived<typeof ssr, Service[]>(
    ssr,
    ($ssr, set) => {
        selectedGeoPoseService.set(null);

        let geoposeServices: Service[] = [];
        for (let record of $ssr) {
            record.services.map((service) => {
                if (service.type === 'geopose') geoposeServices.push(service);
            });
        }

        set(geoposeServices);

        // If none selected yet, set the first available as selected
        // TODO: Make sure that stored selected service is still valid
        if (get(selectedGeoPoseService) === null && geoposeServices.length > 0) {
            selectedGeoPoseService.set(geoposeServices[0]);
        }

        // Prefer GeoPose services, but if there is none, fall back to on-device sensors for localization
        if (get(selectedGeoPoseService) !== null) {
            debug_useGeolocationSensors.set(false);
        } else {
            debug_useGeolocationSensors.set(true);
        }
    },
    [],
);

/**
 * Derived store of ssr store for easy access of all contained content services.
 */
export const availableContentServices = derived<typeof ssr, Service[]>(
    ssr,
    ($ssr, set) => {
        let contentServices: Service[] = [];
        for (let record of $ssr) {
            record.services.forEach((service) => {
                if (service.type === 'content-discovery') {
                    contentServices.push(service);
                }
            });
        }
        set(contentServices);
        // If none selected yet, set all available as selected
        if (Object.keys(get(selectedContentServices)).length === 0 && contentServices.length > 0) {
            let selection: Record<string, { isSelected: boolean; selectedTopic: string }> = {};
            for (const [key, service] of contentServices.entries()) {
                selection[service.id] = { isSelected: true, selectedTopic: 'history' };
            }
            selectedContentServices.set(selection);
        }
    },
    [],
);

/**
 * Derived store of ssr store for easy access of all contained p2pmaster services.
 */
export const availableP2pServices = derived<typeof ssr, Service[]>(
    ssr,
    ($ssr, set) => {
        selectedP2pService.set(null);

        let p2pServices: Service[] = [];
        for (let record of $ssr) {
            record.services.forEach((service) => {
                if (service.type === 'p2p-master') {
                    p2pServices.push(service);
                }
            });
        }
        set(p2pServices);
        // If none selected yet, set the first available as selected
        // TODO: Make sure that stored selected service is still valid
        if (get(selectedP2pService) === null && p2pServices.length > 0) {
            selectedP2pService.set(p2pServices[0]);
        }
    },
    [],
);

/**
 * The one of the returned GeoPose service to be used for localisation.
 */
const storedSelectedGeoPoseService = localStorage.getItem('selectedGeoPoseServiceStorage');
export const selectedGeoPoseService = writable<Service | null>(JSON.parse(storedSelectedGeoPoseService || 'null'));
selectedGeoPoseService.subscribe((value) => {
    localStorage.setItem('selectedGeoPoseServiceStorage', JSON.stringify(value));
});

/**
 * Used to store the values of the most up to date localisation.
 */
export const recentLocalisation = writable<{ geopose: Partial<Geopose>; floorpose: Partial<XRViewerPose> }>({
    geopose: {},
    floorpose: {},
});

/**
 * The ones of the received content services to be used to request content around the current location from.
 */
export const selectedContentServices = writable<Record<string, { isSelected: boolean; selectedTopic: string }>>({});

/**
 * The one of the returned p2p services to be used to set up a local peer to peer network.
 */
const storedSelectedP2pService = JSON.parse(localStorage.getItem('selectedP2pServiceStorage') || 'null');
export const selectedP2pService = writable<Service | null>(storedSelectedP2pService);
selectedP2pService.subscribe((value) => {
    localStorage.setItem('selectedP2pServiceStorage', JSON.stringify(value));
});

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
allowP2pNetwork.subscribe((value) => {
    localStorage.setItem('allowP2pNetwork', value === true ? 'true' : 'false');
});

/**
 * The current state of the peer to peer network connection.
 *
 * @type {Writable<string>}
 */
export const p2pNetworkState = writable('not connected');

/**
 * Alphanumeric uuid string that identifies this client in the P2P network.
 *
 * @type {Writable<string>}
 */
// TODO: change to null or empty string instead
export const peerIdStr = writable('none');

/**
 * Save the captured image used for localisation and append it to the body as an image element.
 *
 * @type {Writable<boolean>}
 */
const storedDebug_saveCameraImage = localStorage.getItem('debug_saveCameraImage') === 'true';
export const debug_saveCameraImage = writable(storedDebug_saveCameraImage);
debug_saveCameraImage.subscribe((value) => {
    localStorage.setItem('debug_saveCameraImage', value === true ? 'true' : 'false');
});

/**
 * Load an existing photo for localization (for example an image saved with debug_saveCameraImage)
 *
 * @type {Writable<boolean>}
 */
const storedDebug_loadCameraImage = localStorage.getItem('debug_loadCameraImage') === 'true';
export const debug_loadCameraImage = writable(storedDebug_loadCameraImage);
debug_loadCameraImage.subscribe((value) => {
    localStorage.setItem('debug_loadCameraImage', value === true ? 'true' : 'false');
});

/**
 * Display axis markers for the local coordinate system.
 *
 * @type {Writable<boolean>}
 */
const storedDebug_showLocalAxes = localStorage.getItem('debug_showLocalAxes') === 'true';
export const debug_showLocalAxes = writable(storedDebug_showLocalAxes);
debug_showLocalAxes.subscribe((value) => {
    localStorage.setItem('debug_showLocalAxes', value === true ? 'true' : 'false');
});

/**
 * Use the Geolocation and AbsoluteOrientation sensors for determining the camera pose in the world (i.e., not use visual positioning).
 *
 * @type {Writable<boolean>}
 */
const storedDebug_useGeolocationSensors = localStorage.getItem('debug_useGeolocationSensors') === 'true';
export const debug_useGeolocationSensors = writable(storedDebug_useGeolocationSensors);
debug_useGeolocationSensors.subscribe((value) => {
    localStorage.setItem('debug_useGeolocationSensors', value === true ? 'true' : 'false');
});

/**
 * Keeps some state of the dashboard.
 */
const storedDashboardDetail: { state: boolean; multiplayer: boolean; debug: boolean } = JSON.parse(localStorage.getItem('dashboardDetail') || 'null') || {
    state: false,
    multiplayer: true,
    debug: true,
};
export const dashboardDetail = writable(storedDashboardDetail);
dashboardDetail.subscribe((value) => {
    localStorage.setItem('dashboardDetail', JSON.stringify(value));
});

export const receivedScrs = writable<SCR[]>([]);
