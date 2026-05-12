import { pool } from '../db.js';
import { isWildcard, fuzzyContains as sharedFuzzyContains } from './ruleMatchingUtils';
import {
  evaluateConditionsForSale,
  conditionsSpecificity,
  type SaleAttrs,
} from './conditionEvaluator';
import { QUALIFIER_FIELD_CODES, type Condition, type QualifierFieldCode } from '@shared/qualifierRegistry';

interface SaleRecord {
  id: string;
  productName: string | null;
  productCode: string | null;
  category: string | null;
  territory: string | null;
  transactionDate: Date | string;
  companyId: string | null;
}

interface ContractRuleInfo {
  contractId: string;
  contractNumber: string;
  ruleId: string;
  ruleName: string;
  productCategories: string[];
  territories: string[];
  effectiveStart: Date | null;
  effectiveEnd: Date | null;
}

interface QualifierInfo {
  ruleId: string;
  qualifierType: string;
  qualifierField: string;
  operator: string;
  qualifierValue: string;
}

interface MatchResult {
  saleId: string;
  contractId: string;
  contractNumber: string;
  matchedRuleName: string;
  matchReason: string;
}

interface MultiMatchResult {
  saleId: string;
  contractId: string;
  ruleId: string;
  matchType: string;
  specificityScore: number;
  matchReason: string;
  isPrimary: boolean;
}

export class SalesContractMatcher {

  static async matchSalesToContracts(
    companyId: string,
    saleIds?: string[]
  ): Promise<{ matched: MatchResult[]; unmatched: string[]; summary: Record<string, number> }> {

    const salesQuery = saleIds && saleIds.length > 0
      ? await pool.query(
          `SELECT id, product_name, product_code, category, territory, transaction_date, company_id
           FROM sales_data WHERE company_id = $1 AND id = ANY($2)`,
          [companyId, saleIds]
        )
      : await pool.query(
          `SELECT id, product_name, product_code, category, territory, transaction_date, company_id
           FROM sales_data WHERE company_id = $1 AND matched_contract_id IS NULL`,
          [companyId]
        );

    const sales: SaleRecord[] = salesQuery.rows.map(r => ({
      id: r.id,
      productName: r.product_name,
      productCode: r.product_code,
      category: r.category,
      territory: r.territory,
      transactionDate: r.transaction_date,
      companyId: r.company_id,
    }));

    if (sales.length === 0) {
      console.log(`📊 [SALES-MATCHER] No unmatched sales found for company ${companyId}`);
      return { matched: [], unmatched: [], summary: {} };
    }

    const rulesQuery = await pool.query(
      `SELECT cr.id as rule_id, cr.rule_name, cr.product_categories, cr.territories,
              cr.contract_id, c.contract_number, c.effective_start, c.effective_end
       FROM contract_rules cr
       JOIN contracts c ON cr.contract_id = c.id
       WHERE c.company_id = $1
         AND c.status IN ('analyzed', 'active')
         AND cr.review_status IN ('verified', 'under_review', 'ai_extracted', 'pending', 'auto_confirmed')
       ORDER BY c.contract_number, cr.priority NULLS LAST`,
      [companyId]
    );

    const rulesQueryRows = rulesQuery.rows as any[];
    const rules: ContractRuleInfo[] = rulesQueryRows.map(r => ({
      contractId: r.contract_id,
      contractNumber: r.contract_number,
      ruleId: r.rule_id,
      ruleName: r.rule_name,
      productCategories: r.product_categories || [],
      territories: r.territories || [],
      effectiveStart: r.effective_start ? new Date(r.effective_start) : null,
      effectiveEnd: r.effective_end ? new Date(r.effective_end) : null,
    }));

    // Map ruleId → sourceClauseId so we can join new-style condition rows back to rules.
    const sourceClauseByRule = new Map<string, string>();
    if (rules.length > 0) {
      const clauseRowsQuery = await pool.query(
        `SELECT id, source_clause_id FROM contract_rules WHERE id = ANY($1::text[])`,
        [rules.map(r => r.ruleId)]
      );
      for (const row of clauseRowsQuery.rows as any[]) {
        if (row.source_clause_id) sourceClauseByRule.set(row.id, row.source_clause_id);
      }
    }

    // Load NEW-style conditions per rule (joined via contract_clause_id → rule.source_clause_id).
    const conditionsByRule = new Map<string, Condition[]>();
    if (sourceClauseByRule.size > 0) {
      const clauseIds = Array.from(new Set(Array.from(sourceClauseByRule.values())));
      const condRows = await pool.query(
        `SELECT cq.contract_clause_id, cq.qualifier_type, cq.qualifier_field, cq.operator,
                cq.qualifier_value, cq.qualifier_logic
         FROM contract_qualifiers cq
         JOIN contracts c ON cq.contract_id = c.id
         WHERE c.company_id = $1
           AND cq.contract_clause_id = ANY($2::text[])
           AND cq.qualifier_field = ANY($3::text[])`,
        [companyId, clauseIds, QUALIFIER_FIELD_CODES as unknown as string[]]
      );
      const condByClause = new Map<string, Condition[]>();
      for (const row of condRows.rows as any[]) {
        const clauseId = row.contract_clause_id;
        if (!clauseId) continue;
        if (!condByClause.has(clauseId)) condByClause.set(clauseId, []);
        condByClause.get(clauseId)!.push({
          field: row.qualifier_field as QualifierFieldCode,
          op: (row.operator || 'in') as Condition['op'],
          value: row.qualifier_value || '',
          group: row.qualifier_logic || 'G1',
          type: row.qualifier_type === 'exclusion' ? 'exclude' : 'include',
        });
      }
      for (const [ruleId, clauseId] of sourceClauseByRule) {
        const conds = condByClause.get(clauseId);
        if (conds && conds.length > 0) conditionsByRule.set(ruleId, conds);
      }
    }

    const qualifiersQuery = await pool.query(
      `SELECT cq.term_id as rule_id, cq.qualifier_type, cq.qualifier_field, cq.operator, cq.qualifier_value
       FROM contract_qualifiers cq
       JOIN contracts c ON cq.contract_id = c.id
       WHERE c.company_id = $1`,
      [companyId]
    );

    const qualifiersByRule = new Map<string, { inclusions: string[]; exclusions: string[] }>();
    for (const q of qualifiersQuery.rows) {
      if (!qualifiersByRule.has(q.rule_id)) {
        qualifiersByRule.set(q.rule_id, { inclusions: [], exclusions: [] });
      }
      const entry = qualifiersByRule.get(q.rule_id)!;
      if (q.qualifier_type === 'exclusion' || q.operator === 'not_in') {
        entry.exclusions.push(q.qualifier_value);
      } else {
        entry.inclusions.push(q.qualifier_value);
      }
    }

    const contractRulesMap = new Map<string, ContractRuleInfo[]>();
    for (const rule of rules) {
      if (!contractRulesMap.has(rule.contractId)) {
        contractRulesMap.set(rule.contractId, []);
      }
      contractRulesMap.get(rule.contractId)!.push(rule);
    }

    const matched: MatchResult[] = [];
    const unmatched: string[] = [];
    const summary: Record<string, number> = {};
    const allMultiMatches: MultiMatchResult[] = [];

    for (const sale of sales) {
      let bestMatch: MatchResult | null = null;
      let bestSpecificity = -1;
      const saleMatches: MultiMatchResult[] = [];

      for (const [contractId, contractRules] of contractRulesMap) {
        const firstRule = contractRules[0];
        if (firstRule.effectiveStart || firstRule.effectiveEnd) {
          const saleDate = new Date(sale.transactionDate);
          if (firstRule.effectiveStart && saleDate < firstRule.effectiveStart) continue;
          if (firstRule.effectiveEnd && saleDate > firstRule.effectiveEnd) continue;
        }

        let bestRuleForContract: { rule: ContractRuleInfo; specificity: number; reason: string } | null = null;

        for (const rule of contractRules) {
          const newConds = conditionsByRule.get(rule.ruleId);
          let matchResult: { matches: boolean; specificity: number; reason: string };
          if (newConds && newConds.length > 0) {
            const saleAttrs: SaleAttrs = {
              productName: sale.productName,
              productCode: sale.productCode,
              category: sale.category,
              territory: sale.territory,
            };
            const ok = evaluateConditionsForSale(newConds, saleAttrs);
            matchResult = ok
              ? {
                  matches: true,
                  specificity: 1000 + conditionsSpecificity(newConds),
                  reason: `conditions match (${newConds.length} condition${newConds.length === 1 ? '' : 's'})`,
                }
              : { matches: false, specificity: 0, reason: '' };
          } else {
            matchResult = this.saleMatchesRule(sale, rule, qualifiersByRule.get(rule.ruleId));
          }
          if (matchResult.matches) {
            if (!bestRuleForContract || matchResult.specificity > bestRuleForContract.specificity) {
              bestRuleForContract = { rule, specificity: matchResult.specificity, reason: matchResult.reason };
            }
            if (matchResult.specificity > bestSpecificity) {
              bestSpecificity = matchResult.specificity;
              bestMatch = {
                saleId: sale.id,
                contractId: rule.contractId,
                contractNumber: rule.contractNumber,
                matchedRuleName: rule.ruleName,
                matchReason: matchResult.reason,
              };
            }
          }
        }

        if (bestRuleForContract) {
          saleMatches.push({
            saleId: sale.id,
            contractId: bestRuleForContract.rule.contractId,
            ruleId: bestRuleForContract.rule.ruleId,
            matchType: bestRuleForContract.reason.includes('qualifier') ? 'qualifier' :
                       bestRuleForContract.reason.includes('product/category') ? 'category' :
                       bestRuleForContract.reason.includes('general') ? 'fallback' : 'category',
            specificityScore: bestRuleForContract.specificity,
            matchReason: bestRuleForContract.reason,
            isPrimary: false,
          });
        }
      }

      if (bestMatch) {
        for (const sm of saleMatches) {
          sm.isPrimary = (sm.contractId === bestMatch.contractId);
        }
        matched.push(bestMatch);
        allMultiMatches.push(...saleMatches);
        summary[bestMatch.contractNumber] = (summary[bestMatch.contractNumber] || 0) + 1;
      } else {
        unmatched.push(sale.id);
      }
    }

    if (matched.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < matched.length; i += batchSize) {
        const batch = matched.slice(i, i + batchSize);
        const cases = batch.map((m, idx) => `WHEN id = $${idx * 2 + 1} THEN $${idx * 2 + 2}::uuid`).join(' ');
        const ids = batch.map(m => m.saleId);
        const params: string[] = [];
        batch.forEach(m => { params.push(m.saleId, m.contractId); });

        await pool.query(
          `UPDATE sales_data SET matched_contract_id = CASE ${cases} END WHERE id = ANY($${params.length + 1}::text[])`,
          [...params, ids]
        );
      }
    }

    if (allMultiMatches.length > 0) {
      const saleIdsToClean = [...new Set(allMultiMatches.map(m => m.saleId))];
      const cleanBatchSize = 500;
      for (let i = 0; i < saleIdsToClean.length; i += cleanBatchSize) {
        const batch = saleIdsToClean.slice(i, i + cleanBatchSize);
        await pool.query(
          `DELETE FROM sale_contract_matches WHERE sale_id = ANY($1::text[])`,
          [batch]
        );
      }

      const insertBatchSize = 50;
      for (let i = 0; i < allMultiMatches.length; i += insertBatchSize) {
        const batch = allMultiMatches.slice(i, i + insertBatchSize);
        const valueClauses: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;
        for (const m of batch) {
          valueClauses.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6})`);
          params.push(m.saleId, m.contractId, m.ruleId, m.matchType, m.specificityScore, m.matchReason, m.isPrimary);
          paramIdx += 7;
        }
        await pool.query(
          `INSERT INTO sale_contract_matches (sale_id, contract_id, rule_id, match_type, specificity_score, match_reason, is_primary)
           VALUES ${valueClauses.join(', ')}`,
          params
        );
      }
      console.log(`📊 [SALES-MATCHER] ${allMultiMatches.length} junction records written to sale_contract_matches (${matched.length} sales × multiple contracts)`);
    }

    console.log(`📊 [SALES-MATCHER] Company ${companyId}: ${matched.length} sales matched, ${unmatched.length} unmatched`);
    for (const [cn, count] of Object.entries(summary)) {
      console.log(`   → ${cn}: ${count} sales`);
    }

    return { matched, unmatched, summary };
  }

  private static saleMatchesRule(
    sale: SaleRecord,
    rule: ContractRuleInfo,
    qualifiers?: { inclusions: string[]; exclusions: string[] }
  ): { matches: boolean; specificity: number; reason: string } {

    const saleProductLower = (sale.productName?.toLowerCase() || '').trim();
    const saleCategoryLower = (sale.category?.toLowerCase() || '').trim();

    if (qualifiers && (qualifiers.inclusions.length > 0 || qualifiers.exclusions.length > 0)) {
      for (const exVal of qualifiers.exclusions) {
        const exLower = exVal.toLowerCase().trim();
        if (!exLower) continue;
        if (saleProductLower && (saleProductLower.includes(exLower) || exLower.includes(saleProductLower))) {
          return { matches: false, specificity: 0, reason: '' };
        }
        if (saleCategoryLower && saleCategoryLower.includes(exLower)) {
          return { matches: false, specificity: 0, reason: '' };
        }
      }

      if (qualifiers.inclusions.length > 0) {
        const firstIncLower = qualifiers.inclusions[0].toLowerCase().trim();
        const isGeneral = qualifiers.inclusions.length === 1 && (firstIncLower === 'general' || firstIncLower === 'all');
        if (!isGeneral) {
          const match = qualifiers.inclusions.some(incVal => {
            const incLower = incVal.toLowerCase().trim();
            if (!incLower) return false;
            if (saleProductLower && (saleProductLower.includes(incLower) || incLower.includes(saleProductLower))) return true;
            if (saleCategoryLower && saleCategoryLower.includes(incLower)) return true;
            return false;
          });
          if (match) {
            const territoryCheck = this.checkTerritory(sale, rule);
            if (!territoryCheck) return { matches: false, specificity: 0, reason: '' };
            return { matches: true, specificity: 1000 / qualifiers.inclusions.length, reason: `qualifier match` };
          }
          return { matches: false, specificity: 0, reason: '' };
        }
      }
    }

    const categories = rule.productCategories || [];
    if (categories.length === 0) {
      return { matches: false, specificity: 0, reason: '' };
    }

    const inclusionCats: string[] = [];
    const exclusionCats: string[] = [];
    for (const cat of categories) {
      const trimmed = (cat as string).trim();
      if (trimmed.startsWith('!')) {
        exclusionCats.push(trimmed.substring(1).toLowerCase().trim());
      } else {
        inclusionCats.push(trimmed.toLowerCase().trim());
      }
    }

    for (const exCat of exclusionCats) {
      if (!exCat) continue;
      if (saleProductLower && (saleProductLower.includes(exCat) || exCat.includes(saleProductLower))) {
        return { matches: false, specificity: 0, reason: '' };
      }
      if (saleCategoryLower && saleCategoryLower.includes(exCat)) {
        return { matches: false, specificity: 0, reason: '' };
      }
    }

    if (inclusionCats.length > 0) {
      const isGeneral = inclusionCats.every(c => isWildcard(c));
      if (isGeneral) {
        return { matches: true, specificity: 1, reason: 'general rule' };
      }

      const matchedCat = inclusionCats.find(catLower => {
        if (!catLower || isWildcard(catLower)) return false;
        if (saleProductLower && (saleProductLower.includes(catLower) || catLower.includes(saleProductLower))) return true;
        if (saleCategoryLower && (saleCategoryLower.includes(catLower) || catLower.includes(saleCategoryLower))) return true;
        return false;
      });

      if (matchedCat) {
        const territoryCheck = this.checkTerritory(sale, rule);
        if (!territoryCheck) return { matches: false, specificity: 0, reason: '' };
        return { matches: true, specificity: 1000 / inclusionCats.length, reason: `product/category match: ${matchedCat}` };
      }
    }

    return { matches: false, specificity: 0, reason: '' };
  }

  private static checkTerritory(sale: SaleRecord, rule: ContractRuleInfo): boolean {
    const ruleTerritories = (rule.territories || []).filter(t => { const v = (t || '').toLowerCase(); return v && !isWildcard(v); });
    if (ruleTerritories.length === 0) return true;
    if (!sale.territory) return true;
    const saleTerr = sale.territory.toLowerCase().trim();
    return ruleTerritories.some(t => {
      const rt = t.toLowerCase().trim();
      return saleTerr === rt || saleTerr.includes(rt) || rt.includes(saleTerr);
    });
  }
}
