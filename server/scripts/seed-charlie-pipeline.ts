import ws from "ws";
import { neonConfig, Pool } from "@neondatabase/serverless";

neonConfig.webSocketConstructor = ws;

const COMPANY_ID = "56d6dc94-8b4a-4537-b0b7-36e23502dd1d";
const CONTRACT_ID = "cp-contract-h1-2026";
const ADMIN_ID = "993f41bb-59e7-4a3a-ad0d-25e808ca81c7";

const csvData = `2026-01-05,INV-20001,Russet Potatoes 50lb,POT-50-RUS,Potatoes,120,18.50,2220.00,US West,Wholesale
2026-01-07,INV-20002,Yellow Onions 50lb,ONI-50-YLW,Onions,85,16.00,1360.00,US West,Wholesale
2026-01-09,INV-20003,Red Potatoes 50lb,POT-50-RED,Potatoes,60,22.00,1320.00,North America,Direct
2026-01-10,INV-20004,4350-20 Box Potatoes,4350-20,Potatoes,45,15.00,675.00,US West,Wholesale
2026-01-12,INV-20005,Red Onions 50lb,ONI-50-RED,Onions,70,20.00,1400.00,US East,Wholesale
2026-01-14,INV-20006,Apples Case,FRT-CS-APP,Fruits,90,28.00,2520.00,US West,Direct
2026-01-15,INV-20007,Lettuce Case,GEN-CS-LET,General,110,18.00,1980.00,US Central,Wholesale
2026-01-17,INV-20008,Yellow Potatoes 50lb,POT-50-YLW,Potatoes,55,24.50,1347.50,Canada,Wholesale
2026-01-19,INV-20009,White Onions 50lb,ONI-50-WHT,Onions,40,18.50,740.00,US West,Direct
2026-01-20,INV-20010,Tomatoes Case,GEN-CS-TOM,General,95,25.00,2375.00,North America,Wholesale
2026-01-22,INV-20011,Fingerling Potatoes 50lb,POT-50-FNG,Potatoes,30,32.00,960.00,US West,Wholesale
2026-01-23,INV-20012,Sweet Onions 50lb,ONI-50-SWT,Onions,65,22.00,1430.00,US East,Direct
2026-01-25,INV-20013,Carrots Case,GEN-CS-CAR,General,130,14.00,1820.00,US Central,Wholesale
2026-01-27,INV-20014,Bell Peppers Case,GEN-CS-PEP,General,50,30.00,1500.00,US West,Direct
2026-01-28,INV-20015,Russet Potatoes 50lb,POT-50-RUS,Potatoes,140,18.50,2590.00,North America,Wholesale
2026-01-29,INV-20016,Bananas Case,FRT-CS-BAN,Fruits,75,22.00,1650.00,US West,Online
2026-01-30,INV-20017,4350-20 Box Potatoes,4350-20,Potatoes,35,15.00,525.00,US East,Wholesale
2026-01-31,INV-20018,Yellow Onions 50lb,ONI-50-YLW,Onions,95,16.00,1520.00,US Central,Wholesale
2026-02-03,INV-20019,Russet Potatoes 50lb,POT-50-RUS,Potatoes,110,18.50,2035.00,US West,Wholesale
2026-02-04,INV-20020,Red Onions 50lb,ONI-50-RED,Onions,80,20.00,1600.00,US East,Direct
2026-02-06,INV-20021,Cucumbers Case,GEN-CS-CUC,General,100,16.00,1600.00,North America,Wholesale
2026-02-07,INV-20022,Yellow Potatoes 50lb,POT-50-YLW,Potatoes,65,24.50,1592.50,US West,Wholesale
2026-02-09,INV-20023,4350-20 Box Potatoes,4350-20,Potatoes,50,15.00,750.00,US Central,Wholesale
2026-02-10,INV-20024,Grapes Case,FRT-CS-GRP,Fruits,40,35.00,1400.00,US West,Direct
2026-02-12,INV-20025,White Onions 50lb,ONI-50-WHT,Onions,55,18.50,1017.50,Canada,Wholesale
2026-02-13,INV-20026,Lettuce Case,GEN-CS-LET,General,120,18.00,2160.00,US West,Wholesale
2026-02-15,INV-20027,Red Potatoes 50lb,POT-50-RED,Potatoes,75,22.00,1650.00,US East,Wholesale
2026-02-17,INV-20028,Sweet Onions 50lb,ONI-50-SWT,Onions,50,22.00,1100.00,US Central,Direct
2026-02-18,INV-20029,Tomatoes Case,GEN-CS-TOM,General,85,25.00,2125.00,North America,Wholesale
2026-02-20,INV-20030,Fingerling Potatoes 50lb,POT-50-FNG,Potatoes,25,32.00,800.00,US West,Wholesale
2026-02-21,INV-20031,Yellow Onions 50lb,ONI-50-YLW,Onions,100,16.00,1600.00,US West,Wholesale
2026-02-23,INV-20032,Apples Case,FRT-CS-APP,Fruits,60,28.00,1680.00,US East,Online
2026-02-24,INV-20033,Bell Peppers Case,GEN-CS-PEP,General,45,30.00,1350.00,US West,Direct
2026-02-25,INV-20034,Russet Potatoes 50lb,POT-50-RUS,Potatoes,130,18.50,2405.00,North America,Wholesale
2026-02-26,INV-20035,4350-20 Box Potatoes,4350-20,Potatoes,40,15.00,600.00,US West,Wholesale
2026-02-27,INV-20036,Carrots Case,GEN-CS-CAR,General,115,14.00,1610.00,US Central,Wholesale
2026-02-28,INV-20037,Red Onions 50lb,ONI-50-RED,Onions,60,20.00,1200.00,US East,Wholesale
2026-03-02,INV-20038,Russet Potatoes 50lb,POT-50-RUS,Potatoes,150,18.50,2775.00,US West,Wholesale
2026-03-04,INV-20039,Yellow Onions 50lb,ONI-50-YLW,Onions,90,16.00,1440.00,US Central,Wholesale
2026-03-05,INV-20040,Red Potatoes 50lb,POT-50-RED,Potatoes,80,22.00,1760.00,Canada,Direct
2026-03-07,INV-20041,4350-20 Box Potatoes,4350-20,Potatoes,55,15.00,825.00,US East,Wholesale
2026-03-09,INV-20042,Sweet Onions 50lb,ONI-50-SWT,Onions,70,22.00,1540.00,US West,Wholesale
2026-03-10,INV-20043,Tomatoes Case,GEN-CS-TOM,General,100,25.00,2500.00,North America,Wholesale
2026-03-12,INV-20044,Bananas Case,FRT-CS-BAN,Fruits,80,22.00,1760.00,US West,Wholesale
2026-03-13,INV-20045,Fingerling Potatoes 50lb,POT-50-FNG,Potatoes,35,32.00,1120.00,US East,Direct
2026-03-15,INV-20046,White Onions 50lb,ONI-50-WHT,Onions,45,18.50,832.50,US Central,Wholesale
2026-03-17,INV-20047,Lettuce Case,GEN-CS-LET,General,105,18.00,1890.00,US West,Wholesale
2026-03-18,INV-20048,Grapes Case,FRT-CS-GRP,Fruits,35,35.00,1225.00,US East,Online
2026-03-20,INV-20049,Cucumbers Case,GEN-CS-CUC,General,90,16.00,1440.00,US West,Direct
2026-03-22,INV-20050,Yellow Potatoes 50lb,POT-50-YLW,Potatoes,70,24.50,1715.00,North America,Wholesale
2026-03-24,INV-20051,Red Onions 50lb,ONI-50-RED,Onions,85,20.00,1700.00,US West,Wholesale
2026-03-25,INV-20052,Apples Case,FRT-CS-APP,Fruits,70,28.00,1960.00,Canada,Direct
2026-03-26,INV-20053,Bell Peppers Case,GEN-CS-PEP,General,55,30.00,1650.00,US Central,Wholesale
2026-03-27,INV-20054,4350-20 Box Potatoes,4350-20,Potatoes,30,15.00,450.00,US West,Wholesale
2026-03-28,INV-20055,Russet Potatoes 50lb,POT-50-RUS,Potatoes,125,18.50,2312.50,US East,Wholesale
2026-03-30,INV-20056,Carrots Case,GEN-CS-CAR,General,100,14.00,1400.00,US West,Wholesale
2026-03-31,INV-20057,Yellow Onions 50lb,ONI-50-YLW,Onions,110,16.00,1760.00,US West,Wholesale
2026-04-02,INV-20058,Red Potatoes 50lb,POT-50-RED,Potatoes,70,22.00,1540.00,US West,Direct
2026-04-04,INV-20059,Sweet Onions 50lb,ONI-50-SWT,Onions,55,22.00,1210.00,US East,Wholesale
2026-04-06,INV-20060,Tomatoes Case,GEN-CS-TOM,General,90,25.00,2250.00,North America,Wholesale
2026-04-07,INV-20061,4350-20 Box Potatoes,4350-20,Potatoes,60,15.00,900.00,US Central,Wholesale
2026-04-09,INV-20062,Fingerling Potatoes 50lb,POT-50-FNG,Potatoes,40,32.00,1280.00,US West,Wholesale
2026-04-10,INV-20063,White Onions 50lb,ONI-50-WHT,Onions,60,18.50,1110.00,US East,Direct
2026-04-12,INV-20064,Lettuce Case,GEN-CS-LET,General,95,18.00,1710.00,US West,Wholesale
2026-04-14,INV-20065,Bananas Case,FRT-CS-BAN,Fruits,65,22.00,1430.00,US Central,Online
2026-04-15,INV-20066,Yellow Onions 50lb,ONI-50-YLW,Onions,80,16.00,1280.00,US West,Wholesale
2026-04-17,INV-20067,Russet Potatoes 50lb,POT-50-RUS,Potatoes,135,18.50,2497.50,North America,Wholesale
2026-04-19,INV-20068,Cucumbers Case,GEN-CS-CUC,General,80,16.00,1280.00,US East,Wholesale
2026-04-20,INV-20069,Grapes Case,FRT-CS-GRP,Fruits,45,35.00,1575.00,US West,Direct
2026-04-22,INV-20070,Red Onions 50lb,ONI-50-RED,Onions,75,20.00,1500.00,Canada,Wholesale
2026-04-24,INV-20071,Yellow Potatoes 50lb,POT-50-YLW,Potatoes,50,24.50,1225.00,US West,Wholesale
2026-04-25,INV-20072,4350-20 Box Potatoes,4350-20,Potatoes,35,15.00,525.00,US East,Wholesale
2026-04-27,INV-20073,Bell Peppers Case,GEN-CS-PEP,General,60,30.00,1800.00,US West,Wholesale
2026-04-28,INV-20074,Apples Case,FRT-CS-APP,Fruits,55,28.00,1540.00,US East,Direct
2026-04-30,INV-20075,Carrots Case,GEN-CS-CAR,General,120,14.00,1680.00,US Central,Wholesale
2026-05-02,INV-20076,Russet Potatoes 50lb,POT-50-RUS,Potatoes,145,18.50,2682.50,US West,Wholesale
2026-05-04,INV-20077,Yellow Onions 50lb,ONI-50-YLW,Onions,105,16.00,1680.00,US East,Wholesale
2026-05-05,INV-20078,Red Potatoes 50lb,POT-50-RED,Potatoes,65,22.00,1430.00,North America,Direct
2026-05-07,INV-20079,4350-20 Box Potatoes,4350-20,Potatoes,45,15.00,675.00,US West,Wholesale
2026-05-08,INV-20080,Sweet Onions 50lb,ONI-50-SWT,Onions,60,22.00,1320.00,US Central,Wholesale
2026-05-10,INV-20081,Tomatoes Case,GEN-CS-TOM,General,110,25.00,2750.00,US West,Wholesale
2026-05-12,INV-20082,Fingerling Potatoes 50lb,POT-50-FNG,Potatoes,30,32.00,960.00,US East,Wholesale
2026-05-13,INV-20083,White Onions 50lb,ONI-50-WHT,Onions,50,18.50,925.00,US West,Direct
2026-05-15,INV-20084,Lettuce Case,GEN-CS-LET,General,100,18.00,1800.00,Canada,Wholesale
2026-05-16,INV-20085,Bananas Case,FRT-CS-BAN,Fruits,70,22.00,1540.00,US West,Wholesale
2026-05-18,INV-20086,Red Onions 50lb,ONI-50-RED,Onions,90,20.00,1800.00,US East,Wholesale
2026-05-20,INV-20087,Yellow Potatoes 50lb,POT-50-YLW,Potatoes,60,24.50,1470.00,US Central,Wholesale
2026-05-22,INV-20088,Grapes Case,FRT-CS-GRP,Fruits,50,35.00,1750.00,US West,Online
2026-05-23,INV-20089,Cucumbers Case,GEN-CS-CUC,General,85,16.00,1360.00,North America,Wholesale
2026-05-25,INV-20090,Russet Potatoes 50lb,POT-50-RUS,Potatoes,115,18.50,2127.50,US West,Direct
2026-05-26,INV-20091,4350-20 Box Potatoes,4350-20,Potatoes,40,15.00,600.00,US East,Wholesale
2026-05-28,INV-20092,Bell Peppers Case,GEN-CS-PEP,General,50,30.00,1500.00,US West,Wholesale
2026-05-29,INV-20093,Apples Case,FRT-CS-APP,Fruits,80,28.00,2240.00,US East,Direct
2026-05-30,INV-20094,Carrots Case,GEN-CS-CAR,General,105,14.00,1470.00,US Central,Wholesale
2026-05-31,INV-20095,Yellow Onions 50lb,ONI-50-YLW,Onions,120,16.00,1920.00,US West,Wholesale
2026-06-01,INV-20096,Red Potatoes 50lb,POT-50-RED,Potatoes,85,22.00,1870.00,US West,Wholesale
2026-06-03,INV-20097,Sweet Onions 50lb,ONI-50-SWT,Onions,75,22.00,1650.00,North America,Wholesale
2026-06-04,INV-20098,4350-20 Box Potatoes,4350-20,Potatoes,50,15.00,750.00,US West,Wholesale
2026-06-06,INV-20099,Tomatoes Case,GEN-CS-TOM,General,95,25.00,2375.00,US East,Wholesale
2026-06-07,INV-20100,Fingerling Potatoes 50lb,POT-50-FNG,Potatoes,45,32.00,1440.00,US West,Direct
2026-06-09,INV-20101,White Onions 50lb,ONI-50-WHT,Onions,65,18.50,1202.50,US Central,Wholesale
2026-06-10,INV-20102,Lettuce Case,GEN-CS-LET,General,115,18.00,2070.00,US West,Wholesale
2026-06-12,INV-20103,Bananas Case,FRT-CS-BAN,Fruits,85,22.00,1870.00,Canada,Wholesale
2026-06-13,INV-20104,Red Onions 50lb,ONI-50-RED,Onions,95,20.00,1900.00,US East,Wholesale
2026-06-15,INV-20105,Yellow Potatoes 50lb,POT-50-YLW,Potatoes,75,24.50,1837.50,US West,Wholesale
2026-06-17,INV-20106,Russet Potatoes 50lb,POT-50-RUS,Potatoes,160,18.50,2960.00,North America,Wholesale
2026-06-18,INV-20107,4350-20 Box Potatoes,4350-20,Potatoes,55,15.00,825.00,US East,Wholesale
2026-06-20,INV-20108,Yellow Onions 50lb,ONI-50-YLW,Onions,130,16.00,2080.00,US West,Wholesale
2026-06-22,INV-20109,Grapes Case,FRT-CS-GRP,Fruits,55,35.00,1925.00,US East,Direct
2026-06-23,INV-20110,Cucumbers Case,GEN-CS-CUC,General,95,16.00,1520.00,US West,Wholesale
2026-06-25,INV-20111,Bell Peppers Case,GEN-CS-PEP,General,65,30.00,1950.00,US Central,Wholesale
2026-06-26,INV-20112,Apples Case,FRT-CS-APP,Fruits,75,28.00,2100.00,US West,Online
2026-06-27,INV-20113,Carrots Case,GEN-CS-CAR,General,110,14.00,1540.00,US East,Wholesale
2026-06-28,INV-20114,Russet Potatoes 50lb,POT-50-RUS,Potatoes,140,18.50,2590.00,US West,Wholesale
2026-06-29,INV-20115,Sweet Onions 50lb,ONI-50-SWT,Onions,80,22.00,1760.00,US East,Wholesale
2026-06-30,INV-20116,Red Potatoes 50lb,POT-50-RED,Potatoes,90,22.00,1980.00,North America,Direct
2026-06-30,INV-20117,Oranges Case,FRT-CS-ORG,Fruits,100,26.00,2600.00,US West,Wholesale`;

interface SaleRow {
  date: string;
  invoiceNum: string;
  productName: string;
  productCode: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  territory: string;
  channel: string;
}

function parseSales(): SaleRow[] {
  return csvData.trim().split("\n").map(line => {
    const [date, invoiceNum, productName, productCode, category, qty, price, total, territory, channel] = line.split(",");
    return {
      date, invoiceNum, productName, productCode, category,
      quantity: parseInt(qty), unitPrice: parseFloat(price),
      totalAmount: parseFloat(total), territory, channel,
    };
  });
}

const RULES = [
  {
    id: "rule-cp-potatoes-pct",
    ruleName: "Potatoes Rebate - 3.5%",
    ruleType: "percentage",
    baseRate: "3.50",
    rate: 0.035,
    productCategories: "{Potatoes}",
    territories: "{General}",
    description: "3.5% rebate on all potato purchases",
    priority: 1,
  },
  {
    id: "rule-cp-onions-pct",
    ruleName: "Onions Rebate - 2.5%",
    ruleType: "percentage",
    baseRate: "2.50",
    rate: 0.025,
    productCategories: "{Onions}",
    territories: "{General}",
    description: "2.5% rebate on all onion purchases",
    priority: 2,
  },
  {
    id: "rule-cp-fruits-pct",
    ruleName: "Fruits Rebate - 4%",
    ruleType: "percentage",
    baseRate: "4.00",
    rate: 0.04,
    productCategories: "{Fruits}",
    territories: "{General}",
    description: "4% rebate on all fruit purchases",
    priority: 3,
  },
  {
    id: "rule-cp-general-pct",
    ruleName: "General Rebate - 1.5%",
    ruleType: "percentage",
    baseRate: "1.50",
    rate: 0.015,
    productCategories: "{General,!Potatoes,!Onions,!Fruits}",
    territories: "{General}",
    description: "1.5% rebate on all general purchases (excluding Potatoes, Onions, and Fruits)",
    priority: 10,
  },
];

function getRuleForCategory(category: string) {
  switch (category) {
    case "Potatoes": return RULES[0];
    case "Onions": return RULES[1];
    case "Fruits": return RULES[2];
    default: return RULES[3];
  }
}

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("Seeding Charlie's Produce full pipeline (4 percentage rules, 117 sales)...\n");

    await pool.query(`DELETE FROM sale_contract_matches WHERE sale_id IN (SELECT id FROM sales_data WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM settlement_line_items WHERE settlement_id IN (SELECT id FROM settlements WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM settlements WHERE company_id = $1`, [COMPANY_ID]);
    await pool.query(`DELETE FROM journal_entry_lines WHERE je_id IN (SELECT je_id FROM journal_entries WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM journal_entries WHERE company_id = $1`, [COMPANY_ID]);
    await pool.query(`DELETE FROM accrual_audit_trail WHERE accrual_id IN (SELECT id FROM accruals WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM accrual_calculation_trace WHERE accrual_id IN (SELECT id FROM accruals WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM accruals WHERE company_id = $1`, [COMPANY_ID]);
    await pool.query(`DELETE FROM period_close_checklist WHERE period_id IN (SELECT id FROM period_close WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM period_close_blockers WHERE period_id IN (SELECT id FROM period_close WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM period_close_audit_trail WHERE period_id IN (SELECT id FROM period_close WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM period_close WHERE company_id = $1`, [COMPANY_ID]);
    await pool.query(`DELETE FROM calculation_rule_results WHERE calculation_id IN (SELECT id FROM contract_calculations WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM calculation_line_items WHERE company_id = $1`, [COMPANY_ID]);
    await pool.query(`DELETE FROM contract_calculations WHERE company_id = $1`, [COMPANY_ID]);
    await pool.query(`DELETE FROM contract_qualifiers WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM contract_rules WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = $1)`, [COMPANY_ID]);
    await pool.query(`DELETE FROM sales_data WHERE company_id = $1`, [COMPANY_ID]);
    await pool.query(`DELETE FROM uploaded_datasets WHERE company_id = $1`, [COMPANY_ID]);
    await pool.query(`DELETE FROM audit_trail WHERE user_id = $1`, [ADMIN_ID]);
    await pool.query(`DELETE FROM contracts WHERE company_id = $1`, [COMPANY_ID]);
    console.log("Cleaned all existing Charlie's Produce data");

    await pool.query(`
      INSERT INTO contracts (
        id, contract_number, file_name, original_name, file_size, file_type, file_path,
        contract_type, priority, status, uploaded_by,
        display_name, effective_start, effective_end,
        organization_name, counterparty_name,
        currency, approval_state,
        company_id, notes
      ) VALUES (
        $1, 'CNT-2026-CP01', 'charlies_produce_rebate.pdf', 'charlies_produce_rebate.pdf',
        52000, 'application/pdf', '/uploads/charlies_produce_rebate.pdf',
        'ib_rebate', 'normal', 'analyzed', $2,
        'CNT-2026-CP01 Charlie''s Produce Rebate Agreement',
        '2026-01-01', '2026-12-31',
        'Charlie''s Produce Inc.', 'Charlie''s Produce Inc.',
        'USD', 'approved',
        $3, 'H1 2026 rebate agreement — Potatoes 3.5%, Onions 2.5%, Fruits 4%, General 1.5%'
      )
    `, [CONTRACT_ID, ADMIN_ID, COMPANY_ID]);
    console.log("Contract created: CNT-2026-CP01 Charlie's Produce Rebate Agreement");

    for (const r of RULES) {
      await pool.query(`
        INSERT INTO contract_rules (id, contract_id, rule_name, rule_type, base_rate, product_categories, description, priority, review_status, is_active, confidence, territories)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'verified', true, 95, $9)
      `, [r.id, CONTRACT_ID, r.ruleName, r.ruleType, r.baseRate, r.productCategories, r.description, r.priority, r.territories]);
    }
    console.log("4 contract rules created (Potatoes 3.5%, Onions 2.5%, Fruits 4%, General 1.5%)");

    const sales = parseSales();
    const catTotals: Record<string, { count: number; salesTotal: number; qtyTotal: number }> = {};

    for (const s of sales) {
      await pool.query(`
        INSERT INTO sales_data (
          matched_contract_id, match_confidence, transaction_date, transaction_id,
          product_code, product_name, category, territory, currency,
          gross_amount, net_amount, quantity, unit_price, channel,
          company_id, customer_code
        ) VALUES ($1, 95, $2, $3, $4, $5, $6, $7, 'USD', $8, $9, $10, $11, $12, $13, 'CUST-CP01')
      `, [
        CONTRACT_ID, s.date, s.invoiceNum,
        s.productCode, s.productName, s.category, s.territory,
        s.totalAmount.toFixed(2), (s.totalAmount * 0.95).toFixed(2),
        s.quantity, s.unitPrice.toFixed(2), s.channel, COMPANY_ID,
      ]);

      if (!catTotals[s.category]) catTotals[s.category] = { count: 0, salesTotal: 0, qtyTotal: 0 };
      catTotals[s.category].count++;
      catTotals[s.category].salesTotal += s.totalAmount;
      catTotals[s.category].qtyTotal += s.quantity;
    }

    console.log(`${sales.length} sales transactions inserted:`);
    for (const [cat, data] of Object.entries(catTotals)) {
      console.log(`  ${cat}: ${data.count} transactions, $${data.salesTotal.toFixed(2)}, ${data.qtyTotal} units`);
    }

    await pool.query(`
      INSERT INTO uploaded_datasets (name, source, records, status, type, valid_rows, error_rows, total_rows, matched_contracts, matched_records, unmatched_records, avg_confidence, company_wide, company_id, contract_id, uploaded_by)
      VALUES ('Charlie''s Produce H1 2026 Sales', 'CSV Upload', $1, 'matched', 'sales', $1, 0, $1, 1, $1, 0, '95.0', false, $2, $3, $4)
    `, [sales.length, COMPANY_ID, CONTRACT_ID, ADMIN_ID]);
    console.log("Uploaded dataset record created");

    const saleIdsResult = await pool.query(
      `SELECT id, category FROM sales_data WHERE company_id = $1 AND matched_contract_id = $2`,
      [COMPANY_ID, CONTRACT_ID]
    );
    for (const row of saleIdsResult.rows) {
      const rule = getRuleForCategory(row.category || "General");
      await pool.query(
        `INSERT INTO sale_contract_matches (sale_id, contract_id, rule_id, match_type, specificity_score, match_reason, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.id, CONTRACT_ID, rule.id, 'category', 1000, `product/category match: ${row.category || 'General'}`, true]
      );
    }
    console.log(`${saleIdsResult.rows.length} sale_contract_matches junction records created`);

    const potatoSales = catTotals["Potatoes"]?.salesTotal || 0;
    const potatoCount = catTotals["Potatoes"]?.count || 0;
    const potatoFee = potatoSales * 0.035;

    const onionSales = catTotals["Onions"]?.salesTotal || 0;
    const onionCount = catTotals["Onions"]?.count || 0;
    const onionFee = onionSales * 0.025;

    const fruitSales = catTotals["Fruits"]?.salesTotal || 0;
    const fruitCount = catTotals["Fruits"]?.count || 0;
    const fruitFee = fruitSales * 0.04;

    const generalSales = catTotals["General"]?.salesTotal || 0;
    const generalCount = catTotals["General"]?.count || 0;
    const generalFee = generalSales * 0.015;

    const totalFee = potatoFee + onionFee + fruitFee + generalFee;
    const totalSales = potatoSales + onionSales + fruitSales + generalSales;
    const totalCount = sales.length;

    console.log(`\nFee calculation:`);
    console.log(`  Potatoes: $${potatoSales.toFixed(2)} x 3.5% = $${potatoFee.toFixed(2)} (${potatoCount} txns)`);
    console.log(`  Onions:   $${onionSales.toFixed(2)} x 2.5% = $${onionFee.toFixed(2)} (${onionCount} txns)`);
    console.log(`  Fruits:   $${fruitSales.toFixed(2)} x 4.0% = $${fruitFee.toFixed(2)} (${fruitCount} txns)`);
    console.log(`  General:  $${generalSales.toFixed(2)} x 1.5% = $${generalFee.toFixed(2)} (${generalCount} txns)`);
    console.log(`  TOTAL:    $${totalSales.toFixed(2)} sales -> $${totalFee.toFixed(2)} fee`);

    const calcId = "calc-cp-h1-2026";
    const ruleBreakdown = [
      { ruleId: RULES[0].id, name: RULES[0].ruleName, sales: potatoSales, fee: potatoFee, cnt: potatoCount, rateLabel: "3.5%" },
      { ruleId: RULES[1].id, name: RULES[1].ruleName, sales: onionSales, fee: onionFee, cnt: onionCount, rateLabel: "2.5%" },
      { ruleId: RULES[2].id, name: RULES[2].ruleName, sales: fruitSales, fee: fruitFee, cnt: fruitCount, rateLabel: "4.0%" },
      { ruleId: RULES[3].id, name: RULES[3].ruleName, sales: generalSales, fee: generalFee, cnt: generalCount, rateLabel: "1.5%" },
    ];

    await pool.query(`
      INSERT INTO contract_calculations (id, contract_id, name, period_start, period_end, status, total_sales_amount, total_royalty, currency, sales_count, breakdown, chart_data, calculated_by, company_id)
      VALUES ($1, $2, 'H1 2026 Rebate Calculation', '2026-01-01', '2026-06-30', 'approved', $3, $4, 'USD', $5, $6, $7, $8, $9)
    `, [
      calcId, CONTRACT_ID,
      totalSales.toFixed(2), totalFee.toFixed(2), totalCount,
      JSON.stringify(ruleBreakdown.map(r => ({ ruleName: r.name, salesAmount: r.sales, fee: r.fee, transactionCount: r.cnt }))),
      JSON.stringify({ rulesApplied: RULES.map(r => r.ruleName), totalFee, totalSales }),
      ADMIN_ID, COMPANY_ID,
    ]);
    console.log("Contract calculation record created (H1 2026)");

    for (const r of ruleBreakdown) {
      const matchingRule = RULES.find(rule => rule.id === r.ruleId)!;
      await pool.query(`
        INSERT INTO calculation_rule_results (id, calculation_id, rule_id, rule_name, rule_type, rule_snapshot, total_fee, total_sales_amount, transaction_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        `crr-${r.ruleId}`, calcId, r.ruleId, r.name, "percentage",
        JSON.stringify({ baseRate: matchingRule.baseRate, productCategories: matchingRule.productCategories }),
        r.fee.toFixed(2), r.sales.toFixed(2), r.cnt,
      ]);
    }
    console.log("4 calculation rule results created");

    for (const s of sales) {
      const rule = getRuleForCategory(s.category);
      const fee = s.totalAmount * rule.rate;
      await pool.query(`
        INSERT INTO calculation_line_items (
          calculation_id, contract_id, rule_id, transaction_date, transaction_id,
          sales_amount, quantity, unit_price, calculated_fee, applied_rate,
          rule_name, rule_type, dimensions, item_name, item_code, territory, period, company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '{}', $13, $14, $15, 'H1 2026', $16)
      `, [
        calcId, CONTRACT_ID, rule.id, s.date, s.invoiceNum,
        s.totalAmount.toFixed(2), s.quantity, s.unitPrice.toFixed(2), fee.toFixed(4), rule.rate.toFixed(4),
        rule.ruleName, "percentage", s.productName, s.productCode, s.territory, COMPANY_ID,
      ]);
    }
    console.log(`${sales.length} calculation line items created`);

    const accrualDefs = [
      { id: "acc-cp-pot-h126", accrualId: "ACC-CP-POT-H126", amount: potatoFee, tier: "Standard", rate: "3.5%", netSales: potatoSales, label: "Potatoes" },
      { id: "acc-cp-oni-h126", accrualId: "ACC-CP-ONI-H126", amount: onionFee, tier: "Standard", rate: "2.5%", netSales: onionSales, label: "Onions" },
      { id: "acc-cp-frt-h126", accrualId: "ACC-CP-FRT-H126", amount: fruitFee, tier: "Standard", rate: "4.0%", netSales: fruitSales, label: "Fruits" },
      { id: "acc-cp-gen-h126", accrualId: "ACC-CP-GEN-H126", amount: generalFee, tier: "Standard", rate: "1.5%", netSales: generalSales, label: "General" },
      { id: "acc-cp-tot-h126", accrualId: "ACC-CP-TOT-H126", amount: totalFee, tier: "Blended", rate: "Blended", netSales: totalSales, label: "Total" },
    ];

    for (const a of accrualDefs) {
      await pool.query(`
        INSERT INTO accruals (id, accrual_id, contract_id, contract_name, counterparty, flow_type, period, amount, status, ai_confidence, tier, rate, net_sales, company_id, created_by)
        VALUES ($1, $2, $3, 'CNT-2026-CP01 Charlie''s Produce Rebate', 'Charlie''s Produce Inc.', 'Inbound Rebate', 'H1 2026', $4, 'posted', 95, $5, $6, $7, $8, $9)
      `, [a.id, a.accrualId, CONTRACT_ID, a.amount.toFixed(2), a.tier, a.rate, a.netSales.toFixed(2), COMPANY_ID, ADMIN_ID]);
    }
    console.log("5 accruals created (Potatoes, Onions, Fruits, General, Total)");

    const jeId = "JE-CP-H126-001";
    await pool.query(`
      INSERT INTO journal_entries (id, je_id, source_accrual_id, contract_id, contract_name, counterparty, flow_type, period, total_amount, je_stage, erp_sync_status, balanced, company_id, created_by)
      VALUES ($1, $2, 'ACC-CP-TOT-H126', $3, 'CNT-2026-CP01 Charlie''s Produce Rebate Agreement', 'Charlie''s Produce Inc.', 'Inbound Rebate', 'H1 2026', $4, 'pending', 'na', true, $5, $6)
    `, ["je-cp-h126-001", jeId, CONTRACT_ID, totalFee.toFixed(2), COMPANY_ID, ADMIN_ID]);

    await pool.query(`
      INSERT INTO journal_entry_lines (je_id, account_code, account_name, debit_amount, credit_amount, description)
      VALUES ($1, '5100', 'Rebate Receivable', $2, '0', 'H1 2026 rebate receivable from vendor')
    `, [jeId, totalFee.toFixed(2)]);
    await pool.query(`
      INSERT INTO journal_entry_lines (je_id, account_code, account_name, debit_amount, credit_amount, description)
      VALUES ($1, '4200', 'Rebate Income', '0', $2, 'H1 2026 inbound rebate income recognized')
    `, [jeId, totalFee.toFixed(2)]);
    console.log(`Journal entry ${jeId} created with 2 balanced lines ($${totalFee.toFixed(2)})`);

    const periodCloseId = "pc-cp-h126";
    await pool.query(`
      INSERT INTO period_close (id, period_label, status, readiness_score, company_id)
      VALUES ($1, 'H1 2026', 'open', 75, $2)
    `, [periodCloseId, COMPANY_ID]);

    const checklistItems = [
      { name: "Sales Data Uploaded", status: "done", progress: `${totalCount} transactions loaded` },
      { name: "Sales Matched to Contract", status: "done", progress: `${totalCount}/${totalCount} matched` },
      { name: "Contract Rules Verified", status: "done", progress: "4/4 rules verified" },
      { name: "Fee Calculation Completed", status: "done", progress: `$${totalFee.toFixed(2)} calculated` },
      { name: "Accruals Created", status: "done", progress: "5 accruals posted" },
      { name: "Journal Entries Created", status: "done", progress: "1 JE balanced" },
      { name: "JE Approved & Synced", status: "in_progress", progress: "Pending approval" },
      { name: "Settlement Reconciliation", status: "idle", progress: "Not started" },
    ];
    for (const item of checklistItems) {
      await pool.query(`
        INSERT INTO period_close_checklist (period_id, item_name, status, progress_text, completed_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [periodCloseId, item.name, item.status, item.progress, item.status === "done" ? new Date() : null]);
    }
    console.log("Period close H1 2026 created (75% readiness, 8 checklist items)");

    await pool.query(`
      INSERT INTO period_close_blockers (period_id, severity, title, description, ai_suggestion, resolved)
      VALUES ($1, 'medium', 'JE Pending Approval', 'Journal entry JE-CP-H126-001 needs manager approval before period can close', 'Route JE to finance manager for approval. Once approved and synced, this blocker auto-resolves.', false)
    `, [periodCloseId]);

    const auditEvents = [
      { eventType: "sales_uploaded", description: `${totalCount} sales transactions uploaded for H1 2026`, iconColor: "blue" },
      { eventType: "rules_verified", description: "All 4 contract rules verified by admin", iconColor: "green" },
      { eventType: "calculation_completed", description: `Fee calculation completed: $${totalFee.toFixed(2)} across 4 rules`, iconColor: "orange" },
      { eventType: "accruals_posted", description: "5 accruals created and posted", iconColor: "green" },
      { eventType: "je_created", description: `Journal entry ${jeId} created ($${totalFee.toFixed(2)})`, iconColor: "purple" },
    ];
    for (const evt of auditEvents) {
      await pool.query(`
        INSERT INTO period_close_audit_trail (period_id, event_type, description, user_name, user_role, icon_color)
        VALUES ($1, $2, $3, 'admin', 'System Admin', $4)
      `, [periodCloseId, evt.eventType, evt.description, evt.iconColor]);
    }
    console.log("Period close audit trail seeded (5 events)");

    const settlementDefs = [
      {
        id: "stl-cp-matched",
        claimId: "CLM-CP-001", claimRef: "VND-INV-2026-0847",
        period: "H1 2026",
        accrualAmount: totalFee, claimAmount: totalFee, variance: 0,
        matchStatus: "matched", matchPct: 100, settlementStatus: "pending",
        disputeReason: null, aiAnalysis: null, resolution: null, postedAmount: null,
        jeId: jeId,
        lineItems: [
          { category: "Potatoes", lineName: "Potatoes Rebate 3.5%", accrual: potatoFee, claim: potatoFee, variance: 0, status: "matched", sort: 1 },
          { category: "Onions", lineName: "Onions Rebate 2.5%", accrual: onionFee, claim: onionFee, variance: 0, status: "matched", sort: 2 },
          { category: "Fruits", lineName: "Fruits Rebate 4%", accrual: fruitFee, claim: fruitFee, variance: 0, status: "matched", sort: 3 },
          { category: "General", lineName: "General Rebate 1.5%", accrual: generalFee, claim: generalFee, variance: 0, status: "matched", sort: 4 },
        ],
      },
      {
        id: "stl-cp-disputed",
        claimId: "CLM-CP-002", claimRef: "VND-INV-2026-0901",
        period: "H1 2026",
        accrualAmount: potatoFee, claimAmount: potatoFee * 1.12, variance: potatoFee * 0.12,
        matchStatus: "disputed", matchPct: 89, settlementStatus: "in_review",
        disputeReason: "Vendor claims higher potato volume (includes 4350-20 box at different rate). Difference of 12% on potato line items.",
        aiAnalysis: "Variance driven by vendor applying 3.5% to 4350-20 boxes which may have exclusion terms. Recommend reviewing contract clause for box items.",
        resolution: null, postedAmount: null, jeId: null,
        lineItems: [
          { category: "Potatoes", lineName: "Potatoes Rebate Disputed", accrual: potatoFee, claim: potatoFee * 1.12, variance: potatoFee * 0.12, status: "disputed", sort: 1 },
        ],
      },
      {
        id: "stl-cp-posted",
        claimId: "CLM-CP-003", claimRef: "VND-INV-2026-0650",
        period: "Q1 2026",
        accrualAmount: totalFee * 0.45, claimAmount: totalFee * 0.45, variance: 0,
        matchStatus: "matched", matchPct: 100, settlementStatus: "posted",
        disputeReason: null, aiAnalysis: null,
        resolution: "auto_approved", postedAmount: totalFee * 0.45, jeId: jeId,
        lineItems: [
          { category: "Potatoes", lineName: "Q1 Potatoes Rebate", accrual: potatoFee * 0.45, claim: potatoFee * 0.45, variance: 0, status: "posted", sort: 1 },
          { category: "Onions", lineName: "Q1 Onions Rebate", accrual: onionFee * 0.45, claim: onionFee * 0.45, variance: 0, status: "posted", sort: 2 },
          { category: "Fruits", lineName: "Q1 Fruits Rebate", accrual: fruitFee * 0.45, claim: fruitFee * 0.45, variance: 0, status: "posted", sort: 3 },
          { category: "General", lineName: "Q1 General Rebate", accrual: generalFee * 0.45, claim: generalFee * 0.45, variance: 0, status: "posted", sort: 4 },
        ],
      },
    ];

    for (const s of settlementDefs) {
      await pool.query(`
        INSERT INTO settlements (id, counterparty, contract_id, contract_name, claim_id, claim_ref, settlement_type, flow_type, period, accrual_amount, claim_amount, variance, match_status, match_pct, settlement_status, dispute_reason, ai_analysis, resolution, posted_amount, je_id, company_id, created_by)
        VALUES ($1, 'Charlie''s Produce Inc.', $2, 'CNT-2026-CP01 Charlie''s Produce Rebate Agreement', $3, $4, 'customer_rebates', 'Inbound Rebate', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [
        s.id, CONTRACT_ID, s.claimId, s.claimRef,
        s.period, s.accrualAmount.toFixed(2), s.claimAmount.toFixed(2), s.variance.toFixed(2),
        s.matchStatus, s.matchPct, s.settlementStatus,
        s.disputeReason, s.aiAnalysis, s.resolution,
        s.postedAmount?.toFixed(2) || null, s.jeId, COMPANY_ID, ADMIN_ID,
      ]);

      for (const li of s.lineItems) {
        await pool.query(`
          INSERT INTO settlement_line_items (settlement_id, category, line_name, accrual_amount, claim_amount, variance, status, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [s.id, li.category, li.lineName, li.accrual.toFixed(2), li.claim.toFixed(2), li.variance.toFixed(2), li.status, li.sort]);
      }
    }
    console.log("3 settlements created (matched/pending, disputed/in_review, posted)");

    const auditTrailEntries = [
      { action: "upload", resourceType: "contract", resourceId: CONTRACT_ID, details: { description: "Contract uploaded: Charlie's Produce Rebate Agreement" } },
      { action: "analyze", resourceType: "contract", resourceId: CONTRACT_ID, details: { description: "Contract analyzed with 4 rules extracted" } },
      { action: "calculate", resourceType: "calculation", resourceId: calcId, details: { description: `Fee calculation completed: $${totalFee.toFixed(2)}`, totalFee, totalSales, rulesApplied: 4 } },
      { action: "create", resourceType: "accrual", resourceId: "acc-cp-tot-h126", details: { description: "5 accruals created from calculation" } },
      { action: "create", resourceType: "journal_entry", resourceId: "je-cp-h126-001", details: { description: `Journal entry ${jeId} created ($${totalFee.toFixed(2)})` } },
    ];

    for (const entry of auditTrailEntries) {
      await pool.query(`
        INSERT INTO audit_trail (user_id, action, resource_type, resource_id, details)
        VALUES ($1, $2, $3, $4, $5)
      `, [ADMIN_ID, entry.action, entry.resourceType, entry.resourceId, JSON.stringify(entry.details)]);
    }
    console.log("5 audit trail entries created");

    console.log("\n=== Charlie's Produce Full Pipeline Seeded ===");
    console.log(`   Company:     Charlie's Produce Inc. (${COMPANY_ID})`);
    console.log(`   Contract:    CNT-2026-CP01 (${CONTRACT_ID})`);
    console.log(`   Rules:       4 (Potatoes 3.5%, Onions 2.5%, Fruits 4%, General 1.5%)`);
    console.log(`   Sales:       ${totalCount} transactions ($${totalSales.toFixed(2)})`);
    console.log(`   Calculation: $${totalFee.toFixed(2)} total fee`);
    console.log(`     Potatoes: $${potatoFee.toFixed(2)} (3.5% of $${potatoSales.toFixed(2)})`);
    console.log(`     Onions:   $${onionFee.toFixed(2)} (2.5% of $${onionSales.toFixed(2)})`);
    console.log(`     Fruits:   $${fruitFee.toFixed(2)} (4.0% of $${fruitSales.toFixed(2)})`);
    console.log(`     General:  $${generalFee.toFixed(2)} (1.5% of $${generalSales.toFixed(2)})`);
    console.log(`   Line Items:  ${totalCount} calculation line items`);
    console.log(`   Accruals:    5 (Potatoes, Onions, Fruits, General, Total)`);
    console.log(`   Journal:     ${jeId} (balanced, $${totalFee.toFixed(2)})`);
    console.log(`   Period Close: H1 2026 (75%, 8 checklist items)`);
    console.log(`   Settlements: 3 (matched, disputed, posted)`);

  } catch (err) {
    console.error("Seed failed:", err);
    throw err;
  } finally {
    await pool.end();
  }
}

seed();
