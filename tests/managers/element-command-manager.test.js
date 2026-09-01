import deepCopy from 'deep-copy';
import ElementCommandManager, { ElementCommandError } from '../../src/modules/sdoc/managers/element-command-manager';
import { ELEMENT_COMMAND_LIMITS } from '../../src/modules/sdoc/constants';
import { applyOperations } from '../../src/modules/sdoc/utils/slate-utils';

const text = (id, value) => ({ id, text: value });
const paragraph = (id, value) => ({ id, type: 'paragraph', children: [text(`${id}-text`, value)] });
const header = (id, value) => ({ id, type: 'header2', children: [text(`${id}-text`, value)] });

const makeDocument = (elements = [paragraph('p1', 'one'), paragraph('p2', 'two')], version = 3) => ({
  version,
  elements: deepCopy(elements),
});

const prepare = (document, commands) => new ElementCommandManager().prepare(document, {
  base_document_version: document.version,
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

  it('allows deletion of non-table structural nodes and individual text leaves when valid', () => {
    const list = {
      id: 'list',
      type: 'unordered_list',
      children: [
        { id: 'item-1', type: 'list_item', children: [paragraph('item-1-paragraph', 'one')] },
        { id: 'item-2', type: 'list_item', children: [paragraph('item-2-paragraph', 'two')] },
      ],
    };
    const codeBlock = { id: 'code-block', type: 'code_block', children: [{ id: 'code-line', type: 'code_line', children: [text('code-text', 'code')] }] };
    const group = { id: 'group', type: 'group', children: [paragraph('group-paragraph', 'group')] };
    const multiText = { id: 'multi-text', type: 'paragraph', children: [text('first-text', 'first'), text('second-text', 'second')] };
    const plan = prepare(makeDocument([paragraph('p1', 'one'), list, codeBlock, group, multiText]), [
      { kind: 'delete_element', target_element_id: 'item-1' },
      { kind: 'delete_element', target_element_id: 'code-block' },
      { kind: 'delete_element', target_element_id: 'group' },
      { kind: 'delete_element', target_element_id: 'first-text' },
    ]);

    expect(plan.elements.map(element => element.id)).toEqual(['p1', 'list', 'multi-text']);
    expect(plan.elements[1].children).toHaveLength(1);
    expect(plan.elements[2].children).toEqual([text('second-text', 'second')]);
  });

  it('rejects deletions that leave a parent without children without creating a plan', () => {
    const document = makeDocument([paragraph('p1', 'one')]);
    const originalElements = deepCopy(document.elements);

    expectError(() => prepare(document, [{ kind: 'delete_element', target_element_id: 'p1-text' }]), 'invalid_parent_child', 0);

    expect(document.elements).toEqual(originalElements);
    expect(document.version).toBe(3);
  });

  it('deletes a complete subtree and rejects a resulting invalid hierarchy', () => {
    const list = { id: 'list', type: 'unordered_list', children: [{ id: 'item', type: 'list_item', children: [paragraph('list-p', 'item')] }] };
    const plan = prepare(makeDocument([paragraph('p1', 'one'), list]), [{ kind: 'delete_element', target_element_id: 'list' }]);
    expect(plan.elements).toHaveLength(1);
    expectError(() => prepare(makeDocument([paragraph('p1', 'one'), list]), [{ kind: 'delete_element', target_element_id: 'item' }]), 'invalid_parent_child', 0);
  });

  it('replaces simple paragraph, heading, list paragraph and table-cell text', () => {
    const list = { id: 'list', type: 'unordered_list', children: [{ id: 'item', type: 'list_item', children: [paragraph('list-p', 'item')] }] };
    const cell = { id: 'cell', type: 'table_cell', children: [text('cell-text', 'cell')] };
    const table = { id: 'table', type: 'table', children: [{ id: 'row', type: 'table_row', children: [cell] }] };
    const plan = prepare(makeDocument([paragraph('p1', 'one'), header('h1', 'heading'), list, table]), [
      { kind: 'replace_element_content', target_element_id: 'p1', payload: { text: 'paragraph' } },
      { kind: 'replace_element_content', target_element_id: 'h1', payload: { text: 'header' } },
      { kind: 'replace_element_content', target_element_id: 'list-p', payload: { text: 'list paragraph' } },
      { kind: 'replace_element_content', target_element_id: 'cell', payload: { text: 'table cell' } },
    ]);
    expect(plan.elements[0].children[0].text).toBe('paragraph');
    expect(plan.elements[1].children[0].text).toBe('header');
    expect(plan.elements[2].children[0].children[0].children[0].text).toBe('list paragraph');
    expect(plan.elements[3].children[0].children[0].children[0].text).toBe('table cell');
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

  it('checks versions, command count, request size and text size before applying', () => {
    const document = makeDocument();
    expectError(() => new ElementCommandManager().prepare(document, { base_document_version: 2, commands: [] }), 'invalid_request', null);
    expectError(() => new ElementCommandManager().prepare(document, { base_document_version: document.version, commands: [] }), 'invalid_request', null);
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
