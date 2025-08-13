import { normalizeEOL } from "../common/utils";

export const normalizeText = text => {
  return (
    normalizeEOL(text)
      // replace tabs with spaces so they render and measure correctly
      .replace(/\t/g, "        ")
  );
};


const splitIntoLines = text => {
  return normalizeText(text).split("\n");
};

/**
 * To get unitless line-height (if unknown) we can calculate it by dividing
 * height-per-line by fontSize.
 */
export const detectLineHeight = textElement => {
  const lineCount = splitIntoLines(textElement.text).length;
  return textElement.height / lineCount / textElement.fontSize;
};
