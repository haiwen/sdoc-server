import { validNode } from '../../src/utils/slate-utils';

describe('test valid node function', () => {
  it('valid no children node', () => {
    const node1 = {
      id: 'add',
      text: 'hello'
    };
    const node2 = {
      text: 'hello, my name is LiLy'
    };

    const exp1 = validNode(node1);
    const exp2 = validNode(node2);

    expect(exp1).toBe(true);
    expect(exp2).toBe(false);
  });

  it('valid has children node 1', () => {
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
        {
          text: 'hello'
        }
      ]
    };

    const exp1 = validNode(node1);
    const exp2 = validNode(node2);

    expect(exp1).toBe(false);
    expect(exp2).toBe(false);
  });

  it('valid has children node 2', () => {
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
        {
          id: '222',
          text: 'hello'
        }
      ]
    };

    const exp1 = validNode(node1);
    const exp2 = validNode(node2);

    expect(exp1).toBe(false);
    expect(exp2).toBe(true);
  });

  it('valid has children node 3', () => {
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
          id: '111_a',
          type: 'list-item',
          children: [
            {
              id: '111_a_b',
              type: 'lic-item',
              children: [
                {
                  id: '111_a_b_1',
                  text: 'hello'
                }
              ]
            }
          ]
        }
      ]
    };

    const exp1 = validNode(node1);
    const exp2 = validNode(node2);

    expect(exp1).toBe(false);
    expect(exp2).toBe(true);
  });

  it('valid has children node 2', () => {
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
                        id: '222-bbb_222_1',
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

    const exp1 = validNode(node1);
    const exp2 = validNode(node2);

    expect(exp1).toBe(false);
    expect(exp2).toBe(true);
  });

});
