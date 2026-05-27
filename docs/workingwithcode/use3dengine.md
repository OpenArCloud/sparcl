---
layout: default
title: Using the 3D engine
parent: Working with code
nav_order: 50
---

# Using the default 3D engine

[OGL](https://github.com/oframe/ogl) was seleceted as the default 3D engine for sparcl, because it is very small and still manages to hide away the specifics of [WebGL](https://www.khronos.org/webgl/).

Viewers depend on the **`RenderingEngine`** interface (`src/core/engines/RenderingEngine.ts`), not on OGL types directly. The default implementation is OGL (`src/core/engines/ogl/ogl.ts`); instantiate it via **`createRenderingEngine('ogl')`** (`src/core/engines/createRenderingEngine.ts`).

Neutral helpers used by viewers and future engines:

- **`PRIMITIVES` / `PrimitiveShape`** — `src/core/contents/primitives.ts` (SCR placeholder shapes)
- **`model3DFormatFromRef` / `pointCloudFormatFromRef`** — `src/core/contents/contentFormats.ts`
- **`getExternalCameraParameters`** — `src/core/engines/externalCameraPose.ts` (returns **`ExternalCameraParameters`**: projection intrinsics + `camerapose` extrinsic column-major `mat4`)
- **`RigidPose` placement** — `addModelWithRigidPose`, `addDynamicObjectWithRigidPose`, `addTextObjectWithRigidPose`, etc.

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
