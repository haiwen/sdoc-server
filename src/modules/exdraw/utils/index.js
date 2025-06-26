export const isHasProperty = (obj, prop) => {
  if (!obj) return false;
  return Object.prototype.hasOwnProperty.call(obj, prop);
};
