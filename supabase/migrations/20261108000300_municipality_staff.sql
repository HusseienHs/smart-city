-- =============================================================================
-- Admin dashboard: the staff directory of one municipality, for its administrators.
--
-- Why a function: the only existing source of staff names is get_colleagues(), which returns
-- ACTIVE staff only (by design: colleagues must not see who left). Municipality admins can
-- already read every membership row of their municipality — including inactive ones — but
-- not the names, because employees.user_id is not readable and profiles are private. Without
-- this function an administrator cannot tell deactivated staff apart, so cannot reactivate the
-- right person.
--
-- What it returns: the membership fields admins can already read (id, role, department,
-- job title, active flag, dates) plus the person's display name. Never user ids, emails,
-- phone numbers, home municipality, language or any other profile field.
--
-- Who may call it: an authenticated user with an ACTIVE municipality_admin membership in
-- p_municipality_id (private.has_staff_role checks auth.uid() against an active membership).
-- Everyone else — other roles, other municipalities' admins, deactivated admins, platform
-- admins without a membership, citizens, anon and the service role — gets an error, never
-- rows. Only rows of p_municipality_id are returned.
--
-- Read-only (STABLE), SECURITY DEFINER (profiles are otherwise unreadable), empty search_path
-- with schema-qualified references. No table, policy or existing function changes.
-- =============================================================================

create function public.get_municipality_staff(p_municipality_id uuid)
returns table (
  employee_id uuid,
  full_name text,
  role public.staff_role,
  department_id uuid,
  job_title text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_uid();

  if p_municipality_id is null
     or not private.has_staff_role(p_municipality_id, '{municipality_admin}') then
    raise exception 'Staff directory not found or access denied' using errcode = '42501';
  end if;

  return query
    select e.id, p.full_name, e.role, e.department_id, e.job_title, e.is_active,
           e.created_at, e.updated_at
    from public.employees e
    join public.profiles p on p.id = e.user_id
    where e.municipality_id = p_municipality_id
    order by e.is_active desc, p.full_name nulls last, e.id;
end;
$$;

comment on function public.get_municipality_staff(uuid) is
  'Staff directory (active and inactive) of one municipality with display names, for its '
  'active municipality admins only. Never returns user ids or contact details.';

revoke execute on function public.get_municipality_staff(uuid) from public, anon, service_role;
grant execute on function public.get_municipality_staff(uuid) to authenticated;
