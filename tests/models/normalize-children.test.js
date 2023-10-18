import { normalizeChildren } from "../../src/models/document-utils";
import { formatChildren } from "../core";
import { 
  withInlineElement, 
  expectChildren1, 
  withSecondLevelElement,
  expectChildren2,
  withEmptyChildElement, 
  expectChildren3, 
} from "./children-mock";

describe('normalize children content', () => {

  it('with inline element child', () => {
    const newContent = normalizeChildren(withInlineElement);
    expect(newContent).toEqual(expectChildren1);
  });

  it('with child element as first level', () => {
    const newContent = normalizeChildren(withSecondLevelElement);
    expect(newContent).toEqual(expectChildren2);
  });

  it('with empty child element', () => {
    const newContent = normalizeChildren(withEmptyChildElement);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectChildren3));
  });

});
