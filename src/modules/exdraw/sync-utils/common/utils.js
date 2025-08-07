export const getUpdatedTimestamp = () => Date.now();

export const escapeDoubleQuotes = (str) => {
  return str.replace(/"/g, "&quot;");
};

export const normalizeEOL = (str) => {
  return str.replace(/\r?\n|\r/g, "\n");
};

export const arrayToMap = items => {
  if (items instanceof Map) {
    return items;
  }
  return items.reduce((acc, element) => {
    acc.set(typeof element === "string" ? element : element.id, element);
    return acc;
  }, new Map());
};
