import { describe, expect, it } from 'vitest';

import { anon, user } from './support/db';
import { ids } from './support/fixtures';
import { DENIED, useWorld } from './support/world';

/** Migration 20261108000100_israeli_cities (docs/israeli-cities-design.md). */
describe('Israeli cities and the home city at sign-up', () => {
  const world = useWorld();
  const citizenA1 = user(ids.citizenA1);
  const adminA = user(ids.adminA);

  const haifaId = async () => {
    const [row] = await world.db.query<{ id: string }>(
      `select id from public.municipalities where cbs_code = 4000`,
    );
    return row!.id;
  };

  const signUp = (userId: string, metadata: Record<string, unknown>) =>
    world.db.query(
      `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
       values ($1, $2, now(), $3::jsonb)`,
      [userId, `${userId}@example.test`, JSON.stringify(metadata)],
    );

  const homeOf = async (userId: string) => {
    const [row] = await world.db.query<{ home_municipality_id: string | null }>(
      `select home_municipality_id from public.profiles where id = $1`,
      [userId],
    );
    return row!.home_municipality_id;
  };

  describe('data', () => {
    it('loads the 82 CBS cities as onboarding, with unique codes and all three languages', async () => {
      const rows = await world.db.query<{
        code: string;
        status: string;
        name: Record<string, string>;
      }>(`select code, status, name from public.municipalities where cbs_code is not null`);
      expect(rows).toHaveLength(82);
      expect(new Set(rows.map((row) => row.code)).size).toBe(82);
      expect(rows.every((row) => row.status === 'onboarding')).toBe(true);
      expect(rows.every((row) => row.name.he && row.name.ar && row.name.en)).toBe(true);
      expect(rows.find((row) => row.code === 'JLM')?.name.en).toBe('Jerusalem');
    });
  });

  describe('read access', () => {
    it('lets anonymous visitors and citizens read onboarding cities', async () => {
      for (const actor of [anon, citizenA1]) {
        const rows = await world.db.as(
          actor,
          `select id from public.municipalities where status = 'onboarding'`,
        );
        expect(rows).toHaveLength(82);
      }
    });

    it('still hides suspended municipalities', async () => {
      const haifa = await haifaId();
      await world.db.query(`update public.municipalities set status = 'suspended' where id = $1`, [
        haifa,
      ]);
      for (const actor of [anon, citizenA1]) {
        const rows = await world.db.as(
          actor,
          `select id from public.municipalities where id = $1`,
          [haifa],
        );
        expect(rows).toHaveLength(0);
      }
    });

    it('does not let staff change the CBS code', async () => {
      expect(
        await world.db.fails(
          adminA,
          `update public.municipalities set cbs_code = 1 where id = $1`,
          [ids.muniA],
        ),
      ).toMatch(DENIED);
    });
  });

  describe('sign-up trigger', () => {
    const newUser = '00000000-0000-4000-8000-00000000f001';

    it('stores a chosen onboarding city as the home municipality', async () => {
      const haifa = await haifaId();
      await signUp(newUser, { full_name: 'New Citizen', home_municipality_id: haifa });
      expect(await homeOf(newUser)).toBe(haifa);
    });

    it('stores a chosen active municipality', async () => {
      await signUp(newUser, { home_municipality_id: ids.muniA });
      expect(await homeOf(newUser)).toBe(ids.muniA);
    });

    it.each([
      ['a value that is not a uuid', 'not-a-uuid'],
      ['an unknown municipality', '00000000-0000-4000-8000-0000000fffff'],
      ['a number', 42],
    ])('ignores %s without failing the sign-up', async (_label, value) => {
      await signUp(newUser, { full_name: 'New Citizen', home_municipality_id: value });
      expect(await homeOf(newUser)).toBeNull();
    });

    it('ignores a suspended municipality', async () => {
      const haifa = await haifaId();
      await world.db.query(`update public.municipalities set status = 'suspended' where id = $1`, [
        haifa,
      ]);
      await signUp(newUser, { home_municipality_id: haifa });
      expect(await homeOf(newUser)).toBeNull();
    });
  });

  describe('reports', () => {
    it('rejects a report to a city that has not joined yet', async () => {
      const haifa = await haifaId();
      expect(
        await world.db.fails(
          citizenA1,
          `select * from public.submit_report(
             p_municipality_id => $1, p_category_code => 'pothole',
             p_description => 'Deep pothole next to the bus stop',
             p_latitude => 32.8, p_longitude => 35.0)`,
          [haifa],
        ),
      ).toMatch(/not active/i);
    });
  });

  it('lets a citizen set an onboarding city as home in their profile', async () => {
    const haifa = await haifaId();
    await world.db.as(
      citizenA1,
      `update public.profiles set home_municipality_id = $1, home_neighborhood_id = null where id = $2`,
      [haifa, ids.citizenA1],
    );
    expect(await homeOf(ids.citizenA1)).toBe(haifa);
  });
});
