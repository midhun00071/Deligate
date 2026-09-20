export const APP_ROLES = ['DELIVERY_ADMIN', 'RIDER', 'BUILDING_SECURITY'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export interface AuthenticatedActor {
  userId: string;
  profileId: string;
  role: AppRole;
  organizationId: string | null;
  displayName: string;
}

export type OrganizationType = 'DELIVERY_COMPANY' | 'BUILDING_OPERATOR';

export type EmploymentStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export type CredentialKind = 'VERIFIED_RIDER' | 'TEMPORARY_BUILDING_ACCESS';
