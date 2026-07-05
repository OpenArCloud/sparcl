/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * External camera parameters (projection + extrinsic pose) for syncing an iframe / external WebGL experience with the host WebXR view.
 * Uses gl-matrix only (no OGL / Three types).
 */

import { mat4, type ReadonlyMat4 } from 'gl-matrix';

/** Intrinsics-style projection matrix plus extrinsic camera pose for an external / iframe renderer. */
export interface ExternalCameraParameters {
    projection: XRView['projectionMatrix'];
    /** Column-major 4×4: inverse(experience) * view, same composition as the legacy OGL implementation. */
    camerapose: mat4;
}

/**
 * @param experienceMatrixColumnMajor Scene / experience transform in WebXR space (column-major 4×4).
 */
export function getExternalCameraParametersForExperience(view: XRView, experienceMatrixColumnMajor: ReadonlyMat4): ExternalCameraParameters {
    const invExp = mat4.create();
    mat4.copy(invExp, experienceMatrixColumnMajor);
    mat4.invert(invExp, invExp);

    const viewMat = mat4.create();
    mat4.copy(viewMat, view.transform.matrix as ReadonlyMat4);

    const camerapose = mat4.create();
    mat4.multiply(camerapose, invExp, viewMat);

    return {
        projection: view.projectionMatrix,
        camerapose,
    };
}
