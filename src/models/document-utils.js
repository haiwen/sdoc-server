import { v4 } from "uuid";
import { FIRST_LEVEL_ELEMENT_TYPES, normalizeElement } from "./normalize-element";
import { isEmptyNode } from "../utils/slate-utils";

const generateDefaultText = (text = '') => {
  return { id: v4(), text };
};

export const generateDefaultParagraph = () => {
  return {
    id: v4(),
    type: 'paragraph',
    children: [generateDefaultText()]
  };
};

export const generateDefaultDocContent = (docTitle, username) => {
  // wiki
  if (!docTitle) {
    const defaultValue = {
      version: 0,
      children: [
        {id: v4(), type: 'paragraph', children: [generateDefaultText()]}
      ],
      format_version: 3,
      last_modify_user: username,
    };
    return defaultValue;
  }
  // sdoc | document plugin
  const titleText = docTitle.replace('.sdoc', ''); 
  const defaultValue = {
    version: 0,
    children: [
      {id: v4(), type: 'title', children: [generateDefaultText(titleText)]},
      {id: v4(), type: 'paragraph', children: [generateDefaultText()]}
    ],
    format_version: 3,
    last_modify_user: username,
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
export function resetDocContentCursors(docContent, username) {
  const { cursors = {}  } = docContent;
  if (cursors[username]) {
    delete cursors[username];
    docContent.cursors = cursors;
    return docContent;
  }
  return docContent;
}

export const normalizeChildren = (children) => {
  if (!children || !Array.isArray(children) || children.length === 0) {
    const doc = generateDefaultDocContent();
    return doc.children;
  }

  // The type of the first-level sub-element must exist. If it does not exist, delete it.
  let newChildren = children.filter(item => {
    return item.type && FIRST_LEVEL_ELEMENT_TYPES.includes(item.type);
  });
  if (newChildren.length === 0) return [generateDefaultParagraph()];

  newChildren = newChildren.map(child => normalizeElement(child));

  const lastChild = newChildren[newChildren.length - 1];
  if (!isEmptyNode(lastChild)) {
    newChildren.push(generateDefaultParagraph());
  }
  
  return newChildren;
};
