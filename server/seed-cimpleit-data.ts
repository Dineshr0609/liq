import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import {
  companies,
  businessUnits,
  locations,
  licenseiqEntityRecords,
  erpEntityRecords,
  pendingTermMappings,
  masterDataMappings,
} from "@shared/schema";

const SOURCE_COMPANY_ID = "40405694-298f-41bf-b0f7-c623c80475e7";
const TARGET_COMPANY_ID = "50536355-2c01-49a3-865f-a069c1ff8f76";

export async function seedCimpleitData() {
  console.log("🌱 Checking CimpleIT Inc. schema data...");

  let [targetCompany] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, TARGET_COMPANY_ID))
    .limit(1);
  if (!targetCompany) {
    console.log("🏢 CimpleIT Inc. not found in companies table, creating it...");
    const adminUsers = await db.execute(
      sql`SELECT id FROM users WHERE username = 'admin' OR role = 'owner' OR role = 'admin' LIMIT 1`
    );
    const creatorId = (adminUsers.rows[0] as any)?.id;
    if (!creatorId) {
      console.log("⏭️ No admin user found to create CimpleIT Inc., skipping");
      return;
    }
    await db.insert(companies).values({
      id: TARGET_COMPANY_ID,
      companyName: "CimpleIT Inc.",
      companyDescr: "Technology solutions and software licensing company",
      city: "Austin",
      stateProvince: "TX",
      country: "United States",
      status: "A",
      createdBy: creatorId,
      lastUpdatedBy: creatorId,
    }).onConflictDoNothing();
    [targetCompany] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, TARGET_COMPANY_ID))
      .limit(1);
    if (targetCompany) {
      console.log("✅ CimpleIT Inc. company created successfully");
    } else {
      console.log("⚠️ Failed to create CimpleIT Inc., skipping data copy");
      return;
    }
  }

  const existingTerms = await db
    .select({ id: pendingTermMappings.id })
    .from(pendingTermMappings)
    .where(eq(pendingTermMappings.companyId, TARGET_COMPANY_ID))
    .limit(1);

  const existingBUs = await db
    .select()
    .from(businessUnits)
    .where(eq(businessUnits.companyId, TARGET_COMPANY_ID));

  if (existingBUs.length > 0 && existingTerms.length > 0) {
    console.log("✓ CimpleIT Inc. already has schema data, skipping copy");
    return;
  }

  const [sourceCompany] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, SOURCE_COMPANY_ID))
    .limit(1);
  if (!sourceCompany) {
    console.log("⏭️ TechSound Audio Inc. not found, skipping data copy");
    return;
  }

  const adminUsers = await db.execute(
    sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`
  );
  const adminUserId = (adminUsers.rows[0] as any)?.id;
  if (!adminUserId) {
    console.log("⏭️ Admin user not found, skipping data copy");
    return;
  }

  const sourceBUs = await db
    .select()
    .from(businessUnits)
    .where(eq(businessUnits.companyId, SOURCE_COMPANY_ID));
  let targetBUs = existingBUs;
  const buIdMap: Record<string, string> = {};

  if (targetBUs.length === 0 && sourceBUs.length > 0) {
    for (const bu of sourceBUs) {
      const newBuId = `ci-${bu.id.replace(/^ts-/, "")}`;
      await db
        .insert(businessUnits)
        .values({
          id: newBuId,
          companyId: TARGET_COMPANY_ID,
          orgName: bu.orgName,
          orgDescr: `Copied from TechSound Audio Inc.`,
          status: "A",
          createdBy: adminUserId,
          lastUpdatedBy: adminUserId,
        })
        .onConflictDoNothing();
      buIdMap[bu.id] = newBuId;
    }
    targetBUs = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.companyId, TARGET_COMPANY_ID));
    console.log(`  ✓ Created ${targetBUs.length} business units for CimpleIT`);
  } else {
    for (let i = 0; i < sourceBUs.length; i++) {
      buIdMap[sourceBUs[i].id] =
        targetBUs[i % targetBUs.length]?.id || targetBUs[0]?.id;
    }
  }

  const sourceLocs = await db
    .select()
    .from(locations)
    .where(eq(locations.companyId, SOURCE_COMPANY_ID));
  let targetLocs = await db
    .select()
    .from(locations)
    .where(eq(locations.companyId, TARGET_COMPANY_ID));
  const locIdMap: Record<string, string> = {};

  if (targetLocs.length === 0 && sourceLocs.length > 0) {
    for (const loc of sourceLocs) {
      const parentBuId = buIdMap[loc.orgId] || targetBUs[0]?.id;
      const newLocId = `ci-${loc.id.replace(/^ts-/, "")}`;
      await db
        .insert(locations)
        .values({
          id: newLocId,
          companyId: TARGET_COMPANY_ID,
          orgId: parentBuId,
          locName: loc.locName,
          locDescr: `Copied from TechSound Audio Inc.`,
          status: "A",
          createdBy: adminUserId,
          lastUpdatedBy: adminUserId,
        })
        .onConflictDoNothing();
      locIdMap[loc.id] = newLocId;
    }
    targetLocs = await db
      .select()
      .from(locations)
      .where(eq(locations.companyId, TARGET_COMPANY_ID));
    console.log(`  ✓ Created ${targetLocs.length} locations for CimpleIT`);
  } else {
    for (let i = 0; i < sourceLocs.length; i++) {
      locIdMap[sourceLocs[i].id] =
        targetLocs[i % targetLocs.length]?.id || targetLocs[0]?.id;
    }
  }

  if (targetBUs.length === 0 || targetLocs.length === 0) {
    console.log(
      "⚠️ No business units or locations available for CimpleIT, cannot copy entity records"
    );
    return;
  }

  const entityRecords = await db
    .select()
    .from(licenseiqEntityRecords)
    .where(eq(licenseiqEntityRecords.grpId, SOURCE_COMPANY_ID));
  let entityCopied = 0;
  for (const rec of entityRecords) {
    await db.insert(licenseiqEntityRecords).values({
      entityId: rec.entityId,
      recordData: rec.recordData,
      grpId: TARGET_COMPANY_ID,
      orgId: buIdMap[rec.orgId] || targetBUs[0]?.id,
      locId: locIdMap[rec.locId] || targetLocs[0]?.id,
    });
    entityCopied++;
  }

  const erpRecords = await db
    .select()
    .from(erpEntityRecords)
    .where(eq(erpEntityRecords.companyId, SOURCE_COMPANY_ID));
  let erpCopied = 0;
  for (const rec of erpRecords) {
    await db.insert(erpEntityRecords).values({
      entityId: rec.entityId,
      data: rec.data,
      companyId: TARGET_COMPANY_ID,
      businessUnitId: rec.businessUnitId
        ? buIdMap[rec.businessUnitId] || targetBUs[0]?.id
        : null,
      locationId: rec.locationId
        ? locIdMap[rec.locationId] || targetLocs[0]?.id
        : null,
      createdBy: adminUserId,
    });
    erpCopied++;
  }

  const sourceTermMappings = await db
    .select()
    .from(pendingTermMappings)
    .where(eq(pendingTermMappings.companyId, SOURCE_COMPANY_ID));
  let termsCopied = 0;
  for (const tm of sourceTermMappings) {
    const { id, ...rest } = tm;
    await db.insert(pendingTermMappings).values({
      ...rest,
      companyId: TARGET_COMPANY_ID,
      contractId: null,
    });
    termsCopied++;
  }

  const mdMappings = await db
    .select()
    .from(masterDataMappings)
    .where(eq(masterDataMappings.companyId, SOURCE_COMPANY_ID));
  let mdCopied = 0;
  for (const md of mdMappings) {
    const { id, ...rest } = md;
    await db.insert(masterDataMappings).values({
      ...rest,
      companyId: TARGET_COMPANY_ID,
      businessUnitId: md.businessUnitId
        ? buIdMap[md.businessUnitId] || null
        : null,
      locationId: md.locationId ? locIdMap[md.locationId] || null : null,
    });
    mdCopied++;
  }

  const existingOrgRole = await db.execute(
    sql`SELECT id FROM user_organization_roles WHERE user_id = ${adminUserId} AND company_id = ${TARGET_COMPANY_ID} LIMIT 1`
  );
  if (existingOrgRole.rows.length === 0) {
    await db.execute(
      sql`INSERT INTO user_organization_roles (id, user_id, company_id, role, status, created_by, last_updated_by, creation_date, last_update_date) 
          VALUES (gen_random_uuid(), ${adminUserId}, ${TARGET_COMPANY_ID}, 'admin', 'A', ${adminUserId}, ${adminUserId}, NOW(), NOW()) 
          ON CONFLICT DO NOTHING`
    );
    console.log(`   ✓ Admin user assigned to CimpleIT Inc.`);
  }

  console.log(`✅ CimpleIT Inc. schema data copy complete:`);
  console.log(`   - Entity records: ${entityCopied}`);
  console.log(`   - ERP records: ${erpCopied}`);
  console.log(`   - Term mappings: ${termsCopied}`);
  console.log(`   - Master data mappings: ${mdCopied}`);
}
