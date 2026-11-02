-- =============================================================================
-- Storage buckets and policies.
--
-- report-media (PRIVATE, 10 MB, images)
--   {municipality_id}/{report_id}/citizen/{uuid}.{ext}      reporter, while `submitted`
--   {municipality_id}/{report_id}/completion/{uuid}.{ext}   handling staff, in progress/resolved
--   * max 5 stored objects per report and kind — counted in storage itself, serialized per
--     report with an advisory lock so concurrent uploads cannot exceed the limit
--   * read: the reporter and staff who can access the report (signed URLs); never public
--   * update/delete: nobody through the API (photos are evidence)
--
-- content-drafts (PRIVATE, 5 MB, images)
--   {municipality_id}/announcements/{announcement_id}/{uuid}.{ext}
--   * write/delete: whoever may edit the announcement; read: staff of the municipality
--
-- public-content (PUBLIC read, 5 MB, images)
--   * the controlled publishing step: only a publisher of that announcement, only after it
--     is published, and only at exactly its `image_path` (copied from content-drafts)
--   * delete: publishers of that announcement only
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('report-media', 'report-media', false, 10485760,
   array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('content-drafts', 'content-drafts', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('public-content', 'public-content', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Path parsing. Returns no row for anything malformed, so policies never throw on
-- hostile input (e.g. a non-uuid folder name).
-- -----------------------------------------------------------------------------
create function private.report_media_target(p_object_name text)
returns table (municipality_id uuid, report_id uuid, kind text)
language sql
immutable
set search_path = ''
as $$
  select parts[1]::uuid, parts[2]::uuid, parts[3]
  from (select string_to_array(p_object_name, '/') as parts) s
  where array_length(parts, 1) = 4
    and parts[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and parts[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and parts[3] in ('citizen', 'completion')
    and parts[4] ~ '^[0-9a-f-]{36}\.(jpg|jpeg|png|heic|webp)$';
$$;

create function private.content_media_target(p_object_name text)
returns table (municipality_id uuid, announcement_id uuid)
language sql
immutable
set search_path = ''
as $$
  select parts[1]::uuid, parts[3]::uuid
  from (select string_to_array(p_object_name, '/') as parts) s
  where array_length(parts, 1) = 4
    and parts[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and parts[2] = 'announcements'
    and parts[3] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and parts[4] ~ '^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$';
$$;

-- -----------------------------------------------------------------------------
-- report-media
-- -----------------------------------------------------------------------------

-- VOLATILE on purpose: it takes a transaction-scoped advisory lock per (report, kind)
-- before counting, so two concurrent uploads are serialized and the second one sees the
-- first (each statement in a volatile function gets a fresh snapshot).
create function private.can_upload_report_media(p_object_name text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_report public.reports;
  v_count integer;
begin
  select * into v_target from private.report_media_target(p_object_name);
  if not found then
    return false;
  end if;

  select * into v_report
  from public.reports r
  where r.id = v_target.report_id and r.municipality_id = v_target.municipality_id;
  if not found then
    return false;
  end if;

  if v_target.kind = 'citizen' then
    if v_report.reporter_id is distinct from (select auth.uid()) or v_report.status <> 'submitted' then
      return false;
    end if;
  else
    if not private.can_handle_report(v_report.municipality_id, v_report.department_id, v_report.assignee_id)
       or v_report.status not in ('in_progress', 'resolved') then
      return false;
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('report-media:' || v_report.id::text || ':' || v_target.kind, 0)
  );

  select count(*) into v_count
  from storage.objects o
  where o.bucket_id = 'report-media'
    and o.name like v_report.municipality_id::text || '/' || v_report.id::text || '/'
                    || v_target.kind || '/%';

  return v_count < 5;
end;
$$;

create function private.can_read_report_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select r.reporter_id = (select auth.uid())
        or private.can_access_report(r.municipality_id, r.department_id, r.assignee_id)
    from private.report_media_target(p_object_name) t
    join public.reports r on r.id = t.report_id and r.municipality_id = t.municipality_id
  ), false);
$$;

create policy "Report media: reporters and handlers upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'report-media' and private.can_upload_report_media(name));

create policy "Report media: reporters and authorized staff read"
  on storage.objects for select to authenticated
  using (bucket_id = 'report-media' and private.can_read_report_media(name));

-- -----------------------------------------------------------------------------
-- content-drafts / public-content
-- -----------------------------------------------------------------------------

-- May the caller edit this announcement (and therefore its draft images)?
create function private.can_edit_announcement_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (
        a.status = 'draft'
        and a.created_by = (select auth.uid())
        and private.can_draft_content(a.municipality_id, a.department_id)
      )
      or private.can_publish_content(a.municipality_id, a.department_id)
    from private.content_media_target(p_object_name) t
    join public.announcements a on a.id = t.announcement_id and a.municipality_id = t.municipality_id
    where a.status <> 'archived'
  ), false);
$$;

create function private.can_read_draft_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.is_staff(t.municipality_id)
    from private.content_media_target(p_object_name) t
  ), false);
$$;

-- The controlled publishing step: exactly the published announcement's image, by a publisher.
create function private.can_publish_announcement_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select a.status = 'published'
      and a.image_path = p_object_name
      and private.can_publish_content(a.municipality_id, a.department_id)
    from private.content_media_target(p_object_name) t
    join public.announcements a on a.id = t.announcement_id and a.municipality_id = t.municipality_id
  ), false);
$$;

create function private.can_delete_public_announcement_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.can_publish_content(a.municipality_id, a.department_id)
    from private.content_media_target(p_object_name) t
    join public.announcements a on a.id = t.announcement_id and a.municipality_id = t.municipality_id
  ), false);
$$;

create policy "Content drafts: editors upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'content-drafts' and private.can_edit_announcement_media(name));

create policy "Content drafts: municipality staff read"
  on storage.objects for select to authenticated
  using (bucket_id = 'content-drafts' and private.can_read_draft_media(name));

create policy "Content drafts: editors delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'content-drafts' and private.can_edit_announcement_media(name));

create policy "Public content: publishers publish images of published announcements"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'public-content' and private.can_publish_announcement_media(name));

-- Listing through the API (public URLs work without it, as the bucket is public).
create policy "Public content: publishers list"
  on storage.objects for select to authenticated
  using (bucket_id = 'public-content' and private.can_delete_public_announcement_media(name));

create policy "Public content: publishers delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'public-content' and private.can_delete_public_announcement_media(name));

-- -----------------------------------------------------------------------------
-- Private schema hardening: remove PUBLIC's default EXECUTE from every private function
-- (see foundation migration). Every later migration that adds a private function must
-- repeat this; schema-guards.test.ts enforces it.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema private from public;

-- Called by the storage policies above (as the querying role).
grant execute on function
  private.can_upload_report_media(text),
  private.can_read_report_media(text),
  private.can_edit_announcement_media(text),
  private.can_read_draft_media(text),
  private.can_publish_announcement_media(text),
  private.can_delete_public_announcement_media(text)
to authenticated;
