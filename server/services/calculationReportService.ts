import { db } from '../db';
import { sql } from 'drizzle-orm';
import { 
  calculationLineItems, 
  calculationDimensionConfig,
  pendingTermMappings,
  blueprintDimensions,
  calculationBlueprints,
  contractRules,
  contractCalculations
} from '@shared/schema';

export interface DimensionConfig {
  dimensionKey: string;
  displayName: string;
  dimensionType: string;
  erpFieldName?: string;
  isGroupable: boolean;
  sortOrder: number;
}

export interface AggregatedResult {
  dimensionValue: string;
  totalSalesAmount: number;
  totalQuantity: number;
  totalFee: number;
  transactionCount: number;
  avgRate?: number;
}

export interface CalculationReportData {
  calculationId: string;
  contractId: string;
  calculationName: string;
  periodStart?: Date;
  periodEnd?: Date;
  totalSalesAmount: number;
  totalFee: number;
  transactionCount: number;
  availableDimensions: DimensionConfig[];
  lineItems?: any[];
  aggregatedData?: Record<string, AggregatedResult[]>;
}

export class CalculationReportService {
  
  async getAvailableDimensions(contractId: string): Promise<DimensionConfig[]> {
    const configs = await db.execute(sql`
      SELECT 
        dimension_key, 
        display_name, 
        dimension_type, 
        erp_field_name, 
        is_groupable, 
        sort_order
      FROM calculation_dimension_config
      WHERE contract_id = ${contractId}
      ORDER BY sort_order ASC
    `);
    
    if (configs.rows.length > 0) {
      return configs.rows.map((row: any) => ({
        dimensionKey: row.dimension_key,
        displayName: row.display_name,
        dimensionType: row.dimension_type,
        erpFieldName: row.erp_field_name,
        isGroupable: row.is_groupable,
        sortOrder: row.sort_order || 0
      }));
    }
    
    return await this.generateDimensionConfigFromMappings(contractId);
  }
  
  async generateDimensionConfigFromMappings(contractId: string): Promise<DimensionConfig[]> {
    // First check for ERP mappings to determine correct labels
    const mappings = await db.execute(sql`
      SELECT DISTINCT 
        ptm.erp_field_name,
        ptm.erp_entity_name
      FROM pending_term_mappings ptm
      WHERE ptm.contract_id = ${contractId}
        AND ptm.status = 'confirmed'
        AND ptm.erp_field_name IS NOT NULL
    `);
    
    // Check if we have a SupplierName mapping (use "By Supplier" instead of "By Vendor")
    const hasSupplierMapping = (mappings.rows as any[]).some(
      (r: any) => r.erp_field_name?.toLowerCase() === 'suppliername' || r.erp_entity_name?.toLowerCase() === 'suppliers'
    );
    
    // Start with standard dimensions that are always available
    const dimensions: DimensionConfig[] = [
      { dimensionKey: 'summary', displayName: 'Summary', dimensionType: 'summary', isGroupable: false, sortOrder: 0 },
      { dimensionKey: 'detail', displayName: 'Detail', dimensionType: 'detail', isGroupable: false, sortOrder: 1 },
    ];
    
    let sortOrder = 2;
    
    // Add standard aggregation dimensions - adjust vendor label based on ERP mapping
    const standardDimensions = [
      { key: 'item_name', display: 'By Product', type: 'product' },
      { key: 'vendor_name', display: hasSupplierMapping ? 'By Supplier' : 'By Vendor', type: 'vendor', erpField: hasSupplierMapping ? 'SupplierName' : undefined },
      { key: 'item_class', display: 'By Category', type: 'category' },
      { key: 'territory', display: 'By Territory', type: 'territory' },
      { key: 'period', display: 'By Period', type: 'period' },
      { key: 'rule_name', display: 'By Rule', type: 'rule' },
    ];
    
    for (const std of standardDimensions) {
      dimensions.push({
        dimensionKey: std.key,
        displayName: std.display,
        dimensionType: std.type,
        erpFieldName: (std as any).erpField,
        isGroupable: true,
        sortOrder: sortOrder++
      });
    }
    
    const seenFields = new Set(standardDimensions.map(d => d.key.toLowerCase()));
    // Also add SupplierName to seen fields to avoid duplicate tabs
    if (hasSupplierMapping) {
      seenFields.add('suppliername');
      seenFields.add('supplier_name');
    }
    
    // Persist dimension config for this contract
    for (const dim of dimensions) {
      await db.execute(sql`
        INSERT INTO calculation_dimension_config 
          (contract_id, dimension_key, display_name, dimension_type, is_groupable, sort_order)
        VALUES 
          (${contractId}, ${dim.dimensionKey}, ${dim.displayName}, ${dim.dimensionType}, ${dim.isGroupable}, ${dim.sortOrder})
        ON CONFLICT (contract_id, dimension_key) DO NOTHING
      `);
    }
    
    return dimensions;
  }
  
  async getCalculationReport(calculationId: string, dimensionKey?: string): Promise<CalculationReportData> {
    const calcResult = await db.execute(sql`
      SELECT 
        crc.id,
        crc.contract_id,
        crc.name,
        crc.period_start,
        crc.period_end,
        crc.total_sales_amount,
        crc.total_royalty,
        crc.sales_count,
        crc.breakdown
      FROM contract_calculations crc
      WHERE crc.id = ${calculationId}
    `);
    
    if (calcResult.rows.length === 0) {
      throw new Error(`Calculation not found: ${calculationId}`);
    }
    
    const calc = calcResult.rows[0] as any;
    const contractId = calc.contract_id;
    
    // Lazy population: Check if line items exist, if not populate from breakdown
    const existingLineItems = await db.execute(sql`
      SELECT COUNT(*) as count FROM calculation_line_items 
      WHERE calculation_id = ${calculationId}
    `);
    
    const lineItemCount = parseInt((existingLineItems.rows[0] as any).count) || 0;
    
    let hasZeroRateIssue = false;
    if (lineItemCount > 0) {
      const zeroRateCheck = await db.execute(sql`
        SELECT COUNT(*) as count FROM calculation_line_items 
        WHERE calculation_id = ${calculationId} 
        AND (applied_rate IS NULL OR CAST(applied_rate AS DECIMAL) = 0)
        AND rule_name IS NOT NULL AND rule_name != 'No matching rule'
      `);
      hasZeroRateIssue = parseInt((zeroRateCheck.rows[0] as any).count) > 0;
      if (hasZeroRateIssue) {
        await db.execute(sql`DELETE FROM calculation_line_items WHERE calculation_id = ${calculationId}`);
      }
    }

    if ((lineItemCount === 0 || hasZeroRateIssue) && calc.breakdown) {
      // Parse breakdown and populate line items
      // Handle double-encoding: JSONB may contain a JSON string that needs parsing
      let breakdown = calc.breakdown;
      
      // If it's a string, parse it (handles double-encoding)
      if (typeof breakdown === 'string') {
        try {
          breakdown = JSON.parse(breakdown);
        } catch (e) {
          console.error('Failed to parse breakdown string:', e);
          breakdown = [];
        }
      }
      
      // If the parsed result is still a string (double-encoded), parse again
      if (typeof breakdown === 'string') {
        try {
          breakdown = JSON.parse(breakdown);
        } catch (e) {
          console.error('Failed to parse double-encoded breakdown:', e);
          breakdown = [];
        }
      }
      
      if (Array.isArray(breakdown) && breakdown.length > 0) {
        await this.populateLineItemsFromCalculation(calculationId, contractId, breakdown);
      }
    }
    
    const availableDimensions = await this.getAvailableDimensions(contractId);
    
    const reportData: CalculationReportData = {
      calculationId,
      contractId,
      calculationName: calc.name,
      periodStart: calc.period_start,
      periodEnd: calc.period_end,
      totalSalesAmount: parseFloat(calc.total_sales_amount) || 0,
      totalFee: parseFloat(calc.total_royalty) || 0,
      transactionCount: calc.sales_count || 0,
      availableDimensions
    };
    
    if (dimensionKey === 'detail' || !dimensionKey) {
      reportData.lineItems = await this.getDetailedLineItems(calculationId);
    }
    
    if (dimensionKey && dimensionKey !== 'detail' && dimensionKey !== 'summary') {
      reportData.aggregatedData = {
        [dimensionKey]: await this.getAggregatedByDimension(calculationId, dimensionKey)
      };
    }
    
    return reportData;
  }
  
  async getDetailedLineItems(calculationId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        cli.id,
        cli.transaction_date,
        cli.transaction_id,
        cli.sales_amount,
        cli.quantity,
        cli.unit_price,
        cli.calculated_fee,
        cli.applied_rate,
        cli.rule_name,
        cli.rule_type,
        cli.tier_applied,
        cli.dimensions,
        cli.vendor_name,
        cli.vendor_code,
        cli.item_name,
        cli.item_code,
        cli.item_class,
        cli.territory,
        cli.period,
        cli.transaction_count
      FROM calculation_line_items cli
      WHERE cli.calculation_id = ${calculationId}
      ORDER BY cli.transaction_date DESC, cli.item_name ASC
    `);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      transactionDate: row.transaction_date,
      transactionId: row.transaction_id,
      salesAmount: parseFloat(row.sales_amount) || 0,
      quantity: parseFloat(row.quantity) || 0,
      unitPrice: parseFloat(row.unit_price) || 0,
      calculatedFee: parseFloat(row.calculated_fee) || 0,
      appliedRate: parseFloat(row.applied_rate) || 0,
      ruleName: row.rule_name,
      ruleType: row.rule_type,
      tierApplied: row.tier_applied,
      dimensions: row.dimensions || {},
      vendorName: row.vendor_name,
      vendorCode: row.vendor_code,
      itemName: row.item_name,
      itemCode: row.item_code,
      itemClass: row.item_class,
      territory: row.territory,
      period: row.period,
      transactionCount: parseInt(row.transaction_count) || 1,
    }));
  }
  
  async getAggregatedByDimension(calculationId: string, dimensionKey: string): Promise<AggregatedResult[]> {
    // Validate dimension key to prevent SQL injection
    const validColumns = ['vendor_name', 'item_name', 'item_class', 'territory', 'period', 'rule_name'];
    const columnMapping: Record<string, string> = {
      'vendor_name': 'vendor_name',
      'vendor': 'vendor_name',
      'item_name': 'item_name',
      'item': 'item_name',
      'product': 'item_name',
      'item_class': 'item_class',
      'category': 'item_class',
      'territory': 'territory',
      'period': 'period',
      'rule_name': 'rule_name'
    };
    
    const mappedColumn = columnMapping[dimensionKey];
    
    if (mappedColumn && validColumns.includes(mappedColumn)) {
      // Use parameterized queries for known columns
      let result;
      switch (mappedColumn) {
        case 'vendor_name':
          result = await db.execute(sql`
            SELECT 
              COALESCE(vendor_name, dimensions->>'vendor_name', dimensions->>'vendor', 'Unknown') as dimension_value,
              COALESCE(SUM(CAST(sales_amount AS DECIMAL)), 0) as total_sales,
              COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_quantity,
              COALESCE(SUM(CAST(calculated_fee AS DECIMAL)), 0) as total_fee,
              COUNT(*) as transaction_count,
              AVG(CAST(applied_rate AS DECIMAL)) as avg_rate
            FROM calculation_line_items
            WHERE calculation_id = ${calculationId}
            GROUP BY COALESCE(vendor_name, dimensions->>'vendor_name', dimensions->>'vendor', 'Unknown')
            ORDER BY total_fee DESC
          `);
          break;
        case 'item_name':
          result = await db.execute(sql`
            SELECT 
              COALESCE(item_name, 'Unknown') as dimension_value,
              COALESCE(SUM(CAST(sales_amount AS DECIMAL)), 0) as total_sales,
              COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_quantity,
              COALESCE(SUM(CAST(calculated_fee AS DECIMAL)), 0) as total_fee,
              COUNT(*) as transaction_count,
              AVG(CAST(applied_rate AS DECIMAL)) as avg_rate
            FROM calculation_line_items
            WHERE calculation_id = ${calculationId}
            GROUP BY item_name
            ORDER BY total_fee DESC
          `);
          break;
        case 'item_class':
          result = await db.execute(sql`
            SELECT 
              COALESCE(item_class, 'Unknown') as dimension_value,
              COALESCE(SUM(CAST(sales_amount AS DECIMAL)), 0) as total_sales,
              COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_quantity,
              COALESCE(SUM(CAST(calculated_fee AS DECIMAL)), 0) as total_fee,
              COUNT(*) as transaction_count,
              AVG(CAST(applied_rate AS DECIMAL)) as avg_rate
            FROM calculation_line_items
            WHERE calculation_id = ${calculationId}
            GROUP BY item_class
            ORDER BY total_fee DESC
          `);
          break;
        case 'territory':
          result = await db.execute(sql`
            SELECT 
              COALESCE(territory, 'Unknown') as dimension_value,
              COALESCE(SUM(CAST(sales_amount AS DECIMAL)), 0) as total_sales,
              COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_quantity,
              COALESCE(SUM(CAST(calculated_fee AS DECIMAL)), 0) as total_fee,
              COUNT(*) as transaction_count,
              AVG(CAST(applied_rate AS DECIMAL)) as avg_rate
            FROM calculation_line_items
            WHERE calculation_id = ${calculationId}
            GROUP BY territory
            ORDER BY total_fee DESC
          `);
          break;
        case 'period':
          result = await db.execute(sql`
            SELECT 
              COALESCE(period, 'Unknown') as dimension_value,
              COALESCE(SUM(CAST(sales_amount AS DECIMAL)), 0) as total_sales,
              COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_quantity,
              COALESCE(SUM(CAST(calculated_fee AS DECIMAL)), 0) as total_fee,
              COUNT(*) as transaction_count,
              AVG(CAST(applied_rate AS DECIMAL)) as avg_rate
            FROM calculation_line_items
            WHERE calculation_id = ${calculationId}
            GROUP BY period
            ORDER BY total_fee DESC
          `);
          break;
        case 'rule_name':
          result = await db.execute(sql`
            SELECT 
              COALESCE(rule_name, 'Unknown') as dimension_value,
              COALESCE(SUM(CAST(sales_amount AS DECIMAL)), 0) as total_sales,
              COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_quantity,
              COALESCE(SUM(CAST(calculated_fee AS DECIMAL)), 0) as total_fee,
              COUNT(*) as transaction_count,
              AVG(CAST(applied_rate AS DECIMAL)) as avg_rate
            FROM calculation_line_items
            WHERE calculation_id = ${calculationId}
            GROUP BY rule_name
            ORDER BY total_fee DESC
          `);
          break;
        default:
          result = { rows: [] };
      }
      
      return result.rows.map((row: any) => ({
        dimensionValue: row.dimension_value || 'Unknown',
        totalSalesAmount: parseFloat(row.total_sales) || 0,
        totalQuantity: parseFloat(row.total_quantity) || 0,
        totalFee: parseFloat(row.total_fee) || 0,
        transactionCount: parseInt(row.transaction_count) || 0,
        avgRate: parseFloat(row.avg_rate) || 0
      }));
    }
    
    // For custom dimensions stored in JSONB, use safe parameterized extraction
    // Validate dimension key format to prevent injection (only allow alphanumeric and underscore)
    if (!/^[a-zA-Z0-9_]+$/.test(dimensionKey)) {
      console.warn(`Invalid dimension key format: ${dimensionKey}`);
      return [];
    }
    
    // Use jsonb_extract_path_text with the key as a parameter for safe extraction
    const result = await db.execute(sql`
      SELECT 
        COALESCE(jsonb_extract_path_text(dimensions, ${dimensionKey}), 'Unknown') as dimension_value,
        COALESCE(SUM(CAST(sales_amount AS DECIMAL)), 0) as total_sales,
        COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_quantity,
        COALESCE(SUM(CAST(calculated_fee AS DECIMAL)), 0) as total_fee,
        COUNT(*) as transaction_count,
        AVG(CAST(applied_rate AS DECIMAL)) as avg_rate
      FROM calculation_line_items
      WHERE calculation_id = ${calculationId}
      GROUP BY jsonb_extract_path_text(dimensions, ${dimensionKey})
      ORDER BY total_fee DESC
    `);
    
    return result.rows.map((row: any) => ({
      dimensionValue: row.dimension_value || 'Unknown',
      totalSalesAmount: parseFloat(row.total_sales) || 0,
      totalQuantity: parseFloat(row.total_quantity) || 0,
      totalFee: parseFloat(row.total_fee) || 0,
      transactionCount: parseInt(row.transaction_count) || 0,
      avgRate: parseFloat(row.avg_rate) || 0
    }));
  }
  
  async populateLineItemsFromCalculation(
    calculationId: string, 
    contractId: string,
    breakdown: any[]
  ): Promise<void> {
    const mappingsResult = await db.execute(sql`
      SELECT original_term, erp_field_name
      FROM pending_term_mappings
      WHERE contract_id = ${contractId}
        AND status = 'confirmed'
        AND erp_field_name IS NOT NULL
    `);
    
    const termToErpField = new Map<string, string>();
    for (const row of mappingsResult.rows as any[]) {
      if (row.original_term && row.erp_field_name) {
        termToErpField.set(row.original_term.toLowerCase(), row.erp_field_name);
      }
    }

    const productCategoryLookup = new Map<string, string>();
    const skuCategoryLookup = new Map<string, string>();
    try {
      const prodResult = await db.execute(sql`
        SELECT DISTINCT product_name, sku, product_category 
        FROM products WHERE product_category IS NOT NULL
      `);
      for (const row of prodResult.rows as any[]) {
        if (row.product_name && row.product_category) {
          productCategoryLookup.set(row.product_name, row.product_category);
        }
        if (row.sku && row.product_category) {
          skuCategoryLookup.set(row.sku, row.product_category);
        }
      }
    } catch (e) {
      console.error('Failed to build product category lookup:', e);
    }

    const saleIds = breakdown.map(item => item.saleId).filter(Boolean);
    const salesLookup = new Map<string, any>();
    if (saleIds.length > 0) {
      try {
        const salesResult = await db.execute(sql`
          SELECT id, product_name, product_code, category, territory, 
                 transaction_date, transaction_id, gross_amount, net_amount, 
                 quantity, unit_price, custom_fields
          FROM sales_data WHERE id IN ${sql.raw(`('${saleIds.join("','")}')`)}
        `);
        for (const row of salesResult.rows as any[]) {
          salesLookup.set(row.id, row);
        }
      } catch (e) {
        console.error('Failed to lookup sales data for line items:', e);
      }
    }

    const ruleRateLookup = new Map<string, { baseRate: number; ruleType: string; ruleName: string }>();
    try {
      const ruleResult = await db.execute(sql`
        SELECT id, rule_name, base_rate, rule_type, formula_definition
        FROM contract_rules
        WHERE contract_id = ${contractId}
      `);
      for (const row of ruleResult.rows as any[]) {
        if (!row.id) continue;
        let br = parseFloat(row.base_rate);
        // If baseRate column is empty but formula has a literal rate, extract it
        if ((!isFinite(br) || br === 0) && row.formula_definition) {
          try {
            const fd = typeof row.formula_definition === 'string'
              ? JSON.parse(row.formula_definition)
              : row.formula_definition;
            const amt = fd?.calculation?.amount;
            if (typeof amt === 'number' && isFinite(amt) && amt !== 0) br = amt;
          } catch {}
        }
        ruleRateLookup.set(row.id, {
          baseRate: isFinite(br) ? br : 0,
          ruleType: (row.rule_type || '').toLowerCase(),
          ruleName: row.rule_name || '',
        });
      }
    } catch (e) {
      console.error('Failed to build rule baseRate lookup:', e);
    }

    let contractPartnerName = '';
    try {
      {
        const partnerResult = await db.execute(sql`
          SELECT partner_id, assignment_type FROM contract_partner_assignments 
          WHERE contract_id = ${contractId} AND status = 'active'
          ORDER BY assignment_type
        `);
        for (const p of partnerResult.rows as any[]) {
          if (!contractPartnerName && p.partner_id) {
            contractPartnerName = p.partner_id;
          }
        }
      }
    } catch (e) {
      console.error('Failed to lookup contract partner assignments:', e);
    }
    
    for (const item of breakdown) {
      const saleRecord = salesLookup.get(item.saleId);
      const customFields = saleRecord?.custom_fields || {};
      const itemName = item.productName || item.itemName || item.variety || item.product || saleRecord?.product_name || '';
      let vendorName = item.vendorName || item.vendor || item.supplier || item.licensee || '';
      if (!vendorName && customFields.vendor_name) vendorName = customFields.vendor_name;
      if (!vendorName && customFields.partner_name) vendorName = customFields.partner_name;
      if (!vendorName && customFields.customer_name) vendorName = customFields.customer_name;
      if (!vendorName) vendorName = contractPartnerName;
      const territory = item.territory || item.region || item.location || item.state || saleRecord?.territory || '';
      let itemClass = item.category || item.itemClass || item.productCategory || item.class || saleRecord?.category || '';
      
      if (!itemClass && itemName) {
        const productLookup = productCategoryLookup.get(itemName);
        if (productLookup) {
          itemClass = productLookup;
        }
      }
      if (!itemClass && (item.productCode || item.itemCode)) {
        const skuLookup = skuCategoryLookup.get(item.productCode || item.itemCode);
        if (skuLookup) {
          itemClass = skuLookup;
        }
      }
      
      // Build comprehensive dimensions JSONB
      const dimensions: Record<string, string> = {};
      
      // Standard dimension fields - store with normalized keys
      if (itemName) {
        dimensions['item_name'] = itemName;
        dimensions['product'] = itemName;
        // Check if this item has an ERP mapping
        const erpField = termToErpField.get(itemName.toLowerCase());
        if (erpField) {
          dimensions[erpField] = itemName;
        }
      }
      if (vendorName) {
        dimensions['vendor_name'] = vendorName;
        dimensions['vendor'] = vendorName;
        // Check if this vendor has an ERP mapping
        const erpField = termToErpField.get(vendorName.toLowerCase());
        if (erpField) {
          dimensions[erpField] = vendorName;
        }
      }
      if (territory) {
        dimensions['territory'] = territory;
        dimensions['region'] = territory;
        // Check if this territory has an ERP mapping
        const erpField = termToErpField.get(territory.toLowerCase());
        if (erpField) {
          dimensions[erpField] = territory;
        }
      }
      if (itemClass) {
        dimensions['item_class'] = itemClass;
        dimensions['category'] = itemClass;
      }
      
      // Also capture any additional fields from the breakdown item
      const additionalFields = [
        'customerId', 'customerName', 'channel', 'salesRep', 
        'brand', 'segment', 'division', 'warehouse', 'store'
      ];
      for (const field of additionalFields) {
        if (item[field]) {
          const val = String(item[field]);
          dimensions[field] = val;
          // Check if this value has an ERP mapping
          const erpField = termToErpField.get(val.toLowerCase());
          if (erpField) {
            dimensions[erpField] = val;
          }
        }
      }
      
      // Period handling
      let period = item.period || null;
      if (!period && item.transactionDate) {
        try {
          period = new Date(item.transactionDate).toISOString().slice(0, 7);
        } catch (e) {
          period = null;
        }
      }
      if (period) {
        dimensions['period'] = period;
      }
      
      const ruleName = item.ruleApplied || item.ruleName || item.rule || null;
      const ruleType = item.ruleType || item.calculationType || null;
      
      if (ruleName) {
        dimensions['rule_name'] = ruleName;
      }
      
      await db.execute(sql`
        INSERT INTO calculation_line_items (
          calculation_id, contract_id, sales_data_id, blueprint_id, rule_id,
          transaction_date, transaction_id, sales_amount, quantity, unit_price,
          calculated_fee, applied_rate, rule_name, rule_type, tier_applied,
          dimensions, vendor_name, vendor_code, item_name, item_code,
          item_class, territory, period, transaction_count
        ) VALUES (
          ${calculationId}, ${contractId}, ${item.saleId || item.salesDataId || null}, 
          ${item.blueprintId || null}, ${item.ruleId || null},
          ${item.transactionDate || null}, ${item.transactionId || null},
          ${item.salesAmount || item.saleAmount || item.netAmount || item.grossAmount || 0}, 
          ${item.quantity || 0},
          ${item.unitPrice || 0}, 
          ${item.calculatedFee || item.royalty || item.royaltyAmount || 0},
          ${(() => {
            const ruleIdRef = item.ruleId || null;
            let ruleInfo = ruleIdRef ? ruleRateLookup.get(ruleIdRef) : null;
            // Fallback: match by rule_name when ruleId not stamped on the breakdown
            if (!ruleInfo && (item.ruleApplied || item.ruleName)) {
              const targetName = String(item.ruleApplied || item.ruleName).toLowerCase();
              for (const info of ruleRateLookup.values()) {
                if ((info as any).ruleName && (info as any).ruleName.toLowerCase() === targetName) {
                  ruleInfo = info;
                  break;
                }
              }
            }
            // DB rule_type wins over breakdown's calculationType (which is often
            // mislabeled as "percentage" by the formula evaluator)
            const rType = (ruleInfo?.ruleType || item.ruleType || item.calculationType || ruleType || '').toLowerCase();
            const isUnitBased = rType === 'per_unit' || rType === 'per-unit' || rType === 'fixed_fee' || rType === 'fixed' || rType === 'flat_rate';
            const isPercentageType = ['percentage', 'rebate_percentage', 'rebate_tiered', 'milestone_tiered', 'minimum_guarantee', 'cap'].includes(rType);

            // Highest priority: an explicit appliedRate set by the engine
            if (item.appliedRate !== undefined && item.appliedRate !== null && parseFloat(item.appliedRate) !== 0) {
              return item.appliedRate;
            }
            // For unit-based rules, ALWAYS prefer the rule's authoritative baseRate
            // over computed fee/qty (which reflects unit conversion, not the rule's intrinsic rate).
            if (isUnitBased && ruleInfo && ruleInfo.baseRate !== 0) {
              return ruleInfo.baseRate;
            }
            const rawRate = parseFloat(item.tierRate || item.rate || item.baseRate || item.effectiveRate || 0);
            if (rawRate !== 0) {
              if (isPercentageType) {
                return rawRate / 100;
              }
              return rawRate;
            }
            // Last-resort: pull baseRate from the rule lookup regardless of type
            if (ruleInfo && ruleInfo.baseRate !== 0) {
              return isPercentageType ? ruleInfo.baseRate / 100 : ruleInfo.baseRate;
            }
            const fee = parseFloat(item.calculatedFee || item.royalty || item.royaltyAmount || item.calculatedRoyalty || 0);
            const salesAmt = parseFloat(item.salesAmount || item.saleAmount || item.netAmount || item.grossAmount || 0);
            const qty = parseFloat(item.quantity || 0);
            if (isUnitBased && fee !== 0 && qty !== 0) {
              return fee / qty;
            }
            if (fee !== 0 && salesAmt !== 0) {
              return fee / salesAmt;
            }
            if (fee !== 0 && qty !== 0) {
              return fee / qty;
            }
            return 0;
          })()}, 
          ${ruleName},
          ${ruleType},
          ${item.tierApplied || item.tier || null}, 
          ${JSON.stringify(dimensions)}::jsonb,
          ${vendorName || null}, 
          ${item.vendorCode || null},
          ${itemName}, 
          ${item.productCode || item.itemCode || null},
          ${itemClass || null}, 
          ${territory || null},
          ${period},
          ${item.transactionCount ?? 1}
        )
      `);
    }
  }
  
  async getSummaryReport(calculationId: string): Promise<any> {
    const calc = await db.execute(sql`
      SELECT 
        crc.*,
        c.display_name as contract_name,
        c.counterparty_name as counterparty
      FROM contract_calculations crc
      LEFT JOIN contracts c ON crc.contract_id = c.id
      WHERE crc.id = ${calculationId}
    `);
    
    if (calc.rows.length === 0) {
      throw new Error('Calculation not found');
    }
    
    const calculation = calc.rows[0] as any;
    
    const byRule = await db.execute(sql`
      SELECT 
        rule_name,
        rule_type,
        COUNT(*) as transaction_count,
        SUM(CAST(quantity AS DECIMAL)) as total_quantity,
        SUM(CAST(calculated_fee AS DECIMAL)) as total_fee
      FROM calculation_line_items
      WHERE calculation_id = ${calculationId}
      GROUP BY rule_name, rule_type
      ORDER BY total_fee DESC
    `);
    
    const byItemClass = await db.execute(sql`
      SELECT 
        COALESCE(item_class, 'Unclassified') as item_class,
        COUNT(*) as transaction_count,
        SUM(CAST(quantity AS DECIMAL)) as total_quantity,
        SUM(CAST(calculated_fee AS DECIMAL)) as total_fee
      FROM calculation_line_items
      WHERE calculation_id = ${calculationId}
      GROUP BY item_class
      ORDER BY total_fee DESC
    `);
    
    return {
      calculation: {
        id: calculation.id,
        name: calculation.name,
        contractName: calculation.contract_name,
        counterparty: calculation.counterparty,
        periodStart: calculation.period_start,
        periodEnd: calculation.period_end,
        totalSalesAmount: parseFloat(calculation.total_sales_amount) || 0,
        totalFee: parseFloat(calculation.total_royalty) || 0,
        salesCount: calculation.sales_count || 0,
        status: calculation.status
      },
      byRule: byRule.rows.map((r: any) => ({
        ruleName: r.rule_name,
        ruleType: r.rule_type,
        transactionCount: parseInt(r.transaction_count),
        totalQuantity: parseFloat(r.total_quantity) || 0,
        totalFee: parseFloat(r.total_fee) || 0
      })),
      byItemClass: byItemClass.rows.map((r: any) => ({
        itemClass: r.item_class,
        transactionCount: parseInt(r.transaction_count),
        totalQuantity: parseFloat(r.total_quantity) || 0,
        totalFee: parseFloat(r.total_fee) || 0
      }))
    };
  }
}

export const calculationReportService = new CalculationReportService();
