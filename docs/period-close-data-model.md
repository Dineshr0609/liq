# Period Close Subledger — Data Model & API Contracts

**Scope.** Backend foundations for shipping Variant C (Worksheet) and Variant D (Co-Pilot) as the new Period Close workspace. Targets the gap between today's mockups and a production-ready integration.

**Rule of thumb.** Everything reuses the existing spine (`obligations`, `accruals`, `journal_entries`, `settlements`, `inbound_claims`, `deductions`, `finance_documents`, `period_close*`). New tables only exist to power things that don't have a home yet: AI chat, AI proposals, pinned KPIs, saved views, batch idempotency.

---

## 1. What already exists (no changes)

These tables are the spine. Every row in the Worksheet grid and every "what's the state" answer in the Co-Pilot derives from joining across them.

| Table | Role in the pipeline | Mockup column |
|---|---|---|
| `contracts` | Master record | Contract / Program |
| `obligations` | **State machine spine** — `accrued → claimable → claimed → approved → paid` (also `expired`, `reversed`). FK to `journal_entries`. Has `partner_id`, `kind`, `funding_period`. | The row identity in the grid |
| `accruals` + `accrual_calculation_trace` | The "Accruals Calc'd" stage. AI confidence, tier, rate, threshold. | "Acc" cell |
| `journal_entries` + `journal_entry_lines` + `je_erp_sync_log` + `je_reconciliation` | "JEs Posted" + ERP sync stage. `je_stage`, `balanced`, `erp_sync_status`. | "JE" cell |
| `settlements` + `settlement_line_items` | "Cash Settled" stage. `match_status`, `dispute_state`, `variance`. | "Stl" cell |
| `inbound_claims` + `inbound_claim_lines` + `inbound_claim_events` | "Claims IB" stage. Status state machine + dispute state. | "IB" cell |
| `deductions` + `deduction_events` | "Deductions" stage. | "Ded" cell |
| `finance_documents` | "Invoice Status" stage. `document_type`, `status`, `oracle_status`. | "Inv" cell |
| `period_close` | Period header — status, readiness score, close date | Header bar |
| `period_close_checklist` | Per-period prepare/review/lock items | Sign-off chain |
| `period_close_blockers` | Critical / medium close blockers with AI suggestions | Right-rail blockers |
| `period_close_audit_trail` | "What's Changed Today" feed | Activity log |
| `period_variance` | Per-flow current vs prior period | Variance card |
| `contract_close_status` | Per-contract roll-up across all stages | The drill-down table |

**Key insight:** `contract_close_status` is *almost* the Worksheet row, but it's a roll-up keyed on contract. The mockup row is keyed on **obligation**, which is finer-grained (one contract can have many obligations across kinds). The Worksheet query joins `obligations → contracts → period_close` and projects per-stage status by left-joining to the stage tables, **not** from `contract_close_status`. We keep `contract_close_status` for backward compatibility but the new endpoint computes fresh.

---

## 2. New tables (5)

### 2.1 `close_chat_threads` — Co-Pilot conversation containers

One thread per (period, user, optional context). A controller might have one thread for "Apr 2026 close — overall" and a separate thread spawned from "explain Walmart concentration risk."

```ts
export const closeChatThreads = pgTable("close_chat_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: varchar("period_id").notNull().references(() => periodClose.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title").default("Untitled close session"),  // auto-generated from first message
  // Scope context — when the thread was spawned with a filter (e.g. "rebates only"
  // or "blocked obligations") this preserves it so model can reference it.
  scopeFilter: jsonb("scope_filter"),  // { flow?: string[], status?: string[], obligationIds?: string[] }
  modelProvider: varchar("model_provider").default("anthropic"),  // anthropic | openai
  modelName: varchar("model_name"),  // claude-sonnet-4 | gpt-4o etc.
  status: varchar("status").default("active"),  // active | archived
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  companyId: varchar("company_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("close_chat_threads_period_user_idx").on(t.periodId, t.userId),
  index("close_chat_threads_company_idx").on(t.companyId),
]);
```

### 2.2 `close_chat_messages` — turns within a thread

Append-only. Stores both user prompts and assistant responses, tool calls, and tool results. A single assistant turn may produce multiple messages (text + tool_use + tool_result).

```ts
export const closeChatMessages = pgTable("close_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => closeChatThreads.id, { onDelete: 'cascade' }),
  // Standard chat-completion roles + 'tool' for tool-call results.
  role: varchar("role").notNull(),  // user | assistant | tool | system
  // Anthropic-style content blocks: [{type:'text',text:...},{type:'tool_use',...}]
  // We persist as JSON to support multi-modal content and tool-use calls without
  // forcing a separate columnar encoding per provider.
  content: jsonb("content").notNull(),
  // Token accounting for cost tracking.
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  // If this assistant message proposed an action (post JE, settle, hold, etc.)
  // the resulting decision row goes here. NULL for plain Q&A.
  decisionId: varchar("decision_id").references((): AnyPgColumn => closeDecisions.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("close_chat_messages_thread_idx").on(t.threadId, t.createdAt),
]);
```

### 2.3 `close_decisions` — the AI Decision Queue (the heart of Variant D)

Every action the Co-Pilot proposes lands here in `pending` status until a human approves or rejects. This is the audit trail for "the AI did this on my behalf" and the bridge between the LLM's tool-use and the actual side-effecting endpoints (batch JE post, settle, etc.).

```ts
export const closeDecisions = pgTable("close_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: varchar("period_id").notNull().references(() => periodClose.id, { onDelete: 'cascade' }),
  threadId: varchar("thread_id").references(() => closeChatThreads.id, { onDelete: 'set null' }),
  messageId: varchar("message_id"),  // back-ref to the assistant message that proposed it (no FK to avoid cycle)
  // What the AI wants to do.
  actionType: varchar("action_type").notNull(),
  // Allow-list, enforced server-side:
  //   post_jes | settle_obligations | resolve_claims | apply_deductions
  //   | reverse_accruals | release_obligations | hold_for_review
  //   | request_info | flag_blocker
  // Strongly-typed payload validated by Zod against actionType-specific schema.
  payload: jsonb("payload").notNull(),
  // Denormalized for fast filtering of the Decision Queue UI.
  affectedObligationIds: text("affected_obligation_ids").array(),
  affectedAmount: decimal("affected_amount", { precision: 15, scale: 2 }),
  affectedCount: integer("affected_count").default(0),
  // Risk band for color-coding the queue.
  riskLevel: varchar("risk_level").default("low"),  // low | medium | high | requires_controller
  rationale: text("rationale"),  // model's explanation in plain English
  citations: jsonb("citations"),  // [{type:'obligation',id:...,note:'...'}]
  // State machine.
  status: varchar("status").notNull().default("pending"),
  // pending | approved | rejected | executed | failed | expired | superseded
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  // Execution tracking — what actually happened when we ran this.
  executedAt: timestamp("executed_at"),
  // Idempotency — see close_batch_operations. NULL until executed.
  batchOperationId: varchar("batch_operation_id"),
  executionError: text("execution_error"),
  // Auto-expire pending decisions older than this so stale proposals
  // don't get accidentally approved (e.g. data has changed since).
  expiresAt: timestamp("expires_at"),
  companyId: varchar("company_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("close_decisions_period_status_idx").on(t.periodId, t.status),
  index("close_decisions_thread_idx").on(t.threadId),
  index("close_decisions_company_idx").on(t.companyId),
]);
```

### 2.4 `pinned_kpis` — saved AI-generated custom KPIs (the "Ask LedgerIQ" tile)

When a user asks "rebate concentration risk by partner" and likes the result, they pin it. From then on, that KPI tile shows on the insights strip with a fresh recomputation each load.

```ts
export const pinnedKpis = pgTable("pinned_kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Pin can be user-scoped (private) or company-scoped (shared across team).
  scope: varchar("scope").notNull().default("user"),  // user | company
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id"),
  // The original natural-language question.
  prompt: text("prompt").notNull(),
  // Display name (auto-generated, user-editable).
  label: varchar("label").notNull(),
  // The compiled query plan that re-runs this KPI on demand. Stored as
  // structured JSON so we can re-execute deterministically; NULL falls back
  // to re-asking the LLM with the original prompt.
  queryPlan: jsonb("query_plan"),
  // { aggregation: 'sum'|'count'|'avg', dimensions: [...], filters: [...],
  //   metric: 'amount'|'count'|..., comparison?: 'mom'|'yoy'|'ytd' }
  preferredChart: varchar("preferred_chart").default("number"),
  // number | bar | line | sparkline | concentration
  iconHint: varchar("icon_hint"),  // lucide-react icon name
  severity: varchar("severity"),  // info | warning | alert — for color coding
  sortOrder: integer("sort_order").default(0),
  lastRunAt: timestamp("last_run_at"),
  lastRunValue: jsonb("last_run_value"),  // cached result for instant render
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("pinned_kpis_owner_idx").on(t.ownerUserId, t.scope),
  index("pinned_kpis_company_idx").on(t.companyId, t.scope),
]);
```

### 2.5 `close_saved_views` — Worksheet filter/column presets + view handoff

Two purposes in one table:

1. **Saved views** — "Rebates needs review" or "Walmart obligations" presets a controller saves and re-uses.
2. **Cross-mode handoff** — when user clicks "Switch to Co-Pilot" from the Worksheet (or vice versa), we store the active filter/selection here with `kind='handoff'` so the destination view can pick it up.

```ts
export const closeSavedViews = pgTable("close_saved_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kind: varchar("kind").notNull().default("saved"),  // saved | handoff | autosave
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: 'cascade' }),
  scope: varchar("scope").notNull().default("user"),  // user | company
  companyId: varchar("company_id"),
  name: varchar("name"),  // null for handoff/autosave
  // The view targets a *kind* of period (Apr-Jun 2026) not a specific period
  // so the same saved view works month over month. Empty filter = all.
  filters: jsonb("filters").notNull().default(sql`'{}'::jsonb`),
  // { flows?: string[], statuses?: string[], partners?: string[],
  //   pipelineStages?: string[], hasBlocker?: boolean,
  //   amountMin?: number, amountMax?: number, search?: string }
  columnConfig: jsonb("column_config"),
  // { visible: string[], order: string[], widths: {col: number} }
  selectedObligationIds: text("selected_obligation_ids").array(),  // for handoff
  // Origin / destination view for handoff.
  fromMode: varchar("from_mode"),  // worksheet | copilot | null
  toMode: varchar("to_mode"),      // worksheet | copilot | null
  // Auto-expire handoffs after 5 minutes so stale ones don't reapply.
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("close_saved_views_owner_idx").on(t.ownerUserId, t.kind),
  index("close_saved_views_company_idx").on(t.companyId, t.kind),
]);
```

### 2.6 `close_batch_operations` — idempotent batch action receipts

Both the Worksheet's "Post 49 JEs" button and the Co-Pilot's `executeDecision` call hit the same batch endpoints. We need an idempotency record so a network retry, double-click, or replayed AI decision doesn't post twice.

```ts
export const closeBatchOperations = pgTable("close_batch_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Client-supplied — UI generates a UUID per click; AI uses decision.id.
  // Unique within (company, operation_type) so retries collapse.
  idempotencyKey: varchar("idempotency_key").notNull(),
  operationType: varchar("operation_type").notNull(),
  // Same allow-list as close_decisions.action_type.
  periodId: varchar("period_id").notNull().references(() => periodClose.id, { onDelete: 'cascade' }),
  initiatedBy: varchar("initiated_by").references(() => users.id, { onDelete: 'set null' }),
  initiatedVia: varchar("initiated_via"),  // worksheet | copilot | api
  payload: jsonb("payload").notNull(),  // exact request body for replay
  status: varchar("status").default("pending"),  // pending | running | succeeded | partial | failed
  resultSummary: jsonb("result_summary"),
  // { succeeded: 47, failed: 2, errors: [{obligationId, message}] }
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  companyId: varchar("company_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  uniqueIndex("close_batch_ops_idem_uq").on(t.companyId, t.operationType, t.idempotencyKey),
  index("close_batch_ops_period_idx").on(t.periodId, t.createdAt),
]);
```

---

## 3. Existing tables — column additions

### 3.1 `period_close` — add SLA + sign-off chain

```ts
// Add to periodClose:
cutoffAt: timestamp("cutoff_at"),
closeDay: integer("close_day"),                    // current day of close (e.g. 3)
closeTargetDay: integer("close_target_day"),       // SLA target (e.g. 5)
slaState: varchar("sla_state").default("on_track"), // on_track | at_risk | late
preparedBy: varchar("prepared_by").references(() => users.id, { onDelete: 'set null' }),
preparedAt: timestamp("prepared_at"),
reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: 'set null' }),
reviewedAt: timestamp("reviewed_at"),
lockedBy: varchar("locked_by").references(() => users.id, { onDelete: 'set null' }),
lockedAt: timestamp("locked_at"),
```

### 3.2 `period_close_blockers` — assignment + AI provenance

Closes the known gap (`assignee_user_id` missing) and adds AI provenance.

```ts
// Add to periodCloseBlockers:
assigneeUserId: varchar("assignee_user_id").references(() => users.id, { onDelete: 'set null' }),
assignedAt: timestamp("assigned_at"),
proposedByAi: boolean("proposed_by_ai").default(false),
proposedDecisionId: varchar("proposed_decision_id").references(() => closeDecisions.id, { onDelete: 'set null' }),
relatedObligationIds: text("related_obligation_ids").array(),  // multi-obligation blockers
resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: 'set null' }),
resolvedAt: timestamp("resolved_at"),
resolutionNote: text("resolution_note"),
```

### 3.3 `period_close_audit_trail` — distinguish AI from human actors

```ts
// Add to periodCloseAuditTrail:
actorType: varchar("actor_type").default("user"),  // user | ai | system
userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
sourceDecisionId: varchar("source_decision_id").references(() => closeDecisions.id, { onDelete: 'set null' }),
sourceBatchOperationId: varchar("source_batch_operation_id"),
metadata: jsonb("metadata"),  // arbitrary structured detail
```

---

## 4. The composite query that powers the Worksheet grid

The single biggest backend question: *what does one row in the Worksheet look like?*

A row is **one obligation**, joined to its stage state. The query is roughly:

```sql
SELECT
  o.id, o.contract_id, o.partner_name, o.kind, o.amount, o.outstanding_amount,
  o.status, o.funding_period, o.due_at, o.dispute_state,
  c.name AS contract_name, c.flow_type,
  -- Stage projections (one column per pipeline stage, NULL if not at that stage)
  a.status        AS accrual_status,        a.ai_confidence,
  je.je_stage     AS je_status,             je.balanced AS je_balanced,
  s.settlement_status,                       s.match_status,
  ic.status       AS claim_status,          ic.dispute_state AS claim_dispute,
  d.status        AS deduction_status,
  fd.status       AS invoice_status,        fd.oracle_status,
  -- Aggregate flags
  EXISTS (SELECT 1 FROM period_close_blockers b
            WHERE o.id = ANY(b.related_obligation_ids) AND NOT b.resolved) AS has_blocker,
  EXISTS (SELECT 1 FROM close_decisions cd
            WHERE o.id = ANY(cd.affected_obligation_ids) AND cd.status='pending') AS has_pending_decision
FROM obligations o
JOIN contracts c           ON c.id = o.contract_id
LEFT JOIN accruals a       ON a.accrual_id = o.source_accrual_id
LEFT JOIN journal_entries je ON je.id = o.linked_journal_entry_id
LEFT JOIN settlements s    ON s.contract_id = o.contract_id AND s.period = $period
LEFT JOIN inbound_claims ic ON ic.contract_id = o.contract_id AND ic.period = $period
LEFT JOIN deductions d     ON d.contract_id = o.contract_id AND d.period = $period  -- exact join condition TBD per deductions schema
LEFT JOIN finance_documents fd ON fd.contract_id = o.contract_id AND fd.period = $period
WHERE o.funding_period = $period
  AND o.company_id = $companyId
  AND ($filters)
ORDER BY <user-chosen sort>
LIMIT $pageSize OFFSET $cursor;
```

**Indexes that need to exist** (most already do):
- `obligations(company_id, funding_period)` — composite — **needs to be added**
- `obligations(contract_id)` ✓
- `obligations(status)` ✓
- `accruals(accrual_id)` ✓ (unique)
- `journal_entries(id)` ✓ (PK)
- `settlements(contract_id, period)` — composite — **needs to be added**
- `inbound_claims(contract_id, period)` — composite — **needs to be added**
- `finance_documents(contract_id, period)` — composite — **needs to be added**
- `period_close_blockers(period_id, resolved) INCLUDE (related_obligation_ids)` — for the EXISTS — **add as supporting index**

For periods of ~150 obligations the join is cheap. For tenants with 10k+ obligations per period we should consider a materialized view refreshed at filter-change time, but that's a phase-2 optimization.

---

## 5. API endpoints

All endpoints scope to the active company via the existing auth middleware. All take `:periodId` from the route. All write endpoints accept `Idempotency-Key` header, persisted to `close_batch_operations`.

### 5.1 Read — powers the grid + insights strip

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/finance/period/:id/obligations` | Paginated grid rows (the composite query above). Query params: `flow`, `status[]`, `pipelineStage[]`, `hasBlocker`, `partner[]`, `search`, `sort`, `cursor`, `limit`. |
| `GET` | `/api/finance/period/:id/insights` | `{ contractsByFlow: [...], periodVsPeriod: {yoy, mom, ytd, sparkline}, pinnedKpis: [...] }` |
| `GET` | `/api/finance/period/:id/pipeline-summary` | The 9-stage funnel counts + `% complete` per stage |
| `GET` | `/api/finance/period/:id/blockers` | Existing `period_close_blockers` (extended) — with assignee, AI flag |

### 5.2 Write — batch actions (used by both Worksheet and Co-Pilot)

| Method | Path | Body |
|---|---|---|
| `POST` | `/api/finance/batch/post-jes` | `{ obligationIds: string[], periodId, dryRun?: boolean }` |
| `POST` | `/api/finance/batch/settle` | `{ obligationIds, settlementMethod, periodId }` |
| `POST` | `/api/finance/batch/resolve-claims` | `{ claimIds, resolution: 'approve'|'reject'|'partial', notes? }` |
| `POST` | `/api/finance/batch/apply-deductions` | `{ deductionIds, action }` |
| `POST` | `/api/finance/batch/reverse-accruals` | `{ accrualIds, reason }` |

All return `{ batchOperationId, status, resultSummary }` and idempotently return the same response on retry with the same `Idempotency-Key`.

### 5.3 Lock — the critical-blocker guard (existing endpoint, hardened)

`POST /api/period-close/:id/approve` (already exists) — add server-side guard:

```ts
// Pseudocode — add at top of handler:
const criticalBlockers = await storage.getCriticalUnresolvedBlockers(periodId);
if (criticalBlockers.length > 0) {
  return res.status(409).json({
    error: 'CRITICAL_BLOCKERS_PRESENT',
    blockers: criticalBlockers.map(b => ({ id: b.id, title: b.title })),
    message: `Cannot lock period — ${criticalBlockers.length} critical blocker(s) unresolved.`,
  });
}
```

Also: hardcoded COA defaults at financeRoutes.ts:37-39 (`2150` / `4000`) should move to `company_settings.defaultAccrualLiabilityAccount` / `defaultAccrualExpenseAccount` (already an existing table, just needs columns).

### 5.4 AI — the new surface area

| Method | Path | Body / Returns |
|---|---|---|
| `POST` | `/api/finance/kpi-ask` | `{ prompt, periodId }` → `{ value, comparison, interpretation, severity, suggestedChart, queryPlan }` (so the result can be pinned). |
| `POST` | `/api/finance/kpi-ask/:resultId/pin` | Pins the most recent ask to `pinned_kpis`. |
| `GET` | `/api/finance/pinned-kpis` | Returns user-scope + company-scope pins for current user. |
| `DELETE` | `/api/finance/pinned-kpis/:id` | Unpin. |

### 5.5 Co-Pilot — chat threads + decision queue

| Method | Path | Body / Returns |
|---|---|---|
| `POST` | `/api/finance/period/:id/copilot/threads` | `{ scopeFilter? }` → new thread |
| `GET` | `/api/finance/period/:id/copilot/threads` | List threads for current user in this period |
| `GET` | `/api/finance/copilot/threads/:tid/messages` | Cursor-paginated messages |
| `POST` | `/api/finance/copilot/threads/:tid/messages` | `{ content }` — streams the assistant response over SSE; persists user + assistant messages and any `close_decisions` rows |
| `GET` | `/api/finance/period/:id/decisions` | The Decision Queue — filter by status |
| `POST` | `/api/finance/decisions/:id/approve` | Approves a pending decision and dispatches to the right batch endpoint with the decision's `payload` |
| `POST` | `/api/finance/decisions/:id/reject` | `{ reason }` |
| `DELETE` | `/api/finance/copilot/threads/:tid` | Archive (soft) |

### 5.6 Saved views + cross-mode handoff

| Method | Path | |
|---|---|---|
| `GET` | `/api/finance/views` | Lists user + company saved views |
| `POST` | `/api/finance/views` | Save a view |
| `PATCH` | `/api/finance/views/:id` | Update |
| `DELETE` | `/api/finance/views/:id` | Delete |
| `POST` | `/api/finance/views/handoff` | `{ fromMode, toMode, filters, selectedObligationIds }` → `{ handoffId }` (5-min TTL) |
| `GET` | `/api/finance/views/handoff/:id` | Consumed once when destination view loads |

---

## 6. AI tool definitions (for Co-Pilot's LLM)

The Co-Pilot LLM needs tools to actually do things. We expose a tight allow-list — every tool maps 1:1 to either a read endpoint or a `close_decisions` row creation. **The LLM never directly calls a write endpoint;** it always proposes a decision that a human approves.

| Tool name | Maps to | Notes |
|---|---|---|
| `query_obligations` | GET /obligations | Read-only |
| `get_period_insights` | GET /insights | Read-only |
| `get_obligation_detail` | new endpoint | Read-only |
| `propose_post_jes` | creates `close_decisions(action_type='post_jes')` | Pending → human approves |
| `propose_settle` | creates `close_decisions(action_type='settle_obligations')` | Pending |
| `propose_resolve_claim` | creates `close_decisions(action_type='resolve_claims')` | Pending |
| `propose_hold_for_review` | creates `close_decisions(action_type='hold_for_review')` | Pending |
| `propose_flag_blocker` | creates `close_decisions(action_type='flag_blocker')` → on approve, writes to `period_close_blockers` | Pending |
| `request_info_from_user` | inline — model asks user a question, no decision row | |

A "high-trust" mode (auto-approve low-risk decisions) is **out of scope for v1**. Every decision requires explicit approval.

---

## 7. Migration strategy

1. **Schema additions only** — the 6 new tables and column additions to existing tables are all additive. No type changes, no destructive ALTERs.
2. Run `npm run db:push --force` to sync.
3. Backfill `period_close.cutoffAt`, `closeDay`, `closeTargetDay`, `slaState` from existing periods (default `closeTargetDay=5`, compute `slaState` from the gap).
4. Backfill `period_close_audit_trail.actorType='user'` for all existing rows.
5. No backfill needed for the new tables — they fill organically.

---

## 8. Build sequencing (matches the phased rollout)

| Phase | What | Tables touched | Endpoints |
|---|---|---|---|
| **1a** | Composite query + grid | `obligations` (index add) | `GET /obligations`, `GET /pipeline-summary` |
| **1b** | Insights strip | none new | `GET /insights` |
| **1c** | Batch actions + idempotency | `close_batch_operations` | `POST /batch/*` |
| **1d** | Lock guard + sign-off | `period_close` (cols), `period_close_blockers` (assignee), `period_close_audit_trail` (actor) | harden existing `/approve` |
| **2** | Ask LedgerIQ | `pinned_kpis` | `POST /kpi-ask`, pin endpoints |
| **3a** | Co-Pilot threads + messages | `close_chat_threads`, `close_chat_messages` | thread/message endpoints (SSE) |
| **3b** | Decision Queue + tools | `close_decisions` | decision endpoints + LLM tool registration |
| **4** | View handoff | `close_saved_views` | view + handoff endpoints |

Phases 1a–1d ship the Worksheet on real data. Phases 2–4 layer the AI on top.

---

## 9. Locked design decisions

| # | Decision | Rationale |
|---|---|---|
| **1** | **Pins** default to `scope='user'` (private) with explicit "Share with team" promotion to `scope='company'`. **Threads** are always private to the creator, no sharing in v1. **Decisions** are company-visible. A `role:close_auditor` permission can read all threads / decisions for SOX evidence pulls (hidden in UI by default). | Removes the chilling effect on AI exploration; keeps AI's audit trail visible to those who need it. |
| **2** | **Decisions expire** at the earliest of: (a) 12 hours after creation, (b) the period being locked, (c) any obligation in `affectedObligationIds` being modified after the decision was created (lazy-marked `superseded` on next read). Per-company TTL override deferred to v2. | Subledger data goes stale fast — a "post 49 JEs" proposal is wrong if a late accrual lands overnight. Lock cascade is the safety belt. |
| **3** | **Claude Sonnet** primary for chat + tool use + structured KPI generation. **Claude Haiku** for cheap utility (thread titles). **gpt-4o** as visible fallback on Anthropic 5xx / rate-limit (chat surfaces "Answered by GPT-4o (Claude unavailable)"). | One-provider simplicity for v1. Anthropic tool-use accuracy is materially better. Visible (never silent) fallback so quality regressions get reported. |
| **4** | **SSE** for Co-Pilot streaming responses *and* for decision-queue updates (piggybacks on the chat connection). **30s polling** via react-query for grid freshness; **60s polling** for the period dashboard. WebSockets deferred until v3 collaboration features (presence, live cursors). | SSE works through reverse proxies, no new infra. WebSockets pay operational cost (reconnects, heartbeats, presence) for no v1 user-facing benefit. |
| **5** | **Two-tier KPI flow.** `kpi-ask` returns `{ naturalLanguageAnswer, citedObligationIds[], suggestedChart }` — fast, conversational, citations are clickable for verification. **Pinning** additionally requires the model to emit a constrained `queryPlan` (`{aggregation, dimensions[], filters[], metric, comparison?}`) that the server evaluates deterministically — no LLM in the dashboard hot path. If model can't emit a valid plan, the pin is rejected with a "try a more specific question" message. | Exploration must be fast and forgiving; pinned production metrics must be deterministic, cheap, and immune to model drift. Bounds the LLM bill — pins re-execute as queries, not inferences. |

### Schema implications of the locked decisions

The locked decisions tighten a few of the columns in §2 and §3 above:

- `pinned_kpis.scope` defaults to `'user'` (already specified) — `'company'` requires an explicit promotion endpoint.
- `close_chat_threads.modelProvider` / `modelName` get populated **per assistant message** (not just at thread creation) so a Claude→OpenAI fallback within a thread is auditable. Add `model_provider` and `model_name` to `close_chat_messages` (assistant rows only).
- `close_decisions` gets `supersededReason text` and `supersededAt timestamp` columns; the lazy supersession check writes them on read.
- `close_decisions.expiresAt` defaults to `created_at + interval '12 hours'` server-side at insert time; the period-lock handler force-expires all pending decisions for the period.
- A new `auditor` capability is added to the existing role/permission system (out of scope for this doc — handled in `roles` / `navigationPermissions`).

These edits are folded into §2 and §3 and need no further sign-off.
