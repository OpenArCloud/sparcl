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

/**
 * Empty Spatial Content Record to initialize variables.
 *
 * @type {{id: string, type: string, content: {}, tenant: string, timestamp: number}}
 */
export const SCR = {
    id: '',
    type: '',
    content: {},
    tenant: '',
    timestamp: 0
}

/**
 * Empty GeoPose object to initialize variables.
 *
 * @type {{position: {lat: number, lon: number, h: number}, quaternion: {x: number, y: number, z: number, w: number}}}
 */
export const GEOPOSE = {
    position: {
        lat: 0,
        lon: 0,
        h: 0
    },
    quaternion: {
        x: 0,
        y: 0,
        z: 0,
        w: 0
    }
}

/**
 * Definition of the local pose properties.
 *
 * @type {{inverse: {}, transform: {w: number, x: number, y: number, z: number}, orientation: {w: number, x: number, y: number, z: number}, matrix: {}}}
 */
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
 * marker: Use marker to define a reference point for content
 * oscp: Use discovery services for localisation and content discovery
 * creator: Allows easy placement of local 3D content. Should make using sparcl during content creation very easy
 * dev: Places default content from a stored service response. Should speed up using sparcl during development
 * experiment: Used for experimenting with features under development
 *
 * @type {{creator: string, dev: string, experiment: string, oscp: string, marker: string}}
 */
export const ARMODES = {
    marker: 'Marker',
    oscp: 'OSCP',
    create: 'Content creation',
    develop: 'Development',
    experiment: 'Experiment'
}

/**
 * Available types creatable with sparcl.
 *
 * placeholder: Generated content defined in app
 * model: 3D model in glb or gltf format
 * scene: WebGL scene exported from game engines like Godot or created using frameworks like threejs
 *
 * @type {{model: string, placeholder: string, scene: string}}
 */
export const CREATIONTYPES = {
    placeholder: "Placeholder",
    model: 'Model',
    scene: 'Scene'
}

/**
 * Supported shapes for placeholder content types.
 *
 * @type {{sign: string, pole: string}}
 */
export const PLACEHOLDERSHAPES = {
    pole: "Pole",
    sign: "Sign"
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

/**
 * Returns an integer random number between min (included) and max (included):
 * @param integer min
 * @param integer max
 * @returns integer
 */
export function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
