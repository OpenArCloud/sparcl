/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  Resolve Spatial Content Record **Content** poses into WebXR scene rigid poses using session alignment.
*/

import type { Content, SCR } from '@oarc/scd-access';
import { SPARCL_WEBXR_SCENE_FRAME_REF, parseFramedPose, type FramedPose } from '@core/spatial';
import { frameTransformGraph } from '@core/frameTransforms';
import { upgradeGeoPoseStandard } from '@core/locationTools';
import * as worldAlignment from '@core/worldAlignment';
import type { RigidPose } from '@core/frameTransforms';

/**
 * SPARCL SCR content: published `@oarc/scd-access` still requires `geopose` and has no `framedPose`.
 * Until that package is updated, a record may carry optional `geopose` and/or SpatialDDS `framedPose`.
 */
export type ContentExtended = Omit<Content, 'geopose'> & {
    geopose?: Content['geopose'];
    framedPose?: FramedPose;
};

export type SCRExtended = Omit<SCR, 'content'> & {
    content: ContentExtended;
};

export type SceneRigidPoseResult =
    | { ok: true; pose: RigidPose }
    | { ok: false; reason: string };

function framedPoseToRigidPose(framedPose: FramedPose): RigidPose {
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
 * use **framedPose** if {@link worldAlignment.findFramedPoseAlignment} matches that pose’s `frame_ref`, else try **frameTransformGraph**
 * **T_scene_from_ref** from content frame → {@link SPARCL_WEBXR_SCENE_FRAME_REF}; otherwise fall back to **geopose** when {@link worldAlignment.getActiveGeoAlignment} is set.
 */
export function sceneRigidPoseFromScrContent(content: ContentExtended): SceneRigidPoseResult {
    const framedPoseWire = content.framedPose;
    const geoPose = content.geopose;

    const framedPose = framedPoseWire === undefined ? undefined : parseFramedPose(framedPoseWire as unknown);
    if (framedPoseWire !== undefined && framedPose === undefined) {
        return {
            ok: false,
            reason: 'content.framedPose is not a valid SpatialDDS FramedPose (frame_ref, pose.t, pose.q)',
        };
    }

    if (framedPose !== undefined) {
        const frameRef = framedPose.frame_ref;
        if (worldAlignment.findFramedPoseAlignment(frameRef) !== undefined) {
            try {
                const rigid = framedPoseToRigidPose(framedPose);
                const pose = worldAlignment.convertFramedPoseToLocalPose(frameRef, rigid);
                return { ok: true, pose };
            } catch (e) {
                return { ok: false, reason: `framedPose conversion failed: ${e}` };
            }
        }
        const graphMat = frameTransformGraph.getTransform(frameRef.uuid, SPARCL_WEBXR_SCENE_FRAME_REF.uuid);
        if (graphMat !== null) {
            try {
                const rigid = framedPoseToRigidPose(framedPose);
                const pose = worldAlignment.convertRigidPoseToSceneRigidPose(graphMat, rigid);
                return { ok: true, pose };
            } catch (e) {
                return { ok: false, reason: `framedPose graph conversion failed: ${e}` };
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
            reason: `No framed alignment for frame_ref uuid=${framedPose.frame_ref.uuid} fqn=${framedPose.frame_ref.fqn}`,
        };
    }
    if (geoPose !== undefined) {
        return { ok: false, reason: 'No active geopose alignment for SCR geopose' };
    }
    return { ok: false, reason: 'SCR content has neither geopose nor framedPose' };
}
