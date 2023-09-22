import { formatContentToVersion2 } from "../../src/models/document-format";
import { docContent, expectDocContent } from "./content-mock";

describe('simple:test format slate node', () => {
  it('format paragraph', () => {
    const newContent = formatContentToVersion2(docContent);
    expect(newContent).toEqual(expectDocContent);
  });
});
