-- =============================================================================
-- DEVELOPMENT SEED — SYNTHETIC DATA ONLY.
--
-- Two fictional municipalities for the hosted development project (D-007). Nothing here
-- describes a real municipality, person or report. No users are seeded: create test
-- accounts through Supabase Auth and add staff memberships explicitly.
-- Never run against a production database.
-- =============================================================================

insert into public.municipalities (id, code, name, status, contact_email, boundary)
values
  (
    'd0000000-0000-4000-8000-000000000001',
    'DMN',
    '{"he": "עיר הדגמה צפון", "ar": "مدينة تجريبية الشمال", "en": "Demo City North"}',
    'active',
    'demo-north@example.invalid',
    'SRID=4326;MULTIPOLYGON(((34.80 30.60,34.90 30.60,34.90 30.70,34.80 30.70,34.80 30.60)))'
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    'DMS',
    '{"he": "עיר הדגמה דרום", "ar": "مدينة تجريبية الجنوب", "en": "Demo City South"}',
    'active',
    'demo-south@example.invalid',
    'SRID=4326;MULTIPOLYGON(((34.80 30.40,34.90 30.40,34.90 30.50,34.80 30.50,34.80 30.40)))'
  )
on conflict (id) do nothing;

insert into public.neighborhoods (id, municipality_id, name, boundary)
values
  ('d0000000-0000-4000-8000-000000000101', 'd0000000-0000-4000-8000-000000000001',
   '{"he": "שכונת הדגמה א", "ar": "حي تجريبي أ", "en": "Demo Quarter A"}',
   'SRID=4326;MULTIPOLYGON(((34.80 30.60,34.85 30.60,34.85 30.70,34.80 30.70,34.80 30.60)))'),
  ('d0000000-0000-4000-8000-000000000102', 'd0000000-0000-4000-8000-000000000001',
   '{"he": "שכונת הדגמה ב", "ar": "حي تجريبي ب", "en": "Demo Quarter B"}',
   'SRID=4326;MULTIPOLYGON(((34.85 30.60,34.90 30.60,34.90 30.70,34.85 30.70,34.85 30.60)))')
on conflict (id) do nothing;

insert into public.departments (id, municipality_id, name, email)
values
  ('d0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000001',
   '{"he": "אגף תשתיות (הדגמה)", "ar": "قسم البنية التحتية (تجريبي)", "en": "Infrastructure (demo)"}',
   'infra@example.invalid'),
  ('d0000000-0000-4000-8000-000000000202', 'd0000000-0000-4000-8000-000000000001',
   '{"he": "אגף תברואה (הדגמה)", "ar": "قسم النظافة (تجريبي)", "en": "Sanitation (demo)"}',
   'sanitation@example.invalid'),
  ('d0000000-0000-4000-8000-000000000203', 'd0000000-0000-4000-8000-000000000002',
   '{"he": "מוקד עירוני (הדגמה)", "ar": "المركز البلدي (تجريبي)", "en": "Municipal hotline (demo)"}',
   'hotline@example.invalid')
on conflict (id) do nothing;

-- Enable every category; route infrastructure vs. sanitation in Demo City North.
insert into public.municipality_report_categories (municipality_id, category_id, default_department_id)
select
  'd0000000-0000-4000-8000-000000000001'::uuid,
  c.id,
  case
    when c.code in ('pothole', 'road', 'sidewalk', 'streetlight', 'water_leak', 'public_infrastructure')
      then 'd0000000-0000-4000-8000-000000000201'::uuid
    when c.code in ('garbage', 'noise') then 'd0000000-0000-4000-8000-000000000202'::uuid
  end
from public.report_categories c
union all
select 'd0000000-0000-4000-8000-000000000002'::uuid, c.id, 'd0000000-0000-4000-8000-000000000203'::uuid
from public.report_categories c
on conflict (municipality_id, category_id) do nothing;
