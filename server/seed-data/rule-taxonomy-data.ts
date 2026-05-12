/**
   * Canonical seed data for the rule taxonomy and reference lookups.
   * Owned by seed-rule-taxonomy.ts. Edit here, not in the seeder.
   *
   * NOTE: These rows correspond to global system data. company_id is null on
   * rule_field_whitelist entries (they are system defaults visible to all
   * companies). Admin edits made through the Reference Lookups UI are never
   * overwritten — the seeder only inserts when no row with the matching
   * natural key already exists.
   */

  export const SUBTYPES_SEED = [
    { code: "RA", name: "Rebate / Allowance", description: "Volume / growth / mix rebates and allowances.", category: "financial", default_aggregation_period: "quarterly", default_engine_handler: "universal", default_gl_account: "2410-rebates-payable", default_finance_hub_tab: "rebates", is_active: true, sort_order: 10 },
  { code: "CB", name: "Chargeback", description: "Customer / distributor chargebacks against accruals.", category: "financial", default_aggregation_period: "per_sale", default_engine_handler: "universal", default_gl_account: "2420-chargebacks-payable", default_finance_hub_tab: "chargebacks", is_active: true, sort_order: 20 },
  { code: "PP", name: "Price Protection", description: "Price-decline protection for inventory in trade.", category: "financial", default_aggregation_period: "per_sale", default_engine_handler: "universal", default_gl_account: "2430-price-protection", default_finance_hub_tab: "price-protection", is_active: true, sort_order: 30 },
  { code: "MDF", name: "Market Development Funds", description: "Co-op / MDF accruals tied to sell-through or marketing spend.", category: "financial", default_aggregation_period: "monthly", default_engine_handler: "universal", default_gl_account: "6210-mdf-expense", default_finance_hub_tab: "mdf", is_active: true, sort_order: 40 },
  { code: "ROY", name: "Royalty", description: "IP / brand royalty obligations on sales or units.", category: "financial", default_aggregation_period: "monthly", default_engine_handler: "universal", default_gl_account: "2440-royalties-payable", default_finance_hub_tab: "royalties", is_active: true, sort_order: 50 },
  { code: "RSS", name: "Revenue Share / SaaS", description: "Revenue share, SaaS rev-rec, and recurring revenue splits.", category: "financial", default_aggregation_period: "monthly", default_engine_handler: "universal", default_gl_account: "4110-revenue-share", default_finance_hub_tab: "rev-share", is_active: true, sort_order: 60 },
  { code: "PTR", name: "Pass-Through Recovery", description: "Pass-through fees, freight, and recoveries.", category: "financial", default_aggregation_period: "per_sale", default_engine_handler: "universal", default_gl_account: "5210-pass-through-recovery", default_finance_hub_tab: "pass-through", is_active: true, sort_order: 70 },
  { code: "SBE", name: "Service / Billing Event", description: "Service-billed events (per-ticket, per-call, per-visit).", category: "financial", default_aggregation_period: "per_sale", default_engine_handler: "universal", default_gl_account: "4210-service-billing", default_finance_hub_tab: "service-billing", is_active: true, sort_order: 80 },
  { code: "COM", name: "Commission", description: "Sales commission and SPIFF programs.", category: "financial", default_aggregation_period: "monthly", default_engine_handler: "universal", default_gl_account: "6310-sales-commissions", default_finance_hub_tab: "commissions", is_active: true, sort_order: 90 },
  { code: "MIN", name: "Minimum Guarantee", description: "Periodic minimum guarantees with shortfall true-ups.", category: "operational", default_aggregation_period: "annual", default_engine_handler: "universal", default_gl_account: "2450-minimum-guarantee", default_finance_hub_tab: "min-guarantee", is_active: true, sort_order: 100 },
  ];

  export const FLOW_SUBTYPE_VALIDITY_SEED = [
    { flow_type_code: "VRP", subtype_code: "RA", is_primary: true, notes: null },
  { flow_type_code: "VRP", subtype_code: "CB", is_primary: false, notes: null },
  { flow_type_code: "VRP", subtype_code: "PTR", is_primary: false, notes: null },
  { flow_type_code: "VRP", subtype_code: "MIN", is_primary: false, notes: null },
  { flow_type_code: "CRP", subtype_code: "RA", is_primary: true, notes: null },
  { flow_type_code: "CRP", subtype_code: "CB", is_primary: false, notes: null },
  { flow_type_code: "CRP", subtype_code: "PP", is_primary: false, notes: null },
  { flow_type_code: "CRP", subtype_code: "MDF", is_primary: false, notes: null },
  { flow_type_code: "CRP", subtype_code: "PTR", is_primary: false, notes: null },
  { flow_type_code: "CRP", subtype_code: "MIN", is_primary: false, notes: null },
  { flow_type_code: "RLA", subtype_code: "ROY", is_primary: true, notes: null },
  { flow_type_code: "RLA", subtype_code: "MIN", is_primary: false, notes: null },
  { flow_type_code: "RLA", subtype_code: "RSS", is_primary: false, notes: null },
  { flow_type_code: "RLA", subtype_code: "SBE", is_primary: false, notes: null },
  { flow_type_code: "SUB", subtype_code: "RSS", is_primary: true, notes: null },
  { flow_type_code: "SUB", subtype_code: "SBE", is_primary: false, notes: null },
  { flow_type_code: "SUB", subtype_code: "MIN", is_primary: false, notes: null },
  { flow_type_code: "RSM", subtype_code: "RA", is_primary: true, notes: null },
  { flow_type_code: "RSM", subtype_code: "COM", is_primary: false, notes: null },
  { flow_type_code: "RSM", subtype_code: "MIN", is_primary: false, notes: null },
  { flow_type_code: "RSM", subtype_code: "MDF", is_primary: false, notes: null },
  { flow_type_code: "OEM", subtype_code: "ROY", is_primary: true, notes: null },
  { flow_type_code: "OEM", subtype_code: "SBE", is_primary: false, notes: null },
  { flow_type_code: "OEM", subtype_code: "MIN", is_primary: false, notes: null },
  { flow_type_code: "VRP", subtype_code: "PP", is_primary: false, notes: null },
  { flow_type_code: "VRP", subtype_code: "MDF", is_primary: false, notes: null },
  ];

  export const RULE_TYPES_SEED = [
    { code: "percentage", name: "Percentage of Basis", description: "rate × basis (e.g. 5% × net sales).", engine_handler: "universal", is_active: true, sort_order: 10 },
  { code: "per_unit", name: "Per-Unit Amount", description: "amount × units (e.g. $0.50 × units shipped).", engine_handler: "universal", is_active: true, sort_order: 20 },
  { code: "flat_amount", name: "Flat / Fixed Amount", description: "A fixed amount per period or event.", engine_handler: "universal", is_active: true, sort_order: 30 },
  { code: "tiered_volume", name: "Tiered (Marginal Volume)", description: "Marginal-tier rate based on per-period volume.", engine_handler: "universal", is_active: true, sort_order: 40 },
  { code: "tiered_cumulative", name: "Tiered (Cumulative)", description: "Cumulative-threshold tiers with retroactive true-ups.", engine_handler: "universal", is_active: true, sort_order: 50 },
  { code: "metered_usage", name: "Metered Usage", description: "Usage-metered billing (per call, per request, per minute, etc.).", engine_handler: "universal", is_active: true, sort_order: 60 },
  ];

  export const RULE_FIELD_WHITELIST_SEED = [
    { company_id: null, object_code: "product", attribute_code: "name", label: "Name", field_type: "lookup", master_table: "products", is_active: true, is_system: true, is_default: true, sequence: 10 },
  { company_id: null, object_code: "product", attribute_code: "sku", label: "SKU", field_type: "lookup", master_table: "products", is_active: true, is_system: true, is_default: false, sequence: 20 },
  { company_id: null, object_code: "product", attribute_code: "product_code", label: "Product Code", field_type: "lookup", master_table: "products", is_active: true, is_system: true, is_default: false, sequence: 30 },
  { company_id: null, object_code: "product", attribute_code: "product_category", label: "Category", field_type: "lookup", master_table: "products", is_active: true, is_system: true, is_default: false, sequence: 40 },
  { company_id: null, object_code: "product", attribute_code: "product_family", label: "Family", field_type: "lookup", master_table: "products", is_active: true, is_system: true, is_default: false, sequence: 50 },
  { company_id: null, object_code: "product", attribute_code: "product_line", label: "Line", field_type: "text", master_table: "products", is_active: true, is_system: true, is_default: false, sequence: 60 },
  { company_id: null, object_code: "product", attribute_code: "asset_type", label: "Asset Type", field_type: "text", master_table: "products", is_active: true, is_system: true, is_default: false, sequence: 70 },
  { company_id: null, object_code: "product", attribute_code: "revenue_type", label: "Revenue Type", field_type: "text", master_table: "products", is_active: true, is_system: true, is_default: false, sequence: 80 },
  { company_id: null, object_code: "customer", attribute_code: "name", label: "Name", field_type: "lookup", master_table: "customers", is_active: true, is_system: true, is_default: true, sequence: 10 },
  { company_id: null, object_code: "customer", attribute_code: "code", label: "Code", field_type: "lookup", master_table: "customers", is_active: true, is_system: true, is_default: false, sequence: 20 },
  { company_id: null, object_code: "customer", attribute_code: "segment", label: "Segment", field_type: "lookup", master_table: "customers", is_active: true, is_system: true, is_default: false, sequence: 30 },
  { company_id: null, object_code: "customer", attribute_code: "channel", label: "Channel", field_type: "text", master_table: "customers", is_active: true, is_system: true, is_default: false, sequence: 40 },
  { company_id: null, object_code: "customer", attribute_code: "territory", label: "Territory", field_type: "text", master_table: "customers", is_active: true, is_system: true, is_default: false, sequence: 50 },
  { company_id: null, object_code: "partner", attribute_code: "partner_name", label: "Name", field_type: "lookup", master_table: "partner_master", is_active: true, is_system: true, is_default: true, sequence: 10 },
  { company_id: null, object_code: "partner", attribute_code: "partner_type", label: "Type", field_type: "text", master_table: "partner_master", is_active: true, is_system: true, is_default: false, sequence: 20 },
  { company_id: null, object_code: "partner", attribute_code: "partner_classification", label: "Classification", field_type: "text", master_table: "partner_master", is_active: true, is_system: true, is_default: false, sequence: 30 },
  { company_id: null, object_code: "partner", attribute_code: "headquarters_country", label: "Country", field_type: "text", master_table: "partner_master", is_active: true, is_system: true, is_default: false, sequence: 40 },
  { company_id: null, object_code: "partner", attribute_code: "headquarters_state", label: "State", field_type: "text", master_table: "partner_master", is_active: true, is_system: true, is_default: false, sequence: 50 },
  { company_id: null, object_code: "partner", attribute_code: "primary_sales_channel", label: "Primary Channel", field_type: "text", master_table: "partner_master", is_active: true, is_system: true, is_default: false, sequence: 60 },
  { company_id: null, object_code: "partner", attribute_code: "primary_territory", label: "Primary Territory", field_type: "text", master_table: "partner_master", is_active: true, is_system: true, is_default: false, sequence: 70 },
  { company_id: null, object_code: "partner", attribute_code: "status", label: "Status", field_type: "text", master_table: "partner_master", is_active: true, is_system: true, is_default: false, sequence: 80 },
  { company_id: null, object_code: "channel", attribute_code: "channel_name", label: "Name", field_type: "lookup", master_table: "sales_channels", is_active: true, is_system: true, is_default: true, sequence: 10 },
  { company_id: null, object_code: "channel", attribute_code: "channel_code", label: "Code", field_type: "lookup", master_table: "sales_channels", is_active: true, is_system: true, is_default: false, sequence: 20 },
  { company_id: null, object_code: "channel", attribute_code: "channel_type", label: "Type", field_type: "text", master_table: "sales_channels", is_active: true, is_system: true, is_default: false, sequence: 30 },
  { company_id: null, object_code: "channel", attribute_code: "channel_category", label: "Category", field_type: "text", master_table: "sales_channels", is_active: true, is_system: true, is_default: false, sequence: 40 },
  { company_id: null, object_code: "territory", attribute_code: "territory_name", label: "Name", field_type: "lookup", master_table: "territory_master", is_active: true, is_system: true, is_default: true, sequence: 10 },
  { company_id: null, object_code: "territory", attribute_code: "territory_code", label: "Code", field_type: "lookup", master_table: "territory_master", is_active: true, is_system: true, is_default: false, sequence: 20 },
  { company_id: null, object_code: "territory", attribute_code: "territory_type", label: "Type", field_type: "text", master_table: "territory_master", is_active: true, is_system: true, is_default: false, sequence: 30 },
  { company_id: null, object_code: "territory", attribute_code: "currency_code", label: "Currency", field_type: "text", master_table: "territory_master", is_active: true, is_system: true, is_default: false, sequence: 40 },
  { company_id: null, object_code: "territory", attribute_code: "tax_jurisdiction", label: "Tax Jurisdiction", field_type: "text", master_table: "territory_master", is_active: true, is_system: true, is_default: false, sequence: 50 },
  { company_id: null, object_code: "product_attribute", attribute_code: "attribute_value", label: "Attribute Value", field_type: "text", master_table: "product_attributes", is_active: true, is_system: true, is_default: true, sequence: 10 },
  { company_id: null, object_code: "product", attribute_code: "brand_id", label: "Brand", field_type: "lookup", master_table: "products", is_active: true, is_system: true, is_default: false, sequence: 25 },
  ];

  export const DEDUCTION_REASON_CODES_SEED = [
    { code: "shortage", description: "Quantity received less than billed", default_disposition: "dispute", is_active: true },
  { code: "damaged", description: "Goods received damaged", default_disposition: "dispute", is_active: true },
  { code: "pricing", description: "Price discrepancy vs PO/contract", default_disposition: "match", is_active: true },
  { code: "promo", description: "Promotional allowance / co-op", default_disposition: "match", is_active: true },
  { code: "returns", description: "Customer returns / RMA", default_disposition: "match", is_active: true },
  { code: "freight", description: "Freight charges disputed", default_disposition: "dispute", is_active: true },
  { code: "tax", description: "Tax billed in error", default_disposition: "write_off", is_active: true },
  { code: "other", description: "Uncategorized deduction", default_disposition: "dispute", is_active: true },
  ];
  