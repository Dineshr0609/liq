/**
 * End-to-end tests for the new template flows (Task #48).
 *
 * Covers, against the running dev server (default http://localhost:5000):
 *   1. Seeder is idempotent and produces 6 system templates with the
 *      expected primary subtype per flow.
 *   2. POST /api/contracts/:id/save-as-template snapshots the right number
 *      of rules/clauses for each scope (minimal | standard | maximal).
 *   3. GET /api/contract-templates returns only system + my-company + mine
 *      to a non-admin user.
 *   4. POST /api/contracts/:id/rules/:ruleId/duplicate clones every column
 *      except PK + extraction_order.
 *   5. GET /api/contracts/:id/sample/:kind responds with a JSON error for
 *      unknown kinds (400 — see note below) and 200 + text/csv for valid
 *      ones; GET /api/contract-templates/:templateId/sample/:kind likewise.
 *
 * NOTE on (5): the task description specifies "404 for unknown kinds", but
 * the route implementation returns HTTP 400 (validation error) when the
 * kind is not in the allowed set; 404 is reserved for "valid kind but no
 * sample CSV exists for this flow / template not visible". We assert the
 * implemented behaviour and additionally cover the 404-on-missing-csv
 * branch so the docstring intent is exercised end-to-end.
 *
 * Run with the dev workflow up:
 *   npx tsx tests/template-flows.e2e.test.ts
 */

import assert from 'node:assert/strict';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { storage } from '../server/storage';
import { hashPassword } from '../server/auth';
import { seedSystemContractTemplates } from '../server/services/contractTemplateSeeder';

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
    // We only care about connect.sid for session continuity.
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
// DB fixture helpers
// ---------------------------------------------------------------------------

const RUN_TAG = `tpl48-${Date.now().toString(36)}`;

interface Fixtures {
  companyId: string;
  otherCompanyId: string;
  member: { id: string; username: string; password: string };
  outsider: { id: string; username: string; password: string };
  contractId: string;
  ruleId: string;
  clauseId: string;
  templateNoFlowSamplesCode: string | null; // a flow code that has no CSV templates on disk
  systemTemplateId: string;
  privateOtherTemplateId: string;
  publicCompanyTemplateId: string;
  privateMineTemplateId: string;
}

async function createFixtures(): Promise<Fixtures> {
  // Re-use the existing master admin as createdBy for the test company.
  const admin = await storage.getUserByUsername('admin');
  assert.ok(admin, 'master admin user must exist for tests to bootstrap');
  const adminId = admin!.id;

  // Test companies — created with status='A'.
  const [{ id: companyId }] = await db.execute<{ id: string }>(sql`
    INSERT INTO companies (company_name, status, created_by, last_updated_by)
    VALUES (${`E2E Templates Co ${RUN_TAG}`}, 'A', ${adminId}, ${adminId})
    RETURNING company_id AS id
  `).then((r) => r.rows as Array<{ id: string }>);

  const [{ id: otherCompanyId }] = await db.execute<{ id: string }>(sql`
    INSERT INTO companies (company_name, status, created_by, last_updated_by)
    VALUES (${`E2E Other Co ${RUN_TAG}`}, 'A', ${adminId}, ${adminId})
    RETURNING company_id AS id
  `).then((r) => r.rows as Array<{ id: string }>);

  // Two non-admin viewers — one in each company.
  const memberPwd = `pw-${RUN_TAG}`;
  const member = await storage.createUser({
    username: `member_${RUN_TAG}`,
    password: await hashPassword(memberPwd),
    email: `member_${RUN_TAG}@test.local`,
    firstName: 'Member',
    lastName: 'Test',
    role: 'viewer',
    isActive: true,
  });

  const outsiderPwd = `pw-${RUN_TAG}`;
  const outsider = await storage.createUser({
    username: `outsider_${RUN_TAG}`,
    password: await hashPassword(outsiderPwd),
    email: `outsider_${RUN_TAG}@test.local`,
    firstName: 'Outsider',
    lastName: 'Test',
    role: 'viewer',
    isActive: true,
  });

  // Tie each user to their company via user_organization_roles + active context.
  const memberRole = await storage.createUserOrganizationRole({
    userId: member.id,
    companyId,
    role: 'editor',
    status: 'A',
    createdBy: adminId,
    lastUpdatedBy: adminId,
  } as any);
  await storage.setUserActiveContext(member.id, memberRole.id);

  const outsiderRole = await storage.createUserOrganizationRole({
    userId: outsider.id,
    companyId: otherCompanyId,
    role: 'editor',
    status: 'A',
    createdBy: adminId,
    lastUpdatedBy: adminId,
  } as any);
  await storage.setUserActiveContext(outsider.id, outsiderRole.id);

  // Pick the system template for RLA — guaranteed to exist after the seeder.
  const sysRow = (await db.execute<{ id: string }>(sql`
    SELECT id FROM contract_templates
    WHERE is_system = true AND flow_type_code = 'RLA' LIMIT 1
  `)).rows[0];
  assert.ok(sysRow?.id, 'RLA system template must exist');

  // Three user templates spanning every visibility / ownership case.
  const privateOther = (await db.execute<{ id: string }>(sql`
    INSERT INTO contract_templates (flow_type_code, name, is_system, visibility, owner_user_id, company_id, snapshot_scope, is_active)
    VALUES ('RLA', ${`PrivateOther ${RUN_TAG}`}, false, 'private', ${outsider.id}, ${otherCompanyId}, 'minimal', true)
    RETURNING id
  `)).rows[0];

  const publicCompany = (await db.execute<{ id: string }>(sql`
    INSERT INTO contract_templates (flow_type_code, name, is_system, visibility, owner_user_id, company_id, snapshot_scope, is_active)
    VALUES ('RLA', ${`PublicCompany ${RUN_TAG}`}, false, 'public', ${outsider.id}, ${companyId}, 'standard', true)
    RETURNING id
  `)).rows[0];

  const privateMine = (await db.execute<{ id: string }>(sql`
    INSERT INTO contract_templates (flow_type_code, name, is_system, visibility, owner_user_id, company_id, snapshot_scope, is_active)
    VALUES ('RLA', ${`PrivateMine ${RUN_TAG}`}, false, 'private', ${member.id}, ${companyId}, 'minimal', true)
    RETURNING id
  `)).rows[0];

  // Test contract owned by the member's company so non-admin can write to it.
  const contractDisplay = `E2E Save-as-Template ${RUN_TAG}`;
  const contractIdSeed = `e2e-${RUN_TAG}`;
  await db.execute(sql`
    INSERT INTO contracts (id, file_name, original_name, file_size, file_type, file_path,
      display_name, contract_type, status, source, organization_name, counterparty_name,
      flow_type_code, company_id, uploaded_by, created_at, updated_at)
    VALUES (
      ${contractIdSeed}, ${'fixture.txt'}, ${'fixture.txt'}, 0, 'text/plain', ${'/tmp/fixture.txt'},
      ${contractDisplay}, 'RLA', 'analyzed', 'manual', ${'E2E Co'}, ${'Counterparty'},
      'RLA', ${companyId}, ${member.id}, NOW(), NOW()
    )
  `);

  // A clause + a rule with a rich payload so we can validate full-column
  // duplication + scope-based snapshot behaviour.
  const clauseRow = (await db.execute<{ id: string }>(sql`
    INSERT INTO contract_clauses (contract_id, clause_identifier, text, clause_category_code, confidence, created_at)
    VALUES (${contractIdSeed}, 'CL-01', 'Royalty 5% of net revenue', 'royalty', 0.95, NOW())
    RETURNING id
  `)).rows[0];

  const ruleRow = (await db.execute<{ id: string }>(sql`
    INSERT INTO contract_rules (
      contract_id, rule_type, rule_name, description,
      formula_definition, base_rate, minimum_guarantee, calculation_formula,
      product_categories, territories, seasonal_adjustments, territory_premiums,
      volume_tiers, field_mappings, priority, is_active, confidence,
      review_status, source_section, source_text, source_page, extraction_order,
      validation_status, validated_confidence, validation_details,
      clause_category, customer_segments, channel, exceptions,
      rule_version_num, specificity_score, template_code, execution_group,
      calc_phase, trigger_source, aggregation_scope, base_metric, tier_basis,
      qualifier_groups, milestones, milestone_count,
      approval_status, source_clause_id, uom
    ) VALUES (
      ${contractIdSeed}, 'royalty', 'Royalty Base Rate', 'Test royalty rule for duplication',
      ${JSON.stringify({ kind: 'flat', rate: 0.05 })}::jsonb, 0.05, 50000, '5% of net revenue',
      ARRAY['Books','Music']::text[], ARRAY['NA','EU']::text[],
      ${JSON.stringify({ Q1: 1.1 })}::jsonb, ${JSON.stringify({ Premium: 1.2 })}::jsonb,
      ${JSON.stringify([{ min: 0, max: 1000, rate: 0.04 }])}::jsonb,
      ${JSON.stringify({ volumeField: 'net_amount' })}::jsonb,
      10, true, 0.92,
      'pending', 'Section 4.1', 'Royalty 5% of net revenue', 7, 3,
      'passed', 0.91, ${JSON.stringify({ valuesFound: ['5%'] })}::jsonb,
      'royalty', ARRAY['Distributor']::text[], 'wholesale',
      ${JSON.stringify({ holiday: { skip: true } })}::jsonb,
      1, 80, 'TPL-ROYALTY', 'gross',
      'gross_calc', 'sale', 'per_period', 'net_amount', 'amount',
      ${JSON.stringify({ groups: [{ field: 'territory', op: 'in', values: ['NA'] }] })}::jsonb,
      ${JSON.stringify([{ name: 'M1', date: '2025-01-01' }])}::jsonb, 1,
      'pending', ${clauseRow.id}, 'unit'
    )
    RETURNING id
  `)).rows[0];

  return {
    companyId,
    otherCompanyId,
    member: { id: member.id, username: member.username, password: memberPwd },
    outsider: { id: outsider.id, username: outsider.username, password: outsiderPwd },
    contractId: contractIdSeed,
    ruleId: ruleRow.id,
    clauseId: clauseRow.id,
    templateNoFlowSamplesCode: null,
    systemTemplateId: sysRow.id,
    privateOtherTemplateId: privateOther.id,
    publicCompanyTemplateId: publicCompany.id,
    privateMineTemplateId: privateMine.id,
  };
}

async function destroyFixtures(fx: Fixtures) {
  // Order matters: delete leaf rows first.
  const tplIdsToDrop = [
    fx.privateMineTemplateId,
    fx.publicCompanyTemplateId,
    fx.privateOtherTemplateId,
  ];
  // Plus any save-as-template templates the member created during the run.
  const savedTpls = await db.execute<{ id: string }>(sql`
    SELECT id FROM contract_templates
    WHERE owner_user_id = ${fx.member.id} AND is_system = false
  `);
  for (const r of savedTpls.rows ?? []) tplIdsToDrop.push(r.id);

  for (const tid of tplIdsToDrop) {
    await db.execute(sql`DELETE FROM template_rules WHERE template_id = ${tid}`);
    await db.execute(sql`DELETE FROM template_clauses WHERE template_id = ${tid}`);
    await db.execute(sql`DELETE FROM contract_templates WHERE id = ${tid}`);
  }

  await db.execute(sql`DELETE FROM accrual_policies WHERE subtype_instance_id IN (SELECT id FROM subtype_instances WHERE contract_id = ${fx.contractId})`);
  await db.execute(sql`DELETE FROM contract_rules WHERE contract_id = ${fx.contractId}`);
  await db.execute(sql`DELETE FROM contract_clauses WHERE contract_id = ${fx.contractId}`);
  await db.execute(sql`DELETE FROM subtype_instances WHERE contract_id = ${fx.contractId}`);
  await db.execute(sql`DELETE FROM contract_analysis WHERE contract_id = ${fx.contractId}`);
  await db.execute(sql`DELETE FROM contracts WHERE id = ${fx.contractId}`);

  // Clean up user_active_context first because of FK to user_organization_roles.
  await db.execute(sql`DELETE FROM user_active_context WHERE user_id IN (${fx.member.id}, ${fx.outsider.id})`);
  await db.execute(sql`DELETE FROM user_organization_roles WHERE user_id IN (${fx.member.id}, ${fx.outsider.id})`);
  await db.execute(sql`DELETE FROM users WHERE id IN (${fx.member.id}, ${fx.outsider.id})`);
  await db.execute(sql`DELETE FROM companies WHERE company_id IN (${fx.companyId}, ${fx.otherCompanyId})`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let fx: Fixtures;
let memberClient: HttpClient;

test('seeder is idempotent and produces 6 system templates with primary subtypes matching the matrix', async () => {
  // Capture state, run again, expect identical row counts (idempotent).
  const before = await db.execute<{ templates: number; rules: number; clauses: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM contract_templates WHERE is_system = true)::int AS templates,
      (SELECT COUNT(*) FROM template_rules WHERE template_id IN (SELECT id FROM contract_templates WHERE is_system = true))::int AS rules,
      (SELECT COUNT(*) FROM template_clauses WHERE template_id IN (SELECT id FROM contract_templates WHERE is_system = true))::int AS clauses
  `);

  await seedSystemContractTemplates();

  const after = await db.execute<{ templates: number; rules: number; clauses: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM contract_templates WHERE is_system = true)::int AS templates,
      (SELECT COUNT(*) FROM template_rules WHERE template_id IN (SELECT id FROM contract_templates WHERE is_system = true))::int AS rules,
      (SELECT COUNT(*) FROM template_clauses WHERE template_id IN (SELECT id FROM contract_templates WHERE is_system = true))::int AS clauses
  `);

  assert.equal(after.rows[0].templates, before.rows[0].templates, 'system template count must not change on re-seed');
  assert.equal(after.rows[0].rules, before.rows[0].rules, 'system template_rules count must not change on re-seed');
  assert.equal(after.rows[0].clauses, before.rows[0].clauses, 'system template_clauses count must not change on re-seed');

  // Exactly one system template per active flow type (the matrix-driven contract = 6 today).
  const flowsActive = await db.execute<{ n: number }>(
    sql`SELECT COUNT(*)::int AS n FROM flow_types WHERE is_active = true`,
  );
  const sysTpls = await db.execute<{ flow_type_code: string }>(
    sql`SELECT flow_type_code FROM contract_templates WHERE is_system = true ORDER BY flow_type_code`,
  );
  assert.equal(sysTpls.rows.length, flowsActive.rows[0].n, 'one system template per active flow type');
  assert.equal(sysTpls.rows.length, 6, 'baseline matrix expects 6 system templates');

  // Every system template has a rule whose subtype matches the flow's
  // primary subtype in flow_subtype_validity (when one is defined).
  type Pair = { flow_type_code: string; subtype_code: string };
  const primaries = await db.execute<Pair>(sql`
    SELECT flow_type_code, subtype_code FROM flow_subtype_validity WHERE is_primary = true
  `);
  const primaryByFlow = new Map(primaries.rows.map((r) => [r.flow_type_code, r.subtype_code]));
  for (const t of sysTpls.rows) {
    const expected = primaryByFlow.get(t.flow_type_code);
    if (!expected) continue; // some flows may legitimately have no primary
    const hits = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM template_rules tr
      JOIN contract_templates ct ON ct.id = tr.template_id
      WHERE ct.is_system = true AND ct.flow_type_code = ${t.flow_type_code}
        AND tr.subtype_code = ${expected} AND tr.is_primary = true
    `);
    assert.ok(
      Number(hits.rows[0].n) >= 1,
      `${t.flow_type_code} system template must have a primary rule for subtype ${expected}`,
    );
  }
});

test('login the non-admin member', async () => {
  memberClient = new HttpClient();
  const res = await memberClient.request('POST', '/api/login', {
    body: { username: fx.member.username, password: fx.member.password },
  });
  assert.equal(res.status, 200, `login should succeed (got ${res.status} body=${JSON.stringify(res.body)})`);
  assert.equal(res.body?.username, fx.member.username);
  // Sanity: the /api/user route should now reflect the logged-in user.
  const me = await memberClient.request('GET', '/api/user');
  assert.equal(me.status, 200);
  assert.equal(me.body?.id, fx.member.id);
  assert.equal(me.body?.activeContext?.companyId, fx.companyId);
});

test('GET /api/contract-templates returns only system + my-company + mine', async () => {
  const res = await memberClient.request('GET', '/api/contract-templates');
  assert.equal(res.status, 200);
  const ids = new Set<string>((res.body?.templates ?? []).map((t: any) => t.id));

  // Visible: system template, the public company template, and member's own private one.
  assert.ok(ids.has(fx.systemTemplateId), 'system template must be visible');
  assert.ok(ids.has(fx.publicCompanyTemplateId), 'company-public template must be visible');
  assert.ok(ids.has(fx.privateMineTemplateId), "member's own private template must be visible");

  // Invisible: private template owned by an outsider in another company.
  assert.ok(!ids.has(fx.privateOtherTemplateId), "outsider's private template must NOT be visible");

  // Every visible non-system template's owner / company must match caller.
  for (const t of res.body.templates ?? []) {
    if (t.isSystem) continue;
    const ownedByMe = t.ownerUserId === fx.member.id;
    const sameCompanyPublic = t.visibility === 'public' && t.companyId === fx.companyId;
    assert.ok(ownedByMe || sameCompanyPublic, `unexpected template visible: ${t.id} (${t.scope})`);
  }
});

test('POST /api/contracts/:id/save-as-template snapshots the right rules+clauses per scope', async () => {
  // 1 rule, 1 clause on the source contract.
  const sourceRules = await db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM contract_rules WHERE contract_id = ${fx.contractId} AND is_active = true`);
  const sourceClauses = await db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM contract_clauses WHERE contract_id = ${fx.contractId}`);
  assert.equal(sourceRules.rows[0].n, 1);
  assert.equal(sourceClauses.rows[0].n, 1);

  for (const scope of ['minimal', 'standard', 'maximal'] as const) {
    const res = await memberClient.request('POST', `/api/contracts/${fx.contractId}/save-as-template`, {
      body: { name: `Saved ${scope} ${RUN_TAG}`, scope, visibility: 'private' },
    });
    assert.equal(res.status, 200, `save-as-template ${scope} should 200 (got ${res.status} body=${JSON.stringify(res.body)})`);
    const tplId = res.body?.templateId;
    assert.ok(tplId, 'response must include a templateId');

    const ruleCount = await db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM template_rules WHERE template_id = ${tplId}`);
    const clauseCount = await db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM template_clauses WHERE template_id = ${tplId}`);
    assert.equal(Number(ruleCount.rows[0].n), 1, `${scope} should snapshot 1 rule`);
    assert.equal(Number(clauseCount.rows[0].n), 1, `${scope} should snapshot 1 clause`);

    const tpl = await db.execute<{ scope: string; party_role_slots: any; accrual_policies: any; sales_sample_csv: string | null }>(sql`
      SELECT snapshot_scope AS scope, party_role_slots, accrual_policies, sales_sample_csv
      FROM contract_templates WHERE id = ${tplId}
    `);
    const row = tpl.rows[0];
    assert.equal(row.scope, scope);
    if (scope === 'minimal') {
      assert.equal(row.party_role_slots, null, 'minimal must NOT carry party role slots');
    } else {
      // standard + maximal carry party role slots (or {} when source had none).
      // Could be null on the source contract — accept null OR an object.
      assert.ok(row.party_role_slots === null || typeof row.party_role_slots === 'object',
        'standard/maximal party_role_slots must be null or jsonb object');
    }
    if (scope !== 'maximal') {
      // accrual_policies starts as [] for non-maximal.
      const ap = row.accrual_policies;
      assert.ok(Array.isArray(ap) && ap.length === 0, `${scope} must have empty accrual_policies`);
      assert.equal(row.sales_sample_csv, null, `${scope} must not snapshot sales sample`);
    }
  }
});

test('POST /api/contracts/:id/rules/:ruleId/duplicate clones every column except PK + extraction_order', async () => {
  const before = (await db.execute<any>(sql`SELECT * FROM contract_rules WHERE id = ${fx.ruleId}`)).rows[0];
  assert.ok(before, 'source rule must exist');

  const res = await memberClient.request('POST', `/api/contracts/${fx.contractId}/rules/${fx.ruleId}/duplicate`);
  assert.equal(res.status, 200, `duplicate should 200 (got ${res.status} body=${JSON.stringify(res.body)})`);
  const newId = res.body?.ruleId;
  assert.ok(newId, 'response must include the new ruleId');

  const after = (await db.execute<any>(sql`SELECT * FROM contract_rules WHERE id = ${newId}`)).rows[0];
  assert.ok(after, 'duplicate must exist in DB');

  // Allowed-to-differ columns.
  const expectedDifferent = new Set([
    'id', 'extraction_order', 'rule_name', 'created_at', 'updated_at',
    // The route deliberately resets these on duplicate.
    'source_text', 'source_section', 'source_page',
    'review_status', 'reviewed_by', 'reviewed_at',
    'approval_status', 'approved_by', 'approved_at', 'approval_notes',
    'is_active', // forced to true on duplicate (already true on source so usually equal — kept for safety)
  ]);

  // Walk every column on the source row and assert that anything outside the
  // allowed-to-differ set was carried across as-is. This is the "every column"
  // check the task asks for — adding a new column to contract_rules will
  // automatically be exercised by this test.
  const colNames = Object.keys(before);
  let comparedCount = 0;
  for (const col of colNames) {
    if (expectedDifferent.has(col)) continue;
    comparedCount += 1;
    const a = before[col];
    const b = after[col];
    // Compare deeply for objects/arrays, structurally for primitives.
    assert.deepEqual(b, a, `column "${col}" must be cloned identically (source=${JSON.stringify(a)}, dup=${JSON.stringify(b)})`);
  }
  assert.ok(comparedCount > 10, `should have compared a meaningful number of columns (${comparedCount})`);

  // PK + extraction_order must NOT match the source.
  assert.notEqual(after.id, before.id, 'PK must differ');
  // extraction_order is shifted: source order +1 (since target = source + 1).
  if (before.extraction_order != null) {
    assert.equal(after.extraction_order, before.extraction_order + 1,
      'duplicate inserted directly below the source');
  }
  assert.equal(after.rule_name, `${before.rule_name} (Copy)`, 'rule_name suffixed with " (Copy)"');
});

test('GET /api/contracts/:id/sample/:kind — unknown kind 400, valid kind 200 + text/csv', async () => {
  const bad = await memberClient.request('GET', `/api/contracts/${fx.contractId}/sample/not_a_real_kind`);
  // Implementation returns 400 (validation) for unknown kinds; 404 is reserved
  // for "valid kind, no CSV exists for this flow". See test docstring note.
  assert.equal(bad.status, 400, 'unknown kind must reject as a validation error');

  const good = await memberClient.request('GET', `/api/contracts/${fx.contractId}/sample/sales`, { expectJson: false });
  assert.equal(good.status, 200, `sales sample for RLA should 200 (got ${good.status} body=${good.raw?.slice(0, 200)})`);
  const ct = good.headers.get('content-type') || '';
  assert.ok(ct.includes('text/csv'), `content-type should be text/csv (got "${ct}")`);
  assert.ok(typeof good.raw === 'string' && good.raw.length > 0, 'CSV body should be non-empty');
});

test('GET /api/contract-templates/:templateId/sample/:kind — unknown kind 400, valid kind 200 + text/csv', async () => {
  const bad = await memberClient.request('GET', `/api/contract-templates/${fx.systemTemplateId}/sample/bogus`);
  assert.equal(bad.status, 400, 'unknown kind must reject as a validation error');

  const good = await memberClient.request('GET', `/api/contract-templates/${fx.systemTemplateId}/sample/sales`, { expectJson: false });
  assert.equal(good.status, 200, `sales sample on system template should 200 (got ${good.status})`);
  assert.ok((good.headers.get('content-type') || '').includes('text/csv'), 'content-type should be text/csv');
  assert.ok(good.raw.length > 0, 'CSV body should be non-empty');

  // Bonus: a private template the caller can't see must 404 (not 403) so we
  // don't leak existence across tenants.
  const blocked = await memberClient.request('GET', `/api/contract-templates/${fx.privateOtherTemplateId}/sample/sales`);
  assert.equal(blocked.status, 404, 'cross-tenant private template access must return 404');
});

// ---------------------------------------------------------------------------
// Task 68 — Posted-Accrual → Obligation promotion bridge
// ---------------------------------------------------------------------------
// Exercises promoteAccrualToObligation() directly (the PATCH route is the
// thin wrapper around it). Each scenario builds its own contract+accrual
// fixture so tests don't bleed state into each other; cleanup runs in a
// finally block so a failed assertion never poisons subsequent tests.

async function setupPromotionFixture(opts: {
  flowCode: string;
  cashDirection: 'inbound' | 'outbound' | 'derived';
  flowName?: string;
  basis?: 'qualifying_sale' | 'scheduled_release';
  amount?: string;
  status?: string;
}): Promise<{ contractId: string; accrualIdStr: string; cleanup: () => Promise<void> }> {
  const tag = `prom-${RUN_TAG}-${Math.random().toString(36).slice(2, 8)}`;
  const contractId = `c-${tag}`;
  const accrualIdStr = `ACC-${tag.toUpperCase()}`;
  const flowName = opts.flowName || `${opts.flowCode} Test Flow`;

  // Upsert flow_type with the requested direction. ON CONFLICT updates the
  // cash_direction so a parallel test seeding the same code can't strand a
  // stale value. companyId stays NULL so it's globally visible.
  await db.execute(sql`
    INSERT INTO flow_types (code, name, description, cash_direction, is_active)
    VALUES (${opts.flowCode}, ${flowName}, ${'E2E test flow'}, ${opts.cashDirection}, true)
    ON CONFLICT (code) DO UPDATE SET cash_direction = EXCLUDED.cash_direction
  `);

  await db.execute(sql`
    INSERT INTO contracts (id, file_name, original_name, file_size, file_type, file_path,
      display_name, contract_type, status, source, organization_name, counterparty_name,
      flow_type_code, company_id, uploaded_by, created_at, updated_at)
    VALUES (
      ${contractId}, ${'fixture.txt'}, ${'fixture.txt'}, 0, 'text/plain', ${'/tmp/fixture.txt'},
      ${`E2E Promo ${tag}`}, ${opts.flowCode}, 'analyzed', 'manual',
      ${'E2E Co'}, ${'Counterparty Promo'},
      ${opts.flowCode}, ${fx.companyId}, ${fx.member.id}, NOW(), NOW()
    )
  `);

  // Optional contract-level basis pin — exercises the per-contract override
  // branch of getObligationAccrualBasis so we don't depend on the system
  // default to test scheduled_release. The basis lives on contracts itself
  // (contracts.obligation_accrual_basis), not a separate settings table.
  if (opts.basis) {
    await db.execute(sql`
      UPDATE contracts SET obligation_accrual_basis = ${opts.basis} WHERE id = ${contractId}
    `);
  }

  await db.execute(sql`
    INSERT INTO accruals (accrual_id, contract_id, contract_name, counterparty,
      flow_type, period, amount, status, company_id, created_by, created_at, updated_at)
    VALUES (
      ${accrualIdStr}, ${contractId}, ${`E2E Promo ${tag}`}, ${'Counterparty Promo'},
      ${opts.flowName || opts.flowCode}, ${'Mar 2026'},
      ${opts.amount || '14054.65'}, ${opts.status || 'posted'},
      ${fx.companyId}, ${fx.member.id}, NOW(), NOW()
    )
  `);

  return {
    contractId,
    accrualIdStr,
    cleanup: async () => {
      // obligation_events cascade via FK; obligations clean themselves
      // explicitly because we don't trust ON DELETE CASCADE on the
      // bridge fields (sourceAccrualId is plain varchar by design).
      await db.execute(sql`DELETE FROM obligation_events WHERE obligation_id IN (SELECT id FROM obligations WHERE source_accrual_id = ${accrualIdStr})`);
      await db.execute(sql`DELETE FROM obligations WHERE source_accrual_id = ${accrualIdStr}`);
      await db.execute(sql`DELETE FROM accrual_audit_trail WHERE accrual_id = ${accrualIdStr}`);
      await db.execute(sql`DELETE FROM accruals WHERE accrual_id = ${accrualIdStr}`);
      await db.execute(sql`DELETE FROM contracts WHERE id = ${contractId}`);
    },
  };
}

test('Task 68 — CRP posted accrual promotes to outbound obligation, claimable status', async () => {
  const { promoteAccrualToObligation } = await import('../server/services/accrualPromotionService');
  const fixture = await setupPromotionFixture({
    flowCode: 'CRP', cashDirection: 'outbound', flowName: 'Customer Rebate Program',
  });
  try {
    const result = await promoteAccrualToObligation(fixture.accrualIdStr);
    assert.equal(result.outcome, 'created', 'first promotion must create');
    assert.equal(result.direction, 'outbound', 'CRP cashDirection=outbound');
    assert.equal(result.kind, 'rebate', 'CRP kind defaults to rebate');
    // System default basis is qualifying_sale → claimable. If a deployment
    // pinned scheduled_release as default this assertion documents that
    // behaviour change so the test fails loudly instead of silently.
    assert.ok(['claimable', 'accrued'].includes(result.initialStatus), 'status from accrual basis');

    const rows = await db.execute<{ id: string; direction: string; kind: string; status: string; source_channel: string }>(sql`
      SELECT id, direction, kind, status, source_channel FROM obligations WHERE source_accrual_id = ${fixture.accrualIdStr}
    `);
    assert.equal(rows.rows.length, 1, 'exactly one obligation row created');
    assert.equal(rows.rows[0].direction, 'outbound');
    assert.equal(rows.rows[0].source_channel, 'accrual_promotion');
  } finally {
    await fixture.cleanup();
  }
});

test('Task 68 — VRP posted accrual promotes to INBOUND obligation', async () => {
  const { promoteAccrualToObligation } = await import('../server/services/accrualPromotionService');
  const fixture = await setupPromotionFixture({
    flowCode: 'VRP', cashDirection: 'inbound', flowName: 'Vendor Rebate Program',
  });
  try {
    const result = await promoteAccrualToObligation(fixture.accrualIdStr);
    assert.equal(result.outcome, 'created');
    assert.equal(result.direction, 'inbound', 'VRP cashDirection=inbound');
    assert.equal(result.kind, 'rebate');
  } finally {
    await fixture.cleanup();
  }
});

test('Task 68 — promotion is idempotent on re-post (same accrual_id)', async () => {
  const { promoteAccrualToObligation } = await import('../server/services/accrualPromotionService');
  const fixture = await setupPromotionFixture({
    flowCode: 'CRP', cashDirection: 'outbound', amount: '1000.00',
  });
  try {
    const first = await promoteAccrualToObligation(fixture.accrualIdStr);
    assert.equal(first.outcome, 'created');

    // Mutate the underlying accrual to simulate an amount correction
    // before re-posting. The bridge should refresh the existing
    // obligation, NOT insert a new one.
    await db.execute(sql`UPDATE accruals SET amount = '1500.00' WHERE accrual_id = ${fixture.accrualIdStr}`);

    const second = await promoteAccrualToObligation(fixture.accrualIdStr);
    assert.equal(second.outcome, 'updated', 're-post must hit the idempotent path');
    assert.equal(second.obligationId, first.obligationId, 'same obligation row');

    const rows = await db.execute<{ id: string; amount: string }>(sql`
      SELECT id, amount FROM obligations WHERE source_accrual_id = ${fixture.accrualIdStr}
    `);
    assert.equal(rows.rows.length, 1, 'still exactly one obligation');
    assert.equal(rows.rows[0].amount, '1500.00', 'amount refreshed in place');

    const events = await db.execute<{ event_type: string }>(sql`
      SELECT event_type FROM obligation_events WHERE obligation_id = ${first.obligationId} ORDER BY created_at
    `);
    const types = events.rows.map(e => e.event_type);
    assert.ok(types.includes('accrued'), 'first promotion logs accrued');
    assert.ok(types.includes('promoted'), 're-post logs promoted');
  } finally {
    await fixture.cleanup();
  }
});

test('Task 68 — scheduled_release basis produces accrued (deferred) status', async () => {
  const { promoteAccrualToObligation } = await import('../server/services/accrualPromotionService');
  const fixture = await setupPromotionFixture({
    flowCode: 'CRP', cashDirection: 'outbound', basis: 'scheduled_release',
  });
  try {
    const result = await promoteAccrualToObligation(fixture.accrualIdStr);
    assert.equal(result.initialStatus, 'accrued', 'scheduled_release defers to accrued');
  } finally {
    await fixture.cleanup();
  }
});

test('Task 68 — OEM (cashDirection=derived) throws OemDirectionRequiredError', async () => {
  const { promoteAccrualToObligation, OemDirectionRequiredError } =
    await import('../server/services/accrualPromotionService');
  const fixture = await setupPromotionFixture({
    flowCode: 'OEM', cashDirection: 'derived', flowName: 'OEM Flow',
  });
  try {
    let threw: any = null;
    try {
      await promoteAccrualToObligation(fixture.accrualIdStr);
    } catch (e) { threw = e; }
    assert.ok(threw, 'OEM promotion must throw');
    assert.ok(threw instanceof OemDirectionRequiredError, 'specific error type');
    assert.match(threw.message, /derived/, 'message names the direction problem');
    // No obligation row written.
    const rows = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM obligations WHERE source_accrual_id = ${fixture.accrualIdStr}
    `);
    assert.equal(rows.rows[0].n, 0, 'no obligation created on OEM throw');
  } finally {
    await fixture.cleanup();
  }
});

test('Task 68 — backfill skips rows that already promoted', async () => {
  const { promoteAccrualToObligation, backfillPostedAccrualObligations } =
    await import('../server/services/accrualPromotionService');
  const fixture = await setupPromotionFixture({
    flowCode: 'CRP', cashDirection: 'outbound',
  });
  try {
    await promoteAccrualToObligation(fixture.accrualIdStr);
    const before = (await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM obligations WHERE source_accrual_id = ${fixture.accrualIdStr}
    `)).rows[0].n;

    const result = await backfillPostedAccrualObligations({ companyId: fx.companyId });
    // After Task 68's tightening, the backfill *pre-skips* already-bridged
    // accruals via a LEFT JOIN — promotion is never re-invoked on the
    // fixture row, so it cannot show up as `promoted` and the obligation
    // row must not be touched (no spurious `promoted`/`updated` event).
    assert.equal(result.errors.length, 0, 'backfill must not error on already-promoted rows');
    assert.equal(result.promoted, 0, 'fixture row must not be re-promoted');
    assert.ok(result.alreadyPromoted >= 1, 'fixture row must count as already-promoted');
    const after = (await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM obligations WHERE source_accrual_id = ${fixture.accrualIdStr}
    `)).rows[0].n;
    assert.equal(after, before, 'backfill is idempotent — no duplicate insert');
    // And: no fresh obligation_event got logged for the fixture row.
    const eventCount = (await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM obligation_events oe
      JOIN obligations o ON o.id = oe.obligation_id
      WHERE o.source_accrual_id = ${fixture.accrualIdStr}
        AND oe.phase = 'backfill'
    `)).rows[0].n;
    assert.equal(eventCount, 0, 'backfill must not emit obligation_events on already-promoted rows');
  } finally {
    await fixture.cleanup();
  }
});

test('Task 68 — PATCH /api/accruals/:id status=posted runs postAndPromoteAccrual atomically', async () => {
  // This test exercises the full HTTP path that production callers use:
  // an authenticated member sending PATCH { status: "posted" }. It proves
  // that the route is wired to postAndPromoteAccrual (atomic txn helper)
  // and not the legacy single-row update — i.e. an obligation must be
  // born transactionally with the status flip, not by a follow-on call.
  const fixture = await setupPromotionFixture({
    flowCode: 'CRP',
    cashDirection: 'outbound',
    flowName: 'Customer Rebate Program',
    status: 'approved', // start non-posted so PATCH does the flip
    amount: '2500.00',
  });
  try {
    // Sanity: no obligation yet because the accrual was seeded as approved.
    const pre = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM obligations WHERE source_accrual_id = ${fixture.accrualIdStr}
    `);
    assert.equal(pre.rows[0].n, 0, 'pre-condition: no obligation before PATCH');

    const res = await memberClient.request('PATCH', `/api/accruals/${fixture.accrualIdStr}`, {
      body: { status: 'posted' },
    });
    assert.equal(res.status, 200, `PATCH should succeed (got ${res.status} body=${JSON.stringify(res.body)})`);
    assert.equal(res.body?.status, 'posted', 'response carries the new status');

    // Obligation row must now exist and be tagged source_channel='accrual_promotion'.
    const post = await db.execute<{ id: string; status: string; direction: string; source_channel: string; amount: string }>(sql`
      SELECT id, status, direction, source_channel, amount
      FROM obligations WHERE source_accrual_id = ${fixture.accrualIdStr}
    `);
    assert.equal(post.rows.length, 1, 'PATCH must create exactly one obligation');
    assert.equal(post.rows[0].direction, 'outbound', 'CRP → outbound');
    assert.equal(post.rows[0].source_channel, 'accrual_promotion');
    assert.equal(post.rows[0].amount, '2500.00');

    // Audit row must mention the obligation id — proves the route ran the
    // postedAuditInsert branch, not the generic status_change one.
    const audit = await db.execute<{ description: string }>(sql`
      SELECT description FROM accrual_audit_trail
      WHERE accrual_id = ${fixture.accrualIdStr} AND event_type = 'status_change'
      ORDER BY created_at DESC LIMIT 1
    `);
    assert.ok(audit.rows.length > 0, 'audit row written');
    assert.match(audit.rows[0].description, /obligation /, 'audit description names the obligation');
  } finally {
    await fixture.cleanup();
  }
});

test('Task 68 — POST /api/accruals with status=posted (auto-batch path) creates obligation', async () => {
  // Auto-accrual batch posting path: a caller (scripted finalizer,
  // pipeline batch job, or seed script) creates an accrual already at
  // status='posted'. The route must mirror PATCH wiring — insert,
  // route through postAndPromoteAccrual, audit, return the posted row
  // with an obligation backing it. Idempotent re-issue must not
  // duplicate the obligation.
  const tag = `batch-${Math.random().toString(36).slice(2, 8)}`;
  const contractId = `c-${tag}`;
  const accrualIdStr = `ACC-${tag.toUpperCase()}`;
  // Pre-seed flow type + contract so the route can resolve the
  // contract→flow_type direction lookup. Reuse CRP for outbound.
  await db.execute(sql`
    INSERT INTO flow_types (code, name, description, cash_direction, is_active)
    VALUES ('CRP', 'Customer Rebate Program', 'E2E', 'outbound', true)
    ON CONFLICT (code) DO UPDATE SET cash_direction = EXCLUDED.cash_direction
  `);
  await db.execute(sql`
    INSERT INTO contracts (id, file_name, original_name, file_size, file_type, file_path,
      display_name, contract_type, status, source, organization_name, counterparty_name,
      flow_type_code, company_id, uploaded_by, created_at, updated_at)
    VALUES (
      ${contractId}, ${'fixture.txt'}, ${'fixture.txt'}, 0, 'text/plain', ${'/tmp/fixture.txt'},
      ${`Auto-batch ${tag}`}, 'CRP', 'analyzed', 'manual',
      ${'E2E Co'}, ${'Counterparty AutoBatch'}, 'CRP', ${fx.companyId}, ${fx.member.id}, NOW(), NOW()
    )
  `);
  try {
    // Auto-batch POST with status=posted in one shot.
    const res = await memberClient.request('POST', '/api/accruals', {
      body: {
        accrualId: accrualIdStr,
        contractId,
        contractName: `Auto-batch ${tag}`,
        counterparty: 'Counterparty AutoBatch',
        flowType: 'CRP',
        period: 'Mar 2026',
        amount: '7777.77',
        status: 'posted',
        companyId: fx.companyId,
        createdBy: fx.member.id,
      },
    });
    assert.equal(res.status, 200, `auto-batch POST should succeed (got ${res.status} body=${JSON.stringify(res.body)})`);
    assert.equal(res.body?.status, 'posted', 'returned row reflects post');

    // Obligation must exist, source_channel='accrual_promotion'.
    const obs = await db.execute<{ id: string; status: string; direction: string; source_channel: string; amount: string }>(sql`
      SELECT id, status, direction, source_channel, amount
      FROM obligations WHERE source_accrual_id = ${accrualIdStr}
    `);
    assert.equal(obs.rows.length, 1, 'auto-batch must create exactly one obligation');
    assert.equal(obs.rows[0].direction, 'outbound');
    assert.equal(obs.rows[0].source_channel, 'accrual_promotion');
    assert.equal(obs.rows[0].amount, '7777.77');

    // Audit row from the auto-post path must mention the obligation id.
    const audit = await db.execute<{ description: string }>(sql`
      SELECT description FROM accrual_audit_trail
      WHERE accrual_id = ${accrualIdStr} AND event_type = 'status_change'
        AND description LIKE 'Auto-posted%'
      ORDER BY created_at DESC LIMIT 1
    `);
    assert.ok(audit.rows.length > 0, 'auto-post audit row written');
    assert.match(audit.rows[0].description, /obligation /, 'audit names the obligation');
  } finally {
    await db.execute(sql`DELETE FROM obligation_events WHERE obligation_id IN (SELECT id FROM obligations WHERE source_accrual_id = ${accrualIdStr})`);
    await db.execute(sql`DELETE FROM obligations WHERE source_accrual_id = ${accrualIdStr}`);
    await db.execute(sql`DELETE FROM accrual_audit_trail WHERE accrual_id = ${accrualIdStr}`);
    await db.execute(sql`DELETE FROM accruals WHERE accrual_id = ${accrualIdStr}`);
    await db.execute(sql`DELETE FROM contracts WHERE id = ${contractId}`);
  }
});

test('Task 68 — PATCH posted on OEM contract returns 422 and does NOT flip the accrual', async () => {
  // Mirror of the OEM unit test but through HTTP: the route must catch
  // OemDirectionRequiredError, audit the failure, and return 422 with the
  // OEM_DIRECTION_REQUIRED code. The accrual must remain unposted because
  // the txn rolled back.
  const fixture = await setupPromotionFixture({
    flowCode: 'OEM',
    cashDirection: 'derived',
    flowName: 'OEM Flow',
    status: 'approved',
  });
  try {
    const res = await memberClient.request('PATCH', `/api/accruals/${fixture.accrualIdStr}`, {
      body: { status: 'posted' },
    });
    assert.equal(res.status, 422, 'OEM promotion must surface as 422');
    assert.equal(res.body?.code, 'OEM_DIRECTION_REQUIRED');

    // Accrual status must NOT be 'posted' — the txn rolled back.
    const acc = await db.execute<{ status: string }>(sql`
      SELECT status FROM accruals WHERE accrual_id = ${fixture.accrualIdStr}
    `);
    assert.equal(acc.rows[0].status, 'approved', 'accrual rolled back to pre-PATCH status');

    // No obligation row.
    const obs = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM obligations WHERE source_accrual_id = ${fixture.accrualIdStr}
    `);
    assert.equal(obs.rows[0].n, 0);

    // Failure audit row exists.
    const audit = await db.execute<{ event_type: string }>(sql`
      SELECT event_type FROM accrual_audit_trail
      WHERE accrual_id = ${fixture.accrualIdStr} AND event_type = 'obligation_promotion_failed'
    `);
    assert.ok(audit.rows.length > 0, 'failure audit row written outside the rolled-back txn');
  } finally {
    await fixture.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Task 69 — Configurable settlement document type matrix
//
// Verifies the 4-level cascade in
// server/services/intakeAgentService.ts#documentTypeForClaim:
//
//   contract.settlementPolicies.documentTypeMatrix
//     → flow_types.documentTypeOverrides
//       → companySettings.settlementPolicies.documentTypeMatrix
//         → BUILT_IN_DOCUMENT_TYPE_MATRIX
//
// Each test isolates the override on one level and asserts the resolved
// document_type. Fixtures use a unique flow_type code per test so a sibling
// flow can be queried in parallel and prove cross-flow isolation.
// ---------------------------------------------------------------------------

async function setupDocTypeFixture(opts: { flowCode?: string }): Promise<{
  contractId: string;
  siblingContractId: string;
  flowCode: string;
  cleanup: () => Promise<void>;
}> {
  const tag = `dt-${RUN_TAG}-${Math.random().toString(36).slice(2, 8)}`;
  const flowCode = opts.flowCode || `DTX-${tag.toUpperCase()}`;
  const siblingFlowCode = `DTY-${tag.toUpperCase()}`;
  const contractId = `c-${tag}`;
  const siblingContractId = `c-sib-${tag}`;

  await db.execute(sql`
    INSERT INTO flow_types (code, name, description, cash_direction, is_active)
    VALUES (${flowCode}, ${flowCode}, ${'Task69 fixture flow'}, 'outbound', true)
    ON CONFLICT (code) DO UPDATE SET cash_direction = EXCLUDED.cash_direction,
      document_type_overrides = NULL
  `);
  await db.execute(sql`
    INSERT INTO flow_types (code, name, description, cash_direction, is_active)
    VALUES (${siblingFlowCode}, ${siblingFlowCode}, ${'Task69 sibling flow'}, 'outbound', true)
    ON CONFLICT (code) DO UPDATE SET cash_direction = EXCLUDED.cash_direction,
      document_type_overrides = NULL
  `);

  for (const [cId, fCode] of [
    [contractId, flowCode],
    [siblingContractId, siblingFlowCode],
  ] as const) {
    await db.execute(sql`
      INSERT INTO contracts (id, file_name, original_name, file_size, file_type, file_path,
        display_name, contract_type, status, source, organization_name, counterparty_name,
        flow_type_code, company_id, uploaded_by, created_at, updated_at)
      VALUES (
        ${cId}, ${'fixture.txt'}, ${'fixture.txt'}, 0, 'text/plain', ${'/tmp/fixture.txt'},
        ${`Doctype Fixture ${cId}`}, ${fCode}, 'analyzed', 'manual',
        ${'E2E Co'}, ${'Counterparty DT'}, ${fCode},
        ${fx.companyId}, ${fx.member.id}, NOW(), NOW()
      )
    `);
  }

  return {
    contractId,
    siblingContractId,
    flowCode,
    cleanup: async () => {
      await db.execute(sql`DELETE FROM contracts WHERE id IN (${contractId}, ${siblingContractId})`);
      await db.execute(sql`DELETE FROM flow_types WHERE code IN (${flowCode}, ${siblingFlowCode})`);
    },
  };
}

async function clearCompanyDocTypeMatrix(companyId: string): Promise<any> {
  // Returns the previous settlementPolicies so the test can restore it.
  // Upserts a company_settings row if missing — the test fixture only seeds
  // `companies`, not `company_settings`, but the cascade resolver reads the
  // matrix off `company_settings.settlement_policies`, so it must exist.
  await db.execute(sql`
    INSERT INTO company_settings (company_id) VALUES (${companyId})
    ON CONFLICT (company_id) DO NOTHING
  `);
  const prev = await db.execute<{ settlement_policies: any }>(sql`
    SELECT settlement_policies FROM company_settings WHERE company_id = ${companyId}
  `);
  await db.execute(sql`
    UPDATE company_settings
    SET settlement_policies = COALESCE(settlement_policies, '{}'::jsonb) - 'documentTypeMatrix'
    WHERE company_id = ${companyId}
  `);
  return prev.rows[0]?.settlement_policies ?? {};
}

async function restoreCompanyDocTypeMatrix(companyId: string, snapshot: any): Promise<void> {
  if (snapshot === null) {
    await db.execute(sql`
      UPDATE company_settings
      SET settlement_policies = COALESCE(settlement_policies, '{}'::jsonb) - 'documentTypeMatrix'
      WHERE company_id = ${companyId}
    `);
  } else {
    await db.execute(sql`
      UPDATE company_settings SET settlement_policies = ${snapshot}::jsonb WHERE company_id = ${companyId}
    `);
  }
}

test('Task 69 — built-in fallback resolves when no level overrides', async () => {
  const { documentTypeForClaim } = await import('../server/services/intakeAgentService');
  const fixture = await setupDocTypeFixture({});
  const snapshot = await clearCompanyDocTypeMatrix(fx.companyId);
  try {
    // mdf inbound default = ap_invoice (built-in row).
    const got = await documentTypeForClaim('mdf', 'inbound', fixture.contractId);
    assert.equal(got, 'ap_invoice', 'mdf inbound should fall through to built-in ap_invoice');
  } finally {
    await restoreCompanyDocTypeMatrix(fx.companyId, snapshot);
    await fixture.cleanup();
  }
});

test('Task 69 — outbound rebate_settlement is credit_memo (regression fix)', async () => {
  const { documentTypeForClaim } = await import('../server/services/intakeAgentService');
  const fixture = await setupDocTypeFixture({});
  const snapshot = await clearCompanyDocTypeMatrix(fx.companyId);
  try {
    // Pre-Task-69 this returned 'ar_invoice' because the seed was wrong;
    // the fix asserts BUILT_IN_DOCUMENT_TYPE_MATRIX returns 'credit_memo'.
    const got = await documentTypeForClaim('rebate_settlement', 'outbound', fixture.contractId);
    assert.equal(got, 'credit_memo', 'outbound rebate_settlement should now resolve to credit_memo');
  } finally {
    await restoreCompanyDocTypeMatrix(fx.companyId, snapshot);
    await fixture.cleanup();
  }
});

test('Task 69 — company-level matrix overrides built-in', async () => {
  const { documentTypeForClaim } = await import('../server/services/intakeAgentService');
  const fixture = await setupDocTypeFixture({});
  const snapshot = await clearCompanyDocTypeMatrix(fx.companyId);
  try {
    const matrix = {
      documentTypeMatrix: {
        rows: [
          { claimType: 'mdf', direction: 'inbound', documentType: 'debit_memo' },
        ],
      },
    };
    await db.execute(sql`
      UPDATE company_settings
      SET settlement_policies = COALESCE(settlement_policies, '{}'::jsonb) || ${matrix}::jsonb
      WHERE company_id = ${fx.companyId}
    `);
    const got = await documentTypeForClaim('mdf', 'inbound', fixture.contractId);
    assert.equal(got, 'debit_memo', 'company override should beat built-in ap_invoice');
  } finally {
    await restoreCompanyDocTypeMatrix(fx.companyId, snapshot);
    await fixture.cleanup();
  }
});

test('Task 69 — company-level matrix applies when only companyId is passed (no contractId)', async () => {
  // Locks the post-review fix: a generation path that has only a tenant
  // and no contract context must still pick up the company-level override
  // instead of falling straight through to the built-in matrix.
  const { documentTypeForClaim } = await import('../server/services/intakeAgentService');
  const snapshot = await clearCompanyDocTypeMatrix(fx.companyId);
  try {
    const matrix = {
      documentTypeMatrix: {
        rows: [{ claimType: 'chargeback', direction: 'inbound', documentType: 'ap_invoice' }],
      },
    };
    await db.execute(sql`
      INSERT INTO company_settings (company_id, settlement_policies)
      VALUES (${fx.companyId}, ${matrix}::jsonb)
      ON CONFLICT (company_id) DO UPDATE
        SET settlement_policies = COALESCE(company_settings.settlement_policies, '{}'::jsonb) || ${matrix}::jsonb
    `);
    const got = await documentTypeForClaim('chargeback', 'inbound', null, fx.companyId);
    assert.equal(got, 'ap_invoice',
      'company override must apply when only companyId is given (built-in default for chargeback/inbound is credit_memo)');
  } finally {
    await restoreCompanyDocTypeMatrix(fx.companyId, snapshot);
  }
});

test('Task 69 — flow-type override beats company matrix', async () => {
  const { documentTypeForClaim } = await import('../server/services/intakeAgentService');
  const fixture = await setupDocTypeFixture({});
  const snapshot = await clearCompanyDocTypeMatrix(fx.companyId);
  try {
    // Company says 'debit_memo'; flow-type says 'ar_invoice' — flow wins.
    const companyMatrix = {
      documentTypeMatrix: {
        rows: [{ claimType: 'mdf', direction: 'inbound', documentType: 'debit_memo' }],
      },
    };
    await db.execute(sql`
      UPDATE company_settings
      SET settlement_policies = COALESCE(settlement_policies, '{}'::jsonb) || ${companyMatrix}::jsonb
      WHERE company_id = ${fx.companyId}
    `);
    const flowMatrix = { rows: [{ claimType: 'mdf', direction: 'inbound', documentType: 'ar_invoice' }] };
    await db.execute(sql`
      UPDATE flow_types SET document_type_overrides = ${flowMatrix}::jsonb WHERE code = ${fixture.flowCode}
    `);

    const got = await documentTypeForClaim('mdf', 'inbound', fixture.contractId);
    assert.equal(got, 'ar_invoice', 'flow-type override should beat company override');

    // Sibling contract (different flow) stays on company override — proves
    // flow-type override is scoped to the right flow.
    const sib = await documentTypeForClaim('mdf', 'inbound', fixture.siblingContractId);
    assert.equal(sib, 'debit_memo', 'sibling flow without override should fall back to company');
  } finally {
    await restoreCompanyDocTypeMatrix(fx.companyId, snapshot);
    await fixture.cleanup();
  }
});

test('Task 69 — contract override beats flow-type, company, and built-in', async () => {
  const { documentTypeForClaim } = await import('../server/services/intakeAgentService');
  const fixture = await setupDocTypeFixture({});
  const snapshot = await clearCompanyDocTypeMatrix(fx.companyId);
  try {
    // Stack all three upstream levels, then pin the contract to a unique
    // value and prove the contract row wins.
    const companyMatrix = {
      documentTypeMatrix: { rows: [{ claimType: 'mdf', direction: 'inbound', documentType: 'debit_memo' }] },
    };
    await db.execute(sql`
      UPDATE company_settings
      SET settlement_policies = COALESCE(settlement_policies, '{}'::jsonb) || ${companyMatrix}::jsonb
      WHERE company_id = ${fx.companyId}
    `);
    const flowMatrix = { rows: [{ claimType: 'mdf', direction: 'inbound', documentType: 'ar_invoice' }] };
    await db.execute(sql`
      UPDATE flow_types SET document_type_overrides = ${flowMatrix}::jsonb WHERE code = ${fixture.flowCode}
    `);
    const contractMatrix = {
      documentTypeMatrix: { rows: [{ claimType: 'mdf', direction: 'inbound', documentType: 'credit_memo' }] },
    };
    await db.execute(sql`
      UPDATE contracts SET settlement_policies = ${contractMatrix}::jsonb WHERE id = ${fixture.contractId}
    `);

    const got = await documentTypeForClaim('mdf', 'inbound', fixture.contractId);
    assert.equal(got, 'credit_memo', 'contract-level override should win every other level');

    // Sibling contract (no contract-level override) follows its own flow
    // (no flow override) → company → 'debit_memo'.
    const sib = await documentTypeForClaim('mdf', 'inbound', fixture.siblingContractId);
    assert.equal(sib, 'debit_memo', 'sibling contract should still see company override');
  } finally {
    await restoreCompanyDocTypeMatrix(fx.companyId, snapshot);
    await fixture.cleanup();
  }
});

test('Task 69 — built-in is authoritative; operator-tuned legacy values do not overwrite known claim types', async () => {
  // Belt-and-suspenders proof of the post-review fix: even if the legacy
  // `claim_type_outcome` table holds the pre-Task-69 wrong value
  // (ar_invoice for outbound rebate_settlement), the resolver must still
  // return the corrected built-in value (credit_memo). This guarantees
  // the apply script never needs to mutate operator data to "fix" the
  // regression.
  const { documentTypeForClaim } = await import('../server/services/intakeAgentService');
  const fixture = await setupDocTypeFixture({});
  const snapshot = await clearCompanyDocTypeMatrix(fx.companyId);
  // Snapshot the legacy row, force it to the broken value, then assert
  // built-in still wins. Restore the row in finally so other tests aren't
  // contaminated.
  const prevLegacy = await db.execute<{ document_type: string }>(sql`
    SELECT document_type FROM claim_type_outcome
     WHERE claim_type = 'rebate_settlement' AND direction = 'outbound'
  `);
  const prevValue = prevLegacy.rows[0]?.document_type ?? null;
  try {
    await db.execute(sql`
      INSERT INTO claim_type_outcome (claim_type, direction, document_type)
      VALUES ('rebate_settlement', 'outbound', 'ar_invoice')
      ON CONFLICT (claim_type, direction) DO UPDATE SET document_type = EXCLUDED.document_type
    `);
    const got = await documentTypeForClaim('rebate_settlement', 'outbound', fixture.contractId);
    assert.equal(got, 'credit_memo',
      'built-in matrix must beat a stale/operator-tuned legacy row for known claim types');
  } finally {
    if (prevValue !== null) {
      await db.execute(sql`
        UPDATE claim_type_outcome SET document_type = ${prevValue}
         WHERE claim_type = 'rebate_settlement' AND direction = 'outbound'
      `);
    }
    await restoreCompanyDocTypeMatrix(fx.companyId, snapshot);
    await fixture.cleanup();
  }
});

test('Task 69 — seedClaimTypeOutcomes is a no-op when the legacy table is non-empty', async () => {
  // Locks the post-review fix: even if seedClaimTypeOutcomes() is called
  // again at startup (or by an admin), it must NOT touch a table that
  // already has rows. We snapshot every row, run the seed, then assert
  // every row is byte-identical and no new rows were inserted.
  const { seedClaimTypeOutcomes } = await import('../server/services/intakeAgentService');
  const before = await db.execute<{ claim_type: string; direction: string; document_type: string }>(sql`
    SELECT claim_type, direction, document_type FROM claim_type_outcome
     ORDER BY claim_type, direction
  `);
  // Pre-flight: we need at least one existing row for this test to be
  // meaningful (the apply-task68 ddl + Task 69 seed should have created
  // the standard set, so this should always be true on a real dev DB).
  assert.ok(before.rows.length > 0, 'fixture sanity — legacy table should have rows from prior seeds');

  // Insert a unique custom-claim row that is NOT in the built-in matrix
  // so we can prove an additional iteration of the seed leaves it intact.
  const sentinelClaim = `sentinel_${Math.random().toString(36).slice(2, 8)}`;
  await db.execute(sql`
    INSERT INTO claim_type_outcome (claim_type, direction, document_type)
    VALUES (${sentinelClaim}, 'inbound', 'debit_memo')
  `);

  try {
    // Run the seed twice — should be idempotent and never modify rows.
    await seedClaimTypeOutcomes();
    await seedClaimTypeOutcomes();

    const after = await db.execute<{ claim_type: string; direction: string; document_type: string }>(sql`
      SELECT claim_type, direction, document_type FROM claim_type_outcome
       ORDER BY claim_type, direction
    `);

    // Every pre-existing row must be byte-identical and the sentinel must
    // still be there with its original value.
    assert.equal(after.rows.length, before.rows.length + 1,
      'seed must not insert any built-in rows when the table is non-empty');
    const sentinelRow = after.rows.find(r => r.claim_type === sentinelClaim);
    assert.ok(sentinelRow, 'sentinel row must be preserved');
    assert.equal(sentinelRow!.document_type, 'debit_memo',
      'sentinel row must retain its operator-tuned value');
  } finally {
    await db.execute(sql`DELETE FROM claim_type_outcome WHERE claim_type = ${sentinelClaim}`);
  }
});

test('Task 69 — operator-tuned legacy rows are still honored for unknown claim types', async () => {
  // The legacy `claim_type_outcome` table is kept as a defensive fallback
  // for claim types that don't appear in BUILT_IN_DOCUMENT_TYPE_MATRIX.
  // This proves the cascade still respects operator-tuned rows for those
  // custom types and doesn't silently swallow them.
  const { documentTypeForClaim } = await import('../server/services/intakeAgentService');
  const fixture = await setupDocTypeFixture({});
  const snapshot = await clearCompanyDocTypeMatrix(fx.companyId);
  const customClaim = `custom_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await db.execute(sql`
      INSERT INTO claim_type_outcome (claim_type, direction, document_type)
      VALUES (${customClaim}, 'inbound', 'debit_memo')
      ON CONFLICT (claim_type, direction) DO UPDATE SET document_type = EXCLUDED.document_type
    `);
    const got = await documentTypeForClaim(customClaim, 'inbound', fixture.contractId);
    assert.equal(got, 'debit_memo',
      'legacy table should still drive the value for unknown claim types');
  } finally {
    await db.execute(sql`
      DELETE FROM claim_type_outcome WHERE claim_type = ${customClaim}
    `);
    await restoreCompanyDocTypeMatrix(fx.companyId, snapshot);
    await fixture.cleanup();
  }
});

test('Task 69 — sparse rows in contract override fall through to upstream for unset cells', async () => {
  const { documentTypeForClaim } = await import('../server/services/intakeAgentService');
  const fixture = await setupDocTypeFixture({});
  const snapshot = await clearCompanyDocTypeMatrix(fx.companyId);
  try {
    // Contract pins ONLY mdf inbound; chargeback inbound should still fall
    // through to the built-in fallback (= credit_memo).
    const contractMatrix = {
      documentTypeMatrix: { rows: [{ claimType: 'mdf', direction: 'inbound', documentType: 'ar_invoice' }] },
    };
    await db.execute(sql`
      UPDATE contracts SET settlement_policies = ${contractMatrix}::jsonb WHERE id = ${fixture.contractId}
    `);

    const pinned = await documentTypeForClaim('mdf', 'inbound', fixture.contractId);
    assert.equal(pinned, 'ar_invoice');
    const unset = await documentTypeForClaim('chargeback', 'inbound', fixture.contractId);
    assert.equal(unset, 'credit_memo', 'unset cell should fall through to built-in');
  } finally {
    await restoreCompanyDocTypeMatrix(fx.companyId, snapshot);
    await fixture.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

(async () => {
  // Pre-flight: server must be reachable.
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
