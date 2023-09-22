// inline
export const oldText = {
  id: 'text',
  text: 'aa',
  'font-size': 12,
  'highlight-color': '#776699',
  BOLD: true,
  ITALIC: true,
  UNDERLINE: true,
  STRIKETHROUGH: true,
  SUPERSCRIPT: true,
  SUBSCRIPT: true,
  CODE: true,
  DELETE: true,
  ADD: true
};

export const expectText = {
  id: 'text',
  text: 'aa',
  'font_size': 12,
  'highlight_color': '#776699',
  bold: true,
  italic: true,
  underline: true,
  strikethrough: true,
  superscript: true,
  subscript: true,
  code: true,
  delete: true,
  add: true
};

export const oldLink = {
  id: 'link',
  type: 'link',
  title: 'seafile',
  display_type: 'text_link',
  children: [
    {
      ...oldText,
      ...{
        id: '**',
        text: "seafile",
      }
    }
  ]
};

export const expectLink = {
  id: 'link',
  type: 'link',
  title: 'seafile',
  display_type: 'text_link',
  children: [
    {
      ...expectText,
      ... {
        id: '**',
        text: "seafile",
      }
    }
  ]
};

export const oldSdocLink = {
  id: 'link',
  type: 'sdoc-link',
  title: 'seafile',
  doc_uuid: '****',
  display_type: 'text_link',
  children: [
    {
      ...oldText,
      ...{
        id: '**',
        text: "seafile",
      }
    }
  ]
};

export const expectSdocLink = {
  id: 'link',
  type: 'sdoc_link',
  title: 'seafile',
  doc_uuid: '****',
  display_type: 'text_link',
  children: [
    {
      ...expectText,
      ... {
        id: '**',
        text: "seafile",
      }
    }
  ]
    
};

export const oldFileLink = {
  id: 'link',
  type: 'file_link',
  title: 'seafile',
  doc_uuid: '****',
  display_type: 'text_link',
  children: [
    {
      ...oldText,
      ...{
        id: '**',
        text: "seafile",
      }
    }
  ]
};

export const expectFileLink = {
  id: 'link',
  type: 'file_link',
  title: 'seafile',
  doc_uuid: '****',
  display_type: 'text_link',
  children: [
    {
      ...expectText,
      ... {
        id: '**',
        text: "seafile",
      }
    }
  ]
};

export const oldImage = {
  id: "EtrJP32cQaqDMkRObR54OQ",
  type: "image",
  data: {
      origin_doc_uuid: '****',
      src: "/image-1694747334820.gif",
      width: 115
  },
  children: [{
    id: "DIjoioIKQFqIrdIvKayRkw",
    text: ""
  }],
};

export const expectImage = {
  id: "EtrJP32cQaqDMkRObR54OQ",
  type: "image",
  data: {
      origin_doc_uuid: '****',
      src: "/image-1694747334820.gif",
      width: 115
  },
  children: [{
    id: "DIjoioIKQFqIrdIvKayRkw",
    text: ""
  }],
};

// block
export const oldBlockquote = {
  type: 'blockquote',
  children: [
    oldText,
    oldImage,
    oldLink,
  ]
};

export const expectBlockquote = {
  type: 'blockquote',
  children: [
    expectText,
    expectImage,
    expectLink,
  ]
};

export const oldTitle = {
  type: 'title',
  children: [
    oldText,
    oldImage,
    oldLink,
  ]
};

export const expectTitle = {
  type: 'title',
  children: [
    expectText,
    expectImage,
    expectLink,
  ]
};

export const oldHeader = {
  type: 'header1',
  children: [
    oldText,
    oldImage,
    oldLink,
  ]
};

export const expectHeader = {
  type: 'header1',
  children: [
    expectText,
    expectImage,
    expectLink,
  ]
};

export const oldOrderedList = {
  type: 'ordered_list',
  children: [
    {
      type: 'list-item',
      children: [
        {type: 'list-lic', children: [oldText, oldImage, oldLink]},
        {type: 'list-lic', children: [oldText, oldImage, oldLink]},
        {type: 'list-lic', children: [oldText, oldImage, oldLink]},
      ]
    },
    {
      type: 'list-item',
      children: [
        {type: 'list-lic', children: [oldText, oldImage, oldLink]},
        {type: 'list-lic', children: [oldText, oldImage, oldLink]},
        {type: 'list-lic', children: [oldText, oldImage, oldLink]},
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
        {type: 'list_lic', children: [expectText, expectImage, expectLink]},
        {type: 'list_lic', children: [expectText, expectImage, expectLink]},
        {type: 'list_lic', children: [expectText, expectImage, expectLink]},
      ]
    },
    {
      type: 'list_item',
      children: [
        {type: 'list_lic', children: [expectText, expectImage, expectLink]},
        {type: 'list_lic', children: [expectText, expectImage, expectLink]},
        {type: 'list_lic', children: [expectText, expectImage, expectLink]},
      ]
    },
  ]
};

export const oldCheckListItem = {
  type: 'check-list-item',
  children: [
    oldText,
    oldImage,
    oldLink,
  ]
};

export const expectCheckListItem = {
  type: 'check_list_item',
  children: [
    expectText,
    expectImage,
    expectLink,
  ]
};

export const oldCodeBlock = {
  type: 'code-block',
  language: 'javascript',
  style: {
    white_space: 'nowrap',
  },
  children: [
    {
      type: 'code-line',
      children: [oldText],
    },
    {
      type: 'code-line',
      children: [oldText],
    },
  ]
};

export const expectCodeBlock = {
  type: 'code_block',
  language: 'javascript',
  style: {
    white_space: 'nowrap',
  },
  children: [
    {
      type: 'code_line',
      children: [expectText],
    },
    {
      type: 'code_line',
      children: [expectText],
    },
  ]
};

export const oldParagraph = {
  type: 'paragraph',
  children: [
    oldText,
    oldImage,
    oldLink,
    oldSdocLink,
    oldFileLink,
  ]
};

export const expectParagraph = {
  type: 'paragraph',
  children: [
    expectText,
    expectImage,
    expectLink,
    expectSdocLink,
    expectFileLink,
  ]
};

export const oldTable = {
  type: 'table',
  children: [
    {
      type: 'table-row',
      children: [
        {type: 'table-cell', style: {textAlign: 'left', bg_color: '#778899'}, children: [oldText, oldSdocLink, oldImage]},
        {type: 'table-cell', style: {textAlign: 'left', bg_color: '#778899'}, children: [oldText, oldSdocLink, oldImage]},
        {type: 'table-cell', style: {textAlign: 'left', bg_color: '#778899'}, children: [oldText, oldSdocLink, oldImage]},
      ]
    },
    {
      type: 'table-row',
      children: [
        {type: 'table-cell', style: {textAlign: 'left', bg_color: '#778899'}, children: [oldText, oldSdocLink, oldImage]},
        {type: 'table-cell', style: {textAlign: 'left', bg_color: '#778899'}, children: [oldText, oldSdocLink, oldImage]},
        {type: 'table-cell', style: {textAlign: 'left', bg_color: '#778899'}, children: [oldText, oldSdocLink, oldImage]},
      ]
    },
  ]
};

export const expectTable = {
  type: 'table',
  children: [
    {
      type: 'table_row',
      children: [
        {type: 'table_cell', style: {text_align: 'left', background_color: '#778899'}, children: [expectText, expectSdocLink, expectImage]},
        {type: 'table_cell', style: {text_align: 'left', background_color: '#778899'}, children: [expectText, expectSdocLink, expectImage]},
        {type: 'table_cell', style: {text_align: 'left', background_color: '#778899'}, children: [expectText, expectSdocLink, expectImage]},
      ]
    },
    {
      type: 'table_row',
      children: [
        {type: 'table_cell', style: {text_align: 'left', background_color: '#778899'}, children: [expectText, expectSdocLink, expectImage]},
        {type: 'table_cell', style: {text_align: 'left', background_color: '#778899'}, children: [expectText, expectSdocLink, expectImage]},
        {type: 'table_cell', style: {text_align: 'left', background_color: '#778899'}, children: [expectText, expectSdocLink, expectImage]},
      ]
    },
  ]
};

export const docContent = {
  format_version: 1,
  children: [
    oldTitle,
    oldHeader,
    oldBlockquote,
    oldParagraph,
    oldCheckListItem,
    oldCheckListItem,
    oldParagraph,
    oldOrderedList,
    oldTable,
  ]
};

export const expectDocContent = {
  format_version: 2,
  children: [
    expectTitle,
    expectHeader,
    expectBlockquote,
    expectParagraph,
    expectCheckListItem,
    expectCheckListItem,
    expectParagraph,
    expectOrderedList,
    expectTable,
  ]
};
