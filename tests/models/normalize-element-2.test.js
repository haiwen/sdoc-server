import { normalizeElement } from "../../src/models/normalize-element";
import { formatChildren } from "../core";
import { blockquote, checkListItem, codeBlock, emptyCodeLine, emptyListItem, emptyTableRow, fileLink, header1, image, link, list, paragraph, sdocLink, table, text, title } from "./children-mock";

describe('normalize element: paragraph', () => {
  it('paragraph', () => {
    const element = paragraph;
    const expectElement = paragraph;
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('paragraph:title', () => {
    const element = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        title
      ]
    };
    const expectElement = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('paragraph:header', () => {
    const element = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        header1
      ]
    };
    const expectElement = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('paragraph:list', () => {
    const element = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        list
      ]
    };
    const expectElement = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('paragraph:check_list_item', () => {
    const element = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        checkListItem
      ]
    };
    const expectElement = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('paragraph:code_block', () => {
    const element = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        codeBlock
      ]
    };
    const expectElement = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('paragraph:inline_elements', () => {
    const element = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        text,
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const expectElement = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        text,
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('paragraph:table', () => {
    const element = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        table
      ]
    };
    const expectElement = {
      id: 'paragraph',
      type: 'paragraph',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

});

describe('normalize element: title', () => {
  it('title', () => {
    const element = title;
    const expectElement = title;
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('title:paragraph', () => {
    const element = {
      id: 'title',
      type: 'title',
      children: [
        paragraph
      ]
    };
    const expectElement = {
      id: 'title',
      type: 'title',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('title:header', () => {
    const element = {
      id: 'title',
      type: 'title',
      children: [
        header1
      ]
    };
    const expectElement = {
      id: 'title',
      type: 'title',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('title:blockquote', () => {
    const element = {
      id: 'title',
      type: 'title',
      children: [
        blockquote
      ]
    };
    const expectElement = {
      id: 'title',
      type: 'title',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('title:list', () => {
    const element = {
      id: 'title',
      type: 'title',
      children: [
        list
      ]
    };
    const expectElement = {
      id: 'title',
      type: 'title',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('title:check_list_item', () => {
    const element = {
      id: 'title',
      type: 'title',
      children: [
        checkListItem
      ]
    };
    const expectElement = {
      id: 'title',
      type: 'title',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('title:code_block', () => {
    const element = {
      id: 'title',
      type: 'title',
      children: [
        codeBlock
      ]
    };
    const expectElement = {
      id: 'title',
      type: 'title',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('title:inline_elements', () => {
    const element = {
      id: 'title',
      type: 'title',
      children: [
        text,
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const expectElement = {
      id: 'title',
      type: 'title',
      children: [
        text,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('title:table', () => {
    const element = {
      id: 'title',
      type: 'title',
      children: [
        table
      ]
    };
    const expectElement = {
      id: 'title',
      type: 'title',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

});

describe('normalize element: header1', () => {
  it('header1', () => {
    const element = header1;
    const expectElement = header1;
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('header1:paragraph', () => {
    const element = {
      id: 'header1',
      type: 'header1',
      children: [
        paragraph
      ]
    };
    const expectElement = {
      id: 'header1',
      type: 'header1',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('header1:title', () => {
    const element = {
      id: 'header1',
      type: 'header1',
      children: [
        title
      ]
    };
    const expectElement = {
      id: 'header1',
      type: 'header1',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('header1:header', () => {
    const element = {
      id: 'header1',
      type: 'header1',
      children: [
        header1
      ]
    };
    const expectElement = {
      id: 'header1',
      type: 'header1',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('header1:blockquote', () => {
    const element = {
      id: 'header1',
      type: 'header1',
      children: [
        blockquote
      ]
    };
    const expectElement = {
      id: 'header1',
      type: 'header1',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('header1:list', () => {
    const element = {
      id: 'header1',
      type: 'header1',
      children: [
        list
      ]
    };
    const expectElement = {
      id: 'header1',
      type: 'header1',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('header1:check_list_item', () => {
    const element = {
      id: 'header1',
      type: 'header1',
      children: [
        checkListItem
      ]
    };
    const expectElement = {
      id: 'header1',
      type: 'header1',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('header1:code_block', () => {
    const element = {
      id: 'header1',
      type: 'header1',
      children: [
        codeBlock
      ]
    };
    const expectElement = {
      id: 'header1',
      type: 'header1',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('header1:inline_elements', () => {
    const element = {
      id: 'header1',
      type: 'header1',
      children: [
        text,
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const expectElement = {
      id: 'header1',
      type: 'header1',
      children: [
        text,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('header1:table', () => {
    const element = {
      id: 'header1',
      type: 'header1',
      children: [
        table
      ]
    };
    const expectElement = {
      id: 'header1',
      type: 'header1',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

});

describe('normalize element: blockquote', () => {
  it('blockquote', () => {
    const element = blockquote;
    const expectElement = blockquote;
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('blockquote:paragraph', () => {
    const element = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        paragraph
      ]
    };
    const expectElement = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        paragraph
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('blockquote:title', () => {
    const element = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        title
      ]
    };
    const expectElement = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        title
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('blockquote:header', () => {
    const element = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        header1
      ]
    };
    const expectElement = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        header1
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('blockquote:list', () => {
    const element = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        list
      ]
    };
    const expectElement = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        list
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('blockquote:check_list_item', () => {
    const element = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        checkListItem
      ]
    };
    const expectElement = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        checkListItem
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('blockquote:code_block', () => {
    const element = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        codeBlock
      ]
    };
    const expectElement = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        {id: 'text', text: ''}
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('blockquote:inline_elements', () => {
    const element = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const expectElement = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('blockquote:table', () => {
    const element = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        table
      ]
    };
    const expectElement = {
      id: 'blockquote',
      type: 'blockquote',
      children: [
        {id: 'text', text: ''}
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

});

describe('normalize element: unordered_list', () => {
  it('unordered_list', () => {
    const element = list;
    const expectElement = list;
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list:paragraph', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        paragraph
      ]
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        emptyListItem
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list:title', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        title
      ]
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        emptyListItem
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list:header', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        header1
      ]
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        emptyListItem
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list:blockquote', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        blockquote
      ]
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        emptyListItem
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list:unordered_list', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        list
      ]
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        emptyListItem
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list:check_list_item', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        checkListItem
      ]
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        emptyListItem
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list:code_block', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        codeBlock
      ]
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        emptyListItem
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list:inline_elements', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        text,
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        emptyListItem
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('unordered_list:table', () => {
    const element = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        table
      ]
    };
    const expectElement = {
      id: 'unordered_list',
      type: 'unordered_list',
      children: [
        emptyListItem
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

});

describe('normalize element: check_list_item', () => {
  it('check_list_item', () => {
    const element = checkListItem;
    const expectElement = checkListItem;
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('check_list_item:paragraph', () => {
    const element = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        paragraph
      ]
    };
    const expectElement = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('check_list_item:title', () => {
    const element = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        title
      ]
    };
    const expectElement = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('check_list_item:header', () => {
    const element = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        header1
      ]
    };
    const expectElement = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('check_list_item:blockquote', () => {
    const element = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        blockquote
      ]
    };
    const expectElement = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('check_list_item:list', () => {
    const element = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        list
      ]
    };
    const expectElement = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('check_list_item:check_list_item', () => {
    const element = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        checkListItem
      ]
    };
    const expectElement = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('check_list_item:code_block', () => {
    const element = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        codeBlock
      ]
    };
    const expectElement = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('check_list_item:inline_elements', () => {
    const element = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        text,
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const expectElement = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        text,
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('check_list_item:table', () => {
    const element = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        table
      ]
    };
    const expectElement = {
      id: 'check_list_item',
      type: 'check_list_item',
      children: [
        text
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

});

describe('normalize element: code_block', () => {
  it('code_block', () => {
    const element = codeBlock;
    const expectElement = codeBlock;
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('code_block:paragraph', () => {
    const element = {
      id: 'code_block',
      type: 'code_block',
      children: [
        paragraph
      ]
    };
    const expectElement = {
      id: 'code_block',
      type: 'code_block',
      children: [
        emptyCodeLine
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('code_block:title', () => {
    const element = {
      id: 'code_block',
      type: 'code_block',
      children: [
        title
      ]
    };
    const expectElement = {
      id: 'code_block',
      type: 'code_block',
      children: [
        emptyCodeLine
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('code_block:header', () => {
    const element = {
      id: 'code_block',
      type: 'code_block',
      children: [
        header1
      ]
    };
    const expectElement = {
      id: 'code_block',
      type: 'code_block',
      children: [
        emptyCodeLine
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('code_block:blockquote', () => {
    const element = {
      id: 'code_block',
      type: 'code_block',
      children: [
        blockquote
      ]
    };
    const expectElement = {
      id: 'code_block',
      type: 'code_block',
      children: [
        emptyCodeLine
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('code_block:list', () => {
    const element = {
      id: 'code_block',
      type: 'code_block',
      children: [
        list
      ]
    };
    const expectElement = {
      id: 'code_block',
      type: 'code_block',
      children: [
        emptyCodeLine
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('code_block:check_list_item', () => {
    const element = {
      id: 'code_block',
      type: 'code_block',
      children: [
        checkListItem
      ]
    };
    const expectElement = {
      id: 'code_block',
      type: 'code_block',
      children: [
        emptyCodeLine
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('code_block:code_block', () => {
    const element = {
      id: 'code_block',
      type: 'code_block',
      children: [
        codeBlock
      ]
    };
    const expectElement = {
      id: 'code_block',
      type: 'code_block',
      children: [
        emptyCodeLine
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('code_block:inline_elements', () => {
    const element = {
      id: 'code_block',
      type: 'code_block',
      children: [
        text,
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const expectElement = {
      id: 'code_block',
      type: 'code_block',
      children: [
        emptyCodeLine
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('code_block:table', () => {
    const element = {
      id: 'code_block',
      type: 'code_block',
      children: [
        table
      ]
    };
    const expectElement = {
      id: 'code_block',
      type: 'code_block',
      children: [
        emptyCodeLine
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

});

describe('normalize element: table', () => {
  it('table', () => {
    const element = table;
    const expectElement = table;
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table:paragraph', () => {
    const element = {
      id: 'table',
      type: 'table',
      children: [
        paragraph
      ]
    };
    const expectElement = {
      id: 'table',
      type: 'table',
      children: [
        emptyTableRow
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table:title', () => {
    const element = {
      id: 'table',
      type: 'table',
      children: [
        title
      ]
    };
    const expectElement = {
      id: 'table',
      type: 'table',
      children: [
        emptyTableRow
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table:header', () => {
    const element = {
      id: 'table',
      type: 'table',
      children: [
        header1
      ]
    };
    const expectElement = {
      id: 'table',
      type: 'table',
      children: [
        emptyTableRow
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table:blockquote', () => {
    const element = {
      id: 'table',
      type: 'table',
      children: [
        blockquote
      ]
    };
    const expectElement = {
      id: 'table',
      type: 'table',
      children: [
        emptyTableRow
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table:list', () => {
    const element = {
      id: 'table',
      type: 'table',
      children: [
        list
      ]
    };
    const expectElement = {
      id: 'table',
      type: 'table',
      children: [
        emptyTableRow
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table:check_list_item', () => {
    const element = {
      id: 'table',
      type: 'table',
      children: [
        checkListItem
      ]
    };
    const expectElement = {
      id: 'table',
      type: 'table',
      children: [
        emptyTableRow
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table:code_block', () => {
    const element = {
      id: 'table',
      type: 'table',
      children: [
        codeBlock
      ]
    };
    const expectElement = {
      id: 'table',
      type: 'table',
      children: [
        emptyTableRow
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table:inline_elements', () => {
    const element = {
      id: 'table',
      type: 'table',
      children: [
        text,
        image,
        sdocLink,
        fileLink,
        link,
      ]
    };
    const expectElement = {
      id: 'table',
      type: 'table',
      children: [
        emptyTableRow
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

  it('table:table', () => {
    const element = {
      id: 'table',
      type: 'table',
      children: [
        table
      ]
    };
    const expectElement = {
      id: 'table',
      type: 'table',
      children: [
        emptyTableRow
      ]
    };
    const newContent = normalizeElement(element);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectElement));
  });

});
