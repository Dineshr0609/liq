import { useState, useMemo, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import {
  Inbox, Search, Filter, Bot, Sparkles, Activity, ChevronRight, ChevronDown, Settings,
  FileText, FileSpreadsheet, Mail, Upload, Plug, PenLine, GitMerge, ShieldCheck, Wand2,
  Download, Users, RotateCw, AlertCircle,
} from "lucide-react";
import {
  agentIcon,
  agentRole,
  agentColor,
  type AgentName,
} from "@/lib/agentFleet";

type Path = "upload" | "email" | "connector" | "manual";
type Lane = "doc" | "data";

interface InboxRow {
  id: string;
  contractId: string;
  item: string;
  counterparty: string;
  source: Path;
  lane: Lane;
  stage: string;
  status: "ready" | "needs-review" | "needs-approval" | "agent-working" | "failed";
  received: string;
  aged: string;
  agedSeverity: "ok" | "warn" | "danger";
  agent: AgentName;
  agentNote: string;
  priorRuns?: number;
  failedStage?: string | null;
  errorLog?: string | null;
}

interface FleetMember {
  name: AgentName;
  state: "running" | "idle" | "paused";
  inflight: number;
  current: string;
  successRate: number;
  autonomy: "observe" | "suggest" | "approve" | "auto";
}

interface InboxResponse {
  rows: InboxRow[];
  counts: {
    total: number; needsAction: number; agentsWorking: number; awaitingApproval: number;
    ready: number; failed: number; stuck24h: number; unmatched: number;
    bySource: Record<Path, number>; byLane: { doc: number; data: number };
  };
  fleet: FleetMember[];
  recentActivity: { time: string; agent: AgentName; action: string; target: string; note: string; success?: boolean; danger?: boolean; warn?: boolean }[];
}

const pathMeta: Record<Path, { icon: any; tone: string; bg: string }> = {
  upload: { icon: Upload, tone: "text-orange-700", bg: "bg-orange-100" },
  email: { icon: Mail, tone: "text-blue-700", bg: "bg-blue-100" },
  connector: { icon: Plug, tone: "text-purple-700", bg: "bg-purple-100" },
  manual: { icon: PenLine, tone: "text-zinc-700", bg: "bg-zinc-200" },
};

// agentIcon / agentRole / agentColor live in @/lib/agentFleet.ts so the
// inbox's Agent Fleet strip and the contract page's agent peek use the
// same source of truth.

function PathPill({ path }: { path: Path }) {
  const m = pathMeta[path]; const Icon = m.icon;
  return <span className={`inline-flex items-center justify-center h-5 w-5 rounded ${m.bg} ${m.tone}`}><Icon className="h-2.5 w-2.5" /></span>;
}
function LaneTag({ lane }: { lane: Lane }) {
  return lane === "doc"
    ? <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded uppercase"><Sparkles className="h-2.5 w-2.5" />Extract</span>
    : <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase"><GitMerge className="h-2.5 w-2.5" />Map</span>;
}
function AutonomyBadge({ level }: { level: "observe" | "suggest" | "approve" | "auto" }) {
  const map = { observe: { l: "Observe", c: "bg-zinc-100 text-zinc-700 border-zinc-200" }, suggest: { l: "Suggest", c: "bg-blue-50 text-blue-700 border-blue-200" }, approve: { l: "Auto · approval", c: "bg-amber-50 text-amber-700 border-amber-200" }, auto: { l: "Auto", c: "bg-emerald-50 text-emerald-700 border-emerald-200" } } as const;
  const m = map[level];
  return <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${m.c}`}>{m.l}</span>;
}

export default function ContractsInbox() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useQuery<InboxResponse>({
    queryKey: ["/api/ingestion/inbox"],
    refetchInterval: (q) => {
      const rows = (q.state.data as InboxResponse | undefined)?.rows ?? [];
      return rows.some((r) => r.status === "agent-working") ? 3000 : 6000;
    },
    refetchIntervalInBackground: false,
  });
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/ingestion/inbox"] });
    refetch();
  };
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedFailure, setExpandedFailure] = useState<string | null>(null);

  const rows = data?.rows ?? [];
  const counts = data?.counts;
  const fleet = data?.fleet ?? [];

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search && !r.item.toLowerCase().includes(search.toLowerCase()) && !r.counterparty.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter === "needs-action" && !(r.status === "needs-review" || r.status === "needs-approval")) return false;
      if (statusFilter === "agent-working" && r.status !== "agent-working") return false;
      if (statusFilter === "ready" && r.status !== "ready") return false;
      if (statusFilter === "failed" && r.status !== "failed") return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const filterButton = (id: string, label: string, n: number, tone?: string) => (
    <button key={id} onClick={() => setStatusFilter(id)} data-testid={`filter-${id}`} className={`w-full flex items-center justify-between px-2 py-1 rounded hover:bg-zinc-100 ${statusFilter === id ? "bg-orange-50 text-orange-800 font-bold" : "text-zinc-700"}`}>
      <span className="truncate">{label}</span>
      <span className={`text-[10px] font-semibold ${tone || "text-zinc-500"}`}>{n}</span>
    </button>
  );

  return (
    <MainLayout>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans text-xs" data-testid="page-contracts-inbox">
        {/* Header */}
        <div className="bg-white border-b border-zinc-200">
          <div className="px-5 py-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-0.5">
                <span>Contracts</span><ChevronRight className="h-3 w-3" /><span>Ingest</span><ChevronRight className="h-3 w-3" /><span className="text-zinc-700 font-medium">Inbox</span>
              </div>
              <h1 className="text-lg font-bold text-zinc-900" data-testid="text-page-title">Ingestion Inbox</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input data-testid="input-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${rows.length} records…`} className="text-xs pl-7 pr-3 py-1.5 rounded-md border border-zinc-200 bg-white w-72 focus:outline-none focus:border-orange-400" />
              </div>
              <button
                onClick={handleRefresh}
                disabled={isFetching}
                title="Refresh inbox"
                className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white inline-flex items-center gap-1.5 text-zinc-700 hover:bg-zinc-50 hover:border-orange-300 disabled:opacity-50"
                data-testid="button-refresh-inbox"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-orange-600" : ""}`} />
                {isFetching ? "Refreshing…" : "Refresh"}
              </button>
              <button disabled className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white inline-flex items-center gap-1.5 text-zinc-400" data-testid="button-export"><Download className="h-3.5 w-3.5" />Export</button>
              <button disabled className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white inline-flex items-center gap-1.5 text-zinc-400" data-testid="button-agent-settings"><Settings className="h-3.5 w-3.5" />Agent settings</button>
            </div>
          </div>
        </div>

        {/* Agent fleet strip */}
        <div className="bg-gradient-to-b from-orange-50/60 to-white border-b border-orange-100 px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-orange-700" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-orange-800">Agent Fleet</h2>
              <span className="text-[10px] text-zinc-500">{fleet.length} agents · {counts?.agentsWorking ?? 0} in flight · {counts?.total ?? 0} total tracked</span>
            </div>
            <span className="text-[10px] text-zinc-500 italic">Display-only — autonomy controls ship Phase B</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {fleet.map((a) => {
              const Icon = agentIcon[a.name];
              return (
                <div key={a.name} className="bg-white border border-zinc-200 rounded-md p-2.5 relative" data-testid={`agent-card-${a.name.toLowerCase()}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-7 w-7 rounded-md bg-zinc-50 flex items-center justify-center ${agentColor[a.name]}`}><Icon className="h-3.5 w-3.5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-zinc-900 truncate flex items-center gap-1">
                        {a.name}
                        <span className={`h-1.5 w-1.5 rounded-full ${a.state === "running" ? "bg-emerald-500 animate-pulse" : "bg-zinc-300"}`} />
                      </div>
                      <div className="text-[9px] text-zinc-500 truncate">{agentRole[a.name]}</div>
                    </div>
                  </div>
                  <div className="text-[9px] text-zinc-700 bg-zinc-50 rounded px-1.5 py-1 leading-tight mb-1.5 truncate" title={a.current}>
                    <span className="text-orange-600 font-bold">▸</span> {a.current}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <AutonomyBadge level={a.autonomy} />
                    <div className="text-[9px] text-zinc-500"><span className="font-bold text-zinc-700">{a.inflight}</span> in flight</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex">
          {/* Filter rail */}
          <aside className="w-56 shrink-0 bg-white border-r border-zinc-200 px-3 py-3 space-y-3 text-[11px]">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Status</div>
              {filterButton("all", "Inbox (all)", counts?.total ?? 0)}
              {filterButton("needs-action", "Needs my action", counts?.needsAction ?? 0, "text-amber-700")}
              {filterButton("agent-working", "Agents working on it", counts?.agentsWorking ?? 0, "text-blue-700")}
              {filterButton("ready", "Ready to activate", counts?.ready ?? 0, "text-emerald-700")}
              {filterButton("failed", "Failed / stuck", counts?.failed ?? 0, "text-rose-700")}
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-between"><span>Source</span><ChevronDown className="h-3 w-3" /></div>
              {(["upload", "email", "connector", "manual"] as Path[]).map((p) => (
                <button key={p} className="w-full flex items-center justify-between px-2 py-0.5 rounded hover:bg-zinc-100 text-zinc-700">
                  <span className="inline-flex items-center gap-1.5"><PathPill path={p} />{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                  <span className="text-[10px] text-zinc-500">{counts?.bySource?.[p] ?? 0}</span>
                </button>
              ))}
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Lane</div>
              <button className="w-full flex items-center justify-between px-2 py-0.5 rounded hover:bg-zinc-100 text-zinc-700"><LaneTag lane="doc" /><span className="text-[10px] text-zinc-500">{counts?.byLane?.doc ?? 0}</span></button>
              <button className="w-full flex items-center justify-between px-2 py-0.5 rounded hover:bg-zinc-100 text-zinc-700"><LaneTag lane="data" /><span className="text-[10px] text-zinc-500">{counts?.byLane?.data ?? 0}</span></button>
            </div>
          </aside>

          {/* Table */}
          <div className="flex-1 min-w-0">
            <div className="bg-white border-b border-zinc-200 px-4 py-2 flex items-center gap-3">
              <span className="text-[11px] text-zinc-500"><span className="font-bold text-zinc-800">{filtered.length}</span> shown of {rows.length}</span>
              <div className="ml-auto flex items-center gap-2 text-[10px] text-zinc-500"><Filter className="h-3 w-3" /><span>Showing all-time · sorted by aged ↓</span></div>
            </div>

            <div className="overflow-x-auto">
            <table className="w-full text-[11px] table-fixed">
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "70px" }} />
                <col style={{ width: "60px" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "90px" }} />
              </colgroup>
              <thead className="bg-zinc-50 text-[9px] uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Item</th>
                  <th className="text-left font-semibold px-2 py-2">Src · Lane</th>
                  <th className="text-left font-semibold px-2 py-2">Stage</th>
                  <th className="text-left font-semibold px-2 py-2">Status</th>
                  <th className="text-left font-semibold px-2 py-2">Received</th>
                  <th className="text-left font-semibold px-2 py-2">Aged</th>
                  <th className="text-left font-semibold px-2 py-2">Agent on it</th>
                  <th className="text-right font-semibold px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {isLoading && <tr><td colSpan={8} className="px-3 py-8 text-center text-zinc-500">Loading…</td></tr>}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-12 text-center text-zinc-500">
                    <Inbox className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                    <div className="font-semibold">Inbox is empty</div>
                    <div className="text-[10px] mt-1">Upload a contract from <Link href="/contracts/ingest"><a className="text-orange-700 hover:underline">Ingest</a></Link> to see it here.</div>
                  </td></tr>
                )}
                {filtered.map((r, idx) => {
                  const statusMap: Record<string, { dot: string; text: string; bg: string; label: string }> = {
                    ready: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Ready" },
                    "needs-review": { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Needs review" },
                    "needs-approval": { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", label: "Needs approval" },
                    "agent-working": { dot: "bg-blue-500 animate-pulse", text: "text-blue-700", bg: "bg-blue-50", label: "Agent working" },
                    failed: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", label: "Failed" },
                  };
                  const s = statusMap[r.status];
                  const isFailed = r.status === "failed";
                  const isExpanded = expandedFailure === r.id;
                  return (
                    <Fragment key={r.id}>
                    <tr className="hover:bg-zinc-50" data-testid={`row-inbox-${r.id}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-zinc-900 truncate max-w-[260px] flex items-center gap-1">
                          {r.lane === "doc" ? <FileText className="h-3 w-3 text-zinc-400 shrink-0" /> : <FileSpreadsheet className="h-3 w-3 text-zinc-400 shrink-0" />}
                          <span className="truncate">{r.item}</span>
                          {(r.priorRuns || 0) > 0 && (
                            <span
                              className="shrink-0 text-[9px] font-semibold px-1 py-0 rounded bg-zinc-100 text-zinc-600 border border-zinc-200"
                              title={`${r.priorRuns} earlier extraction attempt${(r.priorRuns || 0) > 1 ? "s" : ""} for this file`}
                            >
                              +{r.priorRuns}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">{r.counterparty}</div>
                      </td>
                      <td className="px-2 py-2"><div className="flex items-center gap-1"><PathPill path={r.source} /><LaneTag lane={r.lane} /></div></td>
                      <td className="px-2 py-2 text-zinc-700">
                        <div className="truncate" title={r.stage}>{r.stage}</div>
                        {isFailed && r.failedStage ? <div className="text-[10px] text-rose-700 font-bold truncate">@ Stage {r.failedStage}</div> : null}
                      </td>
                      <td className="px-2 py-2"><span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span></td>
                      <td className="px-2 py-2 text-zinc-500 text-[10px]">{r.received}</td>
                      <td className="px-2 py-2"><span className={`text-[10px] font-bold ${r.agedSeverity === "danger" ? "text-rose-700" : r.agedSeverity === "warn" ? "text-amber-700" : "text-zinc-600"}`}>{r.aged}</span></td>
                      <td className="px-2 py-2 min-w-0">
                        <div className="text-[10px] font-semibold text-zinc-800 inline-flex items-center gap-1"><Bot className="h-2.5 w-2.5 text-orange-600 shrink-0" />{r.agent}</div>
                        <div className="text-[9px] truncate text-zinc-600" title={r.agentNote}>{r.agentNote}</div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {isFailed && (
                          <button
                            type="button"
                            onClick={() => setExpandedFailure(isExpanded ? null : r.id)}
                            className="text-[10px] font-bold text-rose-700 hover:text-rose-800 mr-2"
                            data-testid={`button-failure-${r.id}`}
                          >
                            {isExpanded ? "Hide" : "Why?"}
                          </button>
                        )}
                        <Link href={`/contracts/${r.contractId}`} data-testid={`link-open-${r.id}`}><a className="text-[10px] font-bold text-orange-700 hover:text-orange-800">Open →</a></Link>
                      </td>
                    </tr>
                    {isFailed && isExpanded && (
                      <tr className="bg-rose-50 border-l-2 border-rose-500">
                        <td colSpan={8} className="px-5 py-3">
                          <div className="text-[10px] font-bold text-rose-900 mb-1">
                            Failed at Stage {r.failedStage || "?"} · Agent: {r.agent}
                          </div>
                          <pre className="text-[10px] font-mono text-rose-800 bg-white border border-rose-200 rounded px-2 py-1.5 whitespace-pre-wrap break-all max-h-48 overflow-y-auto" data-testid={`text-error-${r.id}`}>
{r.errorLog || "(no error log captured)"}
                          </pre>
                          <div className="text-[10px] text-rose-700 mt-1">
                            Run id: <span className="font-mono">{r.id}</span> · Contract id: <span className="font-mono">{r.contractId}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Activity stream */}
        {data?.recentActivity && data.recentActivity.length > 0 && (
          <div className="px-5 py-4 bg-zinc-100 border-t border-zinc-200">
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-900 inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-orange-600" />Agent activity stream</h3>
                <span className="text-[10px] text-zinc-500">Last {data.recentActivity.length} events</span>
              </div>
              <div className="divide-y divide-zinc-100 max-h-[320px] overflow-y-auto">
                {data.recentActivity.map((e, i) => {
                  const Icon = agentIcon[e.agent];
                  return (
                    <div key={i} className="px-3 py-2 hover:bg-zinc-50 flex items-start gap-2 text-[11px]">
                      <span className="text-[9px] font-mono text-zinc-400 shrink-0 mt-0.5 w-16">{e.time}</span>
                      <Icon className={`h-3 w-3 shrink-0 mt-0.5 ${agentColor[e.agent]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-zinc-900"><span className={`font-bold ${agentColor[e.agent]}`}>{e.agent}</span> · {e.action} · <span className="font-medium">{e.target}</span></div>
                        <div className={`text-[10px] truncate ${e.success ? "text-emerald-700" : e.danger ? "text-rose-700" : e.warn ? "text-amber-700" : "text-zinc-500"}`}>{e.note}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
