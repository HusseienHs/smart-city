import {
  buildReportPhotoPath,
  newReportPhotoId,
  REPORT_MEDIA_BUCKET,
  REPORT_SUBMISSION_MESSAGES,
} from '@smart-city/api';
import { describe, expect, it } from 'vitest';

import { type Actor, user } from './support/db';
import { ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/**
 * Report submission as @smart-city/api performs it — the same RPC argument names, the same
 * storage paths (buildReportPhotoPath) and the same retry assumptions — against the real RPCs,
 * storage policies and constraints.
 */
describe('@smart-city/api report submission against the real database', () => {
  const world = useWorld();
  const citizenA1 = user(ids.citizenA1);
  const citizenA2 = user(ids.citizenA2);
  const insideA = { latitude: 32.07, longitude: 34.75 };

  /** submit_report with named arguments, exactly as the API's rpc() call sends them. */
  const submit = (actor: Actor, overrides: Record<string, unknown> = {}) => {
    const args = {
      p_municipality_id: ids.muniA,
      p_category_code: 'pothole',
      p_description: 'Deep pothole in the right lane, next to the bus stop',
      p_latitude: insideA.latitude,
      p_longitude: insideA.longitude,
      p_location_accuracy_m: 8,
      p_address: 'Herzl St 24',
      p_visibility: null,
      ...overrides,
    };
    const named = Object.keys(args).map((name, i) => `${name} => $${i + 1}`);
    const sql = `select * from public.submit_report(${named.join(', ')})`;
    const params = Object.values(args);
    return {
      sql,
      params,
      run: () => world.db.as<{ report_id: string; tracking_number: string }>(actor, sql, params),
    };
  };

  const photoPath = (reportId: string, mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg') =>
    buildReportPhotoPath({
      municipalityId: ids.muniA,
      reportId,
      photoId: newReportPhotoId(),
      mimeType,
    });

  const jpeg = (size = 180_000) => JSON.stringify({ size, mimetype: 'image/jpeg' });
  const uploadSql = `insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3::jsonb)`;
  const upload = (actor: Actor, path: string, metadata = jpeg()) =>
    world.db.as(actor, uploadSql, [REPORT_MEDIA_BUCKET, path, metadata]);
  const failUpload = (actor: Actor, path: string, metadata = jpeg()) =>
    world.db.fails(actor, uploadSql, [REPORT_MEDIA_BUCKET, path, metadata]);
  const attach = (actor: Actor, reportId: string, path: string) =>
    world.db.as<{ add_report_attachment: string }>(
      actor,
      `select public.add_report_attachment(p_report_id => $1, p_storage_path => $2)`,
      [reportId, path],
    );
  const failAttach = (actor: Actor, reportId: string, path: string) =>
    world.db.fails(
      actor,
      `select public.add_report_attachment(p_report_id => $1, p_storage_path => $2)`,
      [reportId, path],
    );

  describe('submitReport', () => {
    it('submits with the API argument names and returns a real tracking number', async () => {
      const [row] = await submit(citizenA1).run();
      expect(row!.report_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(row!.tracking_number).toMatch(/^TSA-\d{4}-\d{6}$/);

      const [stored] = await world.db.query<{
        reporter_id: string;
        status: string;
        address: string;
      }>(`select reporter_id, status, address from public.reports where id = $1`, [row!.report_id]);
      expect(stored).toEqual({
        reporter_id: ids.citizenA1,
        status: 'submitted',
        address: 'Herzl St 24',
      });
    });

    it('creates a new report on every call (why the client must never resubmit on retry)', async () => {
      const [first] = await submit(citizenA1).run();
      const [second] = await submit(citizenA1).run();
      expect(second!.report_id).not.toBe(first!.report_id);
      expect(second!.tracking_number).not.toBe(first!.tracking_number);
    });

    it('raises the exact messages the API turns into explainable reasons', async () => {
      const failing: [keyof typeof REPORT_SUBMISSION_MESSAGES, Record<string, unknown>][] = [
        ['municipality_unavailable', { p_municipality_id: '00000000-0000-4000-8000-0000000000ff' }],
        ['category_unavailable', { p_category_code: 'graffiti' }],
        ['outside_municipality', { p_latitude: 31.0, p_longitude: 34.0 }],
      ];
      for (const [issue, overrides] of failing) {
        const { sql, params } = submit(citizenA1, overrides);
        const message = await world.db.fails(citizenA1, sql, params);
        expect(REPORT_SUBMISSION_MESSAGES[issue]).toContain(message);
      }
    });
  });

  describe('photos', () => {
    it('a path built by buildReportPhotoPath passes the storage policy and add_report_attachment', async () => {
      const [report] = await submit(citizenA1).run();
      const path = photoPath(report!.report_id);
      await upload(citizenA1, path);
      const [registered] = await attach(citizenA1, report!.report_id, path);
      expect(registered!.add_report_attachment).toMatch(/^[0-9a-f-]{36}$/);

      const [row] = await world.db.query<{ mime_type: string; size_bytes: number }>(
        `select mime_type, size_bytes from public.report_attachments where storage_path = $1`,
        [path],
      );
      // Size and type come from the stored object's metadata, not from the caller.
      expect(row).toEqual({ mime_type: 'image/jpeg', size_bytes: 180_000 });
    });

    it('a retried upload of the same path is a unique violation (the API reads it as "already uploaded")', async () => {
      const [report] = await submit(citizenA1).run();
      const path = photoPath(report!.report_id);
      await upload(citizenA1, path);
      expect(await failUpload(citizenA1, path)).toMatch(/duplicate key|unique/i);
      const [{ count }] = (await world.db.query<{ count: string }>(
        `select count(*) from storage.objects where name = $1`,
        [path],
      )) as [{ count: string }];
      expect(Number(count)).toBe(1);
    });

    it('a retried registration of the same path is a unique violation (the API reads it as "already registered")', async () => {
      const [report] = await submit(citizenA1).run();
      const path = photoPath(report!.report_id);
      await upload(citizenA1, path);
      await attach(citizenA1, report!.report_id, path);
      expect(await failAttach(citizenA1, report!.report_id, path)).toMatch(/duplicate key|unique/i);

      const listed = await world.db.as<{ storage_path: string }>(
        citizenA1,
        `select storage_path from public.get_my_report_attachments($1)`,
        [report!.report_id],
      );
      expect(listed.map((row) => row.storage_path)).toEqual([path]);
    });

    it("a citizen cannot upload into, or register photos on, someone else's report", async () => {
      const [report] = await submit(citizenA1).run();
      const path = photoPath(report!.report_id);
      expect(await failUpload(citizenA2, path)).toMatch(DENIED);

      await upload(citizenA1, path);
      expect(await failAttach(citizenA2, report!.report_id, path)).toMatch(DENIED);
    });

    it('refuses photos once staff have moved the report on', async () => {
      const [report] = await submit(citizenA1).run();
      const uploaded = photoPath(report!.report_id);
      await upload(citizenA1, uploaded);

      await world.db.as(
        user(ids.dispatcherA),
        `select public.update_report_status($1, 'under_review')`,
        [report!.report_id],
      );

      expect(await failUpload(citizenA1, photoPath(report!.report_id))).toMatch(DENIED);
      expect(REPORT_SUBMISSION_MESSAGES.photos_closed).toContain(
        await failAttach(citizenA1, report!.report_id, uploaded),
      );
    });

    it('enforces the 5-photo limit in storage and in registration', async () => {
      const [report] = await submit(citizenA1).run();
      const paths = Array.from({ length: 5 }, () => photoPath(report!.report_id));
      for (const path of paths) {
        await upload(citizenA1, path);
        await attach(citizenA1, report!.report_id, path);
      }
      expect(await failUpload(citizenA1, photoPath(report!.report_id))).toMatch(DENIED);

      // Even a sixth object placed outside the API cannot be registered.
      const sixth = photoPath(report!.report_id);
      await world.db.query(uploadSql, [REPORT_MEDIA_BUCKET, sixth, jpeg()]);
      expect(REPORT_SUBMISSION_MESSAGES.photo_limit).toContain(
        await failAttach(citizenA1, report!.report_id, sixth),
      );
    });

    it('raises the exact photo messages the API explains', async () => {
      const [report] = await submit(citizenA1).run();

      // Never uploaded.
      expect(REPORT_SUBMISSION_MESSAGES.photo_missing).toContain(
        await failAttach(citizenA1, report!.report_id, photoPath(report!.report_id)),
      );

      // Too large according to the stored object's own metadata.
      const large = photoPath(report!.report_id);
      await upload(citizenA1, large, jpeg(10 * 1024 * 1024 + 1));
      expect(REPORT_SUBMISSION_MESSAGES.photo_invalid).toContain(
        await failAttach(citizenA1, report!.report_id, large),
      );

      // Declared type not allowed.
      const gif = photoPath(report!.report_id);
      await upload(citizenA1, gif, JSON.stringify({ size: 1000, mimetype: 'image/gif' }));
      expect(REPORT_SUBMISSION_MESSAGES.photo_invalid).toContain(
        await failAttach(citizenA1, report!.report_id, gif),
      );
    });
  });
});
