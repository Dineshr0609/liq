/**
 * Post-approval edit lock.
 *
 * Once a contract is "active" (a version has been approved and the contract
 * has gone live), users may NOT mutate rules / qualifiers / parties / terms
 * / clauses / contract metadata directly. They must first mint a new draft
 * version (a "change order") via POST /api/contracts/:id/versions/mint.
 * Once an open `contract_versions` row exists in state `draft` or
 * `pending_approval`, edits are unlocked again — those edits flow into the
 * change order and become live only after the new version is approved.
 *
 * Contracts that are still in draft / uploaded / processing / analyzed are
 * always editable (no version has ever been approved yet).
 */

import { sql } from "drizzle-orm";
import { db } from "../db";

export class ContractLockedError extends Error {
  status = 423; // 423 Locked — semantically perfect here
  code = "contract_locked";
  constructor(message = "Contract is active. Click Revise to create a change order before editing.") {
    super(message);
    this.name = "ContractLockedError";
  }
}

/**
 * Returns { locked, status, hasOpenVersion } for a contract.
 * Returns locked=false if the contract doesn't exist (let the calling
 * endpoint surface its own 404 rather than masking it with a 423).
 */
export async function getContractEditState(contractId: string): Promise<{
  locked: boolean;
  status: string | null;
  hasOpenVersion: boolean;
}> {
  const r = await db.execute(sql`
    SELECT
      c.status,
      c.approval_state,
      EXISTS (
        SELECT 1 FROM contract_versions v
        WHERE v.contract_id = c.id
          AND v.approval_state IN ('draft', 'pending_approval')
      ) AS has_open_version
    FROM contracts c
    WHERE c.id = ${contractId}
    LIMIT 1
  `);
  const row: any = r.rows?.[0];
  if (!row) return { locked: false, status: null, hasOpenVersion: false };
  const status = String(row.status || "");
  const approvalState = String(row.approval_state || "");
  const hasOpenVersion = !!row.has_open_version;
  // Lock when the contract has been approved (either gone fully active, or
  // its approval_state is 'approved' even if status hasn't flipped yet).
  // An open draft / pending change order unlocks edits — they flow into the
  // change order and only go live after that version is approved.
  const isLive = status === "active" || approvalState === "approved";
  const locked = isLive && !hasOpenVersion;
  return { locked, status, hasOpenVersion };
}

/**
 * Throws ContractLockedError if the contract is locked. Use inside
 * mutation handlers AFTER you've loaded the contractId (the lookup is
 * cheap — a single indexed row).
 */
export async function assertContractEditable(contractId: string | null | undefined): Promise<void> {
  if (!contractId) return;
  const { locked } = await getContractEditState(contractId);
  if (locked) throw new ContractLockedError();
}

/**
 * Express helper — call inside a try/catch block in routes; sends a 423
 * JSON response and returns true if locked. Use this when the calling
 * route doesn't want to throw (e.g. routes with their own try/catch).
 *
 *   if (await sendIfLocked(res, contractId)) return;
 */
export async function sendIfLocked(res: any, contractId: string | null | undefined): Promise<boolean> {
  if (!contractId) return false;
  const { locked } = await getContractEditState(contractId);
  if (locked) {
    res.status(423).json({
      error: "contract_locked",
      message: "Contract is active. Click Revise to create a change order before editing.",
    });
    return true;
  }
  return false;
}
