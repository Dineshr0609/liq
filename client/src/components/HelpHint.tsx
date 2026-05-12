import { HelpCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { findArticle } from "@/help/registry";

// Tiny ?-icon trigger that opens a popover with the article summary and a
// link to the full Help Center page. Drop next to any UI label that benefits
// from contextual explanation. Renders nothing if the articleId doesn't
// exist (so removing an article doesn't crash the calling page).
//
//   <Label>Verified <HelpHint articleId="verify-traffic-light" /></Label>
export default function HelpHint({
  articleId,
  side = "top",
  className = "",
}: {
  articleId: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  const article = findArticle(articleId);
  if (!article) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Help: ${article.title}`}
          className={`inline-flex items-center justify-center text-zinc-400 hover:text-orange-600 transition ${className}`}
          data-testid={`button-help-hint-${articleId}`}
          onClick={(e) => e.stopPropagation()}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align="start" className="w-72 p-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
          {article.category}
        </div>
        <div className="font-semibold text-sm text-zinc-900 mb-1">{article.title}</div>
        <div className="text-xs text-zinc-600 leading-relaxed mb-3">{article.summary}</div>
        <Link
          href={`/help/${article.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-800"
          data-testid={`link-help-hint-open-${articleId}`}
        >
          Read full article <ArrowRight className="h-3 w-3" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}
