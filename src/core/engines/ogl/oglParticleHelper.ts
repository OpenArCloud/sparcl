import { Geometry, Program, Mesh, type OGLRenderingContext, Vec3, type Attribute } from 'ogl';

import vertex from '@shaders/particlevertex.glsl';
import fragment from '@shaders/particlefragment.glsl';

export enum ParticleShape {
    RANDOM = 'random',
    SPHERE = 'sphere',
    CONE = 'cone',
}

export interface ParticleSystem {
    mesh: Mesh;
    shape: ParticleShape;
    baseColor: Vec3;
    intensity: number;
    systemSize: number;
    speed: number;
}

export function createParticles(gl: OGLRenderingContext, shape: ParticleShape, baseColor: string, pointSize: number, intensity: number, systemSize: number, speed: number): ParticleSystem {
    const positions = new Float32Array(intensity * 3);
    const velocities = new Float32Array(intensity * 3);
    const baseColorArr = baseColor.split(',').map((c) => parseFloat(c));
    const baseColorVec = new Vec3(baseColorArr[0], baseColorArr[1], baseColorArr[2]);

    for (let i = 0; i < intensity; i++) {
        let position = generatePosition(shape, systemSize);
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

    return { mesh: new Mesh(gl, { mode: gl.POINTS, geometry, program }), shape, baseColor: baseColorVec, intensity, systemSize, speed };
}

export function setIntensity(particles: ParticleSystem, newIntensity: number) {
    console.log('Updating particles to', newIntensity);
    const oldPositions = particles.mesh.geometry.getPosition().data!;
    const oldVelocities = particles.mesh.geometry.attributes.velocity!.data!;
    const previousIntensity = oldPositions.length / 3;
    const newPositions = new Float32Array(newIntensity * 3);
    const newVelocities = new Float32Array(newIntensity * 3);
    for (let i = 0; i < newIntensity * 3; i += 3) {
        if (i < previousIntensity * 3) {
            // index is lower than previous buffer size, copy old values
            newPositions[i] = oldPositions[i];
            newPositions[i + 1] = oldPositions[i + 1];
            newPositions[i + 2] = oldPositions[i + 2];
            newVelocities[i] = oldVelocities[i];
            newVelocities[i + 1] = oldVelocities[i + 1];
            newVelocities[i + 2] = oldVelocities[i + 2];
        } else {
            // new particle data needs to be generated
            let position = generatePosition(particles.shape, particles.systemSize);
            newPositions.set(position, i);
            newVelocities.set(generateVelocity(particles.shape, position, particles.speed), i);
        }
    }

    const geometry = {
        position: { size: 3, data: newPositions },
        velocity: { size: 3, data: newVelocities },
    };

    updateGeometry(particles.mesh.geometry, geometry);
    particles.intensity = newIntensity;
}

export interface GeometryAttrs {
    [key: string]: Partial<Attribute>;
}

/** Copy-paste from https://github.com/oframe/ogl/issues/153 */
function updateGeometry(geometry: Geometry, attributes: GeometryAttrs) {
    geometry.attributes = attributes;
    // Store one VAO per program attribute locations order
    geometry.VAOs = {};
    geometry.drawRange = { start: 0, count: 0 };
    geometry.instancedCount = 0;
    // Unbind current VAO so that new buffers don't get added to active mesh
    geometry.gl.renderer.bindVertexArray(null);
    geometry.gl.renderer.currentGeometry = null;
    // Alias for state store to avoid redundant calls for global state
    geometry.glState = geometry.gl.renderer.state;
    // create the buffers
    for (let key in attributes) {
        geometry.addAttribute(key, attributes[key]);
    }
}

function generatePosition(shape: ParticleShape, systemSize: number): Vec3 {
    let position;
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
    let velocity;
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

let t = 0;

export function updateParticles(particles: ParticleSystem) {
    t += 1 / 60;
    particles.mesh.program.uniforms.uTime.value = t;
}
