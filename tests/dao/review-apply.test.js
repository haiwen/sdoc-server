import { getReviewApplyRegistration } from '../../src/modules/sdoc/dao/review-apply';

describe('review apply registration', () => {
  it('uses a locking current read only for uncertain transaction recovery', async () => {
    const executor = jest.fn().mockResolvedValue([]);
    await getReviewApplyRegistration('attempt', executor, true);
    expect(executor).toHaveBeenLastCalledWith(expect.stringMatching(/WHERE apply_attempt_id=\? FOR UPDATE$/), ['attempt']);
    await getReviewApplyRegistration('attempt', executor);
    expect(executor).toHaveBeenLastCalledWith(expect.stringMatching(/WHERE apply_attempt_id=\?$/), ['attempt']);
  });

  it('returns the durable persistence columns over the original result snapshot', async () => {
    const executor = jest.fn().mockResolvedValue([{
      apply_attempt_id: 'apply-attempt-id',
      persistence_status: 'persisted',
      applied_sdoc_version: 7,
      result: JSON.stringify({
        status: 'applied',
        persistence_status: 'not_requested',
        applied_sdoc_version: 6,
      }),
    }]);

    const registration = await getReviewApplyRegistration('apply-attempt-id', executor);

    expect(registration.result).toEqual(expect.objectContaining({
      persistence_status: 'persisted',
      applied_sdoc_version: 7,
    }));
  });
});

describe('review transaction connection cleanup', () => {
  it.each([true, false])('unwraps mysql2 rows for locking registration reads (exists=%s)', async exists => {
    const row = {
      apply_attempt_id: 'attempt', doc_uuid: 'doc', apply_payload_digest: 'digest',
      status: 'applied', persistence_status: 'pending', applied_sdoc_version: 5,
      result: JSON.stringify({status: 'applied', applied_sdoc_version: 5}),
    };
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      query: jest.fn().mockResolvedValue([exists ? [row] : [], [{name: 'status'}]]),
      commit: jest.fn().mockResolvedValue(), rollback: jest.fn(), release: jest.fn(),
    };
    jest.doMock('mysql2/promise', () => ({createPool: () => ({getConnection: async () => connection})}));
    try {
      let withTransaction;
      jest.isolateModules(() => {
        withTransaction = require('../../src/db-helper').withTransaction;
      });
      const result = await withTransaction(executor => getReviewApplyRegistration('attempt', executor, true));
      if (exists) {
        expect(result).toMatchObject({doc_uuid: 'doc', status: 'applied',
          result: {status: 'applied', applied_sdoc_version: 5}});
      } else {
        expect(result).toBeNull();
      }
      expect(connection.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), ['attempt']);
      expect(connection.commit).toHaveBeenCalledTimes(1);
    } finally {
      jest.dontMock('mysql2/promise');
    }
  });

  it.each([true, false])('destroys an unresolved connection instead of returning it to the pool (rollback fails=%s)', async fails => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockRejectedValue(new Error('commit acknowledgement lost')),
      rollback: fails ? jest.fn().mockRejectedValue(new Error('rollback disconnected')) : jest.fn().mockResolvedValue(),
      release: jest.fn(),
      destroy: jest.fn(),
    };
    jest.doMock('mysql2/promise', () => ({createPool: () => ({getConnection: async () => connection})}));
    try {
      let withTransaction;
      jest.isolateModules(() => {
        withTransaction = require('../../src/db-helper').withTransaction;
      });
      await expect(withTransaction(async () => {})).rejects.toMatchObject({error_type: 'database_error'});
      expect(connection.rollback).toHaveBeenCalledTimes(1);
      expect(connection.destroy).toHaveBeenCalledTimes(fails ? 1 : 0);
      expect(connection.release).toHaveBeenCalledTimes(fails ? 0 : 1);
    } finally {
      jest.dontMock('mysql2/promise');
    }
  });
});
