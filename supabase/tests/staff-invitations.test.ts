import { describe, expect, it } from 'vitest';

import { user } from './support/db';
import { ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/**
 * F1: staff access exists only after the intended user (verified email) accepts an
 * invitation. Creating a record can never grant someone staff access by itself.
 */
describe('staff invitations', () => {
  const world = useWorld();
  const adminA = user(ids.adminA);

  const newUser = async (id: string, email: string, confirmed = true) => {
    await world.db.query(
      `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
       values ($1, $2, $3, '{"full_name": "Invited Person"}')`,
      [id, email, confirmed ? new Date().toISOString() : null],
    );
    return user(id);
  };

  const invite = async (
    email: string,
    role = 'employee',
    departmentId: string | null = ids.deptAX,
  ) => {
    const [row] = await world.db.as<{ id: string }>(
      adminA,
      `insert into public.staff_invitations (municipality_id, email, role, department_id)
       values ($1, $2, $3::public.staff_role, $4) returning id`,
      [ids.muniA, email, role, departmentId],
    );
    return row!.id;
  };

  const invitee = '00000000-0000-4000-8000-000000009001';
  const inviteeEmail = 'new.hire@example.test';

  it('creates a membership only when the intended user accepts', async () => {
    const person = await newUser(invitee, inviteeEmail);
    const invitationId = await invite('  New.Hire@Example.test ');

    // Before acceptance: no membership, no access.
    expect(await world.db.as(person, `select id from public.employees`)).toHaveLength(0);
    expect(await world.db.as(person, `select id from public.reports`)).toHaveLength(0);

    const pending = await world.db.as<{ id: string; role: string }>(
      person,
      `select id, role from public.get_my_staff_invitations()`,
    );
    expect(pending).toEqual([{ id: invitationId, role: 'employee' }]);

    await world.db.as(person, `select public.accept_staff_invitation($1)`, [invitationId]);
    const reports = await world.db.as<{ id: string }>(person, `select id from public.reports`);
    expect(reports.map((row) => row.id)).toEqual([world.reports.assignedXA]);

    const [invitation] = await world.db.query<{ status: string; accepted_user_id: string }>(
      `select status, accepted_user_id from public.staff_invitations where id = $1`,
      [invitationId],
    );
    expect(invitation).toEqual({ status: 'accepted', accepted_user_id: invitee });
  });

  it('cannot be accepted by anyone else', async () => {
    const invitationId = await invite(inviteeEmail);
    const other = await newUser(
      '00000000-0000-4000-8000-000000009002',
      'someone.else@example.test',
    );
    expect(
      await world.db.as(other, `select * from public.get_my_staff_invitations()`),
    ).toHaveLength(0);
    for (const actor of [other, user(ids.citizenA1), user(ids.employeeAY)]) {
      expect(
        await world.db.fails(actor, `select public.accept_staff_invitation($1)`, [invitationId]),
      ).toMatch(/not found or no longer valid/i);
    }
  });

  it('requires a confirmed email address', async () => {
    const unconfirmed = await newUser(invitee, inviteeEmail, false);
    const invitationId = await invite(inviteeEmail);
    expect(
      await world.db.fails(unconfirmed, `select public.accept_staff_invitation($1)`, [
        invitationId,
      ]),
    ).toMatch(/not found or no longer valid/i);
  });

  it('rejects revoked, declined and expired invitations', async () => {
    const person = await newUser(invitee, inviteeEmail);

    const revoked = await invite(inviteeEmail);
    await world.db.as(adminA, `select public.revoke_staff_invitation($1)`, [revoked]);
    expect(
      await world.db.fails(person, `select public.accept_staff_invitation($1)`, [revoked]),
    ).toMatch(/no longer valid/i);

    const declined = await invite(inviteeEmail);
    await world.db.as(person, `select public.decline_staff_invitation($1)`, [declined]);
    expect(
      await world.db.fails(person, `select public.accept_staff_invitation($1)`, [declined]),
    ).toMatch(/no longer valid/i);

    const expired = await invite(inviteeEmail);
    await world.db.query(
      `update public.staff_invitations set expires_at = now() - interval '1 minute' where id = $1`,
      [expired],
    );
    expect(
      await world.db.fails(person, `select public.accept_staff_invitation($1)`, [expired]),
    ).toMatch(/no longer valid/i);
  });

  it('lets only admins of the municipality create, list and revoke invitations', async () => {
    for (const actor of [
      ids.employeeAX,
      ids.managerAX,
      ids.dispatcherA,
      ids.citizenA1,
      ids.adminB,
    ]) {
      expect(
        await world.db.fails(
          user(actor),
          `insert into public.staff_invitations (municipality_id, email, role)
           values ($1, 'x@example.test', 'municipality_admin')`,
          [ids.muniA],
        ),
      ).toMatch(DENIED);
    }
    const invitationId = await invite(inviteeEmail);
    for (const actor of [ids.employeeAX, ids.citizenA1, ids.adminB]) {
      expect(
        await world.db.as(user(actor), `select id from public.staff_invitations`),
      ).toHaveLength(0);
      expect(
        await world.db.fails(user(actor), `select public.revoke_staff_invitation($1)`, [
          invitationId,
        ]),
      ).toMatch(/not found or no longer valid/i); // uniform denial: ids cannot be probed
    }
  });

  it("controls server-side fields and doesn't let an admin accept their own invitation", async () => {
    const [created] = await world.db.as<{ id: string }>(
      adminA,
      `insert into public.staff_invitations (municipality_id, email, role)
       values ($1, 'admin.a@example.test', 'municipality_admin') returning id`,
      [ids.muniA],
    );
    const [row] = await world.db.query<{ invited_by: string; status: string }>(
      `select invited_by, status from public.staff_invitations where id = $1`,
      [created!.id],
    );
    expect(row).toEqual({ invited_by: ids.adminA, status: 'pending' });
    expect(
      await world.db.fails(adminA, `select public.accept_staff_invitation($1)`, [created!.id]),
    ).toMatch(/you created/i);
  });

  it('blocks the reporter-identity bypass: no direct membership for a known user id', async () => {
    // Even if an admin learned a citizen's user id, they cannot make them "staff"…
    expect(
      await world.db.fails(
        adminA,
        `insert into public.employees (user_id, municipality_id, role, department_id)
         values ($1, $2, 'employee', $3)`,
        [ids.citizenA1, ids.muniA, ids.deptAX],
      ),
    ).toMatch(DENIED);
    // …and an invitation addressed to them does nothing until they accept it themselves.
    await invite('citizen.a1@example.test');
    expect(
      await world.db.as(adminA, `select * from public.profiles where id = $1`, [ids.citizenA1]),
    ).toHaveLength(0);
    expect(
      await world.db.as(adminA, `select full_name from public.get_colleagues($1)`, [ids.muniA]),
    ).not.toContainEqual({ full_name: 'Citizen A One' });
  });

  it('audits invitation creation and acceptance', async () => {
    const person = await newUser(invitee, inviteeEmail);
    const invitationId = await invite(inviteeEmail);
    await world.db.as(person, `select public.accept_staff_invitation($1)`, [invitationId]);
    const actions = (
      await world.db.as<{ action: string }>(
        adminA,
        `select action from public.get_audit_log($1) where entity_id = $2 order by id`,
        [ids.muniA, invitationId],
      )
    ).map((row) => row.action);
    expect(actions).toEqual(['staff_invitations.insert', 'staff_invitation.accepted']);
  });
});
