
import { v4 } from 'uuid';

const convertKeys = {
  'color': 'color',
  'highlight-color': 'highlight_color',
  'font-size': 'font_size',
  'font': 'font',
  'BOLD': 'bold',
  'ITALIC': 'italic',
  'UNDERLINE': 'underline',
  'STRIKETHROUGH': 'strikethrough',
  'SUPERSCRIPT': 'superscript',
  'SUBSCRIPT': 'subscript',
  'CODE': 'code',
  'DELETE': 'delete',
  'ADD': 'add',
};

const formatTextNode = (node) => {
  const textKeys = Object.keys(node);
  // key is not text and node[key] is exist
  const markKeys = textKeys.filter(key => key !== 'id' && key !== 'text' && node[key]);
  const newNode = { id: node['id'], text: node['text'] };
  markKeys.forEach(key => {
    const newKey = convertKeys[key];
    newNode[newKey] = node[key];
  });
  
  return newNode;
};

const formatElementNodeChildren = (children) => {
  if (!children || !Array.isArray(children)) return [{ id: v4(), text: '' }];
  return children.map(item => formatSlateNode(item));
};

const formatElementNode = (node) => {
  const { type, children } = node;

  if (type === 'blockquote') {
    return { ...node, children: formatElementNodeChildren(children) };
  }
  
  if (type === 'title' || type === 'subtitle') {
    return { ...node, children: formatElementNodeChildren(children) };
  }

  // header1 | header2 | header3 | header4 | header5 | header6
  if (type && type.includes('header')) {
    return { ...node, children: formatElementNodeChildren(children)};
  }

  // ordered_list | unordered_list
  if (type === 'ordered_list' || type === 'unordered_list') {
    return { ...node, children: formatElementNodeChildren(children)};
  }
  
  // list-item -> list_item
  if (type === 'list-item') {
    return { ...node, type: 'list_item', children: formatElementNodeChildren(children)};
  }

  // list-lic -> list_lic
  if (type === 'list-lic') {
    return { ...node, type: 'list_lic', children: formatElementNodeChildren(children)};
  }
  
  // check-list-item -> check_list_item
  if (type === 'check-list-item') {
    return { ...node, type: 'check_list_item', children: formatElementNodeChildren(children)};
  }
  
  if (type === 'paragraph') {
    return { ...node, children: formatElementNodeChildren(children)};
  }
  
  // code-block -> code_block
  if (type === 'code-block') {
    return { ...node, type: 'code_block', children: formatElementNodeChildren(children)};
  }
  
  // code-line -> code_line
  if (type === 'code-line') {
    return { ...node, type: 'code_line', children: formatElementNodeChildren(children)};
  }
  
  
  if (type === 'table') {
    return { ...node, children: formatElementNodeChildren(children)};
  }
  
  // table-row -> table_row
  if (type === 'table-row') {
    // format table-row's style
    const oldStyle = node.style || {};
    const newStyle = {
      ...(oldStyle.minHeight && { min_height: oldStyle.minHeight }),
    };
    if (Object.keys(newStyle).length > 0) {
      node.style = newStyle;
    }
    return { ...node, type: 'table_row', children: formatElementNodeChildren(children)};
  }
  
  // table-cell -> table-cell
  if (type === 'table-cell') {
    // format table-cell's style
    const oldStyle = node.style || {};
    const newStyle = {
      ...(oldStyle.textAlign && { text_align: oldStyle.textAlign }),
      ...(oldStyle.bg_color && { background_color: oldStyle.bg_color }),
    };
    if (Object.keys(newStyle).length > 0) {
      node.style = newStyle;
    }

    return { ...node, type: 'table_cell', children: formatElementNodeChildren(children)};
  }

  if (type === 'link') {
    return { ...node, children: formatElementNodeChildren(children)};
  }

  // sdoc-link -> sdoc-link
  if (type === 'sdoc-link') {
    return { ...node, type: 'sdoc_link', children: formatElementNodeChildren(children)};
  }
  
  if (type === 'file_link') {
    return { ...node, children: formatElementNodeChildren(children)};
  }
  
  if (type === 'image') {
    return { ...node, children: formatElementNodeChildren(children)};
  }

  return node;
};

const formatSlateNode = (slateNode) => {
  if (slateNode.children) {
    return formatElementNode(slateNode);
  }
  return formatTextNode(slateNode);
};

export default formatSlateNode;
