/*
  (c) 2026 Open AR Cloud / contributors
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mat4 } from 'gl-matrix';
import type { Content, Geopose } from '@oarc/scd-access';
import {
    clearActiveFramedPoseAlignment,
    clearActiveGeoPoseAlignment,
    convertGeoPoseToLocalPose,
    convertFramedPoseToLocalPose,
    setActiveGeoAlignmentFromCapture,
    setActiveWorldAlignmentFromMatrices,
} from '@core/worldAlignment';
import { sceneRigidPoseFromScrContent } from '@core/scrPlacement';

function clearAllWorldAlignment(): void {
    clearActiveGeoPoseAlignment();
    clearActiveFramedPoseAlignment();
}

function normalizeGeoposeQuat(g: Geopose): Geopose {
    const { x, y, z, w } = g.quaternion;
    const len = Math.hypot(x, y, z, w) || 1;
    return {
        position: { ...g.position },
        quaternion: { x: x / len, y: y / len, z: z / len, w: w / len },
    };
}

describe('sceneRigidPoseFromScrContent', () => {
    const localCapture = {
        position: { x: 0.12, y: 1.55, z: -0.08 },
        orientation: { x: 0.02, y: 0.61, z: -0.05, w: 0.79 },
    };
    const globalCapture: Geopose = normalizeGeoposeQuat({
        position: { lat: 47.4979, lon: 19.0402, h: 156.0 },
        quaternion: { x: 0.1, y: 0.35, z: -0.2, w: 0.91 },
    });

    it('geopose-only uses geo alignment', () => {
        clearAllWorldAlignment();
        setActiveGeoAlignmentFromCapture(localCapture, globalCapture);
        const objectGeo: Geopose = normalizeGeoposeQuat({
            position: { lat: 47.4985, lon: 19.0415, h: 158.2 },
            quaternion: { x: 0.15, y: 0.2, z: 0.25, w: 0.93 },
        });
        const content = {
            id: 'c1',
            type: 'MODEL_3D',
            title: 'x',
            geopose: objectGeo,
        } as Content;
        const r = sceneRigidPoseFromScrContent(content);
        assert.ok(r.ok);
        const expected = convertGeoPoseToLocalPose(objectGeo);
        assert.ok(Math.abs(r.pose.position.x - expected.position.x) < 1e-5);
        clearAllWorldAlignment();
    });

    it('framedPose-only uses framed alignment', () => {
        clearAllWorldAlignment();
        const id = mat4.create();
        mat4.identity(id);
        const frame = { uuid: 'room-a', fqn: 'vendor:RoomA' };
        setActiveWorldAlignmentFromMatrices({
            tSceneFromRef: id,
            referenceFrameRef: frame,
            anchorGeopose: null,
        });
        const content = {
            id: 'c2',
            type: 'MODEL_3D',
            title: 'x',
            framedPose: {
                frame_ref: frame,
                pose: {
                    t: { x: 1, y: 2, z: -0.5 },
                    q: { x: 0, y: 0, z: 0, w: 1 },
                },
            },
        } as Content;
        const r = sceneRigidPoseFromScrContent(content);
        assert.ok(r.ok);
        assert.ok(Math.abs(r.pose.position.x - 1) < 1e-5);
        assert.ok(Math.abs(r.pose.position.y - 2) < 1e-5);
        clearAllWorldAlignment();
    });

    it('framedPose-only fails without framed alignment', () => {
        clearAllWorldAlignment();
        const content = {
            id: 'c3',
            type: 'MODEL_3D',
            title: 'x',
            framedPose: {
                frame_ref: { uuid: 'unknown', fqn: 'x:y' },
                pose: {
                    t: { x: 0, y: 0, z: 0 },
                    q: { x: 0, y: 0, z: 0, w: 1 },
                },
            },
        } as Content;
        const r = sceneRigidPoseFromScrContent(content);
        assert.ok(!r.ok);
        clearAllWorldAlignment();
    });

    it('prefers framedPose when alignment exists even if geopose is present', () => {
        clearAllWorldAlignment();
        setActiveGeoAlignmentFromCapture(localCapture, globalCapture);
        const id = mat4.create();
        mat4.identity(id);
        const frame = { uuid: 'map', fqn: 'space:Map' };
        setActiveWorldAlignmentFromMatrices({
            tSceneFromRef: id,
            referenceFrameRef: frame,
            anchorGeopose: null,
        });
        const objectGeo: Geopose = normalizeGeoposeQuat({
            position: { lat: 47.4985, lon: 19.0415, h: 158.2 },
            quaternion: { x: 0.15, y: 0.2, z: 0.25, w: 0.93 },
        });
        const rigidInRef = {
            position: { x: 2, y: 0, z: 0 },
            orientation: { x: 0, y: 0, z: 0, w: 1 },
        };
        const expected = convertFramedPoseToLocalPose(frame, rigidInRef);
        const content = {
            id: 'c4',
            type: 'MODEL_3D',
            title: 'x',
            geopose: objectGeo,
            framedPose: {
                frame_ref: frame,
                pose: {
                    t: { x: 2, y: 0, z: 0 },
                    q: { x: 0, y: 0, z: 0, w: 1 },
                },
            },
        } as Content;
        const r = sceneRigidPoseFromScrContent(content);
        assert.ok(r.ok);
        assert.ok(Math.abs(r.pose.position.x - expected.position.x) < 1e-5);
        const geoOnly = convertGeoPoseToLocalPose(objectGeo);
        assert.ok(Math.abs(r.pose.position.x - geoOnly.position.x) > 1e-3, 'should not equal geo-only placement');
        clearAllWorldAlignment();
    });
});
