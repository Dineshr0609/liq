import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Applying Task 69 DDL...');
  // Additive only — adds the new sparse override column. Null/missing means
  // "inherit from company / built-in matrix" by design.
  await db.execute(sql`ALTER TABLE flow_types ADD COLUMN IF NOT EXISTS document_type_overrides jsonb`);
  console.log('✓ flow_types.document_type_overrides');
  // We deliberately do NOT mutate `claim_type_outcome` here. The
  // pre-Task-69 seed had outbound rebate_settlement = ar_invoice, but
  // operators may have hand-tuned that table; clobbering it on every
  // post-merge run would silently destroy their configuration. The fix
  // for the regression lives in `BUILT_IN_DOCUMENT_TYPE_MATRIX`
  // (shared/schema.ts) and the cascade in
  // `documentTypeForClaim`, which now treats the built-in matrix as the
  // authoritative fallback for known claim types and only consults the
  // legacy table for claim types not present in the matrix. See
  // server/services/intakeAgentService.ts for the resolver order.
  console.log('Task 69 DDL applied successfully.');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
