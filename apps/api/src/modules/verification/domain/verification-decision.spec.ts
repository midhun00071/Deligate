import { decideVerification } from './verification-decision';

const proof = {
  state: 'VERIFIED' as const,
  cryptographicVerification: 'PASS' as const,
  revocation: 'NOT_REVOKED' as const,
  issuerDid: 'did:issuer',
  disclosedAttributes: {
    riderId: 'rider',
    deliveryCompany: 'company',
    riderStatus: 'ACTIVE' as const,
  },
};

describe('verification decision', () => {
  it('accepts only separate positive proof, revocation, and trust evidence', () => {
    expect(decideVerification(proof, { state: 'TRUSTED' })).toMatchObject({
      decision: 'ACCEPTED',
      reasons: [],
    });
  });
  it('denies unknown revocation even when proof and trust pass', () => {
    expect(
      decideVerification({ ...proof, revocation: 'UNKNOWN' }, { state: 'TRUSTED' }),
    ).toMatchObject({
      decision: 'DENIED',
      reasons: ['REVOCATION_UNCONFIRMED'],
    });
  });
  it.each([
    [
      { ...proof, disclosedAttributes: { ...proof.disclosedAttributes, riderId: '  ' } },
      'REQUIRED_ATTRIBUTES_MISSING',
    ],
    [
      { ...proof, disclosedAttributes: { ...proof.disclosedAttributes, deliveryCompany: '' } },
      'REQUIRED_ATTRIBUTES_MISSING',
    ],
    [{ ...proof, disclosedAttributes: undefined }, 'REQUIRED_ATTRIBUTES_MISSING'],
    [
      { ...proof, disclosedAttributes: { ...proof.disclosedAttributes, riderStatus: 'SUSPENDED' } },
      'RIDER_NOT_ACTIVE',
    ],
    [
      { ...proof, disclosedAttributes: { ...proof.disclosedAttributes, riderStatus: 'INACTIVE' } },
      'RIDER_NOT_ACTIVE',
    ],
    [
      { ...proof, disclosedAttributes: { ...proof.disclosedAttributes, riderStatus: 'verified' } },
      'RIDER_NOT_ACTIVE',
    ],
  ] as const)('denies invalid required rider evidence', (value, reason) => {
    expect(decideVerification(value, { state: 'TRUSTED' })).toMatchObject({
      decision: 'DENIED',
      reasons: [reason],
    });
  });
  it.each([
    [
      { ...proof, cryptographicVerification: 'FAIL' as const },
      { state: 'TRUSTED' as const },
      'PROOF_NOT_VERIFIED',
    ],
    [
      { ...proof, revocation: 'REVOKED' as const },
      { state: 'TRUSTED' as const },
      'CREDENTIAL_REVOKED',
    ],
    [proof, { state: 'UNTRUSTED' as const }, 'ISSUER_NOT_TRUSTED'],
  ])('denies failed evidence with its own reason', (value, trust, reason) => {
    expect(decideVerification(value, trust).reasons).toEqual([reason]);
    expect(decideVerification(value, trust).decision).toBe('DENIED');
  });
});
