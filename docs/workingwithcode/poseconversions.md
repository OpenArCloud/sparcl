---
layout: default
title: Pose conversions
parent: Working with code
nav_order: 15
---

This document describes how sparcl interprets poses, transforms, and coordinate frame IDs when integrating **named frames**, **transform chains**, and **visual positioning** outputs. Code and APIs should follow it so implementations stay interchangeable.

Until March 2026, the OSCP (and spARcl) used exclusively OGC GeoPose global poses. However, indoor applications may find GeoPose impractical and we may want to use local coordinate reference frames (e.g., room, building, etc.) instead. This document describes how this can be solved in spARcl.

## Coordinate frame IDs

- A **frame ID** is a unique `string`. Frame IDs can be introduced by OSCP payloads and/or registering a frame in the **transform-graph** service (see below). Applications built on top of spARcl can introduce own frames too, so frame IDs are not implied to always come from OSCP.
- **Reserved well-known IDs** (use these literals when you mean the OGC GeoPose global pose):
  - **`OSCP:WGS84-ENU`** — Position is WGS-84 geodetic `(lat, lon, h)` in degrees and meters; orientation is a **right-handed East–North–Up (ENU)** quaternion at the local tangent plane through that position, as used by the current GeoPose response path in sparcl (see [`ogl.ts`](../../src/core/engines/ogl/ogl.ts) comments on ENU vs WebXR).
  - Any pose encoded as today’s `geopose` `{ position, quaternion }` without an explicit `frameId` is treated as **`OSCP:WGS84-ENU`** by new code paths (backwards compatibility).

Implementations may add more reserved IDs later (for example EPSG URNs); document them here when introduced.

## Homogeneous transforms (4×4)

- **Vectors are column vectors**: \(\mathbf{p} = [x, y, z, 1]^T\).
- A transform **from frame A to frame B** is written **`T_B_from_A`**: it maps coordinates of a point fixed in A into B:

\[\mathbf{p}_B = T_{B \leftarrow A}\, \mathbf{p}_A\]

- **Storage layout** in JavaScript must match **`gl-matrix` `mat4`** (and WebGL): **column-major** 16-element array, so the translation components occupy indices `12, 13, 14`.
- **Composition**: if \(\mathbf{p}_C = T_{C \leftarrow B}\, \mathbf{p}_B\) and \(\mathbf{p}_B = T_{B \leftarrow A}\, \mathbf{p}_A\), then \(\mathbf{p}_C = T_{C \leftarrow B}\, T_{B \leftarrow A}\, \mathbf{p}_A\) (multiply in that order for column vectors).

## Quaternions

- **Order**: \((x, y, z, w)\), matching **`gl-matrix` `quat`** and **OGL `Quat`** in this repo.
- **Convention**: Hamilton / right-handed rotation; rotation acts on column vectors in the usual way (same as `gl-matrix`).

## WebXR and OGL scene graph

- The **WebXR / OGL scene** uses a **Y-up, right-handed** frame as already assumed in [`ogl.ts`](../../src/core/engines/ogl/ogl.ts) (e.g. `addDebugAxesAtWorldMatrix` for debug meshes) and `convertGeo2Web*` in [`locationTools.ts`](../../src/core/locationTools.ts).
- **GeoPose localization**: the Viewer calls `setActiveGeoAlignmentFromCapture` in [`worldAlignment.ts`](../../src/core/worldAlignment.ts) (anchor + **T_scene_from_ref** / **T_ref_from_scene**). Optional debug axis placeholders use precomputed world **`mat4`** values (`mat4LocalizationDebug*` helpers) and `ogl.addDebugAxesAtWorldMatrix`. Pose conversions that depend on the anchor use the `*FromActive` helpers in the same module.
- Any pose matrix from **VPS** or other **OSCP service** that targets this scene graph must either be supplied in that convention or converted at the boundary in one place, not scattered across call sites.

## Transform graph

- We can create either a local library or a Web service that maintains a graph of frameIds and the transforms between them. The transform between any two registered frames can be calculated by finding a path in the graph and concatenating the pairwise transforms along the path.
- The API of the **transform graph** (JSON field names, row-major vs column-major, Euler angles, etc.) is defined by that the library or service, and spARcl needs to include an **adapter** which must:
  - fetch or receive **`T_to_from`** for a pair `(fromFrameId, toFrameId)`;
  - normalize to **`mat4` column-major** and the composition rules above before use in the renderer.
- If the service returns a **pose** (translation + quaternion) instead of a full matrix, the adapter builds **`T_to_from`** explicitly using this document’s quaternion rules.

Implementation helpers (cache, `mat4` compose/invert, optional HTTP fetch): **[`src/core/frameTransforms.ts`](../../src/core/frameTransforms.ts)** — import as **`@core/frameTransforms`**.

## VPS / GeoPose protocol (local frames)

- When the visual positioning service returns a pose in a **local frame** `R` (e.g. room), the response must include **`frameId = R`** (string) and a pose or matrix whose meaning is documented by that service **relative to `R`**.
- The relationship between **WebXR session space** at capture time and **`R`** may be communicated directly by the VPS or derived using a **transform graph**; either way, the result exposed to OGL should be a single **`T_sceneRoot_from_R`** (or equivalent) consistent with the definitions above.

## Changelog

- **2026-04-20** — Initial contract.
