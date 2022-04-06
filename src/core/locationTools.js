/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

/*
    Utility function helping with calculations around GeoPose.
 */

import LatLon from 'geodesy/latlon-ellipsoidal-vincenty.js';
import {quat, vec3} from 'gl-matrix';
import * as h3 from "h3-js";
import {supportedCountries} from '@oarc/ssd-access';

export const toRadians = (degrees) => degrees / 180 * Math.PI;
export const toDegrees = (radians) => radians / Math.PI * 180;

export const locationAccessOptions = {
    enableHighAccuracy: false,
    maximumAge: 0
}

/**
 *
 * @param latitude number in degrees
 * @returns Earth radius in meters at input latitude
 */
export function getEarthRadiusAt(latitude) {
    // https://en.wikipedia.org/wiki/Earth_ellipsoid
    // https://rechneronline.de/earth-radius/

    let lat = toRadians(latitude);
    const r1 = 6378137.0; // at Equator
    const r2 = 6356752.3142; // at poles
    let cosLat = Math.cos(lat);
    let sinLat = Math.sin(lat);

    let numerator = (r1 * r1 * cosLat) * (r1 * r1 * cosLat) + (r2 * r2 * sinLat) * (r2 * r2 * sinLat);
    let denominator = (r1 * cosLat) * (r1 * cosLat) +  (r2 * sinLat) * (r2 * sinLat);

    return Math.sqrt(numerator / denominator);
}

// stores the UTC timestamp of the last query to getCurrentLocation(). We must not call the OpenStreetMap API higher than 1 Hz.
// This is important in case the SSD is not available and the client keeps retrying this call.
let lastTimeCurrentLocationQuery = 0;

/**
 *  Promise resolving to the current location (lat, lon) and region code (country currently) of the device.
 *
 * @returns {Promise<LOCATIONINFO>}     Object with lat, lon, regionCode or rejects
 */
export function getCurrentLocation() {
    console.log("getCurrentLocation...");
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            reject('Location is not available');
        }

        let now = Date.now();
        if (now - lastTimeCurrentLocationQuery < 1200) { // we want at least 1.2 secs between calls
            reject('Too frequent calls to current location are not allowed (OpenStreetMap)');
        }
        lastTimeCurrentLocationQuery = now;

        navigator.geolocation.getCurrentPosition((position) => {
            const latAngle = position.coords.latitude;
            const lonAngle = position.coords.longitude;

            // WARNING: more than 1 request in a second leads to IP address ban!
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
                    // TODO: refactor: use US as default and resolve
                    console.error('Could not retrieve country code.');
                    reject(error);
                });
        }, (error) => {
            console.log(`Location request failed: ${error}`)
            reject(error);
        }, locationAccessOptions);
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
 * @param out  Array
 * @param quat  Quaternion
 * @returns Array
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
    // X_WebXR =  X_ENU
    // Y_WebXR =  Z_ENU
    // Z_WebXR = -Y_ENU
    return vec3.fromValues(geoVec3[0], geoVec3[2], -geoVec3[1]);
}

/**
 * * Converts a vector from WebXR to ENU
 * @param {*} webVec3 vecc3
 * @returns vec3
 */
export function convertWeb2GeoVec3(webVec3) {
    // X_ENU =  X_WebXR
    // Y_ENU = -Z_WebXR
    // Z_ENU =  Y_WebXR
    return vec3.fromValues(webVec3[0], -webVec3[2], webVec3[1]);
}

/**
 * * Converts a quaternion from ENU to WebXR
 * @param {*} geoQuat quat
 * @returns quat
 */
export function convertGeo2WebQuat(geoQuat) {
    // WebXR: X to the right, Y up, Z backwards
    // Geo East-North-Up (with camera facing to North): X to the right, Y forwards, Z up
    // X_WebXR =  X_ENU
    // Y_WebXR =  Z_ENU
    // Z_WebXR = -Y_ENU
    return quat.fromValues(geoQuat[0], geoQuat[2], -geoQuat[1], geoQuat[3]);
}

/**
 * * Converts a quaternion from WebXR to ENU
 * @param {*} webQuat quat
 * @returns quat
 */
export function convertWeb2GeoQuat(webQuat) {
    // X_ENU =  X_WebXR
    // Y_ENU = -Z_WebXR
    // Z_ENU =  Y_WebXR
    return quat.fromValues(webQuat[0], -webQuat[2], webQuat[1], webQuat[3]);
}

/**
 * * Converts a _camera_ position from AugmentedCity to WebXR
 * @param {*} acVec3 vec3
 * @returns vec3
 */
export function convertAugmentedCityCam2WebVec3(acVec3) {
    // flip the axes from ENU to WebXR
    // X_WebXR = -Y_AC
    // Y_WebXR =  Z_AC
    // Z_WebXR = -X_AC
    return vec3.fromValues(-acVec3[1], acVec3[2], -acVec3[0]);
}

/**
 * Converts a _camera_ quaternion from AugmentedCity to WebXR
 * @param {*} acQuat quaternion
 * @returns quat
 */
export function convertAugmentedCityCam2WebQuat(acQuat) {
    // WebXR: X to the right, Y up, Z backwards
    // AugmentedCity cameraENU (with camera facing to East): X forward, Y to the left, Z up

    // first from AC to ENU
    // Extra -90 deg rotation around UP axis to get the orientation w.r.t North instead of East
    // This is equivalent to rotating the coordinate sytem the opposite direction (+90 degrees around UP)
    // X_ACrot =  Y_AC
    // Y_ACrot = -X_AC
    // Z_ACRot =  Z_AC
    let enuQuat = quat.create();
    let rotZm90 = quat.create();
    quat.fromEuler(rotZm90, 0, 0, -90); // [0, 0, -0.7071, 0.7071]
    quat.multiply(enuQuat, rotZm90, acQuat);  // enuQuat holds the orientation w.r.t North
    // X_ENU = -Y_ACrot = X_AC
    // Y_ENU =  X_ACrot = Y_AC
    // Z_ENU =  Z_ACrot = Z_AC
    // The ENU cooridate axes are the same as the AC coordinate axes,
    // but the orientation quaternion is different because the zero orientation is different

    // and now flip the axes from ENU to WebXR
    // X_WebXR =  X_ENU = -Y_ACrot
    // Y_WebXR =  Z_ENU =  Z_ACrot
    // Z_WebXR = -Y_ENU = -X_ACrot
    return quat.fromValues(-enuQuat[1], enuQuat[2], -enuQuat[0], enuQuat[3]);
}

/**
* Converts a quaternion from Sensor ENU (X to right, Y forward, Z up) (for example W3C Sensor API)
* to AugmentedCity's cameraENU quaternion (X forward, Y to the left, Z up)
* @param {*} sensorQuat quaternion
* @returns quat
*/
export function convertSensor2AugmentedCityCam(sensorQuat) {
    // NOTE: In our GeoPoseRequest to AugmentedCity, we always set ImageOrientation.mirrored = false and rotation = 0;
    // This is only correct because instead of the actual camera image, 
    // we capture the camera texture which is always rotated according to the screen orientation.

    // At unit quaternion orientation in the WebXR coordinate system, the (back) camera looks in the direction of North
    // At unit quaternion orientation in the W3C Sensor API coordinate system, the (back) camera looks in the direction of gravity
    // At unit quaternion orientation in the AugmentedCity coordinate system, the (back) camera looks towards East.

    /*
    // https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
    let orientation = (screen.orientation || {}).type || screen.mozOrientation || screen.msOrientation;
    let displayTransform = quat.create();
    if (orientation === "landscape-primary") {
        console.log("Screen orienation: landscape-primary");
        quat.fromEuler(displayTransform, 0, 0, 0);
    } else if (orientation === "landscape-secondary") {
        console.log("Screen orienation: landscape-secondary (upside down)");
        quat.fromEuler(displayTransform, 0, 0, 180);
    } else if (orientation === "portrait-primary") {
        console.log("Screen orienation: portrait-primary");
        quat.fromEuler(displayTransform, 0, 0, 90);
    } else if (orientation === "portrait-secondary") {
        console.log("Screen orienation: portrait-secondary (upside down)");
        quat.fromEuler(displayTransform, 0, 0, 270);
    } else {
        console.log("Cannot retrieve screen orientation. Assuming landscape-primary");
        quat.fromEuler(displayTransform, 0, 0, 0);
    }
    
    let screenQuat = quat.create();
    quat.multiply(screenQuat, displayTransform, sensorQuat);
    */

    // The code below works well in landscape-primary orientation and 'device' reference of Sensor
    let screenQuat = sensorQuat;

    // We additionally rotate +90 degrees around the North axis,
    // which is equivalent to rotating the Sensor coordinate system by -90 degrees aroung the North axis,
    // so that the (back) camera looks towards East instead of towards the ground.
    let sensorRotQuat = quat.create();
    let rotY90 = quat.create();
    quat.fromEuler(rotY90, 0, 90, 0);
    quat.multiply(sensorRotQuat, rotY90, screenQuat);

    // Then we swap the axes from Sensor coordinate sytstem to AC (camera) coordinate system
    // X_AC = -Z_SensorRot
    // Y_AC =  Y_SensorRot
    // Z_AC =  X_SensorRot
    return quat.fromValues(-sensorRotQuat[2], sensorRotQuat[1], sensorRotQuat[0], sensorRotQuat[3]);
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
    let dz = objectGeoPose.ellipsoidHeight - cameraGeoPose.ellipsoidHeight;
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
        cameraGeoPose.quaternion.x, cameraGeoPose.quaternion.y, cameraGeoPose.quaternion.z, cameraGeoPose.quaternion.w);
    // object orientation
    const qObj = quat.fromValues(
        objectGeoPose.quaternion.x, objectGeoPose.quaternion.y, objectGeoPose.quaternion.z, objectGeoPose.quaternion.w);

    // WARNING: in the next step, change of coordinate axes might be necessary to match WebXR coordinate system
    return getRelativeOrientation(qCam, qObj);
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
    let { x0, y0, z0} = geodetic_to_ecef(lat_ref, lon_ref, h_ref);

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
    return ecef_to_enu(ecef.x, ecef.y, ecef.z, lat_ref, lon_ref, h_ref);
}
