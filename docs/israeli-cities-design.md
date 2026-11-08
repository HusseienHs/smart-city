# Design: Israeli cities, city at sign-up, municipality per report

**Status:** implemented and applied to `smart-city-dev` (2026-11-08). The owner approved it with the defaults: all 82
CBS cities, including the four in Judea and Samaria, and the demo cities as the only ones that accept reports.

**Differences from the proposal:**

- The API returns the existing `status` field and an `acceptsReports(municipality)` helper instead of a new
  `acceptsReports` field.
- Search in the report-screen picker turns on only above 12 options.
  **Date:** 2026-11-08

## 1. Goal

1. Load every Israeli city into `municipalities`.
2. A new user must choose the city they live in when signing up. It becomes their home municipality.
3. On a new report, the home city is preselected, and the citizen can switch to another municipality for that report.

### Owner decisions (2026-11-08)

| Question                              | Decision                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Which places                          | **Cities only**: localities with CBS municipal status _עירייה_. Local and regional councils are out of scope for now.            |
| Reports to cities not on the platform | **Not allowed.** All cities can be chosen as a home city, but only cities that have joined (`status = 'active'`) accept reports. |
| City at sign-up                       | **Required.**                                                                                                                    |

## 2. Source data

- **Source:** Central Bureau of Statistics (CBS), _Localities in Israel_ file `bycode2024.xlsx`
  (`https://www.cbs.gov.il/he/publications/doclib/2019/ishuvim/bycode2024.xlsx`), with rows filtered on
  `שם מעמד מונציפאלי = עירייה`.
- **Result:** **82 cities.** This is more than the commonly quoted ~77 because several towns became cities recently,
  for example Harish and Kafr Qara. The table in §8 is checked by a script: 82 rows, CBS codes match the file exactly,
  and municipality codes are unique and don't collide with the demo codes `DMN` and `DMS`.
- **Hebrew names:** taken from CBS. One spacing fix: `תל אביב -יפו` becomes `תל אביב-יפו`.
- **English names:** CBS uses an older transliteration (_Petah Tiqwa, Bene Beraq, Elat, Zefat_). The table uses the
  spellings people commonly use (_Petah Tikva, Bnei Brak, Eilat, Safed_).
- **Arabic names:** CBS has none. These were written by hand and **need review by an Arabic speaker** (§7).
- **Boundaries:** left `null` for now. CBS has a single point per city, not a polygon. The column already exists and can
  be filled later from official boundary data.

## 3. Database (new migration `20261108000100_israeli_cities.sql`)

Migrations 0001–0007 stay untouched; this fixes forward.

### 3.1 Schema

```sql
alter table public.municipalities
  add column cbs_code integer unique check (cbs_code > 0);
```

- The column stores the CBS locality code (סמל יישוב). It's the stable external key, so later syncs or boundary
  imports can match rows without relying on names.
- No `UPDATE` grant is given to `authenticated`, so only migrations and the service role can change it. That's the
  same treatment `code` gets.
- It stays nullable because the demo municipalities don't have one.

### 3.2 Data

- Insert the 82 cities from §8 with `status = 'onboarding'`, `default_locale = 'he'`, and every contact field `null`.
- `on conflict (cbs_code) do nothing`, so re-running the migration is harmless.
- **Status meaning:** `onboarding` means "on the list, can be a home city, doesn't accept reports". `active` means it
  accepts reports. `suspended` means hidden. The existing enum already has all three; only the meaning of
  `onboarding` widens slightly.
- **Codes:** 3 letters, chosen by hand. They appear in tracking numbers (`JLM-2026-000001`) and can't be changed once
  created, so **review them before approval**.
- **Why a migration and not `seed.sql`:** this is public reference data that every environment needs, production
  included. `seed.sql` stays for fictional test data only.

### 3.3 RLS: let citizens see cities that haven't joined

Right now anon and authenticated users can read only `status = 'active'` municipalities. The two `select` policies get
replaced (dropped and recreated in the new migration):

| Policy               | Today                                                           | Proposed                                                                         |
| -------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| anon select          | `status = 'active'`                                             | `status in ('active', 'onboarding')`                                             |
| authenticated select | `status = 'active'` or own staff municipality or platform admin | `status in ('active', 'onboarding')` or own staff municipality or platform admin |

**What this exposes:** the extra rows are only names, codes and empty contact fields for 82 public bodies. Columns and
grants stay the same. Suspended municipalities stay hidden.

**No change for reports or categories:**

- `submit_report` already rejects any municipality that isn't `active` (`reports.sql` around line 502).
- Category policies already require `active`.
- Neighborhood policies still require an `active` municipality. A city that hasn't joined has no neighborhoods yet,
  so citizens there can't pick one; that's expected.

### 3.4 Sign-up trigger (`private.handle_new_user`)

Replace the function with `create or replace` so it also copies `home_municipality_id` from the sign-up metadata:

- It's used only if all three hold: it's a well-formed UUID (regex check before the cast, so bad input can't make
  sign-up fail), the municipality exists, and its status is `active` or `onboarding`.
- If any check fails, the value is ignored and stored as `null`. **Sign-up never fails because of this field.**
  Requiring a city is done by the app and API validation, not the database.
- `profiles.home_municipality_id` stays nullable: existing users, staff, and accounts created outside the app may not
  have one.
- The trigger still ignores every other metadata key.

## 4. API (`@smart-city/api`, `@smart-city/shared`)

- `signUpSchema` gets `homeMunicipalityId: z.string().uuid()` as a required field. `signUp` sends it as
  `home_municipality_id` in the sign-up metadata.
- Municipality lists split by purpose:
  - `listCities(client)`: `active` + `onboarding`, sorted by localized name in the app. Used for the home city
    (sign-up and profile).
  - `listReportingMunicipalities(client)`: `active` only. This is today's `listMunicipalities`, renamed so the
    purpose is clear. Used on the report screen.
- Both return a new `acceptsReports: boolean` field, `status === 'active'`. That lets the report screen say _why_
  the home city wasn't preselected.
- Regenerate the database types for the new column.

## 5. Mobile app

| Screen                         | Change                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sign-up**                    | New required **City** field, a searchable picker of all cities. The form won't submit without one. The list loads as anon, which the new policy allows.                                                                                                                                          |
| **Option picker**              | Add a search box (filters on the visible name in all three languages) when there are more than ~12 options. Profile and the report screen get it too.                                                                                                                                            |
| **Profile → Personal details** | The home municipality list becomes all cities. Neighborhood stays disabled unless the city has neighborhoods.                                                                                                                                                                                    |
| **New report → step 1**        | The municipality list stays **joined cities only**. Home city joined: preselected, same as today. Home city not joined: nothing preselected, and a notice says _"‹City› hasn't joined the app yet. Choose a municipality that accepts reports."_ No joined cities at all: today's message stays. |
| **i18n**                       | New strings in he / ar / en: city label, search placeholder, "city required", "your city hasn't joined".                                                                                                                                                                                         |

Existing users with no home city aren't forced to set one. They can set it in Profile, and the report screen behaves
as it does today.

## 6. Tests and rollout

- **pgTAP (`supabase/tests`):**
  - anon and citizens can read `onboarding` cities but not `suspended` ones.
  - The trigger stores a valid city.
  - The trigger ignores a suspended city, a city that doesn't exist, and a value that isn't a UUID.
  - `submit_report` to an `onboarding` city is rejected.
  - `cbs_code` can't be updated by `authenticated`.
- **Unit tests:** the shared schema; `signUp` metadata; the two list functions; picker search filtering; the
  report-screen default logic for a joined home city, a city that hasn't joined, and no home city.
- **Rollout:**
  1. Run `pnpm check`.
  2. Do a `supabase db push --remote --dry-run` and get your approval.
  3. Push the migration to `smart-city-dev`.
  4. Regenerate types.
  5. Test sign-up in the app.
- **Decision log:** add **D-012 · Real municipality reference data**. Public names and codes of municipalities aren't
  personal data and may be stored in every environment. D-007's synthetic-only rule still applies to people and
  reports.

## 7. Open points for the owner

1. **Four cities in Judea and Samaria** (Modi'in Illit, Beitar Illit, Ma'ale Adumim, Ariel) appear as cities in the
   CBS list. This draft includes them, as CBS does. Should they be included?
2. **Arabic names:** please check the Arabic column, or have a native speaker check it. In mixed or Arab cities the
   table uses the Arabic name people use (الناصرة, شفاعمرو, بيسان, اللد, الرملة, عكا), not a transliteration of the
   Hebrew.
3. **Municipality codes:** these are permanent once created (§3.2). Change any now if you prefer a different code.
4. **Demo cities:** Demo City North and Demo City South stay `active` in dev, so reports can still be tested end to
   end. Alternatively, one real city (for example Haifa) could be made `active` in dev instead.

## 8. City table (82)

| #   | CBS code | Code | Hebrew             | English                | Arabic              | District           | Pop. 2024 |
| --- | -------- | ---- | ------------------ | ---------------------- | ------------------- | ------------------ | --------- |
| 1   | 3000     | JLM  | ירושלים            | Jerusalem              | القدس               | ירושלים            | 1,050,151 |
| 2   | 5000     | TLV  | תל אביב-יפו        | Tel Aviv-Yafo          | تل أبيب - يافا      | תל אביב            | 494,900   |
| 3   | 4000     | HFA  | חיפה               | Haifa                  | حيفا                | חיפה               | 297,083   |
| 4   | 7900     | PTK  | פתח תקווה          | Petah Tikva            | بيتح تكفا           | המרכז              | 270,403   |
| 5   | 8300     | RLZ  | ראשון לציון        | Rishon LeZion          | ريشون لتسيون        | המרכז              | 259,275   |
| 6   | 7400     | NTN  | נתניה              | Netanya                | نتانيا              | המרכז              | 234,812   |
| 7   | 6100     | BBK  | בני ברק            | Bnei Brak              | بني براك            | תל אביב            | 229,995   |
| 8   | 70       | ASD  | אשדוד              | Ashdod                 | أسدود               | הדרום              | 228,562   |
| 9   | 9000     | BSV  | באר שבע            | Be'er Sheva            | بئر السبع           | הדרום              | 223,587   |
| 10  | 6600     | HLN  | חולון              | Holon                  | حولون               | תל אביב            | 191,829   |
| 11  | 2610     | BSM  | בית שמש            | Beit Shemesh           | بيت شيمش            | ירושלים            | 176,786   |
| 12  | 8600     | RGN  | רמת גן             | Ramat Gan              | رمات غان            | תל אביב            | 172,242   |
| 13  | 7100     | ASK  | אשקלון             | Ashkelon               | عسقلان              | הדרום              | 166,865   |
| 14  | 8400     | RHV  | רחובות             | Rehovot                | رحوفوت              | המרכז              | 155,050   |
| 15  | 6200     | BTY  | בת ים              | Bat Yam                | بات يام             | תל אביב            | 129,495   |
| 16  | 6400     | HRZ  | הרצלייה            | Herzliya               | هرتسليا             | תל אביב            | 110,885   |
| 17  | 6500     | HDR  | חדרה               | Hadera                 | الخضيرة             | חיפה               | 107,974   |
| 18  | 1200     | MOD  | מודיעין-מכבים-רעות | Modi'in-Maccabim-Re'ut | موديعين مكابيم رعوت | המרכז              | 100,052   |
| 19  | 6900     | KSV  | כפר סבא            | Kfar Saba              | كفار سابا           | המרכז              | 99,410    |
| 20  | 7000     | LOD  | לוד                | Lod                    | اللد                | המרכז              | 94,189    |
| 21  | 3797     | MDI  | מודיעין עילית      | Modi'in Illit          | موديعين عيليت       | אזור יהודה ושומרון | 89,627    |
| 22  | 8500     | RML  | רמלה               | Ramla                  | الرملة              | המרכז              | 86,052    |
| 23  | 8700     | RAN  | רעננה              | Ra'anana               | رعنانا              | המרכז              | 82,963    |
| 24  | 2640     | RHA  | ראש העין           | Rosh HaAyin            | روش هعاين           | המרכז              | 79,023    |
| 25  | 1161     | RHT  | רהט                | Rahat                  | رهط                 | הדרום              | 77,996    |
| 26  | 7300     | NAZ  | נצרת               | Nazareth               | الناصرة             | הצפון              | 75,704    |
| 27  | 2630     | KGT  | קריית גת           | Kiryat Gat             | كريات جات           | הדרום              | 72,139    |
| 28  | 3780     | BTI  | ביתר עילית         | Beitar Illit           | بيتار عيليت         | אזור יהודה ושומרון | 71,698    |
| 29  | 9100     | NHR  | נהרייה             | Nahariya               | نهاريا              | הצפון              | 67,877    |
| 30  | 9700     | HSH  | הוד השרון          | Hod HaSharon           | هود هشارون          | המרכז              | 66,398    |
| 31  | 7700     | AFL  | עפולה              | Afula                  | العفولة             | הצפון              | 66,362    |
| 32  | 6800     | KAT  | קריית אתא          | Kiryat Ata             | كريات آتا           | חיפה               | 62,584    |
| 33  | 2710     | UMF  | אום אל-פחם         | Umm al-Fahm            | أم الفحم            | חיפה               | 60,210    |
| 34  | 6300     | GVT  | גבעתיים            | Givatayim              | جفعتايم             | תל אביב            | 58,600    |
| 35  | 2660     | YVN  | יבנה               | Yavne                  | يفنه                | המרכז              | 58,090    |
| 36  | 246      | NTV  | נתיבות             | Netivot                | نتيفوت              | הדרום              | 56,019    |
| 37  | 2600     | ELT  | אילת               | Eilat                  | إيلات               | הדרום              | 56,004    |
| 38  | 7600     | AKO  | עכו                | Akko                   | عكا                 | הצפון              | 52,884    |
| 39  | 6700     | TVR  | טבריה              | Tiberias               | طبريا               | הצפון              | 52,122    |
| 40  | 8200     | KMZ  | קריית מוצקין       | Kiryat Motzkin         | كريات موتسكين       | חיפה               | 51,488    |
| 41  | 1309     | ELD  | אלעד               | Elad                   | إلعاد               | המרכז              | 50,845    |
| 42  | 2650     | RHS  | רמת השרון          | Ramat HaSharon         | رمات هشارون         | תל אביב            | 48,860    |
| 43  | 1139     | KRM  | כרמיאל             | Karmiel                | كرميئيل             | הצפון              | 47,941    |
| 44  | 7200     | NSZ  | נס ציונה           | Ness Ziona             | نيس تسيونا          | המרכז              | 47,268    |
| 45  | 9500     | KBL  | קריית ביאליק       | Kiryat Bialik          | كريات بياليك        | חיפה               | 47,072    |
| 46  | 2730     | TYB  | טייבה              | Tayibe                 | الطيبة              | המרכז              | 46,870    |
| 47  | 1061     | NFG  | נוף הגליל          | Nof HaGalil            | نوف هجليل           | הצפון              | 45,805    |
| 48  | 2620     | KON  | קריית אונו         | Kiryat Ono             | كريات أونو          | תל אביב            | 45,048    |
| 49  | 8800     | SHF  | שפרעם              | Shefa-'Amr             | شفاعمرو             | הצפון              | 43,858    |
| 50  | 9600     | KYM  | קריית ים           | Kiryat Yam             | كريات يام           | חיפה               | 41,959    |
| 51  | 1247     | HRS  | חריש               | Harish                 | حريش                | חיפה               | 41,574    |
| 52  | 2400     | ORY  | אור יהודה          | Or Yehuda              | أور يهودا           | תל אביב            | 41,130    |
| 53  | 31       | OFK  | אופקים             | Ofakim                 | أوفاكيم             | הדרום              | 39,894    |
| 54  | 2200     | DIM  | דימונה             | Dimona                 | ديمونا              | הדרום              | 39,590    |
| 55  | 8000     | SFD  | צפת                | Safed                  | صفد                 | הצפון              | 38,687    |
| 56  | 2530     | BYK  | באר יעקב           | Be'er Ya'akov          | بئر يعقوب           | המרכז              | 37,493    |
| 57  | 1031     | SDR  | שדרות              | Sderot                 | سديروت              | הדרום              | 37,239    |
| 58  | 8900     | TMR  | טמרה               | Tamra                  | طمرة                | הצפון              | 36,919    |
| 59  | 3616     | MAD  | מעלה אדומים        | Ma'ale Adumim          | معاليه أدوميم       | אזור יהודה ושומרון | 35,845    |
| 60  | 7500     | SKN  | סח'נין             | Sakhnin                | سخنين               | הצפון              | 33,726    |
| 61  | 2100     | TKR  | טירת כרמל          | Tirat Carmel           | طيرة الكرمل         | חיפה               | 32,166    |
| 62  | 9400     | YHD  | יהוד-מונוסון       | Yehud-Monosson         | يهود مونوسون        | המרכז              | 32,145    |
| 63  | 6000     | BAQ  | באקה אל-גרביה      | Baqa al-Gharbiyye      | باقة الغربية        | חיפה               | 31,276    |
| 64  | 168      | KYN  | כפר יונה           | Kfar Yona              | كفار يونا           | המרכז              | 29,820    |
| 65  | 2560     | ARD  | ערד                | Arad                   | عراد                | הדרום              | 29,505    |
| 66  | 681      | GSM  | גבעת שמואל         | Giv'at Shmuel          | جفعات شموئيل        | המרכז              | 29,405    |
| 67  | 874      | MGE  | מגדל העמק          | Migdal HaEmek          | مجدال هعيمق         | הצפון              | 28,431    |
| 68  | 634      | KFQ  | כפר קאסם           | Kafr Qasim             | كفر قاسم            | המרכז              | 27,997    |
| 69  | 1034     | KML  | קריית מלאכי        | Kiryat Malakhi         | كريات ملاخي         | הדרום              | 27,957    |
| 70  | 2720     | TIR  | טירה               | Tira                   | الطيرة              | המרכז              | 27,680    |
| 71  | 531      | ARB  | עראבה              | Arraba                 | عرابة               | הצפון              | 27,175    |
| 72  | 1020     | ORA  | אור עקיבא          | Or Akiva               | أور عكيفا           | חיפה               | 25,922    |
| 73  | 229      | GTK  | גני תקווה          | Ganei Tikva            | جاني تكفا           | המרכז              | 25,487    |
| 74  | 638      | QLN  | קלנסווה            | Qalansawe              | قلنسوة              | המרכז              | 25,167    |
| 75  | 240      | YKN  | יקנעם עילית        | Yokneam Illit          | يوكنعام عيليت       | הצפון              | 24,928    |
| 76  | 2800     | KSH  | קריית שמונה        | Kiryat Shmona          | كريات شمونة         | הצפון              | 24,437    |
| 77  | 481      | MGR  | מגאר               | Maghar                 | المغار              | הצפון              | 23,486    |
| 78  | 1063     | MLT  | מעלות-תרשיחא       | Ma'alot-Tarshiha       | معالوت ترشيحا       | הצפון              | 23,042    |
| 79  | 2500     | NSR  | נשר                | Nesher                 | نيشر                | חיפה               | 22,897    |
| 80  | 3570     | ARL  | אריאל              | Ariel                  | أريئيل              | אזור יהודה ושומרון | 22,190    |
| 81  | 654      | KQR  | כפר קרע            | Kafr Qara              | كفر قرع             | חיפה               | 21,067    |
| 82  | 9200     | BSN  | בית שאן            | Beit She'an            | بيسان               | הצפון              | 20,253    |
