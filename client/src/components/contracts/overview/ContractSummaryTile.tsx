import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Pencil,
  ArrowRight,
  ArrowUpRight,
  Loader2,
  FileText,
  LayoutTemplate,
  PencilLine,
  Mail,
  Plug,
  Table as TableIcon,
} from "lucide-react";

type ContractSource =
  | "upload"
  | "template"
  | "manual"
  | "email"
  | "connector"
  | "fieldmap";

// Snapshotted on the contract row at create time. Carries the human-facing
// role labels for that contract's flow type, e.g. CRP →
// {obligor:"Seller", beneficiary:"Customer"}; RLA →
// {obligor:"Licensee", beneficiary:"Licensor"}.
type PartyRoleSlots = {
  obligor?: string | null;
  beneficiary?: string | null;
};

// The contract object on the Overview is hydrated from a generic /api/contracts
// query that we don't have a Drizzle-generated type for in this file. We only
// touch a handful of fields, so accept an unknown-shaped object and narrow the
// two slot fields locally rather than weakening the whole component to `any`
// at the read sites. Tolerates both camelCase (API default) and snake_case
// (legacy callers) keys.
function readPartyRoleSlots(contract: unknown): PartyRoleSlots {
  if (!contract || typeof contract !== "object") return {};
  const c = contract as Record<string, unknown>;
  const camel = c.partyRoleSlots;
  const snake = c.party_role_slots;
  const raw =
    camel && typeof camel === "object"
      ? (camel as Record<string, unknown>)
      : snake && typeof snake === "object"
        ? (snake as Record<string, unknown>)
        : null;
  if (!raw) return {};
  const obligor = typeof raw.obligor === "string" ? raw.obligor : null;
  const beneficiary =
    typeof raw.beneficiary === "string" ? raw.beneficiary : null;
  return { obligor, beneficiary };
}

function formatDateUSA(value: any): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

function SourceChip({ contract }: { contract: any }) {
  const source: ContractSource = (contract?.source as ContractSource) || "upload";
  const originalName: string | null = contract?.originalName || null;
  const uploaderName: string | null =
    contract?.uploadedByName || contract?.uploadedBy || null;
  const createdAt = formatDateUSA(contract?.createdAt);
  const contractId: string | null = contract?.id || null;

  const baseClass =
    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-medium";

  if (source === "upload") {
    const display = originalName || "document";
    const tooltip = createdAt ? `Uploaded ${createdAt}` : undefined;
    return (
      <span
        className={`${baseClass} border-blue-200 bg-blue-50 text-blue-700`}
        title={tooltip}
        data-testid="chip-source-upload"
      >
        <FileText className="h-3 w-3" />
        <span className="truncate max-w-[180px]" title={display}>
          Upload — {display}
        </span>
        {contractId && (
          <a
            href={`/api/contracts/${contractId}/download`}
            target="_blank"
            rel="noreferrer"
            className="ml-1 underline-offset-2 hover:underline text-blue-700"
            data-testid="link-source-open-document"
          >
            Open
          </a>
        )}
      </span>
    );
  }

  if (source === "template") {
    return (
      <span
        className={`${baseClass} border-violet-200 bg-violet-50 text-violet-700`}
        title={createdAt ? `Created ${createdAt}` : undefined}
        data-testid="chip-source-template"
      >
        <LayoutTemplate className="h-3 w-3" />
        Template
      </span>
    );
  }

  if (source === "manual") {
    const tooltipParts: string[] = [];
    if (uploaderName) tooltipParts.push(`Created by ${uploaderName}`);
    if (createdAt) tooltipParts.push(`on ${createdAt}`);
    return (
      <span
        className={`${baseClass} border-amber-200 bg-amber-50 text-amber-800`}
        title={tooltipParts.length ? tooltipParts.join(" ") : undefined}
        data-testid="chip-source-manual"
      >
        <PencilLine className="h-3 w-3" />
        Manual
      </span>
    );
  }

  if (source === "email") {
    return (
      <span
        className={`${baseClass} border-sky-200 bg-sky-50 text-sky-700`}
        data-testid="chip-source-email"
      >
        <Mail className="h-3 w-3" />
        Email
      </span>
    );
  }

  if (source === "connector") {
    return (
      <span
        className={`${baseClass} border-emerald-200 bg-emerald-50 text-emerald-700`}
        data-testid="chip-source-connector"
      >
        <Plug className="h-3 w-3" />
        Connector
      </span>
    );
  }

  if (source === "fieldmap") {
    return (
      <span
        className={`${baseClass} border-orange-200 bg-orange-50 text-orange-700`}
        data-testid="chip-source-fieldmap"
      >
        <TableIcon className="h-3 w-3" />
        Field-map
      </span>
    );
  }

  return null;
}

type Party = {
  assignment_id?: string;
  party_kind?: string | null;
  partner_id?: string | null;
  company_id?: string | null;
  resolved_name?: string | null;
};

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PartyChip({
  name,
  role,
  primary,
  testId,
}: {
  name: string;
  role: string;
  primary?: boolean;
  testId: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-zinc-200 bg-zinc-50"
      data-testid={testId}
    >
      <div className="h-6 w-6 rounded bg-orange-100 text-orange-700 text-[10px] font-bold flex items-center justify-center">
        {initialsOf(name)}
      </div>
      <div className="leading-tight">
        <div className="text-xs font-medium text-zinc-900">{name}</div>
        <div className="text-[10px] text-zinc-500">
          {role}
          {primary && " · primary"}
        </div>
      </div>
    </div>
  );
}

function PartySlot({
  loading,
  party,
  role,
  fallbackName,
  testId,
}: {
  loading: boolean;
  party: Party | null | undefined;
  role: string;
  fallbackName?: string | null;
  testId: string;
}) {
  if (loading) {
    return (
      <div
        className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-zinc-200 bg-zinc-50 animate-pulse"
        data-testid={`${testId}-loading`}
      >
        <div className="h-6 w-6 rounded bg-zinc-200" />
        <div className="leading-tight">
          <div className="h-3 w-24 rounded bg-zinc-200" />
          <div className="h-2 w-12 rounded bg-zinc-200 mt-1" />
        </div>
      </div>
    );
  }
  const name = party?.resolved_name || fallbackName || null;
  if (!name) {
    return (
      <div
        className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-dashed border-zinc-300 bg-white text-[11px] text-zinc-500"
        data-testid={`${testId}-empty`}
      >
        <span className="font-medium text-zinc-700">{role}</span>
        <span>not assigned</span>
      </div>
    );
  }
  return <PartyChip name={name} role={role} primary testId={testId} />;
}

export function ContractSummaryTile({
  contractId,
  contract,
  onOpenTab,
}: {
  contractId: string;
  contract: any;
  onOpenTab?: (tab: string) => void;
}) {
  const analysisQuery = useQuery<any>({
    queryKey: ["/api/contracts", contractId, "analysis"],
    queryFn: async () => {
      const r = await fetch(`/api/contracts/${contractId}/analysis`, {
        credentials: "include",
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed to load analysis");
      return r.json();
    },
  });

  const owningPartyQuery = useQuery<Party | null>({
    queryKey: ["/api/contracts", contractId, "parties", "owning_party"],
    queryFn: async () => {
      const r = await fetch(
        `/api/contracts/${contractId}/parties/owning_party`,
        { credentials: "include" },
      );
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed to load owning party");
      return r.json();
    },
  });

  const counterpartyQuery = useQuery<Party | null>({
    queryKey: ["/api/contracts", contractId, "parties", "counterparty"],
    queryFn: async () => {
      const r = await fetch(
        `/api/contracts/${contractId}/parties/counterparty`,
        { credentials: "include" },
      );
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed to load counterparty");
      return r.json();
    },
  });

  const summary: string | null =
    typeof analysisQuery.data?.summary === "string"
      ? analysisQuery.data.summary
      : null;
  const summaryStillGenerating =
    typeof summary === "string" &&
    summary.includes("being generated in the background");
  const summaryReady = !!summary && !summaryStillGenerating;

  return (
    <section
      className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col"
      data-testid="card-contract-summary"
    >
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Sparkles className="h-4 w-4 text-orange-500 shrink-0" />
          <h3 className="text-sm font-semibold text-zinc-900">Contract Summary</h3>
          {summaryReady && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
              AI · generated
            </span>
          )}
          <SourceChip contract={contract} />
        </div>
        <button
          onClick={() => onOpenTab?.("analysis")}
          className="text-[11px] text-zinc-500 hover:text-orange-700 inline-flex items-center gap-1 shrink-0"
          data-testid="button-edit-summary"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </header>

      {/* AI summary line */}
      <div className="px-4 py-3 border-b border-zinc-100 min-h-[78px]">
        {analysisQuery.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500" data-testid="text-summary-loading">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading summary…
          </div>
        ) : summaryStillGenerating ? (
          <div className="text-xs text-zinc-500 italic" data-testid="text-summary-pending">
            AI summary is being generated in the background. Refresh in a moment.
          </div>
        ) : summary ? (
          <div className="text-xs text-zinc-700 leading-relaxed" data-testid="text-summary">
            {summary}
          </div>
        ) : (
          (() => {
            const src = (contract?.source as ContractSource) || "upload";
            if (src === "upload") {
              return (
                <div
                  className="text-xs text-zinc-500"
                  data-testid="text-summary-empty"
                >
                  Analysis in progress — or trigger it from the Risks tab.
                </div>
              );
            }
            if (src === "email") {
              return (
                <div
                  className="text-xs text-zinc-500"
                  data-testid="text-summary-empty"
                >
                  Summary derived from email body. Confidence: medium.
                </div>
              );
            }
            // Manual contracts: if the user provided a description on creation
            // (stored as `notes`), surface it here as the Contract Summary
            // instead of the empty-state copy. Closes the gap left by T005 for
            // contracts that have nothing to AI-summarize.
            if (src === "manual" && contract?.notes) {
              return (
                <div
                  className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap"
                  data-testid="text-summary-from-description"
                >
                  {contract.notes}
                </div>
              );
            }
            const label =
              src === "template"
                ? "a template"
                : src === "manual"
                ? "manual entry"
                : src === "connector"
                ? "a connector"
                : "a field-map import";
            return (
              <div
                className="text-xs text-zinc-500"
                data-testid="text-summary-empty"
              >
                This contract was created from {label}. AI summary is optional —
                add a description in Notes.
              </div>
            );
          })()
        )}
      </div>

      {/* Parties strip */}
      <div className="px-4 py-3">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium mb-2">
          Parties
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Role labels come from the contract's snapshotted partyRoleSlots
              (e.g. CRP → {obligor:"Seller", beneficiary:"Customer"};
              RLA → {obligor:"Licensee", beneficiary:"Licensor"}). The
              owning_party is always the obligor (the party that carries the
              financial obligation) and the counterparty is the beneficiary
              (the party that receives the cash). For OUTBOUND flows
              (CRP/RLA/RSM/SUB) the LicenseIQ tenant is the obligor; for
              INBOUND flows (VRP) the tenant is the beneficiary instead and
              the supplier is the obligor — the obligor/beneficiary axis is
              flow-direction-aware. We fall back to "Licensor"/"Licensee" only
              when slots are missing so legacy contracts don't render an empty
              chip. */}
          {(() => {
            const slots = readPartyRoleSlots(contract);
            return (
              <>
                <PartySlot
                  loading={owningPartyQuery.isLoading}
                  party={owningPartyQuery.data}
                  role={slots.obligor || "Licensor"}
                  fallbackName={contract?.organizationName || null}
                  testId="chip-party-owning"
                />
                <ArrowRight className="h-3.5 w-3.5 text-zinc-300" />
                <PartySlot
                  loading={counterpartyQuery.isLoading}
                  party={counterpartyQuery.data}
                  role={slots.beneficiary || "Licensee"}
                  fallbackName={contract?.counterpartyName || null}
                  testId="chip-party-counterparty"
                />
              </>
            );
          })()}
          <button
            onClick={() => onOpenTab?.("parties")}
            className="text-[11px] text-zinc-500 hover:text-orange-700 inline-flex items-center gap-1 ml-auto"
            data-testid="button-open-parties"
          >
            All parties <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </section>
  );
}
