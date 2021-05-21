/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

/*
    Utility function helping with calculations around GeoPose.
 */

import LatLon from 'geodesy/latlon-ellipsoidal-vincenty.js';
import { quat, vec3 } from 'gl-matrix';
import * as h3 from "h3-js";
import { supportedCountries } from 'ssd-access';

export const toRadians = (degrees) => degrees / 180 * Math.PI;
export const toDegrees = (radians) => radians / Math.PI * 180;


/*
    To prevent constant localisation during development.
 */
export const fakeLocationResult = {
    "geopose": {
        "accuracy": {
            "orientation": -1,
            "position": -1
        },
        "ecefPose": {
            "orientation": {
                "w": 0.18475762942989385,
                "x": 0.19376046404179365,
                "y": 0.9382047195400572,
                "z": 0.2193020865712806
            },
            "position": {
                "x": 4166094.007979741,
                "y": 626020.0970524579,
                "z": 4772721.848253169
            }
        },
        "id": "1adc076d-5a33-4f06-aacb-e8c2e94499b9",
        "pose": {
            "ellipsoidHeight": 0.06582733851264133,
            "latitude": 48.756115957414345,
            "longitude": 8.545640947400223,
            "quaternion": {
                "x": 0.13936200826179151,
                "y": 0.33341690000800994,
                "z": 0.06575967542722623,
                "w": -0.9301005679656341
            }
        },
        "timestamp": 1619696982027,
        "type": "geopose"
    },
    "scrs": [
        {
            "content": {
                "custom_data": {
                    "path": "",
                    "sticker_id": 25519,
                    "sticker_subtype": "private",
                    "sticker_text": "parkplatz",
                    "sticker_type": "place",
                    "type": "INFOSTICKER"
                },
                "description": "",
                "ecefPose": {
                    "orientation": {
                        "w": 0.2144326929635223,
                        "x": 0.2953677415218236,
                        "y": 0.14079545389219456,
                        "z": 0.9203005800389348
                    },
                    "position": {
                        "x": 4166093.058332518,
                        "y": 626024.3768432491,
                        "z": 4772720.764265804
                    }
                },
                "geopose": {
                    "ellipsoidHeight": -0.9490814805030823,
                    "latitude": 48.75611158077768,
                    "longitude": 8.545700426348882,
                    "quaternion": {
                        "x": 0.03369506983713525,
                        "y": 0.30602725114310314,
                        "z": 0.010838757575863686,
                        "w": -0.9513645385238395
                    }
                },
                "id": "25519",
                "keywords": [
                    "place"
                ],
                "refs": [],
                "title": "parkplatz",
                "type": "placeholder",
                "url": ""
            },
            "id": "25519",
            "tenant": "AC",
            "timestamp": 1619696982316,
            "type": "scr"
        },
        {
            "content": {
                "custom_data": {
                    "path": "/media/models/Duck.glb",
                    "sticker_id": 25523,
                    "sticker_subtype": "gltf",
                    "sticker_text": "first",
                    "sticker_type": "other",
                    "type": "INFOSTICKER"
                },
                "description": "",
                "ecefPose": {
                    "orientation": {
                        "w": 0.9258142512020657,
                        "x": -0.21110588904593072,
                        "y": -0.30515319928392165,
                        "z": -0.071998616987224
                    },
                    "position": {
                        "x": 4166091.551286406,
                        "y": 626021.0190979425,
                        "z": 4772723.052048196
                    }
                },
                "geopose": {
                    "ellipsoidHeight": -0.8568757176399231,
                    "latitude": 48.7560834514246,
                    "longitude": 8.545731127889324,
                    "quaternion": {
                        "x": 0.030575819204840073,
                        "y":  -0.8192063719687788,
                        "z": -0.04386668473200756,
                        "w": -0.5710006596986791
                    }
                },
                "id": "25523",
                "keywords": [
                    "place"
                ],
                "refs": [],
                "title": "first",
                "type": "placeholder",
                "url": ""
            },
            "id": "25523",
            "tenant": "AC",
            "timestamp": 1619696982578,
            "type": "scr"
        },
        {
            "content": {
                "custom_data": {
                    // "path": "https://clv.zappar.io/6966846783932362010/1.0.12/",  // Unity
                    "path": "https://clv.zappar.io/6817336933886541943/",  // threejs
                    "sticker_id": 25532,
                    "sticker_subtype": "scene",
                    "sticker_text": "Picker",
                    "sticker_type": "other",
                    "type": "INFOSTICKER"
                },
                "description": "",
                "ecefPose": {
                    "orientation": {
                        "w": 0.8042543049156928,
                        "x": -0.26127504256379713,
                        "y": 0.21968396835100398,
                        "z": -0.48646615422598155
                    },
                    "position": {
                        "x": 4166092.0033649127,
                        "y": 626021.3217525029,
                        "z": 4772722.863883659
                    }
                },
                "geopose": {
                    "ellipsoidHeight": -0.4542122185230255,
                    "latitude": 48.756132830613595,
                    "longitude": 8.545662319589079,
                    "quaternion": {
                        "x": -0.11061927770517868,
                        "y": -0.5654197985215716,
                        "z": 0.07686378041725367,
                        "w": -0.8137295534142641
                    }
                },
                "id": "25532",
                "keywords": [
                    "other"
                ],
                "refs": [],
                "title": "Picker",
                "type": "placeholder",
                "url": "/Scene/"
            },
            "id": "25532",
            "tenant": "AC",
            "timestamp": 1619696982834,
            "type": "scr"
        }
    ]
}

export const locationAccessOptions = {
    enableHighAccuracy: false,
    maximumAge: 0
}


/**
 *  Promise resolving to the current location (lat, lon) and region code (country currently) of the device.
 *
 * @returns {Promise<LOCATIONINFO>}     Object with lat, lon, regionCode or rejects
 */
export function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                const latAngle = position.coords.latitude;
                const lonAngle = position.coords.longitude;

                fetch(`https://nominatim.openstreetmap.org/reverse?
                        lat=${latAngle}&lon=${lonAngle}&format=json&zoom=1&email=info%40michaelvogt.eu`)
                    .then((response) => {
                        if (response.ok) {
                            return response.json();
                        } else {
                            reject(response.text());
                        }
                    })
                    .then((data) => {
                        const countryCode = data.address.country_code;
                        resolve({
                            h3Index: h3.geoToH3(latAngle, lonAngle, 8),
                            lat: latAngle,
                            lon: lonAngle,
                            countryCode: countryCode,
                            regionCode: supportedCountries.includes(countryCode) ? countryCode : 'us'
                        })
                    })
                    .catch((error) => {
                        reject(error.statusText());
                    });
            }, (error) => {
                console.log(`Location request failed: ${error}`)
                reject(error);
            }, locationAccessOptions);
        } else {
            reject('Location is not available');
        }
    });
}

/**
 * Calculates the distance between two quaternions.
 *
 * Used to calculate the difference between the device rotation at the moment of localisation of the local and
 * global poses.
 *
 * @param localisationQuaternion  Quaternion        Rotation returned by a GeoPose service after localisation (Array)
 * @param localQuaternion  Quaternion       Rotation reported from WebGL at the moment localisation was started
 * @returns {{x, y, z}}
 */
export function calculateEulerRotation(localisationQuaternion, localQuaternion) {
    const diff = calculateRotation(localisationQuaternion, localQuaternion);

    const euler = vec3.create();
    getEuler(euler, diff);
    return euler;
}


/**
 * Returns an euler angle representation of a quaternion.
 *
 * Taken from gl-matrix issue #329. Will be remove when added to gl-matrix
 *
 * @param  {vec3} out Euler angles, pitch-yaw-roll
 * @param  {quat} mat Quaternion
 * @return {vec3} out
 */
export function getEuler(out, quat) {
    let x = quat[0],
        y = quat[1],
        z = quat[2],
        w = quat[3],
        x2 = x * x,
        y2 = y * y,
        z2 = z * z,
        w2 = w * w;
    let unit = x2 + y2 + z2 + w2;
    let test = x * w - y * z;
    if (test > 0.499995 * unit) { //TODO: Use glmatrix.EPSILON
        // singularity at the north pole
        out[0] = Math.PI / 2;
        out[1] = 2 * Math.atan2(y, x);
        out[2] = 0;
    } else if (test < -0.499995 * unit) { //TODO: Use glmatrix.EPSILON
        // singularity at the south pole
        out[0] = -Math.PI / 2;
        out[1] = 2 * Math.atan2(y, x);
        out[2] = 0;
    } else {
        out[0] = Math.asin(2 * (x * z - w * y));
        out[1] = Math.atan2(2 * (x * w + y * z), 1 - 2 * (z2 + w2));
        out[2] = Math.atan2(2 * (x * y + z * w), 1 - 2 * (y2 + z2));
    }
    // TODO: Return them as degrees and not as radians
    return out;
}

/**
 * * Converts a vector from ENU to WebXR
 * @param {*} geoVec3 vec3
 * @returns vec3
 */
export function convertGeo2WebVec3(geoVec3) {
    let webVec3 = vec3.fromValues(geoVec3[0], geoVec3[2], -geoVec3[1]);
    return webVec3;
}

/**
 * * Converts a vector from WebXR to ENU
 * @param {*} webVec3 vecc3
 * @returns vec3
 */
export function convertWeb2GeoVec3(webVec3) {
    let geoVec3 = vec3.fromValues(webVec3[0], -webVec3[2], webVec3[1]);
    return geoVec3;
}

/**
 * * Converts a quaternion from ENU to WebXR
 * @param {*} geoQuat quat
 * @returns quat
 */
export function convertGeo2WebQuat(geoQuat) {
    // WebXR: X to the right, Y up, Z backwards
    // Geo East-North-Up (with camera facing to North): X to the right, Y forwards, Z up
    let webQuat = quat.fromValues(geoQuat[0], geoQuat[2], -geoQuat[1], geoQuat[3]);
    return webQuat;
}

/**
 * * Converts a quaternion from WebXR to ENU
 * @param {*} webQuat quat
 * @returns quat
 */
export function convertWeb2GeoQuat(webQuat) {
    let geoQuat = vec3.fromValues(webQuat[0], -webQuat[2], webQuat[1], webQuat[3]);
    return geoQuat;
}

/**
 * * Converts a _camera_ position from AugmentedCity to WebXR
 * @param {*} acVec3 vec3
 * @returns vec3
 */
export function convertAugmentedCityCam2WebVec3(acVec3) {
    let webVec3 = vec3.fromValues(-acVec3[1], acVec3[2], -acVec3[0]);
    return webVec3;
}

/**
 * Converts a _camera_ quaternion from AugmentedCity to WebXR
 * @param {*} acQuat quaternion
 * @returns quat
 */
export function convertAugmentedCityCam2WebQuat(acQuat) {
    // WebXR: X to the right, Y up, Z backwards
    // AugmentedCity ENU (with camera facing to East): X forward, Y to the left, Z up

    let enuQuat = quat.create();
    let rotZm90 = quat.create();
    // Extra -90 deg rotation around UP axis to get the orientation w.r.t North instead of East
    quat.fromEuler(rotZm90,0,0,-90);
    quat.multiply(enuQuat, rotZm90, acQuat);
    // and now flip the axes from ENU to WebXR
    let webQuat4 = quat.fromValues(-enuQuat[1], enuQuat[2], -enuQuat[0], enuQuat[3]);
    return webQuat4;
}

/**
*  Calculates the relative position of two geodesic locations.
*
*  Used to calculate the relative distance between the device at the moment of localization and the
*  location of an object received from a content discovery service.
*
* @param cameraGeoPose  GeoPose of the camera returned by the localization service
* @param objectGeoPose  GeoPose of an object
* @returns vec3         Relative position of the object with respect to the camera
*/
export function getRelativeGlobalPosition(cameraGeoPose, objectGeoPose) {
    // We wrap them into LatLon object for easier calculation of relative displacement
    const cam = new LatLon(cameraGeoPose.latitude, cameraGeoPose.longitude);
    const cam2objLat = new LatLon(objectGeoPose.latitude, cameraGeoPose.longitude);
    const cam2objLon = new LatLon(cameraGeoPose.latitude, objectGeoPose.longitude);
    let dx = cam.distanceTo(cam2objLon);
    let dy = cam.distanceTo(cam2objLat);
    if (objectGeoPose.latitude < cameraGeoPose.latitude) {
        dy = -dy;
    }
    if (objectGeoPose.longitude < cameraGeoPose.longitude) {
        dx = -dx;
    }

    // OLD AugmentedCity API
    //const dz = objectGeoPose.altitude - cameraGeoPose.altitude;
    // NEW AugmentedCty API
    const dz = objectGeoPose.ellipsoidHeight - cameraGeoPose.ellipsoidHeight;
    //console.log("dx: " + dx + ", dy: " + dy + ", dz: " + dz);

    // WARNING: AugmentedCity sometimes returns invalid height!
    // Therefore we set dz to 0
    if (isNaN(dz)) {
        console.log("WARNING: dz is not a number");
        dz = 0.0;
    }

    // WARNING: in the next step, change of coordinate axes might be necessary to match WebXR coordinate system
    return vec3.fromValues(dx, dy, dz);
}

/**
*  Calculates the relative orientation of two geodesic locations.
*
*  Used to calculate the relative orientation between the device at the moment of localization and the
*  location of an object received from a content discovery service.
*
* @param cameraGeoPose  GeoPose of the camera returned by the localization service
* @param objectGeoPose  GeoPose of an object
* @returns quat         Relative orientation of the object with respect to the camera
*/
export function getRelativeGlobalOrientation(cameraGeoPose, objectGeoPose) {
    // camera orientation
    const qCam = quat.fromValues(
            cameraGeoPose.quaternion.x,
            cameraGeoPose.quaternion.y,
            cameraGeoPose.quaternion.z,
            cameraGeoPose.quaternion.w);
    // object orientation
    const qObj = quat.fromValues(
            objectGeoPose.quaternion.x,
            objectGeoPose.quaternion.y,
            objectGeoPose.quaternion.z,
            objectGeoPose.quaternion.w);

    qRel = getRelativeOrientation(qCam, qObj)

    // WARNING: in the next step, change of coordinate axes might be necessary to match WebXR coordinate system
    return qRel;
}

/**
*  Calculates the relative orientation between two quaternions
*  NOTE that they must be defined in the same coordinate system!
*
* @param q1  quat First quaternion
* @param q2  quat Second quaternion
* @returns  quat  The rotation which brings q1 into q2
*/
export function getRelativeOrientation(q1, q2) {

    // NOTE: if q2 = qdiff * q1, then  qdiff = q2 * inverse(q1)
    let q1Inv = quat.create();
    quat.invert(q1Inv, q1);
    let qRel = quat.create();
    quat.multiply(qRel, q2, q1Inv);

    //assert(quat.length(qRel) == 1.0, "Quaternion is not normalized!");
    const qNorm = quat.create();
    quat.normalize(qNorm, qRel);
    return qNorm;
}


const a = 6378137;
const b = 6356752.3142;
const f = (a - b) / a;
const e_sq = f * (2 - f);

/**
* Converts WGS-84 Geodetic point (lat, lon, h) to the
* Earth-Centered Earth-Fixed (ECEF) coordinates (x, y, z).
*/
export function geodetic_to_ecef(lat, lon, h) {
    let lamb = toRadians(lat);
    let phi = toRadians(lon);
    let s = Math.sin(lamb);
    let N = a / Math.sqrt(1 - e_sq * s * s);

    let sin_lambda = Math.sin(lamb);
    let cos_lambda = Math.cos(lamb);
    let sin_phi = Math.sin(phi);
    let cos_phi = Math.cos(phi);

    let x = (h + N) * cos_lambda * cos_phi;
    let y = (h + N) * cos_lambda * sin_phi;
    let z = (h + (1 - e_sq) * N) * sin_lambda;

    return { "x": x, "y": y, "z": z };
}

/**
* Converts the Earth-Centered Earth-Fixed (ECEF) coordinates (x, y, z) to
* East-North-Up coordinates in a Local Tangent Plane that is centered at the
* (WGS-84) Geodetic point (lat_ref, lon_ref, h_ref).
*/
export function ecef_to_enu(x, y, z, lat_ref, lon_ref, h_ref) {
    let lamb = toRadians(lat_ref);
    let phi = toRadians(lon_ref);
    let s = Math.sin(lamb);
    let N = a / Math.sqrt(1 - e_sq * s * s);

    let sin_lambda = Math.sin(lamb);
    let cos_lambda = Math.cos(lamb);
    let sin_phi = Math.sin(phi);
    let cos_phi = Math.cos(phi);

    let x0 = (h_ref + N) * cos_lambda * cos_phi;
    let y0 = (h_ref + N) * cos_lambda * sin_phi;
    let z0 = (h_ref + (1 - e_sq) * N) * sin_lambda;

    let xd = x - x0;
    let yd = y - y0;
    let zd = z - z0;

    let xEast = -sin_phi * xd + cos_phi * yd;
    let yNorth = -cos_phi * sin_lambda * xd - sin_lambda * sin_phi * yd + cos_lambda * zd;
    let zUp = cos_lambda * cos_phi * xd + cos_lambda * sin_phi * yd + sin_lambda * zd;

    return { "x": xEast, "y": yNorth, "z": zUp }
}

export function geodetic_to_enu(lat, lon, h, lat_ref, lon_ref, h_ref) {
    let ecef = geodetic_to_ecef(lat, lon, h);
    let enu = ecef_to_enu(ecef.x, ecef.y, ecef.z, lat_ref, lon_ref, h_ref);
    return enu;
}
