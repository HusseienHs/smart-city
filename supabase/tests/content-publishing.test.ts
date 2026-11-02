import { describe, expect, it } from 'vitest';

import { anon, type Actor, user } from './support/db';
import { ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/**
 * Admins publish everything; department managers publish their department's content;
 * other staff only draft. Every publish is audited.
 */
describe('content publishing', () => {
  const world = useWorld();

  const draft = async (actor: Actor, departmentId: string | null) => {
    const [row] = await world.db.as<{ id: string }>(
      actor,
      `insert into public.announcements (municipality_id, department_id, title, body)
       values ($1, $2, '{"he": "סגירת כביש"}', '{"he": "הכביש ייסגר מחר"}') returning id`,
      [ids.muniA, departmentId],
    );
    return row!.id;
  };

  const publish = (actor: Actor, id: string) =>
    world.db.as(actor, `select public.set_announcement_status($1, 'published')`, [id]);
  const failPublish = (actor: Actor, id: string) =>
    world.db.fails(actor, `select public.set_announcement_status($1, 'published')`, [id]);

  const status = async (id: string) =>
    (
      await world.db.query<{ status: string; published_by: string | null }>(
        `select status, published_by from public.announcements where id = $1`,
        [id],
      )
    )[0];

  it('lets employees draft for their own department but never publish', async () => {
    const id = await draft(user(ids.employeeAX), ids.deptAX);
    expect(await status(id)).toEqual({ status: 'draft', published_by: null });
    expect(await failPublish(user(ids.employeeAX), id)).toMatch(DENIED);
    expect(
      await world.db.fails(
        user(ids.employeeAX),
        `update public.announcements set status = 'published' where id = $1`,
        [id],
      ),
    ).toMatch(DENIED);
    expect(
      await world.db.fails(
        user(ids.employeeAX),
        `insert into public.announcements (municipality_id, department_id, title, body, status)
         values ($1, $2, '{"he": "x"}', '{"he": "y"}', 'published')`,
        [ids.muniA, ids.deptAX],
      ),
    ).toMatch(DENIED);
  });

  it('does not let staff draft for another department or municipality-wide', async () => {
    expect(
      await world.db.fails(
        user(ids.employeeAX),
        `insert into public.announcements (municipality_id, department_id, title, body)
         values ($1, $2, '{"he": "x"}', '{"he": "y"}')`,
        [ids.muniA, ids.deptAY],
      ),
    ).toMatch(DENIED);
    expect(
      await world.db.fails(
        user(ids.managerAX),
        `insert into public.announcements (municipality_id, department_id, title, body)
         values ($1, null, '{"he": "x"}', '{"he": "y"}')`,
        [ids.muniA],
      ),
    ).toMatch(DENIED);
  });

  it("lets a department manager publish their department's content only", async () => {
    const own = await draft(user(ids.employeeAX), ids.deptAX);
    const other = await draft(user(ids.managerAY), ids.deptAY);

    await publish(user(ids.managerAX), own);
    expect(await status(own)).toEqual({ status: 'published', published_by: ids.managerAX });
    expect(await failPublish(user(ids.managerAX), other)).toMatch(DENIED);
  });

  it('lets a municipality admin publish anything in their municipality, but not elsewhere', async () => {
    const departmentDraft = await draft(user(ids.managerAY), ids.deptAY);
    const cityWide = await draft(user(ids.adminA), null);
    await publish(user(ids.adminA), departmentDraft);
    await publish(user(ids.adminA), cityWide);
    expect((await status(cityWide))!.status).toBe('published');
    expect(await failPublish(user(ids.adminB), departmentDraft)).toMatch(DENIED);
  });

  it('records every publishing action in the audit log', async () => {
    const id = await draft(user(ids.adminA), null);
    await publish(user(ids.adminA), id);
    await world.db.as(user(ids.adminA), `select public.set_announcement_status($1, 'archived')`, [
      id,
    ]);
    const audit = await world.db.query<{ action: string; actor_id: string }>(
      `select action, actor_id from public.audit_logs where entity_id = $1 order by id`,
      [id],
    );
    expect(audit).toEqual([
      { action: 'announcement.published', actor_id: ids.adminA },
      { action: 'announcement.archived', actor_id: ids.adminA },
    ]);
  });

  it('audits edits to published content and blocks edits by non-publishers', async () => {
    const id = await draft(user(ids.employeeAX), ids.deptAX);
    await publish(user(ids.managerAX), id);

    const byAuthor = await world.db.as(
      user(ids.employeeAX),
      `update public.announcements set severity = 'emergency' where id = $1 returning id`,
      [id],
    );
    expect(byAuthor).toHaveLength(0);

    await world.db.as(
      user(ids.managerAX),
      `update public.announcements set severity = 'important' where id = $1`,
      [id],
    );
    const [edit] = await world.db.query<{ actor_id: string }>(
      `select actor_id from public.audit_logs where entity_id = $1 and action = 'announcement.edited'`,
      [id],
    );
    expect(edit!.actor_id).toBe(ids.managerAX);
  });

  it('shows drafts to staff of the municipality only, and published content to everyone', async () => {
    const draftId = await draft(user(ids.adminA), null);
    const publishedId = await draft(user(ids.adminA), null);
    await publish(user(ids.adminA), publishedId);

    for (const actor of [anon, user(ids.citizenA1), user(ids.adminB)]) {
      const visible = (
        await world.db.as<{ id: string }>(actor, `select id from public.announcements`)
      ).map((row) => row.id);
      expect(visible).toContain(publishedId);
      expect(visible).not.toContain(draftId);
    }
    const staffView = (
      await world.db.as<{ id: string }>(user(ids.employeeAY), `select id from public.announcements`)
    ).map((row) => row.id);
    expect(staffView).toEqual(expect.arrayContaining([draftId, publishedId]));
  });
});
