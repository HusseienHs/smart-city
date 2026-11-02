-- =============================================================================
-- Foundation: extensions, schemas, enums and generic helpers.
--
-- Security conventions used by every migration in this project:
--   * Every table in `public` has RLS enabled in the migration that creates it.
--   * Supabase grants ALL on new `public` tables and EXECUTE on new `public` functions
--     to `anon` and `authenticated` by default. Every migration therefore revokes those
--     grants and re-grants only what is needed (column-level where it matters).
--   * SECURITY DEFINER functions always `set search_path = ''` and schema-qualify every
--     reference, so they cannot be hijacked through objects in other schemas.
--   * Internal helpers live in the `private` schema, which is not exposed by the Data API.
-- =============================================================================

create extension if not exists postgis with schema extensions;

-- -----------------------------------------------------------------------------
-- private schema: RLS helpers and internal functions. Not exposed through PostgREST.
-- `authenticated` needs USAGE because RLS policies call these helpers as the querying role.
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Functions are executable by PUBLIC by default in Postgres. Helpers that must not be
-- callable directly revoke this individually.

-- -----------------------------------------------------------------------------
-- Enums. Values mirror packages/shared (a test fails if they drift).
-- -----------------------------------------------------------------------------
create type public.app_locale as enum ('he', 'ar', 'en');

create type public.municipality_status as enum ('onboarding', 'active', 'suspended');

create type public.staff_role as enum (
  'employee',
  'intake_dispatcher',
  'department_manager',
  'municipality_admin'
);

create type public.report_status as enum (
  'submitted',
  'under_review',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
  'rejected'
);

create type public.report_priority as enum ('low', 'normal', 'high', 'urgent');

create type public.report_visibility as enum ('public', 'private');

create type public.report_rejection_reason as enum (
  'duplicate',
  'not_municipal_responsibility',
  'insufficient_information',
  'not_found_on_site',
  'spam_or_abuse',
  'other'
);

create type public.attachment_kind as enum ('citizen_photo', 'completion_photo');

create type public.notification_type as enum ('report_status_changed', 'report_comment', 'system');

create type public.content_status as enum ('draft', 'published', 'archived');

create type public.announcement_severity as enum ('info', 'important', 'emergency');

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------

-- Keeps updated_at current. Attached to every table that has the column.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Localized text: {"he": "...", "ar": "...", "en": "..."}; Hebrew is mandatory.
create function private.is_localized_text(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is not null
    and jsonb_typeof(value) = 'object'
    and coalesce(length(btrim(value ->> 'he')), 0) > 0
    and not exists (
      select 1 from jsonb_object_keys(value) as k where k not in ('he', 'ar', 'en')
    )
    and not exists (
      select 1 from jsonb_each(value) as e where jsonb_typeof(e.value) <> 'string'
    );
$$;

-- Snaps a point to a ~50 m grid. Used for every location shown publicly, so the exact
-- position of a report is never derivable from public data. Grid snapping (rather than
-- random jitter) is deliberate: jitter can be averaged away over repeated queries,
-- a fixed grid cannot.
create function private.round_location(p extensions.geography)
returns extensions.geography
language sql
immutable
parallel safe
set search_path = ''
as $$
  with c as (
    select
      extensions.st_y(p::extensions.geometry) as lat,
      extensions.st_x(p::extensions.geometry) as lng
  ),
  r as (
    -- 0.00045° of latitude ≈ 50 m. Longitude step widens with latitude to stay ≈ 50 m.
    select
      round(lat / 0.00045) * 0.00045 as lat_r,
      lng,
      0.00045 / cos(radians(least(abs(round(lat / 0.00045) * 0.00045), 89.0))) as lng_step
    from c
  )
  select extensions.st_setsrid(
    extensions.st_makepoint(round(lng / lng_step) * lng_step, lat_r),
    4326
  )::extensions.geography
  from r;
$$;
