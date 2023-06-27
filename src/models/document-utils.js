import { generateDefaultText } from "../utils";

const isHasProperty = (obj, prop) => {
  if (!obj) return false;
  return Object.prototype.hasOwnProperty.call(obj, prop);
};

export const normalizeChildren = (children) => {
  // text
  if (!Array.isArray(children)) return children;

  // element 
  if (Array.isArray(children) && children.length === 0) return [generateDefaultText()];
  return children.map(child => {
    // child is text
    if (isHasProperty(child, 'text') && !isHasProperty(child, 'children')) {
      return child;
    }
    // child is element
    child.children = normalizeChildren(child.children);
    return child;
  });
};