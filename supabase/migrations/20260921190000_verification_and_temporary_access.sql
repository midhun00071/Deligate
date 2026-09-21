-- Macro B workflow state. These are application references/evidence, never raw SSI proof data.
alter table public.verification_sessions
  add column building_zone_id uuid references public.building_zones(id) on delete set null,
  add column workflow_state text not null default 'REQUEST_CREATED' check (workflow_state in ('REQUEST_CREATED','AWAITING_SCAN','PRESENTATION_RECEIVED','VERIFYING','VERIFIED','DENIED','FAILED','TIMED_OUT')),
  add column decision_status text not null default 'PENDING' check (decision_status in ('PENDING','ACCEPTED','DENIED')),
  add column decision_reasons text[] not null default '{}',
  add column cryptographic_status text not null default 'PENDING' check (cryptographic_status in ('PASS','FAIL','PENDING')),
  add column revocation_status text not null default 'UNKNOWN' check (revocation_status in ('NOT_REVOKED','REVOKED','UNKNOWN')),
  add column issuer_trust_status text not null default 'UNKNOWN' check (issuer_trust_status in ('TRUSTED','UNTRUSTED','UNKNOWN')),
  add column disclosed_attributes jsonb,
  add column access_pass_id uuid;

alter table public.access_passes
  alter column rider_id drop not null,
  add column access_scope text not null default 'BUILDING_ENTRY';

create index verification_sessions_org_created_idx on public.verification_sessions (verifier_organization_id, created_at desc);

-- Emit only category-level workflow facts. Invitations, raw presentations and credentials are never stored.
create or replace function public.audit_verification_workflow()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (actor_profile_id, organization_id, event_type, entity_type, entity_id, metadata)
    values (new.verifier_profile_id, new.verifier_organization_id, 'PROOF_REQUEST_CREATED', 'verification_session', new.id, jsonb_build_object('buildingId', new.building_id));
  elsif new.decision_status is distinct from old.decision_status then
    insert into public.audit_events (actor_profile_id, organization_id, event_type, entity_type, entity_id, metadata)
    values (new.verifier_profile_id, new.verifier_organization_id, 'PROOF_' || new.decision_status, 'verification_session', new.id, jsonb_build_object('reasons', new.decision_reasons));
  end if;
  return new;
end;
$$;

create trigger verification_sessions_audit_workflow after insert or update on public.verification_sessions
for each row execute function public.audit_verification_workflow();

create or replace function public.audit_access_workflow()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.audit_events (actor_profile_id, organization_id, event_type, entity_type, entity_id, metadata)
  values ((select verifier_profile_id from public.verification_sessions where id = new.verification_session_id),
    (select verifier_organization_id from public.verification_sessions where id = new.verification_session_id),
    case when tg_op = 'INSERT' then 'TEMPORARY_ACCESS_REQUESTED' when new.status = 'ISSUED' then 'TEMPORARY_ACCESS_ISSUED' else 'TEMPORARY_ACCESS_FAILED' end,
    'access_pass', new.id, jsonb_build_object('status', new.status));
  return new;
end;
$$;

create trigger access_passes_audit_workflow after insert or update of status on public.access_passes
for each row execute function public.audit_access_workflow();

revoke all on function public.audit_verification_workflow() from public, anon, authenticated;
revoke all on function public.audit_access_workflow() from public, anon, authenticated;
