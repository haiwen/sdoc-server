import { pointsEqual } from "../math/points";
import { isArrowElement, isFreeDrawElement, isLinearElement } from "./typeChecks";

export const INVISIBLY_SMALL_ELEMENT_SIZE = 0.1;

export const isInvisiblySmallElement = element => {
  if (isLinearElement(element) || isFreeDrawElement(element)) {
    return (
      element.points.length < 2 ||
      (element.points.length === 2 &&
        isArrowElement(element) &&
        pointsEqual(
          element.points[0],
          element.points[element.points.length - 1],
          INVISIBLY_SMALL_ELEMENT_SIZE
        ))
    );
  }

  return element.width === 0 && element.height === 0;
};

export const getNormalizedDimensions = element => {
  const ret = {
    width: element.width,
    height: element.height,
    x: element.x,
    y: element.y
  };

  if (element.width < 0) {
    const nextWidth = Math.abs(element.width);
    ret.width = nextWidth;
    ret.x = element.x - nextWidth;
  }

  if (element.height < 0) {
    const nextHeight = Math.abs(element.height);
    ret.height = nextHeight;
    ret.y = element.y - nextHeight;
  }

  return ret;
};

