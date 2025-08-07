export const getUpdatedTimestamp = () => Date.now();

export const escapeDoubleQuotes = (str) => {
  return str.replace(/"/g, "&quot;");
};

export const normalizeEOL = (str) => {
  return str.replace(/\r?\n|\r/g, "\n");
};
