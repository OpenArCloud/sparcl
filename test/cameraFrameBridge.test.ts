/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  Camera frame bridge: vision / robotics / graphics wire conventions vs graphics session camera (`XRView`),
  selected by `FrameRef.fqn` and `FrameRef.uuid` (see `vpsCameraFrameBridgeFromFrameRef` in `@core/frameTransforms`).
*/

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mat4, quat, vec3, vec4, type ReadonlyMat4 } from 'gl-matrix';
import type { FramedPose } from '@core/spatial';
import { SPARCL_WEBXR_SCENE_FRAME_REF } from '@core/spatial';
import { convertAugmentedCityCam2WebVec3 } from '@core/locationTools';
import {
    MAT4_ROBOTICS_CAM_FROM_GRAPHICS_CAM,
    MAT4_VISION_CAM_FROM_GRAPHICS_CAM,
    MAT4_VPS_FRAME_BRIDGE_IDENTITY,
    mat4FromPoseSE3,
    mat4FromRigidPose,
    maxAbsDiffMat4,
    vpsCameraFrameBridgeFromFrameRef,
    type RigidPose,
} from '@core/frameTransforms';
import {
    clearActiveFramedPoseAlignment,
    findFramedPoseAlignment,
    setActiveAlignmentInFrame,
} from '@core/worldAlignment';

/** Same kinematics as production `setActiveAlignmentInFrame` fusion: **T_scene_from_map** (tests only). */
function getAlignmentTransformWithCameraFrameBridge(
    localCaptureGraphics: RigidPose,
    mapFromWireCam: ReadonlyMat4,
    wireCamFromGraphicsCam: ReadonlyMat4,
): mat4 {
    const mMapFromCam = mat4.create();
    mat4.multiply(mMapFromCam, mapFromWireCam, wireCamFromGraphicsCam);
    const mCamFromMap = mat4.create();
    if (!mat4.invert(mCamFromMap, mMapFromCam)) {
        throw new Error('getAlignmentTransformWithCameraFrameBridge: singular map-from-camera matrix');
    }
    const mSceneFromCam = mat4FromRigidPose(localCaptureGraphics);
    const tSceneFromMap = mat4.create();
    mat4.multiply(tSceneFromMap, mSceneFromCam, mCamFromMap);
    return tSceneFromMap;
}

describe('vpsCameraFrameBridgeFromFrameRef', () => {
    it('returns identity for graphics tokens (mixed case fqn)', () => {
        assert.ok(maxAbsDiffMat4(vpsCameraFrameBridgeFromFrameRef({ uuid: 'x', fqn: 'sparcl:WebXRScene' }), MAT4_VPS_FRAME_BRIDGE_IDENTITY) < 1e-9);
        assert.ok(maxAbsDiffMat4(vpsCameraFrameBridgeFromFrameRef({ uuid: 'x', fqn: 'My/OPENGL/Map' }), MAT4_VPS_FRAME_BRIDGE_IDENTITY) < 1e-9);
    });

    it('matches webxr via uuid only', () => {
        assert.ok(maxAbsDiffMat4(vpsCameraFrameBridgeFromFrameRef({ uuid: 'dev-webxr-scene-test', fqn: 'local:Map' }), MAT4_VPS_FRAME_BRIDGE_IDENTITY) < 1e-9);
    });

    it('graphics row wins over vision tokens', () => {
        const b = vpsCameraFrameBridgeFromFrameRef({ uuid: 'u', fqn: 'pkg/WebGL/colmap' });
        assert.ok(maxAbsDiffMat4(b, MAT4_VPS_FRAME_BRIDGE_IDENTITY) < 1e-9);
    });

    it('robotics row for ros / AC / AugmentedCity', () => {
        assert.ok(maxAbsDiffMat4(vpsCameraFrameBridgeFromFrameRef({ uuid: 'u', fqn: 'vendor/ROS/map' }), MAT4_ROBOTICS_CAM_FROM_GRAPHICS_CAM) < 1e-9);
        assert.ok(maxAbsDiffMat4(vpsCameraFrameBridgeFromFrameRef({ uuid: 'AC-device', fqn: 'x' }), MAT4_ROBOTICS_CAM_FROM_GRAPHICS_CAM) < 1e-9);
        assert.ok(maxAbsDiffMat4(vpsCameraFrameBridgeFromFrameRef({ uuid: 'u', fqn: 'AugmentedCity/Map' }), MAT4_ROBOTICS_CAM_FROM_GRAPHICS_CAM) < 1e-9);
    });

    it('robotics row wins before vision when both match', () => {
        const b = vpsCameraFrameBridgeFromFrameRef({ uuid: 'u', fqn: 'ros/opencv' });
        assert.ok(maxAbsDiffMat4(b, MAT4_ROBOTICS_CAM_FROM_GRAPHICS_CAM) < 1e-9);
    });

    it('vision row for hloc / colmap / vision / opencv', () => {
        assert.ok(maxAbsDiffMat4(vpsCameraFrameBridgeFromFrameRef({ uuid: 'u', fqn: 'openvps/HLOC' }), MAT4_VISION_CAM_FROM_GRAPHICS_CAM) < 1e-9);
        assert.ok(maxAbsDiffMat4(vpsCameraFrameBridgeFromFrameRef({ uuid: 'u', fqn: 'map/COLMAP' }), MAT4_VISION_CAM_FROM_GRAPHICS_CAM) < 1e-9);
        assert.ok(maxAbsDiffMat4(vpsCameraFrameBridgeFromFrameRef({ uuid: 'u', fqn: 'foo/opencv/bar' }), MAT4_VISION_CAM_FROM_GRAPHICS_CAM) < 1e-9);
    });

    it('unknown fqn/uuid yields identity', () => {
        assert.ok(maxAbsDiffMat4(vpsCameraFrameBridgeFromFrameRef({ uuid: 'id-99', fqn: 'orbit:moon' }), MAT4_VPS_FRAME_BRIDGE_IDENTITY) < 1e-9);
    });
});

describe('MAT4_VISION_CAM_FROM_GRAPHICS_CAM', () => {
    it('is orthonormal with det +1 and is its own inverse', () => {
        const B = MAT4_VISION_CAM_FROM_GRAPHICS_CAM;
        const prod = mat4.create();
        mat4.multiply(prod, B, B);
        const id = mat4.create();
        mat4.identity(id);
        assert.ok(maxAbsDiffMat4(prod, id) < 1e-6, 'B*B should be identity');

        const det =
            B[0]! * (B[5]! * B[10]! - B[6]! * B[9]!) -
            B[4]! * (B[1]! * B[10]! - B[2]! * B[9]!) +
            B[8]! * (B[1]! * B[6]! - B[2]! * B[5]!);
        assert.ok(Math.abs(det - 1) < 1e-6, 'det(R) should be +1');
    });
});

describe('MAT4_ROBOTICS_CAM_FROM_GRAPHICS_CAM vs AC linear map', () => {
    const B = MAT4_ROBOTICS_CAM_FROM_GRAPHICS_CAM;

    it('M * (B * p_g) ≈ p_g for graphics directions (M = AC→Web linear)', () => {
        const dirs: [number, number, number][] = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
            [0.3, -0.7, 0.5],
        ];
        for (const g of dirs) {
            const pG = vec3.fromValues(g[0], g[1], g[2]);
            const pR = vec3.create();
            vec3.transformMat4(pR, pG, B);
            const ac = [pR[0]!, pR[1]!, pR[2]!] as [number, number, number];
            const back = convertAugmentedCityCam2WebVec3(ac);
            assert.ok(vec3.dist(pG, vec3.fromValues(back[0], back[1], back[2])) < 1e-5);
        }
    });

    it('rotation block is orthogonal with det +1', () => {
        const R = mat4.create();
        mat4.copy(R, B);
        R[12] = R[13] = R[14] = 0;
        R[15] = 1;
        const Rt = mat4.create();
        mat4.transpose(Rt, R);
        const prod = mat4.create();
        mat4.multiply(prod, R, Rt);
        const id = mat4.create();
        mat4.identity(id);
        assert.ok(maxAbsDiffMat4(prod, id) < 1e-5);
        const det =
            R[0]! * (R[5]! * R[10]! - R[6]! * R[9]!) -
            R[4]! * (R[1]! * R[10]! - R[2]! * R[9]!) +
            R[8]! * (R[1]! * R[6]! - R[2]! * R[5]!);
        assert.ok(Math.abs(det - 1) < 1e-5);
    });
});

describe('setActiveAlignmentInFrame vs getAlignmentTransformWithCameraFrameBridge', () => {
    const mapRefVision: FramedPose['frameRef'] = { uuid: 'test-map-frame', fqn: 'test:Map/colmap' };
    const mapRefGraphics: FramedPose['frameRef'] = { uuid: 'test-map-webxr', fqn: 'test:Map' };

    it('fusion without vision bridge matches identity wire bridge (regression harness)', () => {
        clearActiveFramedPoseAlignment();
        const local = {
            position: { x: 0.12, y: 1.55, z: -0.08 },
            orientation: { x: 0.02, y: 0.61, z: -0.05, w: 0.79 },
        };
        const pose = {
            t: { x: 0.5, y: -0.2, z: 1.1 },
            q: { x: 0.1, y: 0.3, z: -0.15, w: 0.93 },
        };
        const n = Math.hypot(pose.q.x, pose.q.y, pose.q.z, pose.q.w) || 1;
        const framed: FramedPose = {
            frameRef: mapRefGraphics,
            pose: {
                t: pose.t,
                q: { x: pose.q.x / n, y: pose.q.y / n, z: pose.q.z / n, w: pose.q.w / n },
            },
        };
        const mapFromWire = mat4FromPoseSE3(framed.pose);
        const fromHelper = getAlignmentTransformWithCameraFrameBridge(local, mapFromWire, MAT4_VPS_FRAME_BRIDGE_IDENTITY);
        const mats = setActiveAlignmentInFrame(local, framed);
        const d = maxAbsDiffMat4(fromHelper, mats.tSceneFromRef);
        assert.ok(d < 1e-5, `helper should match setActiveAlignmentInFrame, maxAbsDiff=${d}`);
        clearActiveFramedPoseAlignment();
    });

    it('setActiveAlignmentInFrame with vision fqn matches fusion with vision bridge', () => {
        clearActiveFramedPoseAlignment();
        const local = {
            position: { x: 0.12, y: 1.55, z: -0.08 },
            orientation: { x: 0.02, y: 0.61, z: -0.05, w: 0.79 },
        };
        const pose = {
            t: { x: 0.5, y: -0.2, z: 1.1 },
            q: { x: 0.1, y: 0.3, z: -0.15, w: 0.93 },
        };
        const n = Math.hypot(pose.q.x, pose.q.y, pose.q.z, pose.q.w) || 1;
        const framed: FramedPose = {
            frameRef: mapRefVision,
            pose: {
                t: pose.t,
                q: { x: pose.q.x / n, y: pose.q.y / n, z: pose.q.z / n, w: pose.q.w / n },
            },
        };
        const mapFromWire = mat4FromPoseSE3(framed.pose);
        const expected = getAlignmentTransformWithCameraFrameBridge(local, mapFromWire, MAT4_VISION_CAM_FROM_GRAPHICS_CAM);
        setActiveAlignmentInFrame(local, framed);
        const got = findFramedPoseAlignment(mapRefVision)?.tSceneFromRef;
        assert.ok(got !== undefined);
        const d = maxAbsDiffMat4(expected, got!);
        assert.ok(d < 1e-5, `bridged session alignment should match helper, maxAbsDiff=${d}`);
        clearActiveFramedPoseAlignment();
    });

    it('applying vision bridge changes T_scene_from_map (observable axis-mismatch signal)', () => {
        const local = {
            position: { x: 0.12, y: 1.55, z: -0.08 },
            orientation: { x: 0.02, y: 0.61, z: -0.05, w: 0.79 },
        };
        const pose = {
            t: { x: 0.5, y: -0.2, z: 1.1 },
            q: { x: 0.1, y: 0.3, z: -0.15, w: 0.93 },
        };
        const n = Math.hypot(pose.q.x, pose.q.y, pose.q.z, pose.q.w) || 1;
        const mapFromWire = mat4FromPoseSE3({
            t: pose.t,
            q: { x: pose.q.x / n, y: pose.q.y / n, z: pose.q.z / n, w: pose.q.w / n },
        });
        const without = getAlignmentTransformWithCameraFrameBridge(local, mapFromWire, MAT4_VPS_FRAME_BRIDGE_IDENTITY);
        const withBridge = getAlignmentTransformWithCameraFrameBridge(local, mapFromWire, MAT4_VISION_CAM_FROM_GRAPHICS_CAM);
        const d = maxAbsDiffMat4(without, withBridge);
        assert.ok(d > 1e-3, `bridge should materially change fusion; maxAbsDiff=${d}`);
    });

    it('T_map_from_graphics = T_map_from_wire * T_wire_from_graphics (composition order)', () => {
        const B = MAT4_VISION_CAM_FROM_GRAPHICS_CAM;
        const M = mat4.create();
        mat4.fromRotationTranslation(M, quat.fromValues(0.15, 0.2, 0.25, 0.93), vec3.fromValues(1, 2, -0.5));
        const mapFromGraphics = mat4.create();
        mat4.multiply(mapFromGraphics, M, B);
        const p = vec4.fromValues(0.3, -0.2, 0.9, 1);
        const viaCombined = vec4.create();
        vec4.transformMat4(viaCombined, p, mapFromGraphics);
        const viaB = vec4.create();
        vec4.transformMat4(viaB, p, B);
        const viaM = vec4.create();
        vec4.transformMat4(viaM, viaB, M);
        assert.ok(vec4.dist(viaCombined, viaM) < 1e-5);
    });

    it('SPARCL scene FrameRef uses graphics row via fqn (identity bridge; matches getAlignmentTransformWithCameraFrameBridge)', () => {
        clearActiveFramedPoseAlignment();
        const local = {
            position: { x: 0.1, y: 1.5, z: -0.05 },
            orientation: { x: 0, y: 0, z: 0, w: 1 },
        };
        const framed: FramedPose = {
            frameRef: SPARCL_WEBXR_SCENE_FRAME_REF,
            pose: {
                t: { x: 0, y: 0, z: 0 },
                q: { x: 0, y: 0, z: 0, w: 1 },
            },
        };
        const mapFromWire = mat4FromPoseSE3(framed.pose);
        const expected = getAlignmentTransformWithCameraFrameBridge(local, mapFromWire, MAT4_VPS_FRAME_BRIDGE_IDENTITY);
        const viaFqn = setActiveAlignmentInFrame(local, framed);
        assert.ok(maxAbsDiffMat4(expected, viaFqn.tSceneFromRef) < 1e-5);
        clearActiveFramedPoseAlignment();
    });
});
