import { describe, expect, it } from 'vitest';

import { user } from './support/db';
import { employeeIds, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/** Nobody can grant themselves (or others) more power than their role allows. */
describe('role escalation', () => {
  const world = useWorld();

  const roleOf = async (employeeId: string) =>
    (
      await world.db.query<{ role: string; is_active: boolean }>(
        `select role, is_active from public.employees where id = $1`,
        [employeeId],
      )
    )[0];

  it('stops employees and managers from changing staff records', async () => {
    for (const actor of [ids.employeeAX, ids.managerAX, ids.dispatcherA]) {
      const updated = await world.db.as(
        user(actor),
        `update public.employees set role = 'municipality_admin' where user_id = $1 returning id`,
        [actor],
      );
      expect(updated).toHaveLength(0);
      expect(
        await world.db.fails(
          user(actor),
          `insert into public.employees (user_id, municipality_id, role) values ($1, $2, 'municipality_admin')`,
          [ids.citizenA1, ids.muniA],
        ),
      ).toMatch(DENIED);
    }
    expect(await roleOf(employeeIds.employeeAX)).toEqual({ role: 'employee', is_active: true });
  });

  it('stops citizens from creating staff memberships', async () => {
    expect(
      await world.db.fails(
        user(ids.citizenA1),
        `insert into public.employees (user_id, municipality_id, role) values ($1, $2, 'municipality_admin')`,
        [ids.citizenA1, ids.muniA],
      ),
    ).toMatch(DENIED);
  });

  it('stops an admin from changing their own role or deactivating themselves', async () => {
    expect(
      await world.db.fails(
        user(ids.adminA),
        `update public.employees set role = 'employee', department_id = $2 where id = $1`,
        [employeeIds.adminA, ids.deptAX],
      ),
    ).toMatch(/your own role/i);
    expect(
      await world.db.fails(
        user(ids.adminA),
        `update public.employees set is_active = false where id = $1`,
        [employeeIds.adminA],
      ),
    ).toMatch(/your own role/i);
  });

  it('stops an admin from granting themselves a role in another municipality', async () => {
    expect(
      await world.db.fails(
        user(ids.adminA),
        `insert into public.employees (user_id, municipality_id, role) values ($1, $2, 'municipality_admin')`,
        [ids.adminA, ids.muniB],
      ),
    ).toMatch(DENIED);
  });

  it('lets an admin promote a colleague, and audits it', async () => {
    await world.db.as(
      user(ids.adminA),
      `update public.employees set role = 'department_manager' where id = $1`,
      [employeeIds.employeeAX],
    );
    expect(await roleOf(employeeIds.employeeAX)).toEqual({
      role: 'department_manager',
      is_active: true,
    });
    const [audit] = await world.db.query<{
      actor_id: string;
      details: { after: { role: string } };
    }>(
      `select actor_id, details from public.audit_logs
       where action = 'employees.update' and entity_id = $1 order by id desc limit 1`,
      [employeeIds.employeeAX],
    );
    expect(audit!.actor_id).toBe(ids.adminA);
    expect(audit!.details.after.role).toBe('department_manager');
  });

  it('always leaves the municipality with an active admin', async () => {
    // An admin may deactivate a colleague…
    await world.db.as(
      user(ids.adminA),
      `update public.employees set is_active = false where id = $1`,
      [employeeIds.admin2A],
    );
    // …who then loses all power, including over the remaining admin.
    const demoted = await world.db.as(
      user(ids.admin2A),
      `update public.employees set is_active = false where id = $1 returning id`,
      [employeeIds.adminA],
    );
    expect(demoted).toHaveLength(0);
    // The last admin cannot deactivate themselves.
    expect(
      await world.db.fails(
        user(ids.adminA),
        `update public.employees set is_active = false where id = $1`,
        [employeeIds.adminA],
      ),
    ).toMatch(/your own role/i);

    const [{ admins }] = (await world.db.query<{ admins: number }>(
      `select count(*)::int as admins from public.employees
       where municipality_id = $1 and role = 'municipality_admin' and is_active`,
      [ids.muniA],
    )) as [{ admins: number }];
    expect(admins).toBe(1);
  });

  it('never lets API users become platform admins', async () => {
    for (const actor of [ids.adminA, ids.citizenA1]) {
      expect(
        await world.db.fails(
          user(actor),
          `insert into public.platform_admins (user_id) values ($1)`,
          [actor],
        ),
      ).toMatch(DENIED);
    }
  });

  it('blocks writes to protected columns and tables', async () => {
    const attempts: [string, string, unknown[]][] = [
      [ids.adminA, `update public.municipalities set code = 'HACK' where id = $1`, [ids.muniA]],
      [ids.adminA, `update public.municipalities set status = 'active' where id = $1`, [ids.muniA]],
      [
        ids.adminA,
        `update public.employees set municipality_id = $2 where id = $1`,
        [employeeIds.employeeAX, ids.muniB],
      ],
      [ids.citizenA1, `update public.profiles set id = $1 where id = $1`, [ids.citizenA1]],
      [
        ids.citizenA1,
        `insert into public.notifications (user_id, type) values ($1, 'system')`,
        [ids.citizenA2],
      ],
      [ids.citizenA1, `update public.notifications set data = '{}'::jsonb`, []],
      [ids.adminA, `update public.audit_logs set action = 'nothing'`, []],
      [ids.adminA, `delete from public.audit_logs`, []],
      [
        ids.employeeAX,
        `update public.reports set priority = 'urgent' where id = $1`,
        [world.reports.assignedXA],
      ],
      [ids.employeeAX, `delete from public.report_status_history`, []],
      [
        ids.adminA,
        `insert into public.report_status_history (report_id, municipality_id, to_status) values ($1, $2, 'resolved')`,
        [world.reports.assignedXA, ids.muniA],
      ],
      [ids.citizenA1, `select private.write_audit($1, 'fake', 'report', null)`, [ids.muniA]],
    ];
    for (const [actor, sql, params] of attempts) {
      expect({ sql, error: await world.db.fails(user(actor), sql, params) }).toEqual({
        sql,
        error: expect.stringMatching(DENIED),
      });
    }
  });

  it('keeps the audit log append-only even for the database owner', async () => {
    await expect(world.db.query(`delete from public.audit_logs`)).rejects.toThrow(/append-only/);
    await expect(world.db.query(`update public.audit_logs set action = 'x'`)).rejects.toThrow(
      /append-only/,
    );
  });

  it('lets citizens edit only their own profile', async () => {
    const others = await world.db.as(
      user(ids.citizenA1),
      `update public.profiles set full_name = 'Hacked' where id <> $1 returning id`,
      [ids.citizenA1],
    );
    expect(others).toHaveLength(0);
    const own = await world.db.as(
      user(ids.citizenA1),
      `update public.profiles set full_name = 'Renamed', preferred_locale = 'ar' where id = $1 returning id`,
      [ids.citizenA1],
    );
    expect(own).toHaveLength(1);
  });

  it('treats a request without a verified user id as unauthenticated', async () => {
    expect(
      await world.db.fails(
        { role: 'authenticated', userId: '' },
        `select * from public.submit_report($1, 'pothole', 'A deep pothole near the crossing', 32.02, 34.72)`,
        [ids.muniA],
      ),
    ).toMatch(/not authenticated/i);
  });
});
