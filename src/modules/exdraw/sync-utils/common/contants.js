import { COLOR_PALETTE } from "./colors";

export const CJK_HAND_DRAWN_FALLBACK_FONT = "Xiaolai";
export const WINDOWS_EMOJI_FALLBACK_FONT = "Segoe UI Emoji";

export const FONT_FAMILY = {
  Virgil: 1,
  Helvetica: 2,
  Cascadia: 3,
  // leave 4 unused as it was historically used for Assistant (which we don't use anymore) or custom font (Obsidian)
  Excalifont: 5,
  Nunito: 6,
  "Lilita One": 7,
  "Comic Shanns": 8,
  "Liberation Sans": 9,
  Assistant: 10,
};

export const DEFAULT_FONT_FAMILY = FONT_FAMILY.Excalifont;
export const DEFAULT_TEXT_ALIGN = "left";
export const DEFAULT_VERTICAL_ALIGN = "top";

export const ROUNDNESS = {
  // Used for legacy rounding (rectangles), which currently works the same
  // as PROPORTIONAL_RADIUS, but we need to differentiate for UI purposes and
  // forwards-compat.
  LEGACY: 1,

  // Used for linear elements & diamonds
  PROPORTIONAL_RADIUS: 2,

  // Current default algorithm for rectangles, using fixed pixel radius.
  // It's working similarly to a regular border-radius, but attemps to make
  // radius visually similar across differnt element sizes, especially
  // very large and very small elements.
  //
  // NOTE right now we don't allow configuration and use a constant radius
  // (see DEFAULT_ADAPTIVE_RADIUS constant)
  ADAPTIVE_RADIUS: 3
};


export const ROUGHNESS = {
  architect: 0,
  artist: 1,
  cartoonist: 2
};

export const DEFAULT_ELEMENT_PROPS = {
  strokeColor: COLOR_PALETTE.black,
  backgroundColor: COLOR_PALETTE.transparent,
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: ROUGHNESS.artist,
  opacity: 100,
  locked: false
};

export const SANS_SERIF_GENERIC_FONT = "sans-serif";
export const MONOSPACE_GENERIC_FONT = "monospace";

export const FONT_FAMILY_GENERIC_FALLBACKS = {
  [SANS_SERIF_GENERIC_FONT]: 998,
  [MONOSPACE_GENERIC_FONT]: 999,
};

export const FONT_FAMILY_FALLBACKS = {
  [CJK_HAND_DRAWN_FALLBACK_FONT]: 100,
  ...FONT_FAMILY_GENERIC_FALLBACKS,
  [WINDOWS_EMOJI_FALLBACK_FONT]: 1000,
};

