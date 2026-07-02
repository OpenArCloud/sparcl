/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  Parse VPS (GeoPoseProtocol) localization `response` JSON until `@oarc/gpp-access` schemas match the wire shape.
  Supports OSCP `GeoPoseResponse` and `GeoPoseResponseExtended`: 
  Core fields (`type`, `id`, `timestamp`, `accuracy`, `geopose`) are always parsed; 
  Extended fields (`time`, `poses`, `geoposes`) are parsed when the wire matches the extended shape.
  Optional `scrs` may be appended by AugmentedCity (not part of the core GPP types).
*/

import type { GeoPose } from '@oarc/gpp-access';
import { GeoPoseAccuracy } from '@oarc/gpp-access';
import type { SCR } from '@oarc/scd-access';
import { type FramedPose, type NsTime, parseFramedPose, parseNsTime } from '@core/spatial';

/** Default `GeoPoseAccuracy` when the wire omits `accuracy` (matches `GeoPoseAccuracy` in `@oarc/gpp-access` / Python `sys.float_info.max`). */
export const GEO_POSE_ACCURACY_UNSPECIFIED = new GeoPoseAccuracy();

export type { GeoPoseAccuracy } from '@oarc/gpp-access';

export type { CovarianceType, CovMatrix, NsTime } from '@core/spatial';

/**
 * Parsed localization response: OSCP `GeoPoseResponse` core fields (`type`, `id`, `timestamp`, `accuracy`, `geopose`)
 * plus optional extended fields (`time`, `poses`, `geoposes`) and optional `scrs`.
 * Use {@link isRawGeoPoseResponseExtended} on raw JSON, or {@link isParsedGeoPoseResponseExtended} on the parsed object,
 * to tell extended vs plain response — there is no separate discriminator field on this type.
 */
export type GeoPoseResponseExtended = {
    /** OSCP `type` (default `"geopose"`). */
    type: string;
    /** Response correlation `id`. */
    id: string;
    /** Unix epoch `timestamp` in milliseconds. */
    timestamp: number;
    accuracy: GeoPoseAccuracy;
    /** Primary WGS84 anchor on the wire (optional when extended poses supply localization without a coarse geopose). */
    geopose?: GeoPose;

    /** SpatialDDS UTC time; on extended wire may be derived from `timestamp` when omitted. */
    time?: NsTime;
    /** SpatialDDS framed poses from wire `poses`. */
    poses?: FramedPose[];
    /** Additional global poses from wire `geoposes`. */
    geoposes?: GeoPose[];
    /** AugmentedCity SCR records when present and non-empty. */
    scrs?: SCR[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/** True when the JSON should be treated as `GeoPoseResponseExtended` wire (OSCP + SpatialDDS extras). */
export function isRawGeoPoseResponseExtended(data: Record<string, unknown>): boolean {
    if ('poses' in data) {
        return true;
    }
    if ('geoposes' in data) {
        return true;
    }
    const time = data.time;
    if (time !== undefined && time !== null && isRecord(time) && parseNsTime(time) !== undefined) {
        return true;
    }
    return false;
}

/**
 * True if `parseGppResponse` output contains extended `GeoPoseResponseExtended` payload (SpatialDDS `time`
 * and/or non-empty `poses` / `geoposes`). A plain `GeoPoseResponse` omits those properties (aside from optional `scrs`).
 */
export function isParsedGeoPoseResponseExtended(r: GeoPoseResponseExtended): boolean {
    return (
        r.time !== undefined ||
        (r.poses?.length ?? 0) > 0 ||
        (r.geoposes?.length ?? 0) > 0
    );
}

function parseTimestampMs(raw: unknown): number | undefined {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.round(raw);
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw);
        if (Number.isFinite(n)) {
            return Math.round(n);
        }
    }
    return undefined;
}

function parseAccuracy(raw: unknown): GeoPoseAccuracy {
    const out = new GeoPoseAccuracy();
    if (!isRecord(raw)) {
        return out;
    }
    const pos = raw.position;
    const ori = raw.orientation;
    out.position =
        typeof pos === 'number' && Number.isFinite(pos) ? pos : GEO_POSE_ACCURACY_UNSPECIFIED.position;
    out.orientation =
        typeof ori === 'number' && Number.isFinite(ori) ? ori : GEO_POSE_ACCURACY_UNSPECIFIED.orientation;
    return out;
}

/** Mirrors Python `Time.from_unix_millis`. */
function nsTimeFromUnixMillis(ms: number): NsTime {
    const msF = ms;
    let sec = Math.floor(msF / 1000);
    let nanosec = Math.round((msF - sec * 1000) * 1_000_000);
    if (nanosec >= 1_000_000_000) {
        sec += 1;
        nanosec -= 1_000_000_000;
    }
    return { sec, nanosec };
}

function parseGeopose(raw: Record<string, unknown>): GeoPose | undefined {
    const pos = raw.position;
    const quat = raw.quaternion;
    if (!isRecord(pos) || !isRecord(quat)) {
        return undefined;
    }
    const lat = pos.lat;
    const lon = pos.lon;
    const h = pos.h;
    const qx = quat.x;
    const qy = quat.y;
    const qz = quat.z;
    const qw = quat.w;
    if (
        typeof lat !== 'number' ||
        typeof lon !== 'number' ||
        typeof h !== 'number' ||
        typeof qx !== 'number' ||
        typeof qy !== 'number' ||
        typeof qz !== 'number' ||
        typeof qw !== 'number'
    ) {
        return undefined;
    }
    return {
        position: { lat, lon, h },
        quaternion: { x: qx, y: qy, z: qz, w: qw },
    };
}

function parseGeoposes(raw: unknown): GeoPose[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const out: GeoPose[] = [];
    for (const item of raw) {
        if (!isRecord(item)) {
            continue;
        }
        const g = parseGeopose(item);
        if (g !== undefined) {
            out.push(g);
        }
    }
    return out;
}

function parsePoses(raw: unknown): FramedPose[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const out: FramedPose[] = [];
    for (const item of raw) {
        const fp = parseFramedPose(item);
        if (fp !== undefined) {
            out.push(fp);
        }
    }
    return out;
}

/**
 * Parse a GPP / VPS localization response: core `GeoPoseResponse` fields plus optional extended payload.
 */
export function parseGppResponse(data: unknown): GeoPoseResponseExtended {
    if (!isRecord(data)) {
        throw new Error('GPP response is not a JSON object');
    }

    const extendedWire = isRawGeoPoseResponseExtended(data);

    const type = typeof data.type === 'string' ? data.type : 'geopose';
    const id = typeof data.id === 'string' ? data.id : '';
    const timestamp = parseTimestampMs(data.timestamp) ?? 0;
    const accuracy = parseAccuracy(data.accuracy);

    let wireScrs: SCR[] = [];
    const scrsRaw = data.scrs;
    if (Array.isArray(scrsRaw)) {
        wireScrs = scrsRaw as SCR[];
    }

    let geopose: GeoPose | undefined;
    const geoWire = data.geopose;
    if (geoWire !== undefined && geoWire !== null && isRecord(geoWire)) {
        geopose = parseGeopose(geoWire);
    }

    let geoposes: GeoPose[] = [];
    let poses: FramedPose[] = [];
    let timeFromWire: NsTime | undefined;

    if (extendedWire) {
        geoposes = parseGeoposes(data.geoposes);
        poses = parsePoses(data.poses);
        timeFromWire = parseNsTime(data.time);
        if (geopose === undefined && geoposes.length > 0) {
            geopose = geoposes[0];
        }
    }

    const out: GeoPoseResponseExtended = {
        type,
        id,
        timestamp,
        accuracy,
        geopose,
    };

    if (wireScrs.length > 0) {
        out.scrs = wireScrs;
    }

    if (extendedWire) {
        if (timeFromWire !== undefined) {
            out.time = timeFromWire;
        } else if (Number.isFinite(timestamp)) {
            out.time = nsTimeFromUnixMillis(timestamp);
        }
        if (poses.length > 0) {
            out.poses = poses;
        }
        if (geoposes.length > 0) {
            out.geoposes = geoposes;
        }
    }

    if (geopose === undefined && poses.length === 0) {
        throw new Error('GPP response has no usable geopose, geoposes, or poses');
    }

    return out;
}
