// Central registry of all Help Center articles. Each article module exports
// `meta` (id, title, category, summary, tags, updatedAt) and a default React
// component for the body. Adding a new article = create a file in
// `client/src/help/articles/` and append it here.

import type { ComponentType } from "react";

import * as gettingStarted from "./articles/getting-started";
import * as uploadActivate from "./articles/upload-activate-contract";
import * as contractIngestInbox from "./articles/contract-ingest-inbox";
import * as templateLibrary from "./articles/template-library";
import * as verifyTrafficLight from "./articles/verify-traffic-light";
import * as configureRebate from "./articles/configure-rebate-rule";
import * as configureRoyalty from "./articles/configure-royalty-rule";
import * as financeHubOverview from "./articles/finance-hub-overview";
import * as accrualManagement from "./articles/accrual-management";
import * as outstandingObligations from "./articles/outstanding-obligations";
import * as periodCloseWorkspace from "./articles/period-close-workspace";
import * as settlementWorkspace from "./articles/settlement-workspace";
import * as claimsWorkspace from "./articles/claims-workspace";
import * as liqAiKnowledge from "./articles/liq-ai-knowledge";
import * as glossary from "./articles/glossary";
import * as faq from "./articles/faq";

export type HelpCategory =
  | "Getting Started"
  | "How-To Guides"
  | "Concepts"
  | "Reference"
  | "FAQ & Troubleshooting";

export interface HelpArticleMeta {
  id: string;
  title: string;
  category: HelpCategory;
  summary: string;
  tags: string[];
  updatedAt: string; // ISO date
  // Optional list of route prefixes this article is contextually relevant to.
  // The contextual <HelpHint> component on those pages will surface it.
  contextRoutes?: string[];
}

export interface HelpArticle extends HelpArticleMeta {
  Body: ComponentType;
  /** Lowercased plain-text body cache for substring search. */
  searchText: string;
}

const modules = [
  gettingStarted,
  uploadActivate,
  contractIngestInbox,
  templateLibrary,
  verifyTrafficLight,
  configureRebate,
  configureRoyalty,
  financeHubOverview,
  accrualManagement,
  outstandingObligations,
  periodCloseWorkspace,
  settlementWorkspace,
  claimsWorkspace,
  liqAiKnowledge,
  glossary,
  faq,
] as Array<{ meta: HelpArticleMeta; default: ComponentType; searchText?: string }>;

export const HELP_ARTICLES: HelpArticle[] = modules.map((m) => ({
  ...m.meta,
  Body: m.default,
  searchText: (m.searchText || "").toLowerCase(),
}));

export const HELP_CATEGORIES: HelpCategory[] = [
  "Getting Started",
  "How-To Guides",
  "Concepts",
  "Reference",
  "FAQ & Troubleshooting",
];

export function findArticle(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.id === id);
}

export function searchArticles(query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return HELP_ARTICLES.filter((a) => {
    const hay = `${a.title.toLowerCase()} ${a.summary.toLowerCase()} ${a.tags.join(" ").toLowerCase()} ${a.searchText}`;
    return tokens.every((t) => hay.includes(t));
  });
}

export function articlesForRoute(pathname: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) =>
    (a.contextRoutes || []).some((prefix) => pathname.startsWith(prefix)),
  );
}
