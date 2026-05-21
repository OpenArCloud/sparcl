/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    GEO_POSE_ACCURACY_UNSPECIFIED,
    isRawGeoPoseResponseExtended,
    isParsedGeoPoseResponseExtended,
    parseGppResponse,
} from '@core/geoPoseProtocolExtended';

describe('geoPoseProtocolExtended', () => {
    it('detects extended wire via poses, geoposes, or SpatialDDS time', () => {
        assert.strictEqual(isRawGeoPoseResponseExtended({ poses: [] }), true);
        assert.strictEqual(isRawGeoPoseResponseExtended({ geoposes: [] }), true);
        assert.strictEqual(isRawGeoPoseResponseExtended({ time: { sec: 0, nanosec: 0 } }), true);
        assert.strictEqual(isRawGeoPoseResponseExtended({ time: { sec: 0, nanoSec: 0 } }), true);
        assert.strictEqual(
            isRawGeoPoseResponseExtended({
                type: 'geopose',
                id: 'a',
                timestamp: 1,
                accuracy: { position: 1, orientation: 1 },
                geopose: {},
            }),
            false,
        );
    });

    it('parses flat GeoPoseResp (GeoPoseResponse wire)', () => {
        const r = parseGppResponse({
            id: '1',
            timestamp: 1,
            accuracy: { position: 1, orientation: 1 },
            type: 'geopose',
            geopose: {
                position: { lon: 19, lat: 47, h: 100 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
            },
        });
        assert.strictEqual(isParsedGeoPoseResponseExtended(r), false);
        assert.strictEqual(r.type, 'geopose');
        assert.strictEqual(r.id, '1');
        assert.strictEqual(r.timestamp, 1);
        assert.strictEqual(r.accuracy.position, 1);
        assert.strictEqual(r.accuracy.orientation, 1);
        assert.strictEqual(r.geopose?.position.lat, 47);
        assert.strictEqual(r.poses, undefined);
        assert.strictEqual(r.time, undefined);
    });

    it('applies GeoPoseAccuracy defaults when accuracy is absent', () => {
        const r = parseGppResponse({
            id: '1',
            timestamp: 1,
            type: 'geopose',
            geopose: {
                position: { lon: 19, lat: 47, h: 100 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
            },
        });
        assert.strictEqual(isParsedGeoPoseResponseExtended(r), false);
        assert.deepStrictEqual(r.accuracy, GEO_POSE_ACCURACY_UNSPECIFIED);
    });

    it('parses poses-only body (GeoPoseResponseExtended wire)', () => {
        const r = parseGppResponse({
            id: '1',
            timestamp: 1,
            accuracy: { position: 1, orientation: 1 },
            type: 'geopose',
            poses: [
                {
                    pose: {
                        t: { x: 1, y: 2, z: 3 },
                        q: { x: 0, y: 0, z: 0, w: 1 },
                    },
                    frameRef: { uuid: 'room', fqn: 'x:Room' },
                },
            ],
        });
        assert.strictEqual(isParsedGeoPoseResponseExtended(r), true);
        assert.strictEqual(r.geopose, undefined);
        assert.strictEqual(r.poses?.[0]?.frame_ref.uuid, 'room');
        assert.strictEqual(r.poses?.[0]?.pose.t.x, 1);
        assert.strictEqual(r.time?.sec, 0);
        assert.strictEqual(r.time?.nanosec, 1_000_000);
    });

    it('parses geopose and poses wire fields', () => {
        const r = parseGppResponse({
            geopose: {
                position: { lon: 19, lat: 47, h: 100 },
                quaternion: { x: 0.1, y: 0, z: 0, w: 0.995 },
            },
            poses: [
                {
                    pose: {
                        t: { x: 0, y: 0, z: 0 },
                        q: { x: 0, y: 0, z: 0, w: 1 },
                    },
                    frame_ref: { uuid: 'u', fqn: 'f' },
                },
            ],
        });
        assert.strictEqual(isParsedGeoPoseResponseExtended(r), true);
        assert.strictEqual(r.type, 'geopose');
        assert.strictEqual(r.id, '');
        assert.strictEqual(r.timestamp, 0);
        assert.deepStrictEqual(r.accuracy, GEO_POSE_ACCURACY_UNSPECIFIED);
        assert.ok(r.geopose);
        assert.ok(r.poses?.[0]);
        assert.strictEqual(r.poses?.[0]?.frame_ref.uuid, 'u');
    });

    it('parses flat geopose + omits empty scrs', () => {
        const r = parseGppResponse({
            geopose: {
                position: { lon: 19.1, lat: 47.2, h: 120 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
            },
            scrs: [],
        });
        assert.strictEqual(isParsedGeoPoseResponseExtended(r), false);
        assert.strictEqual(r.geopose?.position.lat, 47.2);
        assert.strictEqual(r.scrs, undefined);
    });

    it('parses FramedPose cov + stamp (SpatialDDS)', () => {
        const r = parseGppResponse({
            id: '1',
            timestamp: 500,
            accuracy: { position: 1, orientation: 1 },
            type: 'geopose',
            geopose: {
                position: { lon: 19, lat: 47, h: 10 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
            },
            poses: [
                {
                    pose: {
                        t: { x: 1, y: 0, z: 0 },
                        q: { x: 0, y: 0, z: 0, w: 1 },
                    },
                    frameRef: { uuid: 'map', fqn: 'space:Map' },
                    cov: {
                        covariance_type: 'COV_POS3',
                        pos: [1, 0, 0, 0, 1, 0, 0, 0, 1],
                    },
                    stamp: { sec: 1700000000, nanosec: 250000 },
                },
            ],
        });
        assert.strictEqual(r.poses?.length, 1);
        const fp = r.poses![0]!;
        assert.strictEqual(fp.cov?.covariance_type, 'COV_POS3');
        assert.strictEqual(fp.cov?.pos?.length, 9);
        assert.strictEqual(fp.stamp?.sec, 1700000000);
        assert.strictEqual(fp.stamp?.nanosec, 250000);
    });

    it('parses FramedPose wire aliases (covMatrix, translation/orientation, covarianceType)', () => {
        const r = parseGppResponse({
            id: '1',
            timestamp: 1,
            accuracy: { position: 1, orientation: 1 },
            type: 'geopose',
            geopose: {
                position: { lon: 19, lat: 47, h: 10 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
            },
            poses: [
                {
                    pose: {
                        translation: { x: 2, y: -1, z: 0.5 },
                        orientation: { x: 0, y: 0, z: 0, w: 1 },
                    },
                    frame_ref: { uuid: 'alias-map', fqn: 'space:Map' },
                    covMatrix: { covarianceType: 'COV_NONE' },
                },
            ],
        });
        const fp = r.poses![0]!;
        assert.strictEqual(fp.frame_ref.uuid, 'alias-map');
        assert.strictEqual(fp.pose.t.x, 2);
        assert.strictEqual(fp.pose.t.y, -1);
        assert.strictEqual(fp.pose.t.z, 0.5);
        assert.strictEqual(fp.cov?.covariance_type, 'COV_NONE');
    });

    it('parses GeoPoseResponseExtended poses + time (SpatialDDS FramedPose wire)', () => {
        const r = parseGppResponse({
            id: '1',
            timestamp: 1000,
            accuracy: { position: 1, orientation: 1 },
            type: 'geopose',
            geopose: {
                position: { lon: 19, lat: 47, h: 10 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
            },
            time: { sec: 1, nanosec: 500 },
            poses: [
                {
                    pose: {
                        t: { x: 1, y: 2, z: 3 },
                        q: { x: 0, y: 0, z: 0, w: 1 },
                    },
                    frameRef: { uuid: 'map', fqn: 'space:Map' },
                },
            ],
        });
        assert.strictEqual(isParsedGeoPoseResponseExtended(r), true);
        assert.strictEqual(r.time?.nanosec, 500);
        assert.strictEqual(r.poses?.length, 1);
        assert.strictEqual(r.poses?.[0]?.frame_ref.uuid, 'map');
        assert.strictEqual(r.poses?.[0]?.pose.t.x, 1);
    });

    it('uses geoposes[0] when geopose is omitted', () => {
        const r = parseGppResponse({
            id: '1',
            timestamp: 1,
            accuracy: { position: 1, orientation: 1 },
            type: 'geopose',
            geoposes: [
                {
                    position: { lon: 19, lat: 47.5, h: 10 },
                    quaternion: { x: 0, y: 0, z: 0, w: 1 },
                },
            ],
        });
        assert.strictEqual(isParsedGeoPoseResponseExtended(r), true);
        assert.strictEqual(r.geopose?.position.lat, 47.5);
        assert.strictEqual(r.geoposes?.length, 1);
        assert.strictEqual(r.poses, undefined);
    });

    it('parses FrameRef coord_convention and coord_scale on poses (SpatialDDS 1.6 + VPS)', () => {
        const r = parseGppResponse({
            id: '1',
            timestamp: 1,
            accuracy: { position: 1, orientation: 1 },
            type: 'geopose',
            geopose: {
                position: { lon: 19, lat: 47, h: 10 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
            },
            poses: [
                {
                    pose: {
                        t: { x: 1, y: 0, z: 0 },
                        q: { x: 0, y: 0, z: 0, w: 1 },
                    },
                    frameRef: {
                        uuid: 'map',
                        fqn: 'space:Map',
                        coord_convention: 'CV',
                        coord_scale: { target_unit: 'SI_METER', scale_factor: 0.001 },
                    },
                },
            ],
        });
        const fr = r.poses?.[0]?.frame_ref;
        assert.strictEqual(fr?.coord_convention, 'CV');
        assert.deepStrictEqual(fr?.coord_scale, { target_unit: 'SI_METER', scale_factor: 0.001 });
    });

    it('throws when neither pose is present', () => {
        assert.throws(() => parseGppResponse({ id: 'x' }), /no usable geopose/);
    });
});
