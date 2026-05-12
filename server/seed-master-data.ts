/**
 * Master Data Seeding Module
 * 
 * Seeds all essential master data on server startup:
 * - Admin user
 * - Monrovia Nursery Company hierarchy (Company -> Business Units -> Locations)
 * - Admin role assignment
 * 
 * This runs automatically on every server start and is idempotent.
 */

import { db } from './db';
import { 
  users, 
  companies, 
  businessUnits, 
  locations, 
  userOrganizationRoles,
  contractTypeDefinitions,
  roles,
  licenseiqEntities,
  licenseiqEntityRecords,
  flowTypes,
  subtypes,
  flowTypePrompts,
  subtypePrompts
} from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { DEFAULT_EXTRACTION_PROMPTS } from './prompts/defaultContractTypePrompts';
import { DEFAULT_FLOW_TYPE_PROMPTS } from './prompts/defaultFlowTypePrompts';
import { DEFAULT_SUBTYPE_PROMPTS } from './prompts/defaultSubtypePrompts';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

export async function seedMasterData() {
  console.log('🌱 Seeding Master Data...');

  try {
    // ==========================================
    // STEP 1: Create System Admin User
    // ==========================================
    let adminUser = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
    
    const hashedPassword = await hashPassword('Admin@123!');
    
    if (adminUser.length === 0) {
      const [newAdmin] = await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@licenseiq.ai',
        role: 'admin',
        isSystemAdmin: true,
      }).returning();
      adminUser = [newAdmin];
      console.log('✓ System Admin user created (admin / Admin@123!)');
    } else {
      // Ensure admin has correct password and isSystemAdmin = true
      await db.update(users)
        .set({ 
          isSystemAdmin: true,
          password: hashedPassword,
          role: 'admin',
          email: 'admin@licenseiq.ai'
        })
        .where(eq(users.username, 'admin'));
      console.log('✓ System Admin user updated (admin / Admin@123!)');
    }

    const adminId = adminUser[0].id;

    // ==========================================
    // STEP 1B: Seed System Roles
    // ==========================================
    const systemRoles = [
      { roleName: 'admin', displayName: 'Administrator', description: 'Full system access', isSystemRole: true },
      { roleName: 'owner', displayName: 'Owner', description: 'Business owner with full access', isSystemRole: true },
      { roleName: 'manager', displayName: 'Manager', description: 'Team and contract management', isSystemRole: true },
      { roleName: 'editor', displayName: 'Editor', description: 'Can edit contracts and data', isSystemRole: true },
      { roleName: 'analyst', displayName: 'Analyst', description: 'Data analysis and reporting', isSystemRole: true },
      { roleName: 'auditor', displayName: 'Auditor', description: 'Access to audit trail and reports', isSystemRole: true },
      { roleName: 'accountant', displayName: 'Accountant', description: 'Financial data and audit access', isSystemRole: true },
      { roleName: 'viewer', displayName: 'Viewer', description: 'Read-only access', isSystemRole: true },
    ];

    let rolesCreated = 0;
    for (const role of systemRoles) {
      try {
        await db.insert(roles).values(role).onConflictDoUpdate({
          target: roles.roleName,
          set: { displayName: role.displayName, description: role.description, updatedAt: new Date() },
        });
        rolesCreated++;
      } catch (err) { }
    }
    console.log(`✓ ${rolesCreated} system roles seeded`);

    // ==========================================
    // STEP 2: Create Monrovia Nursery Company
    // ==========================================
    const MONROVIA_ID = 'monrovia-nursery-company';
    
    const existingCompany = await db.select().from(companies).where(eq(companies.id, MONROVIA_ID)).limit(1);
    
    if (existingCompany.length === 0) {
      await db.insert(companies).values({
        id: MONROVIA_ID,
        companyName: 'Monrovia Nursery Company',
        companyDescr: 'Leading wholesale grower of premium container plants in the United States. Agreements signed at company level cover all facilities for global reporting and fee payments.',
        address1: '18331 Peckham Rd',
        city: 'Dayton',
        stateProvince: 'Oregon',
        country: 'USA',
        contactPerson: 'Licensing Department',
        contactEmail: 'licensing@monrovia.com',
        contactPhone: '503-000-0000',
        contactPreference: 'email',
        status: 'A', // A=Active
        createdBy: adminId,
        lastUpdatedBy: adminId,
      });
      console.log('✓ Monrovia Nursery Company created');
    } else {
      console.log('✓ Monrovia Nursery Company already exists');
    }

    // ==========================================
    // STEP 3: Create Business Units (Divisions)
    // ==========================================
    const businessUnitsData = [
      {
        id: 'monrovia-branded',
        companyId: MONROVIA_ID,
        orgName: 'Monrovia Branded Division',
        orgDescr: 'Premium branded plant varieties requiring higher fee rates. Covers branded products with enhanced marketing and quality standards.',
        contactPerson: 'Branded Division Manager',
        contactEmail: 'branded@monrovia.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
      {
        id: 'wight-berryhill-nonbranded',
        companyId: MONROVIA_ID,
        orgName: 'Wight/Berryhill Non-Branded Division',
        orgDescr: 'Non-branded varieties with reduced fee rates or different terms. Covers generic products for wholesale distribution.',
        contactPerson: 'Non-Branded Division Manager',
        contactEmail: 'nonbranded@monrovia.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
    ];

    for (const bu of businessUnitsData) {
      const existing = await db.select().from(businessUnits).where(eq(businessUnits.id, bu.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(businessUnits).values(bu);
        console.log(`✓ Business Unit created: ${bu.orgName}`);
      }
    }

    // ==========================================
    // STEP 4: Create Locations (Nurseries)
    // ==========================================
    const locationsData = [
      {
        id: 'dayton-oregon-hq',
        companyId: MONROVIA_ID,
        orgId: 'monrovia-branded', // Headquarters - Branded Division
        locName: 'Dayton, Oregon (HQ)',
        locDescr: 'Corporate headquarters and primary production facility. Largest growing operation with full production capacity.',
        address1: '18331 Peckham Rd, Dayton, OR 97114',
        contactPerson: 'Oregon Facility Manager',
        contactEmail: 'dayton@monrovia.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
      {
        id: 'visalia-california',
        companyId: MONROVIA_ID,
        orgId: 'monrovia-branded', // Branded Division
        locName: 'Visalia, California',
        locDescr: 'California production facility serving West Coast markets. Specializes in warm-climate varieties.',
        address1: 'Visalia, CA',
        contactPerson: 'California Facility Manager',
        contactEmail: 'visalia@monrovia.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
      {
        id: 'cairo-georgia',
        companyId: MONROVIA_ID,
        orgId: 'monrovia-branded', // Branded Division
        locName: 'Cairo, Georgia',
        locDescr: 'Southeast production facility. Serves Eastern and Southern markets with region-appropriate varieties.',
        address1: 'Cairo, GA',
        contactPerson: 'Georgia Facility Manager',
        contactEmail: 'cairo@monrovia.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
      {
        id: 'north-carolina',
        companyId: MONROVIA_ID,
        orgId: 'wight-berryhill-nonbranded', // Non-Branded Division
        locName: 'North Carolina',
        locDescr: 'East Coast non-branded production facility. Focuses on wholesale distribution to regional garden centers.',
        address1: 'North Carolina',
        contactPerson: 'NC Facility Manager',
        contactEmail: 'nc@monrovia.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
      {
        id: 'ohio',
        companyId: MONROVIA_ID,
        orgId: 'wight-berryhill-nonbranded', // Non-Branded Division
        locName: 'Ohio',
        locDescr: 'Midwest non-branded production facility. Serves Midwest market with cold-hardy varieties.',
        address1: 'Ohio',
        contactPerson: 'Ohio Facility Manager',
        contactEmail: 'ohio@monrovia.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
    ];

    for (const loc of locationsData) {
      const existing = await db.select().from(locations).where(eq(locations.id, loc.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(locations).values(loc);
        console.log(`✓ Location created: ${loc.locName}`);
      }
    }

    // ==========================================
    // STEP 5: Assign Admin to Monrovia Company
    // ==========================================
    const existingRole = await db.select()
      .from(userOrganizationRoles)
      .where(
        and(
          eq(userOrganizationRoles.userId, adminId),
          eq(userOrganizationRoles.companyId, MONROVIA_ID)
        )
      )
      .limit(1);
    
    if (existingRole.length === 0) {
      await db.insert(userOrganizationRoles).values({
        userId: adminId,
        companyId: MONROVIA_ID,
        businessUnitId: null, // Company-level access (all BUs)
        locationId: null, // All locations
        role: 'owner',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      });
      console.log('✓ Admin assigned as Owner to Monrovia Nursery Company');
    }

    // ==========================================
    // STEP 6: Seed Contract Type Definitions
    // ==========================================
    const contractTypes = [
      { code: 'distributor_reseller_program', name: 'Distributor / Reseller Program', description: 'Contracts for distributor and reseller channel programs including rebates, incentives, and partner agreements', sortOrder: 1 },
      { code: 'licensing_royalty', name: 'Licensing / Royalty', description: 'Intellectual property licensing and fee agreements with percentage or per-unit fee structures', sortOrder: 2 },
      { code: 'ib_rebate', name: 'IB Rebate / Incentive', description: 'Inbound rebate or incentive programs from suppliers/vendors', sortOrder: 3 },
      { code: 'ob_rebate', name: 'OB Rebate / Incentive', description: 'Outbound rebate or incentive programs to customers/distributors', sortOrder: 3 },
      { code: 'price_protection_chargeback', name: 'Price Protection / Chargeback', description: 'Price protection claims, chargeback processing, and price adjustment agreements', sortOrder: 4 },
      { code: 'revenue_share_marketplace', name: 'Revenue Share / Marketplace', description: 'Revenue sharing, marketplace commissions, and platform-based sales agreements', sortOrder: 5 },
      { code: 'mdf', name: 'MDF (Market Development Fund)', description: 'Market Development Fund agreements for co-marketing and promotional activities', sortOrder: 6 },
      { code: 'mixed_commercial_agreement', name: 'Mixed Commercial Agreement', description: 'Contracts containing multiple financial flow types across different categories', sortOrder: 7 },
      { code: 'unknown', name: 'Unknown', description: 'Unclassified contract type pending review or AI auto-detection', sortOrder: 8 },
    ];

    let newContractTypes = 0;
    let updatedPrompts = 0;
    for (const ct of contractTypes) {
      const existing = await db.select().from(contractTypeDefinitions).where(eq(contractTypeDefinitions.code, ct.code)).limit(1);
      const defaultPrompts = DEFAULT_EXTRACTION_PROMPTS[ct.code];
      
      if (existing.length === 0) {
        await db.insert(contractTypeDefinitions).values({
          code: ct.code,
          name: ct.name,
          description: ct.description,
          isSystemType: true,
          isActive: true,
          sortOrder: ct.sortOrder,
          extractionPrompt: defaultPrompts?.extractionPrompt || null,
          ruleExtractionPrompt: defaultPrompts?.ruleExtractionPrompt || null,
          erpMappingPrompt: defaultPrompts?.erpMappingPrompt || null,
          sampleExtractionOutput: defaultPrompts?.sampleExtractionOutput || null,
        });
        newContractTypes++;
      } else if (defaultPrompts && !existing[0].extractionPrompt) {
        // Update existing contract types with default prompts if they don't have prompts yet
        await db.update(contractTypeDefinitions)
          .set({
            extractionPrompt: defaultPrompts.extractionPrompt,
            ruleExtractionPrompt: defaultPrompts.ruleExtractionPrompt,
            erpMappingPrompt: defaultPrompts.erpMappingPrompt,
            sampleExtractionOutput: defaultPrompts.sampleExtractionOutput,
            updatedAt: new Date(),
          })
          .where(eq(contractTypeDefinitions.code, ct.code));
        updatedPrompts++;
      }
    }
    const deprecatedCodes = ['rebate_incentive'];
    for (const oldCode of deprecatedCodes) {
      const exists = await db.select().from(contractTypeDefinitions).where(eq(contractTypeDefinitions.code, oldCode)).limit(1);
      if (exists.length > 0) {
        await db.delete(contractTypeDefinitions).where(eq(contractTypeDefinitions.code, oldCode));
        console.log(`✓ Removed deprecated contract type: ${oldCode} (replaced by ib_rebate/ob_rebate)`);
      }
    }

    if (newContractTypes > 0) {
      console.log(`✓ Created ${newContractTypes} contract type definitions`);
    }
    if (updatedPrompts > 0) {
      console.log(`✓ Updated ${updatedPrompts} contract types with default prompts`);
    }

    // ==========================================
    // STEP 6b: Subflows table was retired. The new taxonomy uses
    // flow_types + subtypes + flow_subtype_validity, all administered
    // from the Contract Reference Lookups page. No-op kept here for
    // numbering continuity with downstream steps.
    // ==========================================

    // ==========================================
    // STEP 6c: Seed Flow Type Prompts (Pass 1 of AI Prompt Registry)
    //   Idempotent: only insert when no row exists for the flow_type_code.
    //   Existing rows are NEVER overwritten so admin edits survive restarts.
    // ==========================================
    {
      const activeFlows = await db.select({ code: flowTypes.code }).from(flowTypes);
      let newFlowPrompts = 0;
      for (const f of activeFlows) {
        const defaults = DEFAULT_FLOW_TYPE_PROMPTS[f.code];
        if (!defaults) continue;
        const existing = await db.select({ id: flowTypePrompts.id })
          .from(flowTypePrompts)
          .where(eq(flowTypePrompts.flowTypeCode, f.code))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(flowTypePrompts).values({
            flowTypeCode: f.code,
            extractionPrompt: defaults.extractionPrompt,
            ruleExtractionPrompt: defaults.ruleExtractionPrompt,
            erpMappingPrompt: defaults.erpMappingPrompt,
            sampleExtractionOutput: defaults.sampleExtractionOutput,
            ragExtractionPrompt: defaults.ragExtractionPrompt ?? null,
            ragRuleExtractionPrompt: defaults.ragRuleExtractionPrompt ?? null,
            ragSampleExtractionOutput: defaults.ragSampleExtractionOutput ?? null,
            isActive: true,
          });
          newFlowPrompts++;
        }
      }
      if (newFlowPrompts > 0) {
        console.log(`✓ Seeded ${newFlowPrompts} flow-type prompt template(s)`);
      }
    }

    // ==========================================
    // STEP 6d: Seed Subtype / Program Prompts (Pass 1 of AI Prompt Registry)
    //   Idempotent: only insert when no row exists for the subtype_code.
    // ==========================================
    {
      const activeSubtypes = await db.select({ code: subtypes.code }).from(subtypes);
      let newSubtypePrompts = 0;
      for (const s of activeSubtypes) {
        const defaults = DEFAULT_SUBTYPE_PROMPTS[s.code];
        if (!defaults) continue;
        const existing = await db.select({ id: subtypePrompts.id })
          .from(subtypePrompts)
          .where(eq(subtypePrompts.subtypeCode, s.code))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(subtypePrompts).values({
            subtypeCode: s.code,
            extractionPrompt: defaults.extractionPrompt,
            ruleExtractionPrompt: defaults.ruleExtractionPrompt,
            erpMappingPrompt: defaults.erpMappingPrompt,
            sampleExtractionOutput: defaults.sampleExtractionOutput,
            ragExtractionPrompt: defaults.ragExtractionPrompt ?? null,
            ragRuleExtractionPrompt: defaults.ragRuleExtractionPrompt ?? null,
            ragSampleExtractionOutput: defaults.ragSampleExtractionOutput ?? null,
            isActive: true,
          });
          newSubtypePrompts++;
        }
      }
      if (newSubtypePrompts > 0) {
        console.log(`✓ Seeded ${newSubtypePrompts} subtype/program prompt template(s)`);
      }
    }


    // ==========================================
    // STEP 7: Create TechSound Audio Inc.
    // ==========================================
    const existingTechSound = await db.select().from(companies).where(eq(companies.companyName, 'TechSound Audio Inc.')).limit(1);

    let TECHSOUND_ID: string;
    if (existingTechSound.length === 0) {
      const [newTs] = await db.insert(companies).values({
        companyName: 'TechSound Audio Inc.',
        companyDescr: 'Consumer electronics manufacturer specializing in audio products including headphones, speakers, soundbars, and professional audio equipment.',
        address1: '100 Audio Way',
        city: 'San Francisco',
        stateProvince: 'California',
        country: 'USA',
        contactPerson: 'Contract Administration',
        contactEmail: 'contracts@techsoundaudio.com',
        contactPhone: '415-555-0100',
        contactPreference: 'email',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      }).returning();
      TECHSOUND_ID = newTs.id;
      console.log('✓ TechSound Audio Inc. created');
    } else {
      TECHSOUND_ID = existingTechSound[0].id;
      console.log('✓ TechSound Audio Inc. already exists');
    }

    const tsBusinessUnits = [
      {
        id: 'ts-consumer-audio',
        companyId: TECHSOUND_ID,
        orgName: 'Consumer Audio Division',
        orgDescr: 'Consumer-facing audio products including wireless headphones, portable speakers, and home soundbars.',
        contactPerson: 'Consumer Division Manager',
        contactEmail: 'consumer@techsoundaudio.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
      {
        id: 'ts-professional-audio',
        companyId: TECHSOUND_ID,
        orgName: 'Professional Audio Division',
        orgDescr: 'Professional-grade audio equipment for studios, live events, and commercial installations.',
        contactPerson: 'Pro Audio Division Manager',
        contactEmail: 'proaudio@techsoundaudio.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
    ];

    for (const bu of tsBusinessUnits) {
      const existing = await db.select().from(businessUnits).where(eq(businessUnits.id, bu.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(businessUnits).values(bu);
        console.log(`✓ TechSound BU created: ${bu.orgName}`);
      }
    }

    const tsLocations = [
      {
        id: 'ts-sf-hq',
        companyId: TECHSOUND_ID,
        orgId: 'ts-consumer-audio',
        locName: 'San Francisco HQ',
        locDescr: 'Corporate headquarters and primary operations center.',
        address1: '100 Audio Way, San Francisco, CA 94105',
        contactPerson: 'SF Office Manager',
        contactEmail: 'sf@techsoundaudio.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
      {
        id: 'ts-austin-tx',
        companyId: TECHSOUND_ID,
        orgId: 'ts-professional-audio',
        locName: 'Austin, TX Office',
        locDescr: 'Professional audio R&D and distribution center.',
        address1: '200 Music Lane, Austin, TX 78701',
        contactPerson: 'Austin Office Manager',
        contactEmail: 'austin@techsoundaudio.com',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      },
    ];

    for (const loc of tsLocations) {
      const existing = await db.select().from(locations).where(eq(locations.id, loc.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(locations).values(loc);
        console.log(`✓ TechSound Location created: ${loc.locName}`);
      }
    }

    const existingTsRole = await db.select()
      .from(userOrganizationRoles)
      .where(
        and(
          eq(userOrganizationRoles.userId, adminId),
          eq(userOrganizationRoles.companyId, TECHSOUND_ID)
        )
      )
      .limit(1);

    if (existingTsRole.length === 0) {
      await db.insert(userOrganizationRoles).values({
        userId: adminId,
        companyId: TECHSOUND_ID,
        businessUnitId: null,
        locationId: null,
        role: 'owner',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      });
      console.log('✓ Admin assigned as Owner to TechSound Audio Inc.');
    }

    // ==========================================
    // STEP 8: Create Accountant User (assigned to TechSound)
    // ==========================================
    let accountantUser = await db.select().from(users).where(eq(users.username, 'accountant')).limit(1);
    const accountantPassword = await hashPassword('password123');

    if (accountantUser.length === 0) {
      const [newAccountant] = await db.insert(users).values({
        username: 'accountant',
        password: accountantPassword,
        email: 'accountant@licenseiq.com',
        role: 'accountant',
        isSystemAdmin: false,
      }).returning();
      accountantUser = [newAccountant];
      console.log('✓ Accountant user created (accountant / password123)');
    } else {
      await db.update(users)
        .set({
          password: accountantPassword,
          role: 'accountant',
        })
        .where(eq(users.username, 'accountant'));
      console.log('✓ Accountant user updated (accountant / password123)');
    }

    const accountantId = accountantUser[0].id;

    const existingAccountantRole = await db.select()
      .from(userOrganizationRoles)
      .where(
        and(
          eq(userOrganizationRoles.userId, accountantId),
          eq(userOrganizationRoles.companyId, TECHSOUND_ID)
        )
      )
      .limit(1);

    if (existingAccountantRole.length === 0) {
      await db.insert(userOrganizationRoles).values({
        userId: accountantId,
        companyId: TECHSOUND_ID,
        businessUnitId: null,
        locationId: null,
        role: 'accountant',
        status: 'A',
        createdBy: adminId,
        lastUpdatedBy: adminId,
      });
      console.log('✓ Accountant assigned to TechSound Audio Inc.');
    }

    const productsEntity = await db.select().from(licenseiqEntities).where(eq(licenseiqEntities.technicalName, 'products')).limit(1);
    if (productsEntity.length > 0) {
      const productsEntityId = productsEntity[0].id;

      const techSoundProducts = [
        { sku: 'TS-BTS-100', product_name: 'Bluetooth Speaker Pro', product_category: 'Bluetooth Speakers', product_status: 'Active', list_price: '149.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-BTS-200', product_name: 'Bluetooth Speaker Ultra', product_category: 'Bluetooth Speakers', product_status: 'Active', list_price: '249.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-HP-100', product_name: 'Wireless Headphones Classic', product_category: 'Headphones', product_status: 'Active', list_price: '79.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-HP-200', product_name: 'Wireless Headphones Premium', product_category: 'Headphones', product_status: 'Active', list_price: '199.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-HP-300', product_name: 'Studio Headphones Pro', product_category: 'Headphones', product_status: 'Active', list_price: '349.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-SB-100', product_name: 'Home Theater Soundbar', product_category: 'Soundbars', product_status: 'Active', list_price: '299.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-SB-200', product_name: 'Premium Dolby Soundbar', product_category: 'Soundbars', product_status: 'Active', list_price: '499.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-AMP-100', product_name: 'Desktop Amplifier', product_category: 'Amplifiers', product_status: 'Active', list_price: '179.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-AMP-200', product_name: 'Studio Reference Amplifier', product_category: 'Amplifiers', product_status: 'Active', list_price: '599.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-MIC-100', product_name: 'USB Condenser Microphone', product_category: 'Microphones', product_status: 'Active', list_price: '89.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-MIC-200', product_name: 'Studio Microphone XLR', product_category: 'Microphones', product_status: 'Active', list_price: '249.99', base_unit_of_measure: 'EA' },
        { sku: 'TS-PS-100', product_name: 'Portable Speaker Mini', product_category: 'Portable Speakers', product_status: 'Active', list_price: '59.99', base_unit_of_measure: 'EA' },
      ];

      const superLensesProducts = [
        { sku: 'SL-HP-100', product_name: 'Super Lenses Headphones', product_category: 'Headphones', product_status: 'Active', list_price: '79.99', base_unit_of_measure: 'EA' },
        { sku: 'SL-HP-200', product_name: 'Super Lenses Headphones Pro', product_category: 'Headphones', product_status: 'Active', list_price: '129.99', base_unit_of_measure: 'EA' },
        { sku: 'SL-SB-100', product_name: 'Super Lenses Soundbar', product_category: 'Soundbars', product_status: 'Active', list_price: '149.99', base_unit_of_measure: 'EA' },
        { sku: 'SL-SB-200', product_name: 'Super Lenses Soundbar Premium', product_category: 'Soundbars', product_status: 'Active', list_price: '249.99', base_unit_of_measure: 'EA' },
      ];

      let newProductCount = 0;

      for (const product of techSoundProducts) {
        const existing = await db.select().from(licenseiqEntityRecords)
          .where(and(
            eq(licenseiqEntityRecords.entityId, productsEntityId),
            eq(licenseiqEntityRecords.grpId, TECHSOUND_ID),
          )).limit(100);
        const alreadyExists = existing.some((r: any) => r.recordData?.sku === product.sku);
        if (!alreadyExists) {
          await db.insert(licenseiqEntityRecords).values({
            entityId: productsEntityId,
            recordData: product,
            grpId: TECHSOUND_ID,
            orgId: 'ts-consumer-audio',
            locId: 'ts-sf-hq',
            createdBy: adminId,
          });
          newProductCount++;
        }
      }

      const superLensesCompany = await db.select().from(companies).where(eq(companies.companyName, 'Super Lenses Company')).limit(1);
      if (superLensesCompany.length === 0) {
        const [slCompany] = await db.insert(companies).values({
          companyName: 'Super Lenses Company',
          companyDescr: 'Audio equipment manufacturer specializing in headphones and soundbars.',
          address1: '500 Optic Blvd',
          city: 'Portland',
          stateProvince: 'Oregon',
          country: 'USA',
          contactPerson: 'Licensing Department',
          contactEmail: 'licensing@superlenses.com',
          contactPhone: '503-555-0200',
          contactPreference: 'email',
          status: 'A',
          createdBy: adminId,
          lastUpdatedBy: adminId,
        }).returning();

        const [slBu] = await db.insert(businessUnits).values({
          id: 'sl-main',
          companyId: slCompany.id,
          orgName: 'Main Operations',
          orgDescr: 'Primary business unit for Super Lenses Company.',
          contactPerson: 'Operations Manager',
          contactEmail: 'ops@superlenses.com',
          status: 'A',
          createdBy: adminId,
          lastUpdatedBy: adminId,
        }).returning();

        const [slLoc] = await db.insert(locations).values({
          id: 'sl-portland-hq',
          companyId: slCompany.id,
          orgId: slBu.id,
          locName: 'Portland HQ',
          locDescr: 'Super Lenses Company headquarters.',
          address1: '500 Optic Blvd, Portland, OR 97201',
          contactPerson: 'Office Manager',
          contactEmail: 'office@superlenses.com',
          status: 'A',
          createdBy: adminId,
          lastUpdatedBy: adminId,
        }).returning();

        for (const product of superLensesProducts) {
          await db.insert(licenseiqEntityRecords).values({
            entityId: productsEntityId,
            recordData: product,
            grpId: slCompany.id,
            orgId: slBu.id,
            locId: slLoc.id,
            createdBy: adminId,
          });
          newProductCount++;
        }

        console.log('✓ Super Lenses Company created with products');
      } else {
        const slId = superLensesCompany[0].id;
        const slBus = await db.select().from(businessUnits).where(eq(businessUnits.companyId, slId)).limit(1);
        const slLocs = await db.select().from(locations).where(eq(locations.companyId, slId)).limit(1);
        if (slBus.length > 0 && slLocs.length > 0) {
          for (const product of superLensesProducts) {
            const existing = await db.select().from(licenseiqEntityRecords)
              .where(and(
                eq(licenseiqEntityRecords.entityId, productsEntityId),
                eq(licenseiqEntityRecords.grpId, slId),
              )).limit(100);
            const alreadyExists = existing.some((r: any) => r.recordData?.sku === product.sku);
            if (!alreadyExists) {
              await db.insert(licenseiqEntityRecords).values({
                entityId: productsEntityId,
                recordData: product,
                grpId: slId,
                orgId: slBus[0].id,
                locId: slLocs[0].id,
                createdBy: adminId,
              });
              newProductCount++;
            }
          }
        }
        console.log('✓ Super Lenses Company already exists');
      }

      console.log(`✓ Products seeded: ${newProductCount} new (${techSoundProducts.length} TechSound, ${superLensesProducts.length} Super Lenses)`);
    }

    // Seed Partner Master records
    {
      const partnerEntity = await db.select().from(licenseiqEntities)
        .where(eq(licenseiqEntities.technicalName, 'partner_master')).limit(1);
      if (partnerEntity.length > 0) {
        const partnerEntityId = partnerEntity[0].id;
        const partnerRecords = [
          {
            partner_name: 'TechSound Audio',
            partner_display_name: 'TechSound Audio Inc.',
            partner_code: 'TS-001',
            company_name: 'TechSound Audio Inc.',
            partner_type: 'Manufacturer',
            partner_status: 'Active',
            hq_country: 'United States',
            hq_city: 'San Francisco',
            hq_state: 'California',
            authorized_channels: 'Direct, Distributor, Retail',
            partner_tier_classification: 'Tier 1',
            payment_terms: 'Net 30',
            partner_onboarding_date: '2024-01-15',
          },
          {
            partner_name: 'National Distributor',
            partner_display_name: 'National Distributor Network',
            partner_code: 'ND-001',
            company_name: 'National Distributor Network Inc.',
            partner_type: 'Distributor',
            partner_status: 'Active',
            hq_country: 'United States',
            authorized_channels: 'Distributor',
            partner_tier_classification: 'Tier 1',
            payment_terms: 'Net 30',
          },
          {
            partner_name: 'Monrovia Nursery',
            partner_display_name: 'Monrovia Nursery Company',
            partner_code: 'MN-001',
            company_name: 'Monrovia Nursery Company',
            partner_type: 'Licensee',
            partner_status: 'Active',
            hq_country: 'United States',
            hq_city: 'Azusa',
            hq_state: 'California',
            authorized_channels: 'Retail, Wholesale',
            partner_tier_classification: 'Tier 1',
          },
          {
            partner_name: 'Super Lenses',
            partner_display_name: 'Super Lenses Company',
            partner_code: 'SL-001',
            company_name: 'Super Lenses Company',
            partner_type: 'Manufacturer',
            partner_status: 'Active',
            hq_country: 'United States',
            hq_city: 'Portland',
            hq_state: 'Oregon',
            authorized_channels: 'Direct, Distributor',
            partner_tier_classification: 'Tier 2',
          },
        ];

        let newPartnerCount = 0;
        const existingPartners = await db.select().from(licenseiqEntityRecords)
          .where(eq(licenseiqEntityRecords.entityId, partnerEntityId)).limit(100);

        for (const partner of partnerRecords) {
          const alreadyExists = existingPartners.some((r: any) =>
            r.recordData?.partner_code === partner.partner_code
          );
          if (!alreadyExists) {
            await db.insert(licenseiqEntityRecords).values({
              entityId: partnerEntityId,
              recordData: partner,
              grpId: TECHSOUND_ID,
              orgId: 'ts-consumer-audio',
              locId: 'ts-sf-hq',
              createdBy: adminId,
            });
            newPartnerCount++;
          }
        }
        console.log(`✓ Partner Master seeded: ${newPartnerCount} new (${partnerRecords.length} total)`);
      }
    }

    // Seed Territory Master records
    {
      const territoryEntity = await db.select().from(licenseiqEntities)
        .where(eq(licenseiqEntities.technicalName, 'territory_master')).limit(1);
      if (territoryEntity.length > 0) {
        const territoryEntityId = territoryEntity[0].id;
        const territoryRecords = [
          { territory_name: 'United States', territory_code: 'US', region: 'North America', territory_status: 'Active', country: 'United States' },
          { territory_name: 'Canada', territory_code: 'CA', region: 'North America', territory_status: 'Active', country: 'Canada' },
          { territory_name: 'Mexico', territory_code: 'MX', region: 'North America', territory_status: 'Active', country: 'Mexico' },
          { territory_name: 'North America', territory_code: 'NA', region: 'North America', territory_status: 'Active', country: 'Multiple' },
          { territory_name: 'European Union', territory_code: 'EU', region: 'Europe', territory_status: 'Active', country: 'Multiple' },
          { territory_name: 'Asia Pacific', territory_code: 'APAC', region: 'Asia Pacific', territory_status: 'Active', country: 'Multiple' },
          { territory_name: 'Latin America', territory_code: 'LATAM', region: 'Latin America', territory_status: 'Active', country: 'Multiple' },
        ];

        let newTerritoryCount = 0;
        const existingTerritories = await db.select().from(licenseiqEntityRecords)
          .where(eq(licenseiqEntityRecords.entityId, territoryEntityId)).limit(100);

        for (const territory of territoryRecords) {
          const alreadyExists = existingTerritories.some((r: any) =>
            r.recordData?.territory_code === territory.territory_code
          );
          if (!alreadyExists) {
            await db.insert(licenseiqEntityRecords).values({
              entityId: territoryEntityId,
              recordData: territory,
              grpId: TECHSOUND_ID,
              orgId: 'ts-consumer-audio',
              locId: 'ts-sf-hq',
              createdBy: adminId,
            });
            newTerritoryCount++;
          }
        }
        console.log(`✓ Territory Master seeded: ${newTerritoryCount} new (${territoryRecords.length} total)`);
      }
    }

    // Seed Customer Segments
    {
      const segmentRecords = [
        { segment_name: 'Enterprise', segment_code: 'ENT', description: 'Large enterprise customers with high volume contracts' },
        { segment_name: 'Mid-Market', segment_code: 'MID', description: 'Mid-sized businesses with moderate licensing needs' },
        { segment_name: 'Small Business', segment_code: 'SMB', description: 'Small businesses and startups' },
        { segment_name: 'Government', segment_code: 'GOV', description: 'Government agencies and public sector organizations' },
        { segment_name: 'Education', segment_code: 'EDU', description: 'Educational institutions including universities and schools' },
        { segment_name: 'Non-Profit', segment_code: 'NPO', description: 'Non-profit and charitable organizations' },
        { segment_name: 'OEM Partner', segment_code: 'OEM', description: 'Original equipment manufacturer partners' },
        { segment_name: 'Distributor', segment_code: 'DIST', description: 'Authorized distributors and resellers' },
        { segment_name: 'Retail', segment_code: 'RETAIL', description: 'Retail chain customers' },
        { segment_name: 'Strategic Alliance', segment_code: 'STRAT', description: 'Strategic alliance and key account partners' },
      ];

      let newSegmentCount = 0;
      const existingSegments = await db.execute(sql`SELECT id, segment_code FROM customer_segments LIMIT 100`);
      const existingCodes = (existingSegments.rows || []).map((r: any) => r.segment_code);

      for (const seg of segmentRecords) {
        if (!existingCodes.includes(seg.segment_code)) {
          await db.execute(sql`INSERT INTO customer_segments (segment_name, segment_code, description) VALUES (${seg.segment_name}, ${seg.segment_code}, ${seg.description})`);
          newSegmentCount++;
        }
      }
      console.log(`✓ Customer Segments seeded: ${newSegmentCount} new (${segmentRecords.length} total)`);
    }

    // Seed Partner Types — drives the Partner Master "Partner Type" dropdown.
    // These are global system defaults (companyId = NULL); tenants can add
    // their own via the Schema Catalog UI.
    {
      const partnerTypeRecords = [
        { code: 'distributor', name: 'Distributor', description: 'Authorized distributors who buy and resell to downstream channels', sort_order: 10 },
        { code: 'reseller',    name: 'Reseller',    description: 'Channel partners who resell products to end customers',         sort_order: 20 },
        { code: 'agent',       name: 'Agent',       description: 'Sales agents who represent the company without taking ownership of inventory', sort_order: 30 },
        { code: 'oem',         name: 'OEM',         description: 'Original equipment manufacturers who embed the product in their own offerings', sort_order: 40 },
        { code: 'retailer',    name: 'Retailer',    description: 'Retail outlets selling directly to consumers',                  sort_order: 50 },
        // Legacy values found in seeded partner rows — keep them in the
        // dropdown so existing partners' Partner Type field still renders
        // a known label. Admins can deactivate them later if not needed.
        { code: 'manufacturer', name: 'Manufacturer', description: 'Manufacturer partners (legacy)', sort_order: 60 },
        { code: 'var',          name: 'VAR',          description: 'Value Added Reseller (legacy)',  sort_order: 70 },
      ];

      let newPartnerTypeCount = 0;
      const existingPartnerTypes = await db.execute(
        sql`SELECT id, code FROM partner_types WHERE company_id IS NULL LIMIT 100`
      );
      const existingPartnerTypeCodes = (existingPartnerTypes.rows || []).map((r: any) => r.code);

      for (const pt of partnerTypeRecords) {
        if (!existingPartnerTypeCodes.includes(pt.code)) {
          await db.execute(sql`
            INSERT INTO partner_types (code, name, description, company_id, sort_order, is_active)
            VALUES (${pt.code}, ${pt.name}, ${pt.description}, NULL, ${pt.sort_order}, true)
          `);
          newPartnerTypeCount++;
        }
      }
      console.log(`✓ Partner Types seeded: ${newPartnerTypeCount} new (${partnerTypeRecords.length} total, system defaults)`);
    }

    // Seed Sales Channels records
    {
      const channelEntity = await db.select().from(licenseiqEntities)
        .where(eq(licenseiqEntities.technicalName, 'sales_channels')).limit(1);
      if (channelEntity.length > 0) {
        const channelEntityId = channelEntity[0].id;
        const channelRecords = [
          { channel_name: 'Direct Sales', channel_code: 'DIRECT', channel_type: 'Direct', channel_status: 'Active' },
          { channel_name: 'Distributor', channel_code: 'DIST', channel_type: 'Indirect', channel_status: 'Active' },
          { channel_name: 'Retail', channel_code: 'RETAIL', channel_type: 'Indirect', channel_status: 'Active' },
          { channel_name: 'Online', channel_code: 'ONLINE', channel_type: 'Direct', channel_status: 'Active' },
          { channel_name: 'Wholesale', channel_code: 'WHOLESALE', channel_type: 'Indirect', channel_status: 'Active' },
          { channel_name: 'OEM', channel_code: 'OEM', channel_type: 'Indirect', channel_status: 'Active' },
        ];

        let newChannelCount = 0;
        const existingChannels = await db.select().from(licenseiqEntityRecords)
          .where(eq(licenseiqEntityRecords.entityId, channelEntityId)).limit(100);

        for (const channel of channelRecords) {
          const alreadyExists = existingChannels.some((r: any) =>
            r.recordData?.channel_code === channel.channel_code
          );
          if (!alreadyExists) {
            await db.insert(licenseiqEntityRecords).values({
              entityId: channelEntityId,
              recordData: channel,
              grpId: TECHSOUND_ID,
              orgId: 'ts-consumer-audio',
              locId: 'ts-sf-hq',
              createdBy: adminId,
            });
            newChannelCount++;
          }
        }
        console.log(`✓ Sales Channels seeded: ${newChannelCount} new (${channelRecords.length} total)`);
      }
    }

    const uomData = [
      { code: 'unit', name: 'Unit', category: 'Quantity', sort: 1 },
      { code: 'case', name: 'Case', category: 'Quantity', sort: 2 },
      { code: 'lb', name: 'Pound (lb)', category: 'Weight', sort: 3 },
      { code: 'kg', name: 'Kilogram (kg)', category: 'Weight', sort: 4 },
      { code: '50lb', name: '50lb Equivalent', category: 'Weight', sort: 5 },
      { code: 'ton', name: 'Ton', category: 'Weight', sort: 6 },
      { code: 'pallet', name: 'Pallet', category: 'Logistics', sort: 7 },
      { code: 'container', name: 'Container', category: 'Logistics', sort: 8 },
      { code: 'gallon', name: 'Gallon', category: 'Volume', sort: 9 },
      { code: 'liter', name: 'Liter', category: 'Volume', sort: 10 },
      { code: 'sqft', name: 'Sq Ft', category: 'Area', sort: 11 },
      { code: 'hour', name: 'Hour', category: 'Time', sort: 12 },
      { code: 'percentage', name: 'Percentage (%)', category: 'Rate', sort: 13 },
      { code: 'flat', name: 'Flat Amount', category: 'Rate', sort: 14 },
    ];
    const legacyCodeMap: Record<string, string> = {
      'per_unit': 'unit', 'per_case': 'case', 'per_lb': 'lb', 'per_kg': 'kg',
      'per_50lb': '50lb', 'per_ton': 'ton', 'per_pallet': 'pallet', 'per_container': 'container',
      'per_gallon': 'gallon', 'per_liter': 'liter', 'per_sqft': 'sqft', 'per_hour': 'hour',
      'per_invoice': 'invoice', 'per_shipment': 'shipment',
    };
    let uomNew = 0, uomFixed = 0;
    for (const [oldCode, newCode] of Object.entries(legacyCodeMap)) {
      const legacy = await db.execute(sql`SELECT 1 FROM uom_master WHERE uom_code = ${oldCode}`);
      if (legacy.rows.length > 0) {
        const target = uomData.find(u => u.code === newCode);
        if (target) {
          await db.execute(sql`UPDATE uom_master SET uom_code = ${target.code}, uom_name = ${target.name}, uom_category = ${target.category}, sort_order = ${target.sort} WHERE uom_code = ${oldCode}`);
        } else {
          await db.execute(sql`UPDATE uom_master SET uom_code = ${newCode} WHERE uom_code = ${oldCode}`);
        }
        await db.execute(sql`UPDATE contract_rules SET uom = ${newCode} WHERE uom = ${oldCode}`);
        uomFixed++;
      }
    }
    for (const u of uomData) {
      const exists = await db.execute(sql`SELECT 1 FROM uom_master WHERE uom_code = ${u.code}`);
      if (exists.rows.length === 0) {
        await db.execute(sql`INSERT INTO uom_master (id, uom_code, uom_name, uom_category, sort_order, is_active) VALUES (gen_random_uuid(), ${u.code}, ${u.name}, ${u.category}, ${u.sort}, true)`);
        uomNew++;
      } else {
        await db.execute(sql`UPDATE uom_master SET uom_name = ${u.name}, uom_category = ${u.category}, sort_order = ${u.sort} WHERE uom_code = ${u.code}`);
      }
    }
    console.log(`✓ UOM Master seeded: ${uomNew} new, ${uomFixed} legacy codes fixed (${uomData.length} total)`);

    console.log('✅ Master Data seeding complete');
    console.log('   - Monrovia Nursery Company (1 company)');
    console.log('   - TechSound Audio Inc. (1 company)');
    console.log('   - Super Lenses Company (1 company)');
    console.log('   - 2+2 Business Units');
    console.log('   - 5+2 Locations');
    console.log(`   - ${contractTypes.length} Contract Type Definitions`);
    console.log('   - Accountant user (assigned to TechSound)');
    console.log('   - Product catalog (TechSound + Super Lenses)');
    console.log(`   - ${uomData.length} UOM definitions`);

  } catch (error: any) {
    console.error('⚠ Master Data seeding warning:', error.message);
  }
}
