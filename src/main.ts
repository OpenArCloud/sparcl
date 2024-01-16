/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import App from './App.svelte';

const app = new App({
    target: document.getElementById('app')!,
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
}

export default app;
