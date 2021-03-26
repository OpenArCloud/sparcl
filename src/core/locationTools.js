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
        "ecef": {
            "quaternion": [
                0.18475762942989385,
                0.19376046404179365,
                0.9382047195400572,
                0.2193020865712806
            ],
            "x": 4166094.007979741,
            "y": 626020.0970524579,
            "z": 4772721.848253169
        },
        "id": "1adc076d-5a33-4f06-aacb-e8c2e94499b9",
        "pose": {
            "altitude": 0.06582733851264133,
            "ellipsoidHeight": -1,
            "latitude": 48.756115957414345,
            "longitude": 8.545640947400223,
            "quaternion": [
                0.13936200826179151,
                0.33341690000800994,
                0.06575967542722623,
                -0.9301005679656341
            ]
        },
        "timestamp": "Thu, 25 Mar 2021 13:05:31 GMT",
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
                    "sticker_type": "place"
                },
                "description": "",
                "geopose": {
                    "ecef": {
                        "quaternion": [
                            0.2953677415218236,
                            0.14079545389219456,
                            0.9203005800389348,
                            0.2144326929635223
                        ],
                        "x": 4166093.058332518,
                        "y": 626024.3768432491,
                        "z": 4772720.764265804
                    },
                    "pose": {
                        "altitude": -0.9490814805030823,
                        "ellipsoidHeight": -1,
                        "latitude": 48.75611158077768,
                        "longitude": 8.545700426348882,
                        "quaternion": [
                            0.03369506983713525,
                            0.30602725114310314,
                            0.010838757575863686,
                            -0.9513645385238395
                        ]
                    }
                },
                "id": "25519",
                "keywords": [
                    "place"
                ],
                "refs": [
                    {
                        "contentType": "",
                        "url": ""
                    }
                ],
                "title": "parkplatz",
                "type": "placeholder",
                "url": ""
            },
            "id": "25519",
            "tenant": "AC",
            "timestamp": "2021-03-25T13:05:31.956283",
            "type": "scr"
        },
        {
            "content": {
                "custom_data": {
                    "path": "",
                    "sticker_id": 25523,
                    "sticker_subtype": "hit",
                    "sticker_text": "first",
                    "sticker_type": "place"
                },
                "description": "",
                "geopose": {
                    "ecef": {
                        "quaternion": [
                            -0.19756436724107565,
                            0.31699256462651565,
                            -0.4874473906608002,
                            0.7892268850629169
                        ],
                        "x": 4166091.7777031483,
                        "y": 626021.3510231776,
                        "z": 4772722.391498527
                    },
                    "pose": {
                        "altitude": -0.8568757176399231,
                        "ellipsoidHeight": -1,
                        "latitude": 48.756132830613595,
                        "longitude": 8.545662319589079,
                        "quaternion": [
                            0.030575819204840073,
                            -0.8192063719687788,
                            -0.04386668473200756,
                            -0.5710006596986791
                        ]
                    }
                },
                "id": "25523",
                "keywords": [
                    "place"
                ],
                "refs": [
                    {
                        "contentType": "",
                        "url": ""
                    }
                ],
                "title": "first",
                "type": "placeholder",
                "url": ""
            },
            "id": "25523",
            "tenant": "AC",
            "timestamp": "2021-03-25T13:05:32.246384",
            "type": "scr"
        },
        {
            "content": {
                "custom_data": {
                    "path": "/Scene/",
                    "sticker_id": 25532,
                    "sticker_subtype": "Playcanvas",
                    "sticker_text": "Picker",
                    "sticker_type": "other"
                },
                "description": "",
                "geopose": {
                    "ecef": {
                        "quaternion": [
                            0.3997884862207025,
                            -0.09861601172454185,
                            0.6785433043553545,
                            -0.6082951854415918
                        ],
                        "x": 4166091.526686034,
                        "y": 626021.3055765239,
                        "z": 4772723.150585335
                    },
                    "pose": {
                        "altitude": -0.4542122185230255,
                        "ellipsoidHeight": -1,
                        "latitude": 48.756139054833376,
                        "longitude": 8.54566221566234,
                        "quaternion": [
                            -0.11061927770517868,
                            -0.5654197985215716,
                            0.07686378041725367,
                            -0.8137295534142641
                        ]
                    }
                },
                "id": "25532",
                "keywords": [
                    "other"
                ],
                "refs": [
                    {
                        "contentType": "",
                        "url": ""
                    }
                ],
                "title": "Picker",
                "type": "placeholder",
                "url": "/Scene/"
            },
            "id": "25532",
            "tenant": "AC",
            "timestamp": "2021-03-25T13:05:32.543188",
            "type": "scr"
        }
    ]
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
            }, {
                enableHighAccuracy: false,
                maximumAge: 0
            });
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
    const global = quat.fromValues(localisationQuaternion[0], localisationQuaternion[1], localisationQuaternion[2], localisationQuaternion[3]);
    const local = quat.fromValues(localQuaternion.x, localQuaternion.y, localQuaternion.z, localQuaternion.w);

    const localInv = quat.create();
    quat.invert(localInv, local);

    const diff = quat.create();
    quat.multiply(diff, global, localInv);

    const norm = quat.create();
    quat.normalize(norm, diff);
    return norm;
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
