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

TypeScript type: **`FrameRef`** in [`src/core/frameTransforms.ts`](../../src/core/frameTransforms.ts) (`@core/frameTransforms`). Reserved global GeoPose / ENU: **`OSCP_WGS84_ENU_FRAME_REF`** (`uuid` and `fqn` both `OSCP:WGS84-ENU` today; implementations may tighten `uuid` when a central registry exists).

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

## Quaternions

- **Order**: \((x, y, z, w)\), matching **`gl-matrix` `quat`** and **OGL `Quat`** in this repo.
- **Convention**: Hamilton / right-handed rotation; rotation acts on column vectors in the usual way (same as `gl-matrix`).

## WebXR and OGL scene graph

- The **WebXR / OGL scene** uses a **Y-up, right-handed** frame as already assumed in [`ogl.ts`](../../src/core/engines/ogl/ogl.ts) (e.g. `addDebugAxesAtWorldMatrix` for debug meshes) and `convertGeo2Web*` in [`locationTools.ts`](../../src/core/locationTools.ts).
- **Global GeoPose localization**: [`Viewer.svelte`](../../src/components/Viewer.svelte) calls `setActiveGeoAlignmentFromCapture` in [`worldAlignment.ts`](../../src/core/worldAlignment.ts) (anchor + **T_scene_from_ref** / **T_ref_from_scene**). Optional debug axis placeholders use precomputed world **`mat4`** values (`mat4LocalizationDebug*` helpers) and `ogl.addDebugAxesAtWorldMatrix`. Pose conversions that depend on that session use the `*FromActive` helpers in the same module.
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
