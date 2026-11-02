import { describe, expect, it } from 'vitest';

import { user } from './support/db';
import { employeeIds, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/** Municipality B's staff must never see or touch municipality A's private data. */
describe('cross-municipality isolation', () => {
  const world = useWorld();
  const adminB = user(ids.adminB);
  const employeeBZ = user(ids.employeeBZ);

  const tenantTables = [
    'reports',
    'report_attachments',
    'report_comments',
    'report_status_history',
    'report_confirmations',
    'report_followers',
    'employees',
    'audit_logs',
    'notifications',
  ];

  it.each(tenantTables)("B's admin and staff see none of A's rows in %s", async (table) => {
    for (const actor of [adminB, employeeBZ]) {
      const rows = await world.db.as(
        actor,
        `select 1 from public.${table} where municipality_id = $1`,
        [ids.muniA],
      );
      expect(rows).toHaveLength(0);
    }
  });

  it("B's admin cannot read A's draft announcements", async () => {
    await world.db.as(
      user(ids.adminA),
      `insert into public.announcements (municipality_id, title, body)
       values ($1, '{"he": "טיוטה"}', '{"he": "תוכן"}')`,
      [ids.muniA],
    );
    const rows = await world.db.as(
      adminB,
      `select 1 from public.announcements where municipality_id = $1`,
      [ids.muniA],
    );
    expect(rows).toHaveLength(0);
  });

  it("B's staff cannot act on A's reports through any RPC", async () => {
    const report = world.reports.assignedXA;
    const calls: [string, unknown[]][] = [
      [`select public.update_report_status($1, 'in_progress')`, [report]],
      [`select public.assign_report($1, $2)`, [report, ids.deptBZ]],
      [`select public.add_report_comment($1, 'cross-tenant', true)`, [report]],
      [`select * from public.get_report_reporter_contact($1)`, [report]],
    ];
    for (const [sql, params] of calls) {
      for (const actor of [adminB, employeeBZ]) {
        expect(await world.db.fails(actor, sql, params)).toMatch(DENIED);
      }
    }
  });

  it("A's admin cannot route an A report to B's department or employee", async () => {
    const report = world.reports.publicUnassignedA;
    expect(
      await world.db.fails(user(ids.adminA), `select public.assign_report($1, $2)`, [
        report,
        ids.deptBZ,
      ]),
    ).toMatch(/department not found/i);
    expect(
      await world.db.fails(user(ids.adminA), `select public.assign_report($1, $2, $3)`, [
        report,
        ids.deptAX,
        employeeIds.employeeBZ,
      ]),
    ).toMatch(/assignee/i);
  });

  it('enforces tenant consistency in the schema itself, even for the database owner', async () => {
    // A comment claiming to belong to B but attached to A's report violates the composite FK.
    await expect(
      world.db.query(
        `insert into public.report_comments (report_id, municipality_id, body) values ($1, $2, 'x')`,
        [world.reports.assignedXA, ids.muniB],
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it("B's admin cannot manage A's staff, structure or settings", async () => {
    expect(
      await world.db.fails(
        adminB,
        `insert into public.employees (user_id, municipality_id, role) values ($1, $2, 'municipality_admin')`,
        [ids.citizenB1, ids.muniA],
      ),
    ).toMatch(DENIED);
    expect(
      await world.db.fails(
        adminB,
        `insert into public.departments (municipality_id, name) values ($1, '{"he": "x"}')`,
        [ids.muniA],
      ),
    ).toMatch(DENIED);

    const updatedEmployees = await world.db.as(
      adminB,
      `update public.employees set is_active = false where municipality_id = $1 returning id`,
      [ids.muniA],
    );
    expect(updatedEmployees).toHaveLength(0);

    const updatedMunicipality = await world.db.as(
      adminB,
      `update public.municipalities set contact_email = 'evil@example.test' where id = $1 returning id`,
      [ids.muniA],
    );
    expect(updatedMunicipality).toHaveLength(0);
  });

  it("A's admin sees A's audit log and not B's", async () => {
    const rows = await world.db.as<{ municipality_id: string }>(
      user(ids.adminA),
      `select distinct municipality_id from public.audit_logs`,
    );
    expect(rows.map((row) => row.municipality_id)).toEqual([ids.muniA]);
  });

  it("a citizen of B never receives A's reports through citizen functions", async () => {
    const rows = await world.db.as<{ municipality_id: string }>(
      user(ids.citizenB1),
      `select municipality_id from public.get_my_reports()`,
    );
    expect(rows.every((row) => row.municipality_id === ids.muniB)).toBe(true);
    expect(rows).toHaveLength(1);
  });
});
