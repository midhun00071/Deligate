-- Deligate core application schema
-- Cryptographic credential/proof truth remains with eidStack.
-- Supabase stores application state, references, and audit metadata only.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------

create type public.app_role as enum (
  'DELIVERY_ADMIN',
  'RIDER',
  'BUILDING_SECURITY'
);

create type public.organization_type as enum (
  'DELIVERY_COMPANY',
  'BUILDING_OPERATOR'
);

create type public.employment_status as enum (
  'ACTIVE',
  'SUSPENDED',
  'INACTIVE'
);

create type public.credential_kind as enum (
  'VERIFIED_RIDER',
  'TEMPORARY_BUILDING_ACCESS'
);

create type public.credential_status as enum (
  'DRAFT',
  'OFFER_CREATED',
  'AWAITING_SCAN',
  'ACCEPTED',
  'ACTIVE',
  'REVOKED',
  'EXPIRED',
  'FAILED'
);

create type public.verification_status as enum (
  'REQUEST_CREATED',
  'AWAITING_SCAN',
  'PRESENTATION_RECEIVED',
  'VERIFYING',
  'VERIFIED',
  'REJECTED',
  'EXPIRED'
);

create type public.access_pass_status as enum (
  'PENDING',
  'ISSUED',
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'DENIED'
);

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),

  type public.organization_type not null,
  name text not null,

  -- Integration references only. These are not secrets.
  eidstack_tenant_id text unique,
  eidstack_did text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- User profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  organization_id uuid
    references public.organizations(id)
    on delete set null,

  role public.app_role not null,
  display_name text not null,
  avatar_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Riders
-- ---------------------------------------------------------------------------

create table public.riders (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid not null unique
    references public.profiles(id)
    on delete cascade,

  employer_organization_id uuid not null
    references public.organizations(id)
    on delete restrict,

  employee_reference text,
  employment_status public.employment_status not null default 'ACTIVE',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Buildings
-- ---------------------------------------------------------------------------

create table public.buildings (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete restrict,

  name text not null,
  address_label text,
  timezone text not null default 'Asia/Dubai',
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.building_zones (
  id uuid primary key default gen_random_uuid(),

  building_id uuid not null
    references public.buildings(id)
    on delete cascade,

  zone_code text not null,
  name text not null,
  floor_label text,
  elevator_bank text,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (building_id, zone_code)
);

-- ---------------------------------------------------------------------------
-- Credential application records
-- ---------------------------------------------------------------------------

create table public.credential_records (
  id uuid primary key default gen_random_uuid(),

  kind public.credential_kind not null,
  status public.credential_status not null default 'DRAFT',

  subject_profile_id uuid
    references public.profiles(id)
    on delete set null,

  rider_id uuid
    references public.riders(id)
    on delete set null,

  issuer_organization_id uuid not null
    references public.organizations(id)
    on delete restrict,

  -- eidStack references. No raw credential payloads are stored here.
  credential_exchange_id text unique,
  credential_id text,
  schema_id text,
  credential_definition_id text,

  -- Linked/chained credential provenance where supplied by eidStack.
  link_group_id text,
  linked_to_credential_exchange_id text,
  link_type text,
  source_verification_id text,

  issued_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.credential_records is
  'Application status and eidStack references only. Raw verifiable credentials, presentations, private keys, and proof payloads must not be stored here.';

-- ---------------------------------------------------------------------------
-- Verification sessions
-- ---------------------------------------------------------------------------

create table public.verification_sessions (
  id uuid primary key default gen_random_uuid(),

  verifier_profile_id uuid not null
    references public.profiles(id)
    on delete restrict,

  verifier_organization_id uuid not null
    references public.organizations(id)
    on delete restrict,

  building_id uuid
    references public.buildings(id)
    on delete set null,

  rider_id uuid
    references public.riders(id)
    on delete set null,

  status public.verification_status not null default 'REQUEST_CREATED',

  -- eidStack verification reference.
  verification_id text unique,

  -- What Deligate requested, not the raw returned proof.
  requested_attributes text[] not null default '{}',
  requested_predicates jsonb not null default '[]'::jsonb,

  required_credential_definition_id text,
  expected_issuer_did text,

  decision_code text,

  verified_at timestamptz,
  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.verification_sessions is
  'Tracks proof-request workflow state and eidStack references. Raw presentations and cryptographic proof payloads must not be persisted here.';

-- ---------------------------------------------------------------------------
-- Temporary building access
-- ---------------------------------------------------------------------------

create table public.access_passes (
  id uuid primary key default gen_random_uuid(),

  verification_session_id uuid not null unique
    references public.verification_sessions(id)
    on delete restrict,

  rider_id uuid not null
    references public.riders(id)
    on delete restrict,

  building_id uuid not null
    references public.buildings(id)
    on delete restrict,

  building_zone_id uuid
    references public.building_zones(id)
    on delete set null,

  -- Source VerifiedRiderCredential application record.
  source_rider_credential_id uuid
    references public.credential_records(id)
    on delete set null,

  -- TemporaryBuildingAccessCredential application record once issued.
  access_credential_id uuid unique
    references public.credential_records(id)
    on delete set null,

  status public.access_pass_status not null default 'PENDING',

  valid_from timestamptz not null,
  expires_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint access_pass_valid_window
    check (expires_at > valid_from)
);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),

  actor_profile_id uuid
    references public.profiles(id)
    on delete set null,

  organization_id uuid
    references public.organizations(id)
    on delete set null,

  event_type text not null,
  entity_type text not null,
  entity_id uuid,

  -- Must contain non-sensitive operational metadata only.
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

comment on table public.audit_events is
  'Non-sensitive operational audit metadata only. Never store raw credentials, proofs, tokens, secrets, Emirates ID numbers, or private keys.';

-- ---------------------------------------------------------------------------
-- Useful indexes
-- ---------------------------------------------------------------------------

create index profiles_organization_id_idx
  on public.profiles (organization_id);

create index riders_employer_organization_id_idx
  on public.riders (employer_organization_id);

create index buildings_organization_id_idx
  on public.buildings (organization_id);

create index building_zones_building_id_idx
  on public.building_zones (building_id);

create index credential_records_subject_profile_id_idx
  on public.credential_records (subject_profile_id);

create index credential_records_rider_id_idx
  on public.credential_records (rider_id);

create index credential_records_issuer_organization_id_idx
  on public.credential_records (issuer_organization_id);

create index credential_records_status_idx
  on public.credential_records (status);

create index verification_sessions_verifier_profile_id_idx
  on public.verification_sessions (verifier_profile_id);

create index verification_sessions_building_id_idx
  on public.verification_sessions (building_id);

create index verification_sessions_rider_id_idx
  on public.verification_sessions (rider_id);

create index verification_sessions_status_idx
  on public.verification_sessions (status);

create index access_passes_rider_id_idx
  on public.access_passes (rider_id);

create index access_passes_building_id_idx
  on public.access_passes (building_id);

create index access_passes_status_idx
  on public.access_passes (status);

create index audit_events_actor_profile_id_idx
  on public.audit_events (actor_profile_id);

create index audit_events_organization_id_idx
  on public.audit_events (organization_id);

create index audit_events_entity_idx
  on public.audit_events (entity_type, entity_id);

create index audit_events_created_at_idx
  on public.audit_events (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger riders_set_updated_at
before update on public.riders
for each row execute function public.set_updated_at();

create trigger buildings_set_updated_at
before update on public.buildings
for each row execute function public.set_updated_at();

create trigger building_zones_set_updated_at
before update on public.building_zones
for each row execute function public.set_updated_at();

create trigger credential_records_set_updated_at
before update on public.credential_records
for each row execute function public.set_updated_at();

create trigger verification_sessions_set_updated_at
before update on public.verification_sessions
for each row execute function public.set_updated_at();

create trigger access_passes_set_updated_at
before update on public.access_passes
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- RLS is enabled immediately. No permissive client policies are added in this
-- migration, so application tables are default-deny for anon/authenticated
-- clients until the dedicated authorization policy migration is introduced.

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.riders enable row level security;
alter table public.buildings enable row level security;
alter table public.building_zones enable row level security;
alter table public.credential_records enable row level security;
alter table public.verification_sessions enable row level security;
alter table public.access_passes enable row level security;
alter table public.audit_events enable row level security;
