export const arrayToMap = items => {
  if (items instanceof Map) {
    return items;
  }
  return items.reduce((acc, element) => {
    acc.set(typeof element === "string" ? element : element.id, element);
    return acc;
  }, new Map());
};

export function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

