import { reconcileElements } from './reconcileElements';
import { restoreElements } from './restoreElements';

export const syncElementsToCurrentDocument = (document, elements, user) => {
  const localElements = document.elements;
  const restoredClientElements = restoreElements(elements, null);
  const reconciledElements = reconcileElements(localElements, restoredClientElements, null);

  const version = document.version;
  const newVersion = version + 1;
  document.setLastModifyUser({ username: user._username });
  document.setValue(reconciledElements, newVersion);

  return true;
};
