import { calculateAffectedBlocks } from '../../src/modules/sdoc/utils/slate-utils';

describe('calculateAffectedBlocks', () => {
  it('insert_text: ui operation, Press the alphanumeric key', () => {

    const operations = [{
      "type": "insert_text",
      "path": [
          11,
          0
      ],
      "offset": 2,
      "text": "d",
      "node_id": "aTnwq3e4QhCLf-NIaz3gdA"
  }];

    const exp1 = calculateAffectedBlocks(operations);

    expect(exp1).toEqual([11]);
  });

  it('remove_text: press the delete key', () => {
    const operations = [{
      "type": "remove_text",
      "path": [
          11,
          0
      ],
      "offset": 0,
      "text": "a",
      "node_id": "aTnwq3e4QhCLf-NIaz3gdA"
  }];

    const exp1 = calculateAffectedBlocks(operations);

    expect(exp1).toEqual([11]);
  });

  it('insert_node: Select normal text, press ordered_list or unordered_list menu item', () => {
    const operations = [
      {
          "type": "insert_node",
          "path": [
              14
          ],
          "node": {
              "id": "bUJTbpc8RHK1FG_EJtO4IA",
              "type": "ordered_list",
              "children": []
          }
      },
      {
          "type": "move_node",
          "path": [
              13
          ],
          "newPath": [
              14,
              0
          ],
          "node_id": "BzwzNb8kSDSzispawuuZWw"
      },
      {
          "type": "set_node",
          "path": [
              13,
              0
          ],
          "properties": {
              "type": "paragraph"
          },
          "newProperties": {
              "type": "list-lic"
          },
          "node_id": "BzwzNb8kSDSzispawuuZWw"
      },
      {
          "type": "insert_node",
          "path": [
              13,
              1
          ],
          "node": {
              "id": "T1xLM_WeQN-sPo-aIakaQw",
              "type": "list-item",
              "children": []
          },
          "parent_node_id": "bUJTbpc8RHK1FG_EJtO4IA"
      },
      {
          "type": "move_node",
          "path": [
              13,
              0
          ],
          "newPath": [
              13,
              1,
              0
          ],
          "node_id": "BzwzNb8kSDSzispawuuZWw"
      },
      {
          "type": "move_node",
          "path": [
              13,
              0
          ],
          "newPath": [
              12,
              1
          ],
          "node_id": "T1xLM_WeQN-sPo-aIakaQw"
      },
      {
          "type": "remove_node",
          "path": [
              13
          ],
          "node": {
              "id": "bUJTbpc8RHK1FG_EJtO4IA",
              "type": "ordered_list",
              "children": []
          },
          "node_id": "bUJTbpc8RHK1FG_EJtO4IA"
      }
  ];

    const exp1 = calculateAffectedBlocks(operations);

    expect(exp1).toEqual([12, 13, 14]);
  });

  it('remove_node: The two elements before and after are text, the second element is empty, press the delete key at the beginning of the element', () => {
    const operations = [{
      "type": "remove_node",
      "path": [
          21
      ],
      "node": {
          "id": "L7EEabHvRu2yRUTJr7TPlA",
          "type": "paragraph",
          "children": [
              {
                  "id": "UJoWnNr6T5CZMQHNw-a7mg",
                  "text": ""
              }
          ]
      },
      "node_id": "L7EEabHvRu2yRUTJr7TPlA"
    }];

    const exp1 = calculateAffectedBlocks(operations);

    expect(exp1).toEqual([21]);
  });

  it('merge_node: The two elements before and after are both text and are not empty, press the delete key at the beginning of the second element', () => {
    const operations = [{
      "type": "merge_node",
      "path": [
          19
      ],
      "position": 1,
      "properties": {
          "id": "ax9hfGpPTFqzzBL7ZDGgZw",
          "type": "paragraph"
      },
      "node_id": "ax9hfGpPTFqzzBL7ZDGgZw"
  }];

    const exp1 = calculateAffectedBlocks(operations);

    expect(exp1).toEqual([19]);
  });

  it('set_node: Select text, press different types of menu items', () => {
    const operations = [{
      "type": "set_node",
      "path": [
          22
      ],
      "properties": {
          "type": "paragraph"
      },
      "newProperties": {
          "type": "check-list-item"
      },
      "node_id": "e6rMYO57RVadlVOORW44Zg"
  }];

    const exp1 = calculateAffectedBlocks(operations);

    expect(exp1).toEqual([22]);
  });

  it('split_node: Select text, Press enter in the middle or end of the text', () => {
    const operations = [
      {
          "type": "split_node",
          "path": [
              22,
              0
          ],
          "position": 6,
          "properties": {
              "id": "Ii1Q8XS7Q-Gf2UrkvFL9wA"
          },
          "node_id": "dTUEYhRERzmqCHT34RQNKQ"
      },
      {
          "type": "split_node",
          "path": [
              22
          ],
          "position": 1,
          "properties": {
              "id": "MqvPnXFeQjuxz0DvdpFp6g",
              "type": "check-list-item"
          },
          "node_id": "e6rMYO57RVadlVOORW44Zg"
      }
  ];

    const exp1 = calculateAffectedBlocks(operations);

    expect(exp1).toEqual([22, 23]);
  });


  it('move_node: Press tab or shift + tab on an entry in unordered_list', () => {
    const operations = [
      {
          "type": "insert_node",
          "path": [
              20,
              2
          ],
          "node": {
              "id": "QqCufTtfQZ2jRCSXwJJaTA",
              "type": "unordered_list",
              "children": []
          },
          "parent_node_id": "FQu4fGGcSWqaRGP99CALzg"
      },
      {
          "type": "move_node",
          "path": [
              20,
              1
          ],
          "newPath": [
              20,
              2,
              0
          ],
          "node_id": "B97XIP-oQlyjtIYFBSwEig"
      },
      {
          "type": "move_node",
          "path": [
              20,
              1
          ],
          "newPath": [
              20,
              0,
              1
          ],
          "node_id": "QqCufTtfQZ2jRCSXwJJaTA"
      }
  ];

    const exp1 = calculateAffectedBlocks(operations);

    expect(exp1).toEqual([20]);
  });

});
