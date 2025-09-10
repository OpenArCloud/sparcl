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

import { ARMODES, CREATIONTYPES, PLACEHOLDERSHAPES } from './core/common.js';
import { v4 as uuidv4 } from 'uuid';
import type { SSR, Service } from '@oarc/ssd-access';
import type { Geopose, SCR } from '@oarc/scd-access';

/**
 * Determines the isAuthenticatedAuth0 status.
 * @type {Readable<boolean>}    true when using Auth0, false otherwise
 */

export const isAuthenticatedAuth0 = writable(false);
export const userNoAuth = writable(false);

export const authenticated0Client = writable({});
export const popupOpen = writable(false);
export const error = writable();

/**
 * Determines the availability of AR functions on the current device.
 * @type {Readable<boolean>}    true when available, false otherwise
 */
export const arIsAvailable = readable(false, (set) => {
    if (navigator.xr !== undefined) {
        navigator.xr.isSessionSupported('immersive-ar').then((result) => set(result));
    }

    return () => set(false);
});

/**
 * Reads and stores the state of login.
 *
 * @type {boolean}  true when login is true, false otherwise
 */
const storedLoginState = localStorage.getItem('isLoggedIn') === 'true';
export const isLoggedIn = writable<boolean>(storedLoginState);
isLoggedIn.subscribe((value) => {
    localStorage.setItem('isLoggedIn', value ? 'true' : 'false');
});

/**
 * Reads and stores the details of the signed user.
 *
 * @type {string}
 */
const kDefaultLoggedInUserData = JSON.stringify({
    email: null,
    username: null,
});
const storedSignedInUserState = localStorage.getItem('currentLoggedInUser') || kDefaultLoggedInUserData;
export const currentLoggedInUser = writable<string>(storedSignedInUserState);
currentLoggedInUser.subscribe((value) => {
    localStorage.setItem('currentLoggedInUser', value);
});

/**
 * Reads and stores the setting whether or not to display the login persistently.
 *
 * @type {boolean}  true when login should be shown, false otherwise
 */
const storedShowLogin = localStorage.getItem('showlogin') === 'true';
export const showLogin = writable(storedShowLogin);
showLogin.subscribe((value) => {
    localStorage.setItem('showlogin', value === true ? 'true' : 'false');
});

/**
 * Determines and keeps track of the state of the location permission.
 * @type {Readable<boolean>}
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
 *
 * @type {boolean}  true when dashboard should be shown, false otherwise
 */
const storedShowDashboard = localStorage.getItem('showdashboard') === 'true';
export const showDashboard = writable(storedShowDashboard);
showDashboard.subscribe((value) => {
    localStorage.setItem('showdashboard', value === true ? 'true' : 'false');
});

/**
 * Reads and stores the setting whether or not the user has already seen the intro.
 *
 * @type {boolean}  true when the intro was already seen, false otherwise
 */
const storedHasIntroSeen = localStorage.getItem('hasintroseen') === 'true';
export const hasIntroSeen = writable(storedHasIntroSeen);
hasIntroSeen.subscribe((value) => {
    localStorage.setItem('hasintroseen', value === true ? 'true' : 'false');
});

/**
 * Reads and stores the setting which AR mode should be used.
 *
 * @type {string}
 */
const storedArMode = localStorage.getItem('storedarmode');
export const arMode = writable(storedArMode || ARMODES.oscp);
arMode.subscribe((value) => {
    localStorage.setItem('storedarmode', value);
});

/**
 * Available settings for creator mode.
 * @type {Writable<{shape: string, style: [], type: string, url: string}>}
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
const storedExperimentModeSettings = JSON.parse(localStorage.getItem('experimentmodesettings') || 'null');
export const experimentModeSettings = writable<Record<string, Record<string, unknown>> | null>(storedExperimentModeSettings);
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
        const geoposeServices: Service[] = [];
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
        } else if (!get(debug_useOverrideGeopose)) {
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
        const contentServices: Service[] = [];
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
                // TODO: get first topic from service (As of 2021, we put everything under the history topic)
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
        const p2pServices: Service[] = [];
        for (let record of $ssr) {
            record.services.forEach((service) => {
                if (service.type === 'p2p-master') {
                    p2pServices.push(service);
                }
            });
        }
        set(p2pServices);
        // If none selected yet, set the first available as selected
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

export const availableMessageBrokerServices = derived<typeof ssr, (Service & { guid: string })[]>(
    ssr,
    ($ssr, set) => {
        const messageBrokerServices: (Service & { guid: string })[] = [];
        for (const record of $ssr) {
            for (const service of record.services) {
                if (service.type === 'message-broker') {
                    const urlParsed = new URL(service.url);
                    urlParsed.protocol = 'wss://'; // HACK: url comes in with https:// protocol, but this needs to be wss://
                    messageBrokerServices.push({ ...service, guid: `${record.id}-${service.id}`, url: urlParsed.href });
                }
            }
        }
        set(messageBrokerServices);
        // If none selected yet, set the first available as selected
        // TODO: Make sure that stored selected service is still valid
        if (get(selectedP2pService) === null && messageBrokerServices.length > 0) {
            selectedP2pService.set(messageBrokerServices[0]);
        }
    },
    [],
);

export const isRabbitmqConnectionTestSuccessful = writable(null);

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
export const p2pNetworkState = writable<'connected' | 'not connected'>('not connected');

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
 * Use a predefined geolocation as if you were actually there. This way we can simulate being in an actual location. Useful for home office work when you wish to see the contents placed in the office.
 */
const storeddebug_useOverrideGeopose = localStorage.getItem('debug_useOverrideGeopose') === 'true';
export const debug_useOverrideGeopose = writable(storeddebug_useOverrideGeopose);
debug_useOverrideGeopose.subscribe((value) => {
    localStorage.setItem('debug_useOverrideGeopose', value === true ? 'true' : 'false');
});

const storedDebug_overrideGeopose: Geopose = JSON.parse(localStorage.getItem('debug_overrideGeopose') || 'null') || {
    position: {
        h: 1.5,
        lat: 0,
        lon: 0,
    },
    quaternion: {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
    },
};
export const debug_overrideGeopose = writable(storedDebug_overrideGeopose);
debug_overrideGeopose.subscribe((value) => {
    localStorage.setItem('debug_overrideGeopose', JSON.stringify(value));
});

/**
 * Enable/disable point cloud contents (usually large files)
 *
 * @type {Writable<boolean>}
 */
const storedDebug_enablePointCloudContents = localStorage.getItem('debug_enablePointCloudContents') === 'true';
export const debug_enablePointCloudContents = writable(storedDebug_enablePointCloudContents);
debug_enablePointCloudContents.subscribe((value) => {
    localStorage.setItem('debug_enablePointCloudContents', value === true ? 'true' : 'false');
});

/**
 * Enable/disable OGC Point of Interest contents
 *
 * @type {Writable<boolean>}
 */
const enableOGCFromLocalStorage = localStorage.getItem('debug_enableOGCPoIContents');
const storedDebug_enableOGCPoIContents = enableOGCFromLocalStorage === 'true' || enableOGCFromLocalStorage == null; // set true if stored true or undefined
export const debug_enableOGCPoIContents = writable(storedDebug_enableOGCPoIContents);
debug_enableOGCPoIContents.subscribe((value) => {
    localStorage.setItem('debug_enableOGCPoIContents', value === true ? 'true' : 'false');
});

/**
 * Keeps some state of the dashboard.
 *
 * @type {any|{debug: boolean, state: boolean, multiplayer: boolean}}
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

/**
 * Used to store a random uuid that corresponds to the current user's agent name
 *
 * @type {Readable<string>}
 */
const storedMyAgentId = localStorage.getItem('myAgentId');
export const myAgentId = readable(storedMyAgentId, (set) => {
    if (!storedMyAgentId) {
        const newAgentId = uuidv4();
        localStorage.setItem('myAgentId', newAgentId);
        set(newAgentId);
    }
    return () => {};
});

/**
 * Used to store the user's agent name
 *
 * @type {Writable<string>}
 */
const storedMyAgentName = localStorage.getItem('myAgentName');
export const myAgentName = writable(storedMyAgentName);
myAgentName.subscribe((value) => {
    if (value) {
        localStorage.setItem('myAgentName', value);
    }
});

const getRandomColorValue = () => {
    return Math.floor(Math.random() * 256);
};

/**
 * Used to store a the users preferred color.
 *
 * @type {Writable<{r: number, g: number, b: number, a: number}>}
 */
const storedMyAgentColor: { r: number; g: number; b: number; a: number } | null = localStorage.getItem('myAgentColor')
    ? JSON.parse(localStorage.getItem('myAgentColor') || 'null')
    : { r: getRandomColorValue(), g: getRandomColorValue(), b: getRandomColorValue(), a: 1 };
export const myAgentColor = writable(storedMyAgentColor);
myAgentColor.subscribe((value) => {
    localStorage.setItem('myAgentColor', JSON.stringify(value));
});
const storedAllowMessageBroker = localStorage.getItem('allowMessageBroker') === 'true';
export const allowMessageBroker = writable(storedAllowMessageBroker);
allowMessageBroker.subscribe((value) => {
    localStorage.setItem('allowMessageBroker', value === true ? 'true' : 'false');
});

const storedMessageBrokerAuth: Record<string, { username: string; password: string }> | null = JSON.parse(localStorage.getItem('messageBrokerAuth') || 'null');
export const messageBrokerAuth = writable(storedMessageBrokerAuth);
messageBrokerAuth.subscribe((value) => {
    localStorage.setItem('messageBrokerAuth', JSON.stringify(value));
});

const storedSelectedMessageBroker: (Service & { guid: string }) | null = JSON.parse(localStorage.getItem('selectedMessageBrokerService') || 'null');
export const selectedMessageBrokerService = writable(storedSelectedMessageBroker);
selectedMessageBrokerService.subscribe((value) => {
    localStorage.setItem('selectedMessageBrokerService', JSON.stringify(value));
    const currentMessageBrokerAuth = get(messageBrokerAuth);
    if (value?.guid != null) {
        // initialize object
        messageBrokerAuth.set({ [value.guid]: { username: '', password: '' }, ...currentMessageBrokerAuth });
    }
});

const storedAutomergeDocumentUrl = localStorage.getItem('automergeDocumentUrl');
export const automergeDocumentUrl = writable(storedAutomergeDocumentUrl);
automergeDocumentUrl.subscribe((value) => {
    localStorage.setItem('automergeDocumentUrl', value!);
});

/**
 * Used to store the user's agent name input status (editable/not)
 *
 * @type {Writable<boolean>}
 */
export const isAgentNameReadonly = writable(false);

// Initialize values for authenticated user details
const userDetails = JSON.parse(localStorage.getItem('currentLoggedInUser') || kDefaultLoggedInUserData);

export const userData = writable(userDetails);
export const userId = writable(userDetails.email);
// split username
const initialUserName = userDetails.username ? userDetails.username.split('(')[0].trim() : '';
export const userName = writable(initialUserName);
