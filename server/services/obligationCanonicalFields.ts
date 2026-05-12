/**
 * Shared helpers for lifting AI-extracted obligation rule fields from the
 * nested `formulaDefinition.calculation` / `.conditions` blocks up to the
 * canonical top-level `formulaDefinition` keys read by
 * `obligationsService.deriveAccrual` and the RuleEditorPanel.
 *
 * Originally lived inline in `server/routes.ts`. Extracted here so the
 * one-time backfill script (`server/scripts/backfill-obligation-canonical-fields.ts`)
 * can reuse the exact same vocabulary as the per-request enrichment path.
 */

export function parseNumericValue(value: any): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return (!isNaN(value) && isFinite(value)) ? value : null;
  }

  if (typeof value === 'object' && value !== null) {
    const extracted = value.amount ?? value.value ?? value.rate ?? value.baseAmount ?? value.number;
    if (extracted !== undefined && extracted !== null) {
      return parseNumericValue(extracted);
    }
    return null;
  }

  const str = String(value).trim();

  let num = parseFloat(str);
  if (!isNaN(num) && isFinite(num)) return num;

  const percentMatch = str.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    const percentVal = parseFloat(percentMatch[1]);
    if (!isNaN(percentVal) && isFinite(percentVal)) {
      return percentVal / 100;
    }
  }

  const dollarMatch = str.match(/\$([\d,]+(?:\.\d+)?)/);
  if (dollarMatch) {
    const dollarVal = parseFloat(dollarMatch[1].replace(/,/g, ''));
    if (!isNaN(dollarVal) && isFinite(dollarVal)) {
      return dollarVal;
    }
  }

  const cleaned = str.replace(/[$€£¥₹₽¢R$S$C$]/g, '').replace(/[,\s]/g, '');
  num = parseFloat(cleaned);

  return (!isNaN(num) && isFinite(num)) ? num : null;
}

/**
 * Lift canonical obligation fields (amount/rate/percentage/bps/
 * plannedReleaseDate/releaseAfterDays/expiryDate/expiresAfterDays/
 * rolloverPolicy) from the nested calculation/conditions blocks up to the
 * top level of `formulaDefData`. Only fills fields that are missing — never
 * clobbers an explicit top-level value. Returns true if any field was set.
 */
export function liftObligationCanonicalFields(
  formulaDefData: any,
  calculation: any,
  conditions: any,
): boolean {
  if (!formulaDefData || typeof formulaDefData !== 'object') return false;
  const calc = (calculation && typeof calculation === 'object') ? calculation : {};
  const cond = (conditions && typeof conditions === 'object') ? conditions : {};
  let mutated = false;
  const setIfMissing = (key: string, value: any) => {
    if (value === undefined || value === null || value === '') return;
    if (formulaDefData[key] !== undefined && formulaDefData[key] !== null && formulaDefData[key] !== '') return;
    formulaDefData[key] = value;
    mutated = true;
  };

  const amountCandidate =
    calc.amount ?? calc.fixedAmount ?? calc.periodAccrualAmount ??
    calc.installmentAmount ?? calc.advanceAmount ?? calc.bonusAmount ??
    calc.milestoneAmount;
  const numericAmount = parseNumericValue(amountCandidate);
  if (numericAmount !== null) setIfMissing('amount', numericAmount);

  if (calc.bps !== undefined) {
    const v = parseNumericValue(calc.bps);
    if (v !== null) setIfMissing('bps', v);
  } else if (calc.percentage !== undefined) {
    const v = parseNumericValue(calc.percentage);
    if (v !== null) setIfMissing('percentage', v);
  } else {
    const rateRaw = calc.rate ?? calc.baseRate ?? calc.bonusRate ??
      calc.reserveRate ?? calc.accrualRate;
    const v = parseNumericValue(rateRaw);
    if (v !== null) setIfMissing('rate', v);
  }

  setIfMissing('plannedReleaseDate',
    calc.plannedReleaseDate ?? calc.releaseDate ?? calc.dueDate ??
    cond.releaseDate ?? cond.dueDate);
  const releaseAfter = parseNumericValue(
    calc.releaseAfterDays ?? calc.releaseAfter ?? calc.daysToRelease,
  );
  if (releaseAfter !== null) setIfMissing('releaseAfterDays', releaseAfter);

  setIfMissing('expiryDate',
    calc.expiryDate ?? calc.expirationDate ?? calc.endDate);
  const expiresAfter = parseNumericValue(
    calc.expiresAfterDays ?? calc.claimWindowDays ?? calc.expiresAfter,
  );
  if (expiresAfter !== null) setIfMissing('expiresAfterDays', expiresAfter);

  const rollover = calc.rolloverPolicy ?? calc.rollover ?? cond.rolloverPolicy;
  if (rollover) setIfMissing('rolloverPolicy', String(rollover));

  return mutated;
}
