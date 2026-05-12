import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { contracts, contractRules, contractCalculations } from '../../shared/schema';
import { sql, eq, ne, count, sum, desc, and, gte, lte, like, or, ilike, inArray } from 'drizzle-orm';

// Generic clause rows in contract_rules (default clause_category = 'general') are
// metadata extractions, not real fee rules. Exclude them from any rule count
// surfaced to the user. Single source of truth — used by every count query below.
const realFeeRuleFilter = ne(contractRules.clauseCategory, 'general');

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || '',
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  timeout: 60_000,
  maxRetries: 2,
});

let currentUserContext: { companyId?: string; userId?: string; role?: string } = {};

const ACTIVE_STATUSES = ['analyzed', 'completed', 'uploaded'];

function truncateToolResult(result: string, maxChars: number = 12000): string {
  if (result.length <= maxChars) return result;
  try {
    const parsed = JSON.parse(result);
    if (parsed.contracts && Array.isArray(parsed.contracts) && parsed.contracts.length > 10) {
      parsed.contracts = parsed.contracts.slice(0, 10);
      parsed.truncated = true;
    }
    if (parsed.rules && Array.isArray(parsed.rules) && parsed.rules.length > 10) {
      parsed.rules = parsed.rules.slice(0, 10);
      parsed.truncated = true;
    }
    if (parsed.calculations && Array.isArray(parsed.calculations) && parsed.calculations.length > 10) {
      parsed.calculations = parsed.calculations.slice(0, 10);
      parsed.truncated = true;
    }
    if (parsed.transactions && Array.isArray(parsed.transactions) && parsed.transactions.length > 10) {
      parsed.transactions = parsed.transactions.slice(0, 10);
      parsed.truncated = true;
    }
    if (parsed.accruals && Array.isArray(parsed.accruals) && parsed.accruals.length > 10) {
      parsed.accruals = parsed.accruals.slice(0, 10);
      parsed.truncated = true;
    }
    if (parsed.journalEntries && Array.isArray(parsed.journalEntries) && parsed.journalEntries.length > 10) {
      parsed.journalEntries = parsed.journalEntries.slice(0, 10);
      parsed.truncated = true;
    }
    const truncated = JSON.stringify(parsed);
    if (truncated.length <= maxChars) return truncated;
    return truncated.slice(0, maxChars) + '..."truncated"}';
  } catch {
    return result.slice(0, maxChars) + '...[truncated]';
  }
}

const tools: Anthropic.Tool[] = [
  {
    name: "query_contracts",
    description: "Query contracts from the database. Use this when the user asks about contracts, their status, count, or details. Returns contract records with status, parties, dates, and metadata. The status 'active' is a valid filter meaning contracts with status analyzed, completed, or uploaded.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by status: uploaded, processing, analyzed, completed, failed, draft, or 'active' (meaning analyzed/completed/uploaded)" },
        search: { type: "string", description: "Search by contract name, organization name, or counterparty name" },
        limit: { type: "number", description: "Max number of results to return (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "query_contract_details",
    description: "Get detailed information about a specific contract by its ID, including terms, parties, dates, and processing status.",
    input_schema: {
      type: "object" as const,
      properties: {
        contractId: { type: "number", description: "The contract ID" },
      },
      required: ["contractId"],
    },
  },
  {
    name: "query_rules",
    description: "Query contract fee rules. Use when the user asks about rules, fee structures, rates, tiers, or rule configurations. Can filter by contract.",
    input_schema: {
      type: "object" as const,
      properties: {
        contractId: { type: "number", description: "Filter rules by contract ID" },
        search: { type: "string", description: "Search rules by name or description" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "query_calculations",
    description: "Query contract fee calculations. Use when the user asks about calculations, computed amounts, calculation history, or totals. Returns calculation records with amounts, periods, and status.",
    input_schema: {
      type: "object" as const,
      properties: {
        contractId: { type: "number", description: "Filter by contract ID" },
        status: { type: "string", description: "Filter by status" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "query_accruals",
    description: "Query accrual records. Use when the user asks about accruals, accrual amounts, accrual status, pending approvals, or accrual exposure. Returns accrual records with amounts, status, and contract info.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by status: draft, pending, approved, rejected" },
        contractId: { type: "number", description: "Filter by contract ID" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "query_journal_entries",
    description: "Query journal entries. Use when the user asks about journal entries, JEs, posting status, GL entries, debit/credit amounts, or ERP sync status.",
    input_schema: {
      type: "object" as const,
      properties: {
        stage: { type: "string", description: "Filter by stage: draft, pending_review, approved, posted, rejected" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "query_sales_data",
    description: "Query sales transaction data. Use when the user asks about sales data, transactions, uploaded sales, POS data, or revenue figures.",
    input_schema: {
      type: "object" as const,
      properties: {
        contractId: { type: "number", description: "Filter by contract ID" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "get_financial_summary",
    description: "Get a comprehensive financial summary with counts and totals across all entities. Use when the user asks about overall health, dashboard metrics, financial snapshot, or general status questions.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "query_period_close",
    description: "Query period close status and readiness. Use when the user asks about period close, close readiness, close checklist, or what's blocking close.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: { type: "string", description: "Period identifier to check" },
      },
      required: [],
    },
  },
  {
    name: "search_contract_text",
    description: "Search through contract document text using semantic search (RAG). Use ONLY when the user asks about specific contract terms, clauses, language, definitions, obligations, renewal policies, or content within contracts. Do NOT use this for platform help questions like 'how to upload a contract'.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query to find in contract text" },
        contractId: { type: "number", description: "Optional: limit search to a specific contract" },
      },
      required: ["query"],
    },
  },
];

function getCompanyFilter() {
  return currentUserContext.companyId || null;
}

async function executeQueryContracts(params: any): Promise<string> {
  try {
    const conditions: any[] = [];
    const companyId = getCompanyFilter();
    if (companyId) {
      conditions.push(eq(contracts.companyId, companyId));
    }

    if (params.status) {
      const statusLower = params.status.toLowerCase();
      if (statusLower === 'active') {
        conditions.push(inArray(contracts.status, ACTIVE_STATUSES));
      } else {
        conditions.push(eq(contracts.status, params.status));
      }
    }
    if (params.search) {
      conditions.push(or(
        ilike(contracts.contractName, `%${params.search}%`),
        ilike(contracts.organizationName, `%${params.search}%`),
        ilike(contracts.counterpartyName, `%${params.search}%`),
      ));
    }

    const limit = Math.min(params.limit || 20, 50);
    const query = db.select({
      id: contracts.id,
      contractName: contracts.contractName,
      displayName: contracts.displayName,
      status: contracts.status,
      organizationName: contracts.organizationName,
      counterpartyName: contracts.counterpartyName,
      contractTypeCode: contracts.contractTypeCode,
      effectiveDate: contracts.effectiveDate,
      expirationDate: contracts.expirationDate,
      contractStatus: contracts.contractStatus,
      currency: contracts.currency,
      createdAt: contracts.createdAt,
    }).from(contracts)
      .orderBy(desc(contracts.createdAt))
      .limit(limit);

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    const totalConditions: any[] = [];
    if (companyId) totalConditions.push(eq(contracts.companyId, companyId));
    const totalResult = totalConditions.length > 0
      ? await db.select({ count: count() }).from(contracts).where(and(...totalConditions))
      : await db.select({ count: count() }).from(contracts);
    const total = totalResult[0]?.count || 0;

    const statusQuery = companyId
      ? db.select({ status: contracts.status, count: count() }).from(contracts).where(eq(contracts.companyId, companyId)).groupBy(contracts.status)
      : db.select({ status: contracts.status, count: count() }).from(contracts).groupBy(contracts.status);
    const statusCounts = await statusQuery;

    return JSON.stringify({
      totalContracts: total,
      statusBreakdown: statusCounts,
      contracts: results,
      showing: results.length,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function executeQueryContractDetails(params: any): Promise<string> {
  try {
    const result = await db.select().from(contracts).where(eq(contracts.id, params.contractId)).limit(1);
    if (result.length === 0) return JSON.stringify({ error: "Contract not found" });

    const rulesResult = await db.select({
      id: contractRules.id,
      ruleName: contractRules.ruleName,
      ruleType: contractRules.ruleType,
      baseRate: contractRules.baseRate,
      isActive: contractRules.isActive,
      aiConfidenceScore: contractRules.aiConfidenceScore,
    }).from(contractRules).where(and(eq(contractRules.contractId, params.contractId), realFeeRuleFilter));

    const calcsResult = await db.select({
      id: contractCalculations.id,
      periodStart: contractCalculations.periodStart,
      periodEnd: contractCalculations.periodEnd,
      totalRoyalty: contractCalculations.totalRoyalty,
      totalSalesAmount: contractCalculations.totalSalesAmount,
      status: contractCalculations.status,
    }).from(contractCalculations).where(eq(contractCalculations.contractId, params.contractId)).orderBy(desc(contractCalculations.createdAt)).limit(10);

    return JSON.stringify({
      contract: result[0],
      rules: rulesResult,
      rulesCount: rulesResult.length,
      recentCalculations: calcsResult,
      calculationsCount: calcsResult.length,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function executeQueryRules(params: any): Promise<string> {
  try {
    const conditions: any[] = [realFeeRuleFilter];
    if (params.contractId) {
      conditions.push(eq(contractRules.contractId, params.contractId));
    }
    if (params.search) {
      conditions.push(ilike(contractRules.ruleName, `%${params.search}%`));
    }
    const companyId = getCompanyFilter();
    if (companyId && !params.contractId) {
      conditions.push(
        sql`${contractRules.contractId} IN (SELECT id FROM contracts WHERE company_id = ${companyId})`
      );
    }
    const limit = Math.min(params.limit || 20, 50);

    const query = db.select({
      id: contractRules.id,
      contractId: contractRules.contractId,
      ruleName: contractRules.ruleName,
      ruleType: contractRules.ruleType,
      baseRate: contractRules.baseRate,
      isActive: contractRules.isActive,
      aiConfidenceScore: contractRules.aiConfidenceScore,
      productCategory: contractRules.productCategory,
      territory: contractRules.territory,
    }).from(contractRules).orderBy(desc(contractRules.createdAt)).limit(limit);

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    const totalConditions: any[] = [realFeeRuleFilter];
    if (companyId) {
      totalConditions.push(sql`${contractRules.contractId} IN (SELECT id FROM contracts WHERE company_id = ${companyId})`);
    }
    const totalResult = await db.select({ count: count() }).from(contractRules).where(and(...totalConditions));

    return JSON.stringify({
      totalRules: totalResult[0]?.count || 0,
      rules: results,
      showing: results.length,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function executeQueryCalculations(params: any): Promise<string> {
  try {
    const conditions: any[] = [];
    if (params.contractId) {
      conditions.push(eq(contractCalculations.contractId, params.contractId));
    }
    if (params.status) {
      conditions.push(eq(contractCalculations.status, params.status));
    }
    const companyId = getCompanyFilter();
    if (companyId && !params.contractId) {
      conditions.push(
        sql`${contractCalculations.contractId} IN (SELECT id FROM contracts WHERE company_id = ${companyId})`
      );
    }
    const limit = Math.min(params.limit || 20, 50);

    const query = db.select({
      id: contractCalculations.id,
      contractId: contractCalculations.contractId,
      periodStart: contractCalculations.periodStart,
      periodEnd: contractCalculations.periodEnd,
      totalRoyalty: contractCalculations.totalRoyalty,
      totalSalesAmount: contractCalculations.totalSalesAmount,
      transactionCount: contractCalculations.transactionCount,
      status: contractCalculations.status,
      createdAt: contractCalculations.createdAt,
    }).from(contractCalculations).orderBy(desc(contractCalculations.createdAt)).limit(limit);

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    const totalsConditions: any[] = [];
    if (companyId) {
      totalsConditions.push(sql`${contractCalculations.contractId} IN (SELECT id FROM contracts WHERE company_id = ${companyId})`);
    }
    const totals = totalsConditions.length > 0
      ? await db.select({
          totalCalcs: count(),
          totalAmount: sum(contractCalculations.totalRoyalty),
          totalSales: sum(contractCalculations.totalSalesAmount),
        }).from(contractCalculations).where(and(...totalsConditions))
      : await db.select({
          totalCalcs: count(),
          totalAmount: sum(contractCalculations.totalRoyalty),
          totalSales: sum(contractCalculations.totalSalesAmount),
        }).from(contractCalculations);

    return JSON.stringify({
      summary: {
        totalCalculations: totals[0]?.totalCalcs || 0,
        totalFeeAmount: totals[0]?.totalAmount || '0',
        totalSalesAmount: totals[0]?.totalSales || '0',
      },
      calculations: results,
      showing: results.length,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function executeQueryAccruals(params: any): Promise<string> {
  try {
    const companyId = getCompanyFilter();
    const whereClauses: string[] = [];

    if (params.status) {
      whereClauses.push(`a.status = '${params.status.replace(/'/g, "''")}'`);
    }
    if (params.contractId) {
      whereClauses.push(`a.contract_id = '${String(params.contractId).replace(/'/g, "''")}'`);
    }
    if (companyId) {
      whereClauses.push(`a.contract_id IN (SELECT id FROM contracts WHERE company_id = '${companyId}')`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const companyFilter = companyId ? `WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = '${companyId}')` : '';

    const accrualResults = await db.execute(sql.raw(`
      SELECT a.id, a.accrual_id, a.contract_id, a.contract_name, a.counterparty,
             a.amount, a.period, a.status, a.ai_confidence, a.flow_type, a.created_at
      FROM accruals a
      ${whereStr}
      ORDER BY a.created_at DESC
      LIMIT ${params.limit || 20}
    `));

    const summaryResult = await db.execute(sql.raw(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COALESCE(SUM(CASE WHEN status = 'draft' THEN amount ELSE 0 END), 0) as draft_amount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved_amount,
        COALESCE(SUM(amount), 0) as total_amount
      FROM accruals
      ${companyFilter}
    `));

    return JSON.stringify({
      summary: summaryResult.rows?.[0] || {},
      accruals: accrualResults.rows || [],
      showing: (accrualResults.rows || []).length,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message, note: "Accruals table may not have data yet" });
  }
}

async function executeQueryJournalEntries(params: any): Promise<string> {
  try {
    const companyId = getCompanyFilter();
    const companyFilter = companyId ? `AND je.contract_id IN (SELECT id FROM contracts WHERE company_id = '${companyId}')` : '';
    const companyFilterSummary = companyId ? `WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = '${companyId}')` : '';

    const stageFilter = params.stage ? `AND je.je_stage = '${String(params.stage).replace(/'/g, "''")}'` : '';
    const jeResults = await db.execute(sql.raw(`
      SELECT je.id, je.je_id, je.source_accrual_id, je.contract_id, je.contract_name,
             je.total_amount, je.je_stage, je.erp_sync_status, je.posting_date, je.created_at
      FROM journal_entries je
      WHERE 1=1 ${companyFilter}
      ${stageFilter}
      ORDER BY je.created_at DESC
      LIMIT ${params.limit || 20}
    `));

    const summaryResult = await db.execute(sql.raw(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE je_stage = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE je_stage = 'pending_review') as pending_count,
        COUNT(*) FILTER (WHERE je_stage = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE je_stage = 'posted') as posted_count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM journal_entries
      ${companyFilterSummary}
    `));

    return JSON.stringify({
      summary: summaryResult.rows?.[0] || {},
      journalEntries: jeResults.rows || [],
      showing: (jeResults.rows || []).length,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message, note: "Journal entries table may not have data yet" });
  }
}

async function executeQuerySalesData(params: any): Promise<string> {
  try {
    const companyId = getCompanyFilter();
    const limit = Math.min(params.limit || 20, 50);

    const companyFilter = companyId ? `AND company_id = '${companyId}'` : '';

    const results = await db.execute(sql.raw(`
      SELECT id, matched_contract_id, transaction_date, product_name, quantity, unit_price, gross_amount, net_amount, territory, channel
      FROM sales_data
      WHERE 1=1 ${companyFilter}
      ${params.contractId ? `AND matched_contract_id = '${params.contractId}'` : ''}
      ORDER BY transaction_date DESC
      LIMIT ${limit}
    `));

    const totals = await db.execute(sql.raw(`
      SELECT COUNT(*) as total_transactions, COALESCE(SUM(gross_amount::numeric), 0) as total_amount
      FROM sales_data
      WHERE 1=1 ${companyFilter}
    `));

    return JSON.stringify({
      summary: {
        totalTransactions: totals.rows?.[0]?.total_transactions || 0,
        totalSalesAmount: totals.rows?.[0]?.total_amount || '0',
      },
      transactions: results.rows || [],
      showing: (results.rows || []).length,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message, note: "Sales data table may not have data yet" });
  }
}

async function executeGetFinancialSummary(): Promise<string> {
  try {
    const companyId = getCompanyFilter();
    const companyConditions: any[] = [];
    if (companyId) companyConditions.push(eq(contracts.companyId, companyId));

    const contractCounts = companyConditions.length > 0
      ? await db.select({ status: contracts.status, count: count() }).from(contracts).where(and(...companyConditions)).groupBy(contracts.status)
      : await db.select({ status: contracts.status, count: count() }).from(contracts).groupBy(contracts.status);

    const totalContracts = contractCounts.reduce((s, r) => s + (r.count || 0), 0);

    const companyFilter = companyId ? `WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = '${companyId}')` : '';
    const companyFilterRules = companyId ? `WHERE ${contractRules.contractId} IN (SELECT id FROM contracts WHERE company_id = '${companyId}')` : '';

    const ruleConditions: any[] = [realFeeRuleFilter];
    if (companyId) ruleConditions.push(sql`${contractRules.contractId} IN (SELECT id FROM contracts WHERE company_id = ${companyId})`);
    const ruleCounts = await db.select({ total: count() }).from(contractRules).where(and(...ruleConditions));

    const calcConditions: any[] = [];
    if (companyId) calcConditions.push(sql`${contractCalculations.contractId} IN (SELECT id FROM contracts WHERE company_id = ${companyId})`);
    const calcTotals = calcConditions.length > 0
      ? await db.select({
          totalCalcs: count(),
          totalAmount: sum(contractCalculations.totalRoyalty),
          totalSales: sum(contractCalculations.totalSalesAmount),
        }).from(contractCalculations).where(and(...calcConditions))
      : await db.select({
          totalCalcs: count(),
          totalAmount: sum(contractCalculations.totalRoyalty),
          totalSales: sum(contractCalculations.totalSalesAmount),
        }).from(contractCalculations);

    const salesFilter = companyId ? `WHERE company_id = '${companyId}'` : '';
    let salesTotals: any = { totalTransactions: 0, totalAmount: '0' };
    try {
      const salesResult = await db.execute(sql.raw(`SELECT COUNT(*) as total, COALESCE(SUM(gross_amount::numeric), 0) as amount FROM sales_data ${salesFilter}`));
      salesTotals = { totalTransactions: salesResult.rows?.[0]?.total || 0, totalAmount: salesResult.rows?.[0]?.amount || '0' };
    } catch { /* table may not exist */ }

    let accrualSummary: any = {};
    try {
      const accrualResult = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'draft') as draft,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved_amount,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount
        FROM accruals
        ${companyFilter}
      `));
      accrualSummary = accrualResult.rows?.[0] || {};
    } catch { accrualSummary = { note: "No accruals yet" }; }

    let jeSummary: any = {};
    try {
      const jeResult = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE je_stage = 'posted') as posted,
          COUNT(*) FILTER (WHERE je_stage != 'posted') as pending,
          COALESCE(SUM(total_amount), 0) as total_amount
        FROM journal_entries
        ${companyFilter}
      `));
      jeSummary = jeResult.rows?.[0] || {};
    } catch { jeSummary = { note: "No journal entries yet" }; }

    return JSON.stringify({
      contracts: { total: totalContracts, byStatus: contractCounts },
      rules: { total: ruleCounts[0]?.total || 0 },
      calculations: {
        total: calcTotals[0]?.totalCalcs || 0,
        totalFeeAmount: calcTotals[0]?.totalAmount || '0',
        totalSalesAmount: calcTotals[0]?.totalSales || '0',
      },
      salesData: {
        totalTransactions: salesTotals.totalTransactions || 0,
        totalAmount: salesTotals.totalAmount || '0',
      },
      accruals: accrualSummary,
      journalEntries: jeSummary,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function executeQueryPeriodClose(params: any): Promise<string> {
  try {
    const companyId = getCompanyFilter();
    let periodClose: any = {};
    try {
      const pcResult = await db.execute(sql`
        SELECT pc.*, 
          (SELECT COUNT(*) FROM period_close_checklist pcl WHERE pcl.period_close_id = pc.id) as checklist_total,
          (SELECT COUNT(*) FROM period_close_checklist pcl WHERE pcl.period_close_id = pc.id AND pcl.is_complete = true) as checklist_done,
          (SELECT COUNT(*) FROM period_close_blockers pcb WHERE pcb.period_close_id = pc.id AND pcb.is_resolved = false) as open_blockers
        FROM period_close pc
        ORDER BY pc.created_at DESC
        LIMIT 5
      `);
      periodClose = pcResult.rows || [];
    } catch { periodClose = []; }

    const companyConditions: any[] = [];
    if (companyId) companyConditions.push(eq(contracts.companyId, companyId));

    const contractStatusCounts = companyConditions.length > 0
      ? await db.select({ status: contracts.status, count: count() }).from(contracts).where(and(...companyConditions)).groupBy(contracts.status)
      : await db.select({ status: contracts.status, count: count() }).from(contracts).groupBy(contracts.status);

    const totalContracts = contractStatusCounts.reduce((s, r) => s + (r.count || 0), 0);
    const analyzed = contractStatusCounts.find(r => r.status === 'analyzed')?.count || 0;

    const ruleConditions: any[] = [realFeeRuleFilter];
    if (companyId) ruleConditions.push(sql`${contractRules.contractId} IN (SELECT id FROM contracts WHERE company_id = ${companyId})`);
    const totalRules = await db.select({ total: count() }).from(contractRules).where(and(...ruleConditions));

    const calcConditions: any[] = [];
    if (companyId) calcConditions.push(sql`${contractCalculations.contractId} IN (SELECT id FROM contracts WHERE company_id = ${companyId})`);
    const totalCalcs = calcConditions.length > 0
      ? await db.select({ total: count() }).from(contractCalculations).where(and(...calcConditions))
      : await db.select({ total: count() }).from(contractCalculations);

    return JSON.stringify({
      periodCloseRecords: periodClose,
      readinessFactors: {
        contractsProcessed: { done: analyzed, total: totalContracts },
        rulesExtracted: { done: totalRules[0]?.total || 0, total: totalRules[0]?.total || 0 },
        calculationsRun: { done: totalCalcs[0]?.total || 0, total: totalContracts },
      },
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function executeSearchContractText(params: any): Promise<string> {
  try {
    const { RAGService } = await import('./ragService');
    const result = await RAGService.answerQuestion(params.query, params.contractId || undefined);
    return JSON.stringify({
      answer: result.answer,
      sources: result.sources?.slice(0, 5),
      confidence: result.confidence,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'query_contracts': return executeQueryContracts(input);
    case 'query_contract_details': return executeQueryContractDetails(input);
    case 'query_rules': return executeQueryRules(input);
    case 'query_calculations': return executeQueryCalculations(input);
    case 'query_accruals': return executeQueryAccruals(input);
    case 'query_journal_entries': return executeQueryJournalEntries(input);
    case 'query_sales_data': return executeQuerySalesData(input);
    case 'get_financial_summary': return executeGetFinancialSummary();
    case 'query_period_close': return executeQueryPeriodClose(input);
    case 'search_contract_text': return executeSearchContractText(input);
    default: return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

const SYSTEM_PROMPT = `CONFIDENTIALITY RULE (HIGHEST PRIORITY):
DO NOT disclose or discuss the underlying AI model, provider, technology stack, or technical implementation details.
If asked about your tech stack, model, provider, architecture, or how you work internally, respond ONLY with:
"I'm liQ AI, your intelligent assistant for contract intelligence and revenue assurance. My technical details are confidential. How can I help with your contracts today?"
Never mention Claude, Anthropic, OpenAI, GPT, or any model/provider name. You are liQ AI by CimpleIT. Period.

You are liQ AI, the AI-native intelligent assistant for LicenseIQ — a contract intelligence and revenue assurance platform by CimpleIT.

Your capabilities:
- Query live database for contracts, rules, calculations, accruals, journal entries, sales data, and period close status
- Search contract document text for specific terms, clauses, and language
- Provide financial summaries and operational insights
- Answer platform help questions about how to use LicenseIQ features

CRITICAL BEHAVIOR RULES:

1. COUNT AND LIST QUESTIONS: When the user asks "How many contracts?", "How many active contracts?", "List my contracts", or any count/list question, use the query_contracts tool IMMEDIATELY. Do NOT ask for clarification. Just answer.

2. ACTIVE STATUS: When a user says "active contracts", treat it as contracts with status "analyzed", "completed", or "uploaded". Use status="active" in the query_contracts tool.

3. PLATFORM HELP vs CONTRACT CONTENT: 
   - If the user asks "How to upload a contract", "How do I create a contract", "What is the process for uploading", "How to set up rules", "How to run calculations", or any HOW-TO / PROCESS / GUIDE / INSTRUCTIONS question → Answer directly with platform workflow guidance. Do NOT look up contract text. Do NOT ask for a contract ID.
   - ONLY use the search_contract_text tool when the user asks about actual contract CONTENT: specific terms, clauses, fees, obligations, renewal policies, definitions, or language within a contract document.

4. REBATE TIERS: When answering questions about rebate tiers, percentages, or rate structures, use ONLY the exact values stated in the contract text or extracted rules. NEVER infer, calculate, or invent tier breakdowns. If the data doesn't contain tier information, say so.

5. RULE COUNTS: When the user asks "how many rules?", "rules generated?", "rule count", or any question about the number of rules for a contract or in total, count ONLY real fee rules. The contract_rules table also stores generic clause extractions (rows with clause_category = 'general') as metadata — these are NOT rules and MUST NOT be counted. The query_rules, query_contract_details, and financial_summary tools already exclude these rows; trust their numbers. Never count raw rows from contract_rules — always use the tool totals. If the filtered count is zero, say "0 rules" explicitly. Example: if the database has 5 rows for a contract but only 2 have a non-general clause_category, answer "2 rules", not "5".

EXAMPLES:
- "How many contracts do I have?" → Use query_contracts immediately, respond with count
- "How many active contracts?" → Use query_contracts with status=active, respond with count  
- "List my contracts" → Use query_contracts, show the list
- "How to upload a contract" → Answer with platform instructions (go to Upload and Process page, click Upload Contract, select PDF, etc.)
- "How do I create rules?" → Answer with platform workflow steps
- "What are the fee terms in contract X?" → Use search_contract_text to look up terms
- "What rebate tiers are in this contract?" → Use search_contract_text, report ONLY what's found

PLATFORM HELP ANSWERS:
- Upload a contract: Navigate to Contract Intelligence > Upload and Process. Click "Upload Contract", select a PDF file, and the system will process it automatically.
- Create rules: Rules are auto-extracted by AI during contract processing. You can also manually add rules from the Rules tab on any contract.
- Run calculations: Go to Contract Execution > Calculate tab. Select your contract scope, set the period, and click "Run Calculations".
- Data Ingestion: Go to Contract Execution > Data Ingestion to upload sales data CSV files.
- Smart Match: Use the "Smart Match Sales to Contracts" button to automatically match uploaded sales to contracts.

Guidelines:
- Always refer to yourself as "liQ AI" (lowercase l, lowercase i, uppercase Q)
- Use "AI-native" (never "AI-powered")
- Use "contract fee" instead of "royalty" or "license fee" in user-facing text
- Format currency values with $ and commas
- Format dates in US format (MM/DD/YYYY)
- Be concise but thorough — provide specific numbers and data
- When showing lists, format them clearly with bullet points or numbered items
- If data is empty or zero, say so clearly rather than making up numbers
- When a user asks about something on their current page, use the page context provided
- For contract-specific questions, query the specific contract
- For general questions, use the financial summary tool first
- Always base your answers on actual data from the tools — never fabricate information

Page context awareness:
- The user's current page is provided in the system message
- Use this to provide contextually relevant answers
- If the user is on a contract page, include that contract's data in your response`;

export interface AgentResponse {
  answer: string;
  toolsUsed: string[];
  sources?: any[];
  confidence?: number;
}

export async function askAgent(
  question: string,
  pageContext?: { page: string; label: string; contractId?: string },
  conversationHistory?: Array<{ role: string; content: string }>,
  userContext?: { companyId?: string; userId?: string; role?: string }
): Promise<AgentResponse> {
  const savedContext = userContext ? { ...userContext } : { ...currentUserContext };
  if (userContext) {
    currentUserContext = { ...userContext };
  }

  const toolsUsed: string[] = [];

  try {
    let contextMessage = '';
    if (pageContext) {
      contextMessage = `\n\nUser is currently viewing: ${pageContext.label} (page: ${pageContext.page})`;
      if (pageContext.contractId) {
        contextMessage += `\nActive contract ID: ${pageContext.contractId}`;
      }
    }
    if (savedContext.companyId) {
      contextMessage += `\nUser's active company ID: ${savedContext.companyId}`;
    }

    const messages: Anthropic.MessageParam[] = [];

    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-8);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          const content = typeof msg.content === 'string' && msg.content.length > 2000
            ? msg.content.slice(0, 2000) + '...'
            : msg.content;
          messages.push({ role: msg.role as 'user' | 'assistant', content });
        }
      }
    }

    messages.push({ role: 'user', content: question });

    console.log(`🤖 [liQ Agent] Processing question: "${question.slice(0, 100)}"`);

    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      temperature: 0.1,
      system: SYSTEM_PROMPT + contextMessage,
      tools,
      messages,
    });

    console.log(`🤖 [liQ Agent] Initial response: stop_reason=${response.stop_reason}, blocks=${response.content.length}`);

    let iterations = 0;
    const maxIterations = 5;

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++;
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ContentBlock & { type: 'tool_use' } => block.type === 'tool_use'
      );

      const toolResults: Anthropic.MessageParam = {
        role: 'user',
        content: await Promise.all(
          toolUseBlocks.map(async (toolBlock) => {
            console.log(`🔧 [liQ Agent] Calling tool: ${toolBlock.name}`, JSON.stringify(toolBlock.input).slice(0, 200));
            toolsUsed.push(toolBlock.name);
            let result: string;
            try {
              result = await executeTool(toolBlock.name, toolBlock.input);
              result = truncateToolResult(result);
            } catch (toolErr: any) {
              console.error(`❌ [liQ Agent] Tool ${toolBlock.name} failed:`, toolErr.message);
              result = JSON.stringify({ error: toolErr.message || 'Tool execution failed' });
            }
            return {
              type: 'tool_result' as const,
              tool_use_id: toolBlock.id,
              content: result,
            };
          })
        ),
      };

      messages.push({ role: 'assistant', content: response.content });
      messages.push(toolResults);

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        temperature: 0.1,
        system: SYSTEM_PROMPT + contextMessage,
        tools,
        messages,
      });

      console.log(`🤖 [liQ Agent] Iteration ${iterations}: stop_reason=${response.stop_reason}`);
    }

    if (iterations >= maxIterations) {
      console.warn(`⚠️ [liQ Agent] Hit max iterations (${maxIterations})`);
    }

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    const answer = textBlocks.map(b => b.text).join('\n') || "I wasn't able to generate a response. Please try rephrasing your question.";

    return {
      answer,
      toolsUsed,
      confidence: toolsUsed.length > 0 ? 0.9 : 0.7,
    };
  } catch (err: any) {
    console.error(`❌ [liQ Agent] Error:`, err.message || err);

    if (err.status === 529 || err.message?.includes('overloaded')) {
      return {
        answer: "I'm experiencing high demand right now. Please try again in a moment.",
        toolsUsed,
        confidence: 0,
      };
    }
    if (err.status === 429 || err.message?.includes('rate')) {
      return {
        answer: "I've hit a rate limit. Please wait a few seconds and try again.",
        toolsUsed,
        confidence: 0,
      };
    }
    if (err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('Timeout')) {
      return {
        answer: "The request took too long. Please try a simpler question or try again.",
        toolsUsed,
        confidence: 0,
      };
    }
    if (err.status === 401 || err.message?.includes('auth') || err.message?.includes('API key')) {
      return {
        answer: "There's a configuration issue with the AI service. Please contact your administrator.",
        toolsUsed,
        confidence: 0,
      };
    }

    return {
      answer: "I encountered an unexpected issue processing your question. Please try again.",
      toolsUsed,
      confidence: 0,
    };
  }
}