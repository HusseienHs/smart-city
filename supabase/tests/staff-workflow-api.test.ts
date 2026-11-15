import {
  buildCompletionPhotoPath,
  REPORT_MEDIA_BUCKET,
  STAFF_DEPARTMENT_COLUMNS,
  STAFF_NEIGHBORHOOD_COLUMNS,
  STAFF_WORKFLOW_MESSAGES,
  type StaffWorkflowIssue,
} from '@smart-city/api';
import { describe, expect, it } from 'vitest';

import { type Actor, user } from './support/db';
import { employeeIds, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/**
 * The staff workflow as @smart-city/api performs it (packages/api/src/staff/workflow.ts and
 * media.ts) — the same named RPC arguments, storage paths and error texts — against the real
 * RPCs, policies and constraints. The unit tests there use a fake client and can't detect a
 * renamed argument, a changed message or a policy that refuses the path.
 */
describe('staff workflow API against the real database', () => {
  const world = useWorld();
  const admin = user(ids.adminA);
  const employeeAX = user(ids.employeeAX);
  const employeeAY = user(ids.employeeAY);
  const managerAX = user(ids.managerAX);
  const dispatcher = user(ids.dispatcherA);
  const adminB = user(ids.adminB);

  const status = (actor: Actor, reportId: string, args: Record<string, unknown> = {}) => {
    const names = ['p_report_id', ...Object.keys(args)];
    const values = [reportId, ...Object.values(args)];
    const sql = `select public.update_report_status(${names
      .map((name, i) => `${name} => $${i + 1}`)
      .join(', ')})`;
    return { sql, params: values };
  };
  const setStatus = async (actor: Actor, reportId: string, args: Record<string, unknown>) => {
    const { sql, params } = status(actor, reportId, args);
    await world.db.as(actor, sql, params);
  };
  const failStatus = (actor: Actor, reportId: string, args: Record<string, unknown>) => {
    const { sql, params } = status(actor, reportId, args);
    return world.db.fails(actor, sql, params);
  };
  const assign = (
    actor: Actor,
    reportId: string,
    departmentId: string | null,
    assigneeId?: string,
  ) =>
    world.db.fails(
      actor,
      `select public.assign_report(p_report_id => $1, p_department_id => $2, p_assignee_id => $3)`,
      [reportId, departmentId, assigneeId ?? null],
    );

  const expectIssue = (message: string, issue: StaffWorkflowIssue) => {
    expect(
      (STAFF_WORKFLOW_MESSAGES[issue] as readonly string[]).some((text) =>
        message.startsWith(text),
      ),
    ).toBe(true);
  };

  it('every message the UI explains still appears in the workflow functions', async () => {
    const rows = await world.db.query<{ src: string }>(
      `select string_agg(prosrc, ' ') as src from pg_proc
       where proname in ('update_report_status', 'assign_report', 'add_report_attachment')
         and pronamespace = 'public'::regnamespace`,
    );
    const source = rows[0]!.src;
    for (const messages of Object.values(STAFF_WORKFLOW_MESSAGES)) {
      for (const text of messages) expect(source).toContain(text);
    }
  });

  it('raises the exact status-change messages the API maps', async () => {
    const intake = world.reports.publicUnassignedA;
    expectIssue(await failStatus(admin, intake, { p_status: 'closed' }), 'invalid_transition');
    expectIssue(
      await failStatus(dispatcher, intake, { p_status: 'assigned' }),
      'dispatcher_status',
    );
    expectIssue(
      await failStatus(admin, intake, {
        p_status: 'rejected',
        p_note: 'Not ours',
        p_note_is_public: false,
        p_rejection_reason: 'other',
      }),
      'public_note_required',
    );
    expectIssue(
      await failStatus(admin, intake, {
        p_status: 'rejected',
        p_note: 'Not ours at all',
        p_note_is_public: true,
      }),
      'rejection_reason_required',
    );
    expectIssue(
      await failStatus(admin, intake, {
        p_status: 'rejected',
        p_note: 'Same as another one',
        p_note_is_public: true,
        p_rejection_reason: 'duplicate',
        p_duplicate_of_id: world.reports.assignedZB, // another municipality
      }),
      'duplicate_invalid',
    );
    expectIssue(await failStatus(admin, intake, { p_status: 'assigned' }), 'department_required');
  });

  it('a duplicate of a report in the same municipality is accepted', async () => {
    await setStatus(admin, world.reports.privateNoiseA, {
      p_status: 'rejected',
      p_note: 'Already reported, we are on it',
      p_note_is_public: true,
      p_rejection_reason: 'duplicate',
      p_duplicate_of_id: world.reports.publicUnassignedA,
    });
    const [row] = await world.db.as<{ status: string; duplicate_of_id: string }>(
      admin,
      `select status, duplicate_of_id from public.reports where id = $1`,
      [world.reports.privateNoiseA],
    );
    expect(row).toEqual({ status: 'rejected', duplicate_of_id: world.reports.publicUnassignedA });
  });

  it('raises the exact assignment messages the API maps', async () => {
    const intake = world.reports.publicUnassignedA;
    const routed = world.reports.assignedXA;
    expectIssue(await assign(employeeAX, routed, ids.deptAX), 'employee_cannot_assign');
    expectIssue(
      await assign(dispatcher, intake, ids.deptAX, employeeIds.employeeAX),
      'dispatcher_department_only',
    );
    expectIssue(await assign(managerAX, routed, ids.deptAY), 'manager_own_department');
    expectIssue(
      await assign(admin, routed, ids.deptAY, employeeIds.employeeAX),
      'assignee_invalid',
    );
    expectIssue(
      await assign(admin, intake, '00000000-0000-4000-8000-0000000000ff'),
      'department_unavailable',
    );

    await setStatus(employeeAX, routed, { p_status: 'in_progress' });
    expectIssue(await assign(admin, routed, null), 'in_progress_no_intake');
  });

  it('a department manager may return a report of their department to intake', async () => {
    await world.db.as(
      managerAX,
      `select public.assign_report(p_report_id => $1, p_department_id => $2)`,
      [world.reports.assignedXA, null],
    );
    const [row] = await world.db.as<{ department_id: string | null; status: string }>(
      admin,
      `select department_id, status from public.reports where id = $1`,
      [world.reports.assignedXA],
    );
    expect(row).toEqual({ department_id: null, status: 'under_review' });
  });

  describe('completion photos (buildCompletionPhotoPath)', () => {
    const photo = (reportId: string, photoId: string) =>
      buildCompletionPhotoPath({
        municipalityId: ids.muniA,
        reportId,
        photoId,
        mimeType: 'image/jpeg',
      });
    const meta = JSON.stringify({ size: 250_000, mimetype: 'image/jpeg' });
    const upload = (actor: Actor, path: string) =>
      world.db.as(
        actor,
        `insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3::jsonb)`,
        [REPORT_MEDIA_BUCKET, path, meta],
      );
    const failUpload = (actor: Actor, path: string) =>
      world.db.fails(
        actor,
        `insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3::jsonb)`,
        [REPORT_MEDIA_BUCKET, path, meta],
      );
    const register = (actor: Actor, reportId: string, path: string) =>
      world.db.as<{ id: string }>(
        actor,
        `select public.add_report_attachment(p_report_id => $1, p_storage_path => $2, p_kind => 'completion_photo') as id`,
        [reportId, path],
      );

    it('the handling employee uploads and registers once the report is in progress', async () => {
      const report = world.reports.assignedXA;
      const path = photo(report, 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001');

      // Not yet in progress: storage refuses the upload.
      expect(await failUpload(employeeAX, path)).toMatch(DENIED);

      await setStatus(employeeAX, report, { p_status: 'in_progress' });
      await upload(employeeAX, path);
      const [row] = await register(employeeAX, report, path);
      expect(row!.id).toBeTruthy();

      const [attachment] = await world.db.as<{ kind: string; size_bytes: number }>(
        admin,
        `select kind, size_bytes from public.report_attachments where id = $1`,
        [row!.id],
      );
      expect(attachment).toEqual({ kind: 'completion_photo', size_bytes: 250_000 });

      // The photo now satisfies the completion requirement.
      await world.db.query(
        `update public.municipalities set require_completion_photo = true where id = $1`,
        [ids.muniA],
      );
      await setStatus(employeeAX, report, {
        p_status: 'resolved',
        p_note: 'Replaced the lamp',
        p_note_is_public: true,
      });
    });

    it('nobody else may upload: other departments, dispatchers, other municipalities', async () => {
      const report = world.reports.assignedXA;
      await setStatus(employeeAX, report, { p_status: 'in_progress' });
      for (const actor of [employeeAY, dispatcher, adminB]) {
        expect(
          await failUpload(actor, photo(report, 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002')),
        ).toMatch(DENIED);
      }
    });

    it('resolving without a completion photo is refused when the municipality requires one', async () => {
      const report = world.reports.assignedXA;
      await world.db.query(
        `update public.municipalities set require_completion_photo = true where id = $1`,
        [ids.muniA],
      );
      await setStatus(employeeAX, report, { p_status: 'in_progress' });
      expectIssue(
        await failStatus(employeeAX, report, {
          p_status: 'resolved',
          p_note: 'Replaced the lamp',
          p_note_is_public: true,
        }),
        'completion_photo_required',
      );
      // Staff can read the setting the UI explains.
      const [row] = await world.db.as<{ require_completion_photo: boolean }>(
        employeeAX,
        `select require_completion_photo from public.municipalities where id = $1`,
        [ids.muniA],
      );
      expect(row!.require_completion_photo).toBe(true);
    });

    it('signed URLs: only staff who can access the report can read its media', async () => {
      const report = world.reports.assignedXA;
      await setStatus(employeeAX, report, { p_status: 'in_progress' });
      const path = photo(report, 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003');
      await upload(employeeAX, path);
      const visible = async (actor: Actor) =>
        (
          await world.db.as(
            actor,
            `select name from storage.objects where bucket_id = $1 and name = $2`,
            [REPORT_MEDIA_BUCKET, path],
          )
        ).length;
      expect(await visible(admin)).toBe(1);
      expect(await visible(employeeAX)).toBe(1);
      expect(await visible(managerAX)).toBe(1);
      expect(await visible(employeeAY)).toBe(0);
      expect(await visible(dispatcher)).toBe(0);
      expect(await visible(adminB)).toBe(0);
    });
  });

  describe('comments (addStaffReportComment passes the visibility explicitly)', () => {
    const comment = (actor: Actor, reportId: string, body: string, isInternal: boolean) =>
      world.db.as(
        actor,
        `select public.add_report_comment(p_report_id => $1, p_body => $2, p_is_internal => $3)`,
        [reportId, body, isInternal],
      );

    it('internal comments stay internal; public ones reach the reporter with a notification', async () => {
      const report = world.reports.assignedXA;
      await comment(employeeAX, report, 'Internal: need a ladder truck', true);
      await comment(employeeAX, report, 'We will fix this tomorrow', false);

      const seen = await world.db.as<{ body: string }>(
        user(ids.citizenA2),
        `select body from public.get_my_report_comments($1)`,
        [report],
      );
      expect(seen.map((row) => row.body)).toEqual(['We will fix this tomorrow']);

      const notifications = await world.db.as<{ type: string }>(
        user(ids.citizenA2),
        `select type from public.notifications where type = 'report_comment'`,
      );
      expect(notifications).toHaveLength(1);

      const staffView = await world.db.as<{ is_internal: boolean; author_employee_id: string }>(
        admin,
        `select is_internal, author_employee_id from public.report_comments where report_id = $1 order by created_at, id`,
        [report],
      );
      expect(staffView.map((row) => row.is_internal).sort()).toEqual([false, true]);
      expect(new Set(staffView.map((row) => row.author_employee_id))).toEqual(
        new Set([employeeIds.employeeAX]),
      );
    });

    it('staff outside the report cannot comment', async () => {
      for (const actor of [employeeAY, dispatcher, adminB]) {
        await expect(comment(actor, world.reports.assignedXA, 'Hello', true)).rejects.toThrow(
          DENIED,
        );
      }
    });
  });

  describe('reporter contact', () => {
    const contact = (actor: Actor, reportId: string) =>
      world.db.as<{ full_name: string; phone: string | null }>(
        actor,
        `select * from public.get_report_reporter_contact(p_report_id => $1)`,
        [reportId],
      );

    it('handlers get it; intake dispatchers and other departments do not', async () => {
      expect(await contact(employeeAX, world.reports.assignedXA)).toHaveLength(1);
      expect(await contact(admin, world.reports.publicUnassignedA)).toHaveLength(1);
      // Dispatchers see the intake queue but never the reporter's contact details.
      await expect(contact(dispatcher, world.reports.publicUnassignedA)).rejects.toThrow(DENIED);
      await expect(contact(employeeAY, world.reports.assignedXA)).rejects.toThrow(DENIED);
      await expect(contact(adminB, world.reports.assignedXA)).rejects.toThrow(DENIED);
    });
  });

  it('the directory column lists are permitted for every staff role', async () => {
    for (const actor of [admin, managerAX, employeeAX, dispatcher]) {
      await expect(
        world.db.as(
          actor,
          `select ${STAFF_DEPARTMENT_COLUMNS} from public.departments where municipality_id = $1`,
          [ids.muniA],
        ),
      ).resolves.not.toHaveLength(0);
      await expect(
        world.db.as(
          actor,
          `select ${STAFF_NEIGHBORHOOD_COLUMNS} from public.neighborhoods where municipality_id = $1`,
          [ids.muniA],
        ),
      ).resolves.toBeDefined();
    }
  });
});
