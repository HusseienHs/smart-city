-- =============================================================================
-- Municipal content: announcements (the template for events, closures etc. in Phase 3).
--
-- Publishing rules:
--   * Any active staff member can create drafts (non-admins only for their own department).
--   * municipality_admin can publish all content of their municipality.
--   * department_manager can publish content belonging to their department.
--   * Status changes happen only through publish/archive RPCs, which are audited.
-- =============================================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities (id),
  department_id uuid,
  neighborhood_id uuid,
  title jsonb not null check (private.is_localized_text(title)),
  body jsonb not null check (private.is_localized_text(body)),
  severity public.announcement_severity not null default 'info',
  status public.content_status not null default 'draft',
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (department_id, municipality_id) references public.departments (id, municipality_id),
  foreign key (neighborhood_id, municipality_id) references public.neighborhoods (id, municipality_id),
  check ((status = 'draft') = (published_at is null))
);

create index announcements_municipality_status_idx
  on public.announcements (municipality_id, status, published_at desc);
create trigger set_updated_at before update on public.announcements
  for each row execute function private.set_updated_at();

-- Can the caller publish content of this department (null = municipality-wide)?
create function private.can_publish_content(p_municipality_id uuid, p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select e.role = 'municipality_admin'
        or (e.role = 'department_manager' and p_department_id is not null
            and p_department_id = e.department_id)
    from public.employees e
    where e.user_id = (select auth.uid())
      and e.municipality_id = p_municipality_id
      and e.is_active
  ), false);
$$;

-- Can the caller draft content for this department?
create function private.can_draft_content(p_municipality_id uuid, p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select e.role = 'municipality_admin'
        or (p_department_id is not null and p_department_id = e.department_id)
    from public.employees e
    where e.user_id = (select auth.uid())
      and e.municipality_id = p_municipality_id
      and e.is_active
  ), false);
$$;

-- Defaults on insert: creator is the caller; drafts only.
create function private.prepare_announcement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  new.status := 'draft';
  new.published_at := null;
  new.published_by := null;
  return new;
end;
$$;

create trigger prepare_announcement before insert on public.announcements
  for each row execute function private.prepare_announcement();

-- Edits to already-published content are audited.
create function private.audit_published_announcement_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'published' and new.status = 'published' then
    perform private.write_audit(new.municipality_id, 'announcement.edited', 'announcement', new.id,
      jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  end if;
  return new;
end;
$$;

revoke execute on function private.audit_published_announcement_edit() from public;

create trigger audit_published_announcement_edit after update on public.announcements
  for each row execute function private.audit_published_announcement_edit();

alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;

grant select on public.announcements to anon, authenticated;
grant insert (municipality_id, department_id, neighborhood_id, title, body, severity, expires_at)
  on public.announcements to authenticated;
grant update (neighborhood_id, title, body, severity, expires_at) on public.announcements to authenticated;
grant delete on public.announcements to authenticated;

create policy "Anyone can read published announcements of active municipalities"
  on public.announcements for select to anon, authenticated
  using (
    status = 'published'
    and (expires_at is null or expires_at > now())
    and exists (
      select 1 from public.municipalities m
      where m.id = municipality_id and m.status = 'active'
    )
  );

create policy "Staff read all announcements of their municipality"
  on public.announcements for select to authenticated
  using (municipality_id in (select private.staff_municipality_ids()));

create policy "Staff create drafts for their department"
  on public.announcements for insert to authenticated
  with check (
    status = 'draft'
    and (select private.can_draft_content(municipality_id, department_id))
  );

create policy "Authors edit their drafts; publishers edit their content"
  on public.announcements for update to authenticated
  using (
    (status = 'draft' and created_by = (select auth.uid())
      and (select private.can_draft_content(municipality_id, department_id)))
    or (select private.can_publish_content(municipality_id, department_id))
  )
  with check (
    (status = 'draft' and created_by = (select auth.uid())
      and (select private.can_draft_content(municipality_id, department_id)))
    or (select private.can_publish_content(municipality_id, department_id))
  );

create policy "Authors and publishers delete drafts"
  on public.announcements for delete to authenticated
  using (
    status = 'draft'
    and (
      (created_by = (select auth.uid())
        and (select private.can_draft_content(municipality_id, department_id)))
      or (select private.can_publish_content(municipality_id, department_id))
    )
  );

-- Publish / archive: the only way to change an announcement's status.
create function public.set_announcement_status(p_announcement_id uuid, p_status public.content_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_item public.announcements;
begin
  select * into v_item from public.announcements a where a.id = p_announcement_id for update;
  if not found or not private.can_publish_content(v_item.municipality_id, v_item.department_id) then
    raise exception 'Announcement not found or you are not allowed to publish it'
      using errcode = '42501';
  end if;

  if p_status = 'draft' then
    raise exception 'Published content cannot return to draft; archive it instead'
      using errcode = '22023';
  end if;

  if v_item.status = p_status then
    return;
  end if;

  update public.announcements a set
    status = p_status,
    published_at = coalesce(a.published_at, now()),
    published_by = case when p_status = 'published' then v_uid else a.published_by end
  where a.id = p_announcement_id;

  perform private.write_audit(v_item.municipality_id, 'announcement.' || p_status::text,
    'announcement', p_announcement_id,
    jsonb_build_object('from', v_item.status, 'to', p_status, 'department_id', v_item.department_id));
end;
$$;

revoke execute on function public.set_announcement_status(uuid, public.content_status) from public, anon;
grant execute on function public.set_announcement_status(uuid, public.content_status) to authenticated;
