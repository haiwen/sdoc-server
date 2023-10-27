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
  NO_ACCESS: 0,
  NO_UPDATE: 1,
  HAS_UPDATE: 2,
  HAS_ACCESS: 4,
};
