import { describe, expect, it } from 'vitest';

import { anon, user } from './support/db';
import { employeeIds, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

type Membership = {
  employee_id: string;
  municipality_id: string;
  municipality_code: string;
  municipality_status: string;
  role: string;
  department_id: string | null;
  department_name: unknown;
};

const MEMBERSHIPS = `select employee_id, municipality_id, municipality_code, municipality_status,
                            role, department_id, department_name
                     from public.get_my_staff_memberships()`;

/**
 * The admin dashboard's staff context: get_my_staff_memberships() returns the caller's own
 * active memberships and nothing about anyone else.
 */
describe('get_my_staff_memberships', () => {
  const world = useWorld();

  it('returns exactly the caller’s own membership, with role and department', async () => {
    const rows = await world.db.as<Membership>(user(ids.managerAX), MEMBERSHIPS);
    expect(rows).toEqual([
      {
        employee_id: employeeIds.managerAX,
        municipality_id: ids.muniA,
        municipality_code: 'TSA',
        municipality_status: 'active',
        role: 'department_manager',
        department_id: ids.deptAX,
        department_name: { he: 'כבישים' },
      },
    ]);
  });

  it('never returns colleagues, although the employees table shows them', async () => {
    const visible = await world.db.as(user(ids.adminA), `select id from public.employees`);
    expect(visible.length).toBeGreaterThan(1);

    const own = await world.db.as<Membership>(user(ids.adminA), MEMBERSHIPS);
    expect(own.map((row) => row.employee_id)).toEqual([employeeIds.adminA]);
  });

  it('roles without a department return no department', async () => {
    const [dispatcher] = await world.db.as<Membership>(user(ids.dispatcherA), MEMBERSHIPS);
    expect(dispatcher).toMatchObject({ role: 'intake_dispatcher', department_id: null });
  });

  it('a deactivated membership grants nothing and is not returned', async () => {
    expect(await world.db.as(user(ids.formerEmployeeAX), MEMBERSHIPS)).toEqual([]);
  });

  it('citizens and platform admins without a membership get an empty list', async () => {
    expect(await world.db.as(user(ids.citizenA1), MEMBERSHIPS)).toEqual([]);
    expect(await world.db.as(user(ids.platformAdmin), MEMBERSHIPS)).toEqual([]);
  });

  it('lists every municipality of staff who work for more than one', async () => {
    // employeeBZ also joins municipality A as a dispatcher.
    await world.db.query(
      `insert into public.employees (user_id, municipality_id, role) values ($1, $2, 'intake_dispatcher')`,
      [ids.employeeBZ, ids.muniA],
    );
    const rows = await world.db.as<Membership>(user(ids.employeeBZ), MEMBERSHIPS);
    expect(rows.map((row) => [row.municipality_code, row.role])).toEqual([
      ['TSA', 'intake_dispatcher'],
      ['TSB', 'employee'],
    ]);
  });

  it('reflects deactivation immediately (no stale access)', async () => {
    await world.db.as(
      user(ids.adminA),
      `update public.employees set is_active = false where id = $1`,
      [employeeIds.employeeAX],
    );
    expect(await world.db.as(user(ids.employeeAX), MEMBERSHIPS)).toEqual([]);
  });

  it('reports a suspended municipality instead of hiding the membership', async () => {
    await world.db.query(`update public.municipalities set status = 'suspended' where id = $1`, [
      ids.muniB,
    ]);
    const [row] = await world.db.as<Membership>(user(ids.adminB), MEMBERSHIPS);
    expect(row).toMatchObject({ municipality_id: ids.muniB, municipality_status: 'suspended' });
  });

  it('is not available to anonymous visitors', async () => {
    await expect(world.db.as(anon, MEMBERSHIPS)).rejects.toThrow(DENIED);
  });

  it('cannot be pointed at someone else: it takes no arguments', async () => {
    await expect(
      world.db.as(user(ids.citizenA1), `select * from public.get_my_staff_memberships($1)`, [
        ids.adminA,
      ]),
    ).rejects.toThrow(/function .* does not exist/i);
  });
});

describe('platform admin flag', () => {
  const world = useWorld();
  const PLATFORM = `select user_id from public.platform_admins`;

  it('each user sees only their own platform-admin row', async () => {
    expect(await world.db.as(user(ids.platformAdmin), PLATFORM)).toEqual([
      { user_id: ids.platformAdmin },
    ]);
    expect(await world.db.as(user(ids.adminA), PLATFORM)).toEqual([]);
    expect(await world.db.as(user(ids.citizenA1), PLATFORM)).toEqual([]);
  });
});
