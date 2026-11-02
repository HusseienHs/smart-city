import { describe, expect, it } from 'vitest';

import { anon, user } from './support/db';
import { exactLocationA, ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

const PUBLIC_REPORT_COLUMNS = [
  'category_code',
  'confirmation_count',
  'id',
  'latitude',
  'longitude',
  'municipality_id',
  'reported_on',
  'status',
];

describe('public report exposure', () => {
  const world = useWorld();
  const outsider = user(ids.citizenB1);
  const wholeCityA = [ids.muniA, 32.0, 34.7, 32.1, 34.8];

  const publicReports = (actor = outsider, params: unknown[] = wholeCityA) =>
    world.db.as<Record<string, unknown>>(
      actor,
      `select * from public.get_public_reports($1, $2, $3, $4, $5)`,
      params,
    );

  it('lists public reports only — never private ones', async () => {
    const ids_ = (await publicReports()).map((row) => row.id);
    expect(ids_).toContain(world.reports.publicUnassignedA);
    expect(ids_).not.toContain(world.reports.privateNoiseA);
  });

  it('returns only the allowlisted columns', async () => {
    const [row] = await publicReports();
    expect(Object.keys(row!).sort()).toEqual(PUBLIC_REPORT_COLUMNS);
  });

  it('never leaks identity, contact details, description, address or internal fields', async () => {
    const serialized = JSON.stringify(await publicReports());
    for (const secret of [
      ids.citizenA1,
      ids.citizenA2,
      'Citizen A One',
      '+972000000001',
      'Synthetic test report',
      ids.deptAX,
      ids.employeeAX,
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('rounds locations to a ~50 m grid', async () => {
    const [row] = (await publicReports()).filter((r) => r.id === world.reports.publicUnassignedA);
    const latitude = row!.latitude as number;
    const longitude = row!.longitude as number;

    expect(latitude).not.toBeCloseTo(exactLocationA.latitude, 6);
    expect(longitude).not.toBeCloseTo(exactLocationA.longitude, 6);
    expect(Math.abs(latitude / 0.00045 - Math.round(latitude / 0.00045))).toBeLessThan(1e-6);

    const [{ meters }] = (await world.db.query<{ meters: number }>(
      `select extensions.st_distance(
         extensions.st_setsrid(extensions.st_makepoint($1, $2), 4326)::extensions.geography,
         extensions.st_setsrid(extensions.st_makepoint($3, $4), 4326)::extensions.geography) as meters`,
      [exactLocationA.longitude, exactLocationA.latitude, longitude, latitude],
    )) as [{ meters: number }];
    expect(meters).toBeGreaterThan(1);
    expect(meters).toBeLessThanOrEqual(40);
  });

  it('cannot be probed with a tiny bounding box around the exact location', async () => {
    const d = 0.00005; // ≈ 5 m
    const rows = await publicReports(outsider, [
      ids.muniA,
      exactLocationA.latitude - d,
      exactLocationA.longitude - d,
      exactLocationA.latitude + d,
      exactLocationA.longitude + d,
    ]);
    expect(rows).toHaveLength(0);
  });

  it('rejects oversized map areas and anonymous callers', async () => {
    expect(
      await world.db.fails(
        outsider,
        `select * from public.get_public_reports($1, 30, 33, 33, 36)`,
        [ids.muniA],
      ),
    ).toMatch(/too large/i);
    expect(
      await world.db.fails(
        anon,
        `select * from public.get_public_reports($1, $2, $3, $4, $5)`,
        wholeCityA,
      ),
    ).toMatch(DENIED);
  });

  it('hides rejected and duplicate reports', async () => {
    await world.db.as(
      user(ids.adminA),
      `select public.update_report_status($1, 'rejected', 'Already reported nearby', true, 'duplicate', $2)`,
      [world.reports.assignedXA, world.reports.publicUnassignedA],
    );
    const listed = (await publicReports()).map((row) => row.id);
    expect(listed).not.toContain(world.reports.assignedXA);
  });

  it('shows exact coordinates only to authorized municipal staff', async () => {
    const exactQuery = `select extensions.st_y(location::extensions.geometry) as lat from public.reports where id = $1`;
    const [staffView] = await world.db.as<{ lat: number }>(user(ids.dispatcherA), exactQuery, [
      world.reports.publicUnassignedA,
    ]);
    expect(staffView!.lat).toBeCloseTo(exactLocationA.latitude, 7);

    for (const actor of [
      outsider,
      user(ids.citizenA2),
      user(ids.employeeAY),
      user(ids.adminB),
      user(ids.platformAdmin),
    ]) {
      expect(await world.db.as(actor, exactQuery, [world.reports.publicUnassignedA])).toHaveLength(
        0,
      );
    }
  });

  describe('photos', () => {
    const objectPath = (reportId: string) =>
      `${ids.muniA}/${reportId}/0b9d6f1e-6c41-4d7f-9a3e-2f1c8d7e6a5b.jpg`;

    const upload = (actor: ReturnType<typeof user>, reportId: string) =>
      world.db.as(
        actor,
        `insert into storage.objects (bucket_id, name) values ('report-media', $1)`,
        [objectPath(reportId)],
      );

    const read = (actor: ReturnType<typeof user> | typeof anon, reportId: string) =>
      world.db.as(
        actor,
        `select name from storage.objects where bucket_id = 'report-media' and name = $1`,
        [objectPath(reportId)],
      );

    it('lets the reporter upload to their own new report only', async () => {
      await upload(user(ids.citizenA1), world.reports.publicUnassignedA);
      expect(
        await world.db.fails(
          user(ids.citizenA2),
          `insert into storage.objects (bucket_id, name) values ('report-media', $1)`,
          [
            `${ids.muniA}/${world.reports.publicUnassignedA}/1b9d6f1e-6c41-4d7f-9a3e-2f1c8d7e6a5b.jpg`,
          ],
        ),
      ).toMatch(DENIED);
      // Wrong municipality prefix for the report → denied.
      expect(
        await world.db.fails(
          user(ids.citizenA1),
          `insert into storage.objects (bucket_id, name) values ('report-media', $1)`,
          [
            `${ids.muniB}/${world.reports.publicUnassignedA}/2b9d6f1e-6c41-4d7f-9a3e-2f1c8d7e6a5b.jpg`,
          ],
        ),
      ).toMatch(DENIED);
    });

    it('never exposes photos publicly — only to the reporter and authorized staff', async () => {
      await upload(user(ids.citizenA1), world.reports.publicUnassignedA);
      await world.db.as(
        user(ids.citizenA1),
        `select public.add_report_attachment($1, $2, 'image/jpeg', 1000)`,
        [world.reports.publicUnassignedA, objectPath(world.reports.publicUnassignedA)],
      );

      expect(await read(user(ids.citizenA1), world.reports.publicUnassignedA)).toHaveLength(1);
      expect(await read(user(ids.dispatcherA), world.reports.publicUnassignedA)).toHaveLength(1);
      expect(await read(user(ids.adminA), world.reports.publicUnassignedA)).toHaveLength(1);

      for (const actor of [
        user(ids.citizenA2),
        user(ids.citizenB1),
        user(ids.employeeAY),
        user(ids.adminB),
        user(ids.platformAdmin),
      ]) {
        expect(await read(actor, world.reports.publicUnassignedA)).toHaveLength(0);
      }
      expect(await read(anon, world.reports.publicUnassignedA)).toHaveLength(0);

      const [bucket] = await world.db.query<{ public: boolean }>(
        `select public from storage.buckets where id = 'report-media'`,
      );
      expect(bucket!.public).toBe(false);
    });

    it('requires the file to exist and match the report before registering it', async () => {
      expect(
        await world.db.fails(
          user(ids.citizenA1),
          `select public.add_report_attachment($1, $2, 'image/jpeg', 1000)`,
          [world.reports.publicUnassignedA, objectPath(world.reports.publicUnassignedA)],
        ),
      ).toMatch(/not been uploaded/i);
      expect(
        await world.db.fails(
          user(ids.citizenA1),
          `select public.add_report_attachment($1, $2, 'image/jpeg', 1000)`,
          [world.reports.publicUnassignedA, objectPath(world.reports.privateNoiseA)],
        ),
      ).toMatch(/invalid storage path/i);
    });

    it('lets only handling staff add completion photos, while work is in progress', async () => {
      const report = world.reports.assignedXA;
      await world.db.as(
        user(ids.employeeAX),
        `select public.update_report_status($1, 'in_progress')`,
        [report],
      );
      const path = `${ids.muniA}/${report}/3b9d6f1e-6c41-4d7f-9a3e-2f1c8d7e6a5b.jpg`;

      expect(
        await world.db.fails(
          user(ids.employeeAY),
          `insert into storage.objects (bucket_id, name) values ('report-media', $1)`,
          [path],
        ),
      ).toMatch(DENIED);
      await world.db.as(
        user(ids.employeeAX),
        `insert into storage.objects (bucket_id, name) values ('report-media', $1)`,
        [path],
      );
      await world.db.as(
        user(ids.employeeAX),
        `select public.add_report_attachment($1, $2, 'image/jpeg', 1000, 'completion_photo')`,
        [report, path],
      );
      // The reporter sees the completion photo of their own report.
      const attachments = await world.db.as<{ kind: string }>(
        user(ids.citizenA2),
        `select kind from public.get_my_report_attachments($1)`,
        [report],
      );
      expect(attachments.map((row) => row.kind)).toEqual(['completion_photo']);
    });
  });
});
