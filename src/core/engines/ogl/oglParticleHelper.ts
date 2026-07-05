import { Geometry, Program, Mesh, type OGLRenderingContext, Vec3, type Attribute } from 'ogl';
import { ParticleShape, type ParticleSystem } from '@core/contents/particleSystem';
import type { SceneNodeId } from '@core/engines/RenderingEngine';
import vertex from '@shaders/particlevertex.glsl';
import fragment from '@shaders/particlefragment.glsl';

/** Per-scene-node OGL particle system: mesh plus simulation fields used when resizing counts. */
export interface OglParticleSystemState {
    mesh: Mesh;
    shape: ParticleShape;
    systemSize: number;
    speed: number;
}

const particleSystemStateBySceneNodeId = new Map<SceneNodeId, OglParticleSystemState>();

export function clearRegisteredParticleSystems(): void {
    particleSystemStateBySceneNodeId.clear();
}

export function registerParticleSystem(sceneNodeId: SceneNodeId, state: OglParticleSystemState): void {
    if (particleSystemStateBySceneNodeId.has(sceneNodeId)) {
        throw new Error(`OGL particles: particle system already registered for scene node ${sceneNodeId}`);
    }
    particleSystemStateBySceneNodeId.set(sceneNodeId, state);
}

export function unregisterParticleSystem(sceneNodeId: SceneNodeId): void {
    particleSystemStateBySceneNodeId.delete(sceneNodeId);
}

/** True if `sceneNodeId` was registered via {@link registerParticleSystem} (still in the map). */
export function isRegisteredParticleSystem(sceneNodeId: SceneNodeId): boolean {
    return particleSystemStateBySceneNodeId.has(sceneNodeId);
}

function getParticleSystemState(sceneNodeId: SceneNodeId): OglParticleSystemState {
    const state = particleSystemStateBySceneNodeId.get(sceneNodeId);
    if (!state) {
        throw new Error(`OGL particles: no particle system for scene node ${sceneNodeId}`);
    }
    return state;
}

export function createParticleSystem(gl: OGLRenderingContext, particleSystem: ParticleSystem): Mesh {
    const { shape, baseColor, pointSize, intensity, systemSize, speed } = particleSystem;
    const positions = new Float32Array(intensity * 3);
    const velocities = new Float32Array(intensity * 3);
    const baseColorVec = new Vec3(baseColor[0], baseColor[1], baseColor[2]);

    for (let i = 0; i < intensity; i++) {
        const position = generatePosition(shape, systemSize);
        positions.set(position, i * 3);
        velocities.set(generateVelocity(shape, position, speed), i * 3);
    }

    const geometry = new Geometry(gl, {
        position: { size: 3, data: positions },
        velocity: { size: 3, data: velocities },
    });

    const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
            uTime: { value: 0 },
            pointSize: { value: pointSize },
            baseColor: { value: baseColorVec },
        },
        transparent: true,
        depthTest: false,
    });

    return new Mesh(gl, { mode: gl.POINTS, geometry, program });
}

export function setParticleIntensity(sceneNodeId: SceneNodeId, newIntensity: number) {
    console.log('Updating particles to', newIntensity);
    const { mesh, shape, systemSize, speed } = getParticleSystemState(sceneNodeId);
    const oldPositions = mesh.geometry.getPosition().data!;
    const oldVelocities = mesh.geometry.attributes.velocity!.data!;
    const previousIntensity = oldPositions.length / 3;
    const newPositions = new Float32Array(newIntensity * 3);
    const newVelocities = new Float32Array(newIntensity * 3);
    for (let i = 0; i < newIntensity * 3; i += 3) {
        if (i < previousIntensity * 3) {
            newPositions[i] = oldPositions[i];
            newPositions[i + 1] = oldPositions[i + 1];
            newPositions[i + 2] = oldPositions[i + 2];
            newVelocities[i] = oldVelocities[i];
            newVelocities[i + 1] = oldVelocities[i + 1];
            newVelocities[i + 2] = oldVelocities[i + 2];
        } else {
            const position = generatePosition(shape, systemSize);
            newPositions.set(position, i);
            newVelocities.set(generateVelocity(shape, position, speed), i);
        }
    }

    const geometry = {
        position: { size: 3, data: newPositions },
        velocity: { size: 3, data: newVelocities },
    };

    updateParticleGeometry(mesh.geometry, geometry);
}

/** Current particle count for a registered GPU particle mesh (from geometry). */
export function getParticleIntensity(sceneNodeId: SceneNodeId): number {
    const state = particleSystemStateBySceneNodeId.get(sceneNodeId);
    if (!state) {
        throw new Error(`OGL particles: no particle system for scene node ${sceneNodeId}`);
    }
    const data = state.mesh.geometry.getPosition().data;
    return data ? data.length / 3 : 0;
}

interface GeometryAttrs {
   [key: string]: Partial<Attribute>;
}

/** Copy-paste from https://github.com/oframe/ogl/issues/153 */
function updateParticleGeometry(geometry: Geometry, attributes: GeometryAttrs) {
    geometry.attributes = attributes;
    geometry.VAOs = {};
    geometry.drawRange = { start: 0, count: 0 };
    geometry.instancedCount = 0;
    geometry.gl.renderer.bindVertexArray(null);
    geometry.gl.renderer.currentGeometry = null;
    geometry.glState = geometry.gl.renderer.state;
    for (const key in attributes) {
        geometry.addAttribute(key, attributes[key]);
    }
}

function generatePosition(shape: ParticleShape, systemSize: number): Vec3 {
    let position: Vec3;
    switch (shape) {
        case ParticleShape.CONE: {
            position = new Vec3(Math.random(), Math.random(), Math.random());
            break;
        }
        case ParticleShape.SPHERE: {
            position = new Vec3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
            break;
        }
        case ParticleShape.RANDOM: {
            position = new Vec3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
            break;
        }
    }
    return position.scale(systemSize);
}

function generateVelocity(shape: ParticleShape, position: Vec3, speed: number): Vec3 {
    let velocity: Vec3;
    switch (shape) {
        case ParticleShape.CONE: {
            velocity = position.clone().scale(-1).normalize();
            break;
        }
        case ParticleShape.SPHERE: {
            velocity = position.clone().scale(-1).normalize();
            break;
        }
        case ParticleShape.RANDOM: {
            velocity = new Vec3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
            break;
        }
    }
    return velocity.scale(speed);
}

/** Time variable for particle animations. */
let particleAnimationTime = 0;

// TODO: pass the clock delta time instead of a fixed 1/60
export function updateParticles(sceneNodeId: SceneNodeId) {
    particleAnimationTime += 1 / 60;
    getParticleSystemState(sceneNodeId).mesh.program.uniforms.uTime.value = particleAnimationTime;
}
