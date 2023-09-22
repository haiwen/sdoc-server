import formatSlateNode from './format-slate-node';

const formatContentToVersion2 = (docContent) => {
  const { children } = docContent;
  // format children adn update version to 2
  const newChildren = children.map(item => formatSlateNode(item));
  return {
    ...docContent,
    format_version: 2,
    children: newChildren
  };
};

const formatDocContentToNewVersion = (docContent) => {
  let newDocContent = docContent;
  const { format_version = 1 } = newDocContent;
  if (format_version === 1) {
    newDocContent = formatContentToVersion2(docContent);
  }

  return newDocContent;
};

export {
  formatContentToVersion2,
};

export default formatDocContentToNewVersion;
