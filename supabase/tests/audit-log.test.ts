import { describe, expect, it } from 'vitest';

import { anon, user } from './support/db';
import { ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/** F6: the audit log is read only through get_audit_log(), with redaction per audience. */
describe('audit log access', () => {
  const world = useWorld();

  const log = (actorId: string) =>
    world.db.as<Record<string, unknown>>(
      user(actorId),
      `select * from public.get_audit_log($1, 500)`,
      [ids.muniA],
    );

  it('is not readable directly by any API role', async () => {
    for (const actor of [anon, user(ids.adminA), user(ids.platformAdmin), user(ids.citizenA1)]) {
      expect(await world.db.fails(actor, `select id from public.audit_logs`)).toMatch(DENIED);
    }
  });

  it('is available only to municipality admins and platform admins', async () => {
    for (const actor of [
      ids.employeeAX,
      ids.managerAX,
      ids.dispatcherA,
      ids.citizenA1,
      ids.adminB,
    ]) {
      expect(
        await world.db.fails(user(actor), `select * from public.get_audit_log($1)`, [ids.muniA]),
      ).toMatch(DENIED);
    }
  });

  it('never shows citizen actor ids, even to municipality admins', async () => {
    await world.db.as(user(ids.adminA), `select * from public.get_report_reporter_contact($1)`, [
      world.reports.publicUnassignedA,
    ]);
    const rows = await log(ids.adminA);
    const citizenEntries = rows.filter((row) => row.actor_kind === 'citizen');
    expect(citizenEntries.length).toBeGreaterThan(0);
    expect(citizenEntries.every((row) => row.actor_id === null)).toBe(true);

    const serialized = JSON.stringify(rows);
    for (const citizen of [ids.citizenA1, ids.citizenA2]) expect(serialized).not.toContain(citizen);

    // Admins still see report-level detail (tracking numbers, who viewed a contact).
    const view = rows.find((row) => row.action === 'report.reporter_contact_viewed');
    expect(view).toMatchObject({
      actor_id: ids.adminA,
      entity_id: world.reports.publicUnassignedA,
    });
  });

  it('gives platform admins an operational view without report details or tracking numbers', async () => {
    const rows = await log(ids.platformAdmin);
    const reportEntries = rows.filter((row) => row.entity_type === 'report');
    expect(reportEntries.length).toBeGreaterThan(0);
    for (const entry of reportEntries) {
      expect(entry.entity_id).toBeNull();
      expect(entry.details).toEqual({});
    }
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toMatch(/TSA-\d{4}-\d{6}/);
    for (const report of Object.values(world.reports)) expect(serialized).not.toContain(report);
    for (const citizen of [ids.citizenA1, ids.citizenA2]) expect(serialized).not.toContain(citizen);

    // Operational entries (staff and structure changes) remain visible.
    expect(rows.some((row) => row.entity_type === 'employees')).toBe(true);
  });
});
