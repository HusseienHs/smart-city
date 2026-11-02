import { describe, expect, it } from 'vitest';

import { user } from './support/db';
import { employeeIds, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/**
 * Moving an employee to another department removes their access to the previous
 * department immediately, and hands their open reports over in the same transaction.
 */
describe('department transfers', () => {
  const world = useWorld();
  const adminA = user(ids.adminA);
  const employeeAX = user(ids.employeeAX);

  const visible = async () =>
    (await world.db.as<{ id: string }>(employeeAX, `select id from public.reports`)).map(
      (r) => r.id,
    );

  const assigneeOf = async (reportId: string) =>
    (
      await world.db.query<{ assignee_id: string | null; department_id: string }>(
        `select assignee_id, department_id from public.reports where id = $1`,
        [reportId],
      )
    )[0]!;

  it('removes access to the previous department immediately', async () => {
    expect(await visible()).toEqual([world.reports.assignedXA]);
    await world.db.as(adminA, `select public.set_employee_role($1, 'employee', $2)`, [
      employeeIds.employeeAX,
      ids.deptAY,
    ]);
    expect(await visible()).toEqual([world.reports.assignedYA]);
    expect(
      await world.db.fails(employeeAX, `select public.update_report_status($1, 'in_progress')`, [
        world.reports.assignedXA,
      ]),
    ).toMatch(DENIED);
    expect(
      await world.db.fails(employeeAX, `select * from public.get_report_reporter_contact($1)`, [
        world.reports.assignedXA,
      ]),
    ).toMatch(DENIED);
  });

  it('returns open reports to the previous department queue by default', async () => {
    const [{ moved }] = (await world.db.as<{ moved: number }>(
      adminA,
      `select public.set_employee_role($1, 'employee', $2) as moved`,
      [employeeIds.employeeAX, ids.deptAY],
    )) as [{ moved: number }];
    expect(moved).toBe(1);
    expect(await assigneeOf(world.reports.assignedXA)).toEqual({
      assignee_id: null,
      department_id: ids.deptAX,
    });
    // The previous department's manager still sees it and can reassign.
    const managerView = await world.db.as<{ id: string }>(
      user(ids.managerAX),
      `select id from public.reports`,
    );
    expect(managerView.map((r) => r.id)).toContain(world.reports.assignedXA);

    const [audit] = await world.db.as<{ details: { reason: string } }>(
      adminA,
      `select details from public.get_audit_log($1) where action = 'report.reassigned' and entity_id = $2`,
      [ids.muniA, world.reports.assignedXA],
    );
    expect(audit!.details.reason).toBe('employee_transfer');
  });

  it('can hand open reports to a colleague of the previous department', async () => {
    await world.db.as(adminA, `select public.set_employee_role($1, 'employee', $2, $3)`, [
      employeeIds.employeeAX,
      ids.deptAY,
      employeeIds.managerAX,
    ]);
    expect((await assigneeOf(world.reports.assignedXA)).assignee_id).toBe(employeeIds.managerAX);
  });

  it('only hands reports to active members of the previous department', async () => {
    for (const target of [
      employeeIds.employeeAY,
      employeeIds.formerEmployeeAX,
      employeeIds.employeeAX,
    ]) {
      expect(
        await world.db.fails(adminA, `select public.set_employee_role($1, 'employee', $2, $3)`, [
          employeeIds.employeeAX,
          ids.deptAY,
          target,
        ]),
      ).toMatch(/previous department/i);
    }
    expect(
      await world.db.fails(
        adminA,
        `select public.set_employee_role($1, 'department_manager', $2, $3)`,
        [employeeIds.employeeAX, ids.deptAX, employeeIds.managerAX],
      ),
    ).toMatch(/only applies when the employee leaves/i);
  });

  it('releases assignments when the employee becomes a dispatcher or is deactivated', async () => {
    await world.db.as(adminA, `select public.set_employee_role($1, 'intake_dispatcher', null)`, [
      employeeIds.employeeAX,
    ]);
    expect((await assigneeOf(world.reports.assignedXA)).assignee_id).toBeNull();
  });

  it('releases open assignments on deactivation', async () => {
    await world.db.as(adminA, `update public.employees set is_active = false where id = $1`, [
      employeeIds.employeeAX,
    ]);
    expect((await assigneeOf(world.reports.assignedXA)).assignee_id).toBeNull();
    expect(await visible()).toEqual([]);
  });

  it('keeps finished reports historically assigned but still removes access', async () => {
    await world.db.as(employeeAX, `select public.update_report_status($1, 'in_progress')`, [
      world.reports.assignedXA,
    ]);
    await world.db.as(
      employeeAX,
      `select public.update_report_status($1, 'resolved', 'Replaced the lamp', true)`,
      [world.reports.assignedXA],
    );
    await world.db.as(adminA, `select public.set_employee_role($1, 'employee', $2)`, [
      employeeIds.employeeAX,
      ids.deptAY,
    ]);
    expect((await assigneeOf(world.reports.assignedXA)).assignee_id).toBe(employeeIds.employeeAX);
    expect(await visible()).not.toContain(world.reports.assignedXA);
  });

  it('cannot move an employee into another municipality’s department', async () => {
    expect(
      await world.db.fails(adminA, `select public.set_employee_role($1, 'employee', $2)`, [
        employeeIds.employeeAX,
        ids.deptBZ,
      ]),
    ).toMatch(/department not found/i);
  });
});
