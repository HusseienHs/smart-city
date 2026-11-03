-- =============================================================================
-- Narrow staff report access (hosted security review, 2026-11).
--
-- Replaces private.can_access_report() only. Signature, SECURITY DEFINER, STABLE,
-- `search_path = ''` and EXECUTE grants are unchanged; every caller (the reports RLS policy
-- and, through it, the report child-table policies; update_report_status, assign_report,
-- add_report_comment, add_report_attachment, get_report_reporter_contact; the report-media
-- storage policies; and private.can_handle_report) picks up the new rules automatically.
--
-- Rules (evaluated against the caller's ACTIVE membership in the report's municipality —
-- no active membership there means no staff access, which also denies every
-- cross-municipality request):
--   municipality_admin  → every report of the municipality
--   department_manager  → reports of their own department
--   employee            → only reports assigned to them, and only while the report belongs
--                         to their own department
--   intake_dispatcher   → only reports with no department AND no assignee
--
-- Assignment model: reports.assignee_id references employees.id (the membership row), not
-- auth.users.id — see the composite FK (assignee_id, municipality_id) →
-- employees (id, municipality_id). "Assigned to the current user" therefore means
-- `p_assignee_id = e.id` for the caller's own membership row `e`, which is selected by
-- `e.user_id = auth.uid()`.
--
-- Note: `check (assignee_id is null or department_id is not null)` on reports means a report
-- without a department never has an assignee. The dispatcher's assignee condition is kept as
-- defense in depth so the rule holds even if that constraint were ever relaxed.
--
-- Citizen access is unaffected: it is granted separately through reporter_id checks in the
-- get_my_* functions, submit/attachment/comment RPCs and the report-media storage policies.
-- =============================================================================

create or replace function private.can_access_report(
  p_municipality_id uuid,
  p_department_id uuid,
  p_assignee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case e.role
      when 'municipality_admin' then true
      when 'department_manager' then p_department_id is not null
                                     and p_department_id = e.department_id
      when 'employee' then p_assignee_id is not null
                           and p_assignee_id = e.id
                           and p_department_id is not null
                           and p_department_id = e.department_id
      when 'intake_dispatcher' then p_department_id is null
                                    and p_assignee_id is null
      else false
    end
    from public.employees e
    where e.user_id = (select auth.uid())
      and e.municipality_id = p_municipality_id
      and e.is_active
  ), false);
$$;

comment on function private.can_access_report(uuid, uuid, uuid) is
  'Staff report access: admin = municipality; manager = own department; employee = assigned to '
  'them within their department; dispatcher = no department and no assignee. Active membership '
  'in the report''s municipality required.';

-- CREATE OR REPLACE keeps the existing ACL (owner + authenticated, verified before/after in
-- the test database). Restated explicitly so the result does not depend on default privileges
-- in the target project:
--   * authenticated needs EXECUTE: RLS policies call this function as the querying role.
--   * service_role does not: it bypasses RLS, and SECURITY DEFINER functions call this as owner.
--   * nobody else (PUBLIC, anon) may execute it.
revoke execute on function private.can_access_report(uuid, uuid, uuid)
  from public, anon, service_role;
grant execute on function private.can_access_report(uuid, uuid, uuid) to authenticated;
