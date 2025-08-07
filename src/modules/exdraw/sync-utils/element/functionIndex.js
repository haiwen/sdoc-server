import { generateNKeysBetween } from "fractional-indexing";
import { mutateElement } from "./mutateElement";
import { arrayToMap } from "../common/utils";

const generateIndices = (elements, indicesGroups) => {
  const elementsUpdates = new Map();

  for (const indices of indicesGroups) {
    const lowerBoundIndex = indices.shift();
    const upperBoundIndex = indices.pop();

    const fractionalIndices = generateNKeysBetween(
      elements[lowerBoundIndex]?.index,
      elements[upperBoundIndex]?.index,
      indices.length
    );

    for (let i = 0; i < indices.length; i++) {
      const element = elements[indices[i]];

      elementsUpdates.set(element, {
        index: fractionalIndices[i]
      });
    }
  }

  return elementsUpdates;
};


const isOrderedElement = element => {
  // for now it's sufficient whether the index is there
  // meaning, the element was already ordered in the past
  // meaning, it is not a newly inserted element, not an unrestored element, etc.
  // it does not have to mean that the index itself is valid
  if (element.index) {
    return true;
  }

  return false;
};

const isValidFractionalIndex = (index, predecessor, successor) => {
  if (!index) {
    return false;
  }

  if (predecessor && successor) {
    return predecessor < index && index < successor;
  }

  if (!predecessor && successor) {
    // first element
    return index < successor;
  }

  if (predecessor && !successor) {
    // last element
    return predecessor < index;
  }

  // only element in the array
  return !!index;
};


export const orderByFractionalIndex = elements => {
  return elements.sort((a, b) => {
    // in case the indices are not the defined at runtime
    if (isOrderedElement(a) && isOrderedElement(b)) {
      if (a.index < b.index) {
        return -1;
      } else if (a.index > b.index) {
        return 1;
      }

      // break ties based on the element id
      return a.id < b.id ? -1 : 1;
    }

    // defensively keep the array order
    return 1;
  });
};

const getInvalidIndicesGroups = elements => {
  const indicesGroups = [];

  // once we find lowerBound / upperBound, it cannot be lower than that, so we cache it for better perf.
  let lowerBound = undefined;
  let upperBound = undefined;
  let lowerBoundIndex = -1;
  let upperBoundIndex = 0;

  /** @returns maybe valid lowerBound */
  const getLowerBound = index => {
    const lowerBound = elements[lowerBoundIndex]
      ? elements[lowerBoundIndex].index
      : undefined;

    // we are already iterating left to right, therefore there is no need for additional looping
    const candidate = elements[index - 1]?.index;

    if (
      (!lowerBound && candidate) || // first lowerBound
      (lowerBound && candidate && candidate > lowerBound) // next lowerBound
    ) {
      // WARN: candidate's index could be higher or same as the current element's index
      return [candidate, index - 1];
    }

    // cache hit! take the last lower bound
    return [lowerBound, lowerBoundIndex];
  };

  /** @returns always valid upperBound */
  const getUpperBound = index => {
    const upperBound = elements[upperBoundIndex]
      ? elements[upperBoundIndex].index
      : undefined;

    // cache hit! don't let it find the upper bound again
    if (upperBound && index < upperBoundIndex) {
      return [upperBound, upperBoundIndex];
    }

    // set the current upperBoundIndex as the starting point
    let i = upperBoundIndex;
    while (++i < elements.length) {
      const candidate = elements[i]?.index;

      if (
        (!upperBound && candidate) || // first upperBound
        (upperBound && candidate && candidate > upperBound) // next upperBound
      ) {
        return [candidate, i];
      }
    }

    // we reached the end, sky is the limit
    return [undefined, i];
  };

  let i = 0;

  while (i < elements.length) {
    const current = elements[i].index
    ;[lowerBound, lowerBoundIndex] = getLowerBound(i)
    ;[upperBound, upperBoundIndex] = getUpperBound(i);

    if (!isValidFractionalIndex(current, lowerBound, upperBound)) {
      // push the lower bound index as the first item
      const indicesGroup = [lowerBoundIndex, i];

      while (++i < elements.length) {
        const current = elements[i].index;
        const [nextLowerBound, nextLowerBoundIndex] = getLowerBound(i);
        const [nextUpperBound, nextUpperBoundIndex] = getUpperBound(i);

        if (isValidFractionalIndex(current, nextLowerBound, nextUpperBound)) {
          break;
        }

        // assign bounds only for the moved elements
        [lowerBound, lowerBoundIndex] = [nextLowerBound, nextLowerBoundIndex]
        ;[upperBound, upperBoundIndex] = [nextUpperBound, nextUpperBoundIndex];

        indicesGroup.push(i);
      }

      // push the upper bound index as the last item
      indicesGroup.push(upperBoundIndex);
      indicesGroups.push(indicesGroup);
    } else {
      i++;
    }
  }

  return indicesGroups;
};


export const syncInvalidIndices = elements => {
  const elementsMap = arrayToMap(elements);
  const indicesGroups = getInvalidIndicesGroups(elements);
  const elementsUpdates = generateIndices(elements, indicesGroups);

  for (const [element, { index }] of elementsUpdates) {
    mutateElement(element, elementsMap, { index });
  }

  return elements;
};

