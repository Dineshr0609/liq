/**
 * Calculation Phases & Rule Taxonomy (Slice 1)
 *
 * The calculation engine walks rules in a fixed phase order. Within a phase,
 * rules are ordered by `priority` (lower = earlier). `executionGroup` is no
 * longer engine-meaningful — it remains as a free-form user-facing label.
 *
 * Slices 2 & 3 will add evaluators for phases other than `gross_calc`.
 */

export const CALC_PHASES = [
  'gross_calc',
  'returns_offset',
  'net_adjustment',
  'floor_minimum',
  'cap_maximum',
  'obligation_accrual',
  'obligation_release',
  'obligation_expiry',
  'penalty',
] as const;

export type CalcPhase = typeof CALC_PHASES[number];

export const CALC_PHASE_ORDER: Record<CalcPhase, number> = {
  gross_calc: 1,
  returns_offset: 2,
  net_adjustment: 3,
  floor_minimum: 4,
  cap_maximum: 5,
  obligation_accrual: 6,
  obligation_release: 7,
  obligation_expiry: 8,
  penalty: 9,
};

export const CALC_PHASE_LABELS: Record<CalcPhase, string> = {
  gross_calc: 'Gross calc',
  returns_offset: 'Returns offset',
  net_adjustment: 'Net adjustment',
  floor_minimum: 'Floor minimum',
  cap_maximum: 'Cap maximum',
  obligation_accrual: 'Obligation accrual',
  obligation_release: 'Obligation release',
  obligation_expiry: 'Obligation expiry',
  penalty: 'Penalty',
};

export const CALC_PHASE_DESCRIPTIONS: Record<CalcPhase, string> = {
  gross_calc: 'Compute the gross fee from sales (percentage, tiered, fixed, etc.).',
  returns_offset: 'Subtract returns and chargebacks from gross.',
  net_adjustment: 'Apply discounts, deductions, and other net adjustments.',
  floor_minimum: 'Enforce minimum guarantees and floor amounts.',
  cap_maximum: 'Apply caps and maximums.',
  obligation_accrual: 'Accrue MDF, advances, reserves, bonuses.',
  obligation_release: 'Event-driven release of approved obligations to payable.',
  obligation_expiry: 'Date-driven sweep that expires/forfeits stale obligations.',
  penalty: 'Apply late-payment and breach penalties.',
};

/**
 * Rule trigger source. `sale` is the legacy default — every existing rule
 * fires per matching sale row. Slice 2/3 introduce additional triggers
 * (period close, contract event, etc.).
 */
export const TRIGGER_SOURCES = ['sale', 'period', 'event', 'manual'] as const;
export type TriggerSource = typeof TRIGGER_SOURCES[number];

/**
 * Aggregation scope. `per_sale` is the legacy default — the rule produces
 * one result per sale. Slice 2/3 introduce broader scopes.
 */
export const AGGREGATION_SCOPES = [
  'per_sale',
  'per_period',
  'per_contract',
] as const;
export type AggregationScope = typeof AGGREGATION_SCOPES[number];

/**
 * Default phase for a given ruleType. Used by the rule editor when a user
 * picks a rule type and by the backfill to seed `calcPhase` for legacy rules
 * that don't have one. Anything not in this map defaults to `gross_calc`
 * (which preserves today's single-phase behaviour).
 */
export const RULE_TYPE_DEFAULT_PHASE: Record<string, CalcPhase> = {
  // Gross calc
  percentage: 'gross_calc',
  tiered: 'gross_calc',
  rebate_tiered: 'gross_calc',
  rebate_percentage: 'gross_calc',
  rebate_rate: 'gross_calc',
  fixed_fee: 'gross_calc',
  per_unit: 'gross_calc',
  annual_fee: 'gross_calc',
  milestone_payment: 'gross_calc',
  milestone_tiered: 'gross_calc',
  rate_structure: 'gross_calc',
  formula_based: 'gross_calc',
  royalty: 'gross_calc',
  bonus: 'gross_calc',
  condition: 'gross_calc',
  'data-only': 'gross_calc',
  payment_schedule: 'gross_calc',

  // Slice 2 — first wave of period-close evaluators
  return_offset: 'returns_offset',
  returns_offset: 'returns_offset',
  chargeback: 'returns_offset',
  deduction: 'net_adjustment',
  discount: 'net_adjustment',
  overpayment_offset: 'net_adjustment',
  advance_recoupment: 'net_adjustment',
  minimum_guarantee: 'floor_minimum',
  annual_minimum: 'floor_minimum',
  quarterly_minimum: 'floor_minimum',
  mgr: 'floor_minimum',
  cap: 'cap_maximum',
  period_cap: 'cap_maximum',
  contract_cap: 'cap_maximum',
  late_payment_penalty: 'penalty',
  missed_milestone_fee: 'penalty',

  // Slice 3 — obligation accrual evaluators (stateful obligations).
  mdf_accrual: 'obligation_accrual',
  advance_payment: 'obligation_accrual',
  recoupable_advance: 'obligation_accrual',
  reserve_accrual: 'obligation_accrual',
  returns_reserve: 'obligation_accrual',
  performance_bonus: 'obligation_accrual',
  signing_bonus: 'obligation_accrual',
  milestone_payment_obligation: 'obligation_accrual',
  minimum_trueup: 'obligation_accrual',
};

/**
 * Minimal shape required for phase resolution / phase-then-priority sorting.
 * Use this instead of `as any` casts when calling resolveCalcPhase or
 * comparePhaseThenPriority from route/service code.
 */
export interface PhaseSortableRule {
  id?: string;
  ruleName?: string | null;
  calcPhase?: string | null;
  ruleType?: string | null;
  priority?: number | null;
}

/**
 * Resolve a rule's calcPhase. Honors explicit `calcPhase` if present, else
 * falls back to the rule-type default, else `gross_calc`.
 */
export function resolveCalcPhase(rule: PhaseSortableRule): CalcPhase {
  const explicit = (rule.calcPhase || '').trim() as CalcPhase;
  if (explicit && (CALC_PHASES as readonly string[]).includes(explicit)) {
    return explicit;
  }
  const rt = (rule.ruleType || '').trim().toLowerCase();
  if (rt && RULE_TYPE_DEFAULT_PHASE[rt]) {
    return RULE_TYPE_DEFAULT_PHASE[rt];
  }
  return 'gross_calc';
}

/**
 * Sort comparator: phase order first, then `priority` (lower wins),
 * then a stable tiebreaker on rule id / name.
 */
export function comparePhaseThenPriority(
  a: PhaseSortableRule,
  b: PhaseSortableRule,
): number {
  const pa = CALC_PHASE_ORDER[resolveCalcPhase(a)] ?? 99;
  const pb = CALC_PHASE_ORDER[resolveCalcPhase(b)] ?? 99;
  if (pa !== pb) return pa - pb;
  const prioA = a.priority ?? 10;
  const prioB = b.priority ?? 10;
  if (prioA !== prioB) return prioA - prioB;
  const ka = a.id || a.ruleName || '';
  const kb = b.id || b.ruleName || '';
  return ka.localeCompare(kb);
}

/**
 * Whitelist guards used by the API to reject malformed taxonomy values
 * before they ever reach the database. Returning `null` for unknown values
 * lets callers either fall back to defaults or 400 with a clear message.
 */
export function normalizeCalcPhase(v: unknown): CalcPhase | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim() as CalcPhase;
  return (CALC_PHASES as readonly string[]).includes(trimmed) ? trimmed : null;
}
export function normalizeTriggerSource(v: unknown): TriggerSource | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim() as TriggerSource;
  return (TRIGGER_SOURCES as readonly string[]).includes(trimmed) ? trimmed : null;
}
export function normalizeAggregationScope(v: unknown): AggregationScope | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim() as AggregationScope;
  return (AGGREGATION_SCOPES as readonly string[]).includes(trimmed) ? trimmed : null;
}

/**
 * Map common AI / legacy synonyms onto the canonical rule_type values that
 * the UI dropdowns and the calc engine recognize. The AI extractor sometimes
 * emits short forms ("offset", "advance", "recoupment", "minimum"); we coerce
 * them to canonical at write-time so the rule editor never shows an empty
 * Select for a value that's actually meaningful.
 *
 * Returns the input unchanged if it is already canonical or unrecognized
 * (callers can decide whether to accept unknown values or 400).
 */
const RULE_TYPE_ALIASES: Record<string, string> = {
  offset: 'overpayment_offset',
  overpayment: 'overpayment_offset',
  return_offset: 'returns_offset',
  recoupment: 'advance_recoupment',
  advance: 'advance_recoupment',
  minimum: 'minimum_guarantee',
  guarantee: 'minimum_guarantee',
  cap: 'cap_maximum',
  mdf: 'mdf_accrual',
  rebate: 'rebate_rate',
  flat: 'fixed_fee',
  flat_fee: 'fixed_fee',
  // Legacy AI-extractor outputs → canonical engine types
  tiered_volume: 'tiered',
  tiered_cumulative: 'rebate_tiered',
  flat_amount: 'fixed_fee',
  metered_usage: 'per_unit',
};

export function canonicalizeRuleType(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim().toLowerCase();
  if (!trimmed) return null;
  return RULE_TYPE_ALIASES[trimmed] || trimmed;
}


/** Rule types grouped for the "Add rule" picker, in phase order. */
export const RULE_TYPES_BY_PHASE: Array<{
  phase: CalcPhase;
  label: string;
  description: string;
  ruleTypes: Array<{ value: string; label: string }>;
}> = [
  {
    phase: 'gross_calc',
    label: CALC_PHASE_LABELS.gross_calc,
    description: CALC_PHASE_DESCRIPTIONS.gross_calc,
    ruleTypes: [
      { value: 'percentage', label: 'Percentage' },
      { value: 'tiered', label: 'Tiered (per-sale ladder)' },
      { value: 'rebate_tiered', label: 'Rebate tiered (retroactive — aggregate, then tier)' },
      { value: 'milestone_tiered', label: 'Milestone tiered (cumulative threshold)' },
      { value: 'net_sales_tiered', label: 'Net sales tiered ($-banded ladder)' },
      { value: 'promotional_rebate', label: 'Promotional rebate (campaign-windowed)' },
      { value: 'bonus_rebate', label: 'Bonus rebate (single-step kicker)' },
      { value: 'fixed_fee', label: 'Fixed fee' },
      { value: 'per_unit', label: 'Per unit' },
      { value: 'annual_fee', label: 'Annual fee' },
      { value: 'milestone_payment', label: 'Milestone payment' },
      { value: 'rate_structure', label: 'Rate structure' },
      { value: 'formula_based', label: 'Formula based' },
      { value: 'rebate_rate', label: 'Rebate rate' },
      { value: 'bonus', label: 'Bonus' },
    ],
  },
  {
    phase: 'returns_offset',
    label: CALC_PHASE_LABELS.returns_offset,
    description: CALC_PHASE_DESCRIPTIONS.returns_offset,
    ruleTypes: [
      { value: 'returns_offset', label: 'Returns offset' },
      { value: 'chargeback', label: 'Chargeback' },
    ],
  },
  {
    phase: 'net_adjustment',
    label: CALC_PHASE_LABELS.net_adjustment,
    description: CALC_PHASE_DESCRIPTIONS.net_adjustment,
    ruleTypes: [
      { value: 'deduction', label: 'Deduction' },
      { value: 'discount', label: 'Discount' },
      { value: 'overpayment_offset', label: 'Overpayment offset' },
      { value: 'advance_recoupment', label: 'Advance recoupment' },
    ],
  },
  {
    phase: 'floor_minimum',
    label: CALC_PHASE_LABELS.floor_minimum,
    description: CALC_PHASE_DESCRIPTIONS.floor_minimum,
    ruleTypes: [
      { value: 'minimum_guarantee', label: 'Minimum guarantee' },
      { value: 'annual_minimum', label: 'Annual minimum' },
      { value: 'quarterly_minimum', label: 'Quarterly minimum' },
      { value: 'mgr', label: 'Minimum guaranteed royalty (MGR)' },
    ],
  },
  {
    phase: 'cap_maximum',
    label: CALC_PHASE_LABELS.cap_maximum,
    description: CALC_PHASE_DESCRIPTIONS.cap_maximum,
    ruleTypes: [
      { value: 'cap', label: 'Cap' },
      { value: 'period_cap', label: 'Period cap' },
      { value: 'contract_cap', label: 'Contract cap' },
    ],
  },
  {
    phase: 'obligation_accrual',
    label: CALC_PHASE_LABELS.obligation_accrual,
    description: CALC_PHASE_DESCRIPTIONS.obligation_accrual,
    ruleTypes: [
      { value: 'mdf_accrual', label: 'MDF accrual' },
      { value: 'recoupable_advance', label: 'Recoupable advance' },
      { value: 'advance_payment', label: 'Advance payment (legacy)' },
      { value: 'returns_reserve', label: 'Returns reserve' },
      { value: 'reserve_accrual', label: 'Reserve accrual (legacy)' },
      { value: 'performance_bonus', label: 'Performance bonus' },
      { value: 'signing_bonus', label: 'Signing bonus' },
      { value: 'milestone_payment', label: 'Milestone payment (stateful obligation)' },
      { value: 'milestone_payment_obligation', label: 'Milestone payment (alias)' },
      { value: 'minimum_trueup', label: 'Minimum true-up' },
      { value: 'payment_schedule', label: 'Payment schedule' },
    ],
  },
  {
    phase: 'penalty',
    label: CALC_PHASE_LABELS.penalty,
    description: CALC_PHASE_DESCRIPTIONS.penalty,
    ruleTypes: [
      { value: 'late_payment_penalty', label: 'Late payment penalty' },
      { value: 'missed_milestone_fee', label: 'Missed milestone fee' },
      { value: 'compliance_penalty', label: 'Compliance penalty' },
    ],
  },
  {
    phase: 'obligation_accrual',
    label: 'Schedule',
    description: 'Payment timing & schedule rules (no per-sale calc)',
    ruleTypes: [
      { value: 'payment_schedule', label: 'Payment schedule' },
    ],
  },
];

/**
 * Slice 2 — rule types whose evaluators are period-close (not per-sale).
 * The universal calc path runs gross_calc per-sale first, then invokes the
 * period-close evaluators in phase order to net into the final payable.
 */
export const PERIOD_CLOSE_RULE_TYPES = new Set<string>([
  'returns_offset',
  'return_offset',
  'chargeback',
  'overpayment_offset',
  'advance_recoupment',
  'annual_minimum',
  'quarterly_minimum',
  'mgr',
  'period_cap',
  'contract_cap',
  'late_payment_penalty',
  'missed_milestone_fee',
]);

/**
 * Slice 3 — rule types whose evaluators create / refresh stateful obligation
 * rows during the obligation_accrual phase at period close. These rules do
 * NOT net into the period payable directly; they upsert obligations that
 * later transition (release/expire/pay) via their own state machine.
 */
// NOTE on `milestone_payment` vs `milestone_payment_obligation`:
//   The legacy non-stateful rule type `milestone_payment` is already used
//   by the gross_calc engine (one-time event payments computed per-sale).
//   The stateful obligation variant uses `milestone_payment_obligation` so
//   the two semantics never collide. We accept both names defensively here
//   so picker UIs that resolve to either work.
export const OBLIGATION_ACCRUAL_RULE_TYPES = new Set<string>([
  'mdf_accrual',
  'advance_payment',
  'recoupable_advance',
  'reserve_accrual',
  'returns_reserve',
  'performance_bonus',
  'signing_bonus',
  // Stateful milestone obligation. `milestone_payment` is the canonical
  // rule type per the lifecycle spec; `milestone_payment_obligation` is
  // accepted as a backward-compatible alias. The engine only treats a
  // rule as a stateful obligation when its calcPhase is explicitly
  // `obligation_accrual`, so legacy `milestone_payment` rules whose
  // default phase is `gross_calc` continue to flow through gross_calc
  // unchanged unless an author opts into the obligation phase.
  'milestone_payment',
  'milestone_payment_obligation',
  'minimum_trueup',
]);

/** Canonical obligation kinds backed by the `obligations` table. */
export const OBLIGATION_KINDS = [
  'mdf',
  'recoupable_advance',
  'returns_reserve',
  'performance_bonus',
  'signing_bonus',
  'milestone_payment',
  'minimum_trueup',
  // Task 68 — Posted-Accrual → Obligation bridge. Customer / vendor rebate
  // programs and royalty/licensing agreements promote their posted accruals
  // into obligations of these kinds; without them the rebate/royalty payable
  // has no canonical bucket and the Claims Workspace can't surface them.
  'rebate',
  'royalty',
] as const;
export type ObligationKind = typeof OBLIGATION_KINDS[number];

/** State machine for a single obligation row. */
export const OBLIGATION_STATUSES = [
  'accrued',     // booked, not yet claimable
  'claimable',   // partner / accounting can submit a claim
  'claimed',     // claim submitted, awaiting approval
  'approved',    // claim approved, awaiting payment
  'paid',        // settled (full)
  'expired',     // forfeited / lapsed (no/partial claim by deadline)
  'reversed',    // accrual reversed (correction / reclass)
] as const;
export type ObligationStatus = typeof OBLIGATION_STATUSES[number];

/** Map a rule type to the obligation kind it produces. */
export const RULE_TYPE_TO_OBLIGATION_KIND: Record<string, ObligationKind> = {
  mdf_accrual: 'mdf',
  recoupable_advance: 'recoupable_advance',
  advance_payment: 'recoupable_advance',
  returns_reserve: 'returns_reserve',
  reserve_accrual: 'returns_reserve',
  performance_bonus: 'performance_bonus',
  signing_bonus: 'signing_bonus',
  milestone_payment: 'milestone_payment',
  milestone_payment_obligation: 'milestone_payment',
  minimum_trueup: 'minimum_trueup',
};
