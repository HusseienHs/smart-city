-- =============================================================================
-- Admin dashboard: the signed-in user's own staff memberships.
--
-- Why a function: `employees.user_id` is deliberately not readable (column grant), and the
-- employees read policy also returns active colleagues, so a client cannot tell which rows
-- are its own. This function answers exactly that question for the calling user — and only
-- for the calling user: it takes no parameters and filters on auth.uid().
--
-- Returns only ACTIVE memberships: a deactivated membership grants no access anywhere
-- (private.staff_role() and every policy ignore it), so the dashboard must not offer it.
-- The municipality status is returned so the UI can explain a suspended municipality; it
-- does not change what the database allows.
--
-- Read-only, SECURITY DEFINER, empty search_path, no table or policy changes.
-- =============================================================================

create function public.get_my_staff_memberships()
returns table (
  employee_id uuid,
  municipality_id uuid,
  municipality_code text,
  municipality_name jsonb,
  municipality_status public.municipality_status,
  role public.staff_role,
  department_id uuid,
  department_name jsonb,
  job_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    m.id,
    m.code,
    m.name,
    m.status,
    e.role,
    e.department_id,
    d.name,
    e.job_title
  from public.employees e
  join public.municipalities m on m.id = e.municipality_id
  left join public.departments d
    on d.id = e.department_id and d.municipality_id = e.municipality_id
  where e.user_id = (select auth.uid())
    and e.is_active
  order by m.code;
$$;

revoke execute on function public.get_my_staff_memberships() from public, anon;
grant execute on function public.get_my_staff_memberships() to authenticated;
