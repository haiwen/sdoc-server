import formatSlateNodeToVersion2 from './format-slate-to-version-2';
import formatSlateNodeToVersion3 from './format-slate-to-version-3';

const formatContentToVersion2 = (docContent) => {
  const { children } = docContent;
  // format children adn update version to 2
  const newChildren = children.map(item => formatSlateNodeToVersion2(item));
  return {
    ...docContent,
    format_version: 2,
    children: newChildren
  };
};

const formatContentToVersion3 = (docContent) => {
  const { children } = docContent;
  // format children adn update version to 3
  const newChildren = children.map(item => formatSlateNodeToVersion3(item));
  return {
    ...docContent,
    format_version: 3,
    children: newChildren
  };
};

const formatContentToVersion4 = (docContent) => {
  const { children } = docContent;
  return {
    ...docContent,
    elements: children,
    format_version: 4,
  };
};

const formatDocContentToNewVersion = (docContent) => {
  let newDocContent = docContent;
  const { format_version = 1 } = newDocContent;
  if (format_version === 1) {
    newDocContent = formatContentToVersion2(docContent);
  }

  if (newDocContent.format_version === 2) {
    newDocContent = formatContentToVersion3(newDocContent);
  }
  
  if (newDocContent.format_version === 3) {
    newDocContent = formatContentToVersion4(newDocContent);
  }

  return newDocContent;
};

export default formatDocContentToNewVersion;

export {
  formatSlateNodeToVersion2,
  formatSlateNodeToVersion3,
  formatContentToVersion2,
  formatContentToVersion3,
};
