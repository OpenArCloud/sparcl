/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import { quat, vec3, type ReadonlyQuat } from 'gl-matrix';
import { getEuler, toDegrees } from '@core/locationTools';
import { Quat, Euler, Vec3, Mat4, Transform, type OGLRenderingContext } from 'ogl';
import { Buffer } from 'buffer';

// Here a good source of test quaternions:
// https://www.euclideanspace.com/maths/geometry/rotations/conversions/eulerToQuaternion/steps/index.htm

// Here a good overview on geodetic distance calculations:
// https://www.movable-type.co.uk/scripts/latlong.html

/*
* Redirects logging from console to logger widget (preformatted text),
* code inspired by https://stackoverflow.com/a/45387558
*
* Example use:
* <pre id="logger"></pre>
  <script> logToElement(document.getElementById("logger")); </script>
*/
export function logToElement(loggerElement: HTMLElement) {
    if (console.oldlog != null) {
        // We already redefined the logging, so do nothing
        return;
    }

    console.oldlog = console.log;
    console.log = function () {
        var output = '',
            arg,
            i;
        for (i = 0; i < arguments.length; i++) {
            arg = arguments[i];
            output += '<span style="white-space: normal; word-wrap: break-word;" class="log-' + typeof arg + '">';
            if (typeof arg === 'object' && typeof JSON === 'object' && typeof JSON.stringify === 'function') {
                output += JSON.stringify(arg);
            } else {
                output += arg;
            }
            output += '</span>&nbsp;';
        }
        loggerElement.innerHTML += output + '<br>';
        console.oldlog?.apply(undefined, arguments as any);
    };

    console.oldwarn = console.warn;
    console.warn = function () {
        var output = '',
            arg,
            i;
        for (i = 0; i < arguments.length; i++) {
            arg = arguments[i];
            output += '<span style="white-space: normal; word-wrap: break-word;" class="warning-' + typeof arg + '">';
            if (typeof arg === 'object' && typeof JSON === 'object' && typeof JSON.stringify === 'function') {
                output += JSON.stringify(arg);
            } else {
                output += arg;
            }
            output += '</span>&nbsp;';
        }
        loggerElement.innerHTML += output + '<br>';
        console.oldwarn?.apply(undefined, arguments as any);
    };

    console.olderror = console.error;
    console.error = function () {
        var output = '',
            arg,
            i;
        for (i = 0; i < arguments.length; i++) {
            arg = arguments[i];
            output += '<span style="white-space: normal; word-wrap: break-word;" class="error-' + typeof arg + '">';
            if (typeof arg === 'object' && typeof JSON === 'object' && typeof JSON.stringify === 'function') {
                output += JSON.stringify(arg);
            } else {
                output += arg;
            }
            output += '</span>&nbsp;';
        }
        loggerElement.innerHTML += output + '<br>';
        console.olderror?.apply(undefined, arguments as any);
    };
}

/*
 * Restores the logging to console only
 */
export function logToConsole() {
    if (console.oldlog != null) {
        console.log = console.oldlog;
        console.oldlog = null;
    }
    if (console.oldwarn != null) {
        console.warn = console.oldwarn;
        console.oldwarn = null;
    }
    if (console.olderror != null) {
        console.error = console.olderror;
        console.olderror = null;
    }
}

/**
 * Checks for pending OpenGL errors
 * @param {glBinding} gl OpenGL binding
 * @param {string} message
 * @returns {boolean} false if no error, true if there was an error
 */
export function checkGLError(gl: OGLRenderingContext, message: string) {
    if (gl == null) {
        console.warn('checkGLError called but there is no GL context');
        return true;
    }
    let e = gl.getError();
    if (e != 0) {
        console.warn('GL error - ' + message + ': ', e);
        return true;
    }
    return false;
}

/**
 * Loads an image from a given URL and returns it in base64 encoding
 * @param url The URL to load
 */
export async function loadImageBase64(url: string) {
    // TODO: also read EXIF entries
    let response = await fetch(url);
    let buffer = await response.arrayBuffer();
    const imageBase64 = 'data:image/jpeg;base64,' + btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    return imageBase64;
}

/**
 * Saves a base64-encoded jpeg, png, or gif image into a file in the default Download folder
 * @param imageBase64 The URL to load
 * @param fileNameStem filename without extension
 */
// code adapted from https://gist.github.com/madhums/e749dca107e26d72b64d
export function saveImageBase64(imageBase64: string, fileNameStem: string) {
    // Grab the extension to resolve any image error
    let ext = imageBase64.split(';')[0].match(/jpeg|png|gif/)?.[0];
    // strip off the data: url prefix to get just the base64-encoded bytes
    let data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    let buf = Buffer.from(data, 'base64');
    let a = document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob([buf], { type: 'image' + '/' + ext }));
    a.download = fileNameStem + '.' + ext;
    a.click();
}

/**
 * Saves text into a text file in the default Download folder
 * @param string text
 * @param fileNameStem filename without extension
 */
// code adapted from https://code-boxx.com/create-save-files-javascript/
export function saveText(string: string, fileNameStem: string) {
    let a = document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob([string], { type: 'text/plain' }));
    a.download = fileNameStem + '.' + 'txt';
    a.click();
}

/**
 * Pretty logging of a gl-matrix quaternion
 * @param name The name to print
 * @param qquat quat from gl-matrix package
 */
export function printGlmQuat(name: string, qquat: ReadonlyQuat) {
    console.log(name + ':');
    let axis = vec3.create();
    let angle = quat.getAxisAngle(axis, qquat);
    console.log('  values: x: ' + qquat[0] + ', y: ' + qquat[1] + ', z: ' + qquat[2] + ', w: ' + qquat[3]);
    console.log('  axis: ' + vec3.str(axis) + ', angle: ' + toDegrees(angle));

    let euler = vec3.create();
    getEuler(euler, qquat);
    //console.log("  MV Euler angles (rad): " + vec3.str(euler));
    console.log('  MV Euler angles: ' + toDegrees(euler[0]) + ', ' + toDegrees(euler[1]) + ', ' + toDegrees(euler[2]));

    let qQuat = new Quat(qquat[0], qquat[1], qquat[2], qquat[3]);
    let eulerOgl = getEulerDegreesOgl(qQuat /*'XYZ'*/);
    console.log('  OGL Euler angles: ' + eulerOgl[0] + ', ' + eulerOgl[1] + ', ' + eulerOgl[2]);
}

/**
 * Pretty logging of a quaternion given by 4 float numbers
 * @param  {name} string The name to print
 * @param  {x} float quaternion component x
 * @param  {y} float quaternion component y
 * @param  {z} float quaternion component z
 * @param  {w} float quaternion component w
 */
export function printQuat(name: string, x: number, y: number, z: number, w: number) {
    // With gl-matrix quat
    let qquat = quat.fromValues(x, y, z, w);
    printGlmQuat(name, qquat);
}

/**
 * Returns the Euler angle representation of a quaternion.
 * @param  {Quat} quat Quaternion
 * @param  {string} order any permutation of XYZ
 * @return {Vec3} Euler angles in radians
 */
export function getEulerAnglesOgl(quat: Quat, order = 'XYZ') {
    let euler = new Euler();
    euler.fromQuaternion(quat, (order = 'XYZ'));
    let vec3 = new Vec3();
    euler.toArray(vec3);
    return vec3;
}

/**
 * Returns the Euler angle representation of a quaternion in degrees.
 * @param  {Quat} quat Quaternion
 * @param  {string} order any permutation of XYZ
 * @return {Vec3} Euler angles in degrees
 */
export function getEulerDegreesOgl(quat: Quat, order = 'XYZ') {
    let eulerRad = getEulerAnglesOgl(quat, order);
    let eulerDeg = new Vec3();
    eulerRad.toArray(eulerDeg);
    eulerDeg[0] = toDegrees(eulerDeg[0]);
    eulerDeg[1] = toDegrees(eulerDeg[1]);
    eulerDeg[2] = toDegrees(eulerDeg[2]);
    return eulerDeg;
}

/**
 * Pretty logging of an OGL Transform
 * @param  {name} string The name to print
 * @param  {transform} Transform An OGL Transform object
 */
export function printOglTransform(name: string, transform: Transform) {
    let tPos = new Vec3(transform.position[0], transform.position[1], transform.position[2]);
    let tQuat = new Quat(transform.quaternion[0], transform.quaternion[1], transform.quaternion[2], transform.quaternion[3]);
    let tEuler = getEulerDegreesOgl(tQuat, 'XYZ');
    console.log(
        'transform ' +
            name +
            '\n' +
            '  position (' +
            tPos[0] +
            ', ' +
            tPos[1] +
            ', ' +
            tPos[2] +
            ') \n' +
            '  orientation (' +
            tEuler[0] +
            ', ' +
            tEuler[1] +
            ', ' +
            tEuler[2] +
            ') \n' +
            '  quaternion (' +
            tQuat[0] +
            ', ' +
            tQuat[1] +
            ', ' +
            tQuat[2] +
            ', ' +
            tQuat[3] +
            ')',
    );
}

/*
    To prevent constant localisation during development.
*/
export const fakeLocationResult = {
    geopose: {
        accuracy: {
            orientation: -1,
            position: -1,
        },
        ecefPose: {
            orientation: {
                w: 0.18475762942989385,
                x: 0.19376046404179365,
                y: 0.9382047195400572,
                z: 0.2193020865712806,
            },
            position: {
                x: 4166094.007979741,
                y: 626020.0970524579,
                z: 4772721.848253169,
            },
        },
        id: '1adc076d-5a33-4f06-aacb-e8c2e94499b9',
        pose: {
            position: {
                lat: 48.756115957414345,
                lon: 8.545640947400223,
                h: 0.06582733851264133,
            },
            quaternion: {
                x: 0.13936200826179151,
                y: 0.33341690000800994,
                z: 0.06575967542722623,
                w: -0.9301005679656341,
            },
        },
        timestamp: 1619696982027,
        type: 'geopose',
    },
    scrs: [
        {
            content: {
                custom_data: {
                    path: '',
                    sticker_id: 25519,
                    sticker_subtype: 'private',
                    sticker_text: 'parkplatz',
                    sticker_type: 'place',
                    type: 'INFOSTICKER',
                },
                description: '',
                ecefPose: {
                    orientation: {
                        w: 0.2144326929635223,
                        x: 0.2953677415218236,
                        y: 0.14079545389219456,
                        z: 0.9203005800389348,
                    },
                    position: {
                        x: 4166093.058332518,
                        y: 626024.3768432491,
                        z: 4772720.764265804,
                    },
                },
                geopose: {
                    position: {
                        lat: 48.75611158077768,
                        lon: 8.545700426348882,
                        h: -0.9490814805030823,
                    },
                    quaternion: {
                        x: 0.03369506983713525,
                        y: 0.30602725114310314,
                        z: 0.010838757575863686,
                        w: -0.9513645385238395,
                    },
                },
                id: '25519',
                keywords: ['place'],
                refs: [],
                title: 'parkplatz',
                type: 'placeholder',
                url: '',
            },
            id: '25519',
            tenant: 'AC',
            timestamp: 1619696982316,
            type: 'scr',
        },
        {
            content: {
                custom_data: {
                    path: '/media/models/Duck.glb',
                    sticker_id: 25523,
                    sticker_subtype: 'gltf',
                    sticker_text: 'first',
                    sticker_type: 'other',
                    type: 'INFOSTICKER',
                },
                description: '',
                ecefPose: {
                    orientation: {
                        w: 0.9258142512020657,
                        x: -0.21110588904593072,
                        y: -0.30515319928392165,
                        z: -0.071998616987224,
                    },
                    position: {
                        x: 4166091.551286406,
                        y: 626021.0190979425,
                        z: 4772723.052048196,
                    },
                },
                geopose: {
                    position: {
                        lat: 48.7560834514246,
                        lon: 8.545731127889324,
                        h: -0.8568757176399231,
                    },
                    quaternion: {
                        x: 0.030575819204840073,
                        y: -0.8192063719687788,
                        z: -0.04386668473200756,
                        w: -0.5710006596986791,
                    },
                },
                id: '25523',
                keywords: ['place'],
                refs: [],
                title: 'first',
                type: 'placeholder',
                url: '',
            },
            id: '25523',
            tenant: 'AC',
            timestamp: 1619696982578,
            type: 'scr',
        },
        {
            content: {
                custom_data: {
                    // "path": "https://clv.zappar.io/6966846783932362010/1.0.12/",  // Unity
                    // "path": "https://clv.zappar.io/6817336933886541943/",  // threejs
                    path: '/media/scenes/waypoint/', // threejs
                    sticker_id: 25532,
                    sticker_subtype: 'scene',
                    sticker_text: 'Picker',
                    sticker_type: 'other',
                    type: 'INFOSTICKER',
                },
                description: '',
                ecefPose: {
                    orientation: {
                        w: 0.8042543049156928,
                        x: -0.26127504256379713,
                        y: 0.21968396835100398,
                        z: -0.48646615422598155,
                    },
                    position: {
                        x: 4166092.0033649127,
                        y: 626021.3217525029,
                        z: 4772722.863883659,
                    },
                },
                geopose: {
                    position: {
                        lat: 48.756132830613595,
                        lon: 8.545662319589079,
                        h: -0.4542122185230255,
                    },
                    quaternion: {
                        x: -0.11061927770517868,
                        y: -0.5654197985215716,
                        z: 0.07686378041725367,
                        w: -0.8137295534142641,
                    },
                },
                id: '25532',
                keywords: ['other'],
                refs: [],
                title: 'Picker',
                type: 'placeholder',
                url: '/Scene/',
            },
            id: '25532',
            tenant: 'AC',
            timestamp: 1619696982834,
            type: 'scr',
        },
    ],
};

export const fakeLocationResult4 = {
    geopose: {
        accuracy: {
            orientation: -1,
            position: -1,
        },
        ecefPose: {
            orientation: {
                w: 0.5919192501923252,
                x: -0.5412070401668473,
                y: 0.011535737343803046,
                z: 0.5971544755668603,
            },
            position: {
                x: 4083570.417534955,
                y: 1408067.6422907924,
                z: 4677080.506363399,
            },
        },
        id: '4fc416d1-eda0-4a5d-92a7-19d6b1a9f381',
        localPose: {
            orientation: {
                w: 0.5063787594539491,
                x: -0.5505655221963802,
                y: 0.4262068860718541,
                z: -0.5087296413690091,
            },
            position: {
                x: -11.526875196127614,
                y: -6.140907495430501,
                z: -0.37968869851290166,
            },
        },
        pose: {
            position: {
                lat: 47.46776729912386,
                lon: 19.024852546852575,
                h: 6.209678601295207,
            },
            quaternion: {
                w: 0.6618161044717988,
                x: -0.5861336742744468,
                y: 0.3673496700733379,
                z: -0.2889653606235868,
            },
        },
        reconstruction_id: 15526,
        timestamp: 1621583444646,
        type: 'geopose',
    },
    scrs: [
        {
            content: {
                custom_data: {
                    created_by: 'gabor.soros@nokia-bell-labs.com',
                    creation_date: '1620988445618',
                    description: '',
                    grounded: '0',
                    model_id: 'santaarcity',
                    model_scale: '1.0',
                    path: 'https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/Duck/glTF-Binary/Duck.glb',
                    sticker_id: '41795',
                    sticker_subtype: 'gltf',
                    sticker_text: 'test-ori-0-0-0',
                    sticker_type: 'other',
                    subtype: 'OBJECT',
                    type: '3D',
                    vertically_aligned: '0',
                },
                ecefPose: {
                    orientation: {
                        w: 0.5406416868871375,
                        x: 0.21146140080276724,
                        y: 0.29659499916150545,
                        z: 0.7583020828421538,
                    },
                    position: {
                        x: 4083567.730369103,
                        y: 1408077.4358462247,
                        z: 4677071.481341206,
                    },
                },
                geopose: {
                    position: {
                        lat: 47.467708102315875,
                        lon: 19.024986975760502,
                        h: -1.1442635727831885e-9,
                    },
                    quaternion: {
                        w: 1.0,
                        x: -2.7755575615628914e-16,
                        y: 3.219916175035085e-17,
                        z: 2.9745892283657463e-17,
                    },
                },
                id: '41795',
                keywords: ['other'],
                localPose: {
                    orientation: {
                        w: 0.9912099698891731,
                        x: -0.01903288291020846,
                        y: -0.13092065979000006,
                        z: -0.000570789437556009,
                    },
                    position: {
                        x: -0.40110391763084274,
                        y: -0.22670973012632145,
                        z: -6.464074744966913,
                    },
                },
                refs: [],
                title: 'test-ori-0-0-0',
                type: 'placeholder',
            },
            id: '41795',
            tenant: 'AC',
            timestamp: 1621583444854,
            type: 'scr',
        },
        {
            content: {
                custom_data: {
                    created_by: 'gabor.soros@nokia-bell-labs.com',
                    creation_date: '1620989858865',
                    description: '',
                    grounded: '0',
                    model_id: 'santaarcity',
                    model_scale: '1.0',
                    path: 'https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/Duck/glTF-Binary/Duck.glb',
                    sticker_id: '41797',
                    sticker_subtype: 'gltf',
                    sticker_text: 'test-ori-x90',
                    sticker_type: 'other',
                    subtype: 'OBJECT',
                    type: '3D',
                    vertically_aligned: '0',
                },
                ecefPose: {
                    orientation: {
                        w: 0.23276561252318587,
                        x: 0.5318171934568722,
                        y: 0.745924880138689,
                        z: 0.3264762097924511,
                    },
                    position: {
                        x: 4083565.002216616,
                        y: 1408081.4752057407,
                        z: 4677072.639405281,
                    },
                },
                geopose: {
                    position: {
                        lat: 47.46772351065496,
                        lon: 19.0250494251137,
                        h: 6.217590331480949e-10,
                    },
                    quaternion: {
                        w: 0.7071067811865476,
                        x: 0.7071067811865472,
                        y: 1.9626155733547187e-17,
                        z: 1.5407439555097887e-33,
                    },
                },
                id: '41797',
                keywords: ['other'],
                localPose: {
                    orientation: {
                        w: 0.7143495718596857,
                        x: 0.6874330107170099,
                        y: -0.09297849541685152,
                        z: 0.09217127725300048,
                    },
                    position: {
                        x: 1.876735462955852,
                        y: -0.1774258048435171,
                        z: -4.867665670359021,
                    },
                },
                refs: [],
                title: 'test-ori-x90',
                type: 'placeholder',
            },
            id: '41797',
            tenant: 'AC',
            timestamp: 1621583444857,
            type: 'scr',
        },
        {
            content: {
                custom_data: {
                    created_by: 'gabor.soros@nokia-bell-labs.com',
                    creation_date: '1620989913654',
                    description: '',
                    grounded: '0',
                    model_id: 'santaarcity',
                    model_scale: '1.0',
                    path: 'https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/Duck/glTF-Binary/Duck.glb',
                    sticker_id: '41798',
                    sticker_subtype: 'gltf',
                    sticker_text: 'test-ori-y90',
                    sticker_type: 'other',
                    subtype: 'OBJECT',
                    type: '3D',
                    vertically_aligned: '0',
                },
                ecefPose: {
                    orientation: {
                        w: 0.1725670678169102,
                        x: -0.3866747544987271,
                        y: 0.592015738163148,
                        z: 0.685726335432413,
                    },
                    position: {
                        x: 4083562.92418376,
                        y: 1408084.820038548,
                        z: 4677073.441338353,
                    },
                },
                geopose: {
                    position: {
                        lat: 47.46773418058248,
                        lon: 19.025100354147355,
                        h: 1.077607447719231e-9,
                    },
                    quaternion: {
                        w: 0.7071067811865476,
                        x: -1.1102230246251565e-16,
                        y: 0.7071067811865477,
                        z: -1.6653345369377348e-16,
                    },
                },
                id: '41798',
                keywords: ['other'],
                localPose: {
                    orientation: {
                        w: 0.7012949003702734,
                        x: -0.10603316690626392,
                        y: -0.07911660576358791,
                        z: 0.7004876822064224,
                    },
                    position: {
                        x: 3.764744087849218,
                        y: -0.14205708610258821,
                        z: -3.678690168397931,
                    },
                },
                refs: [],
                title: 'test-ori-y90',
                type: 'placeholder',
            },
            id: '41798',
            tenant: 'AC',
            timestamp: 1621583444860,
            type: 'scr',
        },
        {
            content: {
                custom_data: {
                    created_by: 'gabor.soros@nokia-bell-labs.com',
                    creation_date: '1620989970933',
                    description: '',
                    grounded: '0',
                    model_id: 'santaarcity',
                    model_scale: '1.0',
                    path: 'https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/Duck/glTF-Binary/Duck.glb',
                    sticker_id: '41799',
                    sticker_subtype: 'gltf',
                    sticker_text: 'test-ori-z90',
                    sticker_type: 'other',
                    subtype: 'OBJECT',
                    type: '3D',
                    vertically_aligned: '0',
                },
                ecefPose: {
                    orientation: {
                        w: -0.15390914197554115,
                        x: 0.35925012563996206,
                        y: 0.060198544706275704,
                        z: 0.9184919479555992,
                    },
                    position: {
                        x: 4083562.137133426,
                        y: 1408085.958382831,
                        z: 4677073.78349634,
                    },
                },
                geopose: {
                    position: {
                        lat: 47.467738733083905,
                        lon: 19.02511803199369,
                        h: 1.5454849899843026e-10,
                    },
                    quaternion: {
                        w: 0.7071067811865475,
                        x: -2.220446049250313e-16,
                        y: 1.6653345369377348e-16,
                        z: 0.7071067811865477,
                    },
                },
                id: '41799',
                keywords: ['other'],
                localPose: {
                    orientation: {
                        w: 0.6083164049534219,
                        x: -0.013861889653263472,
                        y: -0.793466177623274,
                        z: 0.013054671489412542,
                    },
                    position: {
                        x: 4.406486012401896,
                        y: -0.12761956286449005,
                        z: -3.2154214455481465,
                    },
                },
                refs: [],
                title: 'test-ori-z90',
                type: 'placeholder',
            },
            id: '41799',
            tenant: 'AC',
            timestamp: 1621583444862,
            type: 'scr',
        },
        {
            content: {
                custom_data: {
                    created_by: 'gabor.soros@nokia-bell-labs.com',
                    creation_date: '1621001098254',
                    description: '',
                    grounded: '0',
                    model_id: 'trans2tank',
                    model_scale: '1.0',
                    path: 'https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/Duck/glTF-Binary/Duck.glb',
                    sticker_id: '41800',
                    sticker_subtype: 'gltf',
                    sticker_text: 'test-at-green-house',
                    sticker_type: 'other',
                    subtype: 'OBJECT',
                    type: '3D',
                    vertically_aligned: '0',
                },
                ecefPose: {
                    orientation: {
                        w: 0.5406416868871375,
                        x: 0.21146140080276724,
                        y: 0.29659499916150545,
                        z: 0.7583020828421538,
                    },
                    position: {
                        x: 4083572.414225857,
                        y: 1408083.0336644766,
                        z: 4677065.745221431,
                    },
                },
                geopose: {
                    position: {
                        lat: 47.46763178183924,
                        lon: 19.025036918814745,
                        h: -1.809494637461384e-10,
                    },
                    quaternion: {
                        w: 1.0,
                        x: -2.7755575615628914e-16,
                        y: 3.219916175035085e-17,
                        z: 2.9745892283657463e-17,
                    },
                },
                id: '41800',
                keywords: ['other'],
                localPose: {
                    orientation: {
                        w: 0.9912099698891731,
                        x: -0.01903288291020846,
                        y: -0.13092065979000006,
                        z: -0.000570789437556009,
                    },
                    position: {
                        x: 2.840668345839372,
                        y: -0.4128877001606494,
                        z: -10.46761316683347,
                    },
                },
                refs: [],
                title: 'test-at-green-house',
                type: 'placeholder',
            },
            id: '41800',
            tenant: 'AC',
            timestamp: 1621583444864,
            type: 'scr',
        },
    ],
};
