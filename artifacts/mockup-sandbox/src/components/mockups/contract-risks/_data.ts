export type Severity = "high" | "medium" | "low";

export const SEV_LABEL: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const SEV_DOT: Record<Severity, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

export const SEV_TEXT: Record<Severity, string> = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-emerald-600 dark:text-emerald-400",
};

export const SEV_RING: Record<Severity, string> = {
  high: "ring-red-200 bg-red-50 dark:bg-red-950/40 dark:ring-red-900",
  medium: "ring-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:ring-amber-900",
  low: "ring-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:ring-emerald-900",
};

export type RiskCategory =
  | "Auto-renewal"
  | "Concentration"
  | "Term & termination"
  | "IP & licensing"
  | "Payment & price"
  | "Audit & compliance";

export type Risk = {
  id: string;
  title: string;
  category: RiskCategory;
  severity: Severity;
  summary: string;
  clauseRef: string;
  clauseExcerpt: string;
  suggestedAction: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  triggersOnDays?: number;
  triggersOnLabel?: string;
};

export const CONTRACT_LABEL = "Acme Pharma — Master License Agreement (2024)";

export const RISKS: Risk[] = [
  {
    id: "r1",
    title: "Auto-renewal trap with 90-day notice window",
    category: "Auto-renewal",
    severity: "high",
    summary: "Auto-renews for 3 years unless notice given 90 days before term end.",
    clauseRef: "§ 12.2 Renewal",
    clauseExcerpt:
      "This Agreement shall automatically renew for successive three (3) year periods unless either Party provides written notice of non-renewal not less than ninety (90) days prior to the end of the then-current term.",
    suggestedAction: "Add calendar reminder 120 days before 2027-03-31. Draft non-renewal letter template.",
    likelihood: 5,
    impact: 5,
    triggersOnDays: 312,
    triggersOnLabel: "Notice deadline",
  },
  {
    id: "r2",
    title: "Single-customer concentration above 60%",
    category: "Concentration",
    severity: "high",
    summary: "Acme Pharma represents 62% of forecast contract revenue.",
    clauseRef: "Schedule B — Forecast",
    clauseExcerpt:
      "Forecast volumes by Licensee for fiscal years 2025–2027 indicate that Licensee shall account for approximately sixty-two percent (62%) of total worldwide royalty revenue.",
    suggestedAction: "Flag for revenue assurance review. Stress-test cashflow under partial termination.",
    likelihood: 3,
    impact: 5,
  },
  {
    id: "r3",
    title: "Cap on indirect damages excludes IP indemnity",
    category: "IP & licensing",
    severity: "high",
    summary: "Liability cap carves out IP indemnification — uncapped exposure.",
    clauseRef: "§ 18.4 Limitation of Liability",
    clauseExcerpt:
      "Notwithstanding the foregoing, the limitations set forth in this Section 18 shall not apply to any indemnification obligations arising under Section 17 (Intellectual Property Indemnity).",
    suggestedAction: "Insurance review. Consider asking for mutual cap or sub-cap on IP indemnity.",
    likelihood: 2,
    impact: 5,
  },
  {
    id: "r4",
    title: "Most-favored-nation pricing on net sales",
    category: "Payment & price",
    severity: "medium",
    summary: "MFN clause forces price match across all licensees.",
    clauseRef: "§ 7.6 MFN",
    clauseExcerpt:
      "If Licensor grants any third party more favorable royalty rates for substantially similar Licensed Products in the Territory, Licensor shall promptly extend such terms to Licensee.",
    suggestedAction: "Track competitor rate cards. Flag any new licensee deals to legal.",
    likelihood: 3,
    impact: 4,
  },
  {
    id: "r5",
    title: "Audit right with 12-month look-back only",
    category: "Audit & compliance",
    severity: "medium",
    summary: "Audit window shorter than statutory recovery period.",
    clauseRef: "§ 9.3 Audit",
    clauseExcerpt:
      "Licensor's audit rights shall be limited to the twelve (12) months immediately preceding the audit notice.",
    suggestedAction: "Negotiate to 36 months on next renewal. Maintain quarterly internal reconciliations.",
    likelihood: 4,
    impact: 3,
  },
  {
    id: "r6",
    title: "Territory carve-out for EU disputed",
    category: "IP & licensing",
    severity: "medium",
    summary: "Conflicting language between Schedule A and § 3.1 Territory.",
    clauseRef: "§ 3.1 / Schedule A",
    clauseExcerpt:
      "Schedule A enumerates twenty-seven (27) EU member states; § 3.1 grants exclusivity in the 'European Economic Area' without further definition.",
    suggestedAction: "Clarify with counterparty in writing. Update master data territory list once resolved.",
    likelihood: 3,
    impact: 3,
  },
  {
    id: "r7",
    title: "Termination for convenience by Licensee with 60 days",
    category: "Term & termination",
    severity: "low",
    summary: "Licensee can walk with 60 days notice, no break fee.",
    clauseRef: "§ 14.1 Termination",
    clauseExcerpt:
      "Licensee may terminate this Agreement for any reason upon sixty (60) days written notice to Licensor.",
    suggestedAction: "Model worst-case revenue loss. Flag in accrual scenarios.",
    likelihood: 2,
    impact: 4,
    triggersOnDays: 60,
    triggersOnLabel: "Earliest walk",
  },
  {
    id: "r8",
    title: "Currency: USD only, no FX adjustment",
    category: "Payment & price",
    severity: "low",
    summary: "No FX hedge clause; Licensee absorbs currency risk.",
    clauseRef: "§ 7.4 Payment",
    clauseExcerpt:
      "All payments hereunder shall be made in United States Dollars without adjustment for fluctuations in exchange rates.",
    suggestedAction: "Treasury to model EUR/GBP exposure quarterly.",
    likelihood: 2,
    impact: 2,
  },
  {
    id: "r9",
    title: "Late-payment interest only 4% annualized",
    category: "Payment & price",
    severity: "low",
    summary: "Below market remedy for late payments.",
    clauseRef: "§ 7.5 Late Payment",
    clauseExcerpt:
      "Late payments shall accrue interest at a rate of four percent (4%) per annum.",
    suggestedAction: "Note for next renewal. Not material.",
    likelihood: 2,
    impact: 1,
  },
];
