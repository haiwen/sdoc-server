import { v4 } from "uuid";

const isHasProperty = (obj, prop) => {
  if (!obj) return false;
  return Object.prototype.hasOwnProperty.call(obj, prop);
};

const generateDefaultText = (text = '') => {
  return { id: v4(), text };
};

export const generateDefaultDocContent = (docName) => {
  const titleText = docName ? docName.split('.')[0] : '';
  const defaultValue = {
    version: 0,
    children: [
      {id: v4(), type: 'title', children: [generateDefaultText(titleText)]},
      {id: v4(), type: 'paragraph', children: [generateDefaultText()]}
    ],
  };
  return defaultValue;
};

export const isSdocContentValid = (content) => {
  if (!content['children'] || (!content['version'] && content['version'] !== 0)) {
    return false;
  }
  if (!Array.isArray(content['children'])) {
    return false;
  }
  return true;
};

/**
 * delete current user's cursor from returned value
 * @param {*} docContent 
 * @param {*} username 
 * @returns 
 */
export function formatDocContent(docContent, username) {
  const { cursors = {}  } = docContent;
  if (cursors[username]) {
    delete cursors[username];
    docContent.cursors = cursors;
    return docContent;
  }
  return docContent;
}

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
