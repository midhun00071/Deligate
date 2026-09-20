-- Riders may exist without a Deligate/Supabase user account.
-- The external eidStack-compatible wallet is the holder runtime.

alter table public.riders
  alter column profile_id drop not null;
