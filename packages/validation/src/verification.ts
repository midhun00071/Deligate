import { z } from 'zod';

export const verificationDecisionSchema = z.enum(['PENDING', 'ACCEPTED', 'DENIED']);
export const verificationReasonSchema = z.enum([
  'PROOF_NOT_VERIFIED',
  'CREDENTIAL_REVOKED',
  'REVOCATION_UNCONFIRMED',
  'ISSUER_NOT_TRUSTED',
  'REQUIRED_ATTRIBUTES_MISSING',
  'RIDER_NOT_ACTIVE',
  'PROOF_EXPIRED',
  'UPSTREAM_UNAVAILABLE',
]);
export const verificationInputSchema = z
  .object({ buildingId: z.string().uuid(), buildingZoneId: z.string().uuid().optional() })
  .strict();
export const accessInputSchema = z.object({}).strict();
export const securityBuildingSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  zones: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
});
export const securityBuildingListSchema = z.array(securityBuildingSchema);
export const verificationSessionSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(['mock', 'live']),
  buildingId: z.string().uuid(),
  buildingZoneId: z.string().uuid().nullable(),
  invitation: z.string().max(2048).optional(),
  state: z.enum([
    'REQUEST_CREATED',
    'AWAITING_SCAN',
    'PRESENTATION_RECEIVED',
    'VERIFYING',
    'VERIFIED',
    'DENIED',
    'FAILED',
    'TIMED_OUT',
  ]),
  decision: verificationDecisionSchema,
  reasons: z.array(verificationReasonSchema),
  disclosedAttributes: z
    .object({
      riderId: z.string(),
      deliveryCompany: z.string(),
      riderStatus: z.string(),
    })
    .nullable(),
  cryptographicVerification: z.enum(['PASS', 'FAIL', 'PENDING']),
  revocation: z.enum(['NOT_REVOKED', 'REVOKED', 'UNKNOWN']),
  issuerTrust: z.enum(['TRUSTED', 'UNTRUSTED', 'UNKNOWN']),
  expiresAt: z.string().nullable(),
  accessPassId: z.string().uuid().nullable(),
});
export const temporaryAccessSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(['mock', 'live']),
  status: z.enum(['PENDING', 'ISSUED', 'ACTIVE', 'EXPIRED', 'DENIED', 'FAILED']),
  buildingId: z.string().uuid(),
  buildingZoneId: z.string().uuid().nullable(),
  accessScope: z.string(),
  validFrom: z.string(),
  validUntil: z.string(),
  invitation: z.string().max(2048).optional(),
});

export type VerificationInput = z.infer<typeof verificationInputSchema>;
export type AccessInput = z.infer<typeof accessInputSchema>;
export type VerificationDecision = z.infer<typeof verificationDecisionSchema>;
export type VerificationReason = z.infer<typeof verificationReasonSchema>;
export type VerificationSession = z.infer<typeof verificationSessionSchema>;
export type TemporaryAccess = z.infer<typeof temporaryAccessSchema>;
export type SecurityBuilding = z.infer<typeof securityBuildingSchema>;
