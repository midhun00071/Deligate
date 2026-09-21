-- Additive issuer workflow. No raw invitations, credentials or proof data.
alter table public.credential_records
  add column issuer_state text check (issuer_state in
    ('REQUESTING', 'AWAITING_WALLET', 'ISSUED', 'FAILED', 'UNKNOWN', 'REVOKED')),
  add column source_mode text check (source_mode in ('mock', 'live')),
  add column revocation_supported boolean,
  add column revocation_pending boolean not null default false,
  add column error_code text,
  add column action_actor_id uuid references public.profiles(id) on delete set null;

alter table public.credential_records add constraint issuer_workflow_references check (
  issuer_state is null or (
    kind = 'VERIFIED_RIDER' and source_mode is not null and rider_id is not null
    and schema_id is not null and credential_definition_id is not null
    and expires_at is not null
    and (issuer_state not in ('AWAITING_WALLET', 'ISSUED', 'REVOKED') or credential_exchange_id is not null)
  )
);

-- One reserved workflow per rider prevents double-clicks and ambiguous retries.
-- Renewal/reissue requires a separately reviewed workflow; never blindly retry offers.
create unique index credential_records_rider_workflow_unique
  on public.credential_records (rider_id)
  where kind = 'VERIFIED_RIDER' and issuer_state is not null;

create or replace function public.guard_rider_credential_scope()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.issuer_state is not null then
    if not exists (
      select 1 from public.riders r join public.organizations o
        on o.id = r.employer_organization_id
      where r.id = new.rider_id and r.employer_organization_id = new.issuer_organization_id
        and o.type = 'DELIVERY_COMPANY'
    ) then
      raise exception 'Invalid issuer rider scope';
    end if;
    if not exists (
      select 1 from public.profiles p where p.id = new.action_actor_id
        and p.organization_id = new.issuer_organization_id and p.role = 'DELIVERY_ADMIN'
    ) then
      raise exception 'Invalid issuer actor scope';
    end if;
    new.status := case new.issuer_state
      when 'AWAITING_WALLET' then 'AWAITING_SCAN'::public.credential_status
      when 'ISSUED' then 'ACCEPTED'::public.credential_status
      when 'REVOKED' then 'REVOKED'::public.credential_status
      when 'FAILED' then 'FAILED'::public.credential_status
      else 'DRAFT'::public.credential_status end;
  end if;
  return new;
end;
$$;

create trigger credential_records_guard_issuer
before insert or update on public.credential_records
for each row execute function public.guard_rider_credential_scope();

create or replace function public.audit_rider_credential_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.issuer_state is not null and (
    tg_op = 'INSERT' or new.issuer_state is distinct from old.issuer_state
    or new.revocation_pending is distinct from old.revocation_pending
    or new.error_code is distinct from old.error_code
  ) then
    insert into public.audit_events (actor_profile_id, organization_id, event_type, entity_type, entity_id, metadata)
    values (new.action_actor_id, new.issuer_organization_id,
      'ISSUER_' || new.issuer_state, 'rider_credential', new.id,
      jsonb_build_object('source', new.source_mode, 'revocationPending', new.revocation_pending,
        'errorCode', new.error_code));
  end if;
  return new;
end;
$$;

create trigger credential_records_audit_issuer
after insert or update on public.credential_records
for each row execute function public.audit_rider_credential_state();

-- Existing RLS remains default-deny on riders, credentials and audit tables.
-- Only the server service-role client uses these tables, with explicit org filters.
revoke all on function public.guard_rider_credential_scope() from public, anon, authenticated;
revoke all on function public.audit_rider_credential_state() from public, anon, authenticated;
