import type ogl from '@src/core/engines/ogl/ogl';
import { Quat, Vec3, type Mesh } from 'ogl';
import { type ParticleSystem, ParticleShape, updateParticles } from '@src/core/engines/ogl/oglParticleHelper';

export const sensorTexts: Record<string, Mesh> = {};

let particleList: Record<string, ParticleSystem> = {};

let textList: Record<string, TextSensor> = {};

export function createSensorVisualization(tdEngine: ogl, localPosition: Vec3, localQuaternion: Quat, content_definitions: Record<string, string>) {
    switch (content_definitions.visualizationType) {
        case 'particle':
            return createParticleSensor(tdEngine, localPosition, localQuaternion, content_definitions);
        case 'text':
            return createTextSensor(tdEngine, localPosition, localQuaternion, content_definitions);
        default:
            console.error('Invalid sensor visualization type', content_definitions);
    }
}

function createParticleSensor(tdEngine: ogl, localPosition: Vec3, localQuaternion: Quat, content_definitions: Record<string, string>) {
    console.log('Adding particle system', localPosition, localQuaternion);
    const sensor_id = content_definitions['sensor_id'];
    if (!sensor_id) {
        console.error('ERROR: Missing sensor_id field in content record!');
        return undefined;
    }
    const baseColor = content_definitions['baseColor'] ?? '0.5,0.5,0.5';
    const pointSize = parseFloat(content_definitions['pointSize'] ?? '200.0');
    const intensity = parseInt(content_definitions['intensity'] ?? '100');
    const systemSize = parseFloat(content_definitions['systemSize'] ?? '1.0');
    const speed = parseFloat(content_definitions['speed'] ?? '0.4');
    let shape = content_definitions['shape'] ?? 'random';
    if (!(<any>Object).values(ParticleShape).includes(shape)) {
        shape = 'random';
    }

    const particles = tdEngine.addParticleObject(localPosition, localQuaternion, shape as ParticleShape, baseColor, pointSize, intensity, systemSize, speed);
    particleList[sensor_id] = particles;

    setSensorText(sensor_id, `0`, tdEngine, new Vec3().copy(localPosition).add(new Vec3(0, 0.5, 0)), localQuaternion);

    if (content_definitions['createButton'] === 'true') {
        let object_id = sensor_id + '_button';
        const mesh = tdEngine.addDynamicObject(object_id, localPosition, localQuaternion);
        tdEngine.addClickEvent(mesh, () => {
            const newIntensity = tdEngine.setParticleIntensity(particleList[sensor_id], (oldIntensity) => oldIntensity * 2);
            setSensorText(sensor_id, `${newIntensity}`, tdEngine);
        });
    }

    return sensor_id;
}

function createTextSensor(tdEngine: ogl, localPosition: Vec3, localQuaternion: Quat, content_definitions: Record<string, string>) {
    console.log('Adding text sensor', localPosition, localQuaternion);
    const sensor_id = content_definitions['sensor_id'];
    if (!sensor_id) {
        console.error('ERROR: Missing sensor_id field in content record!');
        return undefined;
    }

    setSensorText(sensor_id, `0`, tdEngine, new Vec3().copy(localPosition).add(new Vec3(0, 0.5, 0)), localQuaternion);

    textList[sensor_id] = {
        intensity: 0,
    };

    if (content_definitions['createButton'] === 'true') {
        let object_id = sensor_id + '_button';
        const mesh = tdEngine.addDynamicObject(object_id, localPosition, localQuaternion);
        tdEngine.addClickEvent(mesh, () => {
            const newIntensity = (textList[sensor_id].intensity + 10) % 30;
            updateSensorFromMsg(JSON.stringify({ sensor_id, value: newIntensity }), tdEngine);
        });
    }

    return sensor_id;
}

export function updateSensorVisualization() {
    for (let particles of Object.values(particleList)) {
        updateParticles(particles);
    }
}

export function setSensorText(id: string, value: string, tdEngine: ogl, position?: Vec3, quaternion?: Quat) {
    if (sensorTexts[id]) {
        if (!position) {
            position = sensorTexts[id].position;
        }
        if (!quaternion) {
            quaternion = sensorTexts[id].quaternion;
        }
        tdEngine.remove(sensorTexts[id]);
        delete sensorTexts[id];
    }

    if (!position || !quaternion) {
        console.error('Missing position or quaternion');
        return;
    }

    return tdEngine.addTextObject(position, quaternion, `${value}`, new Vec3(0.2, 0.6, 0.9)).then((textMesh: Mesh) => {
        textMesh.scale.set(0.25);
        tdEngine.setTowardsCameraRotating(textMesh);
        sensorTexts[id] = textMesh;
        return textMesh;
    });
}

export function updateSensorFromMsg(body: string, tdEngine: ogl) {
    const msg = JSON.parse(body);
    const { sensor_id: sensorId, value } = msg;
    if (particleList[sensorId]) {
        let intensity;
        if (value < 0) {
            // mapping to a positive value
            // this formula is for wifi signal strength only
            intensity = 14 * (value + 70);
        } else {
            if (typeof msg.minValue === 'number' && typeof msg.maxValue === 'number') {
                // interpolate between 0..1000
                intensity = ((value - msg.minValue) * (1000 - 0)) / (msg.maxValue - msg.minValue);
            } else {
                // keep original value
                // multiply it by some constant if the expected values are low (<100)
                intensity = value;
            }
        }
        tdEngine.setParticleIntensity(particleList[sensorId], () => intensity);
    } else if (textList[sensorId]) {
        const intensity = value;
        textList[sensorId].intensity = intensity;
    }

    setSensorText(sensorId, `${value}`, tdEngine);
}

export function clearSensorTexts() {
    for (const id of Object.keys(sensorTexts)) {
        delete sensorTexts[id];
    }
}

export interface TextSensor {
    intensity: number;
}
