/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/**
 * Augmented City `INFOSTICKER` placement.
 * `sticker_type` selects a specific icon in the Augmented City viewer; sparcl uses one generic icon.
 */

/** Billboard edge length, in meters. */
export const INFOSTICKER_ICON_SIZE_M = 0.2;

/** Local Y of the caption's top edge, just under the icon. */
export const INFOSTICKER_LABEL_TOP_M = -0.12;

/**
 * Uniform scale for the 1 m MSDF caption.
 * Keeps the letters a few centimetres tall next to the 0.2 m icon.
 */
export const INFOSTICKER_LABEL_SCALE = 0.05;

export const INFOSTICKER_ICON_URL = '/media/icons/infosticker.png';

/** Caption from `custom_data.sticker_text`, falling back to the content title. */
export function infostickerLabel(content: { title: string }): string {
    const customData = (content as { custom_data?: { sticker_text?: unknown } }).custom_data;
    const stickerText = customData?.sticker_text;
    if (typeof stickerText === 'string' && stickerText.trim() !== '') {
        return stickerText.trim();
    }
    return content.title.trim();
}
