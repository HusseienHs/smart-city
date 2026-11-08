import {
  ANNOUNCEMENT_COLUMNS,
  DEPARTMENT_COLUMNS,
  MUNICIPALITY_COLUMNS,
  MUNICIPALITY_REPORT_CATEGORY_COLUMNS,
  MY_PHONE_COLUMNS,
  MY_PROFILE_COLUMNS,
  NEIGHBORHOOD_COLUMNS,
  REPORT_CATEGORY_COLUMNS,
} from '@smart-city/api';
import { describe, expect, it } from 'vitest';

import { anon, type Actor, user } from './support/db';
import { ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/**
 * Runs the exact column lists used by @smart-city/api against the real grants and policies.
 * Unit tests in packages/api use a fake client, which can't detect a column the database refuses.
 */
describe('@smart-city/api column lists against real permissions', () => {
  const world = useWorld();

  const lists: [string, string][] = [
    ['municipalities', MUNICIPALITY_COLUMNS],
    ['neighborhoods', NEIGHBORHOOD_COLUMNS],
    ['departments', DEPARTMENT_COLUMNS],
    ['report_categories', REPORT_CATEGORY_COLUMNS],
    ['municipality_report_categories', MUNICIPALITY_REPORT_CATEGORY_COLUMNS],
    ['announcements', ANNOUNCEMENT_COLUMNS],
  ];

  const actors: [string, Actor][] = [
    ['anonymous visitors', anon],
    ['citizens', user(ids.citizenB1)],
    ['staff', user(ids.employeeAX)],
  ];

  describe.each(actors)('as %s', (_label, actor) => {
    it.each(lists)('can read the columns selected from %s', async (table, columns) => {
      await expect(
        world.db.as(actor, `select ${columns} from public.${table}`),
      ).resolves.toBeDefined();
    });
  });

  it('returns the expected public reference rows to anonymous visitors', async () => {
    const municipalities = await world.db.as<{ code: string }>(
      anon,
      `select ${MUNICIPALITY_COLUMNS} from public.municipalities order by code`,
    );
    expect(municipalities.map((row) => row.code)).toEqual(['TSA', 'TSB']);

    const neighborhoods = await world.db.as(
      anon,
      `select ${NEIGHBORHOOD_COLUMNS} from public.neighborhoods where municipality_id = $1`,
      [ids.muniA],
    );
    expect(neighborhoods).toHaveLength(1);

    const categories = await world.db.as(
      anon,
      `select ${REPORT_CATEGORY_COLUMNS} from public.report_categories`,
    );
    expect(categories.length).toBeGreaterThan(0);
  });

  it('exposes published announcements through the list, and no draft', async () => {
    const [draft] = await world.db.as<{ id: string }>(
      user(ids.adminA),
      `insert into public.announcements (municipality_id, title, body)
       values ($1, '{"he": "טיוטה"}', '{"he": "תוכן"}') returning id`,
      [ids.muniA],
    );
    const [published] = await world.db.as<{ id: string }>(
      user(ids.adminA),
      `insert into public.announcements (municipality_id, title, body)
       values ($1, '{"he": "הודעה"}', '{"he": "תוכן"}') returning id`,
      [ids.muniA],
    );
    await world.db.as(user(ids.adminA), `select public.set_announcement_status($1, 'published')`, [
      published!.id,
    ]);

    const visible = (
      await world.db.as<{ id: string }>(
        anon,
        `select ${ANNOUNCEMENT_COLUMNS} from public.announcements`,
      )
    ).map((row) => row.id);
    expect(visible).toContain(published!.id);
    expect(visible).not.toContain(draft!.id);
  });
});

/**
 * The signed-in user's own data (@smart-city/api `me` functions): the same columns and
 * statements, run as citizens against the real grants and policies, including attempts on
 * someone else's rows.
 */
describe('@smart-city/api "me" functions against real permissions', () => {
  const world = useWorld();
  const citizenA1 = user(ids.citizenA1); // has a phone number
  const citizenA2 = user(ids.citizenA2); // has none
  const citizenB1 = user(ids.citizenB1);

  /** A neighborhood of the municipality (created inside the test's rolled-back transaction if none). */
  const neighborhoodOf = async (municipalityId: string) => {
    const [existing] = await world.db.query<{ id: string }>(
      `select id from public.neighborhoods where municipality_id = $1 limit 1`,
      [municipalityId],
    );
    if (existing) return existing.id;
    const [created] = await world.db.query<{ id: string }>(
      `insert into public.neighborhoods (municipality_id, name)
       values ($1, '{"he": "שכונת בדיקה"}') returning id`,
      [municipalityId],
    );
    return created!.id;
  };

  describe('profiles', () => {
    it('a citizen reads exactly their own profile with MY_PROFILE_COLUMNS', async () => {
      const rows = await world.db.as<{ id: string }>(
        citizenA1,
        `select ${MY_PROFILE_COLUMNS} from public.profiles`,
      );
      expect(rows.map((row) => row.id)).toEqual([ids.citizenA1]);

      const others = await world.db.as(
        citizenA1,
        `select ${MY_PROFILE_COLUMNS} from public.profiles where id = $1`,
        [ids.citizenA2],
      );
      expect(others).toEqual([]);
    });

    it('updateMyProfile: updates the granted columns of the own row', async () => {
      const neighborhood = await neighborhoodOf(ids.muniA);
      const [row] = await world.db.as<Record<string, unknown>>(
        citizenA1,
        `update public.profiles
            set full_name = 'Dana Levi', preferred_locale = 'ar',
                home_municipality_id = $2, home_neighborhood_id = $3
          where id = $1
          returning ${MY_PROFILE_COLUMNS}`,
        [ids.citizenA1, ids.muniA, neighborhood],
      );
      expect(row).toMatchObject({
        id: ids.citizenA1,
        full_name: 'Dana Levi',
        preferred_locale: 'ar',
        home_municipality_id: ids.muniA,
        home_neighborhood_id: neighborhood,
      });
    });

    it("updateMyProfile: another citizen's profile is never updated", async () => {
      const updated = await world.db.as(
        citizenA1,
        `update public.profiles set full_name = 'Hijacked' where id = $1 returning id`,
        [ids.citizenB1],
      );
      expect(updated).toEqual([]);
      const [b1] = await world.db.query<{ full_name: string }>(
        `select full_name from public.profiles where id = $1`,
        [ids.citizenB1],
      );
      expect(b1!.full_name).not.toBe('Hijacked');
    });

    it('updateMyProfile: a neighborhood of another municipality is rejected', async () => {
      const otherNeighborhood = await neighborhoodOf(ids.muniB);
      const message = await world.db.fails(
        citizenA1,
        `update public.profiles set home_municipality_id = $2, home_neighborhood_id = $3
          where id = $1`,
        [ids.citizenA1, ids.muniA, otherNeighborhood],
      );
      expect(message).toMatch(/foreign key/i);
    });

    it('updateMyProfile: columns outside the grant cannot be written', async () => {
      expect(
        await world.db.fails(
          citizenA1,
          `update public.profiles set id = gen_random_uuid() where id = $1`,
          [ids.citizenA1],
        ),
      ).toMatch(DENIED);
    });
  });

  describe('profile_contacts (phone)', () => {
    it('getMyPhone: reads only the own number', async () => {
      const own = await world.db.as<{ phone: string }>(
        citizenA1,
        `select ${MY_PHONE_COLUMNS} from public.profile_contacts where user_id = $1`,
        [ids.citizenA1],
      );
      expect(own).toEqual([{ phone: '+972000000001' }]);

      const others = await world.db.as(
        citizenB1,
        `select ${MY_PHONE_COLUMNS} from public.profile_contacts`,
      );
      expect(others).toEqual([]);
    });

    it('upsertMyPhone: update-then-insert creates and then updates the own row', async () => {
      const update = () =>
        world.db.as<{ phone: string }>(
          citizenA2,
          `update public.profile_contacts set phone = $2 where user_id = $1
           returning ${MY_PHONE_COLUMNS}`,
          [ids.citizenA2, '0501234567'],
        );

      expect(await update()).toEqual([]);
      await world.db.as(
        citizenA2,
        `insert into public.profile_contacts (user_id, phone) values ($1, $2)`,
        [ids.citizenA2, '0501234567'],
      );
      expect(await update()).toEqual([{ phone: '0501234567' }]);
    });

    it('upsertMyPhone: a PostgREST-style upsert is refused (why update-then-insert is used)', async () => {
      // On conflict, PostgREST's upsert also sets user_id, which citizens may not update.
      expect(
        await world.db.fails(
          citizenA1,
          `insert into public.profile_contacts (user_id, phone) values ($1, '0509999999')
           on conflict (user_id) do update set user_id = excluded.user_id, phone = excluded.phone`,
          [ids.citizenA1],
        ),
      ).toMatch(DENIED);
    });

    it("upsertMyPhone: a citizen cannot create or change someone else's number", async () => {
      expect(
        await world.db.fails(
          citizenA2,
          `insert into public.profile_contacts (user_id, phone) values ($1, '0501111111')`,
          [ids.citizenB1],
        ),
      ).toMatch(DENIED);

      const updated = await world.db.as(
        citizenA2,
        `update public.profile_contacts set phone = '0502222222' where user_id = $1
         returning user_id`,
        [ids.citizenA1],
      );
      expect(updated).toEqual([]);
    });

    it("deleteMyPhone: deletes the own number only, never someone else's", async () => {
      const foreign = await world.db.as(
        citizenA2,
        `delete from public.profile_contacts where user_id = $1 returning user_id`,
        [ids.citizenA1],
      );
      expect(foreign).toEqual([]);

      const own = await world.db.as(
        citizenA1,
        `delete from public.profile_contacts where user_id = $1 returning user_id`,
        [ids.citizenA1],
      );
      expect(own).toHaveLength(1);
    });
  });

  describe('report RPCs', () => {
    it('getMyReports: get_my_reports returns only the caller’s reports', async () => {
      const a1 = await world.db.as<{ id: string; address: string | null }>(
        citizenA1,
        `select * from public.get_my_reports()`,
      );
      expect(a1.map((row) => row.id).sort()).toEqual(
        [world.reports.publicUnassignedA, world.reports.privateNoiseA].sort(),
      );

      const b1 = await world.db.as<{ id: string }>(
        citizenB1,
        `select * from public.get_my_reports()`,
      );
      expect(b1.map((row) => row.id)).toEqual([world.reports.assignedZB]);
    });

    it('getMyReports: anonymous callers are refused', async () => {
      expect(await world.db.fails(anon, `select * from public.get_my_reports()`)).toMatch(DENIED);
    });

    it("getMyReportUpdates: someone else's report yields nothing", async () => {
      const own = await world.db.as(citizenA2, `select * from public.get_my_report_updates($1)`, [
        world.reports.assignedXA,
      ]);
      expect(own.length).toBeGreaterThan(0);

      const foreign = await world.db.as(
        citizenB1,
        `select * from public.get_my_report_updates($1)`,
        [world.reports.assignedXA],
      );
      expect(foreign).toEqual([]);
    });
  });
});
