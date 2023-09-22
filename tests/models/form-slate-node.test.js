import formatSlateNode from '../../src/models/format-slate-node';
import { expectBlockquote, expectCheckListItem, expectCodeBlock, expectFileLink, expectHeader, expectImage, expectLink, expectOrderedList, expectSdocLink, expectTable, expectText, expectTitle, oldBlockquote, oldCheckListItem, oldCodeBlock, oldFileLink, oldHeader, oldImage, oldLink, oldOrderedList, oldSdocLink, oldTable, oldText, oldTitle } from './content-mock';

describe('simple:test format slate node', () => {
  it('format text', () => {
    const newContent = formatSlateNode(oldText);
    expect(newContent).toEqual(expectText);
  });

  it('format link', () => {
    const newContent = formatSlateNode(oldLink);
    expect(newContent).toEqual(expectLink);
  });

  it('format sdocLink', () => {
    const newContent = formatSlateNode(oldSdocLink);
    expect(newContent).toEqual(expectSdocLink);
  });

  it('format fileLink', () => {
    const newContent = formatSlateNode(oldFileLink);
    expect(newContent).toEqual(expectFileLink);
  });

  it('format image', () => {
    const newContent = formatSlateNode(oldImage);
    expect(newContent).toEqual(expectImage);
  });

  it('format blockquote', () => {
    const newContent = formatSlateNode(oldBlockquote);
    expect(newContent).toEqual(expectBlockquote);
  });

  it('format title', () => {
    const newContent = formatSlateNode(oldTitle);
    expect(newContent).toEqual(expectTitle);
  });

  it('format header', () => {
    const newContent = formatSlateNode(oldHeader);
    expect(newContent).toEqual(expectHeader);
  });

  it('format orderList', () => {
    const newContent = formatSlateNode(oldOrderedList);
    expect(newContent).toEqual(expectOrderedList);
  });
  
  it('format check-list-item', () => {
    const newContent = formatSlateNode(oldCheckListItem);
    expect(newContent).toEqual(expectCheckListItem);
  });

  it('format codeBlock', () => {
    const newContent = formatSlateNode(oldCodeBlock);
    expect(newContent).toEqual(expectCodeBlock);
  });

  it('format table', () => {
    const newContent = formatSlateNode(oldTable);
    expect(newContent).toEqual(expectTable);
  });

});
