-- =============================================================================
-- DEVELOPMENT SEED — the hosted development project only (D-007). Never run against a
-- production database.
--
-- The cities themselves come from migration 20261108000100_israeli_cities (as 'onboarding').
-- For development, every listed city accepts reports with every category enabled, so a citizen
-- can report to the city they chose at sign-up. In production a city is activated only when it
-- joins the platform.
--
-- No people, staff or reports are seeded: create test accounts through the app.
-- Idempotent: safe to run again.
-- =============================================================================

-- The fictional demo cities of earlier seeds are retired: hidden from everyone, and no longer
-- anyone's home city.
update public.profiles
set home_municipality_id = null, home_neighborhood_id = null
where home_municipality_id in (
  select id from public.municipalities where code in ('DMN', 'DMS') and cbs_code is null
);

update public.municipalities
set status = 'suspended'
where code in ('DMN', 'DMS') and cbs_code is null;

-- Every listed city accepts reports.
update public.municipalities
set status = 'active'
where cbs_code is not null and status = 'onboarding';

-- Every category, in every city. No default department: reports wait in the city's intake queue.
insert into public.municipality_report_categories (municipality_id, category_id)
select m.id, c.id
from public.municipalities m
cross join public.report_categories c
where m.cbs_code is not null
on conflict (municipality_id, category_id) do nothing;
