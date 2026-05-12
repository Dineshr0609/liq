/**
 * End-to-end tests for the fee calculation engine (Task #57).
 *
 * Covers, against the running dev server (default http://localhost:5000):
 *   1. POST /api/contracts/:id/calculate-fees runs the universal evaluator
 *      against real, junction-linked sales data and returns the expected
 *      totalRoyalty for an approved percentage rule.
 *   2. The persisted calculation_rule_results row carries the engine-stamped
 *      phase ('gross_calc') and the per-rule fee aggregates produced by the
 *      universal evaluator.
 *   3. The Verify-then-Pay approval gate is enforced — only contract_rules
 *      with approval_status='approved' contribute to the calculation.
 *
 * Run with the dev workflow up:
 *   npx tsx tests/calculation-engine.e2e.test.ts
 */

import assert from 'node:assert/strict';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { storage } from '../server/storage';
import { hashPassword } from '../server/auth';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Tiny harness
// ---------------------------------------------------------------------------

type TestFn = () => Promise<void>;
const cases: Array<{ name: string; fn: TestFn }> = [];
function test(name: string, fn: TestFn) {
  cases.push({ name, fn });
}

async function run() {
  let passed = 0;
  let failed = 0;
  for (const c of cases) {
    process.stdout.write(`• ${c.name} … `);
    try {
      await c.fn();
      passed += 1;
      console.log('OK');
    } catch (err: any) {
      failed += 1;
      console.log('FAIL');
      console.error('  ', err?.stack || err?.message || err);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  return failed;
}

// ---------------------------------------------------------------------------
// Cookie-aware HTTP helper
// ---------------------------------------------------------------------------

class HttpClient {
  private cookie: string | null = null;

  setCookie(setCookieHeader: string | null) {
    if (!setCookieHeader) return;
    const parts = setCookieHeader.split(/,(?=[^ ]*?=)/g);
    const found = parts
      .map((p) => p.split(';')[0].trim())
      .find((p) => p.startsWith('connect.sid='));
    if (found) this.cookie = found;
  }

  async request(
    method: string,
    path: string,
    init: { body?: unknown; expectJson?: boolean } = {},
  ): Promise<{ status: number; headers: Headers; body: any; raw: string }> {
    const headers: Record<string, string> = {};
    if (this.cookie) headers['cookie'] = this.cookie;
    const opts: RequestInit = { method, headers };
    if (init.body !== undefined) {
      headers['content-type'] = 'application/json';
      opts.body = JSON.stringify(init.body);
    }
    const res = await fetch(`${BASE_URL}${path}`, opts);
    this.setCookie(res.headers.get('set-cookie'));
    const raw = await res.text();
    let body: any = raw;
    if (init.expectJson !== false) {
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        // leave as raw text
      }
    }
    return { status: res.status, headers: res.headers, body, raw };
  }
}

// ---------------------------------------------------------------------------
// DB fixtures
// ---------------------------------------------------------------------------

const RUN_TAG = `calc57-${Date.now().toString(36)}`;

interface Fixtures {
  companyId: string;
  member: { id: string; username: string; password: string };
  contractId: string;
  approvedRuleId: string;
  pendingRuleId: string;
  saleIds: string[];
}

async function createFixtures(): Promise<Fixtures> {
  const admin = await storage.getUserByUsername('admin');
  assert.ok(admin, 'master admin user must exist for tests to bootstrap');
  const adminId = admin!.id;

  const [{ id: companyId }] = (await db.execute<{ id: string }>(sql`
    INSERT INTO companies (company_name, status, created_by, last_updated_by)
    VALUES (${`E2E Calc Co ${RUN_TAG}`}, 'A', ${adminId}, ${adminId})
    RETURNING company_id AS id
  `)).rows as Array<{ id: string }>;

  const memberPwd = `pw-${RUN_TAG}`;
  const member = await storage.createUser({
    username: `calc_member_${RUN_TAG}`,
    password: await hashPassword(memberPwd),
    email: `calc_member_${RUN_TAG}@test.local`,
    firstName: 'Calc',
    lastName: 'Member',
    role: 'editor',
    isActive: true,
  });
  const memberRole = await storage.createUserOrganizationRole({
    userId: member.id,
    companyId,
    role: 'editor',
    status: 'A',
    createdBy: adminId,
    lastUpdatedBy: adminId,
  } as any);
  await storage.setUserActiveContext(member.id, memberRole.id);

  const contractId = `e2e-calc-${RUN_TAG}`;
  await db.execute(sql`
    INSERT INTO contracts (id, file_name, original_name, file_size, file_type, file_path,
      display_name, contract_type, status, source, organization_name, counterparty_name,
      flow_type_code, company_id, uploaded_by, created_at, updated_at)
    VALUES (
      ${contractId}, ${'fixture.txt'}, ${'fixture.txt'}, 0, 'text/plain', ${'/tmp/fixture.txt'},
      ${`E2E Calc Engine ${RUN_TAG}`}, 'RLA', 'analyzed', 'manual', ${'E2E Calc Co'}, ${'Counterparty'},
      'RLA', ${companyId}, ${member.id}, NOW(), NOW()
    )
  `);

  // Approved 5% percentage rule with a universal-evaluator formula definition.
  const approvedRuleRow = (await db.execute<{ id: string }>(sql`
    INSERT INTO contract_rules (
      contract_id, rule_type, rule_name, description,
      formula_definition, base_rate, calculation_formula,
      product_categories, territories,
      priority, is_active, confidence,
      review_status, source_section, source_text, extraction_order,
      calc_phase, trigger_source, aggregation_scope,
      approval_status
    ) VALUES (
      ${contractId}, 'percentage', ${`Approved 5% Royalty ${RUN_TAG}`},
      'Approved royalty rule for calc engine e2e test',
      ${JSON.stringify({ kind: 'flat', rate: 0.05 })}::jsonb, 5, '5% of net revenue',
      ARRAY['Books']::text[], ARRAY['NA']::text[],
      10, true, 0.99,
      'verified', 'Section 1', '5% royalty', 1,
      'gross_calc', 'sale', 'per_sale',
      'approved'
    )
    RETURNING id
  `)).rows[0];

  // Pending (non-approved) rule that must NOT contribute to fees.
  const pendingRuleRow = (await db.execute<{ id: string }>(sql`
    INSERT INTO contract_rules (
      contract_id, rule_type, rule_name, description,
      formula_definition, base_rate, calculation_formula,
      product_categories, territories,
      priority, is_active, confidence,
      review_status, source_section, source_text, extraction_order,
      calc_phase, trigger_source, aggregation_scope,
      approval_status
    ) VALUES (
      ${contractId}, 'percentage', ${`Pending 50% Royalty ${RUN_TAG}`},
      'Pending rule that must be excluded by Verify-then-Pay',
      ${JSON.stringify({ kind: 'flat', rate: 0.5 })}::jsonb, 50, '50% of net revenue',
      ARRAY['Books']::text[], ARRAY['NA']::text[],
      20, true, 0.5,
      'pending', 'Section 2', '50% royalty (pending)', 2,
      'gross_calc', 'sale', 'per_sale',
      'pending'
    )
    RETURNING id
  `)).rows[0];

  // Two in-period sales totaling $8,000 → expected royalty at 5% = $400.
  const sale1 = (await db.execute<{ id: string }>(sql`
    INSERT INTO sales_data (
      transaction_date, transaction_id, product_name, category, territory,
      gross_amount, net_amount, quantity, currency, company_id, matched_contract_id
    ) VALUES (
      ${'2026-04-15'}::timestamp, ${`txn-1-${RUN_TAG}`}, 'Test Book A', 'Books', 'NA',
      5000, 5000, 10, 'USD', ${companyId}, ${contractId}
    )
    RETURNING id
  `)).rows[0];

  const sale2 = (await db.execute<{ id: string }>(sql`
    INSERT INTO sales_data (
      transaction_date, transaction_id, product_name, category, territory,
      gross_amount, net_amount, quantity, currency, company_id, matched_contract_id
    ) VALUES (
      ${'2026-04-20'}::timestamp, ${`txn-2-${RUN_TAG}`}, 'Test Book B', 'Books', 'NA',
      3000, 3000, 6, 'USD', ${companyId}, ${contractId}
    )
    RETURNING id
  `)).rows[0];

  // Junction rows so getSalesForContractViaJunction picks them up directly.
  for (const s of [sale1, sale2]) {
    await db.execute(sql`
      INSERT INTO sale_contract_matches (sale_id, contract_id, rule_id, match_type, specificity_score, match_reason, is_primary)
      VALUES (${s.id}, ${contractId}, ${approvedRuleRow.id}, 'category', 1000, 'fixture seed', true)
    `);
  }

  return {
    companyId,
    member: { id: member.id, username: member.username, password: memberPwd },
    contractId,
    approvedRuleId: approvedRuleRow.id,
    pendingRuleId: pendingRuleRow.id,
    saleIds: [sale1.id, sale2.id],
  };
}

async function destroyFixtures(fx: Fixtures) {
  // Engine side-effects we created or that calculate-fees auto-created.
  // Ordering: child rows (lines / trail / trace) first, then parents,
  // then contract-scoped rows, then auth/identity, then companies.
  const contractId = fx.contractId;
  const companyId = fx.companyId;

  // Settlements + their line items.
  await db.execute(sql`
    DELETE FROM settlement_line_items WHERE settlement_id IN (
      SELECT id FROM settlements WHERE contract_id = ${contractId}
    )
  `);
  await db.execute(sql`DELETE FROM settlements WHERE contract_id = ${contractId}`);

  // Journal entries + their lines.
  await db.execute(sql`
    DELETE FROM journal_entry_lines WHERE je_id IN (
      SELECT je_id FROM journal_entries WHERE contract_id = ${contractId}
    )
  `);
  await db.execute(sql`DELETE FROM journal_entries WHERE contract_id = ${contractId}`);

  // Accruals + audit + trace (trace/audit reference accrual_id, not id).
  await db.execute(sql`
    DELETE FROM accrual_audit_trail WHERE accrual_id IN (
      SELECT accrual_id FROM accruals WHERE contract_id = ${contractId}
    )
  `);
  await db.execute(sql`
    DELETE FROM accrual_calculation_trace WHERE accrual_id IN (
      SELECT accrual_id FROM accruals WHERE contract_id = ${contractId}
    )
  `);
  await db.execute(sql`DELETE FROM accruals WHERE contract_id = ${contractId}`);

  // Period close auto-created by the calc-fees side-effect path.
  await db.execute(sql`DELETE FROM contract_close_status WHERE contract_id = ${contractId}`);
  await db.execute(sql`
    DELETE FROM period_close_checklist WHERE period_id IN (
      SELECT id FROM period_close WHERE company_id = ${companyId}
    )
  `);
  await db.execute(sql`
    DELETE FROM period_close_audit_trail WHERE period_id IN (
      SELECT id FROM period_close WHERE company_id = ${companyId}
    )
  `);
  await db.execute(sql`
    DELETE FROM period_close_blockers WHERE period_id IN (
      SELECT id FROM period_close WHERE company_id = ${companyId}
    )
  `);
  await db.execute(sql`
    DELETE FROM period_variance WHERE period_id IN (
      SELECT id FROM period_close WHERE company_id = ${companyId}
    )
  `);
  await db.execute(sql`DELETE FROM period_close WHERE company_id = ${companyId}`);

  // Recoupment ledger entries reference contract_calculations.id, so drop
  // them before contract_calculations (they'd block by FK otherwise).
  await db.execute(sql`
    DELETE FROM recoupment_ledger_entries WHERE calculation_id IN (
      SELECT id FROM contract_calculations WHERE contract_id = ${contractId}
    )
  `);
  await db.execute(sql`DELETE FROM recoupment_balances WHERE contract_id = ${contractId}`);

  // Five-artifact traceability chain: calculation_audit_items cascade from
  // calculation_runs, but obligations / rule_decision_logs do not.
  await db.execute(sql`
    DELETE FROM calculation_audit_items WHERE run_id IN (
      SELECT id FROM calculation_runs WHERE contract_id = ${contractId}
    )
  `);
  await db.execute(sql`DELETE FROM calculation_runs WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM rule_decision_logs WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM obligations WHERE contract_id = ${contractId}`);

  // calculation_rule_results cascades from contract_calculations.
  await db.execute(sql`DELETE FROM contract_calculations WHERE contract_id = ${contractId}`);

  // Sales junction + sales rows.
  await db.execute(sql`DELETE FROM sale_contract_matches WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM sales_data WHERE company_id = ${companyId}`);

  // Contract rules + clauses + analysis + the contract itself.
  await db.execute(sql`DELETE FROM contract_rules WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contract_clauses WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contract_analysis WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM subtype_instances WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contracts WHERE id = ${contractId}`);

  // Identity / tenancy.
  // Endpoints touched by this test write audit_trail rows referencing user_id.
  await db.execute(sql`DELETE FROM audit_trail WHERE user_id = ${fx.member.id}`);
  await db.execute(sql`DELETE FROM user_active_context WHERE user_id = ${fx.member.id}`);
  await db.execute(sql`DELETE FROM user_organization_roles WHERE user_id = ${fx.member.id}`);
  await db.execute(sql`DELETE FROM users WHERE id = ${fx.member.id}`);
  await db.execute(sql`DELETE FROM companies WHERE company_id = ${companyId}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let fx: Fixtures;
let memberClient: HttpClient;

test('login the non-admin member', async () => {
  memberClient = new HttpClient();
  const res = await memberClient.request('POST', '/api/login', {
    body: { username: fx.member.username, password: fx.member.password },
  });
  assert.equal(res.status, 200, `login should succeed (got ${res.status} body=${JSON.stringify(res.body)})`);
  const me = await memberClient.request('GET', '/api/user');
  assert.equal(me.status, 200);
  assert.equal(me.body?.activeContext?.companyId, fx.companyId);
});

test('POST /api/contracts/:id/calculate-fees totals the approved rule and ignores the pending one', async () => {
  const res = await memberClient.request('POST', `/api/contracts/${fx.contractId}/calculate-fees`, {
    body: {
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      name: `E2E calc ${RUN_TAG}`,
      evaluationMode: 'universal',
    },
  });
  assert.equal(res.status, 200, `calculate-fees should 200 (got ${res.status} body=${JSON.stringify(res.body)})`);
  assert.equal(res.body?.success, true, 'response should report success');

  const calc = res.body?.calculation;
  assert.ok(calc?.id, 'response.calculation must include the persisted calculation id');

  // 5% × ($5,000 + $3,000) = $400 — and the pending rule (50%) must NOT fire.
  // If the Verify-then-Pay gate were broken, we'd see $400 + 50%*$8,000 = $4,400.
  const total = parseFloat(String(calc.totalRoyalty ?? '0'));
  assert.equal(total, 400, `expected total royalty $400, got $${total}`);

  // Breakdown should produce one row per in-period sale, all attributed to
  // the approved rule.
  assert.ok(Array.isArray(calc.breakdown), 'breakdown should be an array');
  assert.equal(calc.breakdown.length, 2, `expected 2 breakdown rows, got ${calc.breakdown.length}`);
  for (const b of calc.breakdown) {
    assert.ok(b.ruleApplied?.includes('Approved 5% Royalty'),
      `every breakdown row should be attributed to the approved rule, got "${b.ruleApplied}"`);
  }
});

test('persisted calculation_rule_results carry phase=gross_calc and aggregate the approved rule fee', async () => {
  // The most recent calculation for this contract is the one we just ran.
  const calcRow = (await db.execute<{ id: string; total_royalty: string }>(sql`
    SELECT id, total_royalty FROM contract_calculations
    WHERE contract_id = ${fx.contractId}
    ORDER BY created_at DESC LIMIT 1
  `)).rows[0];
  assert.ok(calcRow?.id, 'calc-fees must persist a contract_calculations row');
  assert.equal(parseFloat(calcRow.total_royalty), 400, 'persisted total_royalty must equal the response total');

  const ruleResults = (await db.execute<{
    rule_id: string | null;
    phase: string;
    total_fee: string;
    transaction_count: number;
  }>(sql`
    SELECT rule_id, phase, total_fee, transaction_count
    FROM calculation_rule_results WHERE calculation_id = ${calcRow.id}
  `)).rows;

  assert.ok(ruleResults.length >= 1, 'at least one calculation_rule_results row should be persisted');

  // Find the row keyed to the approved rule. The pending rule MUST NOT
  // appear here at all (Verify-then-Pay).
  const approvedRow = ruleResults.find(r => r.rule_id === fx.approvedRuleId);
  assert.ok(approvedRow, 'rule_results must include the approved rule');
  assert.equal(approvedRow!.phase, 'gross_calc',
    `approved rule must be stamped with phase=gross_calc (got ${approvedRow!.phase})`);
  assert.equal(parseFloat(approvedRow!.total_fee), 400,
    `approved rule total_fee must equal 400 (got ${approvedRow!.total_fee})`);
  assert.equal(approvedRow!.transaction_count, 2,
    `approved rule transaction_count must equal 2 sales (got ${approvedRow!.transaction_count})`);

  const pendingRow = ruleResults.find(r => r.rule_id === fx.pendingRuleId);
  assert.equal(pendingRow, undefined,
    'pending rule must NOT have a calculation_rule_results row (Verify-then-Pay)');
});

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

(async () => {
  try {
    const ping = await fetch(`${BASE_URL}/api/user`);
    if (![200, 401].includes(ping.status)) {
      console.error(`Server at ${BASE_URL} returned unexpected status ${ping.status} — is the dev workflow up?`);
      process.exit(2);
    }
  } catch (err: any) {
    console.error(`Cannot reach server at ${BASE_URL}: ${err?.message}`);
    process.exit(2);
  }

  fx = await createFixtures();
  let failures = 0;
  try {
    failures = await run();
  } finally {
    try { await destroyFixtures(fx); } catch (e: any) { console.error('Cleanup error:', e?.message || e); }
  }
  process.exit(failures > 0 ? 1 : 0);
})();
