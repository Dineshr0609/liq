import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronsUpDown, Sparkles, AlertTriangle, ShieldCheck, Unlink, Search, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

export type LinkStatus = "verified" | "suggested" | "unlinked" | "manual";

export interface LinkedMasterFieldProps {
  /** Display value shown inside the trigger (typically the canonical master name). */
  value: string;
  /** Resolved master record id, if any. */
  resolvedId?: string | null;
  /** Current link status — drives the badge color. */
  linkStatus?: LinkStatus | null;
  /** Confidence 0..1 — shown as a percentage in tooltip / popover. */
  confidence?: number | null;
  /** How the link was resolved (exact, fuzzy, ai_semantic, …). */
  method?: string | null;
  /** Original AI-extracted string preserved alongside the link. */
  rawValue?: string | null;
  /** Master endpoint that returns `[{ id, name }, …]` (will be normalised below). */
  masterEndpoint: string;
  /** Map a master row to `{ id, name }` for display. */
  rowMapper: (row: any) => { id: string; name: string };
  /** Resolve-suggestion endpoint target ('partner' | 'company'). */
  linkTarget: "partner" | "company";
  /** Endpoint that handles confirm/set/unlink mutations. */
  mutationEndpoint: string;
  /** Field name in the mutation body for the master id (e.g. 'partnerId', 'companyId'). */
  idFieldName: string;
  /** Field name in the mutation body for the master name. */
  nameFieldName: string;
  /** Cache keys to invalidate after the mutation. */
  invalidateKeys: string[][];
  /** Optional placeholder. */
  placeholder?: string;
  /** Optional disabled flag (e.g. read-only when another user holds the edit lock). */
  disabled?: boolean;
  /** Test id stem. */
  testId?: string;
  /**
   * Optional secondary master source. When provided, the dropdown unions options
   * from both endpoints. Each source's options are tagged so the mutation body
   * uses the correct id/name field names per pick. Useful for party rows where
   * the master record might live in either `companies` or `partner_master`.
   */
  secondarySource?: {
    endpoint: string;
    rowMapper: (row: any) => { id: string; name: string };
    idFieldName: string;
    nameFieldName: string;
    linkTarget: "partner" | "company";
    /** Optional label shown next to options from this source. */
    label?: string;
  };
}

type SourceTag = "primary" | "secondary";
type TaggedOption = { id: string; name: string; __source: SourceTag };

interface LinkAlternative {
  id: string;
  name: string;
  confidence: number;
  method: string;
  __source?: SourceTag;
}

const STATUS_META: Record<LinkStatus, { label: string; className: string; Icon: any }> = {
  verified: {
    label: "Verified",
    className: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
    Icon: ShieldCheck,
  },
  suggested: {
    label: "AI suggestion",
    className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
    Icon: Sparkles,
  },
  unlinked: {
    label: "Unlinked",
    className: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
    Icon: AlertTriangle,
  },
  manual: {
    label: "Manual",
    className: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
    Icon: Check,
  },
};

export function LinkedMasterField(props: LinkedMasterFieldProps) {
  const {
    value,
    resolvedId,
    linkStatus,
    confidence,
    method,
    rawValue,
    masterEndpoint,
    rowMapper,
    linkTarget,
    mutationEndpoint,
    idFieldName,
    nameFieldName,
    invalidateKeys,
    placeholder = "Select…",
    disabled = false,
    testId = "linked-master-field",
  } = props;

  const status: LinkStatus = (linkStatus as LinkStatus) || (value ? "manual" : "unlinked");
  const meta = STATUS_META[status];
  const [open, setOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [suggestionAlternatives, setSuggestionAlternatives] = useState<LinkAlternative[] | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const { toast } = useToast();

  const { secondarySource } = props;

  const { data: masterData } = useQuery({
    queryKey: [masterEndpoint],
    queryFn: () => fetch(masterEndpoint, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: secondaryData } = useQuery({
    queryKey: secondarySource ? [secondarySource.endpoint] : ["__no_secondary__"],
    queryFn: () =>
      secondarySource
        ? fetch(secondarySource.endpoint, { credentials: "include" }).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!secondarySource,
  });

  const options: TaggedOption[] = useMemo(() => {
    const primaryRows = Array.isArray(masterData) ? masterData : [];
    const primary: TaggedOption[] = primaryRows
      .map(rowMapper)
      .filter((o) => o.id && o.name)
      .map((o) => ({ ...o, __source: "primary" as const }));
    if (!secondarySource) return primary;
    const secondaryRows = Array.isArray(secondaryData) ? secondaryData : [];
    const secondary: TaggedOption[] = secondaryRows
      .map(secondarySource.rowMapper)
      .filter((o) => o.id && o.name)
      .map((o) => ({ ...o, __source: "secondary" as const }));
    // Dedupe by id+name in case the same record appears in both sources.
    const seen = new Set<string>();
    return [...primary, ...secondary].filter((o) => {
      const key = `${o.__source}:${o.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [masterData, rowMapper, secondaryData, secondarySource]);

  const queryClientImport = async () => (await import("@/lib/queryClient")).queryClient;

  const mutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("PATCH", mutationEndpoint, body);
      return { body, data: await res.json() };
    },
    onSuccess: async ({ body }) => {
      const qc = await queryClientImport();
      invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      setPopoverOpen(false);
      setOpen(false);
      const action = body?.action;
      const name = body?.[nameFieldName];
      toast({
        title:
          action === "unlink"
            ? "Link removed"
            : action === "confirm"
              ? "Match confirmed"
              : "Linked successfully",
        description:
          action === "unlink"
            ? "This field is no longer linked to a master record."
            : `Linked to ${name}. Status updated.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not save link",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const fetchSuggestion = async (raw: string) => {
    setLoadingSuggestion(true);
    try {
      const fetchOne = async (target: "partner" | "company", source: SourceTag) => {
        const res = await apiRequest("POST", "/api/master-data/link/preview", {
          rawValue: raw,
          target,
        });
        const data = await res.json();
        const out: LinkAlternative[] = [];
        if (data.resolvedId) {
          out.push({
            id: data.resolvedId,
            name: data.resolvedName,
            confidence: data.confidence,
            method: data.method,
            __source: source,
          });
        }
        (data.alternatives || []).forEach((a: LinkAlternative) => {
          out.push({ ...a, __source: source });
        });
        return out;
      };

      const sources: Promise<LinkAlternative[]>[] = [fetchOne(linkTarget, "primary")];
      if (secondarySource) {
        sources.push(fetchOne(secondarySource.linkTarget, "secondary"));
      }
      const results = await Promise.all(sources);
      const merged = results.flat();

      // Dedupe by source+id, keep highest confidence, then sort desc by confidence.
      const bestById = new Map<string, LinkAlternative>();
      for (const item of merged) {
        const key = `${item.__source}:${item.id}`;
        const existing = bestById.get(key);
        if (!existing || (item.confidence ?? 0) > (existing.confidence ?? 0)) {
          bestById.set(key, item);
        }
      }
      const list = Array.from(bestById.values()).sort(
        (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
      );
      setSuggestionAlternatives(list);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const handleConfirm = (id: string, name: string, conf?: number, mth?: string) => {
    mutation.mutate({
      action: "confirm",
      [idFieldName]: id,
      [nameFieldName]: name,
      confidence: conf,
      method: mth,
    });
  };

  const handleSet = (id: string, name: string, source: SourceTag = "primary") => {
    const fields =
      source === "secondary" && secondarySource
        ? { idField: secondarySource.idFieldName, nameField: secondarySource.nameFieldName }
        : { idField: idFieldName, nameField: nameFieldName };
    mutation.mutate({
      action: "set",
      [fields.idField]: id,
      [fields.nameField]: name,
    });
  };

  const handleUnlink = () => {
    mutation.mutate({ action: "unlink" });
  };

  const triggerLabel = value || rawValue || "";

  return (
    <div className="flex w-full items-stretch gap-1.5">
      {/* Main combobox trigger */}
      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-11 flex-1 justify-between font-normal",
              !triggerLabel && "text-muted-foreground",
            )}
            data-testid={`${testId}-trigger`}
          >
            <span className="truncate">{triggerLabel || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search master data…" />
            <CommandList>
              <CommandEmpty>No matching record.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={`${o.__source}:${o.id}`}
                    value={`${o.name} ${o.__source === "secondary" && secondarySource?.label ? secondarySource.label : ""}`}
                    onSelect={() => handleSet(o.id, o.name, o.__source)}
                    data-testid={`${testId}-option-${o.__source}-${o.id}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        resolvedId === o.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{o.name}</span>
                    {o.__source === "secondary" && secondarySource?.label && (
                      <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {secondarySource.label}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Inline Accept button for suggested matches */}
      {status === "suggested" && resolvedId && !disabled && (
        <Button
          type="button"
          size="sm"
          onClick={() => handleConfirm(resolvedId, value, confidence ?? undefined, method ?? undefined)}
          disabled={mutation.isPending}
          className="h-11 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid={`${testId}-accept`}
          title="Accept this AI suggestion"
        >
          <ThumbsUp className="h-4 w-4 mr-1" />
          Accept
        </Button>
      )}

      {/* Status badge / popover */}
      <Popover
        open={popoverOpen}
        onOpenChange={(o) => {
          setPopoverOpen(o);
          if (o && rawValue && status !== "verified") fetchSuggestion(rawValue);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors hover:opacity-80",
              meta.className,
            )}
            title={`${meta.label}${confidence ? ` · ${Math.round(confidence * 100)}% (${method ?? "—"})` : ""}`}
            data-testid={`${testId}-status`}
          >
            <meta.Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{meta.label}</span>
            {confidence ? (
              <span className="opacity-75">{Math.round(confidence * 100)}%</span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-3 space-y-3" align="end">
          <div className="space-y-1">
            <div className="text-sm font-semibold">{meta.label}</div>
            {rawValue && (
              <div className="text-xs text-muted-foreground">
                AI extracted: <span className="font-mono">"{rawValue}"</span>
              </div>
            )}
            {value && value !== rawValue && (
              <div className="text-xs text-muted-foreground">
                Currently linked to: <span className="font-medium text-foreground">{value}</span>
              </div>
            )}
            {confidence ? (
              <div className="text-xs text-muted-foreground">
                Match confidence: <span className="font-medium">{Math.round(confidence * 100)}%</span>
                {method ? <span className="ml-1">via {method}</span> : null}
              </div>
            ) : null}
          </div>

          {status === "suggested" && resolvedId && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleConfirm(resolvedId, value, confidence ?? undefined, method ?? undefined)}
                disabled={mutation.isPending}
                data-testid={`${testId}-confirm`}
              >
                <ShieldCheck className="h-4 w-4 mr-1" />
                Confirm this match
              </Button>
            </div>
          )}

          {(status === "suggested" || status === "unlinked" || status === "manual") && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">
                {loadingSuggestion
                  ? "Looking for matches…"
                  : status === "manual"
                    ? "AI suggestions for the extracted text"
                    : "Other possibilities"}
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(suggestionAlternatives || [])
                  .filter((a) => !(a.id === resolvedId && (a.__source ?? "primary") === "primary"))
                  .map((a) => {
                    const src = a.__source ?? "primary";
                    return (
                      <button
                        key={`${src}:${a.id}`}
                        type="button"
                        onClick={() =>
                          src === "secondary"
                            ? handleSet(a.id, a.name, "secondary")
                            : handleConfirm(a.id, a.name, a.confidence, a.method)
                        }
                        className="flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs hover:bg-accent"
                        data-testid={`${testId}-alt-${src}-${a.id}`}
                      >
                        <span className="truncate flex-1">{a.name}</span>
                        {src === "secondary" && secondarySource?.label && (
                          <span className="ml-2 shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">
                            {secondarySource.label}
                          </span>
                        )}
                        <span className="ml-2 shrink-0 text-muted-foreground">
                          {Math.round(a.confidence * 100)}%
                        </span>
                      </button>
                    );
                  })}
                {!loadingSuggestion && (suggestionAlternatives || []).length === 0 && (
                  <div className="text-xs text-muted-foreground italic">No close matches found.</div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 border-t pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setPopoverOpen(false);
                setOpen(true);
              }}
              data-testid={`${testId}-search`}
            >
              <Search className="h-4 w-4 mr-1" />
              Search master data
            </Button>
            {status !== "unlinked" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUnlink}
                disabled={mutation.isPending}
                data-testid={`${testId}-unlink`}
              >
                <Unlink className="h-4 w-4 mr-1" />
                Unlink
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
