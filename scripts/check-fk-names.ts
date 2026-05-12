import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

const POSTGRES_IDENT_LIMIT = 63;

type Violation = {
  exportName: string;
  tableName: string;
  fkName: string;
  length: number;
};

function isPgTable(value: unknown): value is PgTable {
  return value !== null && typeof value === "object" && is(value, PgTable);
}

const violations: Violation[] = [];

for (const [exportName, value] of Object.entries(schema)) {
  if (!isPgTable(value)) continue;
  const config = getTableConfig(value);
  for (const fk of config.foreignKeys) {
    const name = fk.getName();
    if (name.length > POSTGRES_IDENT_LIMIT) {
      violations.push({
        exportName,
        tableName: config.name,
        fkName: name,
        length: name.length,
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    `\n[check-fk-names] Found ${violations.length} foreign key name(s) longer than ${POSTGRES_IDENT_LIMIT} characters.`,
  );
  console.error(
    "Postgres silently truncates identifiers at 63 chars, which causes drizzle-kit",
  );
  console.error(
    "to falsely detect drift on every db:push and re-drop/re-add the constraint.\n",
  );
  for (const v of violations) {
    console.error(
      `  - table "${v.tableName}" (export ${v.exportName}): "${v.fkName}" (${v.length} chars)`,
    );
  }
  console.error(
    `\nFix: replace the inline \`.references(...)\` with a table-level`,
  );
  console.error(`     \`foreignKey({ columns, foreignColumns, name })\` entry`);
  console.error(
    `     in the table's extra-config callback, using a short explicit name`,
  );
  console.error(`     (<= ${POSTGRES_IDENT_LIMIT} chars). For example:\n`);
  console.error(`       }, (table) => [`);
  console.error(`         foreignKey({`);
  console.error(`           columns: [table.someId],`);
  console.error(`           foreignColumns: [otherTable.id],`);
  console.error(`           name: "short_explicit_fk_name",`);
  console.error(`         }),`);
  console.error(`       ]);\n`);
  console.error(
    `See replit.md > "Schema Sync" for background on the 33 FKs already patched.`,
  );
  process.exit(1);
}

console.log(
  `[check-fk-names] OK — all foreign key names are within the ${POSTGRES_IDENT_LIMIT}-char Postgres limit.`,
);
