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

export {
  formatTextNode,
};
