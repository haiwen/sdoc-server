import { getReviewApplyRegistration } from '../../src/modules/sdoc/dao/review-apply';

describe('review apply registration', () => {
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
