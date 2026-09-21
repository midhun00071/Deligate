import { classifyActivityResult } from './activity.repository';

describe('classifyActivityResult', () => {
  it('presents a successful revocation as completed', () => {
    expect(classifyActivityResult('ISSUER_REVOKED', null)).toBe('completed');
  });

  it('keeps explicit denials and errors distinct', () => {
    expect(classifyActivityResult('PROOF_DENIED', null)).toBe('denied');
    expect(classifyActivityResult('ISSUER_FAILED', null)).toBe('failed');
  });
});
