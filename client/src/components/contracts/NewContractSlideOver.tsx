import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { FileText, Sparkles, Upload, Loader2, LayoutTemplate, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FlowType = { code: string; name: string };
type Partner = { id: string; partner_id?: string; partner_name: string };

// Matches the new TemplateListItem shape returned by /api/contract-templates.
type Template = {
  id: string;
  name: string;
  description?: string | null;
  flowTypeCode: string;
  flowTypeName?: string;
  isSystem?: boolean;
  scope?: "system" | "company" | "mine";
  ownerLabel?: string;
  visibility?: "public" | "private";
  snapshotScope?: string;
  stats?: { rules: number; clauses: number; subtypes: number };
};

// The four static format guides we expose for download from any template.
const SAMPLE_KINDS: { kind: string; label: string }[] = [
  { kind: "sales", label: "Sales sample" },
  { kind: "credit_memos", label: "Credit memos sample" },
  { kind: "pos", label: "POS sample" },
  { kind: "po_receipts", label: "PO receipts sample" },
];

interface NewContractSlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional flow code; auto-filters templates and pre-seeds Flow Type on open. */
  presetFlowType?: string;
}

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "INR"];
const DESC_MAX = 280;
const BLANK = "__blank__";

export function NewContractSlideOver({ open, onOpenChange, presetFlowType }: NewContractSlideOverProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [startFrom, setStartFrom] = useState<string>(BLANK);
  const [name, setName] = useState("");
  const [flowType, setFlowType] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [effectiveStart, setEffectiveStart] = useState("");
  const [effectiveEnd, setEffectiveEnd] = useState("");
  const [description, setDescription] = useState("");

  const { data: flowTypes } = useQuery<FlowType[]>({
    queryKey: ["/api/pipeline/flow-types"],
    enabled: open,
  });

  // Partners (counterparties) live in partner_master and are exposed via the
  // lookup endpoint. The /api/master-data/companies endpoint filters down to
  // the user's own company for non-system-admins, which is the wrong list for
  // picking a counterparty.
  const { data: partners } = useQuery<Partner[]>({
    queryKey: ["/api/lookup/partners"],
    enabled: open,
  });

  const [templateFlowFilter, setTemplateFlowFilter] = useState<string>(presetFlowType ?? "");

  useEffect(() => {
    if (!open || !presetFlowType) return;
    setTemplateFlowFilter(presetFlowType);
    setFlowType((prev) => prev || presetFlowType);
  }, [open, presetFlowType]);

  const { data: templatesResp } = useQuery<{ templates: Template[] }>({
    queryKey: ["/api/contract-templates"],
    enabled: open,
  });
  const allTemplates = templatesResp?.templates || [];

  // When a template is selected, the template itself declares the flow,
  // so sync (and effectively lock) the Flow Type field to match. When the
  // user reverts to "Blank contract", the field unlocks but we leave any
  // value the user may want to keep.
  useEffect(() => {
    if (startFrom === BLANK) return;
    const tpl = allTemplates.find((t) => t.id === startFrom);
    if (tpl?.flowTypeCode && tpl.flowTypeCode !== flowType) {
      setFlowType(tpl.flowTypeCode);
    }
  }, [startFrom, allTemplates, flowType]);
  // Preset-driven filtering only narrows the System group (per spec) so a
  // user opening from a flow-scoped page still sees their My Company / Mine
  // templates from other flows. A user-chosen filter (changing the dropdown
  // away from the preset) applies to every group.
  const userChoseFilter = !!templateFlowFilter && templateFlowFilter !== presetFlowType;
  const templates = userChoseFilter
    ? allTemplates.filter((t) => t.flowTypeCode === templateFlowFilter)
    : allTemplates;
  const usingTemplate = startFrom !== BLANK;
  const selectedTemplate = allTemplates.find((t) => t.id === startFrom);

  // Group by scope so the dropdown reads System → My Company → Mine.
  const grouped: Record<"system" | "company" | "mine", Template[]> = {
    system: [], company: [], mine: [],
  };
  for (const t of templates) {
    const s = (t.scope ?? (t.isSystem ? "system" : "mine")) as "system" | "company" | "mine";
    grouped[s].push(t);
  }
  // If only a preset is active (user hasn't overridden it), narrow only the
  // System group by that preset; My Company / Mine stay unfiltered.
  if (presetFlowType && !userChoseFilter) {
    grouped.system = grouped.system.filter((t) => t.flowTypeCode === presetFlowType);
  }
  const GROUP_LABELS: Record<string, string> = {
    system: "System Templates",
    company: "My Company",
    mine: "Mine",
  };

  const reset = () => {
    setStartFrom(BLANK);
    setName("");
    setFlowType("");
    setCounterpartyId("");
    setCurrency("USD");
    setEffectiveStart("");
    setEffectiveEnd("");
    setDescription("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const counterparty = (partners || []).find((p) => p.id === counterpartyId);
      const counterpartyName = counterparty?.partner_name || "";
      // Same 7-field payload for both modes — templates only contribute
      // clauses/rules/policies/sample data; the user always provides the basics.
      const payload = {
        displayName: name.trim(),
        contractType: flowType || null,
        counterpartyName,
        currency,
        effectiveStart: effectiveStart || null,
        effectiveEnd: effectiveEnd || null,
        notes: description.trim() || null,
        contractStatus: "Draft",
        priority: "normal",
      };
      if (usingTemplate) {
        const res = await apiRequest(
          "POST",
          `/api/contract-templates/${startFrom}/create`,
          payload,
        );
        return res.json();
      }
      const res = await apiRequest("POST", "/api/contracts/create-manual", payload);
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      // Template endpoint returns { contractId, templateName }, manual returns { id }
      const newId = result?.id || result?.contractId;
      const wasTemplate = !!result?.templateName;
      toast({
        title: wasTemplate ? "Contract created from template" : "Draft contract created",
        description: wasTemplate
          ? `"${result.templateName}" was created with sample data.`
          : "Complete the Pending Items checklist to activate.",
      });
      reset();
      onOpenChange(false);
      if (newId) {
        navigate(`/contracts/${newId}`);
      }
    },
    onError: (err: any) => {
      toast({
        title: "Could not create contract",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Same required-field rule for both modes — name, flow type, counterparty
  // and currency are always user-supplied.
  const canSubmit = !!name.trim() && !!flowType && !!counterpartyId && !!currency;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!createMutation.isPending) onOpenChange(o);
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0"
        data-testid="sheet-new-contract"
      >
        <SheetHeader className="px-5 py-4 border-b border-zinc-200 space-y-1">
          <SheetTitle className="text-base font-semibold text-zinc-900">
            New Contract
          </SheetTitle>
          <SheetDescription className="text-xs text-zinc-500">
            {usingTemplate
              ? "Fill the basics — the template will pre-fill clauses, rules and policies."
              : "Captures the basics. You'll fill the rest on the Overview."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Start from: Blank or Template (grouped: System / My Company / Mine) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium text-zinc-700">
                Start from
              </Label>
              {/* Optional flow filter — narrows the dropdown when picking
                  among many templates. Independent from the form's flow type. */}
              <Select
                value={templateFlowFilter || "__all__"}
                onValueChange={(v) => setTemplateFlowFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger
                  className="h-7 text-[11px] w-[140px]"
                  data-testid="select-template-flow-filter"
                >
                  <SelectValue placeholder="All flows" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All flows</SelectItem>
                  {(flowTypes || []).map((ft) => (
                    <SelectItem key={ft.code} value={ft.code}>
                      {ft.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={startFrom} onValueChange={setStartFrom}>
              <SelectTrigger className="text-sm" data-testid="select-start-from">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BLANK}>
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-zinc-500" />
                    Blank contract
                  </span>
                </SelectItem>
                {(["system", "company", "mine"] as const).map((scope) =>
                  grouped[scope].length === 0 ? null : (
                    <div key={scope}>
                      <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        {GROUP_LABELS[scope]}
                      </div>
                      {grouped[scope].map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="inline-flex items-center gap-2">
                            <LayoutTemplate className="h-3.5 w-3.5 text-orange-600" />
                            <span>{t.name}</span>
                            <span className="text-[10px] text-zinc-400">
                              {t.flowTypeCode}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  ),
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-zinc-500">
              System templates live alongside any you or your team have saved.
            </p>
          </div>

          {/* Template hint — visible above the form when a template is picked */}
          {usingTemplate && selectedTemplate && (
            <div className="rounded-md border border-orange-200 bg-orange-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-3.5 w-3.5 text-orange-600" />
                <div className="text-xs font-semibold text-zinc-900 flex-1 truncate">
                  Template attached: {selectedTemplate.name}
                </div>
                <span className="text-[10px] text-zinc-500 shrink-0">
                  {selectedTemplate.ownerLabel ?? selectedTemplate.scope ?? ""}
                </span>
              </div>
              {selectedTemplate.description && (
                <p className="text-[11px] text-zinc-600 leading-snug">
                  {selectedTemplate.description}
                </p>
              )}
              {selectedTemplate.stats && (
                <p className="text-[11px] text-zinc-500">
                  Snapshots {selectedTemplate.stats.rules} rule
                  {selectedTemplate.stats.rules === 1 ? "" : "s"} across{" "}
                  {selectedTemplate.stats.subtypes} subtype
                  {selectedTemplate.stats.subtypes === 1 ? "" : "s"} and{" "}
                  {selectedTemplate.stats.clauses} clause
                  {selectedTemplate.stats.clauses === 1 ? "" : "s"}.
                </p>
              )}
              {/* Sample CSV downloads — fetch the static format guide for
                  this template's flow so the user can see the column shape
                  before they're on the Overview. */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SAMPLE_KINDS.map((s) => (
                  <a
                    key={s.kind}
                    href={`/api/contract-templates/${selectedTemplate.id}/sample/${s.kind}`}
                    className="inline-flex items-center gap-1 text-[10.5px] font-medium text-orange-700 hover:text-orange-900 underline-offset-2 hover:underline"
                    data-testid={`link-template-sample-${s.kind}`}
                  >
                    <Download className="h-3 w-3" />
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Contract Name */}
          <div className="space-y-1.5">
            <Label htmlFor="new-contract-name" className="text-xs font-medium text-zinc-700">
              Contract Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="new-contract-name"
              data-testid="input-contract-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q1 2026 Distributor Rebate Program"
              className="text-sm"
              autoFocus
            />
          </div>

          {/* Flow Type — locked when a template is attached, since the
              template itself declares the flow. */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">
              Flow Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={flowType}
              onValueChange={setFlowType}
              disabled={usingTemplate}
            >
              <SelectTrigger className="text-sm" data-testid="select-flow-type">
                <SelectValue placeholder="Select a flow type…" />
              </SelectTrigger>
              <SelectContent>
                {(flowTypes || []).map((ft) => (
                  <SelectItem key={ft.code} value={ft.code}>
                    {ft.code} — {ft.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-zinc-500">
              {usingTemplate && selectedTemplate
                ? `Set by template (${selectedTemplate.flowTypeCode}). Pick "Blank contract" to change.`
                : "Subflow is set later from the Rules tab."}
            </p>
          </div>

          {/* Counterparty */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">
              Counterparty <span className="text-red-500">*</span>
            </Label>
            <Select value={counterpartyId} onValueChange={setCounterpartyId}>
              <SelectTrigger className="text-sm" data-testid="select-counterparty">
                <SelectValue placeholder="Select counterparty…" />
              </SelectTrigger>
              <SelectContent>
                {(partners || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.partner_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-zinc-500">
              You can add more parties from the Parties tab later.
            </p>
          </div>

          {/* Currency + Start + End */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-700">
                Currency <span className="text-red-500">*</span>
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="text-sm" data-testid="select-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-contract-start" className="text-xs font-medium text-zinc-700">
                Start
              </Label>
              <DatePickerInput
                id="new-contract-start"
                data-testid="input-effective-start"
                value={effectiveStart}
                onChange={setEffectiveStart}
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-contract-end" className="text-xs font-medium text-zinc-700">
                End
              </Label>
              <DatePickerInput
                id="new-contract-end"
                data-testid="input-effective-end"
                value={effectiveEnd}
                onChange={setEffectiveEnd}
                className="h-10 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 -mt-3">
            Dates optional — set or change later on the Overview.
          </p>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="new-contract-desc" className="text-xs font-medium text-zinc-700">
                Description{" "}
                <span className="text-zinc-400 font-normal">(optional)</span>
              </Label>
              <span className="text-[10px] text-zinc-400">
                {description.length}/{DESC_MAX}
              </span>
            </div>
            <Textarea
              id="new-contract-desc"
              data-testid="input-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
              rows={3}
              placeholder="One or two lines about what this contract covers…"
              className="text-sm resize-none"
            />
            <p className="text-[11px] text-zinc-500">
              Shown as the Contract Summary on the Overview when there's no AI summary yet.
            </p>
          </div>

          {/* What happens next */}
          <div className="mt-2 p-3 rounded-md border border-zinc-200 bg-zinc-50">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 mb-2">
              <Sparkles className="h-3 w-3 text-orange-500" />
              What happens next
            </div>
            <ol className="space-y-1.5 text-[11px] text-zinc-600 list-decimal list-inside">
              <li>
                Contract is saved as{" "}
                <span className="font-medium text-zinc-900">Draft</span>.
              </li>
              <li>You land on the Contract Overview.</li>
              <li>
                The{" "}
                <span className="font-medium text-zinc-900">Pending Items</span>{" "}
                checklist guides you through the rest.
              </li>
              <li>Once green, you can move it from Draft → Active.</li>
            </ol>
          </div>

          {/* Alternative path */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              navigate("/contracts/ingest");
            }}
            className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-orange-700"
            data-testid="link-upload-instead"
          >
            <Upload className="h-3 w-3" />
            Have a contract document? Upload instead →
          </button>
        </div>

        {/* Sticky footer */}
        <div className="px-5 py-3 border-t border-zinc-200 bg-white flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
            data-testid="button-cancel"
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            data-testid="button-create-contract"
            className="text-xs bg-orange-600 hover:bg-orange-700 text-white inline-flex items-center gap-1.5"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </>
            ) : usingTemplate ? (
              <>
                <LayoutTemplate className="h-3.5 w-3.5" />
                Create from Template
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                Create Draft Contract
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
