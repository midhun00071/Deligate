-- C01: expose only the authenticated user's own application profile to the
-- publishable Supabase client. Profile mutation remains server-only.

create policy "Authenticated users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);
