import { pool } from './db';
import XLSX from 'xlsx';
import path from 'path';

function excelDateToISO(serial: number | string | boolean | undefined): string | null {
  if (serial === undefined || serial === null || serial === '' || serial === false) return null;
  if (typeof serial === 'boolean') return null;
  const num = typeof serial === 'string' ? parseFloat(serial) : serial;
  if (isNaN(num) || num < 1000) return null;
  const utcDays = Math.floor(num - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

function toBool(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
  if (typeof val === 'number') return val === 1;
  return false;
}

function toNum(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function toStr(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;
  return String(val).trim();
}

function parseSheetWithHeaders(wb: XLSX.WorkBook, sheetName: string): any[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rawData = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
  if (rawData.length === 0) return [];

  const columns = Object.keys(rawData[0]);
  const hasEmptyKeys = columns.some(c => c.startsWith('__EMPTY'));

  if (hasEmptyKeys && rawData.length > 1) {
    const headerRow = rawData.find((r: any) => {
      const vals = Object.values(r);
      return vals.some(v => typeof v === 'string' && (v.includes('_id') || v === 'status' || v === 'notes' || v === 'description'));
    });
    if (headerRow) {
      const headerIdx = rawData.indexOf(headerRow);
      const realHeaders = Object.values(headerRow).map(v => String(v).trim()).filter(h => h && !h.startsWith('__EMPTY'));
      const dataRows = rawData.slice(headerIdx + 1).filter((r: any) => {
        const firstVal = Object.values(r)[0];
        return firstVal && String(firstVal).trim() !== '';
      });

      return dataRows.map((row: any) => {
        const obj: any = {};
        const vals = Object.values(row);
        realHeaders.forEach((header, i) => {
          if (header) obj[header] = vals[i] !== undefined ? vals[i] : '';
        });
        return obj;
      });
    }
  }

  return rawData;
}

export async function importExcelData() {
  console.log('📊 Starting Excel data import...');
  const filePath = path.resolve('attached_assets/LicenseIQ_Data_Models_1770412803281.xlsx');
  const wb = XLSX.readFile(filePath);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. COMPANY MASTER
    console.log('  Creating company_master table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_master (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        company_id VARCHAR(50) UNIQUE NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        legal_entity_name VARCHAR(255),
        industry VARCHAR(100),
        headquarters_city VARCHAR(100),
        headquarters_state VARCHAR(50),
        headquarters_country VARCHAR(100),
        annual_revenue_millions NUMERIC,
        employee_count INTEGER,
        erp_system VARCHAR(100),
        erp_version VARCHAR(50),
        fiscal_year_end DATE,
        primary_currency VARCHAR(10),
        tax_id VARCHAR(50),
        website VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 2. PARTNER MASTER
    console.log('  Creating partner_master table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS partner_master (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        partner_id VARCHAR(50) UNIQUE NOT NULL,
        company_id VARCHAR(50),
        business_unit VARCHAR(100),
        partner_name VARCHAR(255) NOT NULL,
        partner_type VARCHAR(100),
        partner_classification VARCHAR(50),
        legal_entity_name VARCHAR(255),
        headquarters_city VARCHAR(100),
        headquarters_state VARCHAR(50),
        headquarters_country VARCHAR(100),
        primary_contact_name VARCHAR(200),
        primary_contact_email VARCHAR(200),
        status VARCHAR(50) DEFAULT 'Active',
        onboarding_date DATE,
        payment_terms VARCHAR(50),
        payment_method VARCHAR(50),
        currency VARCHAR(10),
        tax_id VARCHAR(50),
        credit_limit NUMERIC,
        primary_sales_channel VARCHAR(50),
        authorized_channels TEXT,
        primary_territory VARCHAR(50),
        authorized_territories TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 3. TERRITORY MASTER
    console.log('  Creating territory_master table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS territory_master (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        territory_id VARCHAR(50) UNIQUE NOT NULL,
        territory_code VARCHAR(50),
        territory_name VARCHAR(200) NOT NULL,
        territory_type VARCHAR(50),
        parent_territory_id VARCHAR(50),
        region_level INTEGER,
        currency_code VARCHAR(10),
        tax_jurisdiction VARCHAR(200),
        regulatory_requirements VARCHAR(500),
        language VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 4. SALES CHANNELS
    console.log('  Creating sales_channels table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_channels (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id VARCHAR(50) UNIQUE NOT NULL,
        channel_code VARCHAR(50),
        channel_name VARCHAR(200) NOT NULL,
        channel_type VARCHAR(50),
        channel_category VARCHAR(50),
        typical_margin_pct_low NUMERIC,
        typical_margin_pct_high NUMERIC,
        requires_certification BOOLEAN DEFAULT false,
        payment_terms_default VARCHAR(50),
        min_order_value_usd NUMERIC,
        max_credit_limit_usd VARCHAR(100),
        volume_discount_eligible BOOLEAN DEFAULT false,
        coop_advertising_eligible BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'Active',
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 5. PARTNER CONTRACT ASSOCIATIONS
    console.log('  Creating partner_contract_associations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS partner_contract_associations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        association_id VARCHAR(50) UNIQUE NOT NULL,
        partner_id VARCHAR(50),
        contract_id VARCHAR(100),
        effective_date DATE,
        expiration_date DATE,
        contract_status VARCHAR(50),
        is_primary_contract BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 6. PRODUCT HIERARCHY
    console.log('  Creating product_hierarchy table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_hierarchy (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        hierarchy_id VARCHAR(50) UNIQUE NOT NULL,
        company_id VARCHAR(50),
        level_name VARCHAR(100),
        level_order INTEGER,
        parent_hierarchy_id VARCHAR(50),
        hierarchy_value VARCHAR(200),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 7. PRODUCT CLASSIFICATIONS
    console.log('  Creating product_classifications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_classifications (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        classification_dimension VARCHAR(100) NOT NULL,
        classification_value VARCHAR(200),
        description TEXT,
        use_case TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        UNIQUE(classification_dimension, classification_value)
      )
    `);

    // 8. PRODUCTS
    console.log('  Creating products table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        product_id VARCHAR(50) UNIQUE NOT NULL,
        company_id VARCHAR(50),
        sku VARCHAR(100),
        product_name VARCHAR(300) NOT NULL,
        product_category VARCHAR(100),
        product_family VARCHAR(100),
        product_line VARCHAR(100),
        product_classification VARCHAR(100),
        asset_type VARCHAR(50),
        durability_class VARCHAR(100),
        revenue_type VARCHAR(100),
        tax_category VARCHAR(50),
        regulatory_class VARCHAR(100),
        list_price NUMERIC,
        standard_cost NUMERIC,
        base_unit_of_measure VARCHAR(50),
        alternate_uom_sellable VARCHAR(100),
        case_pack_quantity INTEGER,
        inner_pack_quantity INTEGER,
        product_status VARCHAR(50) DEFAULT 'Active',
        eligible_for_rebates BOOLEAN DEFAULT false,
        eligible_for_royalties BOOLEAN DEFAULT false,
        has_bom BOOLEAN DEFAULT false,
        is_component_only BOOLEAN DEFAULT false,
        manufacturing_lead_time_days INTEGER,
        launch_date DATE,
        barcode_upc VARCHAR(50),
        weight_kg NUMERIC,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 9. PRODUCT ATTRIBUTES
    console.log('  Creating product_attributes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_attributes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        attribute_id VARCHAR(50) UNIQUE NOT NULL,
        product_id VARCHAR(50),
        attribute_name VARCHAR(200) NOT NULL,
        attribute_value VARCHAR(500),
        attribute_category VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 10. PRODUCT TERRITORY MATRIX
    console.log('  Creating product_territory_matrix table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_territory_matrix (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        territory_auth_id VARCHAR(50) UNIQUE NOT NULL,
        product_id VARCHAR(50),
        territory_id VARCHAR(50),
        is_authorized BOOLEAN DEFAULT false,
        restriction_reason TEXT,
        requires_certification BOOLEAN DEFAULT false,
        certification_type VARCHAR(100),
        certification_status VARCHAR(50),
        effective_date DATE,
        expiration_date DATE,
        import_duty_pct NUMERIC,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 11. PRODUCT CHANNEL MATRIX
    console.log('  Creating product_channel_matrix table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_channel_matrix (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_auth_id VARCHAR(50) UNIQUE NOT NULL,
        product_id VARCHAR(50),
        channel_id VARCHAR(50),
        is_authorized BOOLEAN DEFAULT false,
        restriction_reason TEXT,
        channel_specific_sku VARCHAR(100),
        channel_specific_pricing BOOLEAN DEFAULT false,
        min_order_quantity INTEGER,
        max_order_quantity INTEGER,
        effective_date DATE,
        expiration_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 12. PRODUCT PACKAGING MATRIX
    console.log('  Creating product_packaging_matrix table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_packaging_matrix (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        package_id VARCHAR(50) UNIQUE NOT NULL,
        product_id VARCHAR(50),
        package_type VARCHAR(50),
        package_code VARCHAR(20),
        units_per_package INTEGER,
        is_base_unit BOOLEAN DEFAULT false,
        is_sellable BOOLEAN DEFAULT true,
        list_price_package NUMERIC,
        standard_cost_package NUMERIC,
        barcode_package VARCHAR(50),
        weight_kg_package NUMERIC,
        dimensions_cm VARCHAR(50),
        effective_date DATE,
        expiration_date DATE,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    // 13. PRODUCT BOM
    console.log('  Creating product_bom table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_bom (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        bom_id VARCHAR(50) UNIQUE NOT NULL,
        parent_product_id VARCHAR(50),
        component_product_id VARCHAR(50),
        component_quantity NUMERIC,
        component_uom VARCHAR(50),
        bom_type VARCHAR(100),
        sequence_number INTEGER,
        is_optional BOOLEAN DEFAULT false,
        substitute_product_id VARCHAR(50),
        scrap_factor_percent NUMERIC,
        effective_date DATE,
        expiration_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        record_status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      )
    `);

    await client.query('COMMIT');
    console.log('  ✅ All 13 tables created');

    // Now import data
    await client.query('BEGIN');

    // Companies (only rows with valid company_name)
    const companiesData = parseSheetWithHeaders(wb, 'Companies');
    const validCompanies = companiesData.filter(r => r.company_id && r.company_name && String(r.company_id).startsWith('COMP-'));
    console.log(`  Importing ${validCompanies.length} companies...`);
    for (const row of validCompanies) {
      await client.query(`
        INSERT INTO company_master (company_id, company_name, legal_entity_name, industry, headquarters_city, headquarters_state, headquarters_country, annual_revenue_millions, employee_count, erp_system, erp_version, fiscal_year_end, primary_currency, tax_id, website, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (company_id) DO NOTHING
      `, [
        toStr(row.company_id), toStr(row.company_name), toStr(row.legal_entity_name), toStr(row.industry),
        toStr(row.headquarters_city), toStr(row.headquarters_state), toStr(row.headquarters_country),
        toNum(row.annual_revenue_millions), toNum(row.employee_count), toStr(row.erp_system),
        toStr(row.erp_version), excelDateToISO(row.fiscal_year_end), toStr(row.primary_currency),
        toStr(row.tax_id), toStr(row.website), toStr(row.status) || 'Active'
      ]);
    }

    // Partner Master
    const partnerData = parseSheetWithHeaders(wb, 'Partner Master');
    console.log(`  Importing ${partnerData.length} partners...`);
    for (const row of partnerData) {
      if (!row.partner_id) continue;
      await client.query(`
        INSERT INTO partner_master (partner_id, company_id, business_unit, partner_name, partner_type, partner_classification, legal_entity_name, headquarters_city, headquarters_state, headquarters_country, primary_contact_name, primary_contact_email, status, onboarding_date, payment_terms, payment_method, currency, tax_id, credit_limit, primary_sales_channel, authorized_channels, primary_territory, authorized_territories)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        ON CONFLICT (partner_id) DO NOTHING
      `, [
        toStr(row.partner_id), toStr(row.company_id), toStr(row['business unit'] || row.business_unit),
        toStr(row.partner_name), toStr(row.partner_type), toStr(row.partner_classification),
        toStr(row.legal_entity_name), toStr(row.headquarters_city), toStr(row.headquarters_state),
        toStr(row.headquarters_country), toStr(row.primary_contact_name), toStr(row.primary_contact_email),
        toStr(row.status) || 'Active', excelDateToISO(row.onboarding_date), toStr(row.payment_terms),
        toStr(row.payment_method), toStr(row.currency), toStr(row.tax_id), toNum(row.credit_limit),
        toStr(row.primary_sales_channel), toStr(row.authorized_channels), toStr(row.primary_territory),
        toStr(row.authorized_territories)
      ]);
    }

    // Territory Master
    const territoryData = parseSheetWithHeaders(wb, 'Territory Master');
    console.log(`  Importing ${territoryData.length} territories...`);
    for (const row of territoryData) {
      if (!row.territory_id) continue;
      await client.query(`
        INSERT INTO territory_master (territory_id, territory_code, territory_name, territory_type, parent_territory_id, region_level, currency_code, tax_jurisdiction, regulatory_requirements, language, status, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (territory_id) DO NOTHING
      `, [
        toStr(row.territory_id), toStr(row.territory_code), toStr(row.territory_name), toStr(row.territory_type),
        toStr(row.parent_territory_id), toNum(row.region_level), toStr(row.currency_code),
        toStr(row.tax_jurisdiction), toStr(row.regulatory_requirements), toStr(row.language),
        toStr(row.status) || 'Active', toStr(row.notes)
      ]);
    }

    // Sales Channels
    const channelData = parseSheetWithHeaders(wb, 'Sales Channel');
    console.log(`  Importing ${channelData.length} sales channels...`);
    for (const row of channelData) {
      if (!row.channel_id) continue;
      await client.query(`
        INSERT INTO sales_channels (channel_id, channel_code, channel_name, channel_type, channel_category, typical_margin_pct_low, typical_margin_pct_high, requires_certification, payment_terms_default, min_order_value_usd, max_credit_limit_usd, volume_discount_eligible, coop_advertising_eligible, status, description)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (channel_id) DO NOTHING
      `, [
        toStr(row.channel_id), toStr(row.channel_code), toStr(row.channel_name), toStr(row.channel_type),
        toStr(row.channel_category), toNum(row.typical_margin_pct_low), toNum(row.typical_margin_pct_high),
        toBool(row.requires_certification), toStr(row.payment_terms_default), toNum(row.min_order_value_usd),
        toStr(row.max_credit_limit_usd), toBool(row.volume_discount_eligible), toBool(row.coop_advertising_eligible),
        toStr(row.status) || 'Active', toStr(row.description)
      ]);
    }

    // Partner-Contract Associations
    const assocData = parseSheetWithHeaders(wb, 'Partner-Contract Association');
    console.log(`  Importing ${assocData.length} partner-contract associations...`);
    for (const row of assocData) {
      if (!row.association_id) continue;
      await client.query(`
        INSERT INTO partner_contract_associations (association_id, partner_id, contract_id, effective_date, expiration_date, contract_status, is_primary_contract, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (association_id) DO NOTHING
      `, [
        toStr(row.association_id), toStr(row.partner_id), toStr(row.contract_id),
        excelDateToISO(row.effective_date), excelDateToISO(row.expiration_date),
        toStr(row.contract_status), toBool(row.is_primary_contract), toStr(row.notes)
      ]);
    }

    // Product Hierarchy
    const hierarchyData = parseSheetWithHeaders(wb, 'Product Hierarchy');
    console.log(`  Importing ${hierarchyData.length} product hierarchy entries...`);
    for (const row of hierarchyData) {
      if (!row.hierarchy_id) continue;
      await client.query(`
        INSERT INTO product_hierarchy (hierarchy_id, company_id, level_name, level_order, parent_hierarchy_id, hierarchy_value, description)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (hierarchy_id) DO NOTHING
      `, [
        toStr(row.hierarchy_id), toStr(row.company_id), toStr(row.level_name), toNum(row.level_order),
        toStr(row.parent_hierarchy_id), toStr(row.hierarchy_value), toStr(row.description)
      ]);
    }

    // Product Classifications (manually parse - title row + header row + data)
    const classRaw = XLSX.utils.sheet_to_json(wb.Sheets['Product Classification'], { defval: '', raw: true }) as any[];
    const classRows: any[] = [];
    const classKey = 'PRODUCT CLASSIFICATION TAXONOMY Table - 7 different classifications';
    for (let i = 1; i < classRaw.length; i++) {
      const r = classRaw[i];
      const dim = toStr(r[classKey]);
      if (!dim || dim === 'classification_dimension' || dim.includes('Column') || dim.length > 100) continue;
      classRows.push({
        classification_dimension: dim,
        classification_value: toStr(r['__EMPTY']),
        description: toStr(r['__EMPTY_1']),
        use_case: toStr(r['__EMPTY_2']),
      });
    }
    console.log(`  Importing ${classRows.length} product classifications...`);
    for (const row of classRows) {
      const dim = row.classification_dimension;
      const val = row.classification_value;
      const desc = row.description;
      const uc = row.use_case;
      if (!dim) continue;
      await client.query(`
        INSERT INTO product_classifications (classification_dimension, classification_value, description, use_case)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (classification_dimension, classification_value) DO NOTHING
      `, [dim, val, desc, uc]);
    }

    // Products (filter rows without valid product_id/product_name)
    const productsData = parseSheetWithHeaders(wb, 'Products');
    const validProducts = productsData.filter(r => r.product_id && r.product_name && String(r.product_id).match(/^[A-Z]{2,}-P-/));
    console.log(`  Importing ${validProducts.length} products...`);
    for (const row of validProducts) {
      await client.query(`
        INSERT INTO products (product_id, company_id, sku, product_name, product_category, product_family, product_line, product_classification, asset_type, durability_class, revenue_type, tax_category, regulatory_class, list_price, standard_cost, base_unit_of_measure, alternate_uom_sellable, case_pack_quantity, inner_pack_quantity, product_status, eligible_for_rebates, eligible_for_royalties, has_bom, is_component_only, manufacturing_lead_time_days, launch_date, barcode_upc, weight_kg)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
        ON CONFLICT (product_id) DO NOTHING
      `, [
        toStr(row.product_id), toStr(row.company_id), toStr(row.sku), toStr(row.product_name),
        toStr(row.product_category), toStr(row.product_family), toStr(row.product_line),
        toStr(row.product_classification), toStr(row.asset_type), toStr(row.durability_class),
        toStr(row.revenue_type), toStr(row.tax_category), toStr(row.regulatory_class),
        toNum(row.list_price), toNum(row.standard_cost), toStr(row.base_unit_of_measure),
        toStr(row.alternate_uom_sellable), toNum(row.case_pack_quantity), toNum(row.inner_pack_quantity),
        toStr(row.product_status) || 'Active', toBool(row.eligible_for_rebates), toBool(row.eligible_for_royalties),
        toBool(row.has_bom), toBool(row.is_component_only), toNum(row.manufacturing_lead_time_days),
        excelDateToISO(row.launch_date), toStr(row.barcode_upc), toNum(row.weight_kg)
      ]);
    }

    // Product Attributes
    const attrData = parseSheetWithHeaders(wb, 'Product Attributes');
    console.log(`  Importing ${attrData.length} product attributes...`);
    for (const row of attrData) {
      if (!row.attribute_id) continue;
      await client.query(`
        INSERT INTO product_attributes (attribute_id, product_id, attribute_name, attribute_value, attribute_category, description)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (attribute_id) DO NOTHING
      `, [
        toStr(row.attribute_id), toStr(row.product_id), toStr(row.attribute_name),
        toStr(row.attribute_value), toStr(row.attribute_category), toStr(row.description)
      ]);
    }

    // Product-Territory Matrix
    const ptmData = parseSheetWithHeaders(wb, 'Product-Territory Matrix');
    console.log(`  Importing ${ptmData.length} product-territory entries...`);
    for (const row of ptmData) {
      if (!row.territory_auth_id) continue;
      await client.query(`
        INSERT INTO product_territory_matrix (territory_auth_id, product_id, territory_id, is_authorized, restriction_reason, requires_certification, certification_type, certification_status, effective_date, expiration_date, import_duty_pct, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (territory_auth_id) DO NOTHING
      `, [
        toStr(row.territory_auth_id), toStr(row.product_id), toStr(row.territory_id),
        toBool(row.is_authorized), toStr(row.restriction_reason), toBool(row.requires_certification),
        toStr(row.certification_type), toStr(row.certification_status),
        excelDateToISO(row.effective_date), excelDateToISO(row.expiration_date),
        toNum(row.import_duty_pct), toStr(row.notes)
      ]);
    }

    // Product-Channel Matrix (skip row 0 which has PCA-xxx placeholders)
    const pcmRaw = XLSX.utils.sheet_to_json(wb.Sheets['Product-Channel Matrix '], { defval: '', raw: true }) as any[];
    const pcmData = pcmRaw.filter(r => {
      const pid = toStr(r.product_id);
      return pid && !pid.startsWith('PCA-');
    });
    console.log(`  Importing ${pcmData.length} product-channel entries...`);
    for (const row of pcmData) {
      const authId = toStr(row.channel_auth_id);
      if (!authId) continue;
      await client.query(`
        INSERT INTO product_channel_matrix (channel_auth_id, product_id, channel_id, is_authorized, restriction_reason, channel_specific_sku, channel_specific_pricing, min_order_quantity, max_order_quantity, effective_date, expiration_date, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (channel_auth_id) DO NOTHING
      `, [
        authId, toStr(row.product_id), toStr(row.channel_id),
        toBool(row.is_authorized), toStr(row.restriction_reason), toStr(row.channel_specific_sku),
        toBool(row.channel_specific_pricing), toNum(row.min_order_quantity), toNum(row.max_order_quantity),
        excelDateToISO(row.effective_date), excelDateToISO(row.expiration_date), toStr(row.notes)
      ]);
    }

    // Product Packaging Matrix
    const pkgData = parseSheetWithHeaders(wb, 'Product Packaging Matrix');
    console.log(`  Importing ${pkgData.length} product packaging entries...`);
    for (const row of pkgData) {
      if (!row.package_id) continue;
      await client.query(`
        INSERT INTO product_packaging_matrix (package_id, product_id, package_type, package_code, units_per_package, is_base_unit, is_sellable, list_price_package, standard_cost_package, barcode_package, weight_kg_package, dimensions_cm, effective_date, expiration_date, description)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (package_id) DO NOTHING
      `, [
        toStr(row.package_id), toStr(row.product_id), toStr(row.package_type), toStr(row.package_code),
        toNum(row.units_per_package), toBool(row.is_base_unit), toBool(row.is_sellable),
        toNum(row.list_price_package), toNum(row.standard_cost_package), toStr(row.barcode_package),
        toNum(row.weight_kg_package), toStr(row.dimensions_cm),
        excelDateToISO(row.effective_date), excelDateToISO(row.expiration_date), toStr(row.description)
      ]);
    }

    // Product BOM
    const bomData = parseSheetWithHeaders(wb, 'Product BOM');
    console.log(`  Importing ${bomData.length} BOM entries...`);
    for (const row of bomData) {
      if (!row.bom_id) continue;
      await client.query(`
        INSERT INTO product_bom (bom_id, parent_product_id, component_product_id, component_quantity, component_uom, bom_type, sequence_number, is_optional, substitute_product_id, scrap_factor_percent, effective_date, expiration_date, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (bom_id) DO NOTHING
      `, [
        toStr(row.bom_id), toStr(row.parent_product_id), toStr(row.component_product_id),
        toNum(row.component_quantity), toStr(row.component_uom), toStr(row.bom_type),
        toNum(row.sequence_number), toBool(row.is_optional), toStr(row.substitute_product_id),
        toNum(row.scrap_factor_percent), excelDateToISO(row.effective_date), excelDateToISO(row.expiration_date),
        toStr(row.notes)
      ]);
    }

    await client.query('COMMIT');
    console.log('  ✅ All data imported');

    // Register entities and fields in LicenseIQ Schema Catalog
    await registerEntitiesAndFields(client);

    console.log('📊 ✅ Excel data import complete!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Excel import error:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function registerEntitiesAndFields(client: any) {
  console.log('  Registering entities in LicenseIQ Schema Catalog...');

  const entityDefs = [
    { name: 'Company Master', technicalName: 'company_master', category: 'Master Data', description: 'Company master data with legal entity details, ERP info, and financials' },
    { name: 'Partner Master', technicalName: 'partner_master', category: 'Master Data', description: 'Partner/distributor master data with contact info, payment terms, and authorized territories' },
    { name: 'Territory Master', technicalName: 'territory_master', category: 'Master Data', description: 'Hierarchical territory definitions for global sales coverage' },
    { name: 'Sales Channels', technicalName: 'sales_channels', category: 'Master Data', description: 'Sales channel definitions with margin ranges and certification requirements' },
    { name: 'Partner-Contract Associations', technicalName: 'partner_contract_associations', category: 'Transactional', description: 'Links between partners and their associated contracts' },
    { name: 'Product Hierarchy', technicalName: 'product_hierarchy', category: 'Master Data', description: '3-level product hierarchy: Category → Family → Line' },
    { name: 'Product Classifications', technicalName: 'product_classifications', category: 'Master Data', description: '7-dimension product classification taxonomy' },
    { name: 'Products', technicalName: 'products', category: 'Master Data', description: 'Product master with pricing, classification, eligibility, and packaging details' },
    { name: 'Product Attributes', technicalName: 'product_attributes', category: 'Master Data', description: 'Additional item-specific details and characteristics' },
    { name: 'Product-Territory Matrix', technicalName: 'product_territory_matrix', category: 'Master Data', description: 'Product authorization by territory with certification tracking' },
    { name: 'Product-Channel Matrix', technicalName: 'product_channel_matrix', category: 'Master Data', description: 'Product authorization by sales channel with pricing and order constraints' },
    { name: 'Product Packaging Matrix', technicalName: 'product_packaging_matrix', category: 'Master Data', description: 'Product packaging levels (Each, Inner Case, Master Case, Pallet) with pricing' },
    { name: 'Product BOM', technicalName: 'product_bom', category: 'Master Data', description: 'Bill of Materials - component relationships between products' },
  ];

  for (const entity of entityDefs) {
    const existing = await client.query(
      `SELECT id FROM licenseiq_entities WHERE technical_name = $1`,
      [entity.technicalName]
    );
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO licenseiq_entities (id, name, technical_name, category, description) VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
        [entity.name, entity.technicalName, entity.category, entity.description]
      );
      console.log(`    ✓ Registered entity: ${entity.name}`);
    } else {
      console.log(`    ○ Entity already exists: ${entity.name}`);
    }

    const entityRow = await client.query(
      `SELECT id FROM licenseiq_entities WHERE technical_name = $1`,
      [entity.technicalName]
    );
    const entityId = entityRow.rows[0]?.id;
    if (!entityId) continue;

    const columns = await client.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position`,
      [entity.technicalName]
    );

    const skipCols = new Set(['id', 'created_at', 'updated_at']);
    for (const col of columns.rows) {
      if (skipCols.has(col.column_name)) continue;
      const existingField = await client.query(
        `SELECT id FROM licenseiq_fields WHERE entity_id = $1 AND field_name = $2`,
        [entityId, col.column_name]
      );
      if (existingField.rows.length === 0) {
        let dataType = 'string';
        if (col.data_type.includes('int') || col.data_type === 'numeric') dataType = 'number';
        if (col.data_type === 'boolean') dataType = 'boolean';
        if (col.data_type === 'date' || col.data_type.includes('timestamp')) dataType = 'date';

        await client.query(
          `INSERT INTO licenseiq_fields (id, entity_id, field_name, data_type, is_required, description) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)`,
          [entityId, col.column_name, dataType, col.is_nullable === 'NO', col.column_name.replace(/_/g, ' ')]
        );
      }
    }
  }
  console.log('  ✅ All entities and fields registered');
}

const isMainModule = process.argv[1]?.includes('import-excel-data');
if (isMainModule) {
  importExcelData().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
