import { useMemo, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Search, BookOpen, ArrowLeft, Bot } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  findArticle,
  searchArticles,
  type HelpCategory,
} from "@/help/registry";

// In-app Help Center. /help shows the index (search + categorised list).
// /help/:id renders a single article. Articles are TSX modules in
// `client/src/help/articles/`; the registry stitches them together so adding
// a new article is just: write the file, append to registry.

export default function HelpPage() {
  const params = useParams<{ id?: string }>();
  const articleId = params.id;
  const article = articleId ? findArticle(articleId) : undefined;

  return (
    <MainLayout title="Help Center" description="Guides, references, and FAQs for LicenseIQ">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {article ? <ArticleView articleId={article.id} /> : <HelpIndex />}
      </div>
    </MainLayout>
  );
}

function HelpIndex() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const results = useMemo(() => (query.trim() ? searchArticles(query) : null), [query]);

  // When the local article search comes up empty, route the question to
  // liQ AI on the dedicated Q&A page with the query pre-filled. The unanswered
  // search becomes a content gap we can later turn into a new article.
  const askLiqAi = () => {
    if (!query.trim()) return;
    setLocation(`/contract-qna?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="h-5 w-5 text-orange-600" />
        <h1 className="text-2xl font-bold text-zinc-900">Help Center</h1>
      </div>
      <p className="text-sm text-zinc-600 mb-6">
        Everything you need to get the most out of LicenseIQ — from your first upload
        to advanced calculation patterns.
      </p>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles, e.g. 'rebate tiers' or 'why is verify greyed out'…"
          className="w-full text-sm pl-10 pr-3 py-2.5 rounded-md border border-zinc-200 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-200"
          data-testid="input-help-search"
          autoFocus
        />
      </div>

      {results !== null ? (
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-bold mb-3">
            {results.length} result{results.length === 1 ? "" : "s"}
          </div>
          {results.length === 0 ? (
            <div className="border border-dashed border-zinc-200 rounded-md p-6 text-center">
              <div className="text-sm text-zinc-600 mb-3">
                No matching articles for "<span className="font-semibold text-zinc-800">{query}</span>".
              </div>
              <button
                onClick={askLiqAi}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium"
                data-testid="button-help-ask-liq"
              >
                <Bot className="h-4 w-4" /> Ask liQ AI: "{query.length > 60 ? query.slice(0, 60) + "…" : query}"
              </button>
              <div className="text-[11px] text-zinc-400 mt-2">
                Your question helps us find content gaps.
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {results.map((a) => (
                <ArticleCard key={a.id} {...a} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {HELP_CATEGORIES.map((cat) => {
            const list = HELP_ARTICLES.filter((a) => a.category === cat);
            if (list.length === 0) return null;
            return <CategorySection key={cat} category={cat} articles={list} />;
          })}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  articles,
}: {
  category: HelpCategory;
  articles: typeof HELP_ARTICLES;
}) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-zinc-500 font-bold mb-3">
        {category}
      </h2>
      <ul className="space-y-2">
        {articles.map((a) => (
          <ArticleCard key={a.id} {...a} />
        ))}
      </ul>
    </div>
  );
}

function ArticleCard({
  id,
  title,
  summary,
  category,
}: {
  id: string;
  title: string;
  summary: string;
  category: string;
}) {
  return (
    <li>
      <Link
        href={`/help/${id}`}
        className="block border border-zinc-200 hover:border-orange-300 hover:bg-orange-50/40 rounded-md p-3 transition"
        data-testid={`card-help-article-${id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-zinc-900 text-sm">{title}</div>
            <div className="text-xs text-zinc-600 mt-0.5">{summary}</div>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold shrink-0 mt-1">
            {category}
          </span>
        </div>
      </Link>
    </li>
  );
}

function ArticleView({ articleId }: { articleId: string }) {
  const article = findArticle(articleId);
  if (!article) {
    return (
      <div>
        <Link href="/help" className="text-sm text-orange-700 hover:text-orange-800 inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Help Center
        </Link>
        <div className="mt-6 text-sm text-zinc-500">Article not found.</div>
      </div>
    );
  }
  const Body = article.Body;
  return (
    <div>
      <Link href="/help" className="text-sm text-orange-700 hover:text-orange-800 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Help Center
      </Link>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">
        {article.category}
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mt-1">{article.title}</h1>
      <div className="text-sm text-zinc-500 mt-1">
        Updated {new Date(article.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
      </div>
      <article className="prose prose-zinc max-w-none mt-6">
        <Body />
      </article>
    </div>
  );
}
