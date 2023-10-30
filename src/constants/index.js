// base api prefix
export const BASE_URL_VERSION1 = '/api/v1/docs';

// cached operations limit
export const OPERATIONS_CACHE_LIMIT = 1000;

// message type
export const MESSAGE = {
  DOC_REPLACED: 'doc-replaced',
  DOC_REMOVED: 'doc-removed',
  DOC_PUBLISHED: 'doc-published',
};

export const SAVE_STATUS = {
  BEING_EDITED: 1,
  READY_SAVING: 2,
  CLOSED_STATE: 4,
  SAVED_EDITED: 6,
};
