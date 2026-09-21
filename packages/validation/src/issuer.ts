import { z } from 'zod';

export const employmentSchema = z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']);
export const issuerStateSchema = z.enum([
  'REQUESTING',
  'AWAITING_WALLET',
  'ISSUED',
  'FAILED',
  'UNKNOWN',
  'REVOKED',
]);
export const riderInputSchema = z
  .object({
    employeeReference: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9 _.-]+$/),
    employmentStatus: employmentSchema.default('ACTIVE'),
  })
  .strict();
export const riderQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(64)
      .regex(/^[a-zA-Z0-9 _.-]*$/)
      .default(''),
    status: employmentSchema.optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export const riderSchema = z.object({
  id: z.string().uuid(),
  employeeReference: z.string(),
  employmentStatus: employmentSchema,
  organizationId: z.string().uuid(),
  createdAt: z.string(),
});
export const credentialSchema = z.object({
  id: z.string().uuid(),
  riderId: z.string().uuid(),
  state: issuerStateSchema,
  source: z.enum(['mock', 'live']),
  credentialExchangeId: z.string().nullable(),
  schemaId: z.string(),
  credentialDefinitionId: z.string(),
  revocationSupported: z.boolean().nullable(),
  revocationPending: z.boolean(),
  requestedAt: z.string(),
  issuedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  validUntil: z.string(),
  errorCode: z.string().nullable(),
});
export const riderDetailSchema = z.object({
  rider: riderSchema,
  credential: credentialSchema.nullable(),
  invitation: z.string().max(2048).optional(),
});
export const riderListSchema = z.object({
  riders: z.array(
    riderSchema.extend({
      credentialState: issuerStateSchema.nullable(),
      credentialSource: z.enum(['mock', 'live']).nullable(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export const issuerOverviewSchema = z.object({
  activeRiders: z.number(),
  awaitingWallet: z.number(),
  issued: z.number(),
  revoked: z.number(),
  mode: z.enum(['mock', 'live']),
  recent: z.array(z.object({ id: z.string(), eventType: z.string(), createdAt: z.string() })),
});
export const activityQuerySchema = z
  .object({ page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) })
  .strict();
export const activityEventSchema = z.object({
  id: z.string().uuid(),
  action: z.string().min(1).max(80),
  target: z.string().min(1).max(80),
  result: z.enum(['completed', 'pending', 'denied', 'failed']),
  createdAt: z.string(),
});
export const activityPageSchema = z.object({ events: z.array(activityEventSchema), page: z.number(), limit: z.number(), total: z.number() });
export const technicalStatusSchema = z.object({
  mode: z.enum(['mock', 'live']),
  hostname: z.string().nullable(),
  deliveryTenantConfigured: z.boolean(),
  buildingTenantConfigured: z.boolean(),
  riderSchemaConfigured: z.boolean(),
  riderCredentialDefinitionConfigured: z.boolean(),
  accessSchemaConfigured: z.boolean(),
  accessCredentialDefinitionConfigured: z.boolean(),
  responseContractVerified: z.boolean(),
});
export const securityOverviewSchema = z.object({
  pending: z.number(),
  accepted: z.number(),
  denied: z.number(),
  issuedAccesses: z.number(),
  recent: z.array(z.object({ id: z.string(), eventType: z.string(), createdAt: z.string() })),
});
export const revokeInputSchema = z.object({ confirmed: z.literal(true) }).strict();
export type RiderInput = z.infer<typeof riderInputSchema>;
export type RiderQuery = z.infer<typeof riderQuerySchema>;
export type Rider = z.infer<typeof riderSchema>;
export type CredentialRecord = z.infer<typeof credentialSchema>;
export type RiderDetail = z.infer<typeof riderDetailSchema>;
export type RiderList = z.infer<typeof riderListSchema>;
export type IssuerOverview = z.infer<typeof issuerOverviewSchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
export type ActivityPage = z.infer<typeof activityPageSchema>;
export type TechnicalStatus = z.infer<typeof technicalStatusSchema>;
export type SecurityOverview = z.infer<typeof securityOverviewSchema>;
