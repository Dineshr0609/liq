/**
 * documentSequenceService — fixed {TYPE}-{YYYY}-{SEQ} document numbering.
 * Phase A: counts existing finance_documents per type+year.
 *
 * Claims share the same year-bucketed sequence shape (CLM-YYYY-NNNNN) so
 * users see human-readable identifiers everywhere a claim is referenced
 * (banner in the credit-memo edit dialog, source-claim card, etc.) instead
 * of an opaque UUID slice.
 */
import { db } from "../db";
import { financeDocuments, inboundClaims } from "@shared/schema";
import { sql, like } from "drizzle-orm";

const PREFIX: Record<string, string> = {
  ap_invoice: "API",
  ar_invoice: "ARI",
  credit_memo: "CM",
  debit_memo: "DM",
};

export async function nextDocumentNumber(documentType: string): Promise<string> {
  const prefix = PREFIX[documentType] || documentType.toUpperCase();
  const year = new Date().getUTCFullYear();
  const pattern = `${prefix}-${year}-%`;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(financeDocuments)
    .where(like(financeDocuments.documentNumber, pattern));
  const seq = (Number(rows[0]?.count || 0) + 1).toString().padStart(5, "0");
  return `${prefix}-${year}-${seq}`;
}

/**
 * Reserve the next CLM-{YYYY}-{NNNNN} number for an inbound claim. Counts
 * existing rows for the current year — gaps left by deletions are not
 * back-filled, which matches the document-number behavior above.
 */
export async function nextInboundClaimNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const pattern = `CLM-${year}-%`;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(inboundClaims)
    .where(like(inboundClaims.claimNumber, pattern));
  const seq = (Number(rows[0]?.count || 0) + 1).toString().padStart(5, "0");
  return `CLM-${year}-${seq}`;
}
