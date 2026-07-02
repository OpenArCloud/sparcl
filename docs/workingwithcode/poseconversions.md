---
layout: default
title: Pose conversions
parent: Working with code
nav_order: 15
---

This document describes how sparcl interprets poses, transforms, and coordinate **frames** when integrating **named frames**, **transform chains**, and **visual positioning** outputs. Code and APIs should follow it so implementations stay interchangeable.

Until March 2026, the OSCP (and spARcl) used exclusively OGC GeoPose global poses. However, indoor applications may find GeoPose impractical and we may want to use local coordinate reference frames (e.g., room, building, etc.) instead. This document describes how this can be solved in spARcl.

## FrameRef (canonical frame handle)

New APIs and payloads should identify a coordinate reference frame with a **`FrameRef`**, not a bare string alone:

- **`uuid`** — Unique identifier for this frame **instance** (stable across services and sessions when issued by a registry or VPS).
- **`fqn`** — Fully qualified name / namespace for the frame **kind** (e.g. `OSCP:WGS84-ENU`, an EPSG URN, or a vendor-defined logical type).

TypeScript type: **`FrameRef`** and reserved global GeoPose / ENU constant **`OSCP_WGS84_ENU_FRAME_REF`** live in [`src/core/spatial.ts`](../../src/core/spatial.ts) (`uuid` and `fqn` both `OSCP:WGS84-ENU` today; implementations may tighten `uuid` when a central registry exists). [`src/core/frameTransforms.ts`](../../src/core/frameTransforms.ts) re-exports SpatialDDS pose-related **types** for convenience alongside matrix helpers.

## Session alignment: geopose vs FramedPose (`worldAlignment`)

The session stores **two** kinds of alignment: **`geoPoseAlignment`** (optional) and **`framedPoseAlignments`**. Clear them with `clearActiveGeoPoseAlignment` and `clearActiveFramedPoseAlignment` (call the latter with no args or an empty list to clear all framed entries; pass specific `FrameRef`s to drop only those). Typical session teardown calls **both**.

- **`geoPoseAlignment`** (optional): from `setActiveGeoAlignmentFromCapture` or `setActiveWorldAlignmentFromMatrices` with **OSCP:WGS84-ENU** and a non-null **anchor** `Geopose`. Drives WGS84 content placement, H3 queries, and helpers like `convertGeoPoseToLocalPose` / `*FromActive` for geopose.
- **`framedPoseAlignments`** (array): from `setActiveAlignmentInFrame` (VPS **poses**), or from `setActiveWorldAlignmentFromMatrices` for non-ENU / local **FrameRef**s. Each entry is **T_scene_from_ref** for that **frameRef**. Use `convertFramedPoseToLocalPose(frameRef, …)` for metric poses in that frame.

If a VPS response includes **both** `geopose` and `poses`, both are applied: geopose does **not** get overwritten by the map **FrameRef**. Cross-frame composition (e.g. object in map frame vs ENU) will use a future transform graph; see `FrameGraphMat4Resolver` in `frameTransforms.ts` and the transform graph section below.

## SCR content (Spatial Content Discovery)

Each SCR **`content`** object must include **`geopose`** and/or **`framedPose`**. The latter follows SpatialDDS **`FramedPose`** JSON: canonical **`frame_ref`** (`uuid`, `fqn`); parsers also accept legacy camelCase **`frameRef`**. **`pose`** uses **`t`** / **`q`** (Vec3 + quaternion); **`pose.translation`** / **`pose.orientation`** and optional **`cov`** / **`covMatrix`** / **`covariance`** aliases are accepted on the wire. Zod schemas are defined in **`@oarc/scd-access`** (`contentSchema`, `framedPoseSchema`).

Runtime placement resolves a WebXR rigid pose via **`sceneRigidPoseFromScrContent`** in [`src/core/scrPlacement.ts`](../../src/core/scrPlacement.ts): if **`framedPose`** is set **and** [`findFramedPoseAlignment`](../../src/core/worldAlignment.ts) succeeds for that pose’s **`frame_ref`**, that framed path is used; otherwise **`geopose`** is converted with **`convertGeoPoseToLocalPose`** when geopose alignment exists. If **both** fields are present, **framed** takes precedence when the framed alignment is available; otherwise the implementation falls back to **geopose**. UI that plots SCRs on a **lat/lon** map still needs **`geopose`** (or a separate georeferencing strategy).

**Legacy / backwards compatibility**

- Older payloads that only provide a single string may treat it as both `uuid` and `fqn`, or map to **`OSCP_WGS84_ENU`** when the string is that literal.
- Any pose encoded as today’s `geopose` `{ position, quaternion }` **without** an explicit reference frame is treated as **`OSCP_WGS84_ENU`** (same as **`OSCP_WGS84_ENU_FRAME_REF`**) in new code paths.

Implementations may add more reserved **`FrameRef`** values later; document them here when introduced.

## Homogeneous transforms (4×4)

- **Vectors are column vectors**: \(\mathbf{p} = [x, y, z, 1]^T\).
- A transform **from frame A to frame B** is written **`T_B_from_A`**: it maps coordinates of a point fixed in A into B:

\[\mathbf{p}_B = T_{B \leftarrow A}\, \mathbf{p}_A\]

- **Storage layout** in JavaScript must match **`gl-matrix` `mat4`** (and WebGL): **column-major** 16-element array, so the translation components occupy indices `12, 13, 14`.
- **Composition**: if \(\mathbf{p}_C = T_{C \leftarrow B}\, \mathbf{p}_B\) and \(\mathbf{p}_B = T_{B \leftarrow A}\, \mathbf{p}_A\), then \(\mathbf{p}_C = T_{C \leftarrow B}\, T_{B \leftarrow A}\, \mathbf{p}_A\) (multiply in that order for column vectors).
- **Rigid vs similarity**: helpers **`isSimilarityTransformMat4`** (uniform scale × rotation, valid bottom row) and **`isRigidTransformMat4`** (unit scale, proper rotation `det = +1`) live in [`frameTransforms.ts`](../../src/core/frameTransforms.ts); **`mat4ToRigidPose(m, true)`** throws when the matrix is not rigid.

## Quaternions

- **Order**: \((x, y, z, w)\), matching **`gl-matrix` `quat`** and **OGL `Quat`** in this repo.
- **Convention**: Hamilton / right-handed rotation; rotation acts on column vectors in the usual way (same as `gl-matrix`).

## ENU frame identity (OSCP:WGS84-ENU)

For a **local tangent** frame at a geodetic point whose **body axes** align with **East, North, Up** (standard GeoPose / OSCP `OSCP:WGS84-ENU` semantics), the **orientation quaternion** is the **identity** \((x, y, z, w) = (0, 0, 0, 1)\): “no rotation” *within* that ENU frame.

- **Not** the same as vendor **camera** zero orientations (e.g. AugmentedCity “camera facing East” uses different conventions; see `convertAugmentedCityCam2WebQuat` in [`locationTools.ts`](../../src/core/locationTools.ts)).
- To express that ENU frame in the **WebXR** scene, apply **`convertGeo2WebQuat`** to that quaternion—the same ENU → WebXR boundary used when building object transforms from `geopose.quaternion` in [`mat4ObjectInRefFromGeoPose`](../../src/core/worldAlignment.ts).

## Camera pose

**Viewer pose vs camera (`XRView`) pose** — `XRViewerPose.transform` is the **viewer / device rig** in the reference space; each **`XRView.transform`** is the **camera for that view** (texture + projection used in `ogl.render`). Localization and **`setActiveGeoAlignmentFromCapture`** must use the **same** transform as the freeze-frame camera—typically **`views[0]`** in mono AR—otherwise alignment is consistent internally but **wrong relative to the captured image**.

## WebXR and OGL scene graph

- The **WebXR / OGL scene** uses a **Y-up, right-handed** frame as already assumed in [`ogl.ts`](../../src/core/engines/ogl/ogl.ts) (e.g. `addDebugAxesAtWorldMatrix` for debug meshes) and `convertGeo2Web*` in [`locationTools.ts`](../../src/core/locationTools.ts).
- **Global GeoPose localization**: [`Viewer.svelte`](../../src/components/Viewer.svelte) may call `setActiveGeoAlignmentFromCapture` and/or `setActiveAlignmentInFrame` (see *Session alignment* above). Optional debug axis placeholders use precomputed world **`mat4`** values (`mat4LocalizationDebug*` helpers) and `ogl.addDebugAxesAtWorldMatrix`. Geopose pose conversions use the `*FromActive` helpers, which read **only** the **`geoPoseAlignment`** bucket (`worldAlignment`).
- **`worldAlignmentEstablished`** / **`worldAlignmentCleared`** — Custom events dispatched from **`Viewer.svelte`** when session alignment is applied or cleared (e.g. after localization, relocalize, or session end). Experiments or parents should listen if they need to **replay** or **tear down** content that depends on alignment (same event on **re**-localization: treat as “placement session is (re)valid”).
- Any pose matrix from **VPS** or other **OSCP service** that targets this scene graph must either be supplied in that convention or converted **at one boundary** (not scattered across call sites).

## Transform graph

- A **transform graph** (local library or Web service) holds **nodes** identified by **`FrameRef`** (at minimum a unique **`uuid`** per registered frame; **`fqn`** carries semantic type). Edges are **pairwise** transforms **`T_to_from`** between two frames.
- The transform between any two registered frames is found by **path search** in the graph and **concatenation** of column-major **`mat4`** along the path, using the composition rules above.
- The wire API of the graph service (JSON field names, row-major vs column-major, Euler angles, etc.) is defined by that service. spARcl’s **adapter** must:
  - fetch or receive **`T_B_from_A`** for a pair **`(frameRefA, frameRefB)`** (or equivalent);
  - normalize to **`mat4` column-major** before use in the renderer or in [`FrameTransformsClient`](../../src/core/frameTransforms.ts).
- **Resolver keys**: until all HTTP paths accept structured **`FrameRef`**, an adapter may map each **`FrameRef`** to a string key (convention: prefer **`uuid`** for graph edges when globally unique). The default stub in `frameTransforms.ts` still uses query parameters `fromFrameId` / `toFrameId`; align those names with the real service when it exists.
- If the service returns a **pose** (translation + quaternion) instead of a full matrix, the adapter builds **`T_B_from_A`** using this document’s quaternion rules.

Implementation helpers (cache, `mat4` compose/invert, optional HTTP fetch): **[`src/core/frameTransforms.ts`](../../src/core/frameTransforms.ts)** — import as **`@core/frameTransforms`**.

## VPS / GeoPose protocol (local frames)

- When the visual positioning service returns a pose in a **local frame** `R`, the response must include a **`FrameRef`** for `R` ( **`uuid`** + **`fqn`** ) and a pose or matrix whose meaning is documented by that service **relative to `R`**.
- The relationship between **WebXR session space** at capture time and **`R`** may be communicated directly by the VPS or derived using a **transform graph**; either way, the result exposed to the renderer should be a single scene-consistent transform (e.g. **`T_scene_from_R`**) consistent with the definitions above.

## Implementation roadmap (phased)

Work is intentionally split so global GeoPose stays stable while local frames and graph integration land incrementally.

| Phase | Scope | Status |
|-------|--------|--------|
| **A** | Global GeoPose alignment in **`worldAlignment`**, OGL decoupled from alignment graph, tests, **`Viewer`** **`worldAlignmentEstablished` / `worldAlignmentCleared`**, ISMAR Automerge replay on establish | **Done** (subject to ongoing tweaks) |
| **B** | GPP / localization path: optional **local `FrameRef`** + matrix into **one adapter** → session state (extend **`worldAlignment`** or a sibling module); still fire the same **`Viewer`** events | **Next** |
| **C** | **`placeContent`** (and streams): a **single** helper **`poseFromScrToSceneRigidPose(record)`** (name illustrative) that branches **global `geopose`** vs **graph-backed / non-global** poses so the main switch does not sprawl | **Planned** |
| **D** | Multi-user payloads (e.g. reticle / camera over RMQ or P2P): **version** messages and support **non-global** frame references where needed | **Planned** |

## Changelog

- **2026-04-20** — Initial contract.
- **2026-04-22** — **FrameRef** (`uuid` + `fqn`) as the canonical frame handle; transform graph and VPS sections updated; phased roadmap; **`Viewer`** alignment events; placement-helper note for **`placeContent`**.
- **2026-04-28** — **ENU frame identity** quaternion and **`convertGeo2WebQuat`** on white debug; 
- **2026-04-29** - **`onGeoPoseLocalizationSuccess`** uses for **`localImagePose`** the **`RigidPose`** of the primary camera (from XRView.transform) instead of the pose of the whole rig (XRViewerPose). This matters only if there are multiple cameras on the device.
