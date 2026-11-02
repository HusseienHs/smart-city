import { describe, expect, it } from 'vitest';

import { user } from './support/db';
import { ids } from './support/fixtures';
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
    // Staff can see colleagues' names, but never citizen profiles.
    expect(
      await world.db.as(user(ids.adminA), `select * from public.profiles where id = $1`, [
        ids.citizenA1,
      ]),
    ).toHaveLength(0);
    expect(
      await world.db.as(user(ids.adminA), `select full_name from public.profiles where id = $1`, [
        ids.employeeAX,
      ]),
    ).toEqual([{ full_name: 'Employee AX' }]);
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
