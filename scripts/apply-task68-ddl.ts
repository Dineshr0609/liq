import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Applying Task 68 DDL...');
  await db.execute(sql`ALTER TABLE flow_types ADD COLUMN IF NOT EXISTS cash_direction varchar DEFAULT 'derived'`);
  console.log('✓ flow_types.cash_direction');
  await db.execute(sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS source_accrual_id varchar`);
  console.log('✓ obligations.source_accrual_id');
  await db.execute(sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS superseded_by_obligation_id varchar`);
  console.log('✓ obligations.superseded_by_obligation_id');
  await db.execute(sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS adjustment_reason text`);
  console.log('✓ obligations.adjustment_reason');
  // FK for self-ref (only if not already present).
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
         WHERE constraint_name = 'obligations_superseded_by_obligation_id_fk'
      ) THEN
        ALTER TABLE obligations
          ADD CONSTRAINT obligations_superseded_by_obligation_id_fk
          FOREIGN KEY (superseded_by_obligation_id)
          REFERENCES obligations(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);
  console.log('✓ obligations.superseded_by_obligation_id FK');
  await db.execute(sql`CREATE INDEX IF NOT EXISTS obligations_source_accrual_idx ON obligations(source_accrual_id)`);
  console.log('✓ obligations_source_accrual_idx');
  // Re-seed flow types so the cash_direction values are populated.
  await db.execute(sql`UPDATE flow_types SET cash_direction = 'inbound'  WHERE code = 'VRP'`);
  await db.execute(sql`UPDATE flow_types SET cash_direction = 'outbound' WHERE code IN ('CRP','RLA','SUB','RSM')`);
  await db.execute(sql`UPDATE flow_types SET cash_direction = 'derived'  WHERE code = 'OEM'`);
  console.log('✓ flow_types cash_direction seeded');
  console.log('Task 68 DDL applied successfully.');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
