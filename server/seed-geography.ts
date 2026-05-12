/**
 * Geography Master Seeder
 *
 * Seeds the country / state / city master tables used by partner address
 * lookups and the Reference Lookups admin UI:
 *
 *   - country_master  (~17 countries — country_code keyed, e.g. US, CA, GB)
 *   - state_master    (~128 states/provinces, FK to country)
 *   - city_master     (~184 cities, FK to state)
 *
 * Idempotency
 * -----------
 * - country_master is keyed by country_code (insert when missing).
 * - state_master is keyed by (country_code, state_code). The seeder
 *   resolves the country FK at insert time by looking up country_code, so
 *   it does not depend on integer auto-increment ids matching across DBs.
 * - city_master is keyed by (country_code, state_code, city_name,
 *   postal_code) and resolves the state FK the same way.
 *
 * If country_master is missing a country_code that the state seed
 * references, the state row is skipped (and same for city → state). This
 * keeps the seeder safe to re-run after partial admin edits.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';
import {
  COUNTRY_MASTER_SEED,
  STATE_MASTER_SEED,
  CITY_MASTER_SEED,
} from './seed-data/geography-data';

export async function seedGeographyMasters(): Promise<void> {
  let inserted = 0;

  // --- country_master ---------------------------------------------------
  for (const c of COUNTRY_MASTER_SEED) {
    const r = await db.execute(sql`
      INSERT INTO country_master (country_code, country_name)
      VALUES (${c.country_code}, ${c.country_name})
      ON CONFLICT (country_code) DO NOTHING
      RETURNING id;
    `);
    if ((r as any).rows?.length) inserted++;
  }
  if (inserted) console.log(`✓ Seeded ${inserted} country master row(s)`);
  inserted = 0;

  // --- state_master -----------------------------------------------------
  // Build a country_code → id map once; cheaper than per-row lookups.
  const countryRows = await db.execute(sql`
    SELECT id, country_code FROM country_master;
  `);
  const countryIdByCode = new Map<string, number>();
  for (const row of (countryRows as any).rows as Array<{ id: number; country_code: string }>) {
    countryIdByCode.set(row.country_code, row.id);
  }

  for (const s of STATE_MASTER_SEED) {
    const countryId = countryIdByCode.get(s.country_code);
    if (!countryId) continue; // unresolved country, skip safely

    const exists = await db.execute(sql`
      SELECT 1 FROM state_master
      WHERE country_id = ${countryId} AND state_code = ${s.state_code}
      LIMIT 1;
    `);
    if ((exists as any).rows?.length) continue;

    await db.execute(sql`
      INSERT INTO state_master (state_code, state_name, country_id)
      VALUES (${s.state_code}, ${s.state_name}, ${countryId});
    `);
    inserted++;
  }
  if (inserted) console.log(`✓ Seeded ${inserted} state master row(s)`);
  inserted = 0;

  // --- city_master ------------------------------------------------------
  // Build a (country_code|state_code) → state_id map once.
  const stateRows = await db.execute(sql`
    SELECT sm.id, sm.state_code, cm.country_code
    FROM state_master sm
    JOIN country_master cm ON cm.id = sm.country_id;
  `);
  const stateIdByKey = new Map<string, number>();
  for (const row of (stateRows as any).rows as Array<{ id: number; state_code: string; country_code: string }>) {
    stateIdByKey.set(`${row.country_code}|${row.state_code}`, row.id);
  }

  for (const c of CITY_MASTER_SEED) {
    const stateId = stateIdByKey.get(`${c.country_code}|${c.state_code}`);
    if (!stateId) continue;

    const exists = await db.execute(sql`
      SELECT 1 FROM city_master
      WHERE state_id = ${stateId}
        AND city_name = ${c.city_name}
        AND postal_code IS NOT DISTINCT FROM ${c.postal_code ?? null}
      LIMIT 1;
    `);
    if ((exists as any).rows?.length) continue;

    await db.execute(sql`
      INSERT INTO city_master (city_name, postal_code, state_id)
      VALUES (${c.city_name}, ${c.postal_code ?? null}, ${stateId});
    `);
    inserted++;
  }
  if (inserted) console.log(`✓ Seeded ${inserted} city master row(s)`);
}
