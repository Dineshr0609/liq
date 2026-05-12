import crypto from "crypto";
import { db } from "../db";
import { sql, and, eq, inArray } from "drizzle-orm";
import { contractQualifiers, contractTerms } from "@shared/schema";
import {
  QUALIFIER_FIELD_CODES,
  getDefaultAttribute,
  type Condition,
  type QualifierFieldCode,
} from "@shared/qualifierRegistry";

type Rule = {
  id: string;
  contractId: string;
  sourceClauseId?: string | null;
  productCategories?: string[] | null;
  territories?: string[] | null;
  ruleName?: string | null;
};

type QualifierRow = {
  qualifierId: string;
  termId: string | null;
  contractId: string | null;
  contractClauseId: string | null;
  qualifierType: string | null;
  qualifierField: string | null;
  operator: string | null;
  qualifierValue: string | null;
  notes?: string | null;
};

/**
 * Derive productCategories and territories arrays for a single rule from its
 * qualifier rows. Returns null when we can't derive (no sourceClauseId or no
 * matching qualifiers) so callers can keep the stored arrays as fallback.
 *
 * Exclusions are encoded as `!Value` to match the existing `productCategories`
 * convention consumed by `ruleMatchingUtils.buildMergedFilters`.
 */
export function deriveArraysForRule(
  rule: Pick<Rule, "sourceClauseId">,
  qualifiersForContract: QualifierRow[]
): { productCategories: string[]; territories: string[] } | null {
  if (!rule.sourceClauseId) return null;

  const relevant = qualifiersForContract.filter(
    q => q.contractClauseId === rule.sourceClauseId
  );
  if (relevant.length === 0) return null;

  const productCategories: string[] = [];
  const territories: string[] = [];
  const seenProd = new Set<string>();
  const seenTerr = new Set<string>();

  for (const q of relevant) {
    const value = (q.qualifierValue || "").trim();
    if (!value) continue;

    const isExclusion =
      (q.qualifierType || "").toLowerCase() === "exclusion" ||
      (q.operator || "").toLowerCase() === "not_in" ||
      (q.operator || "").toLowerCase() === "not in";

    if (q.qualifierField === "product_category" || q.qualifierField === "product") {
      const encoded = isExclusion ? `!${value}` : value;
      const key = encoded.toLowerCase();
      if (!seenProd.has(key)) {
        seenProd.add(key);
        productCategories.push(encoded);
      }
    } else if (q.qualifierField === "territory") {
      const key = value.toLowerCase();
      if (!seenTerr.has(key)) {
        seenTerr.add(key);
        territories.push(value);
      }
    }
  }

  return { productCategories, territories };
}

/**
 * Fetch all product/territory qualifiers for a contract in a single query.
 */
async function fetchQualifiersForContract(contractId: string): Promise<QualifierRow[]> {
  const rows = await db
    .select()
    .from(contractQualifiers)
    .where(
      and(
        eq(contractQualifiers.contractId, contractId),
        inArray(contractQualifiers.qualifierField, ["product_category", "product", "territory"])
      )
    );
  return rows as unknown as QualifierRow[];
}

/**
 * Read-side enrichment with a strict zero-impact rule:
 *
 *   Stored arrays ALWAYS win when present. Derived values from qualifiers are
 *   only used to fill gaps (i.e. when stored is null/empty).
 *
 * This is deliberate. Existing contracts can contain stale or malformed
 * qualifier rows from earlier extraction runs, and we refuse to let those
 * rows silently alter calculation behavior. Going forward, write-sync
 * (`syncQualifiersFromRule`) keeps the two in lock-step, so new rules see
 * stored == derived and the distinction becomes academic.
 *
 * Once a contract's parity is confirmed clean (via `getParityReport`), the
 * preference order can safely be inverted by an operator action (backfill).
 */
export async function enrichRulesWithDerivedArrays<T extends Rule>(
  rules: T[],
  contractId: string
): Promise<T[]> {
  if (rules.length === 0) return rules;

  try {
    const qualifiers = await fetchQualifiersForContract(contractId);
    if (qualifiers.length === 0) return rules;

    for (const rule of rules) {
      const derived = deriveArraysForRule(rule, qualifiers);
      if (!derived) continue;

      const storedCats = (rule as any).productCategories as string[] | null | undefined;
      const storedTerrs = (rule as any).territories as string[] | null | undefined;

      // Fill gaps only — never override non-empty stored arrays.
      if ((!storedCats || storedCats.length === 0) && derived.productCategories.length > 0) {
        (rule as any).productCategories = derived.productCategories;
      }
      if ((!storedTerrs || storedTerrs.length === 0) && derived.territories.length > 0) {
        (rule as any).territories = derived.territories;
      }
    }
  } catch (err) {
    console.error("[qualifierSync] enrichRulesWithDerivedArrays failed, returning stored arrays:", err);
  }

  return rules;
}

/**
 * One-time backfill: for every rule in a contract with a sourceClauseId,
 * rewrite its product/territory qualifier rows from the rule's current
 * stored arrays. Blows away any stale/malformed qualifier data for that
 * rule's clause.
 *
 * Safe to re-run. Idempotent.
 */
export async function backfillQualifiersForContract(contractId: string): Promise<{
  rulesProcessed: number;
  rulesSkipped: number;
  qualifiersWritten: number;
}> {
  const rows = (await db.execute(
    sql`SELECT id, contract_id, source_clause_id, rule_name,
               product_categories, territories
        FROM contract_rules
        WHERE contract_id = ${contractId} AND is_active = true`
  )).rows as any[];

  let rulesProcessed = 0;
  let rulesSkipped = 0;
  let qualifiersWritten = 0;

  for (const row of rows) {
    const rule: Rule = {
      id: row.id,
      contractId: row.contract_id,
      sourceClauseId: row.source_clause_id,
      productCategories: row.product_categories || [],
      territories: row.territories || [],
      ruleName: row.rule_name,
    };

    const result = await syncQualifiersFromRule(rule);
    if (result.skipped) {
      rulesSkipped += 1;
    } else {
      rulesProcessed += 1;
      qualifiersWritten += result.written;
    }
  }

  return { rulesProcessed, rulesSkipped, qualifiersWritten };
}

/**
 * Resolve a termId for a rule, needed because contract_qualifiers.termId is
 * notNull. For clauseless rules we use the synthetic `rule:<id>` form so that
 * `loadConditionsForContract` can index the row under that key (the GET
 * /api/contract-rules/:ruleId/conditions endpoint already reads it).
 *
 * Preference order:
 *   1. existing qualifier row for this rule's clause (preserves any termId
 *      previously chosen for that clause)
 *   2. termId of the matching contract_terms row (linked_rule_id = rule.id)
 *   3. `rule:<id>` synthetic key — used for clauseless rules so conditions
 *      can still be loaded back by the read path
 */
async function resolveTermIdForRule(rule: Rule): Promise<string> {
  if (rule.sourceClauseId) {
    const existing = await db
      .select({ termId: contractQualifiers.termId })
      .from(contractQualifiers)
      .where(
        and(
          eq(contractQualifiers.contractId, rule.contractId),
          eq(contractQualifiers.contractClauseId, rule.sourceClauseId)
        )
      )
      .limit(1);
    if (existing[0]?.termId) return existing[0].termId;
  }

  try {
    const termRows = await db
      .select({ termId: contractTerms.termId })
      .from(contractTerms)
      .where(
        and(
          eq(contractTerms.contractId, rule.contractId),
          eq((contractTerms as any).linkedRuleId, rule.id)
        )
      )
      .limit(1);
    if (termRows[0]?.termId) return termRows[0].termId;
  } catch {
    // contractTerms.linkedRuleId may not exist in some schemas; ignore
  }

  // Clauseless fallback: synthetic key the read path knows how to index.
  return `rule:${rule.id}`;
}

/**
 * Delete all product/territory qualifier rows for a given rule. Scoped by
 * the rule's source clause when present; falls back to the synthetic
 * `termId='rule:<id>'` key for clauseless rules so they can still be cleared.
 */
export async function cascadeDeleteQualifiersForRule(rule: Rule): Promise<number> {
  const filterFields = inArray(contractQualifiers.qualifierField, ["product_category", "product", "territory"]);
  const where = rule.sourceClauseId
    ? and(
        eq(contractQualifiers.contractId, rule.contractId),
        eq(contractQualifiers.contractClauseId, rule.sourceClauseId),
        filterFields,
      )
    : and(
        eq(contractQualifiers.contractId, rule.contractId),
        eq(contractQualifiers.termId, `rule:${rule.id}`),
        filterFields,
      );
  const result = await db.delete(contractQualifiers).where(where!);
  return (result as any).rowCount ?? 0;
}

/**
 * Delete existing product/territory qualifier rows for this rule and rewrite
 * them from the rule's current productCategories / territories arrays.
 *
 * Works for both clause-attached and clauseless rules. Clauseless rules are
 * indexed under the synthetic `termId='rule:<id>'` key so the read path
 * (`loadConditionsForContract`) can still surface them via the `rule:<id>`
 * lookup the GET endpoint already does.
 */
export async function syncQualifiersFromRule(rule: Rule): Promise<{ skipped: boolean; written: number }> {
  const termId = await resolveTermIdForRule(rule);

  await cascadeDeleteQualifiersForRule(rule);

  const inserts: any[] = [];
  const cats = rule.productCategories || [];

  // Build a normalized set of product names from master so we can disambiguate
  // genuine product names from category labels. AI extraction emits both under
  // the legacy `productCategories` array; under the new conditions architecture
  // they need to be classified as `product` vs `product_category`.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let productNameSet = new Set<string>();
  if (cats.length > 0) {
    try {
      const prodRows = await db.execute(
        sql`SELECT product_name FROM products`
      );
      const rows = (prodRows as any).rows ?? (prodRows as any);
      productNameSet = new Set(
        (rows as Array<{ product_name: string | null }>)
          .map((r) => norm(r.product_name || ""))
          .filter(Boolean)
      );
    } catch (e) {
      console.warn(`[qualifierSync] Could not load products master for classification: ${(e as Error).message}`);
    }
  }

  for (const cat of cats) {
    const trimmed = (cat || "").trim();
    if (!trimmed) continue;
    const isExclusion = trimmed.startsWith("!");
    const value = isExclusion ? trimmed.substring(1).trim() : trimmed;
    if (!value) continue;
    const field = productNameSet.has(norm(value)) ? "product" : "product_category";
    inserts.push({
      qualifierId: crypto.randomUUID(),
      termId,
      contractId: rule.contractId,
      contractClauseId: rule.sourceClauseId ?? null,
      qualifierType: isExclusion ? "exclusion" : "inclusion",
      qualifierField: field,
      operator: isExclusion ? "not_in" : "in",
      qualifierValue: value,
      qualifierLogic: "G1",
      notes: `Synced from rule "${rule.ruleName || rule.id}"`,
    });
  }

  const terrs = rule.territories || [];
  for (const terr of terrs) {
    const value = (terr || "").trim();
    if (!value) continue;
    inserts.push({
      qualifierId: crypto.randomUUID(),
      termId,
      contractId: rule.contractId,
      contractClauseId: rule.sourceClauseId ?? null,
      qualifierType: "inclusion",
      qualifierField: "territory",
      operator: "in",
      qualifierValue: value,
      qualifierLogic: "G1",
      notes: `Synced from rule "${rule.ruleName || rule.id}"`,
    });
  }

  if (inserts.length > 0) {
    await db.insert(contractQualifiers).values(inserts);
  }

  return { skipped: false, written: inserts.length };
}

/**
 * NEW conditions architecture (v1: 5 dimensions, group-based AND/OR)
 *
 * Storage contract:
 *   - Each Condition → one contract_qualifiers row
 *   - qualifier_field    = condition.field (product | product_category | partner | customer | territory)
 *   - qualifier_value    = condition.value (raw text from contract or user input)
 *   - operator           = condition.op (equals | in | not_in | contains | between)
 *   - qualifier_type     = "inclusion" | "exclusion"
 *   - qualifier_logic    = group id (e.g. "G1", "G2") — same group = AND, different groups = OR
 *   - notes              = optional [liQ-link]{...} marker for AI-mapped master data record
 *
 * Group identity is preserved via qualifier_logic. No schema migration needed.
 */

const NEW_FIELD_CODES = QUALIFIER_FIELD_CODES as readonly string[];

function encodeMappingMarker(mappedTo?: Condition["mappedTo"]): string | null {
  if (!mappedTo) return null;
  return `[liQ-link]${JSON.stringify({
    entityType: mappedTo.entityType,
    recordId: mappedTo.recordId,
    label: mappedTo.label,
    confidence: mappedTo.confidence,
  })}`;
}

function decodeMappingMarker(notes: string | null | undefined): Condition["mappedTo"] | null {
  if (!notes) return null;
  const idx = notes.indexOf("[liQ-link]");
  if (idx < 0) return null;
  try {
    const json = notes.substring(idx + "[liQ-link]".length);
    const parsed = JSON.parse(json);
    if (parsed && parsed.entityType && parsed.recordId) {
      return {
        entityType: String(parsed.entityType),
        recordId: String(parsed.recordId),
        label: parsed.label ? String(parsed.label) : undefined,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
      };
    }
  } catch {
    // ignore malformed markers
  }
  return null;
}

/**
 * Delete every condition row (rows with the new field codes) for a rule.
 * Scoped by source clause when present; falls back to the synthetic
 * `termId='rule:<id>'` key for clauseless rules.
 */
export async function cascadeDeleteConditionsForRule(rule: Pick<Rule, "id" | "contractId" | "sourceClauseId">): Promise<number> {
  const filterFields = inArray(contractQualifiers.qualifierField, NEW_FIELD_CODES as string[]);
  const where = rule.sourceClauseId
    ? and(
        eq(contractQualifiers.contractId, rule.contractId),
        eq(contractQualifiers.contractClauseId, rule.sourceClauseId),
        filterFields,
      )
    : and(
        eq(contractQualifiers.contractId, rule.contractId),
        eq(contractQualifiers.termId, `rule:${rule.id}`),
        filterFields,
      );
  const result = await db.delete(contractQualifiers).where(where!);
  return (result as any).rowCount ?? 0;
}

/**
 * Replace all conditions for a rule with the supplied list. Fully idempotent.
 *
 * Works for both clause-attached and clauseless rules. Clauseless rules use
 * `termId='rule:<id>'` and `contractClauseId=null`; the read path indexes
 * those rows under the `rule:<id>` key.
 *
 * Per "option a" (no legacy populate): callers using this function should NOT
 * also write contract_rules.product_categories / territories.
 */
export async function syncConditionsFromRule(
  rule: Rule,
  conditions: Condition[]
): Promise<{ skipped: boolean; written: number }> {
  const termId = await resolveTermIdForRule(rule);

  await cascadeDeleteConditionsForRule(rule);

  if (!conditions || conditions.length === 0) {
    return { skipped: false, written: 0 };
  }

  const inserts = conditions
    .filter((c) => c && c.field && c.value && String(c.value).trim())
    .map((c) => {
      const baseNote = `Condition for "${rule.ruleName || rule.id}"`;
      const marker = encodeMappingMarker(c.mappedTo);
      const notes = marker ? `${baseNote} ${marker}` : baseNote;
      return {
        qualifierId: crypto.randomUUID(),
        termId,
        contractId: rule.contractId,
        contractClauseId: rule.sourceClauseId ?? null,
        qualifierType: c.type === "exclude" ? "exclusion" : "inclusion",
        qualifierField: c.field,
        qualifierAttribute: (c.attribute && c.attribute.trim()) || getDefaultAttribute(c.field) || null,
        operator: c.op,
        qualifierValue: String(c.value).trim(),
        qualifierLogic: c.group || "G1",
        notes,
      };
    });

  if (inserts.length > 0) {
    await db.insert(contractQualifiers).values(inserts);
  }

  return { skipped: false, written: inserts.length };
}

/**
 * Load conditions for a rule's clause (or for an entire contract).
 * Returns Conditions in the new shape, including any decoded mapping markers.
 *
 * Indexed by BOTH:
 *   - `clause:<contractClauseId>` — for rows linked through their clause
 *   - `rule:<ruleId>`             — for rows backfilled / linked directly to a rule
 *     via termId='rule:<ruleId>' (rules without a sourceClauseId still need
 *     their conditions loaded).
 *
 * The same physical row is indexed under both keys when it has both linkages,
 * so callers can look up by whichever they have.
 */
export async function loadConditionsForContract(
  contractId: string
): Promise<Map<string, Condition[]>> {
  const rows = await db
    .select()
    .from(contractQualifiers)
    .where(
      and(
        eq(contractQualifiers.contractId, contractId),
        inArray(contractQualifiers.qualifierField, NEW_FIELD_CODES as string[])
      )
    );

  const byKey = new Map<string, Condition[]>();
  const push = (key: string, cond: Condition) => {
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(cond);
  };

  for (const r of rows as any[]) {
    const cond: Condition = {
      field: r.qualifierField as QualifierFieldCode,
      attribute: r.qualifierAttribute || getDefaultAttribute(r.qualifierField as string) || null,
      op: (r.operator || "in") as Condition["op"],
      value: r.qualifierValue || "",
      group: r.qualifierLogic || "G1",
      type: r.qualifierType === "exclusion" ? "exclude" : "include",
      mappedTo: decodeMappingMarker(r.notes) ?? undefined,
    };
    // Rule-scoped rows (term_id = "rule:<ruleId>") belong to a specific rule
    // and must NOT be indexed under their clauseId — otherwise sibling rules
    // sharing the same source clause would inherit each other's qualifiers
    // (e.g. an exclusion rule's "4350-20 box" leaking onto an Onions rule
    // because both came out of the same Product Scope clause). Only rows that
    // are NOT pinned to a specific rule fall back to clause-level keys, since
    // those are the legacy/term-level qualifiers that are genuinely shared by
    // every rule from that clause.
    if (typeof r.termId === "string" && r.termId.startsWith("rule:")) {
      push(r.termId, cond); // key form: "rule:<ruleId>" — private to that rule
    } else if (r.contractClauseId) {
      // Legacy key: bare clauseId (kept for backward compatibility with old
      // callers that look up by clauseId only).
      push(r.contractClauseId, cond);
      push(`clause:${r.contractClauseId}`, cond);
    }
  }
  return byKey;
}

/**
 * Parity report: for every rule in a contract, compare stored arrays vs
 * derived-from-qualifiers. Returns only rules that disagree, so a clean
 * contract yields { mismatches: [] }.
 *
 * Used by the admin verification endpoint before trusting the read-enrichment
 * in production.
 */
export async function getParityReport(contractId: string): Promise<{
  contractId: string;
  totalRules: number;
  mismatches: Array<{
    ruleId: string;
    ruleName: string | null;
    sourceClauseId: string | null;
    stored: { productCategories: string[]; territories: string[] };
    derived: { productCategories: string[]; territories: string[] } | null;
    note: string;
  }>;
}> {
  const rules = (await db.execute(
    sql`SELECT id, contract_id, source_clause_id, rule_name, product_categories, territories
        FROM contract_rules WHERE contract_id = ${contractId} AND is_active = true`
  )).rows as any[];

  const qualifiers = await fetchQualifiersForContract(contractId);

  const mismatches: any[] = [];

  for (const row of rules) {
    const stored = {
      productCategories: (row.product_categories as string[]) || [],
      territories: (row.territories as string[]) || [],
    };

    const derived = deriveArraysForRule(
      { sourceClauseId: row.source_clause_id },
      qualifiers
    );

    if (!derived) {
      if (stored.productCategories.length === 0 && stored.territories.length === 0) continue;
      mismatches.push({
        ruleId: row.id,
        ruleName: row.rule_name,
        sourceClauseId: row.source_clause_id,
        stored,
        derived: null,
        note: row.source_clause_id
          ? "No qualifier rows found for this clause — stored arrays are orphaned."
          : "Rule has no sourceClauseId — derivation not possible (stored arrays are source).",
      });
      continue;
    }

    const sameSet = (a: string[], b: string[]) => {
      const na = a.map(s => s.toLowerCase().trim()).filter(Boolean).sort();
      const nb = b.map(s => s.toLowerCase().trim()).filter(Boolean).sort();
      return na.length === nb.length && na.every((v, i) => v === nb[i]);
    };

    const prodMatch = sameSet(stored.productCategories, derived.productCategories);
    const terrMatch = sameSet(stored.territories, derived.territories);

    if (!prodMatch || !terrMatch) {
      mismatches.push({
        ruleId: row.id,
        ruleName: row.rule_name,
        sourceClauseId: row.source_clause_id,
        stored,
        derived,
        note: `${prodMatch ? "" : "productCategories diverge. "}${terrMatch ? "" : "territories diverge."}`.trim(),
      });
    }
  }

  return {
    contractId,
    totalRules: rules.length,
    mismatches,
  };
}
