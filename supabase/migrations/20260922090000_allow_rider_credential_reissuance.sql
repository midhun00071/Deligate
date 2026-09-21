-- Preserve credential history while allowing a replacement after a terminal outcome.
-- Only one non-terminal workflow remains possible for a rider at a time.
drop index if exists public.credential_records_rider_workflow_unique;

create unique index credential_records_rider_active_workflow_unique
  on public.credential_records (rider_id)
  where kind = 'VERIFIED_RIDER'
    and issuer_state in ('REQUESTING', 'AWAITING_WALLET', 'ISSUED', 'UNKNOWN');
