/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * Screen-space fat polylines for Three.js ({@link LineMaterial} `worldUnits: false`),
 * matching OGL {@link Polyline} `uThickness` in pixels.
 */

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { ReadonlyVec3 } from 'gl-matrix';
import { parseHexColor } from '@core/common';

export function createPolyline(
    points: ReadonlyVec3[],
    hexColor: string,
    linewidthPixels: number,
    resolution: THREE.Vector2,
): Line2 | null {
    if (points.length < 2) {
        return null;
    }

    const positions: number[] = [];
    for (const p of points) {
        positions.push(p[0], p[1], p[2]);
    }

    const geometry = new LineGeometry();
    geometry.setPositions(positions);

    const [r, g, b] = parseHexColor(hexColor);
    const material = new LineMaterial({
        color: new THREE.Color(r, g, b).getHex(),
        linewidth: linewidthPixels,
        worldUnits: false,
    });
    material.resolution.copy(resolution);

    const line = new Line2(geometry, material);
    line.computeLineDistances();
    return line;
}
