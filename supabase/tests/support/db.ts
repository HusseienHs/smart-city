import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';

const here = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(here, '..', '..');
const migrationsDir = join(supabaseDir, 'migrations');

/** Who runs a statement: an anonymous visitor, a signed-in user, or the server. */
export type Actor =
  { role: 'anon' } | { role: 'authenticated'; userId: string } | { role: 'service' };

export const anon: Actor = { role: 'anon' };
export const service: Actor = { role: 'service' };
export const user = (userId: string): Actor => ({ role: 'authenticated', userId });

export type Row = Record<string, unknown>;

/**
 * In-process Postgres (PGlite, Postgres 18 + PostGIS) with the Supabase shim and every
 * migration applied. Each test should run inside `begin()` / `rollback()`; individual
 * statements run as a given actor inside a savepoint, exactly like an API request:
 * `SET ROLE` + `request.jwt.claims`.
 */
export class TestDb {
  private constructor(private readonly pg: PGlite) {}

  static async create(): Promise<TestDb> {
    const pg = await PGlite.create({ extensions: { postgis } });
    await pg.exec(readFileSync(join(here, 'supabase-shim.sql'), 'utf8'));
    for (const file of TestDb.migrationFiles()) {
      try {
        await pg.exec(readFileSync(join(migrationsDir, file), 'utf8'));
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
      }
    }
    return new TestDb(pg);
  }

  static migrationFiles(): string[] {
    return readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
  }

  static readSeed(): string {
    return readFileSync(join(supabaseDir, 'seed.sql'), 'utf8');
  }

  async begin(): Promise<void> {
    await this.pg.exec('begin');
  }

  async rollback(): Promise<void> {
    await this.pg.exec('rollback');
  }

  async commit(): Promise<void> {
    await this.pg.exec('commit');
  }

  /** Runs raw SQL as the database owner (setup only — bypasses RLS). */
  async exec(sql: string): Promise<void> {
    await this.pg.exec(sql);
  }

  /** Runs one statement as `actor` and returns the rows. Throws on database errors. */
  async as<T extends Row = Row>(actor: Actor, sql: string, params: unknown[] = []): Promise<T[]> {
    const role =
      actor.role === 'service' ? 'service_role' : actor.role === 'anon' ? 'anon' : 'authenticated';
    const claims =
      actor.role === 'authenticated'
        ? { sub: actor.userId, role: 'authenticated' }
        : { role: role };

    await this.pg.exec('savepoint actor_step');
    try {
      await this.pg.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(claims),
      ]);
      // `role` is one of three fixed literals above — never user input.
      await this.pg.exec(`set local role ${role}`);
      const result = await this.pg.query<T>(sql, params);
      await this.pg.exec('reset role');
      await this.pg.exec('release savepoint actor_step');
      return result.rows;
    } catch (error) {
      await this.pg.exec('rollback to savepoint actor_step');
      await this.pg.exec('release savepoint actor_step');
      throw error;
    }
  }

  /** Asserts that the statement fails, and returns the error message. */
  async fails(actor: Actor, sql: string, params: unknown[] = []): Promise<string> {
    try {
      await this.as(actor, sql, params);
    } catch (error) {
      return (error as Error).message;
    }
    throw new Error(`Expected statement to fail, but it succeeded: ${sql}`);
  }

  /**
   * Owner-level query (bypasses RLS) for setup and assertions about the resulting state.
   * Savepoint-protected, so an expected failure does not abort the surrounding test.
   */
  async query<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec('savepoint owner_step');
    try {
      const rows = (await this.pg.query<T>(sql, params)).rows;
      await this.pg.exec('release savepoint owner_step');
      return rows;
    } catch (error) {
      await this.pg.exec('rollback to savepoint owner_step');
      await this.pg.exec('release savepoint owner_step');
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}
