import { randomInteger } from "../common/random";
import { getUpdatedTimestamp } from "../common/utils";

// eslint-disable-next-line no-unused-vars
export const mutateElement = (element, elementsMap, updates, options) => {
  let didChange = false;

  // casting to any because can't use `in` operator
  // (see https://github.com/microsoft/TypeScript/issues/21732)
  // const { points, fixedSegments, startBinding, endBinding, fileId } = updates;

  // The value here is always false when executed on the server, so no processing is required.
  // if (
  //   isElbowArrow(element) &&
  //   (Object.keys(updates).length === 0 || // normalization case
  //   typeof points !== "undefined" || // repositioning
  //   typeof fixedSegments !== "undefined" || // segment fixing
  //   typeof startBinding !== "undefined" ||
  //   typeof endBinding !== "undefined") // manual binding to element
  // ) {
  //   updates = {
  //     ...updates,
  //     angle: 0,
  //     ...updateElbowArrowPoints(
  //       {
  //         ...element,
  //         x: updates.x || element.x,
  //         y: updates.y || element.y
  //       },
  //       elementsMap,
  //       updates,
  //       options
  //     )
  //   };
  // } else if (typeof points !== "undefined") {
  //   updates = { ...getSizeFromPoints(points), ...updates };
  // }

  for (const key in updates) {
    const value = updates[key];
    if (typeof value !== "undefined") {
      if (
        element[key] === value &&
        // if object, always update because its attrs could have changed
        // (except for specific keys we handle below)
        (typeof value !== "object" ||
          value === null ||
          key === "groupIds" ||
          key === "scale")
      ) {
        continue;
      }

      if (key === "scale") {
        const prevScale = element[key];
        const nextScale = value;
        if (prevScale[0] === nextScale[0] && prevScale[1] === nextScale[1]) {
          continue;
        }
      } else if (key === "points") {
        const prevPoints = element[key];
        const nextPoints = value;
        if (prevPoints.length === nextPoints.length) {
          let didChangePoints = false;
          let index = prevPoints.length;
          while (--index) {
            const prevPoint = prevPoints[index];
            const nextPoint = nextPoints[index];
            if (
              prevPoint[0] !== nextPoint[0] ||
              prevPoint[1] !== nextPoint[1]
            ) {
              didChangePoints = true;
              break;
            }
          }
          if (!didChangePoints) {
            continue;
          }
        }
      }

      element[key] = value;
      didChange = true;
    }
  }

  if (!didChange) {
    return element;
  }

  element.version = updates.version ?? element.version + 1;
  element.versionNonce = updates.versionNonce ?? randomInteger();
  element.updated = getUpdatedTimestamp();

  return element;
};

export const newElementWith = (
  element,
  updates,
  /** pass `true` to always regenerate */
  force = false
) => {
  let didChange = false;
  for (const key in updates) {
    const value = updates[key];
    if (typeof value !== "undefined") {
      if (
        element[key] === value &&
        // if object, always update because its attrs could have changed
        (typeof value !== "object" || value === null)
      ) {
        continue;
      }
      didChange = true;
    }
  }

  if (!didChange && !force) {
    return element;
  }

  return {
    ...element,
    ...updates,
    version: updates.version ?? element.version + 1,
    versionNonce: updates.versionNonce ?? randomInteger(),
    updated: getUpdatedTimestamp()
  };
};

export const bumpVersion = (element, version) => {
  element.version = (version ?? element.version) + 1;
  element.versionNonce = randomInteger();
  element.updated = getUpdatedTimestamp();
  return element;
};

