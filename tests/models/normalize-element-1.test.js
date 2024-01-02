import { normalizeElement } from "../../src/models/normalize-element";
import { formatChildren } from "../core";

describe('normalize element: format empty element to normal element', () => {

  it('blockquote', () => {
    const element = {
      id: 'blockquote',
      type: 'blockquote',
    };
    const expectElement = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        {
          id: 'paragraph',
          type: 'paragraph',
          children: [{id: 'text', text: ''}],
        },
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('title', () => {
    const element = {
      id: 'title',
      type: 'title',
    };
    const expectElement = {
      id: 'title',
      type: 'title',
      children: [
        {id: 'text', text: ''}
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('header1', () => {
    const element = {
      id: 'header1',
      type: 'header1',
    };
    const expectElement = {
      id: 'header1',
      type: 'header1',
      children: [
        {id: 'text', text: ''}
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('list_lic', () => {
    const element = {
      id: 'paragraph',
      type: 'paragraph',
    };
    const expectElement = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        {id: 'text', text: ''}
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('list_item', () => {
    const element = {
      id: 'list_item',
      type: 'list_item',
    };
    const expectElement = {
      id: 'list_item',
      type: 'list_item',
      children: [
        {
          id: 'paragraph',
          type: 'paragraph',
          children: [
            {id: 'text', text: ''}
          ]
        }
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('ordered_list', () => {
    const element = {
      id: 'ordered_list',
      type: 'ordered_list',
    };
    const expectElement = {
      id: 'ordered_list',
      type: 'ordered_list',
      children: [
        {
          id: 'list_item',
          type: 'list_item',
          children: [
            {
              id: 'paragraph',
              type: 'paragraph',
              children: [
                {id: 'text', text: ''}
              ]
            }
          ]
        }
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        {
          id: 'list_item',
          type: 'list_item',
          children: [
            {
              id: 'paragraph',
              type: 'paragraph',
              children: [
                {id: 'text', text: ''}
              ]
            }
          ]
        }
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list > unordered_list', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        {
          id: 'list_item',
          type: 'list_item',
          children: [
            {
              id: 'paragraph',
              type: 'paragraph',
              children: [
              ]
            },
            {
              id: 'unordered_list',
              type: 'unordered_list',
              children: [],
            }
          ]
        }
      ]
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        {
          id: 'list_item',
          type: 'list_item',
          children: [
            {
              id: 'paragraph',
              type: 'paragraph',
              children: [
                {id: 'text', text: ''}
              ]
            },
            {
              id: 'unordered_list',
              type: 'unordered_list',
              children: [
                {
                  id: 'list_item',
                  type: 'list_item',
                  children: [
                    {
                      id: 'paragraph',
                      type: 'paragraph',
                      children: [
                        {id: 'text', text: ''}
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('code_line', () => {
    const element = {
      id: 'code_line',
      type: 'code_line',
    };
    const expectElement = {
      id: 'code_line',
      type: 'code_line',
      children: [
        {id: 'text', text: ''}
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });
  
  it('code_block', () => {
    const element = {
      id: 'code_block',
      type: 'code_block',
      children: [
        {id: 'text', text: ''}
      ]
    };
    const expectElement = {
      id: 'code_block',
      type: 'code_block',
      children: [
        {
          id: 'code_line',
          type: 'code_line',
          children: [
            {id: 'text', text: ''}
          ]
        }
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table_cell', () => {
    const element = {
      id: 'table_cell',
      type: 'table_cell',
    };
    const expectElement = {
      id: 'table_cell',
      type: 'table_cell',
      children: [
        {id: 'text', text: ''}
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table_row', () => {
    const element = {
      id: 'table_row',
      type: 'table_row',
    };
    const expectElement = {
      id: 'table_row',
      type: 'table_row',
      children: [
        {
          id: 'table_cell',
          type: 'table_cell',
          children: [
            {id: 'text', text: ''}
          ]
        }
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table', () => {
    const element = {
      id: 'table',
      type: 'table',
      children: [
        {id: 'text', text: ''},
      ]
    };
    const expectElement = {
      id: 'table',
      type: 'table',
      children: [
        {
          id: 'table_row',
          type: 'table_row',
          children: [
            {
              id: 'table_cell',
              type: 'table_cell',
              children: [
                {id: 'text', text: ''}
              ]
            }
          ]
        }
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

});
