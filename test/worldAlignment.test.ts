/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mat4, quat, vec3 } from 'gl-matrix';
import type { Geopose } from '@oarc/scd-access';
import { convertGeodeticToEnu } from '@core/locationTools';
import {
    clearActiveFramedPoseAlignment,
    clearActiveGeoPoseAlignment,
    computeGeoAlignmentFromPosePair,
    convertCameraWebXrPoseToGeopose,
    convertGeoPoseToLocalPose,
    convertGeoPoseToSceneRigidPose,
    convertRigidPoseInFramedRefToSceneRigidPose,
    convertScenePoseToGeopose,
    convertScenePoseToGeoposeFromActive,
    getActiveGeoAlignment,
    getActiveReferenceFrameRef,
    getFramedPoseAlignments,
    geoPoseToEnuPose,
    mat4ObjectInRefFromGeoPose,
    mat4SceneFromGeoPose,
    setActiveAlignmentInFrame,
    setActiveGeoAlignmentFromCapture,
    setActiveWorldAlignmentFromMatrices,
} from '@core/worldAlignment';
import { OSCP_WGS84_ENU_FRAME_REF } from '@core/frameTransforms';

const EPS_MAT = 1e-5;

function clearAllWorldAlignment(): void {
    clearActiveGeoPoseAlignment();
    clearActiveFramedPoseAlignment();
}

function assertMat4Near(a: Readonly<mat4>, b: Readonly<mat4>, eps = EPS_MAT) {
    for (let i = 0; i < 16; i++) {
        assert.ok(Math.abs(a[i]! - b[i]!) < eps, `mat4[${i}] ${a[i]} vs ${b[i]}`);
    }
}

function normalizeGeoposeQuat(g: Geopose): Geopose {
    const { x, y, z, w } = g.quaternion;
    const len = Math.hypot(x, y, z, w) || 1;
    return {
        position: { ...g.position },
        quaternion: { x: x / len, y: y / len, z: z / len, w: w / len },
    };
}

function assertGeoposeNear(a: Geopose, b: Geopose) {
    assert.ok(Math.abs(a.position.lat - b.position.lat) < 1e-6, 'lat');
    assert.ok(Math.abs(a.position.lon - b.position.lon) < 1e-6, 'lon');
    assert.ok(Math.abs(a.position.h - b.position.h) < 0.05, 'h');
    const dot = Math.abs(
        a.quaternion.x * b.quaternion.x +
            a.quaternion.y * b.quaternion.y +
            a.quaternion.z * b.quaternion.z +
            a.quaternion.w * b.quaternion.w,
    );
    assert.ok(Math.abs(dot - 1) < 1e-4, `quat alignment dot=${dot}`);
}

function decomposePosQuat(m: Readonly<mat4>) {
    const p = vec3.create();
    const q = quat.create();
    mat4.getTranslation(p, m);
    mat4.getRotation(q, m);
    return {
        position: { x: p[0], y: p[1], z: p[2] },
        quaternion: { x: q[0], y: q[1], z: q[2], w: q[3] },
    };
}

describe('worldAlignment', () => {
    const localCapture = {
        position: { x: 0.12, y: 1.55, z: -0.08 },
        orientation: { x: 0.02, y: 0.61, z: -0.05, w: 0.79 },
    };
    const globalCapture: Geopose = normalizeGeoposeQuat({
        position: { lat: 47.4979, lon: 19.0402, h: 156.0 },
        quaternion: { x: 0.1, y: 0.35, z: -0.2, w: 0.91 },
    });

    it('computeGeoAlignmentFromPosePair: tSceneFromRef * tRefFromScene ≈ identity', () => {
        const kin = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
        const prod = mat4.create();
        mat4.multiply(prod, kin.tSceneFromRef, kin.tRefFromScene);
        assertMat4Near(prod, mat4.create());
    });

    it('computeGeoAlignmentFromPosePair: stable across repeated calls', () => {
        const a = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
        const b = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
        assertMat4Near(a.tSceneFromRef, b.tSceneFromRef);
        assertMat4Near(a.tRefFromScene, b.tRefFromScene);
        assert.strictEqual(a.referenceFrameRef.uuid, b.referenceFrameRef.uuid);
        assert.strictEqual(a.referenceFrameRef.fqn, b.referenceFrameRef.fqn);
    });

    it('mat4SceneFromGeoPose matches explicit mat4.multiply(tSceneFromRef, tRefFromObject)', () => {
        const kin = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
        const objectGeo: Geopose = normalizeGeoposeQuat({
            position: { lat: 47.4985, lon: 19.0415, h: 158.2 },
            quaternion: { x: 0.15, y: 0.2, z: 0.25, w: 0.93 },
        });
        const expected = mat4.create();
        const tRefObj = mat4ObjectInRefFromGeoPose(globalCapture, objectGeo);
        mat4.multiply(expected, kin.tSceneFromRef, tRefObj);
        const got = mat4SceneFromGeoPose(globalCapture, objectGeo, kin.tSceneFromRef);
        assertMat4Near(got, expected);
    });

    it('convertScenePoseToGeopose inverts mat4SceneFromGeoPose (round-trip)', () => {
        const kin = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
        const anchor = kin.anchorGeopose;
        const objectGeo: Geopose = normalizeGeoposeQuat({
            position: { lat: 47.4991, lon: 19.039, h: 151.3 },
            quaternion: { x: -0.08, y: 0.42, z: 0.11, w: 0.9 },
        });

        const mScene = mat4SceneFromGeoPose(anchor, objectGeo, kin.tSceneFromRef);
        const { position, quaternion } = decomposePosQuat(mScene);
        const back = convertScenePoseToGeopose(position, quaternion, kin.tRefFromScene, anchor);
        assertGeoposeNear(back, objectGeo);
    });

    /**
     * Numeric regression: expected **tScene_from_ref** was captured once from this module (same inputs as above).
     * If intentional math changes occur, update this matrix after verifying behavior.
     */
    it('computeGeoAlignmentFromPosePair: regression matrix (localCapture / globalCapture fixture)', () => {
        const kin = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
        /** Snapshot from `computeGeoAlignmentFromPosePair` with the fixtures above (normalized global quaternion). */
        const expected = mat4.fromValues(
            -0.696_728_289_127_349_9,
            0.679_461_300_373_077_4,
            0.230_004_504_323_005_68,
            0,
            0.716_919_302_940_368_7,
            0.670_475_959_777_832,
            0.191_020_116_209_983_83,
            0,
            -0.024_421_717_971_563_34,
            0.297_983_795_404_434_2,
            -0.954_258_501_529_693_6,
            0,
            0.119_999_997_317_790_99,
            1.549_999_952_316_284_2,
            -0.079_999_998_211_860_66,
            1,
        );
        assertMat4Near(kin.tSceneFromRef, expected, 2e-5);
    });

    it('geoPoseToEnuPose position matches convertGeodeticToEnu', () => {
        const ref: Geopose = normalizeGeoposeQuat({
            position: { lat: 47.5, lon: 19.05, h: 100 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 },
        });
        const geo: Geopose = normalizeGeoposeQuat({
            position: { lat: 47.501, lon: 19.051, h: 102.5 },
            quaternion: { x: 0.2, y: 0.1, z: -0.3, w: 0.92 },
        });
        const enu = geoPoseToEnuPose(geo, ref);
        const raw = convertGeodeticToEnu(geo.position.lat, geo.position.lon, geo.position.h, ref.position.lat, ref.position.lon, ref.position.h);
        assert.ok(Math.abs(enu.position.x - raw.x) < 1e-6);
        assert.ok(Math.abs(enu.position.y - raw.y) < 1e-6);
        assert.ok(Math.abs(enu.position.z - raw.z) < 1e-6);
        assert.strictEqual(enu.orientation.x, geo.quaternion.x);
        assert.strictEqual(enu.orientation.w, geo.quaternion.w);
    });

    it('convertCameraWebXrPoseToGeopose matches +90° Y then convertScenePoseToGeopose', () => {
        const kin = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
        const pos = { x: 0.3, y: 1.1, z: -0.4 };
        const qCam = quat.fromValues(0.22, 0.55, -0.08, 0.8);
        quat.normalize(qCam, qCam);
        const qCorr = quat.create();
        quat.setAxisAngle(qCorr, [0, 1, 0], Math.PI / 2);
        const qAdj = quat.create();
        quat.multiply(qAdj, qCam, qCorr);
        const expected = convertScenePoseToGeopose(
            pos,
            { x: qAdj[0], y: qAdj[1], z: qAdj[2], w: qAdj[3] },
            kin.tRefFromScene,
            kin.anchorGeopose,
        );
        const got = convertCameraWebXrPoseToGeopose(
            pos,
            { x: qCam[0], y: qCam[1], z: qCam[2], w: qCam[3] },
            kin.tRefFromScene,
            kin.anchorGeopose,
        );
        assertGeoposeNear(got, expected);
    });

    it('session: convertScenePoseToGeoposeFromActive matches explicit matrices after setActiveGeoAlignmentFromCapture', () => {
        const mats = setActiveGeoAlignmentFromCapture(localCapture, globalCapture);
        assert.ok(mats.tSceneFromRef[0] !== undefined);
        const pos = { x: 0.4, y: 0.9, z: -0.2 };
        const q = { x: 0.1, y: 0.7, z: -0.05, w: 0.7 };
        const a = convertScenePoseToGeoposeFromActive(pos, q);
        const b = convertScenePoseToGeopose(pos, q, mats.tRefFromScene, globalCapture);
        assertGeoposeNear(a, b);
        clearAllWorldAlignment();
        assert.throws(() => convertScenePoseToGeoposeFromActive(pos, q), /No active geopose alignment/);
    });

    it('session: convertGeoPoseToLocalPose matches convertGeoPoseToSceneRigidPose', () => {
        setActiveGeoAlignmentFromCapture(localCapture, globalCapture);
        const objectGeo: Geopose = normalizeGeoposeQuat({
            position: { lat: 47.4985, lon: 19.0415, h: 158.2 },
            quaternion: { x: 0.15, y: 0.2, z: 0.25, w: 0.93 },
        });
        const a = convertGeoPoseToLocalPose(objectGeo);
        const kin = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
        const b = convertGeoPoseToSceneRigidPose(globalCapture, objectGeo, kin.tSceneFromRef);
        assert.ok(Math.abs(a.position.x - b.position.x) < 1e-5);
        assert.ok(Math.abs(a.orientation.w - b.orientation.w) < 1e-5);
        clearAllWorldAlignment();
    });

    it('setActiveWorldAlignmentFromMatrices: identity maps pose in ref to same scene rigid pose', () => {
        const id = mat4.create();
        mat4.identity(id);
        const roomFrame = { uuid: 'room-uuid', fqn: 'vendor:RoomA' };
        setActiveWorldAlignmentFromMatrices({
            tSceneFromRef: id,
            referenceFrameRef: roomFrame,
            anchorGeopose: null,
        });
        assert.strictEqual(getActiveReferenceFrameRef()?.uuid, 'room-uuid');
        const poseInRef = {
            position: { x: 1, y: 2, z: -0.5 },
            orientation: { x: 0, y: 0, z: 0, w: 1 },
        };
        const inScene = convertRigidPoseInFramedRefToSceneRigidPose(roomFrame, poseInRef);
        assert.ok(Math.abs(inScene.position.x - 1) < 1e-6);
        assert.ok(Math.abs(inScene.position.y - 2) < 1e-6);
        assert.ok(Math.abs(inScene.position.z + 0.5) < 1e-6);
        clearAllWorldAlignment();
    });

    it('convertGeoPoseToLocalPose throws for non-WGS84 anchor', () => {
        const id = mat4.create();
        mat4.identity(id);
        setActiveWorldAlignmentFromMatrices({
            tSceneFromRef: id,
            referenceFrameRef: { uuid: 'local', fqn: 'local:map' },
            anchorGeopose: null,
        });
        const someGeo: Geopose = normalizeGeoposeQuat({
            position: { lat: 47.5, lon: 19.0, h: 100 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 },
        });
        assert.throws(() => convertGeoPoseToLocalPose(someGeo), /No active geopose alignment/);
        clearAllWorldAlignment();
    });

    it('setActiveWorldAlignmentFromMatrices matches setActiveGeoAlignmentFromCapture for conversions', () => {
        const kin = computeGeoAlignmentFromPosePair(localCapture, globalCapture);
        setActiveWorldAlignmentFromMatrices({
            tSceneFromRef: kin.tSceneFromRef,
            tRefFromScene: kin.tRefFromScene,
            referenceFrameRef: OSCP_WGS84_ENU_FRAME_REF,
            anchorGeopose: kin.anchorGeopose,
        });
        const objectGeo: Geopose = normalizeGeoposeQuat({
            position: { lat: 47.4985, lon: 19.0415, h: 158.2 },
            quaternion: { x: 0.15, y: 0.2, z: 0.25, w: 0.93 },
        });
        const a = convertGeoPoseToLocalPose(objectGeo);
        clearAllWorldAlignment();
        setActiveGeoAlignmentFromCapture(localCapture, globalCapture);
        const b = convertGeoPoseToLocalPose(objectGeo);
        assert.ok(Math.abs(a.position.x - b.position.x) < 1e-5);
        assert.ok(Math.abs(a.orientation.w - b.orientation.w) < 1e-5);
        clearAllWorldAlignment();
    });

    it('geopose alignment is unchanged after framed pose alignment (convertGeoPoseToLocalPose)', () => {
        const objectGeo: Geopose = normalizeGeoposeQuat({
            position: { lat: 47.4985, lon: 19.0415, h: 158.2 },
            quaternion: { x: 0.15, y: 0.2, z: 0.25, w: 0.93 },
        });
        setActiveGeoAlignmentFromCapture(localCapture, globalCapture);
        const beforeFramed = convertGeoPoseToLocalPose(objectGeo);
        setActiveAlignmentInFrame(localCapture, {
            frameRef: { uuid: 'map', fqn: 'space:Map' },
            pose: {
                t: { x: 0, y: 0, z: 0 },
                q: { x: 0, y: 0, z: 0, w: 1 },
            },
        });
        const afterFramed = convertGeoPoseToLocalPose(objectGeo);
        assert.ok(Math.abs(beforeFramed.position.x - afterFramed.position.x) < 1e-5);
        assert.ok(Math.abs(beforeFramed.orientation.w - afterFramed.orientation.w) < 1e-5);
        assert.strictEqual(getFramedPoseAlignments().length, 1);
        assert.strictEqual(getActiveGeoAlignment()?.referenceFrameRef.uuid, OSCP_WGS84_ENU_FRAME_REF.uuid);
        assert.strictEqual(getActiveReferenceFrameRef()?.uuid, OSCP_WGS84_ENU_FRAME_REF.uuid);
        clearAllWorldAlignment();
    });

    it('clearActiveFramedPoseAlignment: default clears all; list removes matching frames only', () => {
        const id = mat4.create();
        mat4.identity(id);
        const frameA = { uuid: 'a', fqn: 'f:a' };
        const frameB = { uuid: 'b', fqn: 'f:b' };
        setActiveWorldAlignmentFromMatrices({
            tSceneFromRef: id,
            referenceFrameRef: frameA,
            anchorGeopose: null,
        });
        setActiveWorldAlignmentFromMatrices({
            tSceneFromRef: id,
            referenceFrameRef: frameB,
            anchorGeopose: null,
        });
        assert.strictEqual(getFramedPoseAlignments().length, 2);
        clearActiveFramedPoseAlignment([frameA]);
        assert.strictEqual(getFramedPoseAlignments().length, 1);
        assert.strictEqual(getFramedPoseAlignments()[0]!.frameRef.uuid, 'b');
        clearActiveFramedPoseAlignment();
        assert.strictEqual(getFramedPoseAlignments().length, 0);
    });

    it('setActiveAlignmentInFrame: identity poses preserve axis offset in ref', () => {
        const local = { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
        const vps = {
            frameRef: { uuid: 'r', fqn: 'r:f' },
            pose: {
                t: { x: 0, y: 0, z: 0 },
                q: { x: 0, y: 0, z: 0, w: 1 },
            },
        };
        setActiveAlignmentInFrame(local, vps);
        const inScene = convertRigidPoseInFramedRefToSceneRigidPose(
            { uuid: 'r', fqn: 'r:f' },
            {
                position: { x: 1, y: 0, z: 0 },
                orientation: { x: 0, y: 0, z: 0, w: 1 },
            },
        );
        assert.ok(Math.abs(inScene.position.x - 1) < 1e-5);
        clearAllWorldAlignment();
    });
});
