import {
  MUNICIPAL_STAFF_ROLES,
  REPORT_CATEGORIES,
  REPORT_PRIORITIES,
  REPORT_REJECTION_REASONS,
  REPORT_STATUSES,
  REPORT_STATUS_TRANSITIONS,
  REPORT_VISIBILITIES,
  SENSITIVE_REPORT_CATEGORIES,
} from '@smart-city/shared';
import { describe, expect, it } from 'vitest';

import { TestDb } from './support/db';
import { useWorld } from './support/world';

/**
 * Structural security invariants. These protect against *future* mistakes: a new table
 * without RLS, a forgotten REVOKE, a SECURITY DEFINER function without a pinned
 * search_path, or drift between the database and packages/shared.
 */
describe('schema security invariants', () => {
  const world = useWorld();

  const publicTables = async () =>
    (
      await world.db.query<{ name: string }>(
        `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`,
      )
    ).map((row) => row.name);

  it('enables RLS on every table in public and on storage.objects', async () => {
    const withoutRls = await world.db.query(
      `select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where ((n.nspname = 'public' and c.relkind in ('r', 'p'))
              or (n.nspname = 'storage' and c.relname = 'objects'))
         and not c.relrowsecurity`,
    );
    expect(withoutRls).toEqual([]);
  });

  it('gives anon read access to public reference data only, and no write access', async () => {
    const anonReadable = new Set([
      'announcements',
      'departments',
      'municipalities',
      'municipality_report_categories',
      'neighborhoods',
      'report_categories',
      'report_status_transitions',
    ]);
    for (const table of await publicTables()) {
      const [privileges] = await world.db.query<Record<string, boolean>>(
        `select has_any_column_privilege('anon', $1, 'SELECT') as sel,
                has_any_column_privilege('anon', $1, 'INSERT') as ins,
                has_any_column_privilege('anon', $1, 'UPDATE') as upd,
                has_table_privilege('anon', $1, 'DELETE') as del,
                has_table_privilege('anon', $1, 'TRUNCATE') as trunc`,
        [`public.${table}`],
      );
      expect({ table, ...privileges }).toEqual({
        table,
        sel: anonReadable.has(table),
        ins: false,
        upd: false,
        del: false,
        trunc: false,
      });
    }
  });

  it('limits authenticated write privileges to an explicit allowlist', async () => {
    const expected: Record<'INSERT' | 'UPDATE' | 'DELETE', string[]> = {
      INSERT: [
        'announcements',
        'departments',
        'municipality_report_categories',
        'neighborhoods',
        'profile_contacts',
        'staff_invitations',
      ],
      UPDATE: [
        'announcements',
        'departments',
        'employees',
        'municipalities',
        'municipality_report_categories',
        'neighborhoods',
        'notifications',
        'profile_contacts',
        'profiles',
      ],
      DELETE: ['announcements', 'profile_contacts', 'push_tokens'],
    };
    for (const action of ['INSERT', 'UPDATE', 'DELETE'] as const) {
      const fn = action === 'DELETE' ? 'has_table_privilege' : 'has_any_column_privilege';
      const tables: string[] = [];
      for (const table of await publicTables()) {
        const [row] = await world.db.query<{ allowed: boolean }>(
          `select ${fn}('authenticated', $1, $2) as allowed`,
          [`public.${table}`, action],
        );
        if (row!.allowed) tables.push(table);
      }
      expect({ action, tables }).toEqual({ action, tables: expected[action].sort() });
    }
  });

  it('never lets API roles write workflow-critical columns directly', async () => {
    // [table, column, insertable by authenticated (RLS-guarded)?] — never updatable.
    const protectedColumns: [string, string, boolean][] = [
      ['reports', 'status', false],
      ['reports', 'priority', false],
      ['reports', 'assignee_id', false],
      ['reports', 'department_id', false],
      ['reports', 'location', false],
      ['municipalities', 'code', false],
      ['municipalities', 'status', false],
      // Memberships come only from accepted invitations; roles/departments only via
      // set_employee_role().
      ['employees', 'user_id', false],
      ['employees', 'municipality_id', false],
      ['employees', 'role', false],
      ['employees', 'department_id', false],
      ['staff_invitations', 'status', false],
      ['staff_invitations', 'invited_by', false],
      ['announcements', 'published_by', false],
      ['announcements', 'status', false],
      ['announcements', 'published_at', false],
      ['announcements', 'created_by', false],
      ['notifications', 'user_id', false],
      ['profiles', 'id', false],
    ];
    for (const [table, column, insertable] of protectedColumns) {
      for (const role of ['anon', 'authenticated']) {
        const [row] = await world.db.query<{ ins: boolean; upd: boolean }>(
          `select has_column_privilege($1, $2, $3, 'INSERT') as ins,
                  has_column_privilege($1, $2, $3, 'UPDATE') as upd`,
          [role, `public.${table}`, column],
        );
        expect({ role, table, column, ...row }).toEqual({
          role,
          table,
          column,
          ins: insertable && role === 'authenticated',
          upd: false,
        });
      }
    }
  });

  it('hides identifying columns from every API role (F1, F8)', async () => {
    const hidden: [string, string][] = [
      ['reports', 'reporter_id'],
      ['report_comments', 'author_id'],
      ['report_status_history', 'changed_by'],
      ['report_attachments', 'uploaded_by'],
      ['employees', 'user_id'],
      ['announcements', 'created_by'],
      ['announcements', 'published_by'],
    ];
    for (const [table, column] of hidden) {
      for (const role of ['anon', 'authenticated']) {
        const [row] = await world.db.query<{ sel: boolean }>(
          `select has_column_privilege($1, $2, $3, 'SELECT') as sel`,
          [role, `public.${table}`, column],
        );
        expect({ role, table, column, sel: row!.sel }).toEqual({ role, table, column, sel: false });
      }
    }
  });

  it('gives no API role direct read access to the audit log (F6)', async () => {
    for (const role of ['anon', 'authenticated']) {
      const [row] = await world.db.query<{ sel: boolean }>(
        `select has_any_column_privilege($1, 'public.audit_logs', 'SELECT') as sel`,
        [role],
      );
      expect(row!.sel).toBe(false);
    }
  });

  it('serializes report photo uploads with a volatile, locking policy function (F2)', async () => {
    const [fn] = await world.db.query<{ volatility: string; body: string }>(
      `select provolatile as volatility, prosrc as body from pg_proc
       where oid = 'private.can_upload_report_media(text)'::regprocedure`,
    );
    expect(fn!.volatility).toBe('v');
    expect(fn!.body).toContain('pg_advisory_xact_lock');
    expect(fn!.body).toContain('storage.objects');
  });

  it('lets authenticated users execute only the private helpers that policies need', async () => {
    const executable = async (role: string) =>
      (
        await world.db.query<{ name: string }>(
          `select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and has_function_privilege($1, p.oid, 'EXECUTE') order by 1`,
          [role],
        )
      ).map((row) => row.name);

    expect(await executable('anon')).toEqual([]);
    expect(await executable('authenticated')).toEqual(
      [
        'can_access_report',
        'can_delete_public_announcement_media',
        'can_draft_content',
        'can_edit_announcement_media',
        'can_publish_announcement_media',
        'can_publish_content',
        'can_read_draft_media',
        'can_read_report_media',
        'can_upload_report_media',
        'has_staff_role',
        'is_localized_text',
        'is_platform_admin',
        'staff_municipality_ids',
      ].sort(),
    );
  });

  it('exposes no function in public to anon', async () => {
    const executable = await world.db.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')`,
    );
    expect(executable).toEqual([]);
  });

  it('exposes exactly the intended RPCs to authenticated users', async () => {
    const rows = await world.db.query<{ name: string }>(
      `select distinct p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')
       order by 1`,
    );
    expect(rows.map((row) => row.name)).toEqual(
      [
        'accept_staff_invitation',
        'add_report_attachment',
        'add_report_comment',
        'assign_report',
        'confirm_report',
        'decline_staff_invitation',
        'follow_report',
        'get_audit_log',
        'get_colleagues',
        'get_my_staff_invitations',
        'get_my_report_attachments',
        'get_my_report_comments',
        'get_my_report_updates',
        'get_my_reports',
        'get_public_reports',
        'get_report_reporter_contact',
        'register_push_token',
        'revoke_staff_invitation',
        'set_announcement_status',
        'set_employee_role',
        'submit_report',
        'unconfirm_report',
        'unfollow_report',
        'update_report_status',
      ].sort(),
    );
  });

  it('pins search_path on every function in public and private', async () => {
    const unpinned = await world.db.query(
      `select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private')
         and not coalesce('search_path=""' = any (p.proconfig), false)`,
    );
    expect(unpinned).toEqual([]);
  });

  it('keeps internal write helpers out of reach of API roles', async () => {
    const internal = [
      'private.write_audit(uuid, text, text, uuid, jsonb, text)',
      'private.release_assignments_on_deactivation()',
      'private.notify_report_followers(uuid, public.notification_type, jsonb)',
      'private.audit_row_change()',
      'private.guard_employee_change()',
      'private.handle_new_user()',
    ];
    for (const signature of internal) {
      for (const role of ['anon', 'authenticated']) {
        const [row] = await world.db.query<{ allowed: boolean }>(
          `select has_function_privilege($1, $2, 'EXECUTE') as allowed`,
          [role, signature],
        );
        expect({ role, signature, allowed: row!.allowed }).toEqual({
          role,
          signature,
          allowed: false,
        });
      }
    }
    const [usage] = await world.db.query<{ allowed: boolean }>(
      `select has_schema_privilege('anon', 'private', 'USAGE') as allowed`,
    );
    expect(usage!.allowed).toBe(false);
  });

  it('keeps database enums identical to packages/shared', async () => {
    const values = async (type: string) =>
      (
        await world.db.query<{ v: string }>(
          `select unnest(enum_range(null::public.${type}))::text as v`,
        )
      ).map((row) => row.v);

    expect(await values('staff_role')).toEqual([...MUNICIPAL_STAFF_ROLES]);
    expect(await values('report_status')).toEqual([...REPORT_STATUSES]);
    expect(await values('report_priority')).toEqual([...REPORT_PRIORITIES]);
    expect(await values('report_visibility')).toEqual([...REPORT_VISIBILITIES]);
    expect(await values('report_rejection_reason')).toEqual([...REPORT_REJECTION_REASONS]);
  });

  it('keeps the category catalog and sensitive defaults identical to packages/shared', async () => {
    const rows = await world.db.query<{ code: string; default_visibility: string }>(
      `select code, default_visibility::text from public.report_categories order by sort_order`,
    );
    expect(rows.map((row) => row.code)).toEqual([...REPORT_CATEGORIES]);
    expect(
      rows.filter((row) => row.default_visibility === 'private').map((row) => row.code),
    ).toEqual([...SENSITIVE_REPORT_CATEGORIES]);
  });

  it('keeps the status workflow identical to packages/shared', async () => {
    const rows = await world.db.query<{ from_status: string; to_status: string }>(
      `select from_status::text, to_status::text from public.report_status_transitions`,
    );
    const fromDb = rows.map((row) => `${row.from_status}->${row.to_status}`).sort();
    const fromShared = Object.entries(REPORT_STATUS_TRANSITIONS)
      .flatMap(([from, targets]) => targets.map((to) => `${from}->${to}`))
      .sort();
    expect(fromDb).toEqual(fromShared);
  });

  it('applies the development seed, which contains only fictional data', async () => {
    await world.db.exec(TestDb.readSeed());
    const municipalities = await world.db.query<{ code: string; name: { en: string } }>(
      `select code, name from public.municipalities where code like 'DM%' order by code`,
    );
    expect(municipalities.map((row) => row.code)).toEqual(['DMN', 'DMS']);
    for (const municipality of municipalities) expect(municipality.name.en).toMatch(/^Demo /);
    const [counts] = await world.db.query<{ users: number; reports: number }>(
      `select (select count(*)::int from auth.users where email not like '%@example.test') as users,
              (select count(*)::int from public.reports r join public.municipalities m
                 on m.id = r.municipality_id where m.code like 'DM%') as reports`,
    );
    expect(counts).toEqual({ users: 0, reports: 0 });
  });
});
