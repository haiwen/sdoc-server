import { isNodeValid } from '../../src/utils/slate-utils';

describe('test is node children valid function', () => {
  it('valid no children node, node is text', () => {
    const node1 = {
      text: 'hello'
    };
    const node2 = {
    };

    const exp1 = isNodeValid(node1);
    const exp2 = isNodeValid(node2);

    expect(exp1).toBe(true);
    expect(exp2).toBe(false);
  });

  it('valid has children node and children node is text', () => {
    const node1 = {
      type: 'paragraph',
      children: [
        {
          text: 'hello'
        }
      ]
    };
    const node2 = {
      id: '111',
      type: 'paragraph',
      children: [
      ]
    };

    const exp1 = isNodeValid(node1);
    const exp2 = isNodeValid(node2);

    expect(exp1).toBe(true);
    expect(exp2).toBe(false);
  });

  it('valid has children node and children node is not text', () => {
    const node1 = {
      type: 'ordered_list',
      children: [
        {
          type: 'list-item',
          children: [
            {
              type: 'list-lic',
              children: [
                {text: 'aaa'}
              ]
            }
          ]
        },
        {
          type: 'list-item',
          children: [
            {
              type: 'list-lic',
              children: [
                {text: 'bbb'}
              ]
            }
          ]
        }
      ]
    };
    const node2 = {
      type: 'ordered_list',
      children: [
      ]
    };

    const exp1 = isNodeValid(node1);
    const exp2 = isNodeValid(node2);

    expect(exp1).toBe(true);
    expect(exp2).toBe(false);
  });

  it('valid more layers node', () => {
    const node1 = {
      type: 'list',
      children: [
        {
          type: 'list-item',
          children: [
            {
              type: 'lic-item',
              children: [
                {
                  text: 'hello'
                }
              ]
            },
            {
              type: 'list',
              children: [
                {
                  type: 'list-item',
                  children: [
                    {
                      type: 'lic-item',
                      children: [{
                        text: 'hello'
                      }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    const node2 = {
      id: '111',
      type: 'list',
      children: [
        {
          id: '111-aaa',
          type: 'list-item',
          children: [
            {
              id: '111-aaa_111',
              type: 'lic-item',
              children: [
                {
                  id: '111-aaa_111_1',
                  text: 'hello'
                }
              ]
            },
            {
              id: '222',
              type: 'list',
              children: [
                {
                  id: '222-bbb',
                  type: 'list-item',
                  children: [
                    {
                      id: '222-bbb_222',
                      type: 'lic-item',
                      children: [{
                      }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const exp1 = isNodeValid(node1);
    const exp2 = isNodeValid(node2);

    expect(exp1).toBe(true);
    expect(exp2).toBe(false);
  });

});
