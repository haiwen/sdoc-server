import { applyOperations } from '../../src/modules/sdoc/utils/slate-utils';
import Document from '../../src/modules/sdoc/models/document';

let document = null;
let user = null;

describe('calculateAffectedBlocks', () => {
  it('execute operations success', () => {
    const content = {children: [
        {
            type: "paragraph",
            children: [{
                text: 'xiaoqiangnihao',
            }]
        }
    ]};

    document = new Document('aaaa', 'aa.sdoc', content);
    user = { username: 'aa@aa.com' };
    const operations = [{
        "type": "insert_text",
        "path": [
            0,
            0
        ],
        "offset": 2,
        "text": "d",
        "node_id": "aTnwq3e4QhCLf-NIaz3gdA"
    }];

    const isExecuteSuccess = applyOperations(document, operations, user);
    expect(isExecuteSuccess).toBe(true);
  });

  it('execute operations success', () => {
    const content = {children: [
        {
            type: "paragraph",
            children: [{}]
        }
    ]};

    document = new Document('aaaa', 'aa.sdoc', content);
    user = { username: 'aa@aa.com' };
    const operations = [{
        "type": "insert_text",
        "path": [
            0,
            0
        ],
        "offset": 2,
        "text": "d",
        "node_id": "aTnwq3e4QhCLf-NIaz3gdA"
    }];

    const isExecuteSuccess = applyOperations(document, operations, user);
    expect(isExecuteSuccess).toBe(false);
  });

});
