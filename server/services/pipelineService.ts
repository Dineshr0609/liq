import { db } from '../db';
import { groqService } from './groqService';
import {
  extractionRuns, contractClauses, ruleConflicts, extractionStageResults,
  contractRules, contracts, contractAnalysis, flowTypes, clauseExecutionGroups, ruleTemplates,
  baseMetrics, clauseCategories,
} from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { canonicalizeRuleType } from '../../shared/calcPhases';

interface ClauseExtractionResult {
  clauseIdentifier: string;
  sectionRef: string;
  text: string;
  clauseCategoryCode: string;
  flowTypeCode: string;
  affectsAccrual: boolean;
  confidence: number;
}

interface RuleMappingResult {
  clauseIdentifier: string;
  templateCode: string;
  executionGroup: string;
  baseMetric: string;
  ruleName: string;
  ruleType: string;
  description: string;
  rate?: number;
  tiers?: any[];
  minimumGuarantee?: number;
  frequency?: string;
  territories?: string[];
  products?: string[];
  confidence: number;
  fieldConfidence: Record<string, number>;
  reviewFlags: string[];
  sourceText: string;
}

interface ConflictResult {
  conflictIdentifier: string;
  ruleNames: string[];
  reason: string;
  resolution: string;
}

export class PipelineService {

  async runFullPipeline(contractId: string): Promise<{ extractionRunId: string }> {
    const contract = await db.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
    if (!contract.length) throw new Error(`Contract ${contractId} not found`);

    const contractData = contract[0];
    const rawText = (contractData as any).rawText || (contractData as any).raw_text;
    if (!rawText) throw new Error(`No contract document uploaded yet. Please upload a contract document first, then run the pipeline.`);

    const [run] = await db.insert(extractionRuns).values({
      contractId,
      runType: 'pipeline_3stage',
      status: 'processing',
      triggeredBy: null,
      currentStage: 'A',
      stageAStatus: 'processing',
      stageBStatus: 'pending',
      stageCStatus: 'pending',
      pipelineMode: 'three_stage',
    }).returning();

    const runId = run.id;
    console.log(`🔄 [Pipeline] Starting 3-stage pipeline for contract ${contractId}, run ${runId}`);

    try {
      const stageAResult = await this.runStageA(runId, contractId, rawText);
      const stageBResult = await this.runStageB(runId, contractId, rawText, stageAResult);

      await this.runTwoPassValidation(runId, contractId, rawText, stageBResult);

      await this.runStageC(runId, contractId, stageBResult);

      await this.updateConflictScoring(contractId, runId);

      const headerFlags = await this.generateHeaderReviewFlags(contractId);
      if (headerFlags.length > 0) {
        console.log(`  ✓ Header review flags: ${headerFlags.join(', ')}`);
      }

      const clauseCount = stageAResult.length;
      const ruleCount = stageBResult.length;

      await db.update(extractionRuns).set({
        status: 'completed',
        currentStage: null,
        rulesExtracted: ruleCount,
        nodesExtracted: clauseCount,
        overallConfidence: stageBResult.length > 0
          ? Math.round(stageBResult.reduce((s, r) => s + r.confidence, 0) / stageBResult.length * 100) / 100
          : 0,
      }).where(eq(extractionRuns.id, runId));

      console.log(`✅ [Pipeline] Completed: ${clauseCount} clauses, ${ruleCount} rules`);
      return { extractionRunId: runId };
    } catch (error: any) {
      console.error(`❌ [Pipeline] Failed:`, error.message);
      await db.update(extractionRuns).set({
        status: 'failed',
        errorLog: error.message,
      }).where(eq(extractionRuns.id, runId));
      throw error;
    }
  }

  private async runStageA(runId: string, contractId: string, contractText: string): Promise<ClauseExtractionResult[]> {
    console.log(`📋 [Stage A] Clause Segmentation...`);

    const [stageRecord] = await db.insert(extractionStageResults).values({
      extractionRunId: runId,
      stage: 'A',
      status: 'processing',
      startedAt: new Date(),
    }).returning();

    try {
      const allFlowTypes = await db.select().from(flowTypes);
      const allCategories = await db.select().from(clauseCategories);

      const flowTypeCodes = allFlowTypes.map(f => f.code).join(', ');
      const categoryCodes = allCategories.map(c => `${c.code} (${c.name})`).join(', ');

      const prompt = `You are a contract analysis expert. Analyze the following contract and segment it into individual clauses.

For each clause, extract:
- clauseIdentifier: A short unique ID like "CL-01", "CL-02" etc.
- sectionRef: The section number or heading from the contract (e.g., "Section 6", "7. Calculation Period")
- text: The full text of the clause
- clauseCategoryCode: One of: ${categoryCodes}
  CRITICAL RULE: If the clause body contains ANY numeric rate, $/unit price, % rebate, fixed fee amount, or per-unit pricing (e.g. "$0.25/lb", "4% of purchases", "$10,000 fee"), you MUST choose "financial_calculation" — regardless of what section heading the clause sits under. Section headings like "Qualification" or "Eligibility" do NOT override this; the presence of a calculable amount is decisive.
- flowTypeCode: One of: ${flowTypeCodes}
- affectsAccrual: true if this clause affects financial accrual calculations, false otherwise
- confidence: 0.0-1.0 how confident you are in the categorization

Return a JSON object with key "clauses" containing an array of clause objects.

CONTRACT TEXT:
${contractText}`;

      const response = await groqService.makeRequest([
        { role: 'system', content: 'You are a contract clause segmentation expert. Return a single JSON object.' },
        { role: 'user', content: prompt },
      ], 0.1, 8000);

      const parsed = this.parseJSON(response);
      const clauses: ClauseExtractionResult[] = (parsed.clauses || []).map((c: any) => ({
        clauseIdentifier: c.clauseIdentifier || c.clause_identifier || 'CL-??',
        sectionRef: c.sectionRef || c.section_ref || '',
        text: c.text || '',
        clauseCategoryCode: c.clauseCategoryCode || c.clause_category_code || 'operational',
        flowTypeCode: c.flowTypeCode || c.flow_type_code || 'other',
        affectsAccrual: !!c.affectsAccrual || !!c.affects_accrual,
        confidence: parseFloat(c.confidence) || 0.7,
      }));

      for (const clause of clauses) {
        await db.insert(contractClauses).values({
          contractId,
          extractionRunId: runId,
          clauseIdentifier: clause.clauseIdentifier,
          sectionRef: clause.sectionRef,
          text: clause.text,
          clauseCategoryCode: clause.clauseCategoryCode,
          flowTypeCode: clause.flowTypeCode,
          affectsAccrual: clause.affectsAccrual,
          confidence: clause.confidence,
        });
      }

      await db.update(extractionStageResults).set({
        status: 'completed',
        rawOutput: { clauseCount: clauses.length },
        completedAt: new Date(),
      }).where(eq(extractionStageResults.id, stageRecord.id));

      await db.update(extractionRuns).set({
        stageAStatus: 'completed',
        currentStage: 'B',
        stageBStatus: 'processing',
      }).where(eq(extractionRuns.id, runId));

      console.log(`  ✓ Stage A: ${clauses.length} clauses extracted`);
      return clauses;
    } catch (error: any) {
      await db.update(extractionStageResults).set({
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      }).where(eq(extractionStageResults.id, stageRecord.id));

      await db.update(extractionRuns).set({ stageAStatus: 'failed' }).where(eq(extractionRuns.id, runId));
      throw error;
    }
  }

  private async runStageB(runId: string, contractId: string, contractText: string, clauses: ClauseExtractionResult[]): Promise<RuleMappingResult[]> {
    console.log(`🔧 [Stage B] Rule Template Mapping...`);

    await db.delete(contractRules).where(and(eq(contractRules.contractId, contractId), sql`template_code IS NOT NULL`));
    await db.update(contractRules).set({ isActive: false }).where(and(eq(contractRules.contractId, contractId), sql`template_code IS NULL`));

    const [stageRecord] = await db.insert(extractionStageResults).values({
      extractionRunId: runId,
      stage: 'B',
      status: 'processing',
      startedAt: new Date(),
    }).returning();

    try {
      const allTemplates = await db.select().from(ruleTemplates);
      const allMetrics = await db.select().from(baseMetrics);

      const templateList = allTemplates.map(t => `${t.templateCode}: ${t.name} (${t.executionGroupCode}) - ${t.description}`).join('\n');
      const metricList = allMetrics.map(m => m.code).join(', ');

      const financialClauses = clauses.filter(c =>
        c.affectsAccrual ||
        ['financial_calculation', 'adjustment', 'event_penalty', 'qualification'].includes(c.clauseCategoryCode)
      );

      const clauseTexts = financialClauses.map(c =>
        `[${c.clauseIdentifier}] (${c.clauseCategoryCode}): ${c.text}`
      ).join('\n\n');

      const prompt = `You are a contract rule mapping expert. Map the following contract clauses to rule templates.

AVAILABLE TEMPLATES:
${templateList}

AVAILABLE BASE METRICS: ${metricList}

For each clause that defines a calculable financial rule, create a mapping with:
- clauseIdentifier: The clause ID it comes from
- templateCode: Best matching template (T1-T12)
- executionGroup: "periodic", "adjustment", or "event"
- baseMetric: The metric used for calculation
- ruleName: A clear descriptive name
- ruleType: The type (e.g., "tiered", "percentage", "fixed_fee", "minimum_guarantee")
- description: What the rule does
- rate: Numeric rate if applicable (e.g., 0.05 for 5%)
- tiers: Array of tier objects if tiered (e.g., [{"min": 0, "max": 1000, "rate": 0.02}, ...])
- minimumGuarantee: Numeric minimum if applicable
- frequency: "monthly", "quarterly", "annually", etc.
- territories: Array of territory names
- products: Array of INDIVIDUAL product names (one name per element, e.g. ["Potatoes", "Onions"]). NEVER use descriptive text like "All products except...". For general/catch-all rules that apply to all products, use ["General"]. For rules with specific products, list each product name individually.
  CRITICAL: For per_unit / fixed_fee / per-unit rules whose RATE is tied to specific products (e.g. "$0.25/lb on potatoes and onions", "$2 per case of widgets"), the products array MUST list those product names individually. Do NOT use ["General"] in that case — ["General"] is reserved for rules that apply broadly to ALL products with no per-product rate variation.
- confidence: 0.0-1.0 overall confidence
- fieldConfidence: Object with confidence per field (e.g., {"rate": 0.95, "territories": 0.8})
- reviewFlags: Array of strings noting concerns (e.g., ["rate ambiguous", "territory unclear"])
- sourceText: The exact contract text this rule is based on

Return a JSON object with key "rules" containing an array.

FINANCIAL CLAUSES:
${clauseTexts}

FULL CONTRACT (for context):
${contractText.substring(0, 5000)}`;

      const response = await groqService.makeRequest([
        { role: 'system', content: 'You are a contract rule template mapping expert. Return a single JSON object.' },
        { role: 'user', content: prompt },
      ], 0.1, 8000);

      const parsed = this.parseJSON(response);
      let rules: RuleMappingResult[] = (parsed.rules || []).map((r: any) => ({
        clauseIdentifier: r.clauseIdentifier || r.clause_identifier || '',
        templateCode: r.templateCode || r.template_code || 'T1',
        executionGroup: r.executionGroup || r.execution_group || 'periodic',
        baseMetric: r.baseMetric || r.base_metric || 'net_sales',
        ruleName: r.ruleName || r.rule_name || 'Unnamed Rule',
        ruleType: r.ruleType || r.rule_type || 'percentage',
        description: r.description || '',
        rate: r.rate ? parseFloat(r.rate) : undefined,
        tiers: r.tiers || undefined,
        minimumGuarantee: r.minimumGuarantee || r.minimum_guarantee ? parseFloat(r.minimumGuarantee || r.minimum_guarantee) : undefined,
        frequency: r.frequency || 'quarterly',
        territories: r.territories || [],
        products: this.cleanProductCategories(r.products || []),
        confidence: parseFloat(r.confidence) || 0.8,
        fieldConfidence: r.fieldConfidence || r.field_confidence || {},
        reviewFlags: r.reviewFlags || r.review_flags || [],
        sourceText: r.sourceText || r.source_text || '',
      }));

      const contract = await db.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
      const contractData = contract[0];

      const dbClauses = await db.select().from(contractClauses).where(eq(contractClauses.contractId, contractId));

      // Per-unit / fixed_fee product backfill. The AI prompt asks for product
      // names individually but still occasionally drops them (e.g. "Per Unit
      // Rebate on Potatoes and Onions" arrives with products=["General"]).
      // Heuristic: when the rule type is per-unit-ish AND the products are
      // empty / catch-all, scan ruleName/description/sourceText for noun
      // phrases after "on" / "for" / "applies to" and lift them into products.
      const PER_UNIT_RULE_TYPES = new Set(['per_unit', 'per-unit', 'fixed_fee', 'per_product_fixed']);
      const STOPWORDS = new Set(['the','a','an','all','any','each','every','sales','purchases','products','product','units','unit','case','cases','box','boxes','lb','lbs','equivalent','rebate','fee','price','rate','of','to','from','on','for','and','or','no','this','that','these','those']);
      function extractProductsFromText(text: string): string[] {
        if (!text) return [];
        const found = new Set<string>();
        const phraseRe = /\b(?:on|for|applies\s+to|covering)\s+([A-Za-z][A-Za-z0-9\- ,]+?)(?=[.,;:()]|$|\bno\b|\band\s+no\b|\bexcept\b|\bexcluding\b)/gi;
        let m: RegExpExecArray | null;
        while ((m = phraseRe.exec(text)) !== null) {
          const phrase = m[1].trim();
          phrase.split(/\s*(?:,|\band\b)\s*/i).forEach(part => {
            const cleaned = part.replace(/[^A-Za-z\- ]/g, '').trim();
            if (!cleaned) return;
            const tokens = cleaned.split(/\s+/).filter(t => !STOPWORDS.has(t.toLowerCase()));
            if (tokens.length === 0 || tokens.length > 3) return;
            const candidate = tokens.map(t => t[0].toUpperCase() + t.slice(1).toLowerCase()).join(' ');
            if (candidate.length >= 3 && !STOPWORDS.has(candidate.toLowerCase())) {
              found.add(candidate);
            }
          });
        }
        return Array.from(found);
      }
      for (const r of rules) {
        const rtype = (r.ruleType || '').toLowerCase().trim();
        if (!PER_UNIT_RULE_TYPES.has(rtype)) continue;
        const isEmpty = !r.products || r.products.length === 0 ||
          (r.products.length === 1 && r.products[0].toLowerCase() === 'general');
        if (!isEmpty) continue;
        const haystack = `${r.ruleName || ''} ${r.description || ''} ${r.sourceText || ''}`;
        const lifted = extractProductsFromText(haystack);
        if (lifted.length > 0) {
          console.log(`   🌱 [Pipeline] Backfilled products for "${r.ruleName}" (${rtype}): ${lifted.join(', ')}`);
          r.products = lifted;
        }
      }

      // Dedupe rules before insert. Mirrors groqService.deduplicateRules
      // logic (legacy fix) so the new pipeline doesn't repopulate duplicates
      // (e.g. a tiered rebate showing up under multiple variant names).
      const beforeDedupe = rules.length;
      const dedupeMap = new Map<string, RuleMappingResult>();
      for (const r of rules) {
        const fingerprint = JSON.stringify({
          type: (r.ruleType || '').toLowerCase().trim(),
          name: (r.ruleName || '').toLowerCase().trim().replace(/\s+/g, ' '),
          rate: r.rate ?? null,
          products: (r.products || []).map(p => p.toLowerCase().trim()).sort(),
          territories: (r.territories || []).map(t => t.toLowerCase().trim()).sort(),
          tierCount: Array.isArray(r.tiers) ? r.tiers.length : 0,
        });
        const existing = dedupeMap.get(fingerprint);
        if (!existing || (r.confidence || 0) > (existing.confidence || 0)) {
          dedupeMap.set(fingerprint, r);
        }
      }
      rules = Array.from(dedupeMap.values());
      if (rules.length !== beforeDedupe) {
        console.log(`  🧹 [Pipeline] Deduplicated rules: ${beforeDedupe} → ${rules.length}`);
      }

      // Second-pass dedup: group by (sourceClause + canonical product set).
      // Rules that come from the same clause and cover the same products are
      // almost always two AI phrasings of the same intent (e.g. "Base Inbound
      // Rebate" vs "4% Rebate on Purchases" — both 4% on the same clause).
      // Keep the one with a usable rate; if both have rates, keep the higher
      // confidence; tie-breaker is longer description.
      const beforeClauseDedupe = rules.length;
      const clauseGroups = new Map<string, RuleMappingResult>();
      for (const r of rules) {
        const productKey = (r.products || [])
          .filter(p => p && !p.startsWith('!'))
          .map(p => p.toLowerCase().trim())
          .sort()
          .join('|');
        const groupKey = `${r.clauseIdentifier || 'no-clause'}::${productKey}`;
        const existing = clauseGroups.get(groupKey);
        if (!existing) {
          clauseGroups.set(groupKey, r);
          continue;
        }
        const rHasRate = r.rate != null;
        const eHasRate = existing.rate != null;
        let winner: RuleMappingResult;
        if (rHasRate && !eHasRate) winner = r;
        else if (!rHasRate && eHasRate) winner = existing;
        else if ((r.confidence || 0) !== (existing.confidence || 0)) {
          winner = (r.confidence || 0) > (existing.confidence || 0) ? r : existing;
        } else {
          winner = (r.description?.length || 0) > (existing.description?.length || 0) ? r : existing;
        }
        const loser = winner === r ? existing : r;
        console.log(`  🧹 [Pipeline] Clause-dedup on ${groupKey}: kept "${winner.ruleName}", dropped "${loser.ruleName}"`);
        clauseGroups.set(groupKey, winner);
      }
      rules = Array.from(clauseGroups.values());
      if (rules.length !== beforeClauseDedupe) {
        console.log(`  🧹 [Pipeline] Clause-dedup pass: ${beforeClauseDedupe} → ${rules.length}`);
      }

      const allSpecificProducts = new Set<string>();
      for (const rule of rules) {
        const nonGeneral = (rule.products || []).filter(p => p !== 'General' && !p.startsWith('!'));
        if (nonGeneral.length > 0) {
          nonGeneral.forEach(p => allSpecificProducts.add(p));
        }
      }

      // Cross-clause force-exclusion linking. Some contracts express exclusions
      // as their own clause ("Totally Excluded items: 4350-20 box", "No rebate
      // on widgets") rather than as part of a calculable rule. Those clauses
      // produce no rule of their own, so the catch-all !injection above misses
      // them. Scan every clause's text for known exclusion patterns and add
      // the named products to the exclusion set so general rules pick them up.
      const FORCE_EXCLUDE_PATTERNS = [
        /totally\s+excluded\s+items?\s*:\s*([^.\n]+)/i,
        /excluded\s+items?\s*:\s*([^.\n]+)/i,
        /excluded\s+products?\s*:\s*([^.\n]+)/i,
        /no\s+rebate\s+(?:on|for)\s+([^.\n]+?)(?=\.|$)/i,
        /not\s+eligible\s+(?:for\s+rebate)?\s*:?\s*([^.\n]+)/i,
      ];
      for (const c of dbClauses) {
        const text = c.text || '';
        for (const re of FORCE_EXCLUDE_PATTERNS) {
          const m = text.match(re);
          if (!m || !m[1]) continue;
          m[1].split(/\s*(?:,|\band\b)\s*/i).forEach(part => {
            const cleaned = part.replace(/[^A-Za-z0-9\- ]/g, '').trim();
            if (!cleaned || cleaned.length < 2) return;
            // Title-case alpha words; preserve mixed alphanumeric tokens
            // (e.g. "4350-20 box") as-is except for trailing common nouns.
            const candidate = /^[A-Za-z]+$/.test(cleaned.replace(/\s/g, ''))
              ? cleaned.split(/\s+/).map(t => t[0].toUpperCase() + t.slice(1).toLowerCase()).join(' ')
              : cleaned;
            if (!allSpecificProducts.has(candidate)) {
              console.log(`   🚫 [Pipeline] Cross-clause exclusion from ${c.clauseIdentifier}: ${candidate}`);
              allSpecificProducts.add(candidate);
            }
          });
          break;
        }
      }

      // Rule types whose calculation does not depend on the product dimension —
      // e.g. payment-mechanic / accounting rules. For these, never auto-generate
      // the General + !ProductX catch-all qualifier set: it adds noise that
      // (a) misleads users in the editor and (b) causes the matcher to evaluate
      // them only against sales of those products, which is wrong.
      const NON_PRODUCT_RULE_TYPES = new Set([
        'minimum_guarantee', 'payment_schedule',
        'fixed_fee', 'annual_fee', 'milestone_payment', 'late_payment_penalty',
        'cap', 'period_cap', 'contract_cap',
        'mdf_accrual', 'recoupable_advance', 'advance_payment', 'signing_bonus',
      ]);

      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const matchedClause = dbClauses.find(c => c.clauseIdentifier === rule.clauseIdentifier);

        let finalProducts = rule.products;
        const ruleTypeLower = (rule.ruleType || '').toLowerCase().trim();
        const isNonProductRule = NON_PRODUCT_RULE_TYPES.has(ruleTypeLower);
        const isMinGuarantee = ruleTypeLower === 'minimum_guarantee';
        const isGeneral = finalProducts.length === 0 || (finalProducts.length === 1 && finalProducts[0] === 'General');
        if (isNonProductRule) {
          // Drop product dimension entirely for non-product rule types — the
          // catch-all is meaningless and so is a stray ['General'] tag.
          if (finalProducts.length > 0) {
            console.log(`   ⏭ [Pipeline] Skipping product qualifiers for non-product rule type "${ruleTypeLower}" on "${rule.ruleName}"`);
          }
          finalProducts = [];
        } else if (isGeneral && allSpecificProducts.size > 0) {
          finalProducts = ['General', ...Array.from(allSpecificProducts).map(p => `!${p}`)];
          console.log(`   🚫 [Pipeline] Added ${allSpecificProducts.size} exclusion(s) to general rule "${rule.ruleName}"`);
        }

        let normalizedRate = rule.rate ?? null;
        if (normalizedRate !== null) {
          const rType = (rule.ruleType || '').toLowerCase();
          const isPercType = rType === 'percentage' || rType === 'category_percentage' || rType === 'tiered' || rType === 'rebate_tiered' || rType === 'milestone_tiered';
          if (isPercType && normalizedRate > 0 && normalizedRate < 1) {
            console.log(`  ✓ [Pipeline] Converting AI decimal rate ${normalizedRate} → ${normalizedRate * 100}% for rule: ${rule.ruleName}`);
            normalizedRate = normalizedRate * 100;
          }
        }

        // Derive the calc-engine aggregationScope from the AI's
        // aggregationPeriod (quarterly / annual / monthly / per_sale /
        // contract). Without this, the rules table column stays NULL and the
        // engine's window resolver falls back to the rule type heuristic.
        const aggPeriod = String(
          (rule as any).aggregationPeriod ||
          (rule as any).aggregation_period ||
          ''
        ).toLowerCase().trim();
        let derivedAggregationScope: string | null = null;
        if (aggPeriod === 'per_sale' || aggPeriod === 'per-sale' || aggPeriod === 'transaction') {
          derivedAggregationScope = 'per_sale';
        } else if (
          aggPeriod === 'monthly' || aggPeriod === 'month' ||
          aggPeriod === 'quarterly' || aggPeriod === 'quarter' ||
          aggPeriod === 'annual' || aggPeriod === 'annually' || aggPeriod === 'year' || aggPeriod === 'yearly'
        ) {
          derivedAggregationScope = 'per_period';
        } else if (aggPeriod === 'contract' || aggPeriod === 'lifetime') {
          derivedAggregationScope = 'per_contract';
        }

        // base_metric does not apply to minimum_guarantee rules — the floor is a
        // dollar amount, not a rate against a sales field. Force NULL so the
        // editor doesn't show a stale 'net_sales' picked up from the AI default.
        const ruleBaseMetric = isMinGuarantee ? null : (rule.baseMetric || null);

        const [insertedRule] = await db.insert(contractRules).values({
          contractId,
          ruleName: rule.ruleName,
          ruleType: canonicalizeRuleType(rule.ruleType) || rule.ruleType,
          description: rule.description,
          baseRate: normalizedRate !== null ? normalizedRate.toString() : null,
          volumeTiers: rule.tiers || null,
          minimumGuarantee: rule.minimumGuarantee?.toString() || null,
          productCategories: finalProducts,
          territories: rule.territories,
          clauseCategory: financialClauses.find(c => c.clauseIdentifier === rule.clauseIdentifier)?.clauseCategoryCode || rule.clauseIdentifier,
          confidence: rule.confidence.toString(),
          reviewStatus: rule.confidence >= 0.85 ? 'auto_confirmed' : 'pending',
          sourceText: rule.sourceText,
          sourceClauseId: matchedClause?.id || null,
          priority: i + 1,
          isActive: true,
          effectiveDate: contractData?.effectiveStart || null,
          expiryDate: contractData?.effectiveEnd || null,
          templateCode: rule.templateCode,
          executionGroup: rule.executionGroup,
          baseMetric: ruleBaseMetric,
          aggregationScope: derivedAggregationScope,
          fieldConfidence: rule.fieldConfidence,
          reviewFlags: rule.reviewFlags,
        }).returning();

        // Mirror legacy productCategories/territories arrays into
        // contract_qualifiers rows so the new conditions architecture and
        // the side-panel editor see them. Skips silently for rules that
        // could not be linked to a sourceClauseId.
        try {
          const { syncQualifiersFromRule } = await import("./qualifierSync");
          await syncQualifiersFromRule(insertedRule as any);
        } catch (syncErr) {
          console.warn(`  ⚠ [Pipeline] qualifier sync failed for rule "${rule.ruleName}": ${(syncErr as Error).message}`);
        }
      }

      await db.update(extractionStageResults).set({
        status: 'completed',
        rawOutput: { ruleCount: rules.length },
        completedAt: new Date(),
      }).where(eq(extractionStageResults.id, stageRecord.id));

      await db.update(extractionRuns).set({
        stageBStatus: 'completed',
        currentStage: 'C',
        stageCStatus: 'processing',
      }).where(eq(extractionRuns.id, runId));

      console.log(`  ✓ Stage B: ${rules.length} rules mapped`);
      return rules;
    } catch (error: any) {
      await db.update(extractionStageResults).set({
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      }).where(eq(extractionStageResults.id, stageRecord.id));

      await db.update(extractionRuns).set({ stageBStatus: 'failed' }).where(eq(extractionRuns.id, runId));
      throw error;
    }
  }

  private async runStageC(runId: string, contractId: string, rules: RuleMappingResult[]): Promise<ConflictResult[]> {
    console.log(`⚡ [Stage C] Conflict Detection...`);

    const [stageRecord] = await db.insert(extractionStageResults).values({
      extractionRunId: runId,
      stage: 'C',
      status: 'processing',
      startedAt: new Date(),
    }).returning();

    try {
      if (rules.length < 2) {
        await db.update(extractionStageResults).set({
          status: 'completed',
          rawOutput: { conflictCount: 0, message: 'Too few rules for conflict analysis' },
          completedAt: new Date(),
        }).where(eq(extractionStageResults.id, stageRecord.id));

        await db.update(extractionRuns).set({
          stageCStatus: 'completed',
          currentStage: null,
        }).where(eq(extractionRuns.id, runId));

        console.log(`  ✓ Stage C: 0 conflicts (fewer than 2 rules)`);
        return [];
      }

      const rulesSummary = rules.map(r =>
        `[${r.clauseIdentifier}] ${r.ruleName} (${r.templateCode}, ${r.executionGroup}): ${r.description}. Rate: ${r.rate || 'N/A'}, Base: ${r.baseMetric}, Products: ${r.products.join(', ') || 'all'}, Territories: ${r.territories.join(', ') || 'all'}`
      ).join('\n');

      const prompt = `You are a contract conflict detection expert. Analyze these extracted rules for potential conflicts:

${rulesSummary}

Look for:
1. Overlapping rules (same products/territories with different rates)
2. Contradictory conditions
3. Ambiguous precedence
4. Missing coverage gaps

Return a JSON object with key "conflicts" containing an array. Each conflict:
- conflictIdentifier: "CONF-01", "CONF-02" etc.
- ruleNames: Array of the conflicting rule names
- reason: Clear explanation of the conflict
- resolution: Suggested resolution

If no conflicts found, return {"conflicts": []}`;

      const response = await groqService.makeRequest([
        { role: 'system', content: 'You are a contract conflict detection expert. Return a single JSON object.' },
        { role: 'user', content: prompt },
      ], 0.1, 4000);

      const parsed = this.parseJSON(response);
      const conflicts: ConflictResult[] = (parsed.conflicts || []).map((c: any) => ({
        conflictIdentifier: c.conflictIdentifier || c.conflict_identifier || 'CONF-??',
        ruleNames: c.ruleNames || c.rule_names || [],
        reason: c.reason || '',
        resolution: c.resolution || '',
      }));

      for (const conflict of conflicts) {
        await db.insert(ruleConflicts).values({
          contractId,
          extractionRunId: runId,
          conflictIdentifier: conflict.conflictIdentifier,
          ruleIds: conflict.ruleNames,
          reason: conflict.reason,
          resolution: conflict.resolution,
        });
      }

      await db.update(extractionStageResults).set({
        status: 'completed',
        rawOutput: { conflictCount: conflicts.length },
        completedAt: new Date(),
      }).where(eq(extractionStageResults.id, stageRecord.id));

      await db.update(extractionRuns).set({
        stageCStatus: 'completed',
        currentStage: null,
      }).where(eq(extractionRuns.id, runId));

      console.log(`  ✓ Stage C: ${conflicts.length} conflicts detected`);
      return conflicts;
    } catch (error: any) {
      await db.update(extractionStageResults).set({
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      }).where(eq(extractionStageResults.id, stageRecord.id));

      await db.update(extractionRuns).set({ stageCStatus: 'failed' }).where(eq(extractionRuns.id, runId));
      throw error;
    }
  }

  private async runTwoPassValidation(runId: string, contractId: string, contractText: string, rules: RuleMappingResult[]): Promise<void> {
    if (rules.length === 0) return;
    console.log(`🔍 [Validation] Two-pass validation on ${rules.length} rules...`);

    // Pass 1: Heuristic checks
    for (const rule of rules) {
      const flags: string[] = [...(rule.reviewFlags || [])];

      if (!rule.rate && !rule.tiers?.length && !rule.minimumGuarantee) {
        flags.push('no_rate_or_tiers_extracted');
      }

      if (rule.rate !== undefined && rule.rate !== null) {
        const rateStr = rule.rate.toString();
        const rateRegex = new RegExp(rateStr.replace('.', '\\.?'), 'i');
        if (!rateRegex.test(contractText) && !contractText.includes(rateStr)) {
          flags.push('rate_not_found_in_source');
        }
      }

      if (rule.sourceText && rule.sourceText.length > 10) {
        const snippet = rule.sourceText.substring(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(snippet, 'i').test(contractText)) {
          flags.push('source_text_mismatch');
        }
      }

      if (!rule.territories || rule.territories.length === 0) {
        if (/territory|territories|region/i.test(contractText)) {
          flags.push('territory_present_but_not_extracted');
        }
      }

      if (!rule.products || rule.products.length === 0) {
        if (/product|products|category|categories/i.test(contractText)) {
          flags.push('products_present_but_not_extracted');
        }
      }

      if (rule.fieldConfidence) {
        const lowConfFields = Object.entries(rule.fieldConfidence)
          .filter(([_, conf]) => typeof conf === 'number' && conf < 0.6)
          .map(([field]) => field);
        if (lowConfFields.length > 0) {
          flags.push(`low_confidence_fields: ${lowConfFields.join(', ')}`);
        }
      }

      rule.reviewFlags = [...new Set(flags)];
    }

    // Pass 2: AI self-validation — ask AI to verify extracted rules against source
    try {
      const rulesSummary = rules.map((r, i) =>
        `Rule ${i + 1}: "${r.ruleName}" type=${r.ruleType} rate=${r.rate ?? 'none'} tiers=${r.tiers?.length ?? 0} products=[${(r.products || []).join(', ')}] territories=[${(r.territories || []).join(', ')}] source="${(r.sourceText || '').substring(0, 120)}"`
      ).join('\n');

      const validationPrompt = `You are a contract validation expert. Verify these extracted rules against the original contract text.

EXTRACTED RULES:
${rulesSummary}

CONTRACT TEXT (first 6000 chars):
${contractText.substring(0, 6000)}

For each rule, check:
1. Does the rate/percentage match what's in the contract?
2. Are the products correctly identified?
3. Are the territories correctly identified?
4. Is the rule type correct for this clause?
5. Is there any data the extraction missed?

Return JSON:
{
  "validations": [
    {
      "ruleIndex": 0,
      "rateCorrect": true,
      "productsCorrect": true,
      "territoriesCorrect": false,
      "typeCorrect": true,
      "flags": ["territory should include Canada"],
      "adjustedConfidence": 0.75
    }
  ]
}`;

      const response = await groqService.makeRequest([
        { role: 'system', content: 'You are a contract validation expert. Return a single JSON object.' },
        { role: 'user', content: validationPrompt },
      ], 0.1, 4000);

      const parsed = this.parseJSON(response);
      const validations = parsed.validations || [];

      for (const v of validations) {
        const idx = typeof v.ruleIndex === 'number' ? v.ruleIndex : -1;
        if (idx < 0 || idx >= rules.length) continue;

        const rule = rules[idx];
        const aiFlags: string[] = v.flags || [];
        if (!v.rateCorrect) aiFlags.push('ai_validation: rate mismatch');
        if (!v.productsCorrect) aiFlags.push('ai_validation: products incorrect');
        if (!v.territoriesCorrect) aiFlags.push('ai_validation: territories incorrect');
        if (!v.typeCorrect) aiFlags.push('ai_validation: rule type mismatch');

        for (const f of aiFlags) {
          if (!rule.reviewFlags.includes(f)) rule.reviewFlags.push(f);
        }

        if (typeof v.adjustedConfidence === 'number' && v.adjustedConfidence < rule.confidence) {
          rule.confidence = v.adjustedConfidence;
        }
      }
      console.log(`  ✓ AI validation pass complete for ${validations.length} rules`);
    } catch (aiErr: any) {
      console.warn(`  ⚠️ AI validation pass failed (non-fatal): ${aiErr.message}`);
    }

    // Persist flags and updated confidence
    for (const rule of rules) {
      if (rule.reviewFlags.length > 0) {
        const newConfidence = Math.max(0.3, rule.confidence);
        const newReviewStatus = newConfidence < 0.7 ? 'pending' : (newConfidence >= 0.85 ? 'auto_confirmed' : 'pending');

        await db.execute(sql`
          UPDATE contract_rules 
          SET review_flags = ${JSON.stringify(rule.reviewFlags)}::jsonb,
              confidence = ${newConfidence.toString()},
              review_status = ${newReviewStatus}
          WHERE contract_id = ${contractId} 
            AND rule_name = ${rule.ruleName}
            AND template_code IS NOT NULL
        `);
      }
    }

    console.log(`  ✓ Validation: ${rules.filter(r => r.reviewFlags.length > 0).length}/${rules.length} rules flagged`);
  }

  async runSingleStage(contractId: string, stage: 'A' | 'B' | 'C'): Promise<{ extractionRunId: string; stage: string }> {
    const contract = await db.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
    if (!contract.length) throw new Error(`Contract ${contractId} not found`);

    const contractData = contract[0];
    const rawText = (contractData as any).rawText || (contractData as any).raw_text;
    if (!rawText) throw new Error(`Contract ${contractId} has no extracted text.`);

    const existingRuns = await db.select().from(extractionRuns)
      .where(and(eq(extractionRuns.contractId, contractId), eq(extractionRuns.pipelineMode, 'three_stage')))
      .orderBy(extractionRuns.createdAt);

    let runId: string;
    if (existingRuns.length > 0) {
      runId = existingRuns[existingRuns.length - 1].id;
      const stageStatusUpdate: any = { currentStage: stage };
      if (stage === 'A') stageStatusUpdate.stageAStatus = 'processing';
      else if (stage === 'B') stageStatusUpdate.stageBStatus = 'processing';
      else if (stage === 'C') stageStatusUpdate.stageCStatus = 'processing';
      await db.update(extractionRuns).set(stageStatusUpdate).where(eq(extractionRuns.id, runId));
    } else {
      const [run] = await db.insert(extractionRuns).values({
        contractId,
        runType: 'pipeline_3stage',
        status: 'processing',
        triggeredBy: null,
        currentStage: stage,
        stageAStatus: stage === 'A' ? 'processing' : 'pending',
        stageBStatus: stage === 'B' ? 'processing' : 'pending',
        stageCStatus: stage === 'C' ? 'processing' : 'pending',
        pipelineMode: 'three_stage',
      }).returning();
      runId = run.id;
    }

    console.log(`🔄 [Pipeline] Running single stage ${stage} for contract ${contractId}, run ${runId}`);

    try {
      if (stage === 'A') {
        await db.delete(contractClauses).where(and(eq(contractClauses.contractId, contractId), eq(contractClauses.extractionRunId, runId)));
        await db.delete(extractionStageResults).where(and(eq(extractionStageResults.extractionRunId, runId), eq(extractionStageResults.stage, 'A')));
        const stageAResult = await this.runStageA(runId, contractId, rawText);
        await db.update(extractionRuns).set({ stageAStatus: 'completed', currentStage: null }).where(eq(extractionRuns.id, runId));
        console.log(`✅ [Pipeline] Stage A re-run: ${stageAResult.length} clauses`);
      } else if (stage === 'B') {
        const clauses = await db.select().from(contractClauses)
          .where(and(eq(contractClauses.contractId, contractId), eq(contractClauses.extractionRunId, runId)));
        if (!clauses.length) throw new Error('No clauses found from Stage A. Run Stage A first.');

        await db.delete(contractRules).where(and(eq(contractRules.contractId, contractId), sql`template_code IS NOT NULL`));
        await db.update(contractRules).set({ isActive: false }).where(and(eq(contractRules.contractId, contractId), sql`template_code IS NULL`));
        await db.delete(extractionStageResults).where(and(eq(extractionStageResults.extractionRunId, runId), eq(extractionStageResults.stage, 'B')));

        const clauseResults: ClauseExtractionResult[] = clauses.map(c => ({
          clauseIdentifier: c.clauseIdentifier || '',
          sectionRef: c.sectionRef || '',
          text: c.text,
          clauseCategoryCode: c.clauseCategoryCode || 'operational',
          flowTypeCode: c.flowTypeCode || 'other',
          affectsAccrual: c.affectsAccrual,
          confidence: c.confidence || 0.7,
        }));
        const stageBResult = await this.runStageB(runId, contractId, rawText, clauseResults);
        await this.runTwoPassValidation(runId, contractId, rawText, stageBResult);
        await db.update(extractionRuns).set({ stageBStatus: 'completed', currentStage: null }).where(eq(extractionRuns.id, runId));
        console.log(`✅ [Pipeline] Stage B re-run: ${stageBResult.length} rules`);
      } else if (stage === 'C') {
        await db.delete(ruleConflicts).where(and(eq(ruleConflicts.contractId, contractId), eq(ruleConflicts.extractionRunId, runId)));
        await db.delete(extractionStageResults).where(and(eq(extractionStageResults.extractionRunId, runId), eq(extractionStageResults.stage, 'C')));

        const rules = await db.select().from(contractRules)
          .where(and(eq(contractRules.contractId, contractId), eq(contractRules.isActive, true)));
        const pipelineRules = rules.filter(r => r.templateCode);
        if (!pipelineRules.length) throw new Error('No pipeline rules found from Stage B. Run Stage B first.');
        const ruleResults: RuleMappingResult[] = pipelineRules.map(r => ({
          clauseIdentifier: r.clauseCategory || '',
          templateCode: r.templateCode || '',
          executionGroup: r.executionGroup || 'periodic',
          baseMetric: r.baseMetric || 'net_sales',
          ruleName: r.ruleName,
          ruleType: r.ruleType,
          description: r.description || '',
          rate: r.baseRate ? parseFloat(r.baseRate) : undefined,
          tiers: r.volumeTiers as any[] || undefined,
          confidence: parseFloat(r.confidence || '0.8'),
          fieldConfidence: (r.fieldConfidence as Record<string, number>) || {},
          reviewFlags: (r.reviewFlags as string[]) || [],
          sourceText: r.sourceText || '',
        }));
        await this.runStageC(runId, contractId, ruleResults);
        await this.updateConflictScoring(contractId, runId);
        await db.update(extractionRuns).set({ stageCStatus: 'completed', currentStage: null }).where(eq(extractionRuns.id, runId));
        console.log(`✅ [Pipeline] Stage C re-run`);
      }

      return { extractionRunId: runId, stage };
    } catch (error: any) {
      console.error(`❌ [Pipeline] Stage ${stage} re-run failed:`, error.message);
      throw error;
    }
  }

  private async updateConflictScoring(contractId: string, runId: string): Promise<void> {
    try {
      const conflicts = await db.select().from(ruleConflicts)
        .where(and(eq(ruleConflicts.contractId, contractId), eq(ruleConflicts.extractionRunId, runId)));

      const rules = await db.select().from(contractRules)
        .where(and(eq(contractRules.contractId, contractId), eq(contractRules.isActive, true)));
      const pipelineRules = rules.filter(r => r.templateCode);

      for (const rule of pipelineRules) {
        const involvedConflicts = conflicts.filter(c => {
          const ruleIds = c.ruleIds as string[];
          return Array.isArray(ruleIds) && ruleIds.some(id =>
            id.toLowerCase().includes(rule.ruleName.toLowerCase()) || rule.ruleName.toLowerCase().includes(id.toLowerCase())
          );
        });

        let specificityScore = 50;
        const prodCount = (rule.productCategories as string[] || []).length;
        const terrCount = (rule.territories as string[] || []).length;
        if (prodCount > 0) specificityScore += Math.min(prodCount * 5, 20);
        if (terrCount > 0) specificityScore += Math.min(terrCount * 5, 15);
        if (rule.customerSegments && (rule.customerSegments as string[]).length > 0) specificityScore += 10;
        if (rule.channel) specificityScore += 5;
        if (involvedConflicts.length > 0) specificityScore -= involvedConflicts.length * 5;
        specificityScore = Math.max(0, Math.min(100, specificityScore));

        const conflictPenalty = involvedConflicts.length > 0 ? Math.min(involvedConflicts.length * 2, 5) : 0;
        const newPriority = Math.max(1, (rule.priority || 5) + conflictPenalty);

        await db.execute(sql`
          UPDATE contract_rules 
          SET specificity_score = ${specificityScore.toString()},
              priority = ${newPriority}
          WHERE id = ${rule.id}
        `);
      }

      console.log(`  ✓ Conflict scoring: updated ${pipelineRules.length} rules`);
    } catch (err: any) {
      console.warn(`  ⚠️ Conflict scoring failed (non-fatal): ${err.message}`);
    }
  }

  async generateHeaderReviewFlags(contractId: string): Promise<string[]> {
    const contract = await db.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
    if (!contract.length) return [];

    const c = contract[0];
    const flags: string[] = [];

    if (!c.effectiveStart) flags.push('missing_effective_date');
    if (!c.effectiveEnd) flags.push('missing_expiration_date');
    if (!c.organizationName) flags.push('missing_organization_name');
    if (!c.counterpartyName) flags.push('missing_counterparty_name');
    if (!c.contractType) flags.push('missing_contract_type');

    if (c.effectiveStart && c.effectiveEnd) {
      const start = new Date(c.effectiveStart);
      const end = new Date(c.effectiveEnd);
      if (end <= start) flags.push('expiration_before_effective_date');
      const diffYears = (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (diffYears > 10) flags.push('unusually_long_contract_term');
    }

    const analysis = await db.select().from(contractAnalysis).where(eq(contractAnalysis.contractId, contractId)).limit(1);
    if (analysis.length > 0) {
      const keyTerms = analysis[0].keyTerms as any;
      if (keyTerms) {
        if (!keyTerms.paymentTerms && !keyTerms.payment_terms) flags.push('ambiguous_payment_timing');
        if (!keyTerms.currency) flags.push('missing_currency');
      }
    }

    const rules = await db.select().from(contractRules)
      .where(and(eq(contractRules.contractId, contractId), eq(contractRules.isActive, true)));
    if (rules.length === 0) flags.push('no_rules_extracted');

    const existingAnalysis2 = await db.select().from(contractAnalysis).where(eq(contractAnalysis.contractId, contractId)).limit(1);
    if (existingAnalysis2.length > 0) {
      await db.update(contractAnalysis).set({
        headerReviewFlags: flags,
        updatedAt: new Date(),
      }).where(eq(contractAnalysis.id, existingAnalysis2[0].id));
    } else {
      await db.insert(contractAnalysis).values({
        contractId,
        headerReviewFlags: flags,
      });
    }

    return flags;
  }

  async getPipelineResults(contractId: string) {
    const runs = await db.select().from(extractionRuns)
      .where(and(
        eq(extractionRuns.contractId, contractId),
        eq(extractionRuns.pipelineMode, 'three_stage'),
      ))
      .orderBy(extractionRuns.createdAt);

    const clauses = await db.select().from(contractClauses)
      .where(eq(contractClauses.contractId, contractId));

    const conflicts = await db.select().from(ruleConflicts)
      .where(eq(ruleConflicts.contractId, contractId));

    const pipelineRules = await db.select().from(contractRules)
      .where(and(
        eq(contractRules.contractId, contractId),
        eq(contractRules.isActive, true),
      ));

    const stageResults = runs.length > 0
      ? await db.select().from(extractionStageResults)
          .where(eq(extractionStageResults.extractionRunId, runs[runs.length - 1].id))
      : [];

    return {
      runs,
      latestRun: runs.length > 0 ? runs[runs.length - 1] : null,
      stageResults,
      clauses,
      rules: pipelineRules,
      conflicts,
      summary: {
        totalClauses: clauses.length,
        totalRules: pipelineRules.length,
        totalConflicts: conflicts.length,
        clausesByCategory: this.groupBy(clauses, 'clauseCategoryCode'),
        rulesByTemplate: this.groupBy(pipelineRules.filter(r => r.templateCode), 'templateCode'),
        rulesByExecutionGroup: this.groupBy(pipelineRules, 'executionGroup'),
        avgConfidence: pipelineRules.length > 0
          ? Math.round(pipelineRules.reduce((s, r) => s + parseFloat(r.confidence || '0'), 0) / pipelineRules.length * 100) / 100
          : 0,
      },
    };
  }

  private groupBy(items: any[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const val = item[key] || 'unknown';
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private cleanProductCategories(products: string[]): string[] {
    if (!products || products.length === 0) return [];
    const cleaned: string[] = [];
    for (const p of products) {
      const lower = p.toLowerCase().trim();
      if (lower.startsWith('all products') || lower.startsWith('all ') || lower.includes('except')) {
        const exceptMatch = p.match(/except\s+(.+)/i);
        if (exceptMatch) {
          const exceptPart = exceptMatch[1]
            .replace(/\band\b/gi, ',')
            .replace(/\bitem\b/gi, '')
            .split(/[,;]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
          cleaned.push('General');
          for (const ep of exceptPart) {
            if (ep.length > 0) cleaned.push(ep);
          }
        } else {
          cleaned.push('General');
        }
      } else {
        cleaned.push(p.trim());
      }
    }
    return [...new Set(cleaned)];
  }

  private parseJSON(text: string): any {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      try {
        const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e2) {
        console.error(`❌ [Pipeline] JSON parse failed:`, text.substring(0, 200));
      }
    }
    return { clauses: [], rules: [], conflicts: [] };
  }

}

export const pipelineService = new PipelineService();
