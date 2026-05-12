/**
 * Contract Template Service (Task #46 — DB-backed)
 *
 * Replaces the old hardcoded TS template registry with queries against
 * contract_templates / template_rules / template_clauses. The service exposes:
 *   - listVisibleTemplates(): scope-aware listing (system | company | mine)
 *   - createContractFromTemplate(): snapshot semantics — copies template
 *     rules/clauses/policies onto a brand-new contract (no live link)
 *   - saveContractAsTemplate(): turns an existing contract into a reusable
 *     template at one of three snapshot scopes (minimal | standard | maximal)
 *   - deleteTemplateContract(): unchanged — wipes a template-seeded contract
 */

import { db } from '../db';
import { sql, desc, eq, and, or, inArray } from 'drizzle-orm';
import {
  contracts,
  contractTemplates,
  contractRules,
  templateRules,
  templateClauses,
  flowTypes,
  subtypeInstances,
  // Aliased so the schema export doesn't collide with our local
  // `accrualPolicies` array variable inside createContractFromTemplate.
  accrualPolicies as accrualPoliciesTable,
} from '@shared/schema';
import { ensureSubtypeInstanceByCode } from './subtypeInstanceService';

// ---------------------------------------------------------------------------

export type TemplateScope = 'system' | 'company' | 'mine';
export type SnapshotScope = 'minimal' | 'standard' | 'maximal';
export type TemplateVisibility = 'public' | 'private';

export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  flowTypeCode: string;
  flowTypeName: string;
  isSystem: boolean;
  visibility: TemplateVisibility;
  ownerUserId: string | null;
  companyId: string | null;
  scope: TemplateScope;
  ownerLabel: string;
  snapshotScope: string;
  versionNum: number;
  stats: { rules: number; clauses: number; subtypes: number };
  // Number of contracts in the caller's visible scope that were created from
  // this template (via contract_analysis.key_terms.sourceTemplateId). Tenant
  // scoping mirrors the per-template usage endpoint so company admins never
  // see cross-tenant counts. system admins see counts across all tenants.
  usageCount: number;
}

export interface TemplateContractOverrides {
  displayName?: string;
  contractType?: string;
  counterpartyName?: string;
  effectiveStart?: string | null;
  effectiveEnd?: string | null;
  currency?: string;
  notes?: string | null;
  contractStatus?: string;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

/**
 * Returns templates visible to the caller, tagged with a scope so the UI can
 * group them (System → My Company → Mine). Visibility rules:
 *   - is_system = true → always returned, scope='system'
 *   - is_system = false AND visibility='public' AND companyId matches caller →
 *     scope='company'
 *   - is_system = false AND ownerUserId matches caller → scope='mine'
 */
export async function listVisibleTemplates(
  userId: string,
  companyId: string | null,
  opts: { isSystemAdmin?: boolean } = {},
): Promise<TemplateListItem[]> {
  const rows = await db
    .select({
      tpl: contractTemplates,
      flowName: flowTypes.name,
    })
    .from(contractTemplates)
    .leftJoin(flowTypes, eq(contractTemplates.flowTypeCode, flowTypes.code))
    .where(
      and(
        eq(contractTemplates.isActive, true),
        or(
          eq(contractTemplates.isSystem, true),
          eq(contractTemplates.ownerUserId, userId),
          and(
            eq(contractTemplates.visibility, 'public'),
            companyId ? eq(contractTemplates.companyId, companyId) : sql`false`,
          ),
        ),
      ),
    )
    .orderBy(contractTemplates.isSystem, contractTemplates.name);

  if (rows.length === 0) return [];

  // Hydrate counts in one go.
  const ids = rows.map((r) => r.tpl.id);
  type RuleCountRow = { template_id: string; n: number; subtypes: number };
  type ClauseCountRow = { template_id: string; n: number };
  // NOTE: build IN-list via sql.join rather than `= ANY(${ids}::text[])`. The
  // latter fails on the @neondatabase/serverless driver with "cannot cast type
  // record to text[]" when the JS array is bound as a composite parameter.
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  const ruleCounts = await db.execute<RuleCountRow>(sql`
    SELECT template_id, COUNT(*)::int AS n, COUNT(DISTINCT subtype_code)::int AS subtypes
    FROM template_rules WHERE template_id IN (${idList}) GROUP BY template_id
  `);
  const clauseCounts = await db.execute<ClauseCountRow>(sql`
    SELECT template_id, COUNT(*)::int AS n
    FROM template_clauses WHERE template_id IN (${idList}) GROUP BY template_id
  `);
  const ruleByTpl = new Map<string, { n: number; subtypes: number }>();
  for (const r of ruleCounts.rows ?? []) {
    ruleByTpl.set(r.template_id, { n: Number(r.n), subtypes: Number(r.subtypes) });
  }
  const clauseByTpl = new Map<string, number>();
  for (const r of clauseCounts.rows ?? []) {
    clauseByTpl.set(r.template_id, Number(r.n));
  }

  // Usage counts (contracts created from each template). Tenant-scoped:
  //   - System admins: every contract counts.
  //   - Everyone else: only contracts in the caller's tenant, plus
  //     un-tenanted contracts the caller uploaded themselves.
  // Joins the latest contract_analysis row per contract (mirrors the
  // /usage list endpoint) so the badge count and the expanded list agree.
  type UsageCountRow = { template_id: string; n: number };
  const isSystemAdmin = opts.isSystemAdmin === true;
  const tenantPredicate = isSystemAdmin
    ? sql`TRUE`
    : sql`(
        ${companyId ? sql`(c.company_id = ${companyId})` : sql`FALSE`}
        OR (c.company_id IS NULL AND c.uploaded_by = ${userId})
      )`;
  const usageCounts = await db.execute<UsageCountRow>(sql`
    SELECT (ca.key_terms::jsonb ->> 'sourceTemplateId') AS template_id,
           COUNT(*)::int AS n
    FROM contracts c
    JOIN LATERAL (
      SELECT key_terms
      FROM contract_analysis
      WHERE contract_id = c.id
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    ) ca ON TRUE
    WHERE (ca.key_terms::jsonb ->> 'sourceTemplateId') IN (${idList})
      AND ${tenantPredicate}
    GROUP BY (ca.key_terms::jsonb ->> 'sourceTemplateId')
  `);
  const usageByTpl = new Map<string, number>();
  for (const r of usageCounts.rows ?? []) {
    if (r.template_id) usageByTpl.set(r.template_id, Number(r.n));
  }

  return rows.map(({ tpl, flowName }) => {
    const isMine = !tpl.isSystem && tpl.ownerUserId === userId;
    const isCompany = !tpl.isSystem && !isMine && tpl.visibility === 'public';
    const scope: TemplateScope = tpl.isSystem ? 'system' : isMine ? 'mine' : 'company';
    const ownerLabel = scope === 'system' ? 'System' : scope === 'mine' ? 'You' : 'My Company';
    const ruleStats = ruleByTpl.get(tpl.id) ?? { n: 0, subtypes: 0 };
    return {
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      flowTypeCode: tpl.flowTypeCode,
      flowTypeName: flowName ?? tpl.flowTypeCode,
      isSystem: tpl.isSystem,
      visibility: tpl.visibility as TemplateVisibility,
      ownerUserId: tpl.ownerUserId,
      companyId: tpl.companyId,
      scope,
      ownerLabel,
      snapshotScope: tpl.snapshotScope,
      versionNum: tpl.versionNum,
      stats: {
        rules: ruleStats.n,
        clauses: clauseByTpl.get(tpl.id) ?? 0,
        subtypes: ruleStats.subtypes,
      },
      usageCount: usageByTpl.get(tpl.id) ?? 0,
    };
  });
}

// Back-compat alias used by older callers.
export async function getTemplateMetadata(userId?: string, companyId?: string | null) {
  if (!userId) {
    // Anonymous fallback: only return system templates.
    return listVisibleTemplates('__anon__', null);
  }
  return listVisibleTemplates(userId, companyId ?? null);
}

// ---------------------------------------------------------------------------
// CREATE CONTRACT FROM TEMPLATE  (snapshot)
// ---------------------------------------------------------------------------

export async function createContractFromTemplate(
  templateId: string,
  companyId: string,
  userId: string,
  overrides?: TemplateContractOverrides,
): Promise<{ contractId: string; templateName: string }> {
  const [tpl] = await db
    .select()
    .from(contractTemplates)
    .where(eq(contractTemplates.id, templateId))
    .limit(1);
  if (!tpl) throw new Error(`Template "${templateId}" not found`);

  const [flow] = await db
    .select({ name: flowTypes.name, code: flowTypes.code })
    .from(flowTypes)
    .where(eq(flowTypes.code, tpl.flowTypeCode))
    .limit(1);

  // Matrix-aware: only copy rules/clauses whose subtype is currently valid for
  // this flow. Rows without a subtype are always copied.
  type ValidSubtypeRow = { subtype_code: string };
  const validRows = await db.execute<ValidSubtypeRow>(sql`
    SELECT DISTINCT fsv.subtype_code
    FROM flow_subtype_validity fsv
    JOIN subtypes s ON s.code = fsv.subtype_code
    WHERE fsv.flow_type_code = ${tpl.flowTypeCode}
      AND s.is_active = true
  `);
  const validSubtypes = new Set((validRows.rows ?? []).map((r) => r.subtype_code));

  const allRules = await db
    .select()
    .from(templateRules)
    .where(eq(templateRules.templateId, templateId))
    .orderBy(templateRules.sortOrder);
  const allClauses = await db
    .select()
    .from(templateClauses)
    .where(eq(templateClauses.templateId, templateId))
    .orderBy(templateClauses.sortOrder);
  const rules = allRules.filter((r) => !r.subtypeCode || validSubtypes.has(r.subtypeCode));
  const clauses = allClauses.filter((c) => !c.subtypeCode || validSubtypes.has(c.subtypeCode));

  // Generate IDs / numbers.
  const suffix = Date.now().toString(36).toUpperCase();
  const contractId = `TMPL-${tpl.flowTypeCode}-${suffix}`;
  const uniqueContractNumber = await nextContractNumber();

  // The owning organization on every template-created contract is the
  // LicenseIQ tenant — i.e. the company the user belongs to. Resolve its
  // display name from the companies table so the Overview chip reads
  // "TechSound Audio Inc." instead of the literal placeholder "Organization".
  // Note: the companies table uses `company_id` / `company_name`, NOT
  // `id` / `name` (this query was previously broken and silently returned
  // zero rows, which is why every template-created contract showed
  // "Organization" with a NULL organization_company_id).
  let orgName = 'Organization';
  let orgCompanyId: string | null = null;
  try {
    const companyResult = await db.execute<{ company_name: string | null }>(
      sql`SELECT company_name FROM companies WHERE company_id = ${companyId} LIMIT 1`,
    );
    const found = companyResult.rows?.[0]?.company_name;
    if (found) {
      orgName = found;
      orgCompanyId = companyId;
    }
  } catch (err) {
    console.warn('[contractTemplateService] company name lookup failed', err);
  }

  const displayName = overrides?.displayName?.trim() || `${tpl.name} — ${suffix}`;
  const contractType = overrides?.contractType || tpl.flowTypeCode;
  const counterpartyName = overrides?.counterpartyName || 'Counterparty TBD';
  const effectiveStart = overrides?.effectiveStart ?? null;
  const effectiveEnd = overrides?.effectiveEnd ?? null;
  const currency = overrides?.currency || 'USD';
  const notes = overrides?.notes ?? tpl.description ?? null;
  const contractStatus = overrides?.contractStatus || 'Draft';
  // partyRoleSlots is a flat {obligor, beneficiary, ...} map shared across
  // every subtype, so it's copied as-is — no per-subtype pruning applies.
  const partyRoleSlots = tpl.partyRoleSlots ?? {};
  // accrualPolicies, however, is a per-subtype array (each entry tagged with
  // subtypeCode in FLOW_DEFAULTS). Matrix-prune it the same way we prune
  // rules/clauses so a retired subtype's policy doesn't get materialized into
  // the new contract.
  const rawAccrualPolicies = Array.isArray(tpl.accrualPolicies) ? (tpl.accrualPolicies as Array<Record<string, unknown>>) : [];
  const accrualPolicies = rawAccrualPolicies.filter((p) => {
    const code = typeof p?.subtypeCode === 'string' ? p.subtypeCode : null;
    // Cross-cutting policies (no subtypeCode) always apply; subtype-scoped
    // policies must be in the matrix-valid set.
    return !code || validSubtypes.has(code);
  });

  const synthesizedRawText = [
    `${tpl.name} — system template snapshot`,
    tpl.description ?? '',
    `Flow type: ${flow?.name ?? tpl.flowTypeCode}`,
    `Generated for ${orgName} on ${new Date().toISOString().slice(0, 10)}.`,
    '',
    'Clauses:',
    ...clauses.map((c, i) => `${String(i + 1).padStart(2, '0')}. ${c.text}`),
  ].filter(Boolean).join('\n');

  await db.execute(sql`
    INSERT INTO contracts (id, file_name, original_name, file_size, file_type, file_path,
      display_name, contract_number, contract_type, status, source,
      organization_name, organization_company_id, counterparty_name,
      effective_start, effective_end,
      currency, notes, contract_status, party_role_slots, flow_type_code,
      company_id, uploaded_by, raw_text, created_at, updated_at)
    VALUES (
      ${contractId}, ${displayName}, ${displayName}, ${synthesizedRawText.length},
      'template', ${'templates/' + tpl.flowTypeCode + '/' + suffix + '.txt'},
      ${displayName}, ${uniqueContractNumber}, ${contractType}, 'analyzed', 'template',
      ${orgName}, ${orgCompanyId}, ${counterpartyName},
      ${effectiveStart}, ${effectiveEnd},
      ${currency}, ${notes}, ${contractStatus}, ${JSON.stringify(partyRoleSlots)}::jsonb,
      ${tpl.flowTypeCode},
      ${companyId}, ${userId}, ${synthesizedRawText}, NOW(), NOW()
    )
  `);

  // Seed the contract_partner_assignments rows for owning_party + counterparty
  // from the contract metadata we just wrote. Without this the parties
  // endpoint has nothing to resolve and the Overview chip falls back to the
  // raw organization_name string with no link to the tenant company record.
  try {
    const { backfillContractPartyRoles } = await import('./partyRoleService');
    await backfillContractPartyRoles(contractId);
  } catch (partyErr: any) {
    console.warn(`⚠️ [Template] backfillContractPartyRoles failed for ${contractId}: ${partyErr?.message}`);
  }

  // Lightweight analysis stub so the Overview page renders.
  await db.execute(sql`
    INSERT INTO contract_analysis (contract_id, summary, key_terms, risk_analysis, insights, confidence, created_at)
    VALUES (
      ${contractId},
      ${`Snapshot of system template "${tpl.name}" (flow: ${flow?.name ?? tpl.flowTypeCode}). Edit rules and clauses to match the executed agreement.`},
      ${JSON.stringify({ partyRoleSlots, accrualPolicies, sourceTemplateId: templateId })}::jsonb,
      ${JSON.stringify({ items: [] })}::jsonb,
      ${JSON.stringify({ source: 'template', templateScope: tpl.snapshotScope })}::jsonb,
      0.92, NOW()
    )
  `);

  // Provision a default subtype instance — must run before rules so they can
  // be linked. Mirrors the upload pipeline behaviour.
  const { ensureDefaultSubtypeInstance, ensureSubtypeInstanceByCode } = await import('./subtypeInstanceService');
  try {
    await ensureDefaultSubtypeInstance(contractId);
  } catch (subtypeErr: any) {
    console.warn(`⚠️ [Template] ensureDefaultSubtypeInstance failed for ${contractId}: ${subtypeErr?.message}`);
  }

  // Materialize each matrix-pruned accrual policy into an actual
  // accrual_policies row tied to a real subtype_instance — without this the
  // contract has no operational accrual config and the calculation engine
  // falls back to per_sale defaults (the old behaviour just stuffed the
  // unmaterialized JSON blob into contract_analysis.key_terms).
  for (const policy of accrualPolicies) {
    const code = typeof policy?.subtypeCode === 'string' ? policy.subtypeCode : null;
    if (!code) continue; // We only materialize subtype-scoped policies.
    try {
      const instanceId = await ensureSubtypeInstanceByCode(contractId, code);
      if (!instanceId) continue; // Helper logs the reason (matrix denial / inactive subtype).
      // Idempotent: skip if a current policy already exists for this instance
      // (the unique partial index would otherwise reject the insert).
      const existing = await db.execute<{ id: string }>(sql`
        SELECT id FROM accrual_policies
        WHERE subtype_instance_id = ${instanceId} AND is_current = true
        LIMIT 1
      `);
      if (existing.rows && existing.rows.length > 0) continue;
      await db.insert(accrualPoliciesTable).values({
        subtypeInstanceId: instanceId,
        aggregationPeriod: typeof policy.aggregationPeriod === 'string' ? policy.aggregationPeriod : 'per_sale',
        obligationAccrualBasis: typeof policy.obligationAccrualBasis === 'string' ? policy.obligationAccrualBasis : 'qualifying_sale',
        glAccount: typeof policy.glAccount === 'string' ? policy.glAccount : null,
        financeHubTab: typeof policy.financeHubTab === 'string' ? policy.financeHubTab : null,
        releaseTriggerType: typeof policy.releaseTriggerType === 'string' ? policy.releaseTriggerType : 'period_end',
        notes: typeof policy.notes === 'string' ? policy.notes : null,
        createdBy: userId,
      });
    } catch (policyErr: any) {
      console.warn(`⚠️ [Template] accrual policy materialization failed for subtype "${code}" on ${contractId}: ${policyErr?.message}`);
    }
  }

  // Snapshot rules and clauses.
  await insertSnapshotRules(contractId, rules);
  await insertSnapshotClauses(contractId, clauses);

  return { contractId, templateName: tpl.name };
}

async function nextContractNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const [last] = await db
    .select({ contractNumber: contracts.contractNumber })
    .from(contracts)
    .where(sql`contract_number LIKE ${`CNT-${currentYear}-%`}`)
    .orderBy(desc(contracts.contractNumber))
    .limit(1);

  let next = 1;
  if (last?.contractNumber) {
    const parts = last.contractNumber.split('-');
    const parsed = parts.length === 3 ? parseInt(parts[2]) : NaN;
    if (!isNaN(parsed)) next = parsed + 1;
  }
  return `CNT-${currentYear}-${String(next).padStart(3, '0')}`;
}

type SnapshotRuleInput = {
  ruleName: string;
  description: string | null;
  ruleType: string;
  subtypeCode: string | null;
  sortOrder: number | null;
  payload: Record<string, unknown>;
};

async function insertSnapshotRules(contractId: string, rules: SnapshotRuleInput[]) {
  // Pre-create a subtype_instance for every distinct subtype these rules
  // reference. ensureSubtypeInstanceByCode is idempotent and matrix-aware
  // (returns null when the (flow, subtype) pair is not in flow_subtype_validity)
  // so a rule whose subtype isn't valid for the contract's flow ends up with
  // subtype_instance_id = null instead of being mis-attached.
  const distinctCodes = Array.from(
    new Set(rules.map((r) => r.subtypeCode).filter((c): c is string => !!c)),
  );
  const subtypeInstanceByCode = new Map<string, string | null>();
  for (const code of distinctCodes) {
    const id = await ensureSubtypeInstanceByCode(contractId, code);
    subtypeInstanceByCode.set(code, id);
  }

  for (const rule of rules) {
    const subtypeInstanceId = rule.subtypeCode
      ? subtypeInstanceByCode.get(rule.subtypeCode) ?? null
      : null;
    const payload = rule.payload ?? {};

    // Spread the full snapshot payload (formula tree, qualifier groups,
    // exceptions, calc taxonomy, milestones, …) and override identity /
    // FK / audit fields. Drizzle drops unknown keys, so any future column
    // additions are forward-compatible.
    await db.insert(contractRules).values({
      ...(payload as Record<string, unknown>),
      contractId,
      ruleName: rule.ruleName,
      description: rule.description ?? null,
      ruleType: rule.ruleType,
      templateCode: 'TPL-' + rule.ruleType.toUpperCase(),
      extractionOrder: rule.sortOrder ?? 0,
      isActive: true,
      subtypeInstanceId,
      sourceClauseId: null,
      reviewStatus: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      approvalStatus: 'pending',
      approvedBy: null,
      approvedAt: null,
    } as typeof contractRules.$inferInsert);
  }
}

async function insertSnapshotClauses(contractId: string, clauses: any[]) {
  for (let i = 0; i < clauses.length; i++) {
    const c = clauses[i];
    const identifier = `CL-${String(i + 1).padStart(2, '0')}`;
    await db.execute(sql`
      INSERT INTO contract_clauses (contract_id, clause_identifier, text, clause_category_code, confidence, created_at)
      VALUES (${contractId}, ${identifier}, ${c.text}, ${c.clauseCategoryCode ?? null}, 0.93, NOW())
    `);
  }
}

// ---------------------------------------------------------------------------
// SAVE CONTRACT AS TEMPLATE
// ---------------------------------------------------------------------------

export interface SaveAsTemplateInput {
  name: string;
  description?: string;
  scope: SnapshotScope; // minimal | standard | maximal
  visibility: TemplateVisibility;
}

/**
 * Snapshots an existing contract into a reusable template at the requested
 * scope. The new template is owned by the caller; visibility controls whether
 * it's visible to other users in the same company.
 *
 * Scope semantics (cumulative, per Task #46 spec):
 *   - minimal:  rules + clauses only — the core fee mechanics.
 *   - standard: + party role slots / subtype mappings.
 *   - maximal:  + accrual policies + a sample of sales_data captured to
 *               salesSampleCsv.
 *
 * Note: party_role_slots is a flat structural map (obligor / beneficiary /
 * etc.) so it ships in Standard. Accrual policies are operational and arrive
 * only in Maximal — they re-materialize into accrual_policies rows on
 * rehydrate, so giving every saved template them by default would surprise
 * the user with engine behaviour they didn't ask for.
 */
export async function saveContractAsTemplate(
  contractId: string,
  userId: string,
  companyId: string | null,
  input: SaveAsTemplateInput,
): Promise<{ templateId: string; name: string }> {
  type ContractRow = {
    id: string;
    display_name: string | null;
    contract_type: string | null;
    party_role_slots: unknown;
    flow_type_code: string | null;
    notes: string | null;
  };
  const contractRow = await db.execute<ContractRow>(sql`
    SELECT id, display_name, contract_type, party_role_slots, flow_type_code, notes
    FROM contracts WHERE id = ${contractId} LIMIT 1
  `);
  const c = contractRow.rows?.[0];
  if (!c) throw new Error(`Contract ${contractId} not found`);

  // Pick a flow code: explicit column wins, else fall back to contract_type
  // when it matches a flow code, else default to RLA so we don't fail closed.
  const flowCodeCandidate = c.flow_type_code || c.contract_type || 'RLA';
  const [flow] = await db
    .select({ code: flowTypes.code })
    .from(flowTypes)
    .where(eq(flowTypes.code, flowCodeCandidate))
    .limit(1);
  const flowTypeCode = flow?.code ?? 'RLA';

  // Standard adds party-role slots (structural / always-safe-to-copy).
  // Maximal additionally captures the live accrual policies — those drive
  // engine behaviour at rehydrate time, so we only include them when the
  // user explicitly opts in via "Maximal".
  const includesPartySlots = input.scope === 'standard' || input.scope === 'maximal';
  const includesAccrualPolicies = input.scope === 'maximal';

  // Insert template shell.
  const inserted = await db
    .insert(contractTemplates)
    .values({
      flowTypeCode,
      name: input.name,
      description: input.description ?? `Saved from "${c.display_name ?? contractId}".`,
      isSystem: false,
      visibility: input.visibility,
      ownerUserId: userId,
      companyId,
      snapshotScope: input.scope,
      partyRoleSlots: includesPartySlots ? (c.party_role_slots ?? null) : null,
      accrualPolicies: includesAccrualPolicies ? await fetchContractAccrualPolicies(contractId) : [],
    })
    .returning({ id: contractTemplates.id });

  const templateId = inserted[0].id;

  // Snapshot the FULL rule shape (formula_definition, qualifier_groups,
  // exceptions, calc taxonomy, milestones, etc.) into payload so rehydrate
  // produces a contract that mirrors the source — not a stripped subset.
  // We pull rows via Drizzle ORM (camelCase, typed), then strip identity /
  // relationship fields that must not carry across.
  const sourceRules = await db
    .select()
    .from(contractRules)
    .where(and(eq(contractRules.contractId, contractId), eq(contractRules.isActive, true)));

  const subtypeInstanceIds = sourceRules
    .map((r) => r.subtypeInstanceId)
    .filter((x): x is string => !!x);
  const subtypeCodeByInstance = new Map<string, string>();
  if (subtypeInstanceIds.length) {
    // NOTE: use Drizzle's typed `inArray` helper rather than
    // `sql\`... = ANY(${jsArray}::text[])\``. The latter binds the JS array as a
    // composite `record` on @neondatabase/serverless and Postgres rejects it
    // with "cannot cast type record to text[]".
    const sis = await db
      .select({ id: subtypeInstances.id, subtypeCode: subtypeInstances.subtypeCode })
      .from(subtypeInstances)
      .where(inArray(subtypeInstances.id, subtypeInstanceIds));
    for (const s of sis) subtypeCodeByInstance.set(s.id, s.subtypeCode);
  }

  for (const r of sourceRules) {
    const subtypeCode = r.subtypeInstanceId
      ? subtypeCodeByInstance.get(r.subtypeInstanceId) ?? null
      : null;
    // Strip identity, FK, and per-instance audit fields. Everything else
    // (including the formula tree, qualifier groups, milestones, calc phase,
    // etc.) flows into payload and round-trips on rehydrate.
    const {
      id: _id,
      contractId: _cid,
      subtypeInstanceId: _siid,
      sourceClauseId: _scid,
      reviewedBy: _rb,
      reviewedAt: _ra,
      approvedBy: _ab,
      approvedAt: _aa,
      reviewStatus: _rs,
      approvalStatus: _as,
      createdAt: _ca,
      updatedAt: _ua,
      ...payload
    } = r;

    await db.insert(templateRules).values({
      templateId,
      subtypeCode,
      ruleName: r.ruleName,
      description: r.description ?? null,
      ruleType: r.ruleType ?? 'custom',
      isPrimary: false,
      payload: payload as Record<string, unknown>,
      sortOrder: r.extractionOrder ?? 0,
    });
  }

  // Preserve clause-level subtype mapping. contract_clauses doesn't have a
  // direct subtype column, so we derive it from the rules that cite the
  // clause via source_clause_id → subtype_instances.subtype_code. When a
  // clause is referenced by rules of exactly one subtype we tag the template
  // clause with that subtype so the matrix-aware rehydrate path can prune
  // it accurately later. If multiple (or none), we fall back to NULL meaning
  // "applies cross-cutting / always copy".
  type ClauseSnapshotRow = {
    id: string;
    text: string;
    clause_category_code: string | null;
    derived_subtype_code: string | null;
  };
  const clauseRows = await db.execute<ClauseSnapshotRow>(sql`
    SELECT
      cc.id,
      cc.text,
      cc.clause_category_code,
      -- DISTINCT subtype_code across rules citing this clause; if there's
      -- exactly one, it becomes the clause's derived subtype.
      (
        SELECT MIN(si.subtype_code)
        FROM contract_rules cr
        JOIN subtype_instances si ON si.id = cr.subtype_instance_id
        WHERE cr.source_clause_id = cc.id
          AND cr.contract_id = ${contractId}
          AND COALESCE(cr.is_active, true) = true
        HAVING COUNT(DISTINCT si.subtype_code) = 1
      ) AS derived_subtype_code
    FROM contract_clauses cc
    WHERE cc.contract_id = ${contractId}
    ORDER BY cc.clause_identifier
  `);
  for (const cl of clauseRows.rows ?? []) {
    await db.insert(templateClauses).values({
      templateId,
      subtypeCode: cl.derived_subtype_code,
      text: cl.text,
      clauseCategoryCode: cl.clause_category_code ?? null,
      isPrimary: false,
      sortOrder: 0,
    });
  }

  // Maximal-only: capture a small slice of historical sales so the next
  // contract created from this template ships with realistic test data.
  if (input.scope === 'maximal') {
    type SalesSampleRow = {
      transaction_date: string | null;
      transaction_id: string | null;
      product_code: string | null;
      product_name: string | null;
      category: string | null;
      territory: string | null;
      channel: string | null;
      quantity: string | null;
      unit_price: string | null;
      gross_amount: string | null;
      net_amount: string | null;
      customer_code: string | null;
    };
    const sample = await db.execute<SalesSampleRow>(sql`
      SELECT transaction_date, transaction_id, product_code, product_name, category,
        territory, channel, quantity, unit_price, gross_amount, net_amount, customer_code
      FROM sales_data WHERE matched_contract_id = ${contractId} ORDER BY transaction_date DESC LIMIT 50
    `);
    const rows = sample.rows ?? [];
    if (rows.length > 0) {
      const headers = ['date', 'txnId', 'productCode', 'productName', 'category', 'territory', 'channel', 'qty', 'unitPrice', 'grossAmount', 'netAmount', 'customerCode'];
      const lines = [headers.join(',')];
      for (const r of rows) {
        const vals = [
          r.transaction_date, r.transaction_id, r.product_code, r.product_name, r.category,
          r.territory, r.channel, r.quantity, r.unit_price, r.gross_amount, r.net_amount, r.customer_code,
        ].map((v) => csvEscape(v));
        lines.push(vals.join(','));
      }
      await db
        .update(contractTemplates)
        .set({ salesSampleCsv: lines.join('\n') })
        .where(eq(contractTemplates.id, templateId));
    }
  }

  return { templateId, name: input.name };
}

type AccrualPolicySnapshot = {
  subtypeCode: string;
  aggregationPeriod: string | null;
  obligationAccrualBasis: string | null;
  glAccount: string | null;
  financeHubTab: string | null;
  releaseTriggerType: string | null;
};

async function fetchContractAccrualPolicies(contractId: string): Promise<AccrualPolicySnapshot[]> {
  type Row = {
    subtype_code: string;
    aggregation_period: string | null;
    obligation_accrual_basis: string | null;
    gl_account: string | null;
    finance_hub_tab: string | null;
    release_trigger_type: string | null;
  };
  const result = await db.execute<Row>(sql`
    SELECT si.subtype_code, ap.aggregation_period, ap.obligation_accrual_basis,
      ap.gl_account, ap.finance_hub_tab, ap.release_trigger_type
    FROM accrual_policies ap
    JOIN subtype_instances si ON si.id = ap.subtype_instance_id
    WHERE si.contract_id = ${contractId} AND ap.is_current = true
  `);
  return (result.rows ?? []).map((r) => ({
    subtypeCode: r.subtype_code,
    aggregationPeriod: r.aggregation_period,
    obligationAccrualBasis: r.obligation_accrual_basis,
    glAccount: r.gl_account,
    financeHubTab: r.finance_hub_tab,
    releaseTriggerType: r.release_trigger_type,
  }));
}

function csvEscape(v: any): string {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deleteTemplateContract(contractId: string): Promise<void> {
  await db.execute(sql`DELETE FROM contract_embeddings WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM sales_data WHERE matched_contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM rule_conflicts WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contract_clauses WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contract_terms WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contract_rules WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contract_analysis WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM extraction_stage_results WHERE extraction_run_id IN (SELECT id FROM extraction_runs WHERE contract_id = ${contractId})`);
  await db.execute(sql`DELETE FROM extraction_runs WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contracts WHERE id = ${contractId}`);
}

/**
 * Permanently delete a non-system template (owner-only, enforced by route).
 */
export async function deleteUserTemplate(templateId: string): Promise<void> {
  await db
    .delete(contractTemplates)
    .where(and(eq(contractTemplates.id, templateId), eq(contractTemplates.isSystem, false)));
}
