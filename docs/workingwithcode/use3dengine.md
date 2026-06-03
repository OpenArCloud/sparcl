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
- **OGL GPU teardown** — `src/core/engines/ogl/oglDisposeHelper.ts`: **`disposeOglGpuResourcesUnder(scene)`** at **`ogl.cleanup()`** (full scene). **`disposeOglGpuResourcesForDetachedSubtree(node, scene)`** from **`ogl.remove()`** before detaching the node: geometry/programs are disposed only when their total use under `scene` equals use under the subtree being removed, so shared GLTF assets stay valid. After full dispose, **`ogl.cleanup()`** also clears the PLY singleton program cache (`clearPlyProgramCache` in `oglPlyHelper.ts`), **`gltfCache`**, and **`TextureLoader.clearCache()`** (OGL’s module-level image texture cache), so the next load does not reuse deleted WebGL programs or textures—including **`loadLogoTexture`** / icon billboards.
- **Poses at the engine boundary** — gl-matrix **`ReadonlyVec3`**, **`ReadonlyQuat`**, and **`mat4`**. Build placement poses with `vec3.fromValues` / `quat.fromValues` (or from `RigidPose` fields). Read or update nodes with `getNodePose`, `setNodePose`, `translateNode`, `setNodeUniformScale`, `setNodeVisible`, `getNodeWorldMatrix`.

The list below still points at the OGL class for historical links; prefer the interface and neutral modules above when adding features.

[init()](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L35)

[remove(3dObject)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L367)

[clearScene()](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L381)

[render(time, view)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L400)

[stop()](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L392)

[addModel(url, position, orientation, scale)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L120)

[addObject(position, orientation, description)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L213)

[addPlaceholder(keywords, position, orientation)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L70)

[addExperiencePlaceholder(position, orientation)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L151)

[addClickEvent(3dobject, handlerFunction)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L266)

[setWaiting(3dObject)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L306)

[getExternalCameraParameters(view, matrix)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L278) — returns **`ExternalCameraParameters`** (`projection` intrinsics + `camerapose` extrinsic column-major `mat4`).
