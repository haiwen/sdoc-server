const text = { 
  id: 'text', 
  text: '' 
};
const link = {
  id: 'link',
  type: 'link',
  title: 'seafile',
  children: [text],
};
const sdocLink = {
  id: 'sdoc_link',
  type: 'sdoc_link',
  "doc_uuid": "c24cee20-88c2-4dba-beb9-4032c5e2c3e1",
  "title": "aaa.sdoc",
  "display_type": "text_link",
  "children": [text]
};
const fileLink = {
  id: 'file_link',
  type: 'file_link',
  "title": "aaa.sdoc",
  "display_type": "text_link",
  "children": [text]
};
const image = {
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

const title = { 
  id: 'title', 
  type: 'title',
  children: [
    text,
    link,
    sdocLink,
    fileLink,
  ]
};
const subtitle = { 
  id: 'subtitle', 
  type: 'subtitle',
  children: [
    text,
    link,
    sdocLink,
    fileLink,
  ]
};
const header = { 
  id: 'header', 
  type: 'header',
  children: [
    text,
    link,
    sdocLink,
    fileLink,
  ]
};
const listLic = { 
  id: 'list_lic', 
  type: 'list_lic',
  children: [
    text,
    sdocLink,
    fileLink,
    image
  ]
};
const listItem = { 
  id: 'list_item', 
  type: 'list_item',
  children: [
    listLic
  ]
};
const list = { 
  id: 'unordered_list', 
  type: 'unordered_list',
  children: [
    listItem,
    listItem,
    listItem,
  ]
};
const checkListItem = { 
  id: 'check_list_item', 
  type: 'check_list_item',
  children: [
    text,
    sdocLink,
    fileLink,
  ]
};
const codeLine = { 
  id: 'code_line', 
  type: 'code_line',
  children: [
    text,
    text,
    text,
  ]
};

const codeBlock = { 
  id: 'code_block', 
  type: 'code_block',
  children: [
    codeLine,
    codeLine,
  ]
};

const tableCell = {
  "id": "table_cell",
  "type": "table_cell",
  "children": [{
      "text": "d",
      "id": "DKNygilkQU-kOGROH__2Aw"
  }]
};

const tableRow = {
  id: 'table_row',
  type: 'table_row',
  children: [
    tableCell,
    tableCell,
    tableCell,
  ]
};

const table = {
  id: 'table',
  type: 'table',
  children: [
    tableRow,
    tableRow,
    tableRow,
  ]
};

const blockquote = {
  id: 'blockquote',
  type: 'blockquote',
  children: [
    text,
    text,
    text,
  ]
};

const paragraph = {
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
  codeBlock
];

export const expectChildren1 = [
  title,
  subtitle,
  paragraph,
  table,
  blockquote,
  codeBlock,
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
            id: 'list_lic',
            type: 'list_lic',
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



