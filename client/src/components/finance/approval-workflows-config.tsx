import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Plus, Trash2, ArrowDown, ArrowUp, Workflow, AlertCircle } from "lucide-react";

interface DocType {
  scope: string;
  label: string;
  description: string;
  subtypeOptions: { value: string; label: string }[];
  directionApplies: boolean;
  hookStatus: "wired" | "pending";
}
interface RoleOpt { value: string; label: string }
interface CatalogResp { docTypes: DocType[]; roles: RoleOpt[] }

interface ChainStep {
  id?: string;
  sequence: number;
  approverRole: string;
  label?: string | null;
  requiresAll?: boolean;
  slaHours?: number | null;
  reminderHours?: number | null;
  onTimeoutAction?: "none" | "escalate" | "auto_approve" | "auto_reject" | null;
}
interface Chain {
  id: string;
  name: string;
  scope: string;
  subtype?: string | null;
  direction?: string | null;
  description?: string | null;
  minAmount: string;
  isActive: boolean;
  companyId?: string | null;
  steps: ChainStep[];
}

const DIRECTIONS = [
  { value: "any", label: "Any direction" },
  { value: "inbound", label: "Inbound only" },
  { value: "outbound", label: "Outbound only" },
];

export function ApprovalWorkflowsConfig() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<{ docType: DocType; chain: Chain | null } | null>(null);

  const catalogQ = useQuery<CatalogResp>({ queryKey: ["/api/finance/approval-doc-types"] });
  const chainsQ = useQuery<Chain[]>({ queryKey: ["/api/finance/approval-chains"] });

  const chainsByScope = useMemo(() => {
    const m = new Map<string, Chain[]>();
    (chainsQ.data || []).forEach(c => {
      const arr = m.get(c.scope) || [];
      arr.push(c); m.set(c.scope, arr);
    });
    return m;
  }, [chainsQ.data]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/finance/approval-chains/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/approval-chains"] });
      toast({ title: "Rule deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message, variant: "destructive" }),
  });

  if (catalogQ.isLoading || chainsQ.isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Loading approval workflows…</div>;
  }
  if (!catalogQ.data) return null;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            Approval Workflows
          </CardTitle>
          <CardDescription>
            Configure approval rules per document type. The first matching rule (most specific +
            highest threshold) decides which ladder fires when an entity is created.
          </CardDescription>
        </CardHeader>
      </Card>

      {catalogQ.data.docTypes.map(dt => {
        const isOpen = !!expanded[dt.scope];
        const rules = chainsByScope.get(dt.scope) || [];
        return (
          <Card key={dt.scope} data-testid={`card-doc-type-${dt.scope}`}>
            <button
              type="button"
              onClick={() => setExpanded(prev => ({ ...prev, [dt.scope]: !prev[dt.scope] }))}
              className="w-full text-left"
              data-testid={`toggle-doc-type-${dt.scope}`}
            >
              <CardHeader className="hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 mt-1 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-1 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        {dt.label}
                        <Badge variant="outline" className="text-xs">{rules.length} rule{rules.length === 1 ? "" : "s"}</Badge>
                        {dt.hookStatus === "wired"
                          ? <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">Active</Badge>
                          : <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">Hook pending</Badge>}
                      </CardTitle>
                      <CardDescription className="mt-1">{dt.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </button>

            {isOpen && (
              <CardContent className="space-y-3 border-t pt-4">
                {dt.hookStatus === "pending" && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Rules can be configured now, but the engine isn't yet hooked into this document type's create flow. Approvals will start firing once the hook ships.</span>
                  </div>
                )}

                {rules.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No rules configured. Items in this category are auto-approved.</p>
                ) : (
                  <div className="space-y-2">
                    {rules.map(rule => (
                      <RuleRow
                        key={rule.id} rule={rule} docType={dt}
                        onEdit={() => setEditing({ docType: dt, chain: rule })}
                        onDelete={() => {
                          if (rule.companyId === null) {
                            toast({ title: "Read-only", description: "System-default rules can't be deleted.", variant: "destructive" });
                            return;
                          }
                          if (confirm(`Delete rule "${rule.name}"?`)) deleteMut.mutate(rule.id);
                        }}
                      />
                    ))}
                  </div>
                )}

                <Button
                  variant="outline" size="sm"
                  onClick={() => setEditing({ docType: dt, chain: null })}
                  data-testid={`button-add-rule-${dt.scope}`}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add rule
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}

      {editing && (
        <RuleEditorDialog
          open={!!editing}
          docType={editing.docType}
          chain={editing.chain}
          roles={catalogQ.data.roles}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RuleRow({ rule, docType, onEdit, onDelete }: {
  rule: Chain; docType: DocType; onEdit: () => void; onDelete: () => void;
}) {
  const isSystemDefault = !rule.companyId;
  const min = Number(rule.minAmount || 0);
  const filters: string[] = [];
  if (rule.subtype) {
    const opt = docType.subtypeOptions.find(o => o.value === rule.subtype);
    filters.push(opt?.label || rule.subtype);
  }
  if (rule.direction) filters.push(rule.direction === "inbound" ? "Inbound" : "Outbound");

  return (
    <div className="border rounded-lg p-3 flex items-center gap-3" data-testid={`rule-row-${rule.id}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{rule.name}</span>
          {isSystemDefault && <Badge variant="outline" className="text-xs">System default</Badge>}
          {!rule.isActive && <Badge variant="outline" className="text-xs text-muted-foreground">Disabled</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
          <span>≥ ${min.toLocaleString()}</span>
          {filters.map(f => <span key={f}>· {f}</span>)}
          <span>·</span>
          <span>
            {rule.steps.map((s, i) => (
              <span key={s.id || i}>
                {i > 0 && <span className="mx-1">→</span>}
                {s.label || s.approverRole}
              </span>
            ))}
          </span>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-rule-${rule.id}`}>Edit</Button>
      <Button variant="ghost" size="sm" onClick={onDelete} disabled={isSystemDefault} data-testid={`button-delete-rule-${rule.id}`}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function RuleEditorDialog({ open, docType, chain, roles, onClose }: {
  open: boolean; docType: DocType; chain: Chain | null; roles: RoleOpt[]; onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!chain;
  const isSystemDefault = !!chain && !chain.companyId;

  const [name, setName] = useState(chain?.name || `${docType.label} approval`);
  const [description, setDescription] = useState(chain?.description || "");
  const [minAmount, setMinAmount] = useState(String(Number(chain?.minAmount || 0)));
  const [subtype, setSubtype] = useState(chain?.subtype || "any");
  const [direction, setDirection] = useState(chain?.direction || "any");
  const [isActive, setIsActive] = useState(chain?.isActive !== false);
  const [steps, setSteps] = useState<ChainStep[]>(
    chain?.steps?.length
      ? chain.steps.map(s => ({ ...s }))
      : [{ sequence: 1, approverRole: roles[0]?.value || "finance_lead", label: roles[0]?.label || "Finance Lead", requiresAll: false }]
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const body: any = {
        name, description: description || null,
        minAmount: Number(minAmount) || 0,
        subtype: subtype === "any" ? null : subtype,
        direction: docType.directionApplies && direction !== "any" ? direction : null,
        isActive,
        steps: steps.map(s => ({
          approverRole: s.approverRole,
          label: s.label || roles.find(r => r.value === s.approverRole)?.label || s.approverRole,
          requiresAll: !!s.requiresAll,
          slaHours: s.slaHours ? Number(s.slaHours) : null,
          reminderHours: s.reminderHours ? Number(s.reminderHours) : null,
          onTimeoutAction: s.onTimeoutAction || "none",
        })),
      };
      if (isEdit) {
        return apiRequest("PATCH", `/api/finance/approval-chains/${chain!.id}`, body);
      }
      return apiRequest("POST", "/api/finance/approval-chains", { ...body, scope: docType.scope });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/approval-chains"] });
      toast({ title: isEdit ? "Rule updated" : "Rule created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
  });

  function moveStep(idx: number, dir: -1 | 1) {
    const next = [...steps];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    next.forEach((s, i) => (s.sequence = i + 1));
    setSteps(next);
  }
  function removeStep(idx: number) {
    if (steps.length === 1) return;
    const next = steps.filter((_, i) => i !== idx);
    next.forEach((s, i) => (s.sequence = i + 1));
    setSteps(next);
  }
  function addStep() {
    setSteps([...steps, {
      sequence: steps.length + 1,
      approverRole: roles[0]?.value || "finance_lead",
      label: roles[0]?.label || "Finance Lead",
      requiresAll: false,
    }]);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit rule" : "New rule"} · {docType.label}</DialogTitle>
          <DialogDescription>
            {isSystemDefault
              ? "This is a system default. You can adjust it; your changes apply to your company only."
              : "Configure the conditions and approval ladder for this rule."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Rule name</Label>
            <Input id="rule-name" value={name} onChange={e => setName(e.target.value)} data-testid="input-rule-name" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-desc">Description (optional)</Label>
            <Textarea id="rule-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-min">Minimum amount (USD)</Label>
              <Input id="rule-min" type="number" min={0} step="0.01"
                value={minAmount} onChange={e => setMinAmount(e.target.value)}
                data-testid="input-rule-min-amount" />
            </div>
            <div className="space-y-1.5 flex items-end">
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-rule-active" />
                <Label>Active</Label>
              </div>
            </div>
          </div>

          {docType.subtypeOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label>Sub-type filter (optional)</Label>
              <Select value={subtype} onValueChange={setSubtype}>
                <SelectTrigger data-testid="select-rule-subtype"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any sub-type</SelectItem>
                  {docType.subtypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {docType.directionApplies && (
            <div className="space-y-1.5">
              <Label>Direction filter</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger data-testid="select-rule-direction"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Approval ladder</Label>
              <Button variant="outline" size="sm" onClick={addStep} data-testid="button-add-step">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add step
              </Button>
            </div>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2" data-testid={`step-row-${i}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Step {i + 1}</Badge>
                    <div className="flex-1" />
                    <Button variant="ghost" size="icon" onClick={() => moveStep(i, -1)} disabled={i === 0}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeStep(i)} disabled={steps.length === 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Approver role</Label>
                      <Select
                        value={s.approverRole}
                        onValueChange={v => {
                          const next = [...steps];
                          next[i] = { ...next[i], approverRole: v, label: roles.find(r => r.value === v)?.label || v };
                          setSteps(next);
                        }}
                      >
                        <SelectTrigger data-testid={`select-step-role-${i}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {roles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Step label</Label>
                      <Input
                        value={s.label || ""}
                        onChange={e => {
                          const next = [...steps];
                          next[i] = { ...next[i], label: e.target.value };
                          setSteps(next);
                        }}
                        data-testid={`input-step-label-${i}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={!!s.requiresAll}
                      onCheckedChange={v => {
                        const next = [...steps];
                        next[i] = { ...next[i], requiresAll: v };
                        setSteps(next);
                      }}
                    />
                    <Label className="text-sm font-normal">All eligible approvers must approve (default: any one)</Label>
                  </div>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">SLA hours</Label>
                      <Input type="number" min={0} placeholder="None"
                        value={s.slaHours ?? ""}
                        onChange={e => {
                          const next = [...steps];
                          next[i] = { ...next[i], slaHours: e.target.value ? Number(e.target.value) : null };
                          setSteps(next);
                        }}
                        data-testid={`input-step-sla-${i}`} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Reminder every (hours)</Label>
                      <Input type="number" min={0} placeholder="None"
                        value={s.reminderHours ?? ""}
                        onChange={e => {
                          const next = [...steps];
                          next[i] = { ...next[i], reminderHours: e.target.value ? Number(e.target.value) : null };
                          setSteps(next);
                        }}
                        data-testid={`input-step-reminder-${i}`} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">When SLA expires</Label>
                      <Select
                        value={s.onTimeoutAction || "none"}
                        onValueChange={v => {
                          const next = [...steps];
                          next[i] = { ...next[i], onTimeoutAction: v as any };
                          setSteps(next);
                        }}
                      >
                        <SelectTrigger data-testid={`select-step-timeout-${i}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Do nothing</SelectItem>
                          <SelectItem value="escalate">Escalate to next step</SelectItem>
                          <SelectItem value="auto_approve">Auto-approve</SelectItem>
                          <SelectItem value="auto_reject">Auto-reject</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="button-save-rule">
            {saveMut.isPending ? "Saving…" : isEdit ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
