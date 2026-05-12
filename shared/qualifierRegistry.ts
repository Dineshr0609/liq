import { z } from "zod";

export type QualifierFieldCode =
  | "product"
  | "product_category"
  | "product_attribute"
  | "partner"
  | "customer"
  | "channel"
  | "territory";

export type QualifierOperator =
  | "equals"
  | "in"
  | "not_in"
  | "contains"
  | "between";

export type QualifierIncExc = "include" | "exclude";

export interface QualifierFieldDef {
  code: QualifierFieldCode;
  label: string;
  masterTable: string;
  mappingEntityType: string;
  allowedOperators: QualifierOperator[];
  saleAttributes: string[];
  /** Default attribute when none specified — preserves legacy behavior. */
  defaultAttribute: string;
}

export const QUALIFIER_FIELDS: QualifierFieldDef[] = [
  {
    code: "product",
    label: "Product",
    masterTable: "products",
    mappingEntityType: "product",
    allowedOperators: ["equals", "in", "not_in", "contains"],
    saleAttributes: ["productName", "productCode", "sku"],
    defaultAttribute: "name",
  },
  {
    code: "product_category",
    label: "Product Category",
    masterTable: "product_classifications",
    mappingEntityType: "product_category",
    allowedOperators: ["equals", "in", "not_in", "contains"],
    saleAttributes: ["category", "productCategory"],
    defaultAttribute: "name",
  },
  {
    code: "product_attribute",
    label: "Product Attribute",
    masterTable: "product_attributes",
    mappingEntityType: "product_attribute",
    allowedOperators: ["equals", "in", "not_in", "contains"],
    saleAttributes: [],
    defaultAttribute: "attribute_value",
  },
  {
    code: "partner",
    label: "Partner",
    masterTable: "partner_master",
    mappingEntityType: "partner",
    allowedOperators: ["equals", "in", "not_in"],
    saleAttributes: ["partnerName", "partnerId"],
    defaultAttribute: "partner_name",
  },
  {
    code: "customer",
    label: "Customer",
    masterTable: "customers",
    mappingEntityType: "customer",
    allowedOperators: ["equals", "in", "not_in", "contains"],
    saleAttributes: ["customerName", "customerId"],
    defaultAttribute: "name",
  },
  {
    code: "channel",
    label: "Channel",
    masterTable: "sales_channels",
    mappingEntityType: "channel",
    allowedOperators: ["equals", "in", "not_in"],
    saleAttributes: ["channel"],
    defaultAttribute: "channel_name",
  },
  {
    code: "territory",
    label: "Territory",
    masterTable: "territory_master",
    mappingEntityType: "territory",
    allowedOperators: ["equals", "in", "not_in", "contains"],
    saleAttributes: ["territory", "region", "country"],
    defaultAttribute: "territory_name",
  },
];

export const QUALIFIER_FIELD_CODES = QUALIFIER_FIELDS.map((f) => f.code) as [
  QualifierFieldCode,
  ...QualifierFieldCode[]
];

export function getFieldDef(code: string): QualifierFieldDef | undefined {
  return QUALIFIER_FIELDS.find((f) => f.code === code);
}

export function getDefaultAttribute(code: string): string | undefined {
  return getFieldDef(code)?.defaultAttribute;
}

export const conditionSchema = z.object({
  field: z.enum(QUALIFIER_FIELD_CODES),
  /**
   * The attribute (column) on the field's master table being filtered.
   * Optional for backward compatibility — when omitted, the field's
   * defaultAttribute is used.
   */
  attribute: z.string().optional().nullable(),
  op: z.enum(["equals", "in", "not_in", "contains", "between"]),
  value: z.string().min(1),
  group: z.string().min(1).default("G1"),
  type: z.enum(["include", "exclude"]).default("include"),
  mappedTo: z
    .object({
      entityType: z.string(),
      recordId: z.string(),
      label: z.string().optional(),
      confidence: z.number().optional(),
    })
    .optional()
    .nullable(),
});

export type Condition = z.infer<typeof conditionSchema>;

export const conditionsArraySchema = z.array(conditionSchema);
