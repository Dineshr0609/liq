import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Filter, Bot } from "lucide-react";

export interface FilterChip {
  key: string;
  label: string;
  count?: number;
}

export interface ViewModeTab {
  key: string;
  label: string;
}

export interface QueueGroup<T> {
  key: string;
  label: string;
  tone?: "urgent" | "agent" | "standard";
  items: T[];
}

export interface WorkspaceShellProps<T> {
  /** Title shown above the queue column. */
  queueTitle: string;
  viewModes?: ViewModeTab[];
  activeViewMode?: string;
  onViewModeChange?: (key: string) => void;
  filterChips?: FilterChip[];
  activeFilters?: string[];
  onToggleFilter?: (key: string) => void;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  groups: QueueGroup<T>[];
  renderQueueItem: (item: T, isSelected: boolean) => ReactNode;
  selectedId?: string | null;
  onSelectItem: (item: T) => void;
  detail?: ReactNode;
  agentPanel?: ReactNode;
  toolbar?: ReactNode;
  loading?: boolean;
  /** Optional KPI strip rendered above the queue/detail/agent panels. */
  kpiStrip?: ReactNode;
  /** Optional thin live-activity bar rendered between the KPI strip and the columns. */
  activityBar?: ReactNode;
}

export function WorkspaceShell<T extends { id: string }>(props: WorkspaceShellProps<T>) {
  const {
    queueTitle, viewModes = [], activeViewMode, onViewModeChange,
    filterChips = [], activeFilters = [], onToggleFilter,
    searchValue, onSearchChange, groups, renderQueueItem, selectedId,
    onSelectItem, detail, agentPanel, toolbar, loading, kpiStrip, activityBar,
  } = props;
  const [agentOpen, setAgentOpen] = useState(true);

  // Account for both the KPI strip (~5rem) and the activity bar (~2rem) when
  // computing the inner column height so nothing scrolls behind the chrome.
  const heightClass = kpiStrip && activityBar
    ? "h-[calc(100vh-16rem)]"
    : kpiStrip
      ? "h-[calc(100vh-14rem)]"
      : activityBar
        ? "h-[calc(100vh-11rem)]"
        : "h-[calc(100vh-9rem)]";

  return (
    <div className="flex flex-col">
    {kpiStrip}
    {activityBar}
    <div className={cn("flex gap-2 bg-white", heightClass)}>
      {/* Queue column */}
      <aside className="flex w-[340px] flex-shrink-0 flex-col rounded-lg border border-neutral-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-neutral-200 px-3 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-900">{queueTitle}</h2>
            {toolbar}
          </div>
          {viewModes.length > 0 && (
            <div className="flex gap-1 rounded-md bg-neutral-100 p-1">
              {viewModes.map(v => (
                <button
                  key={v.key}
                  onClick={() => onViewModeChange?.(v.key)}
                  data-testid={`viewmode-${v.key}`}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-xs font-medium",
                    activeViewMode === v.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                  )}
                >{v.label}</button>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <Input
              value={searchValue || ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-7 text-xs"
              data-testid="input-workspace-search"
            />
          </div>
          {filterChips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {filterChips.map(chip => {
                const active = activeFilters.includes(chip.key);
                return (
                  <button
                    key={chip.key}
                    onClick={() => onToggleFilter?.(chip.key)}
                    data-testid={`filter-${chip.key}`}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                      active
                        ? "border-orange-600 bg-orange-50 text-orange-700"
                        : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    )}
                  >
                    {chip.label}{typeof chip.count === "number" ? ` · ${chip.count}` : ""}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-3 p-2">
            {loading && <div className="p-4 text-center text-xs text-neutral-500">Loading…</div>}
            {!loading && groups.every(g => g.items.length === 0) && (
              <div className="p-6 text-center text-xs text-neutral-500">
                <div>No items match the current filters.</div>
                <div className="mt-1 text-[10px] text-neutral-400">↓ inbound · ↑ outbound</div>
              </div>
            )}
            {groups.map(group => group.items.length > 0 && (
              <div key={group.key}>
                <div className={cn(
                  "mb-1 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider",
                  group.tone === "urgent" && "text-orange-700",
                  group.tone === "agent" && "text-neutral-900",
                  group.tone === "standard" && "text-neutral-500",
                )}>
                  {group.tone === "urgent" && <span className="h-1.5 w-1.5 rounded-full bg-orange-600" />}
                  {group.tone === "agent" && <Bot className="h-3 w-3" />}
                  <span>{group.label}</span>
                  <span className="ml-auto text-neutral-400">{group.items.length}</span>
                </div>
                <div className="space-y-1">
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      data-testid={`queue-item-${item.id}`}
                      onClick={() => onSelectItem(item)}
                      className={cn(
                        "block w-full rounded-md border px-3 py-2 text-left text-xs transition",
                        selectedId === item.id
                          ? "border-orange-600 bg-orange-50"
                          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                      )}
                    >
                      {renderQueueItem(item, selectedId === item.id)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Detail */}
      <main className="flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-6">{detail || <EmptyDetail />}</div>
        </ScrollArea>
      </main>

      {/* Agent panel */}
      {agentPanel && (
        <aside className={cn(
          "flex flex-shrink-0 flex-col rounded-lg border border-neutral-200 bg-white transition-all",
          agentOpen ? "w-[300px]" : "w-12"
        )}>
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
            {agentOpen ? (
              <>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-900">
                  <Bot className="h-3.5 w-3.5 text-orange-600" /> Agent
                </div>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setAgentOpen(false)} data-testid="button-close-agent">×</Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setAgentOpen(true)} data-testid="button-open-agent">
                <Bot className="h-4 w-4" />
              </Button>
            )}
          </div>
          {agentOpen && <ScrollArea className="flex-1"><div className="p-3">{agentPanel}</div></ScrollArea>}
        </aside>
      )}
    </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
      <Filter className="mb-3 h-8 w-8 text-neutral-300" />
      <p className="text-sm font-medium text-neutral-700">Select an item from the queue</p>
      <p className="mt-1 text-xs text-neutral-500">Detail will appear here.</p>
    </div>
  );
}
