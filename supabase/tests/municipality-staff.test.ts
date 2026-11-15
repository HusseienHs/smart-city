import { describe, expect, it } from 'vitest';

import { anon, type Actor, service, user } from './support/db';
import { employeeIds, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/** get_municipality_staff (20261108000300): the admin-only staff directory with names. */
describe('get_municipality_staff', () => {
  const world = useWorld();
  const call = (actor: Actor, municipalityId: string | null = ids.muniA) =>
    world.db.as<Record<string, unknown>>(
      actor,
      `select * from public.get_municipality_staff(p_municipality_id => $1)`,
      [municipalityId],
    );

  it('gives an active municipality admin every member, including deactivated ones, with names', async () => {
    const rows = await call(user(ids.adminA));
    const byId = new Map(rows.map((row) => [row.employee_id, row]));

    expect(byId.get(employeeIds.formerEmployeeAX)).toMatchObject({ is_active: false });
    expect(byId.get(employeeIds.formerEmployeeAX)!.full_name).toEqual(expect.any(String));
    expect(byId.get(employeeIds.employeeAX)).toMatchObject({
      is_active: true,
      role: 'employee',
      department_id: ids.deptAX,
    });
    // Only municipality A.
    expect(byId.has(employeeIds.adminB)).toBe(false);
    expect(byId.has(employeeIds.employeeBZ)).toBe(false);
    // Active members first.
    const firstInactive = rows.findIndex((row) => row.is_active === false);
    expect(rows.slice(firstInactive).every((row) => row.is_active === false)).toBe(true);
  });

  it('returns exactly the documented columns — no user ids or contact details', async () => {
    const [row] = await call(user(ids.adminA));
    expect(Object.keys(row!).sort()).toEqual(
      [
        'created_at',
        'department_id',
        'employee_id',
        'full_name',
        'is_active',
        'job_title',
        'role',
        'updated_at',
      ].sort(),
    );
    // User (profile) ids of the fixture world; ids also holds municipalities and departments.
    const userIds = new Set<string>(
      Object.values(ids).filter((value) => value.startsWith('00000000-0000-4000-8000-000000004')),
    );
    expect(userIds.has(ids.adminA)).toBe(true);
    for (const value of (await call(user(ids.adminA))).flatMap((r) => Object.values(r))) {
      if (typeof value === 'string') expect(userIds.has(value)).toBe(false);
    }
  });

  it('refuses every other role of the municipality', async () => {
    for (const userId of [ids.managerAX, ids.employeeAX, ids.dispatcherA]) {
      await expect(call(user(userId))).rejects.toThrow(DENIED);
    }
  });

  it("refuses another municipality's admin, citizens, platform admins and former staff", async () => {
    for (const userId of [ids.adminB, ids.citizenA1, ids.platformAdmin, ids.formerEmployeeAX]) {
      await expect(call(user(userId))).rejects.toThrow(DENIED);
    }
    // B's admin gets B only.
    const rowsB = await call(user(ids.adminB), ids.muniB);
    expect(rowsB.map((row) => row.employee_id).sort()).toEqual(
      [employeeIds.adminB, employeeIds.employeeBZ].sort(),
    );
  });

  it('refuses a deactivated admin', async () => {
    await world.db.as(
      user(ids.adminA),
      `update public.employees set is_active = false where id = $1`,
      [employeeIds.admin2A],
    );
    await expect(call(user(ids.admin2A))).rejects.toThrow(DENIED);
  });

  it('refuses a null municipality, unauthenticated callers, anon and the service role', async () => {
    await expect(call(user(ids.adminA), null)).rejects.toThrow(DENIED);
    await expect(call(anon)).rejects.toThrow(DENIED);
    await expect(call(service)).rejects.toThrow(DENIED);
    const grants = await world.db.query<{ role: string; allowed: boolean }>(
      `select r as role, has_function_privilege(r, 'public.get_municipality_staff(uuid)', 'EXECUTE') as allowed
       from unnest(array['anon', 'authenticated', 'service_role']) as r`,
    );
    expect(grants).toEqual([
      { role: 'anon', allowed: false },
      { role: 'authenticated', allowed: true },
      { role: 'service_role', allowed: false },
    ]);
  });

  it('is read-only, SECURITY DEFINER and pins an empty search_path', async () => {
    const [fn] = await world.db.query<{ volatile: string; definer: boolean; config: string[] }>(
      `select provolatile as volatile, prosecdef as definer, proconfig as config
       from pg_proc where oid = 'public.get_municipality_staff(uuid)'::regprocedure`,
    );
    expect(fn).toEqual({ volatile: 's', definer: true, config: ['search_path=""'] });
  });
});
