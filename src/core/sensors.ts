import { quat, vec3 } from 'gl-matrix';
import { convertSensor2AugmentedCityCam } from '@core/locationTools';
import type { GeoposeResponse } from '@oarc/gpp-access';

// https://w3c.github.io/orientation-sensor
// We currently use the 'device' reference coordinate system:
// https://w3c.github.io/accelerometer/#device-coordinate-system
// TODO: we could ask for reference coordinate system 'screen',
// so that we do not need to deal with interface orientation:
// https://w3c.github.io/accelerometer/#screen-coordinate-system

// TODO: add proper typings for this!
let sensor = new AbsoluteOrientationSensor({ referenceFrame: 'device' });
let sensorMat4 = new Float32Array(16);
let sensorQuat = quat.create();

/**
 * Requests access to AbsoluteOrientationSensor (accelerometer, gyroscope, magnetometer) and then starts these sensors
 */
export function startOrientationSensor() {
    Promise.all([
        navigator.permissions.query({ name: 'accelerometer' as any }),
        navigator.permissions.query({ name: 'magnetometer' as any }),
        navigator.permissions.query({ name: 'gyroscope' as any }),
    ]).then((results) => {
        if (results.every((result) => result.state === 'granted')) {
            sensor.onerror = (event: any) => console.log(event.error.name, event.error.message);
            sensor.onreading = () => {
                sensor.populateMatrix(sensorMat4);
                // both sensor.quaternion and gl-matrix.quat have x,y,z,w order within the float[4] array
                if (sensor.quaternion) {
                    quat.set(sensorQuat, sensor.quaternion[0], sensor.quaternion[1], sensor.quaternion[2], sensor.quaternion[3]);
                }
            };
            sensor.start();
        } else {
            console.log('No permissions to use AbsoluteOrientationSensor.');
            // TODO: handle this properly
        }
    });
}

/**
 * Stops the AbsoluteOrientationSensor
 */
export function stopOrientationSensor() {
    sensor.stop();
}

// https://w3c.github.io/geolocation-sensor/
//GeolocationSensor.read()
//  .then(geo => console.log(`lat: ${geo.latitude}, long: ${geo.longitude}`))
//  .catch(error => console.error(error.name));

/**
 * Returns the GeoPose of the device estimated from the on-board sensors
 * @returns {Promise<GeoPose>}
 */
export function getSensorEstimatedGeoPose() {
    const accessOptions = {
        enableHighAccuracy: true,
        maximumAge: 0,
    };

    return new Promise<GeoposeResponse['geopose']>((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            reject('Location is not available');
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                // see https://developers.google.com/web/fundamentals/native-hardware/device-orientation
                // device orientation is in East-North-Up coordinate system,
                // the coordinate axes are either defined as 'device' or as 'screen'
                // (the latter being independent from UI orientation)

                // TODO: get the elevation right
                // This is copied from a Mozilla example:
                //    let elevation = 0;
                //    try {
                //        let key = "AIzaSyBrirea7OVV4aKJ9Y0UAp6Nbr6-fXtr-50";
                //        let url = "https://maps.googleapis.com/maps/api/elevation/json?locations="+latitude+","+longitude+"&key="+key
                //        let response = await fetch(url);
                //        let json = await response.json();
                //        console.log("altitude query was")
                //        console.log(json);
                //        if(json && json.results) elevation = json.results.elevation
                //    } catch(e) {
                //        throw e
                //    }
                //

                console.log('Screen orientation: ' + screen.orientation.type + ' (' + screen.orientation.angle + ')');

                // DEBUG
                console.log('latitude: ' + position.coords.latitude);
                console.log('longitude: ' + position.coords.longitude);
                console.log('altitude: ' + position.coords.altitude);
                console.log('accuracy: ' + position.coords.accuracy);
                console.log('altitudeAccuracy: ' + position.coords.altitudeAccuracy);
                console.log('heading: ' + position.coords.heading);
                console.log('speed: ' + position.coords.speed);
                console.log('ori x: ' + sensorQuat[0]);
                console.log('ori y: ' + sensorQuat[1]);
                console.log('ori z: ' + sensorQuat[2]);
                console.log('ori w: ' + sensorQuat[3]);

                // WARNING: the localization code expects the camera pose in the coordinate system defined by Augmented City
                // We should convert every localization result to a unified format
                let augmentedCityCameraQuat = convertSensor2AugmentedCityCam(sensorQuat);

                // NOTE: The sensor API has East-North-Up axes
                // The GeoPose orientation has East-North-Up axes,
                // but we need to make sure the camera orientation is understood the same way
                console.log('warning: geosensor height is set to 0.0 instead of ' + position.coords.altitude);
                let geoPose = {
                    position: {
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                        //"h": position.coords.altitude,
                        h: 1.4, // HACK: hardcoded height to 1.4m (typical smartphone localization height)
                        // Note that we can only use the altitude here when
                        // the contents are also stored with correct altitude instead of 0
                    },
                    quaternion: {
                        x: augmentedCityCameraQuat[0],
                        y: augmentedCityCameraQuat[1],
                        z: augmentedCityCameraQuat[2],
                        w: augmentedCityCameraQuat[3],
                    },
                };

                resolve(geoPose);
            },
            (error) => {
                console.log(`Location request failed: ${error}`);
                reject(error);
            },
            accessOptions
        );
    });
}

/**
 * Locks the screen orientation to the given orientation. It must go fullscreen first.
 * @param orientation  String, one of the values from
 * https://w3c.github.io/screen-orientation/#screen-orientation-types-and-locks
 */
export function lockScreenOrientation(orientation: string) {
    // Code from https://code-boxx.com/lock-screen-orientation/

    document.addEventListener('fullscreenerror', (event) => {
        console.error('Could not change to fullscreen');
        console.log(event);
    });

    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        let de: any = document.documentElement;
        if (de.requestFullscreen) {
            de.requestFullscreen();
        } else if (de.mozRequestFullScreen) {
            de.mozRequestFullScreen();
        } else if (de.webkitRequestFullscreen) {
            de.webkitRequestFullscreen();
        } else if (de.msRequestFullscreen) {
            de.msRequestFullscreen();
        }
    }

    (screen.orientation as any).lock(orientation).then(
        (success: string) => {
            console.log(success);
        },
        (failure: string) => {
            console.error('Could not lock screen orientation');
            console.log(failure);
        }
    );
}

/**
 * Unlocks the screen orientation.
 */
export function unlockScreenOrientation() {
    screen.orientation.unlock();

    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}
