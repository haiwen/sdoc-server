import { FONT_FAMILY, FONT_FAMILY_FALLBACKS } from "./contants";

export const FONT_METADATA = {
  [FONT_FAMILY.Excalifont]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 886,
      descender: -374,
      lineHeight: 1.25
    }
  },
  [FONT_FAMILY.Nunito]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 1011,
      descender: -353,
      lineHeight: 1.25
    }
  },
  [FONT_FAMILY["Lilita One"]]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 923,
      descender: -220,
      lineHeight: 1.15
    }
  },
  [FONT_FAMILY["Comic Shanns"]]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 750,
      descender: -250,
      lineHeight: 1.25
    }
  },
  [FONT_FAMILY.Virgil]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 886,
      descender: -374,
      lineHeight: 1.25
    },
    deprecated: true
  },
  [FONT_FAMILY.Helvetica]: {
    metrics: {
      unitsPerEm: 2048,
      ascender: 1577,
      descender: -471,
      lineHeight: 1.15
    },
    deprecated: true,
    local: true
  },
  [FONT_FAMILY.Cascadia]: {
    metrics: {
      unitsPerEm: 2048,
      ascender: 1900,
      descender: -480,
      lineHeight: 1.2
    },
    deprecated: true
  },
  [FONT_FAMILY["Liberation Sans"]]: {
    metrics: {
      unitsPerEm: 2048,
      ascender: 1854,
      descender: -434,
      lineHeight: 1.15
    },
    private: true
  },
  [FONT_FAMILY.Assistant]: {
    metrics: {
      unitsPerEm: 2048,
      ascender: 1021,
      descender: -287,
      lineHeight: 1.25
    },
    private: true
  },
  [FONT_FAMILY_FALLBACKS.Xiaolai]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 880,
      descender: -144,
      lineHeight: 1.25
    },
    fallback: true
  },
  [FONT_FAMILY_FALLBACKS["Segoe UI Emoji"]]: {
    metrics: {
      // reusing Excalifont metrics
      unitsPerEm: 1000,
      ascender: 886,
      descender: -374,
      lineHeight: 1.25
    },
    local: true,
    fallback: true
  }
};


export const getLineHeight = fontFamily => {
  const { lineHeight } =
    FONT_METADATA[fontFamily]?.metrics ||
    FONT_METADATA[FONT_FAMILY.Excalifont].metrics;

  return lineHeight;
};
