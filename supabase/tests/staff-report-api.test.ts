import {
  REPORT_HIDDEN_COLUMNS,
  STAFF_REPORT_ATTACHMENT_COLUMNS,
  STAFF_REPORT_COMMENT_COLUMNS,
  STAFF_REPORT_DETAIL_COLUMNS,
  STAFF_REPORT_HISTORY_COLUMNS,
  STAFF_REPORT_LIST_COLUMNS,
  toGeoPoint,
} from '@smart-city/api';
import { describe, expect, it } from 'vitest';

import { type Actor, user } from './support/db';
import { exactLocationA, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/**
 * Runs the exact column lists and the location decoding of the staff reports API
 * (packages/api/src/staff) against the real grants, policies and PostGIS output. The unit tests
 * in packages/api use a fake client, which can't detect a refused column or a format change.
 */
describe('staff reports API against the real database', () => {
  const world = useWorld();

  const staff: [string, Actor][] = [
    ['municipality admin', user(ids.adminA)],
    ['department manager', user(ids.managerAX)],
    ['employee', user(ids.employeeAX)],
    ['intake dispatcher', user(ids.dispatcherA)],
  ];

  const childLists: [string, string][] = [
    ['report_attachments', STAFF_REPORT_ATTACHMENT_COLUMNS],
    ['report_comments', STAFF_REPORT_COMMENT_COLUMNS],
    ['report_status_history', STAFF_REPORT_HISTORY_COLUMNS],
  ];

  it.each(staff)('%s: every column list is permitted', async (_role, actor) => {
    for (const list of [STAFF_REPORT_LIST_COLUMNS, STAFF_REPORT_DETAIL_COLUMNS]) {
      await expect(
        world.db.as(actor, `select ${list} from public.reports where municipality_id = $1`, [
          ids.muniA,
        ]),
      ).resolves.toBeDefined();
    }
    for (const [table, list] of childLists) {
      await expect(
        world.db.as(actor, `select ${list} from public.${table}`),
      ).resolves.toBeDefined();
    }
  });

  it('adding any hidden identity column is refused by the database', async () => {
    for (const hidden of ['reporter_id']) {
      await expect(
        world.db.as(
          user(ids.adminA),
          `select ${STAFF_REPORT_LIST_COLUMNS}, ${hidden} from public.reports`,
        ),
      ).rejects.toThrow(DENIED);
    }
    for (const [table, hidden] of [
      ['report_comments', 'author_id'],
      ['report_status_history', 'changed_by'],
      ['report_attachments', 'uploaded_by'],
    ] as const) {
      expect(REPORT_HIDDEN_COLUMNS).toContain(hidden);
      await expect(
        world.db.as(user(ids.adminA), `select ${hidden} from public.${table}`),
      ).rejects.toThrow(DENIED);
    }
  });

  it('the list is scoped by role (RLS) within the active municipality', async () => {
    const visible = async (actor: Actor) =>
      (
        await world.db.as<{ id: string }>(
          actor,
          `select ${STAFF_REPORT_LIST_COLUMNS} from public.reports where municipality_id = $1 order by created_at`,
          [ids.muniA],
        )
      ).map((row) => row.id);

    expect(await visible(user(ids.adminA))).toHaveLength(4);
    expect(await visible(user(ids.managerAX))).toEqual([world.reports.assignedXA]);
    expect(await visible(user(ids.employeeAX))).toEqual([world.reports.assignedXA]);
    expect((await visible(user(ids.dispatcherA))).sort()).toEqual(
      [world.reports.publicUnassignedA, world.reports.privateNoiseA].sort(),
    );
  });

  it('tenant isolation: another municipality’s staff and citizens see nothing in A', async () => {
    for (const actor of [user(ids.adminB), user(ids.employeeBZ), user(ids.citizenA1)]) {
      const rows = await world.db.as(
        actor,
        `select ${STAFF_REPORT_DETAIL_COLUMNS} from public.reports where municipality_id = $1`,
        [ids.muniA],
      );
      expect(rows).toEqual([]);
    }
  });

  it('a report of another municipality is invisible even when asked for by id', async () => {
    const rows = await world.db.as(
      user(ids.adminA),
      `select ${STAFF_REPORT_DETAIL_COLUMNS} from public.reports where id = $1`,
      [world.reports.assignedZB],
    );
    expect(rows).toEqual([]);
  });

  it('decodes the real PostGIS location value into the submitted coordinates', async () => {
    const [row] = await world.db.as<{ location: unknown }>(
      user(ids.adminA),
      `select ${STAFF_REPORT_DETAIL_COLUMNS} from public.reports where id = $1`,
      [world.reports.publicUnassignedA],
    );
    expect(typeof row!.location).toBe('string');
    expect(toGeoPoint(row!.location)).toEqual(exactLocationA);
  });

  it('decodes the value exactly as PostgREST serializes it (JSON)', async () => {
    const [row] = await world.db.as<{ body: { location: unknown } }>(
      user(ids.adminA),
      `select row_to_json(r) as body from (
         select ${STAFF_REPORT_DETAIL_COLUMNS} from public.reports where id = $1
       ) r`,
      [world.reports.publicUnassignedA],
    );
    expect(toGeoPoint(row!.body.location)).toEqual(exactLocationA);
  });
});
