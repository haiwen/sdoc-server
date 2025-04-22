import { v4 } from 'uuid';
import { formatTextNode } from './common';

const formatElementNodeChildren = (children) => {
  if (!children || !Array.isArray(children)) return [{ id: v4(), text: '' }];
  return children.map(item => formatSlateNode(item));
};

const formatElementNode = (node) => {
  const { type, children } = node;

  if (type === 'ordered_list' || type === 'unordered_list') {
    return { ...node, children: formatElementNodeChildren(children)};
  }

  if (type === 'list_item') {
    return { ...node, children: formatElementNodeChildren(children)};
  }

  // list_lic -> paragraph
  if (type === 'list_lic') {
    return { ...node, type: 'paragraph', children: formatElementNodeChildren(children)};
  }

  return node;
};

const formatSlateNode = (slateNode) => {
  if (slateNode.children) {
    return formatElementNode(slateNode);
  }
  return formatTextNode(slateNode);
};

const formatSlateNodeToVersion3 = formatSlateNode;

export default formatSlateNodeToVersion3;
