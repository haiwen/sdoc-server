export const formatChildren = (node) => {
  if (!Array.isArray(node)) {
    const newNode = { ...node };
    if (newNode.id) delete newNode.id;
    if (Object.keys(newNode).includes('__self')) delete newNode.__self;
    if (Object.keys(newNode).includes('__source')) delete newNode.__source;
    if (Array.isArray(newNode.children)) {
      newNode.children = formatChildren(newNode.children);
    }
    return newNode;
  }
  const nodeList = Array.from(node);
  return nodeList && nodeList.map(nodeItem => {
    const newNode = { ...nodeItem };
    if (newNode.id) delete newNode.id;
    if (Object.keys(newNode).includes('__self')) delete newNode.__self;
    if (Object.keys(newNode).includes('__source')) delete newNode.__source;
    const list = newNode.children && Array.from(newNode.children);
    if (list && Array.isArray(list) && list.length > 0) {
      newNode.children = list.map(childItem => formatChildren(childItem));
    }
    return newNode;
  });
};
