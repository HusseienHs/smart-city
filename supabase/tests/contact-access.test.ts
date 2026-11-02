import { describe, expect, it } from 'vitest';

import { user } from './support/db';
import { employeeIds, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/** Phone numbers: optional, never public, only for handlers of the report, always audited. */
describe('reporter contact details', () => {
  const world = useWorld();
  const contactSql = `select * from public.get_report_reporter_contact($1)`;

  const contactAudits = () =>
    world.db.query<{ actor_id: string; entity_id: string }>(
      `select actor_id, entity_id from public.audit_logs where action = 'report.reporter_contact_viewed' order by id`,
    );

  it('lets the handling staff read the contact and records the access', async () => {
    const [contact] = await world.db.as<{ full_name: string; phone: string | null }>(
      user(ids.adminA),
      contactSql,
      [world.reports.publicUnassignedA],
    );
    expect(contact).toEqual({ full_name: 'Citizen A One', phone: '+972000000001' });

    const [assigned] = await world.db.as<{ phone: string | null }>(
      user(ids.employeeAX),
      contactSql,
      [world.reports.assignedXA],
    );
    expect(assigned!.phone).toBeNull(); // citizen A2 never provided a phone number

    expect(await contactAudits()).toEqual([
      { actor_id: ids.adminA, entity_id: world.reports.publicUnassignedA },
      { actor_id: ids.employeeAX, entity_id: world.reports.assignedXA },
    ]);
  });

  it('denies everyone who is not handling the report, without logging a view', async () => {
    const denied: [string, string][] = [
      [ids.dispatcherA, world.reports.publicUnassignedA], // triage only
      [ids.employeeAY, world.reports.assignedXA], // other department
      [ids.managerAY, world.reports.assignedXA],
      [ids.adminB, world.reports.publicUnassignedA], // other municipality
      [ids.platformAdmin, world.reports.publicUnassignedA],
      [ids.citizenA2, world.reports.publicUnassignedA],
      [ids.citizenA1, world.reports.publicUnassignedA], // even the reporter uses their profile, not this
      [ids.formerEmployeeAX, world.reports.assignedXA],
    ];
    for (const [actor, report] of denied) {
      expect(await world.db.fails(user(actor), contactSql, [report])).toMatch(DENIED);
    }
    expect(await contactAudits()).toEqual([]);
  });

  it('keeps phone numbers out of every table staff can read', async () => {
    for (const actor of [ids.adminA, ids.employeeAX, ids.dispatcherA, ids.citizenA2]) {
      expect(await world.db.as(user(actor), `select * from public.profile_contacts`)).toHaveLength(
        0,
      );
    }
    // Nobody reads anyone else's profile — not citizens', not colleagues' (F1, F4).
    for (const target of [ids.citizenA1, ids.employeeAX]) {
      expect(
        await world.db.as(user(ids.adminA), `select * from public.profiles where id = $1`, [
          target,
        ]),
      ).toHaveLength(0);
    }
  });

  it("doesn't let staff read reporter ids directly (F1)", async () => {
    for (const actor of [ids.adminA, ids.employeeAX, ids.dispatcherA]) {
      expect(await world.db.fails(user(actor), `select reporter_id from public.reports`)).toMatch(
        DENIED,
      );
      expect(await world.db.fails(user(actor), `select * from public.reports`)).toMatch(DENIED);
      expect(
        await world.db.fails(user(actor), `select author_id from public.report_comments`),
      ).toMatch(DENIED);
      expect(
        await world.db.fails(user(actor), `select changed_by from public.report_status_history`),
      ).toMatch(DENIED);
      expect(
        await world.db.fails(user(actor), `select uploaded_by from public.report_attachments`),
      ).toMatch(DENIED);
    }
  });

  it('attributes report activity to employees or "the reporter", never to a user id (F1)', async () => {
    await world.db.as(user(ids.citizenA2), `select public.add_report_comment($1, 'Any update?')`, [
      world.reports.assignedXA,
    ]);
    await world.db.as(
      user(ids.employeeAX),
      `select public.add_report_comment($1, 'Crew scheduled', false)`,
      [world.reports.assignedXA],
    );
    const comments = await world.db.as<{
      author_employee_id: string | null;
      from_reporter: boolean;
    }>(
      user(ids.adminA),
      `select author_employee_id, from_reporter from public.report_comments
       where report_id = $1 order by created_at`,
      [world.reports.assignedXA],
    );
    expect(comments).toEqual([
      { author_employee_id: null, from_reporter: true },
      { author_employee_id: employeeIds.employeeAX, from_reporter: false },
    ]);

    const history = await world.db.as<{ to_status: string; changed_by_employee_id: string | null }>(
      user(ids.adminA),
      `select to_status, changed_by_employee_id from public.report_status_history
       where report_id = $1 order by created_at`,
      [world.reports.assignedXA],
    );
    expect(history).toEqual([
      { to_status: 'submitted', changed_by_employee_id: null },
      { to_status: 'assigned', changed_by_employee_id: employeeIds.adminA },
    ]);
  });

  describe('colleague names (F4)', () => {
    it('returns names of active staff only, with no personal profile fields', async () => {
      const colleagues = await world.db.as<Record<string, unknown>>(
        user(ids.employeeAX),
        `select * from public.get_colleagues($1)`,
        [ids.muniA],
      );
      expect(Object.keys(colleagues[0]!).sort()).toEqual(
        ['department_id', 'employee_id', 'full_name', 'job_title', 'role'].sort(),
      );
      const names = colleagues.map((row) => row.full_name);
      expect(names).toContain('Employee AX');
      expect(names).toContain('Dispatcher A');
      expect(names).not.toContain('Former Employee AX'); // inactive
      expect(names).not.toContain('Citizen A One');
      expect(names).not.toContain('Admin B');
    });

    it('returns nothing to citizens, former staff or other municipalities', async () => {
      for (const actor of [ids.citizenA1, ids.formerEmployeeAX, ids.adminB, ids.platformAdmin]) {
        expect(
          await world.db.as(user(actor), `select * from public.get_colleagues($1)`, [ids.muniA]),
        ).toHaveLength(0);
      }
    });

    it('hides inactive memberships from non-admin colleagues', async () => {
      const visible = (
        await world.db.as<{ id: string }>(user(ids.employeeAX), `select id from public.employees`)
      ).map((row) => row.id);
      expect(visible).not.toContain(employeeIds.formerEmployeeAX);
      const adminView = (
        await world.db.as<{ id: string }>(user(ids.adminA), `select id from public.employees`)
      ).map((row) => row.id);
      expect(adminView).toContain(employeeIds.formerEmployeeAX);
    });
  });

  it('lets citizens manage only their own phone number, and report without one', async () => {
    const own = await world.db.as(user(ids.citizenA1), `select phone from public.profile_contacts`);
    expect(own).toEqual([{ phone: '+972000000001' }]);

    expect(
      await world.db.fails(
        user(ids.citizenA2),
        `insert into public.profile_contacts (user_id, phone) values ($1, '+972000000002')`,
        [ids.citizenA1],
      ),
    ).toMatch(DENIED);
    const changed = await world.db.as(
      user(ids.citizenA2),
      `update public.profile_contacts set phone = '+972000000002' where user_id = $1 returning 1`,
      [ids.citizenA1],
    );
    expect(changed).toHaveLength(0);

    // citizenA2 has no phone and can still submit.
    const [created] = await world.db.as<{ tracking_number: string }>(
      user(ids.citizenA2),
      `select * from public.submit_report($1, 'garbage', 'Overflowing bins on the corner', 32.03, 34.73)`,
      [ids.muniA],
    );
    expect(created!.tracking_number).toMatch(/^TSA-/);
  });
});
