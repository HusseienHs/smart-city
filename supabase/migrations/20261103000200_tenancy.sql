-- =============================================================================
-- Tenancy & people: municipalities, neighborhoods, profiles, staff, audit log,
-- and the RLS helper functions every later policy builds on.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- municipalities (tenants)
-- -----------------------------------------------------------------------------
create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  -- Used in tracking numbers; immutable once created (no UPDATE grant).
  code text not null unique check (code ~ '^[A-Z]{2,5}$'),
  name jsonb not null check (private.is_localized_text(name)),
  status public.municipality_status not null default 'onboarding',
  default_locale public.app_locale not null default 'he',
  timezone text not null default 'Asia/Jerusalem',
  contact_email text check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone text check (contact_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  boundary extensions.geography(MultiPolygon, 4326),
  -- false: new reports wait in the intake queue with a *suggested* department.
  -- true: reports are routed straight to the category's default department.
  auto_route_reports boolean not null default false,
  -- Future-ready: when true, resolving a report requires a completion photo.
  require_completion_photo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.municipalities
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- neighborhoods
-- -----------------------------------------------------------------------------
create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities (id),
  name jsonb not null check (private.is_localized_text(name)),
  boundary extensions.geography(MultiPolygon, 4326),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, municipality_id)
);

create index neighborhoods_municipality_idx on public.neighborhoods (municipality_id);
create index neighborhoods_boundary_idx on public.neighborhoods using gist (boundary);
create trigger set_updated_at before update on public.neighborhoods
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- profiles: 1:1 with auth.users. Non-sensitive data only.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(btrim(full_name)) between 1 and 100),
  preferred_locale public.app_locale not null default 'he',
  home_municipality_id uuid references public.municipalities (id),
  home_neighborhood_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The neighborhood must belong to the home municipality.
  foreign key (home_neighborhood_id, home_municipality_id)
    references public.neighborhoods (id, municipality_id)
);

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Sensitive contact details live in their own table so that no row-level policy written
-- for profiles (e.g. "colleagues can see each other") can ever expose them.
create table public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.profile_contacts
  for each row execute function private.set_updated_at();

-- Create the profile when an auth user signs up. Only whitelisted, validated metadata
-- is copied; anything else in raw_user_meta_data is ignored.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  v_locale text := new.raw_user_meta_data ->> 'preferred_locale';
begin
  insert into public.profiles (id, full_name, preferred_locale)
  values (
    new.id,
    left(v_name, 100),
    case when v_locale in ('he', 'ar', 'en') then v_locale::public.app_locale else 'he' end
  );
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- platform_admins: our operators (read-only support access). Managed by service role only.
-- -----------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- departments
-- -----------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities (id),
  name jsonb not null check (private.is_localized_text(name)),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, municipality_id)
);

create index departments_municipality_idx on public.departments (municipality_id);
create trigger set_updated_at before update on public.departments
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- employees: staff membership of a user in one municipality.
-- -----------------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  municipality_id uuid not null references public.municipalities (id),
  department_id uuid,
  role public.staff_role not null,
  job_title text check (char_length(job_title) <= 100),
  is_active boolean not null default true,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, municipality_id),
  unique (id, municipality_id),
  foreign key (department_id, municipality_id) references public.departments (id, municipality_id),
  -- Department-scoped roles must belong to a department.
  check (role not in ('employee', 'department_manager') or department_id is not null)
);

create index employees_user_active_idx on public.employees (user_id) where is_active;
create index employees_municipality_idx on public.employees (municipality_id);
create index employees_department_idx on public.employees (department_id);
create trigger set_updated_at before update on public.employees
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- audit_logs: append-only. Never read directly by API roles — only through
-- get_audit_log(), which redacts citizen identities (and report payloads for
-- platform admins). The service role keeps full access for incident response.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  municipality_id uuid references public.municipalities (id),
  -- No FK: the audit trail must outlive the user account.
  actor_id uuid,
  -- Who acted: a citizen's id is never shown to staff or platform admins.
  actor_kind text not null check (actor_kind in ('system', 'staff', 'citizen', 'platform')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_municipality_created_idx
  on public.audit_logs (municipality_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_mutation();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.prevent_audit_mutation();

-- Internal: write an audit entry. Not callable by API roles.
-- p_actor_kind lets citizen-facing functions mark the actor as a citizen explicitly
-- (e.g. a staff member submitting a report as a resident stays anonymous to colleagues).
create function private.write_audit(
  p_municipality_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb default '{}'::jsonb,
  p_actor_kind text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  insert into public.audit_logs (municipality_id, actor_id, actor_kind, action, entity_type, entity_id, details)
  values (
    p_municipality_id,
    v_uid,
    coalesce(p_actor_kind, case
      when v_uid is null then 'system'
      when p_municipality_id is not null and private.is_staff(p_municipality_id) then 'staff'
      when private.is_platform_admin() then 'platform'
      else 'citizen'
    end),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke execute on function private.write_audit(uuid, text, text, uuid, jsonb, text) from public;

-- Generic row-change audit trigger for administrative tables.
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  perform private.write_audit(
    coalesce(
      v_row ->> 'municipality_id',
      case when tg_table_name = 'municipalities' then v_row ->> 'id' end
    )::uuid,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    jsonb_build_object(
      'before', case when tg_op <> 'INSERT' then to_jsonb(old) end,
      'after', case when tg_op <> 'DELETE' then to_jsonb(new) end
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function private.audit_row_change() from public;

-- -----------------------------------------------------------------------------
-- RLS helper functions. They only ever answer questions about the *calling* user,
-- so exposing them to `authenticated` reveals nothing about anyone else.
-- STABLE + called as `(select private.fn(...))` → evaluated once per statement.
-- -----------------------------------------------------------------------------
create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

-- The caller's active staff role in a municipality, or null.
create function private.staff_role(p_municipality_id uuid)
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select e.role
  from public.employees e
  where e.user_id = (select auth.uid())
    and e.municipality_id = p_municipality_id
    and e.is_active;
$$;

create function private.is_staff(p_municipality_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.staff_role(p_municipality_id) is not null;
$$;

create function private.has_staff_role(p_municipality_id uuid, p_roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.staff_role(p_municipality_id) = any (p_roles), false);
$$;

-- All municipalities where the caller is active staff (index-friendly in policies).
create function private.staff_municipality_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.municipality_id
  from public.employees e
  where e.user_id = (select auth.uid()) and e.is_active;
$$;

-- The caller's employee record in a municipality.
create function private.current_employee(p_municipality_id uuid)
returns public.employees
language sql
stable
security definer
set search_path = ''
as $$
  select e.*
  from public.employees e
  where e.user_id = (select auth.uid())
    and e.municipality_id = p_municipality_id
    and e.is_active;
$$;

-- Called by RLS policies (as the querying role).
grant execute on function
  private.is_platform_admin(),
  private.has_staff_role(uuid, public.staff_role[]),
  private.staff_municipality_ids()
to authenticated;

-- -----------------------------------------------------------------------------
-- Escalation guards on employees.
--
-- SECURITY INVOKER on purpose: `current_user` then tells us who issued the write.
--   * anon / authenticated → a direct API request: only `job_title` / `is_active` updates
--     by an admin of the municipality are possible (grants + RLS), and they are checked here.
--   * anything else → trusted code: SECURITY DEFINER functions (accept_staff_invitation,
--     set_employee_role), migrations, or the server-side service role.
-- Staff memberships are only ever created by accepting an invitation.
-- -----------------------------------------------------------------------------
create function private.guard_employee_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Staff memberships are created by accepting an invitation'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role or new.department_id is distinct from old.department_id then
    raise exception 'Use set_employee_role() to change roles or departments' using errcode = '42501';
  end if;

  if old.user_id = v_uid and new.is_active is distinct from old.is_active then
    raise exception 'You cannot change your own status' using errcode = '42501';
  end if;

  if old.role = 'municipality_admin' and old.is_active and not new.is_active
     and not exists (
       select 1 from public.employees e
       where e.municipality_id = old.municipality_id
         and e.role = 'municipality_admin'
         and e.is_active
         and e.id <> old.id
     ) then
    raise exception 'A municipality must keep at least one active admin'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_employee_change() from public;

create trigger guard_employee_change before insert or update on public.employees
  for each row execute function private.guard_employee_change();

create trigger audit_employees after insert or update on public.employees
  for each row execute function private.audit_row_change();
create trigger audit_departments after insert or update on public.departments
  for each row execute function private.audit_row_change();
create trigger audit_municipalities after update on public.municipalities
  for each row execute function private.audit_row_change();

-- -----------------------------------------------------------------------------
-- staff_invitations: the only way to become staff. An admin invites an email address;
-- the membership is created only when the user who owns that *confirmed* email accepts.
-- -----------------------------------------------------------------------------
create type public.invitation_status as enum ('pending', 'accepted', 'declined', 'revoked');

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities (id),
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.staff_role not null,
  department_id uuid,
  job_title text check (char_length(job_title) <= 100),
  status public.invitation_status not null default 'pending',
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  responded_at timestamptz,
  accepted_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (department_id, municipality_id) references public.departments (id, municipality_id),
  check (role not in ('employee', 'department_manager') or department_id is not null)
);

create unique index staff_invitations_one_pending_idx
  on public.staff_invitations (municipality_id, email) where status = 'pending';
create trigger set_updated_at before update on public.staff_invitations
  for each row execute function private.set_updated_at();

-- Server-controlled fields on insert.
create function private.prepare_staff_invitation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.invited_by := (select auth.uid());
  new.status := 'pending';
  new.expires_at := now() + interval '7 days';
  new.responded_at := null;
  new.accepted_user_id := null;
  return new;
end;
$$;

create trigger prepare_staff_invitation before insert on public.staff_invitations
  for each row execute function private.prepare_staff_invitation();
create trigger audit_staff_invitations after insert on public.staff_invitations
  for each row execute function private.audit_row_change();

create function private.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.municipalities enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.platform_admins enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.audit_logs enable row level security;
alter table public.staff_invitations enable row level security;

-- Remove Supabase's default broad grants; re-grant precisely below.
revoke all on public.municipalities, public.neighborhoods, public.profiles,
  public.profile_contacts, public.platform_admins, public.departments, public.employees,
  public.audit_logs, public.staff_invitations
  from anon, authenticated;

-- municipalities --------------------------------------------------------------
grant select on public.municipalities to anon, authenticated;
grant update (name, contact_email, contact_phone, auto_route_reports, require_completion_photo)
  on public.municipalities to authenticated;

create policy "Anyone can read active municipalities"
  on public.municipalities for select to anon
  using (status = 'active');

create policy "Users read active municipalities; staff read their own"
  on public.municipalities for select to authenticated
  using (
    status = 'active'
    or id in (select private.staff_municipality_ids())
    or (select private.is_platform_admin())
  );

create policy "Municipality admins update their municipality"
  on public.municipalities for update to authenticated
  using ((select private.has_staff_role(id, '{municipality_admin}')))
  with check ((select private.has_staff_role(id, '{municipality_admin}')));

-- neighborhoods -----------------------------------------------------------------
grant select on public.neighborhoods to anon, authenticated;
grant insert (municipality_id, name, boundary, is_active) on public.neighborhoods to authenticated;
grant update (name, boundary, is_active) on public.neighborhoods to authenticated;

create policy "Anyone can read active neighborhoods of active municipalities"
  on public.neighborhoods for select to anon
  using (
    is_active
    and exists (
      select 1 from public.municipalities m
      where m.id = municipality_id and m.status = 'active'
    )
  );

create policy "Users read public neighborhoods; staff read their municipality"
  on public.neighborhoods for select to authenticated
  using (
    (is_active and exists (
      select 1 from public.municipalities m
      where m.id = municipality_id and m.status = 'active'
    ))
    or municipality_id in (select private.staff_municipality_ids())
    or (select private.is_platform_admin())
  );

create policy "Municipality admins create neighborhoods"
  on public.neighborhoods for insert to authenticated
  with check ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

create policy "Municipality admins update neighborhoods"
  on public.neighborhoods for update to authenticated
  using ((select private.has_staff_role(municipality_id, '{municipality_admin}')))
  with check ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

-- profiles ----------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, preferred_locale, home_municipality_id, home_neighborhood_id)
  on public.profiles to authenticated;

-- Profiles are strictly private: nobody reads another person's profile directly.
-- Colleague names come from get_colleagues(); reporter identity only from
-- get_report_reporter_contact() (handlers only, audited).
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- profile_contacts: strictly own row only ------------------------------------------
grant select, delete on public.profile_contacts to authenticated;
grant insert (user_id, phone) on public.profile_contacts to authenticated;
grant update (phone) on public.profile_contacts to authenticated;

create policy "Users manage their own contact details"
  on public.profile_contacts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- platform_admins: users can only see whether they themselves are one ---------------
grant select on public.platform_admins to authenticated;

create policy "Users see their own platform admin row"
  on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- departments -----------------------------------------------------------------------
grant select on public.departments to anon, authenticated;
grant insert (municipality_id, name, email, phone, is_active) on public.departments to authenticated;
grant update (name, email, phone, is_active) on public.departments to authenticated;

-- Department name + contact are public information ("contact a department").
create policy "Anyone can read active departments of active municipalities"
  on public.departments for select to anon
  using (
    is_active
    and exists (
      select 1 from public.municipalities m
      where m.id = municipality_id and m.status = 'active'
    )
  );

create policy "Users read public departments; staff read their municipality"
  on public.departments for select to authenticated
  using (
    (is_active and exists (
      select 1 from public.municipalities m
      where m.id = municipality_id and m.status = 'active'
    ))
    or municipality_id in (select private.staff_municipality_ids())
    or (select private.is_platform_admin())
  );

create policy "Municipality admins create departments"
  on public.departments for insert to authenticated
  with check ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

create policy "Municipality admins update departments"
  on public.departments for update to authenticated
  using ((select private.has_staff_role(municipality_id, '{municipality_admin}')))
  with check ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

-- employees -------------------------------------------------------------------------
-- No INSERT grant: memberships come only from accept_staff_invitation().
-- Role / department changes only through set_employee_role(). user_id is not readable.
grant select (id, municipality_id, department_id, role, job_title, is_active, invited_by,
              created_at, updated_at)
  on public.employees to authenticated;
grant update (job_title, is_active) on public.employees to authenticated;

create policy "Users read their own memberships"
  on public.employees for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Staff read active colleagues; admins read all staff"
  on public.employees for select to authenticated
  using (
    (is_active and municipality_id in (select private.staff_municipality_ids()))
    or (select private.has_staff_role(municipality_id, '{municipality_admin}'))
    or (select private.is_platform_admin())
  );

create policy "Municipality admins update employees"
  on public.employees for update to authenticated
  using ((select private.has_staff_role(municipality_id, '{municipality_admin}')))
  with check ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

-- audit_logs: no direct access for API roles; read through get_audit_log(). ---------------

-- staff_invitations: created and listed by municipality admins ----------------------------
grant select on public.staff_invitations to authenticated;
grant insert (municipality_id, email, role, department_id, job_title)
  on public.staff_invitations to authenticated;

create policy "Municipality admins read their invitations"
  on public.staff_invitations for select to authenticated
  using ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

create policy "Municipality admins create invitations"
  on public.staff_invitations for insert to authenticated
  with check ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

-- -----------------------------------------------------------------------------
-- Staff functions
-- -----------------------------------------------------------------------------

-- Names of active colleagues — the only way staff see other people's names.
-- Never returns home municipality, neighborhood, language or user ids.
create function public.get_colleagues(p_municipality_id uuid)
returns table (
  employee_id uuid,
  full_name text,
  role public.staff_role,
  department_id uuid,
  job_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, p.full_name, e.role, e.department_id, e.job_title
  from public.employees e
  join public.profiles p on p.id = e.user_id
  where e.municipality_id = p_municipality_id
    and e.is_active
    and private.is_staff(p_municipality_id)
  order by p.full_name;
$$;

-- Pending invitations addressed to the caller's confirmed email.
create function public.get_my_staff_invitations()
returns table (
  id uuid,
  municipality_id uuid,
  municipality_name jsonb,
  role public.staff_role,
  department_name jsonb,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.municipality_id, m.name, i.role, d.name, i.expires_at
  from public.staff_invitations i
  join public.municipalities m on m.id = i.municipality_id
  left join public.departments d on d.id = i.department_id
  join auth.users u on u.id = (select auth.uid())
  where u.email_confirmed_at is not null
    and i.email = lower(u.email)
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at;
$$;

-- Accept an invitation: the only path that creates (or reactivates) a staff membership.
create function public.accept_staff_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_email text;
  v_invitation public.staff_invitations;
  v_existing public.employees;
  v_employee_id uuid;
begin
  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;

  select * into v_invitation
  from public.staff_invitations i
  where i.id = p_invitation_id
  for update;

  if not found or v_email is null or v_invitation.email <> v_email
     or v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    raise exception 'Invitation not found or no longer valid' using errcode = '42501';
  end if;

  if v_invitation.invited_by = v_uid then
    raise exception 'You cannot accept an invitation you created' using errcode = '42501';
  end if;

  if v_invitation.department_id is not null and not exists (
    select 1 from public.departments d where d.id = v_invitation.department_id and d.is_active
  ) then
    raise exception 'The invited department is no longer active' using errcode = '22023';
  end if;

  select * into v_existing
  from public.employees e
  where e.user_id = v_uid and e.municipality_id = v_invitation.municipality_id
  for update;

  if found then
    if v_existing.is_active then
      raise exception 'You are already a staff member of this municipality' using errcode = '22023';
    end if;
    update public.employees e set
      role = v_invitation.role,
      department_id = v_invitation.department_id,
      job_title = v_invitation.job_title,
      invited_by = v_invitation.invited_by,
      is_active = true
    where e.id = v_existing.id;
    v_employee_id := v_existing.id;
  else
    insert into public.employees (user_id, municipality_id, department_id, role, job_title, invited_by)
    values (v_uid, v_invitation.municipality_id, v_invitation.department_id, v_invitation.role,
            v_invitation.job_title, v_invitation.invited_by)
    returning id into v_employee_id;
  end if;

  update public.staff_invitations i
  set status = 'accepted', responded_at = now(), accepted_user_id = v_uid
  where i.id = p_invitation_id;

  perform private.write_audit(v_invitation.municipality_id, 'staff_invitation.accepted',
    'staff_invitation', p_invitation_id,
    jsonb_build_object('employee_id', v_employee_id, 'role', v_invitation.role,
                       'department_id', v_invitation.department_id));
  return v_employee_id;
end;
$$;

create function public.decline_staff_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_invitation public.staff_invitations;
begin
  select * into v_invitation
  from public.staff_invitations i
  where i.id = p_invitation_id
    and i.status = 'pending'
    and i.email = (
      select lower(u.email) from auth.users u
      where u.id = v_uid and u.email_confirmed_at is not null
    )
  for update;
  if not found then
    raise exception 'Invitation not found or no longer valid' using errcode = '42501';
  end if;

  update public.staff_invitations i set status = 'declined', responded_at = now()
  where i.id = p_invitation_id;

  perform private.write_audit(v_invitation.municipality_id, 'staff_invitation.declined',
    'staff_invitation', p_invitation_id);
end;
$$;

create function public.revoke_staff_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_invitation public.staff_invitations;
begin
  select * into v_invitation from public.staff_invitations i where i.id = p_invitation_id for update;
  if not found
     or not private.has_staff_role(v_invitation.municipality_id, '{municipality_admin}')
     or v_invitation.status <> 'pending' then
    raise exception 'Invitation not found or no longer valid' using errcode = '42501';
  end if;

  update public.staff_invitations i set status = 'revoked', responded_at = now()
  where i.id = p_invitation_id;

  perform private.write_audit(v_invitation.municipality_id, 'staff_invitation.revoked',
    'staff_invitation', p_invitation_id, jsonb_build_object('revoked_by', v_uid));
end;
$$;

-- Audit log reader.
--   municipality_admin → their municipality's log; citizen actors are anonymized.
--   platform admin     → operational view: citizen actors anonymized AND report entries
--                        stripped of entity id and payload (no report details, tracking
--                        numbers or reporter references).
create function public.get_audit_log(
  p_municipality_id uuid,
  p_limit integer default 100,
  p_before_id bigint default null
)
returns table (
  id bigint,
  municipality_id uuid,
  actor_id uuid,
  actor_kind text,
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
  v_is_platform boolean;
begin
  perform private.require_uid();
  v_is_admin := private.has_staff_role(p_municipality_id, '{municipality_admin}');
  v_is_platform := private.is_platform_admin();

  if not (v_is_admin or v_is_platform) then
    raise exception 'Audit log not found or access denied' using errcode = '42501';
  end if;

  return query
    select
      a.id,
      a.municipality_id,
      case when a.actor_kind = 'citizen' then null else a.actor_id end,
      a.actor_kind,
      a.action,
      a.entity_type,
      case when v_is_admin or a.entity_type <> 'report' then a.entity_id end,
      case when v_is_admin or a.entity_type <> 'report' then a.details else '{}'::jsonb end,
      a.created_at
    from public.audit_logs a
    where a.municipality_id = p_municipality_id
      and (p_before_id is null or a.id < p_before_id)
    order by a.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke execute on function
  public.get_colleagues(uuid),
  public.get_my_staff_invitations(),
  public.accept_staff_invitation(uuid),
  public.decline_staff_invitation(uuid),
  public.revoke_staff_invitation(uuid),
  public.get_audit_log(uuid, integer, bigint)
from public, anon;

grant execute on function
  public.get_colleagues(uuid),
  public.get_my_staff_invitations(),
  public.accept_staff_invitation(uuid),
  public.decline_staff_invitation(uuid),
  public.revoke_staff_invitation(uuid),
  public.get_audit_log(uuid, integer, bigint)
to authenticated;
