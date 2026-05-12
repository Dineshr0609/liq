export type InsightType = "opportunity" | "alert" | "requirement" | "info";

export const TYPE_LABEL: Record<InsightType, string> = {
  opportunity: "Opportunity",
  alert: "Alert",
  requirement: "Requirement",
  info: "Info",
};

export const TYPE_DOT: Record<InsightType, string> = {
  opportunity: "bg-emerald-500",
  alert: "bg-amber-500",
  requirement: "bg-blue-500",
  info: "bg-slate-400",
};

export const TYPE_TEXT: Record<InsightType, string> = {
  opportunity: "text-emerald-700 dark:text-emerald-300",
  alert: "text-amber-700 dark:text-amber-300",
  requirement: "text-blue-700 dark:text-blue-300",
  info: "text-slate-600 dark:text-slate-300",
};

export const TYPE_BG: Record<InsightType, string> = {
  opportunity: "bg-emerald-50 dark:bg-emerald-950/60",
  alert: "bg-amber-50 dark:bg-amber-950/60",
  requirement: "bg-blue-50 dark:bg-blue-950/60",
  info: "bg-slate-100 dark:bg-slate-800/60",
};

export const TYPE_RING: Record<InsightType, string> = {
  opportunity: "ring-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:ring-emerald-900",
  alert: "ring-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:ring-amber-900",
  requirement: "ring-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:ring-blue-900",
  info: "ring-slate-200 bg-slate-50 dark:bg-slate-900/40 dark:ring-slate-800",
};

export type Insight = {
  id: string;
  type: InsightType;
  category: string;
  title: string;
  description: string;
  whyItMatters: string;
  suggestedAction: string;
  clauseRef?: string;
  // Forward-looking: not in today's backend
  impactLabel?: string;
  dueLabel?: string;
  // 1 = highest priority for the top-3 sort
  priority: 1 | 2 | 3 | 4 | 5;
};

export const CONTRACT_LABEL = "Acme Pharma — Master License Agreement (2024)";

export const INSIGHTS: Insight[] = [
  {
    id: "i1",
    type: "opportunity",
    category: "Renewal",
    title: "Renewal window opens in 90 days — repricing eligible",
    description: "Hit volume tier 3 in Q2; contract supports rate step-down on renewal.",
    whyItMatters:
      "§ 12.4 of the agreement allows a renegotiated royalty rate at renewal once tier 3 volume is sustained for 2 consecutive quarters. Q1 and Q2 both cleared the threshold.",
    suggestedAction:
      "Open a renewal worksheet, model 8.5% vs. 12% rates against Q3 forecast, and route the proposal to commercial 30 days ahead of the notice deadline.",
    clauseRef: "§ 12.4 Renewal pricing",
    impactLabel: "+$240K/yr potential",
    priority: 1,
  },
  {
    id: "i2",
    type: "alert",
    category: "Pricing",
    title: "MFN clause could trigger a price match",
    description: "Competitor signed similar deal at 8.5% — your 12% rate is exposed.",
    whyItMatters:
      "The most-favored-nation clause obliges Licensor to extend better terms granted to comparable third parties. A public Q1 filing flagged a 8.5% rate to a competing licensee in the same territory.",
    suggestedAction:
      "Confirm the comparator with legal, model the back-credit exposure, and draft a unilateral rate amendment before the next quarterly statement.",
    clauseRef: "§ 7.6 MFN",
    impactLabel: "−$180K/yr risk",
    priority: 1,
  },
  {
    id: "i3",
    type: "requirement",
    category: "Reporting",
    title: "Quarterly royalty report due Apr 15",
    description: "Self-reporting deadline per § 7.2 Reporting.",
    whyItMatters:
      "Late filing triggers a 4% interest charge on undeclared amounts and resets the audit window. Q1 sales close on Mar 31; allow 10 working days for reconciliation.",
    suggestedAction:
      "Assign to revenue ops, lock the Q1 sales-to-contract match by Apr 8, and generate the report from the calculation snapshot.",
    clauseRef: "§ 7.2 Reporting",
    dueLabel: "Due Apr 15",
    priority: 2,
  },
  {
    id: "i4",
    type: "opportunity",
    category: "Audit rights",
    title: "Audit look-back negotiable at renewal",
    description: "Counterparty currently caps look-back at 12 mo; market is 36.",
    whyItMatters:
      "A 12-month window is shorter than the statutory recovery period; widening it to 36 months on renewal would align the contract with the rest of the portfolio and reduce leakage risk.",
    suggestedAction:
      "Add a 36-month audit ask to the renewal redline. Pair it with a softening on notice period if needed.",
    clauseRef: "§ 9.3 Audit",
    priority: 3,
  },
  {
    id: "i5",
    type: "info",
    category: "Concentration",
    title: "Concentration warning — 62% of fee revenue",
    description: "Top counterparty exposure documented in Schedule B forecast.",
    whyItMatters:
      "Single-licensee concentration above 60% materially increases revenue volatility. This is informational today but should feed into the next portfolio review.",
    suggestedAction:
      "Flag in the next quarterly portfolio review. Consider stress-testing cashflow under partial termination.",
    clauseRef: "Schedule B — Forecast",
    priority: 4,
  },
  {
    id: "i6",
    type: "info",
    category: "Renewal",
    title: "Auto-renewal opt-out window opens in 312 days",
    description: "Soft reminder for portfolio review.",
    whyItMatters:
      "Non-renewal requires 90 days written notice. Surfacing the window early gives the team room to coordinate with finance and legal.",
    suggestedAction: "Add a calendar reminder 120 days before term end.",
    clauseRef: "§ 12.2 Renewal",
    priority: 5,
  },
];
