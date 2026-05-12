import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, AlertTriangle, CheckCircle2, Wand2, Loader2, PlayCircle } from "lucide-react";

type AuditStatus = "canonical" | "liftable" | "unfillable";

interface AuditRule {
  id: string;
  contractId: string;
  contractName: string;
  ruleName: string | null;
  ruleType: string | null;
  status: AuditStatus;
  presentFields: string[];
  missingFields: string[];
  updatedAt: string | null;
}

interface AuditContract {
  id: string;
  name: string;
}

interface AuditResponse {
  rules: AuditRule[];
  contracts: AuditContract[];
  summary: {
    total: number;
    canonical: number;
    liftable: number;
    unfillable: number;
  };
}

const STATUS_BADGE: Record<AuditStatus, { label: string; className: string; icon: any }> = {
  canonical: {
    label: "Canonical",
    className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-100",
    icon: CheckCircle2,
  },
  liftable: {
    label: "Auto-fixable",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100",
    icon: Wand2,
  },
  unfillable: {
    label: "Needs manual fix",
    className: "bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900 dark:text-rose-100",
    icon: AlertTriangle,
  },
};

interface BackfillResult {
  scanned: number;
  updated: number;
  alreadyCanonical: number;
  stillUnfillable: number;
  updatedIds: string[];
}

type BackfillScope = "all" | "single" | "list";

export default function ObligationCanonicalAuditPage() {
  const [contractId, setContractId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"missing" | "all">("missing");
  const [lastResult, setLastResult] = useState<{ scope: BackfillScope; ruleId?: string; result: BackfillResult } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const queryKey = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", statusFilter);
    if (contractId !== "all") params.set("contractId", contractId);
    return ["/api/admin/obligation-canonical-audit", params.toString()] as const;
  }, [contractId, statusFilter]);

  const { data, isLoading, isError } = useQuery<AuditResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (contractId !== "all") params.set("contractId", contractId);
      const res = await fetch(`/api/admin/obligation-canonical-audit?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to load audit (${res.status})`);
      return res.json();
    },
  });

  const summary = data?.summary;
  const rules = data?.rules || [];
  const contracts = data?.contracts || [];

  const liftableRuleIdsInView = useMemo(
    () => rules.filter((r) => r.status === "liftable").map((r) => r.id),
    [rules],
  );

  const backfillMutation = useMutation({
    mutationFn: async (vars: { ruleId?: string; ruleIds?: string[] }) => {
      const body: Record<string, unknown> = {};
      if (vars.ruleId) body.ruleId = vars.ruleId;
      if (!vars.ruleId && vars.ruleIds && vars.ruleIds.length > 0) body.ruleIds = vars.ruleIds;
      const res = await apiRequest(
        "POST",
        "/api/admin/obligation-canonical-audit/backfill",
        body,
      );
      return (await res.json()) as BackfillResult;
    },
    onSuccess: (result, vars) => {
      const scope: BackfillScope = vars.ruleId ? "single" : "list";
      setLastResult({ scope, ruleId: vars.ruleId, result });
      toast({
        title: "Backfill complete",
        description: `${result.updated} rule${result.updated === 1 ? "" : "s"} updated, ${result.stillUnfillable} still need manual fix.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/obligation-canonical-audit"] });
    },
    onError: (err: any) => {
      toast({
        title: "Backfill failed",
        description: err?.message || "Unable to run obligation backfill.",
        variant: "destructive",
      });
    },
  });

  const liftableCount = liftableRuleIdsInView.length;
  const isRunningAll = backfillMutation.isPending && !backfillMutation.variables?.ruleId;
  const runningRuleId = backfillMutation.isPending ? backfillMutation.variables?.ruleId : undefined;

  return (
    <MainLayout
      title="Obligation canonical fields audit"
      description="Find historical obligation rules whose top-level formula is missing canonical amount/rate/percentage/bps fields."
    >
      <div className="p-4 md:p-6 space-y-6" data-testid="page-obligation-canonical-audit">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card data-testid="card-summary-total">
            <CardHeader className="pb-2">
              <CardDescription>Obligation rules scanned</CardDescription>
              <CardTitle className="text-3xl" data-testid="text-summary-total">
                {summary?.total ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card data-testid="card-summary-canonical">
            <CardHeader className="pb-2">
              <CardDescription>Already canonical</CardDescription>
              <CardTitle className="text-3xl text-emerald-700 dark:text-emerald-300" data-testid="text-summary-canonical">
                {summary?.canonical ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card data-testid="card-summary-liftable">
            <CardHeader className="pb-2">
              <CardDescription>Auto-fixable by backfill</CardDescription>
              <CardTitle className="text-3xl text-amber-700 dark:text-amber-300" data-testid="text-summary-liftable">
                {summary?.liftable ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card data-testid="card-summary-unfillable">
            <CardHeader className="pb-2">
              <CardDescription>Need manual fix</CardDescription>
              <CardTitle className="text-3xl text-rose-700 dark:text-rose-300" data-testid="text-summary-unfillable">
                {summary?.unfillable ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Rules</CardTitle>
                <CardDescription>
                  Each row links back to the rule editor so you can re-extract
                  or fill values manually. Auto-fixable rows can be cleared by
                  re-running the obligation canonical backfill.
                </CardDescription>
              </div>
              {isAdmin && (
                <Button
                  onClick={() => backfillMutation.mutate({ ruleIds: liftableRuleIdsInView })}
                  disabled={backfillMutation.isPending || liftableCount === 0}
                  data-testid="button-run-backfill-all"
                  title="Re-run the backfill for the auto-fixable rules currently shown"
                >
                  {isRunningAll ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  Re-run backfill on listed rules
                  {liftableCount > 0 && ` (${liftableCount})`}
                </Button>
              )}
            </div>
            {lastResult && (
              <div
                className="mt-3 rounded-md border border-border bg-muted/50 p-3 text-sm"
                data-testid="text-backfill-result"
              >
                <span className="font-medium">Last run:</span>{" "}
                {lastResult.result.updated} rule
                {lastResult.result.updated === 1 ? "" : "s"} updated,{" "}
                {lastResult.result.alreadyCanonical} already canonical,{" "}
                {lastResult.result.stillUnfillable} still need manual fix
                {lastResult.scope === "single" ? " (single rule)" : ""}.
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Contract</label>
                <Select value={contractId} onValueChange={setContractId}>
                  <SelectTrigger className="w-72" data-testid="select-contract-filter">
                    <SelectValue placeholder="All contracts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" data-testid="option-contract-all">
                      All contracts
                    </SelectItem>
                    {contracts.map((c) => (
                      <SelectItem
                        key={c.id}
                        value={c.id}
                        data-testid={`option-contract-${c.id}`}
                      >
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Show</label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as "missing" | "all")}
                >
                  <SelectTrigger className="w-56" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="missing" data-testid="option-status-missing">
                      Only rules missing canonical fields
                    </SelectItem>
                    <SelectItem value="all" data-testid="option-status-all">
                      All obligation rules
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-muted-foreground" data-testid="text-loading">
                Loading audit…
              </div>
            ) : isError ? (
              <div className="py-10 text-center text-rose-600" data-testid="text-error">
                Failed to load audit. Try again.
              </div>
            ) : rules.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground" data-testid="text-empty">
                {statusFilter === "missing"
                  ? "All obligation-accrual rules have canonical fields. Nothing to fix."
                  : "No obligation-accrual rules found in this scope."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Rule type</TableHead>
                    <TableHead>Missing fields</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => {
                    const meta = STATUS_BADGE[r.status];
                    const Icon = meta.icon;
                    return (
                      <TableRow key={r.id} data-testid={`row-rule-${r.id}`}>
                        <TableCell>
                          <Badge className={meta.className} data-testid={`badge-status-${r.id}`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-contract-${r.id}`}>{r.contractName}</TableCell>
                        <TableCell data-testid={`text-rulename-${r.id}`}>
                          {r.ruleName || <span className="text-muted-foreground">(unnamed)</span>}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs" data-testid={`text-ruletype-${r.id}`}>
                            {r.ruleType}
                          </code>
                        </TableCell>
                        <TableCell>
                          {r.status === "canonical" ? (
                            <span className="text-xs text-muted-foreground">
                              has: {r.presentFields.join(", ")}
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {r.missingFields.map((f) => (
                                <Badge
                                  key={f}
                                  variant="outline"
                                  className="text-xs"
                                  data-testid={`badge-missing-${r.id}-${f}`}
                                >
                                  {f}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {r.status === "liftable" && isAdmin && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => backfillMutation.mutate({ ruleId: r.id })}
                                disabled={backfillMutation.isPending}
                                data-testid={`button-fix-rule-${r.id}`}
                              >
                                {runningRuleId === r.id ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Wand2 className="h-3 w-3 mr-1" />
                                )}
                                Auto-fix
                              </Button>
                            )}
                            <Link href={`/contracts/${r.contractId}/manage`}>
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-open-rule-${r.id}`}
                              >
                                Open in editor
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
