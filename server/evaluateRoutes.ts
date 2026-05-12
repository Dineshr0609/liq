import type { Express } from "express";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import {
  contractRules,
  salesData,
  customers,
  rebatePrograms,
  ruleDecisionLogs,
  insertCustomerSchema,
  insertRebateProgramSchema,
  insertRuleDecisionLogSchema,
} from "@shared/schema";

export function registerEvaluateRoutes(app: Express): void {

  app.post('/api/evaluate', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, transaction } = req.body;
      if (!contractId || !transaction) {
        return res.status(400).json({ error: 'contractId and transaction are required' });
      }

      const rules = await db.select().from(contractRules)
        .where(and(eq(contractRules.contractId, contractId), eq(contractRules.isActive, true)));

      if (rules.length === 0) {
        return res.status(404).json({ error: 'No active rules found for this contract' });
      }

      const txDate = transaction.transactionDate ? new Date(transaction.transactionDate) : null;

      type ScoredRule = {
        rule: typeof rules[0];
        score: number;
        matched: boolean;
        reason: string;
        conditions: string[];
      };

      const scored: ScoredRule[] = rules.map((rule) => {
        let score = 0;
        let matched = true;
        let reason = '';
        const conditions: string[] = [];

        if (rule.productCategories && rule.productCategories.length > 0) {
          score++;
          if (transaction.productName && rule.productCategories.includes(transaction.productName)) {
            conditions.push(`product=${transaction.productName}`);
          } else {
            matched = false;
            reason = `Product '${transaction.productName}' not in [${rule.productCategories.join(', ')}]`;
          }
        }

        if (rule.territories && rule.territories.length > 0) {
          score++;
          if (transaction.territory && rule.territories.includes(transaction.territory)) {
            conditions.push(`territory=${transaction.territory}`);
          } else {
            matched = false;
            reason = reason || `Territory '${transaction.territory}' not in [${rule.territories.join(', ')}]`;
          }
        }

        if (rule.customerSegments && rule.customerSegments.length > 0) {
          score++;
          if (transaction.customerSegment && rule.customerSegments.includes(transaction.customerSegment)) {
            conditions.push(`segment=${transaction.customerSegment}`);
          } else {
            matched = false;
            reason = reason || `Segment '${transaction.customerSegment}' not in [${rule.customerSegments.join(', ')}]`;
          }
        }

        if (rule.channel) {
          score++;
          if (transaction.channel && rule.channel === transaction.channel) {
            conditions.push(`channel=${transaction.channel}`);
          } else {
            matched = false;
            reason = reason || `Channel '${transaction.channel}' != '${rule.channel}'`;
          }
        }

        if (rule.effectiveDate || rule.expiryDate) {
          score++;
          if (txDate) {
            if (rule.effectiveDate && txDate < rule.effectiveDate) {
              matched = false;
              reason = reason || `Date before effective date`;
            }
            if (rule.expiryDate && txDate > rule.expiryDate) {
              matched = false;
              reason = reason || `Date after expiry date`;
            }
            if (matched) {
              conditions.push(`date in range`);
            }
          }
        }

        return { rule, score, matched, reason: reason || 'Did not match criteria', conditions };
      });

      const matchedRules = scored.filter(s => s.matched).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.rule.priority || 10) - (b.rule.priority || 10);
      });

      const alternatives = scored
        .filter(s => !s.matched)
        .map(s => ({ ruleId: s.rule.id, ruleName: s.rule.ruleName, reason: s.reason }));

      if (matchedRules.length === 0) {
        return res.json({
          result: 0,
          explanation: 'No matching rules found for the given transaction',
          ruleApplied: null,
          conditionMatched: '',
          confidenceScore: 0,
          alternativesConsidered: alternatives,
          calculationSteps: ['No rules matched the transaction criteria'],
          specificityScore: 0,
        });
      }

      const best = matchedRules[0];
      const baseRate = parseFloat(best.rule.baseRate || '0');
      const amount = parseFloat(transaction.netAmount || transaction.grossAmount || '0');
      const result = baseRate * amount;
      const calculationSteps = [
        `Selected rule: ${best.rule.ruleName} (specificity=${best.score}, priority=${best.rule.priority})`,
        `Base rate: ${baseRate}`,
        `Amount used: ${amount}`,
        `Calculation: ${baseRate} × ${amount} = ${result}`,
      ];
      const conditionMatched = best.conditions.join(', ');
      const confidenceScore = parseFloat(best.rule.confidence || '0.8');

      await db.insert(ruleDecisionLogs).values({
        ruleId: best.rule.id,
        contractId,
        transactionId: transaction.transactionId || null,
        inputSnapshot: transaction,
        outputDecision: { result, explanation: `Applied ${best.rule.ruleName}` },
        conditionMatched,
        alternativesConsidered: alternatives,
        confidenceScore: String(confidenceScore),
        specificityScore: best.score,
        calculationSteps,
      });

      res.json({
        result,
        explanation: `Applied rule '${best.rule.ruleName}': baseRate(${baseRate}) × amount(${amount}) = ${result}`,
        ruleApplied: { id: best.rule.id, name: best.rule.ruleName, type: best.rule.ruleType },
        conditionMatched,
        confidenceScore,
        alternativesConsidered: alternatives,
        calculationSteps,
        specificityScore: best.score,
      });
    } catch (error: any) {
      console.error('Evaluate error:', error);
      res.status(500).json({ error: error.message || 'Failed to evaluate rule' });
    }
  });

  app.post('/api/rebate/calculate', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, periodStart, periodEnd } = req.body;
      if (!contractId || !periodStart || !periodEnd) {
        return res.status(400).json({ error: 'contractId, periodStart, and periodEnd are required' });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      const rebateRules = await db.select().from(contractRules)
        .where(and(
          eq(contractRules.contractId, contractId),
          eq(contractRules.isActive, true),
        ));

      const filteredRules = rebateRules.filter(r =>
        r.ruleType === 'tiered' || r.ruleType === 'percentage' || r.ruleType === 'rebate'
      );

      const sales = await db.select().from(salesData)
        .where(and(
          eq(salesData.matchedContractId, contractId),
          gte(salesData.transactionDate, start),
          lte(salesData.transactionDate, end),
        ));

      const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.netAmount || s.grossAmount || '0'), 0);

      let totalRebate = 0;
      const breakdown: any[] = [];

      for (const rule of filteredRules) {
        const tiers = (rule.volumeTiers as any[]) || [];
        const baseRate = parseFloat(rule.baseRate || '0');

        if (tiers.length > 0) {
          let ruleRebate = 0;
          for (const tier of tiers) {
            const min = parseFloat(tier.min || '0');
            const max = tier.max ? parseFloat(tier.max) : Infinity;
            const rate = parseFloat(tier.rate || '0');
            if (totalSales >= min && totalSales <= max) {
              ruleRebate = totalSales * rate;
              breakdown.push({
                ruleId: rule.id,
                ruleName: rule.ruleName,
                tierMin: min,
                tierMax: max === Infinity ? null : max,
                rate,
                salesAmount: totalSales,
                rebateAmount: ruleRebate,
              });
              break;
            }
          }
          totalRebate += ruleRebate;
        } else if (baseRate > 0) {
          const ruleRebate = totalSales * baseRate;
          totalRebate += ruleRebate;
          breakdown.push({
            ruleId: rule.id,
            ruleName: rule.ruleName,
            rate: baseRate,
            salesAmount: totalSales,
            rebateAmount: ruleRebate,
          });
        }
      }

      res.json({
        totalRebate,
        breakdown,
        explanation: `Calculated rebate of ${totalRebate.toFixed(2)} on ${totalSales.toFixed(2)} total sales across ${filteredRules.length} rules and ${sales.length} transactions`,
        period: { start: periodStart, end: periodEnd },
      });
    } catch (error: any) {
      console.error('Rebate calculate error:', error);
      res.status(500).json({ error: error.message || 'Failed to calculate rebate' });
    }
  });

  app.get('/api/customers', isAuthenticated, async (req: any, res) => {
    try {
      const companyId = req.query.companyId as string;
      const conditions = companyId ? [eq(customers.companyId, companyId)] : [];
      const rows = conditions.length > 0
        ? await db.select().from(customers).where(and(...conditions))
        : await db.select().from(customers);
      res.json(rows);
    } catch (error: any) {
      console.error('Get customers error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch customers' });
    }
  });

  app.post('/api/customers', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertCustomerSchema.parse(req.body);
      const [created] = await db.insert(customers).values(data).returning();
      res.json(created);
    } catch (error: any) {
      console.error('Create customer error:', error);
      res.status(500).json({ error: error.message || 'Failed to create customer' });
    }
  });

  app.patch('/api/customers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const [updated] = await db.update(customers).set({ ...updates, updatedAt: new Date() }).where(eq(customers.id, id)).returning();
      if (!updated) return res.status(404).json({ error: 'Customer not found' });
      res.json(updated);
    } catch (error: any) {
      console.error('Update customer error:', error);
      res.status(500).json({ error: error.message || 'Failed to update customer' });
    }
  });

  app.delete('/api/customers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [deleted] = await db.delete(customers).where(eq(customers.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: 'Customer not found' });
      res.json({ message: 'Customer deleted successfully' });
    } catch (error: any) {
      console.error('Delete customer error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete customer' });
    }
  });

  app.get('/api/rebate-programs', isAuthenticated, async (req: any, res) => {
    try {
      const companyId = req.query.companyId as string;
      const contractId = req.query.contractId as string;
      const conditions: any[] = [];
      if (companyId) conditions.push(eq(rebatePrograms.companyId, companyId));
      if (contractId) conditions.push(eq(rebatePrograms.contractId, contractId));
      const rows = conditions.length > 0
        ? await db.select().from(rebatePrograms).where(and(...conditions))
        : await db.select().from(rebatePrograms);
      res.json(rows);
    } catch (error: any) {
      console.error('Get rebate programs error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch rebate programs' });
    }
  });

  app.post('/api/rebate-programs', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertRebateProgramSchema.parse(req.body);
      const [created] = await db.insert(rebatePrograms).values(data).returning();
      res.json(created);
    } catch (error: any) {
      console.error('Create rebate program error:', error);
      res.status(500).json({ error: error.message || 'Failed to create rebate program' });
    }
  });

  app.patch('/api/rebate-programs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const [updated] = await db.update(rebatePrograms).set({ ...updates, updatedAt: new Date() }).where(eq(rebatePrograms.id, id)).returning();
      if (!updated) return res.status(404).json({ error: 'Rebate program not found' });
      res.json(updated);
    } catch (error: any) {
      console.error('Update rebate program error:', error);
      res.status(500).json({ error: error.message || 'Failed to update rebate program' });
    }
  });

  app.delete('/api/rebate-programs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [deleted] = await db.delete(rebatePrograms).where(eq(rebatePrograms.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: 'Rebate program not found' });
      res.json({ message: 'Rebate program deleted successfully' });
    } catch (error: any) {
      console.error('Delete rebate program error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete rebate program' });
    }
  });

  app.get('/api/rule-decision-logs/:ruleId', isAuthenticated, async (req: any, res) => {
    try {
      const { ruleId } = req.params;
      const logs = await db.select().from(ruleDecisionLogs)
        .where(eq(ruleDecisionLogs.ruleId, ruleId))
        .orderBy(desc(ruleDecisionLogs.createdAt));
      res.json(logs);
    } catch (error: any) {
      console.error('Get rule decision logs error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch decision logs' });
    }
  });
}
