export const encodePathSegment = value => {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^[a-zA-Z0-9_-]+$/.test(String(value))) {
    throw new TypeError('Invalid Seahub API path parameter');
  }
  return encodeURIComponent(value);
};

export const validateDownloadLink = value => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('Invalid Seahub download link');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError('Invalid Seahub download link');
  }
  return url.href;
};
