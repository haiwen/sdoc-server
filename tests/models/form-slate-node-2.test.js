import { formatContentToVersion2, formatSlateNodeToVersion2 } from '../../src/models/document-format';
import { docContent, expectBlockquote, expectCheckListItem, expectCodeBlock, expectDocContent, expectFileLink, expectHeader, expectImage, expectLink, expectOrderedList, expectSdocLink, expectTable, expectText, expectTitle, oldBlockquote, oldCheckListItem, oldCodeBlock, oldFileLink, oldHeader, oldImage, oldLink, oldOrderedList, oldSdocLink, oldTable, oldText, oldTitle } from './content-mock-2';

describe('simple:test format slate node', () => {
  it('format text', () => {
    const newContent = formatSlateNodeToVersion2(oldText);
    expect(newContent).toEqual(expectText);
  });

  it('format link', () => {
    const newContent = formatSlateNodeToVersion2(oldLink);
    expect(newContent).toEqual(expectLink);
  });

  it('format sdocLink', () => {
    const newContent = formatSlateNodeToVersion2(oldSdocLink);
    expect(newContent).toEqual(expectSdocLink);
  });

  it('format fileLink', () => {
    const newContent = formatSlateNodeToVersion2(oldFileLink);
    expect(newContent).toEqual(expectFileLink);
  });

  it('format image', () => {
    const newContent = formatSlateNodeToVersion2(oldImage);
    expect(newContent).toEqual(expectImage);
  });

  it('format blockquote', () => {
    const newContent = formatSlateNodeToVersion2(oldBlockquote);
    expect(newContent).toEqual(expectBlockquote);
  });

  it('format title', () => {
    const newContent = formatSlateNodeToVersion2(oldTitle);
    expect(newContent).toEqual(expectTitle);
  });

  it('format header', () => {
    const newContent = formatSlateNodeToVersion2(oldHeader);
    expect(newContent).toEqual(expectHeader);
  });

  it('format orderList', () => {
    const newContent = formatSlateNodeToVersion2(oldOrderedList);
    expect(newContent).toEqual(expectOrderedList);
  });
  
  it('format check-list-item', () => {
    const newContent = formatSlateNodeToVersion2(oldCheckListItem);
    expect(newContent).toEqual(expectCheckListItem);
  });

  it('format codeBlock', () => {
    const newContent = formatSlateNodeToVersion2(oldCodeBlock);
    expect(newContent).toEqual(expectCodeBlock);
  });

  it('format table', () => {
    const newContent = formatSlateNodeToVersion2(oldTable);
    expect(newContent).toEqual(expectTable);
  });

});

describe('simple:test format slate node', () => {
  it('format content', () => {
    const newContent = formatContentToVersion2(docContent);
    expect(newContent).toEqual(expectDocContent);
  });
});
