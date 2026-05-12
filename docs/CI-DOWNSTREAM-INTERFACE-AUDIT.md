# CI ↔ Downstream Interface Audit

**Purpose.** Before rebuilding the Contract Intelligence layer (ingestion, agentic extraction, new UI), document every assumption that downstream functions (Calculation, Accruals, JE Hub, Period Close, Settlement, Finance Hub) make about CI's output. Anything not listed here is fair game to change. Anything listed here either (a) must be preserved by the new CI, (b) must be migrated in lock-step with the new CI, or (c) is an explicit decision to break.

**How to read this.** Each section follows the same shape:
- **Entry point** — the file/route where the function starts
- **Reads from CI** — exact tables/columns it expects
- **Shape assumptions** — invariants it would silently break on
- **Lifecycle assumptions** — temporal/state invariants
- **Writes** — what it produces (downstream-of-downstream depends on these)
- **Brittleness flags** — known fragile spots
- **Action required** — preserve / migrate / break (proposed)

---

## 1. Calculation Engine

**Entry point:** `server/services/calculationService.ts → calculateLicenseFees`
Universal path: `server/services/universalCalculationEngine.ts`
Shared matching: `server/services/ruleMatchingUtils.ts`

### Reads from CI

| Table | Columns |
|---|---|
| `contracts` | `id`, `companyId`, `effectiveStart`, `effectiveEnd`, `currency`, `counterpartyName`, `counterpartyPartnerId` |
| `contract_rules` | `id`, `ruleName`, `ruleType`, `isActive`, `approvalStatus`, `priority`, `formulaDefinition` (jsonb tree), `fieldMappings`, `volumeTiers`, `baseRate`, `productCategories` (text[]), `territories` (text[]), `customerSegments`, `channel` |
| `contract_qualifiers` | `qualifierId`, `termId`, `qualifierType`, `qualifierField`, `operator`, `qualifierValue`, `contractClauseId` |
| `sale_contract_matches` | junction — sale-to-contract associations |

### Shape assumptions
1. **Hybrid rule model.** Engine first checks `formulaDefinition`. If present → `universalFormulaEvaluator`. If absent → falls back to legacy columns (`baseRate`, `volumeTiers`). **Both shapes must keep working** until legacy is fully retired.
2. **Qualifier semantics.** `qualifierField === 'product_category'` is the dominant matcher. `not_in` qualifiers on general/catch-all rules drive exclusion. Smart Qualifier Linking (`qualifierSync.ts`) keeps `qualifierValue` matched to master data.
3. **Currency.** `contracts.currency` exists but most code paths assume USD. `parseMoneyValue` regex-extracts numeric values from suffixed strings ("$1M", "50%"). **Multi-currency would break this silently.**
4. **Specificity ordering.** When multiple rules match, `priority` int + specificity heuristics in `ruleMatchingUtils` choose the winner. Both must be preserved.
5. **Approval gate.** Only `approvalStatus = 'approved'` rules participate. `pending` rules block calc and emit a warning row. **Critical: if CI emits a different status enum, calc returns $0 silently for affected rules.**

### Lifecycle assumptions
- Rules are read at calc time with **no version-as-of-date** filter. If CI starts versioning rules, calc must learn `WHERE valid_from <= sale_date AND (valid_to IS NULL OR valid_to > sale_date)`. **~30 line change in `calculationService.ts`.**
- `transactionDate` from sales is compared to `effectiveStart/End` of contract. Range checks assume single contiguous interval per contract (no gap-and-resume).
- One sale → many contracts is supported via `sale_contract_matches`. Each match is independent.

### Writes
- `calculation_runs` (one per engine execution)
- `calculation_audit_items` (immutable 5-artifact traceability per rule application)
- `calculation_rule_results` (per-rule frozen snapshot)
- Updates `accruals` rows (creates draft accruals — see §2)

### Brittleness flags
- `applyFieldMappings` regex-parses currency/percent strings. Locale-dependent. Add a thousand-separator and it breaks.
- `formulaSource` provenance tags (`primary_formula_node`, etc.) are read by Finance UI for traceability. **New CI must emit these tags or the audit trail loses depth.**
- Legacy `productCategories` text[] and new `contract_qualifiers` rows must stay in sync. `qualifierSync.ts` does this today; if CI bypasses it, calc behavior diverges.

### Action required
| Topic | Decision needed |
|---|---|
| Rule versioning | **Decide before CI build:** does new CI emit versioned rules? If yes, add as-of-date filter to calc engine in same release. |
| Currency | **Decide before CI build:** v1 multi-currency or USD-only with rejection at ingest? Don't drift. |
| `formulaSource` provenance | **Preserve.** Required for audit. |
| `approvalStatus` enum values | **Preserve** the exact strings (`pending`, `approved`, `rejected`). |
| Hybrid rule fallback | **Preserve** the legacy column path until cutover plan is signed off. |

---

## 2. Accruals (Auto-Accrual Pipeline)

**Entry point:** `server/financeRoutes.ts → POST /api/accruals/run-calculation`
Triggered by: completion of a calculation run.

### Reads from CI
- `contracts.counterpartyName` (denormalized into `accruals.counterparty` at create time)
- `contracts.id` for FK
- Calculation outputs (not strictly CI but downstream of it)

### Reads from own domain
- `accruals` (`amount`, `status`, `contractName`, `counterparty`, `flowType`, `period`, `aiConfidence`, `netSales`, `rate`)
- `accrual_audit_trail`

### Shape assumptions
1. **Period as a string** ("2026-Q1", "2026-04"). Not a FK to a `fiscal_periods` row. **Sortability and arithmetic on periods is by string convention.**
2. **`counterparty` is denormalized text.** If CI changes the counterparty after the accrual is created, the accrual still shows the old name. (Today this is acceptable because accruals are point-in-time.)
3. **`aiConfidence` is a 0–100 integer** read by Finance Hub for risk stratification (<60 = high risk, <70 = over-accrual).
4. **`netSales` and `rate` are required for the dashboard's "completeness" check.** Missing either → flagged "Missing Data."
5. **One accrual per (contract, period, flowType).** Implicit uniqueness — no DB constraint, but downstream JE creation assumes it.

### Lifecycle assumptions
- Status flow: `draft → review → posted → (rejected → draft)`.
- Posting an accrual auto-promotes linked JE rows from `draft → pending`. Rejecting reverses.
- Accruals are **expected to be immutable once `posted`** (no DB enforcement; convention only).

### Writes
- `accruals.status`, `accruals.updatedAt`
- `accrual_audit_trail` rows
- Cascade to `journal_entries` (see §3)

### Brittleness flags
- No FK from `accruals.period` to a master period table → cannot enforce "this period is closed, refuse new accruals."
- No version pointer back to the rule that produced the accrual. If CI versions rules, **you cannot answer "which version of rule X created this accrual" without joining through `calculation_audit_items`.**
- Status flow is hand-coded in route handlers, not a state machine. Adding states means touching every transition site.

### Action required
| Topic | Decision needed |
|---|---|
| Period as FK | **Migrate** soon. Even if CI doesn't change, this is a Tier 1 cleanup. |
| Rule version pointer | If rule versioning ships, add `accruals.source_rule_version_id`. |
| Immutability enforcement | DB-level CHECK constraint or trigger on `posted` rows. |
| Counterparty snapshot | OK as-is. Document that accruals are point-in-time. |

---

## 3. Journal Entries (JE Hub)

**Entry point:** `server/financeRoutes.ts → PATCH /api/journal-entries/:id/stage`, `bulk-approve`, `erp-sync`

### Reads from CI
- Indirect — JE rows are created from accruals, which carry CI-derived fields (counterparty, contract reference, currency context).
- `journal_entries.totalAmount`, `jeStage`, `erpSyncStatus`, `balanced`
- `journal_entry_lines` — DR/CR distributions

### Shape assumptions
1. **`balanced` is a precomputed boolean** on `journal_entries`. If false, posting is refused. **No re-validation at post time** — assumes upstream calc is correct.
2. **ERP target is hardcoded "SAP"** as default in the `erp-sync` endpoint. Real multi-ERP customers will need this parameterized per workspace.
3. **Account codes assumed present and valid** on `journal_entry_lines`. No validation against a chart of accounts.
4. **Single currency per entry.** Each `journal_entry_lines.amount` is decimal with no `currency_code` sibling.

### Lifecycle assumptions
- Stages: `draft → pending → posted`. `posted` requires `balanced = true` and is treated as immutable.
- Once `erpSyncStatus = 'synced'`, the entry is locked (no DB enforcement, convention only).
- ERP sync is fire-and-forget today; failure is logged to `je_erp_sync_log` but does not auto-retry.

### Writes
- `journal_entries.jeStage`, `erpSyncStatus`
- `je_erp_sync_log`

### Brittleness flags
- No idempotency on ERP sync. A retry could double-post.
- No FX awareness — multi-currency on the upstream contract would silently produce wrong totals here.
- `balanced` is computed once and stored. If a downstream edit sneaks in (shouldn't, but possible), the flag goes stale.

### Action required
| Topic | Decision needed |
|---|---|
| Multi-currency | Tied to §1 currency decision. If yes, add `currency_code` and `fx_rate_used` to `journal_entry_lines`. |
| ERP target abstraction | Required as soon as a non-SAP customer arrives. |
| Idempotency on sync | Add `idempotency_key` to `je_erp_sync_log`. |
| Re-validation at post | Add a `balanced` recompute at the point of posting, not just creation. |

---

## 4. Period Close (Fiscal Period Locking)

**Entry point:** `server/financeRoutes.ts → POST /api/period-close/:id/approve`

### Reads from CI
- Indirect — period close inspects accruals, JEs, and contracts to identify blockers (open accruals, unposted JEs in the period).
- `period_close.status`, `periodLabel`
- `period_close_blockers.resolved`

### Shape assumptions
1. **Blocker list is hand-curated** — a `period_close_blockers` row exists per known problem. There is no "scan everything in this period and find unposted things" automatic pass. **The UI shows only what was inserted.**
2. **Period identity** is `periodLabel` (e.g., "2026-04") — same string convention as `accruals.period`. No master `fiscal_periods` table.
3. Once `period_close.status = 'approved'`, the period is conventionally closed. **No DB constraint prevents writing accruals or JEs to a closed period.**

### Lifecycle assumptions
- `open → in-progress → approved`. Reopen is supported but not well-tested.
- Approval is a single user action; no multi-approver workflow.

### Writes
- `period_close.status`, `closeDate`

### Brittleness flags
- The "is anything unposted in this period" check is run only when blockers are inserted. If a calc is run *after* close-in-progress starts, no new blocker is added → false sense of completeness.
- No audit of *what changed in the period after close*. If somehow a row sneaks in, you can't tell.

### Action required
| Topic | Decision needed |
|---|---|
| Master `fiscal_periods` table | **Migrate.** All period strings become FKs. |
| Closed-period write protection | DB-level: refuse `INSERT/UPDATE` on `accruals`/`journal_entries` where `period.status = 'approved'`. Trigger or RLS. |
| Auto-blocker detection | Background job that scans for unposted items in any non-closed period. |
| Multi-approver | When enterprise customer arrives. Defer. |

---

## 5. Settlement

**Entry point:** `server/financeRoutes.ts → GET /api/settlements`, settlement creation paths

### Reads from CI
- `contracts.counterpartyName` and `contracts.counterpartyPartnerId` to identify the payee (today, via the `counterparty` role). With T001–T007 multi-role party assignments, **this should now read `payee_party` from `contract_partner_assignments` via `partyRoleService.getPartyForRole(contractId, 'payee_party', date)`** — calc handler was updated for this; settlement endpoint may still use the legacy field. **Verify before CI rebuild.**
- `settlements.totalAmount`, `status`
- `settlement_line_items` — links to `calculation_audit_items`

### Shape assumptions
1. **Payee is a single party.** Split payments (royalty owed to two co-licensors) not modeled.
2. **No payment scheduling.** Settlement is "amount + status," not "schedule + installments."
3. **Currency assumed to match the contract.** No FX at settlement time.

### Lifecycle assumptions
- `pending → processed → paid → (failed → pending)`.
- `paid` is conventionally immutable.

### Writes
- `settlements.status`

### Brittleness flags
- If `payee_party` is not yet wired in the settlement endpoint, settlements may still go to the wrong party when payee ≠ counterparty (a real case for distributor / licensor splits).

### Action required
| Topic | Decision needed |
|---|---|
| Wire `payee_party` end-to-end | **Verify** the settlement creation path uses `getPartyForRole`. If not, fix before CI rebuild — otherwise multi-role work T001–T007 is partially unrealized. |
| Split payments | Defer. Document as not-supported. |
| FX at settlement | Tied to multi-currency decision. |

---

## 6. Finance Hub / Financial Control Center

**Entry point:** `server/financeRoutes.ts → GET /api/accruals/insights`, `GET /api/journal-entries/insights`
UI: `client/src/pages/financial-control-center.tsx`

### Reads from CI
- All accrual + JE fields (already covered in §2 and §3)
- Risk stratification depends on `accruals.aiConfidence` (CI-emitted)
- Completeness depends on `accruals.netSales` and `accruals.rate`

### Shape assumptions
1. **`aiConfidence` is a 0–100 integer.** Threshold breakpoints (60, 70) are hardcoded. **If CI changes confidence to a 0–1 float, the dashboard turns everything red.**
2. **All amounts in a single currency** for aggregate cards. No FX-normalized totals.
3. **Time-series charts assume contiguous monthly buckets** read from `accruals.period`. Gaps render badly.

### Lifecycle assumptions
- Dashboard is read-only. No state mutation. Polls; not event-driven.

### Writes
- None (read-only).

### Brittleness flags
- If CI begins emitting accruals without `aiConfidence` (e.g., manual or human-validated rows), risk cards show NaN or 0% misleadingly.
- Polling rate is fixed; no awareness of "data just changed, refresh now."

### Action required
| Topic | Decision needed |
|---|---|
| `aiConfidence` scale | **Preserve 0–100 integer** OR coordinate a UI cutover when CI changes. |
| Multi-currency aggregation | Tied to currency decision (§1). |
| Event-driven refresh | If event log is built (Tier 1 #2), wire dashboard to subscribe. Big UX win, low effort. |

---

## Cross-Cutting Decisions That Block CI Build

These are not per-function — they affect **all six** downstream functions. Decide before code is written.

### D1. Rule versioning (bitemporal)
- **If yes:** every read of `contract_rules` in calc/accrual/JE/Settlement needs an as-of-date filter. ~5 files. ~50 lines total.
- **If no:** new CI must keep mutating rules in place (acceptable for v1, technical debt for v2).
- **Recommendation:** YES. Cheap now, painful later. Domain demands it (auditors will ask "what was the rule on March 14").

### D2. Multi-currency
- **If yes:** add `currency_code` to every `$` column on `accruals`, `journal_entry_lines`, `settlements`. Add `fx_rate_used`. Add a per-period FX rate table. Calc engine learns to normalize.
- **If no:** new CI **must reject non-USD contracts at ingestion**. Be explicit; do not let multi-currency contracts in and pretend they're USD.
- **Recommendation:** Pick "no, with explicit rejection" for CI v1 launch. Add multi-currency in CI v1.5 with all downstream changes shipped together. Don't drift.

### D3. Event log
- **If yes:** every CI write also writes to `events` table. Downstream subscribes (Finance Hub refresh, Watchdog escalation, agent activity stream all powered by this).
- **If no:** keep polling everywhere. Agent activity stream becomes much harder to build.
- **Recommendation:** YES. ~1 table, ~50 lines of helper. Foundational for the agentic framework.

### D4. `workspace_id` everywhere
- Not strictly a CI ↔ downstream contract issue, but it touches every table involved here. Adding it pre-customer is a weekend; adding it later is a quarter.
- **Recommendation:** YES. Do it in lockstep with whatever schema changes CI requires.

### D5. `formulaSource` / provenance preservation
- Calc engine currently emits provenance tags consumed by Finance UI (audit trail depth). New CI must keep emitting them or downgrade the audit detail.
- **Recommendation:** Preserve. Add to acceptance criteria for CI v1.

---

## Summary Table — What Survives, What Migrates, What Breaks

| Item | Action | Owner | Window |
|---|---|---|---|
| Hybrid rule model (formula + legacy fallback) | **Preserve** | CI team | Through CI v1 |
| `approvalStatus` enum strings | **Preserve** | CI team | Permanent |
| `formulaSource` provenance tags | **Preserve** | CI team | Permanent |
| `aiConfidence` 0–100 scale | **Preserve** | CI team | Permanent |
| Status flows (`draft→review→posted`, etc.) | **Preserve** | CI team | Through CI v1 |
| Rule versioning (as-of-date) | **Migrate together** | CI + downstream | CI v1 |
| Period as FK to `fiscal_periods` | **Migrate** | Platform | Pre-CI build |
| `payee_party` wiring in settlement | **Verify & fix** | Platform | Pre-CI build |
| `workspace_id` on every table | **Migrate** | Platform | Pre-CI build |
| Event log (`events` table) | **Migrate** | Platform | Pre-CI build |
| Multi-currency | **Defer with rejection at ingest** | CI team | CI v1.5 |
| ERP target abstraction (non-SAP) | **Defer** | Platform | First non-SAP customer |
| Closed-period write protection | **Migrate** | Platform | Pre-CI build |
| Idempotency on ERP sync | **Defer** | Platform | Pre-first-customer |
| Split payments | **Document as not-supported** | Product | Defer |

---

## What this audit deliberately does NOT cover

- UI redesigns of any downstream page (Calculation Dashboard, Accruals page, JE Hub, Period Close Workspace, Settlement views). Those are deferred per the agreed plan — review them after CI ships.
- Net-new downstream features (e.g., bank-feed reconciliation, payment processor integration, advanced FX hedging). Out of scope.
- Reporting / analytics layer. Reads from the same tables; same assumptions apply transitively.

---

*Owners: Platform (schema, infra-level changes) and CI team (extraction/UI/agentic layer). Review weekly during CI build until D1–D5 are locked.*
