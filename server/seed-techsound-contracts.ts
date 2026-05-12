import { db } from './db';
import {
  contracts,
  contractTerms,
  contractQualifiers,
  contractPartnerAssignments,
  contractAnalysis,
  users,
  companies,
  businessUnits,
  locations,
} from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const XLSX_PATH = path.join(process.cwd(), 'attached_assets', 'Tech_Sound_Audio_Contracts_Data_1771971582199.xlsx');

function excelDateToJs(serial: number | string | null | undefined): Date | null {
  if (serial === null || serial === undefined || serial === '') return null;
  if (typeof serial === 'string') {
    const parsed = new Date(serial);
    if (!isNaN(parsed.getTime())) return parsed;
    const num = parseFloat(serial);
    if (isNaN(num)) return null;
    return new Date((num - 25569) * 86400000);
  }
  if (typeof serial === 'number') {
    return new Date((serial - 25569) * 86400000);
  }
  if (serial instanceof Date) return serial;
  return null;
}

function formatDateStr(serial: number | string | null | undefined): string {
  const d = excelDateToJs(serial);
  if (!d) return '';
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
}

const TERRITORY_NAMES: Record<string, string> = {
  'TERR-001': 'Global',
  'TERR-002': 'North America (US, Canada, Mexico)',
  'TERR-003': 'United States',
  'TERR-004': 'US West Region',
  'TERR-005': 'US East Region',
  'TERR-006': 'EMEA (Europe, Middle East, Africa)',
};

const CHANNEL_NAMES: Record<string, string> = {
  'CH-001': 'Direct Sales',
  'CH-002': 'Wholesale Distribution',
  'CH-003': 'Regional Distribution',
  'CH-004': 'National Retail',
  'CH-005': 'Big Box Retail',
  'CH-006': 'Specialty Retail',
  'CH-007': 'Club Stores',
  'CH-008': 'Online Marketplace',
  'CH-009': 'Direct-to-Consumer E-commerce',
  'CH-010': 'Value Added Reseller',
  'CH-017': 'Government Procurement',
  'CH-019': 'K-12 Education',
  'CH-020': 'Higher Education',
};

const PARTNER_NAMES: Record<string, string> = {
  'TS-DIST-001': 'Summit Distribution',
  'TS-DIST-002': 'Pacific Coast Distributors',
  'TS-DIST-003': 'Atlantic Audio Supply',
  'TS-DIST-004': 'Midwest Electronics',
  'TS-RET-001': 'AudioMax Stores',
  'TS-RET-002': 'SoundWorld Retail',
  'TS-RET-003': 'Premium Audio Boutique',
  'TS-ECOM-001': 'DigitalAudio.com',
};

const PRODUCT_NAMES: Record<string, string> = {
  'TS-P-025': 'TS ProStudio Monitor 8"',
  'TS-P-026': 'TS ProStudio Monitor 5"',
  'TS-P-027': 'TS ProStudio Subwoofer 12"',
  'TS-P-028': 'TS ProStudio Reference Amp',
  'TS-KIT-001': 'Holiday Bundle 2024',
};

const CATEGORY_TO_TYPE_CODE: Record<string, string> = {
  'channel incentive': 'ib_rebate',
  'promotional': 'ob_rebate',
  'pricing agreement': 'price_protection_chargeback',
  'marketing support': 'ob_rebate',
  'rebate': 'ob_rebate',
  'mdf': 'mdf',
  'distribution': 'distributor_reseller_program',
  'licensing': 'licensing_royalty',
  'contract fee': 'licensing_royalty',
  'chargeback': 'price_protection_chargeback',
  'marketplace': 'revenue_share_marketplace',
};

function mapCategoryToTypeCode(category: string): string {
  const lower = (category || '').toLowerCase().trim();
  return CATEGORY_TO_TYPE_CODE[lower] || 'ob_rebate';
}

function resolveCode(code: string | undefined, map: Record<string, string>): string {
  if (!code) return '';
  return String(code).split(',').map(c => {
    const trimmed = c.trim();
    return map[trimmed] || trimmed;
  }).join(', ');
}

export async function seedTechSoundContracts() {
  console.log('🌱 Seeding TechSound Audio Contracts...');

  try {
    const xlsxModule = await import('xlsx');
    const XLSX = xlsxModule.default || xlsxModule;
    const wb = XLSX.readFile(XLSX_PATH);

    const masterSheet = XLSX.utils.sheet_to_json(wb.Sheets['Contract Master'], { header: 1 });
    const termsSheet = XLSX.utils.sheet_to_json(wb.Sheets['Terms'], { header: 1 });
    const qualifiersSheet = XLSX.utils.sheet_to_json(wb.Sheets['Qualifiers'], { header: 1 });
    const partnersSheet = XLSX.utils.sheet_to_json(wb.Sheets['Partner Assignments'], { header: 1 });

    const masterHeader = masterSheet[5] as string[];
    const masterRows = masterSheet.slice(6).filter((r: any[]) => r && r[0] && String(r[0]).startsWith('CTR-'));

    const termsHeader = termsSheet[3] as string[];
    const termsRows = termsSheet.slice(4).filter((r: any[]) => r && r[0] && String(r[0]).startsWith('TERM-'));

    const qualHeader = qualifiersSheet[2] as string[];
    const qualRows = qualifiersSheet.slice(3).filter((r: any[]) => r && r[0] && String(r[0]).startsWith('QUAL-'));

    const partnerHeader = partnersSheet[2] as string[];
    const partnerRows = partnersSheet.slice(3).filter((r: any[]) => r && r[0] && String(r[0]).startsWith('ASSIGN-'));

    const adminUser = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
    if (adminUser.length === 0) {
      console.log('⚠ No admin user found, skipping TechSound contract seeding');
      return;
    }
    const adminId = adminUser[0].id;

    const tsCompany = await db.select().from(companies).where(eq(companies.companyName, 'TechSound Audio Inc.')).limit(1);
    if (tsCompany.length === 0) {
      console.log('⚠ TechSound Audio Inc. company not found, skipping contract seeding');
      return;
    }
    const TECHSOUND_ID = tsCompany[0].id;

    const existingContracts = await db.select().from(contracts).where(eq(contracts.companyId, TECHSOUND_ID)).limit(1);
    if (existingContracts.length > 0) {
      console.log('✓ TechSound contracts already seeded');
      return;
    }

    const tsBUs = await db.select().from(businessUnits).where(eq(businessUnits.companyId, TECHSOUND_ID)).limit(1);
    const BU_ID = tsBUs.length > 0 ? tsBUs[0].id : null;

    const tsLocs = BU_ID ? await db.select().from(locations).where(eq(locations.orgId, BU_ID)).limit(1) : [];
    const LOC_ID = tsLocs.length > 0 ? tsLocs[0].id : null;

    let contractsCreated = 0;
    let termsCreated = 0;
    let qualifiersCreated = 0;
    let partnersCreated = 0;

    for (const row of masterRows) {
      const contractId = String(row[0]);
      const contractNumber = String(row[2]);
      const contractName = String(row[3]);
      const contractType = String(row[4] || '');
      const contractCategory = String(row[5] || '');
      const effectiveDate = excelDateToJs(row[6]);
      const expirationDate = excelDateToJs(row[7]);
      const autoRenew = row[8] === true || row[8] === 'true' || row[8] === 'TRUE';
      const renewalTermMonths = parseInt(String(row[9] || '0')) || 0;
      const territoryScope = resolveCode(String(row[10] || ''), TERRITORY_NAMES);
      const channelScope = resolveCode(String(row[11] || ''), CHANNEL_NAMES);
      const owningParty = String(row[12] || '');
      const counterpartyType = String(row[13] || '');

      const contractPartners = partnerRows.filter(p => String(p[1]) === contractId);
      const counterpartyName = contractPartners.length > 0
        ? contractPartners.map(p => resolveCode(String(p[2] || ''), PARTNER_NAMES)).join(', ')
        : counterpartyType ? `Authorized ${counterpartyType} Partner(s)` : counterpartyType;

      const contractStatus = String(row[14] || '');
      const estimatedAnnual = String(row[15] || '0');
      const currency = String(row[16] || 'USD');
      const paymentFrequency = String(row[17] || '');
      const docUrl = String(row[18] || '');
      const notes = String(row[21] || '');

      const safeName = contractName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
      const pdfFileName = `${safeName}.pdf`;
      const pdfPath = path.join('uploads', pdfFileName);
      let fileSize = 0;
      try {
        const stat = fs.statSync(pdfPath);
        fileSize = stat.size;
      } catch {
        fileSize = 50000;
      }

      const [newContract] = await db.insert(contracts).values({
        fileName: pdfFileName,
        originalName: `${contractName}.pdf`,
        filePath: pdfPath,
        fileSize: fileSize,
        fileType: 'application/pdf',
        status: 'analyzed',
        companyId: TECHSOUND_ID,
        businessUnitId: BU_ID,
        locationId: LOC_ID,
        displayName: contractName,
        contractType: mapCategoryToTypeCode(contractCategory),
        counterpartyName: counterpartyName,
        contractNumber: contractNumber,
        uploadedBy: adminId,
        effectiveStart: effectiveDate,
        effectiveEnd: expirationDate,
        notes: notes,
        contractCategory: contractCategory,
        autoRenew: autoRenew,
        renewalTermMonths: renewalTermMonths,
        territoryScope: territoryScope,
        channelScope: channelScope,
        owningParty: owningParty,
        counterpartyType: counterpartyType as string,
        contractStatus: contractStatus,
        contractValueEstimatedAnnual: estimatedAnnual,
        currency: currency,
        paymentFrequency: paymentFrequency,
      }).returning();

      contractsCreated++;
    }

    for (const row of termsRows) {
      const termId = String(row[0]);
      const contractId = String(row[1]);
      const termSequence = parseInt(String(row[2] || '0')) || 0;
      const rateValue = String(row[7] || '0');
      const tierMin = String(row[8] || '0');
      const tierMax = String(row[9] || '0');
      const requiresClaim = row[19] === true || String(row[19] || '').toLowerCase() === 'true';
      const claimDays = parseInt(String(row[20] || '0')) || 0;
      const requiresProof = row[21] === true || String(row[21] || '').toLowerCase() === 'true';

      await db.insert(contractTerms).values({
        termId: termId,
        contractId: contractId,
        termSequence: termSequence,
        termName: String(row[3] || ''),
        termType: String(row[4] || ''),
        calculationBasis: String(row[5] || ''),
        rateType: String(row[6] || ''),
        rateValue: rateValue,
        tierMin: tierMin,
        tierMax: tierMax,
        tierUom: String(row[10] || ''),
        appliesToProductCategory: String(row[11] || ''),
        appliesToProductFamily: String(row[12] || ''),
        appliesToProductIds: resolveCode(String(row[13] || ''), PRODUCT_NAMES),
        excludedProductIds: resolveCode(String(row[14] || ''), PRODUCT_NAMES),
        appliesToTerritory: resolveCode(String(row[15] || ''), TERRITORY_NAMES),
        appliesToChannel: resolveCode(String(row[16] || ''), CHANNEL_NAMES),
        paymentTiming: String(row[17] || ''),
        paymentMethod: String(row[18] || ''),
        requiresClaim: requiresClaim,
        claimDeadlineDays: claimDays,
        requiresProofOfPerformance: requiresProof,
        effectiveDate: excelDateToJs(row[22]),
        expirationDate: excelDateToJs(row[23]),
        notes: String(row[24] || ''),
      });
      termsCreated++;
    }

    for (const row of qualRows) {
      const qualId = String(row[0]);
      const termId = String(row[1]);
      const qValNumeric = row[6] !== undefined && row[6] !== '' && row[6] !== null ? String(row[6]) : null;

      await db.insert(contractQualifiers).values({
        qualifierId: qualId,
        termId: termId,
        qualifierType: String(row[2] || ''),
        qualifierField: String(row[3] || ''),
        operator: String(row[4] || ''),
        qualifierValue: String(row[5] || ''),
        qualifierValueNumeric: qValNumeric,
        qualifierLogic: String(row[7] || ''),
        effectiveDate: excelDateToJs(row[8]),
        expirationDate: excelDateToJs(row[9]),
        notes: String(row[10] || ''),
      });
      qualifiersCreated++;
    }

    for (const row of partnerRows) {
      const assignId = String(row[0]);
      const contractId = String(row[1]);
      const customTerms = row[7] === true || row[7] === 'true' || row[7] === 'TRUE';

      await db.insert(contractPartnerAssignments).values({
        assignmentId: assignId,
        contractId: contractId,
        partnerId: PARTNER_NAMES[String(row[2] || '')] 
          ? `${PARTNER_NAMES[String(row[2] || '')]} (${String(row[2] || '')})` 
          : String(row[2] || ''),
        assignmentType: String(row[3] || ''),
        effectiveDate: excelDateToJs(row[4]),
        expirationDate: excelDateToJs(row[5]),
        status: String(row[6] || ''),
        customTerms: customTerms,
        notes: String(row[8] || ''),
      });
      partnersCreated++;
    }

    let analysisCreated = 0;
    const allContracts = await db.select().from(contracts).where(eq(contracts.companyId, TECHSOUND_ID));
    for (const c of allContracts) {
      const existingAnalysis = await db.select().from(contractAnalysis).where(eq(contractAnalysis.contractId, c.id)).limit(1);
      if (existingAnalysis.length > 0) continue;

      const termsRecs = await db.select().from(contractTerms).where(eq(contractTerms.contractId, c.id));
      const termIdsList = termsRecs.map(t => t.termId);
      
      const fmtRate = (v: any) => { const n = Number(v); return n % 1 === 0 ? n.toString() : parseFloat(n.toFixed(2)).toString(); };
      const termDescriptions = termsRecs.map(t =>
        t.termName + ': ' + t.rateType + ' ' + fmtRate(t.rateValue) + (t.rateType === 'Percentage' ? '%' : ' USD') +
        (t.tierMin !== null && t.tierMax !== null ? ' (Tier: ' + Number(t.tierMin).toLocaleString() + ' - ' + Number(t.tierMax).toLocaleString() + ' ' + (t.tierUom || '') + ')' : '')
      ).join('. ');

      const partnersRecs = await db.select().from(contractPartnerAssignments).where(eq(contractPartnerAssignments.contractId, c.id));
      const partnerNames = partnersRecs.map(p => p.partnerId).join(', ');

      const summary = (c.displayName || c.originalName) + ' is a ' + (c.contractType || '') + ' agreement (' + (c.contractCategory || '') + ') between ' + (c.owningParty || '') + ' and its ' + (c.counterpartyType || '') + ' partners. ' +
        'Territory: ' + (c.territoryScope || '') + '. Channels: ' + (c.channelScope || '') + '. ' +
        'Estimated annual value: $' + Number(c.contractValueEstimatedAnnual || 0).toLocaleString() + ' ' + (c.currency || 'USD') + '. ' +
        'Payment frequency: ' + (c.paymentFrequency || '') + '. ' +
        (c.autoRenew ? 'Auto-renews every ' + (c.renewalTermMonths || 0) + ' months. ' : '') +
        'This contract includes ' + termsRecs.length + ' pricing tier(s): ' + termDescriptions + '. ' +
        (partnersRecs.length > 0 ? 'Assigned partners: ' + partnerNames + '. ' : '') +
        (c.notes || '');

      const risks: any[] = [];
      if (c.autoRenew) risks.push({ level: 'medium', title: 'Auto-Renewal Risk', description: 'Contract auto-renews every ' + (c.renewalTermMonths || 0) + ' months. Ensure timely review.' });
      if (Number(c.contractValueEstimatedAnnual || 0) > 1000000) risks.push({ level: 'high', title: 'High Value Agreement', description: 'Annual estimated value exceeds $1M. Regular monitoring recommended.' });
      if (termsRecs.some(t => t.requiresClaim)) {
        const claimTerm = termsRecs.find(t => t.requiresClaim);
        risks.push({ level: 'medium', title: 'Claim Required', description: 'Some tiers require claims within ' + (claimTerm?.claimDeadlineDays || 30) + ' days.' });
      }

      const rates = termsRecs.map(t => Number(t.rateValue));
      const rateUnit = termsRecs[0]?.rateType === 'Percentage' ? '%' : ' USD';
      const insights: any[] = [
        { title: 'Pricing Structure', description: termsRecs.length + ' pricing tiers ranging from ' + fmtRate(Math.min(...rates)) + rateUnit + ' to ' + fmtRate(Math.max(...rates)) + rateUnit + '. Higher volumes unlock better rates.' },
        { title: 'Channel Coverage', description: 'Covers ' + (c.channelScope || '') + ' across ' + (c.territoryScope || '') },
      ];
      if (partnersRecs.length > 0) insights.push({ title: 'Partner Network', description: partnersRecs.length + ' partner(s) assigned: ' + partnerNames });

      const termsArray = termsRecs.map(t => ({
        type: t.termName,
        description: t.termType + ' - ' + t.calculationBasis + ': ' + t.rateType + ' ' + fmtRate(t.rateValue) + (t.rateType === 'Percentage' ? '%' : ' USD') + '. Payment: ' + t.paymentTiming + ' via ' + t.paymentMethod + '.',
        location: 'Section 4 - Terms & Tiers'
      }));

      const keyTerms = {
        terms: termsArray,
        territory: c.territoryScope || 'United States',
        licensee: c.counterpartyType || '',
        licensor: c.owningParty || 'TechSound Audio Inc.',
        paymentTerms: c.paymentFrequency || 'quarterly',
        agreementType: c.contractType || '',
        contractValue: '$' + Number(c.contractValueEstimatedAnnual || 0).toLocaleString() + ' estimated annual',
        effectiveDate: c.effectiveStart ? c.effectiveStart.toISOString().split('T')[0] : '',
      };

      await db.insert(contractAnalysis).values({
        id: sql`gen_random_uuid()`,
        contractId: c.id,
        summary: summary,
        riskAnalysis: risks,
        insights: insights,
        keyTerms: keyTerms,
        processingTime: 0,
      } as any);
      analysisCreated++;
    }

    console.log('✅ TechSound Audio Contracts seeding complete');
    console.log(`   - ${contractsCreated} contracts created`);
    console.log(`   - ${termsCreated} terms created`);
    console.log(`   - ${qualifiersCreated} qualifiers created`);
    console.log(`   - ${partnersCreated} partner assignments created`);
    console.log(`   - ${analysisCreated} analysis records created`);

  } catch (error: any) {
    console.error('⚠ TechSound contract seeding warning:', error.message);
  }
}
