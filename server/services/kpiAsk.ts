import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { sql } from "drizzle-orm";

// =====================================================================
// Ask LedgerIQ — two-tier KPI flow per docs/period-close-data-model.md
// §5.4 + locked decision §9 #5.
//
// Tier 1 (chat): user asks a question, model returns a natural-language
//   answer + cited obligation IDs + suggested chart. Fast and conversational.
//
// Tier 2 (pin): user clicks "Pin" → model MUST have emitted a constrained
//   queryPlan that the server can re-execute deterministically. No LLM in
//   the dashboard hot path. If the question can't be reduced to a query
//   plan, the pin button is disabled (canPin=false).
//
// Provider chain (locked decision §9 #3):
//   1. Anthropic Claude Sonnet 4.5 (primary)
//   2. OpenAI gpt-4o (visible fallback on Anthropic 5xx / rate-limit)
//   The response stamps `modelProvider/modelName` so the UI can render
//   "Answered by GPT-4o (Claude unavailable)".
// =====================================================================

// ---------------------------------------------------------------------
// QueryPlan — the constrained, server-evaluable shape.
// ---------------------------------------------------------------------

const ALLOWED_AGGREGATIONS = new Set(["sum", "count", "avg", "count_distinct"]);
const ALLOWED_METRICS = new Set(["amount", "outstanding_amount"]);
const ALLOWED_DIMENSIONS = new Set([
  "flow_type_code",
  "status",
  "kind",
  "partner_name",
  "currency",
]);
const ALLOWED_FILTER_FIELDS = new Set([
  "flow_type_code",
  "status",
  "kind",
  "partner_name",
  "currency",
  "outstanding_amount",
  "amount",
]);
const ALLOWED_FILTER_OPS = new Set(["eq", "in", "gt", "gte", "lt", "lte"]);
const ALLOWED_COMPARISONS = new Set(["mom", "yoy", "ytd"]);

export interface QueryPlanFilter {
  field: string;
  op: string;
  value: any;
}

export interface QueryPlan {
  source: "obligations";
  aggregation: string;
  metric?: string;
  dimensions?: string[];
  filters?: QueryPlanFilter[];
  comparison?: string | null;
}

export class QueryPlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryPlanValidationError";
  }
}

/**
 * Validate a queryPlan against the strict allowlist. Throws on any shape
 * the executor doesn't know how to evaluate safely. Pure function — no IO.
 */
export function validateQueryPlan(plan: any): QueryPlan {
  if (!plan || typeof plan !== "object") {
    throw new QueryPlanValidationError("queryPlan must be an object");
  }
  if (plan.source !== "obligations") {
    throw new QueryPlanValidationError(
      `queryPlan.source must be 'obligations' (got '${plan.source}')`,
    );
  }
  if (!ALLOWED_AGGREGATIONS.has(plan.aggregation)) {
    throw new QueryPlanValidationError(
      `queryPlan.aggregation must be one of ${Array.from(ALLOWED_AGGREGATIONS).join(", ")}`,
    );
  }
  if (plan.aggregation !== "count" && plan.aggregation !== "count_distinct") {
    if (!plan.metric || !ALLOWED_METRICS.has(plan.metric)) {
      throw new QueryPlanValidationError(
        `queryPlan.metric required for aggregation '${plan.aggregation}'; must be one of ${Array.from(ALLOWED_METRICS).join(", ")}`,
      );
    }
  }
  if (plan.aggregation === "count_distinct") {
    if (!plan.metric || !ALLOWED_DIMENSIONS.has(plan.metric)) {
      throw new QueryPlanValidationError(
        `queryPlan.metric for count_distinct must be a dimension column; got '${plan.metric}'`,
      );
    }
  }
  if (plan.dimensions !== undefined) {
    if (!Array.isArray(plan.dimensions)) {
      throw new QueryPlanValidationError("queryPlan.dimensions must be an array");
    }
    for (const d of plan.dimensions) {
      if (!ALLOWED_DIMENSIONS.has(d)) {
        throw new QueryPlanValidationError(`Disallowed dimension '${d}'`);
      }
    }
  }
  if (plan.filters !== undefined) {
    if (!Array.isArray(plan.filters)) {
      throw new QueryPlanValidationError("queryPlan.filters must be an array");
    }
    for (const f of plan.filters) {
      if (!f || typeof f !== "object") {
        throw new QueryPlanValidationError("Each filter must be an object");
      }
      if (!ALLOWED_FILTER_FIELDS.has(f.field)) {
        throw new QueryPlanValidationError(`Disallowed filter field '${f.field}'`);
      }
      if (!ALLOWED_FILTER_OPS.has(f.op)) {
        throw new QueryPlanValidationError(`Disallowed filter op '${f.op}'`);
      }
      if (f.op === "in" && !Array.isArray(f.value)) {
        throw new QueryPlanValidationError(`Filter op 'in' requires array value`);
      }
    }
  }
  if (plan.comparison !== undefined && plan.comparison !== null) {
    if (!ALLOWED_COMPARISONS.has(plan.comparison)) {
      throw new QueryPlanValidationError(
        `queryPlan.comparison must be one of ${Array.from(ALLOWED_COMPARISONS).join(", ")} or null`,
      );
    }
  }
  return plan as QueryPlan;
}

/**
 * Build a parameterized SQL fragment for a single filter. The field name
 * comes from a closed allowlist (see ALLOWED_FILTER_FIELDS), so direct
 * interpolation is safe. Values are always parameterized.
 *
 * Joined-table fields (currently `flow_type_code`) are resolved via
 * `contracts → flow_types` join in the caller.
 */
function buildFilterSql(f: QueryPlanFilter) {
  const colExpr = filterColumnExpr(f.field);
  switch (f.op) {
    case "eq":
      return sql`${colExpr} = ${f.value}`;
    case "in":
      return sql`${colExpr} = ANY(${f.value})`;
    case "gt":
      return sql`${colExpr} > ${f.value}`;
    case "gte":
      return sql`${colExpr} >= ${f.value}`;
    case "lt":
      return sql`${colExpr} < ${f.value}`;
    case "lte":
      return sql`${colExpr} <= ${f.value}`;
    default:
      throw new QueryPlanValidationError(`Unhandled filter op '${f.op}'`);
  }
}

function filterColumnExpr(field: string) {
  switch (field) {
    case "flow_type_code":
      return sql`c.flow_type_code`;
    case "partner_name":
      return sql`o.partner_name`;
    case "status":
      return sql`o.status`;
    case "kind":
      return sql`o.kind`;
    case "currency":
      return sql`o.currency`;
    case "amount":
      return sql`o.amount`;
    case "outstanding_amount":
      return sql`o.outstanding_amount`;
    default:
      throw new QueryPlanValidationError(`Unmapped filter column '${field}'`);
  }
}

function dimensionExpr(dim: string) {
  switch (dim) {
    case "flow_type_code":
      return { select: sql`c.flow_type_code AS dim_${sql.raw(dim)}`, group: sql`c.flow_type_code` };
    case "partner_name":
      return { select: sql`o.partner_name AS dim_${sql.raw(dim)}`, group: sql`o.partner_name` };
    case "status":
      return { select: sql`o.status AS dim_${sql.raw(dim)}`, group: sql`o.status` };
    case "kind":
      return { select: sql`o.kind AS dim_${sql.raw(dim)}`, group: sql`o.kind` };
    case "currency":
      return { select: sql`o.currency AS dim_${sql.raw(dim)}`, group: sql`o.currency` };
    default:
      throw new QueryPlanValidationError(`Unmapped dimension '${dim}'`);
  }
}

function aggregationExpr(plan: QueryPlan) {
  switch (plan.aggregation) {
    case "sum":
      return sql`COALESCE(SUM(${filterColumnExpr(plan.metric!)}), 0)`;
    case "avg":
      return sql`COALESCE(AVG(${filterColumnExpr(plan.metric!)}), 0)`;
    case "count":
      return sql`COUNT(*)`;
    case "count_distinct":
      return sql`COUNT(DISTINCT ${filterColumnExpr(plan.metric!)})`;
    default:
      throw new QueryPlanValidationError(`Unhandled aggregation '${plan.aggregation}'`);
  }
}

export interface QueryPlanResult {
  value: number | string;
  breakdown?: Array<Record<string, any>>;
  comparison?: { current: number; prior: number; deltaPct: number | null; basis: string };
}

/**
 * Evaluate a validated queryPlan against the obligations table for the
 * given period. Always scoped to `funding_period = :periodLabel` (the
 * server passes the resolved period label so the LLM never controls
 * which period is queried).
 */
export async function evaluateQueryPlan(
  plan: QueryPlan,
  periodLabel: string,
  companyId: string | null,
  priorPeriodLabel?: string | null,
): Promise<QueryPlanResult> {
  const validated = validateQueryPlan(plan);

  const wheres: any[] = [sql`o.funding_period = ${periodLabel}`];
  if (companyId) {
    wheres.push(sql`c.company_id = ${companyId}`);
  }
  for (const f of validated.filters ?? []) {
    wheres.push(buildFilterSql(f));
  }
  const whereSql = wheres.reduce((acc, w, i) =>
    i === 0 ? w : sql`${acc} AND ${w}`,
  );

  const dims = validated.dimensions ?? [];
  const dimExprs = dims.map(dimensionExpr);
  const aggExpr = aggregationExpr(validated);

  let query;
  if (dims.length === 0) {
    query = sql`
      SELECT ${aggExpr} AS value
      FROM obligations o
      LEFT JOIN contracts c ON c.id = o.contract_id

      WHERE ${whereSql}
    `;
  } else {
    const selectList = dimExprs
      .map((d) => d.select)
      .reduce((a, b) => sql`${a}, ${b}`);
    const groupList = dimExprs
      .map((d) => d.group)
      .reduce((a, b) => sql`${a}, ${b}`);
    query = sql`
      SELECT ${selectList}, ${aggExpr} AS value
      FROM obligations o
      LEFT JOIN contracts c ON c.id = o.contract_id

      WHERE ${whereSql}
      GROUP BY ${groupList}
      ORDER BY value DESC NULLS LAST
      LIMIT 100
    `;
  }

  const rows: any[] = (await db.execute(query)).rows as any[];

  let value: number | string = 0;
  let breakdown: Array<Record<string, any>> | undefined;
  if (dims.length === 0) {
    value = Number(rows[0]?.value ?? 0);
  } else {
    breakdown = rows.map((r) => {
      const o: Record<string, any> = { value: Number(r.value ?? 0) };
      for (const d of dims) o[d] = r[`dim_${d}`];
      return o;
    });
    value = breakdown.reduce((sum, r) => sum + (r.value ?? 0), 0);
  }

  let comparison: QueryPlanResult["comparison"];
  if (validated.comparison && priorPeriodLabel) {
    const priorWheres = wheres.slice();
    priorWheres[0] = sql`o.funding_period = ${priorPeriodLabel}`;
    const priorWhereSql = priorWheres.reduce((acc, w, i) =>
      i === 0 ? w : sql`${acc} AND ${w}`,
    );
    const priorRows: any[] = (
      await db.execute(sql`
        SELECT ${aggExpr} AS value
        FROM obligations o
        LEFT JOIN contracts c ON c.id = o.contract_id

        WHERE ${priorWhereSql}
      `)
    ).rows as any[];
    const prior = Number(priorRows[0]?.value ?? 0);
    const current = typeof value === "number" ? value : Number(value);
    comparison = {
      current,
      prior,
      deltaPct: prior === 0 ? null : ((current - prior) / prior) * 100,
      basis: validated.comparison,
    };
  }

  return { value, breakdown, comparison };
}

// ---------------------------------------------------------------------
// LLM call — Claude primary, OpenAI fallback.
// ---------------------------------------------------------------------

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "",
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const SYSTEM_PROMPT = `You are LedgerIQ, the finance copilot inside a license-accounting period close workspace.
The user is asking a question about a specific accounting period. Answer concisely (1–2 sentences) and ground every claim in the data snapshot below — never invent numbers.

Always respond with a single JSON object matching this schema:
{
  "naturalLanguageAnswer": string,        // 1-2 sentences, plain English
  "citedObligationIds": string[],         // up to 10 obligation IDs you used
  "suggestedChart": "number" | "bar" | "line" | "sparkline" | "concentration",
  "severity": "info" | "warning" | "alert",
  "queryPlan": null | {                   // ONLY include if the answer is a deterministic aggregation over obligations
    "source": "obligations",
    "aggregation": "sum" | "count" | "avg" | "count_distinct",
    "metric": "amount" | "outstanding_amount",   // required unless aggregation is "count"; for "count_distinct" use a dimension name
    "dimensions": string[],               // optional, subset of: flow_type_code, status, kind, partner_name, currency
    "filters": [                          // optional
      { "field": "flow_type_code"|"status"|"kind"|"partner_name"|"currency"|"outstanding_amount"|"amount",
        "op": "eq"|"in"|"gt"|"gte"|"lt"|"lte",
        "value": any }
    ],
    "comparison": null | "mom" | "yoy" | "ytd"
  }
}

Rules for queryPlan:
- Only emit a queryPlan if the question is a clean aggregation over the obligations table (e.g. "total outstanding for partner X", "count of accruals by flow type"). Conversational follow-ups, comparisons across non-aggregable fields, or qualitative questions should set queryPlan = null.
- Do NOT include period filters in queryPlan — the server always scopes to the current period.
- Severity guidance: 'alert' = blocks close (missing data, broken JE, > $100k variance); 'warning' = needs attention but doesn't block; 'info' = informational.

Reply with ONLY the JSON object — no prose, no markdown fences.`;

export interface AskResult {
  resultId: string;
  naturalLanguageAnswer: string;
  citedObligationIds: string[];
  suggestedChart: string;
  severity: string;
  queryPlan: QueryPlan | null;
  canPin: boolean;
  pinRejectionReason?: string;
  modelProvider: "anthropic" | "openai";
  modelName: string;
  // Pre-evaluated value so the chat tile can render immediately without
  // a second roundtrip. Only populated when canPin=true.
  evaluatedResult?: QueryPlanResult;
}

interface AskOptions {
  prompt: string;
  periodId: string;
  periodLabel: string;
  contextSnapshot: any;
  priorPeriodLabel?: string | null;
  companyId: string | null;
}

function parseModelJson(text: string): any {
  // Models occasionally wrap JSON in ```json ... ``` despite instructions.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

async function callAnthropic(prompt: string, contextJson: string) {
  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `# Period snapshot\n${contextJson}\n\n# Question\n${prompt}`,
      },
    ],
  });
  const block = resp.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Anthropic returned no text block");
  }
  return { raw: block.text, modelName: resp.model };
}

async function callOpenAI(prompt: string, contextJson: string) {
  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `# Period snapshot\n${contextJson}\n\n# Question\n${prompt}`,
      },
    ],
  });
  const text = resp.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned no content");
  return { raw: text, modelName: resp.model };
}

/**
 * Determines whether a Claude failure should fall through to OpenAI.
 * Per locked decision §9 #3 we fall back on 5xx, rate-limit, and
 * connection errors — not on 4xx auth/validation errors.
 */
function shouldFallback(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  if (status && status >= 500) return true;
  if (status === 429) return true;
  const code = err?.code ?? err?.cause?.code;
  if (typeof code === "string" && /^(ECONN|ETIMEDOUT|ENOTFOUND)/.test(code)) return true;
  return false;
}

// In-memory result cache. Pin endpoint reads from here, so the resultId
// the client gets back is meaningful only within this server process for
// 30 minutes. Sufficient for the "ask → pin" flow which is single-user
// and synchronous; restart loses pending pins (acceptable trade-off).
const RESULT_TTL_MS = 30 * 60 * 1000;
const resultCache = new Map<string, { result: AskResult; expiresAt: number }>();

function cacheResult(result: AskResult) {
  resultCache.set(result.resultId, { result, expiresAt: Date.now() + RESULT_TTL_MS });
  // Lazy cleanup — keep the map bounded.
  if (resultCache.size > 1000) {
    const now = Date.now();
    resultCache.forEach((v, k) => {
      if (v.expiresAt < now) resultCache.delete(k);
    });
  }
}

export function getCachedAskResult(resultId: string): AskResult | null {
  const entry = resultCache.get(resultId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    resultCache.delete(resultId);
    return null;
  }
  return entry.result;
}

export async function askLedgerIQ(opts: AskOptions): Promise<AskResult> {
  const contextJson = JSON.stringify(opts.contextSnapshot, null, 0);

  let raw: string;
  let modelName: string;
  let modelProvider: "anthropic" | "openai" = "anthropic";

  try {
    const r = await callAnthropic(opts.prompt, contextJson);
    raw = r.raw;
    modelName = r.modelName;
  } catch (err) {
    if (!shouldFallback(err)) throw err;
    console.warn("[kpi-ask] Claude failed, falling back to OpenAI:", (err as any)?.message);
    const r = await callOpenAI(opts.prompt, contextJson);
    raw = r.raw;
    modelName = r.modelName;
    modelProvider = "openai";
  }

  let parsed: any;
  try {
    parsed = parseModelJson(raw);
  } catch (e) {
    throw new Error(`Model returned invalid JSON: ${(e as Error).message}`);
  }

  const result: AskResult = {
    resultId: randomUUID(),
    naturalLanguageAnswer: String(parsed.naturalLanguageAnswer ?? ""),
    citedObligationIds: Array.isArray(parsed.citedObligationIds)
      ? parsed.citedObligationIds.slice(0, 10).map(String)
      : [],
    suggestedChart: ["number", "bar", "line", "sparkline", "concentration"].includes(
      parsed.suggestedChart,
    )
      ? parsed.suggestedChart
      : "number",
    severity: ["info", "warning", "alert"].includes(parsed.severity)
      ? parsed.severity
      : "info",
    queryPlan: null,
    canPin: false,
    modelProvider,
    modelName,
  };

  if (parsed.queryPlan && typeof parsed.queryPlan === "object") {
    try {
      const plan = validateQueryPlan(parsed.queryPlan);
      result.queryPlan = plan;
      // Pre-evaluate so the chat UI can render the answer with the actual
      // number alongside the natural-language sentence.
      try {
        result.evaluatedResult = await evaluateQueryPlan(
          plan,
          opts.periodLabel,
          opts.companyId,
          opts.priorPeriodLabel ?? null,
        );
        result.canPin = true;
      } catch (evalErr) {
        result.canPin = false;
        result.pinRejectionReason = `Could not evaluate plan: ${(evalErr as Error).message}`;
      }
    } catch (validationErr) {
      result.canPin = false;
      result.pinRejectionReason = (validationErr as Error).message;
    }
  } else {
    result.pinRejectionReason =
      "This answer isn't a deterministic aggregation — try a more specific question (e.g. 'sum of outstanding accruals by flow type').";
  }

  cacheResult(result);
  return result;
}
