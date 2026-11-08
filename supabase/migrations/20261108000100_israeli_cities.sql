-- =============================================================================
-- Israeli cities as municipalities; home city at sign-up.
-- Design: docs/israeli-cities-design.md (approved 2026-11-08).
--
-- 1. municipalities.cbs_code: the CBS locality code, the stable external key.
-- 2. The 82 localities with CBS municipal status "עירייה" (bycode2024.xlsx), as
--    'onboarding': choosable as a home city, not accepting reports until they join.
-- 3. Citizens (and anonymous visitors, for sign-up) can read onboarding municipalities.
-- 4. handle_new_user() also copies a validated home_municipality_id from sign-up metadata.
--
-- Public reference data, not personal data (D-012): it belongs in every environment.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CBS code
-- -----------------------------------------------------------------------------
alter table public.municipalities
  add column cbs_code integer unique check (cbs_code > 0);

-- No UPDATE grant: like `code`, only migrations and the service role can change it.

-- -----------------------------------------------------------------------------
-- 2. Cities (Hebrew from CBS; English in common spelling; Arabic in common use)
-- -----------------------------------------------------------------------------
insert into public.municipalities (cbs_code, code, name, status)
select v.cbs_code, v.code, v.name::jsonb, 'onboarding'
from (values
  (3000, 'JLM', '{"he": "ירושלים", "ar": "القدس", "en": "Jerusalem"}'),
  (5000, 'TLV', '{"he": "תל אביב-יפו", "ar": "تل أبيب - يافا", "en": "Tel Aviv-Yafo"}'),
  (4000, 'HFA', '{"he": "חיפה", "ar": "حيفا", "en": "Haifa"}'),
  (7900, 'PTK', '{"he": "פתח תקווה", "ar": "بيتح تكفا", "en": "Petah Tikva"}'),
  (8300, 'RLZ', '{"he": "ראשון לציון", "ar": "ريشون لتسيون", "en": "Rishon LeZion"}'),
  (7400, 'NTN', '{"he": "נתניה", "ar": "نتانيا", "en": "Netanya"}'),
  (6100, 'BBK', '{"he": "בני ברק", "ar": "بني براك", "en": "Bnei Brak"}'),
  (70, 'ASD', '{"he": "אשדוד", "ar": "أسدود", "en": "Ashdod"}'),
  (9000, 'BSV', '{"he": "באר שבע", "ar": "بئر السبع", "en": "Be''er Sheva"}'),
  (6600, 'HLN', '{"he": "חולון", "ar": "حولون", "en": "Holon"}'),
  (2610, 'BSM', '{"he": "בית שמש", "ar": "بيت شيمش", "en": "Beit Shemesh"}'),
  (8600, 'RGN', '{"he": "רמת גן", "ar": "رمات غان", "en": "Ramat Gan"}'),
  (7100, 'ASK', '{"he": "אשקלון", "ar": "عسقلان", "en": "Ashkelon"}'),
  (8400, 'RHV', '{"he": "רחובות", "ar": "رحوفوت", "en": "Rehovot"}'),
  (6200, 'BTY', '{"he": "בת ים", "ar": "بات يام", "en": "Bat Yam"}'),
  (6400, 'HRZ', '{"he": "הרצלייה", "ar": "هرتسليا", "en": "Herzliya"}'),
  (6500, 'HDR', '{"he": "חדרה", "ar": "الخضيرة", "en": "Hadera"}'),
  (1200, 'MOD', '{"he": "מודיעין-מכבים-רעות", "ar": "موديعين مكابيم رعوت", "en": "Modi''in-Maccabim-Re''ut"}'),
  (6900, 'KSV', '{"he": "כפר סבא", "ar": "كفار سابا", "en": "Kfar Saba"}'),
  (7000, 'LOD', '{"he": "לוד", "ar": "اللد", "en": "Lod"}'),
  (3797, 'MDI', '{"he": "מודיעין עילית", "ar": "موديعين عيليت", "en": "Modi''in Illit"}'),
  (8500, 'RML', '{"he": "רמלה", "ar": "الرملة", "en": "Ramla"}'),
  (8700, 'RAN', '{"he": "רעננה", "ar": "رعنانا", "en": "Ra''anana"}'),
  (2640, 'RHA', '{"he": "ראש העין", "ar": "روش هعاين", "en": "Rosh HaAyin"}'),
  (1161, 'RHT', '{"he": "רהט", "ar": "رهط", "en": "Rahat"}'),
  (7300, 'NAZ', '{"he": "נצרת", "ar": "الناصرة", "en": "Nazareth"}'),
  (2630, 'KGT', '{"he": "קריית גת", "ar": "كريات جات", "en": "Kiryat Gat"}'),
  (3780, 'BTI', '{"he": "ביתר עילית", "ar": "بيتار عيليت", "en": "Beitar Illit"}'),
  (9100, 'NHR', '{"he": "נהרייה", "ar": "نهاريا", "en": "Nahariya"}'),
  (9700, 'HSH', '{"he": "הוד השרון", "ar": "هود هشارون", "en": "Hod HaSharon"}'),
  (7700, 'AFL', '{"he": "עפולה", "ar": "العفولة", "en": "Afula"}'),
  (6800, 'KAT', '{"he": "קריית אתא", "ar": "كريات آتا", "en": "Kiryat Ata"}'),
  (2710, 'UMF', '{"he": "אום אל-פחם", "ar": "أم الفحم", "en": "Umm al-Fahm"}'),
  (6300, 'GVT', '{"he": "גבעתיים", "ar": "جفعتايم", "en": "Givatayim"}'),
  (2660, 'YVN', '{"he": "יבנה", "ar": "يفنه", "en": "Yavne"}'),
  (246, 'NTV', '{"he": "נתיבות", "ar": "نتيفوت", "en": "Netivot"}'),
  (2600, 'ELT', '{"he": "אילת", "ar": "إيلات", "en": "Eilat"}'),
  (7600, 'AKO', '{"he": "עכו", "ar": "عكا", "en": "Akko"}'),
  (6700, 'TVR', '{"he": "טבריה", "ar": "طبريا", "en": "Tiberias"}'),
  (8200, 'KMZ', '{"he": "קריית מוצקין", "ar": "كريات موتسكين", "en": "Kiryat Motzkin"}'),
  (1309, 'ELD', '{"he": "אלעד", "ar": "إلعاد", "en": "Elad"}'),
  (2650, 'RHS', '{"he": "רמת השרון", "ar": "رمات هشارون", "en": "Ramat HaSharon"}'),
  (1139, 'KRM', '{"he": "כרמיאל", "ar": "كرميئيل", "en": "Karmiel"}'),
  (7200, 'NSZ', '{"he": "נס ציונה", "ar": "نيس تسيونا", "en": "Ness Ziona"}'),
  (9500, 'KBL', '{"he": "קריית ביאליק", "ar": "كريات بياليك", "en": "Kiryat Bialik"}'),
  (2730, 'TYB', '{"he": "טייבה", "ar": "الطيبة", "en": "Tayibe"}'),
  (1061, 'NFG', '{"he": "נוף הגליל", "ar": "نوف هجليل", "en": "Nof HaGalil"}'),
  (2620, 'KON', '{"he": "קריית אונו", "ar": "كريات أونو", "en": "Kiryat Ono"}'),
  (8800, 'SHF', '{"he": "שפרעם", "ar": "شفاعمرو", "en": "Shefa-''Amr"}'),
  (9600, 'KYM', '{"he": "קריית ים", "ar": "كريات يام", "en": "Kiryat Yam"}'),
  (1247, 'HRS', '{"he": "חריש", "ar": "حريش", "en": "Harish"}'),
  (2400, 'ORY', '{"he": "אור יהודה", "ar": "أور يهودا", "en": "Or Yehuda"}'),
  (31, 'OFK', '{"he": "אופקים", "ar": "أوفاكيم", "en": "Ofakim"}'),
  (2200, 'DIM', '{"he": "דימונה", "ar": "ديمونا", "en": "Dimona"}'),
  (8000, 'SFD', '{"he": "צפת", "ar": "صفد", "en": "Safed"}'),
  (2530, 'BYK', '{"he": "באר יעקב", "ar": "بئر يعقوب", "en": "Be''er Ya''akov"}'),
  (1031, 'SDR', '{"he": "שדרות", "ar": "سديروت", "en": "Sderot"}'),
  (8900, 'TMR', '{"he": "טמרה", "ar": "طمرة", "en": "Tamra"}'),
  (3616, 'MAD', '{"he": "מעלה אדומים", "ar": "معاليه أدوميم", "en": "Ma''ale Adumim"}'),
  (7500, 'SKN', '{"he": "סח''נין", "ar": "سخنين", "en": "Sakhnin"}'),
  (2100, 'TKR', '{"he": "טירת כרמל", "ar": "طيرة الكرمل", "en": "Tirat Carmel"}'),
  (9400, 'YHD', '{"he": "יהוד-מונוסון", "ar": "يهود مونوسون", "en": "Yehud-Monosson"}'),
  (6000, 'BAQ', '{"he": "באקה אל-גרביה", "ar": "باقة الغربية", "en": "Baqa al-Gharbiyye"}'),
  (168, 'KYN', '{"he": "כפר יונה", "ar": "كفار يونا", "en": "Kfar Yona"}'),
  (2560, 'ARD', '{"he": "ערד", "ar": "عراد", "en": "Arad"}'),
  (681, 'GSM', '{"he": "גבעת שמואל", "ar": "جفعات شموئيل", "en": "Giv''at Shmuel"}'),
  (874, 'MGE', '{"he": "מגדל העמק", "ar": "مجدال هعيمق", "en": "Migdal HaEmek"}'),
  (634, 'KFQ', '{"he": "כפר קאסם", "ar": "كفر قاسم", "en": "Kafr Qasim"}'),
  (1034, 'KML', '{"he": "קריית מלאכי", "ar": "كريات ملاخي", "en": "Kiryat Malakhi"}'),
  (2720, 'TIR', '{"he": "טירה", "ar": "الطيرة", "en": "Tira"}'),
  (531, 'ARB', '{"he": "עראבה", "ar": "عرابة", "en": "Arraba"}'),
  (1020, 'ORA', '{"he": "אור עקיבא", "ar": "أور عكيفا", "en": "Or Akiva"}'),
  (229, 'GTK', '{"he": "גני תקווה", "ar": "جاني تكفا", "en": "Ganei Tikva"}'),
  (638, 'QLN', '{"he": "קלנסווה", "ar": "قلنسوة", "en": "Qalansawe"}'),
  (240, 'YKN', '{"he": "יקנעם עילית", "ar": "يوكنعام عيليت", "en": "Yokneam Illit"}'),
  (2800, 'KSH', '{"he": "קריית שמונה", "ar": "كريات شمونة", "en": "Kiryat Shmona"}'),
  (481, 'MGR', '{"he": "מגאר", "ar": "المغار", "en": "Maghar"}'),
  (1063, 'MLT', '{"he": "מעלות-תרשיחא", "ar": "معالوت ترشيحا", "en": "Ma''alot-Tarshiha"}'),
  (2500, 'NSR', '{"he": "נשר", "ar": "نيشر", "en": "Nesher"}'),
  (3570, 'ARL', '{"he": "אריאל", "ar": "أريئيل", "en": "Ariel"}'),
  (654, 'KQR', '{"he": "כפר קרע", "ar": "كفر قرع", "en": "Kafr Qara"}'),
  (9200, 'BSN', '{"he": "בית שאן", "ar": "بيسان", "en": "Beit She''an"}')
) as v (cbs_code, code, name)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 3. Read access: active and onboarding municipalities are public; suspended stay hidden.
--    Reports, categories and neighborhoods still require 'active' (unchanged).
-- -----------------------------------------------------------------------------
drop policy "Anyone can read active municipalities" on public.municipalities;
drop policy "Users read active municipalities; staff read their own" on public.municipalities;

create policy "Anyone can read listed municipalities"
  on public.municipalities for select to anon
  using (status in ('active', 'onboarding'));

create policy "Users read listed municipalities; staff read their own"
  on public.municipalities for select to authenticated
  using (
    status in ('active', 'onboarding')
    or id in (select private.staff_municipality_ids())
    or (select private.is_platform_admin())
  );

-- -----------------------------------------------------------------------------
-- 4. Sign-up: also copy the chosen home municipality. Only a well-formed id of a listed
--    municipality is used; anything else is ignored, so sign-up never fails on it.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  v_locale text := new.raw_user_meta_data ->> 'preferred_locale';
  v_home_text text := new.raw_user_meta_data ->> 'home_municipality_id';
  v_home uuid;
begin
  if v_home_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select m.id into v_home
    from public.municipalities m
    where m.id = v_home_text::uuid and m.status in ('active', 'onboarding');
  end if;

  insert into public.profiles (id, full_name, preferred_locale, home_municipality_id)
  values (
    new.id,
    left(v_name, 100),
    case when v_locale in ('he', 'ar', 'en') then v_locale::public.app_locale else 'he' end,
    v_home
  );
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public;
