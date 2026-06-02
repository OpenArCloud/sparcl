import type { RenderingEngine, SceneNodeId } from '@core/engines/RenderingEngine';
import { quat, vec3, type ReadonlyQuat, type ReadonlyVec3, type vec3 as Vec3Out } from 'gl-matrix';
import { ParticleShape, type ParticleSystem } from '@core/contents/particleSystem';

export type SensorVisualizationType = 'particle' | 'text';
export type SensorId = string;

export interface TextSensor {
    intensity: number;
}

let sensorTexts: Record<SensorId, SceneNodeId> = {};
let particleSensorVisualizations: Record<SensorId, SceneNodeId> = {};
let textSensorVisualizations: Record<SensorId, TextSensor> = {};

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
    const visualizationType = content_definitions.visualizationType as SensorVisualizationType;
    switch (visualizationType) {
        case 'particle':
            return createParticleSensor(tdEngine, localPosition, localQuaternion, content_definitions);
        case 'text':
            return createTextSensor(tdEngine, localPosition, localQuaternion, content_definitions);
        default:
            console.error('Invalid sensor visualization type', content_definitions);
    }
}

/** Whether a particle- or text-based visualization was already created for this sensor id. */
export function hasSensorVisualization(sensorId: SensorId): boolean {
    return (
        Object.hasOwn(particleSensorVisualizations, sensorId) ||
        Object.hasOwn(textSensorVisualizations, sensorId)
    );
}

function parseBaseColorRgb(raw: string | undefined) {
    const s = raw ?? '0.5,0.5,0.5';
    const parts = s.split(',').map((c) => parseFloat(c.trim()));
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) {
        return vec3.fromValues(0.5, 0.5, 0.5);
    }
    return vec3.fromValues(parts[0]!, parts[1]!, parts[2]!);
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

    const baseColorRgb = parseBaseColorRgb(content_definitions['baseColor']);
    const pointSize = parseFloat(content_definitions['pointSize'] ?? '200.0');
    const intensity = parseInt(content_definitions['intensity'] ?? '100');
    const systemSize = parseFloat(content_definitions['systemSize'] ?? '1.0');
    const speed = parseFloat(content_definitions['speed'] ?? '0.4');
    let shape = content_definitions['shape'] ?? 'random';
    if (!Object.values(ParticleShape).includes(shape as ParticleShape)) {
        shape = 'random';
    }

    const particle: ParticleSystem = {
        shape: shape as ParticleShape,
        baseColor: baseColorRgb,
        pointSize,
        intensity,
        systemSize,
        speed,
    };
    const particleNodeId = tdEngine.addParticleSystem(localPosition, localQuaternion, particle);
    particleSensorVisualizations[sensor_id] = particleNodeId;
    setSensorText(
        tdEngine,
        sensor_id,
        `0`,
        offsetPosition(localPosition, 0.5),
        localQuaternion
    );

    if (content_definitions['createButton'] === 'true') {
        let object_id = sensor_id + '_button';
        const mesh = tdEngine.addDynamicObject(object_id, localPosition, localQuaternion);
        tdEngine.addClickEvent(mesh, () => {
            const newIntensity = tdEngine.updateParticleIntensity(particleSensorVisualizations[sensor_id], (oldIntensity) => oldIntensity * 2);
            setSensorText(tdEngine, sensor_id, `${newIntensity}`);
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
        tdEngine,
        sensor_id,
        `0`,
        offsetPosition(localPosition, 0.5),
        localQuaternion
    ); // Note: async function

    textSensorVisualizations[sensor_id] = {
        intensity: 0,
    };

    // Note: this is only for testing interaction with a sensor visualization
    if (content_definitions['createButton'] === 'true') {
        let object_id = sensor_id + '_button';
        const mesh = tdEngine.addDynamicObject(object_id, localPosition, localQuaternion);
        tdEngine.addClickEvent(mesh, () => {
            const newIntensity = (textSensorVisualizations[sensor_id].intensity + 10) % 30;
            updateSensorFromMsg(JSON.stringify({ sensor_id, value: newIntensity }), tdEngine);
        });
    }

    return sensor_id;
}

export function updateSensorVisualization(
    tdEngine: RenderingEngine
) {
    for (const sceneNodeId of Object.values(particleSensorVisualizations) as SceneNodeId[]) {
        tdEngine.updateParticleSystem(sceneNodeId);
    }
}

export function setSensorText(
    tdEngine: RenderingEngine,
    sensorId: SensorId,
    value: string,
    position?: ReadonlyVec3,
    quaternion?: ReadonlyQuat
) {
    const savedPosition = vec3.create();
    const savedQuaternion = quat.create();
    if (sensorTexts[sensorId]) {
        if (!position || !quaternion) {
            tdEngine.getNodePose(sensorTexts[sensorId], savedPosition, savedQuaternion);
        }
        if (!position) {
            position = savedPosition;
        }
        if (!quaternion) {
            quaternion = savedQuaternion;
        }
        try {
            tdEngine.remove(sensorTexts[sensorId]);
        } catch {
            // Stale id after engine reinit / partial teardown (already removed)
        }

        delete sensorTexts[sensorId];
        // Note: we must delete the reference to the old text node
        // The label will be recreated after the addTextObject call finishes
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
        sensorTexts[sensorId] = textMesh;
        return textMesh;
    });
}

export function updateSensorFromMsg(body: string, tdEngine: RenderingEngine) {
    const msg = JSON.parse(body);
    const { sensor_id: sensorId, value } = msg;
    if (particleSensorVisualizations[sensorId]) {
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
        tdEngine.updateParticleIntensity(particleSensorVisualizations[sensorId], () => intensity);
    } else if (textSensorVisualizations[sensorId]) {
        const intensity = value;
        textSensorVisualizations[sensorId].intensity = intensity;
    }

    setSensorText(tdEngine, sensorId, `${value}`);
}

/**
 * Tear down all sensor visualization scene nodes and clear in-module tracking.
 * Call before {@link RenderingEngine.cleanup} / {@link RenderingEngine.reinitialize} so node ids stay valid.
 */
export function clearSensorVisualizations(tdEngine: RenderingEngine): void {
    // clear particle sensor visualizations
    for (const sceneNodeId of new Set(Object.values(particleSensorVisualizations))) {
        try {
            tdEngine.remove(sceneNodeId);
        } catch {
            // Already removed or unknown id — still clear module maps below.
        }
    }
    particleSensorVisualizations = {};

    // clear text sensor visualizations    
    textSensorVisualizations = {};

    // clear text sensor text labels
    for (const sensorId of Object.keys(sensorTexts) as SensorId[]) {
        const textNodeId = sensorTexts[sensorId];
        if (textNodeId) {
            try {
                tdEngine.remove(textNodeId);
            } catch {
                // Already removed or unknown id.
            }
        }
    }
    sensorTexts = {};
}
