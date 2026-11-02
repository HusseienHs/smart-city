import { describe, expect, it } from 'vitest';

import { anon, user } from './support/db';
import { ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

describe('report workflow', () => {
  const world = useWorld();
  const citizenA1 = user(ids.citizenA1);
  const citizenA2 = user(ids.citizenA2);
  const employeeAX = user(ids.employeeAX);
  const adminA = user(ids.adminA);

  const submit = (
    actor = citizenA2,
    overrides: Partial<{
      category: string;
      description: string;
      lat: number;
      lng: number;
      visibility: string | null;
    }> = {},
  ) =>
    world.db.as<{ report_id: string; tracking_number: string }>(
      actor,
      `select * from public.submit_report($1, $2, $3, $4, $5, null, null, $6::public.report_visibility)`,
      [
        ids.muniA,
        overrides.category ?? 'pothole',
        overrides.description ?? 'A deep pothole near the crossing',
        overrides.lat ?? 32.02,
        overrides.lng ?? 34.72,
        overrides.visibility ?? null,
      ],
    );

  const report = async (id: string) =>
    (
      await world.db.query<Record<string, unknown>>(
        `select r.*, c.code as category_code from public.reports r
         join public.report_categories c on c.id = r.category_id where r.id = $1`,
        [id],
      )
    )[0]!;

  describe('submission', () => {
    it('requires a signed-in user', async () => {
      expect(
        await world.db.fails(
          anon,
          `select * from public.submit_report($1, 'pothole', 'Long enough text', 32.02, 34.72)`,
          [ids.muniA],
        ),
      ).toMatch(DENIED);
    });

    it('generates a tracking number, routes to intake and detects the neighborhood', async () => {
      const [first] = await submit();
      const [second] = await submit(citizenA2, { lat: 32.07, lng: 34.75 });
      expect(first!.tracking_number).toMatch(/^TSA-\d{4}-\d{6}$/);
      const sequence = (tn: string) => Number(tn.split('-')[2]);
      expect(sequence(second!.tracking_number)).toBe(sequence(first!.tracking_number) + 1);

      const created = await report(second!.report_id);
      expect(created).toMatchObject({
        status: 'submitted',
        department_id: null,
        suggested_department_id: ids.deptAX,
        neighborhood_id: ids.neighborhoodANorth,
        reporter_id: ids.citizenA2,
        visibility: 'public',
      });
    });

    it('routes directly to the department when the municipality enables auto-routing', async () => {
      await world.db.as(
        adminA,
        `update public.municipalities set auto_route_reports = true where id = $1`,
        [ids.muniA],
      );
      const [created] = await submit();
      expect(await report(created!.report_id)).toMatchObject({
        department_id: ids.deptAX,
        suggested_department_id: null,
      });
    });

    it('defaults sensitive categories to private but lets the citizen choose', async () => {
      const [noise] = await submit(citizenA2, { category: 'noise' });
      const [publicNoise] = await submit(citizenA2, { category: 'noise', visibility: 'public' });
      const [privatePothole] = await submit(citizenA2, { visibility: 'private' });
      expect((await report(noise!.report_id)).visibility).toBe('private');
      expect((await report(publicNoise!.report_id)).visibility).toBe('public');
      expect((await report(privatePothole!.report_id)).visibility).toBe('private');
    });

    it('rejects invalid input', async () => {
      expect(await world.db.fails(citizenA2, ...submitSql({ lat: 31.0, lng: 34.75 }))).toMatch(
        /outside the municipality/i,
      );
      expect(await world.db.fails(citizenA2, ...submitSql({ description: '   short   ' }))).toMatch(
        /between 10 and 2000/i,
      );
      expect(await world.db.fails(citizenA2, ...submitSql({ category: 'aliens' }))).toMatch(
        /unknown report category/i,
      );
    });

    it('rejects categories the municipality disabled and inactive municipalities', async () => {
      await world.db.as(
        adminA,
        `update public.municipality_report_categories set is_enabled = false
         where municipality_id = $1 and category_id = (select id from public.report_categories where code = 'other')`,
        [ids.muniA],
      );
      expect(await world.db.fails(citizenA2, ...submitSql({ category: 'other' }))).toMatch(
        /not available/i,
      );

      await world.db.query(`update public.municipalities set status = 'suspended' where id = $1`, [
        ids.muniA,
      ]);
      expect(await world.db.fails(citizenA2, ...submitSql())).toMatch(/not active/i);
    });

    it('rate-limits a user to 10 reports per hour', async () => {
      // citizenA2 already submitted 2 fixture reports.
      for (let i = 0; i < 8; i += 1) await submit();
      expect(await world.db.fails(citizenA2, ...submitSql())).toMatch(/too many reports/i);
    });

    function submitSql(
      overrides: Partial<{ category: string; description: string; lat: number; lng: number }> = {},
    ): [string, unknown[]] {
      return [
        `select * from public.submit_report($1, $2, $3, $4, $5)`,
        [
          ids.muniA,
          overrides.category ?? 'pothole',
          overrides.description ?? 'A deep pothole near the crossing',
          overrides.lat ?? 32.02,
          overrides.lng ?? 34.72,
        ],
      ];
    }
  });

  describe('status changes', () => {
    const setStatus = (actor = employeeAX, ...args: unknown[]) =>
      world.db.as(
        actor,
        `select public.update_report_status($1, $2::public.report_status, $3, $4, $5::public.report_rejection_reason, $6)`,
        [world.reports.assignedXA, ...args],
      );
    const failStatus = (actor = employeeAX, ...args: unknown[]) =>
      world.db.fails(
        actor,
        `select public.update_report_status($1, $2::public.report_status, $3, $4, $5::public.report_rejection_reason, $6)`,
        [world.reports.assignedXA, ...args],
      );

    it('never lets citizens change a status — not even the reporter', async () => {
      expect(await failStatus(citizenA2, 'in_progress', null, true, null, null)).toMatch(DENIED);
      expect(
        await world.db.fails(
          citizenA2,
          `update public.reports set status = 'resolved' where id = $1`,
          [world.reports.assignedXA],
        ),
      ).toMatch(DENIED);
    });

    it('rejects transitions outside the workflow', async () => {
      expect(await failStatus(employeeAX, 'resolved', 'Fixed it', true, null, null)).toMatch(
        /invalid status transition/i,
      );
      expect(await failStatus(employeeAX, 'closed', null, true, null, null)).toMatch(
        /invalid status transition/i,
      );
    });

    it('requires a public note to resolve', async () => {
      await setStatus(employeeAX, 'in_progress', null, true, null, null);
      expect(await failStatus(employeeAX, 'resolved', null, true, null, null)).toMatch(
        /public note/i,
      );
      expect(
        await failStatus(employeeAX, 'resolved', 'Replaced the lamp', false, null, null),
      ).toMatch(/public note/i);
      await setStatus(employeeAX, 'resolved', 'Replaced the lamp', true, null, null);
      expect(await report(world.reports.assignedXA)).toMatchObject({ status: 'resolved' });
    });

    it('requires a completion photo when the municipality demands it', async () => {
      await world.db.as(
        adminA,
        `update public.municipalities set require_completion_photo = true where id = $1`,
        [ids.muniA],
      );
      await setStatus(employeeAX, 'in_progress', null, true, null, null);
      expect(
        await failStatus(employeeAX, 'resolved', 'Replaced the lamp', true, null, null),
      ).toMatch(/completion photo/i);
    });

    it('requires a rejection reason and a public note to reject', async () => {
      expect(await failStatus(employeeAX, 'rejected', 'Not ours', true, null, null)).toMatch(
        /rejection reason is required/i,
      );
      expect(
        await failStatus(employeeAX, 'rejected', null, true, 'not_municipal_responsibility', null),
      ).toMatch(/public note/i);
      expect(await failStatus(employeeAX, 'in_progress', null, true, 'other', null)).toMatch(
        /only allowed when rejecting/i,
      );
      await setStatus(
        employeeAX,
        'rejected',
        'This lamp belongs to the electricity company',
        true,
        'not_municipal_responsibility',
        null,
      );
      expect(await report(world.reports.assignedXA)).toMatchObject({
        status: 'rejected',
        rejection_reason: 'not_municipal_responsibility',
      });
    });

    it('requires the original report (same municipality) for duplicates', async () => {
      expect(
        await failStatus(adminA, 'rejected', 'Already reported', true, 'duplicate', null),
      ).toMatch(/original report/i);
      expect(
        await failStatus(
          adminA,
          'rejected',
          'Already reported',
          true,
          'duplicate',
          world.reports.assignedZB,
        ),
      ).toMatch(/original report/i);
      await setStatus(
        adminA,
        'rejected',
        'Already reported',
        true,
        'duplicate',
        world.reports.assignedYA,
      );
      expect(await report(world.reports.assignedXA)).toMatchObject({
        duplicate_of_id: world.reports.assignedYA,
      });
    });

    it('records history and audit, and notifies the citizen when resolved or rejected', async () => {
      await setStatus(employeeAX, 'in_progress', 'Crew on the way', false, null, null);
      await setStatus(employeeAX, 'resolved', 'Replaced the lamp', true, null, null);

      const notifications = await world.db.as<{ data: { to_status: string } }>(
        citizenA2,
        `select data from public.notifications where data ->> 'report_id' = $1 order by created_at`,
        [world.reports.assignedXA],
      );
      expect(notifications.map((row) => row.data.to_status)).toContain('resolved');

      const actorNotifications = await world.db.as(
        employeeAX,
        `select 1 from public.notifications`,
      );
      expect(actorNotifications).toHaveLength(0);

      const history = await world.db.as<{ to_status: string }>(
        adminA,
        `select to_status from public.report_status_history where report_id = $1 order by created_at`,
        [world.reports.assignedXA],
      );
      expect(history.map((row) => row.to_status)).toEqual([
        'submitted',
        'assigned',
        'in_progress',
        'resolved',
      ]);

      const audit = await world.db.as<{ action: string; actor_id: string; actor_kind: string }>(
        adminA,
        `select action, actor_id, actor_kind from public.get_audit_log($1)
         where entity_id = $2 and action = 'report.status_changed'`,
        [ids.muniA, world.reports.assignedXA],
      );
      expect(audit).toHaveLength(2);
      expect(
        audit.every((row) => row.actor_id === ids.employeeAX && row.actor_kind === 'staff'),
      ).toBe(true);
    });

    it('keeps notes internal unless explicitly marked public (F7)', async () => {
      await world.db.as(
        employeeAX,
        `select public.update_report_status($1, 'in_progress', 'Internal: budget code 7')`,
        [world.reports.assignedXA],
      );
      const [entry] = await world.db.query<{ note_is_public: boolean }>(
        `select note_is_public from public.report_status_history
         where report_id = $1 and to_status = 'in_progress'`,
        [world.reports.assignedXA],
      );
      expect(entry!.note_is_public).toBe(false);
      const updates = await world.db.as<{ note: string | null }>(
        citizenA2,
        `select note from public.get_my_report_updates($1)`,
        [world.reports.assignedXA],
      );
      expect(updates.map((row) => row.note)).not.toContain('Internal: budget code 7');
      // Resolution still requires an explicit public note.
      expect(
        await world.db.fails(
          employeeAX,
          `select public.update_report_status($1, 'resolved', 'Replaced the lamp')`,
          [world.reports.assignedXA],
        ),
      ).toMatch(/public note/i);
    });

    it('sends the tracking number only to the reporter, not to other followers (F5)', async () => {
      await world.db.as(citizenA1, `select public.follow_report($1)`, [world.reports.assignedXA]);
      await setStatus(employeeAX, 'in_progress', null, false, null, null);

      const [own] = await world.db.as<{ data: Record<string, unknown> }>(
        citizenA2,
        `select data from public.notifications where data ->> 'to_status' = 'in_progress'`,
      );
      expect(own!.data.tracking_number).toMatch(/^TSA-/);

      const [follower] = await world.db.as<{ data: Record<string, unknown> }>(
        citizenA1,
        `select data from public.notifications where data ->> 'to_status' = 'in_progress'`,
      );
      expect(follower!.data).not.toHaveProperty('tracking_number');
      expect(follower!.data).toEqual({
        report_id: world.reports.assignedXA,
        from_status: 'assigned',
        to_status: 'in_progress',
      });
    });

    it('never reveals the reporter as the actor of a submission in the audit log (F1/F6)', async () => {
      const [entry] = await world.db.as<{ actor_id: string | null; actor_kind: string }>(
        adminA,
        `select actor_id, actor_kind from public.get_audit_log($1)
         where action = 'report.submitted' and entity_id = $2`,
        [ids.muniA, world.reports.assignedXA],
      );
      expect(entry).toEqual({ actor_id: null, actor_kind: 'citizen' });
    });
  });

  describe("the reporter's view", () => {
    it('shows own reports without internal fields', async () => {
      const rows = await world.db.as<Record<string, unknown>>(
        citizenA1,
        `select * from public.get_my_reports()`,
      );
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        for (const internal of ['priority', 'assignee_id', 'department_id', 'reporter_id']) {
          expect(row).not.toHaveProperty(internal);
        }
      }
    });

    it('hides internal notes and internal comments from the reporter', async () => {
      await world.db.as(
        employeeAX,
        `select public.update_report_status($1, 'in_progress', 'Internal: crew B, overtime', false)`,
        [world.reports.assignedXA],
      );
      await world.db.as(
        employeeAX,
        `select public.add_report_comment($1, 'Internal remark', true)`,
        [world.reports.assignedXA],
      );
      await world.db.as(
        employeeAX,
        `select public.add_report_comment($1, 'We are on it!', false)`,
        [world.reports.assignedXA],
      );

      const updates = await world.db.as<{ note: string | null }>(
        citizenA2,
        `select note from public.get_my_report_updates($1)`,
        [world.reports.assignedXA],
      );
      expect(updates.map((row) => row.note)).not.toContain('Internal: crew B, overtime');

      const comments = await world.db.as<{ body: string }>(
        citizenA2,
        `select body from public.get_my_report_comments($1)`,
        [world.reports.assignedXA],
      );
      expect(comments.map((row) => row.body)).toEqual(['We are on it!']);

      const commentNotifications = await world.db.as(
        citizenA2,
        `select 1 from public.notifications where type = 'report_comment'`,
      );
      expect(commentNotifications).toHaveLength(1);
    });

    it('does not let a citizen write internal comments or comment on others’ reports', async () => {
      expect(
        await world.db.fails(citizenA2, `select public.add_report_comment($1, 'sneaky', true)`, [
          world.reports.assignedXA,
        ]),
      ).toMatch(/only municipal staff/i);
      expect(
        await world.db.fails(citizenA1, `select public.add_report_comment($1, 'hello', false)`, [
          world.reports.assignedXA,
        ]),
      ).toMatch(DENIED);
    });

    it("does not reveal another citizen's report details", async () => {
      const updates = await world.db.as(
        citizenA1,
        `select * from public.get_my_report_updates($1)`,
        [world.reports.assignedXA],
      );
      const attachments = await world.db.as(
        citizenA1,
        `select * from public.get_my_report_attachments($1)`,
        [world.reports.assignedXA],
      );
      expect(updates).toHaveLength(0);
      expect(attachments).toHaveLength(0);
    });
  });

  describe('confirm and follow', () => {
    it('lets other citizens confirm and follow public open reports only', async () => {
      await world.db.as(citizenA2, `select public.confirm_report($1)`, [
        world.reports.publicUnassignedA,
      ]);
      await world.db.as(citizenA2, `select public.confirm_report($1)`, [
        world.reports.publicUnassignedA,
      ]);
      expect(await report(world.reports.publicUnassignedA)).toMatchObject({
        confirmation_count: 1,
      });

      expect(
        await world.db.fails(citizenA2, `select public.confirm_report($1)`, [
          world.reports.privateNoiseA,
        ]),
      ).toMatch(DENIED);
      expect(
        await world.db.fails(citizenA2, `select public.follow_report($1)`, [
          world.reports.privateNoiseA,
        ]),
      ).toMatch(DENIED);
      expect(
        await world.db.fails(citizenA1, `select public.confirm_report($1)`, [
          world.reports.publicUnassignedA,
        ]),
      ).toMatch(/your own report/i);
    });
  });
});
