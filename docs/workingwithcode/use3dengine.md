---
layout: default
title: Using the 3D engine
parent: Working with code
nav_order: 50
---

# Using the default 3D engine

[OGL](https://github.com/oframe/ogl) was seleceted as the default 3D engine for sparcl, because it is very small and still manages to hide away the specifics of [WebGL](https://www.khronos.org/webgl/).

Viewers depend on the **`RenderingEngine`** interface (`src/core/engines/RenderingEngine.ts`), not on OGL types directly.

- **OGL** (default): `src/core/engines/ogl/ogl.ts`
- **Three.js** (experimental): `src/core/engines/three/threeEngine.ts`

Instantiate via **`createRenderingEngine()`** (`src/core/engines/createRenderingEngine.ts`). Select the backend with URL **`?engine=ogl`** or **`?engine=three`**, or persist with **`localStorage`** key **`sparcl.renderingEngine`** (helpers **`setPersistedRenderingEngineId`**, **`getPersistedRenderingEngineId`**, constant **`RENDERING_ENGINE_STORAGE_KEY`** in that module). In the app dashboard, **Debug settings** includes a **Rendering engine** control that writes the same key (restart AR to apply; URL still overrides for a single load).

Neutral helpers used by viewers and future engines:

- **`PRIMITIVES` / `PrimitiveShape`** — `src/core/contents/primitives.ts` (SCR placeholder shapes)
- **OGL procedural meshes** — `src/core/engines/ogl/oglPrimitives.ts` (`createModel`, programs, placeholders); **`createRandomObjectDescription`** — `src/core/contents/objectDescription.ts`
- **`model3DFormatFromRef` / `pointCloudFormatFromRef`** — `src/core/contents/contentFormats.ts`
- **`getExternalCameraParameters`** — `src/core/engines/externalCameraPose.ts` (returns **`ExternalCameraParameters`**: projection intrinsics + `camerapose` extrinsic column-major `mat4`)
- **`RigidPose` placement** — `addModelWithRigidPose`, `addDynamicObjectWithRigidPose`, `addTextObjectWithRigidPose`, etc.
- **Scene graph handles** — opaque **`SceneNodeId`** (`string`, exported from `RenderingEngine.ts`). `add*` methods return this id; use `getNodePose` / `setNodePose` / `remove(nodeId)` — never OGL `Mesh` / `Transform` or THREE `Object3D` in viewers. `addModel` / `addModelWithRigidPose` return **`SceneNodeId`** (GLTF root). Engine-local registries: **`OglSceneNodeRegistry`** (`src/core/engines/ogl/oglSceneNodeRegistry.ts`), **`ThreeSceneNodeRegistry`** (`src/core/engines/three/threeSceneNodeRegistry.ts`).
- **OGL GPU teardown** — `src/core/engines/ogl/oglDisposeHelper.ts`: **`disposeOglGpuResourcesUnder(scene)`** at **`ogl.cleanup()`** (full scene). **`disposeOglGpuResourcesForDetachedSubtree(node, scene)`** from **`ogl.remove()`** before detaching the node: geometry/programs are disposed only when their total use under `scene` equals use under the subtree being removed, so shared GLTF assets stay valid. After full dispose, **`ogl.cleanup()`** also clears **`gltfCache`** and **`TextureLoader.clearCache()`** (OGL’s module-level image texture cache used by e.g. PBR helpers), so the next load does not reuse deleted WebGL programs or textures. Each PLY mesh has its own **`Program`** (`createPlyMeshProgram` / `createPlyPointsProgram` in `oglPlyHelper.ts`); there is no shared PLY program cache.
- **OGL long sessions / `remove(nodeId)`** — Sampler textures attached only to programs that are disposed are **`deleteTexture`’d**. **`addLogoObject`** and **`addVideoObject`** return **`SceneNodeId | null`** (registered meshes); logos use per-instance **`Texture`** objects (not **`TextureLoader`**’s global cache), so logos can be removed without leaking or breaking other billboards. **`gltfCache`** is **not** cleared on a single **`remove`**; it keeps unpacked `.glb` bytes in memory for the same URL (bounded if URLs repeat; can grow if you stream endlessly many unique GLB URLs).
- **Poses at the engine boundary** — gl-matrix **`ReadonlyVec3`**, **`ReadonlyQuat`**, and **`mat4`**. Build placement poses with `vec3.fromValues` / `quat.fromValues` (or from `RigidPose` fields). Read or update nodes with `getNodePose`, `setNodePose`, `translateNode`, `setNodeUniformScale`, `setNodeVisible`, `getNodeWorldMatrix`.
