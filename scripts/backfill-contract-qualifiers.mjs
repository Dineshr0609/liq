#!/usr/bin/env node
// One-off: regenerate contract_qualifiers rows for one contract from its
// existing contract_rules.product_categories / territories arrays.
// Usage: node scripts/backfill-contract-qualifiers.mjs <contract_id>
import pg from 'pg';
import crypto from 'crypto';
const { Pool } = pg;
const contractId = process.argv[2];
if (!contractId) { console.error('Usage: node scripts/backfill-contract-qualifiers.mjs <contract_id>'); process.exit(1); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const prods = await pool.query(`SELECT product_name FROM products`);
const productSet = new Set(prods.rows.map((r) => norm(r.product_name)).filter(Boolean));

const rules = await pool.query(
  `SELECT id, contract_id, source_clause_id, rule_name, product_categories, territories
   FROM contract_rules WHERE contract_id = $1 AND is_active = true`,
  [contractId]
);
console.log(`[backfill-contract] ${rules.rows.length} rule(s) for contract ${contractId}`);

let totalIns = 0;
for (const r of rules.rows) {
  if (!r.source_clause_id) { console.log(`  - skip "${r.rule_name}" (no sourceClauseId)`); continue; }
  await pool.query(
    `DELETE FROM contract_qualifiers
     WHERE contract_id = $1 AND contract_clause_id = $2
       AND qualifier_field IN ('product','product_category','territory')`,
    [r.contract_id, r.source_clause_id]
  );
  const inserts = [];
  for (const cat of (r.product_categories || [])) {
    const t = (cat || '').trim(); if (!t) continue;
    const isExcl = t.startsWith('!'); const v = isExcl ? t.slice(1).trim() : t; if (!v) continue;
    const field = productSet.has(norm(v)) ? 'product' : 'product_category';
    inserts.push([crypto.randomUUID(), r.contract_id, r.source_clause_id, isExcl ? 'exclusion' : 'inclusion', field, isExcl ? 'not_in' : 'in', v, 'G1', `Synced from rule "${r.rule_name}"`]);
  }
  for (const terr of (r.territories || [])) {
    const v = (terr || '').trim(); if (!v) continue;
    inserts.push([crypto.randomUUID(), r.contract_id, r.source_clause_id, 'inclusion', 'territory', 'in', v, 'G1', `Synced from rule "${r.rule_name}"`]);
  }
  // term_id NOT NULL — reuse any existing term_id for the clause, else mint
  const existing = await pool.query(
    `SELECT term_id FROM contract_qualifiers WHERE contract_id=$1 AND contract_clause_id=$2 AND term_id IS NOT NULL LIMIT 1`,
    [r.contract_id, r.source_clause_id]
  );
  const termId = existing.rows[0]?.term_id || crypto.randomUUID();
  for (const ins of inserts) {
    await pool.query(
      `INSERT INTO contract_qualifiers (qualifier_id, term_id, contract_id, contract_clause_id, qualifier_type, qualifier_field, operator, qualifier_value, qualifier_logic, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [ins[0], termId, ...ins.slice(1)]);
  }
  console.log(`  ✓ "${r.rule_name}": ${inserts.length} row(s)`);
  totalIns += inserts.length;
}
console.log(`[backfill-contract] Done. Wrote ${totalIns} qualifier row(s).`);
await pool.end();
