select
  u.email,
  p.id as profile_id,
  p.role,
  p.display_name,
  o.name as organization_name,
  o.type as organization_type
from auth.users u
join public.profiles p
  on p.id = u.id
left join public.organizations o
  on o.id = p.organization_id
where u.email in (
  'delivery.admin@deligate.local',
  'security@deligate.local'
)
order by u.email;