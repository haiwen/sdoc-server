// base api prefix
export const BASE_URL_VERSION1 = '/api/v1/docs';

// cached operations limit
export const OPERATIONS_CACHE_LIMIT = 1000;

// message type
export const MESSAGE = {
  DOC_REPLACED: 'doc-replaced',
  DOC_REMOVED: 'doc-removed',
  DOC_PUBLISHED: 'doc-published',
  PARTICIPANT_ADDED: 'participant-added',
  PARTICIPANT_REMOVED: 'participant-removed',
};

export const DOC_CACHE_TIME = 24 * 60 * 60 * 1000;

export const DOC_FORMAT_VERSION = 4;

export const ELEMENT_COMMAND_LIMITS = {
  MAX_COMMANDS: 100,
  MAX_REQUEST_BYTES: 1024 * 1024,
  MAX_TEXT_BYTES: 256 * 1024,
};
