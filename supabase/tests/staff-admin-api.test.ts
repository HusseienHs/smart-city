import {
  MANAGED_DEPARTMENT_COLUMNS,
  STAFF_ADMIN_MESSAGES,
  STAFF_INVITATION_COLUMNS,
} from '@smart-city/api';
import { describe, expect, it } from 'vitest';

import { type Actor, user } from './support/db';
import { employeeIds, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/**
 * Staff administration as @smart-city/api performs it (staff/departments.ts, staff-admin.ts,
 * auth/staff-sign-up.ts) — the same columns, named RPC arguments and error texts — against the
 * real grants, policies, triggers and RPCs.
 */
describe('staff administration API against the real database', () => {
  const world = useWorld();
  const admin = user(ids.adminA);
  const manager = user(ids.managerAX);
  const employee = user(ids.employeeAX);
  const dispatcher = user(ids.dispatcherA);
  const adminB = user(ids.adminB);

  const message = (issue: keyof typeof STAFF_ADMIN_MESSAGES, text: string) =>
    expect(STAFF_ADMIN_MESSAGES[issue] as readonly string[]).toContain(text);

  it('every message the UI explains still appears in the staff functions and triggers', async () => {
    const [row] = await world.db.query<{ src: string }>(
      `select string_agg(prosrc, ' ') as src from pg_proc
       where proname in ('set_employee_role', 'guard_employee_change', 'revoke_staff_invitation',
                         'accept_staff_invitation')`,
    );
    for (const texts of Object.values(STAFF_ADMIN_MESSAGES)) {
      for (const text of texts) expect(row!.src).toContain(text);
    }
  });

  describe('departments', () => {
    const create = (actor: Actor, municipalityId = ids.muniA) =>
      world.db.as<{ id: string }>(
        actor,
        `insert into public.departments (municipality_id, name, email, phone, is_active)
         values ($1, $2::jsonb, $3, $4, true) returning ${MANAGED_DEPARTMENT_COLUMNS}`,
        [
          municipalityId,
          JSON.stringify({ he: 'גנים', en: 'Parks' }),
          'parks@city.test',
          '+972 3-555-0100',
        ],
      );

    it('admins create (returning the managed columns) and update; the change is audited', async () => {
      const [created] = await create(admin);
      const updated = await world.db.as(
        admin,
        `update public.departments set name = $2::jsonb, email = null, phone = null
         where id = $1 and municipality_id = $3 returning id`,
        [created!.id, JSON.stringify({ he: 'גנים ונוף' }), ids.muniA],
      );
      expect(updated).toHaveLength(1);
      const [audit] = await world.db.query<{ count: number }>(
        `select count(*)::int as count from public.audit_logs where entity_id = $1`,
        [created!.id],
      );
      expect(audit!.count).toBe(2);
    });

    it('managers, employees, dispatchers and other municipalities cannot create or change', async () => {
      for (const actor of [manager, employee, dispatcher, adminB]) {
        await expect(create(actor)).rejects.toThrow(DENIED);
        const rows = await world.db.as(
          actor,
          `update public.departments set is_active = false where id = $1 and municipality_id = $2 returning id`,
          [ids.deptAX, ids.muniA],
        );
        // RLS filters the row out: "0 rows", which the API turns into `forbidden`.
        expect(rows).toEqual([]);
      }
    });

    it('rejects invalid names and contacts like the shared schema', async () => {
      for (const [name, email, phone] of [
        ['{"en": "Parks"}', null, null],
        ['{"he": "גנים", "fr": "Parcs"}', null, null],
        ['{"he": "גנים"}', 'not-an-email', null],
        ['{"he": "גנים"}', null, '12'],
      ] as const) {
        await expect(
          world.db.as(
            admin,
            `insert into public.departments (municipality_id, name, email, phone) values ($1, $2::jsonb, $3, $4)`,
            [ids.muniA, name, email, phone],
          ),
        ).rejects.toThrow();
      }
    });

    it('a deactivated department can no longer receive staff (why the UI checks members first)', async () => {
      await world.db.as(admin, `update public.departments set is_active = false where id = $1`, [
        ids.deptAY,
      ]);
      const failure = await world.db.fails(
        admin,
        `select public.set_employee_role(p_employee_id => $1, p_role => 'employee', p_department_id => $2)`,
        [employeeIds.employeeAX, ids.deptAY],
      );
      message('department_unavailable', failure);
    });
  });

  describe('invitations', () => {
    const invite = (actor: Actor, email: string) =>
      world.db.as(
        actor,
        `insert into public.staff_invitations (municipality_id, email, role, department_id, job_title)
         values ($1, $2, 'employee', $3, $4) returning ${STAFF_INVITATION_COLUMNS}`,
        [ids.muniA, email, ids.deptAX, 'Inspector'],
      );

    it('admins invite, list without user ids, and revoke; then can invite again', async () => {
      const [created] = await invite(admin, 'new.person@city.test');
      expect(created).toMatchObject({ status: 'pending', email: 'new.person@city.test' });

      const listed = await world.db.as(
        admin,
        `select ${STAFF_INVITATION_COLUMNS} from public.staff_invitations where municipality_id = $1`,
        [ids.muniA],
      );
      expect(listed.length).toBeGreaterThan(0);

      // Duplicate pending → unique violation (the API's `invitation_pending`).
      await expect(invite(admin, 'new.person@city.test')).rejects.toThrow(/duplicate|unique/i);

      await world.db.as(admin, `select public.revoke_staff_invitation(p_invitation_id => $1)`, [
        created!.id,
      ]);
      await expect(invite(admin, 'new.person@city.test')).resolves.toHaveLength(1);
    });

    it('an expired invitation still blocks a new one until it is revoked', async () => {
      const [created] = await invite(admin, 'late.person@city.test');
      await world.db.query(
        `update public.staff_invitations set expires_at = now() - interval '1 day' where id = $1`,
        [created!.id],
      );
      await expect(invite(admin, 'late.person@city.test')).rejects.toThrow(/duplicate|unique/i);
      await world.db.as(admin, `select public.revoke_staff_invitation(p_invitation_id => $1)`, [
        created!.id,
      ]);
      await expect(invite(admin, 'late.person@city.test')).resolves.toHaveLength(1);
    });

    it('nobody else can invite, list or revoke', async () => {
      const [created] = await invite(admin, 'someone@city.test');
      for (const actor of [manager, employee, dispatcher, adminB]) {
        await expect(invite(actor, 'other@city.test')).rejects.toThrow(DENIED);
        const visible = await world.db.as(
          actor,
          `select ${STAFF_INVITATION_COLUMNS} from public.staff_invitations where municipality_id = $1`,
          [ids.muniA],
        );
        expect(visible).toEqual([]);
        message(
          'invitation_unavailable',
          await world.db.fails(
            actor,
            `select public.revoke_staff_invitation(p_invitation_id => $1)`,
            [created!.id],
          ),
        );
      }
    });
  });

  describe('memberships', () => {
    const setRole = (actor: Actor, args: Record<string, unknown>) => {
      const names = Object.keys(args);
      return world.db.as<{ moved: number }>(
        actor,
        `select public.set_employee_role(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as moved`,
        Object.values(args),
      );
    };

    it('a transfer hands open reports to a colleague of the previous department and says how many', async () => {
      const [row] = await setRole(admin, {
        p_employee_id: employeeIds.employeeAX,
        p_role: 'employee',
        p_department_id: ids.deptAY,
        p_reassign_to: employeeIds.employeeAX2,
      });
      expect(row!.moved).toBe(1);
      const [report] = await world.db.as<{ assignee_id: string }>(
        admin,
        `select assignee_id from public.reports where id = $1`,
        [world.reports.assignedXA],
      );
      expect(report!.assignee_id).toBe(employeeIds.employeeAX2);
    });

    it('roles without a department take a null department', async () => {
      const [row] = await setRole(admin, {
        p_employee_id: employeeIds.employeeAX,
        p_role: 'intake_dispatcher',
        p_department_id: null,
      });
      expect(row!.moved).toBe(1);
      const [report] = await world.db.as<{ assignee_id: string | null }>(
        admin,
        `select assignee_id from public.reports where id = $1`,
        [world.reports.assignedXA],
      );
      expect(report!.assignee_id).toBeNull();
    });

    it('raises the exact messages the API maps', async () => {
      const fail = (actor: Actor, args: Record<string, unknown>) => {
        const names = Object.keys(args);
        return world.db.fails(
          actor,
          `select public.set_employee_role(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')})`,
          Object.values(args),
        );
      };
      message(
        'self_change',
        await fail(admin, {
          p_employee_id: employeeIds.adminA,
          p_role: 'employee',
          p_department_id: ids.deptAX,
        }),
      );
      message(
        'department_required',
        await fail(admin, {
          p_employee_id: employeeIds.employeeAX,
          p_role: 'employee',
          p_department_id: null,
        }),
      );
      message(
        'reassign_not_leaving',
        await fail(admin, {
          p_employee_id: employeeIds.employeeAX,
          p_role: 'department_manager',
          p_department_id: ids.deptAX,
          p_reassign_to: employeeIds.employeeAX2,
        }),
      );
      message(
        'reassign_invalid',
        await fail(admin, {
          p_employee_id: employeeIds.employeeAX,
          p_role: 'employee',
          p_department_id: ids.deptAY,
          p_reassign_to: employeeIds.employeeAY,
        }),
      );
    });

    it('job title and deactivation by the admin; open reports return to the queue', async () => {
      const update = (actor: Actor, set: string, value: unknown, id = employeeIds.employeeAX) =>
        world.db.as(
          actor,
          `update public.employees set ${set} = $1 where id = $2 and municipality_id = $3 returning id`,
          [value, id, ids.muniA],
        );
      expect(await update(admin, 'job_title', 'Senior inspector')).toHaveLength(1);
      expect(await update(admin, 'is_active', false)).toHaveLength(1);
      const [report] = await world.db.as<{ assignee_id: string | null }>(
        admin,
        `select assignee_id from public.reports where id = $1`,
        [world.reports.assignedXA],
      );
      expect(report!.assignee_id).toBeNull();
      // Reactivation is a direct update too.
      expect(await update(admin, 'is_active', true)).toHaveLength(1);

      // Others: 0 rows (RLS), which the API reports as forbidden.
      for (const actor of [manager, employee, adminB]) {
        expect(await update(actor, 'job_title', 'x')).toEqual([]);
      }
    });

    it('self-deactivation and self role changes are refused with the mapped message', async () => {
      // (The last-admin guard is covered by role-escalation.test.ts; through the API it can't be
      // reached by a single actor, since the only remaining admin can't act on themselves.)
      message(
        'self_change',
        await world.db.fails(admin, `update public.employees set is_active = false where id = $1`, [
          employeeIds.adminA,
        ]),
      );
    });
  });

  describe('staff sign-up (signUpStaff metadata)', () => {
    it('creates a profile without a home municipality and no staff membership', async () => {
      const id = '00000000-0000-4000-8000-000000009101';
      await world.db.query(
        `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
         values ($1, 'staff.signup@city.test', now(), $2::jsonb)`,
        [id, JSON.stringify({ full_name: 'New Staff', preferred_locale: 'ar' })],
      );
      const [profile] = await world.db.as<Record<string, unknown>>(
        user(id),
        `select full_name, preferred_locale, home_municipality_id from public.profiles where id = $1`,
        [id],
      );
      expect(profile).toEqual({
        full_name: 'New Staff',
        preferred_locale: 'ar',
        home_municipality_id: null,
      });
      expect(
        await world.db.as(user(id), `select * from public.get_my_staff_memberships()`),
      ).toEqual([]);
    });

    it('can accept only an invitation for its own confirmed email', async () => {
      const id = '00000000-0000-4000-8000-000000009102';
      await world.db.query(
        `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
         values ($1, 'invited.staff@city.test', null, '{"full_name": "Invited"}')`,
        [id],
      );
      const [invitation] = await world.db.as<{ id: string }>(
        admin,
        `insert into public.staff_invitations (municipality_id, email, role, department_id)
         values ($1, 'invited.staff@city.test', 'employee', $2) returning id`,
        [ids.muniA, ids.deptAX],
      );
      // Not confirmed yet: the invitation isn't even visible to them.
      expect(
        await world.db.as(user(id), `select id from public.get_my_staff_invitations()`),
      ).toEqual([]);
      message(
        'invitation_unavailable',
        await world.db.fails(user(id), `select public.accept_staff_invitation($1)`, [
          invitation!.id,
        ]),
      );

      await world.db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [id]);
      expect(
        await world.db.as(user(id), `select id from public.get_my_staff_invitations()`),
      ).toHaveLength(1);
      // Someone else's account can't accept it.
      message(
        'invitation_unavailable',
        await world.db.fails(user(ids.citizenA1), `select public.accept_staff_invitation($1)`, [
          invitation!.id,
        ]),
      );
      await world.db.as(user(id), `select public.accept_staff_invitation($1)`, [invitation!.id]);
      const memberships = await world.db.as<{ role: string }>(
        user(id),
        `select role from public.get_my_staff_memberships()`,
      );
      expect(memberships).toEqual([{ role: 'employee' }]);
      // Accepting again: no longer valid.
      message(
        'invitation_unavailable',
        await world.db.fails(user(id), `select public.accept_staff_invitation($1)`, [
          invitation!.id,
        ]),
      );
    });
  });
});
