/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  Resolve Spatial Content Record **Content** poses into WebXR scene rigid poses using session alignment.
*/

import type { Content } from '@oarc/scd-access';
import type { FrameRef } from '@core/spatial';
import { upgradeGeoPoseStandard } from '@core/locationTools';
import * as worldAlignment from '@core/worldAlignment';
import type { RigidPose } from '@core/worldAlignment';

export type SceneRigidPoseResult =
    | { ok: true; pose: RigidPose }
    | { ok: false; reason: string };

function framedWireToRigidPose(framedPose: NonNullable<Content['framedPose']>): RigidPose {
    const { t, q } = framedPose.pose;
    return {
        position: { x: t.x, y: t.y, z: t.z },
        orientation: { x: q.x, y: q.y, z: q.z, w: q.w },
    };
}

/**
 * Maps SCR **content** to a scene **RigidPose** using {@link worldAlignment}.
 *
 * Precedence when **both** `framedPose` and `geopose` are present:
 * use **framedPose** if {@link worldAlignment.findFramedPoseAlignment} matches `frameRef`; otherwise fall back to **geopose** when {@link worldAlignment.getActiveGeoAlignment} is set.
 */
export function sceneRigidPoseFromScrContent(content: Content): SceneRigidPoseResult {
    const framedPose = content.framedPose;
    const geoPose = content.geopose;

    if (framedPose !== undefined) {
        const ref = framedPose.frameRef as FrameRef;
        if (worldAlignment.findFramedPoseAlignment(ref) !== undefined) {
            try {
                const rigid = framedWireToRigidPose(framedPose);
                const pose = worldAlignment.convertFramedPoseToLocalPose(ref, rigid);
                return { ok: true, pose };
            } catch (e) {
                return { ok: false, reason: `framedPose conversion failed: ${e}` };
            }
        }
    }

    if (geoPose !== undefined && worldAlignment.getActiveGeoAlignment() !== null) {
        try {
            const upgraded = upgradeGeoPoseStandard(geoPose);
            const pose = worldAlignment.convertGeoPoseToLocalPose(upgraded);
            return { ok: true, pose };
        } catch (e) {
            return { ok: false, reason: `geopose conversion failed: ${e}` };
        }
    }

    if (framedPose !== undefined) {
        return {
            ok: false,
            reason: `No framed alignment for frameRef uuid=${framedPose.frameRef.uuid} fqn=${framedPose.frameRef.fqn}`,
        };
    }
    if (geoPose !== undefined) {
        return { ok: false, reason: 'No active geopose alignment for SCR geopose' };
    }
    return { ok: false, reason: 'SCR content has neither geopose nor framedPose' };
}
