import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, ShieldCheck, ShieldX, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Decision {
  id: string;
  step: number;
  approverName: string | null;
  approverRole: string | null;
  decision: string;
  comment: string | null;
  decidedAt: string | null;
}
interface Step {
  id: string;
  sequence: number;
  approverRole: string;
  label: string | null;
}
interface ApprovalRequestRow {
  id: string;
  chainId: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  amount: string | null;
  currency: string | null;
  currentStep: number;
  status: string;
  requestedAt: string | null;
  completedAt: string | null;
  steps?: Step[];
  decisions?: Decision[];
}

interface Props {
  entityType: "claim" | "document" | "deduction";
  entityId: string;
}

/**
 * Renders the approval ladder for a single entity. Shows step status,
 * historical decisions, and Approve/Reject buttons when the current user
 * is on the active step.
 */
export function ApprovalPanel({ entityType, entityId }: Props) {
  const { user } = useAuth() as any;
  const { toast } = useToast();
  const [comment, setComment] = useState("");

  const q = useQuery<ApprovalRequestRow[]>({
    queryKey: ["/api/finance/approvals/by-entity", entityType, entityId],
    enabled: !!entityId,
  });

  const decideMut = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approve" | "reject" }) =>
      apiRequest("POST", `/api/finance/approvals/${id}/decide`, { decision, comment: comment || undefined }),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/finance/approvals/by-entity", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/approvals/pending"] });
      toast({ title: "Decision recorded" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message || "—", variant: "destructive" }),
  });

  const resendMut = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/finance/approvals/${id}/resend-notification`),
    onSuccess: (data: any) => {
      const sent = data?.sent ?? 0;
      toast({
        title: sent > 0 ? "Notification resent" : "No recipients found",
        description: sent > 0 ? `Email sent to ${sent} approver${sent === 1 ? "" : "s"}.` : "No active users match the current step's role.",
      });
    },
    onError: (e: any) => toast({ title: "Resend failed", description: e?.message || "—", variant: "destructive" }),
  });

  if (q.isLoading) return <div className="text-xs text-neutral-500">Loading approvals…</div>;
  const requests = q.data || [];
  if (requests.length === 0) {
    return <div className="text-xs text-neutral-500">No approvals required.</div>;
  }

  return (
    <div className="space-y-4">
      {requests.map(req => {
        const steps = req.steps || [];
        const decisions = req.decisions || [];
        const currentStep = steps.find(s => s.sequence === req.currentStep);
        const userRole = user?.role || "";
        const canDecide = req.status === "pending"
          && currentStep
          && (currentStep.approverRole === userRole || userRole === "system_admin");

        return (
          <div key={req.id} className="rounded-md border border-neutral-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-700">
                <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
                Approval ladder
              </div>
              <Badge variant={
                req.status === "approved" ? "default" :
                req.status === "rejected" ? "destructive" :
                "outline"
              } className="text-[10px]">{req.status}</Badge>
            </div>
            {req.entityLabel && (
              <div className="mb-2 text-xs text-neutral-600">{req.entityLabel}</div>
            )}
            <ol className="mb-3 space-y-1">
              {steps.map(s => {
                const decsForStep = decisions.filter(d => d.step === s.sequence);
                const approved = decsForStep.some(d => d.decision === "approve");
                const rejected = decsForStep.some(d => d.decision === "reject");
                const isActive = req.status === "pending" && s.sequence === req.currentStep;
                return (
                  <li key={s.id} className={cn(
                    "flex items-center gap-2 rounded px-2 py-1 text-xs",
                    isActive ? "bg-orange-50 ring-1 ring-orange-200" : "",
                  )}>
                    <span className={cn(
                      "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      approved ? "bg-emerald-600 text-white" :
                      rejected ? "bg-red-600 text-white" :
                      isActive ? "bg-orange-600 text-white" :
                      "bg-neutral-200 text-neutral-600",
                    )}>
                      {approved ? <Check className="h-3 w-3" /> : rejected ? <X className="h-3 w-3" /> : s.sequence}
                    </span>
                    <span className="font-medium text-neutral-900">{s.label || s.approverRole}</span>
                    <span className="text-neutral-500">· {s.approverRole}</span>
                    {decsForStep.length > 0 && (
                      <span className="ml-auto text-[10px] text-neutral-500">
                        {decsForStep[0].approverName} {decsForStep[0].decision === "approve" ? "approved" : "rejected"}
                      </span>
                    )}
                    {isActive && decsForStep.length === 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-orange-700">
                        <Clock className="h-3 w-3" /> awaiting
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {decisions.some(d => d.comment) && (
              <div className="mb-3 space-y-1 border-t border-neutral-100 pt-2">
                {decisions.filter(d => d.comment).map(d => (
                  <div key={d.id} className="text-[11px] text-neutral-600">
                    <span className="font-medium">{d.approverName}:</span> {d.comment}
                  </div>
                ))}
              </div>
            )}
            {canDecide && (
              <div className="space-y-2 border-t border-neutral-100 pt-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional comment…"
                  className="min-h-[60px] text-xs"
                  data-testid={`textarea-approval-comment-${req.id}`}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => decideMut.mutate({ id: req.id, decision: "approve" })}
                    disabled={decideMut.isPending}
                    data-testid={`button-approve-${req.id}`}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm" variant="destructive" className="flex-1"
                    onClick={() => decideMut.mutate({ id: req.id, decision: "reject" })}
                    disabled={decideMut.isPending}
                    data-testid={`button-reject-${req.id}`}
                  >
                    <ShieldX className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </div>
            )}
            {req.status === "pending" && (
              <div className="pt-1 flex justify-end">
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs text-neutral-600"
                  onClick={() => resendMut.mutate(req.id)}
                  disabled={resendMut.isPending}
                  data-testid={`button-resend-notification-${req.id}`}
                >
                  <Mail className="mr-1 h-3 w-3" />
                  {resendMut.isPending ? "Resending…" : "Resend notification"}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
