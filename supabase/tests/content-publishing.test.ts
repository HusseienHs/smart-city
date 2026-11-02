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
  describe('dispatchers and author privacy (F8, F9)', () => {
    it('does not let intake dispatchers create drafts', async () => {
      for (const departmentId of [null, ids.deptAX]) {
        expect(
          await world.db.fails(
            user(ids.dispatcherA),
            `insert into public.announcements (municipality_id, department_id, title, body)
             values ($1, $2, '{"he": "x"}', '{"he": "y"}')`,
            [ids.muniA, departmentId],
          ),
        ).toMatch(DENIED);
      }
    });

    it('never exposes author user ids publicly', async () => {
      const id = await draft(user(ids.adminA), null);
      await publish(user(ids.adminA), id);
      for (const actor of [anon, user(ids.citizenA1), user(ids.adminA)]) {
        for (const column of ['created_by', 'published_by']) {
          expect(
            await world.db.fails(
              actor,
              `select ${column} from public.announcements where id = $1`,
              [id],
            ),
          ).toMatch(DENIED);
        }
      }
      const [row] = await world.db.as<Record<string, unknown>>(
        anon,
        `select id, title, status, published_at from public.announcements where id = $1`,
        [id],
      );
      expect(row).toMatchObject({ id, status: 'published' });
    });
  });

  describe('content images (F3)', () => {
    const image = (announcementId: string, n = 1) =>
      `${ids.muniA}/announcements/${announcementId}/${String(n).padStart(8, '0')}-1111-4222-8333-444455556666.jpg`;
    const put = (actor: Actor, bucket: string, path: string) =>
      world.db.as(actor, `insert into storage.objects (bucket_id, name) values ($1, $2)`, [
        bucket,
        path,
      ]);
    const failPut = (actor: Actor, bucket: string, path: string) =>
      world.db.fails(actor, `insert into storage.objects (bucket_id, name) values ($1, $2)`, [
        bucket,
        path,
      ]);
    const remove = (actor: Actor, bucket: string, path: string) =>
      world.db.as(
        actor,
        `delete from storage.objects where bucket_id = $1 and name = $2 returning name`,
        [bucket, path],
      );
    const setImage = (actor: Actor, id: string, path: string) =>
      world.db.as(actor, `update public.announcements set image_path = $2 where id = $1`, [
        id,
        path,
      ]);

    it('keeps draft images in a private bucket, visible to municipality staff only', async () => {
      const id = await draft(user(ids.employeeAX), ids.deptAX);
      await put(user(ids.employeeAX), 'content-drafts', image(id));

      const readDraft = (actor: Actor) =>
        world.db.as(
          actor,
          `select name from storage.objects where bucket_id = 'content-drafts' and name = $1`,
          [image(id)],
        );
      expect(await readDraft(user(ids.managerAY))).toHaveLength(1);
      for (const actor of [anon, user(ids.citizenA1), user(ids.adminB)]) {
        expect(await readDraft(actor)).toHaveLength(0);
      }
      const [bucket] = await world.db.query<{ public: boolean }>(
        `select public from storage.buckets where id = 'content-drafts'`,
      );
      expect(bucket!.public).toBe(false);

      // Non-editors cannot add draft images.
      expect(await failPut(user(ids.employeeAY), 'content-drafts', image(id, 2))).toMatch(DENIED);
      expect(await failPut(user(ids.dispatcherA), 'content-drafts', image(id, 3))).toMatch(DENIED);
    });

    it('publishes an image only after publication, only by a publisher, only at its image_path', async () => {
      const id = await draft(user(ids.employeeAX), ids.deptAX);
      await put(user(ids.employeeAX), 'content-drafts', image(id));
      await setImage(user(ids.employeeAX), id, image(id));

      // Still a draft: nobody can put it in the public bucket.
      expect(await failPut(user(ids.managerAX), 'public-content', image(id))).toMatch(DENIED);

      await publish(user(ids.managerAX), id);
      expect(await failPut(user(ids.employeeAX), 'public-content', image(id))).toMatch(DENIED); // not a publisher
      expect(await failPut(user(ids.managerAY), 'public-content', image(id))).toMatch(DENIED); // other dept
      expect(await failPut(user(ids.managerAX), 'public-content', image(id, 9))).toMatch(DENIED); // not image_path
      await put(user(ids.managerAX), 'public-content', image(id));
    });

    it('lets only authorized publishers delete public images', async () => {
      const id = await draft(user(ids.employeeAX), ids.deptAX);
      await setImage(user(ids.employeeAX), id, image(id));
      await publish(user(ids.managerAX), id);
      await put(user(ids.managerAX), 'public-content', image(id));

      for (const actor of [
        user(ids.employeeAX),
        user(ids.dispatcherA),
        user(ids.managerAY),
        user(ids.adminB),
      ]) {
        expect(await remove(actor, 'public-content', image(id))).toHaveLength(0);
      }
      expect(await remove(user(ids.adminA), 'public-content', image(id))).toHaveLength(1);
    });

    it('rejects image paths that do not belong to the announcement', async () => {
      const id = await draft(user(ids.employeeAX), ids.deptAX);
      const other = await draft(user(ids.employeeAX), ids.deptAX);
      expect(
        await world.db.fails(
          user(ids.employeeAX),
          `update public.announcements set image_path = $2 where id = $1`,
          [id, image(other)],
        ),
      ).toMatch(/check constraint/i);
    });
  });
});
