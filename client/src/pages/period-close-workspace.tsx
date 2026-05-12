import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Lock, Bot, Filter } from "lucide-react";
import WorksheetView from "@/components/period-close/WorksheetView";
import CopilotView from "@/components/period-close/CopilotView";

type ViewMode = "copilot" | "worksheet";

export default function PeriodCloseWorkspace() {
  const { toast } = useToast();
  // Variant D (Co-Pilot) is the default per locked decision §9.
  const [view, setView] = useState<ViewMode>("copilot");
  // One-shot status filter handed off from the Co-Pilot's "Live Subledger
  // State" panel when the user clicks a stage row. WorksheetView consumes
  // this once on mount and then we clear it so manual filter clicks aren't
  // overridden on a later view-toggle.
  const [worksheetInitialStatus, setWorksheetInitialStatus] = useState<string | undefined>(undefined);

  const { data: periodData, isLoading } = useQuery<any>({
    queryKey: ["/api/period-close/latest"],
  });

  const lockMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/period-close/${periodData?.id}/approve`, {}),
    onSuccess: () => {
      toast({ title: "Period locked", description: `${periodData?.periodLabel} is now closed.` });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close/latest"] });
    },
    onError: async (e: any) => {
      // The approve endpoint returns 409 + error: 'CRITICAL_BLOCKERS_PRESENT'
      // when blockers remain. apiRequest throws but the message carries the
      // server payload — surface it to the user.
      toast({ title: "Cannot lock period", description: e.message, variant: "destructive" });
    },
  });

  const backButton = (
    <Link
      href="/sales-upload?tab=period-close"
      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 mb-3"
      data-testid="link-back-period-close"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Period Close
    </Link>
  );

  if (isLoading) {
    return (
      <MainLayout title="Period Close Workspace" description="Subledger close workspace">
        {backButton}
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          <span className="ml-2 text-sm text-muted-foreground">Loading period close…</span>
        </div>
      </MainLayout>
    );
  }

  if (!periodData) {
    return (
      <MainLayout title="Period Close Workspace" description="Subledger close workspace">
        {backButton}
        <div className="text-center py-20 text-muted-foreground">No period close data available</div>
      </MainLayout>
    );
  }

  const blockers = periodData.blockers ?? [];
  const isLocked = periodData.status === "approved";
  const criticalOpen = blockers.filter((b: any) => !b.resolved && b.severity === "critical").length;

  // Toolbar mounted in MainLayout's `actions` slot — view toggle + lock button
  // are global to the workspace regardless of which view is active.
  const actions = (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden" data-testid="view-toggle">
        <button
          onClick={() => setView("copilot")}
          className={`text-[11px] h-8 px-3 inline-flex items-center gap-1 transition-colors ${
            view === "copilot" ? "bg-orange-600 text-white font-semibold" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
          data-testid="button-view-copilot"
        >
          <Bot className="w-3 h-3" /> Co-Pilot
        </button>
        <button
          onClick={() => setView("worksheet")}
          className={`text-[11px] h-8 px-3 inline-flex items-center gap-1 transition-colors ${
            view === "worksheet" ? "bg-orange-600 text-white font-semibold" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
          data-testid="button-view-worksheet"
        >
          <Filter className="w-3 h-3" /> Worksheet
        </button>
      </div>
      <button
        onClick={() => lockMut.mutate()}
        disabled={lockMut.isPending || isLocked || criticalOpen > 0}
        title={
          isLocked ? "Period already locked" :
          criticalOpen > 0 ? `${criticalOpen} critical blocker(s) must be resolved first` :
          "Lock the period"
        }
        className={`text-[11px] h-8 px-3 rounded-md inline-flex items-center gap-1.5 font-semibold ${
          isLocked
            ? "bg-green-100 text-green-800 cursor-default"
            : criticalOpen > 0
              ? "bg-orange-600 text-white opacity-50 cursor-not-allowed"
              : "bg-orange-600 text-white hover:bg-orange-700"
        }`}
        data-testid="button-lock-period"
      >
        {lockMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
        {isLocked ? "Locked" : "Lock Period"}
      </button>
    </div>
  );

  return (
    <MainLayout
      title="Period Close Workspace"
      description="Subledger close — verify, review, approve, and lock the financial period"
      actions={actions}
    >
      {backButton}
      {view === "copilot" ? (
        <CopilotView
          periodId={periodData.id}
          periodLabel={periodData.periodLabel}
          blockers={blockers}
          signOff={{
            preparedBy: periodData.preparedBy ?? null,
            preparedAt: periodData.preparedAt ?? null,
            reviewedBy: periodData.reviewedBy ?? null,
            reviewedAt: periodData.reviewedAt ?? null,
            closedBy: periodData.closedBy ?? null,
            closeDate: periodData.closeDate ?? null,
            status: periodData.status ?? null,
          }}
          onSwitchToWorksheet={(opts?: { status?: string }) => {
            setWorksheetInitialStatus(opts?.status);
            setView("worksheet");
          }}
        />
      ) : (
        <WorksheetView
          periodId={periodData.id}
          periodLabel={periodData.periodLabel}
          blockers={blockers}
          initialStatus={worksheetInitialStatus}
          onInitialStatusConsumed={() => setWorksheetInitialStatus(undefined)}
          onSwitchToCopilot={() => setView("copilot")}
        />
      )}
    </MainLayout>
  );
}
