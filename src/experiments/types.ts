/*
  (c) 2026 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import type Ismar2021SignPostViewer from '@experiments/oarc/ismar2021signpost/Viewer.svelte';
import type Ismar2021MultiViewer from '@experiments/oarc/ismar2021multi/Viewer.svelte';
import type Ismar2021PerformanceViewer from '@experiments/oarc/performance/Viewer.svelte';
import type SearchByTextViewer from '@experiments/oarc/searchbytext/Viewer.svelte';

export type ExperimentsViewers = Ismar2021SignPostViewer | Ismar2021MultiViewer | Ismar2021PerformanceViewer | SearchByTextViewer;
