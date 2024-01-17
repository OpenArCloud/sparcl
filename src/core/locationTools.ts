/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/*
  Utility functions helping with calculations around GeoPose.
*/

import LatLon from 'geodesy/latlon-ellipsoidal-vincenty';
import { quat, vec3, type ReadonlyQuat } from 'gl-matrix';
import * as h3 from 'h3-js';
import { supportedCountries } from '@oarc/ssd-access';
import type { Geopose } from '@oarc/scd-access';
import { Quat, type Vec3 } from 'ogl';
import type { OldFormatGeopose } from '../types/xr';

export const toRadians = (degrees: number) => (degrees / 180) * Math.PI;
export const toDegrees = (radians: number) => (radians / Math.PI) * 180;

export const locationAccessOptions = {
    enableHighAccuracy: false,
    maximumAge: 0,
};

/**
 *
 * @param geoPose a GeoPose entry in old or new format
 * @returns The same GeoPose formatted according to the new (March 2022) standard
 */
export function upgradeGeoPoseStandard(geoPose: OldFormatGeopose | Geopose): Geopose {
    if ('position' in geoPose) {
        return geoPose;
    }
    const { latitude, longitude, ellipsoidHeight, ...quaternion } = geoPose;
    const newFormatGeopose: Geopose = {
        position: {
            lat: geoPose.latitude,
            lon: geoPose.longitude,
            h: geoPose.ellipsoidHeight,
        },
        ...quaternion,
    };
    return newFormatGeopose;
}

/**
 *
 * @param latitude number in degrees
 * @returns Earth radius in meters at input latitude
 */
export function getEarthRadiusAt(latitude: number) {
    // https://en.wikipedia.org/wiki/Earth_ellipsoid
    // https://rechneronline.de/earth-radius/

    let lat = toRadians(latitude);
    const r1 = 6378137.0; // at Equator
    const r2 = 6356752.3142; // at poles
    let cosLat = Math.cos(lat);
    let sinLat = Math.sin(lat);

    let numerator = r1 * r1 * cosLat * (r1 * r1 * cosLat) + r2 * r2 * sinLat * (r2 * r2 * sinLat);
    let denominator = r1 * cosLat * (r1 * cosLat) + r2 * sinLat * (r2 * sinLat);

    return Math.sqrt(numerator / denominator);
}

// stores the UTC timestamp of the last query to getCurrentLocation(). We must not call the OpenStreetMap API higher than 1 Hz.
// This is important in case the SSD is not available and the client keeps retrying this call.
let lastTimeCurrentLocationQuery = 0;

/**
 *  Promise resolving to the current location (lat, lon) and region code (country currently) of the device.
 */
export function getCurrentLocation() {
    console.log('getCurrentLocation...');
    return new Promise<{ h3Index: h3.H3Index; lat: number; lon: number; countryCode: string; regionCode: string }>((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            reject('Location is not available');
        }

        let now = Date.now();
        if (now - lastTimeCurrentLocationQuery < 1200) {
            // we want at least 1.2 secs between calls
            reject('Too frequent calls to current location are not allowed (OpenStreetMap)');
        }
        lastTimeCurrentLocationQuery = now;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latAngle = position.coords.latitude;
                const lonAngle = position.coords.longitude;
                console.log('GPS location: (' + latAngle + ', ' + lonAngle + ')');

                // WARNING: more than 1 request in a second leads to IP address ban!
                fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latAngle}&lon=${lonAngle}&format=json&zoom=1&email=info%40michaelvogt.eu`)
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
                            regionCode: supportedCountries.includes(countryCode) ? countryCode : 'us',
                        });
                    })
                    .catch((error) => {
                        // TODO: refactor: use US as default and resolve
                        console.error('Could not retrieve country code.');
                        reject(error);
                    });
            },
            (error) => {
                console.log(`Location request failed: ${error}`);
                reject(error);
            },
            locationAccessOptions,
        );
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
// export function calculateEulerRotation(localisationQuaternion: ReadonlyQuat, localQuaternion: ReadonlyQuat) {
//     const diff = calculateRotation(localisationQuaternion, localQuaternion);

//     const euler = vec3.create();
//     getEuler(euler, diff);
//     return euler;
// }

/**
 * Returns an euler angle representation of a quaternion.
 *
 * Taken from gl-matrix issue #329. Will be remove when added to gl-matrix
 *
 * @param out  Array
 * @param quat  Quaternion
 * @returns Array
 */
export function getEuler(out: vec3, quat: ReadonlyQuat) {
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
    if (test > 0.499995 * unit) {
        //TODO: Use glmatrix.EPSILON
        // singularity at the north pole
        out[0] = Math.PI / 2;
        out[1] = 2 * Math.atan2(y, x);
        out[2] = 0;
    } else if (test < -0.499995 * unit) {
        //TODO: Use glmatrix.EPSILON
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
export function convertGeo2WebVec3(geoVec3: vec3) {
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
export function convertWeb2GeoVec3(webVec3: vec3) {
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
export function convertGeo2WebQuat(geoQuat: ReadonlyQuat) {
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
export function convertWeb2GeoQuat(webQuat: ReadonlyQuat) {
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
export function convertAugmentedCityCam2WebVec3(acVec3: vec3) {
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
export function convertAugmentedCityCam2WebQuat(acQuat: ReadonlyQuat) {
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
    quat.multiply(enuQuat, rotZm90, acQuat); // enuQuat holds the orientation w.r.t North
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
export function convertSensor2AugmentedCityCam(sensorQuat: ReadonlyQuat) {
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
export function getRelativeGlobalPosition(cameraGeoPose: Geopose, objectGeoPose: Geopose) {
    // We wrap them into LatLon object for easier calculation of relative displacement
    const cam = new LatLon(cameraGeoPose.position.lat, cameraGeoPose.position.lon);
    const cam2objLat = new LatLon(objectGeoPose.position.lat, cameraGeoPose.position.lon);
    const cam2objLon = new LatLon(cameraGeoPose.position.lat, objectGeoPose.position.lon);
    let dx = cam.distanceTo(cam2objLon);
    let dy = cam.distanceTo(cam2objLat);
    if (objectGeoPose.position.lat < cameraGeoPose.position.lat) {
        dy = -dy;
    }
    if (objectGeoPose.position.lon < cameraGeoPose.position.lon) {
        dx = -dx;
    }

    // OLD AugmentedCity API
    //const dz = objectGeoPose.altitude - cameraGeoPose.altitude;
    // OLD GeoPose
    //let dz = objectGeoPose.ellipsoidHeight- cameraGeoPose.ellipsoidHeight;
    // NEW AugmentedCity API and NEW GeoPose
    let dz = objectGeoPose.position.h - cameraGeoPose.position.h;
    //console.log("dx: " + dx + ", dy: " + dy + ", dz: " + dz);

    // WARNING: AugmentedCity sometimes returns invalid height!
    // Therefore we set dz to 0
    if (isNaN(dz)) {
        console.log('WARNING: dz is not a number');
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
export function getRelativeGlobalOrientation(cameraGeoPose: Geopose, objectGeoPose: Geopose) {
    // camera orientation
    const qCam = quat.fromValues(cameraGeoPose.quaternion.x, cameraGeoPose.quaternion.y, cameraGeoPose.quaternion.z, cameraGeoPose.quaternion.w);
    // object orientation
    const qObj = quat.fromValues(objectGeoPose.quaternion.x, objectGeoPose.quaternion.y, objectGeoPose.quaternion.z, objectGeoPose.quaternion.w);

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
export function getRelativeOrientation(q1: ReadonlyQuat, q2: ReadonlyQuat) {
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

// Constants of the WGS84 Earth ellipsoid
const a = 6378137.0; // Earth ellipsoid radius at equator
const b = 6356752.3142; // Earth ellipsoid radius at poles
const f = (a - b) / a;
const e_sq = f * (2 - f);

/**
 * Converts WGS-84 Geodetic point (lat, lon, h) to the
 * Earth-Centered Earth-Fixed (ECEF) coordinates (x, y, z).
 */
export function convertGeodeticToEcef(lat: number, lon: number, h: number) {
    const lamb = toRadians(lat);
    const phi = toRadians(lon);

    const sin_lambda = Math.sin(lamb);
    const cos_lambda = Math.cos(lamb);
    const sin_phi = Math.sin(phi);
    const cos_phi = Math.cos(phi);

    const nu = a / Math.sqrt(1 - e_sq * sin_lambda * sin_lambda);

    const x = (h + nu) * cos_lambda * cos_phi;
    const y = (h + nu) * cos_lambda * sin_phi;
    const z = (h + (1 - e_sq) * nu) * sin_lambda;

    return { x: x, y: y, z: z };
}

/**
 * Converts the Earth-Centered Earth-Fixed (ECEF) coordinates (x, y, z) to
 * East-North-Up coordinates in a Local Tangent Plane that is centered at the
 * (WGS-84) Geodetic point (lat0, lon0, h0).
 */
export function convertEcefToEnu(x: number, y: number, z: number, lat0: number, lon0: number, h0: number) {
    const ecef_ref = convertGeodeticToEcef(lat0, lon0, h0);

    const xd = x - ecef_ref.x;
    const yd = y - ecef_ref.y;
    const zd = z - ecef_ref.z;

    const lamb = toRadians(lat0);
    const phi = toRadians(lon0);

    const sin_lambda = Math.sin(lamb);
    const cos_lambda = Math.cos(lamb);
    const sin_phi = Math.sin(phi);
    const cos_phi = Math.cos(phi);

    const t = -cos_phi * xd - sin_phi * yd;

    const xEast = -sin_phi * xd + cos_phi * yd;
    const yNorth = t * sin_lambda + cos_lambda * zd;
    const zUp = cos_lambda * cos_phi * xd + cos_lambda * sin_phi * yd + sin_lambda * zd;

    return { x: xEast, y: yNorth, z: zUp };
}

export function convertGeodeticToEnu(lat: number, lon: number, h: number, lat0: number, lon0: number, h0: number) {
    let ecef = convertGeodeticToEcef(lat, lon, h);
    return convertEcefToEnu(ecef.x, ecef.y, ecef.z, lat0, lon0, h0);
}

export function convertEnuToEcef(xEast: number, yNorth: number, zUp: number, lat0: number, lon0: number, h0: number) {
    const lamb = toRadians(lat0);
    const phi = toRadians(lon0);

    const sin_lambda = Math.sin(lamb);
    const cos_lambda = Math.cos(lamb);
    const sin_phi = Math.sin(phi);
    const cos_phi = Math.cos(phi);

    const nu = a / Math.sqrt(1 - e_sq * sin_lambda * sin_lambda);

    const x0 = (h0 + nu) * cos_lambda * cos_phi;
    const y0 = (h0 + nu) * cos_lambda * sin_phi;
    const z0 = (h0 + (1 - e_sq) * nu) * sin_lambda;

    const t = cos_lambda * zUp - sin_lambda * yNorth;

    const zd = sin_lambda * zUp + cos_lambda * yNorth;
    const xd = cos_phi * t - sin_phi * xEast;
    const yd = sin_phi * t + cos_phi * xEast;

    const x = xd + x0;
    const y = yd + y0;
    const z = zd + z0;

    return { x: x, y: y, z: z };
}

// Convert from ECEF cartesian coordinates to
// latitude, longitude and height (WGS-84)
// Uses Bowring’s (1985) formulation for μm precision in concise form; ‘The accuracy of geodetic
// latitude and height equations’, B R Bowring, Survey Review vol 28, 218, Oct 1985.
// ported from https://github.com/chrisveness/geodesy/blob/master/latlon-ellipsoidal.js#L378
// Formula from http://www.movable-type.co.uk/scripts/latlong-os-gridref.html#cartesian-to-geodetic
export function convertEcefToGeodetic(x: number, y: number, z: number) {
    const e1_sq = 2 * f - f * f; // 1st eccentricity squared = (a^2 − b^2) / a^2
    const e2_sq = e1_sq / (1 - e1_sq); // 2nd eccentricity squared = (a^2 − b^2) / b^2
    const p = Math.sqrt(x * x + y * y); // distance from minor axis
    const R = Math.sqrt(p * p + z * z); // polar radius

    // parametric latitude (Bowring eqn.17, replacing tanBeta = z*a / p*b)
    const tanBeta = ((b * z) / (a * p)) * (1 + (e2_sq * b) / R);
    const sinBeta = tanBeta / Math.sqrt(1 + tanBeta * tanBeta);
    const cosBeta = sinBeta / tanBeta;

    // geodetic latitude (Bowring eqn.18: tanPhi = z + e2_sq * b * (sinBeta)^3 / p − e1_sq * (cosBeta)^3)
    let latRad = 0.0;
    if (!Number.isNaN(cosBeta)) {
        latRad = Math.atan2(z + e2_sq * b * sinBeta * sinBeta * sinBeta, p - e1_sq * a * cosBeta * cosBeta * cosBeta);
    }

    // longitude
    const lonRad = Math.atan2(y, x);

    // height above ellipsoid (Bowring eqn.7)
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const nu = a / Math.sqrt(1 - e1_sq * sinLat * sinLat); // length of the normal terminated by the minor axis
    const height = p * cosLat + z * sinLat - (a * a) / nu;

    return { lat: toDegrees(latRad), lon: toDegrees(lonRad), h: height };
}

export function convertEnuToGeodetic(xEast: number, yNorth: number, zUp: number, lat0: number, lon0: number, h0: number) {
    const enu = convertEnuToEcef(xEast, yNorth, zUp, lat0, lon0, h0);
    const geodetic = convertEcefToGeodetic(enu.x, enu.y, enu.z);
    return geodetic;
}

export function convertLocalPoseToEnu(localPose: any, T_local_to_enu: any) {
    // TODO: change any to actual type
    const enuPose = localPose.clone().multiplyLeft(T_local_to_enu);
    return enuPose;
}

export function convertLocalPoseToGeoPose(localPose: any, T_local_to_enu: any, refGeoPose: any) {
    // TODO: change any to actual type
    const enuPose = convertLocalPoseToEnu(localPose, T_local_to_enu);
    const enuPosition = enuPose.getTranslation();
    const enuRotMat = enuPose.getRotationMatrix3();
    const enuQuaternion = new Quat().fromMatrix3(enuRotMat);

    const dE = enuPosition[0];
    const dN = enuPosition[1];
    const dU = enuPosition[2];
    const lat_ref = refGeoPose.position.lat;
    const lon_ref = refGeoPose.position.lon;
    const h_ref = refGeoPose.position.h;
    const geodetic = convertEnuToGeodetic(dE, dN, dU, lat_ref, lon_ref, h_ref);

    const geoPose = {
        position: {
            lat: geodetic.lat,
            lon: geodetic.lon,
            h: geodetic.h,
        },
        quaternion: {
            x: enuQuaternion.x,
            y: enuQuaternion.y,
            z: enuQuaternion.z,
            w: enuQuaternion.w,
        },
    };
    return geoPose;
}
