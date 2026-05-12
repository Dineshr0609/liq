import { useEffect, useState, useRef, useCallback, useMemo, Fragment } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Save, Send, CheckCircle, CheckCircle2, XCircle, Clock, FileText, History, ThumbsUp, ThumbsDown, Plus, Trash2, Pencil, ListOrdered, Filter, Users, Loader2, ChevronDown, ChevronRight, X, BarChart3, BookOpen, AlertTriangle, Info, Minus, Zap, Scale, Gavel, Check, Database, Sparkles, Settings, DollarSign, Calendar, CreditCard, Layers, Eye, ShieldCheck, CircleDot, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { formatDateUSA } from "@/lib/dateFormat";
import MainLayout from "@/components/layout/main-layout";
import { useContractEditLock } from "@/hooks/use-contract-edit-lock";
import { Lock } from "lucide-react";
import { LinkedMasterField } from "@/components/LinkedMasterField";

function formatDateForInput(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export default function ContractManagement() {
  const [, params] = useRoute("/contracts/:id/manage");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isCreateMode = params?.id === "new";
  const contractId = isCreateMode ? null : params?.id;
  const editLock = useContractEditLock(contractId || undefined);
  const isReadOnly = !!contractId && editLock.status === "locked" && !editLock.heldByMe;

  const urlTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
  const validTabs = ['metadata', 'analysis', 'clauses', 'rules', 'partners', 'policies', 'versions', 'terms', 'qualifiers'];
  const initialTab = urlTab && validTabs.includes(urlTab) ? urlTab : 'metadata';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [effectiveStart, setEffectiveStart] = useState("");
  const [effectiveEnd, setEffectiveEnd] = useState("");
  const [renewalTerms, setRenewalTerms] = useState("");
  const [governingLaw, setGoverningLaw] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [contractType, setContractType] = useState("");
  const [contractSubtype, setContractSubtype] = useState("");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  
  const [territoryScope, setTerritoryScope] = useState("");
  const [channelScope, setChannelScope] = useState("");
  const [paymentFrequency, setPaymentFrequency] = useState("");
  const [contractCategory, setContractCategory] = useState("");
  const [contractStatus, setContractStatus] = useState("draft");
  const [currency, setCurrency] = useState("USD");
  const [autoRenew, setAutoRenew] = useState(false);
  const [contractValueEstimated, setContractValueEstimated] = useState("");

  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [isAdminOverride, setIsAdminOverride] = useState(false);

  const [duplicateWarning, setDuplicateWarning] = useState<{ name: string; contractNumber: string } | null>(null);
  const duplicateCheckTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch next contract number for create mode
  const { data: nextNumberData } = useQuery<{ contractNumber: string }>({
    queryKey: ["/api/contracts/next-number"],
    enabled: isCreateMode,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  // Duplicate name check (debounced)
  const checkDuplicateName = useCallback((name: string) => {
    if (duplicateCheckTimer.current) clearTimeout(duplicateCheckTimer.current);
    if (!name.trim()) { setDuplicateWarning(null); return; }
    duplicateCheckTimer.current = setTimeout(async () => {
      try {
        const excludeParam = contractId ? `&excludeId=${contractId}` : "";
        const res = await fetch(`/api/contracts/check-duplicate-name?name=${encodeURIComponent(name.trim())}${excludeParam}`, { credentials: "include" });
        const data = await res.json();
        if (data.isDuplicate) {
          setDuplicateWarning({ name: data.existingContract.name, contractNumber: data.existingContract.contractNumber });
        } else {
          setDuplicateWarning(null);
        }
      } catch {}
    }, 500);
  }, [contractId]);

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  const { data: activeContextData } = useQuery<{ activeContext: { companyId?: string; businessUnitId?: string; locationId?: string } | null }>({
    queryKey: ["/api/user/active-context"],
  });
  const activeContext = activeContextData?.activeContext;

  const { data: orgContextsData } = useQuery<any[]>({
    queryKey: ["/api/user/org-contexts"],
  });

  const activeCompanyName = orgContextsData?.find(
    (ctx: any) => ctx.companyId === activeContext?.companyId
  )?.companyName || '';

  const userIsSystemAdmin = (user as any)?.isSystemAdmin === true;

  const { data: allPartnersData } = useQuery({
    queryKey: ["/api/master/partners"],
    queryFn: () => fetch("/api/master/partners", { credentials: "include" }).then(r => r.json()),
  });
  const allPartners = Array.isArray(allPartnersData) ? allPartnersData : [];

  const { data: allTerritoriesData } = useQuery({
    queryKey: ["/api/master/territories"],
    queryFn: () => fetch("/api/master/territories", { credentials: "include" }).then(r => r.json()),
  });
  const allTerritories = Array.isArray(allTerritoriesData) ? allTerritoriesData : [];

  const { data: allChannelsData } = useQuery({
    queryKey: ["/api/master/sales-channels"],
    queryFn: () => fetch("/api/master/sales-channels", { credentials: "include" }).then(r => r.json()),
  });
  const allChannels = Array.isArray(allChannelsData) ? allChannelsData : [];

  const { data: contractTypesData } = useQuery<Array<{ id: string; code: string; name: string; description: string | null; isActive: boolean }>>({
    queryKey: ["/api/contract-types"],
  });
  const systemContractTypes = (Array.isArray(contractTypesData) ? contractTypesData : (contractTypesData as any)?.contractTypes || []).filter((ct: any) => ct.isActive);

  const { data: subflowsData } = useQuery<{ subflows: Array<{ id: string; code: string; name: string; description: string | null; isActive: boolean }> }>({
    queryKey: ["/api/subflows"],
  });
  const activeSubflows = (subflowsData?.subflows || (Array.isArray(subflowsData) ? subflowsData : [])).filter((sf: any) => sf.isActive);


  // Fetch contract data
  const { data: contract, isLoading } = useQuery({
    queryKey: [`/api/contracts/${contractId}`],
    enabled: !!contractId && !isCreateMode,
  });

  const createContractMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contracts/create-manual", data),
    onSuccess: async (res: any) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contract created successfully" });
      navigate(`/contracts/${result.id}`);
    },
    onError: (err: any) => toast({ title: "Failed to create contract", description: err.message, variant: "destructive" }),
  });

  // Fetch version history
  const { data: versionsData } = useQuery({
    queryKey: [`/api/contracts/${contractId}/versions`],
    enabled: !!contractId && !isCreateMode,
  });

  const versions = versionsData?.versions || [];

  const masterQuery = useQuery({
    queryKey: ['/api/contracts', contractId, 'master'],
    queryFn: () => fetch(`/api/contracts/${contractId}/master`, { credentials: "include" }).then(r => r.json()),
    enabled: !!contractId && !isCreateMode,
  });

  const termsQuery = useQuery({
    queryKey: ['/api/contracts', contractId, 'terms'],
    queryFn: () => fetch(`/api/contracts/${contractId}/terms`, { credentials: "include" }).then(r => r.json()),
    enabled: !!contractId && !isCreateMode,
  });

  const qualifiersQuery = useQuery({
    queryKey: ['/api/contracts', contractId, 'qualifiers'],
    queryFn: () => fetch(`/api/contracts/${contractId}/qualifiers`, { credentials: "include" }).then(r => r.json()),
    enabled: !!contractId && !isCreateMode,
  });

  const partnersQuery = useQuery({
    queryKey: ['/api/contracts', contractId, 'partners'],
    queryFn: () => fetch(`/api/contracts/${contractId}/partners`, { credentials: "include" }).then(r => r.json()),
    enabled: !!contractId && !isCreateMode,
  });

  const clausesQuery = useQuery({
    queryKey: ['/api/contracts', contractId, 'clauses-list'],
    queryFn: () => fetch(`/api/contracts/${contractId}/clauses-list`, { credentials: "include" }).then(r => r.json()),
    enabled: !!contractId && !isCreateMode,
  });

  const analysisQuery = useQuery({
    queryKey: ['/api/contracts', contractId, 'analysis-record'],
    queryFn: () => fetch(`/api/contracts/${contractId}/analysis-record`, { credentials: "include" }).then(r => r.json()),
    enabled: !!contractId && !isCreateMode,
  });

  const rulesQuery = useQuery<any>({
    queryKey: ['/api/contracts', contractId, 'rules-list'],
    queryFn: () => fetch(`/api/contracts/${contractId}/rules-list`, { credentials: "include" }).then(r => r.json()),
    enabled: !!contractId && !isCreateMode,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data: any = query.state.data;
      const rulesCount = Array.isArray(data)
        ? data.length
        : Array.isArray(data?.rules)
          ? data.rules.length
          : 0;
      const status = (contract as any)?.status;
      const stillProcessing =
        status &&
        !['analyzed', 'completed', 'failed', 'error', 'draft'].includes(status);
      if (stillProcessing) return 3000;
      if (rulesCount === 0 && status === 'analyzed') return 5000;
      return false;
    },
  });

  // Rule-readiness gate for contract approval. Mirrors the server-side
  // integrity check in services/contractApprovalIntegrity.ts: a contract can
  // only be approved when every active rule is also approved. Drives the
  // disabled state of the Approve / Force Approve buttons in the Versions tab.
  const ruleReadiness = useMemo(() => {
    const raw: any = rulesQuery.data;
    const allRules: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.rules) ? raw.rules : [];
    const active = allRules.filter(r => r.isActive !== false);
    let approved = 0, pending = 0, rejected = 0;
    for (const r of active) {
      const s = (r.approvalStatus || 'pending').toLowerCase();
      if (s === 'approved') approved++;
      else if (s === 'rejected') rejected++;
      else pending++;
    }
    const total = active.length;
    const isReady = total > 0 && approved === total;
    let message = '';
    if (total === 0) {
      message = 'No active rules on this contract — add and approve at least one rule before approving the contract.';
    } else if (!isReady) {
      message = `${approved} of ${total} rules approved. ${pending > 0 ? `${pending} need sign-off` : ''}${pending > 0 && rejected > 0 ? '; ' : ''}${rejected > 0 ? `${rejected} rejected` : ''}.`;
    }
    return { total, approved, pending, rejected, isReady, message };
  }, [rulesQuery.data]);

  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoGenerateAttempted, setAutoGenerateAttempted] = useState(false);

  useEffect(() => {
    if (
      contractId &&
      !isCreateMode &&
      contract?.status === 'analyzed' &&
      masterQuery.isFetched &&
      !masterQuery.data &&
      !autoGenerating &&
      !autoGenerateAttempted
    ) {
      setAutoGenerating(true);
      setAutoGenerateAttempted(true);
      apiRequest("POST", `/api/contracts/${contractId}/generate-structured-data`, {})
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'master'] });
          queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'terms'] });
          queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'qualifiers'] });
          queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'partners'] });
        })
        .catch(() => {})
        .finally(() => setAutoGenerating(false));
    }
  }, [contractId, contract?.status, masterQuery.isFetched, masterQuery.data, autoGenerating, autoGenerateAttempted]);

  // Check if current user can approve (admin or owner)
  const canApprove = user?.role === 'admin' || user?.role === 'owner';

  // Initialize form with contract data (includes all metadata fields directly on contract)
  useEffect(() => {
    if (contract) {
      setDisplayName(contract.displayName || contract.originalName || "");
      setEffectiveStart(contract.effectiveStart ? format(new Date(contract.effectiveStart), "yyyy-MM-dd") : "");
      setEffectiveEnd(contract.effectiveEnd ? format(new Date(contract.effectiveEnd), "yyyy-MM-dd") : "");
      setRenewalTerms(contract.renewalTerms || "");
      setGoverningLaw(contract.governingLaw || "");
      setOrganizationName(contract.organizationName || contract.owningParty || "");
      setCounterpartyName(contract.counterpartyName || "");
      setContractType(contract.contractType || "");
      setContractSubtype(contract.contractSubtype || "");
      setPriority(contract.priority || "normal");
      setNotes(contract.notes || "");
      setTerritoryScope(contract.territoryScope || "");
      setChannelScope(contract.channelScope || "");
      setPaymentFrequency(contract.paymentFrequency || "");
      setContractCategory(contract.contractCategory || "");
      setContractStatus((contract.contractStatus || "draft").toLowerCase());
      setCurrency(contract.currency || "USD");
      setAutoRenew(contract.autoRenew || false);
      setContractValueEstimated(contract.contractValueEstimatedAnnual || "");
    }
  }, [contract]);

  useEffect(() => {
    const master = masterQuery.data;
    if (master) {
      if (!territoryScope) setTerritoryScope(master.territoryScope || "");
      if (!channelScope) setChannelScope(master.channelScope || "");
      if (!paymentFrequency) setPaymentFrequency(master.paymentFrequency || "");
      if (!contractCategory) setContractCategory(master.contractCategory || "");
      if (!contractStatus || contractStatus === "draft") setContractStatus((master.contractStatus || "active").toLowerCase());
      if (currency === "USD" && master.currency) setCurrency(master.currency);
      if (!autoRenew && master.autoRenew) setAutoRenew(master.autoRenew);
      if (!contractValueEstimated) setContractValueEstimated(master.contractValueEstimatedAnnual || "");
    }
  }, [masterQuery.data]);

  useEffect(() => {
    if (isCreateMode && activeCompanyName && !organizationName) {
      setOrganizationName(activeCompanyName);
    }
  }, [isCreateMode, activeCompanyName]);

  // Update metadata mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!changeSummary.trim()) {
        throw new Error("Please describe what changed");
      }
      if (duplicateWarning) {
        throw new Error(`A contract named "${duplicateWarning.name}" (${duplicateWarning.contractNumber}) already exists. Please use a unique name.`);
      }

      const metadata = {
        displayName,
        effectiveStart: effectiveStart || undefined,
        effectiveEnd: effectiveEnd || undefined,
        renewalTerms,
        governingLaw,
        organizationName,
        counterpartyName,
        contractType,
        contractSubtype: contractSubtype && contractSubtype !== 'none' ? contractSubtype : undefined,
        priority,
        notes,
        changeSummary,
        territoryScope,
        channelScope,
        paymentFrequency,
        contractCategory,
        contractStatus,
        currency,
        autoRenew,
        contractValueEstimated: contractValueEstimated || undefined,
      };

      return await apiRequest("PATCH", `/api/contracts/${contractId}/metadata`, metadata);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}/versions`] });
      toast({
        title: "Success",
        description: "Contract metadata updated successfully",
      });
      setChangeSummary(""); // Reset change summary
    },
    onError: (error: any) => {
      if (error?.code === 'CONTRACT_VALIDATION_FAILED' && Array.isArray(error?.failures)) {
        toast({
          title: `Cannot activate — ${error.failures.length} issue${error.failures.length === 1 ? '' : 's'} found`,
          description: (error.summary || error.failures.map((f: any) => `• ${f.message}`).join('\n')),
          variant: 'destructive',
          duration: 12000,
        });
      } else {
        toast({
          title: "Error",
          description: (error?.message || "Failed to update contract metadata").replace(/^\d+:\s*/, ''),
          variant: "destructive",
        });
      }
    },
  });

  // Submit for approval mutation
  const submitApprovalMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/contracts/${contractId}/submit-approval`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}/versions`] });
      toast({
        title: "Success",
        description: "Contract submitted for approval",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit for approval",
        variant: "destructive",
      });
    },
  });

  // Discard pending rule-edit changes — restores rules to their prior approved
  // state and brings the contract back to its last approved version.
  const discardPendingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/contracts/${contractId}/discard-pending-changes`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}/versions`] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules-list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules'] });
      toast({
        title: "Pending changes discarded",
        description: data?.message || "Contract restored to its previous approved version.",
      });
    },
    onError: (error: any) => {
      const msg = (error?.message || "Failed to discard pending changes").replace(/^\d+:\s*/, "");
      toast({ title: "Discard failed", description: msg, variant: "destructive" });
    },
  });

  // Approve version mutation
  const approveMutation = useMutation({
    mutationFn: async (versionId: string) => {
      return await apiRequest("POST", `/api/contracts/versions/${versionId}/approve`, {
        status: 'approved',
        decisionNotes: approvalNotes.trim() || undefined,
        adminOverride: isAdminOverride,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}/versions`] });
      toast({
        title: "Approved",
        description: "Contract version approved successfully",
      });
      setExpandedVersionId(null);
      setApprovalNotes("");
      setApprovalAction(null);
      setIsAdminOverride(false);
    },
    onError: (error: any) => {
      const raw = String(error?.message || "Failed to approve version");
      const clean = raw.replace(/^\d{3}:\s*/, "");
      toast({
        title: "Approval blocked",
        description: clean,
        variant: "destructive",
      });
    },
  });

  // Reject version mutation
  const rejectMutation = useMutation({
    mutationFn: async (versionId: string) => {
      if (!approvalNotes.trim()) throw new Error("Please provide a reason for rejection");
      return await apiRequest("POST", `/api/contracts/versions/${versionId}/approve`, {
        status: 'rejected',
        decisionNotes: approvalNotes.trim(),
        adminOverride: isAdminOverride,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}/versions`] });
      toast({
        title: "Rejected",
        description: "Contract version rejected",
      });
      setExpandedVersionId(null);
      setApprovalNotes("");
      setApprovalAction(null);
      setIsAdminOverride(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject version",
        variant: "destructive",
      });
    },
  });

  const handleApprovalAction = (action: 'approve' | 'reject', versionId: string, adminOverride = false) => {
    setApprovalAction(action);
    setExpandedVersionId(versionId);
    setApprovalNotes(""); // Reset notes when opening
    setIsAdminOverride(adminOverride); // Set admin override flag
  };

  const handleConfirmApproval = (versionId: string) => {
    if (approvalAction === 'approve') {
      approveMutation.mutate(versionId);
    } else if (approvalAction === 'reject') {
      rejectMutation.mutate(versionId);
    }
  };

  const handleCancelApproval = () => {
    setExpandedVersionId(null);
    setApprovalAction(null);
    setApprovalNotes("");
    setIsAdminOverride(false);
  };

  const handleCreateContract = () => {
    if (!displayName.trim()) {
      toast({ title: "Contract name is required", variant: "destructive" });
      return;
    }
    if (duplicateWarning) {
      toast({ title: "Duplicate contract name", description: `A contract named "${duplicateWarning.name}" (${duplicateWarning.contractNumber}) already exists.`, variant: "destructive" });
      return;
    }
    createContractMutation.mutate({
      displayName,
      contractType: contractType || undefined,
      contractSubtype: contractSubtype && contractSubtype !== 'none' ? contractSubtype : undefined,
      priority,
      notes,
      organizationName,
      counterpartyName,
      effectiveStart: effectiveStart || undefined,
      effectiveEnd: effectiveEnd || undefined,
      renewalTerms,
      governingLaw,
      territoryScope,
      channelScope,
      paymentFrequency,
      contractCategory,
      contractStatus: contractStatus || "active",
      currency,
      autoRenew,
      contractValueEstimated: contractValueEstimated || undefined,
    });
  };

  if (!isCreateMode && isLoading) {
    return (
      <MainLayout title="Contract Management">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" data-testid="loading-spinner" />
            <p className="mt-4 text-muted-foreground">Loading contract...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!isCreateMode && !contract) {
    return (
      <MainLayout title="Contract Management">
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Contract not found</h3>
          <Button onClick={() => navigate("/contracts")} data-testid="button-back-contracts">
            Back to Contracts
          </Button>
        </div>
      </MainLayout>
    );
  }

  const getApprovalBadge = (state: string) => {
    switch (state) {
      case "approved":
        return <Badge className="bg-green-500" data-testid="badge-approved"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" data-testid="badge-rejected"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "pending_approval":
        return <Badge variant="secondary" data-testid="badge-pending"><Clock className="h-3 w-3 mr-1" />Pending Approval</Badge>;
      case "superseded":
        return <Badge variant="outline" className="text-muted-foreground line-through" data-testid="badge-superseded">Superseded</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-draft">Draft</Badge>;
    }
  };

  return (
    <MainLayout title={isCreateMode ? "New Contract" : (contract?.displayName || "Contract Management")}>
    <div className={`container mx-auto py-8 px-4 max-w-7xl space-y-6 ${isReadOnly ? 'opacity-90' : ''}`} data-testid="contract-management-page">
      {/* Edit-lock banner — only renders for an existing contract held by another user */}
      {!isCreateMode && contractId && editLock.status === "locked" && !editLock.heldByMe && (
        <div
          className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30"
          data-testid="banner-edit-lock"
        >
          <div className="flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5 text-amber-700 dark:text-amber-400" />
            <div>
              <div className="font-medium text-amber-900 dark:text-amber-200">
                {editLock.holderName || "Another user"} is currently editing this contract.
              </div>
              <div className="text-xs text-amber-800/80 dark:text-amber-300/80">
                The page is in read-only mode. You can view metadata, rules and history, but saves will be rejected.
                {editLock.isStale && " The lock looks idle — you can take over."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => editLock.refresh()}
              data-testid="button-edit-lock-refresh"
            >
              Refresh
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                  data-testid="button-edit-lock-takeover"
                >
                  Take over editing
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent data-testid="dialog-edit-lock-takeover">
                <AlertDialogHeader>
                  <AlertDialogTitle>Take over the edit lock?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {editLock.holderName || "Another user"} currently holds the edit lock for this contract.
                    Taking over will end their editing session — any unsaved changes on their side will be lost.
                    This action is recorded in the audit trail.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-takeover-cancel">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => editLock.takeOver()}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="button-takeover-confirm"
                  >
                    Take over
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
      {/* Header with Back Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/contracts")}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Contracts
          </Button>
          {!isCreateMode && contractId && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/contracts/${contractId}`)}
                className="gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                data-testid="button-goto-analysis"
              >
                <Eye className="h-4 w-4" />
                Contract Analysis View
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Contract Info Card */}
      <Card className="border-2 shadow-lg bg-gradient-to-r from-background to-muted/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-page-title">
                    {isCreateMode ? "New Contract" : (contract?.displayName || contract?.originalName || "Contract Management")}
                  </h1>
                  <p className="text-sm text-muted-foreground" data-testid="text-contract-number">
                    {isCreateMode ? "Create a new contract from scratch" : `Contract ID: ${contract?.contractNumber || contract?.id?.substring(0, 8)}`}
                  </p>
                </div>
              </div>
            </div>
            {isCreateMode ? (
              <Button onClick={handleCreateContract} disabled={createContractMutation.isPending} data-testid="button-create-contract">
                {createContractMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Contract
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => navigate(`/contracts/${contractId}`)}
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-500 dark:hover:bg-stone-950"
                  data-testid="button-view-contract"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View Contract
                </Button>
                <ValidateContractButton contractId={contractId!} />
                {getApprovalBadge(contract?.approvalState || "draft")}
                <Badge variant="outline" className="text-sm" data-testid="badge-version">
                  Version {contract?.currentVersion || 1}
                </Badge>
                {ruleReadiness.total > 0 && (
                  <Badge
                    variant="outline"
                    className={
                      ruleReadiness.isReady
                        ? 'text-sm border-green-300 text-green-700 dark:border-green-800 dark:text-green-400'
                        : 'text-sm border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400'
                    }
                    data-testid="badge-rule-readiness"
                    title={ruleReadiness.isReady
                      ? 'All active rules approved — ready to calculate'
                      : `${ruleReadiness.pending} need sign-off${ruleReadiness.rejected > 0 ? `, ${ruleReadiness.rejected} rejected` : ''}`}
                  >
                    {ruleReadiness.approved}/{ruleReadiness.total} rules approved
                  </Badge>
                )}
                {contract?.contractType && (
                  <Badge variant="secondary" className="text-sm">
                    {contract.contractType}
                  </Badge>
                )}
                {contract?.approvalState === 'pending_approval'
                  && Array.isArray(versions)
                  && versions.some((v: any) => v.approvalState === 'superseded' || v.approvalState === 'approved') && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                        data-testid="button-discard-pending"
                        disabled={discardPendingMutation.isPending}
                      >
                        {discardPendingMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                        Discard pending changes
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent data-testid="dialog-discard-pending">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Discard pending changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will roll back every rule that was edited in the current approval cycle, delete version {contract?.currentVersion}, and restore the contract to its previous approved version. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-discard-cancel">Keep changes</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => discardPendingMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                          data-testid="button-discard-confirm"
                        >
                          Discard
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full h-12 grid-cols-7">
          <TabsTrigger value="metadata" className="text-sm" data-testid="tab-metadata">
            <FileText className="h-4 w-4 mr-1" />
            Metadata
          </TabsTrigger>
          <TabsTrigger value="analysis" className="text-sm" data-testid="tab-analysis"><BarChart3 className="h-4 w-4 mr-1" />Analysis</TabsTrigger>
          <TabsTrigger value="clauses" className="text-sm" data-testid="tab-clauses"><BookOpen className="h-4 w-4 mr-1" />Clauses</TabsTrigger>
          <TabsTrigger value="rules" className="text-sm" data-testid="tab-rules"><ListOrdered className="h-4 w-4 mr-1" />Rules</TabsTrigger>
          {/* Terms tab hidden — data table preserved in DB, rules are the primary calculation engine */}
          {/* Qualifiers tab hidden — rule-level qualifiers on Rules tab are the primary qualifier system */}
          <TabsTrigger value="partners" className="text-sm" data-testid="tab-partners"><Users className="h-4 w-4 mr-1" />Partners</TabsTrigger>
          <TabsTrigger value="policies" className="text-sm" data-testid="tab-policies"><Settings className="h-4 w-4 mr-1" />Policies</TabsTrigger>
          <TabsTrigger value="versions" className="text-sm" data-testid="tab-versions"><History className="h-4 w-4 mr-1" />Versions</TabsTrigger>
        </TabsList>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="space-y-6 mt-6">
          <Card className="shadow-md" data-testid="card-metadata">
            <CardHeader className="bg-muted/50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Basic Information</CardTitle>
                  <CardDescription className="mt-1">
                    Core contract details and identifying information
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30 mb-2" data-testid="contract-status-bar">
                <Label className="text-sm font-semibold whitespace-nowrap">Contract Status</Label>
                <Select value={contractStatus || "draft"} onValueChange={setContractStatus}>
                  <SelectTrigger className="h-9 w-48" data-testid="select-contract-status-top">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <Badge className={`text-xs ${
                  contractStatus === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                  contractStatus === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300' :
                  contractStatus === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' :
                  contractStatus === 'expired' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                  contractStatus === 'terminated' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                  contractStatus === 'suspended' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300' :
                  'bg-gray-100 text-gray-800'
                }`} variant="secondary">
                  {(contractStatus || 'draft').charAt(0).toUpperCase() + (contractStatus || 'draft').slice(1)}
                </Badge>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="contractId" className="text-sm font-semibold">
                    Contract ID
                  </Label>
                  <Input
                    id="contractId"
                    value={isCreateMode ? (nextNumberData?.contractNumber || "Generating...") : (contract?.contractNumber || contract?.id?.substring(0, 8) || "")}
                    disabled
                    className="h-11 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono"
                    data-testid="input-contract-id"
                  />
                  <p className="text-xs text-gray-500">Auto-generated. Cannot be modified.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-sm font-semibold">
                    Contract Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); checkDuplicateName(e.target.value); }}
                    placeholder="Enter contract name"
                    className={`h-11 ${duplicateWarning ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    data-testid="input-display-name"
                  />
                  {duplicateWarning && (
                    <p className="text-xs text-red-600 flex items-center gap-1" data-testid="text-duplicate-warning">
                      <AlertTriangle className="h-3 w-3" />
                      Duplicate: "{duplicateWarning.name}" ({duplicateWarning.contractNumber}) already exists
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="contractType" className="text-sm font-semibold">
                    Contract Flow Type
                  </Label>
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger className="h-11" data-testid="select-contract-type">
                      <SelectValue placeholder="Select contract type" />
                    </SelectTrigger>
                    <SelectContent>
                      {systemContractTypes.map((ct: any) => (
                        <SelectItem key={ct.id} value={ct.code}>
                          {ct.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contractSubtype" className="text-sm font-semibold">
                    Subflow
                  </Label>
                  <Select value={contractSubtype || "none"} onValueChange={(v) => setContractSubtype(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-11" data-testid="select-contract-subtype">
                      <SelectValue placeholder="Select subflow (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {activeSubflows.map((sf: any) => (
                        <SelectItem key={sf.id || sf.code} value={sf.code}>
                          {sf.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organizationName" className="text-sm font-semibold">
                    Your Organization
                  </Label>
                  {isCreateMode ? (
                    <Input
                      id="organizationName"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Enter organization name"
                      className="h-11"
                      data-testid="input-organization"
                    />
                  ) : (
                    <LinkedMasterField
                      value={organizationName}
                      resolvedId={(contract as any)?.organizationCompanyId}
                      linkStatus={(contract as any)?.organizationLinkStatus}
                      confidence={(contract as any)?.organizationLinkConfidence}
                      method={(contract as any)?.organizationLinkMethod}
                      rawValue={(contract as any)?.organizationLinkRawValue || organizationName}
                      masterEndpoint="/api/master-data/companies"
                      rowMapper={(c: any) => ({ id: c.id, name: c.companyName || c.company_name || c.name })}
                      linkTarget="company"
                      mutationEndpoint={`/api/contracts/${contractId}/organization-link`}
                      idFieldName="companyId"
                      nameFieldName="companyName"
                      invalidateKeys={[[`/api/contracts/${contractId}`], ["/api/contracts", contractId], ["/api/contracts"]]}
                      placeholder="Select your organization"
                      disabled={isReadOnly}
                      testId="linked-organization"
                    />
                  )}
                  {isCreateMode && <p className="text-xs text-muted-foreground">Pre-filled from your active organization. You can change it.</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="counterpartyName" className="text-sm font-semibold">
                    Counterparty
                  </Label>
                  {isCreateMode ? (
                    <Select value={counterpartyName} onValueChange={setCounterpartyName}>
                      <SelectTrigger className="h-11" data-testid="select-counterparty">
                        <SelectValue placeholder="Select counterparty" />
                      </SelectTrigger>
                      <SelectContent>
                        {allPartners.map((p: any) => (
                          <SelectItem key={p.partner_id || p.id} value={p.partner_name}>
                            {p.partner_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <LinkedMasterField
                      value={counterpartyName}
                      resolvedId={(contract as any)?.counterpartyPartnerId}
                      linkStatus={(contract as any)?.counterpartyLinkStatus}
                      confidence={(contract as any)?.counterpartyLinkConfidence}
                      method={(contract as any)?.counterpartyLinkMethod}
                      rawValue={(contract as any)?.counterpartyLinkRawValue || counterpartyName}
                      masterEndpoint="/api/master/partners"
                      rowMapper={(p: any) => ({ id: p.partner_id || p.id, name: p.partner_name })}
                      linkTarget="partner"
                      mutationEndpoint={`/api/contracts/${contractId}/counterparty-link`}
                      idFieldName="partnerId"
                      nameFieldName="partnerName"
                      invalidateKeys={[[`/api/contracts/${contractId}`], ["/api/contracts", contractId], ["/api/contracts"]]}
                      placeholder="Select counterparty"
                      disabled={isReadOnly}
                      testId="linked-counterparty"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="governingLaw" className="text-sm font-semibold">
                    Governing Law
                  </Label>
                  <Input
                    id="governingLaw"
                    value={governingLaw}
                    onChange={(e) => setGoverningLaw(e.target.value)}
                    placeholder="Jurisdiction"
                    className="h-11"
                    data-testid="input-governing-law"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md" data-testid="card-dates">
            <CardHeader className="bg-muted/50 border-b">
              <CardTitle className="text-xl">Contract Timeline</CardTitle>
              <CardDescription className="mt-1">
                Effective dates and contract duration
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="effectiveStart" className="text-sm font-semibold">
                    Effective Start Date
                  </Label>
                  <DatePickerInput
                    id="effectiveStart"
                    value={effectiveStart}
                    onChange={setEffectiveStart}
                    className="h-11"
                    data-testid="input-effective-start"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="effectiveEnd" className="text-sm font-semibold">
                    Effective End Date
                  </Label>
                  <DatePickerInput
                    id="effectiveEnd"
                    value={effectiveEnd}
                    onChange={setEffectiveEnd}
                    className="h-11"
                    data-testid="input-effective-end"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md" data-testid="card-business-details">
            <CardHeader className="bg-muted/50 border-b">
              <CardTitle className="text-xl">Financial & Business Details</CardTitle>
              <CardDescription className="mt-1">
                Territory, channel, payment, and financial scope
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="territoryScope" className="text-sm font-semibold">
                    Territory Scope
                  </Label>
                  <Select value={territoryScope || "unset"} onValueChange={(v) => setTerritoryScope(v === "unset" ? "" : v)}>
                    <SelectTrigger className="h-11" data-testid="select-territory-scope">
                      <SelectValue placeholder="Select territory" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not Set</SelectItem>
                      {allTerritories.map((t: any) => (
                        <SelectItem key={t.territory_id || t.id} value={t.territory_name}>
                          {t.territory_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channelScope" className="text-sm font-semibold">
                    Channel Scope
                  </Label>
                  <Select value={channelScope || "unset"} onValueChange={(v) => setChannelScope(v === "unset" ? "" : v)}>
                    <SelectTrigger className="h-11" data-testid="select-channel-scope">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not Set</SelectItem>
                      {allChannels.map((c: any) => (
                        <SelectItem key={c.channel_id || c.id} value={c.channel_name}>
                          {c.channel_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentFrequency" className="text-sm font-semibold">
                    Payment Frequency
                  </Label>
                  <Select value={paymentFrequency || "unset"} onValueChange={(v) => setPaymentFrequency(v === "unset" ? "" : v)}>
                    <SelectTrigger className="h-11" data-testid="select-payment-frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not Set</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="one_time">One-Time</SelectItem>
                      <SelectItem value="on_demand">On Demand</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-sm font-semibold">
                    Currency
                  </Label>
                  <Select value={currency || "USD"} onValueChange={setCurrency}>
                    <SelectTrigger className="h-11" data-testid="select-currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                      <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contractValueEstimated" className="text-sm font-semibold">
                    Estimated Annual Value
                  </Label>
                  <Input
                    id="contractValueEstimated"
                    value={contractValueEstimated}
                    onChange={(e) => setContractValueEstimated(e.target.value)}
                    placeholder="e.g. 500000"
                    type="number"
                    className="h-11"
                    data-testid="input-estimated-value"
                  />
                </div>

              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md" data-testid="card-terms">
            <CardHeader className="bg-muted/50 border-b">
              <CardTitle className="text-xl">Terms & Additional Details</CardTitle>
              <CardDescription className="mt-1">
                Renewal terms, notes, and supplementary information
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="renewalTerms" className="text-sm font-semibold">
                  Renewal Terms
                </Label>
                <Textarea
                  id="renewalTerms"
                  value={renewalTerms}
                  onChange={(e) => setRenewalTerms(e.target.value)}
                  placeholder="Describe renewal terms and conditions"
                  rows={4}
                  className="resize-none"
                  data-testid="textarea-renewal-terms"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-semibold">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes or comments"
                  rows={4}
                  className="resize-none"
                  data-testid="textarea-notes"
                />
              </div>
            </CardContent>
          </Card>

          {isCreateMode ? (
            <Card className="shadow-md border-2 border-primary/20" data-testid="card-create-submit">
              <CardContent className="pt-6">
                <div className="flex justify-end">
                  <Button onClick={handleCreateContract} disabled={createContractMutation.isPending} size="lg" className="gap-2" data-testid="button-create-contract-bottom">
                    {createContractMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create Contract
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
          <Card className="shadow-md border-2 border-primary/20" data-testid="card-submit">
            <CardHeader className="bg-primary/5 border-b border-primary/20">
              <CardTitle className="text-xl">Save Changes</CardTitle>
              <CardDescription className="mt-1">
                Document your changes before saving
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="changeSummary" className="text-sm font-semibold">
                  Change Summary <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="changeSummary"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Briefly describe what changed"
                  className="h-11"
                  data-testid="input-change-summary"
                />
                <p className="text-sm text-muted-foreground">
                  Required: Explain what changes you made to the contract metadata
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !changeSummary.trim()}
                  size="lg"
                  className="gap-2"
                  data-testid="button-save-changes"
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                {contract?.approvalState === "draft" && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => submitApprovalMutation.mutate()}
                    disabled={submitApprovalMutation.isPending}
                    className="gap-2"
                    data-testid="button-submit-approval"
                  >
                    <Send className="h-4 w-4" />
                    Submit for Approval
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Version History Tab */}
        <TabsContent value="versions" className="space-y-4 mt-6">
          {isCreateMode ? (
            <CreateModeTabPlaceholder tabName="Versions" onCreateContract={handleCreateContract} isPending={createContractMutation.isPending} />
          ) : (
          <Card className="shadow-md" data-testid="card-version-history">
            <CardHeader className="bg-muted/50 border-b">
              <CardTitle className="text-xl">Version History</CardTitle>
              <CardDescription className="mt-1">
                Complete timeline of all contract versions and approval decisions
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {versions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground font-medium" data-testid="text-no-versions">
                    No version history available yet
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Changes to contract metadata will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {versions.map((version: any, index: number) => (
                    <div
                      key={version.id}
                      className="relative"
                      data-testid={`version-${version.versionNumber}`}
                    >
                      {/* Timeline line - only show if not last item */}
                      {index < versions.length - 1 && (
                        <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
                      )}
                      
                      <div className="flex gap-4">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center">
                          <div className={`flex items-center justify-center h-10 w-10 rounded-full border-2 ${
                            version.approvalState === 'approved' 
                              ? 'bg-green-100 border-green-500 dark:bg-green-950' 
                              : version.approvalState === 'rejected'
                              ? 'bg-red-100 border-red-500 dark:bg-red-950'
                              : version.approvalState === 'pending_approval'
                              ? 'bg-yellow-100 border-yellow-500 dark:bg-yellow-950'
                              : version.approvalState === 'superseded'
                              ? 'bg-gray-100 border-gray-300 opacity-60 dark:bg-gray-900'
                              : 'bg-gray-100 border-gray-400 dark:bg-gray-900'
                          }`}>
                            {version.approvalState === 'approved' ? (
                              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : version.approvalState === 'rejected' ? (
                              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            ) : version.approvalState === 'pending_approval' ? (
                              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                            ) : version.approvalState === 'superseded' ? (
                              <FileText className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            ) : (
                              <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* Version card */}
                        <div className="flex-1 pb-6">
                          <Card className={`shadow-sm ${
                            version.approvalState === 'pending_approval' 
                              ? 'border-2 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20'
                              : ''
                          }`}>
                            <CardContent className="p-5">
                              <div className="space-y-3">
                                {/* Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="font-semibold" data-testid={`badge-version-${version.versionNumber}`}>
                                      Version {version.versionNumber}
                                    </Badge>
                                    {getApprovalBadge(version.approvalState)}
                                  </div>
                                  <span className="text-sm text-muted-foreground" data-testid={`text-version-date-${version.versionNumber}`}>
                                    {format(new Date(version.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                  </span>
                                </div>

                                {/* Change summary */}
                                <div className="bg-muted/50 dark:bg-muted/20 rounded-md p-3">
                                  <p className="text-sm font-medium text-foreground" data-testid={`text-change-summary-${version.versionNumber}`}>
                                    {version.changeSummary || "No summary provided"}
                                  </p>
                                </div>

                                {/* Metadata */}
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span data-testid={`text-editor-${version.versionNumber}`}>
                                    Edited by: {version.editorUsername || 'Unknown'} (ID: {version.editorId?.substring(0, 8)})
                                  </span>
                                </div>
                                
                                {/* Approval Actions - Only show for admins when version is pending */}
                                {canApprove && version.approvalState === 'pending_approval' && user?.id !== version.editorId && (
                                  <div className="pt-3 border-t space-y-3">
                                    {!ruleReadiness.isReady && (
                                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 flex items-start gap-2" data-testid={`alert-rules-not-ready-${version.versionNumber}`}>
                                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                        <div className="text-xs text-amber-800 dark:text-amber-200">
                                          <div className="font-semibold mb-0.5">Approval blocked — rules not ready</div>
                                          <div>{ruleReadiness.message}</div>
                                          <button
                                            type="button"
                                            onClick={() => setActiveTab('rules')}
                                            className="mt-1 underline font-medium hover:text-amber-900 dark:hover:text-amber-100"
                                            data-testid={`link-fix-rules-${version.versionNumber}`}
                                          >
                                            Go to Rules tab →
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    {expandedVersionId !== version.id ? (
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() => handleApprovalAction('approve', version.id)}
                                          disabled={!ruleReadiness.isReady}
                                          title={!ruleReadiness.isReady ? ruleReadiness.message : undefined}
                                          className="bg-green-600 hover:bg-green-700 gap-2"
                                          data-testid={`button-approve-${version.versionNumber}`}
                                        >
                                          <ThumbsUp className="h-4 w-4" />
                                          Approve
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => handleApprovalAction('reject', version.id)}
                                          className="gap-2"
                                          data-testid={`button-reject-${version.versionNumber}`}
                                        >
                                          <ThumbsDown className="h-4 w-4" />
                                          Reject
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="bg-muted/50 dark:bg-muted/20 rounded-md p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                          {approvalAction === 'approve' ? (
                                            <>
                                              <ThumbsUp className="h-4 w-4 text-green-600" />
                                              <span>Approve Version {version.versionNumber}</span>
                                            </>
                                          ) : (
                                            <>
                                              <ThumbsDown className="h-4 w-4 text-red-600" />
                                              <span>Reject Version {version.versionNumber}</span>
                                            </>
                                          )}
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor={`notes-${version.id}`} className="text-sm">
                                            {approvalAction === 'approve' ? 'Notes (Optional)' : 'Rejection Reason (Required)'}
                                          </Label>
                                          <Textarea
                                            id={`notes-${version.id}`}
                                            value={approvalNotes}
                                            onChange={(e) => setApprovalNotes(e.target.value)}
                                            placeholder={approvalAction === 'approve' 
                                              ? 'Add any notes about this approval...'
                                              : 'Explain what needs to be changed...'}
                                            rows={3}
                                            className="resize-none"
                                            data-testid={`textarea-approval-notes-${version.versionNumber}`}
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => handleConfirmApproval(version.id)}
                                            disabled={
                                              (approvalAction === 'reject' && !approvalNotes.trim()) ||
                                              (approvalAction === 'approve' && !ruleReadiness.isReady) ||
                                              approveMutation.isPending ||
                                              rejectMutation.isPending
                                            }
                                            title={approvalAction === 'approve' && !ruleReadiness.isReady ? ruleReadiness.message : undefined}
                                            className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                                            variant={approvalAction === 'approve' ? 'default' : 'destructive'}
                                            data-testid={`button-confirm-approval-${version.versionNumber}`}
                                          >
                                            {approveMutation.isPending || rejectMutation.isPending ? (
                                              'Processing...'
                                            ) : (
                                              approvalAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'
                                            )}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCancelApproval}
                                            disabled={approveMutation.isPending || rejectMutation.isPending}
                                            data-testid={`button-cancel-approval-${version.versionNumber}`}
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Show if user can't approve their own version - with admin override */}
                                {canApprove && version.approvalState === 'pending_approval' && user?.id === version.editorId && (
                                  <div className="pt-3 border-t space-y-3">
                                    {expandedVersionId !== version.id ? (
                                      <>
                                        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                                          <Clock className="h-4 w-4" />
                                          <span className="italic">
                                            You cannot approve your own changes
                                          </span>
                                        </div>
                                        {user?.role === 'admin' && (
                                          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                                            <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                                              <strong>Admin Override:</strong> As an admin, you can force-approve this version for testing purposes. This bypasses the self-approval restriction.
                                            </p>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                size="sm"
                                                onClick={() => handleApprovalAction('approve', version.id, true)}
                                                disabled={!ruleReadiness.isReady}
                                                title={!ruleReadiness.isReady ? ruleReadiness.message : undefined}
                                                variant="outline"
                                                className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950 gap-2"
                                                data-testid={`button-force-approve-${version.versionNumber}`}
                                              >
                                                <ThumbsUp className="h-4 w-4" />
                                                Force Approve (Override)
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleApprovalAction('reject', version.id, true)}
                                                className="border-red-500 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 gap-2"
                                                data-testid={`button-force-reject-${version.versionNumber}`}
                                              >
                                                <ThumbsDown className="h-4 w-4" />
                                                Force Reject (Override)
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                                          {approvalAction === 'approve' ? (
                                            <>
                                              <ThumbsUp className="h-4 w-4" />
                                              <span>Force Approve Version {version.versionNumber} (Admin Override)</span>
                                            </>
                                          ) : (
                                            <>
                                              <ThumbsDown className="h-4 w-4" />
                                              <span>Force Reject Version {version.versionNumber} (Admin Override)</span>
                                            </>
                                          )}
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor={`notes-${version.id}`} className="text-sm text-amber-700 dark:text-amber-400">
                                            {approvalAction === 'approve' ? 'Notes (Optional)' : 'Rejection Reason (Required)'}
                                          </Label>
                                          <Textarea
                                            id={`notes-${version.id}`}
                                            value={approvalNotes}
                                            onChange={(e) => setApprovalNotes(e.target.value)}
                                            placeholder={approvalAction === 'approve' 
                                              ? 'Add any notes about this override approval...'
                                              : 'Explain what needs to be changed...'}
                                            rows={3}
                                            className="resize-none border-amber-300 dark:border-amber-700"
                                            data-testid={`textarea-approval-notes-${version.versionNumber}`}
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => handleConfirmApproval(version.id)}
                                            disabled={
                                              (approvalAction === 'reject' && !approvalNotes.trim()) ||
                                              approveMutation.isPending ||
                                              rejectMutation.isPending
                                            }
                                            className={approvalAction === 'approve' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'}
                                            data-testid={`button-confirm-approval-${version.versionNumber}`}
                                          >
                                            {approveMutation.isPending || rejectMutation.isPending ? (
                                              'Processing...'
                                            ) : (
                                              approvalAction === 'approve' ? 'Confirm Override Approval' : 'Confirm Rejection'
                                            )}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCancelApproval}
                                            disabled={approveMutation.isPending || rejectMutation.isPending}
                                            className="border-amber-500"
                                            data-testid={`button-cancel-approval-${version.versionNumber}`}
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Submit Draft for Approval - Only show for creator when version is draft */}
                                {version.approvalState === 'draft' && user?.id === version.editorId && (
                                  <div className="pt-3 border-t space-y-3">
                                    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-md p-3">
                                      <div className="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-500 mb-2">
                                        <Clock className="h-4 w-4" />
                                        <span className="font-medium">
                                          Draft version - Not yet submitted for approval
                                        </span>
                                      </div>
                                      <p className="text-xs text-orange-700 dark:text-orange-500 mb-3">
                                        Submit this version for approval to make it the active contract metadata.
                                      </p>
                                      <Button
                                        size="sm"
                                        onClick={() => submitApprovalMutation.mutate()}
                                        disabled={submitApprovalMutation.isPending}
                                        className="bg-orange-700 hover:bg-orange-800 gap-2"
                                        data-testid={`button-submit-draft-${version.versionNumber}`}
                                      >
                                        <Send className="h-4 w-4" />
                                        {submitApprovalMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Terms & Tiers Tab */}
        <TabsContent value="terms" className="space-y-4 mt-6">
          {isCreateMode ? <CreateModeTabPlaceholder tabName="Terms" onCreateContract={handleCreateContract} isPending={createContractMutation.isPending} /> : (
            <TermsTabContent contractId={contractId!} terms={termsQuery.data || []} isLoading={termsQuery.isLoading} hasMaster={!!masterQuery.data} isAutoGenerating={autoGenerating} />
          )}
        </TabsContent>

        {/* Qualifiers Tab */}
        <TabsContent value="qualifiers" className="space-y-4 mt-6">
          {isCreateMode ? <CreateModeTabPlaceholder tabName="Qualifiers" onCreateContract={handleCreateContract} isPending={createContractMutation.isPending} /> : (
            <QualifiersTabContent contractId={contractId!} qualifiers={qualifiersQuery.data || []} terms={termsQuery.data || []} isLoading={qualifiersQuery.isLoading} hasMaster={!!masterQuery.data} isAutoGenerating={autoGenerating} />
          )}
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4 mt-6">
          {isCreateMode ? <CreateModeTabPlaceholder tabName="Analysis" onCreateContract={handleCreateContract} isPending={createContractMutation.isPending} /> : (
            <AnalysisTabContent contractId={contractId!} analysisData={analysisQuery.data} isLoading={analysisQuery.isLoading} />
          )}
        </TabsContent>

        {/* Clauses Tab */}
        <TabsContent value="clauses" className="space-y-4 mt-6">
          {isCreateMode ? <CreateModeTabPlaceholder tabName="Clauses" onCreateContract={handleCreateContract} isPending={createContractMutation.isPending} /> : (
            <ClausesTabContent contractId={contractId!} clausesData={clausesQuery.data} isLoading={clausesQuery.isLoading} />
          )}
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4 mt-6">
          {isCreateMode ? <CreateModeTabPlaceholder tabName="Rules" onCreateContract={handleCreateContract} isPending={createContractMutation.isPending} /> : (
            <RulesTabContent contractId={contractId!} rules={rulesQuery.data || []} isLoading={rulesQuery.isLoading} contractEffectiveStart={effectiveStart} contractEffectiveEnd={effectiveEnd} />
          )}
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-4 mt-6">
          {isCreateMode ? <CreateModeTabPlaceholder tabName="Partners" onCreateContract={handleCreateContract} isPending={createContractMutation.isPending} /> : (
            <PartnersTabContent contractId={contractId!} partners={partnersQuery.data || []} isLoading={partnersQuery.isLoading} hasMaster={!!masterQuery.data} isAutoGenerating={autoGenerating} />
          )}
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-4 mt-6">
          {isCreateMode ? <CreateModeTabPlaceholder tabName="Policies" onCreateContract={handleCreateContract} isPending={createContractMutation.isPending} /> : (
            <ContractPoliciesTab contractId={contractId!} contract={contract} />
          )}
        </TabsContent>
      </Tabs>
    </div>
    </MainLayout>
  );
}

function CreateModeTabPlaceholder({ tabName, onCreateContract, isPending }: { tabName: string; onCreateContract: () => void; isPending: boolean }) {
  return (
    <Card className="shadow-md" data-testid={`card-create-placeholder-${tabName.toLowerCase()}`}>
      <CardContent className="py-16">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Save Contract First</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create the contract from the Metadata tab to start adding {tabName.toLowerCase()} data.
            </p>
          </div>
          <Button onClick={onCreateContract} disabled={isPending} className="gap-2" data-testid={`button-create-from-${tabName.toLowerCase()}`}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Contract
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type PartyPickerOption = { id: string; value: string; label: string; hint?: string };
type AiSuggestion = { id: string; name: string; confidence: number; method: string };

function PartySearchPicker({
  value,
  options,
  onSelect,
  onClear,
  placeholder,
  emptyText,
  testId,
  rawValue,
  linkTarget,
}: {
  value: string;
  options: PartyPickerOption[];
  onSelect: (opt: PartyPickerOption) => void;
  onClear: () => void;
  placeholder: string;
  emptyText: string;
  testId: string;
  rawValue?: string;
  linkTarget?: 'partner' | 'company';
}) {
  const [open, setOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[] | null>(null);
  const selected = options.find(o => o.value === value);

  const fetchAiSuggestions = async () => {
    if (!rawValue || !linkTarget) return;
    setAiLoading(true);
    try {
      const res = await apiRequest('POST', '/api/master-data/link/preview', { rawValue, target: linkTarget });
      const data = await res.json();
      const list: AiSuggestion[] = [];
      if (data.resolvedId) list.push({ id: data.resolvedId, name: data.resolvedName, confidence: data.confidence, method: data.method });
      (data.alternatives || []).forEach((a: AiSuggestion) => { if (!list.find(x => x.id === a.id)) list.push(a); });
      setAiSuggestions(list);
    } catch {
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-fetch on open the first time
  useEffect(() => {
    if (open && aiSuggestions === null && rawValue && linkTarget) {
      fetchAiSuggestions();
    }
  }, [open]);

  const optionByMasterId = (mid: string) => options.find(o => o.id === mid);
  const confidenceClass = (c: number) => c >= 0.8 ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : c >= 0.5 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-red-100 text-red-700 border-red-300';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-8 w-full justify-between text-sm font-normal"
          data-testid={testId}
        >
          <span className={`truncate flex items-center gap-1.5 ${selected ? '' : 'text-muted-foreground'}`}>
            {rawValue && linkTarget && <Sparkles className="h-3 w-3 text-orange-500 shrink-0" />}
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" data-testid={`${testId}-input`} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {rawValue && linkTarget && (
              <CommandGroup heading={
                <span className="flex items-center gap-1.5 text-orange-600">
                  <Sparkles className="h-3 w-3" />
                  AI Suggestions for "{rawValue}"
                  {aiLoading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                </span> as any
              }>
                {(aiSuggestions || []).slice(0, 5).map(sug => {
                  const opt = optionByMasterId(sug.id);
                  if (!opt) return null;
                  return (
                    <CommandItem
                      key={`ai-${sug.id}`}
                      value={`__ai__ ${opt.label}`}
                      onSelect={() => { onSelect(opt); setOpen(false); }}
                      data-testid={`${testId}-ai-${sug.id}`}
                    >
                      <Sparkles className="mr-2 h-3 w-3 text-orange-500 shrink-0" />
                      <span className="truncate flex-1">{opt.label}</span>
                      <Badge variant="outline" className={`ml-2 text-[10px] ${confidenceClass(sug.confidence)}`}>
                        {Math.round(sug.confidence * 100)}%
                      </Badge>
                    </CommandItem>
                  );
                })}
                {!aiLoading && aiSuggestions !== null && aiSuggestions.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground italic">No close AI matches found.</div>
                )}
              </CommandGroup>
            )}
            <CommandGroup heading="All master data">
              {selected && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onClear(); setOpen(false); }}
                  className="text-muted-foreground"
                  data-testid={`${testId}-clear`}
                >
                  <X className="h-3 w-3 mr-2" /> Clear selection
                </CommandItem>
              )}
              {options.map(opt => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.label} ${opt.hint || ''}`}
                  onSelect={() => { onSelect(opt); setOpen(false); }}
                  data-testid={`${testId}-option-${opt.id}`}
                >
                  <Check className={`mr-2 h-3 w-3 ${value === opt.value ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="truncate">{opt.label}</span>
                  {opt.hint && <span className="ml-2 text-xs text-muted-foreground">({opt.hint})</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ValidateContractButton({ contractId }: { contractId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; failures: any[]; summary?: string } | null>(null);

  const categoryMeta: Record<string, { label: string; className: string }> = {
    master_links: { label: 'Master Links', className: 'bg-red-100 text-red-800 border-red-200' },
    party_roles: { label: 'Party Roles', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    metadata: { label: 'Metadata', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    dates: { label: 'Dates', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    rules: { label: 'Rules', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/validate`, { credentials: 'include' });
      if (!res.ok) throw new Error('Validation request failed');
      return res.json();
    },
    onSuccess: (data: any) => {
      setResult(data);
      if (data.valid) {
        toast({ title: 'Contract is valid', description: 'No blocking issues found — safe to activate.' });
        setOpen(false);
      } else {
        setOpen(true);
      }
    },
    onError: (err: any) => toast({ title: 'Validation failed', description: err.message, variant: 'destructive' }),
  });

  const grouped = (result?.failures || []).reduce((acc: Record<string, any[]>, f: any) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {});

  return (
    <>
      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        variant="outline"
        size="sm"
        className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/30"
        data-testid="button-validate-contract"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
        Validate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-validation-results">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {result?.failures?.length || 0} validation issue{(result?.failures?.length || 0) === 1 ? '' : 's'} found
            </DialogTitle>
            <DialogDescription>
              These issues must be resolved before this contract can be saved as Active.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {Object.entries(grouped).map(([cat, items]) => {
              const meta = categoryMeta[cat] || { label: cat, className: 'bg-muted text-muted-foreground' };
              return (
                <div key={cat} className="rounded-md border p-3" data-testid={`validation-group-${cat}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={`text-[11px] ${meta.className}`}>{meta.label}</Badge>
                    <span className="text-xs text-muted-foreground">{items.length} issue{items.length === 1 ? '' : 's'}</span>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {items.map((f: any, i: number) => (
                      <li key={`${cat}-${i}`} className="flex items-start gap-2" data-testid={`validation-issue-${cat}-${i}`}>
                        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium">{f.message}</div>
                          {f.field && <div className="text-xs text-muted-foreground font-mono">{f.field}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {(!result?.failures || result.failures.length === 0) && (
              <div className="text-center py-8 text-muted-foreground" data-testid="validation-no-issues">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-2" />
                No issues found.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-close-validation">Close</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-revalidate">
              {mutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Re-validate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GenerateSampleButton({ contractId, tabType, label, onSuccess }: { contractId: string; tabType: string; label: string; onSuccess: () => void }) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contracts/${contractId}/generate-sample-data`, { tabType });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.message || `${label} generated successfully` });
      onSuccess();
    },
    onError: (err: any) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      variant="outline"
      className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
      data-testid={`button-generate-${tabType}`}
    >
      {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {mutation.isPending ? `Generating ${label}...` : `Generate ${label}`}
    </Button>
  );
}

function TermsTabContent({ contractId, terms, isLoading, hasMaster, isAutoGenerating }: { contractId: string; terms: any[]; isLoading: boolean; hasMaster: boolean; isAutoGenerating: boolean }) {
  const { toast } = useToast();
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<any>({});
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());

  const { data: territoriesData } = useQuery({ queryKey: ['/api/master/territories'], queryFn: () => fetch('/api/master/territories', { credentials: "include" }).then(r => r.json()) });
  const { data: channelsData } = useQuery({ queryKey: ['/api/master/sales-channels'], queryFn: () => fetch('/api/master/sales-channels', { credentials: "include" }).then(r => r.json()) });
  const { data: productsData } = useQuery({ queryKey: ['/api/master/products'], queryFn: () => fetch('/api/master/products', { credentials: "include" }).then(r => r.json()) });
  const territories = Array.isArray(territoriesData) ? territoriesData : [];
  const channels = Array.isArray(channelsData) ? channelsData : [];
  const products = Array.isArray(productsData) ? productsData : [];
  const productCategories = [...new Set(products.map((p: any) => p.product_category).filter(Boolean))];

  const startEdit = (term: any) => {
    setEditingTermId(term.termId);
    setEditForm({ ...term });
    setAddingNew(false);
  };
  const cancelEdit = () => { setEditingTermId(null); setEditForm({}); };
  const startAdd = () => {
    setAddingNew(true);
    setEditingTermId(null);
    setNewForm({ termName: "", termType: "Rebate", rateType: "Percentage", rateValue: "", termSequence: terms.length + 1, calculationBasis: "", appliesToProductCategory: "", appliesToTerritory: "", appliesToChannel: "", paymentTiming: "", notes: "" });
  };
  const cancelAdd = () => { setAddingNew(false); setNewForm({}); };
  const toggleTiers = (termId: string) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      next.has(termId) ? next.delete(termId) : next.add(termId);
      return next;
    });
  };

  const updateTermMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contract-terms/${data.termId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'terms'] });
      cancelEdit();
      toast({ title: "Term updated" });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const addTermMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/contracts/${contractId}/terms`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'terms'] });
      cancelAdd();
      toast({ title: "Term added" });
    },
    onError: (err: any) => toast({ title: "Add failed", description: err.message, variant: "destructive" }),
  });

  const deleteTermMutation = useMutation({
    mutationFn: (termId: string) => apiRequest("DELETE", `/api/contract-terms/${termId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'terms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'qualifiers'] });
      toast({ title: "Term deleted" });
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  if (!hasMaster) {
    return (
      <Card className="shadow-md" data-testid="card-terms-empty">
        <CardContent className="p-8 text-center">
          {isAutoGenerating ? (
            <>
              <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Generating Structured Data...</h3>
              <p className="text-muted-foreground" data-testid="text-terms-generating">Extracting terms, qualifiers, and partners from contract analysis</p>
            </>
          ) : (
            <>
              <ListOrdered className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Structured Data Available</h3>
              <p className="text-muted-foreground" data-testid="text-terms-info">Structured data is automatically generated when the contract is analyzed</p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  }

  const renderInlineEditFields = (form: any, setField: (f: string, v: any) => void, onSave: () => void, onCancel: () => void, isPending: boolean, isNew: boolean) => (
    <TableRow className="bg-muted/30" data-testid={isNew ? "row-term-add-form" : `row-term-edit-${form.termId}`}>
      <TableCell colSpan={11} className="p-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Term Name</Label>
            <Input value={form.termName || ""} onChange={e => setField("termName", e.target.value)} className="h-8 text-sm" data-testid="input-term-name" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Term Type</Label>
            <Select value={form.termType || "none"} onValueChange={v => setField("termType", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-term-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                <SelectItem value="Rebate">Rebate</SelectItem>
                <SelectItem value="condition">Condition</SelectItem>
                <SelectItem value="data-only">Data Only</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="tiered">Tiered</SelectItem>
                <SelectItem value="fixed_fee">Fixed Fee</SelectItem>
                <SelectItem value="minimum_guarantee">Minimum Guarantee</SelectItem>
                <SelectItem value="cap">Cap</SelectItem>
                <SelectItem value="deduction">Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Calculation Basis</Label>
            <Select value={form.calculationBasis || "none"} onValueChange={v => setField("calculationBasis", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-calc-basis"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                <SelectItem value="net_sales">Net Sales</SelectItem>
                <SelectItem value="gross_sales">Gross Sales</SelectItem>
                <SelectItem value="units_sold">Units Sold</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="margin">Margin</SelectItem>
                <SelectItem value="invoice_value">Invoice Value</SelectItem>
                <SelectItem value="purchase_volume">Purchase Volume</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Rate Type</Label>
            <Select value={form.rateType || "none"} onValueChange={v => setField("rateType", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-rate-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                <SelectItem value="Percentage">Percentage</SelectItem>
                <SelectItem value="Fixed">Fixed</SelectItem>
                <SelectItem value="Per Unit">Per Unit</SelectItem>
                <SelectItem value="Tiered">Tiered</SelectItem>
                <SelectItem value="Flat Fee">Flat Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Rate Value</Label>
            <Input type="number" step="0.01" value={form.rateValue ?? ""} onChange={e => setField("rateValue", e.target.value)} className="h-8 text-sm" data-testid="input-rate-value" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Tier Min</Label>
            <Input type="number" step="0.01" value={form.tierMin ?? ""} onChange={e => setField("tierMin", e.target.value)} className="h-8 text-sm" data-testid="input-tier-min" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Tier Max</Label>
            <Input type="number" step="0.01" value={form.tierMax ?? ""} onChange={e => setField("tierMax", e.target.value)} className="h-8 text-sm" data-testid="input-tier-max" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Tier UOM</Label>
            <Select value={form.tierUom || "none"} onValueChange={v => setField("tierUom", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-tier-uom"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                <SelectItem value="units">Units</SelectItem>
                <SelectItem value="dollars">Dollars</SelectItem>
                <SelectItem value="cases">Cases</SelectItem>
                <SelectItem value="pallets">Pallets</SelectItem>
                <SelectItem value="weight_lbs">Weight (lbs)</SelectItem>
                <SelectItem value="weight_kg">Weight (kg)</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Product Category</Label>
            <Select value={form.appliesToProductCategory || "none"} onValueChange={v => setField("appliesToProductCategory", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-product-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="All Products">All Products</SelectItem>
                {productCategories.map((cat: string) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Territory</Label>
            <Select value={form.appliesToTerritory || "none"} onValueChange={v => setField("appliesToTerritory", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-territory"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                <SelectItem value="All">All Territories</SelectItem>
                {territories.map((t: any) => <SelectItem key={t.territory_id} value={t.territory_name}>{t.territory_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Channel</Label>
            <Select value={form.appliesToChannel || "none"} onValueChange={v => setField("appliesToChannel", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-channel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                <SelectItem value="All">All Channels</SelectItem>
                {channels.map((c: any) => <SelectItem key={c.channel_id} value={c.channel_name}>{c.channel_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Payment Timing</Label>
            <Select value={form.paymentTiming || "none"} onValueChange={v => setField("paymentTiming", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-payment-timing"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                <SelectItem value="Monthly">Monthly</SelectItem>
                <SelectItem value="Quarterly">Quarterly</SelectItem>
                <SelectItem value="Semi-Annual">Semi-Annual</SelectItem>
                <SelectItem value="Annual">Annual</SelectItem>
                <SelectItem value="Upon Invoice">Upon Invoice</SelectItem>
                <SelectItem value="End of Term">End of Term</SelectItem>
                <SelectItem value="Net 30">Net 30</SelectItem>
                <SelectItem value="Net 60">Net 60</SelectItem>
                <SelectItem value="Net 90">Net 90</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-3">
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Input value={form.notes || ""} onChange={e => setField("notes", e.target.value)} className="h-8 text-sm" data-testid="input-term-notes" />
          </div>
          <div className="flex items-end gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={onCancel} className="h-8" data-testid="button-cancel-term">
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={onSave} disabled={isPending} className="h-8" data-testid="button-save-term">
              {isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <Card className="shadow-md" data-testid="card-terms-table">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/50 border-b">
        <div>
          <CardTitle className="text-xl">Terms & Tiers</CardTitle>
          <CardDescription>{terms.length} term(s) defined</CardDescription>
        </div>
        <Button size="sm" onClick={startAdd} disabled={addingNew} data-testid="button-add-term">
          <Plus className="h-4 w-4 mr-1" /> Add Term
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Term Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Tier Min</TableHead>
                <TableHead>Tier Max</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addingNew && renderInlineEditFields(
                newForm,
                (f, v) => setNewForm((p: any) => ({ ...p, [f]: v })),
                () => addTermMutation.mutate(newForm),
                cancelAdd,
                addTermMutation.isPending,
                true
              )}
              {terms.map((term: any, idx: number) => {
                const isEditing = editingTermId === term.termId;
                const hasTiers = term.volumeTiers && Array.isArray(term.volumeTiers) && term.volumeTiers.length > 0;
                const tiersExpanded = expandedTiers.has(term.termId);

                return isEditing ? (
                  renderInlineEditFields(
                    editForm,
                    (f, v) => setEditForm((p: any) => ({ ...p, [f]: v })),
                    () => updateTermMutation.mutate({ ...editForm, termId: term.termId }),
                    cancelEdit,
                    updateTermMutation.isPending,
                    false
                  )
                ) : (
                  <Fragment key={term.termId}>
                    <TableRow data-testid={`row-term-${term.termId}`} className={tiersExpanded ? "border-b-0" : ""}>
                      <TableCell className="w-8 px-2">
                        {hasTiers ? (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleTiers(term.termId)} data-testid={`button-toggle-tiers-${term.termId}`}>
                            {tiersExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </Button>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{term.termSequence || idx + 1}</TableCell>
                      <TableCell className="font-medium">{term.termName}</TableCell>
                      <TableCell><Badge variant="outline">{term.termType}</Badge></TableCell>
                      <TableCell>{term.rateValue != null ? `${term.rateValue}${term.rateType === "Percentage" ? "%" : ""}` : "-"}</TableCell>
                      <TableCell>{term.tierMin ?? "-"}</TableCell>
                      <TableCell>{term.tierMax ?? "-"}</TableCell>
                      <TableCell>{term.appliesToTerritory || "-"}</TableCell>
                      <TableCell>{term.appliesToChannel || "-"}</TableCell>
                      <TableCell className="max-w-48 truncate">{term.notes || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(term)} data-testid={`button-edit-term-${term.termId}`}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-delete-term-${term.termId}`}>
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Term</AlertDialogTitle>
                                <AlertDialogDescription>Are you sure you want to delete this term? This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTermMutation.mutate(term.termId)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                    {hasTiers && tiersExpanded && (
                      <TableRow className="bg-orange-50/50 dark:bg-orange-950/20">
                        <TableCell colSpan={11} className="py-2 px-4">
                          <div className="ml-8">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className="text-xs">Volume Tiers</Badge>
                              <span className="text-xs text-muted-foreground">{term.volumeTiers.length} tier(s) from linked rule</span>
                            </div>
                            <div className="rounded border bg-background">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs h-8">Tier #</TableHead>
                                    <TableHead className="text-xs h-8">Min</TableHead>
                                    <TableHead className="text-xs h-8">Max</TableHead>
                                    <TableHead className="text-xs h-8">Rate</TableHead>
                                    <TableHead className="text-xs h-8">Type</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {term.volumeTiers.map((tier: any, tIdx: number) => (
                                    <TableRow key={tIdx} data-testid={`row-tier-${term.termId}-${tIdx}`}>
                                      <TableCell className="text-xs py-1.5">{tIdx + 1}</TableCell>
                                      <TableCell className="text-xs py-1.5">{tier.min != null ? Number(tier.min).toLocaleString() : "-"}</TableCell>
                                      <TableCell className="text-xs py-1.5">{tier.max != null ? Number(tier.max).toLocaleString() : "∞"}</TableCell>
                                      <TableCell className="text-xs py-1.5 font-medium">{tier.rate != null ? `${tier.rate}%` : "-"}</TableCell>
                                      <TableCell className="text-xs py-1.5">{tier.type || "percentage"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {terms.length === 0 && !addingNew && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12">
                    <div className="space-y-3">
                      <p className="text-muted-foreground">No terms defined yet</p>
                      <GenerateSampleButton contractId={contractId} tabType="terms" label="Sample Terms" onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'terms'] })} />
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function QualifiersTabContent({ contractId, qualifiers, terms, isLoading, hasMaster, isAutoGenerating }: { contractId: string; qualifiers: any[]; terms: any[]; isLoading: boolean; hasMaster: boolean; isAutoGenerating: boolean }) {
  const { toast } = useToast();
  const [editingQualId, setEditingQualId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<any>({});
  const editFormRef = useRef<any>({});
  const newFormRef = useRef<any>({});
  editFormRef.current = editForm;
  newFormRef.current = newForm;

  const { data: masterProducts = [] } = useQuery({ queryKey: ['/api/master/products'] });
  const { data: masterTerritories = [] } = useQuery({ queryKey: ['/api/master/territories'] });
  const { data: masterSegments = [] } = useQuery({ queryKey: ['/api/master/customer-segments'] });
  const { data: masterChannels = [] } = useQuery({ queryKey: ['/api/master/sales-channels'] });
  const { data: masterProductHierarchy = [] } = useQuery({ queryKey: ['/api/master/product-hierarchy'] });
  const { data: masterProductClassifications = [] } = useQuery({ queryKey: ['/api/master/product-classifications'] });
  const { data: masterPartnerAssociations = [] } = useQuery({ queryKey: ['/api/master/partner-contract-associations'] });

  const existingValuesForField = (field: string): string[] => {
    return [...new Set(qualifiers.filter((q: any) => q.qualifierField === field).map((q: any) => q.qualifierValue).filter(Boolean))];
  };

  const getValueOptionsForField = (field: string): string[] => {
    let masterValues: string[] = [];
    switch (field) {
      case 'product_category': {
        const names = (masterProducts as any[]).map((p: any) => p.product_name || p.productName).filter(Boolean);
        const categories = (masterProducts as any[]).map((p: any) => p.product_category || p.productCategory).filter(Boolean);
        masterValues = [...names, ...categories];
        break;
      }
      case 'territory':
        masterValues = (masterTerritories as any[]).map((t: any) => t.territory_name || t.territoryName).filter(Boolean);
        break;
      case 'customer_segment':
        masterValues = (masterSegments as any[]).map((s: any) => s.segment_name || s.segmentName).filter(Boolean);
        break;
      case 'channel':
        masterValues = (masterChannels as any[]).map((c: any) => c.channel_name || c.channelName).filter(Boolean);
        break;
      default:
        masterValues = [];
    }
    const existing = existingValuesForField(field);
    return [...new Set([...masterValues, ...existing])].sort();
  };

  const startEdit = (qual: any) => { setEditingQualId(qual.qualifierId); setEditForm({ ...qual }); setAddingNew(false); };
  const cancelEdit = () => { setEditingQualId(null); setEditForm({}); };
  const startAdd = () => { setAddingNew(true); setEditingQualId(null); setNewForm({ termId: terms[0]?.termId || "", qualifierType: "", qualifierField: "", operator: "", qualifierValue: "", qualifierLogic: "AND", notes: "" }); };
  const cancelAdd = () => { setAddingNew(false); setNewForm({}); };

  const termMap = Object.fromEntries((terms || []).map((t: any) => [t.termId, t.termName]));

  const updateQualMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contract-qualifiers/${data.qualifierId}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'qualifiers'] });
      cancelEdit();
      toast({ title: "Qualifier updated" });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const addQualMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/contracts/${contractId}/qualifiers`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'qualifiers'] });
      cancelAdd();
      toast({ title: "Qualifier added" });
    },
    onError: (err: any) => toast({ title: "Add failed", description: err.message, variant: "destructive" }),
  });

  const deleteQualMutation = useMutation({
    mutationFn: (qualId: string) => apiRequest("DELETE", `/api/contract-qualifiers/${qualId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'qualifiers'] });
      toast({ title: "Qualifier deleted" });
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  if (!hasMaster) {
    return (
      <Card className="shadow-md" data-testid="card-qualifiers-empty">
        <CardContent className="p-8 text-center">
          {isAutoGenerating ? (
            <>
              <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Generating Structured Data...</h3>
              <p className="text-muted-foreground" data-testid="text-qualifiers-generating">Extracting terms, qualifiers, and partners from contract analysis</p>
            </>
          ) : (
            <>
              <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Structured Data Available</h3>
              <p className="text-muted-foreground" data-testid="text-qualifiers-info">Structured data is automatically generated when the contract is analyzed</p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  }

  const renderQualInlineEdit = (form: any, setField: (f: string, v: any) => void, onSave: () => void, onCancel: () => void, isPending: boolean, isNew: boolean) => (
    <TableRow className="bg-muted/30" data-testid={isNew ? "row-qualifier-add-form" : `row-qualifier-edit-${form.qualifierId}`}>
      <TableCell colSpan={8} className="p-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Linked Term</Label>
            <Select value={form.termId || ""} onValueChange={v => setField("termId", v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-qualifier-term"><SelectValue /></SelectTrigger>
              <SelectContent>
                {terms.map((t: any) => (
                  <SelectItem key={t.termId} value={t.termId}>{t.termName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Qualifier Type</Label>
            <Select value={form.qualifierType || ""} onValueChange={v => setField("qualifierType", v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-qualifier-type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inclusion">inclusion</SelectItem>
                <SelectItem value="exclusion">exclusion</SelectItem>
                <SelectItem value="threshold">threshold</SelectItem>
                <SelectItem value="condition">condition</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Qualifier Field</Label>
            <Select value={form.qualifierField || ""} onValueChange={v => { setField("qualifierField", v); setField("qualifierValue", ""); }}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-qualifier-field"><SelectValue placeholder="Select field" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="product_category">product_category</SelectItem>
                <SelectItem value="territory">territory</SelectItem>
                <SelectItem value="customer_segment">customer_segment</SelectItem>
                <SelectItem value="channel">channel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Operator</Label>
            <Select value={form.operator || ""} onValueChange={v => setField("operator", v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-qualifier-operator"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">equals</SelectItem>
                <SelectItem value="not_equals">not_equals</SelectItem>
                <SelectItem value="greater_than">greater_than</SelectItem>
                <SelectItem value="less_than">less_than</SelectItem>
                <SelectItem value="greater_than_or_equal">greater_than_or_equal</SelectItem>
                <SelectItem value="less_than_or_equal">less_than_or_equal</SelectItem>
                <SelectItem value="in">in</SelectItem>
                <SelectItem value="not_in">not_in</SelectItem>
                <SelectItem value="between">between</SelectItem>
                <SelectItem value="contains">contains</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Qualifier Value</Label>
            {(() => {
              const options = getValueOptionsForField(form.qualifierField || "");
              if (options.length > 0) {
                return (
                  <Select value={form.qualifierValue || ""} onValueChange={v => setField("qualifierValue", v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-qualifier-value"><SelectValue placeholder="Select value" /></SelectTrigger>
                    <SelectContent>
                      {options.map((opt: string) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }
              return <Input value={form.qualifierValue || ""} onChange={e => setField("qualifierValue", e.target.value)} placeholder={form.qualifierField ? "Select a field first" : "Enter value"} className="h-8 text-sm" data-testid="input-qualifier-value" />;
            })()}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Logic</Label>
            <Select value={form.qualifierLogic || "AND"} onValueChange={v => setField("qualifierLogic", v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-qualifier-logic"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-1">
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Input value={form.notes || ""} onChange={e => setField("notes", e.target.value)} className="h-8 text-sm" data-testid="input-qualifier-notes" />
          </div>
          <div className="flex items-end gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={onCancel} className="h-8" data-testid="button-cancel-qualifier">
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={onSave} disabled={isPending} className="h-8" data-testid="button-save-qualifier">
              {isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <Card className="shadow-md" data-testid="card-qualifiers-table">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/50 border-b">
        <div>
          <CardTitle className="text-xl">Qualifiers</CardTitle>
          <CardDescription>{qualifiers.length} qualifier(s) defined</CardDescription>
        </div>
        <Button size="sm" onClick={startAdd} disabled={addingNew || terms.length === 0} data-testid="button-add-qualifier">
          <Plus className="h-4 w-4 mr-1" /> Add Qualifier
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Linked Term</TableHead>
                <TableHead>Qualifier Type</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Logic</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addingNew && renderQualInlineEdit(
                newForm,
                (f, v) => setNewForm((p: any) => ({ ...p, [f]: v })),
                () => addQualMutation.mutate(newFormRef.current),
                cancelAdd,
                addQualMutation.isPending,
                true
              )}
              {qualifiers.map((qual: any) => {
                const isEditing = editingQualId === qual.qualifierId;
                return isEditing ? renderQualInlineEdit(
                  editForm,
                  (f, v) => setEditForm((p: any) => ({ ...p, [f]: v })),
                  () => updateQualMutation.mutate({ ...editFormRef.current, qualifierId: qual.qualifierId }),
                  cancelEdit,
                  updateQualMutation.isPending,
                  false
                ) : (
                  <TableRow key={qual.qualifierId} data-testid={`row-qualifier-${qual.qualifierId}`}>
                    <TableCell className="font-medium">{termMap[qual.termId] || qual.termId}</TableCell>
                    <TableCell><Badge variant="outline">{qual.qualifierType}</Badge></TableCell>
                    <TableCell>{qual.qualifierField || "-"}</TableCell>
                    <TableCell>{qual.operator || "-"}</TableCell>
                    <TableCell>{qual.qualifierValue || "-"}</TableCell>
                    <TableCell>{qual.qualifierLogic || "-"}</TableCell>
                    <TableCell className="max-w-48 truncate">{qual.notes || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(qual)} data-testid={`button-edit-qualifier-${qual.qualifierId}`}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-delete-qualifier-${qual.qualifierId}`}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Qualifier</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure you want to delete this qualifier? This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteQualMutation.mutate(qual.qualifierId)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {qualifiers.length === 0 && !addingNew && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="space-y-3">
                      <p className="text-muted-foreground">No qualifiers defined yet</p>
                      <GenerateSampleButton contractId={contractId} tabType="qualifiers" label="Sample Qualifiers" onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'qualifiers'] })} />
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalysisTabContent({ contractId, analysisData, isLoading }: { contractId: string; analysisData: any; isLoading: boolean }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ summary: "", keyTerms: "", riskAnalysis: "", insights: "" });

  const analysis = analysisData || {};
  const summary = analysis.summary || "";
  const keyTerms = analysis.keyTerms;
  const riskAnalysis = analysis.riskAnalysis || analysis.riskScore || analysis.risk_score;
  const insights = analysis.insights;

  const startEdit = () => {
    setEditing(true);
    setForm({
      summary: summary || "",
      keyTerms: keyTerms ? JSON.stringify(keyTerms, null, 2) : "",
      riskAnalysis: riskAnalysis ? (typeof riskAnalysis === 'object' ? JSON.stringify(riskAnalysis, null, 2) : String(riskAnalysis)) : "",
      insights: insights ? JSON.stringify(insights, null, 2) : "",
    });
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/contracts/${contractId}/analysis-record`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'analysis-record'] });
      setEditing(false);
      toast({ title: "Analysis saved" });
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => {
    let parsedKeyTerms = null;
    let parsedRiskAnalysis = null;
    let parsedInsights = null;
    try { if (form.keyTerms.trim()) parsedKeyTerms = JSON.parse(form.keyTerms); } catch { parsedKeyTerms = form.keyTerms; }
    try { if (form.riskAnalysis.trim()) parsedRiskAnalysis = JSON.parse(form.riskAnalysis); } catch { parsedRiskAnalysis = form.riskAnalysis; }
    try { if (form.insights.trim()) parsedInsights = JSON.parse(form.insights); } catch { parsedInsights = form.insights; }
    saveMutation.mutate({ summary: form.summary, keyTerms: parsedKeyTerms, riskAnalysis: parsedRiskAnalysis, insights: parsedInsights });
  };

  if (isLoading) {
    return <Card className="shadow-md"><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /><p className="mt-2 text-muted-foreground">Loading analysis data...</p></CardContent></Card>;
  }

  const hasData = summary || keyTerms || riskAnalysis;

  return (
    <Card className="shadow-md" data-testid="card-analysis-edit">
      <CardHeader className="bg-muted/50 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl">Contract Analysis</CardTitle>
          <CardDescription>{hasData ? "View and edit analysis data" : "Add analysis data manually"}</CardDescription>
        </div>
        {!editing ? (
          <Button size="sm" onClick={startEdit} data-testid="button-edit-analysis"><Pencil className="h-4 w-4 mr-1" /> {hasData ? "Edit" : "Add Analysis"}</Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-analysis"><X className="h-3 w-3 mr-1" /> Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-analysis">
              {saveMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Summary</Label>
              <Textarea value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} rows={4} data-testid="textarea-analysis-summary" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Key Terms (JSON)</Label>
              <Textarea value={form.keyTerms} onChange={e => setForm(p => ({ ...p, keyTerms: e.target.value }))} rows={4} className="font-mono text-xs" data-testid="textarea-analysis-key-terms" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Risk Analysis (JSON or value)</Label>
              <Textarea value={form.riskAnalysis} onChange={e => setForm(p => ({ ...p, riskAnalysis: e.target.value }))} rows={3} className="font-mono text-xs" data-testid="textarea-analysis-risk" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Insights (JSON)</Label>
              <Textarea value={form.insights} onChange={e => setForm(p => ({ ...p, insights: e.target.value }))} rows={3} className="font-mono text-xs" data-testid="textarea-analysis-insights" />
            </div>
          </div>
        ) : !hasData ? (
          <div className="text-center py-8 space-y-4">
            <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Analysis Available</h3>
            <p className="text-muted-foreground mb-4">Generate AI-native analysis or add data manually.</p>
            <div className="flex justify-center gap-3">
              <GenerateSampleButton contractId={contractId} tabType="analysis" label="Analysis" onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'analysis-record'] })} />
              <Button variant="outline" size="sm" onClick={startEdit} data-testid="button-manual-analysis"><Pencil className="h-4 w-4 mr-1" /> Add Manually</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {summary && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Summary</h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-ai-summary">{summary}</p>
              </div>
            )}
            {keyTerms && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Key Terms</h3>
                <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto max-h-40">{typeof keyTerms === 'object' ? JSON.stringify(keyTerms, null, 2) : keyTerms}</pre>
              </div>
            )}
            {riskAnalysis && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Risk Analysis</h3>
                {typeof riskAnalysis === 'number' ? (
                  <div className="flex items-center gap-2">
                    <div className={`text-xl font-bold ${(riskAnalysis * 100) > 70 ? "text-red-500" : (riskAnalysis * 100) > 40 ? "text-orange-500" : "text-green-500"}`}>{Math.round(riskAnalysis * 100)}%</div>
                    <Badge variant={(riskAnalysis * 100) > 70 ? "destructive" : (riskAnalysis * 100) > 40 ? "secondary" : "default"}>
                      {(riskAnalysis * 100) > 70 ? "High Risk" : (riskAnalysis * 100) > 40 ? "Medium Risk" : "Low Risk"}
                    </Badge>
                  </div>
                ) : (
                  <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto max-h-40">{typeof riskAnalysis === 'object' ? JSON.stringify(riskAnalysis, null, 2) : riskAnalysis}</pre>
                )}
              </div>
            )}
            {insights && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Insights</h3>
                <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto max-h-40">{typeof insights === 'object' ? JSON.stringify(insights, null, 2) : insights}</pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClausesTabContent({ contractId, clausesData, isLoading }: { contractId: string; clausesData: any; isLoading: boolean }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<any>({});

  const { data: clauseCategoriesData } = useQuery({ queryKey: ['/api/master/clause-categories'], queryFn: () => fetch('/api/master/clause-categories', { credentials: "include" }).then(r => r.json()) });
  const { data: flowTypesData } = useQuery({ queryKey: ['/api/master/flow-types'], queryFn: () => fetch('/api/master/flow-types', { credentials: "include" }).then(r => r.json()) });
  const categories = Array.isArray(clauseCategoriesData) ? clauseCategoriesData : [];
  const flowTypes = Array.isArray(flowTypesData) ? flowTypesData : [];

  const clauses = Array.isArray(clausesData) ? clausesData : [];

  const startEdit = (clause: any) => { setEditingId(clause.id); setEditForm({ ...clause }); setAddingNew(false); };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const startAdd = () => {
    setAddingNew(true);
    setEditingId(null);
    let maxNum = 0;
    clauses.forEach((c: any) => {
      const m = (c.clauseIdentifier || '').match(/(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
    const nextId = `CL-${String(maxNum + 1).padStart(3, '0')}`;
    setNewForm({ clauseIdentifier: nextId, sectionRef: "", text: "", clauseCategoryCode: "", flowTypeCode: "", affectsAccrual: false });
  };
  const cancelAdd = () => { setAddingNew(false); setNewForm({}); };

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/contracts/${contractId}/clauses-list`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'clauses-list'] }); cancelAdd(); toast({ title: "Clause added" }); },
    onError: (err: any) => toast({ title: "Add failed", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contract-clauses/${data.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'clauses-list'] }); cancelEdit(); toast({ title: "Clause updated" }); },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/contract-clauses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'clauses-list'] }); toast({ title: "Clause deleted" }); },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <Card className="shadow-md"><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /><p className="mt-2 text-muted-foreground">Loading clauses...</p></CardContent></Card>;
  }

  const renderForm = (form: any, setField: (f: string, v: any) => void, onSave: () => void, onCancel: () => void, isPending: boolean, isNew: boolean) => (
    <TableRow className="bg-muted/30" data-testid={isNew ? "row-clause-add-form" : `row-clause-edit-${form.id}`}>
      <TableCell colSpan={7} className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Clause ID</Label>
            <Input value={form.clauseIdentifier || ""} disabled className="h-8 text-sm bg-gray-100 dark:bg-gray-800 font-mono" data-testid="input-clause-identifier" />
            <p className="text-xs text-gray-500">Auto-generated</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Section Reference</Label>
            <Input value={form.sectionRef || ""} onChange={e => setField("sectionRef", e.target.value)} className="h-8 text-sm" data-testid="input-clause-section" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Category</Label>
            <Select value={form.clauseCategoryCode || "none"} onValueChange={v => setField("clauseCategoryCode", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-clause-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                {categories.map((c: any) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Flow Type</Label>
            <Select value={form.flowTypeCode || "none"} onValueChange={v => setField("flowTypeCode", v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-clause-flow-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                {flowTypes.map((f: any) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-3 pb-1">
            <div className="flex items-center gap-2">
              <Switch checked={form.affectsAccrual || false} onCheckedChange={v => setField("affectsAccrual", v)} data-testid="switch-clause-accrual" />
              <Label className="text-xs">Affects Accrual</Label>
            </div>
          </div>
          <div className="space-y-1 col-span-3">
            <Label className="text-xs font-medium text-muted-foreground">Clause Text *</Label>
            <Textarea value={form.text || ""} onChange={e => setField("text", e.target.value)} rows={3} className="text-sm" data-testid="textarea-clause-text" />
          </div>
          <div className="col-span-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onCancel} className="h-8" data-testid="button-cancel-clause"><X className="h-3 w-3 mr-1" /> Cancel</Button>
            <Button size="sm" onClick={onSave} disabled={isPending} className="h-8" data-testid="button-save-clause">
              {isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Save
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <Card className="shadow-md" data-testid="card-clauses-table">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/50 border-b">
        <div>
          <CardTitle className="text-xl">Contract Clauses</CardTitle>
          <CardDescription>{clauses.length} clause(s)</CardDescription>
        </div>
        <Button size="sm" onClick={startAdd} disabled={addingNew} data-testid="button-add-clause"><Plus className="h-4 w-4 mr-1" /> Add Clause</Button>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Flow Type</TableHead>
                <TableHead>Accrual</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addingNew && renderForm(newForm, (f, v) => setNewForm((p: any) => ({ ...p, [f]: v })), () => addMutation.mutate(newForm), cancelAdd, addMutation.isPending, true)}
              {clauses.map((clause: any) => {
                if (editingId === clause.id) {
                  return renderForm(editForm, (f, v) => setEditForm((p: any) => ({ ...p, [f]: v })), () => updateMutation.mutate(editForm), cancelEdit, updateMutation.isPending, false);
                }
                return (
                  <TableRow key={clause.id} data-testid={`row-clause-${clause.id}`}>
                    <TableCell className="font-medium text-sm">{clause.clauseIdentifier || "-"}</TableCell>
                    <TableCell className="text-sm">{clause.sectionRef || "-"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{clause.clauseCategoryCode || "-"}</Badge></TableCell>
                    <TableCell className="text-sm">{clause.flowTypeCode || "-"}</TableCell>
                    <TableCell>{clause.affectsAccrual ? <Badge variant="default" className="text-xs">Yes</Badge> : <span className="text-muted-foreground text-xs">No</span>}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(clause)} data-testid={`button-edit-clause-${clause.id}`}><Pencil className="h-3 w-3" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-delete-clause-${clause.id}`}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Clause</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure you want to delete this clause? This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(clause.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {clauses.length === 0 && !addingNew && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="space-y-3">
                      <p className="text-muted-foreground">No clauses found yet</p>
                      <GenerateSampleButton contractId={contractId} tabType="clauses" label="Sample Clauses" onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'clauses-list'] })} />
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RulesTabContent({ contractId, rules, isLoading, contractEffectiveStart, contractEffectiveEnd }: { contractId: string; rules: any[]; isLoading: boolean; contractEffectiveStart?: string; contractEffectiveEnd?: string }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<string>('general');
  const editFormRef = useRef<HTMLDivElement>(null);

  // Holds the sanitized rule payload while we wait for the user to confirm the
  // "this will create a new contract version that requires approval" dialog.
  // Set by handleSaveRule when the contract is currently approved; consumed by
  // the AlertDialog rendered at the end of this component.
  const [pendingApprovalSave, setPendingApprovalSave] = useState<any | null>(null);

  // We need the contract's current approval state to know whether saving a
  // rule should trigger the confirmation dialog. Pulled from the same query
  // the parent uses, so this stays in sync without prop drilling.
  const { data: contractInfo } = useQuery<any>({ queryKey: [`/api/contracts/${contractId}`] });

  useEffect(() => {
    if (editingId && editFormRef.current) {
      setTimeout(() => {
        editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [editingId]);

  const [editForm, setEditForm] = useState<any>({
    ruleName: "", description: "", ruleType: "percentage", priority: 10,
    clauseCategory: "", channel: "", effectiveDate: "", expiryDate: "",
    baseRate: "", minimumGuarantee: "", baseMetric: "", executionGroup: "",
    calculationFormula: "", sourceSection: "",
    productCategories: [] as string[], territories: [] as string[], customerSegments: [] as string[], partnerIds: [] as string[], channels: [] as string[],
    aggregationPeriod: "", minimumPrice: "",
    conditions: [] as Array<{ field: string; operator: string; value: string }>,
    volumeTiers: [] as Array<{ min: number; max: number | null; rate: number; minimumAnnual?: number }>,
    milestones: [] as Array<{ event: string; amount: number; dueDate: string }>,
    exceptions: [] as Array<{ condition: string; action: string; description: string }>,
    seasonalAdjustments: {} as Record<string, number>,
    territoryPremiums: {} as Record<string, number>,
    tierMode: 'whole' as 'whole' | 'marginal',
  });

  const [newCondField, setNewCondField] = useState("");
  const [newCondOperator, setNewCondOperator] = useState("");
  const [newCondValue, setNewCondValue] = useState("");

  const { data: metricsData } = useQuery({ queryKey: ['/api/master/base-metrics'], queryFn: () => fetch('/api/master/base-metrics', { credentials: "include" }).then(r => r.json()) });
  const { data: execGroupsData } = useQuery({ queryKey: ['/api/master/execution-groups'], queryFn: () => fetch('/api/master/execution-groups', { credentials: "include" }).then(r => r.json()) });
  const { data: clauseCategoriesData } = useQuery({ queryKey: ['/api/master/clause-categories'], queryFn: () => fetch('/api/master/clause-categories', { credentials: "include" }).then(r => r.json()) });
  const { data: channelsData } = useQuery({ queryKey: ['/api/master/sales-channels'], queryFn: () => fetch('/api/master/sales-channels', { credentials: "include" }).then(r => r.json()) });
  const { data: productsData } = useQuery({ queryKey: ['/api/master/products'], queryFn: () => fetch('/api/master/products', { credentials: "include" }).then(r => r.json()) });
  const { data: territoriesData } = useQuery({ queryKey: ['/api/master/territories'], queryFn: () => fetch('/api/master/territories', { credentials: "include" }).then(r => r.json()) });
  const { data: partnersData } = useQuery({ queryKey: ['/api/master/partners'], queryFn: () => fetch('/api/master/partners', { credentials: "include" }).then(r => r.json()) });
  const { data: customerSegmentsData } = useQuery({ queryKey: ['/api/master/customer-segments'], queryFn: () => fetch('/api/master/customer-segments', { credentials: "include" }).then(r => r.json()) });
  const { data: productHierarchyData } = useQuery({ queryKey: ['/api/master/product-hierarchy'], queryFn: () => fetch('/api/master/product-hierarchy', { credentials: "include" }).then(r => r.json()) });
  const { data: productClassificationsData } = useQuery({ queryKey: ['/api/master/product-classifications'], queryFn: () => fetch('/api/master/product-classifications', { credentials: "include" }).then(r => r.json()) });
  const { data: partnerAssociationsData } = useQuery({ queryKey: ['/api/master/partner-contract-associations'], queryFn: () => fetch('/api/master/partner-contract-associations', { credentials: "include" }).then(r => r.json()) });
  const { data: uomData } = useQuery({ queryKey: ['/api/master/uom'], queryFn: () => fetch('/api/master/uom', { credentials: "include" }).then(r => r.json()) });
  const { data: decisionLogsData } = useQuery<{ logs: any[] }>({ queryKey: ['/api/rule-decision-logs', editingId], enabled: !!editingId && editTab === 'history' });
  const metrics = Array.isArray(metricsData) ? metricsData : [];
  const execGroups = Array.isArray(execGroupsData) ? execGroupsData : [];
  const clauseCategories = Array.isArray(clauseCategoriesData) ? clauseCategoriesData : [];
  const channels = Array.isArray(channelsData) ? channelsData : [];
  const masterProducts = Array.isArray(productsData) ? productsData : [];
  const masterTerritories = Array.isArray(territoriesData) ? territoriesData : [];
  const masterPartners = Array.isArray(partnersData) ? partnersData : [];
  const masterSegments = Array.isArray(customerSegmentsData) ? customerSegmentsData : [];
  const masterProductHierarchy = Array.isArray(productHierarchyData) ? productHierarchyData : [];
  const masterProductClassifications = Array.isArray(productClassificationsData) ? productClassificationsData : [];
  const masterPartnerAssociations = Array.isArray(partnerAssociationsData) ? partnerAssociationsData : [];
  const masterUom = Array.isArray(uomData) ? uomData : [];

  const [productSearch, setProductSearch] = useState("");
  const [territorySearch, setTerritorySearch] = useState("");
  const [segmentSearch, setSegmentSearch] = useState("");
  const [qualEntity, setQualEntity] = useState<string>('');
  const [qualField, setQualField] = useState<string>('');
  const [qualCondition, setQualCondition] = useState<string>('in');
  const [qualValue, setQualValue] = useState<string>('');
  const [editingCondKey, setEditingCondKey] = useState<string | null>(null);

  const [partnerSearch, setPartnerSearch] = useState("");

  const allRuleTypes: Record<string, string> = {
    percentage: 'Percentage', tiered_pricing: 'Tiered Pricing', rebate_tiered: 'Rebate - Tiered Volume',
    promotional_rebate: 'Rebate - Promotional', bonus_rebate: 'Rebate - Growth Bonus',
    minimum_guarantee: 'Minimum Guarantee', fixed_fee: 'Fixed Fee (One-Time)', annual_fee: 'Annual Fee (Recurring)',
    cap: 'Cap', payment_schedule: 'Payment Schedule', payment_method: 'Payment Method',
    rate_structure: 'Rate Structure', invoice_requirements: 'Invoice Requirements',
    late_payment_penalty: 'Late Payment Penalty', advance_payment: 'Advance Payment',
    milestone_payment: 'Milestone Payment', milestone_tiered: 'Milestone - Tiered Threshold',
    category_percentage: 'Category Percentage',
    deduction: 'Deduction', condition: 'Condition / Clause', 'data-only': 'Data Reference',
  };

  const defaultFormState = {
    ruleName: "", description: "", ruleType: "percentage", priority: 10,
    clauseCategory: "", channel: "", effectiveDate: "", expiryDate: "",
    baseRate: "", minimumGuarantee: "", baseMetric: "", executionGroup: "",
    calculationFormula: "", sourceSection: "",
    productCategories: [], territories: [], customerSegments: [], partnerIds: [], channels: [],
    aggregationPeriod: "", minimumPrice: "", uom: "",
    qualifierGroups: [{ id: 'A', conditions: [] }] as Array<{ id: string; conditions: Array<{ entity: string; field: string; operator: string; values: string[] }> }>,
    conditions: [], volumeTiers: [], milestones: [],
    milestoneCount: '' as string,
    milestoneTiers: [] as Array<{ fromThreshold: number; toThreshold: number | null; rate: number; rateType: 'percentage' | 'fixed'; retroactive: boolean }>,
    milestoneConfig: { measurementBasis: 'cumulative_revenue', measurementPeriod: 'contract_period', retroactiveDefault: true } as { measurementBasis: string; measurementPeriod: string; retroactiveDefault: boolean },
    exceptions: [], seasonalAdjustments: {}, territoryPremiums: {},
  };

  const flatArraysToGroups = (rule: any): Array<{ id: string; conditions: Array<{ entity: string; field: string; operator: string; values: string[] }> }> => {
    if (rule.qualifierGroups && Array.isArray(rule.qualifierGroups) && rule.qualifierGroups.length > 0) {
      return rule.qualifierGroups;
    }
    const conditions: Array<{ entity: string; field: string; operator: string; values: string[] }> = [];
    const pc = rule.productCategories || [];
    const inclusions = pc.filter((v: string) => !v.startsWith('!'));
    const exclusions = pc.filter((v: string) => v.startsWith('!')).map((v: string) => v.slice(1));
    if (inclusions.length > 0) conditions.push({ entity: 'product_hierarchy', field: 'hierarchy_value', operator: 'in', values: inclusions });
    if (exclusions.length > 0) conditions.push({ entity: 'product_hierarchy', field: 'hierarchy_value', operator: 'not_in', values: exclusions });
    const terrs = rule.territories || [];
    if (terrs.length > 0) conditions.push({ entity: 'territory', field: 'territory_name', operator: 'in', values: terrs });
    const segs = rule.customerSegments || [];
    if (segs.length > 0) conditions.push({ entity: 'customer_segment', field: 'segment_name', operator: 'in', values: segs });
    const parts = rule.partnerIds || [];
    if (parts.length > 0) conditions.push({ entity: 'partner', field: 'partner_name', operator: 'in', values: parts });
    const ch = (rule.channel || '').split(',').map((c: string) => c.trim()).filter((c: string) => c && c !== 'All');
    if (ch.length > 0) conditions.push({ entity: 'channel', field: 'channel_name', operator: 'in', values: ch });
    if (conditions.length === 0) return [{ id: 'A', conditions: [] }];
    return [{ id: 'A', conditions }];
  };

  const groupsToFlatArrays = (groups: Array<{ id: string; conditions: Array<{ entity: string; field: string; operator: string; values: string[] }> }>) => {
    const productCategories: string[] = [];
    const territories: string[] = [];
    const customerSegments: string[] = [];
    const partnerIds: string[] = [];
    const channelValues: string[] = [];
    for (const group of groups) {
      for (const cond of group.conditions) {
        const vals = cond.values || [];
        if (cond.entity === 'product_hierarchy' || cond.entity === 'product') {
          if (cond.operator === 'not_in') {
            vals.forEach(v => { const ex = `!${v}`; if (!productCategories.includes(ex)) productCategories.push(ex); });
          } else {
            vals.forEach(v => { if (!productCategories.includes(v)) productCategories.push(v); });
          }
        } else if (cond.entity === 'territory') {
          vals.forEach(v => { if (!territories.includes(v)) territories.push(v); });
        } else if (cond.entity === 'customer_segment') {
          vals.forEach(v => { if (!customerSegments.includes(v)) customerSegments.push(v); });
        } else if (cond.entity === 'partner') {
          vals.forEach(v => { if (!partnerIds.includes(v)) partnerIds.push(v); });
        } else if (cond.entity === 'channel') {
          vals.forEach(v => { if (!channelValues.includes(v)) channelValues.push(v); });
        }
      }
    }
    return { productCategories, territories, customerSegments, partnerIds, channel: channelValues.join(',') || null };
  };

  const toDateInputValue = (val: any): string => {
    if (!val) return "";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().split('T')[0];
    } catch { return ""; }
  };

  const startEdit = (rule: any, opts?: { preserveTab?: boolean }) => {
    setEditingId(rule.id);
    const channelVal = rule.channel || 'All';
    const fd = rule.formulaDefinition as any;
    const calc = fd?.calculation;
    // Extract Start Date/End Date from tableData rows if available
    let tdStart: any = null, tdEnd: any = null;
    const tdRows = [...(calc?.tableData?.rows || []), ...(calc?.tiers || [])];
    for (const row of tdRows) {
      const field = row.Field || row.field || '';
      if (/start\s*date/i.test(field) && !tdStart) tdStart = row.Value || row.value;
      if (/end\s*date/i.test(field) && !tdEnd) tdEnd = row.Value || row.value;
    }
    const isValidFdDate = (d: any) => d && d !== 'No End' && d !== 'Current' && d !== 'current' && d !== 'N/A' && d !== 'null' && d !== 1 && !d.toString().toLowerCase().includes('revisit');
    const fdStartDate = (isValidFdDate(tdStart) ? tdStart : null) || calc?.startDate || (calc?.startDate === 'Current' || !calc?.startDate ? calc?.signatureDate : null);
    const fdEndDate = (isValidFdDate(tdEnd) ? tdEnd : null) || calc?.endDate;
    setEditForm({
      ...defaultFormState,
      ...rule,
      channel: channelVal,
      effectiveDate: toDateInputValue(rule.effectiveDate) || (isValidFdDate(fdStartDate) ? toDateInputValue(fdStartDate) : '') || contractEffectiveStart || "",
      expiryDate: toDateInputValue(rule.expiryDate) || (isValidFdDate(fdEndDate) ? toDateInputValue(fdEndDate) : '') || contractEffectiveEnd || "",
      productCategories: rule.productCategories || [],
      territories: rule.territories || [],
      customerSegments: rule.customerSegments || [],
      partnerIds: rule.partnerIds || [],
      channels: channelVal.split(',').map((c: string) => c.trim()).filter(Boolean),
      qualifierGroups: flatArraysToGroups(rule),
      conditions: rule.conditions || [],
      volumeTiers: rule.volumeTiers || [],
      milestones: rule.milestones || [],
      milestoneTiers: rule.milestoneTiers || [],
      milestoneConfig: rule.milestoneConfig || { measurementBasis: 'cumulative_revenue', measurementPeriod: 'contract_period', retroactiveDefault: true },
      exceptions: rule.exceptions || [],
      seasonalAdjustments: rule.seasonalAdjustments || {},
      territoryPremiums: rule.territoryPremiums || {},
      tierMode: (fd?.tierMode === 'marginal' ? 'marginal' : 'whole'),
    });
    if (!opts?.preserveTab) setEditTab('general');
    setAddingNew(false);
    setExpandedId(null);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editRuleId = params.get('editRule');
    const addRule = params.get('addRule');
    if (editRuleId && rules?.length) {
      const rule = rules.find((r: any) => r.id === editRuleId);
      if (rule) {
        startEdit(rule);
        window.history.replaceState({}, '', window.location.pathname + '?tab=rules');
      }
    } else if (addRule === 'true' && !addingNew && !editingId) {
      startAdd();
      window.history.replaceState({}, '', window.location.pathname + '?tab=rules');
    }
  }, [rules]);

  const cancelEdit = () => {
    setAddingNew(false);
    setEditingId(null);
    setEditForm({ ...defaultFormState });
  };

  const startAdd = () => {
    setAddingNew(true);
    setEditingId('new');
    setEditForm({
      ...defaultFormState,
      effectiveDate: contractEffectiveStart || "",
      expiryDate: contractEffectiveEnd || "",
    });
    setEditTab('general');
    setExpandedId(null);
  };

  const cancelAdd = () => { setAddingNew(false); setEditingId(null); setEditForm({ ...defaultFormState }); };

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/contracts/${contractId}/rules-list`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules-list'] }); cancelAdd(); toast({ title: "Rule added" }); },
    onError: (err: any) => toast({ title: "Add failed", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contract-rules/${data.id}`, data),
    onSuccess: () => {
      setEditingId(null);
      setAddingNew(false);
      setEditForm({ ...defaultFormState });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules-list'] });
      toast({ title: "Rule updated" });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/contract-rules/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules-list'] }); toast({ title: "Rule deleted" }); },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const reviewStatusMutation = useMutation({
    mutationFn: (data: { ruleId: string; reviewStatus: string; notes?: string }) =>
      apiRequest("PATCH", `/api/contract-rules/${data.ruleId}/review-status`, { reviewStatus: data.reviewStatus, notes: data.notes }),
    onSuccess: () => {
      setEditingId(null);
      setAddingNew(false);
      setEditForm({ ...defaultFormState });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules-list'] });
      toast({ title: "Validation status updated" });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const bulkReviewMutation = useMutation({
    mutationFn: (data: { reviewStatus: string; ruleIds?: string[] }) =>
      apiRequest("PATCH", `/api/contracts/${contractId}/rules/bulk-review-status`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules-list'] });
      const label = variables.reviewStatus === 'verified' ? 'verified' : variables.reviewStatus === 'under_review' ? 'sent to review' : 'updated';
      toast({ title: `All rules ${label}` });
    },
    onError: (err: any) => toast({ title: "Bulk update failed", description: err.message, variant: "destructive" }),
  });

  const approveRuleMutation = useMutation({
    mutationFn: (ruleId: string) =>
      apiRequest("POST", `/api/contracts/${contractId}/rules/${ruleId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules-list'] });
      toast({ title: "Rule approved — ready for calculations" });
    },
    onError: (err: any) => toast({ title: "Approve failed", description: err.message, variant: "destructive" }),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ruleIds: string[]) => {
      await Promise.all(
        ruleIds.map(id => apiRequest("POST", `/api/contracts/${contractId}/rules/${id}/approve`))
      );
    },
    onSuccess: (_, ruleIds) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules-list'] });
      toast({ title: `${ruleIds.length} rule(s) approved — ready for calculations` });
    },
    onError: (err: any) => toast({ title: "Bulk approve failed", description: err.message, variant: "destructive" }),
  });

  const verifyAndApproveAllMutation = useMutation({
    mutationFn: async (ruleIds: string[]) => {
      await apiRequest("PATCH", `/api/contracts/${contractId}/rules/bulk-review-status`, { reviewStatus: 'verified' });
      await Promise.all(
        ruleIds.map(id => apiRequest("POST", `/api/contracts/${contractId}/rules/${id}/approve`))
      );
    },
    onSuccess: (_, ruleIds) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules-list'] });
      toast({ title: `All rules verified & approved`, description: `${ruleIds.length} rule(s) are now active in calculations.` });
    },
    onError: (err: any) => toast({ title: "Verify & Approve failed", description: err.message, variant: "destructive" }),
  });

  const getTrafficLightConfig = (status: string) => {
    switch (status) {
      case 'verified':
        return { color: 'bg-green-500', label: 'Verified', icon: ShieldCheck, textColor: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950', borderColor: 'border-green-200 dark:border-green-800' };
      case 'under_review':
        return { color: 'bg-yellow-400', label: 'Under Review', icon: AlertCircle, textColor: 'text-yellow-700 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-950', borderColor: 'border-yellow-200 dark:border-yellow-800' };
      case 'rejected':
        return { color: 'bg-red-500', label: 'Rejected', icon: XCircle, textColor: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950', borderColor: 'border-red-200 dark:border-red-800' };
      default:
        return { color: 'bg-red-500', label: 'AI Extracted', icon: CircleDot, textColor: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950', borderColor: 'border-red-200 dark:border-red-800' };
    }
  };

  const verifiedCount = rules.filter((r: any) => r.reviewStatus === 'verified').length;
  const underReviewCount = rules.filter((r: any) => r.reviewStatus === 'under_review').length;
  const pendingCount = rules.filter((r: any) => !r.reviewStatus || r.reviewStatus === 'pending' || r.reviewStatus === 'auto_confirmed').length;
  const rejectedCount = rules.filter((r: any) => r.reviewStatus === 'rejected').length;
  const verificationProgress = rules.length > 0 ? Math.round((verifiedCount / rules.length) * 100) : 0;
  const approvedCount = rules.filter((r: any) => r.approvalStatus === 'approved').length;
  const pendingApprovalIds = rules.filter((r: any) => !r.approvalStatus || r.approvalStatus === 'pending').map((r: any) => r.id);
  const allRuleIds = rules.map((r: any) => r.id);

  const handleVerifyRule = (ruleId: string) => {
    reviewStatusMutation.mutate({ ruleId, reviewStatus: 'verified' });
  };

  const handleSendToReview = (ruleId: string) => {
    reviewStatusMutation.mutate({ ruleId, reviewStatus: 'under_review' });
  };

  const handleRejectRule = (ruleId: string) => {
    reviewStatusMutation.mutate({ ruleId, reviewStatus: 'rejected' });
  };

  const handleResetToPending = (ruleId: string) => {
    reviewStatusMutation.mutate({ ruleId, reviewStatus: 'pending' });
  };

  const handleSaveRule = () => {
    if (!editForm.ruleName?.trim()) {
      toast({ title: "Validation Error", description: "Rule name is required", variant: "destructive" });
      return;
    }
    if (!editForm.ruleType?.trim()) {
      toast({ title: "Validation Error", description: "Rule Type is required", variant: "destructive" });
      return;
    }
    if (!editForm.clauseCategory?.trim() || editForm.clauseCategory === 'general') {
      toast({ title: "Validation Error", description: "Clause Category is required — please select a specific category", variant: "destructive" });
      return;
    }
    if (!editForm.effectiveDate?.trim()) {
      toast({ title: "Validation Error", description: "Effective Date is required", variant: "destructive" });
      return;
    }
    if (!editForm.executionGroup?.trim()) {
      toast({ title: "Validation Error", description: "Execution Group is required", variant: "destructive" });
      return;
    }
    if (!editForm.baseMetric?.trim()) {
      toast({ title: "Validation Error", description: "Base Metric is required", variant: "destructive" });
      return;
    }
    const ruleTypesRequiringUom = ['percentage', 'minimum_guarantee', 'cap', 'per_unit', 'per-unit', 'rebate-rate', 'fixed_fee', 'annual_fee'];
    if (ruleTypesRequiringUom.includes(editForm.ruleType) && !editForm.uom?.trim()) {
      toast({ title: "Validation Error", description: "Unit of Measure is required", variant: "destructive" });
      return;
    }
    const dupRule = rules.find((r: any) => {
      if (editingId && r.id === editingId) return false;
      return (r.ruleName || '').trim().toLowerCase() === editForm.ruleName.trim().toLowerCase();
    });
    if (dupRule) {
      toast({ title: "Duplicate Rule Name", description: `A rule named "${editForm.ruleName.trim()}" already exists in this contract. Please use a unique name.`, variant: "destructive" });
      return;
    }
    if (editForm.ruleType === 'milestone_payment' && editForm.milestones?.length > 0 && parseFloat(editForm.baseRate) > 0) {
      const contractVal = parseFloat(editForm.baseRate);
      const totalMilestoneAmt = editForm.milestones.reduce((sum: number, m: any) => {
        const pct = parseFloat(m.percentage);
        if (pct > 0) return sum + (pct / 100) * contractVal;
        return sum + (parseFloat(m.amount) || 0);
      }, 0);
      const diff = Math.abs(contractVal - totalMilestoneAmt);
      if (diff > 0.01) {
        const totalFormatted = totalMilestoneAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const contractFormatted = contractVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        toast({ title: "Milestone Total Mismatch", description: `Milestone amounts total $${totalFormatted} but the Total Contract Value is $${contractFormatted}. Please adjust the milestones so they add up to the contract value.`, variant: "destructive" });
        return;
      }
    }
    const flatArrays = groupsToFlatArrays(editForm.qualifierGroups || []);
    // Persist tierMode inside formulaDefinition where the calculation engine
    // (universal evaluator + executeRebateTieredRule) reads it from.
    const tierModeRuleTypes = ['tiered', 'rebate_tiered', 'tiered_pricing', 'royalty', 'milestone_tiered'];
    const existingFd: any = (editForm.formulaDefinition as any) || {};
    const mergedFormulaDefinition = tierModeRuleTypes.includes(editForm.ruleType)
      ? { ...existingFd, tierMode: editForm.tierMode || 'whole' }
      : existingFd;
    const sanitizedData: any = {
      ...editForm,
      baseRate: (typeof editForm.baseRate === 'string' && editForm.baseRate.trim() === '') ? null : editForm.baseRate,
      minimumGuarantee: (typeof editForm.minimumGuarantee === 'string' && editForm.minimumGuarantee.trim() === '') ? null : editForm.minimumGuarantee,
      minimumPrice: (typeof editForm.minimumPrice === 'string' && editForm.minimumPrice.trim() === '') ? null : editForm.minimumPrice,
      channel: flatArrays.channel || ((editForm.channels && editForm.channels.length > 0) ? editForm.channels.join(',') : (editForm.channel || null)),
      clauseCategory: editForm.clauseCategory,
      productCategories: flatArrays.productCategories,
      territories: flatArrays.territories,
      customerSegments: flatArrays.customerSegments,
      partnerIds: flatArrays.partnerIds,
      qualifierGroups: editForm.qualifierGroups,
      formulaDefinition: mergedFormulaDefinition,
    };
    delete sanitizedData.channels;
    delete sanitizedData.tierMode;
    // Note: editing a rule no longer demotes its verification status. Verification
    // ("AI extraction is correct") is independent of approval ("authorized for
    // calculations"). The server-side handler resets approvalStatus → pending
    // on substantive edits, which alone re-opens the contract approval gate.
    if (addingNew) {
      addMutation.mutate(sanitizedData);
    } else {
      // If the contract is currently approved, saving a rule edit will mint a
      // new pending version that requires re-approval. Surface that as an
      // explicit confirmation step so the editor knows what they're triggering
      // and can back out before the cycle starts.
      if (contractInfo?.approvalState === 'approved') {
        setPendingApprovalSave(sanitizedData);
      } else {
        updateMutation.mutate(sanitizedData);
      }
    }
  };

  const removeCategory = (i: number) => { setEditForm({ ...editForm, productCategories: editForm.productCategories.filter((_: any, idx: number) => idx !== i) }); };
  const removeTerritory = (i: number) => { setEditForm({ ...editForm, territories: editForm.territories.filter((_: any, idx: number) => idx !== i) }); };
  const addVolumeTier = () => { setEditForm({ ...editForm, volumeTiers: [...editForm.volumeTiers, { min: 0, max: null, rate: 0 }] }); };
  const updateVolumeTier = (index: number, field: string, value: any) => { const t = [...editForm.volumeTiers]; t[index] = { ...t[index], [field]: value }; setEditForm({ ...editForm, volumeTiers: t }); };
  const removeVolumeTier = (i: number) => { setEditForm({ ...editForm, volumeTiers: editForm.volumeTiers.filter((_: any, idx: number) => idx !== i) }); };

  if (isLoading) {
    return <Card className="shadow-md"><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /><p className="mt-2 text-muted-foreground">Loading rules...</p></CardContent></Card>;
  }

  const renderEditForm = () => (
    <div ref={editFormRef} className="space-y-4 p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-lg border-2 border-orange-200 dark:border-orange-800" data-testid={addingNew ? "row-rule-add-form" : `row-rule-edit-${editForm.id}`}>
      <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-900 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-orange-100 dark:bg-orange-950">
            {addingNew ? 'New Rule' : 'Edit Rule'}
          </Badge>
          {editForm.clauseCategory && (
            <Badge variant="secondary" className="text-xs">{editForm.clauseCategory}</Badge>
          )}
          {!addingNew && (() => {
            const tlConfig = getTrafficLightConfig(editForm.reviewStatus || 'pending');
            const TlIcon = tlConfig.icon;
            return (
              <Badge variant="outline" className={`text-xs ${tlConfig.textColor} ${tlConfig.bgColor} ${tlConfig.borderColor}`} data-testid="badge-rule-validation-status">
                <TlIcon className="h-3 w-3 mr-1" />
                {tlConfig.label}
              </Badge>
            );
          })()}
          <span className="text-xs text-muted-foreground ml-auto">{editForm.ruleName || 'Untitled Rule'}</span>
        </div>
      </div>

      <Tabs value={editTab} onValueChange={setEditTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="general" className="text-xs" data-testid="tab-edit-general">General</TabsTrigger>
          <TabsTrigger value="calculation" className="text-xs" data-testid="tab-edit-calculation">Calculation</TabsTrigger>
          <TabsTrigger value="history" className="text-xs" data-testid="tab-edit-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Rule Name *</Label>
              <Input value={editForm.ruleName} onChange={(e) => setEditForm({ ...editForm, ruleName: e.target.value })} placeholder="e.g., Base Contract Fee Rate" data-testid="input-rule-name" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Describe this rule..." rows={3} data-testid="textarea-rule-description" />
            </div>
            <div>
              <Label>Rule Type *</Label>
              <Select value={editForm.ruleType} onValueChange={(v) => setEditForm({ ...editForm, ruleType: v })}>
                <SelectTrigger data-testid="select-rule-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(() => {
                    const usedTypes = new Set(rules.map((r: any) => r.ruleType).filter(Boolean));
                    if (editForm.ruleType) usedTypes.add(editForm.ruleType);
                    const relevantTypes: Array<[string, string]> = [];
                    usedTypes.forEach(t => {
                      const label = allRuleTypes[t] || t.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                      relevantTypes.push([t, label]);
                    });
                    ['percentage', 'tiered_pricing', 'fixed_fee', 'rate_structure', 'minimum_guarantee', 'cap', 'milestone_tiered', 'milestone_payment'].forEach(t => {
                      if (!usedTypes.has(t)) relevantTypes.push([t, allRuleTypes[t]]);
                    });
                    const seen = new Set<string>();
                    return relevantTypes.filter(([k]) => { if (seen.has(k)) return false; seen.add(k); return true; }).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
            {['tiered', 'rebate_tiered', 'tiered_pricing', 'royalty', 'milestone_tiered'].includes(editForm.ruleType) && (
              <div data-testid="field-tier-mode">
                <Label>Tier Calculation Mode</Label>
                <Select value={editForm.tierMode || 'whole'} onValueChange={(v) => setEditForm({ ...editForm, tierMode: v })}>
                  <SelectTrigger data-testid="select-tier-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole">Whole-tier — full value gets matched tier rate</SelectItem>
                    <SelectItem value="marginal">Marginal — each band calculated separately, then summed</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Example at $2M with tiers [0–1M @ 2%, 1M+ @ 3%]: whole-tier = $60,000 · marginal = $50,000
                </p>
              </div>
            )}
            <div>
              <Label>Priority (1 = highest)</Label>
              <Input type="number" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: parseInt(e.target.value) || 1 })} data-testid="input-rule-priority" />
            </div>
            <div>
              <Label>Clause Category *</Label>
              <Select value={editForm.clauseCategory || "none"} onValueChange={(v) => setEditForm({ ...editForm, clauseCategory: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-rule-clause-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  {clauseCategories.map((cc: any) => <SelectItem key={cc.code} value={cc.code}>{cc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={editForm.channel || "none"} onValueChange={(v) => setEditForm({ ...editForm, channel: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-rule-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  <SelectItem value="All">All Channels</SelectItem>
                  {channels.map((c: any) => <SelectItem key={c.channel_id || c.code} value={c.channel_name || c.name}>{c.channel_name || c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Effective Date *</Label>
              <Input type="date" value={editForm.effectiveDate || ""} onChange={(e) => setEditForm({ ...editForm, effectiveDate: e.target.value })} data-testid="input-effective-date" />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input type="date" value={editForm.expiryDate || ""} onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })} data-testid="input-expiry-date" />
            </div>
            <div>
              <Label>Execution Group *</Label>
              <Select value={editForm.executionGroup || "none"} onValueChange={(v) => setEditForm({ ...editForm, executionGroup: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-rule-exec-group"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  {execGroups.map((g: any) => <SelectItem key={g.code} value={g.code}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base Metric *</Label>
              <Select value={editForm.baseMetric || "none"} onValueChange={(v) => setEditForm({ ...editForm, baseMetric: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-rule-base-metric"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  {metrics.map((m: any) => <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2"><Scale className="h-4 w-4" /> Condition Groups</h3>
                <p className="text-xs text-muted-foreground">Rows within a group are AND'd. Groups are OR'd together. This covers any qualifier logic.</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" data-testid="button-add-condition-group"
                onClick={() => {
                  const groups = [...(editForm.qualifierGroups || [])];
                  const nextId = String.fromCharCode(65 + groups.length);
                  groups.push({ id: nextId, conditions: [] });
                  setEditForm({ ...editForm, qualifierGroups: groups });
                }}>
                <Plus className="h-3 w-3 mr-1" /> Add OR Group
              </Button>
            </div>
          </div>

          {(() => {
            const masterEntities = [
              {
                entity: 'product_hierarchy', label: 'Product Hierarchy',
                fields: [
                  { key: 'hierarchy_value', label: 'Hierarchy Value', values: () => [...new Set((masterProductHierarchy as any[]).map((h: any) => h.hierarchy_value).filter(Boolean))].sort() as string[] },
                  { key: 'level_name', label: 'Level Name', values: () => [...new Set((masterProductHierarchy as any[]).map((h: any) => h.level_name).filter(Boolean))].sort() as string[] },
                ],
                badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
                icon: '🏗️',
              },
              {
                entity: 'product', label: 'Product',
                fields: [
                  { key: 'product_name', label: 'Product Name', values: () => [...new Set((masterProducts as any[]).map((p: any) => p.product_name).filter(Boolean))].sort() as string[] },
                  { key: 'product_category', label: 'Product Category', values: () => [...new Set((masterProducts as any[]).map((p: any) => p.product_category).filter(Boolean))].sort() as string[] },
                  { key: 'sku', label: 'SKU', values: () => [...new Set((masterProducts as any[]).map((p: any) => p.sku).filter(Boolean))].sort() as string[] },
                ],
                badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
                icon: '📦',
              },
              {
                entity: 'territory', label: 'Territory',
                fields: [
                  { key: 'territory_name', label: 'Territory Name', values: () => [...new Set((masterTerritories as any[]).map((t: any) => t.territory_name).filter(Boolean))].sort() as string[] },
                  { key: 'territory_code', label: 'Territory Code', values: () => [...new Set((masterTerritories as any[]).map((t: any) => t.territory_code).filter(Boolean))].sort() as string[] },
                  { key: 'territory_type', label: 'Territory Type', values: () => [...new Set((masterTerritories as any[]).map((t: any) => t.territory_type).filter(Boolean))].sort() as string[] },
                ],
                badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                icon: '🌍',
              },
              {
                entity: 'channel', label: 'Sales Channel',
                fields: [
                  { key: 'channel_name', label: 'Channel Name', values: () => [...new Set((channels as any[]).map((c: any) => c.channel_name).filter(Boolean))].sort() as string[] },
                  { key: 'channel_code', label: 'Channel Code', values: () => [...new Set((channels as any[]).map((c: any) => c.channel_code).filter(Boolean))].sort() as string[] },
                  { key: 'channel_type', label: 'Channel Type', values: () => [...new Set((channels as any[]).map((c: any) => c.channel_type).filter(Boolean))].sort() as string[] },
                ],
                badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                icon: '📡',
              },
              {
                entity: 'partner', label: 'Partner',
                fields: [
                  { key: 'partner_name', label: 'Partner Name', values: () => [...new Set((masterPartners as any[]).map((p: any) => p.partner_name).filter(Boolean))].sort() as string[] },
                  { key: 'partner_type', label: 'Partner Type', values: () => [...new Set((masterPartners as any[]).map((p: any) => p.partner_type).filter(Boolean))].sort() as string[] },
                ],
                badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                icon: '🤝',
              },
              {
                entity: 'customer_segment', label: 'Customer Segment',
                fields: [
                  { key: 'segment_name', label: 'Segment Name', values: () => [...new Set((masterSegments as any[]).map((s: any) => typeof s === 'string' ? s : s.segment_name).filter(Boolean))].sort() as string[] },
                  { key: 'segment_code', label: 'Segment Code', values: () => [...new Set((masterSegments as any[]).map((s: any) => typeof s === 'string' ? s : s.segment_code).filter(Boolean))].sort() as string[] },
                ],
                badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
                icon: '👥',
              },
            ];

            const groups = editForm.qualifierGroups || [{ id: 'A', conditions: [] }];

            const updateGroups = (newGroups: typeof groups) => {
              const relabeled = newGroups.map((g: any, i: number) => ({ ...g, id: String.fromCharCode(65 + i) }));
              setEditForm({ ...editForm, qualifierGroups: relabeled });
            };

            const addConditionToGroup = (groupIdx: number) => {
              if (!qualEntity || !qualField || !qualValue) return;
              const newGroups = [...groups];
              const existing = newGroups[groupIdx].conditions.find(
                (c: any) => c.entity === qualEntity && c.field === qualField && c.operator === qualCondition
              );
              if (existing) {
                if (!existing.values.includes(qualValue)) existing.values.push(qualValue);
              } else {
                newGroups[groupIdx] = {
                  ...newGroups[groupIdx],
                  conditions: [...newGroups[groupIdx].conditions, { entity: qualEntity, field: qualField, operator: qualCondition, values: [qualValue] }]
                };
              }
              updateGroups(newGroups);
              setQualValue('');
            };

            const removeConditionFromGroup = (groupIdx: number, condIdx: number) => {
              const newGroups = [...groups];
              newGroups[groupIdx] = {
                ...newGroups[groupIdx],
                conditions: newGroups[groupIdx].conditions.filter((_: any, i: number) => i !== condIdx)
              };
              updateGroups(newGroups);
            };

            const removeValueFromCondition = (groupIdx: number, condIdx: number, valueToRemove: string) => {
              const newGroups = [...groups];
              const cond = { ...newGroups[groupIdx].conditions[condIdx] };
              cond.values = cond.values.filter((v: string) => v !== valueToRemove);
              if (cond.values.length === 0) {
                newGroups[groupIdx] = {
                  ...newGroups[groupIdx],
                  conditions: newGroups[groupIdx].conditions.filter((_: any, i: number) => i !== condIdx)
                };
              } else {
                newGroups[groupIdx] = {
                  ...newGroups[groupIdx],
                  conditions: newGroups[groupIdx].conditions.map((c: any, i: number) => i === condIdx ? cond : c)
                };
              }
              updateGroups(newGroups);
            };

            const removeGroup = (groupIdx: number) => {
              if (groups.length <= 1) return;
              const newGroups = groups.filter((_: any, i: number) => i !== groupIdx);
              updateGroups(newGroups);
            };

            const getEntityMeta = (entityKey: string) => masterEntities.find(e => e.entity === entityKey);
            const getFieldLabel = (entityKey: string, fieldKey: string) => {
              const ent = getEntityMeta(entityKey);
              return ent?.fields.find(f => f.key === fieldKey)?.label || fieldKey;
            };

            const selectedEntity = masterEntities.find(e => e.entity === qualEntity);
            const selectedFieldDef = selectedEntity?.fields.find(f => f.key === qualField);
            const fieldOptions = selectedFieldDef?.values() || [];

            return (
              <div className="space-y-3">
                {groups.map((group: any, groupIdx: number) => (
                  <div key={group.id}>
                    {groupIdx > 0 && (
                      <div className="flex items-center gap-3 my-2">
                        <Separator className="flex-1" />
                        <Badge className="bg-orange-600 text-white text-xs font-bold px-3">OR</Badge>
                        <Separator className="flex-1" />
                      </div>
                    )}
                    <div className="border rounded-lg overflow-hidden" data-testid={`condition-group-${group.id}`}>
                      <div className="bg-muted/50 px-3 py-2 flex items-center justify-between border-b">
                        <span className="text-xs font-semibold text-muted-foreground">Group {group.id} {group.conditions.length > 0 ? `— ${group.conditions.length} condition${group.conditions.length > 1 ? 's' : ''} (AND)` : ''}</span>
                        {groups.length > 1 && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-red-500 hover:text-red-700" data-testid={`button-remove-group-${group.id}`}
                            onClick={() => removeGroup(groupIdx)}>
                            <Trash2 className="h-3 w-3 mr-1" /> Remove Group
                          </Button>
                        )}
                      </div>

                      {group.conditions.length === 0 && (
                        <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                          No conditions — rule applies to all dimensions in this group
                        </div>
                      )}

                      {group.conditions.map((cond: any, condIdx: number) => {
                        const entMeta = getEntityMeta(cond.entity);
                        const condKey = `${group.id}-${condIdx}`;
                        const isEditing = editingCondKey === condKey;

                        if (isEditing) {
                          const editEntMeta = masterEntities.find(e => e.entity === qualEntity);
                          const editFieldDef = editEntMeta?.fields.find(f => f.key === qualField);
                          const editFieldOpts = editFieldDef?.values() || [];
                          return (
                            <div key={condKey} className="px-3 py-2 border-b last:border-b-0 bg-orange-50/50 dark:bg-orange-950/10" data-testid={`condition-edit-${condKey}`}>
                              {condIdx > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 mb-2 font-bold">AND</Badge>}
                              <div className="grid grid-cols-5 gap-2 items-end">
                                <Select value={qualEntity} onValueChange={(v) => { setQualEntity(v); setQualField(''); setQualValue(''); }}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Entity..." /></SelectTrigger>
                                  <SelectContent>
                                    {masterEntities.map(e => (
                                      <SelectItem key={e.entity} value={e.entity}>
                                        <span className="flex items-center gap-1">{e.icon} {e.label}</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={qualField} onValueChange={(v) => { setQualField(v); setQualValue(''); }} disabled={!qualEntity}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Field..." /></SelectTrigger>
                                  <SelectContent>
                                    {editEntMeta?.fields.map(f => (
                                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={qualCondition} onValueChange={setQualCondition}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="in">IN</SelectItem>
                                    <SelectItem value="not_in">NOT IN</SelectItem>
                                    <SelectItem value="equals">EQUALS</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="col-span-2 flex gap-2">
                                  <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-xs flex-1" data-testid={`button-save-cond-${condKey}`}
                                    onClick={() => {
                                      const newGroups = [...groups];
                                      newGroups[groupIdx] = {
                                        ...newGroups[groupIdx],
                                        conditions: newGroups[groupIdx].conditions.map((c: any, i: number) =>
                                          i === condIdx ? { ...c, entity: qualEntity, field: qualField, operator: qualCondition } : c
                                        )
                                      };
                                      updateGroups(newGroups);
                                      setEditingCondKey(null);
                                    }}>
                                    <Check className="h-3 w-3 mr-1" /> Save
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-8 text-xs" data-testid={`button-cancel-cond-${condKey}`}
                                    onClick={() => setEditingCondKey(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(cond.values || []).map((val: string) => (
                                  <Badge key={val} variant="secondary" className={`text-xs ${entMeta?.badgeColor || ''} pr-1`}>
                                    {val}
                                    <button className="ml-1 hover:text-red-600" onClick={() => removeValueFromCondition(groupIdx, condIdx, val)}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={condKey} className="px-3 py-2 border-b last:border-b-0 flex items-center gap-2 flex-wrap" data-testid={`condition-row-${group.id}-${condIdx}`}>
                            {condIdx > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 mr-1 font-bold">AND</Badge>}
                            <span className="text-sm">{entMeta?.icon}</span>
                            <span className="text-sm font-medium">{entMeta?.label || cond.entity}</span>
                            <span className="text-xs text-muted-foreground">{getFieldLabel(cond.entity, cond.field)}</span>
                            <Badge variant="outline" className="text-xs">{cond.operator === 'not_in' ? 'NOT IN' : cond.operator === 'in' ? 'IN' : cond.operator.toUpperCase()}</Badge>
                            <div className="flex flex-wrap gap-1">
                              {(cond.values || []).map((val: string) => (
                                <Badge key={val} variant="secondary" className={`text-xs ${entMeta?.badgeColor || ''} pr-1`}>
                                  {val}
                                  <button className="ml-1 hover:text-red-600" onClick={() => removeValueFromCondition(groupIdx, condIdx, val)} data-testid={`remove-val-${group.id}-${condIdx}-${val}`}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                            <div className="flex gap-1 ml-auto">
                              <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`edit-cond-${group.id}-${condIdx}`}
                                onClick={() => {
                                  setQualEntity(cond.entity);
                                  setQualField(cond.field);
                                  setQualCondition(cond.operator);
                                  setQualValue('');
                                  setEditingCondKey(condKey);
                                }}>
                                <Pencil className="h-3 w-3 text-blue-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`remove-cond-${group.id}-${condIdx}`}
                                onClick={() => removeConditionFromGroup(groupIdx, condIdx)}>
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      <div className="px-3 py-2 bg-orange-50/50 dark:bg-orange-950/10 border-t">
                        <div className="grid grid-cols-5 gap-2 items-end">
                          <Select value={qualEntity} onValueChange={(v) => { setQualEntity(v); setQualField(''); setQualValue(''); }}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-qual-entity-${group.id}`}><SelectValue placeholder="Entity..." /></SelectTrigger>
                            <SelectContent>
                              {masterEntities.map(e => (
                                <SelectItem key={e.entity} value={e.entity}>
                                  <span className="flex items-center gap-1">{e.icon} {e.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={qualField} onValueChange={(v) => { setQualField(v); setQualValue(''); }} disabled={!qualEntity}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-qual-field-${group.id}`}><SelectValue placeholder="Field..." /></SelectTrigger>
                            <SelectContent>
                              {selectedEntity?.fields.map(f => (
                                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={qualCondition} onValueChange={setQualCondition}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-qual-op-${group.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in">IN</SelectItem>
                              <SelectItem value="not_in">NOT IN</SelectItem>
                              <SelectItem value="equals">EQUALS</SelectItem>
                            </SelectContent>
                          </Select>
                          {qualField && fieldOptions.length > 0 ? (
                            <Select value={qualValue} onValueChange={setQualValue}>
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-qual-value-${group.id}`}><SelectValue placeholder="Value..." /></SelectTrigger>
                              <SelectContent>
                                {fieldOptions.map((opt: string) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={qualValue} onChange={(e) => setQualValue(e.target.value)} placeholder={qualField ? "Value..." : "Select field first"} className="h-8 text-xs" disabled={!qualField} data-testid={`input-qual-value-${group.id}`} />
                          )}
                          <Button size="sm" className="h-8 bg-orange-600 hover:bg-orange-700 text-xs" data-testid={`button-add-cond-${group.id}`}
                            disabled={!qualEntity || !qualField || !qualValue}
                            onClick={() => addConditionToGroup(groupIdx)}>
                            <Plus className="h-3 w-3 mr-1" /> Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <Separator className="my-2" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Aggregation Period</Label>
              <Select value={editForm.aggregationPeriod || ''} onValueChange={(v) => setEditForm({ ...editForm, aggregationPeriod: v })}>
                <SelectTrigger data-testid="select-aggregation-period"><SelectValue placeholder="Select period..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="per-transaction">Per Transaction</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">How often this rule accumulates/resets</p>
            </div>
            <div>
              <Label>Minimum Price ($)</Label>
              <Input type="number" step="0.01" value={editForm.minimumPrice || ""} onChange={(e) => setEditForm({ ...editForm, minimumPrice: e.target.value })} placeholder="0.00" data-testid="input-minimum-price" />
              <p className="text-xs text-muted-foreground mt-1">Minimum price floor for this rule</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="conditions" className="space-y-4 mt-4">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Gavel className="h-4 w-4" /> Applicability Conditions</h3>
            <p className="text-sm text-muted-foreground">Define when this rule applies. Conditions are evaluated before the calculation runs.</p>
          </div>
          {editForm.conditions.length > 0 && (
            <div className="space-y-3 mt-4">
              <Label className="font-medium">Current Conditions</Label>
              {editForm.conditions.map((cond: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border" data-testid={`condition-row-${idx}`}>
                  <Badge variant="outline" className="text-xs">{cond.field}</Badge>
                  <span className="text-xs text-muted-foreground">{cond.operator}</span>
                  <span className="text-sm font-medium">{cond.value}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => setEditForm({ ...editForm, conditions: editForm.conditions.filter((_: any, i: number) => i !== idx) })}><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 p-3 rounded border mt-4">
            <Label className="text-sm font-medium mb-2 block">Add Condition</Label>
            <div className="grid grid-cols-4 gap-2">
              <Select value={newCondField} onValueChange={setNewCondField}>
                <SelectTrigger data-testid="select-condition-field"><SelectValue placeholder="Field" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="volume">Volume</SelectItem>
                  <SelectItem value="amount">Amount ($)</SelectItem>
                  <SelectItem value="productCategories">Product Category</SelectItem>
                  <SelectItem value="territories">Territory</SelectItem>
                  <SelectItem value="period">Period</SelectItem>
                  <SelectItem value="channel">Channel</SelectItem>
                  <SelectItem value="customerSegment">Customer Segment</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newCondOperator} onValueChange={setNewCondOperator}>
                <SelectTrigger data-testid="select-condition-operator"><SelectValue placeholder="Operator" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value=">=">Greater or Equal</SelectItem>
                  <SelectItem value="<=">Less or Equal</SelectItem>
                  <SelectItem value="in">In List</SelectItem>
                  <SelectItem value="not_equals">Not Equals</SelectItem>
                </SelectContent>
              </Select>
              <Input value={newCondValue} onChange={(e) => setNewCondValue(e.target.value)} placeholder="Value..." data-testid="input-condition-value"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCondField && newCondOperator && newCondValue.trim()) {
                    setEditForm({ ...editForm, conditions: [...editForm.conditions, { field: newCondField, operator: newCondOperator, value: newCondValue.trim() }] });
                    setNewCondField(''); setNewCondOperator(''); setNewCondValue('');
                  }
                }} />
              <Button type="button" size="sm" data-testid="button-add-condition" onClick={() => {
                if (newCondField && newCondOperator && newCondValue.trim()) {
                  setEditForm({ ...editForm, conditions: [...editForm.conditions, { field: newCondField, operator: newCondOperator, value: newCondValue.trim() }] });
                  setNewCondField(''); setNewCondOperator(''); setNewCondValue('');
                }
              }}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          {(editForm.ruleType === 'condition' || editForm.ruleType === 'data-only') && (
            <div className="mt-4 space-y-4 bg-white dark:bg-gray-800 p-4 rounded border">
              {editForm.ruleType === 'condition' && (
                <>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2"><Gavel className="h-4 w-4 text-amber-600" /><p className="text-sm font-medium text-amber-800 dark:text-amber-200">Contract Condition / Clause</p></div>
                  </div>
                  <div><Label>Clause Text</Label><Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="e.g., Distributor shall not sell below MAP..." rows={4} data-testid="input-condition-text" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Severity</Label>
                      <Select value={editForm.baseRate || 'standard'} onValueChange={(v) => setEditForm({ ...editForm, baseRate: v })}>
                        <SelectTrigger data-testid="select-condition-severity"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="informational">Informational</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="important">Important</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Enforcement</Label><Input value={editForm.minimumGuarantee || ''} onChange={(e) => setEditForm({ ...editForm, minimumGuarantee: e.target.value })} placeholder="e.g., Termination, Penalty" data-testid="input-condition-enforcement" /></div>
                  </div>
                </>
              )}
              {editForm.ruleType === 'data-only' && (
                <>
                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2"><BookOpen className="h-4 w-4 text-orange-700" /><p className="text-sm font-medium text-orange-900 dark:text-orange-200">Data Reference / Definition</p></div>
                  </div>
                  <div><Label>Definition Text</Label><Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={4} data-testid="input-data-definition" /></div>
                  <div><Label>Section Reference</Label><Input value={editForm.minimumGuarantee || ''} onChange={(e) => setEditForm({ ...editForm, minimumGuarantee: e.target.value })} placeholder="e.g., Section 1.2, Exhibit A" data-testid="input-data-section" /></div>
                </>
              )}
            </div>
          )}
          {editForm.conditions.length === 0 && editForm.ruleType !== 'condition' && editForm.ruleType !== 'data-only' && (
            <div className="text-center py-6 text-muted-foreground"><Scale className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No applicability conditions set. This rule applies to all matching transactions.</p></div>
          )}
        </TabsContent>

        <TabsContent value="calculation" className="space-y-4 mt-4">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">
              {['payment_schedule', 'payment_method', 'rate_structure', 'invoice_requirements', 'late_payment_penalty', 'advance_payment', 'milestone_payment'].includes(editForm.ruleType)
                ? 'Payment Term Details' : editForm.ruleType === 'condition' ? 'Condition Details' : editForm.ruleType === 'data-only' ? 'Reference Details' : 'Rates & Calculations'}
            </h3>

            {(editForm.ruleType === 'percentage' || editForm.ruleType === 'minimum_guarantee' || editForm.ruleType === 'cap') && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{editForm.ruleType === 'percentage' && editForm.baseRate && parseFloat(editForm.baseRate) > 0 && parseFloat(editForm.baseRate) <= 1 ? `Rate (${(parseFloat(editForm.baseRate) * 100).toFixed(1)}%)` : 'Base Rate ($)'}</Label>
                  <Input type="number" step="0.01" value={editForm.baseRate} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder={editForm.ruleType === 'percentage' ? '0.05' : '1.25'} data-testid="input-rule-base-rate" />
                  <p className="text-xs text-muted-foreground mt-1">{editForm.ruleType === 'percentage' && editForm.baseRate && parseFloat(editForm.baseRate) > 0 && parseFloat(editForm.baseRate) <= 1 ? `Percentage rate (${(parseFloat(editForm.baseRate) * 100).toFixed(1)}%)` : editForm.ruleType === 'percentage' ? 'Percentage rate (e.g., 0.05 = 5%)' : 'Per-unit base contract fee rate'}</p>
                </div>
                <div>
                  <Label>Unit of Measure <span className="text-red-500">*</span></Label>
                  <Select value={editForm.uom || ''} onValueChange={(v) => setEditForm({ ...editForm, uom: v })}>
                    <SelectTrigger className="h-9" data-testid="select-uom"><SelectValue placeholder="Select UOM..." /></SelectTrigger>
                    <SelectContent>
                      {masterUom.map((u: any) => (
                        <SelectItem key={u.uom_code} value={u.uom_code}>{u.uom_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">How the rate is measured</p>
                </div>
                <div>
                  <Label>Minimum Guarantee ($)</Label>
                  <Input type="number" step="0.01" value={editForm.minimumGuarantee} onChange={(e) => setEditForm({ ...editForm, minimumGuarantee: e.target.value })} placeholder="85000" data-testid="input-rule-min-guarantee" />
                  <p className="text-xs text-muted-foreground mt-1">Annual minimum payment</p>
                </div>
              </div>
            )}

            {(editForm.ruleType === 'per_unit' || editForm.ruleType === 'per-unit') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Per-Unit Amount ($)</Label>
                  <Input type="number" step="0.01" value={editForm.baseRate} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder="0.25" data-testid="input-per-unit-amount" />
                  <p className="text-xs text-muted-foreground mt-1">Amount charged per unit (e.g., $0.25 per pound)</p>
                </div>
                <div>
                  <Label>Unit of Measure <span className="text-red-500">*</span></Label>
                  <Select value={editForm.uom || ''} onValueChange={(v) => setEditForm({ ...editForm, uom: v })}>
                    <SelectTrigger className="h-9" data-testid="select-uom-per-unit"><SelectValue placeholder="Select UOM..." /></SelectTrigger>
                    <SelectContent>
                      {masterUom.map((u: any) => (
                        <SelectItem key={u.uom_code} value={u.uom_code}>{u.uom_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">What unit the amount applies to</p>
                </div>
              </div>
            )}

            {editForm.ruleType === 'rebate-rate' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Rebate Rate (%)</Label>
                  <Input type="number" step="0.01" value={editForm.baseRate} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder="4.00" data-testid="input-rebate-rate" />
                  <p className="text-xs text-muted-foreground mt-1">Rebate percentage (e.g., 4 = 4%)</p>
                </div>
                <div>
                  <Label>Unit of Measure <span className="text-red-500">*</span></Label>
                  <Select value={editForm.uom || ''} onValueChange={(v) => setEditForm({ ...editForm, uom: v })}>
                    <SelectTrigger className="h-9" data-testid="select-uom-rebate"><SelectValue placeholder="Select UOM..." /></SelectTrigger>
                    <SelectContent>
                      {masterUom.map((u: any) => (
                        <SelectItem key={u.uom_code} value={u.uom_code}>{u.uom_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">How the rate is measured</p>
                </div>
                <div>
                  <Label>Minimum Guarantee ($)</Label>
                  <Input type="number" step="0.01" value={editForm.minimumGuarantee} onChange={(e) => setEditForm({ ...editForm, minimumGuarantee: e.target.value })} placeholder="0" data-testid="input-rebate-min-guarantee" />
                </div>
              </div>
            )}

            {(editForm.ruleType === 'fixed_fee' || editForm.ruleType === 'annual_fee') && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Fee Amount ($)</Label>
                  <Input type="number" step="0.01" value={editForm.baseRate} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder="35000" data-testid="input-fee-amount" />
                  <p className="text-xs text-muted-foreground mt-1">{editForm.ruleType === 'annual_fee' ? 'Recurring annual fee' : 'One-time fee'}</p>
                </div>
                <div>
                  <Label>Unit of Measure <span className="text-red-500">*</span></Label>
                  <Select value={editForm.uom || ''} onValueChange={(v) => setEditForm({ ...editForm, uom: v })}>
                    <SelectTrigger className="h-9" data-testid="select-uom-fixed"><SelectValue placeholder="Select UOM..." /></SelectTrigger>
                    <SelectContent>
                      {masterUom.map((u: any) => (
                        <SelectItem key={u.uom_code} value={u.uom_code}>{u.uom_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">How the fee is measured</p>
                </div>
                <div>
                  <Label>Fee Description</Label>
                  <Input value={editForm.minimumGuarantee || ''} onChange={(e) => setEditForm({ ...editForm, minimumGuarantee: e.target.value })} placeholder="e.g., Training fee" data-testid="input-fee-description" />
                </div>
              </div>
            )}

            {editForm.ruleType === 'payment_schedule' && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Payment Terms</Label><Input value={editForm.baseRate || ''} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder="e.g., Net 45" data-testid="input-payment-terms" /></div>
                <div><Label>Schedule Type</Label><Input value={editForm.minimumGuarantee || ''} onChange={(e) => setEditForm({ ...editForm, minimumGuarantee: e.target.value })} placeholder="e.g., Quarterly" data-testid="input-schedule-type" /></div>
              </div>
            )}

            {editForm.ruleType === 'payment_method' && (
              <div><Label>Payment Method</Label><Input value={editForm.baseRate || ''} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder="e.g., Wire transfer, ACH" data-testid="input-payment-method" /></div>
            )}

            {editForm.ruleType === 'rate_structure' && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Rate Amount ($)</Label><Input type="number" step="0.01" value={editForm.baseRate} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder="125.00" data-testid="input-rate-amount" /></div>
                <div><Label>Rate Unit</Label><Input value={editForm.minimumGuarantee || ''} onChange={(e) => setEditForm({ ...editForm, minimumGuarantee: e.target.value })} placeholder="e.g., per hour" data-testid="input-rate-unit" /></div>
              </div>
            )}

            {editForm.ruleType === 'invoice_requirements' && (
              <div><Label>Invoice Requirements</Label><Textarea value={editForm.baseRate || ''} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} rows={3} data-testid="input-invoice-requirements" /></div>
            )}

            {editForm.ruleType === 'late_payment_penalty' && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Penalty Rate (%)</Label><Input type="number" step="0.01" value={editForm.baseRate} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder="1.5" data-testid="input-penalty-rate" /></div>
                <div><Label>Penalty Details</Label><Input value={editForm.minimumGuarantee || ''} onChange={(e) => setEditForm({ ...editForm, minimumGuarantee: e.target.value })} placeholder="per month after due date" data-testid="input-penalty-details" /></div>
              </div>
            )}

            {editForm.ruleType === 'advance_payment' && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Advance Amount ($)</Label><Input type="number" step="0.01" value={editForm.baseRate} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder="5000" data-testid="input-advance-amount" /></div>
                <div><Label>Percentage (Optional)</Label><Input type="number" step="0.01" value={editForm.minimumGuarantee} onChange={(e) => setEditForm({ ...editForm, minimumGuarantee: e.target.value })} placeholder="25" data-testid="input-advance-percentage" /></div>
              </div>
            )}

            {editForm.ruleType === 'milestone_payment' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 mb-2">
                  <div>
                    <Label>Total Contract Value ($)</Label>
                    <Input type="number" step="0.01" value={editForm.baseRate || ''} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder="100000" data-testid="input-milestone-contract-value" />
                    <p className="text-xs text-muted-foreground mt-1">Used to calculate percentage-based milestones</p>
                  </div>
                  <div>
                    <Label>Number of Milestones</Label>
                    <div className="flex gap-2">
                      <Input type="number" min="1" max="20" value={editForm.milestoneCount || ''} onChange={(e) => setEditForm({ ...editForm, milestoneCount: e.target.value })} placeholder="4" className="w-20" data-testid="input-milestone-count" />
                      <Button type="button" variant="outline" size="sm" className="h-9 whitespace-nowrap" onClick={() => {
                        const count = parseInt(editForm.milestoneCount) || 0;
                        if (count < 1 || count > 20) return;
                        const contractVal = parseFloat(editForm.baseRate) || 0;
                        const evenPct = parseFloat((100 / count).toFixed(2));
                        const evenAmt = contractVal > 0 ? parseFloat(((contractVal * evenPct) / 100).toFixed(2)) : 0;
                        const generated = Array.from({ length: count }, (_, i) => ({
                          event: `Milestone ${i + 1}`,
                          percentage: String(evenPct),
                          amount: evenAmt,
                          dueDate: '',
                          status: 'pending',
                        }));
                        setEditForm({ ...editForm, milestones: generated });
                      }} data-testid="button-generate-milestones">Generate</Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Auto-create rows distributed evenly</p>
                  </div>
                  <div>
                    <Label>Execution Trigger</Label>
                    <Select value={editForm.executionGroup || 'event'} onValueChange={(v) => setEditForm({ ...editForm, executionGroup: v })}>
                      <SelectTrigger data-testid="select-milestone-trigger"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event">Event-Based (manual trigger)</SelectItem>
                        <SelectItem value="periodic">Periodic (scheduled)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">How milestone completion is tracked</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Milestone Events</p>
                    <p className="text-xs text-muted-foreground">Define each milestone with its trigger event, payment amount or percentage, and expected due date</p>
                  </div>
                  <Button type="button" size="sm" onClick={() => setEditForm({ ...editForm, milestones: [...(editForm.milestones || []), { event: '', amount: 0, percentage: '', dueDate: '', status: 'pending' }] })} data-testid="button-add-milestone"><Plus className="h-4 w-4 mr-1" /> Add Milestone</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border rounded">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Event / Trigger</th>
                        <th className="text-right px-3 py-2 font-medium">%</th>
                        <th className="text-right px-3 py-2 font-medium">Amount ($)</th>
                        <th className="text-left px-3 py-2 font-medium">Due Date</th>
                        <th className="text-center px-3 py-2 font-medium">Status</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(editForm.milestones || []).map((m: any, idx: number) => {
                        const contractVal = parseFloat(editForm.baseRate) || 0;
                        const pctAmount = m.percentage && contractVal > 0 ? (parseFloat(m.percentage) / 100) * contractVal : null;
                        return (
                          <tr key={idx} className="border-t">
                            <td className="px-2 py-2"><Input value={m.event || ''} onChange={(e) => { const ms = [...(editForm.milestones || [])]; ms[idx] = { ...ms[idx], event: e.target.value }; setEditForm({ ...editForm, milestones: ms }); }} className="h-8" placeholder="e.g., Contract Signing" data-testid={`input-milestone-event-${idx}`} /></td>
                            <td className="px-2 py-2"><Input type="number" step="0.01" value={m.percentage || ''} onChange={(e) => { const ms = [...(editForm.milestones || [])]; const pct = e.target.value; const amt = pct && contractVal > 0 ? (parseFloat(pct) / 100) * contractVal : ms[idx].amount; ms[idx] = { ...ms[idx], percentage: pct, amount: amt || 0 }; setEditForm({ ...editForm, milestones: ms }); }} className="h-8 w-16 text-right" placeholder="50" data-testid={`input-milestone-pct-${idx}`} /></td>
                            <td className="px-2 py-2"><Input type="number" step="0.01" value={pctAmount !== null ? pctAmount.toFixed(2) : (m.amount || '')} onChange={(e) => { const ms = [...(editForm.milestones || [])]; ms[idx] = { ...ms[idx], amount: parseFloat(e.target.value) || 0, percentage: '' }; setEditForm({ ...editForm, milestones: ms }); }} className="h-8 w-28 text-right" placeholder="50000" data-testid={`input-milestone-amount-${idx}`} readOnly={pctAmount !== null} /></td>
                            <td className="px-2 py-2"><Input type="date" value={m.dueDate || ''} onChange={(e) => { const ms = [...(editForm.milestones || [])]; ms[idx] = { ...ms[idx], dueDate: e.target.value }; setEditForm({ ...editForm, milestones: ms }); }} className="h-8" data-testid={`input-milestone-due-${idx}`} /></td>
                            <td className="px-2 py-2 text-center">
                              <Select value={m.status || 'pending'} onValueChange={(v) => { const ms = [...(editForm.milestones || [])]; ms[idx] = { ...ms[idx], status: v }; setEditForm({ ...editForm, milestones: ms }); }}>
                                <SelectTrigger className="h-8 w-24" data-testid={`select-milestone-status-${idx}`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="invoiced">Invoiced</SelectItem>
                                  <SelectItem value="paid">Paid</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-1 py-2"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditForm({ ...editForm, milestones: (editForm.milestones || []).filter((_: any, i: number) => i !== idx) })} data-testid={`button-remove-milestone-${idx}`}><Minus className="h-4 w-4" /></Button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(!editForm.milestones || editForm.milestones.length === 0) && <p className="text-sm text-muted-foreground italic text-center py-4">No milestones configured. Click "Add Milestone" to define payment events.</p>}
                {editForm.milestones && editForm.milestones.length > 0 && (() => {
                  const cVal = parseFloat(editForm.baseRate) || 0;
                  const mTotal = editForm.milestones.reduce((sum: number, m: any) => {
                    const pct = parseFloat(m.percentage);
                    if (pct > 0 && cVal > 0) return sum + (pct / 100) * cVal;
                    return sum + (parseFloat(m.amount) || 0);
                  }, 0);
                  const pctOfContract = cVal > 0 ? ((mTotal / cVal) * 100).toFixed(1) : null;
                  const isMismatch = cVal > 0 && Math.abs(cVal - mTotal) > 0.01;
                  return (
                    <div className={`flex items-center justify-end gap-4 text-sm px-3 py-2 rounded-md ${isMismatch ? 'bg-red-50 border border-red-200' : ''}`}>
                      {isMismatch && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                      <span className={isMismatch ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        Total: <strong className={isMismatch ? 'text-red-700' : 'text-foreground'}>${mTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                      </span>
                      {pctOfContract && (
                        <span className={isMismatch ? 'text-red-600' : 'text-muted-foreground'}>({pctOfContract}% of contract value)</span>
                      )}
                      {isMismatch && (
                        <span className="text-red-600 text-xs">Must equal ${cVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {editForm.ruleType === 'deduction' && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Deduction Amount / Rate</Label><Input type="number" step="0.01" value={editForm.baseRate} onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })} placeholder="0.03 for 3%" data-testid="input-deduction-amount" /></div>
                <div><Label>Deduction Basis</Label><Input value={editForm.minimumGuarantee || ''} onChange={(e) => setEditForm({ ...editForm, minimumGuarantee: e.target.value })} placeholder="e.g., Gross sales" data-testid="input-deduction-basis" /></div>
              </div>
            )}

            {editForm.ruleType === 'rebate_tiered' && (
              <div className="space-y-4">
                <Label>Volume Tiers</Label>
                <div className="border rounded p-3 bg-muted/50"><pre className="text-sm whitespace-pre-wrap">{JSON.stringify(editForm.volumeTiers || [], null, 2)}</pre></div>
              </div>
            )}

            {editForm.ruleType === 'milestone_tiered' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Measurement Basis</Label>
                    <Select value={editForm.milestoneConfig?.measurementBasis || 'cumulative_revenue'} onValueChange={(v) => setEditForm({ ...editForm, milestoneConfig: { ...editForm.milestoneConfig, measurementBasis: v } })}>
                      <SelectTrigger data-testid="select-milestone-basis"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cumulative_revenue">Cumulative Revenue</SelectItem>
                        <SelectItem value="cumulative_units">Cumulative Units</SelectItem>
                        <SelectItem value="cumulative_count">Cumulative Transaction Count</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">What metric drives the tier thresholds</p>
                  </div>
                  <div>
                    <Label>Measurement Period</Label>
                    <Select value={editForm.milestoneConfig?.measurementPeriod || 'contract_period'} onValueChange={(v) => setEditForm({ ...editForm, milestoneConfig: { ...editForm.milestoneConfig, measurementPeriod: v } })}>
                      <SelectTrigger data-testid="select-milestone-period"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contract_period">Full Contract Period</SelectItem>
                        <SelectItem value="annual">Annual (Calendar Year)</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">When cumulative totals reset</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">Milestone Threshold Tiers</h4>
                    <p className="text-xs text-muted-foreground">Define threshold ranges and the rate/amount applied when each tier is reached</p>
                  </div>
                  <Button type="button" size="sm" onClick={() => {
                    const tiers = [...(editForm.milestoneTiers || [])];
                    const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1].toThreshold || 0) : 0;
                    tiers.push({ fromThreshold: lastMax, toThreshold: null, rate: 0, rateType: 'percentage' as const, retroactive: editForm.milestoneConfig?.retroactiveDefault ?? true });
                    setEditForm({ ...editForm, milestoneTiers: tiers });
                  }} data-testid="button-add-milestone-tier"><Plus className="h-4 w-4 mr-1" /> Add Tier</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border rounded">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">From</th>
                        <th className="text-left px-3 py-2 font-medium">To</th>
                        <th className="text-right px-3 py-2 font-medium">Rate / Amount</th>
                        <th className="text-center px-3 py-2 font-medium">Type</th>
                        <th className="text-center px-3 py-2 font-medium">Retroactive</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(editForm.milestoneTiers || []).map((tier: any, idx: number) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-2">
                            <Input type="number" step="0.01" value={tier.fromThreshold ?? 0} onChange={(e) => {
                              const t = [...(editForm.milestoneTiers || [])]; t[idx] = { ...t[idx], fromThreshold: parseFloat(e.target.value) || 0 }; setEditForm({ ...editForm, milestoneTiers: t });
                            }} className="h-8 w-28" data-testid={`input-ms-tier-from-${idx}`} />
                          </td>
                          <td className="px-2 py-2">
                            <Input type="number" step="0.01" value={tier.toThreshold ?? ''} onChange={(e) => {
                              const t = [...(editForm.milestoneTiers || [])]; t[idx] = { ...t[idx], toThreshold: e.target.value ? parseFloat(e.target.value) : null }; setEditForm({ ...editForm, milestoneTiers: t });
                            }} className="h-8 w-28" placeholder="∞" data-testid={`input-ms-tier-to-${idx}`} />
                          </td>
                          <td className="px-2 py-2">
                            <Input type="number" step="0.01" value={tier.rate ?? 0} onChange={(e) => {
                              const t = [...(editForm.milestoneTiers || [])]; t[idx] = { ...t[idx], rate: parseFloat(e.target.value) || 0 }; setEditForm({ ...editForm, milestoneTiers: t });
                            }} className="h-8 w-24 text-right" data-testid={`input-ms-tier-rate-${idx}`} />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <Select value={tier.rateType || 'percentage'} onValueChange={(v) => {
                              const t = [...(editForm.milestoneTiers || [])]; t[idx] = { ...t[idx], rateType: v }; setEditForm({ ...editForm, milestoneTiers: t });
                            }}>
                              <SelectTrigger className="h-8 w-20" data-testid={`select-ms-tier-type-${idx}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">%</SelectItem>
                                <SelectItem value="fixed">$</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" checked={tier.retroactive ?? true} onChange={(e) => {
                              const t = [...(editForm.milestoneTiers || [])]; t[idx] = { ...t[idx], retroactive: e.target.checked }; setEditForm({ ...editForm, milestoneTiers: t });
                            }} className="h-4 w-4 accent-orange-600" data-testid={`checkbox-ms-tier-retro-${idx}`} />
                          </td>
                          <td className="px-1 py-2">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              setEditForm({ ...editForm, milestoneTiers: (editForm.milestoneTiers || []).filter((_: any, i: number) => i !== idx) });
                            }} data-testid={`button-remove-ms-tier-${idx}`}><Minus className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(!editForm.milestoneTiers || editForm.milestoneTiers.length === 0) && (
                  <p className="text-sm text-muted-foreground italic text-center py-4">No milestone tiers configured. Click "Add Tier" to define threshold-based rates.</p>
                )}
                <div className="flex items-center gap-2 px-1">
                  <input type="checkbox" checked={editForm.milestoneConfig?.retroactiveDefault ?? true} onChange={(e) => setEditForm({ ...editForm, milestoneConfig: { ...editForm.milestoneConfig, retroactiveDefault: e.target.checked } })} className="h-4 w-4 accent-orange-600" data-testid="checkbox-ms-retro-default" />
                  <Label className="text-sm font-normal">Retroactive by default — when a higher tier is reached, recalculate all prior volume at the new rate</Label>
                </div>
              </div>
            )}

            {editForm.ruleType === 'condition' && (
              <div className="text-center py-4 text-muted-foreground"><Gavel className="h-6 w-6 mx-auto mb-2 opacity-30" /><p className="text-sm">This is a contract condition — edit its clause text in the Conditions tab.</p></div>
            )}

            {editForm.ruleType === 'data-only' && (
              <div className="text-center py-4 text-muted-foreground"><BookOpen className="h-6 w-6 mx-auto mb-2 opacity-30" /><p className="text-sm">This is a data reference — edit its definition in the Conditions tab.</p></div>
            )}

            {!['condition', 'data-only', 'payment_schedule', 'payment_method', 'invoice_requirements', 'late_payment_penalty', 'advance_payment', 'milestone_payment', 'milestone_tiered', 'rebate_tiered', 'deduction', 'fixed_fee', 'annual_fee', 'per_unit', 'per-unit', 'rebate-rate'].includes(editForm.ruleType) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Volume Tiers</h3>
                  <Button type="button" size="sm" onClick={addVolumeTier} data-testid="button-add-volume-tier"><Plus className="h-4 w-4 mr-1" /> Add Tier</Button>
                </div>
                {editForm.volumeTiers.map((tier: any, index: number) => (
                  <div key={index} className="grid grid-cols-5 gap-2 items-end">
                    <div><Label>Min Qty</Label><Input type="number" value={tier.min ?? 0} onChange={(e) => updateVolumeTier(index, 'min', parseInt(e.target.value) || 0)} data-testid={`input-tier-min-${index}`} /></div>
                    <div><Label>Max Qty</Label><Input type="number" value={tier.max || ""} onChange={(e) => updateVolumeTier(index, 'max', e.target.value ? parseInt(e.target.value) : null)} placeholder="∞" data-testid={`input-tier-max-${index}`} /></div>
                    <div><Label>Rate ($)</Label><Input type="number" step="0.01" value={tier.rate} onChange={(e) => updateVolumeTier(index, 'rate', parseFloat(e.target.value) || 0)} data-testid={`input-tier-rate-${index}`} /></div>
                    <div><Label>Min Annual ($)</Label><Input type="number" step="0.01" value={tier.minimumAnnual || ""} onChange={(e) => updateVolumeTier(index, 'minimumAnnual', e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="0" data-testid={`input-tier-min-annual-${index}`} /></div>
                    <Button type="button" variant="destructive" size="icon" onClick={() => removeVolumeTier(index)} data-testid={`button-remove-tier-${index}`}><Minus className="h-4 w-4" /></Button>
                  </div>
                ))}
                {editForm.volumeTiers.length === 0 && <p className="text-sm text-muted-foreground">No volume tiers configured.</p>}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="overrides" className="space-y-4 mt-4">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Zap className="h-4 w-4" /> Exceptions & Overrides</h3>
            <p className="text-sm text-muted-foreground">Define exceptions, seasonal adjustments, and territory premiums that override the base calculation.</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Exceptions</Label>
              <Button type="button" size="sm" variant="outline" data-testid="button-add-exception" onClick={() => setEditForm({ ...editForm, exceptions: [...editForm.exceptions, { condition: '', action: '', description: '' }] })}><Plus className="h-4 w-4 mr-1" /> Add Exception</Button>
            </div>
            {editForm.exceptions.map((exc: any, idx: number) => (
              <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded border space-y-2" data-testid={`exception-row-${idx}`}>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Condition</Label><Input value={exc.condition} onChange={(e) => { const excs = [...editForm.exceptions]; excs[idx] = { ...excs[idx], condition: e.target.value }; setEditForm({ ...editForm, exceptions: excs }); }} placeholder="When..." data-testid={`input-exception-condition-${idx}`} /></div>
                  <div><Label className="text-xs">Action</Label><Input value={exc.action} onChange={(e) => { const excs = [...editForm.exceptions]; excs[idx] = { ...excs[idx], action: e.target.value }; setEditForm({ ...editForm, exceptions: excs }); }} placeholder="Then..." data-testid={`input-exception-action-${idx}`} /></div>
                  <div className="flex gap-1">
                    <div className="flex-1"><Label className="text-xs">Note</Label><Input value={exc.description} onChange={(e) => { const excs = [...editForm.exceptions]; excs[idx] = { ...excs[idx], description: e.target.value }; setEditForm({ ...editForm, exceptions: excs }); }} data-testid={`input-exception-desc-${idx}`} /></div>
                    <Button type="button" variant="ghost" size="icon" className="mt-5 h-9 w-9" onClick={() => setEditForm({ ...editForm, exceptions: editForm.exceptions.filter((_: any, i: number) => i !== idx) })}><X className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            ))}
            {editForm.exceptions.length === 0 && <p className="text-sm text-muted-foreground italic">No exceptions defined.</p>}
          </div>
          <Separator />
          {editForm.ruleType !== 'condition' && editForm.ruleType !== 'data-only' && Object.keys(editForm.seasonalAdjustments || {}).length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Seasonal Adjustments (Multipliers)</h3>
              <div className="grid grid-cols-3 gap-4">
                {['Spring', 'Summer', 'Fall', 'Winter', 'Holiday', 'Off-Season'].map((season) => (
                  <div key={season}>
                    <Label>{season}</Label>
                    <Input type="number" step="any" min="-10" max="10" value={editForm.seasonalAdjustments?.[season] ?? ""} onChange={(e) => {
                      const val = e.target.value; const newAdj = { ...(editForm.seasonalAdjustments || {}) };
                      if (val === '') { delete newAdj[season]; } else { const num = parseFloat(val); if (!isNaN(num)) newAdj[season] = num; }
                      setEditForm({ ...editForm, seasonalAdjustments: newAdj });
                    }} placeholder="1.0" data-testid={`input-seasonal-${season.toLowerCase()}`} />
                    <p className="text-xs text-muted-foreground mt-1">0.95=-5%, 1.0=no change, 1.15=+15%</p>
                  </div>
                ))}
              </div>
              <Separator />
            </div>
          )}
          {editForm.ruleType !== 'condition' && editForm.ruleType !== 'data-only' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Territory Premiums (Multipliers)</h3>
                <Select value="" onValueChange={(v) => { if (v && !editForm.territoryPremiums?.[v]) setEditForm({ ...editForm, territoryPremiums: { ...(editForm.territoryPremiums || {}), [v]: 1.0 } }); }}>
                  <SelectTrigger className="w-48" data-testid="select-add-territory-premium"><SelectValue placeholder="Add territory..." /></SelectTrigger>
                  <SelectContent>
                    {masterTerritories.filter((t: any) => !editForm.territoryPremiums?.[t.territory_name]).map((t: any) => (
                      <SelectItem key={t.territory_id} value={t.territory_name}>{t.territory_name}</SelectItem>
                    ))}
                    {['Primary', 'Secondary', 'International', 'Organic', 'Specialty'].filter(t => !editForm.territoryPremiums?.[t] && !masterTerritories.find((mt: any) => mt.territory_name === t)).map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {Object.keys(editForm.territoryPremiums || {}).length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(editForm.territoryPremiums || {}).map(([territory, val]: [string, any]) => (
                    <div key={territory} className="relative">
                      <Label className="flex items-center justify-between">{territory}<X className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-red-500" onClick={() => { const tp = { ...(editForm.territoryPremiums || {}) }; delete tp[territory]; setEditForm({ ...editForm, territoryPremiums: tp }); }} /></Label>
                      <Input type="number" step="0.01" value={val ?? ""} onChange={(e) => setEditForm({ ...editForm, territoryPremiums: { ...(editForm.territoryPremiums || {}), [territory]: parseFloat(e.target.value) || 0 } })} placeholder="1.0" data-testid={`input-territory-${territory.toLowerCase()}`} />
                      <p className="text-xs text-muted-foreground mt-1">0.95=-5%, 1.0=no change, 1.15=+15%</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground italic">No territory premiums. Use dropdown above to add.</p>}
            </div>
          )}
          {editForm.ruleType !== 'condition' && editForm.ruleType !== 'data-only' && Object.keys(editForm.seasonalAdjustments || {}).length === 0 && Object.keys(editForm.territoryPremiums || {}).length === 0 && editForm.exceptions.length === 0 && (
            <div className="text-center py-6 text-muted-foreground"><Zap className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No overrides configured. Add exceptions above to customize rule behavior.</p></div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Clock className="h-4 w-4" /> Version History</h3>
            <p className="text-sm text-muted-foreground">Track changes and audit trail for this rule.</p>
          </div>
          {(() => {
            const currentRule = rules.find((r: any) => r.id === editingId);
            if (!currentRule && !addingNew) return <p className="text-sm text-muted-foreground italic">Save the rule first to see history.</p>;
            if (addingNew) return <p className="text-sm text-muted-foreground italic">Save the rule first to see history.</p>;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border text-center">
                    <p className="text-xs text-muted-foreground">Version</p>
                    <p className="text-2xl font-bold text-orange-600">v{currentRule?.ruleVersionNum || 1}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border text-center">
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm font-medium">{currentRule?.createdAt ? new Date(currentRule.createdAt).toLocaleDateString('en-US') : 'N/A'}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border text-center">
                    <p className="text-xs text-muted-foreground">Last Modified</p>
                    <p className="text-sm font-medium">{currentRule?.updatedAt ? new Date(currentRule.updatedAt).toLocaleDateString('en-US') : 'N/A'}</p>
                  </div>
                </div>
                {currentRule?.previousVersionData && (
                  <div className="space-y-2">
                    <Label className="font-medium">Previous Version Changes</Label>
                    <div className="bg-muted/50 p-3 rounded border"><pre className="text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">{JSON.stringify(currentRule.previousVersionData, null, 2)}</pre></div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="font-medium">Rule Metadata</Label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border"><span className="text-xs text-muted-foreground">Rule ID:</span><p className="font-mono text-xs truncate">{currentRule?.id}</p></div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border"><span className="text-xs text-muted-foreground">Extraction Order:</span><p className="font-mono text-xs">{currentRule?.extractionOrder ?? 'N/A'}</p></div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border"><span className="text-xs text-muted-foreground">Source:</span><p className="text-xs">{currentRule?.sourceSpan ? 'AI Extracted' : 'Manual'}</p></div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border"><span className="text-xs text-muted-foreground">Priority:</span><p className="text-xs">{currentRule?.priority || 1}</p></div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="font-medium flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Decision Logs</Label>
                  <p className="text-xs text-muted-foreground">Records of when this rule was evaluated against transactions.</p>
                  {decisionLogsData?.logs && decisionLogsData.logs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border rounded" data-testid="table-decision-logs">
                        <thead className="bg-muted"><tr><th className="text-left px-2 py-1.5 font-medium">Date</th><th className="text-left px-2 py-1.5 font-medium">Transaction</th><th className="text-left px-2 py-1.5 font-medium">Condition Matched</th><th className="text-right px-2 py-1.5 font-medium">Specificity</th></tr></thead>
                        <tbody>
                          {decisionLogsData.logs.map((log: any, idx: number) => (
                            <tr key={log.id || idx} className="border-t" data-testid={`decision-log-row-${idx}`}>
                              <td className="px-2 py-1.5">{log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-US') : 'N/A'}</td>
                              <td className="px-2 py-1.5 font-mono truncate max-w-[120px]">{log.transactionId || '—'}</td>
                              <td className="px-2 py-1.5">{log.conditionMatched || '—'}</td>
                              <td className="px-2 py-1.5 text-right">{log.specificityScore ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground bg-white dark:bg-gray-800 rounded border">
                      <Database className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
                      <p className="text-xs">No decision logs yet. Logs appear when this rule is evaluated against transactions.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2 pt-4 border-t mt-4">
        {!addingNew && editForm.reviewStatus !== 'verified' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400 dark:border-green-800"
                  onClick={() => { handleSaveRule(); setTimeout(() => handleVerifyRule(editForm.id), 500); }}
                  disabled={reviewStatusMutation.isPending}
                  data-testid="button-verify-rule"
                >
                  <ShieldCheck className="h-4 w-4 mr-1" /> Verify & Confirm
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Save and mark this rule as verified — ready for calculations</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {!addingNew && (!editForm.reviewStatus || editForm.reviewStatus === 'pending' || editForm.reviewStatus === 'auto_confirmed') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:hover:bg-yellow-900 dark:text-yellow-400 dark:border-yellow-800"
                  onClick={() => handleSendToReview(editForm.id)}
                  disabled={reviewStatusMutation.isPending}
                  data-testid="button-send-to-review"
                >
                  <AlertCircle className="h-4 w-4 mr-1" /> Send to Review
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Mark this rule as under review — needs manual verification</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {!addingNew && editForm.reviewStatus !== 'rejected' && editForm.reviewStatus !== 'verified' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:hover:bg-red-900 dark:text-red-400 dark:border-red-800"
                  onClick={() => handleRejectRule(editForm.id)}
                  disabled={reviewStatusMutation.isPending}
                  data-testid="button-reject-rule"
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Reject this rule — it will not be used in calculations</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {!addingNew && (editForm.reviewStatus === 'verified' || editForm.reviewStatus === 'rejected') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:hover:bg-yellow-900 dark:text-yellow-400 dark:border-yellow-800"
                  onClick={() => handleSendToReview(editForm.id)}
                  disabled={reviewStatusMutation.isPending}
                  data-testid="button-unverify-rule"
                >
                  <AlertCircle className="h-4 w-4 mr-1" /> Re-open for Review
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Move back to review — will require re-verification</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={addingNew ? cancelAdd : cancelEdit} data-testid="button-cancel-rule"><X className="h-4 w-4 mr-2" /> Cancel</Button>
          <Button onClick={handleSaveRule} disabled={addMutation.isPending || updateMutation.isPending} className="bg-orange-600 hover:bg-orange-700" data-testid="button-save-rule">
            {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            {(addMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save Rule"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
    <Card className="shadow-md" data-testid="card-rules-table">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/50 border-b">
        <div>
          <CardTitle className="text-xl">Contract Fee Rules</CardTitle>
          <CardDescription>{rules.length} rule(s)</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {rules.length > 0 && (pendingApprovalIds.length > 0 || pendingCount + underReviewCount > 0) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={verifyAndApproveAllMutation.isPending}
                  data-testid="button-bulk-verify-approve"
                >
                  {verifyAndApproveAllMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                  Verify & Approve All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Verify & Approve All Rules</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark all {rules.length} rule(s) as <strong>verified</strong> and <strong>approved</strong> in one step. Approved rules immediately become active in fee calculations. Are you sure?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-green-600 hover:bg-green-700" onClick={() => verifyAndApproveAllMutation.mutate(allRuleIds)}>
                    Verify & Approve All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {rules.length > 0 && pendingCount + underReviewCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400 dark:border-green-800"
                  disabled={bulkReviewMutation.isPending}
                  data-testid="button-bulk-verify"
                >
                  {bulkReviewMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                  Verify Only
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Verify All Rules</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark all {pendingCount + underReviewCount} unverified rule(s) as verified. Verified rules still need to be approved before they participate in payment calculations.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-green-600 hover:bg-green-700" onClick={() => bulkReviewMutation.mutate({ reviewStatus: 'verified' })}>Verify All Rules</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {rules.length > 0 && pendingCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:hover:bg-yellow-900 dark:text-yellow-400 dark:border-yellow-800"
                  disabled={bulkReviewMutation.isPending}
                  data-testid="button-bulk-review"
                >
                  <AlertCircle className="h-4 w-4 mr-1" /> Send All to Review
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send All to Review</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move all {pendingCount} AI-extracted rule(s) to "Under Review" status for manual verification. Rules under review do not participate in payment calculations until verified.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-yellow-600 hover:bg-yellow-700" onClick={() => bulkReviewMutation.mutate({ reviewStatus: 'under_review' })}>Send All to Review</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {rules.length > 0 && verificationProgress === 100 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-400 dark:border-orange-800"
                  disabled={bulkReviewMutation.isPending}
                  data-testid="button-bulk-reopen"
                >
                  <AlertCircle className="h-4 w-4 mr-1" /> Re-open All for Review
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Re-open All for Review</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset all {verifiedCount} verified rule(s) back to "Under Review" status. Rules will need to be re-verified before participating in payment calculations.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-orange-600 hover:bg-orange-700" onClick={() => bulkReviewMutation.mutate({ reviewStatus: 'under_review' })}>Re-open All for Review</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button size="sm" onClick={startAdd} disabled={!!editingId} data-testid="button-add-rule"><Plus className="h-4 w-4 mr-1" /> Add Rule</Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {rules.length > 0 && (
          <div className="space-y-2" data-testid="verification-progress-bar">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Verification Progress</span>
              <span className="text-muted-foreground">{verifiedCount} of {rules.length} rules verified</span>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={verificationProgress} className="h-2 flex-1" />
              <span className="text-sm font-semibold min-w-[40px] text-right">{verificationProgress}%</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span> AI Extracted: {pendingCount}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400"></span> Under Review: {underReviewCount}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span> Verified: {verifiedCount}</span>
              {rejectedCount > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400"></span> Rejected: {rejectedCount}</span>}
            </div>
          </div>
        )}

        {addingNew && renderEditForm()}

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Validation</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Base Rate</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule: any) => {
                const tlConfig = getTrafficLightConfig(rule.reviewStatus || 'pending');
                const TlIcon = tlConfig.icon;
                return (
                <Fragment key={rule.id}>
                  <TableRow data-testid={`row-rule-${rule.id}`} className="cursor-pointer" onClick={() => { if (editingId === rule.id) return; if (editingId) { cancelEdit(); } startEdit(rule); }}>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-center" data-testid={`validation-indicator-${rule.id}`}>
                              <div className={`w-3.5 h-3.5 rounded-full ${tlConfig.color} shadow-sm ring-2 ring-white dark:ring-gray-800`} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="flex items-center gap-1.5">
                              <TlIcon className={`h-3.5 w-3.5 ${tlConfig.textColor}`} />
                              <span>{tlConfig.label}</span>
                            </div>
                            {rule.reviewedAt && <p className="text-xs text-muted-foreground mt-1">Updated: {new Date(rule.reviewedAt).toLocaleDateString('en-US')}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{rule.ruleName}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{allRuleTypes[rule.ruleType] || rule.ruleType}</Badge></TableCell>
                    <TableCell className="text-sm">{rule.baseRate || "-"}</TableCell>
                    <TableCell className="text-sm">{rule.priority}</TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">{rule.isActive ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell>
                      {rule.approvalStatus === 'approved' ? (
                        <Badge className="text-xs bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800" data-testid={`badge-approval-${rule.id}`}>Approved</Badge>
                      ) : rule.approvalStatus === 'rejected' ? (
                        <Badge className="text-xs bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800" data-testid={`badge-approval-${rule.id}`}>Rejected</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-approval-${rule.id}`}>Pending Approval</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center" onClick={e => e.stopPropagation()}>
                        {rule.approvalStatus !== 'approved' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-green-700 hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:hover:bg-green-950"
                                  onClick={() => approveRuleMutation.mutate(rule.id)}
                                  disabled={approveRuleMutation.isPending}
                                  data-testid={`button-approve-rule-${rule.id}`}
                                >
                                  <ShieldCheck className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Approve rule — makes it active in calculations</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => { if (editingId && editingId !== rule.id) { cancelEdit(); } startEdit(rule); }} data-testid={`button-edit-rule-${rule.id}`}><Pencil className="h-3 w-3" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-delete-rule-${rule.id}`}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure you want to delete "{rule.name}"? This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(rule.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                  {editingId === rule.id && !addingNew && (
                    <TableRow>
                      <TableCell colSpan={8} className="p-0">
                        {renderEditForm()}
                      </TableCell>
                    </TableRow>
                  )}
                  {expandedId === rule.id && editingId !== rule.id && (
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={8} className="p-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          {rule.description && <div className="col-span-3"><span className="text-muted-foreground font-medium">Description: </span>{rule.description}</div>}
                          {rule.calculationFormula && <div className="col-span-3"><span className="text-muted-foreground font-medium">Formula: </span>{rule.calculationFormula}</div>}
                          {rule.minimumGuarantee && <div><span className="text-muted-foreground font-medium">Min Guarantee: </span>{rule.minimumGuarantee}</div>}
                          {rule.channel && <div><span className="text-muted-foreground font-medium">Channel: </span>{rule.channel}</div>}
                          {rule.clauseCategory && <div><span className="text-muted-foreground font-medium">Category: </span>{rule.clauseCategory}</div>}
                          {rule.executionGroup && <div><span className="text-muted-foreground font-medium">Exec Group: </span>{rule.executionGroup}</div>}
                          {rule.baseMetric && <div><span className="text-muted-foreground font-medium">Base Metric: </span>{rule.baseMetric}</div>}
                          {rule.sourceSection && <div><span className="text-muted-foreground font-medium">Source: </span>{rule.sourceSection}</div>}
                          {rule.territories?.length > 0 && <div><span className="text-muted-foreground font-medium">Territories: </span>{rule.territories.join(', ')}</div>}
                          {rule.productCategories?.length > 0 && <div><span className="text-muted-foreground font-medium">Products: </span>{rule.productCategories.join(', ')}</div>}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
              })}
              {rules.length === 0 && !addingNew && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="space-y-3">
                      <p className="text-muted-foreground">No rules found yet</p>
                      <GenerateSampleButton contractId={contractId} tabType="rules" label="Sample Rules" onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules-list'] })} />
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

      </CardContent>
    </Card>

    {/* Confirmation dialog: rule edit on an approved contract starts a new
        approval cycle (mints a new pending version on the server). Editor must
        opt in so they understand they're invalidating the current approval. */}
    <AlertDialog open={!!pendingApprovalSave} onOpenChange={(open) => { if (!open) setPendingApprovalSave(null); }}>
      <AlertDialogContent data-testid="dialog-rule-edit-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Saving will create a new contract version</AlertDialogTitle>
          <AlertDialogDescription>
            This contract is currently approved. Saving this rule change will create a new version{contractInfo?.currentVersion ? ` (v${(contractInfo.currentVersion || 1) + 1})` : ''} that requires re-approval before fees can be calculated. The current approved version will be set aside until the new one is approved or discarded.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => setPendingApprovalSave(null)}
            data-testid="button-rule-edit-cancel"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-orange-600 hover:bg-orange-700"
            onClick={() => {
              const data = pendingApprovalSave;
              setPendingApprovalSave(null);
              if (data) updateMutation.mutate(data);
            }}
            data-testid="button-rule-edit-confirm"
          >
            Save & require approval
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function PartnersTabContent({ contractId, partners, isLoading, hasMaster, isAutoGenerating }: { contractId: string; partners: any[]; isLoading: boolean; hasMaster: boolean; isAutoGenerating: boolean }) {
  const { toast } = useToast();
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<any>({});

  const { data: partnerMasterData } = useQuery({ queryKey: ['/api/master/partners'], queryFn: () => fetch('/api/master/partners', { credentials: "include" }).then(r => r.json()) });
  const partnerMaster = Array.isArray(partnerMasterData) ? partnerMasterData : [];
  const { data: companyMasterData } = useQuery({ queryKey: ['/api/master-data/companies'], queryFn: () => fetch('/api/master-data/companies', { credentials: "include" }).then(r => r.json()) });
  const companyMaster = Array.isArray(companyMasterData) ? companyMasterData : (companyMasterData?.data || []);
  const { data: roleCatalog } = useQuery<any>({ queryKey: ['/api/party-roles/catalog'], queryFn: () => fetch('/api/party-roles/catalog', { credentials: 'include' }).then(r => r.json()) });
  const { data: requiredRoles } = useQuery<any>({ queryKey: ['/api/contracts', contractId, 'required-roles'], queryFn: () => fetch(`/api/contracts/${contractId}/required-roles`, { credentials: 'include' }).then(r => r.json()) });
  const allRoles: any[] = roleCatalog?.all || [];
  const roleLabel = (code?: string) => allRoles.find(r => r.role === code)?.label || code || '—';
  const roleCategory = (code?: string) => allRoles.find(r => r.role === code)?.category || null;
  const roleChipClass = (code?: string) => roleCategory(code) === 'financial'
    ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
    : roleCategory(code) === 'operational'
      ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300'
      : 'bg-muted text-muted-foreground';
  const linkBadge = (status?: string) => {
    const s = (status || 'unlinked').toLowerCase();
    if (s === 'verified') return <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Verified</Badge>;
    if (s === 'manual') return <Badge variant="outline" className="text-[10px]">Manual</Badge>;
    if (s === 'suggested') return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">Suggested</Badge>;
    return <Badge variant="destructive" className="text-[10px]">Unlinked</Badge>;
  };

  const startEdit = (p: any) => {
    const aId = p.assignment_id || p.assignmentId;
    const kind = p.party_kind || p.partyKind || (p.company_id ? 'organization' : 'partner');
    // The Select uses partner_name as its value, but stored partnerId may be a UUID — resolve back to name
    const rawPartnerId = p.partner_id || p.partnerId || '';
    const matchedPartner = kind === 'partner'
      ? partnerMaster.find((m: any) => m.partner_id === rawPartnerId || m.id === rawPartnerId || m.partner_name === rawPartnerId)
      : null;
    const partnerSelectValue = kind === 'partner'
      ? (matchedPartner?.partner_name || p.resolved_name || p.partner_name || rawPartnerId || '')
      : '';
    setEditingPartnerId(aId);
    setEditForm({
      assignmentId: aId,
      partyKind: kind,
      partnerId: partnerSelectValue,
      companyId: p.company_id || p.companyId || '',
      partyRole: p.party_role || p.partyRole || '',
      partyRoles: [p.party_role || p.partyRole].filter(Boolean) as string[],
      assignmentType: p.assignment_type || p.assignmentType || '',
      isPrimary: p.is_primary ?? p.isPrimary ?? false,
      effectiveStart: p.effective_start || p.effectiveStart || '',
      effectiveEnd: p.effective_end || p.effectiveEnd || '',
      status: p.status || 'active',
      customTerms: p.custom_terms ?? p.customTerms ?? false,
      notes: p.notes || '',
      // Seed rawValue for AI suggestions: prefer raw extracted text, then resolved/displayed name
      rawValue: p.raw_value || p.rawValue || p.resolved_name || p.partner_name || (kind === 'organization' ? (p.company_name || '') : rawPartnerId) || '',
    });
    setAddingNew(false);
  };
  const cancelEdit = () => { setEditingPartnerId(null); setEditForm({}); };
  const startAdd = () => { setAddingNew(true); setEditingPartnerId(null); setNewForm({ partyKind: 'partner', partnerId: '', companyId: '', partyRole: '', partyRoles: [], isPrimary: false, status: 'active', customTerms: false, notes: '' }); };
  const cancelAdd = () => { setAddingNew(false); setNewForm({}); };

  const updatePartnerMutation = useMutation({
    mutationFn: async (data: any) => {
      const roles: string[] = Array.isArray(data.partyRoles) && data.partyRoles.length > 0
        ? data.partyRoles
        : (data.partyRole ? [data.partyRole] : []);
      const primaryRole = roles[0] || data.partyRole || null;
      // Update the existing row to its primary role
      await apiRequest("PUT", `/api/contract-partners/${data.assignmentId}`, { ...data, partyRole: primaryRole });
      // Append new rows for any additional roles selected on the same party
      const extraRoles = roles.slice(1);
      for (const role of extraRoles) {
        await apiRequest("POST", `/api/contracts/${contractId}/partners`, {
          partyKind: data.partyKind,
          partnerId: data.partnerId || null,
          companyId: data.companyId || null,
          partyRole: role,
          isPrimary: false,
          effectiveStart: data.effectiveStart || null,
          effectiveEnd: data.effectiveEnd || null,
          status: data.status || 'active',
          notes: data.notes || null,
          rawValue: data.rawValue || null,
        });
      }
      return { roles: roles.length };
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'partners'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'required-roles'] });
      cancelEdit();
      toast({ title: r.roles > 1 ? `Updated and added ${r.roles - 1} more role(s)` : "Partner assignment updated" });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const addPartnerMutation = useMutation({
    mutationFn: async (data: any) => {
      const roles: string[] = Array.isArray(data.partyRoles) && data.partyRoles.length > 0
        ? data.partyRoles
        : (data.partyRole ? [data.partyRole] : []);
      if (roles.length === 0) {
        throw new Error("Pick at least one role for this party.");
      }
      // Create one assignment row per selected role; first role is primary
      let createdCount = 0;
      for (let i = 0; i < roles.length; i++) {
        await apiRequest("POST", `/api/contracts/${contractId}/partners`, {
          partyKind: data.partyKind,
          partnerId: data.partnerId || null,
          companyId: data.companyId || null,
          partyRole: roles[i],
          isPrimary: i === 0 ? !!data.isPrimary : false,
          effectiveStart: data.effectiveStart || null,
          effectiveEnd: data.effectiveEnd || null,
          status: data.status || 'active',
          notes: data.notes || null,
          rawValue: data.rawValue || null,
        });
        createdCount++;
      }
      return { createdCount };
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'partners'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'required-roles'] });
      cancelAdd();
      toast({ title: r.createdCount > 1 ? `Added party with ${r.createdCount} roles` : "Partner added" });
    },
    onError: (err: any) => toast({ title: "Add failed", description: err.message, variant: "destructive" }),
  });

  const deletePartnerMutation = useMutation({
    mutationFn: (assignId: string) => apiRequest("DELETE", `/api/contract-partners/${assignId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'partners'] });
      toast({ title: "Partner removed" });
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  if (!hasMaster) {
    return (
      <Card className="shadow-md" data-testid="card-partners-empty">
        <CardContent className="p-8 text-center">
          {isAutoGenerating ? (
            <>
              <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Generating Structured Data...</h3>
              <p className="text-muted-foreground" data-testid="text-partners-generating">Extracting terms, qualifiers, and partners from contract analysis</p>
            </>
          ) : (
            <>
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Structured Data Available</h3>
              <p className="text-muted-foreground" data-testid="text-partners-info">Structured data is automatically generated when the contract is analyzed</p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  }

  const renderPartnerInlineEdit = (form: any, setField: (f: string, v: any) => void, onSave: () => void, onCancel: () => void, isPending: boolean, isNew: boolean, rowKey?: string) => {
    const kind = form.partyKind || 'partner';
    const formatDate = (d: any) => {
      if (!d) return '';
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
    };
    return (
    <TableRow key={rowKey || (isNew ? 'partner-add-form' : `partner-edit-${form.assignmentId}`)} className="bg-muted/30" data-testid={isNew ? "row-partner-add-form" : `row-partner-edit-${form.assignmentId}`}>
      <TableCell colSpan={7} className="p-4">
        <div className="grid grid-cols-6 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Party Kind</Label>
            <Select value={kind} onValueChange={v => { setField('partyKind', v); setField(v === 'partner' ? 'companyId' : 'partnerId', ''); }}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-party-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="partner">External Partner</SelectItem>
                <SelectItem value="organization">Internal Organization</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Party</Label>
            {kind === 'partner' ? (
              <PartySearchPicker
                placeholder="Search partner master…"
                emptyText="No matching partner. Type to search master data."
                value={form.partnerId || ''}
                rawValue={form.rawValue || form.partnerId || ''}
                linkTarget="partner"
                options={partnerMaster.map((p: any) => ({
                  id: p.partner_id || p.id,
                  value: p.partner_name,
                  label: p.partner_name,
                  hint: p.partner_type || '',
                }))}
                onSelect={(opt) => setField('partnerId', opt?.value || '')}
                onClear={() => setField('partnerId', '')}
                testId="picker-partner-id"
              />
            ) : (
              <PartySearchPicker
                placeholder="Search organization master…"
                emptyText="No matching organization. Type to search master data."
                value={form.companyId || ''}
                rawValue={form.rawValue || ''}
                linkTarget="company"
                options={companyMaster.map((c: any) => ({
                  id: c.id,
                  value: c.id,
                  label: c.companyName || c.company_name || c.name,
                  hint: '',
                }))}
                onSelect={(opt) => setField('companyId', opt?.value || '')}
                onClear={() => setField('companyId', '')}
                testId="picker-company-id"
              />
            )}
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Roles {isNew ? '(pick one or more — same party can play multiple roles)' : '(adding more roles creates additional rows for this party)'}
            </Label>
            {(() => {
              const selected: string[] = Array.isArray(form.partyRoles) ? form.partyRoles : (form.partyRole ? [form.partyRole] : []);
              const toggle = (roleCode: string) => {
                const next = selected.includes(roleCode) ? selected.filter(r => r !== roleCode) : [...selected, roleCode];
                setField('partyRoles', next);
                setField('partyRole', next[0] || '');
              };
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-auto min-h-8 w-full justify-between text-sm font-normal py-1" data-testid="select-party-roles">
                      <div className="flex flex-wrap gap-1 items-center">
                        {selected.length === 0 && <span className="text-muted-foreground">Select role(s)…</span>}
                        {selected.map(rc => (
                          <Badge key={rc} variant="outline" className={`text-[10px] ${roleChipClass(rc)}`}>{roleLabel(rc)}</Badge>
                        ))}
                      </div>
                      <ChevronDown className="h-3 w-3 opacity-60 shrink-0 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="start">
                    <div className="space-y-2">
                      <div>
                        <div className="px-1 pb-1 text-[10px] uppercase font-semibold text-blue-700 dark:text-blue-300">Financial</div>
                        {(roleCatalog?.categories?.financial || []).map((r: any) => (
                          <label key={r.role} className="flex items-center gap-2 px-1 py-1 hover:bg-muted rounded cursor-pointer text-sm" data-testid={`checkbox-role-${r.role}`}>
                            <Checkbox checked={selected.includes(r.role)} onCheckedChange={() => toggle(r.role)} />
                            <span>{r.label}</span>
                          </label>
                        ))}
                      </div>
                      <div>
                        <div className="px-1 pb-1 text-[10px] uppercase font-semibold text-purple-700 dark:text-purple-300">Operational</div>
                        {(roleCatalog?.categories?.operational || []).map((r: any) => (
                          <label key={r.role} className="flex items-center gap-2 px-1 py-1 hover:bg-muted rounded cursor-pointer text-sm" data-testid={`checkbox-role-${r.role}`}>
                            <Checkbox checked={selected.includes(r.role)} onCheckedChange={() => toggle(r.role)} />
                            <span>{r.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })()}
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch checked={!!form.isPrimary} onCheckedChange={v => setField('isPrimary', v)} data-testid="switch-is-primary" />
            <Label className="text-xs">Primary</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Effective Start</Label>
            <Input type="date" value={formatDate(form.effectiveStart)} onChange={e => setField('effectiveStart', e.target.value)} className="h-8 text-sm" data-testid="input-effective-start" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Effective End</Label>
            <Input type="date" value={formatDate(form.effectiveEnd)} onChange={e => setField('effectiveEnd', e.target.value)} className="h-8 text-sm" data-testid="input-effective-end" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <Select value={form.status || ''} onValueChange={v => setField('status', v)}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-partner-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-3">
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Input value={form.notes || ''} onChange={e => setField('notes', e.target.value)} className="h-8 text-sm" data-testid="input-partner-notes" />
          </div>
          <div className="col-span-6 flex items-center justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={onCancel} className="h-8" data-testid="button-cancel-partner"><X className="h-3 w-3 mr-1" /> Cancel</Button>
            <Button size="sm" onClick={onSave} disabled={isPending} className="h-8" data-testid="button-save-partner">
              {isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
    );
  };

  return (
    <Card className="shadow-md" data-testid="card-partners-table">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/50 border-b">
        <div>
          <CardTitle className="text-xl">Party Assignments</CardTitle>
          <CardDescription>{partners.length} party assignment(s) — used downstream by calculations, accruals, journal entries and settlement.</CardDescription>
        </div>
        <Button size="sm" onClick={startAdd} disabled={addingNew} data-testid="button-add-partner">
          <Plus className="h-4 w-4 mr-1" /> Add Party
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        {requiredRoles?.slots?.length ? (
          <div className="mb-4 rounded-md border bg-muted/30 p-3" data-testid="banner-required-roles">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required Roles for this Contract Type</div>
              <div className="text-xs text-muted-foreground">{(requiredRoles.slots.filter((s: any) => s.required).length - (requiredRoles.missing?.length || 0))} / {requiredRoles.slots.filter((s: any) => s.required).length} filled</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {requiredRoles.slots.map((s: any) => {
                const isFilled = !(requiredRoles.missing || []).includes(s.role);
                const filledClass = isFilled ? 'bg-green-100 text-green-800 border-green-200' : (s.required ? 'bg-red-50 text-red-700 border-red-200' : 'bg-muted text-muted-foreground');
                return (
                  <Badge key={s.role} variant="outline" className={`text-[11px] ${filledClass}`} data-testid={`chip-required-role-${s.role}`}>
                    {isFilled ? '✓ ' : (s.required ? '○ ' : '· ')}{roleLabel(s.role)}{s.required && !isFilled ? ' (required)' : ''}
                  </Badge>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Party</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Primary</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addingNew && renderPartnerInlineEdit(
                newForm,
                (f, v) => setNewForm((p: any) => ({ ...p, [f]: v })),
                () => addPartnerMutation.mutate(newForm),
                cancelAdd,
                addPartnerMutation.isPending,
                true
              )}
              {partners.map((p: any) => {
                const aId = p.assignment_id || p.assignmentId;
                const isEditing = editingPartnerId === aId;
                const kind = p.party_kind || p.partyKind || (p.company_id ? 'organization' : 'partner');
                const role = p.party_role || p.partyRole;
                const effStart = p.effective_start || p.effectiveStart;
                const effEnd = p.effective_end || p.effectiveEnd;
                const isPrimary = p.is_primary ?? p.isPrimary;
                const fmt = (d: any) => d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';
                return isEditing ? renderPartnerInlineEdit(
                  editForm,
                  (f, v) => setEditForm((prev: any) => ({ ...prev, [f]: v })),
                  () => updatePartnerMutation.mutate({ ...editForm, assignmentId: aId }),
                  cancelEdit,
                  updatePartnerMutation.isPending,
                  false
                ) : (
                  <TableRow key={aId} data-testid={`row-partner-${aId}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span data-testid={`text-party-name-${aId}`}>{p.resolved_name || p.partner_name || p.partner_id || p.raw_value || '—'}</span>
                        {linkBadge(p.link_status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{kind === 'organization' ? 'Internal' : 'External'}</Badge>
                    </TableCell>
                    <TableCell>
                      {role ? (
                        <Badge variant="outline" className={`text-[11px] ${roleChipClass(role)}`} data-testid={`badge-role-${aId}`}>{roleLabel(role)}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmt(effStart)}{effStart || effEnd ? ' → ' : ''}{effEnd ? fmt(effEnd) : (effStart ? 'open' : '')}</TableCell>
                    <TableCell>
                      {isPrimary ? <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">Primary</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-xs">{p.notes || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(p)} data-testid={`button-edit-partner-${aId}`}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-delete-partner-${aId}`}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Party Assignment</AlertDialogTitle>
                              <AlertDialogDescription>Remove <strong>{p.resolved_name || p.partner_name || 'this party'}</strong> as <strong>{roleLabel(role)}</strong>? This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deletePartnerMutation.mutate(aId)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {partners.length === 0 && !addingNew && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="space-y-3">
                      <p className="text-muted-foreground">No partners assigned yet</p>
                      <GenerateSampleButton contractId={contractId} tabType="partners" label="Sample Partners" onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'partners'] })} />
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ContractPoliciesTab({ contractId, contract }: { contractId: string; contract: any }) {
  const { toast } = useToast();
  const [policySection, setPolicySection] = useState('financial-policies');
  const [policyForm, setPolicyForm] = useState<Record<string, any>>({
    financialPolicies: contract?.financialPolicies || {},
    periodPolicies: contract?.periodPolicies || {},
    datasetPolicies: contract?.datasetPolicies || {},
    settlementPolicies: contract?.settlementPolicies || {},
  });

  useEffect(() => {
    if (contract) {
      setPolicyForm({
        financialPolicies: contract.financialPolicies || {},
        periodPolicies: contract.periodPolicies || {},
        datasetPolicies: contract.datasetPolicies || {},
        settlementPolicies: contract.settlementPolicies || {},
      });
    }
  }, [contract]);

  const { data: companySettings } = useQuery<any>({ queryKey: ['/api/settings/company'] });
  const { data: contractTypes } = useQuery<any[]>({ queryKey: ['/api/contract-types'] });

  const contractType = contractTypes?.find((t: any) => t.code === contract?.contractType);

  const getInheritedValue = (policyKey: string, field: string, defaultValue: any) => {
    const typePol = contractType?.[policyKey];
    if (typePol && field in typePol) return { value: typePol[field], source: contractType?.name || 'Contract Type' };
    const compPol = companySettings?.[policyKey];
    if (compPol && field in compPol) return { value: compPol[field], source: 'Company' };
    return { value: defaultValue, source: 'System Default' };
  };

  const getEffectiveValue = (policyKey: string, field: string, defaultValue: any) => {
    const formVal = policyForm?.[policyKey];
    if (formVal && field in formVal) return formVal[field];
    return getInheritedValue(policyKey, field, defaultValue).value;
  };

  const isOverridden = (policyKey: string, field: string) => {
    const formVal = policyForm?.[policyKey];
    return formVal && field in formVal;
  };

  const handleChange = (policyKey: string, field: string, value: any) => {
    const current = policyForm?.[policyKey] || {};
    setPolicyForm(prev => ({ ...prev, [policyKey]: { ...current, [field]: value } }));
  };

  const clearOverride = (policyKey: string, field: string) => {
    const current = { ...(policyForm?.[policyKey] || {}) };
    delete current[field];
    setPolicyForm(prev => ({ ...prev, [policyKey]: current }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('PATCH', `/api/contracts/${contractId}`, policyForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}`] });
      toast({ title: "Saved", description: "Contract policies have been updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save policies", variant: "destructive" });
    },
  });

  const PolicyField = ({ label, policyKey, field, defaultValue, children }: {
    label: string; policyKey: string; field: string; defaultValue: any; children: React.ReactNode;
  }) => {
    const inherited = getInheritedValue(policyKey, field, defaultValue);
    const overridden = isOverridden(policyKey, field);
    return (
      <div className="space-y-1.5" data-testid={`contract-policy-${policyKey}-${field}`}>
        <div className="flex items-center justify-between">
          <Label className="text-sm">{label}</Label>
          <div className="flex items-center gap-2">
            {overridden ? (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] px-1.5 py-0">Overridden</Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted" onClick={() => clearOverride(policyKey, field)}>
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">Revert to inherited value</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                Inherited from {inherited.source}: <strong>{String(inherited.value)}</strong>
              </span>
            )}
          </div>
        </div>
        {children}
      </div>
    );
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-muted/50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Settings className="w-5 h-5" />
              Configuration Policies
            </CardTitle>
            <CardDescription className="mt-1">
              Override inherited policies for this specific contract. Values cascade: Company → Contract Type → Contract.
            </CardDescription>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-contract-policies">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Policies
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-50 dark:bg-green-950/20 mb-6" data-testid="banner-inheritance-contract">
          <Layers className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium">Contract Level (Overrides All)</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><Info className="w-4 h-4 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  <strong>3-Tier Inheritance:</strong> Company → Contract Type ({contractType?.name || 'None'}) → This Contract
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex gap-6">
          <div className="w-48 shrink-0 space-y-1">
            {[
              { key: 'financial-policies', label: 'Financial Policies', icon: DollarSign },
              { key: 'period-management', label: 'Period Management', icon: Calendar },
              { key: 'dataset-control', label: 'Dataset Control', icon: Database },
              { key: 'settlement-payment', label: 'Settlement & Payment', icon: CreditCard },
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setPolicySection(item.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                    policySection === item.key
                      ? 'bg-orange-50 text-orange-700 font-medium border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  data-testid={`contract-policy-tab-${item.key}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-0 space-y-5">
            {policySection === 'financial-policies' && (
              <>
                <PolicyField label="Cutoff Policy" policyKey="financialPolicies" field="cutoffPolicy" defaultValue="period_end">
                  <Select value={getEffectiveValue('financialPolicies', 'cutoffPolicy', 'period_end')} onValueChange={v => handleChange('financialPolicies', 'cutoffPolicy', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="period_end">Period End</SelectItem>
                      <SelectItem value="transaction_date">Transaction Date</SelectItem>
                      <SelectItem value="invoice_date">Invoice Date</SelectItem>
                      <SelectItem value="ship_date">Ship Date</SelectItem>
                    </SelectContent>
                  </Select>
                </PolicyField>
                <PolicyField label="Rounding Method" policyKey="financialPolicies" field="roundingMethod" defaultValue="round_half_up">
                  <Select value={getEffectiveValue('financialPolicies', 'roundingMethod', 'round_half_up')} onValueChange={v => handleChange('financialPolicies', 'roundingMethod', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round_half_up">Round Half Up</SelectItem>
                      <SelectItem value="round_half_down">Round Half Down</SelectItem>
                      <SelectItem value="round_down">Round Down</SelectItem>
                      <SelectItem value="round_up">Round Up</SelectItem>
                      <SelectItem value="bankers_rounding">Banker's Rounding</SelectItem>
                    </SelectContent>
                  </Select>
                </PolicyField>
                <PolicyField label="Accrual Mode" policyKey="financialPolicies" field="accrualMode" defaultValue="automatic">
                  <Select value={getEffectiveValue('financialPolicies', 'accrualMode', 'automatic')} onValueChange={v => handleChange('financialPolicies', 'accrualMode', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatic">Automatic</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="semi_automatic">Semi-Automatic</SelectItem>
                    </SelectContent>
                  </Select>
                </PolicyField>
                {/* Payment Mode field hidden - can be restored when needed
                <PolicyField label="Payment Mode" policyKey="financialPolicies" field="paymentMode" defaultValue="net">
                  <Select value={getEffectiveValue('financialPolicies', 'paymentMode', 'net')} onValueChange={v => handleChange('financialPolicies', 'paymentMode', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="net">Net Settlement</SelectItem>
                      <SelectItem value="gross">Gross Payment</SelectItem>
                      <SelectItem value="credit_memo">Credit Memo</SelectItem>
                    </SelectContent>
                  </Select>
                </PolicyField>
                */}
                <PolicyField label="FX Method" policyKey="financialPolicies" field="fxMethod" defaultValue="spot_rate">
                  <Select value={getEffectiveValue('financialPolicies', 'fxMethod', 'spot_rate')} onValueChange={v => handleChange('financialPolicies', 'fxMethod', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spot_rate">Spot Rate</SelectItem>
                      <SelectItem value="average_rate">Average Rate</SelectItem>
                      <SelectItem value="fixed_rate">Fixed Contract Rate</SelectItem>
                      <SelectItem value="month_end_rate">Month-End Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </PolicyField>
              </>
            )}

            {policySection === 'period-management' && (
              <>
                <PolicyField label="Period Frequency" policyKey="periodPolicies" field="periodFrequency" defaultValue="monthly">
                  <Select value={getEffectiveValue('periodPolicies', 'periodFrequency', 'monthly')} onValueChange={v => handleChange('periodPolicies', 'periodFrequency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </PolicyField>
                <PolicyField label="Period Naming" policyKey="periodPolicies" field="periodNaming" defaultValue="calendar">
                  <Select value={getEffectiveValue('periodPolicies', 'periodNaming', 'calendar')} onValueChange={v => handleChange('periodPolicies', 'periodNaming', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendar">Calendar (Jan, Feb, ...)</SelectItem>
                      <SelectItem value="fiscal">Fiscal (P1, P2, ...)</SelectItem>
                      <SelectItem value="quarter">Quarter (Q1, Q2, ...)</SelectItem>
                    </SelectContent>
                  </Select>
                </PolicyField>
              </>
            )}

            {policySection === 'dataset-control' && (
              <>
                <PolicyField label="Completeness Threshold (%)" policyKey="datasetPolicies" field="completenessThreshold" defaultValue={95}>
                  <Input type="number" min={0} max={100}
                    value={getEffectiveValue('datasetPolicies', 'completenessThreshold', 95)}
                    onChange={e => handleChange('datasetPolicies', 'completenessThreshold', parseInt(e.target.value) || 95)}
                    data-testid="input-completeness-threshold"
                  />
                </PolicyField>
                <PolicyField label="Data Retention (Months)" policyKey="datasetPolicies" field="dataRetentionMonths" defaultValue={84}>
                  <Input type="number" min={1} max={120}
                    value={getEffectiveValue('datasetPolicies', 'dataRetentionMonths', 84)}
                    onChange={e => handleChange('datasetPolicies', 'dataRetentionMonths', parseInt(e.target.value) || 84)}
                    data-testid="input-data-retention"
                  />
                </PolicyField>
              </>
            )}

            {policySection === 'settlement-payment' && (
              <>
                <PolicyField label="Payment Frequency" policyKey="settlementPolicies" field="defaultPaymentFrequency" defaultValue="monthly">
                  <Select value={getEffectiveValue('settlementPolicies', 'defaultPaymentFrequency', 'monthly')} onValueChange={v => handleChange('settlementPolicies', 'defaultPaymentFrequency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="on_demand">On Demand</SelectItem>
                    </SelectContent>
                  </Select>
                </PolicyField>
                <PolicyField label="Payment Terms (Days)" policyKey="settlementPolicies" field="paymentTermsDays" defaultValue={30}>
                  <Input type="number" min={0} max={365}
                    value={getEffectiveValue('settlementPolicies', 'paymentTermsDays', 30)}
                    onChange={e => handleChange('settlementPolicies', 'paymentTermsDays', parseInt(e.target.value) || 30)}
                    data-testid="input-payment-terms"
                  />
                </PolicyField>
                <PolicyField label="Settlement Method" policyKey="settlementPolicies" field="settlementMethod" defaultValue="check">
                  <Select value={getEffectiveValue('settlementPolicies', 'settlementMethod', 'check')} onValueChange={v => handleChange('settlementPolicies', 'settlementMethod', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="ach">ACH / Bank Transfer</SelectItem>
                      <SelectItem value="wire">Wire Transfer</SelectItem>
                      <SelectItem value="credit_memo">Credit Memo / Offset</SelectItem>
                      <SelectItem value="eft">EFT</SelectItem>
                    </SelectContent>
                  </Select>
                </PolicyField>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
