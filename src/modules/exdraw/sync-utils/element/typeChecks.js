import { pointsEqual } from "../math/points";

export const isLinearElement = element => {
  return element != null && isLinearElementType(element.type);
};

export const isLinearElementType = elementType => {
  return (
    elementType === "arrow" || elementType === "line" // || elementType === "freedraw"
  );
};

export const isFreeDrawElement = element => {
  return element != null && isFreeDrawElementType(element.type);
};

export const isFreeDrawElementType = elementType => {
  return elementType === "freedraw";
};


export const isElbowArrow = element => {
  return isArrowElement(element) && element.elbowed;
};

export const isArrowElement = element => {
  return element != null && element.type === "arrow";
};

export const isBindableElement = (element, includeLocked = true) => {
  return (
    element != null &&
    (!element.locked || includeLocked === true) &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse" ||
      element.type === "image" ||
      element.type === "iframe" ||
      element.type === "embeddable" ||
      element.type === "frame" ||
      element.type === "magicframe" ||
      (element.type === "text" && !element.containerId))
  );
};

export const isUsingAdaptiveRadius = (type) =>
  type === "rectangle" ||
  type === "embeddable" ||
  type === "iframe" ||
  type === "image";

export const isLineElement = element => {
  return element != null && element.type === "line";
};

export const isValidPolygon = points => {
  return points.length > 3 && pointsEqual(points[0], points[points.length - 1]);
};

export const isFixedPointBinding = binding => {
  return Object.hasOwn(binding, "fixedPoint") && binding.fixedPoint != null;
};



