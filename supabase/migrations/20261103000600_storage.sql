-- =============================================================================
-- Storage buckets and policies.
--
-- report-media (PRIVATE): {municipality_id}/{report_id}/{uuid}.{ext}
--   upload: the reporter while the report is `submitted`; handling staff (completion photos)
--   read:   the reporter, or staff who can access the report — via signed URLs
--   update/delete: nobody through the API (photos are evidence)
-- public-content (PUBLIC read): {municipality_id}/... images for published content.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('report-media', 'report-media', false, 10485760,
   array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('public-content', 'public-content', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Parses a report-media object path. Returns null for anything malformed, so policies
-- never throw on hostile input (e.g. a non-uuid folder name).
create function private.report_media_target(p_object_name text)
returns table (municipality_id uuid, report_id uuid)
language sql
immutable
set search_path = ''
as $$
  select parts[1]::uuid, parts[2]::uuid
  from (select string_to_array(p_object_name, '/') as parts) s
  where array_length(parts, 1) = 3
    and parts[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and parts[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and parts[3] ~ '^[0-9a-f-]{36}\.(jpg|jpeg|png|heic|webp)$';
$$;

create function private.can_upload_report_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      (
        r.reporter_id = (select auth.uid())
        and r.status = 'submitted'
        and (
          select count(*) from public.report_attachments a
          where a.report_id = r.id and a.kind = 'citizen_photo'
        ) < 5
      )
      or (
        private.can_handle_report(r.municipality_id, r.department_id, r.assignee_id)
        and r.status in ('in_progress', 'resolved')
      )
    from private.report_media_target(p_object_name) t
    join public.reports r on r.id = t.report_id and r.municipality_id = t.municipality_id
  ), false);
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

-- Staff may manage public-content files under their municipality's prefix.
create function private.can_manage_public_content(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.is_staff(s.parts[1]::uuid)
    from (select string_to_array(p_object_name, '/') as parts) s
    where s.parts[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and array_length(s.parts, 1) >= 2
  ), false);
$$;

create policy "Report media: reporters and handlers upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'report-media' and private.can_upload_report_media(name));

create policy "Report media: reporters and authorized staff read"
  on storage.objects for select to authenticated
  using (bucket_id = 'report-media' and private.can_read_report_media(name));

create policy "Public content: staff upload under their municipality"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'public-content' and private.can_manage_public_content(name));

create policy "Public content: staff list their municipality"
  on storage.objects for select to authenticated
  using (bucket_id = 'public-content' and private.can_manage_public_content(name));

create policy "Public content: staff delete their municipality files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'public-content' and private.can_manage_public_content(name));
