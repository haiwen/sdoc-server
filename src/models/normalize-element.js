import { v4 } from "uuid";

const isHasProperty = (obj, prop) => {
  if (!obj) return false;
  return Object.prototype.hasOwnProperty.call(obj, prop);
};

// child types: image | link | sdoc_link | file_link | text
const INLINE_TYPES = ['link', 'sdoc_link', 'file_link', 'image', 'column', 'wiki_link'];
const INLINE_TYPES_WITHOUT_IMAGE = ['link', 'sdoc_link', 'file_link', 'wiki_link'];
const BLOCKQUOTE_CHILDREN_TYPES = [
  'ordered_list',
  'unordered_list',
  'check_list_item',
  'title',
  'subtitle',
  'header1',
  'header2',
  'header3',
  'header4',
  'header5',
  'header6',
  'paragraph',
  'group',
];
export const FIRST_LEVEL_ELEMENT_TYPES = [
  'blockquote',
  'title',
  'subtitle',
  'header1',
  'header2',
  'header3',
  'header4',
  'header5',
  'header6',
  'ordered_list',
  'unordered_list',
  'check_list_item',
  'paragraph',
  'code_block',
  'table',
  'callout',
  'image_block',
  'video',
  'seatable_table',
  'multi_column',
  'column',
  'group',
];

const isElementNeedChildrenAttributes = (element) => {
  const types = [...FIRST_LEVEL_ELEMENT_TYPES, ...INLINE_TYPES];
  return types.includes(element.type);
};

/**
 * format element's children, every element child is block
 * @param {*} children element's children
 * @param {*} childType child type
 * @returns 
 */
const formatElementChildren = (children, childType) => {
  const validChildrenTypes = [childType, 'group'];
  const defaultChildren = [{
    id: v4(),
    type: childType,
    children: []
  }];
  if (!children || !Array.isArray(children) || children.length === 0) {
    return defaultChildren;
  }
  const newChildren = children.filter(item => item.type && validChildrenTypes.includes(item.type));
  return newChildren.length === 0 ? defaultChildren : newChildren;
};

const formatListItemChildren = (children) => {
  const defaultChildren = [{
    id: v4(),
    type: 'paragraph',
    children: []
  }];
  if (!children || !Array.isArray(children) || children.length === 0) {
    return defaultChildren;
  }
  const types = ['paragraph', 'unordered_list', 'ordered_list', 'group'];
  const newChildren = children.filter(item => item.type && types.includes(item.type));
  return newChildren.length === 0 ? defaultChildren : newChildren;
};

/**
 * format element's children, every element child are block or inline
 * @param {*} children element's children
 * @param {*} types child support types
 * @returns 
 */
const formatElementChildrenWithTypes = (children, types) => {
  const defaultChildren = [{
    id: v4(),
    text: '',
  }];

  if (!children || !Array.isArray(children) || children.length === 0) {
    return defaultChildren;
  }

  const newChildren = children.filter(item => {
    if (!item.type) return true;
    if (types && types.length !== 0 && types.includes(item.type)) return true;
    return false;
  });
  return newChildren.length === 0 ? defaultChildren : newChildren;
};

export const normalizeElement = (element) => {
  const { type, children } = element;
  // child is text
  if (isHasProperty(element, 'text') && !isElementNeedChildrenAttributes(element)) {
    return element;
  }

  // After the data structure is wrong, the element containing the children attribute may have an extra text attribute,
  // which needs to be cleaned up to ensure the consistency of the data structure and avoid other bugs.
  if (element.text) {
    delete element.text;
  }


  switch(type) {
    case 'blockquote': {
      const validChildren = formatElementChildrenWithTypes(children, [...INLINE_TYPES, ...BLOCKQUOTE_CHILDREN_TYPES]);
      element.children = validChildren.map(element => {
        if (BLOCKQUOTE_CHILDREN_TYPES.includes(element.type)) {
          return normalizeElement(element);
        }
        // Patch: Convert inline nodes to paragraphs
        return {
          id: v4(),
          type: 'paragraph',
          children: [element],
        };
      });
      break;
    }
    case 'title':
    case 'subtitle':
    case 'header1':
    case 'header2':
    case 'header3':
    case 'header4':
    case 'header5':
    case 'header6': {
      element.children = formatElementChildrenWithTypes(children, INLINE_TYPES_WITHOUT_IMAGE);
      break;
    }
    case 'ordered_list':
    case 'unordered_list': {
      const validChildren = formatElementChildren(children, 'list_item');
      element.children = validChildren.map(element => normalizeElement(element));
      break;
    }
    case 'list_item': {
      const validChildren = formatListItemChildren(children);
      element.children = validChildren.map(element => normalizeElement(element));
      break;
    }
    case 'check_list_item':
    case 'paragraph': {
      element.children = formatElementChildrenWithTypes(children, INLINE_TYPES);
      break;
    }
    case 'code_block': {
      const validChildren = formatElementChildren(children, 'code_line');
      element.children = validChildren.map(element => normalizeElement(element));
      break;
    }
    case 'code_line': {
      const validChildren = formatElementChildrenWithTypes(children);
      element.children = validChildren.map(element => normalizeElement(element));
      break;
    }
    case 'table': {
      const validChildren = formatElementChildren(children, 'table_row');
      element.children = validChildren.map(element => normalizeElement(element));
      break;
    }
    case 'table_row': {
      const validChildren = formatElementChildren(children, 'table_cell');
      element.children = validChildren.map(element => normalizeElement(element));
      break;
    }
    case 'table_cell': {
      const supportTypes = [
        ...INLINE_TYPES, 
        'check_list_item',
        'ordered_list', 
        'unordered_list',
      ];
      const validChildren = formatElementChildrenWithTypes(children, supportTypes);
      element.children = validChildren.map(element => normalizeElement(element));
      break;
    }
    case 'image_block': {
      // patch
      if (children.length === 1 && isHasProperty(children[0], 'text')) {
        element = {
          ...element,
          type: 'paragraph',
        };
        break;
      }
      // default
      break;
    }
    case 'group': {
      element.children = element.children.map(element => normalizeElement(element));
    }
  }

  return element;
};
