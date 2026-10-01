/*
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import { writable } from 'svelte/store';

/** SCD API session for Memento (separate Auth0 application from app login). */
export const isAuthenticatedScdAuth0 = writable(false);
