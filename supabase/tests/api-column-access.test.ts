import {
  ANNOUNCEMENT_COLUMNS,
  DEPARTMENT_COLUMNS,
  MUNICIPALITY_COLUMNS,
  MUNICIPALITY_REPORT_CATEGORY_COLUMNS,
  NEIGHBORHOOD_COLUMNS,
  REPORT_CATEGORY_COLUMNS,
} from '@smart-city/api';
import { describe, expect, it } from 'vitest';

import { anon, type Actor, user } from './support/db';
import { ids } from './support/fixtures';
import { useWorld } from './support/world';

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
