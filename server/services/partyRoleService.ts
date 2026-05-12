import { db } from "../db";
import { sql } from "drizzle-orm";

// ====================================================================
// Party Role Service — multi-role party assignments per contract.
// v1 supports Financial + Operational role categories.
// ====================================================================

export const PARTY_ROLE_CATEGORIES = {
  financial: [
    { role: "owning_party", label: "Owning Party", defaultPartyKind: "organization" },
    { role: "counterparty", label: "Counterparty", defaultPartyKind: "partner" },
    { role: "billed_party", label: "Billed Party", defaultPartyKind: "partner" },
    { role: "payee_party", label: "Payee Party", defaultPartyKind: "partner" },
    { role: "remit_to_party", label: "Remit-To Party", defaultPartyKind: "partner" },
    { role: "guarantor", label: "Guarantor", defaultPartyKind: "partner" },
  ],
  operational: [
    { role: "finance_owner", label: "Finance Owner", defaultPartyKind: "organization" },
    { role: "execution_owner", label: "Execution Owner", defaultPartyKind: "organization" },
    { role: "legal_owner", label: "Legal Owner", defaultPartyKind: "organization" },
    { role: "notice_recipient", label: "Notice Recipient", defaultPartyKind: "partner" },
  ],
} as const;

export const ALL_PARTY_ROLES = [
  ...PARTY_ROLE_CATEGORIES.financial.map(r => ({ ...r, category: "financial" as const })),
  ...PARTY_ROLE_CATEGORIES.operational.map(r => ({ ...r, category: "operational" as const })),
];

export function getRoleMeta(role: string) {
  return ALL_PARTY_ROLES.find(r => r.role === role) || null;
}

export type PartyRoleSlot = {
  role: string;
  required: boolean;
  allowMultiple?: boolean;
};

/**
 * Default party-role slot presets used as a fallback when a contract type
 * has no `partyRoleSlots` configured yet.
 */
export const DEFAULT_PARTY_ROLE_SLOTS: PartyRoleSlot[] = [
  { role: "owning_party", required: true },
  { role: "counterparty", required: true },
  { role: "billed_party", required: true },
  { role: "payee_party", required: true },
  { role: "remit_to_party", required: false },
  { role: "finance_owner", required: false },
  { role: "execution_owner", required: false },
];

/**
 * Consolidate duplicate party assignments on a contract.
 *
 * Two passes:
 *  1. Same-master dedupe: when multiple rows reference the same partner_id
 *     (or company_id), keep the "richest" row (is_primary > has party_role >
 *     earliest assignment_id), merge any role flags from losers into the
 *     winner, and delete the losers. Common cause: backfill creates a
 *     `PARTY-CP-*` row for the counterparty AFTER the AI also extracted
 *     that same partner; both end up pointing to the same partner master.
 *
 *  2. Name-match dedupe of orphans: an unmapped row (partner_id IS NULL,
 *     company_id IS NULL) with NO party_role and not is_primary is a
 *     dangling AI extraction. If another row in the same contract is
 *     mapped to a master partner whose name (or raw_value) normalizes
 *     to the same string as the orphan's raw_value, drop the orphan.
 *
 * Idempotent and cheap — safe to call on every read.
 */
export async function consolidateContractParties(contractId: string) {
  // Helper: per-key dedupe driven by ranked CTE — keeps the richest row,
  // merges role flags from losers into the winner, then deletes losers.
  // Runs in JS so we can produce simple, predictable SQL per group.
  // Dedupe by (partner_id|company_id, party_role) — a single party can hold
  // multiple roles (Billed Party + Counterparty etc.), so each (party, role)
  // pair is its own slot. Earlier this partitioned by party only, which
  // silently deleted any second-role row the user ticked because it looked
  // like a duplicate. NULL-role placeholder rows are also kept separate from
  // any real (party, role) row so the user can promote them later.
  const dedupeBy = async (keyCol: 'partner_id' | 'company_id') => {
    const ranked = await db.execute(sql`
      SELECT assignment_id, ${sql.raw(keyCol)} AS key, party_role, is_primary,
             ROW_NUMBER() OVER (
               PARTITION BY ${sql.raw(keyCol)}, COALESCE(party_role, '__null__')
               ORDER BY COALESCE(is_primary, false) DESC,
                        assignment_id ASC
             ) AS rn
      FROM contract_partner_assignments
      WHERE contract_id = ${contractId}
        AND ${sql.raw(keyCol)} IS NOT NULL
    `);
    const rows: any[] = ranked.rows || [];
    const groups = new Map<string, { winner: any; losers: any[] }>();
    for (const r of rows) {
      const key = `${String(r.key)}::${r.party_role ?? '__null__'}`;
      const g = groups.get(key) || { winner: null as any, losers: [] as any[] };
      if (Number(r.rn) === 1) g.winner = r; else g.losers.push(r);
      groups.set(key, g);
    }
    for (const { winner, losers } of groups.values()) {
      if (!winner || losers.length === 0) continue;
      const inheritPrimary = !!winner.is_primary || losers.some(l => !!l.is_primary);
      if (inheritPrimary && !winner.is_primary) {
        await db.execute(sql`
          UPDATE contract_partner_assignments
          SET is_primary = true
          WHERE assignment_id = ${winner.assignment_id}
        `);
      }
      for (const loser of losers) {
        await db.execute(sql`
          DELETE FROM contract_partner_assignments
          WHERE assignment_id = ${loser.assignment_id}
        `);
      }
    }
  };
  await dedupeBy('partner_id');
  await dedupeBy('company_id');

  // Pass 2: drop orphan unmapped rows whose raw_value matches a mapped
  // sibling (by partner_master.partner_name, companies.company_name, or the
  // sibling's own raw_value). Only delete rows with no role and not primary.
  await db.execute(sql`
    DELETE FROM contract_partner_assignments orphan
    WHERE orphan.contract_id = ${contractId}
      AND orphan.partner_id IS NULL
      AND orphan.company_id IS NULL
      AND orphan.party_role IS NULL
      AND COALESCE(orphan.is_primary, false) = false
      AND orphan.raw_value IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM contract_partner_assignments mapped
        LEFT JOIN partner_master pm
          ON mapped.partner_id = pm.partner_name
          OR mapped.partner_id = pm.partner_id::text
          OR mapped.partner_id = pm.id::text
        LEFT JOIN companies co ON mapped.company_id = co.company_id
        WHERE mapped.contract_id = ${contractId}
          AND mapped.assignment_id <> orphan.assignment_id
          AND (mapped.partner_id IS NOT NULL OR mapped.company_id IS NOT NULL)
          AND (
            lower(btrim(orphan.raw_value)) = lower(btrim(COALESCE(mapped.raw_value, '')))
            OR lower(btrim(orphan.raw_value)) = lower(btrim(COALESCE(pm.partner_name, '')))
            OR lower(btrim(orphan.raw_value)) = lower(btrim(COALESCE(co.company_name, '')))
          )
      )
  `);
}

/**
 * List all parties assigned to a contract, joining either partner_master
 * or companies based on party_kind, and falling back to legacy partner_id-only rows.
 */
export async function listPartiesByContract(contractId: string) {
  // Best-effort dedupe before reading. Failure here must not blank the list.
  try {
    await consolidateContractParties(contractId);
  } catch (e: any) {
    console.warn("[consolidateContractParties] non-fatal:", e?.message || e);
  }
  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (cpa.assignment_id)
        cpa.assignment_id,
        cpa.contract_id,
        cpa.party_kind,
        cpa.partner_id,
        cpa.company_id,
        cpa.party_role,
        cpa.assignment_type,
        cpa.is_primary,
        cpa.effective_start,
        cpa.effective_end,
        cpa.status,
        cpa.custom_terms,
        cpa.notes,
        cpa.raw_value,
        cpa.link_status,
        cpa.link_confidence,
        cpa.link_method,
        COALESCE(
          CASE WHEN cpa.party_kind = 'organization' THEN c.company_name END,
          pm.partner_name,
          cpa.partner_id,
          cpa.raw_value
        ) AS resolved_name,
        CASE
          WHEN cpa.party_kind = 'organization' THEN 'organization'
          WHEN cpa.party_kind = 'partner' THEN 'partner'
          WHEN cpa.partner_id IS NOT NULL THEN 'partner'
          ELSE 'unknown'
        END AS resolved_kind
      FROM contract_partner_assignments cpa
      LEFT JOIN partner_master pm
        ON cpa.partner_id = pm.partner_name
        OR cpa.partner_id = pm.partner_id::text
        OR cpa.partner_id = pm.id::text
      LEFT JOIN companies c
        ON cpa.company_id = c.company_id
      WHERE cpa.contract_id = ${contractId}
      ORDER BY cpa.assignment_id, pm.partner_name NULLS LAST
    ) sub
    ORDER BY
      sub.is_primary DESC NULLS LAST,
      sub.party_role NULLS LAST,
      sub.assignment_id
  `);
  return result.rows || [];
}

/**
 * Resolve the active primary party holding a given role on a contract,
 * optionally constrained to a specific date.
 */
export async function getPartyForRole(
  contractId: string,
  role: string,
  asOfDate?: Date,
) {
  const dateClause = asOfDate
    ? sql`AND (cpa.effective_start IS NULL OR cpa.effective_start <= ${asOfDate})
          AND (cpa.effective_end   IS NULL OR cpa.effective_end   >= ${asOfDate})`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      cpa.assignment_id,
      cpa.party_kind,
      cpa.partner_id,
      cpa.company_id,
      COALESCE(
        CASE WHEN cpa.party_kind = 'organization' THEN c.company_name END,
        pm.partner_name,
        cpa.partner_id,
        cpa.raw_value
      ) AS resolved_name
    FROM contract_partner_assignments cpa
    LEFT JOIN partner_master pm
      ON cpa.partner_id = pm.partner_name
      OR cpa.partner_id = pm.partner_id::text
      OR cpa.partner_id = pm.id::text
    LEFT JOIN companies c ON cpa.company_id = c.company_id
    WHERE cpa.contract_id = ${contractId}
      AND cpa.party_role = ${role}
      AND COALESCE(cpa.status, 'active') = 'active'
      ${dateClause}
    ORDER BY cpa.is_primary DESC NULLS LAST, cpa.assignment_id
    LIMIT 1
  `);
  return result.rows?.[0] || null;
}

/**
 * Get the configured role slots for a contract type, falling back to defaults.
 */
export async function getPartyRoleSlotsForContractType(
  contractTypeCode: string,
): Promise<PartyRoleSlot[]> {
  const r = await db.execute(sql`
    SELECT party_role_slots
    FROM contract_type_definitions
    WHERE code = ${contractTypeCode}
    LIMIT 1
  `);
  const slots = (r.rows?.[0] as any)?.party_role_slots;
  if (Array.isArray(slots) && slots.length > 0) return slots as PartyRoleSlot[];
  return DEFAULT_PARTY_ROLE_SLOTS;
}

/**
 * Compute which required roles for the given contract still need a party
 * assignment. Returns the list of unfulfilled role codes.
 */
export async function getMissingRequiredRoles(
  contractId: string,
  contractTypeCode: string,
): Promise<string[]> {
  const slots = await getPartyRoleSlotsForContractType(contractTypeCode);
  const required = slots.filter(s => s.required).map(s => s.role);
  if (required.length === 0) return [];

  // Auto-heal: if a role row has no master link but a sibling row with the
  // same normalized raw_value IS mapped, inherit that link. Fixes legacy
  // rows whose check / promote happened before any twin was mapped, so the
  // UI (which groups by name) shows them as mapped while the DB still has
  // NULL ids — making the readiness gate stay red forever.
  await db.execute(sql`
    UPDATE contract_partner_assignments tgt
    SET partner_id   = COALESCE(tgt.partner_id, src.partner_id),
        company_id   = COALESCE(tgt.company_id, src.company_id),
        party_kind   = COALESCE(NULLIF(tgt.party_kind, ''), src.party_kind),
        link_status  = CASE WHEN tgt.link_status IN ('unlinked','') OR tgt.link_status IS NULL
                            THEN COALESCE(src.link_status, 'manual')
                            ELSE tgt.link_status END,
        link_method  = COALESCE(tgt.link_method, 'inherited_from_sibling')
    FROM contract_partner_assignments src
    WHERE tgt.contract_id = ${contractId}
      AND src.contract_id = ${contractId}
      AND tgt.assignment_id <> src.assignment_id
      AND tgt.partner_id IS NULL
      AND tgt.company_id IS NULL
      AND (src.partner_id IS NOT NULL OR src.company_id IS NOT NULL)
      AND tgt.raw_value IS NOT NULL
      AND src.raw_value IS NOT NULL
      AND lower(btrim(tgt.raw_value)) = lower(btrim(src.raw_value))
  `);

  const r = await db.execute(sql`
    SELECT DISTINCT party_role
    FROM contract_partner_assignments
    WHERE contract_id = ${contractId}
      AND party_role IS NOT NULL
      AND COALESCE(status, 'active') = 'active'
      AND (partner_id IS NOT NULL OR company_id IS NOT NULL)
  `);
  const filled = new Set((r.rows || []).map((row: any) => row.party_role));
  return required.filter(role => !filled.has(role));
}

/**
 * Backfill counterparty + owning_party party-role rows from the contracts
 * table for a single contract. Idempotent: skips contracts that already
 * have those roles defined.
 */
export async function backfillContractPartyRoles(contractId: string) {
  // Counterparty
  await db.execute(sql`
    INSERT INTO contract_partner_assignments (
      assignment_id, contract_id, partner_id, party_kind, party_role,
      is_primary, status, raw_value, link_status, link_confidence, link_method
    )
    SELECT
      'PARTY-CP-' || c.id,
      c.id,
      COALESCE(c.counterparty_partner_id, c.counterparty_name),
      'partner',
      'counterparty',
      true,
      'active',
      COALESCE(c.counterparty_link_raw_value, c.counterparty_name),
      COALESCE(c.counterparty_link_status, 'unlinked'),
      c.counterparty_link_confidence,
      c.counterparty_link_method
    FROM contracts c
    WHERE c.id = ${contractId}
      AND (c.counterparty_name IS NOT NULL OR c.counterparty_partner_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM contract_partner_assignments x
        WHERE x.contract_id = c.id AND x.party_role = 'counterparty'
      )
  `);

  // Owning party (organization)
  await db.execute(sql`
    INSERT INTO contract_partner_assignments (
      assignment_id, contract_id, company_id, party_kind, party_role,
      is_primary, status, raw_value, link_status, link_confidence, link_method
    )
    SELECT
      'PARTY-OP-' || c.id,
      c.id,
      c.organization_company_id,
      'organization',
      'owning_party',
      true,
      'active',
      COALESCE(c.organization_link_raw_value, c.organization_name),
      COALESCE(c.organization_link_status, 'unlinked'),
      c.organization_link_confidence,
      c.organization_link_method
    FROM contracts c
    WHERE c.id = ${contractId}
      AND (c.organization_name IS NOT NULL OR c.organization_company_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM contract_partner_assignments x
        WHERE x.contract_id = c.id AND x.party_role = 'owning_party'
      )
  `);
}

/**
 * Two-way metadata sync: refresh the primary counterparty + owning_party
 * party-role rows on a contract from the latest values stored on the
 * `contracts` table (counterparty_*, organization_*). Inserts the rows if
 * missing (delegates to backfill) and updates them in-place when present.
 */
export async function syncPrimaryPartyRolesFromContract(contractId: string) {
  // Ensure the rows exist
  await backfillContractPartyRoles(contractId);

  // Update primary counterparty row to reflect current contract metadata
  await db.execute(sql`
    UPDATE contract_partner_assignments cpa
    SET partner_id      = COALESCE(c.counterparty_partner_id, c.counterparty_name),
        raw_value       = COALESCE(c.counterparty_link_raw_value, c.counterparty_name),
        link_status     = COALESCE(c.counterparty_link_status, cpa.link_status),
        link_confidence = c.counterparty_link_confidence,
        link_method     = c.counterparty_link_method,
        party_kind      = 'partner'
    FROM contracts c
    WHERE cpa.contract_id = c.id
      AND c.id = ${contractId}
      AND cpa.party_role = 'counterparty'
      AND COALESCE(cpa.is_primary, false) = true
  `);

  // Update primary owning_party row
  await db.execute(sql`
    UPDATE contract_partner_assignments cpa
    SET company_id      = c.organization_company_id,
        raw_value       = COALESCE(c.organization_link_raw_value, c.organization_name),
        link_status     = COALESCE(c.organization_link_status, cpa.link_status),
        link_confidence = c.organization_link_confidence,
        link_method     = c.organization_link_method,
        party_kind      = 'organization'
    FROM contracts c
    WHERE cpa.contract_id = c.id
      AND c.id = ${contractId}
      AND cpa.party_role = 'owning_party'
      AND COALESCE(cpa.is_primary, false) = true
  `);
}

/**
 * Reverse sync: when a primary counterparty / owning_party party-role row is
 * created or modified on the Partners tab, write the resolved values back to
 * the `contracts` table so legacy code paths reading counterpartyName /
 * organizationName remain consistent.
 */
export async function syncContractMetadataFromPartyRoles(contractId: string) {
  // Counterparty → contracts.counterpartyName / counterpartyPartnerId / link_*
  await db.execute(sql`
    UPDATE contracts c
    SET counterparty_partner_id      = sub.partner_id,
        counterparty_name            = COALESCE(sub.resolved_name, c.counterparty_name),
        counterparty_link_status     = COALESCE(sub.link_status, c.counterparty_link_status),
        counterparty_link_confidence = COALESCE(sub.link_confidence, c.counterparty_link_confidence),
        counterparty_link_method     = COALESCE(sub.link_method, c.counterparty_link_method),
        counterparty_link_raw_value  = COALESCE(sub.raw_value, c.counterparty_link_raw_value)
    FROM (
      SELECT cpa.partner_id,
             cpa.raw_value,
             cpa.link_status,
             cpa.link_confidence,
             cpa.link_method,
             COALESCE(pm.partner_name, cpa.raw_value, cpa.partner_id) AS resolved_name
      FROM contract_partner_assignments cpa
      LEFT JOIN partner_master pm
        ON cpa.partner_id = pm.partner_name
        OR cpa.partner_id = pm.partner_id::text
        OR cpa.partner_id = pm.id::text
      WHERE cpa.contract_id = ${contractId}
        AND cpa.party_role = 'counterparty'
        AND COALESCE(cpa.is_primary, false) = true
        AND COALESCE(cpa.status, 'active') = 'active'
      ORDER BY cpa.assignment_id
      LIMIT 1
    ) sub
    WHERE c.id = ${contractId}
  `);

  // Owning party → contracts.organizationName / organizationCompanyId / link_*
  await db.execute(sql`
    UPDATE contracts c
    SET organization_company_id      = sub.company_id,
        organization_name            = COALESCE(sub.resolved_name, c.organization_name),
        organization_link_status     = COALESCE(sub.link_status, c.organization_link_status),
        organization_link_confidence = COALESCE(sub.link_confidence, c.organization_link_confidence),
        organization_link_method     = COALESCE(sub.link_method, c.organization_link_method),
        organization_link_raw_value  = COALESCE(sub.raw_value, c.organization_link_raw_value)
    FROM (
      SELECT cpa.company_id,
             cpa.raw_value,
             cpa.link_status,
             cpa.link_confidence,
             cpa.link_method,
             COALESCE(co.company_name, cpa.raw_value) AS resolved_name
      FROM contract_partner_assignments cpa
      LEFT JOIN companies co ON cpa.company_id = co.company_id
      WHERE cpa.contract_id = ${contractId}
        AND cpa.party_role = 'owning_party'
        AND COALESCE(cpa.is_primary, false) = true
        AND COALESCE(cpa.status, 'active') = 'active'
      ORDER BY cpa.assignment_id
      LIMIT 1
    ) sub
    WHERE c.id = ${contractId}
  `);
}

export async function backfillAllContracts() {
  const r = await db.execute(sql`SELECT id FROM contracts`);
  let n = 0;
  for (const row of r.rows || []) {
    await backfillContractPartyRoles((row as any).id);
    n++;
  }
  return n;
}
