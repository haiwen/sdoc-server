import { normalizeChildren } from "../../src/modules/sdoc/models/document-utils";
import { formatChildren } from "../core";
import { children, expectChildren } from "./children-mock-2";
import { children2, expectChildren2 } from "./children-mock-3";

describe('normalize children content', () => {

  // unordered_list -> list-item -> list_lic
  //                             -> unordered_list
  it('unordered_list test', () => {
    const newContent = normalizeChildren(children);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectChildren));
  });

  it('ordered_list test', () => {
    const newContent = normalizeChildren(children2);
    expect(formatChildren(newContent)).toEqual(formatChildren(expectChildren2));
  });

});
