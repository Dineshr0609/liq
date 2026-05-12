import PDFDocument from 'pdfkit';

export function generateDistributorAgreementPDF(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      bufferPages: true,
      info: {
        Title: 'Distributor Reseller Agreement - Super Lenses Company & North West Distribution',
        Author: 'LicenseIQ',
        Subject: 'Distributor Reseller Agreement',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const effectiveDate = dateStr;
    const expirationYear = today.getFullYear() + 3;
    const expirationDate = new Date(expirationYear, today.getMonth(), today.getDate())
      .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const LEFT = 72;
    const RIGHT = 540;
    const pageWidth = RIGHT - LEFT;

    function resetCursor() {
      doc.x = LEFT;
    }

    function checkPage(needed: number = 80) {
      if (doc.y > 720 - needed) {
        doc.addPage();
        resetCursor();
      }
    }

    function drawTableRow(y: number, cols: { text: string; width: number; align?: string; bold?: boolean }[], opts?: { bg?: string; height?: number }) {
      const rowH = opts?.height || 22;
      let x = LEFT;
      if (opts?.bg) {
        doc.rect(x, y, pageWidth, rowH).fill(opts.bg);
      }
      doc.rect(x, y, pageWidth, rowH).strokeColor('#999999').lineWidth(0.5).stroke();
      for (const col of cols) {
        doc.rect(x, y, col.width, rowH).stroke();
        doc.fillColor('#1a1a1a').fontSize(9);
        if (col.bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
        doc.text(col.text, x + 6, y + 6, { width: col.width - 12, align: (col.align as any) || 'left' });
        x += col.width;
      }
      resetCursor();
      return y + rowH;
    }

    function sectionTitle(num: number, title: string) {
      checkPage(60);
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#1a237e')
        .text(`${num}. ${title}`, LEFT, doc.y, { width: pageWidth });
      doc.moveDown(0.3);
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).strokeColor('#1a237e').lineWidth(1).stroke();
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
      resetCursor();
    }

    function bodyText(text: string) {
      checkPage(40);
      doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a')
        .text(text, LEFT, doc.y, { width: pageWidth, align: 'left', lineGap: 2 });
      doc.moveDown(0.3);
      resetCursor();
    }

    function bulletPoint(text: string) {
      checkPage(30);
      doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a')
        .text(`    \u2022  ${text}`, LEFT, doc.y, { width: pageWidth, indent: 0, lineGap: 2 });
      resetCursor();
    }

    function subSection(label: string, text: string) {
      checkPage(30);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333')
        .text(label, LEFT, doc.y, { width: pageWidth, continued: true });
      doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a')
        .text(` ${text}`, { width: pageWidth });
      doc.moveDown(0.2);
      resetCursor();
    }

    // ===== COVER / TITLE PAGE =====
    doc.moveDown(5);
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#1a237e')
      .text('DISTRIBUTOR RESELLER', LEFT, doc.y, { align: 'center', width: pageWidth });
    doc.text('AGREEMENT', LEFT, doc.y, { align: 'center', width: pageWidth });
    doc.moveDown(1.5);

    doc.moveTo(200, doc.y).lineTo(400, doc.y).strokeColor('#1a237e').lineWidth(2).stroke();
    doc.moveDown(1.5);

    doc.font('Helvetica').fontSize(14).fillColor('#333333')
      .text('Between', LEFT, doc.y, { align: 'center', width: pageWidth });
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1a237e')
      .text('SUPER LENSES COMPANY', LEFT, doc.y, { align: 'center', width: pageWidth });
    doc.font('Helvetica').fontSize(12).fillColor('#555555')
      .text('(hereinafter referred to as "Manufacturer")', LEFT, doc.y, { align: 'center', width: pageWidth });
    doc.moveDown(0.8);
    doc.font('Helvetica').fontSize(14).fillColor('#333333')
      .text('and', LEFT, doc.y, { align: 'center', width: pageWidth });
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1a237e')
      .text('NORTH WEST DISTRIBUTION', LEFT, doc.y, { align: 'center', width: pageWidth });
    doc.font('Helvetica').fontSize(12).fillColor('#555555')
      .text('(hereinafter referred to as "Distributor")', LEFT, doc.y, { align: 'center', width: pageWidth });

    doc.moveDown(3);
    doc.font('Helvetica').fontSize(12).fillColor('#333333')
      .text(`Effective Date: ${effectiveDate}`, LEFT, doc.y, { align: 'center', width: pageWidth });
    doc.moveDown(0.5);
    doc.text(`Agreement Number: DRA-SL-NWD-${today.getFullYear()}-001`, LEFT, doc.y, { align: 'center', width: pageWidth });

    doc.moveDown(4);
    doc.fontSize(9).fillColor('#888888')
      .text('CONFIDENTIAL \u2014 FOR AUTHORIZED PARTIES ONLY', LEFT, doc.y, { align: 'center', width: pageWidth });
    doc.text('This document contains proprietary business terms and is not to be disclosed to third parties.', LEFT, doc.y, { align: 'center', width: pageWidth });

    // ===== PAGE 2+: AGREEMENT BODY =====
    doc.addPage();
    resetCursor();

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a1a')
      .text(`This Distributor Reseller Agreement ("Agreement") is entered into as of ${effectiveDate} ("Effective Date") by and between:`, LEFT, doc.y, { width: pageWidth });
    doc.moveDown(0.5);
    resetCursor();
    bodyText(`Super Lenses Company, a corporation organized and existing under the laws of the State of Delaware, with its principal place of business at 1200 Innovation Drive, Suite 400, San Jose, CA 95134 ("Manufacturer"); and`);
    bodyText(`North West Distribution, a limited liability company organized under the laws of the State of Washington, with its principal place of business at 3500 Commerce Way, Suite 200, Seattle, WA 98101 ("Distributor").`);
    bodyText(`Collectively referred to as the "Parties" and individually as a "Party."`);
    doc.moveDown(0.3);
    bodyText(`WHEREAS, Manufacturer designs, manufactures, and distributes premium audio equipment including headphones and soundbars; and`);
    bodyText(`WHEREAS, Distributor possesses the necessary infrastructure, market presence, and expertise to distribute and resell Manufacturer's products within the designated territories; and`);
    bodyText(`WHEREAS, the Parties desire to establish a non-exclusive distribution arrangement pursuant to the terms and conditions set forth herein;`);
    bodyText(`NOW, THEREFORE, in consideration of the mutual covenants and agreements hereinafter set forth and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:`);

    sectionTitle(1, 'DEFINITIONS');
    bodyText(`For purposes of this Agreement, the following terms shall have the meanings set forth below:`);
    subSection('1.1 "Agreement"', 'means this Distributor Reseller Agreement, including all exhibits, schedules, and amendments hereto.');
    subSection('1.2 "Products"', 'means the Manufacturer\'s audio equipment products specifically identified in Section 4, including Headphones and Soundbars, together with any successor or replacement products mutually agreed upon by the Parties.');
    subSection('1.3 "Territory"', 'means the geographic regions specified in Section 3 within which Distributor is authorized to distribute and resell the Products.');
    subSection('1.4 "Net Sales"', 'means the gross invoiced sales price of Products sold by Distributor to end customers or sub-distributors, less (i) returns and allowances, (ii) trade discounts actually granted, (iii) freight and shipping charges separately invoiced, and (iv) applicable sales, use, or value-added taxes.');
    subSection('1.5 "Minimum Advertised Price" or "MAP"', 'means the minimum price at which Distributor may advertise or offer for sale the Products, as established by Manufacturer and set forth in Section 5.');
    subSection('1.6 "Quarter" or "Quarterly Period"', 'means each successive three-month period commencing on January 1, April 1, July 1, and October 1 of each calendar year during the Term.');
    subSection('1.7 "Rebate"', 'means the retrospective volume-based discount payable by Manufacturer to Distributor in accordance with the Volume Rebate Program described in Section 7.');
    subSection('1.8 "Effective Date"', `means ${effectiveDate}, the date upon which this Agreement becomes effective.`);

    sectionTitle(2, 'APPOINTMENT OF DISTRIBUTOR');
    bodyText(`2.1 Manufacturer hereby appoints Distributor, and Distributor hereby accepts such appointment, as a non-exclusive authorized distributor and reseller of the Products within the Territory, subject to the terms and conditions of this Agreement.`);
    bodyText(`2.2 Distributor shall use commercially reasonable efforts to promote, market, and sell the Products throughout the Territory, maintaining adequate inventory levels, trained sales personnel, and customer support capabilities consistent with industry standards.`);
    bodyText(`2.3 Distributor shall not appoint sub-distributors or assign any rights under this Agreement without the prior written consent of Manufacturer, which consent shall not be unreasonably withheld or delayed.`);
    bodyText(`2.4 Nothing in this Agreement shall be construed to create a partnership, joint venture, agency, or employment relationship between the Parties. Distributor is an independent contractor and shall conduct its business in its own name and at its own risk and expense.`);

    sectionTitle(3, 'TERRITORY');
    bodyText(`3.1 The Territory for purposes of this Agreement shall consist of the following geographic regions:`);
    bulletPoint('United States of America (all fifty states and the District of Columbia)');
    bulletPoint('Canada (all provinces and territories)');
    doc.moveDown(0.3);
    bodyText(`3.2 Distributor shall not actively solicit orders or establish distribution channels for the Products outside the Territory without the prior written consent of Manufacturer. Passive sales to customers located outside the Territory that result from unsolicited inquiries shall be permitted.`);
    bodyText(`3.3 Manufacturer reserves the right to modify the Territory upon ninety (90) days' prior written notice to Distributor, provided that any territory reduction shall not affect existing customer relationships or pending orders within the affected region.`);

    sectionTitle(4, 'PRODUCTS COVERED');
    bodyText(`4.1 This Agreement shall apply to the following Products manufactured or distributed by Manufacturer:`);
    doc.moveDown(0.3);
    checkPage(80);

    let y = doc.y;
    y = drawTableRow(y, [
      { text: 'Product Category', width: 156, bold: true },
      { text: 'Description', width: 200, bold: true },
      { text: 'SKU Prefix', width: 112, bold: true },
    ], { bg: '#e8eaf6', height: 24 });
    y = drawTableRow(y, [
      { text: 'Headphones', width: 156 },
      { text: 'Premium wireless and wired headphone models', width: 200 },
      { text: 'SL-HP-*', width: 112 },
    ]);
    y = drawTableRow(y, [
      { text: 'Soundbars', width: 156 },
      { text: 'Home theater and portable soundbar systems', width: 200 },
      { text: 'SL-SB-*', width: 112 },
    ]);
    doc.y = y + 10;
    resetCursor();

    bodyText(`4.2 Manufacturer may add additional products to this Agreement by written amendment, subject to mutual consent of both Parties. Removal of products from this Agreement shall require sixty (60) days' prior written notice.`);

    sectionTitle(5, 'PRICING & MINIMUM RESALE PRICE');
    bodyText(`5.1 Wholesale Pricing. Manufacturer shall provide Distributor with a wholesale price list, updated no less frequently than annually. Wholesale prices may be adjusted by Manufacturer upon sixty (60) days' prior written notice.`);
    bodyText(`5.2 Minimum Advertised Price (MAP) Policy. Distributor agrees to comply with the Manufacturer's MAP Policy as follows:`);
    bodyText(`(a) Distributor shall not advertise, promote, display, or offer for sale any Product at a price below the applicable Minimum Advertised Price set forth in the table below.`);
    bodyText(`(b) The MAP applies to all forms of advertising, including but not limited to: print media, digital advertising, email marketing, social media, website listings, and point-of-sale displays.`);
    doc.moveDown(0.3);

    checkPage(80);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a237e')
      .text('Table 5.1 \u2014 Minimum Advertised Prices by Product and Territory', LEFT, doc.y, { width: pageWidth });
    doc.moveDown(0.3);
    resetCursor();
    y = doc.y;
    y = drawTableRow(y, [
      { text: 'Product', width: 156, bold: true },
      { text: 'United States (USD)', width: 156, bold: true },
      { text: 'Canada (CAD)', width: 156, bold: true },
    ], { bg: '#e8eaf6', height: 24 });
    y = drawTableRow(y, [
      { text: 'Headphones', width: 156 },
      { text: '$80.00', width: 156, align: 'right' },
      { text: '$85.00', width: 156, align: 'right' },
    ]);
    y = drawTableRow(y, [
      { text: 'Soundbars', width: 156 },
      { text: '$150.00', width: 156, align: 'right' },
      { text: '$160.00', width: 156, align: 'right' },
    ]);
    doc.y = y + 10;
    resetCursor();

    bodyText(`5.3 MAP Compliance and Enforcement. Violation of the MAP Policy shall be subject to the following progressive enforcement measures:`);
    bulletPoint('First Violation: Written warning issued by Manufacturer with a fourteen (14) day cure period.');
    bulletPoint('Second Violation: Immediate suspension of all rebate payments for the current and subsequent Quarter, effective upon written notice from Manufacturer.');
    bulletPoint('Third Violation: Manufacturer shall have the right to terminate this Agreement immediately upon written notice, in addition to any other remedies available at law or in equity.');
    doc.moveDown(0.3);
    bodyText(`5.4 Manufacturer reserves the right to conduct periodic pricing audits to verify Distributor's compliance with the MAP Policy. Distributor shall cooperate fully with any such audit and provide requested pricing data within ten (10) business days of request.`);

    sectionTitle(6, 'ORDERS & PAYMENT TERMS');
    bodyText(`6.1 Orders. Distributor shall submit purchase orders to Manufacturer in writing (including by electronic means) specifying product quantities, delivery dates, and shipping instructions. Manufacturer shall confirm or reject each order within five (5) business days of receipt.`);
    bodyText(`6.2 Payment Terms. Unless otherwise agreed in writing, payment for all orders shall be due net thirty (30) days from the date of invoice. All payments shall be made in the currency of the applicable Territory (USD for United States, CAD for Canada).`);
    bodyText(`6.3 Late Payments. Any amounts not paid when due shall bear interest at the lesser of one and one-half percent (1.5%) per month or the maximum rate permitted by applicable law, calculated from the due date until the date of actual payment.`);
    bodyText(`6.4 Minimum Order Quantities. Manufacturer may establish minimum order quantities for individual Products, which shall be communicated to Distributor in writing at least thirty (30) days prior to implementation.`);

    sectionTitle(7, 'VOLUME REBATE PROGRAM');
    bodyText(`7.1 Program Overview. Manufacturer shall maintain a Volume Rebate Program ("Rebate Program") pursuant to which Distributor may earn retrospective rebates based on the total cumulative volume of Products purchased during each Quarterly Period.`);
    bodyText(`7.2 Rebate Tiers. The following rebate tiers shall apply to the Distributor's cumulative quarterly Net Sales volume:`);
    doc.moveDown(0.3);

    checkPage(100);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a237e')
      .text('Table 7.1 \u2014 Volume-Based Rebate Tier Schedule', LEFT, doc.y, { width: pageWidth });
    doc.moveDown(0.3);
    resetCursor();
    y = doc.y;
    y = drawTableRow(y, [
      { text: 'Tier', width: 80, bold: true },
      { text: 'Quarterly Unit Volume', width: 188, bold: true },
      { text: 'Rebate Percentage', width: 100, bold: true },
      { text: 'Basis', width: 100, bold: true },
    ], { bg: '#e8eaf6', height: 24 });
    y = drawTableRow(y, [
      { text: 'Tier 1', width: 80 },
      { text: '0 \u2014 1,000 units', width: 188 },
      { text: '2.0%', width: 100, align: 'center' },
      { text: 'Net Sales', width: 100 },
    ]);
    y = drawTableRow(y, [
      { text: 'Tier 2', width: 80 },
      { text: '1,001 \u2014 5,000 units', width: 188 },
      { text: '5.0%', width: 100, align: 'center' },
      { text: 'Net Sales', width: 100 },
    ]);
    y = drawTableRow(y, [
      { text: 'Tier 3', width: 80 },
      { text: '5,001+ units', width: 188 },
      { text: '8.0%', width: 100, align: 'center' },
      { text: 'Net Sales', width: 100 },
    ]);
    doc.y = y + 10;
    resetCursor();

    bodyText(`7.3 Retrospective Calculation. Rebates shall be calculated retrospectively based on total cumulative quarterly purchases and applied to all eligible units within that quarter. Upon attainment of a higher tier during the Quarter, the higher rebate percentage shall be applied retroactively to all qualifying units purchased during that entire Quarter.`);
    bodyText(`7.4 Territory-Specific Rebate Adjustments. The following territory-specific rebate adjustments may apply in addition to or in lieu of the standard rebate tiers set forth in Table 7.1:`);
    doc.moveDown(0.3);

    checkPage(80);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a237e')
      .text('Table 7.2 \u2014 Territory-Specific Rebate Schedule', LEFT, doc.y, { width: pageWidth });
    doc.moveDown(0.3);
    resetCursor();
    y = doc.y;
    y = drawTableRow(y, [
      { text: 'Territory', width: 156, bold: true },
      { text: 'Tier 1 Override', width: 104, bold: true },
      { text: 'Tier 2 Override', width: 104, bold: true },
      { text: 'Tier 3 Override', width: 104, bold: true },
    ], { bg: '#e8eaf6', height: 24 });
    y = drawTableRow(y, [
      { text: 'United States', width: 156 },
      { text: '2.0%', width: 104, align: 'center' },
      { text: '5.0%', width: 104, align: 'center' },
      { text: '8.0%', width: 104, align: 'center' },
    ]);
    y = drawTableRow(y, [
      { text: 'Canada', width: 156 },
      { text: '2.0%', width: 104, align: 'center' },
      { text: '5.0%', width: 104, align: 'center' },
      { text: '8.0%', width: 104, align: 'center' },
    ]);
    doc.y = y + 10;
    resetCursor();

    bodyText(`7.5 Rebate Payment. All earned rebates shall be paid by Manufacturer to Distributor within forty-five (45) days following the end of each Quarter. Payment shall be made by wire transfer or check to the account designated by Distributor.`);

    sectionTitle(8, 'REBATE CALCULATION METHODOLOGY');
    bodyText(`8.1 Quarterly Accumulation. For each Quarter, Distributor's aggregate unit volume shall be calculated based on all confirmed and shipped orders during the applicable Quarterly Period, regardless of the date of invoice or payment.`);
    bodyText(`8.2 Retrospective Application. When Distributor's cumulative purchases during a Quarter cross from one rebate tier to the next higher tier, the higher rebate percentage shall apply retroactively to all units purchased during that Quarter. For the avoidance of doubt, the following example illustrates the methodology:`);
    doc.moveDown(0.2);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#444444')
      .text(`Example: If Distributor purchases 800 units in Month 1 (Tier 1 at 2%) and 600 units in Month 2 (cumulative 1,400 units, crossing into Tier 2), the 5% rebate shall apply to all 1,400 units, not just the incremental 600 units.`, LEFT, doc.y, { width: pageWidth, lineGap: 2 });
    doc.moveDown(0.3);
    resetCursor();
    doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
    bodyText(`8.3 Product Aggregation. Units of all Product categories (Headphones and Soundbars) shall be aggregated for purposes of determining the applicable rebate tier, unless otherwise specified in a written amendment to this Agreement.`);
    bodyText(`8.4 Exclusions. The following shall be excluded from rebate-eligible volume: (i) warranty replacements, (ii) sample units, (iii) units returned or credited, and (iv) units sold in violation of the MAP Policy.`);

    sectionTitle(9, 'QUARTERLY REPORTING & AUDIT RIGHTS');
    bodyText(`9.1 Quarterly Reports. Within fifteen (15) days following the end of each Quarter, Distributor shall submit to Manufacturer a detailed sales report including: (i) total units sold by Product and Territory, (ii) Net Sales revenue by Product and Territory, (iii) inventory levels by Product, and (iv) any pricing exceptions or deviations from MAP.`);
    bodyText(`9.2 Audit Rights. Manufacturer shall have the right, upon thirty (30) days' prior written notice, to audit Distributor's books, records, and accounts related to the Products, including sales records, inventory records, and financial statements. Such audits may be conducted no more than twice per calendar year during normal business hours.`);
    bodyText(`9.3 Audit Discrepancies. If any audit reveals that Distributor has underreported sales volume or overstated deductions by more than three percent (3%), Distributor shall bear the reasonable costs of the audit and promptly remit any underpayment identified.`);

    sectionTitle(10, 'RETROSPECTIVE ADJUSTMENTS');
    bodyText(`10.1 End-of-Quarter True-Up. At the conclusion of each Quarterly Period, Manufacturer shall perform a true-up calculation comparing actual cumulative volume against the rebate tiers. Any difference between interim rebate credits (if applicable) and the final calculated rebate amount shall be settled within the forty-five (45) day payment window.`);
    bodyText(`10.2 Returns and Credits. Products returned during or after a Quarter shall reduce the cumulative volume for the Quarter in which the original sale occurred. If such reduction causes a tier reclassification, the rebate shall be recalculated accordingly and any overpayment shall be offset against future rebate payments.`);
    bodyText(`10.3 Dispute Resolution for Adjustments. Any disputes arising from retrospective adjustments shall be resolved in accordance with the dispute resolution procedures set forth in Section 14 of this Agreement. Pending resolution of any dispute, undisputed amounts shall continue to be paid according to the regular schedule.`);

    sectionTitle(11, 'COMPLIANCE & PRICING VIOLATIONS');
    bodyText(`11.1 General Compliance. Distributor shall comply with all applicable laws, regulations, and industry standards in connection with the distribution and resale of the Products, including but not limited to consumer protection laws, trade regulations, and advertising standards.`);
    bodyText(`11.2 Pricing Violations. In addition to the progressive enforcement measures described in Section 5.3, the following provisions shall apply to pricing violations:`);
    bodyText(`(a) Manufacturer may suspend shipment of new orders upon the occurrence of a second MAP violation until Distributor has demonstrated corrective action satisfactory to Manufacturer.`);
    bodyText(`(b) Repeated or willful MAP violations may result in forfeiture of all earned but unpaid rebates for the Quarter in which the violation occurs.`);
    bodyText(`(c) Distributor shall implement and maintain internal controls and training programs designed to prevent MAP violations by its sales personnel and authorized sub-distributors (if any).`);
    bodyText(`11.3 Anti-Corruption. Each Party represents and warrants that it shall not, directly or indirectly, offer, pay, promise, or authorize the payment of any money or anything of value to any government official, political party, or candidate for public office for the purpose of influencing any act or decision in connection with this Agreement.`);

    sectionTitle(12, 'TERM & TERMINATION');
    bodyText(`12.1 Initial Term. This Agreement shall commence on the Effective Date and shall continue for an initial term of three (3) years (the "Initial Term"), expiring on ${expirationDate}, unless earlier terminated in accordance with this Section.`);
    bodyText(`12.2 Renewal. Upon expiration of the Initial Term, this Agreement shall automatically renew for successive one (1) year periods (each, a "Renewal Term"), unless either Party provides written notice of non-renewal at least ninety (90) days prior to the expiration of the then-current term.`);
    bodyText(`12.3 Termination for Cause. Either Party may terminate this Agreement immediately upon written notice if the other Party: (i) commits a material breach that remains uncured for thirty (30) days after written notice thereof, (ii) becomes insolvent, files for bankruptcy, or has a receiver appointed for its assets, or (iii) commits a third MAP pricing violation as described in Section 5.3.`);
    bodyText(`12.4 Termination for Convenience. Either Party may terminate this Agreement without cause upon one hundred twenty (120) days' prior written notice to the other Party.`);
    bodyText(`12.5 Effect of Termination. Upon termination or expiration: (i) all outstanding purchase orders accepted prior to the effective date of termination shall be fulfilled, (ii) all earned but unpaid rebates shall be calculated and paid within forty-five (45) days, (iii) Distributor shall cease using Manufacturer's trademarks and marketing materials, and (iv) Distributor may sell remaining inventory for a period of ninety (90) days following termination.`);

    sectionTitle(13, 'CONFIDENTIALITY');
    bodyText(`13.1 Confidential Information. Each Party acknowledges that in the course of performing this Agreement, it may receive or have access to confidential and proprietary information of the other Party, including but not limited to: pricing information, customer lists, sales data, marketing strategies, product development plans, and financial information ("Confidential Information").`);
    bodyText(`13.2 Obligations. The receiving Party shall: (i) maintain all Confidential Information in strict confidence, (ii) not disclose Confidential Information to any third party without the prior written consent of the disclosing Party, (iii) use Confidential Information solely for purposes of performing its obligations under this Agreement, and (iv) protect Confidential Information using the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.`);
    bodyText(`13.3 Survival. The obligations of confidentiality set forth in this Section shall survive the termination or expiration of this Agreement for a period of three (3) years.`);

    sectionTitle(14, 'GOVERNING LAW & DISPUTE RESOLUTION');
    bodyText(`14.1 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.`);
    bodyText(`14.2 Dispute Resolution. Any dispute, controversy, or claim arising out of or relating to this Agreement shall first be submitted to good faith negotiation between senior executives of each Party for a period of thirty (30) days.`);
    bodyText(`14.3 Arbitration. If any dispute cannot be resolved through negotiation within the thirty (30) day period, such dispute shall be submitted to binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules. The arbitration shall take place in Wilmington, Delaware, and shall be conducted by a single arbitrator with expertise in commercial distribution agreements.`);
    bodyText(`14.4 Injunctive Relief. Notwithstanding the foregoing, either Party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent or restrain any breach or threatened breach of the confidentiality or intellectual property provisions of this Agreement.`);

    sectionTitle(15, 'SIGNATURES');
    bodyText(`IN WITNESS WHEREOF, the Parties hereto have executed this Distributor Reseller Agreement as of the date first written above, by their duly authorized representatives.`);
    doc.moveDown(1.5);

    checkPage(200);
    const sigY = doc.y;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a237e')
      .text('MANUFACTURER:', LEFT, sigY, { width: pageWidth });
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a')
      .text('Super Lenses Company', LEFT, sigY + 18, { width: pageWidth });
    doc.moveDown(1.5);
    doc.moveTo(LEFT, doc.y).lineTo(280, doc.y).strokeColor('#333333').lineWidth(0.5).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor('#555555')
      .text('Authorized Signature', LEFT, doc.y, { width: pageWidth });
    doc.moveDown(0.8);
    doc.moveTo(LEFT, doc.y).lineTo(280, doc.y).stroke();
    doc.moveDown(0.3);
    doc.text('Name & Title', LEFT, doc.y, { width: pageWidth });
    doc.moveDown(0.8);
    doc.moveTo(LEFT, doc.y).lineTo(280, doc.y).stroke();
    doc.moveDown(0.3);
    doc.text('Date', LEFT, doc.y, { width: pageWidth });

    doc.moveDown(2);
    const sigY2 = doc.y;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a237e')
      .text('DISTRIBUTOR:', LEFT, sigY2, { width: pageWidth });
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a')
      .text('North West Distribution', LEFT, sigY2 + 18, { width: pageWidth });
    doc.moveDown(1.5);
    doc.moveTo(LEFT, doc.y).lineTo(280, doc.y).strokeColor('#333333').lineWidth(0.5).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor('#555555')
      .text('Authorized Signature', LEFT, doc.y, { width: pageWidth });
    doc.moveDown(0.8);
    doc.moveTo(LEFT, doc.y).lineTo(280, doc.y).stroke();
    doc.moveDown(0.3);
    doc.text('Name & Title', LEFT, doc.y, { width: pageWidth });
    doc.moveDown(0.8);
    doc.moveTo(LEFT, doc.y).lineTo(280, doc.y).stroke();
    doc.moveDown(0.3);
    doc.text('Date', LEFT, doc.y, { width: pageWidth });

    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    const origAddPage = doc.addPage.bind(doc);
    doc.addPage = () => doc as any;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#666666')
        .text('Distributor Reseller Agreement \u2014 Super Lenses Company & North West Distribution', LEFT, 30, { align: 'center', width: pageWidth, lineBreak: false });
      doc.moveTo(LEFT, 50).lineTo(RIGHT, 50).strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(8).fillColor('#888888')
        .text(`Page ${i + 1} of ${totalPages}`, LEFT, 740, { align: 'center', width: pageWidth, lineBreak: false });
      doc.moveTo(LEFT, 735).lineTo(RIGHT, 735).strokeColor('#cccccc').lineWidth(0.5).stroke();
    }
    doc.addPage = origAddPage;

    doc.end();
  });
}
