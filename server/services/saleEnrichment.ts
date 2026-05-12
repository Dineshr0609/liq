import { db } from "../db";
import { sql } from "drizzle-orm";

export interface EnrichedSale {
  raw: {
    productName?: string;
    productCode?: string | null;
    category?: string;
    territory?: string;
    channel?: string;
    customerCode?: string | null;
  };
  product: Record<string, any> | null;
  customer: Record<string, any> | null;
  partner: Record<string, any> | null;
  channel: Record<string, any> | null;
  territory: Record<string, any> | null;
  productAttributes: Record<string, string>;
}

const norm = (v: any): string =>
  (v == null ? "" : String(v)).toLowerCase().trim();

export class SaleEnricher {
  private productsById = new Map<string, any>();
  private productsByCode = new Map<string, any>();
  private productsByName = new Map<string, any>();
  private customersByCode = new Map<string, any>();
  private customersByName = new Map<string, any>();
  private channelsByName = new Map<string, any>();
  private channelsByCode = new Map<string, any>();
  private territoriesByName = new Map<string, any>();
  private territoriesByCode = new Map<string, any>();
  private attrsByProductId = new Map<string, Record<string, string>>();
  private partner: any = null;
  private initialized = false;

  constructor(private contractId: string, private companyId: string) {}

  async init(): Promise<void> {
    if (this.initialized) return;

    const [
      productsRes,
      customersRes,
      channelsRes,
      territoriesRes,
      attrsRes,
      partnerRes,
    ] = await Promise.all([
      db.execute(sql`SELECT * FROM products WHERE company_id = ${this.companyId}`),
      db.execute(sql`SELECT * FROM customers WHERE company_id = ${this.companyId}`),
      db.execute(sql`SELECT * FROM sales_channels`),
      db.execute(sql`SELECT * FROM territory_master`),
      db.execute(sql`
        SELECT pa.product_id, pa.attribute_name, pa.attribute_value
        FROM product_attributes pa
        JOIN products p ON p.id = pa.product_id
        WHERE p.company_id = ${this.companyId}
      `),
      db.execute(sql`
        SELECT pm.* FROM partner_master pm
        JOIN contracts c ON c.counterparty_partner_id = pm.id
        WHERE c.id = ${this.contractId}
        LIMIT 1
      `),
    ]);

    const productRows = ((productsRes as any).rows ?? productsRes) as any[];
    for (const p of productRows) {
      if (p.id) this.productsById.set(p.id, p);
      if (p.product_code) this.productsByCode.set(norm(p.product_code), p);
      if (p.sku) this.productsByCode.set(norm(p.sku), p);
      if (p.product_name) this.productsByName.set(norm(p.product_name), p);
    }

    const customerRows = ((customersRes as any).rows ?? customersRes) as any[];
    for (const c of customerRows) {
      if (c.code) this.customersByCode.set(norm(c.code), c);
      if (c.name) this.customersByName.set(norm(c.name), c);
    }

    const channelRows = ((channelsRes as any).rows ?? channelsRes) as any[];
    for (const ch of channelRows) {
      if (ch.channel_name) this.channelsByName.set(norm(ch.channel_name), ch);
      if (ch.channel_code) this.channelsByCode.set(norm(ch.channel_code), ch);
    }

    const territoryRows = ((territoriesRes as any).rows ?? territoriesRes) as any[];
    for (const t of territoryRows) {
      if (t.territory_name) this.territoriesByName.set(norm(t.territory_name), t);
      if (t.territory_code) this.territoriesByCode.set(norm(t.territory_code), t);
    }

    const attrRows = ((attrsRes as any).rows ?? attrsRes) as any[];
    for (const a of attrRows) {
      const pid = a.product_id;
      if (!pid) continue;
      if (!this.attrsByProductId.has(pid)) this.attrsByProductId.set(pid, {});
      this.attrsByProductId.get(pid)![a.attribute_name] = a.attribute_value;
    }

    const partnerRows = ((partnerRes as any).rows ?? partnerRes) as any[];
    this.partner = partnerRows[0] ?? null;

    this.initialized = true;
  }

  enrich(sale: {
    productName?: string;
    productCode?: string | null;
    category?: string;
    territory?: string;
    channel?: string;
    customerCode?: string | null;
  }): EnrichedSale {
    let product: any = null;
    if (sale.productCode) product = this.productsByCode.get(norm(sale.productCode)) ?? null;
    if (!product && sale.productName) product = this.productsByName.get(norm(sale.productName)) ?? null;

    let customer: any = null;
    if (sale.customerCode) customer = this.customersByCode.get(norm(sale.customerCode)) ?? null;

    let channel: any = null;
    if (sale.channel) {
      channel =
        this.channelsByName.get(norm(sale.channel)) ??
        this.channelsByCode.get(norm(sale.channel)) ??
        null;
    }

    let territory: any = null;
    if (sale.territory) {
      territory =
        this.territoriesByName.get(norm(sale.territory)) ??
        this.territoriesByCode.get(norm(sale.territory)) ??
        null;
    }

    const productAttributes =
      product && this.attrsByProductId.get(product.id)
        ? this.attrsByProductId.get(product.id)!
        : {};

    return {
      raw: sale,
      product,
      customer,
      partner: this.partner,
      channel,
      territory,
      productAttributes,
    };
  }
}
