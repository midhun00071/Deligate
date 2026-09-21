import type { RiderProofRequest } from '@deligate/eidstack';

/** Deligate only asks for the operational claims needed to decide visitor entry. */
export function riderProofPolicy(
  requestId: string,
  credentialDefinitionId: string,
): RiderProofRequest {
  return {
    requestId,
    credentialDefinitionId,
    attributes: [{ name: 'riderId' }, { name: 'deliveryCompany' }, { name: 'riderStatus' }],
    comment: 'Confirm active delivery-rider status for temporary building access.',
  };
}
