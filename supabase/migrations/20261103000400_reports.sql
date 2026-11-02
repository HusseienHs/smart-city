-- =============================================================================
-- Municipal reporting.
--
-- Access model:
--   * Staff read reports directly, scoped by private.can_access_report():
--       municipality_admin → all reports of their municipality
--       department_manager → reports of their department
--       employee           → reports of their department or assigned to them
--       intake_dispatcher  → unassigned reports (department_id is null)
--   * Citizens never read report tables directly. They use get_my_* functions (own reports)
--     and get_public_reports() (rounded location, no identity, no description, no photos).
--   * Nobody writes report tables directly. All writes go through the RPCs below, which
--     validate permissions + state and record history, notifications and audit entries.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reference data
-- -----------------------------------------------------------------------------
create table public.report_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z_]{2,40}$'),
  name jsonb not null check (private.is_localized_text(name)),
  icon text,
  default_visibility public.report_visibility not null default 'public',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.report_categories
  for each row execute function private.set_updated_at();

-- Global catalog (mirrors REPORT_CATEGORIES in packages/shared). Sensitive categories
-- default to private.
insert into public.report_categories (code, name, icon, default_visibility, sort_order) values
  ('pothole', '{"he": "בור בכביש", "ar": "حفرة في الطريق", "en": "Pothole"}', 'warning', 'public', 10),
  ('streetlight', '{"he": "פנס רחוב תקול", "ar": "عمود إنارة معطل", "en": "Broken streetlight"}', 'bulb', 'public', 20),
  ('garbage', '{"he": "אשפה", "ar": "نفايات", "en": "Garbage"}', 'trash', 'public', 30),
  ('water_leak', '{"he": "נזילת מים", "ar": "تسرب مياه", "en": "Water leak"}', 'water', 'public', 40),
  ('sidewalk', '{"he": "מדרכה פגומה", "ar": "رصيف متضرر", "en": "Damaged sidewalk"}', 'walk', 'public', 50),
  ('road', '{"he": "מפגע בכביש", "ar": "مشكلة في الطريق", "en": "Road problem"}', 'car', 'public', 60),
  ('public_infrastructure', '{"he": "תשתית ציבורית", "ar": "بنية تحتية عامة", "en": "Public infrastructure"}', 'construct', 'public', 70),
  ('noise', '{"he": "מפגע רעש", "ar": "شكوى ضجيج", "en": "Noise complaint"}', 'volume-high', 'private', 80),
  ('other', '{"he": "אחר", "ar": "أخرى", "en": "Other"}', 'ellipsis-horizontal', 'public', 90);

-- Per-municipality category settings: enablement, routing and default priority.
create table public.municipality_report_categories (
  municipality_id uuid not null references public.municipalities (id),
  category_id uuid not null references public.report_categories (id),
  is_enabled boolean not null default true,
  default_department_id uuid,
  default_priority public.report_priority not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (municipality_id, category_id),
  foreign key (default_department_id, municipality_id)
    references public.departments (id, municipality_id)
);

create trigger set_updated_at before update on public.municipality_report_categories
  for each row execute function private.set_updated_at();

-- The status workflow as data. Must equal REPORT_STATUS_TRANSITIONS in packages/shared.
create table public.report_status_transitions (
  from_status public.report_status not null,
  to_status public.report_status not null,
  primary key (from_status, to_status),
  check (from_status <> to_status)
);

insert into public.report_status_transitions (from_status, to_status) values
  ('submitted', 'under_review'), ('submitted', 'assigned'), ('submitted', 'rejected'),
  ('under_review', 'assigned'), ('under_review', 'in_progress'), ('under_review', 'rejected'),
  ('assigned', 'in_progress'), ('assigned', 'under_review'), ('assigned', 'rejected'),
  ('in_progress', 'resolved'), ('in_progress', 'assigned'),
  ('resolved', 'closed'), ('resolved', 'in_progress');

-- -----------------------------------------------------------------------------
-- reports
-- -----------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities (id),
  -- Sequential and therefore guessable: never used for authorization.
  tracking_number text not null unique check (tracking_number ~ '^[A-Z]{2,5}-[0-9]{4}-[0-9]{6}$'),
  reporter_id uuid references public.profiles (id) on delete set null,
  category_id uuid not null references public.report_categories (id),
  neighborhood_id uuid,
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  -- Exact location: visible only to the reporter and authorized staff.
  location extensions.geography(Point, 4326) not null,
  -- ~50 m grid location: the only location ever returned publicly.
  public_location extensions.geography(Point, 4326)
    generated always as (private.round_location(location)) stored,
  location_accuracy_m real check (location_accuracy_m >= 0),
  address text check (char_length(address) <= 300),
  visibility public.report_visibility not null,
  status public.report_status not null default 'submitted',
  priority public.report_priority not null default 'normal',
  suggested_department_id uuid,
  department_id uuid,
  assignee_id uuid,
  rejection_reason public.report_rejection_reason,
  duplicate_of_id uuid,
  confirmation_count integer not null default 0 check (confirmation_count >= 0),
  follower_count integer not null default 0 check (follower_count >= 0),
  status_changed_at timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, municipality_id),
  -- Composite FKs: every referenced row must belong to the same municipality.
  foreign key (neighborhood_id, municipality_id)
    references public.neighborhoods (id, municipality_id),
  foreign key (suggested_department_id, municipality_id)
    references public.departments (id, municipality_id),
  foreign key (department_id, municipality_id)
    references public.departments (id, municipality_id),
  foreign key (assignee_id, municipality_id)
    references public.employees (id, municipality_id) on delete set null (assignee_id),
  foreign key (duplicate_of_id, municipality_id)
    references public.reports (id, municipality_id),
  check (assignee_id is null or department_id is not null),
  check ((status = 'rejected') = (rejection_reason is not null)),
  check (duplicate_of_id is null or rejection_reason = 'duplicate'),
  check (duplicate_of_id is null or duplicate_of_id <> id)
);

create index reports_municipality_status_created_idx
  on public.reports (municipality_id, status, created_at desc);
create index reports_municipality_category_idx on public.reports (municipality_id, category_id);
create index reports_municipality_neighborhood_idx on public.reports (municipality_id, neighborhood_id);
create index reports_department_idx on public.reports (department_id);
create index reports_assignee_idx on public.reports (assignee_id);
create index reports_reporter_created_idx on public.reports (reporter_id, created_at desc);
create index reports_location_idx on public.reports using gist (location);
create index reports_public_location_idx on public.reports using gist (public_location)
  where visibility = 'public';

create trigger set_updated_at before update on public.reports
  for each row execute function private.set_updated_at();

create table public.report_tracking_counters (
  municipality_id uuid not null references public.municipalities (id),
  year integer not null,
  last_value integer not null,
  primary key (municipality_id, year)
);

-- -----------------------------------------------------------------------------
-- Report children. Each carries municipality_id with a composite FK to the report.
-- -----------------------------------------------------------------------------
create table public.report_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  municipality_id uuid not null,
  kind public.attachment_kind not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/heic', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (report_id, municipality_id) references public.reports (id, municipality_id)
);

create index report_attachments_report_idx on public.report_attachments (report_id);

create table public.report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  municipality_id uuid not null,
  -- Internal only (not readable by API roles): would identify the reporter.
  author_id uuid references public.profiles (id) on delete set null,
  -- What staff see instead: the staff author, or "from the reporter".
  author_employee_id uuid,
  from_reporter boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (report_id, municipality_id) references public.reports (id, municipality_id),
  foreign key (author_employee_id, municipality_id)
    references public.employees (id, municipality_id) on delete set null (author_employee_id)
);

create index report_comments_report_idx on public.report_comments (report_id, created_at);

create table public.report_status_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  municipality_id uuid not null,
  from_status public.report_status,
  to_status public.report_status not null,
  -- Internal only (not readable by API roles): for the initial entry this is the reporter.
  changed_by uuid references public.profiles (id) on delete set null,
  -- What staff see instead: the employee who made the change (null for the submission).
  changed_by_employee_id uuid,
  note text check (char_length(note) <= 2000),
  note_is_public boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (report_id, municipality_id) references public.reports (id, municipality_id),
  foreign key (changed_by_employee_id, municipality_id)
    references public.employees (id, municipality_id) on delete set null (changed_by_employee_id)
);

create index report_status_history_report_idx on public.report_status_history (report_id, created_at);

create table public.report_confirmations (
  report_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  municipality_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id),
  foreign key (report_id, municipality_id) references public.reports (id, municipality_id)
);

create table public.report_followers (
  report_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  municipality_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id),
  foreign key (report_id, municipality_id) references public.reports (id, municipality_id)
);

create index report_confirmations_user_idx on public.report_confirmations (user_id);
create index report_followers_user_idx on public.report_followers (user_id);

-- -----------------------------------------------------------------------------
-- Access helpers
-- -----------------------------------------------------------------------------

-- The single definition of "which staff member may see which report".
-- Employees and managers see the reports of their *current* department only, so moving
-- someone to another department removes their access to the previous one immediately.
-- (Assignees always belong to the report's department — enforced by assign_report and
-- set_employee_role — so "assigned to me" is covered by "my department".)
-- p_assignee_id is kept in the signature for policy compatibility; it grants nothing.
create function private.can_access_report(
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
      when 'employee' then p_department_id is not null
                           and p_department_id = e.department_id
      when 'intake_dispatcher' then p_department_id is null
      else false
    end
    from public.employees e
    where e.user_id = (select auth.uid())
      and e.municipality_id = p_municipality_id
      and e.is_active
  ), false);
$$;

-- Called by the reports RLS policy (as the querying role).
grant execute on function private.can_access_report(uuid, uuid, uuid) to authenticated;

-- Staff actually handling a report (excludes intake dispatchers, who only triage).
create function private.can_handle_report(
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
  select private.can_access_report(p_municipality_id, p_department_id, p_assignee_id)
    and private.staff_role(p_municipality_id) <> 'intake_dispatcher';
$$;

-- Internal: notify everyone following a report, except the actor. The tracking number is
-- added only to the reporter's own notification; other followers get the report id and
-- the status change, nothing that identifies the report outside the public data.
create function private.notify_report_followers(
  p_report_id uuid,
  p_type public.notification_type,
  p_data jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, municipality_id, type, data)
  select
    f.user_id,
    f.municipality_id,
    p_type,
    case when f.user_id = r.reporter_id
      then p_data || jsonb_build_object('tracking_number', r.tracking_number)
      else p_data
    end
  from public.report_followers f
  join public.reports r on r.id = f.report_id
  where f.report_id = p_report_id
    and f.user_id is distinct from (select auth.uid());
$$;

revoke execute on function private.notify_report_followers(uuid, public.notification_type, jsonb)
  from public;

-- The caller's employee id in a municipality (for attributing staff actions), or null.
create function private.current_employee_id(p_municipality_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (private.current_employee(p_municipality_id)).id;
$$;

-- Shared denial: identical for "does not exist" and "not allowed", so callers cannot
-- probe which report ids exist.
create function private.deny_report_access()
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Report not found or access denied' using errcode = '42501';
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.report_categories enable row level security;
alter table public.municipality_report_categories enable row level security;
alter table public.report_status_transitions enable row level security;
alter table public.reports enable row level security;
alter table public.report_tracking_counters enable row level security;
alter table public.report_attachments enable row level security;
alter table public.report_comments enable row level security;
alter table public.report_status_history enable row level security;
alter table public.report_confirmations enable row level security;
alter table public.report_followers enable row level security;

revoke all on public.report_categories, public.municipality_report_categories,
  public.report_status_transitions, public.reports, public.report_tracking_counters,
  public.report_attachments, public.report_comments, public.report_status_history,
  public.report_confirmations, public.report_followers
  from anon, authenticated;

-- Reference data ---------------------------------------------------------------------
grant select on public.report_categories, public.report_status_transitions to anon, authenticated;

create policy "Anyone can read active categories"
  on public.report_categories for select to anon, authenticated
  using (is_active);

create policy "Anyone can read the status workflow"
  on public.report_status_transitions for select to anon, authenticated
  using (true);

grant select on public.municipality_report_categories to anon, authenticated;
grant insert (municipality_id, category_id, is_enabled, default_department_id, default_priority)
  on public.municipality_report_categories to authenticated;
grant update (is_enabled, default_department_id, default_priority)
  on public.municipality_report_categories to authenticated;

create policy "Anyone can read enabled categories of active municipalities"
  on public.municipality_report_categories for select to anon
  using (
    is_enabled
    and exists (
      select 1 from public.municipalities m
      where m.id = municipality_id and m.status = 'active'
    )
  );

create policy "Users read enabled categories; staff read their municipality"
  on public.municipality_report_categories for select to authenticated
  using (
    (is_enabled and exists (
      select 1 from public.municipalities m
      where m.id = municipality_id and m.status = 'active'
    ))
    or municipality_id in (select private.staff_municipality_ids())
  );

create policy "Municipality admins configure categories"
  on public.municipality_report_categories for insert to authenticated
  with check ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

create policy "Municipality admins update category settings"
  on public.municipality_report_categories for update to authenticated
  using ((select private.has_staff_role(municipality_id, '{municipality_admin}')))
  with check ((select private.has_staff_role(municipality_id, '{municipality_admin}')));

create trigger audit_municipality_report_categories
  after insert or update on public.municipality_report_categories
  for each row execute function private.audit_row_change();

-- reports: staff read only (department-scoped). No write grants at all. ---------------
-- Platform admins deliberately have NO access to report data: exact locations and
-- citizen-provided content are for authorized municipal staff only.
-- Column-level grant: reporter_id is NOT readable. Reporter identity is available only
-- through get_report_reporter_contact() (handlers only, audited). Clients must list
-- columns explicitly (`select *` is denied).
grant select (
  id, municipality_id, tracking_number, category_id, neighborhood_id, description, location,
  public_location, location_accuracy_m, address, visibility, status, priority,
  suggested_department_id, department_id, assignee_id, rejection_reason, duplicate_of_id,
  confirmation_count, follower_count, status_changed_at, first_response_at, resolved_at,
  closed_at, created_at, updated_at
) on public.reports to authenticated;

create policy "Staff read reports they are authorized for"
  on public.reports for select to authenticated
  using (private.can_access_report(municipality_id, department_id, assignee_id));

-- Report children: visible to staff exactly when the parent report is (the subquery is
-- itself filtered by the reports policy above). Columns that would reveal the reporter's
-- user id (author_id, changed_by, uploaded_by) are not granted.
grant select (id, report_id, municipality_id, kind, storage_path, mime_type, size_bytes, created_at)
  on public.report_attachments to authenticated;
grant select (id, report_id, municipality_id, author_employee_id, from_reporter, body, is_internal,
              created_at)
  on public.report_comments to authenticated;
grant select (id, report_id, municipality_id, from_status, to_status, changed_by_employee_id, note,
              note_is_public, created_at)
  on public.report_status_history to authenticated;

create policy "Staff read attachments of accessible reports"
  on public.report_attachments for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id));

create policy "Staff read comments of accessible reports"
  on public.report_comments for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id));

create policy "Staff read history of accessible reports"
  on public.report_status_history for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id));

-- Confirmations / follows: users see only their own rows. Writes via RPCs.
grant select on public.report_confirmations, public.report_followers to authenticated;

create policy "Users read their own confirmations"
  on public.report_confirmations for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users read their own follows"
  on public.report_followers for select to authenticated
  using (user_id = (select auth.uid()));

-- report_tracking_counters: no access for API roles (RLS on, no policies, no grants).

-- -----------------------------------------------------------------------------
-- RPC: submit a report (citizens; staff act as citizens here)
-- -----------------------------------------------------------------------------
create function public.submit_report(
  p_municipality_id uuid,
  p_category_code text,
  p_description text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_accuracy_m real default null,
  p_address text default null,
  p_visibility public.report_visibility default null
)
returns table (report_id uuid, tracking_number text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_municipality public.municipalities;
  v_category public.report_categories;
  v_settings public.municipality_report_categories;
  v_point extensions.geography;
  v_neighborhood_id uuid;
  v_default_department uuid;
  v_year integer;
  v_sequence integer;
  v_tracking text;
  v_id uuid;
  v_description text := btrim(p_description);
begin
  select * into v_municipality
  from public.municipalities m
  where m.id = p_municipality_id and m.status = 'active';
  if not found then
    raise exception 'Municipality not found or not active' using errcode = '22023';
  end if;

  select * into v_category
  from public.report_categories c
  where c.code = p_category_code and c.is_active;
  if not found then
    raise exception 'Unknown report category' using errcode = '22023';
  end if;

  select * into v_settings
  from public.municipality_report_categories s
  where s.municipality_id = p_municipality_id and s.category_id = v_category.id and s.is_enabled;
  if not found then
    raise exception 'This category is not available in this municipality' using errcode = '22023';
  end if;

  if v_description is null or char_length(v_description) not between 10 and 2000 then
    raise exception 'The description must be between 10 and 2000 characters' using errcode = '22023';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;

  if v_municipality.boundary is not null
     and not extensions.st_covers(v_municipality.boundary, v_point) then
    raise exception 'The location is outside the municipality' using errcode = '22023';
  end if;

  -- Rate limit: 10 reports per user per hour, serialized per user.
  perform pg_advisory_xact_lock(hashtextextended('submit_report:' || v_uid::text, 0));
  if (
    select count(*) from public.reports r
    where r.reporter_id = v_uid and r.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many reports in a short time. Please try again later.'
      using errcode = 'P0001', hint = 'rate_limited';
  end if;

  select n.id into v_neighborhood_id
  from public.neighborhoods n
  where n.municipality_id = p_municipality_id
    and n.is_active
    and n.boundary is not null
    and extensions.st_covers(n.boundary, v_point)
  order by n.created_at
  limit 1;

  select d.id into v_default_department
  from public.departments d
  where d.id = v_settings.default_department_id and d.is_active;

  v_year := extract(year from (now() at time zone v_municipality.timezone))::integer;

  insert into public.report_tracking_counters as c (municipality_id, year, last_value)
  values (p_municipality_id, v_year, 1)
  on conflict (municipality_id, year) do update set last_value = c.last_value + 1
  returning c.last_value into v_sequence;

  if v_sequence > 999999 then
    raise exception 'Tracking number sequence exhausted for this year';
  end if;

  v_tracking := v_municipality.code || '-' || v_year || '-' || lpad(v_sequence::text, 6, '0');

  insert into public.reports (
    municipality_id, tracking_number, reporter_id, category_id, neighborhood_id, description,
    location, location_accuracy_m, address, visibility, priority,
    suggested_department_id, department_id, follower_count
  ) values (
    p_municipality_id, v_tracking, v_uid, v_category.id, v_neighborhood_id, v_description,
    v_point, p_location_accuracy_m, nullif(btrim(p_address), ''),
    coalesce(p_visibility, v_category.default_visibility), v_settings.default_priority,
    case when v_municipality.auto_route_reports then null else v_default_department end,
    case when v_municipality.auto_route_reports then v_default_department else null end,
    1
  )
  returning id into v_id;

  -- The reporter follows their own report (drives status notifications).
  insert into public.report_followers (report_id, user_id, municipality_id)
  values (v_id, v_uid, p_municipality_id);

  insert into public.report_status_history (report_id, municipality_id, from_status, to_status, changed_by)
  values (v_id, p_municipality_id, null, 'submitted', v_uid);

  -- Always recorded as a citizen action (even when the reporter is also staff), so the
  -- reporter's identity is never shown in the audit log.
  perform private.write_audit(p_municipality_id, 'report.submitted', 'report', v_id,
    jsonb_build_object('tracking_number', v_tracking), 'citizen');

  return query select v_id, v_tracking;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: register an uploaded photo. The file must already be in storage; its size and
-- type are taken from the stored object's metadata, never from the caller.
-- Paths: {municipality_id}/{report_id}/citizen/{uuid}.{ext}     (citizen_photo)
--        {municipality_id}/{report_id}/completion/{uuid}.{ext}  (completion_photo)
-- -----------------------------------------------------------------------------
create function public.add_report_attachment(
  p_report_id uuid,
  p_storage_path text,
  p_kind public.attachment_kind default 'citizen_photo'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_report public.reports;
  v_id uuid;
  v_folder text := case when p_kind = 'citizen_photo' then 'citizen' else 'completion' end;
  v_metadata jsonb;
  v_size bigint;
  v_mime text;
begin
  select * into v_report from public.reports r where r.id = p_report_id for update;
  if not found then
    perform private.deny_report_access();
  end if;

  if p_kind = 'citizen_photo' then
    if v_report.reporter_id is distinct from v_uid then
      perform private.deny_report_access();
    end if;
    if v_report.status <> 'submitted' then
      raise exception 'Photos can only be added while the report is newly submitted' using errcode = '22023';
    end if;
    if (
      select count(*) from public.report_attachments a
      where a.report_id = p_report_id and a.kind = 'citizen_photo'
    ) >= 5 then
      raise exception 'A report can have at most 5 photos' using errcode = '22023';
    end if;
  else
    if not private.can_handle_report(v_report.municipality_id, v_report.department_id, v_report.assignee_id) then
      perform private.deny_report_access();
    end if;
    if v_report.status not in ('in_progress', 'resolved') then
      raise exception 'Completion photos require the report to be in progress or resolved' using errcode = '22023';
    end if;
    if (
      select count(*) from public.report_attachments a
      where a.report_id = p_report_id and a.kind = 'completion_photo'
    ) >= 5 then
      raise exception 'A report can have at most 5 completion photos' using errcode = '22023';
    end if;
  end if;

  if p_storage_path !~ ('^' || v_report.municipality_id::text || '/' || v_report.id::text
                        || '/' || v_folder || '/[0-9a-f-]{36}\.(jpg|jpeg|png|heic|webp)$') then
    raise exception 'Invalid storage path' using errcode = '22023';
  end if;

  select o.metadata into v_metadata
  from storage.objects o
  where o.bucket_id = 'report-media' and o.name = p_storage_path;
  if not found then
    raise exception 'The file has not been uploaded' using errcode = '22023';
  end if;

  v_size := (v_metadata ->> 'size')::bigint;
  v_mime := v_metadata ->> 'mimetype';
  if v_size is null or v_size < 1 or v_size > 10485760 then
    raise exception 'The file is empty or larger than 10 MB' using errcode = '22023';
  end if;
  if v_mime is null or v_mime not in ('image/jpeg', 'image/png', 'image/heic', 'image/webp') then
    raise exception 'Unsupported file type' using errcode = '22023';
  end if;

  insert into public.report_attachments (report_id, municipality_id, kind, storage_path, mime_type, size_bytes, uploaded_by)
  values (p_report_id, v_report.municipality_id, p_kind, p_storage_path, v_mime, v_size, v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: change a report's status (authorized staff only)
-- -----------------------------------------------------------------------------
create function public.update_report_status(
  p_report_id uuid,
  p_status public.report_status,
  p_note text default null,
  -- Notes are internal unless explicitly marked public. Resolving and rejecting require an
  -- explicit public note.
  p_note_is_public boolean default false,
  p_rejection_reason public.report_rejection_reason default null,
  p_duplicate_of_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_report public.reports;
  v_role public.staff_role;
  v_note text := nullif(btrim(p_note), '');
  v_note_is_public boolean := coalesce(p_note_is_public, false) and nullif(btrim(p_note), '') is not null;
begin
  select * into v_report from public.reports r where r.id = p_report_id for update;
  if not found
     or not private.can_access_report(v_report.municipality_id, v_report.department_id, v_report.assignee_id) then
    perform private.deny_report_access();
  end if;

  v_role := private.staff_role(v_report.municipality_id);

  if v_role = 'intake_dispatcher' and p_status not in ('under_review', 'rejected') then
    raise exception 'Intake dispatchers can only move reports to review or reject them'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.report_status_transitions t
    where t.from_status = v_report.status and t.to_status = p_status
  ) then
    raise exception 'Invalid status transition from % to %', v_report.status, p_status
      using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'The note is too long' using errcode = '22023';
  end if;

  if p_status in ('resolved', 'rejected')
     and (v_note is null or char_length(v_note) < 5 or not v_note_is_public) then
    raise exception 'A public note for the citizen is required when a report is resolved or rejected'
      using errcode = '22023';
  end if;

  if p_status = 'rejected' then
    if p_rejection_reason is null then
      raise exception 'A rejection reason is required' using errcode = '22023';
    end if;
    if p_rejection_reason = 'duplicate' then
      if p_duplicate_of_id is null or p_duplicate_of_id = p_report_id or not exists (
        select 1 from public.reports r
        where r.id = p_duplicate_of_id and r.municipality_id = v_report.municipality_id
      ) then
        raise exception 'A duplicate must reference the original report in the same municipality'
          using errcode = '22023';
      end if;
    elsif p_duplicate_of_id is not null then
      raise exception 'Only duplicates reference an original report' using errcode = '22023';
    end if;
  elsif p_rejection_reason is not null or p_duplicate_of_id is not null then
    raise exception 'A rejection reason is only allowed when rejecting' using errcode = '22023';
  end if;

  if p_status = 'assigned' and v_report.department_id is null then
    raise exception 'Route the report to a department first (assign_report)' using errcode = '22023';
  end if;

  if p_status = 'resolved'
     and (select m.require_completion_photo from public.municipalities m where m.id = v_report.municipality_id)
     and not exists (
       select 1 from public.report_attachments a
       where a.report_id = p_report_id and a.kind = 'completion_photo'
     ) then
    raise exception 'This municipality requires a completion photo before resolving'
      using errcode = '22023';
  end if;

  update public.reports r set
    status = p_status,
    status_changed_at = now(),
    first_response_at = coalesce(r.first_response_at, now()),
    resolved_at = case
      when p_status = 'resolved' then now()
      when p_status = 'in_progress' then null
      else r.resolved_at
    end,
    closed_at = case when p_status in ('closed', 'rejected') then now() else r.closed_at end,
    rejection_reason = p_rejection_reason,
    duplicate_of_id = p_duplicate_of_id
  where r.id = p_report_id;

  insert into public.report_status_history (
    report_id, municipality_id, from_status, to_status, changed_by, changed_by_employee_id,
    note, note_is_public
  ) values (
    p_report_id, v_report.municipality_id, v_report.status, p_status, v_uid,
    private.current_employee_id(v_report.municipality_id), v_note, v_note_is_public
  );

  perform private.notify_report_followers(p_report_id, 'report_status_changed', jsonb_build_object(
    'report_id', p_report_id,
    'from_status', v_report.status,
    'to_status', p_status
  ));

  perform private.write_audit(v_report.municipality_id, 'report.status_changed', 'report', p_report_id,
    jsonb_build_object('from', v_report.status, 'to', p_status, 'rejection_reason', p_rejection_reason,
                       'duplicate_of_id', p_duplicate_of_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: route / assign a report
--   dispatcher → route an unassigned report to any department (no individual assignee)
--   manager    → assign within their department, or return the report to intake
--   admin      → anything within their municipality
--   employee   → not allowed
-- -----------------------------------------------------------------------------
create function public.assign_report(
  p_report_id uuid,
  p_department_id uuid,
  p_assignee_id uuid default null,
  p_priority public.report_priority default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_report public.reports;
  v_actor public.employees;
  v_new_status public.report_status;
begin
  select * into v_report from public.reports r where r.id = p_report_id for update;
  if not found
     or not private.can_access_report(v_report.municipality_id, v_report.department_id, v_report.assignee_id) then
    perform private.deny_report_access();
  end if;

  v_actor := private.current_employee(v_report.municipality_id);

  if v_actor.role = 'employee' then
    raise exception 'Employees cannot assign reports' using errcode = '42501';
  end if;

  if v_actor.role = 'intake_dispatcher' and p_assignee_id is not null then
    raise exception 'Intake dispatchers route reports to departments; the department assigns an employee'
      using errcode = '42501';
  end if;

  if v_actor.role = 'department_manager'
     and p_department_id is not null
     and p_department_id <> v_actor.department_id then
    raise exception 'Department managers can only assign within their department or return the report to intake'
      using errcode = '42501';
  end if;

  if v_report.status in ('resolved', 'closed', 'rejected') then
    raise exception 'Finished reports cannot be reassigned' using errcode = '22023';
  end if;

  if p_department_id is null and v_report.status not in ('submitted', 'under_review', 'assigned') then
    raise exception 'Reports in progress cannot be returned to intake' using errcode = '22023';
  end if;

  if p_assignee_id is not null and p_department_id is null then
    raise exception 'An assignee requires a department' using errcode = '22023';
  end if;

  if p_department_id is not null and not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.municipality_id = v_report.municipality_id and d.is_active
  ) then
    raise exception 'Department not found' using errcode = '22023';
  end if;

  if p_assignee_id is not null and not exists (
    select 1 from public.employees e
    where e.id = p_assignee_id
      and e.municipality_id = v_report.municipality_id
      and e.department_id = p_department_id
      and e.is_active
      and e.role in ('employee', 'department_manager')
  ) then
    raise exception 'The assignee must be an active member of that department' using errcode = '22023';
  end if;

  v_new_status := case
    when p_department_id is not null and v_report.status in ('submitted', 'under_review') then 'assigned'
    when p_department_id is null and v_report.status = 'assigned' then 'under_review'
    else v_report.status
  end;

  update public.reports r set
    department_id = p_department_id,
    assignee_id = p_assignee_id,
    priority = coalesce(p_priority, r.priority),
    status = v_new_status,
    status_changed_at = case when v_new_status <> v_report.status then now() else r.status_changed_at end,
    first_response_at = coalesce(r.first_response_at, now())
  where r.id = p_report_id;

  if v_new_status <> v_report.status then
    insert into public.report_status_history (
      report_id, municipality_id, from_status, to_status, changed_by, changed_by_employee_id
    ) values (
      p_report_id, v_report.municipality_id, v_report.status, v_new_status, v_uid, v_actor.id
    );

    perform private.notify_report_followers(p_report_id, 'report_status_changed', jsonb_build_object(
      'report_id', p_report_id,
      'from_status', v_report.status,
      'to_status', v_new_status
    ));
  end if;

  perform private.write_audit(v_report.municipality_id, 'report.assigned', 'report', p_report_id,
    jsonb_build_object(
      'from_department_id', v_report.department_id, 'to_department_id', p_department_id,
      'from_assignee_id', v_report.assignee_id, 'to_assignee_id', p_assignee_id,
      'from_priority', v_report.priority, 'to_priority', coalesce(p_priority, v_report.priority)
    ));
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: comments. Staff may write internal or public comments on reports they can access;
-- the reporter may write public comments on their own open report.
-- -----------------------------------------------------------------------------
create function public.add_report_comment(
  p_report_id uuid,
  p_body text,
  p_is_internal boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_report public.reports;
  v_is_staff boolean;
  v_id uuid;
begin
  select * into v_report from public.reports r where r.id = p_report_id;
  if not found then
    perform private.deny_report_access();
  end if;

  v_is_staff := private.can_access_report(v_report.municipality_id, v_report.department_id, v_report.assignee_id);

  if not v_is_staff then
    if v_report.reporter_id is distinct from v_uid then
      perform private.deny_report_access();
    end if;
    if coalesce(p_is_internal, false) then
      raise exception 'Only municipal staff can write internal comments' using errcode = '42501';
    end if;
    if v_report.status in ('closed', 'rejected') then
      raise exception 'This report is closed' using errcode = '22023';
    end if;
  end if;

  insert into public.report_comments (
    report_id, municipality_id, author_id, author_employee_id, from_reporter, body, is_internal
  ) values (
    p_report_id, v_report.municipality_id, v_uid,
    case when v_is_staff then private.current_employee_id(v_report.municipality_id) end,
    not v_is_staff, btrim(p_body), coalesce(p_is_internal, false)
  )
  returning id into v_id;

  if v_is_staff and not coalesce(p_is_internal, false)
     and v_report.reporter_id is not null and v_report.reporter_id <> v_uid then
    insert into public.notifications (user_id, municipality_id, type, data)
    values (v_report.reporter_id, v_report.municipality_id, 'report_comment',
            jsonb_build_object('report_id', p_report_id, 'tracking_number', v_report.tracking_number));
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: reporter contact details — authorized handlers only, every access audited.
-- -----------------------------------------------------------------------------
create function public.get_report_reporter_contact(p_report_id uuid)
returns table (full_name text, phone text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_report public.reports;
begin
  select * into v_report from public.reports r where r.id = p_report_id;
  if not found
     or not private.can_handle_report(v_report.municipality_id, v_report.department_id, v_report.assignee_id) then
    perform private.deny_report_access();
  end if;

  perform private.write_audit(v_report.municipality_id, 'report.reporter_contact_viewed', 'report',
    p_report_id);

  return query
    select p.full_name, c.phone
    from public.profiles p
    left join public.profile_contacts c on c.user_id = p.id
    where p.id = v_report.reporter_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Citizen reads: own reports (exact data, no internal fields).
-- -----------------------------------------------------------------------------
create function public.get_my_reports()
returns table (
  id uuid,
  tracking_number text,
  municipality_id uuid,
  category_code text,
  status public.report_status,
  visibility public.report_visibility,
  description text,
  address text,
  latitude double precision,
  longitude double precision,
  rejection_reason public.report_rejection_reason,
  confirmation_count integer,
  created_at timestamptz,
  status_changed_at timestamptz,
  resolved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.tracking_number, r.municipality_id, c.code, r.status, r.visibility,
         r.description, r.address,
         extensions.st_y(r.location::extensions.geometry),
         extensions.st_x(r.location::extensions.geometry),
         r.rejection_reason, r.confirmation_count, r.created_at, r.status_changed_at, r.resolved_at
  from public.reports r
  join public.report_categories c on c.id = r.category_id
  where r.reporter_id = (select auth.uid())
  order by r.created_at desc;
$$;

-- Status timeline of an own report. Internal notes and staff identities are never returned.
create function public.get_my_report_updates(p_report_id uuid)
returns table (
  to_status public.report_status,
  note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.to_status, case when h.note_is_public then h.note end, h.created_at
  from public.report_status_history h
  join public.reports r on r.id = h.report_id
  where h.report_id = p_report_id and r.reporter_id = (select auth.uid())
  order by h.created_at;
$$;

create function public.get_my_report_comments(p_report_id uuid)
returns table (
  id uuid,
  body text,
  is_mine boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select cm.id, cm.body, cm.author_id = (select auth.uid()), cm.created_at
  from public.report_comments cm
  join public.reports r on r.id = cm.report_id
  where cm.report_id = p_report_id
    and not cm.is_internal
    and r.reporter_id = (select auth.uid())
  order by cm.created_at;
$$;

create function public.get_my_report_attachments(p_report_id uuid)
returns table (
  id uuid,
  kind public.attachment_kind,
  storage_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.kind, a.storage_path, a.created_at
  from public.report_attachments a
  join public.reports r on r.id = a.report_id
  where a.report_id = p_report_id and r.reporter_id = (select auth.uid())
  order by a.created_at;
$$;

-- -----------------------------------------------------------------------------
-- Public reports: the ONLY way to see other people's reports.
-- Returns category, status, ~50 m location, date and confirmation count. Never the
-- reporter, contact details, description, address, exact location, priority, department,
-- assignee or photos. Filtering uses the rounded location too, so a shrinking bounding
-- box cannot be used to recover the exact position.
-- -----------------------------------------------------------------------------
create function public.get_public_reports(
  p_municipality_id uuid,
  p_south double precision,
  p_west double precision,
  p_north double precision,
  p_east double precision,
  p_limit integer default 200
)
returns table (
  id uuid,
  municipality_id uuid,
  category_code text,
  status public.report_status,
  latitude double precision,
  longitude double precision,
  reported_on date,
  confirmation_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_south is null or p_west is null or p_north is null or p_east is null
     or p_north <= p_south or p_east <= p_west
     or p_north - p_south > 0.5 or p_east - p_west > 0.5 then
    raise exception 'Invalid or too large map area' using errcode = '22023';
  end if;

  return query
    select r.id, r.municipality_id, c.code, r.status,
           extensions.st_y(r.public_location::extensions.geometry),
           extensions.st_x(r.public_location::extensions.geometry),
           (r.created_at at time zone 'UTC')::date,
           r.confirmation_count
    from public.reports r
    join public.report_categories c on c.id = r.category_id
    join public.municipalities m on m.id = r.municipality_id and m.status = 'active'
    where r.municipality_id = p_municipality_id
      and r.visibility = 'public'
      and r.duplicate_of_id is null
      and r.status <> 'rejected'
      and (r.status not in ('resolved', 'closed') or r.status_changed_at > now() - interval '30 days')
      and r.public_location operator(extensions.&&)
          extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::extensions.geography
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;

-- -----------------------------------------------------------------------------
-- Confirm ("I see this too") and follow.
-- -----------------------------------------------------------------------------
create function private.is_public_open_report(p_report public.reports)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_report.visibility = 'public'
    and p_report.duplicate_of_id is null
    and p_report.status in ('submitted', 'under_review', 'assigned', 'in_progress');
$$;

create function public.confirm_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_report public.reports;
  v_inserted integer;
begin
  select * into v_report from public.reports r where r.id = p_report_id for update;
  if not found or not private.is_public_open_report(v_report) then
    perform private.deny_report_access();
  end if;
  if v_report.reporter_id = v_uid then
    raise exception 'You cannot confirm your own report' using errcode = '22023';
  end if;

  insert into public.report_confirmations (report_id, user_id, municipality_id)
  values (p_report_id, v_uid, v_report.municipality_id)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.reports r set confirmation_count = r.confirmation_count + 1 where r.id = p_report_id;
  end if;
end;
$$;

create function public.unconfirm_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_deleted integer;
begin
  perform 1 from public.reports r where r.id = p_report_id for update;
  delete from public.report_confirmations c where c.report_id = p_report_id and c.user_id = v_uid;
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    update public.reports r set confirmation_count = greatest(r.confirmation_count - 1, 0)
    where r.id = p_report_id;
  end if;
end;
$$;

create function public.follow_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_report public.reports;
  v_inserted integer;
begin
  select * into v_report from public.reports r where r.id = p_report_id for update;
  if not found or not (private.is_public_open_report(v_report) or v_report.reporter_id = v_uid) then
    perform private.deny_report_access();
  end if;

  insert into public.report_followers (report_id, user_id, municipality_id)
  values (p_report_id, v_uid, v_report.municipality_id)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.reports r set follower_count = r.follower_count + 1 where r.id = p_report_id;
  end if;
end;
$$;

create function public.unfollow_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_deleted integer;
begin
  perform 1 from public.reports r where r.id = p_report_id for update;
  delete from public.report_followers f where f.report_id = p_report_id and f.user_id = v_uid;
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    update public.reports r set follower_count = greatest(r.follower_count - 1, 0)
    where r.id = p_report_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Staff role / department changes (municipality admins only).
--
-- When an employee leaves a department (transfer, or a role that cannot hold
-- assignments), their open reports are handed over in the same transaction:
--   * to p_reassign_to (an active employee/manager of the *previous* department), or
--   * back to the previous department's queue (assignee cleared), visible to its manager.
-- Access to the previous department's reports ends immediately because
-- can_access_report() only grants employees/managers their current department.
-- -----------------------------------------------------------------------------
create function public.set_employee_role(
  p_employee_id uuid,
  p_role public.staff_role,
  p_department_id uuid,
  p_reassign_to uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_employee public.employees;
  v_leaves_department boolean;
  v_report record;
  v_moved integer := 0;
begin
  select * into v_employee from public.employees e where e.id = p_employee_id for update;
  if not found or not private.has_staff_role(v_employee.municipality_id, '{municipality_admin}') then
    raise exception 'Employee not found or access denied' using errcode = '42501';
  end if;

  if v_employee.user_id = v_uid then
    raise exception 'You cannot change your own role or department' using errcode = '42501';
  end if;

  if p_role in ('employee', 'department_manager') and p_department_id is null then
    raise exception 'This role requires a department' using errcode = '22023';
  end if;

  if p_department_id is not null and not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.municipality_id = v_employee.municipality_id and d.is_active
  ) then
    raise exception 'Department not found' using errcode = '22023';
  end if;

  if v_employee.role = 'municipality_admin' and v_employee.is_active
     and p_role <> 'municipality_admin'
     and not exists (
       select 1 from public.employees e
       where e.municipality_id = v_employee.municipality_id and e.role = 'municipality_admin'
         and e.is_active and e.id <> v_employee.id
     ) then
    raise exception 'A municipality must keep at least one active admin' using errcode = '42501';
  end if;

  v_leaves_department := v_employee.department_id is not null and (
    p_department_id is distinct from v_employee.department_id
    or p_role not in ('employee', 'department_manager')
  );

  if p_reassign_to is not null then
    if not v_leaves_department then
      raise exception 'Reassignment only applies when the employee leaves their department'
        using errcode = '22023';
    end if;
    if p_reassign_to = p_employee_id or not exists (
      select 1 from public.employees e
      where e.id = p_reassign_to
        and e.municipality_id = v_employee.municipality_id
        and e.department_id = v_employee.department_id
        and e.is_active
        and e.role in ('employee', 'department_manager')
    ) then
      raise exception 'Open reports can only be handed to an active member of the previous department'
        using errcode = '22023';
    end if;
  end if;

  if v_leaves_department then
    for v_report in
      select r.id from public.reports r
      where r.assignee_id = p_employee_id
        and r.status in ('submitted', 'under_review', 'assigned', 'in_progress')
      for update
    loop
      update public.reports r set assignee_id = p_reassign_to where r.id = v_report.id;
      perform private.write_audit(v_employee.municipality_id, 'report.reassigned', 'report', v_report.id,
        jsonb_build_object('reason', 'employee_transfer', 'from_assignee_id', p_employee_id,
                           'to_assignee_id', p_reassign_to));
      v_moved := v_moved + 1;
    end loop;
  end if;

  update public.employees e set role = p_role, department_id = p_department_id
  where e.id = p_employee_id;

  return v_moved;
end;
$$;

-- Deactivating an employee hands their open reports back to the department queue.
create function private.release_assignments_on_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report record;
begin
  for v_report in
    select r.id from public.reports r
    where r.assignee_id = new.id
      and r.status in ('submitted', 'under_review', 'assigned', 'in_progress')
    for update
  loop
    update public.reports r set assignee_id = null where r.id = v_report.id;
    perform private.write_audit(new.municipality_id, 'report.reassigned', 'report', v_report.id,
      jsonb_build_object('reason', 'employee_deactivated', 'from_assignee_id', new.id));
  end loop;
  return new;
end;
$$;

revoke execute on function private.release_assignments_on_deactivation() from public;

create trigger release_assignments_on_deactivation
  after update of is_active on public.employees
  for each row when (old.is_active and not new.is_active)
  execute function private.release_assignments_on_deactivation();

-- -----------------------------------------------------------------------------
-- Function privileges: authenticated users only. Never anon.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.submit_report(uuid, text, text, double precision, double precision, real, text, public.report_visibility),
  public.add_report_attachment(uuid, text, public.attachment_kind),
  public.update_report_status(uuid, public.report_status, text, boolean, public.report_rejection_reason, uuid),
  public.assign_report(uuid, uuid, uuid, public.report_priority),
  public.add_report_comment(uuid, text, boolean),
  public.get_report_reporter_contact(uuid),
  public.get_my_reports(),
  public.get_my_report_updates(uuid),
  public.get_my_report_comments(uuid),
  public.get_my_report_attachments(uuid),
  public.get_public_reports(uuid, double precision, double precision, double precision, double precision, integer),
  public.confirm_report(uuid),
  public.unconfirm_report(uuid),
  public.follow_report(uuid),
  public.unfollow_report(uuid),
  public.set_employee_role(uuid, public.staff_role, uuid, uuid)
from public, anon;

grant execute on function
  public.submit_report(uuid, text, text, double precision, double precision, real, text, public.report_visibility),
  public.add_report_attachment(uuid, text, public.attachment_kind),
  public.update_report_status(uuid, public.report_status, text, boolean, public.report_rejection_reason, uuid),
  public.assign_report(uuid, uuid, uuid, public.report_priority),
  public.add_report_comment(uuid, text, boolean),
  public.get_report_reporter_contact(uuid),
  public.get_my_reports(),
  public.get_my_report_updates(uuid),
  public.get_my_report_comments(uuid),
  public.get_my_report_attachments(uuid),
  public.get_public_reports(uuid, double precision, double precision, double precision, double precision, integer),
  public.confirm_report(uuid),
  public.unconfirm_report(uuid),
  public.follow_report(uuid),
  public.unfollow_report(uuid),
  public.set_employee_role(uuid, public.staff_role, uuid, uuid)
to authenticated;
