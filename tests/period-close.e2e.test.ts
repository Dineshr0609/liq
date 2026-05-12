/**
 * End-to-end tests for the period-close pipeline (Task #57).
 *
 * Covers, against the running dev server (default http://localhost:5000):
 *   1. POST /api/period-close creates a period_close row.
 *   2. GET /api/period-close/:id returns the period plus its checklist /
 *      blockers / audit-trail bundles.
 *   3. POST /api/period-close/:id/approve flips the row to status='approved'
 *      and writes an audit-trail entry.
 *   4. GET /api/period-close/:id/phase-summary aggregates persisted
 *      calculation_rule_results.phase rows scoped to the period's company
 *      and date window — verifying the Verify-then-Pay-aware waterfall the
 *      finance dashboard relies on.
 *   5. DELETE /api/period-close/:id cascades child rows.
 *
 * Run with the dev workflow up:
 *   npx tsx tests/period-close.e2e.test.ts
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

const RUN_TAG = `pclose57-${Date.now().toString(36)}`;

interface Fixtures {
  companyId: string;
  member: { id: string; username: string; password: string };
  contractId: string;
  ruleId: string;
  calculationId: string;
  ruleResultId: string;
}

async function createFixtures(): Promise<Fixtures> {
  const admin = await storage.getUserByUsername('admin');
  assert.ok(admin, 'master admin user must exist for tests to bootstrap');
  const adminId = admin!.id;

  const [{ id: companyId }] = (await db.execute<{ id: string }>(sql`
    INSERT INTO companies (company_name, status, created_by, last_updated_by)
    VALUES (${`E2E PeriodClose Co ${RUN_TAG}`}, 'A', ${adminId}, ${adminId})
    RETURNING company_id AS id
  `)).rows as Array<{ id: string }>;

  const memberPwd = `pw-${RUN_TAG}`;
  const member = await storage.createUser({
    username: `pclose_member_${RUN_TAG}`,
    password: await hashPassword(memberPwd),
    email: `pclose_member_${RUN_TAG}@test.local`,
    firstName: 'PeriodClose',
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

  // Seed a contract + an in-period contract_calculations row + a
  // calculation_rule_results row so phase-summary has something to aggregate.
  const contractId = `e2e-pclose-${RUN_TAG}`;
  await db.execute(sql`
    INSERT INTO contracts (id, file_name, original_name, file_size, file_type, file_path,
      display_name, contract_type, status, source, organization_name, counterparty_name,
      flow_type_code, company_id, uploaded_by, created_at, updated_at)
    VALUES (
      ${contractId}, ${'fixture.txt'}, ${'fixture.txt'}, 0, 'text/plain', ${'/tmp/fixture.txt'},
      ${`E2E PeriodClose ${RUN_TAG}`}, 'RLA', 'analyzed', 'manual', ${'E2E PeriodClose Co'}, ${'Counterparty'},
      'RLA', ${companyId}, ${member.id}, NOW(), NOW()
    )
  `);

  const ruleRow = (await db.execute<{ id: string }>(sql`
    INSERT INTO contract_rules (
      contract_id, rule_type, rule_name,
      formula_definition, base_rate,
      product_categories, territories,
      priority, is_active, confidence,
      review_status, extraction_order,
      calc_phase, trigger_source, aggregation_scope,
      approval_status
    ) VALUES (
      ${contractId}, 'percentage', ${`Approved 5% ${RUN_TAG}`},
      ${JSON.stringify({ kind: 'flat', rate: 0.05 })}::jsonb, 5,
      ARRAY['Books']::text[], ARRAY['NA']::text[],
      10, true, 0.99,
      'verified', 1,
      'gross_calc', 'sale', 'per_sale',
      'approved'
    )
    RETURNING id
  `)).rows[0];

  // Calculation row pinned to April 2026 so the phase-summary date filter
  // (derived from periodLabel='Apr 2026') will pick it up.
  const calcRow = (await db.execute<{ id: string }>(sql`
    INSERT INTO contract_calculations (
      contract_id, name, period_start, period_end, status,
      total_sales_amount, total_royalty, currency, sales_count, company_id
    ) VALUES (
      ${contractId}, ${`E2E PeriodClose Calc ${RUN_TAG}`},
      ${'2026-04-01'}::timestamp, ${'2026-04-30'}::timestamp, 'approved',
      8000, 400, 'USD', 2, ${companyId}
    )
    RETURNING id
  `)).rows[0];

  const ruleResultRow = (await db.execute<{ id: string }>(sql`
    INSERT INTO calculation_rule_results (
      calculation_id, rule_id, rule_name, rule_type, rule_snapshot,
      total_fee, total_sales_amount, transaction_count, phase
    ) VALUES (
      ${calcRow.id}, ${ruleRow.id}, ${`Approved 5% ${RUN_TAG}`}, 'percentage',
      ${JSON.stringify({ ruleId: ruleRow.id, ruleType: 'percentage', formulaDefinition: { kind: 'flat', rate: 0.05 } })}::jsonb,
      400, 8000, 2, 'gross_calc'
    )
    RETURNING id
  `)).rows[0];

  return {
    companyId,
    member: { id: member.id, username: member.username, password: memberPwd },
    contractId,
    ruleId: ruleRow.id,
    calculationId: calcRow.id,
    ruleResultId: ruleResultRow.id,
  };
}

async function destroyFixtures(fx: Fixtures, leftoverPeriodIds: string[]) {
  const contractId = fx.contractId;
  const companyId = fx.companyId;

  // Drop any period_close rows the tests left behind. The DELETE route
  // already cascades child tables, but we go through the DB so cleanup is
  // resilient to a test that aborts before reaching the DELETE step.
  for (const pid of leftoverPeriodIds) {
    await db.execute(sql`DELETE FROM period_close_checklist WHERE period_id = ${pid}`);
    await db.execute(sql`DELETE FROM period_close_audit_trail WHERE period_id = ${pid}`);
    await db.execute(sql`DELETE FROM period_close_blockers WHERE period_id = ${pid}`);
    await db.execute(sql`DELETE FROM period_variance WHERE period_id = ${pid}`);
    await db.execute(sql`DELETE FROM contract_close_status WHERE period_id = ${pid}`);
    await db.execute(sql`DELETE FROM period_close WHERE id = ${pid}`);
  }
  // Belt-and-suspenders: drop any remaining periods scoped to the test
  // company in case more were created than we tracked.
  await db.execute(sql`
    DELETE FROM contract_close_status WHERE period_id IN (
      SELECT id FROM period_close WHERE company_id = ${companyId}
    )
  `);
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

  // calculation_rule_results cascades from contract_calculations.
  await db.execute(sql`DELETE FROM contract_calculations WHERE contract_id = ${contractId}`);

  await db.execute(sql`DELETE FROM contract_rules WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contract_clauses WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contract_analysis WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM subtype_instances WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contracts WHERE id = ${contractId}`);

  // Endpoints touched by this test may write audit_trail rows referencing user_id.
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
let createdPeriodId = '';
const periodIdsToCleanup: string[] = [];

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

test('POST /api/period-close creates an open period scoped to the company', async () => {
  const res = await memberClient.request('POST', '/api/period-close', {
    body: { periodLabel: 'Apr 2026', status: 'open', companyId: fx.companyId },
  });
  assert.equal(res.status, 200, `create should 200 (got ${res.status} body=${JSON.stringify(res.body)})`);
  assert.ok(res.body?.id, 'response must include the new id');
  assert.equal(res.body.periodLabel, 'Apr 2026');
  assert.equal(res.body.status, 'open');
  assert.equal(res.body.companyId, fx.companyId,
    'period.companyId must equal the requested companyId so phase-summary auth allows it');
  createdPeriodId = res.body.id;
  periodIdsToCleanup.push(createdPeriodId);
});

test('GET /api/period-close/:id returns the period plus child bundles', async () => {
  const res = await memberClient.request('GET', `/api/period-close/${createdPeriodId}`);
  assert.equal(res.status, 200);
  assert.equal(res.body?.id, createdPeriodId);
  assert.ok(Array.isArray(res.body?.checklist), 'checklist must be an array');
  assert.ok(Array.isArray(res.body?.blockers), 'blockers must be an array');
  assert.ok(Array.isArray(res.body?.auditTrail), 'auditTrail must be an array');
  assert.equal(res.body.status, 'open', 'should still be open before approval');
});

test('GET /api/period-close/:id/phase-summary aggregates approved calc_rule_results by phase', async () => {
  const res = await memberClient.request('GET', `/api/period-close/${createdPeriodId}/phase-summary`);
  assert.equal(res.status, 200, `phase-summary should 200 for in-tenant period (got ${res.status} body=${JSON.stringify(res.body)})`);
  assert.equal(res.body?.periodId, createdPeriodId);
  assert.ok(Array.isArray(res.body?.summary), 'summary must be an array');

  // The seeded calculation_rule_results row is phase=gross_calc / total_fee=400.
  const gross = res.body.summary.find((s: any) => s.phase === 'gross_calc');
  assert.ok(gross, `summary must include a gross_calc phase row (got ${JSON.stringify(res.body.summary)})`);
  assert.equal(gross.totalFee, 400, `gross_calc totalFee must equal 400 (got ${gross.totalFee})`);
  assert.equal(gross.transactionCount, 2, `gross_calc transactionCount must equal 2 (got ${gross.transactionCount})`);
  assert.ok(gross.ruleCount >= 1, `gross_calc ruleCount must be >= 1 (got ${gross.ruleCount})`);

  // Net payable equals the sum of all phase totalFees — for our gross_calc-
  // only fixture that's exactly 400.
  assert.equal(res.body.netPayable, 400,
    `netPayable must equal 400 for the gross_calc-only fixture (got ${res.body.netPayable})`);
});

test('POST /api/period-close/:id/approve flips status to approved + writes audit row', async () => {
  const res = await memberClient.request('POST', `/api/period-close/${createdPeriodId}/approve`, {
    body: { closedBy: `approver_${RUN_TAG}` },
  });
  assert.equal(res.status, 200, `approve should 200 (got ${res.status} body=${JSON.stringify(res.body)})`);
  assert.equal(res.body?.status, 'approved');
  assert.equal(res.body.closedBy, `approver_${RUN_TAG}`);
  assert.ok(res.body.closeDate, 'closeDate must be set on approval');

  // Re-fetch and confirm the audit-trail row was written.
  const after = await memberClient.request('GET', `/api/period-close/${createdPeriodId}`);
  assert.equal(after.status, 200);
  assert.equal(after.body?.status, 'approved');
  const approvalEvents = (after.body?.auditTrail || []).filter((a: any) => a.eventType === 'approval');
  assert.ok(approvalEvents.length >= 1, 'audit-trail must contain an approval event');
  assert.equal(approvalEvents[0].userName, `approver_${RUN_TAG}`,
    'audit-trail userName must be the closedBy from the request');
});

test('DELETE /api/period-close/:id removes the period and its audit children', async () => {
  const res = await memberClient.request('DELETE', `/api/period-close/${createdPeriodId}`);
  assert.equal(res.status, 200, `delete should 200 (got ${res.status} body=${JSON.stringify(res.body)})`);
  assert.equal(res.body?.success, true);

  const gone = await memberClient.request('GET', `/api/period-close/${createdPeriodId}`);
  assert.equal(gone.status, 404, 'period should be gone after delete');

  const remainingAudit = (await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM period_close_audit_trail WHERE period_id = ${createdPeriodId}
  `)).rows[0].n;
  assert.equal(remainingAudit, 0, 'period_close_audit_trail rows must be cascaded by DELETE route');
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
    try { await destroyFixtures(fx, periodIdsToCleanup); } catch (e: any) { console.error('Cleanup error:', e?.message || e); }
  }
  process.exit(failures > 0 ? 1 : 0);
})();
