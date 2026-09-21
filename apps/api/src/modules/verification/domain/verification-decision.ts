import type { ProofStatusResult, TrustCheckResult } from '@deligate/eidstack';
import type { VerificationDecision, VerificationReason } from '@deligate/validation';

export interface DecisionEvidence {
  decision: VerificationDecision;
  reasons: VerificationReason[];
  cryptographicVerification: ProofStatusResult['cryptographicVerification'];
  revocation: ProofStatusResult['revocation'];
  issuerTrust: TrustCheckResult['state'];
}

export function decideVerification(
  proof: ProofStatusResult,
  trust: TrustCheckResult | null,
): DecisionEvidence {
  if (proof.state === 'PENDING') return pending(proof, 'UPSTREAM_UNAVAILABLE');
  if (proof.state === 'EXPIRED') return denied(proof, trust, 'PROOF_EXPIRED');
  if (proof.state === 'DECLINED' || proof.cryptographicVerification !== 'PASS')
    return denied(proof, trust, 'PROOF_NOT_VERIFIED');
  if (proof.revocation === 'REVOKED') return denied(proof, trust, 'CREDENTIAL_REVOKED');
  if (proof.revocation !== 'NOT_REVOKED') return denied(proof, trust, 'REVOCATION_UNCONFIRMED');
  if (!trust || trust.state !== 'TRUSTED') return denied(proof, trust, 'ISSUER_NOT_TRUSTED');
  if (!hasRequiredAttributes(proof.disclosedAttributes))
    return denied(proof, trust, 'REQUIRED_ATTRIBUTES_MISSING');
  if (proof.disclosedAttributes.riderStatus !== 'ACTIVE')
    return denied(proof, trust, 'RIDER_NOT_ACTIVE');
  return {
    decision: 'ACCEPTED',
    reasons: [],
    cryptographicVerification: proof.cryptographicVerification,
    revocation: proof.revocation,
    issuerTrust: trust.state,
  };
}

function hasRequiredAttributes(
  attributes: ProofStatusResult['disclosedAttributes'],
): attributes is NonNullable<ProofStatusResult['disclosedAttributes']> {
  return Boolean(
    attributes &&
    typeof attributes.riderId === 'string' &&
    attributes.riderId.trim() &&
    typeof attributes.deliveryCompany === 'string' &&
    attributes.deliveryCompany.trim() &&
    typeof attributes.riderStatus === 'string' &&
    attributes.riderStatus.trim(),
  );
}

export function unavailableDecision(): DecisionEvidence {
  return {
    decision: 'DENIED',
    reasons: ['UPSTREAM_UNAVAILABLE'],
    cryptographicVerification: 'PENDING',
    revocation: 'UNKNOWN',
    issuerTrust: 'UNKNOWN',
  };
}

function pending(proof: ProofStatusResult, reason: VerificationReason): DecisionEvidence {
  return {
    decision: 'PENDING',
    reasons: reason === 'UPSTREAM_UNAVAILABLE' ? [] : [reason],
    cryptographicVerification: proof.cryptographicVerification,
    revocation: proof.revocation,
    issuerTrust: 'UNKNOWN',
  };
}

function denied(
  proof: ProofStatusResult,
  trust: TrustCheckResult | null,
  reason: VerificationReason,
): DecisionEvidence {
  return {
    decision: 'DENIED',
    reasons: [reason],
    cryptographicVerification: proof.cryptographicVerification,
    revocation: proof.revocation,
    issuerTrust: trust?.state ?? 'UNKNOWN',
  };
}
