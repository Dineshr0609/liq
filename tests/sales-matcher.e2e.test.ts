/**
 * End-to-end tests for the sales-to-contract matcher (Task #57).
 *
 * Covers, against the running dev server (default http://localhost:5000):
 *   1. POST /api/sales/auto-match links unmatched sales rows to a contract
 *      whose rule has a matching product_categories / territories signature
 *      (happy-path category match), and skips sales that don't match any
 *      rule (negative case in the same fixture so the counts are exact).
 *   2. The matcher writes both the matched_contract_id pointer on
 *      sales_data and a sale_contract_matches junction row per match
 *      (with is_primary=true on the best contract) — this is what the rest
 *      of the calc engine + period-close pipeline relies on.
 *
 * Run with the dev workflow up:
 *   npx tsx tests/sales-matcher.e2e.test.ts
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

const RUN_TAG = `match57-${Date.now().toString(36)}`;

interface Fixtures {
  companyId: string;
  member: { id: string; username: string; password: string };
  contractId: string;
  contractNumber: string;
  ruleId: string;
  bookSaleIds: string[];
  toySaleId: string;
}

async function createFixtures(): Promise<Fixtures> {
  const admin = await storage.getUserByUsername('admin');
  assert.ok(admin, 'master admin user must exist for tests to bootstrap');
  const adminId = admin!.id;

  const [{ id: companyId }] = (await db.execute<{ id: string }>(sql`
    INSERT INTO companies (company_name, status, created_by, last_updated_by)
    VALUES (${`E2E Matcher Co ${RUN_TAG}`}, 'A', ${adminId}, ${adminId})
    RETURNING company_id AS id
  `)).rows as Array<{ id: string }>;

  const memberPwd = `pw-${RUN_TAG}`;
  const member = await storage.createUser({
    username: `match_member_${RUN_TAG}`,
    password: await hashPassword(memberPwd),
    email: `match_member_${RUN_TAG}@test.local`,
    firstName: 'Match',
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

  // Contract must be status='analyzed' (or 'active') for the matcher to
  // consider it. contract_number is auto-unique so we set an explicit
  // tag-suffixed value to make summary[contractNumber] easy to assert on.
  // The matcher's bulk UPDATE casts contract_id ::uuid (see
  // salesContractMatcher.ts), so the id MUST be a valid UUID.
  const contractId = (await import('node:crypto')).randomUUID();
  const contractNumber = `MATCH-${RUN_TAG}`;
  await db.execute(sql`
    INSERT INTO contracts (id, contract_number, file_name, original_name, file_size, file_type, file_path,
      display_name, contract_type, status, source, organization_name, counterparty_name,
      flow_type_code, company_id, uploaded_by, created_at, updated_at)
    VALUES (
      ${contractId}, ${contractNumber}, ${'fixture.txt'}, ${'fixture.txt'}, 0, 'text/plain', ${'/tmp/fixture.txt'},
      ${`E2E Matcher ${RUN_TAG}`}, 'RLA', 'analyzed', 'manual', ${'E2E Matcher Co'}, ${'Counterparty'},
      'RLA', ${companyId}, ${member.id}, NOW(), NOW()
    )
  `);

  // Rule with a category whitelist — Books only, NA territory.
  // review_status='verified' so the matcher's rule SQL accepts it.
  const ruleRow = (await db.execute<{ id: string }>(sql`
    INSERT INTO contract_rules (
      contract_id, rule_type, rule_name, description,
      formula_definition, base_rate,
      product_categories, territories,
      priority, is_active, confidence,
      review_status, source_section, source_text, extraction_order,
      calc_phase, trigger_source, aggregation_scope,
      approval_status
    ) VALUES (
      ${contractId}, 'percentage', ${`Books-only ${RUN_TAG}`},
      'Books / NA matcher rule for e2e test',
      ${JSON.stringify({ kind: 'flat', rate: 0.05 })}::jsonb, 5,
      ARRAY['Books']::text[], ARRAY['NA']::text[],
      10, true, 0.99,
      'verified', 'Section 1', 'Books 5%', 1,
      'gross_calc', 'sale', 'per_sale',
      'approved'
    )
    RETURNING id
  `)).rows[0];

  // Two unmatched Books sales (matched_contract_id IS NULL) and one
  // unmatched Toys sale that should be left unmatched.
  const insertSale = async (txnId: string, category: string, productName: string) =>
    (await db.execute<{ id: string }>(sql`
      INSERT INTO sales_data (
        transaction_date, transaction_id, product_name, category, territory,
        gross_amount, net_amount, quantity, currency, company_id
      ) VALUES (
        ${'2026-04-15'}::timestamp, ${txnId}, ${productName}, ${category}, 'NA',
        1000, 1000, 1, 'USD', ${companyId}
      )
      RETURNING id
    `)).rows[0].id;

  const book1 = await insertSale(`book1-${RUN_TAG}`, 'Books', 'Test Book One');
  const book2 = await insertSale(`book2-${RUN_TAG}`, 'Books', 'Test Book Two');
  const toy = await insertSale(`toy-${RUN_TAG}`, 'Toys', 'Test Toy');

  return {
    companyId,
    member: { id: member.id, username: member.username, password: memberPwd },
    contractId,
    contractNumber,
    ruleId: ruleRow.id,
    bookSaleIds: [book1, book2],
    toySaleId: toy,
  };
}

async function destroyFixtures(fx: Fixtures) {
  const contractId = fx.contractId;
  const companyId = fx.companyId;

  await db.execute(sql`DELETE FROM sale_contract_matches WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM sales_data WHERE company_id = ${companyId}`);

  await db.execute(sql`DELETE FROM contract_rules WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contract_clauses WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contract_analysis WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM subtype_instances WHERE contract_id = ${contractId}`);
  await db.execute(sql`DELETE FROM contracts WHERE id = ${contractId}`);

  // The auto-match endpoint writes audit_trail rows referencing user_id.
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

test('POST /api/sales/auto-match links Books sales and leaves Toys sale unmatched', async () => {
  const res = await memberClient.request('POST', '/api/sales/auto-match', {
    body: { companyId: fx.companyId },
  });
  assert.equal(res.status, 200, `auto-match should 200 (got ${res.status} body=${JSON.stringify(res.body)})`);
  assert.equal(res.body?.success, true, 'response.success should be true');

  // Counts: 2 Books sales matched, 1 Toys sale unmatched. The matcher only
  // considers sales for the company in the request body, so other concurrent
  // company data cannot affect this assertion.
  assert.equal(res.body.matched, 2,
    `expected 2 matched sales, got ${res.body.matched} (summary=${JSON.stringify(res.body.summary)})`);
  assert.equal(res.body.unmatched, 1,
    `expected 1 unmatched sale, got ${res.body.unmatched}`);

  // Per-contract summary keyed by contract_number.
  assert.equal(res.body.summary?.[fx.contractNumber], 2,
    `summary[${fx.contractNumber}] should be 2 (got ${JSON.stringify(res.body.summary)})`);
});

test('matcher writes matched_contract_id on Books sales and skips the Toys sale', async () => {
  const rows = (await db.execute<{ id: string; matched_contract_id: string | null; category: string }>(sql`
    SELECT id, matched_contract_id, category FROM sales_data WHERE company_id = ${fx.companyId}
    ORDER BY transaction_id
  `)).rows;
  assert.equal(rows.length, 3, 'three sales should still exist');

  for (const r of rows) {
    if (r.category === 'Books') {
      assert.equal(r.matched_contract_id, fx.contractId,
        `Books sale ${r.id} should be matched to contract ${fx.contractId}, got ${r.matched_contract_id}`);
    } else {
      assert.equal(r.matched_contract_id, null,
        `non-Books sale ${r.id} (${r.category}) should remain unmatched`);
    }
  }
});

test('sale_contract_matches junction has one is_primary row per matched sale', async () => {
  const junction = (await db.execute<{
    sale_id: string; contract_id: string; rule_id: string | null; is_primary: boolean;
  }>(sql`
    SELECT sale_id, contract_id, rule_id, is_primary
    FROM sale_contract_matches WHERE contract_id = ${fx.contractId}
  `)).rows;

  assert.equal(junction.length, 2, `expected 2 junction rows, got ${junction.length}`);
  const matchedSaleIds = junction.map(j => j.sale_id).sort();
  assert.deepEqual(matchedSaleIds, [...fx.bookSaleIds].sort(),
    'junction must reference the two Books sales');

  for (const j of junction) {
    assert.equal(j.contract_id, fx.contractId, 'junction contract_id must point at the test contract');
    assert.equal(j.rule_id, fx.ruleId, 'junction rule_id must point at the matched rule');
    assert.equal(j.is_primary, true,
      'each match must be marked primary (only one contract in this fixture, so it is the best by definition)');
  }
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
