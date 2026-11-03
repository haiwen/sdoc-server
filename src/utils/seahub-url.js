export const encodePathSegment = value => {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^[a-zA-Z0-9_-]+$/.test(String(value))) {
    throw new TypeError('Invalid Seahub API path parameter');
  }
  return encodeURIComponent(value);
};
