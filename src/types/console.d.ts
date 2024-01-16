/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

interface Console {
    oldlog?: typeof console.log | null;
    oldwarn?: typeof console.warn | null;
    olderror?: typeof console.error | null;
}

interface Document {
    mozFullScreenElement?: () => void;
    webkitFullscreenElement?: () => void;
    msFullscreenElement?: () => void;
    webkitExitFullscreen?: () => void;
    mozCancelFullScreen?: () => void;
    msExitFullscreen?: () => void;
}
