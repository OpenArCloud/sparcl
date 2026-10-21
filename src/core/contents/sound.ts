/*
  (c) 2026 Open AR Cloud / contributors
  (c) 2026 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT

  SOUND SCR content helpers.
*/

import { getUrlExtension } from '@core/contents/contentFormats';

/** SCR `content.type` for spatial audio assets. */
export const SCR_SOUND_TYPE = 'SOUND';

export function isScrSoundContentType(scrContentType: string): boolean {
    return scrContentType === SCR_SOUND_TYPE;
}

/** Common audio MIME substrings and file extensions for SCR refs. */
export function isLikelyAudioRef(url: string, contentType: string): boolean {
    const ext = getUrlExtension(url);
    const ct = (contentType || '').toLowerCase();
    if (ct.startsWith('audio/')) {
        return true;
    }
    return ext === 'wav' || ext === 'mp3' || ext === 'ogg' || ext === 'm4a' || ext === 'aac';
}

export type SoundScrRef = { url?: string; contentType?: string };

/**
 * Resolves the first ref URL for a SOUND SCR, or empty string if missing.
 */
export function soundUrlFromScrRef(ref: SoundScrRef | undefined): string {
    return ref?.url?.trim() ?? '';
}
