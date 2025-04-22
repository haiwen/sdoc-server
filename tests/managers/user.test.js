import UsersManager from "../../src/managers/users-manager";

let usersManager = null;
beforeEach(() => {
  usersManager = UsersManager.getInstance();

  usersManager.addUser('111111', 'aaaaaa1', { username: 'aaa1', permission: 'rw'});
  usersManager.addUser('111111', 'aaaaaa2', { username: 'aaa2', permission: 'rw'});
  usersManager.addUser('222222', 'bbbbbb1', { username: 'bbb1', permission: 'rw'});
  usersManager.addUser('333333', 'cccccc1', { username: 'ccc1', permission: 'rw'});
  usersManager.addUser('444444', 'dddddd1', { username: 'ddd1', permission: 'rw'});
});

describe('user manager test', () => {
  it('add user test', () => {
    const userInfo = { username: 'eee1', permission: 'rw'};
    usersManager.addUser('555555', 'eeeeee1', userInfo);
    const user = usersManager.getUser('555555', 'eeeeee1');
    expect(user.username).toBe('eee1');
  });
  
  it('delete user test', () => {
    const users1 = usersManager.getDocUsers('111111');
    expect(users1.length).toBe(2);
    
    usersManager.deleteUser('111111', 'aaaaaa1');
    const users2 = usersManager.getDocUsers('111111');
    expect(users2.length).toBe(1);
  });
  
  it('get doc users', () => {
    const users2 = usersManager.getDocUsers('111111');
    expect(users2.length).toBe(2);
  });
});
