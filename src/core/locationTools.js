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
 *  Calculates the relative distance of two geodesic locations.
 *
 *  Used to calculate the relative distance between the device location at the moment of localisation and the
 *  location of an object as received from content discovery service.
 *
 * @param localisationPose  XRPose      Local pose provided by the XRSession for the latest localisation
 * @param objectPose  GeoPose       Global position as provided by a request to a Spatial Content Discovery server
 * @returns {[x,y,z]}      Local location of the global GeoPose relative to the provided local pose
 */
export function calculateDistance(localisationPose, objectPose) {
    const centerPoint = new LatLon(localisationPose.latitude, localisationPose.longitude);
    const latDiff = new LatLon( objectPose.latitude, localisationPose.longitude );
    const lonDiff = new LatLon( localisationPose.latitude, objectPose.longitude );

    const xValue = centerPoint.distanceTo(lonDiff);
    const yValue = centerPoint.distanceTo(latDiff);

    // TODO: Add y-value when receiving valid height value from GeoPose service
    // Ground plane for geodesic values is x/y, for 3D it's x/-z
    return {x:xValue, y:0.0, z:-yValue};
}


/**
 * Calculates the distance between two quaternions.
 *
 * Used to calculate the difference between the device rotation at the moment of localisation of the local and
 * global poses.
 *
 * @param localisationQuaternion  Quaternion        Rotation returned by a GeoPose service after localisation (Array)
 * @param localQuaternion  Quaternion       Rotation reported from WebGL at the moment localisation was started
 * @returns {{x, y, z, w}}
 */
export function calculateRotation(localisationQuaternion, localQuaternion) {
    const global = quat.fromValues(localisationQuaternion.x, localisationQuaternion.y, localisationQuaternion.z, localisationQuaternion.w);
    const local = quat.fromValues(localQuaternion.x, localQuaternion.y, localQuaternion.z, localQuaternion.w);

    const localInv = quat.create();
    quat.invert(localInv, local);

    const diff = quat.create();
    quat.multiply(diff, global, localInv);

    const norm = quat.create();
    quat.normalize(norm, diff);
    return {x:norm[0], y:norm[1], z:norm[2], w:norm[3]};
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
function getEuler(out, quat) {
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
