import { useEffect, useMemo, useState } from "react";
import {
  QUALIFIER_FIELDS,
  type Condition,
  type QualifierFieldCode,
} from "@shared/qualifierRegistry";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import SalesRowsTable, {
  formatSalesMoney,
  tallySalesRows,
  type SalesRowRecord,
} from "@/components/SalesRowsTable";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Calculator,
  TrendingUp,
  Tag,
  Link2,
  History,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  Sparkles,
  AlertTriangle,
  Info,
  ArrowRight,
  CheckCircle2,
  Download,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  RULE_TYPES_BY_PHASE,
  OBLIGATION_ACCRUAL_RULE_TYPES,
  RULE_TYPE_TO_OBLIGATION_KIND,
  resolveCalcPhase,
  canonicalizeRuleType,
} from "@shared/calcPhases";
import { Wallet } from "lucide-react";

const EXECUTION_GROUPS = [
  { value: "periodic", label: "Periodic — runs every period (monthly/quarterly fees)" },
  { value: "event", label: "Event — triggered by a specific event (milestones, advances)" },
  { value: "adjustment", label: "Adjustment — modifies other rules' results (caps, MGs, deductions)" },
];

const BASE_METRICS = [
  { value: "net_sales", label: "Net Sales" },
  { value: "gross_sales", label: "Gross Sales" },
  { value: "net_revenue", label: "Net Revenue" },
  { value: "gross_revenue", label: "Gross Revenue" },
  { value: "units", label: "Units Sold" },
  { value: "invoice_amount", label: "Invoice Amount" },
  { value: "custom", label: "Custom Field" },
  { value: "other", label: "Other" },
  { value: "not_applicable", label: "Not applicable" },
];

// Rule types that operate on a sales-side amount and therefore REQUIRE a real
// base metric (net_sales / units / etc). Everything else — adjustments,
// offsets, floors, caps, penalties, obligation accruals, payment schedules —
// computes against prior totals or fixed amounts and should accept
// "Not applicable" without tripping the validation banner.
const RULE_TYPES_REQUIRING_BASE_METRIC = new Set([
  "percentage",
  "tiered",
  "per_unit",
  "rebate_rate",
  "rate_structure",
  "formula_based",
  "category_percentage",
]);

// Rule types whose calc engine actually aggregates sales over a window
// (per_period / per_contract). Aggregation Period must be set for these so
// the engine knows the bucket size — leaving it blank silently falls back to
// per_sale and produces wrong results for quarterly / annual contracts.
const RULE_TYPES_REQUIRING_AGGREGATION_PERIOD = new Set([
  "percentage", "category_percentage", "rebate_percentage", "rebate_rate",
  "tiered", "rebate_tiered", "milestone_tiered", "rate_structure",
  "per_unit", "formula_based",
  "minimum_guarantee", "annual_minimum", "quarterly_minimum", "mgr",
  "cap", "period_cap", "contract_cap",
]);

// Rule types whose calculation is a fixed dollar floor / payment / penalty
// — base_metric (net_sales / units / etc) is meaningless for these. Hide the
// picker so the editor doesn't suggest a rate-against-sales mental model.
const RULE_TYPES_NO_BASE_METRIC = new Set([
  "minimum_guarantee", "annual_minimum", "quarterly_minimum", "mgr",
  "fixed_fee", "annual_fee", "milestone_payment", "late_payment_penalty",
  "payment_schedule", "signing_bonus", "advance_payment", "recoupable_advance",
]);

const ROLLOVER_POLICIES = [
  { value: "forfeit", label: "Forfeit", desc: "Unused balance is written off at expiry." },
  { value: "rollover", label: "Roll over", desc: "Unused balance carries to the next period." },
  { value: "extend", label: "Extend", desc: "Push the expiry date out instead of forfeiting." },
];

const OBLIGATION_KIND_LABELS: Record<string, string> = {
  mdf: "MDF (market development funds)",
  recoupable_advance: "Recoupable advance",
  returns_reserve: "Returns reserve",
  performance_bonus: "Performance bonus",
  signing_bonus: "Signing bonus",
  milestone_payment: "Milestone payment",
  minimum_trueup: "Minimum true-up",
};

// Per rule-type configuration for the obligation editor: which fields are
// shown, which are required, and what helpful copy to surface. Mirrors the
// fields read by `deriveAccrual` in server/services/obligationsService.ts.
type ObligationKindConfig = {
  amountMode: "fixed" | "rate" | "either";
  amountLabel?: string;
  rateLabel?: string;
  defaultRolloverPolicy: string;
  showPlannedRelease: boolean;
  showExpiry: boolean;
  defaultExpiresAfterDays?: number;
  hint?: string;
};
const OBLIGATION_KIND_CONFIG: Record<string, ObligationKindConfig> = {
  mdf_accrual: {
    amountMode: "either",
    amountLabel: "MDF amount per period",
    rateLabel: "% of period sales",
    defaultRolloverPolicy: "forfeit",
    showPlannedRelease: true,
    showExpiry: true,
    defaultExpiresAfterDays: 90,
    hint: "MDF buckets normally accrue per period and expire if the partner doesn't claim them.",
  },
  recoupable_advance: {
    amountMode: "fixed",
    amountLabel: "Advance amount",
    defaultRolloverPolicy: "forfeit",
    showPlannedRelease: true,
    showExpiry: false,
    hint: "Recoupable advances are paid up-front and netted against future earnings.",
  },
  advance_payment: {
    amountMode: "fixed",
    amountLabel: "Advance amount",
    defaultRolloverPolicy: "forfeit",
    showPlannedRelease: true,
    showExpiry: false,
    hint: "Legacy alias for recoupable advance.",
  },
  returns_reserve: {
    amountMode: "rate",
    rateLabel: "% of period sales reserved",
    defaultRolloverPolicy: "rollover",
    showPlannedRelease: true,
    showExpiry: false,
    hint: "A returns reserve withholds a % of sales each period to cover future returns.",
  },
  reserve_accrual: {
    amountMode: "rate",
    rateLabel: "% of period sales reserved",
    defaultRolloverPolicy: "rollover",
    showPlannedRelease: true,
    showExpiry: false,
    hint: "Legacy alias for returns reserve.",
  },
  performance_bonus: {
    amountMode: "either",
    amountLabel: "Bonus amount when earned",
    rateLabel: "% of period sales (if earned)",
    defaultRolloverPolicy: "forfeit",
    showPlannedRelease: true,
    showExpiry: true,
    hint: "Bonuses accrue when their qualifying conditions are met. They typically expire one year after period close.",
  },
  signing_bonus: {
    amountMode: "fixed",
    amountLabel: "Signing bonus amount",
    defaultRolloverPolicy: "forfeit",
    showPlannedRelease: true,
    showExpiry: true,
    hint: "One-time bonus paid on contract signature. Set the planned release date to schedule it.",
  },
  milestone_payment: {
    amountMode: "fixed",
    amountLabel: "Milestone payment amount",
    defaultRolloverPolicy: "forfeit",
    showPlannedRelease: true,
    showExpiry: true,
    hint: "Stateful milestone payments accrue when the milestone fires and pay on the planned release date.",
  },
  milestone_payment_obligation: {
    amountMode: "fixed",
    amountLabel: "Milestone payment amount",
    defaultRolloverPolicy: "forfeit",
    showPlannedRelease: true,
    showExpiry: true,
    hint: "Stateful milestone payments accrue when the milestone fires and pay on the planned release date.",
  },
  minimum_trueup: {
    amountMode: "either",
    amountLabel: "Fixed true-up amount",
    rateLabel: "% of period shortfall",
    defaultRolloverPolicy: "forfeit",
    showPlannedRelease: true,
    showExpiry: false,
    hint: "Books the gap between the contractual minimum and what the partner actually earned this period.",
  },
};

const TIER_MODES: Array<{ value: string; label: string; desc: string }> = [
  {
    value: "whole",
    label: "Whole-tier",
    desc: "Apply the rate of the highest tier reached to the full volume.",
  },
  {
    value: "marginal",
    label: "Marginal",
    desc: "Apply each tier's rate only to the portion of volume that falls in that band.",
  },
];

type Rule = any;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  rule: Rule | null;
  allQualifiers?: any[];
  onSaved?: () => void;
}

const csvToArr = (s?: string): string[] | undefined => {
  if (s == null) return undefined;
  const arr = String(s)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return arr.length ? arr : undefined;
};

const arrToCsv = (a?: string[] | null): string =>
  Array.isArray(a) ? a.join(", ") : "";

// Escape a single CSV cell — wrap in quotes if it contains a comma, quote,
// newline, or leading/trailing whitespace, and double any embedded quotes.
// Also prefix a leading apostrophe to defuse spreadsheet formula injection
// (=, +, -, @, tab, CR) since some sales fields are user-supplied.
const csvCell = (v: unknown): string => {
  if (v == null) return "";
  let s = String(v);
  // Numeric values (incl. negatives like "-12.34") are safe — only treat
  // a leading -/+ as risky when it isn't actually a number.
  const looksNumeric = /^[+-]?\d+(\.\d+)?$/.test(s);
  if (!looksNumeric && s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

// Build a CSV string mirroring the visible columns of the sales-rows
// drill-down table. Returns are flagged in two ways: a "Type" column (Sale
// vs. Return) and a signed Amount (returns are negative) so spreadsheet
// totals naturally net them out.
function buildSalesRowsCsv(rows: SalesRowRecord[]): string {
  // Columns mirror the visible drill-down table (SalesRowsTable):
  // Date, Type, Product, Category, Channel, Territory, Qty, Amount.
  // The Product cell collapses name + code the same way the UI does
  // (name on top, code in parentheses) so the export is a true mirror.
  const header = [
    "Date",
    "Type",
    "Product",
    "Category",
    "Channel",
    "Territory",
    "Qty",
    "Amount",
  ];
  const isReturn = (r: SalesRowRecord) =>
    String(r.transactionType || "").toLowerCase() === "return";
  const lines = [header.join(",")];
  for (const r of rows) {
    const ret = isReturn(r);
    const amt = Math.abs(Number(r.grossAmount || 0));
    const signed = ret ? -amt : amt;
    const product =
      r.productName && r.productCode
        ? `${r.productName} (${r.productCode})`
        : r.productName || r.productCode || "";
    lines.push(
      [
        csvCell(r.transactionDate ? String(r.transactionDate).slice(0, 10) : ""),
        csvCell(ret ? "Return" : "Sale"),
        csvCell(product),
        csvCell(r.category || ""),
        csvCell(r.channel || ""),
        csvCell(r.territory || ""),
        csvCell(r.quantity != null ? String(r.quantity) : ""),
        csvCell(Number.isFinite(signed) ? signed.toFixed(2) : ""),
      ].join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

function makeInitialForm(rule: Rule | null) {
  if (!rule) {
    return {
      id: null,
      ruleName: "",
      ruleType: "percentage",
      description: "",
      priority: 10,
      isActive: true,
      subtypeInstanceId: "",
      aggregationPeriod: "",
      baseRate: "",
      minimumGuarantee: "",
      baseMetric: "",
      executionGroup: "",
      templateCode: "",
      tierMode: "whole",
      tierBasis: "auto",
      volumeTiers: [] as Array<{ min: string; max: string; rate: string }>,
      seasonalAdjustments: [] as Array<{ key: string; value: string }>,
      territoryPremiums: [] as Array<{ key: string; value: string }>,
      productCategoriesCsv: "",
      territoriesCsv: "",
      formulaDefinition: null,
      sourceText: "",
      confidence: null,
      reviewStatus: "pending",
      sourceClauseId: null,
      // Obligation accrual fields (mirrors `deriveAccrual` in obligationsService).
      oblAmountMode: "fixed" as "fixed" | "rate",
      oblAmount: "",
      oblRate: "",
      oblRateBasis: "percent" as "percent" | "bps" | "decimal",
      oblPlannedReleaseDate: "",
      oblReleaseAfterDays: "",
      oblExpiryDate: "",
      oblExpiresAfterDays: "",
      oblRolloverPolicy: "forfeit",
    };
  }
  const tiers = Array.isArray(rule.volumeTiers)
    ? rule.volumeTiers.map((t: any) => ({
        min: t.min != null ? String(t.min) : "",
        max: t.max != null ? String(t.max) : "",
        rate: t.rate != null ? String(t.rate) : "",
      }))
    : [];
  const objToRows = (o: any) =>
    o && typeof o === "object" && !Array.isArray(o)
      ? Object.entries(o).map(([key, value]) => ({ key, value: String(value) }))
      : [];
  const fd: any = rule.formulaDefinition || {};
  // AI-extracted obligation rules currently nest values under
  // `formulaDefinition.calculation` (and sometimes `.conditions`) using the
  // legacy extractor vocabulary (fixedAmount, installmentAmount, baseRate,
  // bonusRate, dueDate, endDate, ...). Treat those nested objects as
  // fall-throughs so the editor can pre-fill canonical fields without the
  // user having to retype anything the AI already pulled.
  const fdCalc: any = (fd && typeof fd.calculation === "object" && fd.calculation) || {};
  const fdCond: any = (fd && typeof fd.conditions === "object" && fd.conditions) || {};
  const firstDefined = (...vals: any[]) =>
    vals.find((v) => v !== undefined && v !== null && v !== "");
  const dateOnly = (v: any): string => {
    if (!v) return "";
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };
  // Resolve the obligation amount mode. Prefer whichever fd field is
  // populated; otherwise fall back to the kind's default amount mode so
  // rate-only kinds (returns_reserve, reserve_accrual) start in "rate" and
  // fixed-only kinds start in "fixed".
  const fdRawAmount = firstDefined(
    fd.amount,
    fd.fixedAmount,
    fd.periodAccrualAmount,
    fdCalc.amount,
    fdCalc.fixedAmount,
    fdCalc.periodAccrualAmount,
    fdCalc.installmentAmount,
    fdCalc.advanceAmount,
    fdCalc.bonusAmount,
    fdCalc.milestoneAmount,
  );
  const fdRawRate = firstDefined(
    fd.rate,
    fd.percentage,
    fd.bps,
    fdCalc.rate,
    fdCalc.percentage,
    fdCalc.bps,
    fdCalc.baseRate,
    fdCalc.bonusRate,
    fdCalc.reserveRate,
    fdCalc.accrualRate,
  );
  const kindCfgInit = OBLIGATION_KIND_CONFIG[String(rule.ruleType || "").toLowerCase()];
  const kindDefaultMode: "fixed" | "rate" =
    kindCfgInit?.amountMode === "rate" ? "rate" : "fixed";
  const oblAmountMode: "fixed" | "rate" =
    fdRawAmount != null && fdRawAmount !== ""
      ? "fixed"
      : fdRawRate != null && fdRawRate !== ""
      ? "rate"
      : kindDefaultMode;
  // Pick the basis from whichever level actually has the value (top-level fd
  // wins, else nested calculation), so AI rules pre-fill with the right unit.
  const bpsRaw = firstDefined(fd.bps, fdCalc.bps);
  const pctRaw = firstDefined(fd.percentage, fdCalc.percentage);
  const rateRaw = firstDefined(
    fd.rate,
    fdCalc.rate,
    fdCalc.baseRate,
    fdCalc.bonusRate,
    fdCalc.reserveRate,
    fdCalc.accrualRate,
  );
  const oblRateBasis: "percent" | "bps" | "decimal" =
    bpsRaw !== undefined
      ? "bps"
      : pctRaw !== undefined
      ? "percent"
      : rateRaw !== undefined
      ? Number(rateRaw) > 1
        ? "percent"
        : "decimal"
      : "percent";
  const rateValue =
    bpsRaw !== undefined ? bpsRaw : pctRaw !== undefined ? pctRaw : rateRaw;
  const plannedReleaseRaw = firstDefined(
    fd.plannedReleaseDate,
    fdCalc.plannedReleaseDate,
    fdCalc.releaseDate,
    fdCalc.dueDate,
    fdCond.dueDate,
    fdCond.releaseDate,
  );
  const releaseAfterRaw = firstDefined(
    fd.releaseAfterDays,
    fdCalc.releaseAfterDays,
    fdCalc.releaseAfter,
    fdCalc.daysToRelease,
  );
  const expiryRaw = firstDefined(
    fd.expiryDate,
    fdCalc.expiryDate,
    fdCalc.expirationDate,
    fdCalc.endDate,
  );
  const expiresAfterRaw = firstDefined(
    fd.expiresAfterDays,
    fdCalc.expiresAfterDays,
    fdCalc.claimWindowDays,
    fdCalc.expiresAfter,
  );
  const rolloverRaw = firstDefined(
    fd.rolloverPolicy,
    fdCalc.rolloverPolicy,
    fdCalc.rollover,
  );
  return {
    id: rule.id,
    ruleName: rule.ruleName || "",
    ruleType: canonicalizeRuleType(rule.ruleType) || rule.ruleType || "percentage",
    description: rule.description || "",
    priority: rule.priority ?? 10,
    isActive: rule.isActive ?? true,
    subtypeInstanceId: (rule as any).subtypeInstanceId || "",
    aggregationPeriod: ((rule as any).formulaDefinition?.aggregationPeriod ?? "") as string,
    baseRate: rule.baseRate ?? "",
    minimumGuarantee: rule.minimumGuarantee ?? "",
    baseMetric: rule.baseMetric || "",
    executionGroup: rule.executionGroup || "",
    templateCode: rule.templateCode || "",
    tierMode: rule.tierMode || rule.formulaDefinition?.tierMode || "whole",
    tierBasis: rule.tierBasis || rule.formulaDefinition?.tierBasis || "auto",
    volumeTiers: tiers,
    seasonalAdjustments: objToRows(rule.seasonalAdjustments),
    territoryPremiums: objToRows(rule.territoryPremiums),
    productCategoriesCsv: arrToCsv(rule.productCategories),
    territoriesCsv: arrToCsv(rule.territories),
    formulaDefinition: rule.formulaDefinition ?? null,
    sourceText: rule.sourceText || "",
    confidence: rule.confidence ?? null,
    reviewStatus: rule.reviewStatus || "pending",
    sourceClauseId: rule.sourceClauseId || null,
    oblAmountMode,
    oblAmount:
      oblAmountMode === "fixed" && fdRawAmount != null && fdRawAmount !== ""
        ? String(fdRawAmount)
        : "",
    oblRate:
      oblAmountMode === "rate" && rateValue != null && rateValue !== ""
        ? String(rateValue)
        : "",
    oblRateBasis,
    oblPlannedReleaseDate: dateOnly(plannedReleaseRaw),
    oblReleaseAfterDays:
      releaseAfterRaw != null && releaseAfterRaw !== ""
        ? String(releaseAfterRaw)
        : "",
    oblExpiryDate: dateOnly(expiryRaw),
    oblExpiresAfterDays:
      expiresAfterRaw != null && expiresAfterRaw !== ""
        ? String(expiresAfterRaw)
        : "",
    oblRolloverPolicy:
      (rolloverRaw && String(rolloverRaw)) ||
      kindCfgInit?.defaultRolloverPolicy ||
      "forfeit",
  };
}

function buildPayload(form: any) {
  const tiers = (form.volumeTiers || [])
    .filter((t: any) => t.min !== "" || t.max !== "" || t.rate !== "")
    .map((t: any) => ({
      min: t.min === "" ? 0 : Number(t.min),
      ...(t.max === "" ? {} : { max: Number(t.max) }),
      rate: t.rate === "" ? 0 : Number(t.rate),
    }));
  const rowsToObj = (rows: any[]) => {
    const out: Record<string, number> = {};
    (rows || []).forEach((r) => {
      if (r.key && r.value !== "") out[r.key] = Number(r.value);
    });
    return Object.keys(out).length ? out : null;
  };
  // For obligation rule types, fold the dedicated form fields back into
  // formulaDefinition so the calc engine's `deriveAccrual` reads them. We
  // start from the existing FD (preserving anything the AI extracted that the
  // editor doesn't surface) and overwrite only the obligation-controlled
  // keys; we also clear sibling keys so the editor never leaves stale
  // amount/rate values behind when the author switches modes.
  let formulaDefinition: any = form.formulaDefinition ?? null;
  if (OBLIGATION_ACCRUAL_RULE_TYPES.has(String(form.ruleType || "").toLowerCase())) {
    const next = { ...(formulaDefinition || {}) };
    delete next.amount;
    delete next.fixedAmount;
    delete next.periodAccrualAmount;
    delete next.rate;
    delete next.percentage;
    delete next.bps;
    delete next.plannedReleaseDate;
    delete next.releaseAfterDays;
    delete next.expiryDate;
    delete next.expiresAfterDays;
    delete next.rolloverPolicy;
    // Resolve effective amount mode from the kind config: fixed-only and
    // rate-only kinds ignore form.oblAmountMode (the UI doesn't expose a
    // toggle for them), so we coerce the persistence path here too. This
    // prevents new rate-only rules (returns_reserve, reserve_accrual) from
    // saving with an empty formulaDefinition just because the form-state
    // default for oblAmountMode is "fixed".
    const kindCfg = OBLIGATION_KIND_CONFIG[String(form.ruleType || "").toLowerCase()];
    const effectiveMode: "fixed" | "rate" =
      kindCfg?.amountMode === "fixed"
        ? "fixed"
        : kindCfg?.amountMode === "rate"
        ? "rate"
        : form.oblAmountMode === "rate"
        ? "rate"
        : "fixed";
    if (effectiveMode === "fixed" && form.oblAmount !== "" && form.oblAmount != null) {
      next.amount = Number(form.oblAmount);
    } else if (effectiveMode === "rate" && form.oblRate !== "" && form.oblRate != null) {
      const rate = Number(form.oblRate);
      if (form.oblRateBasis === "bps") next.bps = rate;
      else if (form.oblRateBasis === "decimal") next.rate = rate;
      else next.percentage = rate;
    }
    if (form.oblPlannedReleaseDate) {
      next.plannedReleaseDate = form.oblPlannedReleaseDate;
    } else if (form.oblReleaseAfterDays !== "" && form.oblReleaseAfterDays != null) {
      next.releaseAfterDays = Number(form.oblReleaseAfterDays);
    }
    if (form.oblExpiryDate) {
      next.expiryDate = form.oblExpiryDate;
    } else if (form.oblExpiresAfterDays !== "" && form.oblExpiresAfterDays != null) {
      next.expiresAfterDays = Number(form.oblExpiresAfterDays);
    }
    if (form.oblRolloverPolicy) next.rolloverPolicy = form.oblRolloverPolicy;
    formulaDefinition = next;
  }
  // Aggregation period: optional rule-level override of the program's
  // accrual policy default. Empty = inherit from policy (drop the key so
  // the rule card chip reads "from policy"). Anything else = override.
  if (form.aggregationPeriod && String(form.aggregationPeriod).trim() !== "") {
    formulaDefinition = { ...(formulaDefinition || {}), aggregationPeriod: String(form.aggregationPeriod) };
  } else if (formulaDefinition && "aggregationPeriod" in formulaDefinition) {
    const { aggregationPeriod, ...rest } = formulaDefinition;
    formulaDefinition = Object.keys(rest).length ? rest : null;
  }
  return {
    ruleName: form.ruleName?.trim(),
    ruleType: form.ruleType,
    description: form.description || null,
    priority: form.priority ? parseInt(String(form.priority), 10) : 10,
    isActive: !!form.isActive,
    subtypeInstanceId: form.subtypeInstanceId || null,
    baseRate:
      form.baseRate === "" || form.baseRate == null ? null : String(form.baseRate),
    minimumGuarantee:
      form.minimumGuarantee === "" || form.minimumGuarantee == null
        ? null
        : String(form.minimumGuarantee),
    baseMetric: form.baseMetric || null,
    executionGroup: form.executionGroup || null,
    templateCode: form.templateCode || null,
    // NOTE (conditions architecture, option a): legacy productCategories /
    // territories arrays are no longer populated by the panel. The new
    // conditions[] (PUT after this save) is the single source of truth.
    // Sending [] keeps the column non-null without re-introducing duplicates.
    productCategories: [],
    territories: [],
    volumeTiers: tiers.length ? tiers : null,
    tierMode: form.tierMode || null,
    tierBasis: form.tierBasis || null,
    seasonalAdjustments: rowsToObj(form.seasonalAdjustments),
    territoryPremiums: rowsToObj(form.territoryPremiums),
    formulaDefinition,
  };
}

function Section({
  icon: Icon,
  title,
  defaultOpen = false,
  children,
  count,
  testid,
}: {
  icon: any;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  count?: number;
  testid: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border transition group ${
          open
            ? "bg-orange-50/60 border-orange-200 hover:bg-orange-50"
            : "bg-white border-zinc-200 hover:border-orange-200 hover:bg-orange-50/40"
        }`}
        data-testid={`section-toggle-${testid}`}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-orange-600" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-orange-600" />
        )}
        <Icon
          className={`h-3.5 w-3.5 ${open ? "text-orange-600" : "text-orange-500"}`}
        />
        <span className="text-sm font-semibold text-zinc-900">{title}</span>
        {typeof count === "number" && count > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-orange-100 text-orange-700 ml-1">
            {count}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pt-3 pb-4 space-y-3 border-l-2 border-orange-100 ml-2 mt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wide">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

export default function RuleEditorPanel({
  open,
  onOpenChange,
  contractId,
  rule,
  allQualifiers = [],
  onSaved,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !rule?.id;
  const [form, setForm] = useState<any>(() => makeInitialForm(rule));

  // Only reset the form when the panel transitions from closed→open or the
  // edited rule's identity changes. Depending on the full `rule` object would
  // wipe user keystrokes every time the parent re-renders (since the rules
  // query returns fresh object references each render).
  useEffect(() => {
    if (open) setForm(makeInitialForm(rule));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule?.id]);

  const setField = (key: string, value: any) =>
    setForm((p: any) => ({ ...p, [key]: value }));

  // Load existing conditions for this rule (new architecture: 5-dim, group-based).
  const conditionsQuery = useQuery<{
    ruleId: string;
    conditions: Condition[];
    suggestedConditions?: Array<{ fromRuleId: string; fromRuleName: string; conditions: Condition[] }>;
  }>({
    queryKey: ["/api/contract-rules", form.id, "conditions"],
    enabled: open && !!form.id,
  });

  // Subtype Instances for this contract — drives the "Program" picker so
  // the user can attach a manually-created rule to the right policy bundle.
  const subtypeInstancesQuery = useQuery<any[]>({
    queryKey: ["/api/contracts", contractId, "subtype-instances"],
    enabled: open && !!contractId,
  });
  const subtypeInstances = subtypeInstancesQuery.data || [];
  const subtypeInstancesLoading = subtypeInstancesQuery.isLoading;

  // Allowed program types for THIS contract, filtered through the
  // flow_subtype_validity matrix (e.g. a Distributor / Reseller contract gets
  // only RA + COM + MDF + MIN — not the full 10-subtype catalog). The matrix's
  // primary subtype comes back first with isPrimary=true.
  // The default queryFn just joins queryKey segments with "/", which would
  // serialize the params object to "[object Object]". Provide an explicit
  // queryFn that builds the proper "?contractId=…" URL so the matrix-filtered
  // catalog comes back (e.g. RLA contract → ROY ★ + MIN + RSS + SBE only).
  const subtypesCatalogQuery = useQuery<Array<{ code: string; name: string; description?: string | null; isPrimary?: boolean }>>({
    queryKey: ["/api/subtypes", contractId],
    queryFn: async () => {
      const res = await fetch(`/api/subtypes?contractId=${encodeURIComponent(contractId || "")}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: open && !!contractId,
  });
  const subtypesCatalog = subtypesCatalogQuery.data || [];

  const createSubtypeInstanceMutation = useMutation({
    mutationFn: async (subtypeCode: string) => {
      const res = await apiRequest("POST", `/api/contracts/${contractId}/subtype-instances`, { subtypeCode });
      return await res.json();
    },
    onSuccess: (created: any) => {
      qc.invalidateQueries({ queryKey: ["/api/contracts", contractId, "subtype-instances"] });
      qc.invalidateQueries({ queryKey: ["/api/contracts", contractId, "policies-summary"] });
      setForm((p: any) => ({ ...p, subtypeInstanceId: created.id }));
      toast({ title: "Program created", description: created.label });
    },
    onError: (err: any) => {
      toast({ title: "Couldn't create program", description: err?.message || "Try again.", variant: "destructive" });
    },
  });
  // For brand-new rules, if exactly one instance exists, default to it so
  // every new rule gets attached to *something* without forcing a click.
  useEffect(() => {
    if (!open) return;
    if (form.id) return; // only auto-select on create
    if (form.subtypeInstanceId) return;
    if (subtypeInstances.length === 1) {
      setForm((p: any) => ({ ...p, subtypeInstanceId: subtypeInstances[0].id }));
    }
  }, [open, form.id, form.subtypeInstanceId, subtypeInstances.length]);

  // ---- Add Rule AI prefill (T005) ----
  // While the user is typing the name (and optionally a description) on a brand-new
  // rule, we ping a lightweight heuristic endpoint that suggests ruleType/baseMetric.
  // Suggestion is presented inline; user clicks Apply to accept (never auto-applied).
  type RuleSuggestion = {
    ruleType: string;
    baseMetric: string | null;
    templateCode: string | null;
    confidence: number;
    rationale: string | null;
  } | null;
  const [debouncedName, setDebouncedName] = useState("");
  const [debouncedDesc, setDebouncedDesc] = useState("");
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedName((form.ruleName || "").trim());
      setDebouncedDesc((form.description || "").trim());
    }, 350);
    return () => clearTimeout(t);
  }, [form.ruleName, form.description]);
  // Reset the dismiss flag when the panel opens or the rule identity changes,
  // so the next Add session starts with a clean slate.
  useEffect(() => {
    if (open) setDismissedSuggestion(false);
  }, [open, rule?.id]);
  const suggestQuery = useQuery<{ suggestion: RuleSuggestion }>({
    queryKey: ["/api/rules/suggest", debouncedName, debouncedDesc],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/rules/suggest", {
        name: debouncedName,
        description: debouncedDesc,
      });
      return res.json();
    },
    enabled: open && isNew && debouncedName.length >= 3,
    staleTime: 60_000,
  });
  const aiSuggestion: RuleSuggestion = suggestQuery.data?.suggestion ?? null;
  const ruleTypeLabel = useMemo(() => {
    if (!aiSuggestion?.ruleType) return null;
    for (const g of RULE_TYPES_BY_PHASE) {
      const hit = g.ruleTypes.find((t) => t.value === aiSuggestion.ruleType);
      if (hit) return hit.label;
    }
    return aiSuggestion.ruleType;
  }, [aiSuggestion?.ruleType]);
  const baseMetricLabel = useMemo(() => {
    if (!aiSuggestion?.baseMetric) return null;
    return BASE_METRICS.find((b) => b.value === aiSuggestion.baseMetric)?.label
      || aiSuggestion.baseMetric;
  }, [aiSuggestion?.baseMetric]);
  // Don't pester the user once they've already filled in fields the suggestion
  // would set — only show when at least one of ruleType/baseMetric differs from
  // current form values (or is empty).
  const suggestionWouldChangeForm =
    !!aiSuggestion && (
      (aiSuggestion.ruleType && form.ruleType !== aiSuggestion.ruleType) ||
      (aiSuggestion.baseMetric && form.baseMetric !== aiSuggestion.baseMetric)
    );
  const showSuggestion =
    isNew && !dismissedSuggestion && !!aiSuggestion && !!suggestionWouldChangeForm;
  const applySuggestion = () => {
    if (!aiSuggestion) return;
    setForm((p: any) => ({
      ...p,
      ruleType: aiSuggestion.ruleType || p.ruleType,
      baseMetric: aiSuggestion.baseMetric || p.baseMetric,
      templateCode: aiSuggestion.templateCode || p.templateCode,
    }));
    setDismissedSuggestion(true);
  };

  // Local conditions state (synced from query). User edits update this; on save we PUT it.
  // Re-sync whenever the panel opens, the rule identity changes, or the query
  // returns new data. We deliberately depend on `open` (not just data) because
  // closing the panel resets local state to []; without re-syncing on reopen,
  // a still-cached query result wouldn't trigger the effect (same reference)
  // and the editor would render empty until the network refetch completed.
  const [conditions, setConditions] = useState<Condition[]>([]);
  useEffect(() => {
    if (!open) return;
    if (conditionsQuery.data) {
      setConditions(conditionsQuery.data.conditions || []);
    } else if (!form.id) {
      setConditions([]);
    }
  }, [open, conditionsQuery.data, form.id]);

  // When the panel closes, invalidate so the next open fetches fresh data,
  // and reset the local draft so unsaved deletions don't persist across opens.
  // The reset is safe because the open-effect above will repopulate from the
  // cache (or refetch) the moment the panel re-opens.
  useEffect(() => {
    if (!open) {
      setConditions([]);
      if (form.id) {
        qc.invalidateQueries({ queryKey: ["/api/contract-rules", form.id, "conditions"] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.id]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const ruleResp = await apiRequest("PUT", `/api/contract-rules/${id}`, body);
      // Then push conditions (new architecture). Skipped server-side if no sourceClauseId.
      // Drop any rows whose value is empty — Zod requires min(1) and an empty
      // value would cause the whole batch to be rejected (silently losing edits).
      const cleanConditions = (conditions || []).filter(
        (c) => c && typeof c.value === "string" && c.value.trim() !== ""
      );
      try {
        await apiRequest("PUT", `/api/contract-rules/${id}/conditions`, { conditions: cleanConditions });
      } catch (condErr: any) {
        // Conditions PUT failure shouldn't kill the whole save — but we should warn.
        console.warn("[RuleEditorPanel] conditions PUT failed:", condErr);
        toast({
          title: "Conditions not saved",
          description: condErr?.message || "Rule fields saved but conditions failed.",
          variant: "destructive",
        });
      }
      return ruleResp;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contracts", contractId, "combined-rules"] });
      qc.invalidateQueries({ queryKey: ["/api/contracts", contractId, "qualifiers"] });
      qc.invalidateQueries({ queryKey: ["/api/contract-rules", form.id, "conditions"] });
      toast({ title: "Rule saved" });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest("POST", `/api/contracts/${contractId}/rules-list`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contracts", contractId, "combined-rules"] });
      qc.invalidateQueries({ queryKey: ["/api/contracts", contractId, "qualifiers"] });
      toast({ title: "Rule added" });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Add failed", description: e.message, variant: "destructive" }),
  });

  const isPending = updateMutation.isPending || addMutation.isPending;
  const [unmappedCount, setUnmappedCount] = useState(0);

  // Obligation rule? → look up its config and surface a preview / validation.
  const ruleTypeLower = String(form.ruleType || "").toLowerCase();
  // Treat a rule as an obligation when its ruleType is an obligation kind
  // AND its resolved calcPhase is `obligation_accrual`. Mirrors the engine's
  // own gate in obligationsService — keeps the editor from showing the
  // obligation UX for the legacy `milestone_payment` rule type whose default
  // phase is gross_calc unless the author has explicitly opted into the
  // obligation phase.
  const resolvedPhase = resolveCalcPhase({
    ruleType: form.ruleType,
    calcPhase: rule?.calcPhase,
  } as any);
  const isObligationRule =
    OBLIGATION_ACCRUAL_RULE_TYPES.has(ruleTypeLower) &&
    resolvedPhase === "obligation_accrual";
  const obligationKind = RULE_TYPE_TO_OBLIGATION_KIND[ruleTypeLower];
  const obligationConfig = OBLIGATION_KIND_CONFIG[ruleTypeLower];

  // Per-kind validation: must supply either an amount or rate, the right one
  // for fixed-only / rate-only kinds. Returned as a list of human messages
  // surfaced inline in the section and blocked at save time.
  const obligationErrors = useMemo<string[]>(() => {
    if (!isObligationRule || !obligationConfig) return [];
    const errs: string[] = [];
    const hasAmount = form.oblAmount !== "" && form.oblAmount != null;
    const hasRate = form.oblRate !== "" && form.oblRate != null;
    if (obligationConfig.amountMode === "fixed" && !hasAmount) {
      errs.push(`${obligationConfig.amountLabel || "Amount"} is required for this obligation type.`);
    } else if (obligationConfig.amountMode === "rate" && !hasRate) {
      errs.push(`${obligationConfig.rateLabel || "Rate"} is required for this obligation type.`);
    } else if (obligationConfig.amountMode === "either") {
      if (form.oblAmountMode === "fixed" && !hasAmount) {
        errs.push(`${obligationConfig.amountLabel || "Amount"} is required (or switch to rate).`);
      } else if (form.oblAmountMode === "rate" && !hasRate) {
        errs.push(`${obligationConfig.rateLabel || "Rate"} is required (or switch to fixed amount).`);
      }
    }
    if (
      obligationConfig.showExpiry &&
      !form.oblExpiryDate &&
      (form.oblExpiresAfterDays === "" || form.oblExpiresAfterDays == null) &&
      ruleTypeLower !== "performance_bonus" // these have a sensible default
    ) {
      // Only nag if the kind doesn't have a service-side default.
      if (
        ruleTypeLower !== "mdf_accrual" &&
        ruleTypeLower !== "signing_bonus" &&
        ruleTypeLower !== "milestone_payment" &&
        ruleTypeLower !== "milestone_payment_obligation"
      ) {
        errs.push("Set an expiry date or 'expires after N days' to control the rollover policy.");
      }
    }
    return errs;
  }, [isObligationRule, obligationConfig, form.oblAmount, form.oblRate, form.oblAmountMode, form.oblExpiryDate, form.oblExpiresAfterDays, ruleTypeLower]);

  // Recent period sales totals for this contract — powers the preview's
  // period selector so authors see real numbers instead of a hard-coded
  // sample. Falls back to a $100k illustrative figure when the contract
  // has no closed periods or in-flight sales yet.
  type PeriodBreakdownSlice = { key: string; total: number; share: number };
  type PeriodBreakdown = {
    category: PeriodBreakdownSlice[];
    channel: PeriodBreakdownSlice[];
    territory: PeriodBreakdownSlice[];
    breakdownTotal: number;
    otherCount: number;
  };
  type PeriodSalesEntry = {
    key: string;
    label: string;
    periodStart: string | null;
    periodEnd: string | null;
    totalSales: number;
    source: "closed" | "current";
    status: string | null;
    breakdown?: PeriodBreakdown;
  };
  const recentPeriodsQuery = useQuery<{ periods: PeriodSalesEntry[] }>({
    queryKey: ["/api/contracts", contractId, "recent-period-sales", { breakdown: 1 }],
    queryFn: async () => {
      const res = await fetch(
        `/api/contracts/${contractId}/recent-period-sales?breakdown=1`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Failed to load period sales (${res.status})`);
      return res.json();
    },
    enabled: open && isObligationRule && !!contractId,
  });
  const recentPeriods = recentPeriodsQuery.data?.periods ?? [];
  const SAMPLE_SALES_FALLBACK = 100000;
  const [previewPeriodKey, setPreviewPeriodKey] = useState<string>("__sample");

  // Drill-down state: when an author clicks a slice in the breakdown popover,
  // we open a dialog showing the underlying sales rows filtered to this
  // contract + period + dimension value. Returns are kept and visibly
  // distinguished so authors can see what was excluded from the breakdown
  // total before locking in (e.g.) a returns reserve %.
  type DrilldownState = {
    dimension: "category" | "channel" | "territory" | null;
    value: string | null;
    sliceTotal: number | null;
    periodLabel: string;
    periodSource: "closed" | "current";
    periodStart: string | null;
    periodEnd: string | null;
    periodStartExclusive: boolean;
  };
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  // Default selection: prefer the most recent closed period, then the
  // current in-flight period, then the synthetic sample. We re-evaluate
  // when the panel opens or the data arrives.
  useEffect(() => {
    if (!open || !isObligationRule) return;
    const firstClosed = recentPeriods.find((p) => p.source === "closed");
    const firstCurrent = recentPeriods.find((p) => p.source === "current");
    setPreviewPeriodKey(firstClosed?.key || firstCurrent?.key || "__sample");
  }, [open, isObligationRule, recentPeriodsQuery.data]);

  // Live preview of the accrual that will be created at the next period close.
  // Mirrors the math in `deriveAccrual` (server/services/obligationsService.ts).
  const obligationPreview = useMemo(() => {
    if (!isObligationRule || !obligationConfig) return null;
    const selected =
      recentPeriods.find((p) => p.key === previewPeriodKey) || null;
    const periodSales = selected ? selected.totalSales : SAMPLE_SALES_FALLBACK;
    const periodLabel = selected
      ? `${selected.label} (${selected.source === "closed" ? "closed period sales" : "sales so far this period"})`
      : `$${SAMPLE_SALES_FALLBACK.toLocaleString()} sample sales (no real period data yet)`;
    let amount = 0;
    let amountSource = "";
    if (form.oblAmountMode === "fixed" && form.oblAmount !== "" && form.oblAmount != null) {
      amount = Number(form.oblAmount) || 0;
      amountSource = `Fixed amount of $${amount.toFixed(2)} per period`;
    } else if (form.oblAmountMode === "rate" && form.oblRate !== "" && form.oblRate != null) {
      const rate = Number(form.oblRate) || 0;
      const divisor =
        form.oblRateBasis === "bps" ? 10000 : form.oblRateBasis === "percent" ? 100 : 1;
      amount = +((periodSales * rate) / divisor).toFixed(2);
      const rateUnit = form.oblRateBasis === "bps" ? " bps" : form.oblRateBasis === "percent" ? "%" : "";
      amountSource = `${rate}${rateUnit} × $${periodSales.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${periodLabel}) = $${amount.toFixed(2)}`;
    }
    let plannedRelease: string | null = null;
    if (form.oblPlannedReleaseDate) {
      plannedRelease = `Releases on ${form.oblPlannedReleaseDate}`;
    } else if (form.oblReleaseAfterDays !== "" && form.oblReleaseAfterDays != null) {
      plannedRelease = `Releases ${form.oblReleaseAfterDays} day(s) after period end`;
    }
    let expiry: string | null = null;
    if (form.oblExpiryDate) {
      expiry = `Expires on ${form.oblExpiryDate}`;
    } else if (form.oblExpiresAfterDays !== "" && form.oblExpiresAfterDays != null) {
      expiry = `Expires ${form.oblExpiresAfterDays} day(s) after planned release`;
    } else if (ruleTypeLower === "mdf_accrual") {
      expiry = "Expires 90 days after period end (default)";
    } else if (ruleTypeLower === "performance_bonus" || ruleTypeLower === "signing_bonus") {
      expiry = "Expires 1 year after period end (default)";
    }
    return {
      kind: obligationKind,
      kindLabel: OBLIGATION_KIND_LABELS[obligationKind || ""] || obligationKind,
      amount,
      amountSource,
      plannedRelease,
      expiry,
      rolloverPolicy: form.oblRolloverPolicy || obligationConfig.defaultRolloverPolicy,
    };
  }, [isObligationRule, obligationConfig, obligationKind, ruleTypeLower, form.oblAmountMode, form.oblAmount, form.oblRate, form.oblRateBasis, form.oblPlannedReleaseDate, form.oblReleaseAfterDays, form.oblExpiryDate, form.oblExpiresAfterDays, form.oblRolloverPolicy, recentPeriods, previewPeriodKey]);

  const onSave = () => {
    const body = buildPayload(form);
    // Hard-required fields. The asterisk on each <Field required> is purely
    // visual — these blocks are what actually prevent a save with holes.
    if (!body.ruleName || !String(body.ruleName).trim()) {
      toast({ title: "Rule name is required", variant: "destructive" });
      return;
    }
    if (!form.ruleType) {
      toast({
        title: "Rule type is required",
        description: "Pick a rule type so the calculation engine knows how to evaluate this rule.",
        variant: "destructive",
      });
      return;
    }
    // Confirm the chosen ruleType is actually one the engine knows about.
    const knownRuleTypes = new Set(
      RULE_TYPES_BY_PHASE.flatMap((g) => g.ruleTypes.map((t) => t.value))
    );
    if (!knownRuleTypes.has(form.ruleType)) {
      toast({
        title: "Unknown rule type",
        description: `"${form.ruleType}" is not a recognized rule type. Pick one from the dropdown.`,
        variant: "destructive",
      });
      return;
    }
    // Base metric is required for any rule type whose evaluator reads a
    // sales field (percentage, tiered, per_unit, rebate_rate, …).
    if (
      RULE_TYPES_REQUIRING_BASE_METRIC.has(String(form.ruleType).toLowerCase()) &&
      !form.baseMetric
    ) {
      toast({
        title: "Base metric is required",
        description: "This rule type calculates against a sales field — pick one in the Calculation section.",
        variant: "destructive",
      });
      return;
    }
    // Aggregation period is required for engine-aggregating rule types
    // (percentage / tiered / per_unit / minimum_guarantee / cap / …).
    // Without it the engine silently buckets per_sale and the result is wrong
    // for any quarterly / annual contract.
    if (
      RULE_TYPES_REQUIRING_AGGREGATION_PERIOD.has(String(form.ruleType).toLowerCase()) &&
      !form.aggregationPeriod
    ) {
      toast({
        title: "Aggregation Period is required",
        description: "Pick how this rule's sales bucket up (per sale / monthly / quarterly / annual) in the Calculation section.",
        variant: "destructive",
      });
      return;
    }
    // Program (subtype_instance) is mandatory on every rule — without it the
    // engine has no Accrual & Settlement Policy to read defaults from and the
    // matrix-driven separation breaks down (every rule lumps onto whatever
    // happens to be the default).
    if (!form.subtypeInstanceId) {
      toast({
        title: "Program is required",
        description: "Pick a Program in the General section, or create a new one of the right type.",
        variant: "destructive",
      });
      return;
    }
    if (obligationErrors.length > 0) {
      toast({
        title: "Obligation rule incomplete",
        description: obligationErrors[0],
        variant: "destructive",
      });
      return;
    }
    if (form.id) updateMutation.mutate({ id: form.id, body });
    else addMutation.mutate(body);
  };

  // Filter the contract's qualifier rows down to those linked to this rule.
  // Qualifiers can be linked via termId="rule:<ruleId>" (backfilled rows) or
  // by sharing contractClauseId with the rule's sourceClauseId (AI-extracted).
  const ruleQualifiers = useMemo(() => {
    if (!Array.isArray(allQualifiers)) return [];
    const ruleTermId = form.id ? `rule:${form.id}` : null;
    return allQualifiers.filter((q: any) => {
      if (ruleTermId && q.termId === ruleTermId) return true;
      if (
        form.sourceClauseId &&
        (q.contractClauseId === form.sourceClauseId ||
          q.sourceClauseId === form.sourceClauseId)
      )
        return true;
      return false;
    });
  }, [form.id, form.sourceClauseId, allQualifiers]);

  const tierCount = (form.volumeTiers || []).length;
  const adjustmentCount =
    (form.seasonalAdjustments || []).length + (form.territoryPremiums || []).length;
  const referenceCount = conditions.length;
  // Derive flat product / territory value lists for the legacy MappingSection.
  const productValuesFromConds = useMemo(
    () =>
      conditions
        .filter((c) => c.field === "product" || c.field === "product_category")
        .flatMap((c) =>
          c.op === "in" || c.op === "not_in"
            ? c.value.split(/[,;|]/g).map((s) => s.trim()).filter(Boolean)
            : [c.value]
        ),
    [conditions]
  );
  const territoryValuesFromConds = useMemo(
    () =>
      conditions
        .filter((c) => c.field === "territory")
        .flatMap((c) =>
          c.op === "in" || c.op === "not_in"
            ? c.value.split(/[,;|]/g).map((s) => s.trim()).filter(Boolean)
            : [c.value]
        ),
    [conditions]
  );

  const showTiersPrompt =
    (form.ruleType === "tiered" || form.ruleType === "milestone_tiered") &&
    tierCount === 0;
  // Only flag a missing base metric when the rule type actually consumes one.
  // Adjustment / offset / floor / cap / penalty / obligation rules don't, and
  // an explicit "not_applicable" choice always satisfies the requirement.
  const showMetricPrompt =
    RULE_TYPES_REQUIRING_BASE_METRIC.has(String(form.ruleType || "").toLowerCase()) &&
    !form.baseMetric;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[640px] p-0 flex flex-col"
        data-testid="panel-rule-editor"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-5 py-4 border-b-2 border-orange-200 bg-gradient-to-r from-orange-50/70 to-white">
          <SheetTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
            {isNew ? (
              <>
                <Plus className="h-4 w-4 text-orange-600" /> Add calculation rule
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 text-orange-600" /> Edit rule
                <span className="text-zinc-400 font-normal text-sm truncate max-w-[280px]">
                  · {form.ruleName || "Untitled"}
                </span>
              </>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs text-zinc-500">
            All fields the calculation engine reads at runtime. Save to apply changes
            immediately to this contract.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {/* General */}
          <Section icon={FileText} title="General" defaultOpen testid="general">
            <Field
              label="Program (Subtype Instance)"
              required
              hint="Which program inside the contract this rule belongs to. Required — determines which Accrual & Settlement Policy provides the defaults."
            >
              <Select
                value={form.subtypeInstanceId || "__none__"}
                onValueChange={(v) => {
                  if (v === "__none__") {
                    setField("subtypeInstanceId", "");
                    return;
                  }
                  // Sentinel: "__new__:<subtypeCode>" creates a new program of
                  // that type on this contract and auto-selects it.
                  if (v.startsWith("__new__:")) {
                    const code = v.slice("__new__:".length);
                    if (!createSubtypeInstanceMutation.isPending) {
                      createSubtypeInstanceMutation.mutate(code);
                    }
                    return;
                  }
                  setField("subtypeInstanceId", v);
                }}
                disabled={subtypeInstancesLoading || createSubtypeInstanceMutation.isPending}
              >
                <SelectTrigger
                  data-testid="select-panel-subtype-instance"
                  className={!form.subtypeInstanceId ? "border-rose-400 focus:ring-rose-400" : undefined}
                >
                  <SelectValue
                    placeholder={
                      subtypeInstancesLoading
                        ? "Loading…"
                        : createSubtypeInstanceMutation.isPending
                          ? "Creating program…"
                          : "— Required: pick a program —"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {/* "Unassigned" is intentionally NOT offered — Program is
                      mandatory. Use one of the existing programs, or create a
                      new one of the desired type below. */}
                  {subtypeInstances && subtypeInstances.length > 0 && (
                    <>
                      <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Existing programs on this contract
                      </div>
                      {subtypeInstances.map((inst: any) => (
                        <SelectItem
                          key={inst.id}
                          value={inst.id}
                          data-testid={`option-existing-program-${inst.id}`}
                        >
                          {inst.label}
                          {inst.subtypeCode ? ` (${inst.subtypeCode})` : ""}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {subtypesCatalog && subtypesCatalog.length > 0 && (
                    <>
                      <div className="mt-1 border-t border-zinc-200 px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        + Create new program of type
                      </div>
                      {subtypesCatalog.map((s) => (
                        <SelectItem
                          key={`__new__:${s.code}`}
                          value={`__new__:${s.code}`}
                          data-testid={`option-create-program-${s.code}`}
                        >
                          + {s.name} ({s.code}){s.isPrimary ? "  ★ primary" : ""}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Rule name" required>
              <Input
                value={form.ruleName}
                onChange={(e) => setField("ruleName", e.target.value)}
                placeholder="e.g. Base Royalty Rate"
                data-testid="input-panel-rule-name"
              />
              {showSuggestion && aiSuggestion && (
                <div
                  className="mt-1.5 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50/70 px-2.5 py-1.5"
                  data-testid="banner-rule-suggestion"
                  title={aiSuggestion.rationale || undefined}
                >
                  <Sparkles className="h-3.5 w-3.5 text-orange-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0 text-[11px] leading-snug text-zinc-700">
                    <span className="font-semibold text-orange-800">AI suggests:</span>{" "}
                    {ruleTypeLabel && (
                      <span data-testid="text-suggestion-rule-type">
                        rule type <span className="font-semibold">{ruleTypeLabel}</span>
                      </span>
                    )}
                    {ruleTypeLabel && baseMetricLabel && <span>, </span>}
                    {baseMetricLabel && (
                      <span data-testid="text-suggestion-base-metric">
                        base metric <span className="font-semibold">{baseMetricLabel}</span>
                      </span>
                    )}
                    {aiSuggestion.confidence > 0 && (
                      <span className="text-zinc-500"> · {Math.round(aiSuggestion.confidence * 100)}% confident</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="text-[10px] px-2 py-0.5 rounded border border-orange-300 bg-orange-100 hover:bg-orange-200 text-orange-800 font-semibold shrink-0"
                    data-testid="button-apply-suggestion"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedSuggestion(true)}
                    className="p-0.5 rounded hover:bg-orange-100 text-zinc-400 hover:text-zinc-600 shrink-0"
                    title="Dismiss"
                    data-testid="button-dismiss-suggestion"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rule type" required>
                <Select
                  value={form.ruleType}
                  onValueChange={(v) => {
                    // When switching to a fixed-only or rate-only obligation
                    // kind, snap oblAmountMode so persistence picks up the
                    // right field even if the user never edits the toggle.
                    // Also seed the kind's default rollover policy so e.g.
                    // a fresh returns_reserve starts on "rollover" instead
                    // of the global "forfeit" fallback.
                    const cfg = OBLIGATION_KIND_CONFIG[v.toLowerCase()];
                    setForm((p: any) => ({
                      ...p,
                      ruleType: v,
                      oblAmountMode:
                        cfg?.amountMode === "fixed"
                          ? "fixed"
                          : cfg?.amountMode === "rate"
                          ? "rate"
                          : p.oblAmountMode,
                      oblRolloverPolicy: cfg?.defaultRolloverPolicy
                        ? cfg.defaultRolloverPolicy
                        : p.oblRolloverPolicy,
                    }));
                  }}
                >
                  <SelectTrigger data-testid="select-panel-rule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES_BY_PHASE.map((group) => (
                      <SelectGroup key={group.phase}>
                        <SelectLabel
                          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          data-testid={`label-phase-${group.phase}`}
                        >
                          {group.label}
                        </SelectLabel>
                        {group.ruleTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority" hint="Lower = higher priority">
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setField("priority", e.target.value)}
                  data-testid="input-panel-priority"
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={2}
                placeholder="Explain what this rule does"
                data-testid="textarea-panel-description"
              />
            </Field>
            <div className="flex items-center justify-between border border-zinc-100 rounded-md px-3 py-2">
              <div>
                <div className="text-xs font-semibold text-zinc-800">Active</div>
                <div className="text-[11px] text-zinc-500">
                  Inactive rules are skipped during calculation
                </div>
              </div>
              <Switch
                checked={!!form.isActive}
                onCheckedChange={(v) => setField("isActive", v)}
                data-testid="switch-panel-active"
              />
            </div>
            {form.sourceText && (
              <Field label="Source quote (from contract)">
                <div className="text-[11px] text-zinc-700 bg-zinc-50 border border-zinc-100 rounded-md p-2.5 italic max-h-32 overflow-y-auto">
                  "{form.sourceText}"
                </div>
                {form.confidence != null && (
                  <div className="text-[10px] text-zinc-500 mt-1">
                    AI confidence: {Math.round(parseFloat(form.confidence) * 100)}%
                  </div>
                )}
              </Field>
            )}
          </Section>

          {/* Calculation */}
          <Section icon={Calculator} title="Calculation" defaultOpen testid="calculation">
            {showMetricPrompt && (
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  <span className="font-semibold">Base metric required</span> — without this,
                  the engine doesn't know which sales column to multiply by the rate.
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {/* Base metric is meaningless for fixed-dollar rule types
                  (minimum_guarantee, fixed_fee, late_payment_penalty, …).
                  Hide the picker so the editor doesn't suggest a
                  rate-against-sales mental model. */}
              {!RULE_TYPES_NO_BASE_METRIC.has(String(form.ruleType || "").toLowerCase()) && (
                <Field label="Base metric" hint="Which sales field to apply the rate to">
                  <Select
                    value={form.baseMetric || "__none"}
                    onValueChange={(v) => setField("baseMetric", v === "__none" ? "" : v)}
                  >
                    <SelectTrigger data-testid="select-panel-base-metric">
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— none —</SelectItem>
                      {BASE_METRICS.map((b) => (
                        <SelectItem key={b.value} value={b.value}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Execution group" hint="When the engine runs this rule">
                <Select
                  value={form.executionGroup || "__none"}
                  onValueChange={(v) =>
                    setField("executionGroup", v === "__none" ? "" : v)
                  }
                >
                  <SelectTrigger data-testid="select-panel-execution-group">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— none —</SelectItem>
                    {EXECUTION_GROUPS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Template code"
                hint="Identifier for the calculation template"
              >
                <Input
                  value={form.templateCode}
                  onChange={(e) => setField("templateCode", e.target.value)}
                  placeholder="e.g. royalty_percentage_net_sales"
                  data-testid="input-panel-template-code"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Base rate" hint="% or $ per the rule type">
                <Input
                  value={form.baseRate}
                  onChange={(e) => setField("baseRate", e.target.value)}
                  placeholder="e.g. 5.00"
                  data-testid="input-panel-base-rate"
                />
              </Field>
              <Field
                label="Minimum guarantee"
                hint="Floor amount, applied at rule type minimum_guarantee"
              >
                <Input
                  value={form.minimumGuarantee}
                  onChange={(e) => setField("minimumGuarantee", e.target.value)}
                  placeholder="e.g. 100000"
                  data-testid="input-panel-min-guarantee"
                />
              </Field>
            </div>
            {(() => {
              const aggRequired = RULE_TYPES_REQUIRING_AGGREGATION_PERIOD.has(
                String(form.ruleType || "").toLowerCase()
              );
              const aggMissing = aggRequired && !form.aggregationPeriod;
              return (
                <Field
                  label="Aggregation Period"
                  required={aggRequired}
                  hint={
                    aggRequired
                      ? "Required for this rule type — pick the bucket the engine should use (per sale / monthly / quarterly / annual)."
                      : "How sales feeding this rule are bucketed before applying the rate. Leave blank to inherit the program's accrual policy default."
                  }
                >
                  <Select
                    value={form.aggregationPeriod || "__inherit__"}
                    onValueChange={(v) => setField("aggregationPeriod", v === "__inherit__" ? "" : v)}
                  >
                    <SelectTrigger
                      data-testid="select-panel-aggregation-period"
                      className={aggMissing ? "border-rose-400 focus:ring-rose-400" : undefined}
                    >
                      <SelectValue placeholder={aggRequired ? "— Required —" : "— Inherit from policy —"} />
                    </SelectTrigger>
                    <SelectContent>
                      {!aggRequired && (
                        <SelectItem value="__inherit__">— Inherit from policy —</SelectItem>
                      )}
                      <SelectItem value="per_sale">Per sale (no aggregation)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                  {aggMissing && (
                    <p className="text-[11px] text-rose-600 mt-1">
                      Aggregation Period is required for this rule type.
                    </p>
                  )}
                </Field>
              );
            })()}
            {form.formulaDefinition && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-700 select-none">
                  Show raw formula definition (debug)
                </summary>
                <pre className="mt-1 text-[10px] text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-md p-2 overflow-x-auto max-h-40" data-testid="text-formula-definition-raw">
                  {JSON.stringify(form.formulaDefinition, null, 2)}
                </pre>
              </details>
            )}
          </Section>

          {/* Obligation accrual — only for stateful obligation rule types */}
          {isObligationRule && obligationConfig && (
            <Section
              icon={Wallet}
              title="Obligation accrual"
              testid="obligation"
              defaultOpen
              count={obligationErrors.length}
            >
              <div className="text-[11px] text-zinc-700 bg-orange-50/50 border border-orange-100 rounded-md p-2.5 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-zinc-800">
                    {OBLIGATION_KIND_LABELS[obligationKind || ""] || obligationKind}
                  </div>
                  {obligationConfig.hint && (
                    <div className="text-zinc-600 mt-0.5">{obligationConfig.hint}</div>
                  )}
                </div>
              </div>

              {obligationConfig.amountMode === "either" && (
                <Field label="How is the amount determined?">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: "fixed", label: "Fixed amount", desc: "A flat dollar amount per period." },
                      { v: "rate", label: "Rate of sales", desc: "A % / bps applied to period sales." },
                    ].map((m) => {
                      const active = form.oblAmountMode === m.v;
                      return (
                        <button
                          key={m.v}
                          type="button"
                          onClick={() => setField("oblAmountMode", m.v)}
                          className={`text-left rounded-md border px-3 py-2 transition ${
                            active
                              ? "border-orange-500 bg-orange-50 ring-1 ring-orange-200"
                              : "border-zinc-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
                          }`}
                          data-testid={`button-obl-amount-mode-${m.v}`}
                        >
                          <div className={`text-xs font-semibold ${active ? "text-orange-800" : "text-zinc-800"}`}>
                            {m.label}
                          </div>
                          <div className="text-[11px] text-zinc-600 leading-snug mt-0.5">{m.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              {(obligationConfig.amountMode === "fixed" ||
                (obligationConfig.amountMode === "either" && form.oblAmountMode === "fixed")) && (
                <Field
                  label={obligationConfig.amountLabel || "Amount"}
                  required
                  hint="Booked as the obligation balance at each accrual."
                >
                  <Input
                    type="number"
                    step="0.01"
                    value={form.oblAmount}
                    onChange={(e) => setField("oblAmount", e.target.value)}
                    placeholder="e.g. 50000"
                    data-testid="input-obl-amount"
                  />
                </Field>
              )}

              {(obligationConfig.amountMode === "rate" ||
                (obligationConfig.amountMode === "either" && form.oblAmountMode === "rate")) && (
                <div className="grid grid-cols-[1fr_140px] gap-3">
                  <Field
                    label={obligationConfig.rateLabel || "Rate"}
                    required
                    hint="Multiplied by the period sales total."
                  >
                    <Input
                      type="number"
                      step="0.0001"
                      value={form.oblRate}
                      onChange={(e) => setField("oblRate", e.target.value)}
                      placeholder="e.g. 2.5"
                      data-testid="input-obl-rate"
                    />
                  </Field>
                  <Field label="Basis">
                    <Select
                      value={form.oblRateBasis}
                      onValueChange={(v) => setField("oblRateBasis", v)}
                    >
                      <SelectTrigger data-testid="select-obl-rate-basis">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percent (%)</SelectItem>
                        <SelectItem value="bps">Basis points (bps)</SelectItem>
                        <SelectItem value="decimal">Decimal (0.025)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}

              {obligationConfig.showPlannedRelease && (
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Planned release date"
                    hint="Calendar date when the obligation becomes claimable / payable."
                  >
                    <Input
                      type="date"
                      value={form.oblPlannedReleaseDate}
                      onChange={(e) => {
                        setField("oblPlannedReleaseDate", e.target.value);
                        if (e.target.value) setField("oblReleaseAfterDays", "");
                      }}
                      data-testid="input-obl-planned-release-date"
                    />
                  </Field>
                  <Field
                    label="…or N days after period end"
                    hint="Use this when the release date is relative to each period."
                  >
                    <Input
                      type="number"
                      value={form.oblReleaseAfterDays}
                      onChange={(e) => {
                        setField("oblReleaseAfterDays", e.target.value);
                        if (e.target.value) setField("oblPlannedReleaseDate", "");
                      }}
                      placeholder="e.g. 30"
                      data-testid="input-obl-release-after-days"
                    />
                  </Field>
                </div>
              )}

              {obligationConfig.showExpiry && (
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Expiry date"
                    hint="After this date, unclaimed amounts are handled per rollover policy."
                  >
                    <Input
                      type="date"
                      value={form.oblExpiryDate}
                      onChange={(e) => {
                        setField("oblExpiryDate", e.target.value);
                        if (e.target.value) setField("oblExpiresAfterDays", "");
                      }}
                      data-testid="input-obl-expiry-date"
                    />
                  </Field>
                  <Field
                    label="…or expires after N days"
                    hint="Days after planned release / period end."
                  >
                    <Input
                      type="number"
                      value={form.oblExpiresAfterDays}
                      onChange={(e) => {
                        setField("oblExpiresAfterDays", e.target.value);
                        if (e.target.value) setField("oblExpiryDate", "");
                      }}
                      placeholder={
                        obligationConfig.defaultExpiresAfterDays
                          ? `default ${obligationConfig.defaultExpiresAfterDays}`
                          : "e.g. 90"
                      }
                      data-testid="input-obl-expires-after-days"
                    />
                  </Field>
                </div>
              )}

              <Field
                label="Rollover policy"
                hint="What happens to unclaimed balance when the expiry hits."
              >
                <div className="grid grid-cols-3 gap-2">
                  {ROLLOVER_POLICIES.map((p) => {
                    const active = (form.oblRolloverPolicy || "forfeit") === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setField("oblRolloverPolicy", p.value)}
                        className={`text-left rounded-md border px-3 py-2 transition ${
                          active
                            ? "border-orange-500 bg-orange-50 ring-1 ring-orange-200"
                            : "border-zinc-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
                        }`}
                        data-testid={`button-obl-rollover-${p.value}`}
                      >
                        <div className={`text-xs font-semibold ${active ? "text-orange-800" : "text-zinc-800"}`}>
                          {p.label}
                        </div>
                        <div className="text-[11px] text-zinc-600 leading-snug mt-0.5">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {obligationErrors.length > 0 && (
                <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-md p-2 space-y-1">
                  {obligationErrors.map((e, i) => (
                    <div key={i} className="flex items-start gap-1.5" data-testid={`text-obl-error-${i}`}>
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              )}

              {obligationPreview && obligationErrors.length === 0 && (() => {
                const selectedPeriod =
                  recentPeriods.find((p) => p.key === previewPeriodKey) || null;
                const breakdown = selectedPeriod?.breakdown || null;
                const fmtMoney = (n: number) =>
                  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                const fmtPct = (n: number) =>
                  `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`;
                const renderSlices = (
                  title: string,
                  slices: PeriodBreakdownSlice[],
                  dimension: "category" | "channel" | "territory",
                ) => {
                  if (!slices || slices.length === 0) return null;
                  return (
                    <div data-testid={`breakdown-${title.toLowerCase()}`}>
                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-0.5">
                        Top {title}
                      </div>
                      <div className="space-y-0.5">
                        {slices.map((s) => (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => {
                              if (!selectedPeriod) return;
                              const toIso = (d: Date | string | null) => {
                                if (!d) return null;
                                const dt = typeof d === "string" ? new Date(d) : d;
                                if (isNaN(dt.getTime())) return null;
                                return dt.toISOString();
                              };
                              setDrilldown({
                                dimension,
                                value: s.key,
                                sliceTotal: s.total,
                                periodLabel: selectedPeriod.label,
                                periodSource: selectedPeriod.source,
                                periodStart: toIso(selectedPeriod.periodStart),
                                periodEnd: toIso(selectedPeriod.periodEnd),
                                periodStartExclusive: selectedPeriod.source === "current" && !!selectedPeriod.periodStart,
                              });
                            }}
                            className="group w-full flex items-center justify-between gap-3 text-[11px] rounded px-1 -mx-1 py-0.5 hover:bg-emerald-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition cursor-pointer text-left"
                            data-testid={`button-breakdown-slice-${dimension}-${s.key}`}
                            aria-label={`View ${s.key} sales in ${selectedPeriod?.label || "period"}`}
                          >
                            <span className="truncate text-zinc-800 group-hover:text-emerald-900">{s.key}</span>
                            <span className="text-zinc-600 tabular-nums shrink-0">
                              {fmtMoney(s.total)} · {fmtPct(s.share)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                };
                const hasAnyBreakdown =
                  !!breakdown &&
                  (breakdown.category.length > 0 ||
                    breakdown.channel.length > 0 ||
                    breakdown.territory.length > 0);
                return (
                <div
                  className="border-2 border-emerald-200 bg-emerald-50/60 rounded-md p-3 space-y-1.5"
                  data-testid="preview-obligation"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-[11px] font-semibold text-emerald-900 uppercase tracking-wide">
                        Preview at next accrual
                      </span>
                    </div>
                    {form.oblAmountMode === "rate" && (
                      <div className="flex items-center gap-2">
                        {selectedPeriod && (
                          <button
                            type="button"
                            onClick={() => {
                              const toIso = (d: Date | string | null) => {
                                if (!d) return null;
                                const dt = typeof d === "string" ? new Date(d) : d;
                                if (isNaN(dt.getTime())) return null;
                                return dt.toISOString();
                              };
                              setDrilldown({
                                dimension: null,
                                value: null,
                                sliceTotal: selectedPeriod.totalSales,
                                periodLabel: selectedPeriod.label,
                                periodSource: selectedPeriod.source,
                                periodStart: toIso(selectedPeriod.periodStart),
                                periodEnd: toIso(selectedPeriod.periodEnd),
                                periodStartExclusive: selectedPeriod.source === "current" && !!selectedPeriod.periodStart,
                              });
                            }}
                            className="text-[11px] font-medium text-emerald-800 hover:text-emerald-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded px-1 py-0.5"
                            data-testid="button-view-all-sales"
                            aria-label={`View all sales rows in ${selectedPeriod.label}`}
                          >
                            View all sales
                          </button>
                        )}
                      <Select
                        value={previewPeriodKey}
                        onValueChange={(v) => setPreviewPeriodKey(v)}
                      >
                        <SelectTrigger
                          className="h-7 text-[11px] w-auto min-w-[180px] bg-white"
                          data-testid="select-preview-period"
                        >
                          <SelectValue placeholder="Preview against…" />
                        </SelectTrigger>
                        <SelectContent>
                          {recentPeriods.length === 0 && (
                            <SelectItem value="__sample">
                              $100,000 sample (no real sales yet)
                            </SelectItem>
                          )}
                          {recentPeriods.some((p) => p.source === "current") && (
                            <SelectGroup>
                              <SelectLabel className="text-[10px]">In-flight</SelectLabel>
                              {recentPeriods
                                .filter((p) => p.source === "current")
                                .map((p) => (
                                  <SelectItem
                                    key={p.key}
                                    value={p.key}
                                    data-testid={`option-preview-period-${p.key}`}
                                  >
                                    {p.label} — ${p.totalSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          )}
                          {recentPeriods.some((p) => p.source === "closed") && (
                            <SelectGroup>
                              <SelectLabel className="text-[10px]">Closed periods</SelectLabel>
                              {recentPeriods
                                .filter((p) => p.source === "closed")
                                .map((p) => (
                                  <SelectItem
                                    key={p.key}
                                    value={p.key}
                                    data-testid={`option-preview-period-${p.key}`}
                                  >
                                    {p.label} — ${p.totalSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          )}
                          {recentPeriods.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-[10px]">Illustrative</SelectLabel>
                              <SelectItem value="__sample">
                                $100,000 sample
                              </SelectItem>
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-zinc-800">
                    A new <b>{obligationPreview.kindLabel}</b> obligation will be booked for{" "}
                    <b data-testid="text-preview-amount">${obligationPreview.amount.toFixed(2)}</b>.
                  </div>
                  <div className="text-[11px] text-zinc-600 space-y-0.5">
                    {obligationPreview.amountSource && <div>• {obligationPreview.amountSource}</div>}
                    {obligationPreview.plannedRelease && <div>• {obligationPreview.plannedRelease}</div>}
                    {obligationPreview.expiry && <div>• {obligationPreview.expiry}</div>}
                    <div>
                      • Unused balance: <b className="capitalize">{obligationPreview.rolloverPolicy}</b>
                    </div>
                  </div>
                  {form.oblAmountMode === "rate" && selectedPeriod && (
                    <HoverCard openDelay={120} closeDelay={80}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 hover:text-emerald-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded px-0.5"
                          data-testid="button-period-breakdown"
                          aria-label={`What's in ${selectedPeriod.label}`}
                        >
                          <Info className="h-3 w-3" />
                          What's in this period? <span className="text-zinc-500 font-normal">({selectedPeriod.label})</span>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent
                        side="bottom"
                        align="end"
                        className="w-80 p-3 space-y-2"
                        data-testid="popover-period-breakdown"
                      >
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b">
                          <div>
                            <div className="text-[11px] font-semibold text-zinc-900">
                              {selectedPeriod.label}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {selectedPeriod.source === "closed"
                                ? "Closed period · gross sales (returns excluded)"
                                : "Sales recorded since last close · gross (returns excluded)"}
                            </div>
                          </div>
                          <div className="text-[11px] font-semibold text-zinc-800 tabular-nums shrink-0">
                            {fmtMoney(
                              breakdown?.breakdownTotal ?? selectedPeriod.totalSales,
                            )}
                          </div>
                        </div>
                        {!recentPeriodsQuery.isLoading && !hasAnyBreakdown && (
                          <div className="text-[11px] text-zinc-500" data-testid="text-no-breakdown">
                            No category, channel, or territory data is recorded for the
                            sales in this period.
                          </div>
                        )}
                        {recentPeriodsQuery.isLoading && (
                          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading breakdown…
                          </div>
                        )}
                        {hasAnyBreakdown && breakdown && (
                          <div className="space-y-2">
                            {renderSlices("Categories", breakdown.category, "category")}
                            {renderSlices("Channels", breakdown.channel, "channel")}
                            {renderSlices("Territories", breakdown.territory, "territory")}
                            <div className="text-[10px] text-zinc-500 pt-1 italic" data-testid="text-breakdown-drill-hint">
                              Click any row to see the underlying sales transactions.
                            </div>
                            {breakdown.otherCount > 0 && (
                              <div className="text-[10px] text-zinc-500 pt-1">
                                + {breakdown.otherCount} more {breakdown.otherCount === 1 ? "category" : "categories"} not shown
                              </div>
                            )}
                          </div>
                        )}
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </div>
              );
              })()}
            </Section>
          )}

          {/* Tiers & Adjustments */}
          <Section
            icon={TrendingUp}
            title="Tiers & adjustments"
            count={tierCount + adjustmentCount}
            testid="tiers"
            defaultOpen={tierCount + adjustmentCount > 0 || showTiersPrompt}
          >
            {showTiersPrompt && (
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  This rule type expects volume tiers — without any tier rows the engine
                  has nothing to evaluate.
                </span>
              </div>
            )}
            {(form.ruleType === "tiered" || form.ruleType === "milestone_tiered" || form.ruleType === "rebate_tiered" || form.ruleType === "net_sales_tiered") && (
              <Field
                label="Tier basis"
                hint="What the tier thresholds are measured in. 'Auto' falls back to a magnitude heuristic."
              >
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "auto", label: "Auto-detect", desc: "Heuristic on tier sizes" },
                    { value: "units", label: "Units", desc: "Quantity sold per period" },
                    { value: "amount", label: "Amount", desc: "Net/gross dollars per period" },
                  ].map((m) => {
                    const active = (form.tierBasis || "auto") === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setField("tierBasis", m.value)}
                        className={`text-left rounded-md border px-3 py-2 transition ${
                          active
                            ? "border-orange-500 bg-orange-50 ring-1 ring-orange-200"
                            : "border-zinc-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
                        }`}
                        data-testid={`button-tier-basis-${m.value}`}
                      >
                        <div className={`text-xs font-semibold ${active ? "text-orange-800" : "text-zinc-800"}`}>
                          {m.label}
                        </div>
                        <div className="text-[11px] text-zinc-600 leading-snug mt-0.5">{m.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}
            {(form.ruleType === "tiered" || form.ruleType === "milestone_tiered") && (
              <Field
                label="Calculation mode"
                hint="How tier rates apply when the volume crosses multiple bands"
              >
                <div className="grid grid-cols-2 gap-2">
                  {TIER_MODES.map((m) => {
                    const active = (form.tierMode || "whole") === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setField("tierMode", m.value)}
                        className={`text-left rounded-md border px-3 py-2 transition ${
                          active
                            ? "border-orange-500 bg-orange-50 ring-1 ring-orange-200"
                            : "border-zinc-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
                        }`}
                        data-testid={`button-tier-mode-${m.value}`}
                      >
                        <div
                          className={`text-xs font-semibold ${
                            active ? "text-orange-800" : "text-zinc-800"
                          }`}
                        >
                          {m.label}
                        </div>
                        <div className="text-[11px] text-zinc-600 leading-snug mt-0.5">
                          {m.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wide">
                  Volume tiers
                </Label>
                <button
                  onClick={() =>
                    setField("volumeTiers", [
                      ...(form.volumeTiers || []),
                      { min: "", max: "", rate: "" },
                    ])
                  }
                  className="text-[10px] px-2 py-0.5 rounded border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 inline-flex items-center gap-1 font-semibold"
                  data-testid="button-add-tier"
                >
                  <Plus className="h-2.5 w-2.5" /> Add tier
                </button>
              </div>
              {tierCount === 0 ? (
                <div className="text-[11px] text-zinc-500 italic px-2 py-2 border border-dashed border-zinc-200 rounded">
                  No tiers defined yet — click <span className="font-semibold not-italic text-orange-700">Add tier</span> to add the first band.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {form.volumeTiers.map((t: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5"
                      data-testid={`row-tier-${i}`}
                    >
                      <Input
                        value={t.min}
                        onChange={(e) => {
                          const copy = [...form.volumeTiers];
                          copy[i] = { ...copy[i], min: e.target.value };
                          setField("volumeTiers", copy);
                        }}
                        placeholder="Min"
                        className="h-7 text-xs"
                        data-testid={`input-tier-min-${i}`}
                      />
                      <Input
                        value={t.max}
                        onChange={(e) => {
                          const copy = [...form.volumeTiers];
                          copy[i] = { ...copy[i], max: e.target.value };
                          setField("volumeTiers", copy);
                        }}
                        placeholder="Max (blank = ∞)"
                        className="h-7 text-xs"
                        data-testid={`input-tier-max-${i}`}
                      />
                      <Input
                        value={t.rate}
                        onChange={(e) => {
                          const copy = [...form.volumeTiers];
                          copy[i] = { ...copy[i], rate: e.target.value };
                          setField("volumeTiers", copy);
                        }}
                        placeholder="Rate"
                        className="h-7 text-xs"
                        data-testid={`input-tier-rate-${i}`}
                      />
                      <button
                        onClick={() =>
                          setField(
                            "volumeTiers",
                            form.volumeTiers.filter((_: any, j: number) => j !== i),
                          )
                        }
                        className="p-1 rounded hover:bg-rose-100 text-zinc-400 hover:text-rose-600 shrink-0"
                        title="Remove tier"
                        data-testid={`button-remove-tier-${i}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <KeyValueEditor
              label="Seasonal adjustments"
              hint="Multiplier applied based on transaction date (e.g. Spring → 1.10)"
              rows={form.seasonalAdjustments}
              onChange={(rows) => setField("seasonalAdjustments", rows)}
              keyPlaceholder="Season (e.g. Spring)"
              valuePlaceholder="Multiplier (e.g. 1.10)"
              testid="seasonal"
            />
            <KeyValueEditor
              label="Territory premiums"
              hint="Multiplier applied based on territory (e.g. Secondary → 1.10)"
              rows={form.territoryPremiums}
              onChange={(rows) => setField("territoryPremiums", rows)}
              keyPlaceholder="Territory (e.g. Secondary)"
              valuePlaceholder="Multiplier"
              testid="territory-premium"
            />
          </Section>

          {/* Conditions (new architecture: 5-dim, group-based AND/OR) */}
          <Section
            icon={Tag}
            title="Conditions"
            count={referenceCount}
            testid="conditions"
            defaultOpen
          >
            {!form.id && (
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                Conditions can be edited after the rule is created.
              </div>
            )}
            {form.id && conditionsQuery.isLoading ? (
              <div className="text-[11px] text-zinc-500">Loading conditions…</div>
            ) : (
              <ConditionsEditorInline
                conditions={conditions}
                onChange={setConditions}
                disabled={!form.id}
                contractId={contractId}
              />
            )}
            {/* Sibling-rule suggestions: surface when this rule has no
                conditions of its own but a sibling on the same contract does. */}
            {form.id && conditions.length === 0 && (conditionsQuery.data?.suggestedConditions?.length ?? 0) > 0 && (
              <div className="mt-2 space-y-2">
                {conditionsQuery.data!.suggestedConditions!.map((s) => (
                  <div
                    key={s.fromRuleId}
                    className="text-[11px] bg-amber-50 border border-amber-200 rounded-md p-2.5"
                    data-testid={`suggestion-${s.fromRuleId}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="text-amber-900">
                        <span className="font-semibold">Suggestion:</span> sibling rule{" "}
                        <span className="font-semibold">"{s.fromRuleName}"</span> uses{" "}
                        {s.conditions.length} condition{s.conditions.length === 1 ? "" : "s"}.
                        Apply the same here?
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // Merge with current conditions, de-dupe on field|op|value|group|type
                          const seen = new Set(
                            conditions.map((c) => `${c.field}|${c.op}|${c.value}|${c.group}|${c.type}`),
                          );
                          const next: Condition[] = [...conditions];
                          for (const c of s.conditions) {
                            const k = `${c.field}|${c.op}|${c.value}|${c.group}|${c.type}`;
                            if (seen.has(k)) continue;
                            seen.add(k);
                            next.push(c);
                          }
                          setConditions(next);
                        }}
                        className="shrink-0 text-[10px] px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                        data-testid={`button-apply-suggestion-${s.fromRuleId}`}
                      >
                        Apply
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.conditions.map((c, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-amber-200 text-amber-900"
                        >
                          <span className="opacity-60 capitalize">{c.field.replace(/_/g, " ")}:</span> {c.value}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* AI Mapping */}
          <MappingSection
            productValues={productValuesFromConds}
            territoryValues={territoryValuesFromConds}
            qualifierValues={ruleQualifiers}
            contractId={contractId}
            onUnmappedCountChange={setUnmappedCount}
          />

          {unmappedCount > 0 && (
            <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">
                  {unmappedCount} reference{unmappedCount === 1 ? "" : "s"} still unmapped
                </div>
                <div className="text-[11px] text-rose-700">
                  This rule cannot be marked <b>Verified</b> until every product
                  / territory above is linked to your master data.
                </div>
              </div>
            </div>
          )}

          {/* History */}
          <Section icon={History} title="History & audit" testid="history">
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="text-zinc-500">Review status</div>
                <div className="font-semibold text-zinc-800 capitalize">
                  {form.reviewStatus || "pending"}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">AI confidence</div>
                <div className="font-semibold text-zinc-800">
                  {form.confidence != null
                    ? `${Math.round(parseFloat(form.confidence) * 100)}%`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">Source clause</div>
                <div className="font-mono text-[10px] text-zinc-700 truncate">
                  {form.sourceClauseId || "—"}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">Rule ID</div>
                <div className="font-mono text-[10px] text-zinc-700 truncate">
                  {form.id || "(unsaved)"}
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="border-t-2 border-orange-200 px-5 py-3 flex items-center justify-between bg-gradient-to-r from-orange-50/60 to-white shrink-0">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Changes save immediately on this contract.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 inline-flex items-center gap-1"
              data-testid="button-panel-cancel"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isPending || !form.ruleName?.trim()}
              className="text-xs px-3.5 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1"
              data-testid="button-panel-save"
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {isNew ? "Create rule" : "Save changes"}
            </button>
          </div>
        </div>
      </SheetContent>
      <SalesRowsDrilldownDialog
        contractId={contractId}
        drilldown={drilldown}
        onClose={() => setDrilldown(null)}
      />
    </Sheet>
  );
}

type DrilldownProps = {
  contractId: string;
  drilldown: {
    dimension: "category" | "channel" | "territory" | null;
    value: string | null;
    sliceTotal: number | null;
    periodLabel: string;
    periodSource: "closed" | "current";
    periodStart: string | null;
    periodEnd: string | null;
    periodStartExclusive: boolean;
  } | null;
  onClose: () => void;
};

// Drill-down dialog for the obligation-preview breakdown popover. Shows the
// raw sales rows behind a clicked slice (contract + period + dimension value),
// keeping returns visible but visually distinguished so authors can see what
// was excluded from the breakdown total before locking in a returns reserve %.
function SalesRowsDrilldownDialog({ contractId, drilldown, onClose }: DrilldownProps) {
  const open = !!drilldown;
  const isAllRows = !!drilldown && !drilldown.dimension;
  const params = new URLSearchParams();
  if (drilldown) {
    if (drilldown.dimension) params.set("dimension", drilldown.dimension);
    if (drilldown.value != null) params.set("value", drilldown.value);
    if (drilldown.periodStart) params.set("periodStart", drilldown.periodStart);
    if (drilldown.periodEnd) params.set("periodEnd", drilldown.periodEnd);
    if (drilldown.periodStartExclusive) params.set("periodStartExclusive", "1");
  }
  const query = useQuery<{ salesData: SalesRowRecord[]; total: number }>({
    queryKey: ["/api/contracts", contractId, "sales", drilldown ? params.toString() : null],
    queryFn: async () => {
      const res = await fetch(
        `/api/contracts/${contractId}/sales?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Failed to load sales (${res.status})`);
      return res.json();
    },
    enabled: open && !!contractId && !!drilldown,
  });

  const rows = query.data?.salesData ?? [];
  const totals = tallySalesRows(rows);
  const dimensionLabel =
    drilldown?.dimension === "category"
      ? "Category"
      : drilldown?.dimension === "channel"
      ? "Channel"
      : drilldown?.dimension === "territory"
      ? "Territory"
      : "All sales";

  const handleDownloadCsv = () => {
    if (!rows.length) return;
    const csv = buildSalesRowsCsv(rows);
    const slug = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "all";
    const parts = [
      "sales-rows",
      drilldown?.dimension ? slug(drilldown.dimension) : "all",
      drilldown?.value ? slug(String(drilldown.value)) : null,
      drilldown?.periodStart ? drilldown.periodStart.slice(0, 10) : null,
      drilldown?.periodEnd ? drilldown.periodEnd.slice(0, 10) : null,
    ].filter(Boolean);
    const filename = `${parts.join("_")}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-4xl max-h-[85vh] flex flex-col p-0"
        data-testid="dialog-sales-drilldown"
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <span className="text-zinc-500 text-xs font-normal uppercase tracking-wide">
                {dimensionLabel}
              </span>
              {!isAllRows && (
                <span data-testid="text-drilldown-value">{drilldown?.value}</span>
              )}
            </DialogTitle>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={!rows.length || query.isLoading}
              className="mr-7 text-[11px] px-2.5 py-1 rounded border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-700 inline-flex items-center gap-1.5"
              data-testid="button-download-drilldown-csv"
              title={
                rows.length
                  ? "Download these rows as a CSV"
                  : "No rows to download"
              }
            >
              <Download className="h-3 w-3" /> Download CSV
            </button>
          </div>
          <DialogDescription className="text-xs text-zinc-500">
            <span data-testid="text-drilldown-period">{drilldown?.periodLabel}</span>
            {isAllRows
              ? drilldown?.periodSource === "closed"
                ? " — every sales row recorded in this closed period (returns shown separately)"
                : " — every sales row recorded since the last close (returns shown separately)"
              : drilldown?.periodSource === "closed"
              ? " — closed period (returns excluded from slice total)"
              : " — sales since last close (returns excluded from slice total)"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-3 border-b bg-zinc-50/60 grid grid-cols-3 gap-3">
          <div data-testid="stat-drilldown-slice-total">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">
              {isAllRows ? "Period total (excl. returns)" : "Slice total (excl. returns)"}
            </div>
            <div className="text-sm font-semibold tabular-nums text-zinc-900">
              {drilldown && drilldown.sliceTotal != null
                ? formatSalesMoney(drilldown.sliceTotal)
                : "—"}
            </div>
          </div>
          <div data-testid="stat-drilldown-sales">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">
              Sales rows
            </div>
            <div className="text-sm font-semibold tabular-nums text-zinc-900">
              {totals.salesCount} · {formatSalesMoney(totals.salesAmount)}
            </div>
          </div>
          <div data-testid="stat-drilldown-returns">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">
              Returns (excluded)
            </div>
            <div className="text-sm font-semibold tabular-nums text-rose-700">
              {totals.returnsCount > 0
                ? `${totals.returnsCount} · -${formatSalesMoney(totals.returnsAmount)}`
                : "None"}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <SalesRowsTable
            rows={rows}
            isLoading={query.isLoading}
            isError={query.isError}
            errorMessage="Failed to load sales rows."
            emptyMessage={isAllRows ? "No sales rows found for this period." : "No sales rows found for this slice."}
            onRetry={() => query.refetch()}
            maxRows={500}
            testId="table-drilldown-sales"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KeyValueEditor({
  label,
  hint,
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  testid,
}: {
  label: string;
  hint?: string;
  rows: Array<{ key: string; value: string }>;
  onChange: (rows: Array<{ key: string; value: string }>) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  testid: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wide">
          {label}
        </Label>
        <button
          onClick={() => onChange([...(rows || []), { key: "", value: "" }])}
          className="text-[10px] px-2 py-0.5 rounded border border-zinc-200 hover:bg-zinc-50 text-zinc-700 inline-flex items-center gap-1"
          data-testid={`button-add-${testid}`}
        >
          <Plus className="h-2.5 w-2.5" /> Add
        </button>
      </div>
      {(rows || []).length === 0 ? (
        <div className="text-[11px] text-zinc-400 italic px-1">None defined.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5"
              data-testid={`row-${testid}-${i}`}
            >
              <Input
                value={r.key}
                onChange={(e) => {
                  const copy = [...rows];
                  copy[i] = { ...copy[i], key: e.target.value };
                  onChange(copy);
                }}
                placeholder={keyPlaceholder}
                className="h-7 text-xs"
                data-testid={`input-${testid}-key-${i}`}
              />
              <Input
                value={r.value}
                onChange={(e) => {
                  const copy = [...rows];
                  copy[i] = { ...copy[i], value: e.target.value };
                  onChange(copy);
                }}
                placeholder={valuePlaceholder}
                className="h-7 text-xs"
                data-testid={`input-${testid}-value-${i}`}
              />
              <button
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="p-1 rounded hover:bg-rose-100 text-zinc-400 hover:text-rose-600 shrink-0"
                title="Remove"
                data-testid={`button-remove-${testid}-${i}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {hint && <p className="text-[11px] text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Mapping section: for each product / territory value on the rule, ask the
// server for the closest ERP master-data record. Shows live confidence and
// lets the user accept the suggestion (visual confirm; persistence in T003).
// ---------------------------------------------------------------------------

type MapStatus = "verified" | "suggested" | "unmapped";
interface MapSuggestion {
  recordId: string;
  recordValue: string;
  field: string;
  confidence: number;
  method: string;
  table: string;
}
interface MapResponse {
  value: string;
  dimension: string;
  status: MapStatus;
  topConfidence: number;
  candidatesScanned: number;
  suggestions: MapSuggestion[];
}

// ─────────────────────────────────────────────────────────────────────────
// ConditionsEditorInline — inline editor matching the approved mockup.
// Each row = (field, op, value, group, type). Same group = AND, across = OR.
// ─────────────────────────────────────────────────────────────────────────

const OP_LABEL: Record<string, string> = {
  equals: "is",
  in: "is one of",
  not_in: "is not one of",
  contains: "contains",
  between: "between",
};

// Single-value picker for `equals` / `contains` operators.
// Free-text Input with an optional master-data typeahead dropdown.
function MappingPill({
  label,
  confidence,
  testId,
}: {
  label: string;
  confidence: number;
  testId?: string;
}) {
  const pct = Math.round((confidence ?? 0) * 100);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-1.5 py-0.5 text-[10px] leading-none"
      data-testid={testId}
      title={`Mapped to ${label} (${pct}% confidence)`}
    >
      <CheckCircle2 className="h-2.5 w-2.5" />
      <span className="truncate max-w-[200px]">{label}</span>
      <span className="opacity-70">· {pct}%</span>
    </span>
  );
}

function ConditionValuePicker({
  field,
  attribute,
  value,
  onChange,
  disabled,
  testIdPrefix,
  mapping,
}: {
  field: string;
  attribute?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  testIdPrefix: string;
  mapping?: { recordId: string; label: string; confidence: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const valuesUrl = attribute
    ? `/api/condition-values/${encodeURIComponent(field)}?attribute=${encodeURIComponent(attribute)}`
    : `/api/condition-values/${encodeURIComponent(field)}`;
  const { data: optionsResp } = useQuery<{ values: Array<{ id: string; label: string }> }>({
    queryKey: ["/api/condition-values", field, attribute || ""],
    queryFn: async () => {
      const res = await apiRequest("GET", valuesUrl);
      return res.json();
    },
    enabled: !!field,
    staleTime: 5 * 60_000,
  });
  const allOptions = optionsResp?.values ?? [];
  const q = (value || "").trim().toLowerCase();
  const filtered = (q
    ? allOptions.filter((o) => (o.label || "").toLowerCase().includes(q))
    : allOptions
  ).slice(0, 8);
  const showEmptyHint = allOptions.length === 0;
  const fieldLabel = (field || "value").replace(/_/g, " ");

  return (
    <div className="relative">
      <Input
        value={value}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered.length > 0) {
            e.preventDefault();
            onChange(filtered[0].label);
            setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Pick or type a value…"
        className="h-8 text-[11px]"
        data-testid={`${testIdPrefix}-input`}
      />
      {!disabled && open && (filtered.length > 0 || showEmptyHint) && (
        <div
          className="absolute z-50 mt-1 left-0 right-0 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-lg text-[11px]"
          data-testid={`${testIdPrefix}-suggestions`}
        >
          {showEmptyHint ? (
            <div
              className="px-2 py-2 text-[10px] text-muted-foreground italic"
              data-testid={`${testIdPrefix}-empty`}
            >
              No saved {fieldLabel}s yet — type a value and press Enter to use it.
            </div>
          ) : (
            filtered.map((opt, i) => (
              <button
                key={`${opt.id}-${i}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.label);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-orange-50 hover:text-orange-900 border-b border-border/30 last:border-b-0"
                data-testid={`${testIdPrefix}-option-${i}`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
      {mapping && (
        <div className="mt-1">
          <MappingPill
            label={mapping.label}
            confidence={mapping.confidence}
            testId={`${testIdPrefix}-mapping-pill`}
          />
        </div>
      )}
    </div>
  );
}

// Multi-value chip editor used inside ConditionsEditorInline for `in` / `not_in`
// operators. Each value renders as a removable chip; a small input at the end
// accepts new values on Enter or comma. Keeps every value visible (no clipping).
function ConditionChipsEditor({
  field,
  attribute,
  values,
  onChange,
  disabled,
  testIdPrefix,
  getMapping,
}: {
  field: string;
  attribute?: string;
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  testIdPrefix: string;
  getMapping?: (value: string) => { recordId: string; label: string; confidence: number } | null;
}) {
  const [draft, setDraft] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch master-data values for this field. Cached per field+attribute.
  const valuesUrl = attribute
    ? `/api/condition-values/${encodeURIComponent(field)}?attribute=${encodeURIComponent(attribute)}`
    : `/api/condition-values/${encodeURIComponent(field)}`;
  const { data: optionsResp } = useQuery<{ values: Array<{ id: string; label: string }> }>({
    queryKey: ["/api/condition-values", field, attribute || ""],
    queryFn: async () => {
      const res = await apiRequest("GET", valuesUrl);
      return res.json();
    },
    enabled: !!field,
    staleTime: 5 * 60_000,
  });
  const allOptions = optionsResp?.values ?? [];
  const filteredOptions = (() => {
    const q = draft.trim().toLowerCase();
    const taken = new Set(values.map((v) => v.toLowerCase()));
    const pool = allOptions.filter((o) => !taken.has((o.label || "").toLowerCase()));
    if (!q) return pool.slice(0, 8);
    return pool
      .filter((o) => (o.label || "").toLowerCase().includes(q))
      .slice(0, 8);
  })();
  const showEmptyHint = allOptions.length === 0;
  const fieldLabel = (field || "value").replace(/_/g, " ");

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    // Allow commit-many: paste "a, b, c" then Enter splits
    const parts = trimmed
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length === 0) return;
    const merged = [...values];
    for (const p of parts) if (!merged.includes(p)) merged.push(p);
    onChange(merged);
    setDraft("");
  };

  const removeAt = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  const addValue = (v: string) => {
    const t = v.trim();
    if (!t) return;
    if (!values.includes(t)) onChange([...values, t]);
    setDraft("");
  };

  return (
    <div className="relative">
      <div
        className="min-h-8 flex flex-wrap items-center gap-1 px-1.5 py-1 rounded-md border border-input bg-background text-[11px]"
        data-testid={testIdPrefix}
      >
        {values.map((v, i) => {
          const m = getMapping ? getMapping(v) : null;
          return (
            <span
              key={`${v}-${i}`}
              className="inline-flex flex-col items-start gap-0.5"
              data-testid={`${testIdPrefix}-chip-wrap-${i}`}
            >
              <span
                className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-900 rounded px-1.5 py-0.5 leading-tight"
                data-testid={`${testIdPrefix}-chip-${i}`}
              >
                <span className="break-all">{v}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="text-orange-500 hover:text-rose-600"
                    aria-label={`Remove ${v}`}
                    data-testid={`${testIdPrefix}-remove-${i}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
              {m && (
                <MappingPill
                  label={m.label}
                  confidence={m.confidence}
                  testId={`${testIdPrefix}-mapping-pill-${i}`}
                />
              )}
            </span>
          );
        })}
        <input
          type="text"
          value={draft}
          disabled={disabled}
          onFocus={() => setShowSuggestions(true)}
          onChange={(e) => {
            const next = e.target.value;
            if (next.endsWith(",")) {
              addValue(next.slice(0, -1));
              return;
            }
            setDraft(next);
            setShowSuggestions(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filteredOptions.length > 0 && draft.trim()) {
                addValue(filteredOptions[0].label);
              } else {
                commitDraft();
              }
            } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
              removeAt(values.length - 1);
            } else if (e.key === "Escape") {
              setShowSuggestions(false);
            }
          }}
          onBlur={() => {
            // Delay so option click fires before close
            setTimeout(() => setShowSuggestions(false), 150);
            commitDraft();
          }}
          placeholder={values.length === 0 ? "Pick or type a value…" : "+ add"}
          className="flex-1 min-w-[80px] outline-none bg-transparent text-[11px] py-0.5"
          data-testid={`${testIdPrefix}-input`}
        />
      </div>
      {!disabled && showSuggestions && (filteredOptions.length > 0 || showEmptyHint) && (
        <div
          className="absolute z-50 mt-1 left-0 right-0 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-lg text-[11px]"
          data-testid={`${testIdPrefix}-suggestions`}
        >
          {showEmptyHint ? (
            <div
              className="px-2 py-2 text-[10px] text-muted-foreground italic"
              data-testid={`${testIdPrefix}-empty`}
            >
              No saved {fieldLabel}s yet — type a value and press Enter (or comma) to add it.
            </div>
          ) : (
            filteredOptions.map((opt, i) => (
              <button
                key={`${opt.id}-${i}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addValue(opt.label);
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-orange-50 hover:text-orange-900 border-b border-border/30 last:border-b-0"
                data-testid={`${testIdPrefix}-option-${i}`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const GROUP_DOT_COLORS = [
  "bg-orange-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-rose-500",
];

function nextGroupId(existing: string[]): string {
  for (let i = 1; i < 100; i++) {
    const g = `G${i}`;
    if (!existing.includes(g)) return g;
  }
  return `G${Date.now()}`;
}

type RuleConditionCatalog = {
  objects: Array<{
    object: QualifierFieldCode;
    attributes: Array<{
      code: string;
      label: string;
      fieldType: string;
      masterTable?: string | null;
      isDefault?: boolean;
      sequence?: number;
    }>;
  }>;
};

function ConditionsEditorInline({
  conditions,
  onChange,
  disabled,
  contractId,
}: {
  conditions: Condition[];
  onChange: (next: Condition[]) => void;
  disabled?: boolean;
  contractId?: string;
}) {
  // Whitelist catalog of (object, attribute) pairs. Drives both the Object
  // and Attribute dropdowns. Falls back to the static QUALIFIER_FIELDS
  // registry while loading or on error.
  const catalogQ = useQuery<RuleConditionCatalog>({
    queryKey: ["/api/rule-condition-catalog"],
    staleTime: 60_000,
  });
  const catalogObjects = catalogQ.data?.objects ?? [];
  const objectOptions = catalogObjects.length > 0
    ? catalogObjects.map((o) => {
        const def = QUALIFIER_FIELDS.find((f) => f.code === o.object);
        return { code: o.object, label: def?.label ?? o.object };
      })
    : QUALIFIER_FIELDS.map((f) => ({ code: f.code, label: f.label }));
  const attributesFor = (objectCode: string) => {
    const found = catalogObjects.find((o) => o.object === objectCode);
    if (found && found.attributes.length > 0) return found.attributes;
    // fallback: a single synthetic attribute matching the field's default
    const def = QUALIFIER_FIELDS.find((f) => f.code === objectCode);
    return [{ code: def?.defaultAttribute || "name", label: "Name", fieldType: "text", isDefault: true }];
  };
  const defaultAttributeFor = (objectCode: string) => {
    const attrs = attributesFor(objectCode);
    return (attrs.find((a) => a.isDefault) ?? attrs[0])?.code || "name";
  };

  // Pull accepted mappings (shared cache w/ MappingSection) so we can show
  // a tiny pill under each value with the matched master record + confidence.
  const acceptedQ = useQuery<{
    links: Array<{
      dimension: string;
      value: string;
      recordId: string;
      recordValue: string;
      confidence: number;
      method: string;
    }>;
  }>({
    queryKey: ["/api/mapping/accepted", contractId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/mapping/accepted?contractId=${encodeURIComponent(contractId || "")}`
      );
      return res.json();
    },
    enabled: !!contractId,
    // Always refetch on mount so the pills are consistent whether the user
    // opened the rule directly or detoured through another rule. Without this,
    // a stale empty cache from a prior visit (before any mappings existed)
    // would keep showing "no pills" even after auto-map had persisted links.
    refetchOnMount: "always",
    staleTime: 0,
  });

  const lookupMapping = (field: string, value: string) => {
    if (!value) return null;
    const dim =
      field === "product" || field === "product_category"
        ? "product"
        : field === "territory"
        ? "territory"
        : null;
    if (!dim) return null;
    const key = `${dim}::${value.trim().toLowerCase()}`;
    const hit = (acceptedQ.data?.links || []).find(
      (lk) => `${lk.dimension}::${lk.value.toLowerCase()}` === key
    );
    return hit
      ? { recordId: hit.recordId, label: hit.recordValue, confidence: hit.confidence }
      : null;
  };
  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const c of conditions) {
      if (!seen.includes(c.group)) seen.push(c.group);
    }
    return seen.length ? seen : [];
  }, [conditions]);

  const groupColor = (idx: number) =>
    GROUP_DOT_COLORS[idx % GROUP_DOT_COLORS.length];

  const updateAt = (idx: number, next: Condition) =>
    onChange(conditions.map((c, i) => (i === idx ? next : c)));

  const removeAt = (idx: number) =>
    onChange(conditions.filter((_, i) => i !== idx));

  const addToGroup = (group: string) => {
    onChange([
      ...conditions,
      {
        field: "product",
        attribute: defaultAttributeFor("product"),
        op: "in",
        value: "",
        group,
        type: "include",
      },
    ]);
  };

  const addNewGroup = () => {
    const g = nextGroupId(groups);
    addToGroup(g);
  };

  const seedFirstGroup = () => addToGroup("G1");

  if (conditions.length === 0) {
    return (
      <div className="border border-dashed border-zinc-300 rounded-md p-4 text-center">
        <p className="text-[12px] text-zinc-600 mb-2">
          No conditions yet — this rule applies to <strong>all sales</strong> on the contract.
        </p>
        <button
          type="button"
          onClick={seedFirstGroup}
          disabled={disabled}
          className="text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold disabled:opacity-50"
          data-testid="button-add-first-condition"
        >
          <Plus className="h-3 w-3" /> Add first condition
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-zinc-500">
        Conditions inside the same group are joined with <strong>AND</strong>. Different
        groups are joined with <strong>OR</strong>.
      </p>
      {groups.map((g, gIdx) => {
        const groupConds = conditions
          .map((c, idx) => ({ c, idx }))
          .filter(({ c }) => c.group === g);
        return (
          <div key={g}>
            <div
              className="rounded-md border-2 border-orange-200 bg-orange-50/40 p-2.5"
              data-testid={`condition-group-${g}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${groupColor(gIdx)}`} />
                  <span className="text-[11px] font-semibold text-zinc-800">
                    Group {g.slice(1)}
                  </span>
                  <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-semibold">
                    All must match · AND
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500">
                  {groupConds.length} condition{groupConds.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-1.5">
                {(() => {
                  // Merge consecutive same-(field,op,type) conditions in this group
                  // into one multi-value display row. Storage stays one-row-per-value
                  // so the evaluator and existing data continue to work unchanged.
                  type Merged = {
                    field: QualifierFieldCode;
                    attribute: string;
                    op: Condition["op"];
                    type: Condition["type"];
                    values: string[];
                    indices: number[];
                  };
                  const merged: Merged[] = [];
                  for (const { c, idx } of groupConds) {
                    const cAttr = (c.attribute && c.attribute.trim()) || defaultAttributeFor(c.field);
                    const last = merged[merged.length - 1];
                    if (
                      last &&
                      last.field === c.field &&
                      last.attribute === cAttr &&
                      last.op === c.op &&
                      last.type === c.type
                    ) {
                      last.values.push(c.value);
                      last.indices.push(idx);
                    } else {
                      merged.push({
                        field: c.field,
                        attribute: cAttr,
                        op: c.op,
                        type: c.type,
                        values: [c.value],
                        indices: [idx],
                      });
                    }
                  }

                  const replaceMerged = (m: Merged, patch: Partial<Merged>) => {
                    const nextField = (patch.field ?? m.field) as QualifierFieldCode;
                    const nextAttribute = patch.attribute ?? m.attribute;
                    const nextOp = (patch.op ?? m.op) as Condition["op"];
                    const nextType = (patch.type ?? m.type) as Condition["type"];
                    const nextValues = patch.values ?? m.values;
                    const replacements: Condition[] = nextValues.map((v) => ({
                      field: nextField,
                      attribute: nextAttribute,
                      op: nextOp,
                      value: v,
                      group: g,
                      type: nextType,
                    }));
                    // Splice: remove all original indices, insert replacements at first idx.
                    const insertAt = m.indices[0];
                    const drop = new Set(m.indices);
                    const next: Condition[] = [];
                    for (let i = 0; i < conditions.length; i++) {
                      if (i === insertAt) next.push(...replacements);
                      if (!drop.has(i)) next.push(conditions[i]);
                    }
                    onChange(next);
                  };

                  return merged.map((m, mIdx) => {
                    const isMulti = m.op === "in" || m.op === "not_in";
                    const valueText = isMulti
                      ? m.values.filter((v) => v.trim() !== "").join(", ")
                      : m.values[0] ?? "";
                    const rowKey = `${m.field}-${m.op}-${m.type}-${m.indices[0]}`;
                    const attrOptions = attributesFor(m.field);
                    // Always show the Attribute selector for product_attribute
                    // (EAV) so users can pick which attribute name to filter on
                    // even before any data exists; for other objects only show
                    // when there is more than one whitelisted attribute.
                    const showAttrSelect = m.field === "product_attribute" || attrOptions.length > 1;
                    return (
                      <div
                        key={rowKey}
                        className={
                          showAttrSelect
                            ? "grid grid-cols-[1fr_1fr_1fr_2fr_28px_28px] gap-1.5 items-start"
                            : "grid grid-cols-[1fr_1fr_2fr_28px_28px] gap-1.5 items-start"
                        }
                        data-testid={`condition-row-${mIdx}`}
                      >
                        <Select
                          value={m.field}
                          disabled={disabled}
                          onValueChange={(v) => {
                            const nextField = v as QualifierFieldCode;
                            if (nextField === m.field) return;
                            // Field switched — old values (e.g. product names) don't
                            // belong under the new field (e.g. product_category).
                            // Reset to a single empty slot so the value picker shows
                            // a clean dropdown sourced from the new field's master data.
                            replaceMerged(m, {
                              field: nextField,
                              attribute: defaultAttributeFor(nextField),
                              values: [""],
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 text-[11px]" data-testid={`select-condition-field-${mIdx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {objectOptions.map((f) => (
                              <SelectItem key={f.code} value={f.code} className="text-[11px]">
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {showAttrSelect && (
                          <Select
                            value={m.attribute}
                            disabled={disabled}
                            onValueChange={(v) => {
                              if (v === m.attribute) return;
                              replaceMerged(m, { attribute: v, values: [""] });
                            }}
                          >
                            <SelectTrigger className="h-8 text-[11px]" data-testid={`select-condition-attribute-${mIdx}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {attrOptions.map((a) => (
                                <SelectItem key={a.code} value={a.code} className="text-[11px]">
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Select
                          value={m.op}
                          disabled={disabled}
                          onValueChange={(v) => {
                            const newOp = v as Condition["op"];
                            const newIsMulti = newOp === "in" || newOp === "not_in";
                            const nextValues = newIsMulti ? m.values : [m.values[0] ?? ""];
                            replaceMerged(m, { op: newOp, values: nextValues });
                          }}
                        >
                          <SelectTrigger className="h-8 text-[11px]" data-testid={`select-condition-op-${mIdx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(OP_LABEL).map(([op, label]) => (
                              <SelectItem key={op} value={op} className="text-[11px]">
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isMulti ? (
                          <ConditionChipsEditor
                            field={m.field}
                            attribute={m.attribute}
                            values={m.values.filter((v) => v.trim() !== "")}
                            disabled={disabled}
                            onChange={(nextValues) =>
                              replaceMerged(m, { values: nextValues.length ? nextValues : [""] })
                            }
                            testIdPrefix={`condition-chips-${mIdx}`}
                            getMapping={(v) => lookupMapping(m.field, v)}
                          />
                        ) : (
                          <ConditionValuePicker
                            field={m.field}
                            attribute={m.attribute}
                            value={valueText}
                            disabled={disabled}
                            onChange={(next) => replaceMerged(m, { values: [next] })}
                            testIdPrefix={`condition-value-${mIdx}`}
                            mapping={lookupMapping(m.field, valueText)}
                          />
                        )}
                        <button
                          type="button"
                          disabled={disabled}
                          title={m.type === "include" ? "Include (click to exclude)" : "Exclude (click to include)"}
                          onClick={() =>
                            replaceMerged(m, {
                              type: m.type === "include" ? "exclude" : "include",
                            })
                          }
                          className={`h-8 w-7 rounded border text-xs font-bold disabled:opacity-50 ${
                            m.type === "include"
                              ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                              : "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100"
                          }`}
                          data-testid={`button-condition-toggle-${mIdx}`}
                        >
                          {m.type === "include" ? "✓" : "✕"}
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            // Remove every underlying row for this merged display row.
                            const drop = new Set(m.indices);
                            onChange(conditions.filter((_, i) => !drop.has(i)));
                          }}
                          className="h-8 w-7 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center disabled:opacity-50"
                          data-testid={`button-condition-delete-${mIdx}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => addToGroup(g)}
                className="mt-2 text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded border border-orange-200 bg-white hover:bg-orange-50 text-orange-700 font-semibold disabled:opacity-50"
                data-testid={`button-add-condition-${g}`}
              >
                <Plus className="h-3 w-3" /> Add condition to this group
              </button>
            </div>
            {gIdx < groups.length - 1 && (
              <div className="flex items-center gap-2 my-1.5">
                <div className="flex-1 border-t border-dashed border-zinc-300" />
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700 text-white font-bold">
                  OR
                </span>
                <div className="flex-1 border-t border-dashed border-zinc-300" />
              </div>
            )}
          </div>
        );
      })}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={disabled}
          onClick={addNewGroup}
          className="text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-300 bg-white hover:bg-zinc-50 font-semibold text-zinc-700 disabled:opacity-50"
          data-testid="button-add-or-group"
        >
          <Plus className="h-3 w-3" /> Add OR group
        </button>
      </div>
    </div>
  );
}

function MappingSection({
  productValues,
  territoryValues,
  qualifierValues,
  contractId,
  onUnmappedCountChange,
}: {
  productValues: string[];
  territoryValues: string[];
  qualifierValues: any[];
  contractId: string;
  onUnmappedCountChange?: (n: number) => void;
}) {
  // Build a unique list of (value, dimension) pairs to map. Pull from the
  // legacy CSV fields AND from contract_qualifiers so we cover both shapes.
  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ value: string; dimension: "product" | "category" | "territory" }> = [];
    const add = (v: string, dim: "product" | "category" | "territory") => {
      const cleaned = v.trim().replace(/^!/, "");
      if (!cleaned || cleaned === "*" || cleaned.toLowerCase() === "general") return;
      const key = `${dim}::${cleaned.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ value: cleaned, dimension: dim });
    };
    productValues.forEach((p) => add(p, "product"));
    territoryValues.forEach((t) => add(t, "territory"));
    (qualifierValues || []).forEach((q: any) => {
      const dim: "product" | "category" | "territory" | null =
        q.qualifierField === "product_category"
          ? "category"
          : q.qualifierField === "product"
          ? "product"
          : q.qualifierField === "territory" || q.qualifierField === "region"
          ? "territory"
          : null;
      if (!dim) return;
      const values = Array.isArray(q.qualifierValues)
        ? q.qualifierValues
        : q.qualifierValue
        ? [q.qualifierValue]
        : [];
      values.forEach((v: string) => add(v, dim));
    });
    return out;
  }, [productValues, territoryValues, qualifierValues]);

  const totalCount = items.length;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Lifted state: per-key accepted MapSuggestion (or null = pending/unmapped).
  const [accepted, setAccepted] = useState<Record<string, MapSuggestion | null>>({});
  // Track suggestion responses keyed the same way so Auto-map can read tops.
  const [suggestionByKey, setSuggestionByKey] = useState<Record<string, MapResponse | undefined>>({});
  const [isAutoMapping, setIsAutoMapping] = useState(false);

  const keyOf = (it: { value: string; dimension: string }) =>
    `${it.dimension}::${it.value.toLowerCase()}`;

  // Pre-load previously accepted mappings on mount / contract change.
  const accepted$ = useQuery<{ links: Array<{ dimension: string; value: string; recordId: string; recordValue: string; confidence: number; method: string }> }>({
    queryKey: ["/api/mapping/accepted", contractId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/mapping/accepted?contractId=${encodeURIComponent(contractId)}`);
      return res.json();
    },
    enabled: !!contractId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!accepted$.data?.links) return;
    setAccepted((prev) => {
      const next = { ...prev };
      for (const lk of accepted$.data!.links) {
        const k = `${lk.dimension}::${lk.value.toLowerCase()}`;
        if (next[k] === undefined) {
          next[k] = {
            recordId: lk.recordId,
            recordValue: lk.recordValue,
            field: "",
            confidence: lk.confidence,
            method: lk.method,
            table: "",
          };
        }
      }
      return next;
    });
  }, [accepted$.data]);

  // Compute mapped vs unmapped counts and bubble up.
  const mappedCount = useMemo(() => {
    let n = 0;
    for (const it of items) if (accepted[keyOf(it)]) n++;
    return n;
  }, [items, accepted]);
  const unmappedCount = totalCount - mappedCount;

  useEffect(() => {
    onUnmappedCountChange?.(unmappedCount);
  }, [unmappedCount, onUnmappedCountChange]);

  const persistMutation = useMutation({
    mutationFn: async (payload: {
      dimension: string;
      value: string;
      recordId: string | null;
      recordValue?: string;
      confidence?: number;
      method?: string;
    }) => {
      const res = await apiRequest("POST", "/api/mapping/accept", { contractId, ...payload });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mapping/accepted", contractId] });
    },
    onError: (err: any) => {
      toast({ title: "Mapping save failed", description: err?.message || "Could not save mapping.", variant: "destructive" });
    },
  });

  const handleAccept = (it: { value: string; dimension: string }, sug: MapSuggestion) => {
    setAccepted((prev) => ({ ...prev, [keyOf(it)]: sug }));
    persistMutation.mutate({
      dimension: it.dimension,
      value: it.value,
      recordId: sug.recordId,
      recordValue: sug.recordValue,
      confidence: sug.confidence,
      method: sug.method,
    });
  };

  const handleClear = (it: { value: string; dimension: string }) => {
    setAccepted((prev) => ({ ...prev, [keyOf(it)]: null }));
    persistMutation.mutate({ dimension: it.dimension, value: it.value, recordId: null });
  };

  const handleSuggestionLoaded = (it: { value: string; dimension: string }, data: MapResponse) => {
    setSuggestionByKey((prev) => ({ ...prev, [keyOf(it)]: data }));
  };

  const handleAutoMapAll = async () => {
    setIsAutoMapping(true);
    try {
      let mapped = 0;
      let skipped = 0;
      for (const it of items) {
        const k = keyOf(it);
        if (accepted[k]) continue;
        const sug = suggestionByKey[k]?.suggestions?.[0];
        if (sug && sug.confidence >= 0.7) {
          handleAccept(it, sug);
          mapped++;
        } else {
          skipped++;
        }
      }
      toast({
        title: "Auto-map complete",
        description: `Linked ${mapped} value${mapped === 1 ? "" : "s"}` +
          (skipped > 0 ? ` · ${skipped} need manual attention` : ""),
      });
    } finally {
      setIsAutoMapping(false);
    }
  };

  return (
    <Section
      icon={Sparkles}
      title="AI master-data mapping"
      count={totalCount}
      testid="mapping"
      defaultOpen
    >
      <div className="text-[11px] text-zinc-600 bg-orange-50/50 border border-orange-100 rounded-md p-2.5 flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-orange-600 shrink-0 mt-0.5" />
        <span>
          Each product / territory value is matched against your ERP master data
          (Items, Territory Master) using a fuzzy + AI cascade. Confirmed
          mappings will be required to mark this rule as <b>Verified</b>.
        </span>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between gap-2 mt-2 mb-1 px-1">
          <div className="text-[11px] text-zinc-700">
            <span className="font-semibold text-zinc-900">{mappedCount}</span>
            <span className="text-zinc-500"> / {totalCount} mapped</span>
            {unmappedCount > 0 && (
              <span className="ml-2 text-rose-700 font-medium">
                · {unmappedCount} unmapped
              </span>
            )}
          </div>
          <button
            onClick={handleAutoMapAll}
            disabled={isAutoMapping || unmappedCount === 0}
            className="text-[10px] px-2 py-1 rounded bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-300 text-white font-semibold inline-flex items-center gap-1"
            data-testid="button-automap-all"
            title={unmappedCount === 0 ? "Everything is already mapped" : "Auto-accept top suggestion ≥70% confidence for each unmapped value"}
          >
            {isAutoMapping ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Auto-map all
          </button>
        </div>
      )}

      {totalCount === 0 ? (
        <div className="text-[11px] text-zinc-500 italic px-2 py-3 border border-dashed border-zinc-200 rounded">
          No reference values to map — add a product or territory above.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <MapRow
              key={`${it.dimension}-${it.value}-${i}`}
              item={it}
              accepted={accepted[keyOf(it)] ?? null}
              onAccept={(sug) => handleAccept(it, sug)}
              onClear={() => handleClear(it)}
              onSuggestionLoaded={(data) => handleSuggestionLoaded(it, data)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function MapRow({
  item,
  accepted,
  onAccept,
  onClear,
  onSuggestionLoaded,
}: {
  item: { value: string; dimension: "product" | "territory" };
  accepted: MapSuggestion | null;
  onAccept: (sug: MapSuggestion) => void;
  onClear: () => void;
  onSuggestionLoaded?: (data: MapResponse) => void;
}) {
  const query = useQuery<MapResponse>({
    queryKey: ["/api/mapping/value-suggest", item.dimension, item.value],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/mapping/value-suggest", {
        value: item.value,
        dimension: item.dimension,
      });
      return res.json();
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.data) onSuggestionLoaded?.(query.data);
  }, [query.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = query.data;
  const top = data?.suggestions?.[0];
  const status = accepted
    ? "verified"
    : data?.status || (query.isLoading ? "loading" : "unmapped");

  const dimColor =
    item.dimension === "product"
      ? "bg-orange-50 border-orange-200 text-orange-800"
      : "bg-sky-50 border-sky-200 text-sky-800";

  const statusBadge =
    status === "verified" ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 inline-flex items-center gap-0.5">
        <CheckCircle2 className="h-2.5 w-2.5" /> Linked
      </span>
    ) : status === "suggested" ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        Suggested
      </span>
    ) : status === "unmapped" ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-0.5">
        <AlertTriangle className="h-2.5 w-2.5" /> Unmapped
      </span>
    ) : (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 inline-flex items-center gap-1">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Searching…
      </span>
    );

  return (
    <div
      className="border border-zinc-200 rounded-md p-2.5 bg-white"
      data-testid={`map-row-${item.dimension}-${item.value}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${dimColor}`}>
          {item.dimension}
        </span>
        <span className="text-xs font-semibold text-zinc-900 truncate">{item.value}</span>
        <div className="ml-auto">{statusBadge}</div>
      </div>

      {query.isLoading && !accepted && (
        <div className="text-[11px] text-zinc-500 italic">Searching master data…</div>
      )}

      {query.isError && (
        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded p-1.5">
          Lookup failed. <button onClick={() => query.refetch()} className="underline">Retry</button>
        </div>
      )}

      {!query.isLoading && !accepted && data && top && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
            <span className="font-semibold text-zinc-900 truncate">{top.recordValue}</span>
            <span className="text-zinc-400 truncate">· {top.field}</span>
            <span className="ml-auto text-zinc-500 shrink-0">
              {Math.round(top.confidence * 100)}% · {top.method}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onAccept(top)}
              className="text-[10px] px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-700 text-white font-semibold inline-flex items-center gap-1"
              data-testid={`button-accept-${item.dimension}-${item.value}`}
            >
              <CheckCircle2 className="h-2.5 w-2.5" /> Accept
            </button>
            <button
              onClick={() => query.refetch()}
              className="text-[10px] px-2 py-0.5 rounded border border-zinc-200 hover:bg-zinc-50 text-zinc-700 inline-flex items-center gap-1"
              data-testid={`button-resuggest-${item.dimension}-${item.value}`}
            >
              <Sparkles className="h-2.5 w-2.5" /> Re-suggest
            </button>
            {data.suggestions.length > 1 && (
              <details className="ml-1">
                <summary className="text-[10px] text-orange-700 cursor-pointer hover:underline">
                  {data.suggestions.length - 1} alt
                </summary>
                <div className="mt-1 space-y-1">
                  {data.suggestions.slice(1).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onAccept(s)}
                      className="block w-full text-left text-[10px] px-2 py-1 rounded hover:bg-orange-50 border border-zinc-100"
                    >
                      <span className="font-semibold">{s.recordValue}</span>
                      <span className="text-zinc-500 ml-1">
                        · {Math.round(s.confidence * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {!query.isLoading && !accepted && data && !top && (
        <div className="text-[11px] text-zinc-600 bg-rose-50 border border-rose-100 rounded p-2">
          No master data match found{" "}
          {data.candidatesScanned > 0 && (
            <span className="text-zinc-500">
              ({data.candidatesScanned} candidates scanned)
            </span>
          )}
          . Add this value to your{" "}
          {item.dimension === "product" ? "Product" : "Territory"} master.
        </div>
      )}

      {accepted && (
        <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded p-1.5 flex items-center gap-2">
          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
          <span className="truncate">
            Linked to <b>{accepted.recordValue}</b> ({Math.round(accepted.confidence * 100)}%)
          </span>
          <button
            onClick={() => onClear()}
            className="ml-auto text-[10px] text-emerald-700 hover:underline"
            data-testid={`button-unlink-${item.dimension}-${item.value}`}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
