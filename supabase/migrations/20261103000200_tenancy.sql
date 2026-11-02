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
-- audit_logs: append-only.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  municipality_id uuid references public.municipalities (id),
  -- No FK: the audit trail must outlive the user account.
  actor_id uuid,
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
create function private.write_audit(
  p_municipality_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (municipality_id, actor_id, action, entity_type, entity_id, details)
  values (p_municipality_id, (select auth.uid()), p_action, p_entity_type, p_entity_id,
          coalesce(p_details, '{}'::jsonb));
$$;

revoke execute on function private.write_audit(uuid, text, text, uuid, jsonb) from public;

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

-- -----------------------------------------------------------------------------
-- Escalation guards on employees.
-- -----------------------------------------------------------------------------
create function private.guard_employee_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- Service-role / migration context (no end user): allowed.
  if v_uid is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id = v_uid then
      raise exception 'You cannot grant yourself a staff role' using errcode = '42501';
    end if;
    new.invited_by := v_uid;
    return new;
  end if;

  -- UPDATE
  if old.user_id = v_uid and (
    new.role is distinct from old.role
    or new.is_active is distinct from old.is_active
    or new.department_id is distinct from old.department_id
  ) then
    raise exception 'You cannot change your own role, department or status'
      using errcode = '42501';
  end if;

  if old.role = 'municipality_admin' and old.is_active
     and (new.role <> 'municipality_admin' or not new.is_active)
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

-- Remove Supabase's default broad grants; re-grant precisely below.
revoke all on public.municipalities, public.neighborhoods, public.profiles,
  public.profile_contacts, public.platform_admins, public.departments, public.employees,
  public.audit_logs
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

create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- Colleagues can see each other's names (needed to assign work). Citizen profiles are
-- never readable by staff; reporter contact goes through get_report_reporter_contact().
create policy "Staff read colleagues in their municipality"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.user_id = profiles.id
        and e.municipality_id in (select private.staff_municipality_ids())
    )
  );

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
grant select on public.employees to authenticated;
grant insert (user_id, municipality_id, department_id, role, job_title, is_active)
  on public.employees to authenticated;
grant update (department_id, role, job_title, is_active) on public.employees to authenticated;

create policy "Staff read colleagues; users read their own memberships"
  on public.employees for select to authenticated
  using (
    user_id = (select auth.uid())
    or municipality_id in (select private.staff_municipality_ids())
    or (select private.is_platform_admin())
  );

create policy "Municipality admins add employees"
  on public.employees for insert to authenticated
  with check ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

create policy "Municipality admins update employees"
  on public.employees for update to authenticated
  using ((select private.has_staff_role(municipality_id, '{municipality_admin}')))
  with check ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

-- audit_logs: read-only, admins of the municipality ----------------------------------
grant select on public.audit_logs to authenticated;

create policy "Municipality admins read their audit log"
  on public.audit_logs for select to authenticated
  using (
    (select private.has_staff_role(municipality_id, '{municipality_admin}'))
    or (select private.is_platform_admin())
  );
