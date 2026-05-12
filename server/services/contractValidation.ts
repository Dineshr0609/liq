import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  getMissingRequiredRoles,
  getRoleMeta,
} from "./partyRoleService";

// ====================================================================
// Contract Validation Service
//
// Single source of truth for "is this contract complete enough to be
// activated / approved?". Returns a structured list of every failure so
// the UI can surface ALL problems at once instead of one-at-a-time.
// ====================================================================

export type ValidationFailure = {
  category:
    | "master_links"
    | "party_roles"
    | "metadata"
    | "dates"
    | "rules";
  field: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  failures: ValidationFailure[];
};

const OK_LINK_STATUSES = new Set(["verified", "manual"]);

/**
 * Build a comprehensive list of validation failures that block activation
 * of the given contract. Empty `failures` array means the contract is OK
 * to transition to "Active".
 */
export async function validateContractForActivation(
  contractId: string,
): Promise<ValidationResult> {
  const failures: ValidationFailure[] = [];

  const r = await db.execute(sql`
    SELECT
      id,
      display_name,
      contract_type,
      counterparty_name,
      counterparty_partner_id,
      counterparty_link_status,
      organization_name,
      owning_party,
      organization_company_id,
      organization_link_status,
      effective_start,
      effective_end,
      currency
    FROM contracts
    WHERE id = ${contractId}
    LIMIT 1
  `);
  const c: any = r.rows?.[0];
  if (!c) {
    return {
      valid: false,
      failures: [
        { category: "metadata", field: "contract", message: "Contract not found." },
      ],
    };
  }

  // ─── Master-data link confirmation ────────────────────────────────
  if (!c.counterparty_name || !c.counterparty_name.trim()) {
    failures.push({
      category: "metadata",
      field: "Counterparty",
      message: "Counterparty name is missing.",
    });
  } else if (!OK_LINK_STATUSES.has((c.counterparty_link_status || "unlinked").toString())) {
    failures.push({
      category: "master_links",
      field: "Counterparty",
      message: `Counterparty "${c.counterparty_name}" is not linked to a partner master record. Confirm or unlink it.`,
    });
  }

  const orgName = c.organization_name || c.owning_party;
  if (!orgName || !orgName.toString().trim()) {
    failures.push({
      category: "metadata",
      field: "Your Organization",
      message: "Your organization is missing.",
    });
  } else if (!OK_LINK_STATUSES.has((c.organization_link_status || "unlinked").toString())) {
    failures.push({
      category: "master_links",
      field: "Your Organization",
      message: `Your organization "${orgName}" is not linked to a company master record. Confirm or unlink it.`,
    });
  }

  // ─── Required party roles per contract type ──────────────────────
  if (c.contract_type) {
    try {
      const missing = await getMissingRequiredRoles(contractId, c.contract_type);
      for (const role of missing) {
        const meta = getRoleMeta(role);
        failures.push({
          category: "party_roles",
          field: meta?.label || role,
          message: `Required ${meta?.category || "party"} role "${meta?.label || role}" is not assigned. Add it on the Partners tab.`,
        });
      }
    } catch (e: any) {
      // Non-fatal — surface as a warning-style failure
      failures.push({
        category: "party_roles",
        field: "Party roles",
        message: `Could not evaluate required party roles: ${e?.message || e}`,
      });
    }
  }

  // ─── Effective dates ──────────────────────────────────────────────
  if (!c.effective_start) {
    failures.push({
      category: "dates",
      field: "Effective Start",
      message: "Effective start date is required.",
    });
  }
  if (c.effective_start && c.effective_end) {
    const start = new Date(c.effective_start as any).getTime();
    const end = new Date(c.effective_end as any).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
      failures.push({
        category: "dates",
        field: "Effective End",
        message: "Effective end date must be on or after the effective start date.",
      });
    }
  }

  // ─── Basic metadata ───────────────────────────────────────────────
  if (!c.currency || !c.currency.toString().trim()) {
    failures.push({
      category: "metadata",
      field: "Currency",
      message: "Currency is required.",
    });
  }
  if (!c.display_name || !c.display_name.toString().trim()) {
    failures.push({
      category: "metadata",
      field: "Contract Name",
      message: "Contract name is required.",
    });
  }

  return { valid: failures.length === 0, failures };
}

/**
 * Format an array of failures as a single human-readable multi-line
 * string suitable for an Error.message or a toast description.
 */
export function formatFailureSummary(failures: ValidationFailure[]): string {
  if (failures.length === 0) return "";
  const grouped: Record<string, ValidationFailure[]> = {};
  for (const f of failures) {
    (grouped[f.category] ||= []).push(f);
  }
  const labels: Record<string, string> = {
    master_links: "Master Data Links",
    party_roles: "Party Roles",
    metadata: "Contract Details",
    dates: "Effective Dates",
    rules: "Rules",
  };
  const lines: string[] = [];
  for (const cat of Object.keys(grouped)) {
    lines.push(`${labels[cat] || cat}:`);
    for (const f of grouped[cat]) {
      lines.push(`  • ${f.message}`);
    }
  }
  return lines.join("\n");
}
