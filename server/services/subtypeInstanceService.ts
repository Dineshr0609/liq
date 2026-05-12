/**
 * Subtype Instance Auto-Provisioning
 * ----------------------------------
 * Every contract should have at least one subtype_instance ("Program") so that
 * its rules can be linked to a financial program with its own accrual /
 * settlement policy. Historically the AI extraction pipeline never created
 * these rows, leaving newly-uploaded contracts with an empty Program picker
 * on the rule editor.
 *
 * This module owns:
 *   1. The mapping from a contract's `contract_type` code to a default
 *      `subtypes.code` (e.g. ob_rebate -> RA).
 *   2. An idempotent ensureDefaultSubtypeInstance() that creates a single
 *      default instance for a contract if and only if none exist yet.
 *
 * The pipeline calls ensureDefaultSubtypeInstance() right before flipping
 * contract status to 'analyzed'. The rule POST endpoint also calls it as a
 * safety net so any rule created on a contract without an instance triggers
 * one to be provisioned on the spot.
 */

import { db, pool } from "../db";
import { sql } from "drizzle-orm";

export const CONTRACT_TYPE_TO_SUBTYPE_CODE: Record<string, string> = {
  ob_rebate: "RA",
  ib_rebate: "RA",
  licensing_royalty: "ROY",
  mdf: "MDF",
  price_protection_chargeback: "PP",
  revenue_share_marketplace: "RSS",
  distributor_reseller_program: "RA",
  mixed_commercial_agreement: "RA",
};

/**
 * Fallback map for contracts whose flow_type_code is NULL (legacy / template
 * contracts that pre-date the flow taxonomy). Used to resolve the right slice
 * of flow_subtype_validity so the rule editor's program picker is filtered
 * correctly.
 */
export const CONTRACT_TYPE_TO_FLOW_TYPE: Record<string, string> = {
  ob_rebate: "VRP",
  ib_rebate: "CRP",
  licensing_royalty: "RLA",
  mdf: "RSM",
  price_protection_chargeback: "CRP",
  revenue_share_marketplace: "RSM",
  distributor_reseller_program: "RSM",
  mixed_commercial_agreement: "RSM",
};

export function defaultSubtypeCodeForContractType(
  contractType: string | null | undefined,
): string | null {
  if (!contractType) return null;
  return CONTRACT_TYPE_TO_SUBTYPE_CODE[contractType.toLowerCase()] || null;
}

export function fallbackFlowTypeForContractType(
  contractType: string | null | undefined,
): string | null {
  if (!contractType) return null;
  return CONTRACT_TYPE_TO_FLOW_TYPE[contractType.toLowerCase()] || null;
}

/**
 * Return the list of subtype codes the matrix (`flow_subtype_validity`) allows
 * for a given contract. Resolution order:
 *   1. contract.flow_type_code (preferred)
 *   2. CONTRACT_TYPE_TO_FLOW_TYPE fallback
 *   3. null → caller decides (we currently return all active subtypes).
 *
 * The result includes `is_primary` so the picker can highlight the recommended
 * default.
 */
export async function getAllowedSubtypesForContract(contractId: string): Promise<
  Array<{ code: string; name: string; description: string | null; isPrimary: boolean }>
> {
  const c = await db.execute(sql`
    SELECT contract_type, flow_type_code FROM contracts WHERE id = ${contractId} LIMIT 1
  `);
  const row = (c as any).rows?.[0];
  if (!row) return [];

  const flowTypeCode: string | null =
    (row.flow_type_code && String(row.flow_type_code).trim()) ||
    fallbackFlowTypeForContractType(row.contract_type);

  // No flow type known → return all active subtypes (full catalog) so the user
  // is never blocked from picking one.
  if (!flowTypeCode) {
    const all = await db.execute(sql`
      SELECT code, name, description, false AS is_primary
      FROM subtypes WHERE is_active = true ORDER BY name ASC
    `);
    return ((all as any).rows || []).map((r: any) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      isPrimary: false,
    }));
  }

  const filtered = await db.execute(sql`
    SELECT s.code, s.name, s.description, fsv.is_primary
    FROM flow_subtype_validity fsv
    JOIN subtypes s ON s.code = fsv.subtype_code AND s.is_active = true
    WHERE fsv.flow_type_code = ${flowTypeCode}
    ORDER BY fsv.is_primary DESC, s.name ASC
  `);
  return ((filtered as any).rows || []).map((r: any) => ({
    code: r.code,
    name: r.name,
    description: r.description,
    isPrimary: !!r.is_primary,
  }));
}

/**
 * Build a human-readable label for a new subtype instance.
 * Prefers counterparty name → contract number → "Default" fallback,
 * suffixed with the subtype's display name.
 */
function buildInstanceLabel(opts: {
  counterpartyName?: string | null;
  contractNumber?: string | null;
  subtypeName: string;
}): string {
  const prefix =
    (opts.counterpartyName && opts.counterpartyName.trim()) ||
    (opts.contractNumber && opts.contractNumber.trim()) ||
    "Default";
  return `${prefix} — ${opts.subtypeName}`;
}

/**
 * Ensure the contract has at least one subtype_instance. No-op if one or
 * more already exist. Returns the id of an existing or newly-created instance,
 * or null if no default subtype could be resolved (e.g. contract_type is
 * 'unknown' or unmapped — caller should surface a UI affordance to let the
 * user pick a program manually in that case).
 */
export async function ensureDefaultSubtypeInstance(
  contractId: string,
): Promise<string | null> {
  // 1. Already have one? Use it.
  const existing = await db.execute(sql`
    SELECT id FROM subtype_instances
    WHERE contract_id = ${contractId}
    ORDER BY created_at ASC
    LIMIT 1
  `);
  if (existing.rows && existing.rows.length > 0) {
    return (existing.rows[0] as any).id as string;
  }

  // 2. Resolve subtype_code. Prefer the matrix-driven primary for the
  //    contract's flow_type_code (the user-picked classifier at upload),
  //    and only fall back to the legacy contract_type map if no flow type
  //    is set (older contracts).
  const c = await db.execute(sql`
    SELECT contract_type, flow_type_code, contract_number, counterparty_name
    FROM contracts
    WHERE id = ${contractId}
    LIMIT 1
  `);
  if (!c.rows || c.rows.length === 0) return null;
  const contractRow = c.rows[0] as any;

  let subtypeCode: string | null = null;

  const flowTypeCode = contractRow.flow_type_code
    ? String(contractRow.flow_type_code).trim()
    : null;
  if (flowTypeCode) {
    const primary = await db.execute(sql`
      SELECT subtype_code FROM flow_subtype_validity
      WHERE flow_type_code = ${flowTypeCode} AND is_primary = true
      LIMIT 1
    `);
    const primaryRow = (primary as any).rows?.[0];
    if (primaryRow?.subtype_code) {
      subtypeCode = String(primaryRow.subtype_code);
    }
  }

  if (!subtypeCode) {
    subtypeCode = defaultSubtypeCodeForContractType(contractRow.contract_type);
  }

  if (!subtypeCode) {
    console.warn(
      `[subtype-auto] Contract ${contractId} has no resolvable subtype (flow_type_code='${flowTypeCode}', contract_type='${contractRow.contract_type}'); not creating default instance.`,
    );
    return null;
  }

  // 3. Confirm subtype exists & fetch its display name for the label.
  const sub = await db.execute(sql`
    SELECT name FROM subtypes WHERE code = ${subtypeCode} AND is_active = true LIMIT 1
  `);
  if (!sub.rows || sub.rows.length === 0) {
    console.warn(
      `[subtype-auto] Subtype code '${subtypeCode}' not found or inactive; cannot auto-create instance for contract ${contractId}.`,
    );
    return null;
  }
  const subtypeName = (sub.rows[0] as any).name as string;

  // 4. Insert. Use ON CONFLICT DO NOTHING via a guarded select to avoid the
  //    rare race where two pipeline steps fire ensureDefault... concurrently.
  const label = buildInstanceLabel({
    counterpartyName: contractRow.counterparty_name,
    contractNumber: contractRow.contract_number,
    subtypeName,
  });

  const inserted = await db.execute(sql`
    INSERT INTO subtype_instances (contract_id, subtype_code, label, status)
    SELECT ${contractId}, ${subtypeCode}, ${label}, 'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM subtype_instances WHERE contract_id = ${contractId}
    )
    RETURNING id
  `);

  if (inserted.rows && inserted.rows.length > 0) {
    const newId = (inserted.rows[0] as any).id as string;
    console.log(
      `[subtype-auto] Created default subtype_instance ${newId} (${subtypeCode}) for contract ${contractId}: "${label}"`,
    );
    return newId;
  }

  // Race lost — re-read the existing row created by the other writer.
  const fallback = await db.execute(sql`
    SELECT id FROM subtype_instances
    WHERE contract_id = ${contractId}
    ORDER BY created_at ASC
    LIMIT 1
  `);
  return fallback.rows && fallback.rows.length > 0
    ? ((fallback.rows[0] as any).id as string)
    : null;
}

/**
 * Ensure the contract has a subtype_instance for a *specific* subtype code
 * (e.g. MIN for minimum-guarantee rules, RSS for revenue share). Idempotent —
 * returns the existing instance id if one exists for that code, otherwise
 * creates one (only if the matrix `flow_subtype_validity` allows the code for
 * this contract's flow_type, or if no flow_type is set).
 *
 * Used by the post-extraction router to attach min_guarantee rules to a MIN
 * program even when the contract's primary program is ROY.
 */
export async function ensureSubtypeInstanceByCode(
  contractId: string,
  subtypeCode: string,
): Promise<string | null> {
  const code = String(subtypeCode || "").trim().toUpperCase();
  if (!code) return null;

  // 1. Already exists for this contract+code? Use it.
  const existing = await db.execute(sql`
    SELECT id FROM subtype_instances
    WHERE contract_id = ${contractId} AND subtype_code = ${code}
    ORDER BY created_at ASC
    LIMIT 1
  `);
  if (existing.rows && existing.rows.length > 0) {
    return (existing.rows[0] as any).id as string;
  }

  // 2. Resolve contract metadata + check matrix permission.
  const c = await db.execute(sql`
    SELECT contract_type, flow_type_code, contract_number, counterparty_name
    FROM contracts WHERE id = ${contractId} LIMIT 1
  `);
  if (!c.rows || c.rows.length === 0) return null;
  const contractRow = c.rows[0] as any;

  const flowTypeCode = contractRow.flow_type_code
    ? String(contractRow.flow_type_code).trim()
    : fallbackFlowTypeForContractType(contractRow.contract_type);

  // If we know the flow type, the matrix MUST allow this subtype. No flow
  // type known (legacy contract) → permissive: just confirm subtype is active.
  if (flowTypeCode) {
    const allowed = await db.execute(sql`
      SELECT 1 FROM flow_subtype_validity
      WHERE flow_type_code = ${flowTypeCode} AND subtype_code = ${code}
      LIMIT 1
    `);
    if (!allowed.rows || allowed.rows.length === 0) {
      console.warn(
        `[subtype-auto] Subtype '${code}' not allowed by matrix for flow_type '${flowTypeCode}' (contract ${contractId}); skipping.`,
      );
      return null;
    }
  }

  const sub = await db.execute(sql`
    SELECT name FROM subtypes WHERE code = ${code} AND is_active = true LIMIT 1
  `);
  if (!sub.rows || sub.rows.length === 0) {
    console.warn(
      `[subtype-auto] Subtype '${code}' not found / inactive; skipping for contract ${contractId}.`,
    );
    return null;
  }
  const subtypeName = (sub.rows[0] as any).name as string;

  const label = buildInstanceLabel({
    counterpartyName: contractRow.counterparty_name,
    contractNumber: contractRow.contract_number,
    subtypeName,
  });

  const inserted = await db.execute(sql`
    INSERT INTO subtype_instances (contract_id, subtype_code, label, status)
    SELECT ${contractId}, ${code}, ${label}, 'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM subtype_instances
      WHERE contract_id = ${contractId} AND subtype_code = ${code}
    )
    RETURNING id
  `);
  if (inserted.rows && inserted.rows.length > 0) {
    const newId = (inserted.rows[0] as any).id as string;
    console.log(
      `[subtype-auto] Created ${code} subtype_instance ${newId} for contract ${contractId}: "${label}"`,
    );
    return newId;
  }

  // Race lost — re-read.
  const fallback = await db.execute(sql`
    SELECT id FROM subtype_instances
    WHERE contract_id = ${contractId} AND subtype_code = ${code}
    LIMIT 1
  `);
  return fallback.rows && fallback.rows.length > 0
    ? ((fallback.rows[0] as any).id as string)
    : null;
}

/**
 * Map of rule_type → subtype code the rule should live under, when the matrix
 * allows it. Used by the post-extraction router to keep matrix-correct
 * separation even when the AI extractor lumps every rule onto the contract's
 * primary subtype (e.g. ROY).
 *
 *   minimum_guarantee / annual_minimum / quarterly_minimum / mgr → MIN
 *   recoupable_advance / advance_payment / signing_bonus           → ADV
 *   late_payment_penalty                                           → LPP
 */
export const RULE_TYPE_TO_SUBTYPE_CODE: Record<string, string> = {
  minimum_guarantee: "MIN",
  annual_minimum: "MIN",
  quarterly_minimum: "MIN",
  mgr: "MIN",
};

/**
 * After AI extraction, walk the contract's just-saved rules and:
 *   1. For any rule whose rule_type maps to a non-default subtype code per
 *      RULE_TYPE_TO_SUBTYPE_CODE, ensure that subtype_instance exists (matrix
 *      permitting) and re-point the rule's subtype_instance_id to it.
 *   2. Dedup: collapse duplicate rules that share
 *      (rule_type, minimum_guarantee, source_text) — AI sometimes emits the
 *      same MIN twice when it appears in both an exhibit and the body.
 *
 * Idempotent: re-running on a contract whose rules are already routed +
 * deduped is a no-op. Safe to call from the pipeline's "rules saved" hook.
 */
export async function routeRulesToMatrixSubtypes(
  contractId: string,
): Promise<{ rerouted: number; deduped: number }> {
  let rerouted = 0;
  let deduped = 0;

  // 1. Routing — group rules by target subtype code.
  const routableTypes = Object.keys(RULE_TYPE_TO_SUBTYPE_CODE);
  if (routableTypes.length === 0) return { rerouted, deduped };

  const placeholders = routableTypes.map((t) => `'${t.replace(/'/g, "''")}'`).join(",");
  const candidateRules = await db.execute(sql.raw(`
    SELECT id, rule_type, subtype_instance_id
    FROM contract_rules
    WHERE contract_id = '${contractId.replace(/'/g, "''")}'
      AND lower(rule_type) IN (${placeholders})
  `));

  const rulesByTarget = new Map<string, string[]>(); // code → ruleIds
  for (const r of (candidateRules as any).rows || []) {
    const target = RULE_TYPE_TO_SUBTYPE_CODE[String(r.rule_type).toLowerCase()];
    if (!target) continue;
    if (!rulesByTarget.has(target)) rulesByTarget.set(target, []);
    rulesByTarget.get(target)!.push(r.id);
  }

  for (const [code, ruleIds] of rulesByTarget) {
    const targetInstanceId = await ensureSubtypeInstanceByCode(contractId, code);
    if (!targetInstanceId) {
      console.log(
        `[subtype-auto] Could not provision ${code} instance for contract ${contractId}; leaving ${ruleIds.length} rule(s) on default subtype.`,
      );
      continue;
    }
    // Re-point rules whose current subtype_instance_id != targetInstanceId.
    const idList = ruleIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
    const upd = await db.execute(sql.raw(`
      UPDATE contract_rules
      SET subtype_instance_id = '${targetInstanceId.replace(/'/g, "''")}'
      WHERE id IN (${idList})
        AND (subtype_instance_id IS DISTINCT FROM '${targetInstanceId.replace(/'/g, "''")}')
      RETURNING id
    `));
    rerouted += ((upd as any).rows || []).length;
  }

  // 2. Dedup — collapse rules with same (rule_type, minimum_guarantee, source_text)
  //    keeping the earliest-created row.
  const dupes = await db.execute(sql`
    WITH ranked AS (
      SELECT id,
             rule_type,
             minimum_guarantee,
             source_text,
             ROW_NUMBER() OVER (
               PARTITION BY lower(rule_type),
                            COALESCE(minimum_guarantee::text, ''),
                            COALESCE(source_text, '')
               ORDER BY created_at ASC, id ASC
             ) AS rn
      FROM contract_rules
      WHERE contract_id = ${contractId}
        AND lower(rule_type) = 'minimum_guarantee'
    )
    SELECT id FROM ranked WHERE rn > 1
  `);
  const dupeIds = ((dupes as any).rows || []).map((r: any) => r.id);
  if (dupeIds.length > 0) {
    const idList = dupeIds.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(",");
    await db.execute(sql.raw(`
      DELETE FROM contract_rules WHERE id IN (${idList})
    `));
    deduped = dupeIds.length;
    console.log(
      `[subtype-auto] Deduped ${deduped} duplicate minimum_guarantee rule(s) on contract ${contractId}.`,
    );
  }

  if (rerouted > 0) {
    console.log(
      `[subtype-auto] Rerouted ${rerouted} rule(s) to matrix-correct subtype instance(s) on contract ${contractId}.`,
    );
  }
  return { rerouted, deduped };
}
