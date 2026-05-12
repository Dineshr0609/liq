import type { Condition } from "@shared/qualifierRegistry";
import { getDefaultAttribute } from "@shared/qualifierRegistry";
import type { EnrichedSale } from "./saleEnrichment";

const norm = (v: any): string =>
  (v == null ? "" : String(v)).toLowerCase().trim();

const WILDCARDS = new Set(["all", "any", "*", "general", "universal", "everything"]);
const isWild = (v: string) => WILDCARDS.has(norm(v));

/**
 * Read the actual sale-side value for a (field, attribute) pair from the
 * enriched sale. For Product Attribute (EAV) the attribute IS the lookup key
 * into productAttributes. For other objects the attribute is the column name
 * on the related master row.
 */
export function readSaleValue(
  enriched: EnrichedSale,
  field: string,
  attribute: string
): string | null {
  switch (field) {
    case "product": {
      // Prefer master row column; fall back to raw sale fields when product
      // master wasn't matched (so a "name = X" condition still works).
      if (enriched.product && enriched.product[attribute] != null) {
        return String(enriched.product[attribute]);
      }
      if (attribute === "name" || attribute === "product_name") return enriched.raw.productName ?? null;
      if (attribute === "product_code" || attribute === "sku") return enriched.raw.productCode ?? null;
      return null;
    }
    case "product_category": {
      if (enriched.product && enriched.product[attribute] != null) {
        return String(enriched.product[attribute]);
      }
      return enriched.raw.category ?? null;
    }
    case "product_attribute": {
      // EAV — `attribute` is the attribute_name (e.g. "Brand"); read its
      // value from the productAttributes map.
      const v = enriched.productAttributes[attribute];
      return v != null ? String(v) : null;
    }
    case "customer": {
      if (enriched.customer && enriched.customer[attribute] != null) {
        return String(enriched.customer[attribute]);
      }
      return null;
    }
    case "partner": {
      if (enriched.partner && enriched.partner[attribute] != null) {
        return String(enriched.partner[attribute]);
      }
      return null;
    }
    case "channel": {
      if (enriched.channel && enriched.channel[attribute] != null) {
        return String(enriched.channel[attribute]);
      }
      if (attribute === "channel_name") return enriched.raw.channel ?? null;
      return null;
    }
    case "territory": {
      if (enriched.territory && enriched.territory[attribute] != null) {
        return String(enriched.territory[attribute]);
      }
      if (attribute === "territory_name") return enriched.raw.territory ?? null;
      return null;
    }
    default:
      return null;
  }
}

/**
 * Apply a single operator against (saleValue, ruleValue). Both are normalized
 * to strings; wildcards in ruleValue auto-pass.
 */
function opPasses(op: string, saleValue: string | null, ruleValue: string): boolean {
  if (isWild(ruleValue)) return true;
  if (saleValue == null) return false;
  const s = norm(saleValue);
  const r = norm(ruleValue);
  if (!r) return true;
  switch (op) {
    case "equals":
    case "in":
    case "not_in": // negation handled by caller via type=exclude
      return s === r;
    case "contains":
      return s.includes(r) || r.includes(s);
    case "between": {
      // value format "a..b" or "a,b" — numeric range
      const parts = r.split(/\.\.|,/).map((p) => p.trim());
      if (parts.length !== 2) return false;
      const sn = Number(s);
      const lo = Number(parts[0]);
      const hi = Number(parts[1]);
      if (Number.isNaN(sn) || Number.isNaN(lo) || Number.isNaN(hi)) return false;
      return sn >= lo && sn <= hi;
    }
    default:
      return s === r;
  }
}

interface GroupKey {
  field: string;
  attribute: string;
  type: "include" | "exclude";
  group: string;
}

/**
 * Evaluate a set of attribute-level conditions against an enriched sale.
 *
 * Semantics:
 *  - Conditions are bucketed by (field, attribute, type, group).
 *  - Within an `include` bucket: ANY value matching the operator is enough.
 *  - Within an `exclude` bucket: NO value may match.
 *  - Across buckets: ALL must pass (AND).
 *
 * Returns true if the sale passes every bucket. Returns true if there are no
 * conditions (vacuously satisfies, callers should treat empty as "no extra
 * filtering needed").
 */
export function evaluateAttributeConditions(
  conditions: Condition[],
  enriched: EnrichedSale
): boolean {
  if (!conditions || conditions.length === 0) return true;

  const buckets = new Map<string, { key: GroupKey; conds: Condition[] }>();
  for (const c of conditions) {
    const attribute = (c.attribute && c.attribute.trim()) || getDefaultAttribute(c.field) || "name";
    const k: GroupKey = {
      field: c.field,
      attribute,
      type: c.type ?? "include",
      group: c.group ?? "G1",
    };
    const id = `${k.field}|${k.attribute}|${k.type}|${k.group}`;
    if (!buckets.has(id)) buckets.set(id, { key: k, conds: [] });
    buckets.get(id)!.conds.push(c);
  }

  for (const { key, conds } of buckets.values()) {
    const saleValue = readSaleValue(enriched, key.field, key.attribute);
    if (key.type === "include") {
      const anyMatch = conds.some((c) => opPasses(c.op, saleValue, c.value));
      if (!anyMatch) return false;
    } else {
      const anyMatch = conds.some((c) => opPasses(c.op, saleValue, c.value));
      if (anyMatch) return false;
    }
  }
  return true;
}

/**
 * Decide whether a condition is "extended" — i.e. evaluated by this engine
 * rather than by the legacy product/territory/channel string-array path.
 *
 * Today the legacy path covers `product` (default attribute = name) and
 * `product_category` (default attribute = name) and territory/channel via the
 * rule's own columns. Anything else goes through the new evaluator.
 */
/**
 * Lightweight sale attributes used by the auto-matcher BEFORE the heavy
 * SaleEnricher has run. Only carries the columns that come straight off
 * sales_data (no joins to product_master / customer_master / etc).
 *
 * The auto-matcher's job is "given a freshly uploaded sale row, which
 * contract+rule does it belong to?" — at that point we don't have the
 * enriched master-data joins yet, so we evaluate conditions against this
 * flat shape. Conditions referencing fields the matcher can't see
 * (customer, partner, product_attribute, product.<non-name>) are skipped
 * here and will be re-evaluated downstream by the universal engine.
 */
export interface SaleAttrs {
  productName?: string | null;
  productCode?: string | null;
  category?: string | null;
  territory?: string | null;
  channel?: string | null;
}

/**
 * Adapt SaleAttrs to the EnrichedSale shape expected by
 * evaluateAttributeConditions. Master-data slots are left null so any
 * condition needing them is treated as "field unreadable" — the bucket
 * fails closed (include miss → no match) which is the correct fail-safe
 * for pre-enrichment matching.
 */
function attrsToEnriched(a: SaleAttrs): EnrichedSale {
  return {
    raw: {
      productName: a.productName ?? undefined,
      productCode: a.productCode ?? undefined,
      category: a.category ?? undefined,
      territory: a.territory ?? undefined,
      channel: a.channel ?? undefined,
    },
    product: null,
    customer: null,
    partner: null,
    channel: null,
    territory: null,
    productAttributes: {},
  };
}

/**
 * Pre-enrichment condition check used by the sales auto-matcher.
 * Returns true if the sale satisfies every condition bucket per the
 * standard include/exclude/AND-across-buckets semantics.
 */
export function evaluateConditionsForSale(
  conditions: Condition[],
  attrs: SaleAttrs
): boolean {
  return evaluateAttributeConditions(conditions, attrsToEnriched(attrs));
}

/**
 * Specificity score for a condition set, used by the matcher to break
 * ties when multiple rules across multiple contracts all match the same
 * sale. Higher = more specific. We count each non-wildcard condition as
 * one point; exclude buckets count too because "not in [a,b,c]" is still
 * a discriminating signal.
 */
export function conditionsSpecificity(conditions: Condition[]): number {
  if (!conditions || conditions.length === 0) return 0;
  let score = 0;
  for (const c of conditions) {
    const v = (c.value ?? "").toString().toLowerCase().trim();
    if (!v) continue;
    if (WILDCARDS.has(v)) continue;
    score += 1;
  }
  return score;
}

export function isExtendedCondition(c: Condition): boolean {
  const def = getDefaultAttribute(c.field);
  const attr = (c.attribute && c.attribute.trim()) || def || "";
  // Customer / Partner / Product Attribute / Channel-with-non-default /
  // Territory-with-non-default / Product-with-non-default -> extended.
  if (c.field === "customer" || c.field === "partner" || c.field === "product_attribute") {
    return true;
  }
  if (c.field === "channel" && attr !== "channel_name") return true;
  if (c.field === "territory" && attr !== "territory_name") return true;
  if (c.field === "product" && attr !== "name") return true;
  if (c.field === "product_category" && attr !== "name") return true;
  return false;
}
