/**
 * Canonical catalog of approvable document types ("scopes") in the system.
 * Surfaced to the frontend via GET /api/finance/approval-doc-types so the
 * Approval Workflows admin UI stays in sync without hard-coding the list.
 *
 * `subtypeOptions`, when non-empty, drives the optional sub-type filter on
 * each rule (e.g. claim_type for claims, contract_type for contracts).
 * `directionApplies` enables the inbound/outbound direction filter for claims.
 * `hookStatus` reflects whether the engine is actually called from the
 * relevant create flow today — useful for the UI to show "wired" vs
 * "not yet wired" badges so users aren't surprised by silent no-ops.
 */
export interface ApprovalDocType {
  scope: string;
  label: string;
  description: string;
  subtypeOptions: { value: string; label: string }[];
  directionApplies: boolean;
  hookStatus: "wired" | "pending";
}

export const APPROVAL_DOC_TYPES: ApprovalDocType[] = [
  {
    scope: "contract",
    label: "Contracts",
    description: "Approval required to publish or activate a new contract.",
    subtypeOptions: [
      { value: "royalty_license", label: "Royalty / License" },
      { value: "distribution", label: "Distribution" },
      { value: "rebate_program", label: "Rebate Program" },
      { value: "co_op_marketing", label: "Co-op / Marketing" },
      { value: "service", label: "Service" },
    ],
    directionApplies: false,
    hookStatus: "pending",
  },
  {
    scope: "contract_change",
    label: "Contract Changes",
    description: "Approval required for amendments and revisions to active contracts.",
    subtypeOptions: [
      { value: "amendment", label: "Amendment" },
      { value: "renewal", label: "Renewal" },
      { value: "termination", label: "Termination" },
      { value: "rate_change", label: "Rate Change" },
    ],
    directionApplies: false,
    hookStatus: "pending",
  },
  {
    scope: "claim",
    label: "Claims",
    description: "Inbound and outbound claims (chargebacks, MDF, rebate settlements, etc.).",
    subtypeOptions: [
      { value: "chargeback", label: "Chargeback" },
      { value: "mdf", label: "MDF" },
      { value: "price_protection", label: "Price Protection" },
      { value: "rebate_settlement", label: "Rebate Settlement" },
      { value: "royalty_statement", label: "Royalty Statement" },
      { value: "other", label: "Other" },
    ],
    directionApplies: true,
    hookStatus: "wired",
  },
  {
    scope: "manual_accrual",
    label: "Manual Accrual Adjustments",
    description: "Approval required for manual accrual creation or adjustment outside the calculation engine.",
    subtypeOptions: [],
    directionApplies: false,
    hookStatus: "pending",
  },
  {
    scope: "journal_entry",
    label: "Manual Journal Entries",
    description: "Approval required to post a manual journal entry to the ledger.",
    subtypeOptions: [],
    directionApplies: false,
    hookStatus: "pending",
  },
  {
    scope: "deduction",
    label: "Deduction Write-offs",
    description: "Approval required to write off a customer deduction.",
    subtypeOptions: [],
    directionApplies: false,
    hookStatus: "wired",
  },
  {
    scope: "document",
    label: "Invoices & Memos",
    description: "Outbound invoices, credit memos, and debit memos.",
    subtypeOptions: [
      { value: "invoice", label: "Invoice" },
      { value: "credit_memo", label: "Credit Memo" },
      { value: "debit_memo", label: "Debit Memo" },
    ],
    directionApplies: false,
    hookStatus: "wired",
  },
  {
    scope: "period_close",
    label: "Period Open / Close",
    description: "Approval required to open or close a fiscal period.",
    subtypeOptions: [
      { value: "open", label: "Open Period" },
      { value: "close", label: "Close Period" },
    ],
    directionApplies: false,
    hookStatus: "pending",
  },
];

/**
 * Approver roles offered in the workflow editor. We list them centrally
 * (rather than reading from `users.role`) so the editor can show a stable
 * set even when no user has been assigned that role yet.
 */
export const APPROVER_ROLES = [
  { value: "finance_lead", label: "Finance Lead" },
  { value: "controller", label: "Controller" },
  { value: "cfo", label: "CFO" },
  { value: "contract_manager", label: "Contract Manager" },
  { value: "legal", label: "Legal" },
  { value: "operations_lead", label: "Operations Lead" },
  { value: "system_admin", label: "System Administrator" },
];

export function isValidScope(scope: string): boolean {
  return APPROVAL_DOC_TYPES.some(d => d.scope === scope);
}
