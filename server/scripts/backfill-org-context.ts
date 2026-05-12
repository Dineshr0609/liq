/**
 * Backfill Script: Assign Organizational Context to Existing Data
 * 
 * This script assigns company/business unit/location IDs to existing:
 * 1. Contracts (based on uploader's primary org context)
 * 2. Sales Data (inherited from matched contract)
 * 3. Fee Calculations (inherited from parent contract)
 * 
 * Usage:
 *   tsx server/scripts/backfill-org-context.ts
 */

import { db } from '../db';
import { contracts, salesData, contractCalculations, users, userOrganizationRoles } from '../../shared/schema';
import { eq, isNull, and } from 'drizzle-orm';

async function backfillOrganizationalContext() {
  console.log('🚀 Starting Organizational Context Backfill...\n');

  try {
    // ==========================================
    // STEP 1: Backfill Contracts
    // ==========================================
    console.log('📄 STEP 1: Backfilling Contracts...');
    
    // Get all contracts without organizational context
    const contractsWithoutContext = await db
      .select()
      .from(contracts)
      .where(
        and(
          isNull(contracts.companyId),
          isNull(contracts.businessUnitId),
          isNull(contracts.locationId)
        )
      );

    console.log(`   Found ${contractsWithoutContext.length} contracts without org context`);

    let contractsUpdated = 0;
    let contractsSkipped = 0;

    for (const contract of contractsWithoutContext) {
      if (!contract.uploadedBy) {
        console.log(`   ⚠️  Skipping contract ${contract.id} - no uploader`);
        contractsSkipped++;
        continue;
      }

      // Get user's primary organization context (first assigned location)
      const [userOrg] = await db
        .select()
        .from(userOrganizationRoles)
        .where(eq(userOrganizationRoles.userId, contract.uploadedBy))
        .limit(1);

      if (!userOrg) {
        console.log(`   ⚠️  Skipping contract ${contract.id} - user has no org assignments`);
        contractsSkipped++;
        continue;
      }

      // Update contract with org context
      await db
        .update(contracts)
        .set({
          companyId: userOrg.companyId,
          businessUnitId: userOrg.businessUnitId,
          locationId: userOrg.locationId,
        } as any)
        .where(eq(contracts.id, contract.id));

      contractsUpdated++;
      
      if (contractsUpdated % 10 === 0) {
        console.log(`   ✓ Updated ${contractsUpdated} contracts...`);
      }
    }

    console.log(`   ✅ Contracts: ${contractsUpdated} updated, ${contractsSkipped} skipped\n`);

    // ==========================================
    // STEP 2: Backfill Sales Data
    // ==========================================
    console.log('💰 STEP 2: Backfilling Sales Data...');
    
    // Get all sales data without organizational context
    const salesWithoutContext = await db
      .select()
      .from(salesData)
      .where(
        and(
          isNull(salesData.companyId),
          isNull(salesData.businessUnitId),
          isNull(salesData.locationId)
        )
      );

    console.log(`   Found ${salesWithoutContext.length} sales records without org context`);

    let salesUpdated = 0;
    let salesSkipped = 0;

    for (const sale of salesWithoutContext) {
      if (!sale.matchedContractId) {
        console.log(`   ⚠️  Skipping sale ${sale.id} - no matched contract`);
        salesSkipped++;
        continue;
      }

      // Get org context from matched contract
      const [contract] = await db
        .select()
        .from(contracts)
        .where(eq(contracts.id, sale.matchedContractId))
        .limit(1);

      if (!contract || !contract.companyId) {
        console.log(`   ⚠️  Skipping sale ${sale.id} - contract has no org context`);
        salesSkipped++;
        continue;
      }

      // Inherit org context from contract
      await db
        .update(salesData)
        .set({
          companyId: contract.companyId,
          businessUnitId: contract.businessUnitId,
          locationId: contract.locationId,
        } as any)
        .where(eq(salesData.id, sale.id));

      salesUpdated++;
      
      if (salesUpdated % 50 === 0) {
        console.log(`   ✓ Updated ${salesUpdated} sales records...`);
      }
    }

    console.log(`   ✅ Sales Data: ${salesUpdated} updated, ${salesSkipped} skipped\n`);

    // ==========================================
    // STEP 3: Backfill Fee Calculations
    // ==========================================
    console.log('📊 STEP 3: Backfilling Fee Calculations...');
    
    // Get all calculations without organizational context
    const calculationsWithoutContext = await db
      .select()
      .from(contractCalculations)
      .where(
        and(
          isNull(contractCalculations.companyId),
          isNull(contractCalculations.businessUnitId),
          isNull(contractCalculations.locationId)
        )
      );

    console.log(`   Found ${calculationsWithoutContext.length} calculations without org context`);

    let calculationsUpdated = 0;
    let calculationsSkipped = 0;

    for (const calculation of calculationsWithoutContext) {
      // Get org context from parent contract
      const [contract] = await db
        .select()
        .from(contracts)
        .where(eq(contracts.id, calculation.contractId))
        .limit(1);

      if (!contract || !contract.companyId) {
        console.log(`   ⚠️  Skipping calculation ${calculation.id} - contract has no org context`);
        calculationsSkipped++;
        continue;
      }

      // Inherit org context from contract
      await db
        .update(contractCalculations)
        .set({
          companyId: contract.companyId,
          businessUnitId: contract.businessUnitId,
          locationId: contract.locationId,
        } as any)
        .where(eq(contractCalculations.id, calculation.id));

      calculationsUpdated++;
      
      if (calculationsUpdated % 20 === 0) {
        console.log(`   ✓ Updated ${calculationsUpdated} calculations...`);
      }
    }

    console.log(`   ✅ Calculations: ${calculationsUpdated} updated, ${calculationsSkipped} skipped\n`);

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('═══════════════════════════════════════');
    console.log('📝 BACKFILL SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Contracts:    ${contractsUpdated} updated, ${contractsSkipped} skipped`);
    console.log(`Sales Data:   ${salesUpdated} updated, ${salesSkipped} skipped`);
    console.log(`Calculations: ${calculationsUpdated} updated, ${calculationsSkipped} skipped`);
    console.log('═══════════════════════════════════════\n');
    console.log('✅ Backfill completed successfully!');

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run backfill
backfillOrganizationalContext()
  .then(() => {
    console.log('\n🎉 All done! Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
