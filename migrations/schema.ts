import { pgTable, index, uniqueIndex, varchar, boolean, integer, timestamp, text, numeric, jsonb, unique, date, json, vector, real, serial, foreignKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const calculationDimensionConfig = pgTable("calculation_dimension_config", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        dimensionKey: varchar("dimension_key").notNull(),
        displayName: varchar("display_name").notNull(),
        erpFieldId: varchar("erp_field_id"),
        erpFieldName: varchar("erp_field_name"),
        dimensionType: varchar("dimension_type").notNull(),
        isGroupable: boolean("is_groupable").default(true).notNull(),
        sortOrder: integer("sort_order").default(0),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("calc_dim_config_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        uniqueIndex("calc_dim_config_unique_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops"), table.dimensionKey.asc().nullsLast().op("text_ops")),
]);

export const calculationFieldTypes = pgTable("calculation_field_types", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractTypeCode: varchar("contract_type_code").notNull(),
        fieldCode: varchar("field_code").notNull(),
        fieldName: varchar("field_name").notNull(),
        fieldCategory: varchar("field_category").notNull(),
        description: text(),
        isRequired: boolean("is_required").default(false).notNull(),
        sortOrder: integer("sort_order").default(0),
        defaultColumnPatterns: text("default_column_patterns").array(),
        dataType: varchar("data_type").default('number').notNull(),
        isActive: boolean("is_active").default(true).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const calculationLineItems = pgTable("calculation_line_items", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        calculationId: varchar("calculation_id").notNull(),
        contractId: varchar("contract_id").notNull(),
        salesDataId: varchar("sales_data_id"),
        blueprintId: varchar("blueprint_id"),
        ruleId: varchar("rule_id"),
        transactionDate: timestamp("transaction_date", { mode: 'string' }),
        transactionId: varchar("transaction_id"),
        salesAmount: numeric("sales_amount", { precision: 15, scale:  2 }),
        quantity: numeric({ precision: 12, scale:  4 }),
        unitPrice: numeric("unit_price", { precision: 15, scale:  2 }),
        calculatedFee: numeric("calculated_fee", { precision: 15, scale:  2 }).notNull(),
        appliedRate: numeric("applied_rate", { precision: 10, scale:  4 }),
        ruleName: varchar("rule_name"),
        ruleType: varchar("rule_type"),
        tierApplied: varchar("tier_applied"),
        dimensions: jsonb().default({}).notNull(),
        vendorName: varchar("vendor_name"),
        vendorCode: varchar("vendor_code"),
        itemName: varchar("item_name"),
        itemCode: varchar("item_code"),
        itemClass: varchar("item_class"),
        territory: varchar(),
        period: varchar(),
        companyId: varchar("company_id"),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("calc_line_items_calc_idx").using("btree", table.calculationId.asc().nullsLast().op("text_ops")),
        index("calc_line_items_class_idx").using("btree", table.itemClass.asc().nullsLast().op("text_ops")),
        index("calc_line_items_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("calc_line_items_item_idx").using("btree", table.itemName.asc().nullsLast().op("text_ops")),
        index("calc_line_items_period_idx").using("btree", table.period.asc().nullsLast().op("text_ops")),
        index("calc_line_items_territory_idx").using("btree", table.territory.asc().nullsLast().op("text_ops")),
        index("calc_line_items_vendor_idx").using("btree", table.vendorName.asc().nullsLast().op("text_ops")),
]);

export const companyMaster = pgTable("company_master", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        companyId: varchar("company_id", { length: 50 }).notNull(),
        companyName: varchar("company_name", { length: 255 }).notNull(),
        legalEntityName: varchar("legal_entity_name", { length: 255 }),
        industry: varchar({ length: 100 }),
        headquartersCity: varchar("headquarters_city", { length: 100 }),
        headquartersState: varchar("headquarters_state", { length: 50 }),
        headquartersCountry: varchar("headquarters_country", { length: 100 }),
        annualRevenueMillions: numeric("annual_revenue_millions"),
        employeeCount: integer("employee_count"),
        erpSystem: varchar("erp_system", { length: 100 }),
        erpVersion: varchar("erp_version", { length: 50 }),
        fiscalYearEnd: date("fiscal_year_end"),
        primaryCurrency: varchar("primary_currency", { length: 10 }),
        taxId: varchar("tax_id", { length: 50 }),
        website: varchar({ length: 255 }),
        status: varchar({ length: 50 }).default('Active'),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("company_master_company_id_key").on(table.companyId),
]);

export const contractTypeDefinitions = pgTable("contract_type_definitions", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        code: varchar().notNull(),
        name: varchar().notNull(),
        description: text(),
        icon: varchar(),
        color: varchar(),
        isSystemType: boolean("is_system_type").default(false).notNull(),
        isActive: boolean("is_active").default(true).notNull(),
        sortOrder: integer("sort_order").default(0),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        extractionPrompt: text("extraction_prompt"),
        ruleExtractionPrompt: text("rule_extraction_prompt"),
        erpMappingPrompt: text("erp_mapping_prompt"),
        sampleExtractionOutput: text("sample_extraction_output"),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        ragExtractionPrompt: text("rag_extraction_prompt"),
        ragRuleExtractionPrompt: text("rag_rule_extraction_prompt"),
        ragSampleExtractionOutput: text("rag_sample_extraction_output"),
}, (table) => [
        unique("contract_type_definitions_code_key").on(table.code),
        unique("contract_type_definitions_code_unique").on(table.code),
]);

export const dataImportSources = pgTable("data_import_sources", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        name: varchar({ length: 255 }).notNull(),
        description: text(),
        sourceType: varchar("source_type").default('file').notNull(),
        connectionId: varchar("connection_id"),
        endpointTemplateId: varchar("endpoint_template_id"),
        mappingId: varchar("mapping_id"),
        erpSystemId: varchar("erp_system_id"),
        entityType: varchar("entity_type"),
        licenseiqEntityId: varchar("licenseiq_entity_id"),
        companyId: varchar("company_id"),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        filters: jsonb(),
        scheduleEnabled: boolean("schedule_enabled").default(false).notNull(),
        scheduleType: varchar("schedule_type"),
        scheduleCron: varchar("schedule_cron"),
        lastRunAt: timestamp("last_run_at", { mode: 'string' }),
        nextRunAt: timestamp("next_run_at", { mode: 'string' }),
        importOptions: jsonb("import_options"),
        status: varchar().default('active').notNull(),
        lastError: text("last_error"),
        successCount: integer("success_count").default(0),
        failureCount: integer("failure_count").default(0),
        createdBy: varchar("created_by").notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const demoRequests = pgTable("demo_requests", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        email: varchar().notNull(),
        planTier: varchar("plan_tier").notNull(),
        source: varchar().default('pricing_section'),
        status: varchar().default('new').notNull(),
        notes: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("demo_requests_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
        index("demo_requests_plan_idx").using("btree", table.planTier.asc().nullsLast().op("text_ops")),
        index("demo_requests_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const earlyAccessSignups = pgTable("early_access_signups", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        email: varchar().notNull(),
        name: varchar(),
        company: varchar(),
        source: varchar().default('landing_page'),
        status: varchar().default('new').notNull(),
        notes: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("early_access_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
        index("early_access_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const items = pgTable("items", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        itemNumber: varchar("item_number", { length: 50 }).notNull(),
        description: varchar({ length: 500 }).notNull(),
        licenseFeeType: varchar("license_fee_type", { length: 100 }),
        fullLegalProductName: varchar("full_legal_product_name", { length: 500 }),
        language: varchar({ length: 50 }),
        priceTier: varchar("price_tier", { length: 50 }),
        itemCategory: varchar("item_category", { length: 100 }),
        licenseFeeCategory: varchar("license_fee_category", { length: 100 }),
        additionalCategory: varchar("additional_category", { length: 100 }),
        licenseBrand: varchar("license_brand", { length: 200 }),
        licenseProperty: varchar("license_property", { length: 200 }),
        itemType: varchar("item_type", { length: 100 }),
        itemClass: varchar("item_class", { length: 100 }),
        uom: varchar({ length: 20 }),
        sellUom: varchar("sell_uom", { length: 20 }),
        buyUom: varchar("buy_uom", { length: 20 }),
        retailUom: varchar("retail_uom", { length: 20 }),
        componentItem: boolean("component_item").default(false),
        mfgItemNumber: varchar("mfg_item_number", { length: 100 }),
        licensorItemNumber: varchar("licensor_item_number", { length: 100 }),
        vendorItemNumber: varchar("vendor_item_number", { length: 100 }),
        itemStatus: varchar("item_status", { length: 50 }).default('Active'),
        gtin: varchar({ length: 50 }),
        vendor: varchar({ length: 200 }),
        companyId: varchar("company_id"),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        createdBy: varchar("created_by"),
        updatedBy: varchar("updated_by"),
}, (table) => [
        index("idx_items_category").using("btree", table.itemCategory.asc().nullsLast().op("text_ops")),
        index("idx_items_company").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("idx_items_item_number").using("btree", table.itemNumber.asc().nullsLast().op("text_ops")),
        index("idx_items_status").using("btree", table.itemStatus.asc().nullsLast().op("text_ops")),
        index("idx_items_vendor").using("btree", table.vendor.asc().nullsLast().op("text_ops")),
        unique("items_item_number_key").on(table.itemNumber),
]);

export const marketBenchmarks = pgTable("market_benchmarks", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractType: varchar("contract_type").notNull(),
        industry: varchar(),
        benchmarkData: jsonb("benchmark_data"),
        averageValue: numeric("average_value", { precision: 15, scale:  2 }),
        standardTerms: jsonb("standard_terms"),
        riskFactors: jsonb("risk_factors"),
        lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const partnerContractAssociations = pgTable("partner_contract_associations", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        associationId: varchar("association_id", { length: 50 }).notNull(),
        partnerId: varchar("partner_id", { length: 50 }),
        contractId: varchar("contract_id", { length: 100 }),
        effectiveDate: date("effective_date"),
        expirationDate: date("expiration_date"),
        contractStatus: varchar("contract_status", { length: 50 }),
        isPrimaryContract: boolean("is_primary_contract").default(false),
        notes: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("partner_contract_associations_association_id_key").on(table.associationId),
]);

export const partnerMaster = pgTable("partner_master", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        partnerId: varchar("partner_id", { length: 50 }).notNull(),
        companyId: varchar("company_id", { length: 50 }),
        businessUnit: varchar("business_unit", { length: 100 }),
        partnerName: varchar("partner_name", { length: 255 }).notNull(),
        partnerType: varchar("partner_type", { length: 100 }),
        partnerClassification: varchar("partner_classification", { length: 50 }),
        legalEntityName: varchar("legal_entity_name", { length: 255 }),
        headquartersCity: varchar("headquarters_city", { length: 100 }),
        headquartersState: varchar("headquarters_state", { length: 50 }),
        headquartersCountry: varchar("headquarters_country", { length: 100 }),
        primaryContactName: varchar("primary_contact_name", { length: 200 }),
        primaryContactEmail: varchar("primary_contact_email", { length: 200 }),
        status: varchar({ length: 50 }).default('Active'),
        onboardingDate: date("onboarding_date"),
        paymentTerms: varchar("payment_terms", { length: 50 }),
        paymentMethod: varchar("payment_method", { length: 50 }),
        currency: varchar({ length: 10 }),
        taxId: varchar("tax_id", { length: 50 }),
        creditLimit: numeric("credit_limit"),
        primarySalesChannel: varchar("primary_sales_channel", { length: 50 }),
        authorizedChannels: text("authorized_channels"),
        primaryTerritory: varchar("primary_territory", { length: 50 }),
        authorizedTerritories: text("authorized_territories"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("partner_master_partner_id_key").on(table.partnerId),
]);

export const productAttributes = pgTable("product_attributes", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        attributeId: varchar("attribute_id", { length: 50 }).notNull(),
        productId: varchar("product_id", { length: 50 }),
        attributeName: varchar("attribute_name", { length: 200 }).notNull(),
        attributeValue: varchar("attribute_value", { length: 500 }),
        attributeCategory: varchar("attribute_category", { length: 100 }),
        description: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("product_attributes_attribute_id_key").on(table.attributeId),
]);

export const productBom = pgTable("product_bom", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        bomId: varchar("bom_id", { length: 50 }).notNull(),
        parentProductId: varchar("parent_product_id", { length: 50 }),
        componentProductId: varchar("component_product_id", { length: 50 }),
        componentQuantity: numeric("component_quantity"),
        componentUom: varchar("component_uom", { length: 50 }),
        bomType: varchar("bom_type", { length: 100 }),
        sequenceNumber: integer("sequence_number"),
        isOptional: boolean("is_optional").default(false),
        substituteProductId: varchar("substitute_product_id", { length: 50 }),
        scrapFactorPercent: numeric("scrap_factor_percent"),
        effectiveDate: date("effective_date"),
        expirationDate: date("expiration_date"),
        notes: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("product_bom_bom_id_key").on(table.bomId),
]);

export const productChannelMatrix = pgTable("product_channel_matrix", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        channelAuthId: varchar("channel_auth_id", { length: 50 }).notNull(),
        productId: varchar("product_id", { length: 50 }),
        channelId: varchar("channel_id", { length: 50 }),
        isAuthorized: boolean("is_authorized").default(false),
        restrictionReason: text("restriction_reason"),
        channelSpecificSku: varchar("channel_specific_sku", { length: 100 }),
        channelSpecificPricing: boolean("channel_specific_pricing").default(false),
        minOrderQuantity: integer("min_order_quantity"),
        maxOrderQuantity: integer("max_order_quantity"),
        effectiveDate: date("effective_date"),
        expirationDate: date("expiration_date"),
        notes: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("product_channel_matrix_channel_auth_id_key").on(table.channelAuthId),
]);

export const productClassifications = pgTable("product_classifications", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        classificationDimension: varchar("classification_dimension", { length: 100 }).notNull(),
        classificationValue: varchar("classification_value", { length: 200 }),
        description: text(),
        useCase: text("use_case"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("product_classifications_dim_val_unique").on(table.classificationDimension, table.classificationValue),
]);

export const productHierarchy = pgTable("product_hierarchy", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        hierarchyId: varchar("hierarchy_id", { length: 50 }).notNull(),
        companyId: varchar("company_id", { length: 50 }),
        levelName: varchar("level_name", { length: 100 }),
        levelOrder: integer("level_order"),
        parentHierarchyId: varchar("parent_hierarchy_id", { length: 50 }),
        hierarchyValue: varchar("hierarchy_value", { length: 200 }),
        description: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("product_hierarchy_hierarchy_id_key").on(table.hierarchyId),
]);

export const productPackagingMatrix = pgTable("product_packaging_matrix", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        packageId: varchar("package_id", { length: 50 }).notNull(),
        productId: varchar("product_id", { length: 50 }),
        packageType: varchar("package_type", { length: 50 }),
        packageCode: varchar("package_code", { length: 20 }),
        unitsPerPackage: integer("units_per_package"),
        isBaseUnit: boolean("is_base_unit").default(false),
        isSellable: boolean("is_sellable").default(true),
        listPricePackage: numeric("list_price_package"),
        standardCostPackage: numeric("standard_cost_package"),
        barcodePackage: varchar("barcode_package", { length: 50 }),
        weightKgPackage: numeric("weight_kg_package"),
        dimensionsCm: varchar("dimensions_cm", { length: 50 }),
        effectiveDate: date("effective_date"),
        expirationDate: date("expiration_date"),
        description: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("product_packaging_matrix_package_id_key").on(table.packageId),
]);

export const productTerritoryMatrix = pgTable("product_territory_matrix", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        territoryAuthId: varchar("territory_auth_id", { length: 50 }).notNull(),
        productId: varchar("product_id", { length: 50 }),
        territoryId: varchar("territory_id", { length: 50 }),
        isAuthorized: boolean("is_authorized").default(false),
        restrictionReason: text("restriction_reason"),
        requiresCertification: boolean("requires_certification").default(false),
        certificationType: varchar("certification_type", { length: 100 }),
        certificationStatus: varchar("certification_status", { length: 50 }),
        effectiveDate: date("effective_date"),
        expirationDate: date("expiration_date"),
        importDutyPct: numeric("import_duty_pct"),
        notes: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("product_territory_matrix_territory_auth_id_key").on(table.territoryAuthId),
]);

export const roles = pgTable("roles", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        roleName: varchar("role_name").notNull(),
        displayName: varchar("display_name").notNull(),
        description: text(),
        isSystemRole: boolean("is_system_role").default(false),
        isActive: boolean("is_active").default(true),
        createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
        updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
        index("roles_name_idx").using("btree", table.roleName.asc().nullsLast().op("text_ops")),
        unique("roles_role_name_key").on(table.roleName),
]);

export const products = pgTable("products", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        productId: varchar("product_id", { length: 50 }).notNull(),
        companyId: varchar("company_id", { length: 50 }),
        sku: varchar({ length: 100 }),
        productName: varchar("product_name", { length: 300 }).notNull(),
        productCategory: varchar("product_category", { length: 100 }),
        productFamily: varchar("product_family", { length: 100 }),
        productLine: varchar("product_line", { length: 100 }),
        productClassification: varchar("product_classification", { length: 100 }),
        assetType: varchar("asset_type", { length: 50 }),
        durabilityClass: varchar("durability_class", { length: 100 }),
        revenueType: varchar("revenue_type", { length: 100 }),
        taxCategory: varchar("tax_category", { length: 50 }),
        regulatoryClass: varchar("regulatory_class", { length: 100 }),
        listPrice: numeric("list_price"),
        standardCost: numeric("standard_cost"),
        baseUnitOfMeasure: varchar("base_unit_of_measure", { length: 50 }),
        alternateUomSellable: varchar("alternate_uom_sellable", { length: 100 }),
        casePackQuantity: integer("case_pack_quantity"),
        innerPackQuantity: integer("inner_pack_quantity"),
        productStatus: varchar("product_status", { length: 50 }).default('Active'),
        eligibleForRebates: boolean("eligible_for_rebates").default(false),
        eligibleForRoyalties: boolean("eligible_for_royalties").default(false),
        hasBom: boolean("has_bom").default(false),
        isComponentOnly: boolean("is_component_only").default(false),
        manufacturingLeadTimeDays: integer("manufacturing_lead_time_days"),
        launchDate: date("launch_date"),
        barcodeUpc: varchar("barcode_upc", { length: 50 }),
        weightKg: numeric("weight_kg"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
        productCategoryId: varchar("product_category_id"),
        productFamilyId: varchar("product_family_id"),
        productLineId: varchar("product_line_id"),
        brandId: varchar("brand_id"),
}, (table) => [
        unique("products_product_id_key").on(table.productId),
]);

export const ruleNodeDefinitions = pgTable("rule_node_definitions", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        nodeType: varchar("node_type").notNull(),
        displayName: varchar("display_name").notNull(),
        description: text(),
        schema: jsonb().notNull(),
        evaluationAdapter: text("evaluation_adapter"),
        examples: jsonb(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        unique("rule_node_definitions_node_type_key").on(table.nodeType),
]);

export const salesChannels = pgTable("sales_channels", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        channelId: varchar("channel_id", { length: 50 }).notNull(),
        channelCode: varchar("channel_code", { length: 50 }),
        channelName: varchar("channel_name", { length: 200 }).notNull(),
        channelType: varchar("channel_type", { length: 50 }),
        channelCategory: varchar("channel_category", { length: 50 }),
        typicalMarginPctLow: numeric("typical_margin_pct_low"),
        typicalMarginPctHigh: numeric("typical_margin_pct_high"),
        requiresCertification: boolean("requires_certification").default(false),
        paymentTermsDefault: varchar("payment_terms_default", { length: 50 }),
        minOrderValueUsd: numeric("min_order_value_usd"),
        maxCreditLimitUsd: varchar("max_credit_limit_usd", { length: 100 }),
        volumeDiscountEligible: boolean("volume_discount_eligible").default(false),
        coopAdvertisingEligible: boolean("coop_advertising_eligible").default(false),
        status: varchar({ length: 50 }).default('Active'),
        description: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("sales_channels_channel_id_key").on(table.channelId),
]);

export const session = pgTable("session", {
        sid: varchar().primaryKey().notNull(),
        sess: json().notNull(),
        expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
        index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const sessions = pgTable("sessions", {
        sid: varchar().primaryKey().notNull(),
        sess: jsonb().notNull(),
        expire: timestamp({ mode: 'string' }).notNull(),
});

export const systemEmbeddings = pgTable("system_embeddings", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        documentId: varchar("document_id").notNull(),
        category: varchar().notNull(),
        title: varchar().notNull(),
        sourceText: text("source_text").notNull(),
        embedding: vector({ dimensions: 384 }),
        metadata: jsonb(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("system_embeddings_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
        index("system_embeddings_document_idx").using("btree", table.documentId.asc().nullsLast().op("text_ops")),
        index("system_embeddings_embedding_hnsw_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
        unique("system_embeddings_document_id_key").on(table.documentId),
]);

export const systemSettings = pgTable("system_settings", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        aiModel: varchar("ai_model").default('llama-3.3-70b-versatile').notNull(),
        aiTemperature: real("ai_temperature").default(0.1).notNull(),
        aiMaxTokens: integer("ai_max_tokens").default(8000).notNull(),
        aiRetryAttempts: integer("ai_retry_attempts").default(3).notNull(),
        autoConfirmThreshold: real("auto_confirm_threshold").default(0.85).notNull(),
        lowConfidenceThreshold: real("low_confidence_threshold").default(0.6).notNull(),
        sessionTimeoutMinutes: integer("session_timeout_minutes").default(60).notNull(),
        maxLoginAttempts: integer("max_login_attempts").default(5).notNull(),
        passwordMinLength: integer("password_min_length").default(8).notNull(),
        require2Fa: boolean("require_2fa").default(false).notNull(),
        maxFileSizeMb: integer("max_file_size_mb").default(50).notNull(),
        allowedFileTypes: jsonb("allowed_file_types").default(["pdf","docx","xlsx","csv"]).notNull(),
        fileRetentionDays: integer("file_retention_days").default(365).notNull(),
        enableBetaFeatures: boolean("enable_beta_features").default(false).notNull(),
        enableAuditLogging: boolean("enable_audit_logging").default(true).notNull(),
        enableEmailNotifications: boolean("enable_email_notifications").default(true).notNull(),
        apiRateLimitPerMinute: integer("api_rate_limit_per_minute").default(100).notNull(),
        extractionPrompts: jsonb("extraction_prompts"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        defaultEvaluationMode: varchar("default_evaluation_mode").default('universal').notNull(),
        defaultExtractionMode: varchar("default_extraction_mode").default('rag').notNull(),
        aiProvider: varchar("ai_provider").default('anthropic').notNull(),
        analysisMode: varchar("analysis_mode").default('on_demand').notNull(),
});

export const territoryMaster = pgTable("territory_master", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        territoryId: varchar("territory_id", { length: 50 }).notNull(),
        territoryCode: varchar("territory_code", { length: 50 }),
        territoryName: varchar("territory_name", { length: 200 }).notNull(),
        territoryType: varchar("territory_type", { length: 50 }),
        parentTerritoryId: varchar("parent_territory_id", { length: 50 }),
        regionLevel: integer("region_level"),
        currencyCode: varchar("currency_code", { length: 10 }),
        taxJurisdiction: varchar("tax_jurisdiction", { length: 200 }),
        regulatoryRequirements: varchar("regulatory_requirements", { length: 500 }),
        language: varchar({ length: 100 }),
        status: varchar({ length: 50 }).default('Active'),
        notes: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        recordStatus: varchar("record_status", { length: 20 }).default('Active').notNull(),
        createdBy: varchar("created_by", { length: 255 }),
        updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
        unique("territory_master_territory_id_key").on(table.territoryId),
]);

export const accuracyTestRuns = pgTable("accuracy_test_runs", {
        id: serial().primaryKey().notNull(),
        extractionMode: varchar("extraction_mode", { length: 50 }).notNull(),
        startedAt: timestamp("started_at", { mode: 'string' }).defaultNow(),
        completedAt: timestamp("completed_at", { mode: 'string' }),
        status: varchar({ length: 20 }).default('pending').notNull(),
        totalTests: integer("total_tests"),
        passedTests: integer("passed_tests"),
        failedTests: integer("failed_tests"),
        overallAccuracy: real("overall_accuracy"),
        metrics: jsonb(),
});

export const accuracyTestResults = pgTable("accuracy_test_results", {
        id: serial().primaryKey().notNull(),
        runId: integer("run_id").notNull(),
        testCaseId: integer("test_case_id").notNull(),
        passed: boolean().notNull(),
        accuracy: real().notNull(),
        fieldResults: jsonb("field_results").notNull(),
        extractedData: jsonb("extracted_data"),
        extractionTimeMs: integer("extraction_time_ms"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        foreignKey({
                        columns: [table.runId],
                        foreignColumns: [accuracyTestRuns.id],
                        name: "accuracy_test_results_run_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.testCaseId],
                        foreignColumns: [accuracyTestCases.id],
                        name: "accuracy_test_results_test_case_id_fkey"
                }).onDelete("cascade"),
]);

export const accuracyTestCases = pgTable("accuracy_test_cases", {
        id: serial().primaryKey().notNull(),
        name: varchar({ length: 255 }).notNull(),
        contractType: varchar("contract_type", { length: 100 }).notNull(),
        description: text(),
        contractText: text("contract_text").notNull(),
        groundTruth: jsonb("ground_truth").notNull(),
        isActive: boolean("is_active").default(true).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        source: varchar().default('synthetic').notNull(),
});

export const users = pgTable("users", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        email: varchar(),
        firstName: varchar("first_name"),
        lastName: varchar("last_name"),
        profileImageUrl: varchar("profile_image_url"),
        role: varchar().default('viewer').notNull(),
        isActive: boolean("is_active").default(true).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        username: varchar(),
        password: varchar().default('temp').notNull(),
        isSystemAdmin: boolean("is_system_admin").default(false).notNull(),
}, (table) => [
        unique("users_email_unique").on(table.email),
        unique("users_username_key").on(table.username),
        unique("users_username_unique").on(table.username),
]);

export const auditTrail = pgTable("audit_trail", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        userId: varchar("user_id").notNull(),
        action: varchar().notNull(),
        resourceType: varchar("resource_type"),
        resourceId: varchar("resource_id"),
        details: jsonb(),
        ipAddress: varchar("ip_address"),
        userAgent: text("user_agent"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        foreignKey({
                        columns: [table.userId],
                        foreignColumns: [users.id],
                        name: "audit_trail_user_id_users_id_fk"
                }),
]);

export const calculationBlueprints = pgTable("calculation_blueprints", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        companyId: varchar("company_id").notNull(),
        royaltyRuleId: varchar("royalty_rule_id").notNull(),
        erpRuleSetId: varchar("erp_rule_set_id"),
        name: varchar().notNull(),
        description: text(),
        ruleType: varchar("rule_type").notNull(),
        calculationLogic: jsonb("calculation_logic").notNull(),
        erpFieldBindings: jsonb("erp_field_bindings"),
        dualTerminologyMap: jsonb("dual_terminology_map"),
        matchingCriteria: jsonb("matching_criteria"),
        priority: integer().default(10).notNull(),
        status: varchar().default('active').notNull(),
        version: integer().default(1).notNull(),
        isFullyMapped: boolean("is_fully_mapped").default(false).notNull(),
        unmappedFields: text("unmapped_fields").array(),
        materializedAt: timestamp("materialized_at", { mode: 'string' }).defaultNow(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("calc_blueprints_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("calc_blueprints_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("calc_blueprints_rule_idx").using("btree", table.royaltyRuleId.asc().nullsLast().op("text_ops")),
        index("calc_blueprints_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const blueprintDimensions = pgTable("blueprint_dimensions", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        blueprintId: varchar("blueprint_id").notNull(),
        dimensionType: varchar("dimension_type").notNull(),
        contractTerm: varchar("contract_term").notNull(),
        erpFieldName: varchar("erp_field_name"),
        erpFieldId: varchar("erp_field_id"),
        mappingId: varchar("mapping_id"),
        matchValue: varchar("match_value"),
        isMapped: boolean("is_mapped").default(false).notNull(),
        confidence: numeric({ precision: 5, scale:  2 }),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("blueprint_dims_blueprint_idx").using("btree", table.blueprintId.asc().nullsLast().op("text_ops")),
        index("blueprint_dims_type_idx").using("btree", table.dimensionType.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.blueprintId],
                        foreignColumns: [calculationBlueprints.id],
                        name: "blueprint_dimensions_blueprint_id_fkey"
                }).onDelete("cascade"),
]);

export const companies = pgTable("companies", {
        companyId: varchar("company_id").default(gen_random_uuid()).primaryKey().notNull(),
        companyName: varchar("company_name", { length: 500 }).notNull(),
        companyDescr: text("company_descr"),
        address1: varchar({ length: 500 }),
        address2: varchar({ length: 500 }),
        address3: varchar({ length: 500 }),
        city: varchar({ length: 200 }),
        stateProvince: varchar("state_province", { length: 200 }),
        county: varchar({ length: 200 }),
        country: varchar({ length: 200 }),
        contactPerson: varchar("contact_person", { length: 300 }),
        contactEmail: varchar("contact_email", { length: 300 }),
        contactPhone: varchar("contact_phone", { length: 50 }),
        contactPreference: varchar("contact_preference", { length: 50 }),
        status: varchar({ length: 1 }).default('A').notNull(),
        createdBy: varchar("created_by").notNull(),
        creationDate: timestamp("creation_date", { mode: 'string' }).defaultNow().notNull(),
        lastUpdatedBy: varchar("last_updated_by").notNull(),
        lastUpdateDate: timestamp("last_update_date", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
        index("companies_name_idx").using("btree", table.companyName.asc().nullsLast().op("text_ops")),
        index("companies_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "companies_created_by_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.lastUpdatedBy],
                        foreignColumns: [users.id],
                        name: "companies_last_updated_by_fkey"
                }).onDelete("cascade"),
]);

export const businessUnits = pgTable("business_units", {
        orgId: varchar("org_id").default(gen_random_uuid()).primaryKey().notNull(),
        companyId: varchar("company_id").notNull(),
        orgName: varchar("org_name", { length: 500 }).notNull(),
        orgDescr: text("org_descr"),
        address1: varchar({ length: 500 }),
        contactPerson: varchar("contact_person", { length: 300 }),
        contactEmail: varchar("contact_email", { length: 300 }),
        contactPhone: varchar("contact_phone", { length: 50 }),
        contactPreference: varchar("contact_preference", { length: 50 }),
        status: varchar({ length: 1 }).default('A').notNull(),
        createdBy: varchar("created_by").notNull(),
        creationDate: timestamp("creation_date", { mode: 'string' }).defaultNow().notNull(),
        lastUpdatedBy: varchar("last_updated_by").notNull(),
        lastUpdateDate: timestamp("last_update_date", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
        index("business_units_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("business_units_name_idx").using("btree", table.orgName.asc().nullsLast().op("text_ops")),
        index("business_units_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.companyId],
                        foreignColumns: [companies.companyId],
                        name: "business_units_company_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "business_units_created_by_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.lastUpdatedBy],
                        foreignColumns: [users.id],
                        name: "business_units_last_updated_by_fkey"
                }).onDelete("cascade"),
]);

export const companySettings = pgTable("company_settings", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        companyId: varchar("company_id").notNull(),
        dateFormat: varchar("date_format").default('MM/DD/YYYY').notNull(),
        defaultCurrency: varchar("default_currency").default('USD').notNull(),
        timezone: varchar().default('America/New_York').notNull(),
        numberFormat: varchar("number_format").default('1,000.00').notNull(),
        allowedContractTypes: jsonb("allowed_contract_types").default(["direct_sales","distributor_reseller","referral","royalty_license","rebate_mdf"]).notNull(),
        customContractTypes: jsonb("custom_contract_types"),
        requiredFieldsByType: jsonb("required_fields_by_type"),
        allowedRegions: jsonb("allowed_regions"),
        defaultRegion: varchar("default_region"),
        territoryHierarchy: jsonb("territory_hierarchy"),
        enableApprovalWorkflow: boolean("enable_approval_workflow").default(true).notNull(),
        approvalChain: jsonb("approval_chain"),
        autoApprovalThresholdAmount: real("auto_approval_threshold_amount"),
        escalationDays: integer("escalation_days").default(3).notNull(),
        companyLogo: varchar("company_logo"),
        primaryColor: varchar("primary_color").default('#6366f1'),
        reportHeaderText: text("report_header_text"),
        reportFooterText: text("report_footer_text"),
        emailDigestFrequency: varchar("email_digest_frequency").default('daily').notNull(),
        alertThresholdAmount: real("alert_threshold_amount"),
        defaultErpSystemId: varchar("default_erp_system_id"),
        autoSyncEnabled: boolean("auto_sync_enabled").default(false).notNull(),
        syncScheduleCron: varchar("sync_schedule_cron"),
        roundingMethod: varchar("rounding_method").default('round_half_up').notNull(),
        defaultPaymentTermsDays: integer("default_payment_terms_days").default(30).notNull(),
        fiscalYearStartMonth: integer("fiscal_year_start_month").default(1).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        uniqueIndex("company_settings_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.companyId],
                        foreignColumns: [companies.companyId],
                        name: "company_settings_company_id_fkey"
                }).onDelete("cascade"),
]);

export const complianceAnalysis = pgTable("compliance_analysis", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        complianceScore: numeric("compliance_score", { precision: 5, scale:  2 }),
        regulatoryFrameworks: jsonb("regulatory_frameworks"),
        jurisdictionAnalysis: jsonb("jurisdiction_analysis"),
        dataProtectionCompliance: boolean("data_protection_compliance"),
        industryStandards: jsonb("industry_standards"),
        riskFactors: jsonb("risk_factors"),
        recommendedActions: jsonb("recommended_actions"),
        lastComplianceCheck: timestamp("last_compliance_check", { mode: 'string' }).defaultNow(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "compliance_analysis_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const contractApprovals = pgTable("contract_approvals", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractVersionId: varchar("contract_version_id").notNull(),
        approverId: varchar("approver_id").notNull(),
        status: varchar().notNull(),
        decisionNotes: text("decision_notes"),
        decidedAt: timestamp("decided_at", { mode: 'string' }).defaultNow(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("contract_approvals_version_idx").using("btree", table.contractVersionId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.approverId],
                        foreignColumns: [users.id],
                        name: "contract_approvals_approver_id_fkey"
                }),
        foreignKey({
                        columns: [table.contractVersionId],
                        foreignColumns: [contractVersions.id],
                        name: "contract_approvals_contract_version_id_fkey"
                }).onDelete("cascade"),
]);

export const contractVersions = pgTable("contract_versions", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        versionNumber: integer("version_number").notNull(),
        editorId: varchar("editor_id").notNull(),
        changeSummary: text("change_summary"),
        metadataSnapshot: jsonb("metadata_snapshot").notNull(),
        fileReference: varchar("file_reference"),
        approvalState: varchar("approval_state").default('draft').notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("contract_versions_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("contract_versions_state_idx").using("btree", table.approvalState.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "contract_versions_contract_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.editorId],
                        foreignColumns: [users.id],
                        name: "contract_versions_editor_id_fkey"
                }),
]);

export const contractComparisons = pgTable("contract_comparisons", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        similarContracts: jsonb("similar_contracts"),
        clauseVariations: jsonb("clause_variations"),
        termComparisons: jsonb("term_comparisons"),
        bestPractices: jsonb("best_practices"),
        anomalies: jsonb(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "contract_comparisons_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const contractDocuments = pgTable("contract_documents", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        extractionRunId: varchar("extraction_run_id"),
        documentSection: varchar("document_section"),
        sectionOrder: integer("section_order"),
        rawText: text("raw_text").notNull(),
        normalizedText: text("normalized_text"),
        pageNumber: integer("page_number"),
        metadata: jsonb(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("contract_documents_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("contract_documents_extraction_idx").using("btree", table.extractionRunId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "contract_documents_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const contractEmbeddings = pgTable("contract_embeddings", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        embeddingType: varchar("embedding_type").notNull(),
        sourceText: text("source_text").notNull(),
        embedding: vector({ dimensions: 384 }),
        metadata: jsonb(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("contract_embeddings_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("contract_embeddings_embedding_hnsw_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
        index("contract_embeddings_type_idx").using("btree", table.embeddingType.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "contract_embeddings_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const contractGraphEdges = pgTable("contract_graph_edges", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        extractionRunId: varchar("extraction_run_id"),
        sourceNodeId: varchar("source_node_id").notNull(),
        targetNodeId: varchar("target_node_id").notNull(),
        relationshipType: varchar("relationship_type").notNull(),
        properties: jsonb(),
        confidence: numeric({ precision: 5, scale:  2 }),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("graph_edges_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("graph_edges_source_idx").using("btree", table.sourceNodeId.asc().nullsLast().op("text_ops")),
        index("graph_edges_target_idx").using("btree", table.targetNodeId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "contract_graph_edges_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.sourceNodeId],
                        foreignColumns: [contractGraphNodes.id],
                        name: "contract_graph_edges_source_node_id_fkey"
                }),
        foreignKey({
                        columns: [table.targetNodeId],
                        foreignColumns: [contractGraphNodes.id],
                        name: "contract_graph_edges_target_node_id_fkey"
                }),
]);

export const contractGraphNodes = pgTable("contract_graph_nodes", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        extractionRunId: varchar("extraction_run_id"),
        nodeType: varchar("node_type").notNull(),
        label: varchar().notNull(),
        properties: jsonb().notNull(),
        confidence: numeric({ precision: 5, scale:  2 }),
        sourceDocumentId: varchar("source_document_id"),
        sourceText: text("source_text"),
        embedding: vector({ dimensions: 384 }),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("graph_nodes_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("graph_nodes_extraction_idx").using("btree", table.extractionRunId.asc().nullsLast().op("text_ops")),
        index("graph_nodes_type_idx").using("btree", table.nodeType.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "contract_graph_nodes_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.sourceDocumentId],
                        foreignColumns: [contractDocuments.id],
                        name: "contract_graph_nodes_source_document_id_fkey"
                }),
]);

export const contractObligations = pgTable("contract_obligations", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        obligationType: varchar("obligation_type").notNull(),
        description: text().notNull(),
        dueDate: timestamp("due_date", { mode: 'string' }),
        responsible: varchar(),
        status: varchar().default('pending'),
        priority: varchar().default('medium'),
        completionDate: timestamp("completion_date", { mode: 'string' }),
        notes: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "contract_obligations_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const contracts = pgTable("contracts", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        fileName: varchar("file_name").notNull(),
        originalName: varchar("original_name").notNull(),
        fileSize: integer("file_size").notNull(),
        fileType: varchar("file_type").notNull(),
        filePath: varchar("file_path").notNull(),
        contractType: varchar("contract_type"),
        priority: varchar().default('normal').notNull(),
        status: varchar().default('uploaded').notNull(),
        uploadedBy: varchar("uploaded_by").notNull(),
        notes: text(),
        processingStartedAt: timestamp("processing_started_at", { mode: 'string' }),
        processingCompletedAt: timestamp("processing_completed_at", { mode: 'string' }),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        contractNumber: varchar("contract_number"),
        displayName: varchar("display_name"),
        effectiveStart: timestamp("effective_start", { mode: 'string' }),
        effectiveEnd: timestamp("effective_end", { mode: 'string' }),
        renewalTerms: text("renewal_terms"),
        governingLaw: varchar("governing_law"),
        counterpartyName: varchar("counterparty_name"),
        contractOwnerId: varchar("contract_owner_id"),
        approvalState: varchar("approval_state").default('draft').notNull(),
        currentVersion: integer("current_version").default(1).notNull(),
        organizationName: varchar("organization_name"),
        useErpMatching: boolean("use_erp_matching").default(false).notNull(),
        companyId: varchar("company_id"),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        erpSystemId: varchar("erp_system_id"),
        requireMappingConfirmation: boolean("require_mapping_confirmation").default(true).notNull(),
        mappingConfidenceThreshold: real("mapping_confidence_threshold").default(0.7),
        contractSubtype: varchar("contract_subtype"),
        rawText: text("raw_text"),
        contractCategory: varchar("contract_category"),
        owningParty: varchar("owning_party"),
        counterpartyType: varchar("counterparty_type"),
        territoryScope: varchar("territory_scope"),
        channelScope: varchar("channel_scope"),
        contractValueEstimatedAnnual: numeric("contract_value_estimated_annual", { precision: 15, scale:  2 }),
        currency: varchar(),
        paymentFrequency: varchar("payment_frequency"),
        autoRenew: boolean("auto_renew"),
        renewalTermMonths: integer("renewal_term_months"),
        linkedContractId: varchar("linked_contract_id"),
        contractStatus: varchar("contract_status"),
}, (table) => [
        foreignKey({
                        columns: [table.contractOwnerId],
                        foreignColumns: [users.id],
                        name: "contracts_contract_owner_id_fkey"
                }),
        foreignKey({
                        columns: [table.uploadedBy],
                        foreignColumns: [users.id],
                        name: "contracts_uploaded_by_users_id_fk"
                }),
        unique("contracts_contract_number_unique").on(table.contractNumber),
]);

export const integrationConnections = pgTable("integration_connections", {
        id: varchar({ length: 255 }).default(gen_random_uuid()).primaryKey().notNull(),
        name: varchar({ length: 200 }).notNull(),
        erpSystemId: varchar("erp_system_id", { length: 255 }).notNull(),
        companyId: varchar("company_id", { length: 255 }),
        businessUnitId: varchar("business_unit_id", { length: 255 }),
        locationId: varchar("location_id", { length: 255 }),
        baseUrl: varchar("base_url", { length: 500 }).notNull(),
        authType: varchar("auth_type", { length: 50 }).notNull(),
        clientId: varchar("client_id", { length: 200 }),
        tokenUrl: varchar("token_url", { length: 500 }),
        authUrl: varchar("auth_url", { length: 500 }),
        scopes: varchar({ length: 500 }),
        apiKeyHeader: varchar("api_key_header", { length: 100 }),
        apiKeyLocation: varchar("api_key_location", { length: 20 }).default('header'),
        rateLimitRpm: integer("rate_limit_rpm").default(60),
        rateLimitConcurrent: integer("rate_limit_concurrent").default(5),
        retryMaxAttempts: integer("retry_max_attempts").default(3),
        retryBackoffMs: integer("retry_backoff_ms").default(1000),
        healthCheckEndpoint: varchar("health_check_endpoint", { length: 200 }),
        lastHealthCheckAt: timestamp("last_health_check_at", { mode: 'string' }),
        lastHealthCheckStatus: varchar("last_health_check_status", { length: 20 }),
        lastHealthCheckMessage: text("last_health_check_message"),
        status: varchar({ length: 20 }).default('active').notNull(),
        lastConnectedAt: timestamp("last_connected_at", { mode: 'string' }),
        description: text(),
        createdBy: varchar("created_by", { length: 255 }).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        basicUsername: varchar("basic_username", { length: 200 }),
        basicPassword: varchar("basic_password", { length: 500 }),
}, (table) => [
        index("integration_connections_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("integration_connections_erp_idx").using("btree", table.erpSystemId.asc().nullsLast().op("text_ops")),
        index("integration_connections_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "integration_connections_created_by_fkey"
                }),
        foreignKey({
                        columns: [table.erpSystemId],
                        foreignColumns: [erpSystems.id],
                        name: "integration_connections_erp_system_id_fkey"
                }),
]);

export const dataImportJobs = pgTable("data_import_jobs", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        mappingId: varchar("mapping_id").notNull(),
        customerId: varchar("customer_id"),
        jobName: varchar("job_name").notNull(),
        uploadMeta: jsonb("upload_meta"),
        status: varchar().default('pending').notNull(),
        recordsTotal: integer("records_total").default(0),
        recordsProcessed: integer("records_processed").default(0),
        recordsFailed: integer("records_failed").default(0),
        errorLog: jsonb("error_log"),
        createdBy: varchar("created_by").notNull(),
        startedAt: timestamp("started_at", { mode: 'string' }),
        completedAt: timestamp("completed_at", { mode: 'string' }),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        mappingVersion: integer("mapping_version"),
        companyId: varchar("company_id"),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        erpSystemId: varchar("erp_system_id"),
        entityType: varchar("entity_type"),
        jobType: varchar("job_type").default('import').notNull(),
        recordsSkipped: integer("records_skipped").default(0),
        processingLog: jsonb("processing_log"),
        connectionId: varchar("connection_id"),
        endpointTemplateId: varchar("endpoint_template_id"),
        sourceId: varchar("source_id", { length: 255 }),
}, (table) => [
        index("data_import_jobs_bu_idx").using("btree", table.businessUnitId.asc().nullsLast().op("text_ops")),
        index("data_import_jobs_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("data_import_jobs_customer_idx").using("btree", table.customerId.asc().nullsLast().op("text_ops")),
        index("data_import_jobs_erp_system_idx").using("btree", table.erpSystemId.asc().nullsLast().op("text_ops")),
        index("data_import_jobs_job_type_idx").using("btree", table.jobType.asc().nullsLast().op("text_ops")),
        index("data_import_jobs_loc_idx").using("btree", table.locationId.asc().nullsLast().op("text_ops")),
        index("data_import_jobs_mapping_idx").using("btree", table.mappingId.asc().nullsLast().op("text_ops")),
        index("data_import_jobs_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.connectionId],
                        foreignColumns: [integrationConnections.id],
                        name: "data_import_jobs_connection_id_fkey"
                }),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "data_import_jobs_created_by_fkey"
                }),
        foreignKey({
                        columns: [table.customerId],
                        foreignColumns: [contracts.id],
                        name: "data_import_jobs_customer_id_fkey"
                }),
        foreignKey({
                        columns: [table.endpointTemplateId],
                        foreignColumns: [integrationEndpointTemplates.id],
                        name: "data_import_jobs_endpoint_template_id_fkey"
                }),
        foreignKey({
                        columns: [table.erpSystemId],
                        foreignColumns: [erpSystems.id],
                        name: "data_import_jobs_erp_system_id_fkey"
                }),
        foreignKey({
                        columns: [table.mappingId],
                        foreignColumns: [masterDataMappings.id],
                        name: "data_import_jobs_mapping_id_fkey"
                }).onDelete("cascade"),
]);

export const integrationEndpointTemplates = pgTable("integration_endpoint_templates", {
        id: varchar({ length: 255 }).default(gen_random_uuid()).primaryKey().notNull(),
        erpSystemId: varchar("erp_system_id", { length: 255 }).notNull(),
        erpEntityId: varchar("erp_entity_id", { length: 255 }),
        operationType: varchar("operation_type", { length: 30 }).notNull(),
        name: varchar({ length: 200 }).notNull(),
        httpMethod: varchar("http_method", { length: 10 }).default('GET').notNull(),
        pathTemplate: varchar("path_template", { length: 500 }).notNull(),
        queryDefaults: jsonb("query_defaults"),
        paginationType: varchar("pagination_type", { length: 30 }).default('offset'),
        paginationConfig: jsonb("pagination_config"),
        requestHeaders: jsonb("request_headers"),
        requestBodyTemplate: jsonb("request_body_template"),
        responseDataPath: varchar("response_data_path", { length: 200 }),
        responseTotalPath: varchar("response_total_path", { length: 200 }),
        responseSchema: jsonb("response_schema"),
        expectedResponseTimeMs: integer("expected_response_time_ms").default(5000),
        requiresCompanyScope: boolean("requires_company_scope").default(true),
        samplePayload: jsonb("sample_payload"),
        sampleResponse: jsonb("sample_response"),
        status: varchar({ length: 20 }).default('active').notNull(),
        description: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("endpoint_templates_entity_idx").using("btree", table.erpEntityId.asc().nullsLast().op("text_ops")),
        index("endpoint_templates_erp_idx").using("btree", table.erpSystemId.asc().nullsLast().op("text_ops")),
        index("endpoint_templates_operation_idx").using("btree", table.operationType.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.erpEntityId],
                        foreignColumns: [erpEntities.id],
                        name: "integration_endpoint_templates_erp_entity_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.erpSystemId],
                        foreignColumns: [erpSystems.id],
                        name: "integration_endpoint_templates_erp_system_id_fkey"
                }).onDelete("cascade"),
]);

export const erpSystems = pgTable("erp_systems", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        name: varchar().notNull(),
        vendor: varchar().notNull(),
        version: varchar(),
        description: text(),
        category: varchar().default('enterprise'),
        status: varchar().default('active').notNull(),
        createdBy: varchar("created_by").notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("erp_systems_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        index("erp_systems_vendor_idx").using("btree", table.vendor.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "erp_systems_created_by_fkey"
                }),
]);

export const masterDataMappings = pgTable("master_data_mappings", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        mappingName: varchar("mapping_name").notNull(),
        erpSystem: varchar("erp_system").notNull(),
        entityType: varchar("entity_type").notNull(),
        sourceSchema: jsonb("source_schema").notNull(),
        targetSchema: jsonb("target_schema").notNull(),
        mappingResults: jsonb("mapping_results").notNull(),
        status: varchar().default('active').notNull(),
        aiModel: varchar("ai_model").default('llama-3.3-70b-versatile'),
        createdBy: varchar("created_by").notNull(),
        notes: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        customerId: varchar("customer_id"),
        erpSystemId: varchar("erp_system_id"),
        licenseiqEntityId: varchar("licenseiq_entity_id"),
        companyId: varchar("company_id"),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        version: integer().default(1).notNull(),
        parentMappingId: varchar("parent_mapping_id"),
        aiConfidence: real("ai_confidence"),
        approvedBy: varchar("approved_by"),
        approvedAt: timestamp("approved_at", { mode: 'string' }),
}, (table) => [
        index("master_data_mappings_bu_idx").using("btree", table.businessUnitId.asc().nullsLast().op("text_ops")),
        index("master_data_mappings_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("master_data_mappings_customer_idx").using("btree", table.customerId.asc().nullsLast().op("text_ops")),
        index("master_data_mappings_entity_idx").using("btree", table.entityType.asc().nullsLast().op("text_ops")),
        index("master_data_mappings_erp_idx").using("btree", table.erpSystem.asc().nullsLast().op("text_ops")),
        index("master_data_mappings_erp_system_id_idx").using("btree", table.erpSystemId.asc().nullsLast().op("text_ops")),
        index("master_data_mappings_loc_idx").using("btree", table.locationId.asc().nullsLast().op("text_ops")),
        index("master_data_mappings_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        index("master_data_mappings_version_idx").using("btree", table.version.asc().nullsLast().op("int4_ops")),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "master_data_mappings_created_by_fkey"
                }),
        foreignKey({
                        columns: [table.customerId],
                        foreignColumns: [contracts.id],
                        name: "master_data_mappings_customer_id_fkey"
                }),
        foreignKey({
                        columns: [table.erpSystemId],
                        foreignColumns: [erpSystems.id],
                        name: "master_data_mappings_erp_system_id_fkey"
                }),
]);

export const erpEntities = pgTable("erp_entities", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        systemId: varchar("system_id").notNull(),
        name: varchar().notNull(),
        technicalName: varchar("technical_name").notNull(),
        entityType: varchar("entity_type").notNull(),
        description: text(),
        sampleData: jsonb("sample_data"),
        status: varchar().default('active').notNull(),
        createdBy: varchar("created_by").notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("erp_entities_system_idx").using("btree", table.systemId.asc().nullsLast().op("text_ops")),
        index("erp_entities_type_idx").using("btree", table.entityType.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "erp_entities_created_by_fkey"
                }),
        foreignKey({
                        columns: [table.systemId],
                        foreignColumns: [erpSystems.id],
                        name: "erp_entities_system_id_fkey"
                }).onDelete("cascade"),
]);

export const erpEntityRecords = pgTable("erp_entity_records", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        entityId: varchar("entity_id").notNull(),
        data: jsonb().notNull(),
        companyId: varchar("company_id"),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        createdBy: varchar("created_by").notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("erp_entity_records_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("erp_entity_records_entity_idx").using("btree", table.entityId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "erp_entity_records_created_by_fkey"
                }),
        foreignKey({
                        columns: [table.entityId],
                        foreignColumns: [erpEntities.id],
                        name: "erp_entity_records_entity_id_fkey"
                }).onDelete("cascade"),
]);

export const erpFields = pgTable("erp_fields", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        entityId: varchar("entity_id").notNull(),
        fieldName: varchar("field_name").notNull(),
        dataType: varchar("data_type").notNull(),
        constraints: jsonb(),
        sampleValues: text("sample_values"),
        description: text(),
        isPrimaryKey: boolean("is_primary_key").default(false),
        isRequired: boolean("is_required").default(false),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("erp_fields_entity_idx").using("btree", table.entityId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.entityId],
                        foreignColumns: [erpEntities.id],
                        name: "erp_fields_entity_id_fkey"
                }).onDelete("cascade"),
]);

export const erpLicenseiqFieldMappings = pgTable("erp_licenseiq_field_mappings", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        erpSystemId: varchar("erp_system_id").notNull(),
        erpEntityId: varchar("erp_entity_id").notNull(),
        erpFieldId: varchar("erp_field_id").notNull(),
        licenseiqEntityId: varchar("licenseiq_entity_id").notNull(),
        licenseiqFieldId: varchar("licenseiq_field_id").notNull(),
        mappingType: varchar("mapping_type", { length: 50 }).default('direct'),
        transformExpression: text("transform_expression"),
        isActive: boolean("is_active").default(true),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("erp_liq_mapping_erp_idx").using("btree", table.erpSystemId.asc().nullsLast().op("text_ops"), table.erpFieldId.asc().nullsLast().op("text_ops")),
        index("erp_liq_mapping_liq_idx").using("btree", table.licenseiqEntityId.asc().nullsLast().op("text_ops"), table.licenseiqFieldId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.erpEntityId],
                        foreignColumns: [erpEntities.id],
                        name: "erp_licenseiq_field_mappings_erp_entity_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.erpFieldId],
                        foreignColumns: [erpFields.id],
                        name: "erp_licenseiq_field_mappings_erp_field_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.erpSystemId],
                        foreignColumns: [erpSystems.id],
                        name: "erp_licenseiq_field_mappings_erp_system_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.licenseiqEntityId],
                        foreignColumns: [licenseiqEntities.id],
                        name: "erp_licenseiq_field_mappings_licenseiq_entity_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.licenseiqFieldId],
                        foreignColumns: [licenseiqFields.id],
                        name: "erp_licenseiq_field_mappings_licenseiq_field_id_fkey"
                }).onDelete("cascade"),
]);

export const licenseiqEntities = pgTable("licenseiq_entities", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        name: varchar({ length: 100 }).notNull(),
        technicalName: varchar("technical_name", { length: 100 }).notNull(),
        description: text(),
        category: varchar({ length: 50 }),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        unique("licenseiq_entities_technical_name_key").on(table.technicalName),
]);

export const licenseiqFields = pgTable("licenseiq_fields", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        entityId: varchar("entity_id").notNull(),
        fieldName: varchar("field_name", { length: 100 }).notNull(),
        dataType: varchar("data_type", { length: 50 }).notNull(),
        description: text(),
        isRequired: boolean("is_required").default(false).notNull(),
        defaultValue: varchar("default_value"),
        validationRules: text("validation_rules"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("licenseiq_fields_entity_idx").using("btree", table.entityId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.entityId],
                        foreignColumns: [licenseiqEntities.id],
                        name: "licenseiq_fields_entity_id_fkey"
                }).onDelete("cascade"),
]);

export const erpMappingRules = pgTable("erp_mapping_rules", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        ruleSetId: varchar("rule_set_id").notNull(),
        name: varchar().notNull(),
        description: text(),
        priority: integer().default(1).notNull(),
        sourceField: varchar("source_field").notNull(),
        sourceFieldId: varchar("source_field_id"),
        targetField: varchar("target_field").notNull(),
        targetFieldId: varchar("target_field_id"),
        transformationType: varchar("transformation_type").default('direct').notNull(),
        transformationConfig: jsonb("transformation_config"),
        isActive: boolean("is_active").default(true).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("erp_mapping_rules_priority_idx").using("btree", table.priority.asc().nullsLast().op("int4_ops")),
        index("erp_mapping_rules_set_idx").using("btree", table.ruleSetId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.ruleSetId],
                        foreignColumns: [erpMappingRuleSets.id],
                        name: "erp_mapping_rules_rule_set_id_fkey"
                }).onDelete("cascade"),
]);

export const erpMappingConditions = pgTable("erp_mapping_conditions", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        ruleId: varchar("rule_id").notNull(),
        fieldName: varchar("field_name").notNull(),
        operator: varchar().notNull(),
        value: varchar(),
        valueList: jsonb("value_list"),
        logicOperator: varchar("logic_operator").default('AND').notNull(),
        orderIndex: integer("order_index").default(0).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("erp_mapping_conditions_rule_idx").using("btree", table.ruleId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.ruleId],
                        foreignColumns: [erpMappingRules.id],
                        name: "erp_mapping_conditions_rule_id_fkey"
                }).onDelete("cascade"),
]);

export const erpMappingOutputs = pgTable("erp_mapping_outputs", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        ruleId: varchar("rule_id").notNull(),
        outputField: varchar("output_field").notNull(),
        calculationType: varchar("calculation_type").notNull(),
        calculationConfig: jsonb("calculation_config"),
        roundingMode: varchar("rounding_mode").default('nearest'),
        decimalPlaces: integer("decimal_places").default(2),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("erp_mapping_outputs_rule_idx").using("btree", table.ruleId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.ruleId],
                        foreignColumns: [erpMappingRules.id],
                        name: "erp_mapping_outputs_rule_id_fkey"
                }).onDelete("cascade"),
]);

export const erpMappingRuleSets = pgTable("erp_mapping_rule_sets", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        name: varchar().notNull(),
        description: text(),
        companyId: varchar("company_id").notNull(),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        sourceSystemId: varchar("source_system_id").notNull(),
        sourceEntityId: varchar("source_entity_id"),
        targetEntityId: varchar("target_entity_id"),
        mappingId: varchar("mapping_id"),
        status: varchar().default('draft').notNull(),
        version: integer().default(1).notNull(),
        effectiveDate: timestamp("effective_date", { mode: 'string' }),
        expiryDate: timestamp("expiry_date", { mode: 'string' }),
        createdBy: varchar("created_by"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("erp_rule_sets_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("erp_rule_sets_source_idx").using("btree", table.sourceSystemId.asc().nullsLast().op("text_ops")),
        index("erp_rule_sets_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const erpRuleExecutionLog = pgTable("erp_rule_execution_log", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        ruleSetId: varchar("rule_set_id").notNull(),
        calculationId: varchar("calculation_id"),
        salesRecordId: varchar("sales_record_id"),
        inputData: jsonb("input_data"),
        outputData: jsonb("output_data"),
        rulesApplied: jsonb("rules_applied"),
        executionTimeMs: integer("execution_time_ms"),
        status: varchar().default('success').notNull(),
        errorMessage: text("error_message"),
        executedAt: timestamp("executed_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("erp_rule_exec_log_calc_idx").using("btree", table.calculationId.asc().nullsLast().op("text_ops")),
        index("erp_rule_exec_log_date_idx").using("btree", table.executedAt.asc().nullsLast().op("timestamp_ops")),
        index("erp_rule_exec_log_set_idx").using("btree", table.ruleSetId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.ruleSetId],
                        foreignColumns: [erpMappingRuleSets.id],
                        name: "erp_rule_execution_log_rule_set_id_fkey"
                }).onDelete("cascade"),
]);

export const financialAnalysis = pgTable("financial_analysis", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        totalValue: numeric("total_value", { precision: 15, scale:  2 }),
        currency: varchar().default('USD'),
        paymentSchedule: jsonb("payment_schedule"),
        royaltyStructure: jsonb("royalty_structure"),
        revenueProjections: jsonb("revenue_projections"),
        costImpact: jsonb("cost_impact"),
        currencyRisk: numeric("currency_risk", { precision: 5, scale:  2 }),
        paymentTerms: text("payment_terms"),
        penaltyClauses: jsonb("penalty_clauses"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "financial_analysis_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const humanReviewTasks = pgTable("human_review_tasks", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        extractionRunId: varchar("extraction_run_id"),
        taskType: varchar("task_type").notNull(),
        priority: varchar().default('normal'),
        status: varchar().default('pending'),
        targetId: varchar("target_id"),
        targetType: varchar("target_type"),
        originalData: jsonb("original_data").notNull(),
        suggestedCorrection: jsonb("suggested_correction"),
        confidence: numeric({ precision: 5, scale:  2 }),
        reviewNotes: text("review_notes"),
        assignedTo: varchar("assigned_to"),
        reviewedBy: varchar("reviewed_by"),
        reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("review_tasks_assigned_idx").using("btree", table.assignedTo.asc().nullsLast().op("text_ops")),
        index("review_tasks_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("review_tasks_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.assignedTo],
                        foreignColumns: [users.id],
                        name: "human_review_tasks_assigned_to_fkey"
                }),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "human_review_tasks_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.extractionRunId],
                        foreignColumns: [extractionRuns.id],
                        name: "human_review_tasks_extraction_run_id_fkey"
                }),
        foreignKey({
                        columns: [table.reviewedBy],
                        foreignColumns: [users.id],
                        name: "human_review_tasks_reviewed_by_fkey"
                }),
]);

export const importedErpRecords = pgTable("imported_erp_records", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        jobId: varchar("job_id").notNull(),
        mappingId: varchar("mapping_id").notNull(),
        customerId: varchar("customer_id"),
        sourceRecord: jsonb("source_record").notNull(),
        targetRecord: jsonb("target_record").notNull(),
        embedding: vector({ dimensions: 384 }),
        metadata: jsonb(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        mappingVersion: integer("mapping_version"),
        companyId: varchar("company_id"),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        licenseiqEntityId: varchar("licenseiq_entity_id"),
        licenseiqRecordId: varchar("licenseiq_record_id"),
        recordStatus: varchar("record_status").default('staged').notNull(),
        validationErrors: jsonb("validation_errors"),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("imported_records_bu_idx").using("btree", table.businessUnitId.asc().nullsLast().op("text_ops")),
        index("imported_records_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("imported_records_customer_idx").using("btree", table.customerId.asc().nullsLast().op("text_ops")),
        index("imported_records_embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
        index("imported_records_job_idx").using("btree", table.jobId.asc().nullsLast().op("text_ops")),
        index("imported_records_licenseiq_entity_idx").using("btree", table.licenseiqEntityId.asc().nullsLast().op("text_ops")),
        index("imported_records_loc_idx").using("btree", table.locationId.asc().nullsLast().op("text_ops")),
        index("imported_records_mapping_idx").using("btree", table.mappingId.asc().nullsLast().op("text_ops")),
        index("imported_records_status_idx").using("btree", table.recordStatus.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.customerId],
                        foreignColumns: [contracts.id],
                        name: "imported_erp_records_customer_id_fkey"
                }),
        foreignKey({
                        columns: [table.jobId],
                        foreignColumns: [dataImportJobs.id],
                        name: "imported_erp_records_job_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.mappingId],
                        foreignColumns: [masterDataMappings.id],
                        name: "imported_erp_records_mapping_id_fkey"
                }),
]);

export const integrationHealthEvents = pgTable("integration_health_events", {
        id: varchar({ length: 255 }).default(gen_random_uuid()).primaryKey().notNull(),
        connectionId: varchar("connection_id", { length: 255 }).notNull(),
        status: varchar({ length: 20 }).notNull(),
        statusCode: integer("status_code"),
        message: text(),
        latencyMs: integer("latency_ms"),
        rateLimitRemaining: integer("rate_limit_remaining"),
        rateLimitReset: timestamp("rate_limit_reset", { mode: 'string' }),
        eventType: varchar("event_type", { length: 30 }).notNull(),
        details: jsonb(),
        checkedAt: timestamp("checked_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("health_events_checked_idx").using("btree", table.checkedAt.asc().nullsLast().op("timestamp_ops")),
        index("health_events_connection_idx").using("btree", table.connectionId.asc().nullsLast().op("text_ops")),
        index("health_events_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        index("health_events_type_idx").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.connectionId],
                        foreignColumns: [integrationConnections.id],
                        name: "integration_health_events_connection_id_fkey"
                }).onDelete("cascade"),
]);

export const integrationOperations = pgTable("integration_operations", {
        id: varchar({ length: 255 }).default(gen_random_uuid()).primaryKey().notNull(),
        name: varchar({ length: 200 }).notNull(),
        connectionId: varchar("connection_id", { length: 255 }).notNull(),
        endpointTemplateId: varchar("endpoint_template_id", { length: 255 }).notNull(),
        mappingId: varchar("mapping_id", { length: 255 }),
        mappingVersion: integer("mapping_version"),
        companyId: varchar("company_id", { length: 255 }),
        businessUnitId: varchar("business_unit_id", { length: 255 }),
        locationId: varchar("location_id", { length: 255 }),
        operationMode: varchar("operation_mode", { length: 30 }).notNull(),
        schedule: varchar({ length: 100 }),
        isEnabled: boolean("is_enabled").default(true).notNull(),
        highWatermarkField: varchar("high_watermark_field", { length: 100 }),
        lastHighWatermark: varchar("last_high_watermark", { length: 200 }),
        lastCursor: varchar("last_cursor", { length: 500 }),
        dryRunAllowed: boolean("dry_run_allowed").default(true).notNull(),
        requiresApproval: boolean("requires_approval").default(false).notNull(),
        lastRunAt: timestamp("last_run_at", { mode: 'string' }),
        lastRunStatus: varchar("last_run_status", { length: 20 }),
        lastRunRecordsProcessed: integer("last_run_records_processed"),
        lastRunRecordsFailed: integer("last_run_records_failed"),
        lastRunDurationMs: integer("last_run_duration_ms"),
        lastRunError: text("last_run_error"),
        nextRunAt: timestamp("next_run_at", { mode: 'string' }),
        retryPolicy: jsonb("retry_policy"),
        description: text(),
        createdBy: varchar("created_by", { length: 255 }).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("integration_operations_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("integration_operations_connection_idx").using("btree", table.connectionId.asc().nullsLast().op("text_ops")),
        index("integration_operations_mode_idx").using("btree", table.operationMode.asc().nullsLast().op("text_ops")),
        index("integration_operations_schedule_idx").using("btree", table.isEnabled.asc().nullsLast().op("bool_ops")),
        index("integration_operations_template_idx").using("btree", table.endpointTemplateId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.connectionId],
                        foreignColumns: [integrationConnections.id],
                        name: "integration_operations_connection_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "integration_operations_created_by_fkey"
                }),
        foreignKey({
                        columns: [table.endpointTemplateId],
                        foreignColumns: [integrationEndpointTemplates.id],
                        name: "integration_operations_endpoint_template_id_fkey"
                }),
        foreignKey({
                        columns: [table.mappingId],
                        foreignColumns: [masterDataMappings.id],
                        name: "integration_operations_mapping_id_fkey"
                }),
]);

export const licenseiqApiEndpoints = pgTable("licenseiq_api_endpoints", {
        id: varchar({ length: 255 }).default(gen_random_uuid()).primaryKey().notNull(),
        entityId: varchar("entity_id", { length: 255 }).notNull(),
        operationType: varchar("operation_type", { length: 30 }).notNull(),
        name: varchar({ length: 200 }).notNull(),
        httpMethod: varchar("http_method", { length: 10 }).default('GET').notNull(),
        pathTemplate: varchar("path_template", { length: 500 }).notNull(),
        queryDefaults: jsonb("query_defaults"),
        paginationType: varchar("pagination_type", { length: 30 }).default('offset'),
        paginationConfig: jsonb("pagination_config"),
        requestBodySchema: jsonb("request_body_schema"),
        responseDataPath: varchar("response_data_path", { length: 200 }),
        responseSchema: jsonb("response_schema"),
        sampleRequest: jsonb("sample_request"),
        sampleResponse: jsonb("sample_response"),
        status: varchar({ length: 20 }).default('active').notNull(),
        description: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("licenseiq_api_entity_idx").using("btree", table.entityId.asc().nullsLast().op("text_ops")),
        index("licenseiq_api_operation_idx").using("btree", table.operationType.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.entityId],
                        foreignColumns: [licenseiqEntities.id],
                        name: "licenseiq_api_endpoints_entity_id_fkey"
                }).onDelete("cascade"),
]);

export const licenseiqEntityRecords = pgTable("licenseiq_entity_records", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        entityId: varchar("entity_id").notNull(),
        recordData: jsonb("record_data").notNull(),
        createdBy: varchar("created_by"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        grpId: varchar("grp_id").notNull(),
        orgId: varchar("org_id").notNull(),
        locId: varchar("loc_id").notNull(),
}, (table) => [
        index("licenseiq_records_entity_idx").using("btree", table.entityId.asc().nullsLast().op("text_ops")),
        index("licenseiq_records_grp_idx").using("btree", table.grpId.asc().nullsLast().op("text_ops")),
        index("licenseiq_records_loc_idx").using("btree", table.locId.asc().nullsLast().op("text_ops")),
        index("licenseiq_records_org_idx").using("btree", table.orgId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "licenseiq_entity_records_created_by_fkey"
                }),
        foreignKey({
                        columns: [table.entityId],
                        foreignColumns: [licenseiqEntities.id],
                        name: "licenseiq_entity_records_entity_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.grpId],
                        foreignColumns: [companies.companyId],
                        name: "licenseiq_entity_records_grp_id_fkey"
                }).onDelete("restrict"),
        foreignKey({
                        columns: [table.locId],
                        foreignColumns: [locations.locId],
                        name: "licenseiq_entity_records_loc_id_fkey"
                }).onDelete("restrict"),
        foreignKey({
                        columns: [table.orgId],
                        foreignColumns: [businessUnits.orgId],
                        name: "licenseiq_entity_records_org_id_fkey"
                }).onDelete("restrict"),
]);

export const locations = pgTable("locations", {
        locId: varchar("loc_id").default(gen_random_uuid()).primaryKey().notNull(),
        companyId: varchar("company_id").notNull(),
        orgId: varchar("org_id").notNull(),
        locName: varchar("loc_name", { length: 500 }).notNull(),
        locDescr: text("loc_descr"),
        address1: varchar({ length: 500 }),
        contactPerson: varchar("contact_person", { length: 300 }),
        contactEmail: varchar("contact_email", { length: 300 }),
        contactPhone: varchar("contact_phone", { length: 50 }),
        contactPreference: varchar("contact_preference", { length: 50 }),
        status: varchar({ length: 1 }).default('A').notNull(),
        createdBy: varchar("created_by").notNull(),
        creationDate: timestamp("creation_date", { mode: 'string' }).defaultNow().notNull(),
        lastUpdatedBy: varchar("last_updated_by").notNull(),
        lastUpdateDate: timestamp("last_update_date", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
        index("locations_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("locations_name_idx").using("btree", table.locName.asc().nullsLast().op("text_ops")),
        index("locations_org_idx").using("btree", table.orgId.asc().nullsLast().op("text_ops")),
        index("locations_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.companyId],
                        foreignColumns: [companies.companyId],
                        name: "locations_company_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "locations_created_by_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.lastUpdatedBy],
                        foreignColumns: [users.id],
                        name: "locations_last_updated_by_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.orgId],
                        foreignColumns: [businessUnits.orgId],
                        name: "locations_org_id_fkey"
                }).onDelete("cascade"),
]);

export const navigationCategories = pgTable("navigation_categories", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        categoryKey: varchar("category_key").notNull(),
        categoryName: varchar("category_name").notNull(),
        iconName: varchar("icon_name"),
        description: text(),
        defaultSortOrder: integer("default_sort_order").default(0),
        isCollapsible: boolean("is_collapsible").default(true),
        defaultExpanded: boolean("default_expanded").default(true),
        isActive: boolean("is_active").default(true),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("nav_cat_key_idx").using("btree", table.categoryKey.asc().nullsLast().op("text_ops")),
        index("nav_cat_sort_idx").using("btree", table.defaultSortOrder.asc().nullsLast().op("int4_ops")),
        unique("navigation_categories_category_key_key").on(table.categoryKey),
]);

export const navigationItemCategories = pgTable("navigation_item_categories", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        navItemKey: varchar("nav_item_key").notNull(),
        categoryKey: varchar("category_key").notNull(),
        sortOrder: integer("sort_order").default(0),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("nav_item_cat_cat_idx").using("btree", table.categoryKey.asc().nullsLast().op("text_ops")),
        index("nav_item_cat_item_idx").using("btree", table.navItemKey.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.categoryKey],
                        foreignColumns: [navigationCategories.categoryKey],
                        name: "navigation_item_categories_category_key_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.navItemKey],
                        foreignColumns: [navigationPermissions.itemKey],
                        name: "navigation_item_categories_nav_item_key_fkey"
                }).onDelete("cascade"),
]);

export const navigationPermissions = pgTable("navigation_permissions", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        itemKey: varchar("item_key").notNull(),
        itemName: varchar("item_name").notNull(),
        href: varchar().notNull(),
        iconName: varchar("icon_name"),
        defaultRoles: jsonb("default_roles").default([]),
        isActive: boolean("is_active").default(true),
        sortOrder: integer("sort_order").default(0),
        createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
        updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
        index("nav_perm_item_key_idx").using("btree", table.itemKey.asc().nullsLast().op("text_ops")),
        unique("navigation_permissions_item_key_key").on(table.itemKey),
]);

export const orgCalculationSettings = pgTable("org_calculation_settings", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        companyId: varchar("company_id").notNull(),
        calculationApproach: varchar("calculation_approach").default('manual').notNull(),
        defaultApproach: boolean("default_approach").default(true).notNull(),
        allowContractOverride: boolean("allow_contract_override").default(true).notNull(),
        createdBy: varchar("created_by"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("org_calc_settings_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.companyId],
                        foreignColumns: [companies.companyId],
                        name: "org_calculation_settings_company_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "org_calculation_settings_created_by_fkey"
                }),
]);

export const pendingTermMappings = pgTable("pending_term_mappings", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id"),
        extractionRunId: varchar("extraction_run_id"),
        originalTerm: varchar("original_term").notNull(),
        originalValue: text("original_value"),
        sourceText: text("source_text"),
        erpSystemId: varchar("erp_system_id"),
        erpEntityId: varchar("erp_entity_id"),
        erpFieldId: varchar("erp_field_id"),
        erpFieldName: varchar("erp_field_name"),
        erpEntityName: varchar("erp_entity_name"),
        confidence: real().default(0).notNull(),
        mappingMethod: varchar("mapping_method").default('ai').notNull(),
        alternativeMappings: jsonb("alternative_mappings"),
        status: varchar().default('pending').notNull(),
        confirmedBy: varchar("confirmed_by"),
        confirmedAt: timestamp("confirmed_at", { mode: 'string' }),
        userModifiedValue: text("user_modified_value"),
        userModifiedFieldId: varchar("user_modified_field_id"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        erpRecordId: varchar("erp_record_id"),
        erpRecordValue: varchar("erp_record_value"),
        erpRecordTable: varchar("erp_record_table"),
        companyId: varchar("company_id"),
        sourceSection: varchar("source_section"),
        sourcePage: integer("source_page"),
}, (table) => [
        index("pending_term_mappings_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("pending_term_mappings_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("pending_term_mappings_erp_idx").using("btree", table.erpSystemId.asc().nullsLast().op("text_ops")),
        index("pending_term_mappings_run_idx").using("btree", table.extractionRunId.asc().nullsLast().op("text_ops")),
        index("pending_term_mappings_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.companyId],
                        foreignColumns: [companies.companyId],
                        name: "pending_term_mappings_company_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.confirmedBy],
                        foreignColumns: [users.id],
                        name: "pending_term_mappings_confirmed_by_fkey"
                }),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "pending_term_mappings_contract_id_fkey"
                }).onDelete("set null"),
        foreignKey({
                        columns: [table.erpEntityId],
                        foreignColumns: [erpEntities.id],
                        name: "pending_term_mappings_erp_entity_id_fkey"
                }),
        foreignKey({
                        columns: [table.erpFieldId],
                        foreignColumns: [erpFields.id],
                        name: "pending_term_mappings_erp_field_id_fkey"
                }),
        foreignKey({
                        columns: [table.erpSystemId],
                        foreignColumns: [erpSystems.id],
                        name: "pending_term_mappings_erp_system_id_fkey"
                }),
]);

export const performanceMetrics = pgTable("performance_metrics", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        performanceScore: numeric("performance_score", { precision: 5, scale:  2 }),
        milestoneCompletion: numeric("milestone_completion", { precision: 5, scale:  2 }),
        onTimeDelivery: boolean("on_time_delivery").default(true),
        budgetVariance: numeric("budget_variance", { precision: 10, scale:  2 }),
        qualityScore: numeric("quality_score", { precision: 5, scale:  2 }),
        clientSatisfaction: numeric("client_satisfaction", { precision: 5, scale:  2 }),
        renewalProbability: numeric("renewal_probability", { precision: 5, scale:  2 }),
        lastReviewDate: timestamp("last_review_date", { mode: 'string' }),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "performance_metrics_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const roleNavigationPermissions = pgTable("role_navigation_permissions", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        role: varchar().notNull(),
        navItemKey: varchar("nav_item_key").notNull(),
        isEnabled: boolean("is_enabled").default(true),
        createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
        updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
        index("role_nav_perm_item_idx").using("btree", table.navItemKey.asc().nullsLast().op("text_ops")),
        index("role_nav_perm_role_idx").using("btree", table.role.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.navItemKey],
                        foreignColumns: [navigationPermissions.itemKey],
                        name: "role_navigation_permissions_nav_item_key_fkey"
                }).onDelete("cascade"),
]);

export const ruleDefinitions = pgTable("rule_definitions", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        extractionRunId: varchar("extraction_run_id"),
        linkedGraphNodeId: varchar("linked_graph_node_id"),
        ruleType: varchar("rule_type").notNull(),
        ruleName: varchar("rule_name").notNull(),
        description: text(),
        formulaDefinition: jsonb("formula_definition").notNull(),
        applicabilityFilters: jsonb("applicability_filters"),
        confidence: numeric({ precision: 5, scale:  2 }),
        validationStatus: varchar("validation_status").default('pending'),
        validationErrors: jsonb("validation_errors"),
        isActive: boolean("is_active").default(false),
        version: integer().default(1),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("rule_definitions_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("rule_definitions_status_idx").using("btree", table.validationStatus.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "rule_definitions_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.extractionRunId],
                        foreignColumns: [extractionRuns.id],
                        name: "rule_definitions_extraction_run_id_fkey"
                }),
        foreignKey({
                        columns: [table.linkedGraphNodeId],
                        foreignColumns: [contractGraphNodes.id],
                        name: "rule_definitions_linked_graph_node_id_fkey"
                }),
]);

export const ruleValidationEvents = pgTable("rule_validation_events", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        ruleDefinitionId: varchar("rule_definition_id").notNull(),
        validationType: varchar("validation_type").notNull(),
        validationResult: varchar("validation_result").notNull(),
        issues: jsonb(),
        recommendations: jsonb(),
        validatorId: varchar("validator_id"),
        validatedAt: timestamp("validated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("validation_events_rule_idx").using("btree", table.ruleDefinitionId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.ruleDefinitionId],
                        foreignColumns: [ruleDefinitions.id],
                        name: "rule_validation_events_rule_definition_id_fkey"
                }),
        foreignKey({
                        columns: [table.validatorId],
                        foreignColumns: [users.id],
                        name: "rule_validation_events_validator_id_fkey"
                }),
]);

export const salesFieldMappings = pgTable("sales_field_mappings", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id"),
        sourceFieldName: varchar("source_field_name").notNull(),
        targetFieldType: varchar("target_field_type").notNull(),
        mappingConfidence: numeric("mapping_confidence", { precision: 5, scale:  2 }),
        mappingMethod: varchar("mapping_method").default('ai_semantic'),
        sampleValues: jsonb("sample_values"),
        approvedBy: varchar("approved_by"),
        approvedAt: timestamp("approved_at", { mode: 'string' }),
        usageCount: integer("usage_count").default(0),
        lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("field_mappings_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("field_mappings_source_idx").using("btree", table.sourceFieldName.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.approvedBy],
                        foreignColumns: [users.id],
                        name: "sales_field_mappings_approved_by_fkey"
                }),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "sales_field_mappings_contract_id_contracts_id_fk"
                }).onDelete("set null"),
]);

export const semanticIndexEntries = pgTable("semantic_index_entries", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        indexType: varchar("index_type").notNull(),
        sourceId: varchar("source_id"),
        content: text().notNull(),
        embedding: vector({ dimensions: 384 }),
        metadata: jsonb(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("semantic_index_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("semantic_index_type_idx").using("btree", table.indexType.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "semantic_index_entries_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const strategicAnalysis = pgTable("strategic_analysis", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        strategicValue: numeric("strategic_value", { precision: 5, scale:  2 }),
        marketAlignment: numeric("market_alignment", { precision: 5, scale:  2 }),
        competitiveAdvantage: jsonb("competitive_advantage"),
        riskConcentration: numeric("risk_concentration", { precision: 5, scale:  2 }),
        standardizationScore: numeric("standardization_score", { precision: 5, scale:  2 }),
        negotiationInsights: jsonb("negotiation_insights"),
        benchmarkComparison: jsonb("benchmark_comparison"),
        recommendations: jsonb(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "strategic_analysis_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const userOrganizationRoles = pgTable("user_organization_roles", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        userId: varchar("user_id").notNull(),
        companyId: varchar("company_id").notNull(),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        role: varchar().default('viewer').notNull(),
        status: varchar({ length: 1 }).default('A').notNull(),
        createdBy: varchar("created_by").notNull(),
        creationDate: timestamp("creation_date", { mode: 'string' }).defaultNow().notNull(),
        lastUpdatedBy: varchar("last_updated_by").notNull(),
        lastUpdateDate: timestamp("last_update_date", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
        index("user_org_roles_bu_idx").using("btree", table.businessUnitId.asc().nullsLast().op("text_ops")),
        index("user_org_roles_company_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops")),
        index("user_org_roles_location_idx").using("btree", table.locationId.asc().nullsLast().op("text_ops")),
        index("user_org_roles_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        index("user_org_roles_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.businessUnitId],
                        foreignColumns: [businessUnits.orgId],
                        name: "user_organization_roles_business_unit_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.companyId],
                        foreignColumns: [companies.companyId],
                        name: "user_organization_roles_company_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.createdBy],
                        foreignColumns: [users.id],
                        name: "user_organization_roles_created_by_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.lastUpdatedBy],
                        foreignColumns: [users.id],
                        name: "user_organization_roles_last_updated_by_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.locationId],
                        foreignColumns: [locations.locId],
                        name: "user_organization_roles_location_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.userId],
                        foreignColumns: [users.id],
                        name: "user_organization_roles_user_id_fkey"
                }).onDelete("cascade"),
        unique("user_org_unique").on(table.userId, table.companyId, table.businessUnitId, table.locationId),
]);

export const userActiveContext = pgTable("user_active_context", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        userId: varchar("user_id").notNull(),
        activeOrgRoleId: varchar("active_org_role_id").notNull(),
        lastSwitched: timestamp("last_switched", { mode: 'string' }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
        index("user_active_ctx_role_idx").using("btree", table.activeOrgRoleId.asc().nullsLast().op("text_ops")),
        index("user_active_ctx_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.activeOrgRoleId],
                        foreignColumns: [userOrganizationRoles.id],
                        name: "user_active_context_active_org_role_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.userId],
                        foreignColumns: [users.id],
                        name: "user_active_context_user_id_fkey"
                }).onDelete("cascade"),
        unique("user_active_context_user_id_key").on(table.userId),
]);

export const userCategoryPreferences = pgTable("user_category_preferences", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        userId: varchar("user_id").notNull(),
        navItemKey: varchar("nav_item_key").notNull(),
        categoryKey: varchar("category_key").notNull(),
        sortOrder: integer("sort_order").default(0),
        isVisible: boolean("is_visible").default(true),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("user_cat_pref_item_idx").using("btree", table.navItemKey.asc().nullsLast().op("text_ops")),
        index("user_cat_pref_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.categoryKey],
                        foreignColumns: [navigationCategories.categoryKey],
                        name: "user_category_preferences_category_key_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.navItemKey],
                        foreignColumns: [navigationPermissions.itemKey],
                        name: "user_category_preferences_nav_item_key_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.userId],
                        foreignColumns: [users.id],
                        name: "user_category_preferences_user_id_fkey"
                }).onDelete("cascade"),
]);

export const userCategoryState = pgTable("user_category_state", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        userId: varchar("user_id").notNull(),
        categoryKey: varchar("category_key").notNull(),
        isExpanded: boolean("is_expanded").default(true),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("user_cat_state_cat_idx").using("btree", table.categoryKey.asc().nullsLast().op("text_ops")),
        index("user_cat_state_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.categoryKey],
                        foreignColumns: [navigationCategories.categoryKey],
                        name: "user_category_state_category_key_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.userId],
                        foreignColumns: [users.id],
                        name: "user_category_state_user_id_fkey"
                }).onDelete("cascade"),
]);

export const userNavigationOverrides = pgTable("user_navigation_overrides", {
        id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
        userId: varchar("user_id").notNull(),
        navItemKey: varchar("nav_item_key").notNull(),
        isEnabled: boolean("is_enabled").default(true),
        createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
        updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
        index("user_nav_override_item_idx").using("btree", table.navItemKey.asc().nullsLast().op("text_ops")),
        index("user_nav_override_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.navItemKey],
                        foreignColumns: [navigationPermissions.itemKey],
                        name: "user_navigation_overrides_nav_item_key_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.userId],
                        foreignColumns: [users.id],
                        name: "user_navigation_overrides_user_id_fkey"
                }).onDelete("cascade"),
]);

export const extractionRuns = pgTable("extraction_runs", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        runType: varchar("run_type").notNull(),
        status: varchar().default('processing').notNull(),
        overallConfidence: numeric("overall_confidence", { precision: 5, scale:  2 }),
        nodesExtracted: integer("nodes_extracted"),
        edgesExtracted: integer("edges_extracted"),
        rulesExtracted: integer("rules_extracted"),
        validationResults: jsonb("validation_results"),
        aiModel: varchar("ai_model").default('llama-3.1-8b'),
        processingTime: integer("processing_time"),
        errorLog: text("error_log"),
        triggeredBy: varchar("triggered_by"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        completedAt: timestamp("completed_at", { mode: 'string' }),
        currentStage: varchar("current_stage"),
        stageAStatus: varchar("stage_a_status").default('pending'),
        stageBStatus: varchar("stage_b_status").default('pending'),
        stageCStatus: varchar("stage_c_status").default('pending'),
        pipelineMode: varchar("pipeline_mode").default('legacy'),
}, (table) => [
        index("extraction_runs_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("extraction_runs_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "extraction_runs_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.triggeredBy],
                        foreignColumns: [users.id],
                        name: "extraction_runs_triggered_by_fkey"
                }),
]);

export const contractCalculations = pgTable("contract_calculations", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        name: varchar().notNull(),
        periodStart: timestamp("period_start", { mode: 'string' }),
        periodEnd: timestamp("period_end", { mode: 'string' }),
        status: varchar().default('pending_approval'),
        totalSalesAmount: numeric("total_sales_amount", { precision: 15, scale:  2 }),
        totalRoyalty: numeric("total_royalty", { precision: 15, scale:  2 }),
        currency: varchar().default('USD'),
        salesCount: integer("sales_count"),
        breakdown: jsonb(),
        chartData: jsonb("chart_data"),
        calculatedBy: varchar("calculated_by"),
        approvedBy: varchar("approved_by"),
        approvedAt: timestamp("approved_at", { mode: 'string' }),
        rejectedBy: varchar("rejected_by"),
        rejectedAt: timestamp("rejected_at", { mode: 'string' }),
        rejectionReason: text("rejection_reason"),
        comments: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        companyId: varchar("company_id"),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
}, (table) => [
        foreignKey({
                        columns: [table.approvedBy],
                        foreignColumns: [users.id],
                        name: "contract_royalty_calculations_approved_by_fkey"
                }),
        foreignKey({
                        columns: [table.calculatedBy],
                        foreignColumns: [users.id],
                        name: "contract_royalty_calculations_calculated_by_fkey"
                }),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "contract_royalty_calculations_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.rejectedBy],
                        foreignColumns: [users.id],
                        name: "contract_royalty_calculations_rejected_by_fkey"
                }),
]);

export const contractTerms = pgTable("contract_terms", {
        termId: varchar("term_id").primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        termSequence: integer("term_sequence"),
        termName: varchar("term_name"),
        termType: varchar("term_type"),
        calculationBasis: varchar("calculation_basis"),
        rateType: varchar("rate_type"),
        rateValue: numeric("rate_value", { precision: 15, scale:  6 }),
        tierMin: numeric("tier_min", { precision: 15, scale:  2 }),
        tierMax: numeric("tier_max", { precision: 15, scale:  2 }),
        tierUom: varchar("tier_uom"),
        appliesToProductCategory: varchar("applies_to_product_category"),
        appliesToProductFamily: varchar("applies_to_product_family"),
        appliesToProductIds: text("applies_to_product_ids"),
        excludedProductIds: text("excluded_product_ids"),
        appliesToTerritory: varchar("applies_to_territory"),
        appliesToChannel: varchar("applies_to_channel"),
        paymentTiming: varchar("payment_timing"),
        paymentMethod: varchar("payment_method"),
        requiresClaim: boolean("requires_claim"),
        claimDeadlineDays: integer("claim_deadline_days"),
        requiresProofOfPerformance: boolean("requires_proof_of_performance"),
        effectiveDate: timestamp("effective_date", { mode: 'string' }),
        expirationDate: timestamp("expiration_date", { mode: 'string' }),
        notes: text(),
        linkedRuleId: varchar("linked_rule_id"),
}, (table) => [
        index("contract_terms_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
]);

export const contractQualifiers = pgTable("contract_qualifiers", {
        qualifierId: varchar("qualifier_id").primaryKey().notNull(),
        termId: varchar("term_id").notNull(),
        qualifierType: varchar("qualifier_type"),
        qualifierField: varchar("qualifier_field"),
        operator: varchar(),
        qualifierValue: varchar("qualifier_value"),
        qualifierValueNumeric: numeric("qualifier_value_numeric", { precision: 15, scale:  2 }),
        qualifierLogic: varchar("qualifier_logic"),
        effectiveDate: timestamp("effective_date", { mode: 'string' }),
        expirationDate: timestamp("expiration_date", { mode: 'string' }),
        notes: text(),
}, (table) => [
        index("contract_qualifiers_term_idx").using("btree", table.termId.asc().nullsLast().op("text_ops")),
]);

export const contractPartnerAssignments = pgTable("contract_partner_assignments", {
        assignmentId: varchar("assignment_id").primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        partnerId: varchar("partner_id"),
        assignmentType: varchar("assignment_type"),
        effectiveDate: timestamp("effective_date", { mode: 'string' }),
        expirationDate: timestamp("expiration_date", { mode: 'string' }),
        status: varchar(),
        customTerms: boolean("custom_terms"),
        notes: text(),
}, (table) => [
        index("contract_partner_assignments_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
]);

export const contractRules = pgTable("contract_rules", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        ruleType: varchar("rule_type").notNull(),
        ruleName: varchar("rule_name").notNull(),
        description: text(),
        productCategories: text("product_categories").array(),
        territories: text().array(),
        seasonalAdjustments: jsonb("seasonal_adjustments"),
        territoryPremiums: jsonb("territory_premiums"),
        volumeTiers: jsonb("volume_tiers"),
        baseRate: numeric("base_rate", { precision: 15, scale:  2 }),
        minimumGuarantee: numeric("minimum_guarantee", { precision: 15, scale:  2 }),
        calculationFormula: text("calculation_formula"),
        priority: integer().default(10),
        isActive: boolean("is_active").default(true),
        confidence: numeric({ precision: 5, scale:  2 }),
        sourceSection: varchar("source_section"),
        sourceText: text("source_text"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        formulaDefinition: jsonb("formula_definition"),
        formulaVersion: varchar("formula_version").default('1.0'),
        reviewStatus: varchar("review_status").default('pending'),
        reviewedBy: varchar("reviewed_by"),
        reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
        sourcePage: integer("source_page"),
        validationStatus: varchar("validation_status").default('pending'),
        validatedConfidence: numeric("validated_confidence", { precision: 5, scale:  2 }),
        validationDetails: jsonb("validation_details"),
        fieldMappings: jsonb("field_mappings"),
        extractionOrder: integer("extraction_order"),
        clauseCategory: varchar("clause_category").default('general'),
        customerSegments: text("customer_segments").array(),
        channel: varchar(),
        exceptions: jsonb(),
        ruleVersionNum: integer("rule_version_num").default(1),
        previousVersionData: jsonb("previous_version_data"),
        specificityScore: integer("specificity_score").default(0),
        effectiveDate: timestamp("effective_date", { mode: 'string' }),
        expiryDate: timestamp("expiry_date", { mode: 'string' }),
        minimumPrice: numeric("minimum_price", { precision: 15, scale:  2 }),
        templateCode: varchar("template_code"),
        executionGroup: varchar("execution_group"),
        baseMetric: varchar("base_metric"),
        tierBasis: varchar("tier_basis").default("auto"),
        fieldConfidence: jsonb("field_confidence"),
        reviewFlags: jsonb("review_flags"),
        partnerIds: text("partner_ids").array(),
}, (table) => [
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "royalty_rules_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const flowTypes = pgTable("flow_types", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        code: varchar().notNull(),
        name: varchar().notNull(),
        description: text(),
        isActive: boolean("is_active").default(true).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        unique("pipeline_flow_types_code_key").on(table.code),
]);

export const salesData = pgTable("sales_data", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        matchedContractId: varchar("matched_contract_id"),
        matchConfidence: numeric("match_confidence", { precision: 5, scale:  2 }),
        transactionDate: timestamp("transaction_date", { mode: 'string' }).notNull(),
        transactionId: varchar("transaction_id"),
        productCode: varchar("product_code"),
        productName: varchar("product_name"),
        category: varchar(),
        territory: varchar(),
        currency: varchar().default('USD'),
        grossAmount: numeric("gross_amount", { precision: 15, scale:  2 }).notNull(),
        netAmount: numeric("net_amount", { precision: 15, scale:  2 }),
        quantity: numeric({ precision: 12, scale:  4 }),
        unitPrice: numeric("unit_price", { precision: 15, scale:  2 }),
        customFields: jsonb("custom_fields"),
        importJobId: varchar("import_job_id"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        companyId: varchar("company_id"),
        businessUnitId: varchar("business_unit_id"),
        locationId: varchar("location_id"),
        channel: varchar(),
        customerCode: varchar("customer_code"),
}, (table) => [
        foreignKey({
                        columns: [table.matchedContractId],
                        foreignColumns: [contracts.id],
                        name: "sales_data_matched_contract_id_contracts_id_fk"
                }).onDelete("set null"),
]);

export const rebatePrograms = pgTable("rebate_programs", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id"),
        companyId: varchar("company_id"),
        name: varchar().notNull(),
        description: text(),
        programType: varchar("program_type").default('volume'),
        status: varchar().default('draft'),
        startDate: timestamp("start_date", { mode: 'string' }),
        endDate: timestamp("end_date", { mode: 'string' }),
        qualificationCriteria: jsonb("qualification_criteria"),
        tiers: jsonb(),
        retroactive: boolean().default(false),
        calculationFrequency: varchar("calculation_frequency").default('quarterly'),
        totalAccrued: numeric("total_accrued", { precision: 15, scale:  2 }).default('0'),
        totalPaid: numeric("total_paid", { precision: 15, scale:  2 }).default('0'),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "rebate_programs_contract_id_fkey"
                }).onDelete("cascade"),
]);

export const ruleDecisionLogs = pgTable("rule_decision_logs", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        ruleId: varchar("rule_id"),
        contractId: varchar("contract_id"),
        transactionId: varchar("transaction_id"),
        inputSnapshot: jsonb("input_snapshot"),
        outputDecision: jsonb("output_decision"),
        conditionMatched: text("condition_matched"),
        alternativesConsidered: jsonb("alternatives_considered"),
        confidenceScore: numeric("confidence_score", { precision: 5, scale:  2 }),
        specificityScore: integer("specificity_score"),
        calculationSteps: jsonb("calculation_steps"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "rule_decision_logs_contract_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.ruleId],
                        foreignColumns: [contractRules.id],
                        name: "rule_decision_logs_rule_id_fkey"
                }).onDelete("set null"),
]);

export const clauseExecutionGroups = pgTable("clause_execution_groups", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        code: varchar().notNull(),
        name: varchar().notNull(),
        description: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        unique("clause_execution_groups_code_key").on(table.code),
]);

export const ruleTemplates = pgTable("rule_templates", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        templateCode: varchar("template_code").notNull(),
        name: varchar().notNull(),
        executionGroupCode: varchar("execution_group_code").notNull(),
        description: text(),
        requiredFields: jsonb("required_fields"),
        isActive: boolean("is_active").default(true).notNull(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        unique("rule_templates_template_code_key").on(table.templateCode),
]);

export const contractAnalysis = pgTable("contract_analysis", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        summary: text(),
        keyTerms: jsonb("key_terms"),
        riskAnalysis: jsonb("risk_analysis"),
        insights: jsonb(),
        confidence: numeric({ precision: 5, scale:  2 }),
        processingTime: integer("processing_time"),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        headerReviewFlags: jsonb("header_review_flags"),
}, (table) => [
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "contract_analysis_contract_id_contracts_id_fk"
                }).onDelete("cascade"),
]);

export const ruleConflicts = pgTable("rule_conflicts", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        extractionRunId: varchar("extraction_run_id"),
        conflictIdentifier: varchar("conflict_identifier"),
        ruleIds: jsonb("rule_ids"),
        reason: text(),
        resolution: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        status: varchar().default('open'),
        resolvedAt: timestamp("resolved_at", { mode: 'string' }),
}, (table) => [
        index("rule_conflicts_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("rule_conflicts_extraction_idx").using("btree", table.extractionRunId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "rule_conflicts_contract_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.extractionRunId],
                        foreignColumns: [extractionRuns.id],
                        name: "rule_conflicts_extraction_run_id_fkey"
                }).onDelete("set null"),
]);

export const baseMetrics = pgTable("base_metrics", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        code: varchar().notNull(),
        name: varchar().notNull(),
        description: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        salesColumn: varchar("sales_column"),
}, (table) => [
        unique("pipeline_base_metrics_code_key").on(table.code),
]);

export const contractClauses = pgTable("contract_clauses", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        contractId: varchar("contract_id").notNull(),
        extractionRunId: varchar("extraction_run_id"),
        clauseIdentifier: varchar("clause_identifier"),
        sectionRef: varchar("section_ref"),
        text: text().notNull(),
        clauseCategoryCode: varchar("clause_category_code"),
        flowTypeCode: varchar("flow_type_code"),
        affectsAccrual: boolean("affects_accrual").default(false).notNull(),
        confidence: real(),
        evidence: jsonb(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        index("contract_clauses_category_idx").using("btree", table.clauseCategoryCode.asc().nullsLast().op("text_ops")),
        index("contract_clauses_contract_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
        index("contract_clauses_extraction_idx").using("btree", table.extractionRunId.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.contractId],
                        foreignColumns: [contracts.id],
                        name: "contract_clauses_contract_id_fkey"
                }).onDelete("cascade"),
        foreignKey({
                        columns: [table.extractionRunId],
                        foreignColumns: [extractionRuns.id],
                        name: "contract_clauses_extraction_run_id_fkey"
                }).onDelete("set null"),
]);

export const extractionStageResults = pgTable("extraction_stage_results", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        extractionRunId: varchar("extraction_run_id").notNull(),
        stage: varchar().notNull(),
        status: varchar().default('pending').notNull(),
        rawOutput: jsonb("raw_output"),
        errorMessage: text("error_message"),
        startedAt: timestamp("started_at", { mode: 'string' }),
        completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
        index("extraction_stage_results_run_idx").using("btree", table.extractionRunId.asc().nullsLast().op("text_ops")),
        index("extraction_stage_results_stage_idx").using("btree", table.stage.asc().nullsLast().op("text_ops")),
        foreignKey({
                        columns: [table.extractionRunId],
                        foreignColumns: [extractionRuns.id],
                        name: "extraction_stage_results_extraction_run_id_fkey"
                }).onDelete("cascade"),
]);

export const clauseCategories = pgTable("clause_categories", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        code: varchar().notNull(),
        name: varchar().notNull(),
        description: text(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        unique("pipeline_clause_categories_code_key").on(table.code),
]);

export const subflows = pgTable("subflows", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        code: varchar().notNull(),
        name: varchar().notNull(),
        description: text(),
        icon: varchar(),
        color: varchar(),
        isActive: boolean("is_active").default(true).notNull(),
        sortOrder: integer("sort_order").default(0),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
        unique("subflows_code_key").on(table.code),
]);

export const customerSegments = pgTable("customer_segments", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        segmentName: varchar("segment_name").notNull(),
        segmentCode: varchar("segment_code").notNull(),
        description: text(),
        companyId: varchar("company_id"),
        isActive: boolean("is_active").default(true),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const customers = pgTable("customers", {
        id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
        companyId: varchar("company_id"),
        name: varchar().notNull(),
        code: varchar(),
        segment: varchar(),
        channel: varchar(),
        territory: varchar(),
        contactEmail: varchar("contact_email"),
        isActive: boolean("is_active").default(true),
        metadata: jsonb(),
        createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
        segmentId: varchar("segment_id"),
}, (table) => [
        foreignKey({
                        columns: [table.segmentId],
                        foreignColumns: [customerSegments.id],
                        name: "customers_segment_id_fkey"
                }),
]);
