import type { RenderingEngine } from '@core/engines/RenderingEngine';
import type { SceneNodeId } from '@core/engines/RenderingEngine';
import { quat, vec3, type ReadonlyQuat, type ReadonlyVec3, type vec3 as Vec3Out } from 'gl-matrix';
import { type ParticleSystem, ParticleShape, updateParticles } from '@src/core/engines/ogl/oglParticleHelper';

export const sensorTexts: Record<string, SceneNodeId> = {};

let particleList: Record<string, ParticleSystem> = {};

let textList: Record<string, TextSensor> = {};

const debugSensors = false;

function offsetPosition(localPosition: ReadonlyVec3, dy: number): Vec3Out {
    const out = vec3.clone(localPosition);
    out[1] += dy;
    return out;
}

export function createSensorVisualization(
    tdEngine: RenderingEngine,
    localPosition: ReadonlyVec3,
    localQuaternion: ReadonlyQuat,
    content_definitions: Record<string, string>,
) {
    switch (content_definitions.visualizationType) {
        case 'particle':
            return createParticleSensor(tdEngine, localPosition, localQuaternion, content_definitions);
        case 'text':
            return createTextSensor(tdEngine, localPosition, localQuaternion, content_definitions);
        default:
            console.error('Invalid sensor visualization type', content_definitions);
    }
}

function createParticleSensor(
    tdEngine: RenderingEngine,
    localPosition: ReadonlyVec3,
    localQuaternion: ReadonlyQuat,
    content_definitions: Record<string, string>,
) {
    const sensor_id = content_definitions['sensor_id'];
    if (!sensor_id) {
        console.error('ERROR: Missing sensor_id field in content record!');
        return undefined;
    }
    if (debugSensors) console.log('Adding sensor as particle system: ', sensor_id);
    const baseColor = content_definitions['baseColor'] ?? '0.5,0.5,0.5';
    const pointSize = parseFloat(content_definitions['pointSize'] ?? '200.0');
    const intensity = parseInt(content_definitions['intensity'] ?? '100');
    const systemSize = parseFloat(content_definitions['systemSize'] ?? '1.0');
    const speed = parseFloat(content_definitions['speed'] ?? '0.4');
    let shape = content_definitions['shape'] ?? 'random';
    if (!(<any>Object).values(ParticleShape).includes(shape)) {
        shape = 'random';
    }

    const particles = tdEngine.addParticleObject(
        localPosition,
        localQuaternion,
        shape as ParticleShape,
        baseColor,
        pointSize,
        intensity,
        systemSize,
        speed,
    );
    particleList[sensor_id] = particles;

    setSensorText(
        sensor_id,
        `0`,
        tdEngine,
        offsetPosition(localPosition, 0.5),
        localQuaternion
    );

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

function createTextSensor(
    tdEngine: RenderingEngine,
    localPosition: ReadonlyVec3,
    localQuaternion: ReadonlyQuat,
    content_definitions: Record<string, string>,
) {
    const sensor_id = content_definitions['sensor_id'];
    if (!sensor_id) {
        console.error('ERROR: Missing sensor_id field in content record!');
        return undefined;
    }
    if (debugSensors) console.log('Adding sensor as text: ', sensor_id);

    setSensorText(
        sensor_id,
        `0`,
        tdEngine,
        offsetPosition(localPosition, 0.5),
        localQuaternion
    );

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

export function setSensorText(
    id: string,
    value: string,
    tdEngine: RenderingEngine,
    position?: ReadonlyVec3,
    quaternion?: ReadonlyQuat
) {
    const savedPosition = vec3.create();
    const savedQuaternion = quat.create();
    if (sensorTexts[id]) {
        if (!position || !quaternion) {
            tdEngine.getNodePose(sensorTexts[id], savedPosition, savedQuaternion);
        }
        if (!position) {
            position = savedPosition;
        }
        if (!quaternion) {
            quaternion = savedQuaternion;
        }
        tdEngine.remove(sensorTexts[id]);
        delete sensorTexts[id];
    }

    if (!position || !quaternion) {
        console.error('Missing sensor position or quaternion');
        return;
    }

    return tdEngine.addTextObject(
        position,
        quaternion,
        `${value}`,
        vec3.fromValues(0.2, 0.6, 0.9),
    ).then((textMesh) => {
        tdEngine.setNodeUniformScale(textMesh, 0.25);
        tdEngine.setTowardsCameraRotating(textMesh);
        sensorTexts[id] = textMesh;
        return textMesh;
    });
}

export function updateSensorFromMsg(body: string, tdEngine: RenderingEngine) {
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
