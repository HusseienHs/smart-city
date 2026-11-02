import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { TestDb } from './db';
import { type FixtureReports, setupFixtures } from './fixtures';

export interface World {
  db: TestDb;
  reports: FixtureReports;
}

/**
 * Boots one database per test file with all migrations + fixtures, and wraps every test in
 * a transaction that is rolled back, so tests never affect each other.
 */
export function useWorld(): World {
  const world = {} as World;

  beforeAll(async () => {
    world.db = await TestDb.create();
    world.reports = await setupFixtures(world.db);
  });

  afterAll(async () => {
    await world.db?.close();
  });

  beforeEach(async () => {
    await world.db.begin();
  });

  afterEach(async () => {
    await world.db.rollback();
  });

  return world;
}

/** Matches the generic error RLS / missing grants produce. */
export const DENIED = /permission denied|row-level security|access denied|not allowed|cannot/i;
