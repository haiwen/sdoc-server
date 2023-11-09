import { expectCheckListItem, expectHeader, expectParagraph, expectTable, expectText, expectTitle, oldText } from "./content-mock-2";

export const oldOrderedList = {
  type: 'ordered_list',
  children: [
    {
      type: 'list_item',
      children: [
        {type: 'list_lic', children: [oldText]},
        {type: 'list_lic', children: [oldText]},
        {type: 'list_lic', children: [oldText]},
      ]
    },
    {
      type: 'list_item',
      children: [
        {type: 'list_lic', children: [oldText]},
        {type: 'list_lic', children: [oldText]},
        {type: 'list_lic', children: [oldText]},
      ]
    },
  ]
};

export const expectOrderedList =  {
  type: 'ordered_list',
  children: [
    {
      type: 'list_item',
      children: [
        {type: 'paragraph', children: [expectText]},
        {type: 'paragraph', children: [expectText]},
        {type: 'paragraph', children: [expectText]},
      ]
    },
    {
      type: 'list_item',
      children: [
        {type: 'paragraph', children: [expectText]},
        {type: 'paragraph', children: [expectText]},
        {type: 'paragraph', children: [expectText]},
      ]
    },
  ]
};

export const docContent = {
  format_version: 1,
  children: [
    expectTitle,
    expectHeader,
    expectParagraph,
    expectCheckListItem,
    expectCheckListItem,
    expectParagraph,
    expectTable,
    oldOrderedList,
  ]
};

export const expectDocContent = {
  format_version: 3,
  children: [
    expectTitle,
    expectHeader,
    expectParagraph,
    expectCheckListItem,
    expectCheckListItem,
    expectParagraph,
    expectTable,
    expectOrderedList,
  ]
};
