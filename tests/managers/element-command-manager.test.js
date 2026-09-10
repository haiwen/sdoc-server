import deepCopy from 'deep-copy';
import ElementCommandManager, { ElementCommandError } from '../../src/modules/sdoc/managers/element-command-manager';
import { ELEMENT_COMMAND_LIMITS } from '../../src/modules/sdoc/constants';
import { applyOperations } from '../../src/modules/sdoc/utils/slate-utils';

const text = (id, value) => ({ id, text: value });
const paragraph = (id, value) => ({ id, type: 'paragraph', children: [text(`${id}-text`, value)] });

const makeDocument = (elements = [paragraph('p1', 'one'), paragraph('p2', 'two')], version = 3) => ({
  version,
  elements: deepCopy(elements),
});

const prepare = (document, commands) => new ElementCommandManager().prepare(document, {
  commands,
});

const expectError = (callback, errorCode, commandIndex) => {
  try {
    callback();
    throw new Error('Expected an ElementCommandError');
  } catch (error) {
    expect(error).toBeInstanceOf(ElementCommandError);
    expect(error.error_code).toBe(errorCode);
    expect(error.command_index).toBe(commandIndex);
  }
};

describe('ElementCommandManager', () => {
  it('inserts root elements with prepend, append, before and after positioning', () => {
    const document = makeDocument();
    const plan = prepare(document, [
      { kind: 'insert_element', position: 'prepend', parent_element_id: null, payload: { type: 'paragraph', text: 'start' } },
      { kind: 'insert_element', position: 'append', parent_element_id: null, payload: { type: 'paragraph', text: 'end' } },
      { kind: 'insert_element', before_element_id: 'p2', parent_element_id: null, payload: { type: 'header1', text: 'before' } },
      { kind: 'insert_element', after_element_id: 'p2', parent_element_id: null, payload: { type: 'paragraph', text: 'after' } },
    ]);

    expect(plan.elements.map(element => element.children[0].text)).toEqual(['start', 'one', 'before', 'two', 'after', 'end']);
  });

  it('preserves command order for multiple before and after inserts at one anchor', () => {
    const plan = prepare(makeDocument(), [
      { kind: 'insert_element', parent_element_id: null, before_element_id: 'p2', payload: { type: 'paragraph', text: 'before-1' } },
      { kind: 'insert_element', parent_element_id: null, before_element_id: 'p2', payload: { type: 'paragraph', text: 'before-2' } },
      { kind: 'insert_element', parent_element_id: null, after_element_id: 'p2', payload: { type: 'paragraph', text: 'after-1' } },
      { kind: 'insert_element', parent_element_id: null, after_element_id: 'p2', payload: { type: 'paragraph', text: 'after-2' } },
    ]);

    expect(plan.elements.map(element => element.children[0].text)).toEqual(['one', 'before-1', 'before-2', 'two', 'after-1', 'after-2']);
  });

  it('recalculates after and prepend positions after inserted targets are deleted', () => {
    const afterPlan = prepare(makeDocument(), [
      { kind: 'insert_element', client_ref: 'x', parent_element_id: null, after_element_id: 'p1', payload: { type: 'paragraph', text: 'x' } },
      { kind: 'delete_element', target_ref: 'x' },
      { kind: 'insert_element', parent_element_id: null, after_element_id: 'p1', payload: { type: 'paragraph', text: 'y' } },
    ]);
    expect(afterPlan.elements.map(element => element.children[0].text)).toEqual(['one', 'y', 'two']);

    const prependPlan = prepare(makeDocument(), [
      { kind: 'insert_element', client_ref: 'x', parent_element_id: null, position: 'prepend', payload: { type: 'paragraph', text: 'x' } },
      { kind: 'delete_element', target_ref: 'x' },
      { kind: 'insert_element', parent_element_id: null, position: 'prepend', payload: { type: 'paragraph', text: 'y' } },
    ]);
    expect(prependPlan.elements.map(element => element.children[0].text)).toEqual(['y', 'one', 'two']);
  });

  it('produces operations that replay to the preflight document', () => {
    const document = makeDocument();
    const plan = prepare(document, [
      { kind: 'insert_element', client_ref: 'x', parent_element_id: null, after_element_id: 'p1', payload: { type: 'paragraph', text: 'x' } },
      { kind: 'delete_element', target_ref: 'x' },
      { kind: 'insert_element', parent_element_id: null, after_element_id: 'p1', payload: { type: 'paragraph', text: 'y' } },
    ]);
    const replay = {
      version: document.version,
      elements: deepCopy(document.elements),
      setLastModifyUser: () => {},
      setValue(elements) {
        this.elements = elements;
      },
    };

    expect(applyOperations(replay, deepCopy(plan.operations), { username: 'writer@example.com' })).toBe(true);
    expect(replay.elements).toEqual(plan.elements);
  });

  it('supports earlier batch references and rejects duplicate, missing and forward references', () => {
    const plan = prepare(makeDocument(), [
      { kind: 'insert_element', client_ref: 'list', parent_element_id: null, position: 'append', payload: { type: 'unordered_list' } },
      { kind: 'insert_element', parent_ref: 'list', position: 'append', payload: { type: 'list_item', text: 'item' } },
      { kind: 'replace_element_content', target_ref: 'list', payload: { text: 'not allowed' } },
    ].slice(0, 2));
    expect(plan.elements[2].children[0].children[0].children[0].text).toBe('item');
    expectError(() => prepare(makeDocument(), [
      { kind: 'insert_element', client_ref: 'same', parent_element_id: null, position: 'append', payload: { type: 'paragraph', text: 'one' } },
      { kind: 'insert_element', client_ref: 'same', parent_element_id: null, position: 'append', payload: { type: 'paragraph', text: 'two' } },
    ]), 'invalid_request', 1);
    expectError(() => prepare(makeDocument(), [{ kind: 'delete_element', target_ref: 'missing' }]), 'invalid_request', 0);
    expectError(() => prepare(makeDocument(), [
      { kind: 'delete_element', target_ref: 'later' },
      { kind: 'insert_element', client_ref: 'later', parent_element_id: null, position: 'append', payload: { type: 'paragraph', text: 'later' } },
    ]), 'invalid_request', 0);
  });

  it('returns mappings for client references that match object prototype property names', () => {
    const plan = prepare(makeDocument(), [{
      kind: 'insert_element',
      client_ref: '__proto__',
      parent_element_id: null,
      position: 'append',
      payload: { type: 'paragraph', text: 'prototype-safe' },
    }]);

    expect(Object.getPrototypeOf(plan.elementIdMappings)).toBeNull();
    expect(plan.elementIdMappings.__proto__).toBe(plan.commandResults[0].target_element_id);
    expect(JSON.parse(JSON.stringify(plan.elementIdMappings)).__proto__).toBe(plan.commandResults[0].target_element_id);
  });

  it('rejects empty element identifiers and references without side effects', () => {
    const document = makeDocument();
    const originalElements = deepCopy(document.elements);
    const invalidCommands = [
      [{ kind: 'delete_element', target_element_id: '' }, 'invalid_request'],
      [{ kind: 'delete_element', target_ref: '' }, 'invalid_request'],
      [{ kind: 'insert_element', parent_element_id: '', position: 'append', payload: { type: 'paragraph', text: 'bad parent' } }, 'invalid_request'],
      [{ kind: 'insert_element', parent_ref: '', position: 'append', payload: { type: 'paragraph', text: 'bad parent ref' } }, 'invalid_request'],
      [{ kind: 'insert_element', client_ref: '', parent_element_id: null, position: 'append', payload: { type: 'paragraph', text: 'bad client ref' } }, 'invalid_request'],
      [{ kind: 'insert_element', parent_element_id: null, before_element_id: '', payload: { type: 'paragraph', text: 'bad anchor' } }, 'invalid_anchor'],
    ];

    invalidCommands.forEach(([command, errorCode]) => {
      expectError(() => prepare(document, [command]), errorCode, 0);
    });

    expect(document.elements).toEqual(originalElements);
    expect(document.version).toBe(3);
  });

  it('rejects invalid hierarchy and anchors outside the declared parent', () => {
    const list = { id: 'list', type: 'unordered_list', children: [{ id: 'item', type: 'list_item', children: [paragraph('list-p', 'item')] }] };
    expectError(() => prepare(makeDocument([paragraph('p1', 'one'), list]), [{
      kind: 'insert_element', parent_element_id: 'item', position: 'append', payload: { type: 'header1', text: 'bad' },
    }]), 'invalid_parent_child', 0);
    expectError(() => prepare(makeDocument([paragraph('p1', 'one'), list]), [{
      kind: 'insert_element', parent_element_id: 'list', after_element_id: 'p1', payload: { type: 'list_item', text: 'bad anchor' },
    }]), 'invalid_anchor', 0);
  });

  it('accepts existing normalized group and code-block structures when changing another paragraph', () => {
    const listGroup = {
      id: 'list-group',
      type: 'group',
      children: [{ id: 'group-item', type: 'list_item', children: [paragraph('group-paragraph', 'group item')] }],
    };
    const codeBlock = {
      id: 'code-block',
      type: 'code_block',
      children: [{ id: 'code-line', type: 'code_line', children: [text('code-text', 'code')] }],
    };
    const listItemGroup = {
      id: 'item-group',
      type: 'group',
      children: [paragraph('item-group-paragraph', 'item group')],
    };
    const list = {
      id: 'list',
      type: 'unordered_list',
      children: [listGroup, { id: 'item', type: 'list_item', children: [codeBlock, listItemGroup] }],
    };
    const table = {
      id: 'table',
      type: 'table',
      children: [{
        id: 'table-group',
        type: 'group',
        children: [{
          id: 'row',
          type: 'table_row',
          children: [{
            id: 'cell-group',
            type: 'group',
            children: [{ id: 'cell', type: 'table_cell', children: [text('cell-text', 'cell')] }],
          }],
        }],
      }],
    };
    const plan = prepare(makeDocument([paragraph('p1', 'one'), list, table]), [{
      kind: 'replace_element_content', target_element_id: 'p1', payload: { text: 'updated' },
    }]);

    expect(plan.elements[0].children[0].text).toBe('updated');
  });

  it('deletes a complete table subtree but protects its structural rows, cells and wrapper groups', () => {
    const table = {
      id: 'table',
      type: 'table',
      children: [
        { id: 'table-group', type: 'group', children: [{ id: 'group-row', type: 'table_row', children: [{ id: 'group-cell', type: 'table_cell', children: [text('group-cell-text', 'cell')] }] }] },
        { id: 'row', type: 'table_row', children: [{ id: 'cell', type: 'table_cell', children: [text('cell-text', 'cell')] }, { id: 'row-group', type: 'group', children: [{ id: 'row-group-cell', type: 'table_cell', children: [text('row-group-cell-text', 'cell')] }] }] },
      ],
    };
    const document = makeDocument([paragraph('p1', 'one'), table]);
    const tablePlan = prepare(document, [{ kind: 'delete_element', target_element_id: 'table' }]);
    expect(tablePlan.elements).toEqual([paragraph('p1', 'one')]);

    ['row', 'cell', 'table-group', 'row-group'].forEach(targetElementId => {
      expectError(() => prepare(document, [{ kind: 'delete_element', target_element_id: targetElementId }]), 'unsupported_element_type', 0);
    });
    expect(document.elements).toEqual([paragraph('p1', 'one'), table]);
  });

  it('rejects direct deletion of text leaves and structural internal elements without side effects', () => {
    const list = {
      id: 'list',
      type: 'unordered_list',
      children: [
        { id: 'item-1', type: 'list_item', children: [paragraph('item-1-paragraph', 'one')] },
        { id: 'item-2', type: 'list_item', children: [paragraph('item-2-paragraph', 'two')] },
      ],
    };
    const codeBlock = { id: 'code-block', type: 'code_block', children: [{ id: 'code-line', type: 'code_line', children: [text('code-text', 'code')] }] };
    const table = { id: 'table', type: 'table', children: [{ id: 'row', type: 'table_row', children: [{ id: 'cell', type: 'table_cell', children: [text('cell-text', 'cell')] }] }] };
    const multiColumn = { id: 'multi-column', type: 'multi_column', children: [{ id: 'column', type: 'column', children: [paragraph('column-paragraph', 'column')] }] };
    const document = makeDocument([paragraph('p1', 'one'), list, codeBlock, table, multiColumn]);
    const originalElements = deepCopy(document.elements);

    ['p1-text', 'code-line', 'row', 'cell', 'column'].forEach(targetElementId => {
      expectError(() => prepare(document, [{ kind: 'delete_element', target_element_id: targetElementId }]), 'unsupported_element_type', 0);
    });

    expect(document.elements).toEqual(originalElements);
    expect(document.version).toBe(3);
  });

  it('validates multi-column structure without exposing columns as direct targets', () => {
    const multiColumn = {
      id: 'multi-column',
      type: 'multi_column',
      children: [{
        id: 'column',
        type: 'column',
        children: [
          paragraph('column-paragraph', 'column'),
          {
            id: 'column-list',
            type: 'unordered_list',
            children: [{ id: 'column-list-item', type: 'list_item', children: [paragraph('column-list-paragraph', 'item')] }],
          },
          {
            id: 'column-callout',
            type: 'callout',
            children: [paragraph('column-callout-paragraph', 'note')],
          },
          {
            id: 'column-code-block',
            type: 'code_block',
            children: [{ id: 'column-code-line', type: 'code_line', children: [text('column-code-text', 'code')] }],
          },
        ],
      }],
    };
    const validDocument = makeDocument([paragraph('p1', 'one'), multiColumn]);
    const plan = prepare(validDocument, [{
      kind: 'replace_element_content', target_element_id: 'p1', payload: { text: 'updated' },
    }]);

    expect(plan.elements[0].children[0].text).toBe('updated');
    expect(plan.elements[1]).toEqual(multiColumn);
    expectError(() => prepare(validDocument, [{
      kind: 'delete_element', target_element_id: 'column',
    }]), 'unsupported_element_type', 0);
  });

  it.each([
    ['a paragraph directly under multi-column', [
      paragraph('p1', 'one'),
      { id: 'multi-column', type: 'multi_column', children: [paragraph('invalid-child', 'invalid')] },
    ]],
    ['a root-level column', [
      paragraph('p1', 'one'),
      { id: 'column', type: 'column', children: [paragraph('column-paragraph', 'column')] },
    ]],
    ['a root-level text leaf', [
      paragraph('p1', 'one'),
      text('root-text', 'invalid'),
    ]],
  ])('rejects documents with %s without side effects', (description, elements) => {
    const document = makeDocument(elements);
    const originalElements = deepCopy(document.elements);

    expectError(() => prepare(document, [{
      kind: 'replace_element_content', target_element_id: 'p1', payload: { text: 'updated' },
    }]), 'apply_failed', null);

    expect(document.elements).toEqual(originalElements);
    expect(document.version).toBe(3);
  });

  it('applies direct-target restrictions to targets resolved by client reference', () => {
    const manager = new ElementCommandManager();
    const elements = [{ id: 'code-block', type: 'code_block', children: [{ id: 'code-line', type: 'code_line', children: [text('code-text', 'code')] }] }];

    // Public batches cannot insert prohibited internal node types, so exercise the
    // shared target resolver with the same reference map it receives during preflight.
    expectError(() => manager.resolveTarget(
      { target_ref: 'code-line' },
      0,
      elements,
      new Map([['code-line', 'code-line']]),
    ), 'unsupported_element_type', 0);
  });

  it('rejects deletions that leave a parent without children without creating a plan', () => {
    const document = makeDocument([paragraph('p1', 'one')]);
    const originalElements = deepCopy(document.elements);

    expectError(() => prepare(document, [{ kind: 'delete_element', target_element_id: 'p1-text' }]), 'unsupported_element_type', 0);

    expect(document.elements).toEqual(originalElements);
    expect(document.version).toBe(3);
  });

  it('deletes a complete subtree and rejects a resulting invalid hierarchy', () => {
    const list = { id: 'list', type: 'unordered_list', children: [{ id: 'item', type: 'list_item', children: [paragraph('list-p', 'item')] }] };
    const plan = prepare(makeDocument([paragraph('p1', 'one'), list]), [{ kind: 'delete_element', target_element_id: 'list' }]);
    expect(plan.elements).toHaveLength(1);
    expectError(() => prepare(makeDocument([paragraph('p1', 'one'), list]), [{ kind: 'delete_element', target_element_id: 'item' }]), 'invalid_parent_child', 0);
  });

  it('allows deletion of ordinary blocks, lists and list items when the result remains valid', () => {
    const list = {
      id: 'list',
      type: 'unordered_list',
      children: [
        { id: 'item-1', type: 'list_item', children: [paragraph('item-1-paragraph', 'one')] },
        { id: 'item-2', type: 'list_item', children: [paragraph('item-2-paragraph', 'two')] },
      ],
    };
    const plan = prepare(makeDocument([paragraph('p1', 'one'), paragraph('p2', 'two'), list]), [
      { kind: 'delete_element', target_element_id: 'p1' },
      { kind: 'delete_element', target_element_id: 'item-1' },
      { kind: 'delete_element', target_element_id: 'list' },
    ]);

    expect(plan.elements).toEqual([paragraph('p2', 'two')]);
  });

  it('replaces simple paragraph and every heading level text', () => {
    const list = { id: 'list', type: 'unordered_list', children: [{ id: 'item', type: 'list_item', children: [paragraph('list-p', 'item')] }] };
    const headings = ['header1', 'header2', 'header3', 'header4', 'header5', 'header6'].map((type, index) => ({
      id: `h${index + 1}`,
      type,
      children: [text(`h${index + 1}-text`, `heading ${index + 1}`)],
    }));
    const plan = prepare(makeDocument([paragraph('p1', 'one'), ...headings, list]), [
      { kind: 'replace_element_content', target_element_id: 'p1', payload: { text: 'paragraph' } },
      ...headings.map((heading, index) => ({
        kind: 'replace_element_content', target_element_id: heading.id, payload: { text: `header ${index + 1}` },
      })),
      { kind: 'replace_element_content', target_element_id: 'list-p', payload: { text: 'list paragraph' } },
    ]);
    expect(plan.elements[0].children[0].text).toBe('paragraph');
    headings.forEach((heading, index) => {
      expect(plan.elements[index + 1].children[0].text).toBe(`header ${index + 1}`);
    });
    expect(plan.elements[7].children[0].children[0].children[0].text).toBe('list paragraph');
  });

  it('rejects table-cell text replacement without modifying the document', () => {
    const cell = { id: 'cell', type: 'table_cell', children: [text('cell-text', 'cell')] };
    const table = { id: 'table', type: 'table', children: [{ id: 'row', type: 'table_row', children: [cell] }] };
    const document = makeDocument([paragraph('p1', 'one'), table]);
    const originalElements = deepCopy(document.elements);

    expectError(() => prepare(document, [{
      kind: 'replace_element_content', target_element_id: 'cell', payload: { text: 'table cell' },
    }]), 'unsupported_content', 0);

    expect(document.elements).toEqual(originalElements);
    expect(document.version).toBe(3);
  });

  it('rejects simple-text replacement on element types outside the specification', () => {
    const title = { id: 'title', type: 'title', children: [text('title-text', 'title')] };

    expectError(() => prepare(makeDocument([title]), [{
      kind: 'replace_element_content', target_element_id: 'title', payload: { text: 'replacement' },
    }]), 'unsupported_content', 0);
  });

  it('preserves the media boundary while allowing document-node deletion', () => {
    const inlineImage = { id: 'image', type: 'image', data: { src: 'image.png' }, children: [text('image-text', '')] };
    const imageParagraph = {
      id: 'image-paragraph',
      type: 'paragraph',
      children: [text('before-image', 'before'), inlineImage, text('after-image', 'after')],
    };
    const video = { id: 'video', type: 'video', data: { src: 'video.mp4' }, children: [text('video-text', '')] };
    const document = makeDocument([paragraph('p1', 'one'), imageParagraph, video]);

    expectError(() => prepare(document, [{
      kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'image_block' },
    }]), 'unsupported_element_type', 0);
    expectError(() => prepare(document, [{
      kind: 'replace_element_content', target_element_id: 'image', payload: { text: 'replacement' },
    }]), 'unsupported_content', 0);
    expectError(() => prepare(document, [{
      kind: 'update_element_attributes', target_element_id: 'video', payload: { type: 'paragraph' },
    }]), 'unsupported_element_type', 0);

    const plan = prepare(document, [{ kind: 'delete_element', target_element_id: 'video' }]);
    expect(plan.elements.map(element => element.id)).toEqual(['p1', 'image-paragraph']);
    expect(plan.operations).toEqual([expect.objectContaining({ type: 'remove_node', path: [2] })]);
  });

  it('rejects direct deletion of groups and element types outside the delete allowlist', () => {
    const group = { id: 'group', type: 'group', children: [paragraph('group-p', 'group')] };
    const whiteboard = { id: 'whiteboard', type: 'whiteboard', children: [text('whiteboard-text', '')] };
    const document = makeDocument([paragraph('p1', 'one'), group, whiteboard]);

    ['group', 'whiteboard'].forEach(targetElementId => {
      expectError(() => prepare(document, [{
        kind: 'delete_element', target_element_id: targetElementId,
      }]), 'unsupported_element_type', 0);
    });
  });

  it('creates blockquotes, callouts, checklist items and code blocks with canonical structures', () => {
    const plan = prepare(makeDocument(), [
      { kind: 'insert_element', client_ref: 'quote', parent_element_id: null, position: 'append', payload: { type: 'blockquote', text: 'Quoted text' } },
      { kind: 'insert_element', client_ref: 'callout', parent_element_id: null, position: 'append', payload: { type: 'callout', text: 'Important', background_color: '#e1e9fe' } },
      { kind: 'insert_element', client_ref: 'task', parent_element_id: null, position: 'append', payload: { type: 'check_list_item', text: 'Ship it', checked: true } },
      { kind: 'insert_element', client_ref: 'code', parent_element_id: null, position: 'append', payload: { type: 'code_block', text: 'const a = 1;\n\nreturn a;', language: 'javascript', white_space: 'normal' } },
    ]);
    const [blockquote, callout, checklist, codeBlock] = plan.elements.slice(-4);

    expect(blockquote).toEqual(expect.objectContaining({
      type: 'blockquote',
      children: [expect.objectContaining({ type: 'paragraph', children: [expect.objectContaining({ text: 'Quoted text' })] })],
    }));
    expect(callout).toEqual(expect.objectContaining({
      type: 'callout',
      style: { background_color: '#e1e9fe' },
      children: [expect.objectContaining({ type: 'paragraph', children: [expect.objectContaining({ text: 'Important' })] })],
    }));
    expect(checklist).toEqual(expect.objectContaining({
      type: 'check_list_item', checked: true, children: [expect.objectContaining({ text: 'Ship it' })],
    }));
    expect(codeBlock).toEqual(expect.objectContaining({
      type: 'code_block',
      language: 'javascript',
      style: { white_space: 'normal' },
    }));
    expect(codeBlock.children.map(line => line.children[0].text)).toEqual(['const a = 1;', '', 'return a;']);
  });

  it('uses specification defaults for callouts, checklist items and code blocks', () => {
    const plan = prepare(makeDocument(), [
      { kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'callout', text: '' } },
      { kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'check_list_item', text: '' } },
      { kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'code_block', text: '' } },
    ]);
    const [callout, checklist, codeBlock] = plan.elements.slice(-3);

    expect(callout.style).toEqual({ background_color: '#fef7e0' });
    expect(checklist.checked).toBe(false);
    expect(codeBlock.language).toBe('plaintext');
    expect(codeBlock.style).toEqual({ white_space: 'nowrap' });
    expect(codeBlock.children).toHaveLength(1);
    expect(codeBlock.children[0].children[0].text).toBe('');
  });

  it('replaces simple content in blockquotes, callouts, checklist items and code blocks', () => {
    const blockquote = { id: 'quote', type: 'blockquote', children: [paragraph('quote-p', 'old quote')] };
    const callout = { id: 'callout', type: 'callout', style: { background_color: '#fef7e0' }, children: [paragraph('callout-p', 'old callout')] };
    const checklist = { id: 'task', type: 'check_list_item', checked: false, children: [text('task-text', 'old task')] };
    const codeBlock = {
      id: 'code', type: 'code_block', language: 'plaintext', style: { white_space: 'nowrap' },
      children: [{ id: 'line', type: 'code_line', children: [text('line-text', 'old code')] }],
    };
    const document = makeDocument([blockquote, callout, checklist, codeBlock]);
    const plan = prepare(document, [
      { kind: 'replace_element_content', target_element_id: 'quote', payload: { text: 'new quote' } },
      { kind: 'replace_element_content', target_element_id: 'callout', payload: { text: 'new callout' } },
      { kind: 'replace_element_content', target_element_id: 'task', payload: { text: 'new task' } },
      { kind: 'replace_element_content', target_element_id: 'code', payload: { text: 'line one\nline two' } },
    ]);

    expect(plan.elements[0].children[0].children[0].text).toBe('new quote');
    expect(plan.elements[1].children[0].children[0].text).toBe('new callout');
    expect(plan.elements[2].children[0].text).toBe('new task');
    expect(plan.elements[3].children.map(line => line.children[0].text)).toEqual(['line one', 'line two']);

    const replay = {
      version: document.version,
      elements: deepCopy(document.elements),
      setLastModifyUser: () => {},
      setValue(elements) {
        this.elements = elements;
      },
    };
    expect(applyOperations(replay, deepCopy(plan.operations), { username: 'writer@example.com' })).toBe(true);
    expect(replay.elements).toEqual(plan.elements);
  });

  it('updates checklist, callout and code-block attributes through type-specific whitelists', () => {
    const callout = { id: 'callout', type: 'callout', style: { background_color: '#fef7e0' }, children: [paragraph('callout-p', 'note')] };
    const checklist = { id: 'task', type: 'check_list_item', checked: false, children: [text('task-text', 'task')] };
    const codeBlock = {
      id: 'code', type: 'code_block', language: 'plaintext', style: { white_space: 'nowrap' },
      children: [{ id: 'line', type: 'code_line', children: [text('line-text', 'code')] }],
    };
    const plan = prepare(makeDocument([callout, checklist, codeBlock]), [
      { kind: 'update_element_attributes', target_element_id: 'callout', payload: { background_color: '#ffe6e3' } },
      { kind: 'update_element_attributes', target_element_id: 'task', payload: { checked: true } },
      { kind: 'update_element_attributes', target_element_id: 'code', payload: { language: 'python', white_space: 'normal' } },
    ]);

    expect(plan.elements[0].style.background_color).toBe('#ffe6e3');
    expect(plan.elements[1].checked).toBe(true);
    expect(plan.elements[2]).toEqual(expect.objectContaining({ language: 'python', style: { white_space: 'normal' } }));
    expect(plan.operations.slice(-3)).toEqual([
      expect.objectContaining({ type: 'set_node', newProperties: { style: { background_color: '#ffe6e3' } } }),
      expect.objectContaining({ type: 'set_node', newProperties: { checked: true } }),
      expect.objectContaining({ type: 'set_node', newProperties: { language: 'python', style: { white_space: 'normal' } } }),
    ]);
  });

  it('rejects invalid extended-format payloads and complex container content', () => {
    const complexQuote = {
      id: 'quote',
      type: 'blockquote',
      children: [paragraph('quote-p-1', 'one'), paragraph('quote-p-2', 'two')],
    };
    const invalidCommands = [
      { kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'blockquote' } },
      { kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'callout', text: 'note', background_color: '#ffffff' } },
      { kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'check_list_item', text: 'task', checked: 'yes' } },
      { kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'code_block', text: 'code', language: 'unknown' } },
      { kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'code_block', text: 'code', white_space: 'pre' } },
    ];
    invalidCommands.forEach(command => {
      expectError(() => prepare(makeDocument(), [command]), 'invalid_request', 0);
    });
    expectError(() => prepare(makeDocument([complexQuote]), [{
      kind: 'replace_element_content', target_element_id: 'quote', payload: { text: 'replacement' },
    }]), 'unsupported_content', 0);
    expectError(() => prepare(makeDocument(), [{
      kind: 'update_element_attributes', target_element_id: 'p1', payload: { checked: true },
    }]), 'unsupported_element_type', 0);
  });

  it('creates ordered and unordered lists with one standard initial list item', () => {
    const plan = prepare(makeDocument(), [
      { kind: 'insert_element', client_ref: 'ordered', parent_element_id: null, position: 'append', payload: { type: 'ordered_list', text: 'First item' } },
      { kind: 'insert_element', client_ref: 'unordered', parent_element_id: null, position: 'append', payload: { type: 'unordered_list', text: '' } },
    ]);
    const [orderedList, unorderedList] = plan.elements.slice(-2);

    expect(orderedList.type).toBe('ordered_list');
    expect(orderedList.children[0].type).toBe('list_item');
    expect(orderedList.children[0].children[0].type).toBe('paragraph');
    expect(orderedList.children[0].children[0].children[0].text).toBe('First item');
    expect(unorderedList.children[0].children[0].children[0].text).toBe('');
    expect(plan.elementIdMappings.ordered).toBe(orderedList.id);
    expect(plan.elementIdMappings.unordered).toBe(unorderedList.id);
  });

  it('keeps list initial text with newlines in a single list item', () => {
    const plan = prepare(makeDocument(), [{
      kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'unordered_list', text: 'First line\nSecond line' },
    }]);
    const list = plan.elements[2];

    expect(list.children).toHaveLength(1);
    expect(list.children[0].children[0].children[0].text).toBe('First line\nSecond line');
  });

  it('rejects invalid or oversized list initial text and empty final list containers', () => {
    const document = makeDocument();
    expectError(() => prepare(document, [{
      kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'ordered_list', text: 1 },
    }]), 'invalid_request', 0);
    expectError(() => prepare(document, [{
      kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'ordered_list', text: 'x'.repeat(ELEMENT_COMMAND_LIMITS.MAX_TEXT_BYTES + 1) },
    }]), 'batch_limit_exceeded', 0);
    expectError(() => prepare(document, [{
      kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'ordered_list' },
    }]), 'invalid_parent_child', 0);
  });

  it('allows an empty list container when later commands add list items by reference', () => {
    const document = makeDocument();
    const plan = prepare(document, [
      { kind: 'insert_element', client_ref: 'list', parent_element_id: null, position: 'append', payload: { type: 'unordered_list' } },
      { kind: 'insert_element', parent_ref: 'list', position: 'append', payload: { type: 'list_item', text: 'First item' } },
      { kind: 'insert_element', parent_ref: 'list', position: 'append', payload: { type: 'list_item', text: 'Second item' } },
    ]);
    const replay = {
      version: document.version,
      elements: deepCopy(document.elements),
      setLastModifyUser: () => {},
      setValue(elements) {
        this.elements = elements;
      },
    };

    expect(plan.elements[2].children).toHaveLength(2);
    expect(applyOperations(replay, deepCopy(plan.operations), { username: 'writer@example.com' })).toBe(true);
    expect(replay.elements).toEqual(plan.elements);
  });

  it('rejects list items and complex inline content as text replacement targets', () => {
    const linkedParagraph = { id: 'complex', type: 'paragraph', children: [{ id: 'link', type: 'link', children: [text('link-text', 'link')] }] };
    expectError(() => prepare(makeDocument([linkedParagraph]), [{
      kind: 'replace_element_content', target_element_id: 'complex', payload: { text: 'replacement' },
    }]), 'unsupported_content', 0);
    const list = { id: 'list', type: 'unordered_list', children: [{ id: 'item', type: 'list_item', children: [paragraph('list-p', 'item')] }] };
    expectError(() => prepare(makeDocument([list]), [{
      kind: 'replace_element_content', target_element_id: 'item', payload: { text: 'replacement' },
    }]), 'unsupported_content', 0);
  });

  it('only allows supported type conversions at valid parents', () => {
    const list = { id: 'list', type: 'ordered_list', children: [{ id: 'item', type: 'list_item', children: [paragraph('list-p', 'item')] }] };
    const plan = prepare(makeDocument([paragraph('p1', 'one'), list]), [
      { kind: 'update_element_attributes', target_element_id: 'p1', payload: { type: 'header4' } },
      { kind: 'update_element_attributes', target_element_id: 'list', payload: { type: 'unordered_list' } },
    ]);
    expect(plan.elements[0].type).toBe('header4');
    expect(plan.elements[1].type).toBe('unordered_list');
    expectError(() => prepare(makeDocument([paragraph('p1', 'one')]), [{
      kind: 'update_element_attributes', target_element_id: 'p1', payload: { type: 'ordered_list' },
    }]), 'unsupported_element_type', 0);
  });

  it('rejects converting paragraph content that headings cannot preserve', () => {
    const paragraphWithImage = {
      id: 'p1',
      type: 'paragraph',
      children: [
        text('p1-text', 'caption'),
        { id: 'image', type: 'image', src: 'example.png', children: [text('image-text', '')] },
      ],
    };
    const document = makeDocument([paragraphWithImage]);
    const originalElements = deepCopy(document.elements);

    expectError(() => prepare(document, [{
      kind: 'update_element_attributes',
      target_element_id: 'p1',
      payload: { type: 'header2' },
    }]), 'unsupported_content', 0);

    expect(document.elements).toEqual(originalElements);
    expect(document.version).toBe(3);
  });

  it('preserves supported inline links when converting a paragraph to a heading', () => {
    const linkedParagraph = {
      id: 'p1',
      type: 'paragraph',
      children: [
        text('p1-text', 'See '),
        { id: 'link', type: 'link', href: 'https://example.com', children: [text('link-text', 'example')] },
      ],
    };

    const plan = prepare(makeDocument([linkedParagraph]), [{
      kind: 'update_element_attributes',
      target_element_id: 'p1',
      payload: { type: 'header2' },
    }]);

    expect(plan.elements[0].type).toBe('header2');
    expect(plan.elements[0].children).toEqual(linkedParagraph.children);
  });

  it('rejects attribute updates for internal structural targets without side effects', () => {
    const table = {
      id: 'table',
      type: 'table',
      children: [{ id: 'row', type: 'table_row', children: [{ id: 'cell', type: 'table_cell', children: [text('cell-text', 'cell')] }] }],
    };
    const document = makeDocument([paragraph('p1', 'one'), table]);
    const originalElements = deepCopy(document.elements);

    expectError(() => prepare(document, [{
      kind: 'update_element_attributes',
      target_element_id: 'cell',
      payload: { type: 'paragraph' },
    }]), 'unsupported_element_type', 0);

    expect(document.elements).toEqual(originalElements);
    expect(document.version).toBe(3);
  });

  it('checks request shape, command count, request size and text size before applying', () => {
    const document = makeDocument();
    expectError(() => new ElementCommandManager().prepare(document, { commands: [], base_document_version: 2 }), 'invalid_request', null);
    expectError(() => new ElementCommandManager().prepare(document, { commands: [], request_id: 'not-supported' }), 'invalid_request', null);
    expect(document.version).toBe(3);
    expect(document.elements[0].children[0].text).toBe('one');
    const commands = Array.from({ length: 101 }, () => ({ kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'paragraph', text: '' } }));
    expectError(() => prepare(document, commands), 'batch_limit_exceeded', null);
    expectError(() => prepare(document, [{ kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'paragraph', text: 'x'.repeat(ELEMENT_COMMAND_LIMITS.MAX_TEXT_BYTES + 1) } }]), 'batch_limit_exceeded', 0);
    expectError(() => prepare(document, [{ kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'paragraph', text: 'x'.repeat(ELEMENT_COMMAND_LIMITS.MAX_REQUEST_BYTES) } }]), 'batch_limit_exceeded', null);
  });

  it('supports batches of 1, 20 and 100 commands', () => {
    [1, 20, 100].forEach(count => {
      const commands = Array.from({ length: count }, (_, index) => ({
        kind: 'insert_element', parent_element_id: null, position: 'append', payload: { type: 'paragraph', text: `${index}` },
      }));
      const plan = prepare(makeDocument(), commands);
      expect(plan.commandResults).toHaveLength(count);
    });
  });
});
