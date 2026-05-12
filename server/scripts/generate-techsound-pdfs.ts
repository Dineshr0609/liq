import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXCEL_PATH = path.resolve(__dirname, '../../attached_assets/Tech_Sound_Audio_Contracts_Data_1771971582199.xlsx');
const OUTPUT_DIR = path.resolve(__dirname, '../../uploads');

const PAGE_WIDTH = 612;
const CONTENT_LEFT = 60;
const CONTENT_WIDTH = PAGE_WIDTH - 120;
const BOTTOM_MARGIN = 60;

const NAVY = '#1a2744';
const HEADER_BG = '#2c3e6b';
const ALT_ROW = '#f4f6fa';
const BORDER_COLOR = '#bfc9d9';
const TEXT_COLOR = '#222222';

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

function resolveCode(code: string | undefined, map: Record<string, string>): string {
  if (!code) return 'N/A';
  return String(code).split(',').map(c => {
    const trimmed = c.trim();
    return map[trimmed] || trimmed;
  }).join(', ');
}

function excelDateToString(serial: number | string | undefined): string {
  if (!serial || serial === '') return 'N/A';
  if (typeof serial === 'string') return serial;
  const d = new Date((serial - 25569) * 86400000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatCurrency(val: number | string | undefined): string {
  if (!val && val !== 0) return 'N/A';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SheetRow {
  [key: string]: any;
}

function parseSheet(ws: xlsx.WorkSheet): SheetRow[] {
  const raw = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });
  if (raw.length < 3) return [];
  const headers = raw[1] as string[];
  const data: SheetRow[] = [];
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i] as any[];
    if (!row || !row[0]) continue;
    const obj: SheetRow = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? row[idx] : '';
    });
    data.push(obj);
  }
  return data;
}

function generatePDF(
  contract: SheetRow,
  terms: SheetRow[],
  qualifiers: SheetRow[],
  partners: SheetRow[],
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
      autoFirstPage: true,
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    stream.on('finish', resolve);
    stream.on('error', reject);

    function ensureSpace(n: number) {
      if (doc.y > doc.page.height - BOTTOM_MARGIN - n) {
        doc.addPage();
      }
    }

    function heading(text: string) {
      ensureSpace(40);
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY);
      doc.text(text.toUpperCase(), CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.2);
      const lineY = doc.y;
      doc.save();
      doc.moveTo(CONTENT_LEFT, lineY).lineTo(CONTENT_LEFT + CONTENT_WIDTH, lineY).lineWidth(1.5).strokeColor(NAVY).stroke();
      doc.restore();
      doc.y = lineY + 4;
      doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
    }

    function drawTable(headers: string[], rows: string[][], colWidths: number[]) {
      const ROW_HEIGHT = 18;
      const PADDING = 4;
      const FONT_SIZE = 8;

      ensureSpace(ROW_HEIGHT * 2 + 10);

      function drawHeaderRow() {
        const y = doc.y;
        doc.save();
        doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, ROW_HEIGHT).fill(HEADER_BG);
        doc.restore();
        let x = CONTENT_LEFT;
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE).fillColor('#FFFFFF');
        headers.forEach((h, i) => {
          doc.text(h, x + PADDING, y + PADDING, { width: colWidths[i] - PADDING * 2 });
          x += colWidths[i];
        });
        doc.y = y + ROW_HEIGHT;
      }

      drawHeaderRow();

      rows.forEach((row, rowIdx) => {
        if (doc.y > doc.page.height - BOTTOM_MARGIN - ROW_HEIGHT) {
          doc.addPage();
          drawHeaderRow();
        }
        const y = doc.y;
        doc.save();
        if (rowIdx % 2 === 0) {
          doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, ROW_HEIGHT).fill(ALT_ROW);
        }
        doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, ROW_HEIGHT).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();
        doc.restore();

        let x = CONTENT_LEFT;
        doc.font('Helvetica').fontSize(FONT_SIZE).fillColor(TEXT_COLOR);
        row.forEach((cell, i) => {
          const cellText = cell !== undefined && cell !== null ? String(cell) : '';
          doc.text(cellText, x + PADDING, y + PADDING, { width: colWidths[i] - PADDING * 2 });
          x += colWidths[i];
        });
        doc.y = y + ROW_HEIGHT;
      });

      doc.y += 6;
    }

    function drawKeyValue(label: string, value: string) {
      ensureSpace(16);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY);
      doc.text(label + ': ', CONTENT_LEFT, doc.y, { continued: false, width: 140 });
      const labelY = doc.y - 12;
      doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
      doc.text(String(value || 'N/A'), CONTENT_LEFT + 145, labelY, { width: CONTENT_WIDTH - 145 });
    }

    // Determine counterparty names from partner assignments
    const partnerNames = partners.map(p => resolveCode(p.partner_id, PARTNER_NAMES));
    const counterpartyLabel = contract.counterparty_type || 'Counterparty';
    const counterpartyDisplayName = partnerNames.length > 0
      ? partnerNames.join(', ')
      : `Authorized ${counterpartyLabel} Partner(s)`;
    const licensorName = contract.owning_party || 'TechSound Audio Inc.';

    // ===== COVER BLOCK =====
    doc.moveDown(2);
    doc.save();
    const coverY = doc.y;
    doc.rect(CONTENT_LEFT, coverY, CONTENT_WIDTH, 210).fill('#f0f2f7');
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(18).fillColor(NAVY);
    doc.text(contract.contract_name || '', CONTENT_LEFT + 20, coverY + 15, { width: CONTENT_WIDTH - 40, align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(11).fillColor(TEXT_COLOR);
    doc.text(`Contract No. ${contract.contract_number || ''}`, CONTENT_LEFT + 20, doc.y, { width: CONTENT_WIDTH - 40, align: 'center' });
    doc.moveDown(0.6);

    doc.font('Helvetica').fontSize(10).fillColor('#444444');
    doc.text('This Agreement is entered into by and between:', CONTENT_LEFT + 20, doc.y, { width: CONTENT_WIDTH - 40, align: 'center' });
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY);
    doc.text(licensorName, CONTENT_LEFT + 20, doc.y, { width: CONTENT_WIDTH - 40, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    doc.text('(hereinafter referred to as "Licensor" or "Manufacturer")', CONTENT_LEFT + 20, doc.y, { width: CONTENT_WIDTH - 40, align: 'center' });
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT_COLOR);
    doc.text('— AND —', CONTENT_LEFT + 20, doc.y, { width: CONTENT_WIDTH - 40, align: 'center' });
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY);
    doc.text(counterpartyDisplayName, CONTENT_LEFT + 20, doc.y, { width: CONTENT_WIDTH - 40, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    doc.text(`(hereinafter referred to as "Licensee" or "${counterpartyLabel}")`, CONTENT_LEFT + 20, doc.y, { width: CONTENT_WIDTH - 40, align: 'center' });
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT_COLOR);
    doc.text(
      `Effective: ${excelDateToString(contract.effective_date)}  —  Expires: ${excelDateToString(contract.expiration_date)}`,
      CONTENT_LEFT + 20, doc.y, { width: CONTENT_WIDTH - 40, align: 'center' }
    );
    doc.y = coverY + 220;

    // ===== AGREEMENT DETAILS =====
    heading('Section 1 — Agreement Details');
    const detailRows: string[][] = [
      ['Contract Number', contract.contract_number],
      ['Contract Name', contract.contract_name],
      ['Type / Category', `${contract.contract_type} / ${contract.contract_category}`],
      ['Licensor (First Party)', licensorName],
      ['Licensee / Counterparty', counterpartyDisplayName],
      ['Counterparty Classification', counterpartyLabel],
      ['Effective Date', excelDateToString(contract.effective_date)],
      ['Expiration Date', excelDateToString(contract.expiration_date)],
      ['Auto-Renew', contract.auto_renew ? 'Yes' : 'No'],
      ['Renewal Term', `${contract.renewal_term_months} months`],
      ['Status', contract.contract_status],
      ['Est. Annual Value', formatCurrency(contract.contract_value_estimated_annual)],
      ['Currency', contract.currency],
      ['Payment Frequency', contract.payment_frequency],
    ];
    drawTable(['Field', 'Value'], detailRows, [CONTENT_WIDTH * 0.35, CONTENT_WIDTH * 0.65]);

    // ===== PARTIES =====
    heading('Section 2 — Parties');
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY);
    ensureSpace(40);
    doc.text('LICENSOR / FIRST PARTY:', CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
    doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
    doc.text(
      `${licensorName}, a corporation organized and existing under the laws of the State of California, ` +
      `with its principal place of business at 100 Audio Way, San Francisco, California, USA ` +
      `(hereinafter referred to as "Licensor" or "Manufacturer").`,
      CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH }
    );
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY);
    ensureSpace(40);
    doc.text('LICENSEE / SECOND PARTY:', CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
    doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
    if (partners.length > 0) {
      partners.forEach((p, i) => {
        const pName = resolveCode(p.partner_id, PARTNER_NAMES);
        const pType = p.assignment_type || counterpartyLabel;
        doc.text(
          `${i + 1}. ${pName}, serving as ${pType}${p.notes ? ' — ' + p.notes : ''} ` +
          `(hereinafter referred to as "Licensee" or "${counterpartyLabel}").`,
          CONTENT_LEFT + 10, doc.y, { width: CONTENT_WIDTH - 10 }
        );
        doc.moveDown(0.2);
      });
    } else {
      doc.text(
        `Authorized ${counterpartyLabel} partner(s) as designated by ${licensorName} ` +
        `(hereinafter referred to as "Licensee" or "${counterpartyLabel}").`,
        CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH }
      );
    }
    doc.moveDown(0.3);

    ensureSpace(30);
    doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
    doc.text(
      `WHEREAS, the Licensor is engaged in the manufacture and distribution of audio products; and ` +
      `WHEREAS, the Licensee desires to ${counterpartyLabel === 'Distributor' ? 'distribute' : counterpartyLabel === 'Retailer' ? 'retail' : counterpartyLabel === 'E-commerce Partner' ? 'sell via e-commerce channels' : 'market and sell'} ` +
      `the Licensor's products under the terms and conditions set forth herein; ` +
      `NOW, THEREFORE, in consideration of the mutual covenants and agreements contained herein, the parties agree as follows:`,
      CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH }
    );
    doc.moveDown(0.5);

    // ===== TERRITORY & CHANNEL =====
    heading('Section 3 — Territory & Channel');
    drawKeyValue('Territory Scope', resolveCode(contract.territory_scope, TERRITORY_NAMES));
    drawKeyValue('Channel Scope', resolveCode(contract.channel_scope, CHANNEL_NAMES));
    doc.moveDown(0.3);

    // ===== TERMS & TIERS =====
    heading('Section 4 — Terms & Tiers');
    if (terms.length > 0) {
      const termColWidths = [
        CONTENT_WIDTH * 0.20,
        CONTENT_WIDTH * 0.15,
        CONTENT_WIDTH * 0.12,
        CONTENT_WIDTH * 0.10,
        CONTENT_WIDTH * 0.12,
        CONTENT_WIDTH * 0.12,
        CONTENT_WIDTH * 0.10,
        CONTENT_WIDTH * 0.09,
      ];
      const termHeaders = ['Term Name', 'Type', 'Basis', 'Rate', 'Tier Min', 'Tier Max', 'UOM', 'Timing'];
      const termRows = terms.map(t => [
        t.term_name || '',
        t.term_type || '',
        t.calculation_basis || '',
        t.rate_type === 'Percentage' ? `${t.rate_value}%` : `$${t.rate_value}`,
        t.tier_min !== undefined ? String(t.tier_min) : '',
        t.tier_max !== undefined ? String(t.tier_max) : '',
        t.tier_uom || '',
        t.payment_timing || '',
      ]);
      drawTable(termHeaders, termRows, termColWidths);

      terms.forEach(t => {
        if (t.notes) {
          ensureSpace(20);
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#555555');
          doc.text(`• ${t.term_name}: ${t.notes}`, CONTENT_LEFT + 10, doc.y, { width: CONTENT_WIDTH - 20 });
          doc.moveDown(0.2);
        }
      });
      doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
    } else {
      doc.text('No terms defined for this contract.', CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.4);
    }

    // ===== ELIGIBLE/EXCLUDED PRODUCTS =====
    heading('Section 5 — Product Eligibility');
    const eligibleProducts = terms.filter(t => t.applies_to_product_ids).map(t => `${t.term_name}: ${resolveCode(t.applies_to_product_ids, PRODUCT_NAMES)}`);
    const excludedProducts = terms.filter(t => t.excluded_product_ids).map(t => `${t.term_name}: ${resolveCode(t.excluded_product_ids, PRODUCT_NAMES)}`);
    if (eligibleProducts.length > 0) {
      drawKeyValue('Eligible Products', eligibleProducts.join('; '));
    }
    if (excludedProducts.length > 0) {
      drawKeyValue('Excluded Products', excludedProducts.join('; '));
    }
    if (eligibleProducts.length === 0 && excludedProducts.length === 0) {
      doc.text('All products eligible unless otherwise specified.', CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.4);
    }
    const productCategories = terms.filter(t => t.applies_to_product_category).map(t => `${t.term_name}: ${t.applies_to_product_category}`);
    if (productCategories.length > 0) {
      drawKeyValue('Product Categories', productCategories.join('; '));
    }

    // ===== QUALIFIERS =====
    heading('Section 6 — Qualifiers & Rules');
    if (qualifiers.length > 0) {
      const qualColWidths = [
        CONTENT_WIDTH * 0.18,
        CONTENT_WIDTH * 0.18,
        CONTENT_WIDTH * 0.12,
        CONTENT_WIDTH * 0.20,
        CONTENT_WIDTH * 0.10,
        CONTENT_WIDTH * 0.22,
      ];
      const qualHeaders = ['Type', 'Field', 'Operator', 'Value', 'Logic', 'Notes'];
      const qualRows = qualifiers.map(q => [
        q.qualifier_type || '',
        q.qualifier_field || '',
        q.operator || '',
        String(q.qualifier_value || ''),
        q.qualifier_logic || '',
        q.notes || '',
      ]);
      drawTable(qualHeaders, qualRows, qualColWidths);
    } else {
      doc.text('No additional qualifiers for this contract.', CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.4);
    }

    // ===== PARTNER ASSIGNMENTS =====
    heading('Section 7 — Partner Assignments');
    if (partners.length > 0) {
      const partColWidths = [
        CONTENT_WIDTH * 0.18,
        CONTENT_WIDTH * 0.15,
        CONTENT_WIDTH * 0.15,
        CONTENT_WIDTH * 0.15,
        CONTENT_WIDTH * 0.12,
        CONTENT_WIDTH * 0.25,
      ];
      const partHeaders = ['Partner', 'Type', 'Effective', 'Expires', 'Status', 'Notes'];
      const partRows = partners.map(p => [
        resolveCode(p.partner_id, PARTNER_NAMES),
        p.assignment_type || '',
        excelDateToString(p.effective_date),
        excelDateToString(p.expiration_date),
        p.status || '',
        p.notes || '',
      ]);
      drawTable(partHeaders, partRows, partColWidths);
    } else {
      doc.text('No partner assignments for this contract.', CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.4);
    }

    // ===== PAYMENT TERMS =====
    heading('Section 8 — Payment Terms');
    drawKeyValue('Payment Frequency', contract.payment_frequency);
    drawKeyValue('Currency', contract.currency);
    const claimTerms = terms.filter(t => t.requires_claim);
    if (claimTerms.length > 0) {
      drawKeyValue('Claim Required', 'Yes');
      drawKeyValue('Claim Deadline', `${claimTerms[0].claim_deadline_days} days`);
    }
    const proofTerms = terms.filter(t => t.requires_proof_of_performance);
    if (proofTerms.length > 0) {
      drawKeyValue('Proof of Performance', 'Required');
    }
    const paymentMethods = [...new Set(terms.map(t => t.payment_method).filter(Boolean))];
    if (paymentMethods.length > 0) {
      drawKeyValue('Payment Method(s)', paymentMethods.join(', '));
    }
    doc.moveDown(0.3);

    // ===== TERM & RENEWAL =====
    heading('Section 9 — Term & Renewal');
    drawKeyValue('Effective Date', excelDateToString(contract.effective_date));
    drawKeyValue('Expiration Date', excelDateToString(contract.expiration_date));
    drawKeyValue('Auto-Renew', contract.auto_renew ? 'Yes' : 'No');
    if (contract.auto_renew) {
      drawKeyValue('Renewal Term', `${contract.renewal_term_months} months`);
    }
    doc.moveDown(0.3);

    // ===== GENERAL PROVISIONS =====
    heading('Section 10 — General Provisions');
    doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
    ensureSpace(100);
    doc.text(
      `This Agreement constitutes the entire agreement between ${licensorName} ("Licensor") and ` +
      `${counterpartyDisplayName} ("Licensee") with respect to the subject matter hereof and supersedes all ` +
      `prior negotiations, representations, warranties, commitments, offers, and agreements in connection with the subject matter.`,
      CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH }
    );
    doc.moveDown(0.3);
    doc.text(
      'Any amendments or modifications must be made in writing and signed by authorized representatives of both parties. ' +
      'This Agreement shall be governed by and construed in accordance with the laws of the State of California. ' +
      'Neither party may assign this Agreement without the prior written consent of the other party.',
      CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH }
    );
    doc.moveDown(0.4);

    if (contract.notes) {
      heading('Additional Notes');
      doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
      doc.text(contract.notes, CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.4);
    }

    // ===== SIGNATURE BLOCKS =====
    ensureSpace(150);
    heading('Signatures');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
    doc.text(
      `IN WITNESS WHEREOF, the parties hereto have executed this Agreement as of the date set forth below.`,
      CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH }
    );
    doc.moveDown(0.6);

    const sigStartY = doc.y;
    const halfWidth = CONTENT_WIDTH / 2 - 10;

    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY);
    doc.text('LICENSOR / MANUFACTURER', CONTENT_LEFT, sigStartY, { width: halfWidth });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
    doc.text(licensorName, CONTENT_LEFT, doc.y, { width: halfWidth });
    doc.moveDown(1.5);
    const sigLineY1 = doc.y;
    doc.save();
    doc.moveTo(CONTENT_LEFT, sigLineY1).lineTo(CONTENT_LEFT + halfWidth - 20, sigLineY1).lineWidth(0.5).strokeColor(BORDER_COLOR).stroke();
    doc.restore();
    doc.y = sigLineY1 + 2;
    doc.text('Authorized Signature', CONTENT_LEFT, doc.y, { width: halfWidth });
    doc.moveDown(0.3);
    doc.text('Name: _______________', CONTENT_LEFT, doc.y, { width: halfWidth });
    doc.moveDown(0.3);
    doc.text('Title: _______________', CONTENT_LEFT, doc.y, { width: halfWidth });
    doc.moveDown(0.3);
    doc.text('Date: _______________', CONTENT_LEFT, doc.y, { width: halfWidth });
    const leftEndY = doc.y;

    doc.y = sigStartY;
    const rightX = CONTENT_LEFT + CONTENT_WIDTH / 2 + 10;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY);
    doc.text(`LICENSEE / ${counterpartyLabel.toUpperCase()}`, rightX, sigStartY, { width: halfWidth });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
    doc.text(counterpartyDisplayName, rightX, doc.y, { width: halfWidth });
    doc.moveDown(1.5);
    const sigLineY2 = doc.y;
    doc.save();
    doc.moveTo(rightX, sigLineY2).lineTo(rightX + halfWidth - 20, sigLineY2).lineWidth(0.5).strokeColor(BORDER_COLOR).stroke();
    doc.restore();
    doc.y = sigLineY2 + 2;
    doc.text('Authorized Signature', rightX, doc.y, { width: halfWidth });
    doc.moveDown(0.3);
    doc.text('Name: _______________', rightX, doc.y, { width: halfWidth });
    doc.moveDown(0.3);
    doc.text('Title: _______________', rightX, doc.y, { width: halfWidth });
    doc.moveDown(0.3);
    doc.text('Date: _______________', rightX, doc.y, { width: halfWidth });
    const rightEndY = doc.y;

    doc.y = Math.max(leftEndY, rightEndY);
    doc.moveDown(1);

    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#888888');
    doc.text('CONFIDENTIAL — This document and its contents are proprietary and confidential.', CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH, align: 'center' });

    doc.end();
  });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const wb = xlsx.readFile(EXCEL_PATH);

  const contracts = parseSheet(wb.Sheets['Contract Master']);
  const allTerms = parseSheet(wb.Sheets['Terms']);

  const rawQualifiers = xlsx.utils.sheet_to_json<any[]>(wb.Sheets['Qualifiers'], { header: 1, blankrows: false });
  const qualHeaders = rawQualifiers[1] as string[];
  const allQualifiers: SheetRow[] = [];
  for (let i = 2; i < rawQualifiers.length; i++) {
    const row = rawQualifiers[i] as any[];
    if (!row || !row[0]) continue;
    const obj: SheetRow = {};
    qualHeaders.forEach((h, idx) => { obj[h] = row[idx] !== undefined ? row[idx] : ''; });
    allQualifiers.push(obj);
  }

  const rawPartners = xlsx.utils.sheet_to_json<any[]>(wb.Sheets['Partner Assignments'], { header: 1, blankrows: false });
  const partHeaders = rawPartners[1] as string[];
  const allPartners: SheetRow[] = [];
  for (let i = 2; i < rawPartners.length; i++) {
    const row = rawPartners[i] as any[];
    if (!row || !row[0]) continue;
    const obj: SheetRow = {};
    partHeaders.forEach((h, idx) => { obj[h] = row[idx] !== undefined ? row[idx] : ''; });
    allPartners.push(obj);
  }

  console.log(`Found ${contracts.length} contracts, ${allTerms.length} terms, ${allQualifiers.length} qualifiers, ${allPartners.length} partners`);

  for (const contract of contracts) {
    const contractId = contract.contract_id;
    const terms = allTerms.filter(t => t.contract_id === contractId);
    const termIds = new Set(terms.map(t => t.term_id));
    const qualifiers = allQualifiers.filter(q => termIds.has(q.term_id));
    const partners = allPartners.filter(p => p.contract_id === contractId);

    const safeName = (contract.contract_name || contractId).replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
    const filename = `${safeName}.pdf`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    console.log(`Generating ${filename} (${terms.length} terms, ${qualifiers.length} qualifiers, ${partners.length} partners)...`);
    await generatePDF(contract, terms, qualifiers, partners, outputPath);
    console.log(`  ✓ ${filename} created`);
  }

  console.log(`\nDone! Generated ${contracts.length} PDFs in ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
