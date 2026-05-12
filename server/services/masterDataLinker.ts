import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Linked-Master-Field resolver.
 *
 * Given a free-text value (typically from AI extraction) and a target master
 * table, returns a structured link result with confidence and method.
 *
 * Cascade:
 *   1. exact (case+whitespace insensitive) → 1.00 → verified
 *   2. normalized (strip legal suffixes/punct) → 0.95 → verified
 *   3. alphanumeric (strip everything but [a-z0-9]) → 0.90 → verified
 *   4. trigram fuzzy (pg_trgm) ≥ 0.70 → suggested
 *   5. AI semantic fallback (only if all above failed) → suggested
 */

export type LinkStatus = "verified" | "suggested" | "unlinked" | "manual";
export type LinkMethod =
  | "exact"
  | "normalized"
  | "alphanumeric"
  | "fuzzy"
  | "ai_semantic"
  | "manual";

export interface LinkAlternative {
  id: string;
  name: string;
  confidence: number;
  method: LinkMethod;
}

export interface LinkResult {
  resolvedId: string | null;
  resolvedName: string | null;
  status: LinkStatus;
  confidence: number;
  method: LinkMethod | null;
  rawValue: string;
  alternatives: LinkAlternative[];
}

const AUTO_VERIFY_THRESHOLD = 0.95;
const SUGGEST_THRESHOLD = 0.7;

const LEGAL_SUFFIX_RE =
  /\b(inc|incorporated|llc|ltd|limited|co|corp|corporation|company|gmbh|sa|ag|plc|llp|lp|pty|holdings?|group|intl|international|the)\b\.?/gi;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(LEGAL_SUFFIX_RE, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function alphanumeric(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface MasterRecord {
  id: string;
  name: string;
}

export interface LinkerOptions {
  /** Master table name (e.g. 'partner_master', 'companies'). */
  table: string;
  /** Column on the master table holding the human-readable name. */
  nameColumn: string;
  /** Column on the master table holding the canonical id. */
  idColumn?: string;
  /** Optional WHERE-clause fragment to scope candidates (e.g. by company). */
  scopeSql?: ReturnType<typeof sql>;
  /** Optional AI semantic resolver — invoked only when all deterministic tiers fail. */
  aiResolver?: (rawValue: string, candidates: MasterRecord[]) => Promise<{
    id: string;
    confidence: number;
  } | null>;
}

async function loadCandidates(opts: LinkerOptions): Promise<MasterRecord[]> {
  const idCol = opts.idColumn ?? "id";
  const baseQuery = sql`SELECT ${sql.raw(idCol)} AS id, ${sql.raw(
    opts.nameColumn,
  )} AS name FROM ${sql.raw(opts.table)} WHERE ${sql.raw(
    opts.nameColumn,
  )} IS NOT NULL`;
  const finalQuery = opts.scopeSql
    ? sql`${baseQuery} AND ${opts.scopeSql}`
    : baseQuery;
  const result: any = await db.execute(finalQuery);
  const rows = result.rows ?? result;
  return (rows as any[])
    .map((r) => ({ id: String(r.id), name: String(r.name ?? "") }))
    .filter((r) => r.name.length > 0);
}

async function trigramCandidates(
  rawValue: string,
  opts: LinkerOptions,
  limit = 5,
): Promise<Array<MasterRecord & { score: number }>> {
  const idCol = opts.idColumn ?? "id";
  try {
    const base = sql`SELECT ${sql.raw(idCol)} AS id, ${sql.raw(
      opts.nameColumn,
    )} AS name, similarity(${sql.raw(opts.nameColumn)}, ${rawValue}) AS score
      FROM ${sql.raw(opts.table)}
      WHERE ${sql.raw(opts.nameColumn)} IS NOT NULL`;
    const scoped = opts.scopeSql ? sql`${base} AND ${opts.scopeSql}` : base;
    const ordered = sql`${scoped} ORDER BY score DESC LIMIT ${limit}`;
    const result: any = await db.execute(ordered);
    const rows = (result.rows ?? result) as any[];
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      score: Number(r.score) || 0,
    }));
  } catch {
    // pg_trgm not available — skip silently
    return [];
  }
}

export async function resolveLink(
  rawValue: string | null | undefined,
  opts: LinkerOptions,
): Promise<LinkResult> {
  const cleanValue = (rawValue ?? "").trim();
  const baseResult: LinkResult = {
    resolvedId: null,
    resolvedName: null,
    status: "unlinked",
    confidence: 0,
    method: null,
    rawValue: cleanValue,
    alternatives: [],
  };
  if (!cleanValue) return baseResult;

  const candidates = await loadCandidates(opts);
  if (candidates.length === 0) return baseResult;

  const lower = cleanValue.toLowerCase();
  const normRaw = normalize(cleanValue);
  const alphaRaw = alphanumeric(cleanValue);

  // Tier 1: exact (case-insensitive trim)
  const exact = candidates.find((c) => c.name.trim().toLowerCase() === lower);
  if (exact) {
    return {
      ...baseResult,
      resolvedId: exact.id,
      resolvedName: exact.name,
      status: "verified",
      confidence: 1.0,
      method: "exact",
    };
  }

  // Tier 2: normalized
  const normMatch = candidates.find((c) => normalize(c.name) === normRaw);
  if (normMatch) {
    return {
      ...baseResult,
      resolvedId: normMatch.id,
      resolvedName: normMatch.name,
      status: "verified",
      confidence: 0.95,
      method: "normalized",
    };
  }

  // Tier 3: alphanumeric strip
  if (alphaRaw.length > 0) {
    const alphaMatch = candidates.find((c) => alphanumeric(c.name) === alphaRaw);
    if (alphaMatch) {
      return {
        ...baseResult,
        resolvedId: alphaMatch.id,
        resolvedName: alphaMatch.name,
        status: "verified",
        confidence: 0.9,
        method: "alphanumeric",
      };
    }
  }

  // Tier 4: trigram fuzzy via pg_trgm
  const trigrams = await trigramCandidates(cleanValue, opts, 5);
  const fuzzyTop = trigrams.find((t) => t.score >= SUGGEST_THRESHOLD);
  // Always return up to top 5 candidates regardless of score so the UI can
  // surface "best-effort" suggestions for the user to manually verify, even
  // when nothing crosses the suggest threshold. The legacy app behaved this
  // way and users prefer seeing low-confidence matches over an empty list.
  const alternatives: LinkAlternative[] = trigrams
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      name: t.name,
      confidence: Number(t.score.toFixed(2)),
      method: "fuzzy" as LinkMethod,
    }));

  if (fuzzyTop) {
    const status: LinkStatus =
      fuzzyTop.score >= AUTO_VERIFY_THRESHOLD ? "verified" : "suggested";
    return {
      ...baseResult,
      resolvedId: fuzzyTop.id,
      resolvedName: fuzzyTop.name,
      status,
      confidence: Number(fuzzyTop.score.toFixed(2)),
      method: "fuzzy",
      alternatives: alternatives.filter((a) => a.id !== fuzzyTop.id),
    };
  }

  // Tier 5: AI semantic fallback (only if deterministic tiers fail)
  if (opts.aiResolver) {
    try {
      const top10 = trigrams.length > 0 ? trigrams.slice(0, 10) : candidates.slice(0, 10);
      const ai = await opts.aiResolver(cleanValue, top10);
      if (ai && ai.confidence >= SUGGEST_THRESHOLD) {
        const aiPick = candidates.find((c) => c.id === ai.id);
        if (aiPick) {
          return {
            ...baseResult,
            resolvedId: aiPick.id,
            resolvedName: aiPick.name,
            status: ai.confidence >= AUTO_VERIFY_THRESHOLD ? "verified" : "suggested",
            confidence: Number(ai.confidence.toFixed(2)),
            method: "ai_semantic",
            alternatives,
          };
        }
      }
    } catch {
      // AI fallback failed — treat as unlinked
    }
  }

  return { ...baseResult, alternatives };
}

export async function resolvePartnerLink(
  rawValue: string | null | undefined,
  companyId?: string | null,
): Promise<LinkResult> {
  return resolveLink(rawValue, {
    table: "partner_master",
    nameColumn: "partner_name",
    idColumn: "id",
    scopeSql: companyId
      ? sql`record_status = 'Active' AND (company_id = ${companyId} OR company_id IS NULL)`
      : sql`record_status = 'Active'`,
  });
}

export async function resolveCompanyLink(
  rawValue: string | null | undefined,
): Promise<LinkResult> {
  return resolveLink(rawValue, {
    table: "companies",
    nameColumn: "company_name",
    idColumn: "company_id",
  });
}
