import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';

function excelSerialToDate(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

function coerceToDateString(val: any): string {
  if (val == null || val === '') return new Date().toISOString();
  if (typeof val === 'number' && val > 30000 && val < 100000) {
    return excelSerialToDate(val);
  }
  if (val instanceof Date) return val.toISOString();
  const str = String(val).trim();
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

const numericField = z.union([
  z.number(),
  z.string().transform(val => parseFloat(val)),
]).pipe(z.number().refine(v => !isNaN(v)));

const salesDataRowSchema = z.object({
  transactionDate: z.any().transform(coerceToDateString).optional().default(new Date().toISOString()),
  transactionId: z.any().transform(v => v != null ? String(v) : undefined).optional(),
  productCode: z.any().transform(v => v != null ? String(v) : undefined).optional(),
  productName: z.any().transform(v => v != null ? String(v) : undefined).optional(),
  category: z.any().transform(v => v != null ? String(v) : undefined).optional(),
  territory: z.any().transform(v => v != null ? String(v) : undefined).optional(),
  vendorName: z.any().transform(v => v != null ? String(v) : undefined).optional(),
  channel: z.any().transform(v => v != null ? String(v) : undefined).optional(),
  currency: z.string().default('USD'),
  grossAmount: numericField.optional(),
  netAmount: numericField.optional(),
  quantity: numericField.optional(),
  unitPrice: numericField.optional(),
}).transform(data => {
  if (data.grossAmount == null && data.netAmount != null) {
    data.grossAmount = data.netAmount;
  }
  if (data.netAmount == null && data.grossAmount != null) {
    data.netAmount = data.grossAmount;
  }
  if (data.grossAmount == null && data.quantity != null && data.unitPrice != null) {
    data.grossAmount = data.quantity * data.unitPrice;
    data.netAmount = data.grossAmount;
  }
  if (data.grossAmount == null) {
    data.grossAmount = 0;
  }
  return data;
});

/**
 * Normalize field names from various CSV formats to match our schema
 * Supports common variations like "Date" -> "transactionDate", "Sales Amount" -> "grossAmount"
 */
function normalizeFieldNames(row: any): any {
  const normalized: any = {};
  
  // Field name mappings (case-insensitive)
  const fieldMappings: Record<string, string> = {
    // Transaction Date variations
    'date': 'transactionDate',
    'transaction date': 'transactionDate',
    'transactiondate': 'transactionDate',
    'transaction_date': 'transactionDate',
    'sale date': 'transactionDate',
    'saledate': 'transactionDate',
    'sale_date': 'transactionDate',
    'invoice date': 'transactionDate',
    'invoice_date': 'transactionDate',
    
    // Transaction ID variations
    'transaction id': 'transactionId',
    'transactionid': 'transactionId',
    'transaction_id': 'transactionId',
    'id': 'transactionId',
    'sale id': 'transactionId',
    
    // Product Code variations
    'product code': 'productCode',
    'productcode': 'productCode',
    'product_code': 'productCode',
    'product_id': 'productCode',
    'productid': 'productCode',
    'product id': 'productCode',
    'sku': 'productCode',
    'item code': 'productCode',
    'item_code': 'productCode',
    
    // Product Name variations
    'product name': 'productName',
    'productname': 'productName',
    'product_name': 'productName',
    'product': 'productName',
    'item name': 'productName',
    'item': 'productName',
    
    // Category variations
    'category': 'category',
    'product category': 'category',
    'productcategory': 'category',
    'type': 'category',
    
    // Territory variations
    'territory': 'territory',
    'region': 'territory',
    'country': 'territory',
    'location': 'territory',
    
    // Gross Amount variations
    'sales amount': 'grossAmount',
    'salesamount': 'grossAmount',
    'gross amount': 'grossAmount',
    'grossamount': 'grossAmount',
    'gross_amount': 'grossAmount',
    'gross sales': 'grossAmount',
    'grosssales': 'grossAmount',
    'gross_sales': 'grossAmount',
    'amount': 'grossAmount',
    'total amount': 'grossAmount',
    'revenue': 'grossAmount',
    'sales': 'grossAmount',
    
    // Net Amount variations
    'net amount': 'netAmount',
    'netamount': 'netAmount',
    'net_amount': 'netAmount',
    'net': 'netAmount',
    'net sales value': 'netAmount',
    'net_sales_value': 'netAmount',
    'netsalesvalue': 'netAmount',
    'net sales': 'netAmount',
    'net_sales': 'netAmount',
    'netsales': 'netAmount',
    'net_sales_amount': 'netAmount',
    'net sales amount': 'netAmount',
    'netsalesamount': 'netAmount',
    
    
    // Quantity variations
    'quantity': 'quantity',
    'qty': 'quantity',
    'units': 'quantity',
    'units sold': 'quantity',
    'unitssold': 'quantity',
    'volume': 'quantity',
    
    // Unit Price variations
    'unit price': 'unitPrice',
    'unitprice': 'unitPrice',
    'unit_price': 'unitPrice',
    'price': 'unitPrice',
    'price per unit': 'unitPrice',
    
    // Component Type (electronics specific)
    'component type': 'category',
    'componenttype': 'category',

    // Product Family / Line variations
    'product_family': 'category',
    'product family': 'category',
    'productfamily': 'category',
    'product_line': 'productCode',
    'product line': 'productCode',
    'productline': 'productCode',

    // Vendor / Partner / Supplier variations
    'partner_name': 'vendorName',
    'partner name': 'vendorName',
    'partnername': 'vendorName',
    'vendor_name': 'vendorName',
    'vendor name': 'vendorName',
    'vendorname': 'vendorName',
    'supplier_name': 'vendorName',
    'supplier name': 'vendorName',
    'suppliername': 'vendorName',
    'supplier': 'vendorName',
    'vendor': 'vendorName',
    'partner': 'vendorName',
    'licensee': 'vendorName',
    'distributor': 'vendorName',
    'reseller': 'vendorName',

    // Channel variations
    'channel': 'channel',
    'sales_channel': 'channel',
    'sales channel': 'channel',
    'distribution_channel': 'channel',
    'distribution channel': 'channel',

    // Transaction type variations
    'transaction_type': 'transactionType',
    'transaction type': 'transactionType',
    'transactiontype': 'transactionType',
    'type': 'transactionType',
    'sale_type': 'transactionType',
    'sale type': 'transactionType',

    // Rebate eligibility variations
    'rebate_eligible': 'rebateEligible',
    'rebate eligible': 'rebateEligible',
    'rebateeligible': 'rebateEligible',
    'eligible': 'rebateEligible',
    'is_eligible': 'rebateEligible',

    // Exclusion reason variations
    'exclusion_reason': 'exclusionReason',
    'exclusion reason': 'exclusionReason',
    'exclusionreason': 'exclusionReason',
    'exclude_reason': 'exclusionReason',

    // Quarter variations
    'quarter': 'quarter',
    'fiscal_quarter': 'quarter',
    'fiscal quarter': 'quarter',
    'reporting_quarter': 'quarter',
    'reporting quarter': 'quarter',

    // Distributor / Licensee variations
    'distributor_name': 'distributorName',
    'distributor name': 'distributorName',
    'licensee_name': 'licenseeName',
    'licensee name': 'licenseeName',

    // Reported amounts
    'reported_royalty_amount': 'reportedRoyaltyAmount',
    'reported fee amount': 'reportedRoyaltyAmount',
    'reported_rebate_amount': 'reportedRoyaltyAmount',
    'reported rebate amount': 'reportedRoyaltyAmount',
    'report_date': 'reportDate',
    'report date': 'reportDate',
  };
  
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.toLowerCase().trim();
    const mappedKey = fieldMappings[normalizedKey] || key;
    if (normalized[mappedKey] === undefined || normalized[mappedKey] === '' || normalized[mappedKey] === null) {
      normalized[mappedKey] = value;
    }
  }
  
  return normalized;
}

export interface ParsedSalesRow {
  rowIndex: number;
  rowData: any;
  validationStatus: 'valid' | 'invalid';
  validationErrors?: string[];
  externalId?: string;
}

export interface ParseResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ParsedSalesRow[];
  errors?: string[];
}

export class SalesDataParser {
  /**
   * Parse CSV file
   */
  static async parseCSV(fileBuffer: Buffer): Promise<ParseResult> {
    return new Promise((resolve) => {
      const fileContent = fileBuffer.toString('utf-8');
      
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          const parseResult = this.validateAndTransformRows(results.data, results.errors);
          resolve(parseResult);
        },
        error: (error) => {
          resolve({
            success: false,
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            rows: [],
            errors: [error.message]
          });
        }
      });
    });
  }

  /**
   * Parse Excel file (XLSX/XLS)
   */
  static async parseExcel(fileBuffer: Buffer): Promise<ParseResult> {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      
      // Use first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return {
          success: false,
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          rows: [],
          errors: ['No sheets found in Excel file']
        };
      }
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      return this.validateAndTransformRows(jsonData, []);
    } catch (error) {
      return {
        success: false,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        rows: [],
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * Validate and transform raw rows into ParsedSalesRow format
   */
  private static validateAndTransformRows(rawRows: any[], parseErrors: any[]): ParseResult {
    const parsedRows: ParsedSalesRow[] = [];
    let validCount = 0;
    let invalidCount = 0;

    rawRows.forEach((row, index) => {
      // Normalize field names to match our schema (e.g., "Date" -> "transactionDate")
      const normalizedRow = normalizeFieldNames(row);
      const result = salesDataRowSchema.safeParse(normalizedRow);
      
      if (result.success) {
        parsedRows.push({
          rowIndex: index,
          rowData: result.data,
          validationStatus: 'valid',
          externalId: normalizedRow.transactionId || row.transactionId || `row-${index}`
        });
        validCount++;
      } else {
        const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        parsedRows.push({
          rowIndex: index,
          rowData: row,
          validationStatus: 'invalid',
          validationErrors: errors,
          externalId: normalizedRow.transactionId || row.transactionId || `row-${index}`
        });
        invalidCount++;
      }
    });

    return {
      success: parseErrors.length === 0,
      totalRows: rawRows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      rows: parsedRows,
      errors: parseErrors.map(err => err.message)
    };
  }

  /**
   * Detect file type and parse accordingly
   */
  static async parseFile(fileBuffer: Buffer, fileName: string): Promise<ParseResult> {
    const ext = fileName.toLowerCase().split('.').pop();
    
    switch (ext) {
      case 'csv':
        return this.parseCSV(fileBuffer);
      case 'xlsx':
      case 'xls':
        return this.parseExcel(fileBuffer);
      default:
        return {
          success: false,
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          rows: [],
          errors: [`Unsupported file type: ${ext}. Please upload CSV or Excel files.`]
        };
    }
  }
}
