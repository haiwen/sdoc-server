import { getDocUuidFromUrl } from '../../src/utils';

describe('getDocUuidFromUrl', () => {
  it.each([
    '/api/v1/docs/doc-1',
    '/api/v1/docs/doc-1/',
    '/api/v1/docs/doc-1/collaborators',
    '/api/v1/docs/doc-1/comment/12/replies/34/?from=seahub',
    '/api/v1/docs/doc-1/?doc_uuid=other-doc',
    '/api/v1/exdraw/doc-1',
    '/api/v1/exdraw/doc-1/?from=seahub',
    '/API/V1/DOCS/doc-1/collaborators',
    '/api/v1/docs/doc%2D1/collaborators',
  ])('extracts the Express document parameter from %s', url => {
    expect(getDocUuidFromUrl(url)).toBe('doc-1');
  });

  it.each([
    undefined,
    null,
    '',
    '/',
    '/api/v1/docs',
    '/api/v1/docs/',
    '/api/v1/docs//collaborators',
    '/api/v1/exdraw/',
    '/files/doc-1/',
    '/prefix/api/v1/docs/doc-1/',
    '/api/v2/docs/doc-1/',
    '/api/v1/docs-extra/doc-1/',
    '/?next=/api/v1/docs/doc-1/',
    '/api/v1/docs/%/collaborators',
    '/api/v1/docs/%E0%A4/collaborators',
  ])('returns null when no document parameter can be parsed from %p', url => {
    expect(getDocUuidFromUrl(url)).toBeNull();
  });
});
