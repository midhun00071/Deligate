-- Local transactional regression checks. All fixture data is rolled back.
begin;
insert into auth.users (id) values ('11000000-0000-4000-8000-000000000001');
insert into public.organizations (id, type, name) values
  ('22000000-0000-4000-8000-000000000001', 'DELIVERY_COMPANY', 'Issuer test A'),
  ('22000000-0000-4000-8000-000000000002', 'DELIVERY_COMPANY', 'Issuer test B');
insert into public.profiles (id, organization_id, role, display_name) values
  ('11000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'DELIVERY_ADMIN', 'Test');
insert into public.riders (id, employer_organization_id, employee_reference) values
  ('33000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'Test rider');

do $$
begin
  begin
    insert into public.credential_records (kind, rider_id, issuer_organization_id, issuer_state,
      source_mode, schema_id, credential_definition_id, expires_at, action_actor_id)
    values ('VERIFIED_RIDER', '33000000-0000-4000-8000-000000000001',
      '22000000-0000-4000-8000-000000000002', 'REQUESTING', 'mock', 's', 'd', now() + interval '90 days',
      '11000000-0000-4000-8000-000000000001');
    raise exception 'Cross-org insert unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'Invalid issuer rider scope' then raise; end if;
  end;
end $$;

insert into public.credential_records (id, kind, rider_id, issuer_organization_id, issuer_state,
  source_mode, schema_id, credential_definition_id, expires_at, action_actor_id)
values ('44000000-0000-4000-8000-000000000001', 'VERIFIED_RIDER', '33000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000001', 'REQUESTING', 'mock', 's', 'd', now() + interval '90 days',
  '11000000-0000-4000-8000-000000000001');

do $$
begin
  begin
    insert into public.credential_records (kind, rider_id, issuer_organization_id, issuer_state,
      source_mode, schema_id, credential_definition_id, expires_at, action_actor_id)
    select kind, rider_id, issuer_organization_id, issuer_state, source_mode, schema_id,
      credential_definition_id, expires_at, action_actor_id from public.credential_records
      where id = '44000000-0000-4000-8000-000000000001';
    raise exception 'Duplicate issuance unexpectedly succeeded';
  exception when unique_violation then null;
  end;
  if not exists (select 1 from public.audit_events where entity_id = '44000000-0000-4000-8000-000000000001'
    and event_type = 'ISSUER_REQUESTING') then raise exception 'Atomic audit missing'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
do $$
declare affected integer;
begin
  if exists(select 1 from public.riders) or exists(select 1 from public.credential_records)
    or exists(select 1 from public.audit_events) then raise exception 'RLS read leak'; end if;
  update public.riders set employment_status = 'INACTIVE'
    where id = '33000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS update leak'; end if;
  begin
    insert into public.riders (employer_organization_id, employee_reference)
      values ('22000000-0000-4000-8000-000000000001', 'Unauthorized');
    raise exception 'RLS insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
