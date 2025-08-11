import { arrayToMap } from "./common/utils";
import { orderByFractionalIndex, syncInvalidIndices } from "./element/functionIndex";

const shouldDiscardRemoteElement = (localAppState, local, remote) => {
  if (
    local &&
    // local element is being edited
    (local.id === localAppState?.editingTextElement?.id ||
    local.id === localAppState?.resizingElement?.id ||
    local.id === localAppState?.newElement?.id || // TODO: Is this still valid? As newElement is selection element, which is never part of the elements array
      // local element is newer
      local.version > remote.version ||
      // resolve conflicting edits deterministically by taking the one with
      // the lowest versionNonce
      (local.version === remote.version &&
        local.versionNonce < remote.versionNonce))
  ) {
    return true;
  }
  return false;
};

// const validateIndicesThrottled = throttle(
//   (orderedElements, localElements, remoteElements) => {
//     if (isDevEnv() || isTestEnv() || window?.DEBUG_FRACTIONAL_INDICES) {
//       // create new instances due to the mutation
//       const elements = syncInvalidIndices(orderedElements.map(x => ({ ...x })));

//       validateFractionalIndices(elements, {
//         // throw in dev & test only, to remain functional on `DEBUG_FRACTIONAL_INDICES`
//         shouldThrow: isTestEnv() || isDevEnv(),
//         includeBoundTextValidation: true,
//         reconciliationContext: {
//           localElements,
//           remoteElements
//         }
//       });
//     }
//   },
//   1000 * 60,
//   { leading: true, trailing: false }
// );



export const reconcileElements = (localElements, remoteElements, localAppState
) => {
  const localElementsMap = arrayToMap(localElements);
  const reconciledElements = [];
  const added = new Set();

  // process remote elements
  for (const remoteElement of remoteElements) {
    if (!added.has(remoteElement.id)) {
      const localElement = localElementsMap.get(remoteElement.id);
      const discardRemoteElement = shouldDiscardRemoteElement(
        localAppState,
        localElement,
        remoteElement
      );

      if (localElement && discardRemoteElement) {
        reconciledElements.push(localElement);
        added.add(localElement.id);
      } else {
        reconciledElements.push(remoteElement);
        added.add(remoteElement.id);
      }
    }
  }

  // process remaining local elements
  for (const localElement of localElements) {
    if (!added.has(localElement.id)) {
      reconciledElements.push(localElement);
      added.add(localElement.id);
    }
  }

  const orderedElements = orderByFractionalIndex(reconciledElements);

  // validateIndicesThrottled(orderedElements, localElements, remoteElements);

  // de-duplicate indices
  syncInvalidIndices(orderedElements);

  return orderedElements;
};
