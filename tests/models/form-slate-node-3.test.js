import { formatContentToVersion3, formatSlateNodeToVersion3 } from '../../src/models/document-format';
import { docContent, expectDocContent, expectOrderedList, oldOrderedList } from './content-mock-3';

describe('simple:test format slate node', () => {
  it('format orderList', () => {
    const newContent = formatSlateNodeToVersion3(oldOrderedList);
    expect(newContent).toEqual(expectOrderedList);
  });
});

describe('simple:test format slate node', () => {
  it('format content', () => {
    const newContent = formatContentToVersion3(docContent);
    expect(newContent).toEqual(expectDocContent);
  });
});
