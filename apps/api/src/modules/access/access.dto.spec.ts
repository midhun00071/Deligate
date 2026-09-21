import { accessInputSchema } from '@deligate/validation';

describe('temporary access input', () => {
  it('does not accept client-owned access scope', () => {
    expect(accessInputSchema.safeParse({})).toMatchObject({ success: true });
    expect(accessInputSchema.safeParse({ accessScope: 'ALL_AREAS' })).toMatchObject({
      success: false,
    });
  });
});
