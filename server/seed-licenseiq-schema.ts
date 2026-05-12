import { db } from './db';
import { licenseiqEntities, licenseiqFields, type InsertLicenseiqEntity, type InsertLicenseiqField } from '@shared/schema';
import { eq } from 'drizzle-orm';

const standardFieldDefinitions: Record<string, Array<{fieldName: string; dataType: string; isRequired: boolean; description?: string}>> = {
  companies: [
    { fieldName: 'id', dataType: 'text', isRequired: true, description: 'Unique company identifier (UUID)' },
    { fieldName: 'code', dataType: 'text', isRequired: true, description: 'Company code (unique)' },
    { fieldName: 'name', dataType: 'text', isRequired: true, description: 'Company name' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Company description' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'Status: A(Active), I(Inactive), D(Deleted)' },
    { fieldName: 'createdBy', dataType: 'text', isRequired: true, description: 'User ID who created this record' },
    { fieldName: 'creationDate', dataType: 'date', isRequired: true, description: 'Record creation timestamp' },
    { fieldName: 'lastUpdatedBy', dataType: 'text', isRequired: false, description: 'User ID who last updated this record' },
    { fieldName: 'lastUpdateDate', dataType: 'date', isRequired: false, description: 'Last update timestamp' },
  ],
  business_units: [
    { fieldName: 'id', dataType: 'text', isRequired: true, description: 'Unique business unit identifier (UUID)' },
    { fieldName: 'companyId', dataType: 'text', isRequired: true, description: 'Parent company ID (foreign key)' },
    { fieldName: 'code', dataType: 'text', isRequired: true, description: 'Business unit code (unique)' },
    { fieldName: 'name', dataType: 'text', isRequired: true, description: 'Business unit name' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Business unit description' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'Status: A(Active), I(Inactive), D(Deleted)' },
    { fieldName: 'createdBy', dataType: 'text', isRequired: true, description: 'User ID who created this record' },
    { fieldName: 'creationDate', dataType: 'date', isRequired: true, description: 'Record creation timestamp' },
    { fieldName: 'lastUpdatedBy', dataType: 'text', isRequired: false, description: 'User ID who last updated this record' },
    { fieldName: 'lastUpdateDate', dataType: 'date', isRequired: false, description: 'Last update timestamp' },
  ],
  locations: [
    { fieldName: 'id', dataType: 'text', isRequired: true, description: 'Unique location identifier (UUID)' },
    { fieldName: 'businessUnitId', dataType: 'text', isRequired: true, description: 'Parent business unit ID (foreign key)' },
    { fieldName: 'code', dataType: 'text', isRequired: true, description: 'Location code (unique)' },
    { fieldName: 'name', dataType: 'text', isRequired: true, description: 'Location name' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Location description' },
    { fieldName: 'address', dataType: 'text', isRequired: false, description: 'Physical address' },
    { fieldName: 'city', dataType: 'text', isRequired: false, description: 'City' },
    { fieldName: 'state', dataType: 'text', isRequired: false, description: 'State/Province' },
    { fieldName: 'country', dataType: 'text', isRequired: false, description: 'Country' },
    { fieldName: 'postalCode', dataType: 'text', isRequired: false, description: 'Postal/ZIP code' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'Status: A(Active), I(Inactive), D(Deleted)' },
    { fieldName: 'createdBy', dataType: 'text', isRequired: true, description: 'User ID who created this record' },
    { fieldName: 'creationDate', dataType: 'date', isRequired: true, description: 'Record creation timestamp' },
    { fieldName: 'lastUpdatedBy', dataType: 'text', isRequired: false, description: 'User ID who last updated this record' },
    { fieldName: 'lastUpdateDate', dataType: 'date', isRequired: false, description: 'Last update timestamp' },
  ],
  customers_parties: [
    { fieldName: 'customerCode', dataType: 'text', isRequired: true, description: 'Unique customer code' },
    { fieldName: 'customerName', dataType: 'text', isRequired: true, description: 'Customer full name' },
    { fieldName: 'email', dataType: 'text', isRequired: false, description: 'Customer email address' },
    { fieldName: 'phone', dataType: 'text', isRequired: false, description: 'Contact phone number' },
    { fieldName: 'category', dataType: 'text', isRequired: false, description: 'Customer category' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  item_category: [
    { fieldName: 'categoryCode', dataType: 'text', isRequired: true, description: 'Category code' },
    { fieldName: 'categoryName', dataType: 'text', isRequired: true, description: 'Category name' },
    { fieldName: 'parentCategory', dataType: 'text', isRequired: false, description: 'Parent category code' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  item_class: [
    { fieldName: 'classCode', dataType: 'text', isRequired: true, description: 'Class code' },
    { fieldName: 'className', dataType: 'text', isRequired: true, description: 'Class name' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Class description' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  item_catalog: [
    { fieldName: 'catalogCode', dataType: 'text', isRequired: true, description: 'Catalog code' },
    { fieldName: 'catalogName', dataType: 'text', isRequired: true, description: 'Catalog name' },
    { fieldName: 'effectiveDate', dataType: 'date', isRequired: false, description: 'Effective from date' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  item_structures: [
    { fieldName: 'structureCode', dataType: 'text', isRequired: true, description: 'Structure code' },
    { fieldName: 'parentItem', dataType: 'text', isRequired: true, description: 'Parent item code' },
    { fieldName: 'childItem', dataType: 'text', isRequired: true, description: 'Child item code' },
    { fieldName: 'quantity', dataType: 'number', isRequired: true, description: 'Component quantity' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  customer_sites: [
    { fieldName: 'siteCode', dataType: 'text', isRequired: true, description: 'Site code' },
    { fieldName: 'customerCode', dataType: 'text', isRequired: true, description: 'Customer code' },
    { fieldName: 'siteName', dataType: 'text', isRequired: true, description: 'Site name' },
    { fieldName: 'address', dataType: 'text', isRequired: false, description: 'Site address' },
    { fieldName: 'city', dataType: 'text', isRequired: false, description: 'City' },
    { fieldName: 'country', dataType: 'text', isRequired: false, description: 'Country' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  customer_site_uses: [
    { fieldName: 'siteUseCode', dataType: 'text', isRequired: true, description: 'Site use code' },
    { fieldName: 'siteCode', dataType: 'text', isRequired: true, description: 'Site code' },
    { fieldName: 'useType', dataType: 'text', isRequired: true, description: 'Use type (Bill-To, Ship-To)' },
    { fieldName: 'isPrimary', dataType: 'boolean', isRequired: false, description: 'Primary site flag' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  suppliers_vendors: [
    { fieldName: 'supplierCode', dataType: 'text', isRequired: true, description: 'Supplier code' },
    { fieldName: 'supplierName', dataType: 'text', isRequired: true, description: 'Supplier name' },
    { fieldName: 'email', dataType: 'text', isRequired: false, description: 'Contact email' },
    { fieldName: 'phone', dataType: 'text', isRequired: false, description: 'Contact phone' },
    { fieldName: 'category', dataType: 'text', isRequired: false, description: 'Supplier category' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  supplier_sites: [
    { fieldName: 'siteCode', dataType: 'text', isRequired: true, description: 'Site code' },
    { fieldName: 'supplierCode', dataType: 'text', isRequired: true, description: 'Supplier code' },
    { fieldName: 'siteName', dataType: 'text', isRequired: true, description: 'Site name' },
    { fieldName: 'address', dataType: 'text', isRequired: false, description: 'Site address' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  payment_terms: [
    { fieldName: 'code', dataType: 'text', isRequired: true, description: 'Terms code' },
    { fieldName: 'name', dataType: 'text', isRequired: true, description: 'Terms name' },
    { fieldName: 'dueDays', dataType: 'number', isRequired: true, description: 'Due in days' },
    { fieldName: 'discountPercent', dataType: 'number', isRequired: false, description: 'Discount percentage' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  organizations: [
    { fieldName: 'orgCode', dataType: 'text', isRequired: true, description: 'Organization code' },
    { fieldName: 'orgName', dataType: 'text', isRequired: true, description: 'Organization name' },
    { fieldName: 'parentOrg', dataType: 'text', isRequired: false, description: 'Parent organization code' },
    { fieldName: 'level', dataType: 'number', isRequired: false, description: 'Hierarchy level' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  chart_of_accounts: [
    { fieldName: 'accountCode', dataType: 'text', isRequired: true, description: 'GL account code' },
    { fieldName: 'accountName', dataType: 'text', isRequired: true, description: 'Account name' },
    { fieldName: 'accountType', dataType: 'text', isRequired: true, description: 'Account type (Asset/Liability/Revenue/Expense)' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  sales_reps: [
    { fieldName: 'repCode', dataType: 'text', isRequired: true, description: 'Sales rep code' },
    { fieldName: 'repName', dataType: 'text', isRequired: true, description: 'Sales rep name' },
    { fieldName: 'email', dataType: 'text', isRequired: false, description: 'Email address' },
    { fieldName: 'territory', dataType: 'text', isRequired: false, description: 'Sales territory' },
    { fieldName: 'isActive', dataType: 'boolean', isRequired: true, description: 'Active status' },
  ],
  employee_master: [
    { fieldName: 'empCode', dataType: 'text', isRequired: true, description: 'Employee code' },
    { fieldName: 'empName', dataType: 'text', isRequired: true, description: 'Employee name' },
    { fieldName: 'department', dataType: 'text', isRequired: false, description: 'Department' },
    { fieldName: 'position', dataType: 'text', isRequired: false, description: 'Job position' },
    { fieldName: 'hireDate', dataType: 'date', isRequired: false, description: 'Hire date' },
  ],
  sales_orders: [
    { fieldName: 'orderNumber', dataType: 'text', isRequired: true, description: 'Sales order number' },
    { fieldName: 'customerCode', dataType: 'text', isRequired: true, description: 'Customer code' },
    { fieldName: 'orderDate', dataType: 'date', isRequired: true, description: 'Order date' },
    { fieldName: 'totalAmount', dataType: 'number', isRequired: true, description: 'Order total amount' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'Order status' },
    { fieldName: 'salesRep', dataType: 'text', isRequired: false, description: 'Sales rep code' },
  ],
  sales_order_lines: [
    { fieldName: 'lineNumber', dataType: 'number', isRequired: true, description: 'Line number' },
    { fieldName: 'orderNumber', dataType: 'text', isRequired: true, description: 'Sales order number' },
    { fieldName: 'itemCode', dataType: 'text', isRequired: true, description: 'Item code' },
    { fieldName: 'quantity', dataType: 'number', isRequired: true, description: 'Ordered quantity' },
    { fieldName: 'unitPrice', dataType: 'number', isRequired: true, description: 'Unit price' },
    { fieldName: 'lineTotal', dataType: 'number', isRequired: true, description: 'Line total' },
  ],
  ar_invoices: [
    { fieldName: 'invoiceNumber', dataType: 'text', isRequired: true, description: 'Invoice number' },
    { fieldName: 'customerCode', dataType: 'text', isRequired: true, description: 'Customer code' },
    { fieldName: 'invoiceDate', dataType: 'date', isRequired: true, description: 'Invoice date' },
    { fieldName: 'amount', dataType: 'number', isRequired: true, description: 'Invoice amount' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'Invoice status' },
    { fieldName: 'dueDate', dataType: 'date', isRequired: false, description: 'Payment due date' },
  ],
  ar_invoice_lines: [
    { fieldName: 'lineNumber', dataType: 'number', isRequired: true, description: 'Line number' },
    { fieldName: 'invoiceNumber', dataType: 'text', isRequired: true, description: 'Invoice number' },
    { fieldName: 'description', dataType: 'text', isRequired: true, description: 'Line description' },
    { fieldName: 'amount', dataType: 'number', isRequired: true, description: 'Line amount' },
    { fieldName: 'quantity', dataType: 'number', isRequired: true, description: 'Quantity' },
  ],
  ap_invoices: [
    { fieldName: 'invoiceNumber', dataType: 'text', isRequired: true, description: 'AP invoice number' },
    { fieldName: 'supplierCode', dataType: 'text', isRequired: true, description: 'Supplier code' },
    { fieldName: 'invoiceDate', dataType: 'date', isRequired: true, description: 'Invoice date' },
    { fieldName: 'amount', dataType: 'number', isRequired: true, description: 'Invoice amount' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'Status' },
    { fieldName: 'dueDate', dataType: 'date', isRequired: false, description: 'Payment due date' },
  ],
  ap_invoice_lines: [
    { fieldName: 'lineNumber', dataType: 'number', isRequired: true, description: 'Line number' },
    { fieldName: 'invoiceNumber', dataType: 'text', isRequired: true, description: 'AP invoice number' },
    { fieldName: 'description', dataType: 'text', isRequired: true, description: 'Line description' },
    { fieldName: 'amount', dataType: 'number', isRequired: true, description: 'Line amount' },
    { fieldName: 'quantity', dataType: 'number', isRequired: true, description: 'Quantity' },
  ],
  ap_invoice_payments: [
    { fieldName: 'paymentNumber', dataType: 'text', isRequired: true, description: 'Payment number' },
    { fieldName: 'invoiceNumber', dataType: 'text', isRequired: true, description: 'AP invoice number' },
    { fieldName: 'paymentDate', dataType: 'date', isRequired: true, description: 'Payment date' },
    { fieldName: 'paymentAmount', dataType: 'number', isRequired: true, description: 'Payment amount' },
    { fieldName: 'paymentMethod', dataType: 'text', isRequired: false, description: 'Payment method' },
  ],
  purchase_orders: [
    { fieldName: 'poNumber', dataType: 'text', isRequired: true, description: 'PO number' },
    { fieldName: 'supplierCode', dataType: 'text', isRequired: true, description: 'Supplier code' },
    { fieldName: 'orderDate', dataType: 'date', isRequired: true, description: 'Order date' },
    { fieldName: 'totalAmount', dataType: 'number', isRequired: true, description: 'Total amount' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'PO status' },
  ],
  purchase_order_lines: [
    { fieldName: 'lineNumber', dataType: 'number', isRequired: true, description: 'Line number' },
    { fieldName: 'poNumber', dataType: 'text', isRequired: true, description: 'PO number' },
    { fieldName: 'itemCode', dataType: 'text', isRequired: true, description: 'Item code' },
    { fieldName: 'quantity', dataType: 'number', isRequired: true, description: 'Order quantity' },
    { fieldName: 'unitPrice', dataType: 'number', isRequired: true, description: 'Unit price' },
    { fieldName: 'lineTotal', dataType: 'number', isRequired: true, description: 'Line total' },
  ],
  contract_terms: [
    { fieldName: 'termCode', dataType: 'text', isRequired: true, description: 'Term code' },
    { fieldName: 'termName', dataType: 'text', isRequired: true, description: 'Term name' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Term description' },
    { fieldName: 'isStandard', dataType: 'boolean', isRequired: true, description: 'Standard term flag' },
  ],
  products: [
    { fieldName: 'product_id', dataType: 'text', isRequired: true, description: 'Unique product identifier' },
    { fieldName: 'company_id', dataType: 'text', isRequired: true, description: 'Company ID (foreign key)' },
    { fieldName: 'sku', dataType: 'text', isRequired: true, description: 'Stock Keeping Unit code' },
    { fieldName: 'product_name', dataType: 'text', isRequired: true, description: 'Product display name' },
    { fieldName: 'product_category', dataType: 'text', isRequired: false, description: 'Product category' },
    { fieldName: 'product_family', dataType: 'text', isRequired: false, description: 'Product family grouping' },
    { fieldName: 'product_line', dataType: 'text', isRequired: false, description: 'Product line' },
    { fieldName: 'product_classification', dataType: 'text', isRequired: false, description: 'Product classification type' },
    { fieldName: 'asset_type', dataType: 'text', isRequired: false, description: 'Asset type classification' },
    { fieldName: 'durability_class', dataType: 'text', isRequired: false, description: 'Durability classification' },
    { fieldName: 'revenue_type', dataType: 'text', isRequired: false, description: 'Revenue recognition type' },
    { fieldName: 'tax_category', dataType: 'text', isRequired: false, description: 'Tax category' },
    { fieldName: 'regulatory_class', dataType: 'text', isRequired: false, description: 'Regulatory classification' },
    { fieldName: 'list_price', dataType: 'number', isRequired: false, description: 'List/retail price' },
    { fieldName: 'standard_cost', dataType: 'number', isRequired: false, description: 'Standard cost' },
    { fieldName: 'base_unit_of_measure', dataType: 'text', isRequired: false, description: 'Base unit of measure' },
    { fieldName: 'alternate_uom_sellable', dataType: 'text', isRequired: false, description: 'Alternate sellable UOM' },
    { fieldName: 'case_pack_quantity', dataType: 'number', isRequired: false, description: 'Case pack quantity' },
    { fieldName: 'inner_pack_quantity', dataType: 'number', isRequired: false, description: 'Inner pack quantity' },
    { fieldName: 'product_status', dataType: 'text', isRequired: false, description: 'Product status (Active/Inactive/Discontinued)' },
    { fieldName: 'eligible_for_rebates', dataType: 'boolean', isRequired: false, description: 'Eligible for rebate programs' },
    { fieldName: 'eligible_for_royalties', dataType: 'boolean', isRequired: false, description: 'Eligible for contract fee calculations' },
    { fieldName: 'has_bom', dataType: 'boolean', isRequired: false, description: 'Has bill of materials' },
    { fieldName: 'is_component_only', dataType: 'boolean', isRequired: false, description: 'Component-only (not sold separately)' },
    { fieldName: 'manufacturing_lead_time_days', dataType: 'number', isRequired: false, description: 'Manufacturing lead time in days' },
    { fieldName: 'launch_date', dataType: 'date', isRequired: false, description: 'Product launch date' },
    { fieldName: 'barcode_upc', dataType: 'text', isRequired: false, description: 'Barcode/UPC code' },
    { fieldName: 'weight_kg', dataType: 'number', isRequired: false, description: 'Product weight in kg' },
  ],
  company_master: [
    { fieldName: 'company_id', dataType: 'text', isRequired: true, description: 'Company ID (foreign key to companies)' },
    { fieldName: 'company_name', dataType: 'text', isRequired: true, description: 'Company display name' },
    { fieldName: 'legal_entity_name', dataType: 'text', isRequired: false, description: 'Legal entity name' },
    { fieldName: 'industry', dataType: 'text', isRequired: false, description: 'Industry classification' },
    { fieldName: 'headquarters_city', dataType: 'text', isRequired: false, description: 'HQ city' },
    { fieldName: 'headquarters_state', dataType: 'text', isRequired: false, description: 'HQ state/province' },
    { fieldName: 'headquarters_country', dataType: 'text', isRequired: false, description: 'HQ country' },
    { fieldName: 'annual_revenue_millions', dataType: 'number', isRequired: false, description: 'Annual revenue in millions' },
    { fieldName: 'employee_count', dataType: 'number', isRequired: false, description: 'Number of employees' },
    { fieldName: 'erp_system', dataType: 'text', isRequired: false, description: 'ERP system name' },
    { fieldName: 'erp_version', dataType: 'text', isRequired: false, description: 'ERP version' },
    { fieldName: 'fiscal_year_end', dataType: 'text', isRequired: false, description: 'Fiscal year end month' },
    { fieldName: 'primary_currency', dataType: 'text', isRequired: false, description: 'Primary operating currency' },
    { fieldName: 'tax_id', dataType: 'text', isRequired: false, description: 'Tax identification number' },
    { fieldName: 'website', dataType: 'text', isRequired: false, description: 'Company website URL' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'Status (Active/Inactive)' },
  ],
  partner_types: [
    { fieldName: 'code', dataType: 'text', isRequired: true, description: 'Machine-readable code (e.g. distributor, oem) — used for joins and filters' },
    { fieldName: 'name', dataType: 'text', isRequired: true, description: 'Display label shown in the Partner Type dropdown' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Optional explanation of what this partner type means' },
    { fieldName: 'company_id', dataType: 'text', isRequired: false, description: 'Owning company (NULL = global system default available to every tenant)' },
    { fieldName: 'sort_order', dataType: 'number', isRequired: false, description: 'Display order in dropdowns (ascending)' },
    { fieldName: 'is_active', dataType: 'boolean', isRequired: false, description: 'Inactive types are hidden from selection but kept for historical rows' },
  ],
  partner_master: [
    { fieldName: 'partner_id', dataType: 'text', isRequired: true, description: 'Unique partner identifier' },
    { fieldName: 'company_id', dataType: 'text', isRequired: true, description: 'Company ID (foreign key)' },
    { fieldName: 'business_unit', dataType: 'text', isRequired: false, description: 'Business unit' },
    { fieldName: 'partner_name', dataType: 'text', isRequired: true, description: 'Partner display name' },
    { fieldName: 'partner_type', dataType: 'text', isRequired: false, description: 'Partner type (VAR, Distributor, Reseller, etc.)' },
    { fieldName: 'partner_classification', dataType: 'text', isRequired: false, description: 'Partner tier classification' },
    { fieldName: 'legal_entity_name', dataType: 'text', isRequired: false, description: 'Legal entity name' },
    { fieldName: 'headquarters_city', dataType: 'text', isRequired: false, description: 'HQ city' },
    { fieldName: 'headquarters_state', dataType: 'text', isRequired: false, description: 'HQ state' },
    { fieldName: 'headquarters_country', dataType: 'text', isRequired: false, description: 'HQ country' },
    { fieldName: 'primary_contact_name', dataType: 'text', isRequired: false, description: 'Primary contact name' },
    { fieldName: 'primary_contact_email', dataType: 'text', isRequired: false, description: 'Primary contact email' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'Status (Active/Inactive/Suspended)' },
    { fieldName: 'onboarding_date', dataType: 'date', isRequired: false, description: 'Partner onboarding date' },
    { fieldName: 'payment_terms', dataType: 'text', isRequired: false, description: 'Payment terms' },
    { fieldName: 'payment_method', dataType: 'text', isRequired: false, description: 'Payment method' },
    { fieldName: 'currency', dataType: 'text', isRequired: false, description: 'Operating currency' },
    { fieldName: 'tax_id', dataType: 'text', isRequired: false, description: 'Tax identification number' },
    { fieldName: 'credit_limit', dataType: 'number', isRequired: false, description: 'Credit limit' },
    { fieldName: 'primary_sales_channel', dataType: 'text', isRequired: false, description: 'Primary sales channel' },
    { fieldName: 'authorized_channels', dataType: 'text', isRequired: false, description: 'Authorized sales channels (comma-separated)' },
    { fieldName: 'primary_territory', dataType: 'text', isRequired: false, description: 'Primary territory' },
    { fieldName: 'authorized_territories', dataType: 'text', isRequired: false, description: 'Authorized territories (comma-separated)' },
  ],
  partner_contract_associations: [
    { fieldName: 'association_id', dataType: 'text', isRequired: true, description: 'Unique association identifier' },
    { fieldName: 'partner_id', dataType: 'text', isRequired: true, description: 'Partner ID (foreign key)' },
    { fieldName: 'contract_id', dataType: 'text', isRequired: false, description: 'Contract ID (foreign key)' },
    { fieldName: 'effective_date', dataType: 'date', isRequired: false, description: 'Association effective date' },
    { fieldName: 'expiration_date', dataType: 'date', isRequired: false, description: 'Association expiration date' },
    { fieldName: 'contract_status', dataType: 'text', isRequired: false, description: 'Contract status' },
    { fieldName: 'is_primary_contract', dataType: 'boolean', isRequired: false, description: 'Primary contract flag' },
    { fieldName: 'notes', dataType: 'text', isRequired: false, description: 'Notes' },
  ],
  product_hierarchy: [
    { fieldName: 'hierarchy_id', dataType: 'text', isRequired: true, description: 'Unique hierarchy node identifier' },
    { fieldName: 'company_id', dataType: 'text', isRequired: true, description: 'Company ID (foreign key)' },
    { fieldName: 'level_name', dataType: 'text', isRequired: true, description: 'Hierarchy level name (Category, Subcategory, etc.)' },
    { fieldName: 'level_order', dataType: 'number', isRequired: true, description: 'Level order/depth in hierarchy' },
    { fieldName: 'parent_hierarchy_id', dataType: 'text', isRequired: false, description: 'Parent node ID' },
    { fieldName: 'hierarchy_value', dataType: 'text', isRequired: true, description: 'Value at this hierarchy level' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Description' },
  ],
  product_attributes: [
    { fieldName: 'attribute_id', dataType: 'text', isRequired: true, description: 'Unique attribute identifier' },
    { fieldName: 'product_id', dataType: 'text', isRequired: true, description: 'Product ID (foreign key)' },
    { fieldName: 'attribute_name', dataType: 'text', isRequired: true, description: 'Attribute name' },
    { fieldName: 'attribute_value', dataType: 'text', isRequired: true, description: 'Attribute value' },
    { fieldName: 'attribute_category', dataType: 'text', isRequired: false, description: 'Attribute category grouping' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Description' },
  ],
  product_bom: [
    { fieldName: 'bom_id', dataType: 'text', isRequired: true, description: 'Unique BOM identifier' },
    { fieldName: 'parent_product_id', dataType: 'text', isRequired: true, description: 'Parent product ID' },
    { fieldName: 'component_product_id', dataType: 'text', isRequired: true, description: 'Component product ID' },
    { fieldName: 'component_quantity', dataType: 'number', isRequired: true, description: 'Component quantity' },
    { fieldName: 'component_uom', dataType: 'text', isRequired: false, description: 'Component unit of measure' },
    { fieldName: 'bom_type', dataType: 'text', isRequired: false, description: 'BOM type (Manufacturing, Assembly, Kit)' },
    { fieldName: 'sequence_number', dataType: 'number', isRequired: false, description: 'Assembly sequence number' },
    { fieldName: 'is_optional', dataType: 'boolean', isRequired: false, description: 'Optional component flag' },
    { fieldName: 'substitute_product_id', dataType: 'text', isRequired: false, description: 'Substitute product ID' },
    { fieldName: 'scrap_factor_percent', dataType: 'number', isRequired: false, description: 'Scrap factor percentage' },
    { fieldName: 'effective_date', dataType: 'date', isRequired: false, description: 'BOM effective date' },
    { fieldName: 'expiration_date', dataType: 'date', isRequired: false, description: 'BOM expiration date' },
    { fieldName: 'notes', dataType: 'text', isRequired: false, description: 'Notes' },
  ],
  product_packaging_matrix: [
    { fieldName: 'package_id', dataType: 'text', isRequired: true, description: 'Unique package identifier' },
    { fieldName: 'product_id', dataType: 'text', isRequired: true, description: 'Product ID (foreign key)' },
    { fieldName: 'package_type', dataType: 'text', isRequired: true, description: 'Package type (Each, Inner Pack, Case, Pallet)' },
    { fieldName: 'package_code', dataType: 'text', isRequired: false, description: 'Package code' },
    { fieldName: 'units_per_package', dataType: 'number', isRequired: true, description: 'Units per package' },
    { fieldName: 'is_base_unit', dataType: 'boolean', isRequired: false, description: 'Base unit flag' },
    { fieldName: 'is_sellable', dataType: 'boolean', isRequired: false, description: 'Sellable package flag' },
    { fieldName: 'list_price_package', dataType: 'number', isRequired: false, description: 'List price for this package' },
    { fieldName: 'standard_cost_package', dataType: 'number', isRequired: false, description: 'Standard cost for this package' },
    { fieldName: 'barcode_package', dataType: 'text', isRequired: false, description: 'Package barcode' },
    { fieldName: 'weight_kg_package', dataType: 'number', isRequired: false, description: 'Package weight in kg' },
    { fieldName: 'dimensions_cm', dataType: 'text', isRequired: false, description: 'Package dimensions (L x W x H cm)' },
    { fieldName: 'effective_date', dataType: 'date', isRequired: false, description: 'Effective date' },
    { fieldName: 'expiration_date', dataType: 'date', isRequired: false, description: 'Expiration date' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Description' },
  ],
  territory_master: [
    { fieldName: 'territory_id', dataType: 'text', isRequired: true, description: 'Unique territory identifier' },
    { fieldName: 'territory_code', dataType: 'text', isRequired: true, description: 'Territory code' },
    { fieldName: 'territory_name', dataType: 'text', isRequired: true, description: 'Territory display name' },
    { fieldName: 'territory_type', dataType: 'text', isRequired: false, description: 'Territory type (Region, Country, State, etc.)' },
    { fieldName: 'parent_territory_id', dataType: 'text', isRequired: false, description: 'Parent territory ID for hierarchy' },
    { fieldName: 'region_level', dataType: 'number', isRequired: false, description: 'Region hierarchy level' },
    { fieldName: 'currency_code', dataType: 'text', isRequired: false, description: 'Territory currency code' },
    { fieldName: 'tax_jurisdiction', dataType: 'text', isRequired: false, description: 'Tax jurisdiction' },
    { fieldName: 'regulatory_requirements', dataType: 'text', isRequired: false, description: 'Regulatory requirements' },
    { fieldName: 'language', dataType: 'text', isRequired: false, description: 'Primary language' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'Status (Active/Inactive)' },
    { fieldName: 'notes', dataType: 'text', isRequired: false, description: 'Notes' },
  ],
  sales_channels: [
    { fieldName: 'channel_id', dataType: 'text', isRequired: true, description: 'Unique channel identifier' },
    { fieldName: 'channel_code', dataType: 'text', isRequired: true, description: 'Channel code' },
    { fieldName: 'channel_name', dataType: 'text', isRequired: true, description: 'Channel display name' },
    { fieldName: 'channel_type', dataType: 'text', isRequired: false, description: 'Channel type (B2B, B2C, Marketplace, etc.)' },
    { fieldName: 'channel_category', dataType: 'text', isRequired: false, description: 'Channel category' },
    { fieldName: 'typical_margin_pct_low', dataType: 'number', isRequired: false, description: 'Typical margin percentage (low)' },
    { fieldName: 'typical_margin_pct_high', dataType: 'number', isRequired: false, description: 'Typical margin percentage (high)' },
    { fieldName: 'requires_certification', dataType: 'boolean', isRequired: false, description: 'Requires certification flag' },
    { fieldName: 'payment_terms_default', dataType: 'text', isRequired: false, description: 'Default payment terms' },
    { fieldName: 'min_order_value_usd', dataType: 'number', isRequired: false, description: 'Minimum order value (USD)' },
    { fieldName: 'max_credit_limit_usd', dataType: 'number', isRequired: false, description: 'Maximum credit limit (USD)' },
    { fieldName: 'volume_discount_eligible', dataType: 'boolean', isRequired: false, description: 'Volume discount eligible' },
    { fieldName: 'coop_advertising_eligible', dataType: 'boolean', isRequired: false, description: 'Co-op advertising eligible' },
    { fieldName: 'status', dataType: 'text', isRequired: true, description: 'Status (Active/Inactive)' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Description' },
  ],
  product_territory_matrix: [
    { fieldName: 'territory_auth_id', dataType: 'text', isRequired: true, description: 'Unique territory authorization identifier' },
    { fieldName: 'product_id', dataType: 'text', isRequired: true, description: 'Product ID (foreign key)' },
    { fieldName: 'territory_id', dataType: 'text', isRequired: true, description: 'Territory ID (foreign key)' },
    { fieldName: 'is_authorized', dataType: 'boolean', isRequired: true, description: 'Authorization status' },
    { fieldName: 'restriction_reason', dataType: 'text', isRequired: false, description: 'Restriction reason if not authorized' },
    { fieldName: 'requires_certification', dataType: 'boolean', isRequired: false, description: 'Requires certification' },
    { fieldName: 'certification_type', dataType: 'text', isRequired: false, description: 'Certification type' },
    { fieldName: 'certification_status', dataType: 'text', isRequired: false, description: 'Certification status' },
    { fieldName: 'effective_date', dataType: 'date', isRequired: false, description: 'Effective date' },
    { fieldName: 'expiration_date', dataType: 'date', isRequired: false, description: 'Expiration date' },
    { fieldName: 'import_duty_pct', dataType: 'number', isRequired: false, description: 'Import duty percentage' },
    { fieldName: 'notes', dataType: 'text', isRequired: false, description: 'Notes' },
  ],
  product_channel_matrix: [
    { fieldName: 'channel_auth_id', dataType: 'text', isRequired: true, description: 'Unique channel authorization identifier' },
    { fieldName: 'product_id', dataType: 'text', isRequired: true, description: 'Product ID (foreign key)' },
    { fieldName: 'channel_id', dataType: 'text', isRequired: true, description: 'Channel ID (foreign key)' },
    { fieldName: 'is_authorized', dataType: 'boolean', isRequired: true, description: 'Authorization status' },
    { fieldName: 'restriction_reason', dataType: 'text', isRequired: false, description: 'Restriction reason if not authorized' },
    { fieldName: 'channel_specific_sku', dataType: 'text', isRequired: false, description: 'Channel-specific SKU' },
    { fieldName: 'channel_specific_pricing', dataType: 'number', isRequired: false, description: 'Channel-specific pricing' },
    { fieldName: 'min_order_quantity', dataType: 'number', isRequired: false, description: 'Minimum order quantity' },
    { fieldName: 'max_order_quantity', dataType: 'number', isRequired: false, description: 'Maximum order quantity' },
    { fieldName: 'effective_date', dataType: 'date', isRequired: false, description: 'Effective date' },
    { fieldName: 'expiration_date', dataType: 'date', isRequired: false, description: 'Expiration date' },
    { fieldName: 'notes', dataType: 'text', isRequired: false, description: 'Notes' },
  ],
  product_classifications: [
    { fieldName: 'classification_dimension', dataType: 'text', isRequired: true, description: 'Classification dimension (Product Type, Licensing Category, etc.)' },
    { fieldName: 'classification_value', dataType: 'text', isRequired: true, description: 'Classification value' },
    { fieldName: 'description', dataType: 'text', isRequired: false, description: 'Description' },
    { fieldName: 'use_case', dataType: 'text', isRequired: false, description: 'Use case for this classification' },
  ],
  sales_transactions: [
    { fieldName: 'transaction_id', dataType: 'text', isRequired: true, description: 'Unique transaction identifier' },
    { fieldName: 'company_id', dataType: 'text', isRequired: true, description: 'Company ID (foreign key)' },
    { fieldName: 'transaction_date', dataType: 'date', isRequired: true, description: 'Transaction date' },
    { fieldName: 'customer_name', dataType: 'text', isRequired: false, description: 'Customer name' },
    { fieldName: 'item_number', dataType: 'text', isRequired: false, description: 'Item number' },
    { fieldName: 'quantity', dataType: 'number', isRequired: false, description: 'Quantity sold' },
    { fieldName: 'unit_price', dataType: 'number', isRequired: false, description: 'Unit price' },
    { fieldName: 'total_amount', dataType: 'number', isRequired: false, description: 'Total amount' },
    { fieldName: 'territory', dataType: 'text', isRequired: false, description: 'Sales territory' },
    { fieldName: 'channel', dataType: 'text', isRequired: false, description: 'Sales channel' },
  ],
};

export async function seedLicenseIQSchema() {
  console.log('🌱 Seeding LicenseIQ Schema Catalog...');

  try {
    const existingEntities = await db.select().from(licenseiqEntities);
    const existingTechnicalNames = new Set(existingEntities.map(e => e.technicalName));
    
    const standardEntities: InsertLicenseiqEntity[] = [
      { name: 'Company Master', technicalName: 'company_master', category: 'Master Data', description: 'Company master data with legal entity details, ERP info, and financials' },
      { name: 'Partner Master', technicalName: 'partner_master', category: 'Master Data', description: 'Partner/distributor master data with contact info, payment terms, and authorized territories' },
      { name: 'Partner Type Master', technicalName: 'partner_types', category: 'Master Data', description: 'Lookup list of partner types (Distributor, Reseller, Agent, OEM, Retailer, …) used by the Partner Master "Partner Type" dropdown' },
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
      { name: 'Sales Transactions', technicalName: 'sales_transactions', category: 'Transactional', description: 'Sales transaction records' },
    ];

    let newEntitiesCount = 0;
    for (const entityData of standardEntities) {
      if (!existingTechnicalNames.has(entityData.technicalName)) {
        await db.insert(licenseiqEntities).values(entityData);
        newEntitiesCount++;
        console.log(`  ✓ Added entity: ${entityData.name}`);
      }
    }
    
    if (newEntitiesCount > 0) {
      console.log(`✅ Added ${newEntitiesCount} new entities to LicenseIQ schema`);
    } else {
      console.log(`✓ Core LicenseIQ schema entities already exist (${existingEntities.length} entities total)`);
    }

    const allEntities = await db.select().from(licenseiqEntities);
    const entityMap = new Map(allEntities.map(e => [e.technicalName, e.id]));

    let totalFieldsCreated = 0;
    let entitiesSeeded = 0;

    for (const [technicalName, fieldDefs] of Object.entries(standardFieldDefinitions)) {
      const entityId = entityMap.get(technicalName);
      if (!entityId) {
        continue;
      }

      const existingFields = await db.select().from(licenseiqFields).where(eq(licenseiqFields.entityId, entityId));
      if (existingFields.length > 0) {
        continue;
      }

      for (const fieldDef of fieldDefs) {
        try {
          await db.insert(licenseiqFields).values({
            entityId,
            fieldName: fieldDef.fieldName,
            dataType: fieldDef.dataType,
            isRequired: fieldDef.isRequired,
            description: fieldDef.description || null,
          });
          totalFieldsCreated++;
        } catch (err: any) {
          if (!err.message?.includes('duplicate')) {
            console.error(`  ❌ Failed to create field ${fieldDef.fieldName} for ${technicalName}`);
          }
        }
      }
      entitiesSeeded++;
      console.log(`  ✓ Seeded ${fieldDefs.length} fields for ${technicalName}`);
    }

    if (totalFieldsCreated > 0) {
      console.log(`✅ LicenseIQ field seeding complete: ${totalFieldsCreated} fields across ${entitiesSeeded} entities`);
    } else {
      console.log(`✓ All LicenseIQ entity fields already seeded`);
    }
  } catch (error) {
    console.error('❌ Error seeding LicenseIQ schema:', error);
    throw error;
  }
}
