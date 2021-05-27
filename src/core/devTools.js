
import { quat, vec3 } from 'gl-matrix';
import { getEuler, getRelativeOrientation, toRadians, toDegrees } from '@core/locationTools';
import { Quat, Euler, Vec3, Mat4, Transform } from 'ogl';

// Here a good source of test quaternions:
// https://www.euclideanspace.com/maths/geometry/rotations/conversions/eulerToQuaternion/steps/index.htm

/**
 * Pretty logging of a gl-matrix quaternion
* @param name The name to print
* @param qquat quat from gl-matrix package
*/
export function printGlmQuat(name, qquat) {
    console.log(name + ":")
    let axis = vec3.create();
    let angle = quat.getAxisAngle(axis, qquat);
    console.log("  values: x: " + qquat[0] + ", y: " + qquat[1] + ", z: " + qquat[2] + ", w: " + qquat[3]);
    console.log("  axis: " + vec3.str(axis) + ", angle: " + toDegrees(angle));

    let euler = vec3.create();
    getEuler(euler, qquat);
    //console.log("  MV Euler angles (rad): " + vec3.str(euler));
    console.log("  MV Euler angles: " + toDegrees(euler[0]) + ", " + toDegrees(euler[1]) + ", " + toDegrees(euler[2]));

    let qQuat = new Quat(qquat[0], qquat[1], qquat[2], qquat[3]);
    let eulerOgl = getEulerDegreesOgl(qQuat, /*'XYZ'*/);
    console.log("  OGL Euler angles: " + eulerOgl[0] + ", " + eulerOgl[1] + ", " + eulerOgl[2]);
}

/**
 * Pretty logging of a quaternion given by 4 float numbers
 * @param  {name} string The name to print
 * @param  {x} float quaternion component x
 * @param  {y} float quaternion component y
 * @param  {z} float quaternion component z
 * @param  {w} float quaternion component w
*/
export function printQuat(name, x, y, z, w) {
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
export function getEulerAnglesOgl(quat, order = 'XYZ') {
    let euler = new Euler();
    euler.fromQuaternion(quat, order = 'XYZ');
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
 export function getEulerDegreesOgl(quat, order = 'XYZ') {
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
export function printOglTransform(name, transform) {
    let tPos = new Vec3(transform.position[0], transform.position[1], transform.position[2]);
    let tQuat = new Quat(transform.quaternion[0], transform.quaternion[1], transform.quaternion[2], transform.quaternion[3]);
    let tEuler = getEulerDegreesOgl(tQuat, 'XYZ');
    console.log("transform " + name + "\n" +
            "  position (" + tPos[0] + ", " + tPos[1] + ", " +  tPos[2] + ") \n" +
            "  orientation (" + tEuler[0] +  ", " + tEuler[1] + ", " +  tEuler[2] + ")");
}

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
                        "y": -0.8192063719687788,
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
                    // "path": "https://clv.zappar.io/6817336933886541943/",  // threejs
                    "path": "/media/scenes/waypoint/",  // threejs
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
