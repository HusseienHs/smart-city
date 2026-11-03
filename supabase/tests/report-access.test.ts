import { describe, expect, it } from 'vitest';

import { anon, type Actor, user } from './support/db';
import { type FixtureReports, employeeIds, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/** Department-scoped access inside a municipality, including the intake dispatcher role. */
describe('report access within a municipality', () => {
  const world = useWorld();

  const visible = async (actor: Actor) =>
    (await world.db.as<{ id: string }>(actor, `select id from public.reports order by id`))
      .map((row) => row.id)
      .sort();

  const pick = (...keys: (keyof FixtureReports)[]) => keys.map((key) => world.reports[key]).sort();

  it('scopes report visibility by role and department', async () => {
    expect(await visible(user(ids.employeeAX))).toEqual(pick('assignedXA'));
    expect(await visible(user(ids.managerAX))).toEqual(pick('assignedXA'));
    // Employees see only reports assigned to them; Y's report is routed but unassigned.
    expect(await visible(user(ids.employeeAY))).toEqual([]);
    expect(await visible(user(ids.managerAY))).toEqual(pick('assignedYA'));
    expect(await visible(user(ids.dispatcherA))).toEqual(
      pick('publicUnassignedA', 'privateNoiseA'),
    );
    expect(await visible(user(ids.adminA))).toEqual(
      pick('publicUnassignedA', 'privateNoiseA', 'assignedXA', 'assignedYA'),
    );
    expect(await visible(user(ids.adminB))).toEqual(pick('assignedZB'));
  });

  it('gives no direct report access to citizens (even their own), former staff or platform admins', async () => {
    expect(await visible(user(ids.citizenA1))).toEqual([]);
    expect(await visible(user(ids.formerEmployeeAX))).toEqual([]);
    expect(await visible(user(ids.platformAdmin))).toEqual([]);
    expect(await world.db.fails(anon, `select id from public.reports`)).toMatch(DENIED);
  });

  it("lets an employee update their department's report but not another department's", async () => {
    await world.db.as(
      user(ids.employeeAX),
      `select public.update_report_status($1, 'in_progress')`,
      [world.reports.assignedXA],
    );
    expect(
      await world.db.fails(
        user(ids.employeeAY),
        `select public.update_report_status($1, 'in_progress')`,
        [world.reports.assignedXA],
      ),
    ).toMatch(DENIED);
  });

  it('removes access immediately when an employee is deactivated', async () => {
    await world.db.as(
      user(ids.adminA),
      `update public.employees set is_active = false where id = $1`,
      [employeeIds.employeeAX],
    );
    expect(await visible(user(ids.employeeAX))).toEqual([]);
    expect(
      await world.db.fails(
        user(ids.employeeAX),
        `select public.update_report_status($1, 'in_progress')`,
        [world.reports.assignedXA],
      ),
    ).toMatch(DENIED);
  });

  describe('intake dispatcher', () => {
    const dispatcher = user(ids.dispatcherA);

    it('triages unassigned reports: review or reject only', async () => {
      await world.db.as(dispatcher, `select public.update_report_status($1, 'under_review')`, [
        world.reports.publicUnassignedA,
      ]);
      expect(
        await world.db.fails(dispatcher, `select public.update_report_status($1, 'in_progress')`, [
          world.reports.publicUnassignedA,
        ]),
      ).toMatch(/dispatchers can only/i);
    });

    it('routes a report to a department and then loses access to it', async () => {
      await world.db.as(dispatcher, `select public.assign_report($1, $2, null, 'high')`, [
        world.reports.publicUnassignedA,
        ids.deptAY,
      ]);
      const [routed] = await world.db.query<{
        status: string;
        department_id: string;
        priority: string;
      }>(`select status, department_id, priority from public.reports where id = $1`, [
        world.reports.publicUnassignedA,
      ]);
      expect(routed).toEqual({ status: 'assigned', department_id: ids.deptAY, priority: 'high' });
      expect(await visible(dispatcher)).toEqual([world.reports.privateNoiseA]);
    });

    it('cannot assign individual employees or touch assigned reports', async () => {
      expect(
        await world.db.fails(dispatcher, `select public.assign_report($1, $2, $3)`, [
          world.reports.publicUnassignedA,
          ids.deptAX,
          employeeIds.employeeAX,
        ]),
      ).toMatch(/dispatchers route/i);
      expect(
        await world.db.fails(dispatcher, `select public.update_report_status($1, 'rejected')`, [
          world.reports.assignedXA,
        ]),
      ).toMatch(DENIED);
    });
  });

  describe('department manager', () => {
    const manager = user(ids.managerAX);

    it('assigns within their department and can return a report to intake', async () => {
      await world.db.as(manager, `select public.assign_report($1, $2, $3)`, [
        world.reports.assignedXA,
        ids.deptAX,
        employeeIds.managerAX,
      ]);
      await world.db.as(manager, `select public.assign_report($1, null)`, [
        world.reports.assignedXA,
      ]);
      const [returned] = await world.db.query<{ status: string; department_id: string | null }>(
        `select status, department_id from public.reports where id = $1`,
        [world.reports.assignedXA],
      );
      expect(returned).toEqual({ status: 'under_review', department_id: null });
    });

    it('cannot transfer a report to another department', async () => {
      expect(
        await world.db.fails(manager, `select public.assign_report($1, $2)`, [
          world.reports.assignedXA,
          ids.deptAY,
        ]),
      ).toMatch(/only assign within their department/i);
    });
  });

  it('does not let regular employees assign reports', async () => {
    expect(
      await world.db.fails(user(ids.employeeAX), `select public.assign_report($1, $2, $3)`, [
        world.reports.assignedXA,
        ids.deptAX,
        employeeIds.employeeAX,
      ]),
    ).toMatch(/employees cannot assign/i);
  });

  it('only assigns employees who belong to the target department', async () => {
    expect(
      await world.db.fails(user(ids.adminA), `select public.assign_report($1, $2, $3)`, [
        world.reports.assignedXA,
        ids.deptAX,
        employeeIds.employeeAY,
      ]),
    ).toMatch(/active member of that department/i);
    expect(
      await world.db.fails(user(ids.adminA), `select public.assign_report($1, $2, $3)`, [
        world.reports.assignedXA,
        ids.deptAX,
        employeeIds.formerEmployeeAX,
      ]),
    ).toMatch(/active member of that department/i);
  });
});
