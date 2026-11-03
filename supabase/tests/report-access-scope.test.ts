import { describe, expect, it } from 'vitest';

import { type Actor, user } from './support/db';
import { employeeIds, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/**
 * Staff report access after the hosted security review (migration …000700):
 *   admin      → every report of their municipality
 *   manager    → reports of their own department
 *   employee   → only reports assigned to them, within their own department
 *   dispatcher → only reports with no department and no assignee
 * Inactive or missing membership → nothing; other municipalities → nothing.
 * Citizens keep their own, separate access through reporter_id.
 */
describe('report access scope', () => {
  const world = useWorld();
  const adminA = user(ids.adminA);
  const employeeAX = user(ids.employeeAX);
  const dispatcherA = user(ids.dispatcherA);

  const visible = async (actor: Actor) =>
    (await world.db.as<{ id: string }>(actor, `select id from public.reports`)).map((r) => r.id);

  /** Calls the access function directly (it is executable by `authenticated` for RLS). */
  const canAccess = async (
    actor: Actor,
    municipalityId: string,
    departmentId: string | null,
    assigneeId: string | null,
  ) => {
    const [row] = await world.db.as<{ ok: boolean }>(
      actor,
      `select private.can_access_report($1, $2, $3) as ok`,
      [municipalityId, departmentId, assigneeId],
    );
    return row!.ok;
  };

  /** A new citizen report in A, routed to a department (optionally assigned) by the admin. */
  const routedReport = async (departmentId: string, assigneeId: string | null = null) => {
    const [created] = await world.db.as<{ report_id: string }>(
      user(ids.citizenA2),
      `select report_id from public.submit_report($1, 'road', 'Cracked asphalt on the main road', 32.06, 34.76)`,
      [ids.muniA],
    );
    await world.db.as(adminA, `select public.assign_report($1, $2, $3)`, [
      created!.report_id,
      departmentId,
      assigneeId,
    ]);
    return created!.report_id;
  };

  it('1. lets a municipality admin access reports across all departments and intake', async () => {
    const seen = await visible(adminA);
    for (const report of [
      world.reports.assignedXA,
      world.reports.assignedYA,
      world.reports.publicUnassignedA,
      world.reports.privateNoiseA,
    ]) {
      expect(seen).toContain(report);
    }
  });

  it("2. lets a department manager access their department's reports, assigned or not", async () => {
    const unassignedX = await routedReport(ids.deptAX);
    const seen = await visible(user(ids.managerAX));
    expect(seen).toContain(world.reports.assignedXA);
    expect(seen).toContain(unassignedX);
  });

  it("3. denies a department manager another department's reports", async () => {
    expect(await visible(user(ids.managerAX))).not.toContain(world.reports.assignedYA);
    expect(await visible(user(ids.managerAY))).not.toContain(world.reports.assignedXA);
    expect(
      await world.db.fails(
        user(ids.managerAX),
        `select public.update_report_status($1, 'in_progress')`,
        [world.reports.assignedYA],
      ),
    ).toMatch(DENIED);
  });

  it('4. lets an employee access a report assigned to them in their department', async () => {
    expect(await visible(employeeAX)).toEqual([world.reports.assignedXA]);
    await world.db.as(employeeAX, `select public.update_report_status($1, 'in_progress')`, [
      world.reports.assignedXA,
    ]);
  });

  it('5. denies an employee an unassigned report, even in their department', async () => {
    const unassignedX = await routedReport(ids.deptAX);
    expect(await visible(employeeAX)).not.toContain(unassignedX);
    expect(
      await world.db.fails(employeeAX, `select public.update_report_status($1, 'in_progress')`, [
        unassignedX,
      ]),
    ).toMatch(DENIED);
    expect(
      await world.db.fails(employeeAX, `select public.add_report_comment($1, 'note', true)`, [
        unassignedX,
      ]),
    ).toMatch(DENIED);
  });

  it('6. denies an employee a report assigned to another employee of the same department', async () => {
    const employeeAX2 = user(ids.employeeAX2);
    // Employee B (AX2) and employee A (AX) are both ordinary, active employees of department X.
    const reportOfB = await routedReport(ids.deptAX, employeeIds.employeeAX2);

    // Positive control: B can access and work on their own assignment.
    expect(await visible(employeeAX2)).toEqual([reportOfB]);
    await world.db.as(employeeAX2, `select public.update_report_status($1, 'in_progress')`, [
      reportOfB,
    ]);

    // A cannot see it, act on it, comment on it, or reach the reporter's contact details…
    expect(await visible(employeeAX)).not.toContain(reportOfB);
    for (const sql of [
      `select public.update_report_status($1, 'resolved', 'Fixed the asphalt', true)`,
      `select public.add_report_comment($1, 'note', true)`,
      `select * from public.get_report_reporter_contact($1)`,
    ]) {
      expect(await world.db.fails(employeeAX, sql, [reportOfB])).toMatch(DENIED);
    }
    // …and the reverse holds: B cannot access A's assignment.
    expect(await visible(employeeAX2)).not.toContain(world.reports.assignedXA);

    // Same for a report assigned to the department manager.
    const reportOfManager = await routedReport(ids.deptAX, employeeIds.managerAX);
    expect(await visible(employeeAX)).not.toContain(reportOfManager);
  });

  it("7. denies an employee another department's reports, even if assigned to them", async () => {
    const assignedToAY = await routedReport(ids.deptAY, employeeIds.employeeAY);
    const seen = await visible(employeeAX);
    expect(seen).not.toContain(world.reports.assignedYA);
    expect(seen).not.toContain(assignedToAY);
    // A stale assignment outside their current department grants nothing.
    expect(await canAccess(employeeAX, ids.muniA, ids.deptAY, employeeIds.employeeAX)).toBe(false);
  });

  it('8. lets a dispatcher access reports with no department and no assignee', async () => {
    const seen = await visible(dispatcherA);
    expect(seen.sort()).toEqual(
      [world.reports.publicUnassignedA, world.reports.privateNoiseA].sort(),
    );
    expect(await canAccess(dispatcherA, ids.muniA, null, null)).toBe(true);
  });

  it('9. denies a dispatcher reports that have a department', async () => {
    expect(await visible(dispatcherA)).not.toContain(world.reports.assignedYA); // department, no assignee
    expect(
      await world.db.fails(dispatcherA, `select public.update_report_status($1, 'rejected')`, [
        world.reports.assignedYA,
      ]),
    ).toMatch(DENIED);
    expect(await canAccess(dispatcherA, ids.muniA, ids.deptAY, null)).toBe(false);
  });

  it('10. denies a dispatcher reports that have an assignee', async () => {
    expect(await visible(dispatcherA)).not.toContain(world.reports.assignedXA);
    // "No department but an assignee" cannot exist as data (table constraint)…
    await expect(
      world.db.query(`update public.reports set department_id = null where id = $1`, [
        world.reports.assignedXA,
      ]),
    ).rejects.toThrow(/check constraint/i);
    // …and the function denies it anyway (defense in depth).
    expect(await canAccess(dispatcherA, ids.muniA, null, employeeIds.employeeAX)).toBe(false);
  });

  it('11. gives inactive staff no access, even to reports still assigned to them', async () => {
    const report = await routedReport(ids.deptAX);
    // Owner-level setup: point an assignment at the inactive membership.
    await world.db.query(`update public.reports set assignee_id = $2 where id = $1`, [
      report,
      employeeIds.formerEmployeeAX,
    ]);
    const former = user(ids.formerEmployeeAX);
    expect(await visible(former)).toEqual([]);
    expect(await canAccess(former, ids.muniA, ids.deptAX, employeeIds.formerEmployeeAX)).toBe(
      false,
    );

    // Deactivating an assigned employee removes their access immediately.
    await world.db.as(adminA, `update public.employees set is_active = false where id = $1`, [
      employeeIds.employeeAX,
    ]);
    expect(await visible(employeeAX)).toEqual([]);

    // A signed-in user with no membership at all has no staff access either.
    expect(await canAccess(user(ids.citizenA1), ids.muniA, null, null)).toBe(false);
  });

  it('12. denies every cross-municipality access', async () => {
    const reportsOfA = [
      world.reports.publicUnassignedA,
      world.reports.privateNoiseA,
      world.reports.assignedXA,
      world.reports.assignedYA,
    ];
    for (const actor of [user(ids.adminB), user(ids.employeeBZ)]) {
      const seen = await visible(actor);
      for (const report of reportsOfA) expect(seen).not.toContain(report);
    }
    // Positive control: B's admin does see B's own report.
    expect(await visible(user(ids.adminB))).toEqual([world.reports.assignedZB]);
    // Even with matching-looking arguments, a membership elsewhere grants nothing in A.
    expect(
      await canAccess(user(ids.employeeBZ), ids.muniA, ids.deptBZ, employeeIds.employeeBZ),
    ).toBe(false);
    expect(await canAccess(user(ids.adminB), ids.muniA, null, null)).toBe(false);
    expect(await canAccess(adminA, ids.muniB, ids.deptBZ, null)).toBe(false);
  });

  it('keeps EXECUTE on the access function limited to authenticated (and its owner)', async () => {
    const [fn] = await world.db.query<{
      owner: string;
      grants: string[];
      security_definer: boolean;
      config: string[];
    }>(
      `select p.proowner::regrole::text as owner,
              array(select a.grantee::regrole::text || ':' || a.privilege_type
                    from aclexplode(p.proacl) a order by 1) as grants,
              p.prosecdef as security_definer,
              p.proconfig as config
       from pg_proc p where p.oid = 'private.can_access_report(uuid, uuid, uuid)'::regprocedure`,
    );
    expect(fn!.grants).toEqual([`${fn!.owner}:EXECUTE`, 'authenticated:EXECUTE'].sort());
    expect(fn!.security_definer).toBe(true);
    expect(fn!.config).toEqual(['search_path=""']);
    for (const role of ['anon', 'service_role']) {
      const [row] = await world.db.query<{ allowed: boolean }>(
        `select has_function_privilege($1, 'private.can_access_report(uuid, uuid, uuid)', 'EXECUTE') as allowed`,
        [role],
      );
      expect({ role, allowed: row!.allowed }).toEqual({ role, allowed: false });
    }
  });

  it('13. keeps citizen access to their own reports through the dedicated mechanisms', async () => {
    const citizen = user(ids.citizenA2);
    // No staff path: the reports table shows nothing to a citizen…
    expect(await visible(citizen)).toEqual([]);
    expect(await canAccess(citizen, ids.muniA, ids.deptAX, employeeIds.employeeAX)).toBe(false);
    // …while reporter_id-based functions still work, regardless of assignment.
    const own = await world.db.as<{ id: string }>(
      citizen,
      `select id from public.get_my_reports()`,
    );
    expect(own.map((r) => r.id).sort()).toEqual(
      [world.reports.assignedXA, world.reports.assignedYA].sort(),
    );
    const updates = await world.db.as(citizen, `select * from public.get_my_report_updates($1)`, [
      world.reports.assignedYA,
    ]);
    expect(updates.length).toBeGreaterThan(0);
    await world.db.as(citizen, `select public.add_report_comment($1, 'Any news?')`, [
      world.reports.assignedYA,
    ]);
    const comments = await world.db.as<{ body: string }>(
      citizen,
      `select body from public.get_my_report_comments($1)`,
      [world.reports.assignedYA],
    );
    expect(comments.map((c) => c.body)).toContain('Any news?');
  });
});
