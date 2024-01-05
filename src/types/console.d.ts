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
