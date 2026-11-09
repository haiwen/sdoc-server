import { hasWhiteboardReference } from '../../src/modules/exdraw/whiteboard-reference';

const uuid = '11111111-2222-4333-8444-555555555555';
const service = 'https://seafile.test/seahub';
const link = `${service}/smart-link/${uuid}/?readonly=true&filetype=Excalidraw`;
const check = elements => hasWhiteboardReference(elements, uuid, service);

describe('structured sdoc whiteboard references', () => {
  it('finds nested whiteboards without relying on node IDs or persisted signatures', () => {
    expect(check([{ type: 'multi_column', children: [{ type: 'column', children: [
      { type: 'whiteboard', link },
    ] }] }])).toBe(true);
  });

  it('allows another live instance of the same reference after one is deleted', () => {
    expect(check([{ type: 'whiteboard', link, isDeleted: true }, { type: 'whiteboard', link }])).toBe(true);
  });

  it.each([
    undefined, {}, [], [{ text: link }], [{ type: 'link', link }],
    [{ type: 'whiteboard', link, isDeleted: true }],
    [{ type: 'group', isDeleted: true, children: [{ type: 'whiteboard', link }] }],
    [{ type: 'whiteboard', link: 'not a URL' }],
    [{ type: 'whiteboard', link: `${service}/smart-link/${uuid}/embed-link/` }],
    [{ type: 'whiteboard', link: link.replace('https://', 'https://user:password@') }],
    [{ type: 'whiteboard', link: link.replace(uuid, `${uuid}0`) }],
    [{ type: 'whiteboard', link: link.replace('seafile.test', 'seafile.test.attacker.test') }],
  ].map(elements => ({ elements })))('rejects non-authorizing structures: %j', ({ elements }) => {
    expect(check(elements)).toBe(false);
  });
});
