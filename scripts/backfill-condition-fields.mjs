#!/usr/bin/env node
/**
 * One-shot backfill: reclassify mislabeled `qualifier_field='product_category'` rows.
 *
 * Context: 44 product-name qualifier rows were stored with qualifier_field
 * 'product_category' but the values are individual product names (e.g.
 * "SoundPro Wireless Headphones - Black"), not category labels. Under the
 * new conditions architecture (5 fields: product, product_category, partner,
 * customer, territory), these should be `qualifier_field = 'product'`.
 *
 * Heuristic: if qualifier_value matches a product name in the products master
 * table (by exact or fuzzy match), reclassify to 'product'. Otherwise leave
 * as 'product_category'. Also default qualifier_logic to 'G1' where NULL so
 * rows have a group id.
 *
 * Idempotent: re-runs are safe.
 *
 * Usage:
 *   node scripts/backfill-condition-fields.mjs           # dry-run, prints plan
 *   node scripts/backfill-condition-fields.mjs --apply   # actually update
 */

import pg from 'pg';

const { Pool } = pg;
const APPLY = process.argv.includes('--apply');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

function norm(s) {
  return (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log(`[backfill] Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  // 1) Default qualifier_logic to 'G1' where NULL/empty.
  const logicRows = await pool.query(
    `SELECT COUNT(*)::int AS n FROM contract_qualifiers
     WHERE qualifier_field IN ('product','product_category','partner','customer','territory')
       AND (qualifier_logic IS NULL OR qualifier_logic = '')`
  );
  console.log(`[backfill] Rows missing qualifier_logic: ${logicRows.rows[0].n}`);
  if (APPLY && logicRows.rows[0].n > 0) {
    const upd = await pool.query(
      `UPDATE contract_qualifiers SET qualifier_logic = 'G1'
       WHERE qualifier_field IN ('product','product_category','partner','customer','territory')
         AND (qualifier_logic IS NULL OR qualifier_logic = '')`
    );
    console.log(`[backfill] Updated qualifier_logic on ${upd.rowCount} row(s).`);
  }

  // 2) Reclassify product_category rows whose value matches a product name.
  const candRows = await pool.query(
    `SELECT qualifier_id AS id, qualifier_value FROM contract_qualifiers
     WHERE qualifier_field = 'product_category'`
  );
  console.log(`[backfill] product_category rows to inspect: ${candRows.rows.length}`);

  let products = [];
  try {
    const prodRows = await pool.query(`SELECT id, product_name FROM products`);
    products = prodRows.rows;
  } catch (e) {
    console.warn(`[backfill] Could not read products table: ${e.message}`);
  }

  const productIndex = new Map();
  for (const p of products) {
    if (p.product_name) productIndex.set(norm(p.product_name), p.product_name);
  }

  const toReclassify = [];
  for (const r of candRows.rows) {
    const k = norm(r.qualifier_value);
    if (!k) continue;
    if (productIndex.has(k)) {
      toReclassify.push({ id: r.id, value: r.qualifier_value, matched: productIndex.get(k) });
    }
  }

  console.log(`[backfill] Rows to reclassify product_category → product: ${toReclassify.length}`);
  for (const r of toReclassify.slice(0, 20)) {
    console.log(`  - "${r.value}" → product (matched master "${r.matched}")`);
  }
  if (toReclassify.length > 20) console.log(`  ...and ${toReclassify.length - 20} more.`);

  if (APPLY && toReclassify.length > 0) {
    const ids = toReclassify.map((r) => r.id);
    const upd = await pool.query(
      `UPDATE contract_qualifiers SET qualifier_field = 'product'
       WHERE qualifier_id = ANY($1::text[])`,
      [ids]
    );
    console.log(`[backfill] Reclassified ${upd.rowCount} row(s).`);
  }

  console.log('[backfill] Done.');
  await pool.end();
}

main().catch((err) => {
  console.error('[backfill] ERROR:', err);
  process.exit(1);
});
