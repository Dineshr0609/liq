import { useEffect, useRef, useState } from "react";
import { Bot, AlertCircle, CheckCircle2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityRow {
  id: string;
  agentName: string | null;
  scope: string | null;
  scopeId: string | null;
  step: string;
  status: string;
  summary: string | null;
  details?: any;
  createdAt: string | null;
}

interface AgentActivityBarProps {
  /** Optional scope filter (claim | document | deduction). Empty = show all. */
  scope?: string;
  className?: string;
}

const MAX_ROWS = 12;

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 5_000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function statusIcon(status: string) {
  if (status === "error") return <AlertCircle className="h-3 w-3 text-red-600" />;
  if (status === "warn") return <AlertCircle className="h-3 w-3 text-amber-600" />;
  if (status === "success") return <CheckCircle2 className="h-3 w-3 text-emerald-600" />;
  return <Activity className="h-3 w-3 text-orange-600" />;
}

export function AgentActivityBar({ scope, className }: AgentActivityBarProps) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [live, setLive] = useState(false);
  const tickRef = useRef(0);
  const [, force] = useState(0);

  // Initial backfill
  useEffect(() => {
    let cancelled = false;
    fetch("/api/agent-activity?limit=50", { credentials: "include" })
      .then(r => r.json())
      .then((all: ActivityRow[]) => {
        if (cancelled) return;
        const filtered = scope ? all.filter(r => r.scope === scope) : all;
        setRows(filtered.slice(0, MAX_ROWS));
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [scope]);

  // Live SSE stream
  useEffect(() => {
    const es = new EventSource("/api/agent-activity/stream", { withCredentials: true } as any);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (ev) => {
      try {
        const r: ActivityRow = JSON.parse(ev.data);
        if (scope && r.scope !== scope) return;
        setRows(prev => [r, ...prev.filter(p => p.id !== r.id)].slice(0, MAX_ROWS));
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [scope]);

  // Re-render every 10s so "time ago" stays fresh.
  useEffect(() => {
    const i = setInterval(() => force(++tickRef.current), 10_000);
    return () => clearInterval(i);
  }, []);

  return (
    <div
      data-testid="agent-activity-bar"
      className={cn(
        "flex items-center gap-3 overflow-hidden border-b border-neutral-200 bg-gradient-to-r from-orange-50/40 via-white to-white px-4 py-1.5",
        className,
      )}
    >
      <div className="flex flex-shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
        <Bot className="h-3.5 w-3.5 text-orange-600" />
        Agent
        <span className={cn(
          "ml-1 inline-block h-1.5 w-1.5 rounded-full",
          live ? "animate-pulse bg-emerald-500" : "bg-neutral-300",
        )} title={live ? "Live" : "Reconnecting…"} />
      </div>
      <div className="flex flex-1 items-center gap-4 overflow-x-auto whitespace-nowrap text-[11px] text-neutral-700 scrollbar-none">
        {rows.length === 0 && (
          <span className="text-neutral-400">No recent agent activity.</span>
        )}
        {rows.map(r => (
          <div
            key={r.id}
            data-testid={`agent-activity-${r.id}`}
            className="flex items-center gap-1.5"
          >
            {statusIcon(r.status)}
            <span className="font-medium text-neutral-900">{r.step.replace(/_/g, " ")}</span>
            <span className="text-neutral-600">— {r.summary || (r.scope ? `${r.scope}` : "")}</span>
            <span className="text-neutral-400">· {timeAgo(r.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
