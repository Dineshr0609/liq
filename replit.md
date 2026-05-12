# Overview

License IQ Research Platform is an AI-native SaaS web application designed for intelligent contract management and analysis. It automates contract processing, risk assessment, and compliance, offering features like payment calculations, dynamic rule engines, and a RAG-powered Q&A system. The platform aims to reduce manual effort, provide deep insights into complex licensing agreements, and ensure revenue assurance. The business vision is to become the leading solution for AI-driven contract intelligence, empowering businesses to optimize licensing operations and unlock new market potential.

# User Preferences

Preferred communication style: Simple, everyday language.

**Terminology Standards:**
- Use "Contract Fee" (NOT "Royalty" or "License Fee") throughout the application — the generic term covers all contract fee types
- Use "liQ AI" (NOT "Contract Q&A") for the RAG-powered assistant - Note: lowercase 'l', lowercase 'i', uppercase 'Q'
- Internal code variables (totalRoyalty, calculatedRoyalty, royaltyAmount, etc.) and DB column names (total_royalty, royalty_rule_id) retain old names for backward compatibility
- The contract type code `royalty_license` is an enum value and stays as-is

# System Architecture

## UI/UX Decisions
The platform features a modern, responsive UI built with React, TailwindCSS, and shadcn/ui, supporting multi-theme capabilities with 12 color schemes, dark mode, and USA date formatting (MM-DD-YYYY). Key pages include a rules management page with dynamic category tabs, stats cards, a Key Contract Terms summary, and insight panels. A 3-tab editor (General, Calculation, History) is used for rule configuration, including Qualifier Condition Groups. Navigation is structured into 8 main groups for usability. Dashboards for Financial Control Center, Accrual Management, Journal Entry Hub, and Period Close Workspace are also included.

The Entity Data Browser incorporates enterprise-grade form validation, including mandatory field indicators, strict text validation, date sequence validation, and multi-select fields. User-friendly delete confirmations display record names instead of UUIDs. All validations are enforced on both the frontend and backend.

## Technical Implementations
The frontend uses React, TypeScript, Vite, Wouter, TanStack Query, React Hook Form, and Zod. The backend is an Express.js and TypeScript RESTful API. PostgreSQL with Drizzle ORM and pgvector serves as the primary database.

The system features a dynamic contract processing system leveraging a knowledge graph database schema for AI-powered extraction and human-in-the-loop validation. This includes consolidated AI calls, defensive numeric validation, and flexible territory matching. The `contract_master` table has been consolidated into `contracts`, and a new `calculation_rule_results` table stores per-rule frozen snapshots for traceability.

The contract processing pipeline uses a "Fast Path" for immediate rule extraction and deferred background analysis. PDF text extraction employs a 4-tier fallback system. A "never miss a term" system (`termCoverageService.ts`) provides contract-type-specific term checklists and section-aware extraction. A multi-layer AI prompt system (35 prompts across 9 layers) is managed via `aiPromptRegistry.ts`, allowing custom overrides. Prompt resolution follows a 5-level cascade: **Custom Override → Subtype Prompt (`subtype_prompts`) → Flow Type Prompt (`flow_type_prompts`) → Contract Type Prompt → Built-in Default**. Flow type and subtype starter prompts are editable via the System Settings → AI Prompt Registry tab. A `ruleTemplateService.ts` implements contract-type-specific rule slot templates to guide AI extraction. The AI extraction system (`groqService.ts`) is contract-type-aware, dynamically adjusting prompts.

A Smart Qualifier Linking system automatically matches AI-extracted product names to master data using a multi-layer fuzzy matcher. General/catch-all rules receive `not_in` exclusion qualifiers, while product-specific rules get `in` inclusion qualifiers linked to matched master data. Qualifier `notes` fields indicate linking status.

A `milestone_tiered` rule type supports cumulative threshold-based tiers with retroactive calculation capabilities. The fee calculation engine supports a **one sale → many contracts** architecture via the `sale_contract_matches` junction table.

**Multi-Role Party Assignments** are managed through `contract_partner_assignments`, extended with `partyKind`, `companyId`, `partyRole` enum, and `isPrimary`, categorizing roles into Financial and Operational. Contract-type-specific required-role checklists are managed via `contract_type_definitions.partyRoleSlots`. A shared `ruleMatchingUtils.ts` module provides a single source of truth for all rule-to-sale matching logic.

The Data Ingestion page stores uploaded dataset metadata in `uploaded_datasets`. A Smart Sales-to-Contract Matching system (`server/services/salesContractMatcher.ts`) automatically matches sales to contracts. The system includes an auto-accrual pipeline that creates accrual records, audit trails, and draft journal entries upon calculation completion. A Period Close Master Data system manages fiscal periods.

**Accrual → Obligation Promotion** (`server/services/accrualPromotionService.ts`): when an accrual transitions to `posted`, the PATCH `/api/accruals/:id` route auto-creates a claim/obligation. Direction is derived from `flow_types.cash_direction`. Initial status follows the contract's `obligation_accrual_basis`. OEM (`cash_direction='derived'`) throws `OEM_DIRECTION_REQUIRED` (HTTP 422). Both the Accrual detail panel and the Claims workspace surface cross-links between an accrual and its promoted obligation.

**Settlement Document Type Matrix** (Task 69, `server/services/intakeAgentService.ts#documentTypeForClaim`): The mapping `(claim_type, direction) → document_type` is now a 4-level cascade resolved per claim: **`contract.settlementPolicies.documentTypeMatrix` → `flow_types.documentTypeOverrides` → `companySettings.settlementPolicies.documentTypeMatrix` → `BUILT_IN_DOCUMENT_TYPE_MATRIX`** (defined in `shared/schema.ts`). Configuration UI lives in **Enterprise Configuration → Settlement & Payment** and on each contract's **Payments** tab.

**Settlement Auto-Close on Credit-Memo Post** (Apr 2026): Closed a long-standing reconciliation gap where a `fully_matched` ($0 variance) settlement would sit in "Matched — Pending Approval" forever after its credit memo was posted to GL. Previously the only path that flipped `settlements.settlementStatus → 'posted'` was `clearSettlementResidual`, which only fires when the variance is non-zero. **Fix**: `transitionFinanceDocument` in `server/services/financeStateMachine.ts` now performs a side-effect on every `→ posted` transition — it looks up the inbound claim via `inboundClaims.linkedDocumentId === doc.id`, then the settlement via `settlements.claimId === claim.id`, and if `matchStatus === 'fully_matched' && settlementStatus !== 'posted'`, it sets `settlementStatus='posted'`, `postedAmount=accrualAmount`, and stamps the JE id. Wrapped in try/catch so a settlement-side failure can never roll back the document transition. **UI cleanup** (`client/src/pages/settlement-workspace.tsx`): once the inbound claim has `linkedDocumentId` set, the orange "Post Credit Memo" button is replaced with an outlined "Finish GL Post →" deep-link to `/invoices-memos?docId=<id>&type=credit_memo`. The "draft" button label was also corrected from "Post Credit Memo" to "Draft Credit Memo" to match what the action actually does (the endpoint is idempotent on `linked_document_id` and only mints a draft).

**Liability Aging (formerly Outstanding Obligations)** (Apr 2026): Repositioned `/outstanding-obligations` as a read-mostly aging view to remove confusion with the Claims and Invoices pages. Renamed the page header / MainLayout title / Financial Control Center tile to "Liability Aging" (route stays the same to preserve deep-links). Added a header explainer documenting that "Outstanding" is the sum of `outstanding_amount` for obligations in `accrued|claimable|claimed|approved` status — ERP payments do **not** auto-decrement this; an obligation only drops out via the `mark_paid` (or `expired`) state transition, which today is not auto-triggered by Oracle AP payments. Aging buckets compare `planned_release_date` to today (NULL → "Current"). Inline per-row Approve / Mark-paid buttons were removed and replaced with deep-link buttons "View claim →" (→ `/claims-workspace`) and "Pay in AP →" (→ `/invoices-memos`); the bulk-action menu was trimmed to just `Expire` / `Reverse`. Detail / Claim / Expire and the Expiry Sweep remain in place. Files: `client/src/pages/outstanding-obligations.tsx`, `client/src/pages/financial-control-center.tsx`.

**Period Close Subledger Workspace — Phase 1a Schema** (Apr 2026): Foundational data model for the new Period Close subledger workspace shipping as Variant D (Co-Pilot, default) + Variant C (Worksheet, power-user toggle). Spec lives in `docs/period-close-data-model.md` (with locked decisions in §9). Three existing tables in the `period_close` family were extended in place: `period_close` got SLA + sign-off chain (`cutoff_at`, `close_day`, `close_target_day`, `sla_state`, `prepared_by/at`, `reviewed_by/at`, `locked_by/at`), `period_close_blockers` got assignment + AI provenance (`assignee_user_id`, `assigned_at`, `proposed_by_ai`, `proposed_decision_id`, `related_obligation_ids[]`, `resolved_by/at`, `resolution_note`), and `period_close_audit_trail` got actor + back-refs (`actor_type`, `user_id`, `source_decision_id`, `source_batch_operation_id`, `metadata`). Six new tables were added at the end of `shared/schema.ts`: `close_chat_threads` (Co-Pilot conversation containers, always private to user), `close_decisions` (AI-proposed actions awaiting human approval; 12h `expires_at` default via `now() + interval '12 hours'`; lazy supersession via `superseded_at/reason`; allow-listed `action_type`), `close_chat_messages` (append-only chat turns + Anthropic-style content blocks; per-message `model_provider/name` so a Claude→OpenAI fallback mid-thread is auditable), `pinned_kpis` (saved AI-generated custom KPIs; `scope='user'` default with explicit "Share with team" promotion to `company`; `query_plan` jsonb required for pin), `close_saved_views` (Worksheet presets + cross-mode handoff state with `kind ∈ saved|handoff|autosave`), and `close_batch_operations` (idempotency receipts keyed by `(company_id, operation_type, idempotency_key)`). Forward-references are stored as plain `varchar` (no FK) where they would create declaration cycles (`close_decisions.batch_operation_id`, `close_chat_messages.decision_id` — wait, this one IS a FK; the cycle-breakers are decisions↔batch and blockers↔decisions). Schema was applied to Neon as additive idempotent DDL because drizzle-kit's interactive rename prompt can't be bypassed via piped stdin in this sandbox; the SQL mirrors the Drizzle source exactly. Phase 1b (storage methods + composite obligations grid endpoint + insights endpoint + composite indexes on `obligations(company_id, funding_period)` and `(settlements|inbound_claims|finance_documents)(contract_id, period)`) is next.

**Period Close Subledger Workspace — Unpin KPI button** (Apr 2026): The Pinned KPIs panel in both `CopilotView.tsx` (large dashboard panel, right column) and `WorksheetView.tsx` (compact panel inside the Ask LedgerIQ tile) now has a hover-to-reveal X button on each pinned card. Both views got a new `unpinMut` mutation calling `DELETE /api/finance/pinned-kpis/:id` (endpoint already existed from Phase 2 — was just unwired in the UI), then invalidating `["/api/period-close", periodId, "insights"]`. Each card uses `group relative` + `opacity-0 group-hover:opacity-100 focus:opacity-100` so the X stays out of the way until the user hovers, surfaces a `window.confirm` prompt with the KPI label so an accidental click is recoverable, shows a "Pin removed" toast on success, and disables itself while the request is in flight. Test IDs: `button-unpin-{pinId}`. The backend already enforces ownership (returns 403 if the user tries to unpin another user's pin), so there's no client-side scope check needed.

**Period Close Subledger Workspace — Worksheet FLOW chips wired to real catalog** (Apr 2026): The Worksheet's FLOW filter chips were hardcoded to ["Rebates", "Royalties", "Commissions", "Subscriptions"] with codes "REBATES"/"ROYALTIES"/etc, but the backend obligations endpoint filters on `c.flow_type_code = $1` against the canonical 6-flow catalog (CRP, VRP, RLA, SUB, RSM, OEM). Result: clicking any chip silently returned zero rows. Fixed in `client/src/components/period-close/WorksheetView.tsx` by adding a `useQuery({ queryKey: ['/api/pipeline/flow-types'], staleTime: 5min })` (same pattern as `contracts-list-new.tsx` etc) and building `flowChips` via `useMemo`: filters to `isActive !== false`, prepends an "All flows" chip, and uses `name` as label and `code` as filter value. Also replaced the stale `FLOW_COLOR` map (keyed by REBATES/ROYALTIES/COMMISSIONS/SUBSCRIPTIONS) with one keyed by the real codes (VRP=orange, CRP=amber, RLA=purple, SUB=teal, RSM=blue, OEM=emerald). The progress-bar colors in the "Active Contracts · by flow" insights tile now match the chip colors. Test IDs unchanged (`chip-flow-{code}` already used the dynamic code, so e.g. `chip-flow-vrp` is now reachable). Typecheck still 1517/1523. Caught after the user pointed out the chips didn't match real flows; no other period-close file had the stale vocab.

**Period Close Subledger Workspace — Worksheet row deep-links** (Apr 2026): Every cell in the Worksheet grid is now a click-through to its underlying detail page with row-level focus/scroll. Backend (`server/financeRoutes.ts`): the four LATERAL subqueries in `GET /api/period-close/:id/obligations` now also project `s.id`/`ic.id`/`d.id`/`fd.id` and the outer SELECT surfaces `linkedSettlementId`, `linkedClaimId`, `linkedDeductionId`, `linkedFinanceDocumentId`, plus `linkedJeCode` (= `je.je_id` — the human-readable JE-XXXX, since the JE Hub list rows are keyed by `jeId`, not the UUID). Frontend (`client/src/components/period-close/WorksheetView.tsx`): the eight column cells use `wouter`'s `<Link>` with subtle dotted-underline hover styling — Obligation ID → `/outstanding-obligations?focus=<id>`, Contract/Partner → `/contracts/<contractId>`, Accrual → `/accrual-management?focus=<id>`, JE → `/journal-entry-hub?focus=<jeCode>`, Settle → `/settlement-workspace?focus=<settlementId>`, Claim → `/claims-workspace?focus=<claimId>`, Dedn → `/deductions-workspace?focus=<deductionId>` (or contract filter fallback), Invoice → `/invoices-memos?focus=<docId>`. Cells with no value (`—`) are NOT linked. Each link has a `title` tooltip and `data-testid={link-<column>-<obligationId>}`. Workspaces consume `?focus=`: **Settlement** (`client/src/pages/settlement-workspace.tsx`) — new `useEffect` reads `?focus=`, switches to the settlement's flow-type tab, sets `selectedId`, scrolls to `[data-testid="settlement-item-<id>"]`, strips the param. **JE Hub** (`client/src/pages/journal-entry-hub.tsx`) — `useEffect` after entries query reads `?focus=` (matches against `je.jeId`), sets `selectedJE`, scrolls to `[data-testid="row-je-<jeId>"]`. **Claims** (`client/src/pages/claims-workspace.tsx`) — extended existing `?claimId=` handler to also accept `?focus=` (period-close uses `focus` everywhere for consistency); strips both params and scrolls to `[data-testid="queue-item-<id>"]` (the QueueGroup component used by `WorkspaceShell`). **Invoices & Memos** (`client/src/pages/invoices-memos.tsx`) — extended existing `?docId=` handler the same way. **Deductions** (`client/src/pages/deductions-workspace.tsx`) — extended existing `?deductionId=`/`?contractId=` handler to also accept `?focus=`; scrolls to `[data-testid="queue-item-<id>"]`. All scroll calls are deferred 200ms via `setTimeout` to wait for the list render. Verified end-to-end via curl on the Apr 2026 period: response now contains `linkedJeCode: "VRPCLM-DA529747-MOKHXOZG"`, `linkedSettlementId`, `linkedClaimId`, `linkedFinanceDocumentId` populated for the rows that have them. Typecheck below baseline at 1517/1523. Phase 4c (AI proposer wiring LLM tool-use into the chat-thread `/turn` endpoint to create `close_decisions`) is the next major piece.

**Period Close Subledger Workspace — Live Subledger State deep-links** (Apr 2026): The 7 rows of the Co-Pilot Live Subledger State panel (`client/src/components/period-close/CopilotView.tsx`) are now clickable buttons. Each row routes to either a pre-filtered Worksheet view or an external workspace: Obligations → worksheet (no filter), Accruals → worksheet filtered to `Pending`, JEs Posted → worksheet, Settlements → worksheet filtered to `Settled`, Claims → `/claims-workspace`, Deductions → `/deductions-workspace`, Invoices → `/invoices-memos`. External destinations get a small `↗` glyph next to the label. The workspace page (`client/src/pages/period-close-workspace.tsx`) holds a `worksheetInitialStatus` one-shot state; `onSwitchToWorksheet` accepts `(opts?: {status?: string})` and sets it before flipping the `view` to `worksheet`. `WorksheetView` consumes `initialStatus` via `useEffect` on first render then notifies the parent via `onInitialStatusConsumed` so a manual chip toggle later isn't overridden. Hover treatment: orange tint + colored icon. Test IDs: `link-side-state-<key>`.

**Period Close Subledger Workspace — Phase 4b AI Decisions Queue** (Apr 2026): Persistent AI-proposed action queue per spec §2.3, §5.5, §9. **Action exec layer** (`server/services/closeActions.ts`, ~399 LOC): six reusable executors (`execPostJEs`, `execSettle`, `execResolveClaims`, `execApplyDeductions`, `execReverseAccruals`, `execFlagBlocker`) lift the body of each Phase 1c batch endpoint into a function with signature `(payload, ctx, decisionId) → result`. The five existing `/api/finance/batch/*` endpoints in `financeRoutes.ts` were refactored to delegate to these execs (no behavior change, ~150 LOC removed). One dispatcher `execBatchAction(actionType, payload, ctx, decisionId)` plus a `BATCH_OP_BY_ACTION` map and `NON_BATCH_ACTIONS` set route an action type to either a `runIdempotentBatch` call (for `post_jes`/`settle_obligations`/`resolve_claims`/`apply_deductions`/`reverse_accruals`) or an inline path (for `flag_blocker`/`hold_for_review`/`request_info` which don't produce per-row receipts). Caught during smoke-test: `release_obligations` is in the `BatchOpType` allowlist but has no exec yet — dispatcher throws an explicit `unimplemented exec` error rather than silently mis-routing. **Five decision endpoints** in `financeRoutes.ts` (after the chat-thread `:id/turn` POST): `GET /api/finance/period/:id/decisions?status=pending|all` (calls `markExpiredDecisions(periodId)` first which flips any `pending` row whose `expiresAt < now()` to `expired` — single UPDATE, no N+1; default filter is `pending` so the queue UI never sees expired rows), `GET /api/finance/decisions/:id` (also sweeps before reading), `POST /api/finance/decisions` (manual create — for testing and as the eventual landing path for the LLM tool-use proposer; body validates `actionType` against `ALLOWED_DECISION_ACTIONS` 9-type allowlist and stamps `expiresAt = now + 12h` per locked decision §9), `POST /api/finance/decisions/:id/approve`, `POST /api/finance/decisions/:id/reject`. **Approve flow** is the heart of the feature: (1) reload decision → 410 `DECISION_EXPIRED` if `status='expired'` or expiry passed, 409 `DECISION_NOT_PENDING` if not pending, (2) **lazy supersession check** — for action types that act on obligations, query `obligations.updated_at` for the affected IDs; if any row's `updated_at > decision.created_at`, mark the decision `superseded` and return 409 `DECISION_SUPERSEDED` with the offending obligation IDs (this is the "no proposed action goes stale silently" guarantee from §9 #4 without needing background sweeps), (3) dispatch via `execBatchAction` — for batch actions the decision id IS the `idempotencyKey` so a second approve click is a guaranteed no-op replay, for non-batch actions the inline path runs directly, (4) atomically stamp `status='executed' | 'failed'`, `executedBy`, `executedAt`, and `executionResult` jsonb (full receipt: batchOperationId, succeeded/failed counts, OR the inline result like `{blockerId}`), (5) return `{ok, decision, executed, batchStatus?, result, inline?}`. Reject requires `reason` (≥1 char, 400 if missing/empty) and stamps `status='rejected'`, `rejectedBy`, `rejectedAt`, `rejectionReason`; never executes the action. **Verified end-to-end via curl** (period `f0619971...`, accountant `b8461af3...`, obligation `614c6755...`): create → list (pending=1) → approve (200 ok+executed+batchStatus=succeeded with batchOperationId) → re-approve same id (409 not pending) → create another → simulate supersession by `UPDATE obligations SET updated_at=now()` after decision creation → approve returns 409 `DECISION_SUPERSEDED` with affected ids, decision row flipped to `superseded` → reject without reason (400) → reject with reason (200, status=rejected) → expiry path (insert with `expires_at = now() - 1h`, list call returns 0 rows and the row is now `expired` in DB) → flag_blocker happy path (approve writes a `period_close_blockers` row with `proposed_by_ai=true`, `proposed_decision_id=<decision.id>`, severity respected). **Frontend wiring** in `CopilotView.tsx`: replaced the blockers-derived `decisionQueue` stand-in with a real `useQuery({ queryKey: ['/api/finance/period', periodId, 'decisions'], refetchInterval: 30_000 })` that polls every 30s so the badge count and TTL strings stay accurate without manual refresh; the `pendingDecisions.length` drives the orange "N decisions in queue" badge in the workspace header. The Decision Queue panel now renders one card per decision with: action-type icon (BookOpen/Handshake/Inbox/ArrowLeftRight/RefreshCw/Flag/Clock/MessageSquare), action label, risk-level chip (color-tiered: requires_controller=red, high=orange, medium=amber), TTL badge ("3h 42m" / "12m" / "expired"), rationale (line-clamp-3), affected-obligation count, proposer name, and inline Approve/Reject buttons. Approve mutation surfaces `batchStatus` + succeeded/failed counts in the toast and invalidates obligations + insights query keys so the grid refreshes immediately after a posted-JE batch; reject prompts for reason via `window.prompt` (cancelling aborts). When `pendingDecisions.length === 0`, the panel falls back to surfacing up to 4 open blockers under an "Open blockers" sub-header so the panel still communicates open work pre-AI-proposer. Every interactive element carries `data-testid`s: `panel-decision-queue`, `text-decision-count`, `decision-{id}`, `text-decision-action-{id}`, `badge-risk-{id}`, `text-ttl-{id}`, `text-rationale-{id}`, `button-approve-{id}`, `button-reject-{id}`, `blocker-{id}`. **Bug fixed during build**: `execFlagBlocker` initially used `periodCloseId` and `category` columns from a stale memory of the schema; correct columns are `periodId` and `aiSuggestion` (no `category` column on `period_close_blockers`). Typecheck below baseline at 1517/1523 (-4 TS2353, -2 TS2769 in `financeRoutes.ts` from the batch-endpoint refactor). Phase 4c+ candidates remaining: **AI proposer** (LLM tool-use call inside the chat-thread `:id/turn` path that creates `close_decisions` rows when the model judges the user's question implies an action — would unblock the queue from being purely manual-create), batch-operation receipt detail view (`close_batch_operations` rows already capture everything needed), saved Worksheet views via `close_saved_views`.

**Period Close Subledger Workspace — Phase 4a Chat Persistence + Worksheet grid fix** (Apr 2026): The Co-Pilot conversation now persists across reloads and tab-switches via the `close_chat_threads` + `close_chat_messages` tables seeded in Phase 1a. Five new endpoints under `/api/finance/chat-threads`: GET (list user's threads for a period, sorted `lastMessageAt DESC`, default `status=active` with `?status=archived` filter), POST (create — body `{periodId, title?, scopeFilter?}` — auto-titles to `"<periodLabel> close session"` if no title given), GET `:id` (returns `{thread, messages}` in a single round-trip; messages ordered oldest-first to match chat-render order), PATCH `:id` (rename + archive — body `{title?, status?}`), and POST `:id/turn` which is the Co-Pilot's only write path: it persists the user message **first** (so even if the LLM call crashes the user's question survives in the thread), calls the existing `askLedgerIQ` service with the same period snapshot the stateless `/kpi-ask` endpoint builds, then persists the full `AskResult` as `content: [{type:'ask_result', result:{...}}]` so a reload re-renders the same headline number, dimensions, and pin button without touching the LLM. The assistant message captures `modelProvider`/`modelName` per-row, satisfying the locked decision §9 #3 audit requirement (Claude→OpenAI fallback mid-thread is auditable per-message). Auto-titling: the first user prompt overwrites the placeholder title so the History panel shows meaningful entries; subsequent prompts don't re-title. **Authorization model**: every thread endpoint scopes by `userId = req.user.id` and returns 404 (not 403) on cross-user access — verified end-to-end with two different logins. **Failure path**: when `askLedgerIQ` throws, the assistant message is still persisted as `content: [{type:'error', message: ...}]` and the thread's `lastMessageAt` is bumped, then the 500 is surfaced to the caller — so a thread can never end up with an unanswered user message. **Frontend**: `CopilotView.tsx` swaps its local `useState<ChatTurn[]>` for three queries (thread list, active thread detail) and one `turnMut` mutation, with an `useEffect` that auto-selects the most recent thread on mount or creates one if none exist. New chat header controls: "New chat" (orange, calls `createThreadMut`), "History (n)" toggle that drops down a thread list as a 32-px scroll panel — clicking a thread sets `activeThreadId` and the detail query refetches. The greeting bubble is rendered client-side (kept out of the persisted append-only log per locked decision: only user/assistant turns are stored). The "LedgerIQ is thinking" indicator is now driven by `turnMut.isPending`. All new chat-thread interactive elements carry `data-testid`s: `button-new-chat`, `button-toggle-history`, `panel-thread-history`, `thread-{id}`, `text-thread-title`, `text-thread-turns`, `indicator-loading-thread`. **Worksheet grid bug fix (caught while smoke-testing)**: the obligations grid query in `GET /api/period-close/:id/obligations` was amplifying rows when a single contract+period had multiple settlements, claims, deductions, or finance documents (4 plain LEFT JOINs → Cartesian product). One Apr 2026 obligation surfaced twice in the grid, triggering a "duplicate React key" warning and a cascading "Invalid hook call" warning where the reconciler re-mounted the wrong `<tr>` subtree. Fixed by converting the four amplifying joins to `LEFT JOIN LATERAL (... ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1)` subqueries, projecting the most-recent representative row per obligation. End-to-end check after fix: total=5, unique=5, both warnings gone from the browser console. Typecheck baseline still 1523/1523. Phase 4b candidates remaining: AI-proposed `close_decisions` queue endpoints + 12h expiry + lazy supersession check; batch action receipt detail view (the `close_batch_operations` row already stores everything needed); saved Worksheet views (`close_saved_views` table is in place).

**Period Close Subledger Workspace — Phase 3 UI Graduation** (Apr 2026): Replaced the existing 745-line `client/src/pages/period-close-workspace.tsx` (data-tile dashboard) with a Variant D (Co-Pilot, default) + Variant C (Worksheet, toggle) workspace that surfaces every Phase 1b/1c/1d/2 endpoint shipped so far. Page is now an orchestrator that owns: the period query (`/api/period-close/latest`), a `view` state ('copilot' | 'worksheet'), the global lock button (calls `POST /api/period-close/:id/approve`, surfaces 409 `CRITICAL_BLOCKERS_PRESENT` errors as toasts, button is disabled when `criticalOpen > 0` or `status === 'approved'`), and the view toggle in the MainLayout `actions` slot — both pieces are global to the workspace regardless of which view is active. Two new components: (a) `client/src/components/period-close/WorksheetView.tsx` — composite obligations grid wired to `/api/period-close/:id/obligations` (filters: flow CSV via the locked allowlist [REBATES, ROYALTIES, COMMISSIONS, SUBSCRIPTIONS], status filter chips that map to backend `status IN (...)` enum sets, free-text search across partner/contract name/obligation ID, all on the composite indexes added in Phase 1b), 3-tile insights strip from `/api/period-close/:id/insights` (Active-Contracts-by-Flow with progress bars colored per-flow + share %, Period-vs-Period sparkline showing 12-month accrual history with a `max` derived from the actual data, Ask-LedgerIQ tile that POSTs to `/api/finance/kpi-ask` then offers a one-click `Pin` button which POSTs to `/api/finance/kpi-ask/:resultId/pin` and re-renders the Pinned panel), batch action bar that appears when rows are selected (Post JEs / Approve settlements / Resolve claims) — each click generates a fresh UUID `Idempotency-Key` and stamps `X-Initiated-Via: worksheet`; toast surfaces `succeeded/failed` counts from `resultSummary` and re-runs invalidate `/api/period-close` query keys so the grid refreshes, plus a per-blocker `Resolve →` button (PATCH `/api/period-close/blockers/:id/resolve`), and a 4-gate Readiness panel (Accruals 100% calc'd / All JEs posted / Critical blockers cleared / Audit trail captured) computed client-side from the loaded grid + blockers; (b) `client/src/components/period-close/CopilotView.tsx` — chat-led layout with three columns: LEFT = live subledger state derived from insights tile data + the sign-off chain (Prepare → Review → Lock with click-to-stamp buttons calling `mark-prepared` / `mark-reviewed`), CENTER = conversation thread (locally-state'd; chat persistence is Phase 4) with a composer that POSTs to `/api/finance/kpi-ask` and renders each AI turn with the natural-language answer, a "Computed value" callout when the LLM produced a query plan and the server pre-evaluated it (showing the headline number + dimension breakdown), citations count, and `Pin to dashboard` button (disabled with the rejection reason inline when `canPin=false`), RIGHT = decision queue derived from active blockers (severity → urgent flag) + Pinned KPIs panel + period snapshot. Status-enum → 4-state visual signal mapping is centralized as helper functions (`accrualSignal`/`jeSignal`/`settleSignal`/`claimSignal`/`dedSignal`/`invoiceSignal`) so each column knows its own vocabulary without scattering enum strings across the JSX. Visual fidelity preserved from mockups: `bg-[hsl(43,26%,95%)]` warm cream background (with `dark:bg-gray-950` companion), orange-600 primary, `text-[10px]` uppercase labels with `tracking-wider`, sticky-left checkbox + obligation-ID columns in the table, gradient orange tile for Ask LedgerIQ, gradient orange/white avatars for the Co-Pilot bot. Every interactive element carries a `data-testid` (worksheet has `chip-flow-rebates`, `button-batch-post-jes`, `row-obligation-{id}`, etc; copilot has `button-send`, `button-pin-{i}`, `signoff-prepare`, `signoff-review`, `view-toggle`, `button-lock-period`, …). Verified: HMR picked up changes, `/api/period-close/latest` + `/api/period-close/:id/insights` both returned 200 in browser session, typecheck baseline held at 1523/1523. Mockups in `artifacts/mockup-sandbox/src/components/mockups/subledger-close/{Worksheet,Copilot}.tsx` are kept on the canvas for reference. Phase 4 (still pending): persisted chat threads via `close_chat_threads`/`close_chat_messages`, AI-proposed `close_decisions` with 12h expiry, batch action receipt detail view, saved Worksheet views via `close_saved_views`.

**Period Close Subledger Workspace — Phase 2 Ask LedgerIQ** (Apr 2026): Two-tier KPI ask + pin flow per spec §5.4 and locked decision §9 #5. New service `server/services/kpiAsk.ts` exposes (a) `askLedgerIQ({ prompt, periodId, periodLabel, contextSnapshot, companyId })` — returns `{ resultId, naturalLanguageAnswer, citedObligationIds[], suggestedChart, severity, queryPlan, canPin, pinRejectionReason?, modelProvider, modelName, evaluatedResult? }`, (b) `getCachedAskResult(resultId)` — 30-min in-memory cache with lazy cleanup at 1k entries, (c) `validateQueryPlan(plan)` — pure function that throws `QueryPlanValidationError` against a strict allowlist (aggregation ∈ {sum,count,avg,count_distinct}; metric ∈ {amount,outstanding_amount} unless count; dimensions ⊆ {flow_type_code,status,kind,partner_name,currency}; filter fields/ops mirrored; comparison ∈ {mom,yoy,ytd,null}), (d) `evaluateQueryPlan(plan, periodLabel, companyId, priorPeriodLabel?)` — deterministic SQL builder that runs the plan against `obligations o LEFT JOIN contracts c` (no LLM), always scoping to `o.funding_period = :periodLabel` from server context (LLM never controls which period). All field names come from closed allowlists so direct interpolation is safe; values are always parameterized via Drizzle's tagged `sql`. **Provider chain** (locked decision §9 #3): Claude Sonnet 4.5 primary; `shouldFallback()` triggers OpenAI gpt-4o on Anthropic 5xx / 429 / connection errors only (not 4xx auth/validation). Response always stamps `modelProvider/modelName` so the chat UI can render "Answered by GPT-4o (Claude unavailable)". Both providers receive the same JSON-only system prompt; OpenAI gets `response_format: { type: 'json_object' }`. Four endpoints in `server/financeRoutes.ts` (right before the batch helper section): `POST /api/finance/kpi-ask` (validates prompt ≤1000 chars + periodId, builds a compact snapshot containing tile data + top 30 obligations by amount so the LLM can cite real IDs without us shipping the full grid, calls `askLedgerIQ`, returns the result; pre-evaluates the queryPlan when present so chat tile renders the actual number alongside the prose without a second roundtrip), `POST /api/finance/kpi-ask/:resultId/pin` (looks up cache; returns 404 `ASK_RESULT_EXPIRED` if missed, 422 `NOT_PINNABLE` if `canPin=false` with the rejection reason from validation; otherwise inserts `pinned_kpis` row with `prompt`/`label`/`queryPlan`/`preferredChart`/`severity`/`lastRunAt`/`lastRunValue` from the cached result and `scope='user'` default per locked decision §9 #1), `GET /api/finance/pinned-kpis?periodId=...` (visibility = own pins ∪ company-scope pins for active company; for each pin re-executes the queryPlan against the requested period and attaches `currentValue` — purely deterministic, no LLM in this path; falls back to `lastRunValue` if execution fails), `DELETE /api/finance/pinned-kpis/:id` (403 if attempting to unpin another user's pin). **Pin rejection rationale** (locked decision §9 #5): qualitative questions like "what should I worry about?" return `canPin=false` with the message "This answer isn't a deterministic aggregation — try a more specific question (e.g. 'sum of outstanding accruals by flow type').". Verified end-to-end against live data (Apr 2026 test period): aggregable question returned `value=88779.74` from Claude with valid plan (1 LLM call, then deterministic SQL); dimensional question returned partner breakdown with 4 rows (Soundcore, Midwest, TechFlow, Summit); qualitative question correctly returned `canPin=false`; pin → list → unpin round-trip works; `currentValue` re-evaluates on every list call. Caught + fixed during testing: my snapshot query used `c.flow_type_id` but the schema column is `c.flow_type_code` directly (no FK to flow_types needed for this lookup). Typecheck baseline held at 1523/1523 (used `Array.from(set)` instead of spread to avoid TS2802 in older `--target` settings; one Drizzle insert at line 1966 uses `as any` matching the file's existing pattern). Next: Phase 3 — graduate the Worksheet/Co-Pilot UI on top of the now-complete read+write+ask APIs.

**Period Close Subledger Workspace — Phase 1c + 1d Write Paths** (Apr 2026): All five batch endpoints from spec §5.2 plus the lock-guard + sign-off chain from §5.3 / §3.1. New helper service `server/services/closeBatch.ts` exposes `runIdempotentBatch<T>({ operationType, idempotencyKey, periodId, initiatedBy, initiatedVia, companyId, payload, exec })` that wraps every batch in a `close_batch_operations` receipt: it looks up `(companyId, operationType, idempotencyKey)`, returns the cached `{ batchOperationId, status, resultSummary, replayed:true }` on hit, otherwise inserts a `running` row, runs the action, and stamps `succeeded|partial|failed` + `resultSummary` + `completedAt`. Race-loser path (concurrent first-time requests) catches the unique-constraint violation and re-reads the winner. Critical pitfall fixed during smoke-test: when `companyId` is null we MUST use `isNull(col)` because Drizzle's `eq(col, null)` emits SQL `col = NULL` which is never true — without that fix the replay lookup silently missed and inserted duplicates. Every batch additionally writes one `period_close_audit_trail` row with `actorType` ('ai' if initiated via copilot, else 'user'), `sourceBatchOperationId` back-ref, and a `metadata` jsonb of the counts + errors so SOX evidence pulls can join on the receipt id. Five endpoints follow the same contract — all require an `Idempotency-Key` header (UI generates a UUID per click; AI executor reuses `close_decisions.id`) and an optional `X-Initiated-Via: worksheet|copilot|api` header: `POST /api/finance/batch/post-jes` (resolves obligations → linkedJournalEntryId, sets `jeStage='posted'`; supports `dryRun` that returns `posted[]` without writing), `POST /api/finance/batch/settle` (joins obligations to settlements via `(contract_id, period)` and posts them in one update), `POST /api/finance/batch/resolve-claims` (per-claim `inboundClaims.status` update + `inboundClaimEvents` audit row; resolution allowlist `'approve'|'reject'|'partial'`), `POST /api/finance/batch/apply-deductions` (allowlist `'match'|'write_off'|'recover'` mapped to `matched|written_off|recovered`), `POST /api/finance/batch/reverse-accruals` (per-accrual update to `status='reversed'` + `accrualAuditTrail` row capturing `reason`). All return `{ batchOperationId, status, resultSummary, replayed }`. Plus `GET /api/finance/batch/:id` for status polling. Phase 1d hardens `POST /api/period-close/:id/approve` with the critical-blocker guard from spec §5.3: queries `period_close_blockers WHERE period_id=:id AND resolved=false AND severity='critical'` (uses the composite index from Phase 1b) and returns 409 with `error: 'CRITICAL_BLOCKERS_PRESENT'` and a blocker list payload if any exist; on pass it stamps `lockedBy/lockedAt` (Phase 1a sign-off columns) and writes an audit row. Two new sign-off endpoints for the prepared → reviewed → locked progression: `POST /api/period-close/:id/mark-prepared` and `POST /api/period-close/:id/mark-reviewed` stamp the corresponding `*By/*At` columns and write audit rows (idempotent — re-stamping is a semantic no-op). Verified with synthetic critical blocker (409 → resolve → 200 with lockedAt) and idempotency replay test (same key returns same batchOperationId). Typecheck baseline grew from 1509 → 1523 — all 14 new errors are the same Drizzle `update().set({...})` type-inference quirk this file already accepts (pre-existing baseline of 7 TS2353 + 6 TS2769 in this file). The COA-defaults move (`financeRoutes.ts:37-39` `2150` / `4000` → `companySettings.defaultAccrualLiabilityAccount` / `defaultAccrualExpenseAccount`) noted in spec §5.3 is **deferred** — separate cleanup, doesn't gate the Worksheet UI graduation. Next: Phase 2 (Ask LedgerIQ) **or** Phase 3 (graduate Worksheet UI on the now-complete read+write APIs).

**Period Close Subledger Workspace — Phase 1b Indexes + Read API** (Apr 2026): Five composite indexes added to both `shared/schema.ts` and Neon to back the new workspace queries: `obligations(company_id, funding_period)`, `settlements(contract_id, period)`, `inbound_claims(contract_id, period)`, `finance_documents(contract_id, period)`, `period_close_blockers(period_id, resolved)` (the last index supports the `EXISTS (... AND NOT resolved)` blocker subquery used by both the grid and per-row blocker flag). Two new read endpoints in `server/financeRoutes.ts` (after `/api/period-close/:id/flow-summary`, before the master-data section): `GET /api/period-close/:id/obligations` is the single composite query that powers the Worksheet grid — projects each obligation joined to `contracts/flow_types` and LEFT-joined to all five downstream subledger tables (`accruals` via `source_accrual_id`, `journal_entries` via `linked_journal_entry_id`, `settlements`/`inbound_claims`/`finance_documents` by `(contract_id, period)`, `deductions` via `matched_obligation_id`), plus computed `hasBlocker` and `hasPendingDecision` flags from `period_close_blockers` and `close_decisions`. Supports filters (`flow`, `status` CSV, `partner` CSV, `hasBlocker=true`, `search` ILIKE on partner/contract/id) with parameterized whitelist sort (`amount_desc` default, plus amount/partner/status/due asc+desc) and `LIMIT n+1`-trick cursor pagination (default 50, max 200). `GET /api/period-close/:id/insights` returns the 3-tile insights strip: `contractsByFlow` (distinct contracts + total $ per flow_type, computed over obligations in this period with pct shares), `periodVsPeriod` (current accrual total + prior-month, prior-year, YTD comparisons with `deltaPct`, plus 12-month sparkline oldest→newest — all derived from a single batched `IN(...)` SUM query against `accruals.period`), and `pinnedKpis` (rows visible to current user: own-scope OR same-company shared). Important pitfall encountered: Drizzle's `sql` template converts JS arrays passed as `${arr}::text[]` into a Postgres row literal, not a text array — so all multi-value filters use `IN (${sql.join(arr.map(v => sql`${v}`), sql`, `)})` instead. `period_label` arithmetic for comparisons reuses the existing `parsePeriodLabel` helper and the canonical "MMM YYYY" string (the same form the period dropdown serves), so no date casting is required. Storage-interface CRUD wrappers for the six new tables (`close_chat_threads` etc.) are deferred until Phase 2 needs them.

**JE Hub & Accrual Management Parity** (Apr 2026): Both pages now share a period selector ("All Periods" + distinct labels from `/api/{journal-entries,accruals}/periods`, sorted recent-first) that scopes the list, summary, insights, and Excel export server-side via `?period=...`. List/detail rows are enriched on the server with `LEFT JOIN contracts` (→ `contractNumber`, `contractDisplayName`) and `LEFT JOIN flow_types` (→ `flowTypeCode`, `flowTypeName`). The frontend uses `resolveContract`/`resolveFlow` helpers so the table cell and side-panel hero render `CNT-2026-045 Contract X` and `💰 CRP Customer Rebate Program` instead of the raw FK / enum. The JE Hub source-accrual chip is a wouter `Link` that drills into `/accrual-management?focus=ACC-XXXX`. Posted JEs are GL-locked: `DELETE /api/journal-entries/:id` returns 409 when `jeStage === 'posted'`, the table hides the trash and shows "Posted · locked", and the bulk-approve mutation surfaces server reasons via `extractServerReason()`. Insight tiles are now six honest, status-driven counts (Pending Approval / Ready to Post / Posted+$ / Unbalanced / ERP Sync Failed / Data Issues) with no AI labels. The Bulk Approve button reads "Bulk Approve Pending (n)" and is disabled when n=0. Both export endpoints support `?format=xlsx` via dynamic `await import("xlsx")`. **Important Express ordering**: `/api/{journal-entries,accruals}/periods` MUST be declared before `/:id` in `server/financeRoutes.ts` so it isn't shadowed.

**Reference-data Seeding Architecture** (April 2026): All system reference tables now have idempotent code seeders that run on every startup, registered in `server/index.ts`. Adding a row to `subtypes`, `flow_subtype_validity`, `rule_types`, `rule_field_whitelist`, `deduction_reason_codes`, or any geography master must be done by editing the corresponding `*-data.ts` file in `server/seed-data/`, never by manual SQL on dev. Seeders use natural keys (`code`, `(flow_type_code, subtype_code)`, `(country_code, state_code)`, etc.) so admin edits via the Reference Lookups UI are never overwritten. The chain is: `seedRuleTaxonomy` → `seedGeographyMasters` → existing seeders → `seedSystemContractTemplates` → `seedDefaultPolicies`. The last one backfills per-contract `subtype_instances` + default `settlement_policies` (with all 5 children: payment_schedule, settlement_method, overpayment_handling, dispute_handling, fx_rule) + default `accrual_policies` for any contract uploaded before its taxonomy existed. This replaces the retired one-time "Round 1 Phase 4 migration" SQL script and ensures every fresh deployment self-heals.

## Feature Specifications
Key features include: AI Contract Reading & Analysis, Dynamic Rule Engine with JSON expression trees, Rule Evaluation Playground, Customer Management, Contract Template System, Rebate Programs, AI Sales Matching, Payment Calculation Dashboard, liQ AI (RAG-Powered Q&A), Omnipresent AI Agent, five-tier RBAC Security & Access Control, Universal Contract Processing, Contract Metadata Management, Universal ERP Catalog & LicenseIQ Schema Catalog, AI Master Data Mapping, Comprehensive Contract Search, Multi-Location Data Filtering, a Two-Tier Admin System, ERP Integration Hub, Pre-Import Data Filtering, Dual Terminology Mapping, ERP Value Linking, and an ERP Mapping Rules System.

A Rule Validation Traffic Light system (Red: AI Extracted/Pending, Yellow: Under Review, Green: Verified) provides enterprise-grade rule verification. Only verified rules participate in payment calculations. SMTP/Email configuration is stored in `system_settings` and managed via a System Settings tab, supporting branded email templates. An admin-only web-based SQL Console is available for query execution and table browsing.

## System Design Choices
The architecture is AI-native, prioritizing asynchronous AI processing, and employs a relational data model. It is designed for enterprise readiness, supporting multi-entity operations, robust user management, audit trails, and flexible data import capabilities. Granular access control is provided via multi-location context filtering and a two-tier admin system.

# External Dependencies

## Database Services
- Neon PostgreSQL
- Drizzle ORM

## AI Services
- Anthropic Claude API (claude-sonnet-4-5)
- Groq API
- Hugging Face Embeddings

## UI Components
- Radix UI
- shadcn/ui
- Recharts

## Authentication & Session Management
- Passport.js
- connect-pg-simple

## File Processing
- Multer
- html-pdf-node

## Settlement Workspace — direction-aware actions (Apr 2026)
The settlement workspace decision bar is flow-type-aware. The cash
direction comes from the contract's `flow_type_code` → `flow_types`
join (surfaced on every settlement row by both the list and detail
endpoints).

- Outbound flows (CRP / RLA / RSM / SUB): partner submits a claim TO us.
  Buttons go through PATCH `/api/settlements/:id` with the existing
  `accept_claim` / `settle_at_accrual` / `partial` resolutions and
  observe the inbound-claim approval gate.
- Inbound flows (VRP): we generate a claim and send it to the supplier.
  Buttons hit purpose-built endpoints (no claim-approval gate, since
  there's no inbound claim to approve):
    - POST `/api/settlements/:id/submit-vendor-claim` — Dr 1240 Vendor
      Rebate Receivable / Cr 2155 Accrued Vendor Rebate; sets
      resolution `submit_vendor_claim`, status `approved`, mints a
      `VRP-CLAIM-…` reference, sets `variance='0.00'` (claim now
      equals accrual), AND mints an outbound `obligations` row
      (direction='outbound', source_channel='vrp_settlement',
      status='claim_submitted', linked to the draft JE) so the
      vendor claim shows up in Claims Workspace as a tracked
      recovery claim — that's where document generation, evidence
      attachments, and dispute workflows already live. The toast
      surfaces a deep-link to `/claims-workspace?claimId=…`. Stays
      unposted until confirmation.
    - POST `/api/settlements/:id/apply-deduction` — creates a
      `deductions` row keyed to the contract's owning_party (the
      vendor) and posts Dr 2100 A/P – Vendor / Cr 2155 Accrued
      Vendor Rebate; settlement → `posted`.
    - POST `/api/settlements/:id/record-vendor-confirmation` — closes
      a previously-submitted vendor claim (`postedAmount = claimAmount`,
      status `posted`).

The detail endpoint also returns `vendorPartyName` / `vendorPartnerId`
(joined from `contract_partner_assignments` where `party_role =
'owning_party'`) so the UI can label "Submit claim to Soundcore Corp"
instead of falling back to the legacy `counterparty` column (which
stores the tenant company on inbound rows).

## Claims Workspace — manual claim edit & delete (Apr 2026)
The claim detail panel now offers Edit / Delete actions for
manually-created claims, gated to mirror the server's mutation rules:

- **Inbound** (`source_channel = "manual"`): edit and delete are
  available while status ∈ `needs_review | pending`. Once a decision
  has been taken (`approved | partial_approved | settled | paid`)
  both are locked — touching the row would diverge from the
  inbound-event audit log and any downstream credit memo.
- **Outbound** (`source_channel = "manual_entry"` on `obligations`):
  edit and delete are only available while the claim is still
  `claim_submitted`. After the approval ladder decides, the row is
  immutable.

Endpoints:
- PATCH `/api/finance/inbound-claims/:id` — re-validates `claim_type`
  against `claim_type_outcome`, optionally re-resolves partner /
  contract, recalculates `claimedAmount`, persists notes into
  `metadata.notes` (no real notes column on inbound), writes one
  `inbound_claim_events` row with `eventType="edited"` and the
  changed-key list.
- DELETE `/api/finance/inbound-claims/:id` — relies on the cascade
  FK on `inbound_claim_lines` and `inbound_claim_events` to clean
  child rows.
- PATCH `/api/finance/outbound-claims/:id` — updates `obligations`,
  keeping `amount`, `outstandingAmount` and `claimedAmount` in
  lockstep so the settlement workspace doesn't see an inconsistent
  outstanding > total. Logs an `obligation_events` "edited" row.
- DELETE `/api/finance/outbound-claims/:id` — first cancels any
  pending `approval_requests` row (`entity_type='claim'`,
  `entity_id=obligation.id`) by flipping status to `cancelled`, then
  deletes the obligation (events cascade). Best-effort
  `agent_activity` log so the action remains visible after the row
  is gone.

Files: `server/financeHubRoutes.ts` (4 new endpoints around
`/api/finance/inbound-claims/:id` and `/api/finance/outbound-claims/:id`),
`client/src/pages/claims-workspace.tsx` (NewClaimDialog gained an
`editing?: UnifiedClaim | null` prop; ClaimDetail gained Edit/Delete
buttons + a confirmation dialog; parent `ClaimsWorkspace` owns
`editingClaim` / `deletingClaim` state and a `deleteMut` mutation).

## Contract Management — Agent mode wired (Apr 2026)
The Contract Management page's two-mode toggle (List / Agent) is no
longer a placeholder. Agent mode now hosts a real conversational
surface against the existing `/api/liq-agent/ask` endpoint — the
same agent the right-rail liQ AI panel uses, with its 10-tool
read inventory (contracts, rules, period close, accruals, JEs,
finance summaries, etc.).

What ships in this round (Phase A of the agent-runtime roadmap):
- Controlled `<input>` + Send button (Enter-to-submit) replaces the
  old disabled placeholder.
- Local chat thread (`agentMessages` state, page-lifecycle only) with
  `FormattedAnswer` rendering for assistant turns, tool-use chips,
  and a "N sources · confidence X%" footer when the agent returns
  RAG hits.
- 6 one-click suggested prompts (shown only while the thread is
  empty) covering portfolio counts, expirations, fee outliers,
  missing rules, accrual exposure, and close blockers.
- Loading state (`Loader2` + "liQ is thinking…") and a per-turn
  error bubble so failures stay visible instead of silently
  vanishing.
- Last 8 turns of `conversationHistory` (truncated to 2 KB each)
  are sent with every request so the agent can follow-up.
- "Clear conversation" button resets the local thread.
- Pedagogical "When to use List / Agent mode" tiles preserved
  underneath the composer for first-run users.

All five phases of the agent-runtime roadmap (A–E) have shipped.
See the dedicated section per phase below for the design + audit
trail.

### Phase E — Persistent agent threads (Apr 30 2026)

Mirrors the `close_chat_threads` pattern from Period Close into the
contracts domain so reloads, tab switches, and accidental clicks
no longer drop the user's agent history.

Backend
- New tables in `shared/schema.ts`:
  - `contractChatThreads` — id, userId, organizationId, title, status
    (active|archived), messageCount, lastMessageAt, createdAt, updatedAt.
  - `contractChatMessages` — id, threadId, role (user|assistant),
    content (jsonb: { text, sources?, confidence?, toolsUsed? }),
    createdAt.
  - Tables created via direct SQL (drizzle-kit was confused by Phase C
    state); both are owner-scoped via `eq(userId, ...)` filters.
- New service `server/services/contractChatService.ts`:
  - `createThread`, `listThreads` (active only), `getThreadWithMessages`,
    `appendMessage`, `touchThreadAfterTurn` (bumps messageCount +
    lastMessageAt), `patchThread` (rename / archive),
    `buildConversationHistory` (formats prior turns for `askAgent`).
- New routes (after dismiss-decision route, ~lines 4955-5079 of
  `server/routes.ts`):
  - `GET    /api/contracts/chat-threads`
  - `POST   /api/contracts/chat-threads`
  - `GET    /api/contracts/chat-threads/:id`
  - `PATCH  /api/contracts/chat-threads/:id` (title / status)
  - `POST   /api/contracts/chat-threads/:id/turn`
- The `/turn` endpoint persists the user message first, calls
  `askAgent` with prior conversation history, persists the assistant
  message with the full payload (text + sources + confidence +
  toolsUsed), and auto-titles the thread from the first user question.

Frontend (`client/src/pages/contracts-list-new.tsx`)
- Replaced local `agentMessages` array with persisted thread queries:
  - `useQuery(['/api/contracts/chat-threads'])` — list of active threads
    for the switcher.
  - `useQuery(['/api/contracts/chat-threads', currentThreadId])` —
    current thread + messages.
  - `useMemo` maps persisted rows into the existing `AgentMsg` shape
    so the rest of the JSX (bubbles, sources, confidence pill) keeps
    working unchanged.
  - `pendingUserMsg` for optimistic echo while the turn mutation is
    in flight.
- `turnMut` calls `/turn`; lazy `ensureThread` creates a thread on
  first send so empty conversations don't pollute the list.
- "Clear conversation" button now archives the thread (PATCH
  `status: archived`) and resets `currentThreadId`, so history is
  preserved instead of nuked.
- New thread switcher (`<select>`) appears above the chat thread when
  the user has more than one saved conversation, letting them jump
  back to past threads without losing the current one.
- `agentMut = turnMut` compatibility alias preserves Phase A spinner /
  disabled JSX without rewriting it.

Verification
- End-to-end: empty list → create → first turn (auto-titled "What is
  in my contract portfolio?") → multi-turn context works → archive
  flips status and removes from list. All confirmed via curl + server
  logs.
- Typecheck baseline refreshed: 1530 errors (was 1523; +7 from new
  schema's `omit({ ...: true })` pattern, same as Phase C).

Files: `client/src/pages/contracts-list-new.tsx` (new `agentMessages`
/ `agentInput` state, `agentMut` mutation, `askAgent` helper, and a
~150-line rewrite of the Agent-mode JSX block from line ~607 down).
No backend changes — we reuse the existing endpoint at
`server/routes.ts:6873` and the `liqAgentService.askAgent` export.

### Contract Management — List interactions polish (Apr 30 2026)

Post-Phase-E hardening pass on the Contract Management list. The
mockup-era buttons were placeholders; this turns them into real
interactions.

- **Select-all + per-row checkboxes** — previously bare HTML inputs
  with no state. Now backed by a `selectedIds: Set<string>` with a
  shared `TriCheckbox` helper that drives the HTML `indeterminate`
  flag for the master checkbox. Master is in the table header bar
  AND the table thead — both stay in sync.
- **Bulk-actions bar** — when at least one row is checked the
  zinc-coloured header bar flips to an orange "X selected · Clear"
  bar. Bulk operations themselves are still a stub ("coming soon"),
  but the selection plumbing is now live so wiring them is a
  one-handler change.
- **Row actions wired** — Revise / Amend / Approve previously had no
  `onClick`. They now navigate to the contract detail page on the
  right tab via `?tab=…`:
  - Revise → `?tab=history` (versions live there)
  - Amend  → `?tab=terms`   (amendments edit clauses)
  - Approve → `?tab=overview` (readiness checklist + approve gate)
- **More menu** — was also dead. Now opens a small popover with
  shortcuts to the Parties / Rules / Payments tabs, Copy contract
  number (writes to clipboard via `navigator.clipboard`), and
  "Open in new tab". Closes on outside click via a window-level
  listener gated by `openMenuId`.
- **`contract-edit.tsx` deep-link support** — reads `?tab=…` from
  the URL on mount (validated against an allow-list of tab keys)
  and seeds `useState(initialTab)` so the row actions actually
  land on the right tab.

## Contract Management — Morning brief service (Apr 2026)
Phase B of the agent-runtime roadmap. The static "Coming in Phase B"
intro card on the Contract Management Agent-mode tab is replaced by
a live morning brief computed server-side from the visible contract
portfolio.

New endpoint:
- `GET /api/contracts/morning-brief` (auth-required, org-scoped via
  the same `OrgAccessContext` shape the contracts list uses). Pulls
  up to 1k contracts via `storage.getContracts`, then aggregates
  in-memory. Pure read — no writes, no LLM calls — so it's safe
  to call on every page mount and is the foundation we'll later
  attach to a scheduled job / morning email.

Response shape:
```json
{
  "generatedAt": "ISO timestamp",
  "headline": "1-sentence framing string",
  "summary": {
    "total": 8,
    "active": 5,
    "expiringSoon": 0,        // ≤60 days from end date
    "expiredActive": 1,       // ★ active but already past effective_end
    "missingRules": 0,        // active with rulesCount === 0
    "pendingReview": 0,       // status ∈ pending / draft / in_revision
    "totalAnnualValue": 19000
  },
  "priorities": [             // top 8, ranked high → med → low
    { "type": "expired-active" | "expiring" | "missing-rules" | "pending-review",
      "urgency": "high" | "med" | "low",
      "contractId": "...", "name": "...", "detail": "..." }
  ]
}
```

Frontend wiring (`client/src/pages/contracts-list-new.tsx`):
- New `useQuery<BriefData>` against `/api/contracts/morning-brief`,
  `enabled: mode === "agent"` so list-mode users don't pay the
  cost. `staleTime: 5 min`.
- The intro card now renders the live `headline`, six summary
  chips (total / active / past-due / expiring<60d / missing-rules /
  pending-review / annual $), and the ranked `priorities` list with
  per-row navigation (`<Link href="/contracts/:id">`) into the
  contract detail page.
- Loading state: spinner + "Building brief…". Empty-priority state:
  chips render but the priorities block is omitted (the headline
  already says "Portfolio looks calm").

Notable design choices:
- **`expiredActive` bucket** was added after observing real test
  data — one contract was `status='active'` with
  `effective_end = 2025-12-31` (4 months in the past). That's a
  billing-correctness risk and now sits at the top of the
  headline ladder.
- Status-matching uses tolerant regex (`/^(active|executed|signed|
  approved|amended)$/i` for active, `/^(pending|pending_approval|
  in_revision|draft)$/i` for pending) so legacy and modern status
  vocabularies both flow through.
- Annual value falls back across `contractValueEstimatedAnnual`
  → `totalValue` → `contractValue` so the chip works for older
  rows that only populated one of the three columns.

Files: `server/routes.ts` (~155 lines added right after the
`/api/contracts` list route at line ~4677); `client/src/pages/
contracts-list-new.tsx` (new `BriefData` types, `useQuery` for the
brief, and a re-render of the Agent-mode intro card from the
static prose to the live digest).

## Contract Management — Decision proposer queue (Apr 2026)
Phase C of the agent-runtime roadmap. The agent now keeps a
persistent queue of proposed actions on contracts that the user
can accept (executes the action) or dismiss with one click.

### New table: `contract_decisions`
```
id              uuid pk
company_id      varchar         -- tenant scoping
contract_id     varchar fk → contracts(id) on delete cascade
proposal_type   varchar         -- expired-active | expiring | missing-rules | pending-review
urgency         varchar         -- high | med | low
summary         text            -- 1-line user-facing description
action_type     varchar         -- mark-expired | acknowledge
action_params   jsonb           -- optional payload for the action
status          varchar         -- pending | accepted | dismissed
proposed_at     timestamp
decided_at      timestamp       -- nullable until decided
decided_by      varchar         -- userId who clicked accept/dismiss
decision_note   text
```
Indexes: company_id, contract_id, status, and a (contract_id,
proposal_type, status) tuple used by the proposer's dedupe scan.

### New service: `server/services/contractProposerService.ts`
- `refreshProposals(orgContext, hasAdminAccess, userId, companyId)`
  — derives proposals from the visible portfolio using the same
  bucket logic as the morning brief (expired-active, expiring,
  missing-rules, pending-review). Inserts rows for proposals that
  aren't already pending AND haven't been decided in the last
  30 days (suppression window prevents the queue from refilling
  itself the moment it's cleared).
- `listPendingDecisions(companyId)` — read-only fetch of pending
  rows, scoped by companyId when present.
- `acceptDecision(decisionId, userId, note?)` — validates the row
  is still pending, dispatches `actionType`:
    - `mark-expired` → `UPDATE contracts SET status='expired'`
    - `acknowledge`  → no-op (used for buckets where the agent
       can't safely automate the fix but the user has handled it)
  Then marks the row `accepted` and returns `{ decision, effect }`.
- `dismissDecision(decisionId, userId, note?)` — marks the row
  `dismissed` without performing any action.

### New endpoints (`server/routes.ts`)
- `GET  /api/contracts/decisions` — auto-runs `refreshProposals`
  then returns `{ decisions: ContractDecision[], refreshed: { inserted, skipped } }`.
  Pass `?skipRefresh=1` for read-only polling.
- `POST /api/contracts/decisions/:id/accept` — body `{ note? }`,
  returns `{ decision, effect }`.
- `POST /api/contracts/decisions/:id/dismiss` — body `{ note? }`,
  returns `{ decision }`.

### Frontend wiring (`client/src/pages/contracts-list-new.tsx`)
A new "Proposed actions" card sits between the morning brief and
the chat thread (only renders when there are pending decisions or
the queue is loading). Each row shows: urgency dot, type label,
summary, "open contract →" link, and the two action buttons.
- Accept button label adapts to the action: "Mark expired" for
  `mark-expired`, "Acknowledge" for `acknowledge`.
- Mutations invalidate `/api/contracts/decisions` (always),
  plus `/api/contracts` and `/api/contracts/morning-brief` on
  accept since `mark-expired` mutates the underlying contract.
- Toasts confirm both outcomes with the 30-day suppression note
  on dismiss.

### Closed-loop verification (end-to-end test, recorded)
1. `GET /decisions` → inserts 1 pending decision for the live
   data-quality anomaly (TechSound contract: `active` but ended
   120d ago).
2. `GET /decisions` again → idempotent, `skipped:1, inserted:0`.
3. `POST /decisions/:id/accept` → returns `effect: contract.status
   = 'expired'`. Contract row verified updated.
4. `GET /decisions` → returns 0 — the underlying condition is
   gone, so the proposer no longer generates that proposal.

### Notable design choices
- **No proposer cron yet.** The queue refreshes lazily on every
  GET, which is fine at the portfolio sizes we target (≤1k rows).
  When the brief moves to a scheduled morning email, the same
  `refreshProposals` call will run there.
- **Action surface kept narrow.** Only `mark-expired` performs a
  real mutation; `acknowledge` is the safe default for proposals
  where automation could be wrong (rules editing, approval
  routing, etc.). New action types can be added by extending the
  switch in `acceptDecision`.
- **30-day suppression** balances "don't nag" with "remind me
  later if it's still wrong". A future Phase will let users pick
  a custom snooze duration.

Files: `shared/schema.ts` (new `contractDecisions` table +
`InsertContractDecision` types); `server/services/
contractProposerService.ts` (new ~250-line service);
`server/routes.ts` (3 new endpoints); `client/src/pages/
contracts-list-new.tsx` (new `DecisionRow` types, `decisionsData`
query, `decideMut` mutation, and the "Proposed actions" panel
between the brief and chat thread).

DB migration: created via raw SQL (`CREATE TABLE IF NOT EXISTS
contract_decisions ...`) because `drizzle-kit push` confused the
new table with renames of unrelated existing tables. The schema
file is the source of truth — re-running push in the future
should be safe once it sees the table already exists.

## Contract Management — Risk scoring (Apr 2026)
Phase D of the agent-runtime roadmap. The "At risk (high)" KPI in
the contracts page header used to read "—". It now reads a live
count from a pure-function risk service that scores every contract
in the visible portfolio.

### Design choice — no schema change
Risk is computed on demand from columns we already store, not
persisted. At our portfolio sizes (≤1k contracts) the compute is
sub-millisecond per row, and avoiding a `riskScore` column means
no cache-invalidation bugs when contract data changes.

### New service: `server/services/contractRiskService.ts`
- `computeRiskFor(contract, now?)` — pure function returning
  `{ contractId, score (0-100), level (low|med|high), factors[] }`.
  Factor catalog with weights:
  - past-due (40) — active contracts past their end date
  - expiring-14d (30) / expiring-30d (25) / expiring-60d (15)
  - auto-renew-no-notice (20) — auto-renews with no notice window
  - auto-renew (8) — auto-renew with notice captured
  - value-high (15) ≥ $500k / value-med (10) ≥ $100k / value-low (5) ≥ $25k
  - counterparty-unlinked (8) — not verified against master
  - no-end-date (10) — active with no effective_end set
  - approval-stuck (10) — pending_approval > 14d
  Score caps at 100. Cutoffs: high ≥ 60, med 30-59, low < 30.
- `getRiskSummary(orgContext, hasAdminAccess, userId)` — aggregates
  across the visible portfolio, returns `{ summary: {high, med,
  low, total}, top: [...] }` with the top 8 non-low contracts
  sorted by score desc.
- `getRiskForContract(contractId)` — per-contract breakdown for
  detail pages and tooltips.

### New endpoints (`server/routes.ts`)
- `GET /api/contracts/risk-summary` — KPI feed.
- `GET /api/contracts/:id/risk` — per-contract breakdown.

### Frontend wiring (`client/src/pages/contracts-list-new.tsx`)
- New `useQuery<RiskSummary>` against `/api/contracts/risk-summary`,
  not gated on agent mode (the KPI shows in both modes), 2-min
  staleTime.
- The "At risk (high)" KPI now displays the live `high` count.
  Subtitle adapts: "X med · Y scored" when there are med risks,
  "Y scored" otherwise. Icon color shifts rose / amber / emerald
  based on whether anything is high / med / all-clear.
- Native `title` tooltip on hover shows the top 5 scored
  contracts with `[LEVEL SCORE] Name — top factor`, so the user
  gets the "why" without needing a modal.
- The Phase C `decideMut.onSuccess` now also invalidates
  `/api/contracts/risk-summary` when an action is accepted, so the
  KPI immediately reflects status changes (e.g. mark-expired drops
  the past-due factor → contract drops out of the med tier).

### Closed-loop verification (recorded)
1. `GET /risk-summary` → high:0, med:1 (TechSound at 40 pts:
   "Active but ended 120d ago").
2. `POST /decisions/:id/accept` for the matching mark-expired
   proposal → `effect: contract.status = 'expired'`.
3. `GET /risk-summary` → high:0, med:0, low:8. The past-due factor
   no longer fires once the contract isn't active, so the score
   correctly drops to low.

### Bug squashed during build-out
Initial scoring used `c.contractStatus || c.status` which
shadowed the operational `status='active'` with the legacy
`contractStatus='Draft'` string, causing every contract to score
0. Fixed by keying off `status` only — same convention the
morning-brief uses.

Files: `server/services/contractRiskService.ts` (new ~250-line
pure service); `server/routes.ts` (2 new endpoints right after
`morning-brief`); `client/src/pages/contracts-list-new.tsx`
(new `RiskSummary` type, `useQuery`, KPI rewrite with adaptive
subtitle/color/tooltip, and risk-summary cache invalidation in
`decideMut.onSuccess`).

## Contract Command Center — Reconciliation tab (Apr 30 2026)

Phase 1 of the Contract Command Center: replaced the three stub tabs (Sales
Match, Payments, Ledger) on the contract-edit page with a single, flow-aware
**Reconciliation** tab. The Performance tab is a separate later phase.

### New tab order
Overview · Parties · Terms · Rules · Policies · **Reconciliation** · Risks · History.

### Backend additions
- All four cross-contract finance endpoints now accept `?contractId=` for
  contract-scoped queries:
  - `GET /api/accruals` (`server/financeRoutes.ts`)
  - `GET /api/journal-entries` (`server/financeRoutes.ts`)
  - `GET /api/settlements` (`server/financeRoutes.ts`)
  - `GET /api/finance/inbound-claims` (`server/financeHubRoutes.ts`)
  - `GET /api/finance/documents` (`server/financeHubRoutes.ts`)
- New aggregation endpoint `GET /api/contracts/:contractId/reconciliation`
  (`server/contractReconciliationRoutes.ts`, registered in `server/routes.ts`):
  - Query: `?period=mtd|qtd|ytd|trailing12|custom&from=&to=` (default `ytd`).
  - Returns `contract` (with `flowTypeCode` + resolved `cashDirection`),
    `period`, `subtypeInstances[]`, `kpis` (open accruals, open obligations,
    settlement variance, claims pending, unposted JEs, invoices in range,
    last GL sync), `settlementVarianceRows[]`, compact projections of
    `accruals[]`, `obligations[]`, `claims[]`, `invoices[]`,
    `journalEntries[]`, plus `closeReadiness[]` checklist.
  - Strict company scoping; 404 on missing contract.

### Frontend additions
- Flow-aware **KPI registry**
  (`client/src/components/contracts/reconciliation/kpiRegistry.ts`) exports
  `getReconciliationKpis(flowTypeCode, summary)` so the same six tiles render
  with VRP/CRP/RLA/SUB/RSM/OEM-specific labels and cash-direction language
  (e.g. "Vendor accruals receivable" vs "Customer rebate liability").
- Reconciliation tab (`client/src/components/contracts/reconciliation/`):
  - `ReconciliationTab.tsx` — period selector (MTD/QTD/YTD/Trailing12),
    KPI strip, settlement variance table, accruals/obligations and
    claims/invoices card rows, compact JE table, right-rail close-readiness
    + GL sync.
  - `SettlementVarianceTable.tsx` — last N periods with click-to-investigate.
  - `VarianceInvestigationDrawer.tsx` — contract-scoped drawer that pulls the
    selected settlement via `/api/settlements/:id` for side-by-side our-calc
    vs their-claim review and notes.
  - `CloseReadinessCard.tsx` — drives the right-rail checklist from the
    aggregation endpoint's `closeReadiness[]`.

### Policies tab — new contract-level header
The two cards previously living on the Payments tab moved into the Policies
tab as a collapsible "Contract-level overrides" header above the per-subtype
instance editors:
- `client/src/components/contracts/policies/ContractLevelPoliciesHeader.tsx`
  hosts both `ObligationAccrualBasisCard` (per-contract pin overriding the
  system default for accrual basis) and `SettlementDocumentTypeCard` (the
  contract-level document-type matrix for settlement direction). Wired into
  `client/src/components/contracts/PoliciesTab.tsx`.
- The duplicate card definitions and their helper imports (CLAIM_TYPES,
  SETTLEMENT_DIRECTIONS, BUILT_IN_DOCUMENT_TYPE_MATRIX, etc.) and the dead
  Sales/Payments/Ledger render blocks were removed from
  `client/src/pages/contract-edit.tsx`. The `initialTab` allowed-set was
  updated to drop `sales|payments|ledger` and add `reconciliation`.

### Verified end-to-end
- Typecheck baseline unchanged (1530 errors == 1530 baseline; no new errors).
- `GET /api/contracts/:id/reconciliation?period=ytd` on a real CRP contract
  (CNT-2026-050) returns 200 with full payload: 7 KPIs populated, 1 matched
  settlement variance row (variance $0.65, 0.005%), 1 accrual, 1 obligation,
  1 invoice, 2 JEs, 5 close-readiness items.

## Contract Command Center — Performance tab (Apr 30 2026)

Phase 2 of the Contract Command Center: a flow-aware **Performance** tab
sits between Reconciliation and Risks. The header "Legacy view" link was
removed in the same pass (the Command Center now covers everything the
legacy analysis page did).

### Updated tab order
Overview · Parties · Terms · Rules · Policies · Reconciliation ·
**Performance** · Risks · History.

### Backend
- New endpoint `GET /api/contracts/:contractId/performance` in
  `server/contractPerformanceRoutes.ts` (registered in `server/routes.ts`):
  - Query: `?period=mtd|qtd|ytd|trailing12|custom&from=&to=` (default `ytd`).
  - Returns `contract` (with `flowTypeCode` + `cashDirection`), `period`
    (current and prior comparison range), `kpis` (lifetime fees, period
    fees + delta-vs-prior-period %, effective rate, avg per calc, run
    health %, last calc, active rules), `trend[12mo]`
    (`{monthKey,monthLabel,fees,sales,calcCount}`), `topRules[]` (top 8
    contributors with fee, share %, transaction count, calc count) and
    `recentRuns[]` (last 10 calculation runs).
  - Sources: `contract_calculations`, `calculation_runs`, and
    `calculation_rule_results` for in-period calcs only (avoids loading
    every rule trace ever).
  - Strict company scoping; 404 on missing contract.

### Frontend
- Flow-aware **Performance KPI registry**
  (`client/src/components/contracts/performance/performanceKpiRegistry.ts`)
  exports `getPerformanceKpis(flowTypeCode, summary, currency)` so the
  same six tiles render with VRP/CRP/RLA/SUB/RSM/OEM-specific labels
  (e.g. "Royalty calculated" for RLA, "Customer rebate paid" for CRP,
  "Vendor receivables earned" for VRP).
- `PerformanceTab.tsx` (single file, inlines `TrendChart`, `TopRulesCard`,
  `RecentRunsCard`):
  - Period selector (MTD/QTD/YTD/Trailing12), KPI strip, 12-month bar
    chart with hover tooltip, top rules card with share-of-fee bars,
    recent calculation runs table with status pills, empty + error states.

### Wiring
- `client/src/pages/contract-edit.tsx`: added Performance `TabBtn`
  (TrendingUp icon), added `performance` to the `initialTab` allow-set,
  added the render branch, removed the header "Legacy view" link.

### Verified
- Typecheck baseline unchanged (1530 == 1530, no new errors).
- `GET /api/contracts/:id/performance?period=ytd` on CNT-2026-050 (CRP):
  lifetime fees $14,054.65 (1 calc), effective rate 2.50% on $562k sales,
  100% run success (1/1), 12-month trend with Apr 26 bucket populated,
  1 top rule ("TechSound Distributor Volume Rebate" — 100% share),
  1 recent run.

## Utility Libraries
- date-fns
- React Hook Form
- TanStack Query
- Wouter
- Zod