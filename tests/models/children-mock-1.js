export const text = { 
  id: 'text', 
  text: '' 
};
export const link = {
  id: 'link',
  type: 'link',
  title: 'seafile',
  children: [text],
};
export const sdocLink = {
  id: 'sdoc_link',
  type: 'sdoc_link',
  "doc_uuid": "c24cee20-88c2-4dba-beb9-4032c5e2c3e1",
  "title": "aaa.sdoc",
  "display_type": "text_link",
  "children": [text]
};
export const fileLink = {
  id: 'file_link',
  type: 'file_link',
  "title": "aaa.sdoc",
  "display_type": "text_link",
  "children": [text]
};
export const image = {
  "id": "EtrJP32cQaqDMkRObR54OQ",
  "type": "image",
  "children": [{
    "id": "DIjoioIKQFqIrdIvKayRkw",
    "text": ""
  }],
  "data": {
      "src": "/image-1694747334820.gif",
      "width": 115
  }
};

export const title = { 
  id: 'title', 
  type: 'title',
  children: [
    text,
    link,
    sdocLink,
    fileLink,
  ]
};
export const subtitle = { 
  id: 'subtitle', 
  type: 'subtitle',
  children: [
    text,
    link,
    sdocLink,
    fileLink,
  ]
};
export const header1 = { 
  id: 'header1', 
  type: 'header1',
  children: [
    text,
    link,
    sdocLink,
    fileLink,
  ]
};
export const listLic = { 
  id: 'paragraph', 
  type: 'paragraph',
  children: [
    text,
    sdocLink,
    fileLink,
    image
  ]
};

export const emptyListLic = { 
  id: 'paragraph', 
  type: 'paragraph',
  children: [
    {
      id: 'text',
      text: '',
    }
  ]
};
export const listItem = { 
  id: 'list_item', 
  type: 'list_item',
  children: [
    listLic
  ]
};

export const emptyListItem = { 
  id: 'list_item', 
  type: 'list_item',
  children: [
    emptyListLic
  ]
};

export const list = { 
  id: 'unordered_list', 
  type: 'unordered_list',
  children: [
    listItem,
    listItem,
    listItem,
  ]
};
export const checkListItem = { 
  id: 'check_list_item', 
  type: 'check_list_item',
  children: [
    text,
    sdocLink,
    fileLink,
  ]
};
export const codeLine = { 
  id: 'code_line', 
  type: 'code_line',
  children: [
    text,
    text,
    text,
  ]
};

export const emptyCodeLine = {
  id: 'code_line', 
  type: 'code_line',
  children: [
    text,
  ]
};

export const codeBlock = { 
  id: 'code_block', 
  type: 'code_block',
  children: [
    codeLine,
    codeLine,
  ]
};

export const tableCell = {
  "id": "table_cell",
  "type": "table_cell",
  "children": [{
      "text": "d",
      "id": "DKNygilkQU-kOGROH__2Aw"
  }]
};

export const emptyTableCell = {
  "id": "table_cell",
  "type": "table_cell",
  "children": [{
      "text": "",
      "id": "DKNygilkQU-kOGROH__2Aw"
  }]
};

export const tableRow = {
  id: 'table_row',
  type: 'table_row',
  children: [
    tableCell,
    tableCell,
    tableCell,
  ]
};

export const emptyTableRow = {
  id: 'table_row',
  type: 'table_row',
  children: [
    emptyTableCell
  ]
};

export const table = {
  id: 'table',
  type: 'table',
  children: [
    tableRow,
    tableRow,
    tableRow,
  ]
};

export const blockquote = {
  id: 'blockquote',
  type: 'blockquote',
  children: [
    text,
    text,
    text,
  ]
};

export const expectBlockquote = {
  id: 'blockquote',
  type: 'blockquote',
  children: [
    {
      id: 'paragraph',
      type: 'paragraph',
      children: [text],
    },
    {
      id: 'paragraph',
      type: 'paragraph',
      children: [text],
    },
    {
      id: 'paragraph',
      type: 'paragraph',
      children: [text],
    }
  ]
};

export const paragraph = {
  id: 'paragraph',
  type: 'paragraph',
  children: [
    image,
    text,
    text,
    link,
    fileLink,
    sdocLink,
  ]
};

export const withInlineElement = [
  title,
  subtitle,
  paragraph,
  table,
  sdocLink,
  text,
  fileLink,
  image,
  link,
  blockquote,
  codeBlock,
  header1,
  checkListItem,
];

export const expectChildren1 = [
  title,
  subtitle,
  paragraph,
  table,
  blockquote,
  codeBlock,
  header1,
  checkListItem,
];

export const withSecondLevelElement = [
  title,
  codeLine,
  codeBlock,
  listItem,
  list,
];

export const expectChildren2 = [
  title,
  codeBlock,
  list,
];

export const withEmptyChildElement = [
  title,
  {
    id: 'ordered_list',
    type: 'ordered_list',
    children: [],
  },
  {
    id: 'code_block',
    type: 'code_block',
    children: [],
  }
];

export const expectChildren3 = [
  title,
  {
    id: 'ordered_list',
    type: 'ordered_list',
    children: [
      {
        id: 'list-item',
        type: 'list_item',
        children: [
          {
            id: 'paragraph',
            type: 'paragraph',
            children: [text]
          }
        ]
      }
    ],
  },
  {
    id: 'code_block',
    type: 'code_block',
    children: [{
      id: 'code_line',
      type: 'code_line',
      children: [text]
    }],
  }
];



