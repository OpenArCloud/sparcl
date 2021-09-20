---
layout: default
title: Using the 3D engine
parent: Working with code
nav_order: 50
---

# Using the default 3D engine

[OGL](https://github.com/oframe/ogl) was seleceted as the default 3D engine for sparcl, because it is very small and still manages to hide away the specifics of [WebGL](https://www.khronos.org/webgl/). 

The idea is, that the 3D engine can 'easily' be replaced by another one, but still being able to use the default `Viewer` and XR engine. For this, we will have some kind of API defined, but this is not yet accomplished, unfortunately.

To give you an overview what can be used right now, we added a list with currently available functions. Please be aware that this list is likely to change in the future.

[init()](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L35)

[remove(3dObject)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L367)

[clearScene()](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L381)

[render(time, view)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L400)

[stop()](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L392)

[addModel(position, orientation, url)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L120)

[addObject(position, orientation, description)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L213)

[addPlaceholder(keywords, position, orientation)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L70)

[addExperiencePlaceholder(position, orientation)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L151)

[addClickEvent(3dobject, handlerFunction)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L266)

[setWaiting(3dObject)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L306)

[getExternalCameraPose(view, matrix)](https://github.com/OpenArCloud/sparcl/blob/5b28318dc53dbfc70d9ae987dcadf697219c85e9/src/core/engines/ogl/ogl.js#L278)
