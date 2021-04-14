/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

/* Provider for common data types and functions */


/**
 * Type for location info, no orientation
 *
 * @type {{regionCode: string, h3Index: number}}
 */
export const LOCATIONINFO = {
    h3Index: 0,
    lat: 0,
    lon: 0,
    regionCode: ''
}

/**
 * Empty Spatial Services Record to initialize variables.
 *
 * @type {{altitude: number, provider: string, geometry: {}, id: string, services: [], type: string, timestamp: number}}
 */
export const SSR = {
    id: '',
    type: '',
    services: [],
    geometry: {},
    altitude: 0,
    provider: '',
    timestamp: 0
}

export const SCR = {
    id: '',
    type: '',
    content: {},
    tenant: '',
    timestamp: 0
}

export const GEOPOSE = {
    longitude: 0,
    latitude: 0,
    ellipsoidHeight: 0,
    quaternion: []
}

export const LOCALPOSE = {
    transform: {x: 0, y: 0, z: 0, w: 1},
    orientation: {x: 0, y: 0, z: 0, w: 0},
    matrix: {},
    inverse: {}
}

/**
 * Empty service value, contained in the services array of an SSR.
 *
 * @type {{capabilities: [], description: string, id: string, type: string, title: string, url: string}}
 */
export const SERVICE = {
    id: '',
    type: '',
    title: '',
    description: '',
    url: '',
    capabilities: []
}

/**
 * Implemented AR modes of the client.
 *
 * auto: The client selects one of the modes, depending the availability of AR functionality and discovery services
 * oscp: Use discovery services for localisation and content discovery
 * marker: Use marker to define a reference point for content
 *
 * @type {{auto: string, oscp: string, marker: string}}
 */
export const ARMODES = {
    auto: 'Auto',
    marker: 'Marker',
    oscp: 'ARCloud',
    creator: 'Content creation'
}

/**
 * Utility function used to delay the execution of the next expression delay milliseconds.
 *
 * @param delay
 * @returns {Promise<null>}
 */
export function wait(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Delays the execution of the provided function until timeout expired.
 *
 * @param func  function        Will be executed when timeout expires
 * @param timeout  Number       Duration in milliseconds to delay the execution of the provided function
 * @returns {function(...[*]=): void}
 */
export function debounce(func, timeout = 300){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}
