import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  Calendar,
  Send,
  Loader2,
  X,
  Paperclip,
  ShieldCheck,
  UserCheck,
  Rocket,
  MessageSquare,
  ChevronRight,
  RefreshCw,
  Eye,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Download,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Users,
  Clock,
  FileText,
  KeyRound,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, isAfter, startOfDay, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface EarlyAccessSignup {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  notes: string | null;
  verificationData: any | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

interface DemoRequest {
  id: string;
  email: string;
  planTier: string;
  status: string;
  notes: string | null;
  verificationData: any | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

type Lead = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  position?: string | null;
  phone?: string | null;
  status: string;
  notes: string | null;
  verificationData: any | null;
  verifiedAt: Date | null;
  activityLog: any[] | null;
  createdAt: Date;
  type: "early_access" | "demo_request";
  planTier?: string;
};

interface FieldsState {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}

type SortField = "name" | "email" | "company" | "status" | "type" | "createdAt";
type SortDir = "asc" | "desc";
type PanelType = "verification" | "workspace" | "followup" | "compose" | "status" | "preview" | "notes" | "create_account" | "reset_password" | null;

const PIPELINE_STAGES = [
  { key: "new", label: "New", icon: Mail, color: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-300", bgLight: "bg-blue-50 dark:bg-blue-950" },
  { key: "verification_sent", label: "Verification Sent", icon: ShieldCheck, color: "bg-orange-500", textColor: "text-orange-700 dark:text-orange-300", bgLight: "bg-orange-50 dark:bg-orange-950" },
  { key: "verified", label: "Verified", icon: UserCheck, color: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-300", bgLight: "bg-emerald-50 dark:bg-emerald-950" },
  { key: "contacted", label: "Contacted", icon: MessageSquare, color: "bg-purple-500", textColor: "text-purple-700 dark:text-purple-300", bgLight: "bg-purple-50 dark:bg-purple-950" },
  { key: "converted", label: "Account Created", icon: Rocket, color: "bg-green-500", textColor: "text-green-700 dark:text-green-300", bgLight: "bg-green-50 dark:bg-green-950" },
];

const DATE_PRESETS = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
];

const PAGE_SIZES = [10, 25, 50, 100];

function getStage(status: string) {
  return PIPELINE_STAGES.find((s) => s.key === status) || PIPELINE_STAGES[0];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function StatusBadge({ status }: { status: string }) {
  const stage = getStage(status);
  return (
    <Badge variant="outline" className={`${stage.bgLight} ${stage.textColor} border-0 text-xs`}>
      <stage.icon className="h-3 w-3 mr-1" />
      {stage.label}
    </Badge>
  );
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-slate-400" />;
  return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-orange-600" /> : <ArrowDown className="h-3.5 w-3.5 ml-1 text-orange-600" />;
}

export default function AdminLeads() {
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [panelLead, setPanelLead] = useState<Lead | null>(null);

  const [workspaceFields, setWorkspaceFields] = useState({ loginUrl: "https://www.licenseiq.ai", tempPassword: "" });
  const [followupFields, setFollowupFields] = useState({ senderName: "", senderTitle: "", senderEmail: "", senderPhone: "" });
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [accountWizardStep, setAccountWizardStep] = useState(1);
  const [accountFields, setAccountFields] = useState({ companyName: "", userEmail: "", firstName: "", lastName: "", tempPassword: "", role: "admin", sourceCompanyId: "" });
  const [resetPasswordField, setResetPasswordField] = useState("");

  const [previewState, setPreviewState] = useState<{
    actionType: "verification" | "workspace" | "followup";
    subject: string; html: string; loading: boolean;
  }>({ actionType: "verification", subject: "", html: "", loading: false });

  const [fields, setFields] = useState<FieldsState>({ to: "", cc: "", bcc: "", subject: "", body: "" });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  

  const [deleteConfirm, setDeleteConfirm] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editContactFields, setEditContactFields] = useState({ name: "", company: "", position: "", phone: "" });

  const { data: earlyAccessSignups, isLoading: loadingEarlyAccess } = useQuery<EarlyAccessSignup[]>({
    queryKey: ["/api/admin/early-access-signups"],
  });
  const { data: demoRequests, isLoading: loadingDemos } = useQuery<DemoRequest[]>({
    queryKey: ["/api/admin/demo-requests"],
  });
  const { data: mailConfig } = useQuery<{ fromEmail: string; fromName: string }>({
    queryKey: ["/api/admin/mail-config"],
  });
  const { data: lookupCompanies } = useQuery<{ id: string; company_name: string }[]>({
    queryKey: ["/api/lookup/companies"],
  });

  const allLeads: Lead[] = useMemo(() => [
    ...(earlyAccessSignups || []).map((s: any) => ({
      id: s.id, email: s.email, name: s.name, company: s.company,
      status: s.status || "new", notes: s.notes, verificationData: s.verificationData, verifiedAt: s.verifiedAt,
      activityLog: s.activityLog || [],
      createdAt: s.createdAt, type: "early_access" as const,
    })),
    ...(demoRequests || []).map((r: any) => ({
      id: r.id, email: r.email, name: r.name || null, company: r.company || null,
      position: r.position || null, phone: r.phone || null,
      status: r.status || "new", notes: r.notes, verificationData: r.verificationData, verifiedAt: r.verifiedAt,
      activityLog: r.activityLog || [],
      createdAt: r.createdAt, type: "demo_request" as const, planTier: r.planTier,
    })),
  ], [earlyAccessSignups, demoRequests]);

  const filteredAndSortedLeads = useMemo(() => {
    let results = [...allLeads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter((l) =>
        (l.name || "").toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.company || "").toLowerCase().includes(q) ||
        (l.notes || "").toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") results = results.filter((l) => l.status === filterStatus);
    if (filterType !== "all") results = results.filter((l) => l.type === filterType);
    if (datePreset !== "all") {
      const now = new Date();
      let cutoff: Date;
      switch (datePreset) {
        case "today": cutoff = startOfDay(now); break;
        case "7d": cutoff = subDays(now, 7); break;
        case "30d": cutoff = subDays(now, 30); break;
        case "90d": cutoff = subDays(now, 90); break;
        default: cutoff = new Date(0);
      }
      results = results.filter((l) => isAfter(new Date(l.createdAt), cutoff));
    }
    results.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = (a.name || a.email).localeCompare(b.name || b.email); break;
        case "email": cmp = a.email.localeCompare(b.email); break;
        case "company": cmp = (a.company || "").localeCompare(b.company || ""); break;
        case "status": {
          const ai = PIPELINE_STAGES.findIndex((s) => s.key === a.status);
          const bi = PIPELINE_STAGES.findIndex((s) => s.key === b.status);
          cmp = ai - bi; break;
        }
        case "type": cmp = a.type.localeCompare(b.type); break;
        case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return results;
  }, [allLeads, searchQuery, filterStatus, filterType, datePreset, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedLeads.length / pageSize));
  const paginatedLeads = filteredAndSortedLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const stageCounts = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: allLeads.filter((l) => l.status === stage.key).length,
  }));

  const activeFilterCount = [filterStatus !== "all", filterType !== "all", datePreset !== "all", searchQuery.trim().length > 0].filter(Boolean).length;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir(field === "createdAt" ? "desc" : "asc"); }
    setCurrentPage(1);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedLeads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginatedLeads.map((l) => `${l.type}-${l.id}`)));
  };

  const toggleSelect = (lead: Lead) => {
    const key = `${lead.type}-${lead.id}`;
    const next = new Set(selectedIds);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedIds(next);
  };

  const clearAllFilters = () => { setSearchQuery(""); setFilterStatus("all"); setFilterType("all"); setDatePreset("all"); setCurrentPage(1); };

  const exportCsv = () => {
    const headers = ["Name", "Email", "Company", "Type", "Status", "Date", "Notes"];
    const rows = filteredAndSortedLeads.map((l) => [
      l.name || "", l.email, l.company || "",
      l.type === "early_access" ? "Early Access" : `Demo - ${l.planTier || ""}`,
      getStage(l.status).label,
      format(new Date(l.createdAt), "MM/dd/yyyy hh:mm a"),
      (l.notes || "").replace(/"/g, '""'),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads_export_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${filteredAndSortedLeads.length} leads exported to CSV` });
  };

  const openPanel = (type: PanelType, lead: Lead) => {
    setActivePanel(type);
    setPanelLead(lead);
  };

  const closePanel = () => { setActivePanel(null); setPanelLead(null); };

  const verificationMutation = useMutation({
    mutationFn: async (lead: Lead) => {
      const res = await apiRequest("POST", "/api/admin/send-verification", {
        email: lead.email, name: lead.name || lead.email, company: lead.company || "",
        leadId: lead.id, leadType: lead.type,
      });
      return res.json();
    },
    onSuccess: (_, lead) => {
      toast({ title: "Verification Sent", description: `Verification email sent to ${lead.email}` });
      closePanel();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/early-access-signups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message || "Failed to send verification email", variant: "destructive" });
    },
  });

  const workspaceMutation = useMutation({
    mutationFn: async ({ lead, loginUrl, tempPassword }: { lead: Lead; loginUrl: string; tempPassword: string }) => {
      const res = await apiRequest("POST", "/api/admin/send-workspace-ready", {
        email: lead.email, name: lead.name || lead.email, company: lead.company || "",
        loginUrl, tempPassword, leadId: lead.id, leadType: lead.type,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Workspace Ready Email Sent", description: "Login credentials sent to the customer." });
      closePanel();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/early-access-signups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
    },
    onError: (err: any) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const followupMutation = useMutation({
    mutationFn: async ({ lead, ...sender }: { lead: Lead; senderName: string; senderTitle: string; senderEmail: string; senderPhone: string }) => {
      const res = await apiRequest("POST", "/api/admin/send-followup", {
        email: lead.email, name: lead.name || lead.email, ...sender,
        leadId: lead.id, leadType: lead.type,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Follow-Up Sent", description: "Personal follow-up email sent." });
      closePanel();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/early-access-signups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
    },
    onError: (err: any) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ lead, status, notes }: { lead: Lead; status: string; notes: string }) => {
      const endpoint = lead.type === "early_access" ? `/api/admin/early-access-signups/${lead.id}` : `/api/admin/demo-requests/${lead.id}`;
      const res = await apiRequest("PATCH", endpoint, { status, notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Status Updated" });
      closePanel();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/early-access-signups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
    },
    onError: (err: any) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const notesMutation = useMutation({
    mutationFn: async ({ lead, notes, contactFields }: { lead: Lead; notes: string; contactFields?: { name: string; company: string; position: string; phone: string } }) => {
      const endpoint = lead.type === "early_access" ? `/api/admin/early-access-signups/${lead.id}` : `/api/admin/demo-requests/${lead.id}`;
      const payload: any = { notes };
      if (contactFields) {
        payload.name = contactFields.name;
        payload.company = contactFields.company;
        if (lead.type === "demo_request") {
          payload.position = contactFields.position;
          payload.phone = contactFields.phone;
        }
      }
      const res = await apiRequest("PATCH", endpoint, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Lead details have been updated." });
      closePanel();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/early-access-signups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
    },
    onError: (err: any) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const handleDeleteLead = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const endpoint = deleteConfirm.type === "early_access"
        ? `/api/admin/early-access-signups/${deleteConfirm.id}`
        : `/api/admin/demo-requests/${deleteConfirm.id}`;
      await apiRequest("DELETE", endpoint);
      toast({ title: "Lead Deleted", description: `${deleteConfirm.name || deleteConfirm.email} has been removed.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/early-access-signups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const createAccountMutation = useMutation({
    mutationFn: async (payload: { leadId: string; leadType: string; companyName: string; userEmail: string; tempPassword: string; firstName: string; lastName: string; role: string; sourceCompanyId?: string }) => {
      const res = await apiRequest("POST", "/api/admin/leads/create-account", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Account Created", description: data.message });
      closePanel();
      setAccountWizardStep(1);
      setAccountFields({ companyName: "", userEmail: "", firstName: "", lastName: "", tempPassword: "", role: "admin", sourceCompanyId: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/early-access-signups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
    },
    onError: (err: any) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (payload: { leadId: string; leadType: string; email: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/admin/leads/reset-password", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Password Reset", description: data.message });
      closePanel();
      setResetPasswordField("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/early-access-signups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
    },
    onError: (err: any) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const loadPreview = async (lead: Lead, templateKey: string, actionType: "verification" | "workspace" | "followup", extraVars?: Record<string, string>) => {
    openPanel("preview", lead);
    setPreviewState({ actionType, subject: "", html: "", loading: true });
    try {
      const variables: Record<string, string> = {
        name: lead.name || lead.email, email: lead.email, company: lead.company || "",
        year: new Date().getFullYear().toString(), ...extraVars,
      };
      const res = await apiRequest("POST", "/api/admin/preview-email-by-key", { templateKey, variables });
      const data = await res.json();
      setPreviewState((p) => ({ ...p, subject: data.subject, html: data.html, loading: false }));
    } catch (err: any) {
      toast({ title: "Preview Failed", description: err.message, variant: "destructive" });
      closePanel();
    }
  };

  const handlePreviewSend = () => {
    if (!panelLead) return;
    const lead = panelLead;
    if (previewState.actionType === "verification") verificationMutation.mutate(lead);
    else if (previewState.actionType === "workspace") workspaceMutation.mutate({ lead, ...workspaceFields });
    else if (previewState.actionType === "followup") followupMutation.mutate({ lead, ...followupFields });
  };

  const openCompose = (lead: Lead) => {
    openPanel("compose", lead);
    setFields({ to: lead.email, cc: "", bcc: "", subject: "", body: "" });
    setAttachments([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeAttachment = (index: number) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  const handleSend = async () => {
    if (!fields.to || !fields.subject) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("to", fields.to);
      if (fields.cc) formData.append("cc", fields.cc);
      if (fields.bcc) formData.append("bcc", fields.bcc);
      formData.append("subject", fields.subject);
      formData.append("body", fields.body);
      if (panelLead) {
        formData.append("leadId", panelLead.id);
        formData.append("leadType", panelLead.type);
      }
      attachments.forEach((f) => formData.append("attachments", f));
      const resp = await fetch("/api/admin/send-lead-email", { method: "POST", body: formData, credentials: "include" });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Send failed");
      toast({ title: "Email Sent", description: result.message });
      closePanel();
    } catch (err: any) {
      toast({ title: "Send Failed", description: err.message || "Failed to send email", variant: "destructive" });
    } finally { setSending(false); }
  };

  const isLoading = loadingEarlyAccess || loadingDemos;
  const panelLeadName = panelLead?.name || panelLead?.email || "";

  const renderInlinePanel = () => {
    if (!activePanel || !panelLead) return null;

    const panelHeader = (title: string, icon: React.ReactNode) => (
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">— {panelLeadName}</span>
        </div>
        <button onClick={closePanel} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" data-testid="button-close-panel">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>
    );

    const panelContent = renderPanelContent(panelHeader);
    if (!panelContent) return null;

    return (
      <div className="fixed inset-0 z-50" data-testid="panel-overlay">
        <div className="fixed inset-0 bg-black/30 transition-opacity" onClick={closePanel} data-testid="panel-backdrop" />
        <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto transition-transform" data-testid="panel-drawer">
          {panelContent}
        </div>
      </div>
    );
  };

  const renderPanelContent = (panelHeader: (title: string, icon: React.ReactNode) => React.ReactNode) => {
    if (!activePanel || !panelLead) return null;

    if (activePanel === "preview") {
      return (
        <div data-testid="panel-preview">
          {panelHeader("Email Preview", <Eye className="h-4 w-4 text-orange-600" />)}
          {previewState.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
              <span className="ml-3 text-sm text-slate-500">Loading preview...</span>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 uppercase">To:</span>
                <span className="text-sm text-slate-900 dark:text-white">{panelLead.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 uppercase">Subject:</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{previewState.subject}</span>
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white overflow-hidden" style={{ height: "400px" }}>
                <iframe srcDoc={previewState.html} className="w-full h-full border-0" title="Email Preview" data-testid="iframe-preview" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={closePanel} data-testid="button-preview-cancel">Cancel</Button>
                <Button
                  size="sm"
                  onClick={handlePreviewSend}
                  disabled={verificationMutation.isPending || workspaceMutation.isPending || followupMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  data-testid="button-preview-send"
                >
                  {(verificationMutation.isPending || workspaceMutation.isPending || followupMutation.isPending) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Confirm & Send
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activePanel === "workspace") {
      return (
        <div data-testid="panel-workspace">
          {panelHeader("Send Workspace Ready", <Rocket className="h-4 w-4 text-green-600" />)}
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">Send login credentials to <strong>{panelLeadName}</strong>. This will update their status to "Account Created".</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Login URL</label>
                <Input value={workspaceFields.loginUrl} onChange={(e) => setWorkspaceFields((p) => ({ ...p, loginUrl: e.target.value }))} placeholder="https://www.licenseiq.ai" data-testid="input-workspace-url" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Temporary Password</label>
                <Input value={workspaceFields.tempPassword} onChange={(e) => setWorkspaceFields((p) => ({ ...p, tempPassword: e.target.value }))} placeholder="Enter temporary password" data-testid="input-workspace-password" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={closePanel} data-testid="button-workspace-cancel">Cancel</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => panelLead && loadPreview(panelLead, "workspace_ready", "workspace", { loginUrl: workspaceFields.loginUrl, tempPassword: workspaceFields.tempPassword || "(provided separately)" })}
                disabled={!workspaceFields.tempPassword}
                data-testid="button-workspace-preview"
              >
                <Eye className="h-4 w-4 mr-2" /> Preview & Send
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (activePanel === "create_account") {
      const vd = panelLead.verificationData as any;
      const step = accountWizardStep;
      const af = accountFields;
      const canProceedStep1 = af.companyName.trim().length > 0;
      const canProceedStep2 = af.userEmail.includes("@") && af.tempPassword.length >= 6;
      return (
        <div data-testid="panel-create-account">
          {panelHeader("Create Account", <Rocket className="h-4 w-4 text-green-600" />)}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? "bg-orange-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500"}`}>{s}</div>
                  <span className={`text-xs font-medium ${step === s ? "text-orange-600" : "text-slate-400"}`}>{s === 1 ? "Company" : s === 2 ? "User" : "Review"}</span>
                  {s < 3 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">Create a company for <strong>{panelLeadName}</strong>. This will appear in the Enterprise Master hierarchy.</p>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Company Name *</label>
                  <Input value={af.companyName} onChange={(e) => setAccountFields((p) => ({ ...p, companyName: e.target.value }))} placeholder="e.g. Acme Corporation" data-testid="input-account-company" />
                </div>
                {vd && (
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-medium text-slate-500 uppercase tracking-wide mb-1">From Verification</p>
                    {vd.websiteUrl && <p><span className="text-slate-400">Website:</span> <span className="text-slate-700 dark:text-slate-300">{vd.websiteUrl}</span></p>}
                    {vd.jobTitle && <p><span className="text-slate-400">Role:</span> <span className="text-slate-700 dark:text-slate-300">{vd.jobTitle}</span></p>}
                    {vd.contractCount && <p><span className="text-slate-400">Contracts:</span> <span className="text-slate-700 dark:text-slate-300">{vd.contractCount}</span></p>}
                    {vd.goals && <p><span className="text-slate-400">Goals:</span> <span className="text-slate-700 dark:text-slate-300">{vd.goals}</span></p>}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={closePanel}>Cancel</Button>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={!canProceedStep1} onClick={() => setAccountWizardStep(2)} data-testid="button-account-next-1">
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">Create a user account for this company. Select their role and set login credentials.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">First Name</label>
                    <Input value={af.firstName} onChange={(e) => setAccountFields((p) => ({ ...p, firstName: e.target.value }))} placeholder="e.g. John" data-testid="input-account-firstname" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Last Name</label>
                    <Input value={af.lastName} onChange={(e) => setAccountFields((p) => ({ ...p, lastName: e.target.value }))} placeholder="e.g. Smith" data-testid="input-account-lastname" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Email * <span className="text-xs text-slate-400 font-normal">(used as login)</span></label>
                  <Input type="email" value={af.userEmail} onChange={(e) => setAccountFields((p) => ({ ...p, userEmail: e.target.value }))} placeholder="john@acmecorp.com" data-testid="input-account-email" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Temporary Password * <span className="text-xs text-slate-400 font-normal">(min 6 chars)</span></label>
                    <Input type="password" value={af.tempPassword} onChange={(e) => setAccountFields((p) => ({ ...p, tempPassword: e.target.value }))} placeholder="Enter a temporary password" data-testid="input-account-password" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Role *</label>
                    <Select value={af.role} onValueChange={(v) => setAccountFields((p) => ({ ...p, role: v }))}>
                      <SelectTrigger data-testid="select-account-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Company Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="accountant">Accountant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Copy Master Data From <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                  <Select value={af.sourceCompanyId} onValueChange={(v) => setAccountFields((p) => ({ ...p, sourceCompanyId: v }))}>
                    <SelectTrigger data-testid="select-source-company"><SelectValue placeholder="Select a company to copy data from..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {(lookupCompanies || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-between pt-1">
                  <Button variant="outline" size="sm" onClick={() => setAccountWizardStep(1)} data-testid="button-account-back-2">Back</Button>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={!canProceedStep2} onClick={() => setAccountWizardStep(3)} data-testid="button-account-next-2">
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">Review details and create the account. A welcome email with login credentials will be sent automatically.</p>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Company</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200" data-testid="text-review-company">{af.companyName}</p>
                  </div>
                  <hr className="border-slate-200 dark:border-slate-600" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Name</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300" data-testid="text-review-name">{af.firstName || af.lastName ? `${af.firstName} ${af.lastName}`.trim() : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Login (Email)</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300" data-testid="text-review-email">{af.userEmail}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Role</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300" data-testid="text-review-role">{af.role === 'admin' ? 'Company Admin' : af.role === 'editor' ? 'Editor' : af.role === 'viewer' ? 'Viewer' : af.role === 'accountant' ? 'Accountant' : 'Company Admin'}</p>
                    </div>
                  </div>
                  {af.sourceCompanyId && af.sourceCompanyId !== "none" && (
                    <>
                      <hr className="border-slate-200 dark:border-slate-600" />
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Copy Master Data From</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300" data-testid="text-review-source-company">{lookupCompanies?.find(c => c.id === af.sourceCompanyId)?.company_name || af.sourceCompanyId}</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs text-green-700 dark:text-green-300">
                  <strong>What happens next:</strong> The company will appear in Enterprise Master. The user can log in with their credentials, view their company data, and create additional users for their company.
                </div>
                <div className="flex justify-between pt-1">
                  <Button variant="outline" size="sm" onClick={() => setAccountWizardStep(2)} data-testid="button-account-back-3">Back</Button>
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    disabled={createAccountMutation.isPending}
                    onClick={() => panelLead && createAccountMutation.mutate({
                      leadId: panelLead.id,
                      leadType: panelLead.type,
                      companyName: af.companyName,
                      userEmail: af.userEmail,
                      tempPassword: af.tempPassword,
                      firstName: af.firstName,
                      lastName: af.lastName,
                      role: af.role,
                      ...(af.sourceCompanyId && af.sourceCompanyId !== "none" ? { sourceCompanyId: af.sourceCompanyId } : {}),
                    })}
                    data-testid="button-account-create"
                  >
                    {createAccountMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
                    Create Account & Send Email
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activePanel === "followup") {
      return (
        <div data-testid="panel-followup">
          {panelHeader("Send Personal Follow-Up", <MessageSquare className="h-4 w-4 text-purple-600" />)}
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">Send a personal follow-up email to <strong>{panelLeadName}</strong> from a named team member.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Your Name</label>
                <Input value={followupFields.senderName} onChange={(e) => setFollowupFields((p) => ({ ...p, senderName: e.target.value }))} placeholder="e.g. Kamal Rao" data-testid="input-followup-name" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Your Title</label>
                <Input value={followupFields.senderTitle} onChange={(e) => setFollowupFields((p) => ({ ...p, senderTitle: e.target.value }))} placeholder="e.g. Founder & CEO" data-testid="input-followup-title" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Your Email</label>
                <Input value={followupFields.senderEmail} onChange={(e) => setFollowupFields((p) => ({ ...p, senderEmail: e.target.value }))} placeholder="e.g. kamal@licenseiq.ai" data-testid="input-followup-email" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Your Phone</label>
                <Input value={followupFields.senderPhone} onChange={(e) => setFollowupFields((p) => ({ ...p, senderPhone: e.target.value }))} placeholder="e.g. +1 555-123-4567" data-testid="input-followup-phone" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={closePanel} data-testid="button-followup-cancel">Cancel</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => panelLead && loadPreview(panelLead, "personal_followup", "followup", {
                  senderName: followupFields.senderName || "LicenseIQ Team",
                  senderTitle: followupFields.senderTitle || "Account Executive",
                  senderEmail: followupFields.senderEmail || "info@licenseiq.ai",
                  senderPhone: followupFields.senderPhone || "",
                })}
                disabled={!followupFields.senderName}
                data-testid="button-followup-preview"
              >
                <Eye className="h-4 w-4 mr-2" /> Preview & Send
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (activePanel === "status") {
      return (
        <div data-testid="panel-status">
          {panelHeader("Change Lead Status", <RefreshCw className="h-4 w-4 text-slate-500" />)}
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">Update the pipeline status for <strong>{panelLeadName}</strong>.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">New Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((stage) => (
                      <SelectItem key={stage.key} value={stage.key}>{stage.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Notes (optional)</label>
                <Input value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} placeholder="Add a note about this status change..." data-testid="input-status-notes" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={closePanel} data-testid="button-status-cancel">Cancel</Button>
              <Button
                size="sm"
                onClick={() => panelLead && statusMutation.mutate({ lead: panelLead, status: newStatus, notes: statusNotes })}
                disabled={statusMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white"
                data-testid="button-status-save"
              >
                {statusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Update Status
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (activePanel === "reset_password") {
      return (
        <div data-testid="panel-reset-password">
          {panelHeader("Reset Password", <KeyRound className="h-4 w-4 text-orange-600" />)}
          <div className="p-5 space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
              <strong>Important:</strong> This will reset the password for <strong>{panelLead.email}</strong> and send them a new Workspace Ready email with the updated credentials.
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">New Temporary Password * <span className="text-xs text-slate-400 font-normal">(min 6 chars)</span></label>
              <Input type="password" value={resetPasswordField} onChange={(e) => setResetPasswordField(e.target.value)} placeholder="Enter new temporary password" data-testid="input-reset-password" />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={closePanel} data-testid="button-reset-cancel">Cancel</Button>
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={resetPasswordMutation.isPending || resetPasswordField.length < 6}
                onClick={() => panelLead && resetPasswordMutation.mutate({
                  leadId: panelLead.id,
                  leadType: panelLead.type,
                  email: panelLead.email,
                  newPassword: resetPasswordField,
                })}
                data-testid="button-reset-submit"
              >
                {resetPasswordMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                Reset & Send Email
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (activePanel === "notes") {
      const vd = panelLead.verificationData as any;
      return (
        <div data-testid="panel-notes">
          {panelHeader("Lead Details", <Paperclip className="h-4 w-4 text-orange-600" />)}
          <div className="p-5 space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-900 dark:text-white block">Contact Information</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Name</label>
                  <Input
                    value={editContactFields.name}
                    onChange={(e) => setEditContactFields(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Full name"
                    className="text-sm"
                    data-testid="input-lead-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Company</label>
                  <Input
                    value={editContactFields.company}
                    onChange={(e) => setEditContactFields(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Company name"
                    className="text-sm"
                    data-testid="input-lead-company"
                  />
                </div>
                {panelLead.type === "demo_request" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Position</label>
                      <Input
                        value={editContactFields.position}
                        onChange={(e) => setEditContactFields(prev => ({ ...prev, position: e.target.value }))}
                        placeholder="Job title / Position"
                        className="text-sm"
                        data-testid="input-lead-position"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Phone</label>
                      <Input
                        value={editContactFields.phone}
                        onChange={(e) => setEditContactFields(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Phone number"
                        className="text-sm"
                        data-testid="input-lead-phone"
                      />
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Email</label>
                <Input value={panelLead.email} disabled className="text-sm bg-slate-50 dark:bg-slate-800" />
              </div>
            </div>
            {vd && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Verification Response</span>
                  {panelLead.verifiedAt && (
                    <span className="text-xs text-slate-400">Submitted {format(new Date(panelLead.verifiedAt), "MMM d, yyyy 'at' h:mm a")}</span>
                  )}
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-2">
                  {vd.websiteUrl && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 min-w-[120px]">Website:</span>
                      <a href={vd.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline break-all">{vd.websiteUrl}</a>
                    </div>
                  )}
                  {vd.jobTitle && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 min-w-[120px]">Role / Title:</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{vd.jobTitle}</span>
                    </div>
                  )}
                  {vd.contractCount && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 min-w-[120px]">Contracts:</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{vd.contractCount}</span>
                    </div>
                  )}
                  {vd.goals && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 min-w-[120px]">Goals:</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{vd.goals}</span>
                    </div>
                  )}
                  {vd.referralSource && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 min-w-[120px]">Heard About Us:</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{vd.referralSource}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Internal Notes</label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add internal notes about this lead..."
                rows={4}
                className="text-sm"
                data-testid="textarea-lead-notes"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={closePanel} data-testid="button-notes-cancel">Cancel</Button>
              <Button
                size="sm"
                onClick={() => panelLead && notesMutation.mutate({ lead: panelLead, notes: editNotes, contactFields: editContactFields })}
                disabled={notesMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white"
                data-testid="button-notes-save"
              >
                {notesMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Details
              </Button>
            </div>

            {(() => {
              const actLog = Array.isArray(panelLead.activityLog) ? panelLead.activityLog : [];
              const sorted = [...actLog].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              const actionIcons: Record<string, string> = {
                lead_created: "📝",
                email_sent: "📧",
                status_changed: "🔄",
                verification_submitted: "✅",
                account_created: "🚀",
                password_reset: "🔑",
                notes_updated: "📋",
              };
              return (
                <div data-testid="activity-log-section">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Activity Trail</span>
                    <Badge variant="outline" className="text-xs">{sorted.length}</Badge>
                  </div>
                  {sorted.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
                      <p className="text-xs text-slate-400">No activity recorded yet. Future actions (emails, status changes, account creation) will appear here automatically.</p>
                    </div>
                  ) : (
                    <div className="space-y-0 relative">
                      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />
                      {sorted.map((entry: any, i: number) => (
                        <div key={i} className="relative flex items-start gap-3 pb-3 pl-0" data-testid={`activity-entry-${i}`}>
                          <div className="relative z-10 w-6 h-6 flex items-center justify-center text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full shrink-0">
                            {actionIcons[entry.action] || "📋"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700 dark:text-slate-300">{entry.details || entry.action}</p>
                            {entry.emailSubject && (
                              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <FileText className="h-3 w-3" /> {entry.emailSubject}
                              </p>
                            )}
                            {entry.emailPreview && (
                              <p className="text-xs text-slate-400 mt-0.5 italic truncate">{entry.emailPreview}</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {entry.timestamp ? (() => {
                                const ts = String(entry.timestamp);
                                const d = new Date(ts.endsWith("Z") || ts.includes("+") ? ts : ts + "Z");
                                return isNaN(d.getTime()) ? ts : format(d, "MMM d, yyyy 'at' h:mm a");
                              })() : "—"}
                              {entry.by && <span className="ml-1">by {entry.by}</span>}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      );
    }

    if (activePanel === "compose") {
      return (
        <div data-testid="panel-compose">
          {panelHeader("Compose Email", <Send className="h-4 w-4 text-slate-500" />)}
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From</label>
                <input type="text" readOnly value={mailConfig ? `${mailConfig.fromName} <${mailConfig.fromEmail}>` : "Loading..."} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed" data-testid="input-compose-from" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To</label>
                <Input value={fields.to} onChange={(e) => setFields((p) => ({ ...p, to: e.target.value }))} data-testid="input-compose-to" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">CC</label>
                  <Input value={fields.cc} onChange={(e) => setFields((p) => ({ ...p, cc: e.target.value }))} placeholder="cc@example.com" data-testid="input-compose-cc" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">BCC</label>
                  <Input value={fields.bcc} onChange={(e) => setFields((p) => ({ ...p, bcc: e.target.value }))} placeholder="bcc@example.com" data-testid="input-compose-bcc" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
              <Input value={fields.subject} onChange={(e) => setFields((p) => ({ ...p, subject: e.target.value }))} placeholder="Email subject" data-testid="input-compose-subject" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Body</label>
              <Textarea value={fields.body} onChange={(e) => setFields((p) => ({ ...p, body: e.target.value }))} placeholder="Write your message..." rows={5} data-testid="input-compose-body" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" data-testid="input-compose-files" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" data-testid="button-attach-files">
                  <Paperclip className="h-3.5 w-3.5" /> Attach Files
                </button>
                {attachments.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {attachments.map((file, i) => (
                      <span key={i} className="inline-flex items-center text-xs bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 gap-1">
                        {file.name} ({formatFileSize(file.size)})
                        <button onClick={() => removeAttachment(i)} className="text-slate-400 hover:text-red-500" data-testid={`button-remove-attachment-${i}`}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={closePanel} data-testid="button-cancel-compose">Cancel</Button>
                <Button size="sm" onClick={handleSend} disabled={!fields.to || !fields.subject || sending} className="bg-orange-600 hover:bg-orange-700 text-white" data-testid="button-send-compose">
                  {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-2" />Send</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <MainLayout title="Lead Management" description="Manage early access signups and demo requests through the onboarding pipeline">
      <div className="space-y-4">
        {/* Pipeline Stage Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stageCounts.map((stage) => (
            <button
              key={stage.key}
              onClick={() => { setFilterStatus(filterStatus === stage.key ? "all" : stage.key); setCurrentPage(1); }}
              className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all ${
                filterStatus === stage.key
                  ? "border-orange-400 ring-2 ring-orange-200 dark:ring-orange-800 bg-white dark:bg-slate-900"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
              data-testid={`filter-stage-${stage.key}`}
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${stage.color} flex items-center justify-center`}>
                <stage.icon className="h-4 w-4 text-white" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stage.count}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{stage.label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Pipeline Flow Indicator */}
        <div className="flex items-center justify-center gap-1 py-1">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.key} className="flex items-center">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                filterStatus === stage.key ? `${stage.color} text-white` : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}>{stage.label}</div>
              {i < PIPELINE_STAGES.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 mx-1" />}
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search by name, email, company, or notes..."
                className="pl-10 w-full"
                data-testid="input-search"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filterType} onValueChange={(v) => { setFilterType(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px] h-9 text-sm" data-testid="filter-type">
                  <Users className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  <SelectValue placeholder="Lead Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="early_access">Early Access</SelectItem>
                  <SelectItem value="demo_request">Demo Requests</SelectItem>
                </SelectContent>
              </Select>
              <Select value={datePreset} onValueChange={(v) => { setDatePreset(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px] h-9 text-sm" data-testid="filter-date">
                  <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-orange-600 hover:text-orange-700 h-9" data-testid="button-clear-filters">
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear ({activeFilterCount})
                </Button>
              )}
              <div className="border-l border-slate-200 dark:border-slate-700 h-6 mx-1" />
              <Button variant="outline" size="sm" onClick={exportCsv} className="h-9" data-testid="button-export">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span data-testid="text-result-count">
              Showing {filteredAndSortedLeads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredAndSortedLeads.length)} of {filteredAndSortedLeads.length} leads
              {filteredAndSortedLeads.length !== allLeads.length && ` (filtered from ${allLeads.length} total)`}
            </span>
            {selectedIds.size > 0 && (
              <span className="text-orange-600 font-medium">{selectedIds.size} selected</span>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-orange-600 mr-2" />
              <span className="text-slate-500">Loading leads...</span>
            </div>
          ) : filteredAndSortedLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Search className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium">No leads found</p>
              <p className="text-xs mt-1">Try adjusting your search or filters</p>
              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-3">Clear All Filters</Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="w-10 px-3 py-3">
                        <Checkbox checked={paginatedLeads.length > 0 && selectedIds.size === paginatedLeads.length} onCheckedChange={toggleSelectAll} data-testid="checkbox-select-all" />
                      </th>
                      <th className="text-left px-3 py-3">
                        <button onClick={() => toggleSort("name")} className="flex items-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hover:text-slate-900 dark:hover:text-white" data-testid="sort-name">
                          Name / Email <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="text-left px-3 py-3 hidden md:table-cell">
                        <button onClick={() => toggleSort("company")} className="flex items-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hover:text-slate-900 dark:hover:text-white" data-testid="sort-company">
                          Company <SortIcon field="company" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="text-left px-3 py-3">
                        <button onClick={() => toggleSort("type")} className="flex items-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hover:text-slate-900 dark:hover:text-white" data-testid="sort-type">
                          Source <SortIcon field="type" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="text-left px-3 py-3">
                        <button onClick={() => toggleSort("status")} className="flex items-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hover:text-slate-900 dark:hover:text-white" data-testid="sort-status">
                          Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="text-left px-3 py-3 hidden lg:table-cell">
                        <button onClick={() => toggleSort("createdAt")} className="flex items-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hover:text-slate-900 dark:hover:text-white" data-testid="sort-date">
                          Date <SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="w-10 px-3 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedLeads.map((lead) => {
                      const stage = getStage(lead.status);
                      const key = `${lead.type}-${lead.id}`;
                      const isSelected = selectedIds.has(key);
                      const isActiveLead = panelLead?.id === lead.id && panelLead?.type === lead.type && activePanel !== null;
                      return (
                        <tr
                          key={key}
                          className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isSelected ? "bg-orange-50/50 dark:bg-orange-950/20" : ""} ${isActiveLead ? "bg-orange-50 dark:bg-orange-950/30 ring-1 ring-inset ring-orange-200 dark:ring-orange-800" : ""}`}
                          data-testid={`row-lead-${lead.id}`}
                        >
                          <td className="px-3 py-3">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(lead)} data-testid={`checkbox-lead-${lead.id}`} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full ${stage.color} flex items-center justify-center`}>
                                <span className="text-white text-xs font-bold">{(lead.name || lead.email).charAt(0).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate" data-testid={`text-name-${lead.id}`}>{lead.name || lead.email.split("@")[0]}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate" data-testid={`text-email-${lead.id}`}>{lead.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell">
                            <span className="text-sm text-slate-700 dark:text-slate-300" data-testid={`text-company-${lead.id}`}>
                              {lead.company || <span className="text-slate-400 italic">—</span>}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className={`text-xs ${
                              lead.type === "early_access"
                                ? "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-0"
                                : "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-0"
                            }`}>
                              {lead.type === "early_access" ? "Early Access" : `Demo${lead.planTier ? ` - ${
                                lead.planTier === "licenseiq_plus" ? "Plus" : lead.planTier === "licenseiq_ultra" ? "Ultra" : "Basic"
                              }` : ""}`}
                            </Badge>
                          </td>
                          <td className="px-3 py-3"><StatusBadge status={lead.status} /></td>
                          <td className="px-3 py-3 hidden lg:table-cell">
                            <div>
                              <p className="text-sm text-slate-700 dark:text-slate-300" data-testid={`text-date-${lead.id}`}>{format(new Date(lead.createdAt), "MMM d, yyyy")}</p>
                              <p className="text-xs text-slate-400">{format(new Date(lead.createdAt), "h:mm a")}</p>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-actions-${lead.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                {lead.status === "new" && (
                                  <DropdownMenuItem onClick={() => loadPreview(lead, "verification_request", "verification")} data-testid={`action-verify-${lead.id}`}>
                                    <ShieldCheck className="h-4 w-4 mr-2 text-orange-600" /> Send Verification
                                  </DropdownMenuItem>
                                )}
                                {lead.status === "verified" && (
                                  <DropdownMenuItem onClick={() => {
                                    const nameParts = (lead.name || "").split(" ");
                                    setAccountWizardStep(1);
                                    setAccountFields({
                                      companyName: lead.company || "",
                                      userEmail: lead.email,
                                      firstName: nameParts[0] || "",
                                      lastName: nameParts.slice(1).join(" ") || "",
                                      tempPassword: "",
                                      role: "admin",
                                      sourceCompanyId: "",
                                    });
                                    openPanel("create_account", lead);
                                  }} data-testid={`action-create-account-${lead.id}`}>
                                    <Users className="h-4 w-4 mr-2 text-green-600" /> Create Account
                                  </DropdownMenuItem>
                                )}
                                {lead.status === "converted" && (
                                  <DropdownMenuItem onClick={() => { openPanel("reset_password", lead); setResetPasswordField(""); }} data-testid={`action-reset-password-${lead.id}`}>
                                    <KeyRound className="h-4 w-4 mr-2 text-orange-600" /> Reset Password
                                  </DropdownMenuItem>
                                )}
                                {(lead.status === "verified" || lead.status === "verification_sent") && (
                                  <DropdownMenuItem onClick={() => { openPanel("workspace", lead); setWorkspaceFields({ loginUrl: "https://www.licenseiq.ai", tempPassword: "" }); }} data-testid={`action-workspace-${lead.id}`}>
                                    <Rocket className="h-4 w-4 mr-2 text-green-600" /> Send Workspace Ready
                                  </DropdownMenuItem>
                                )}
                                {lead.status !== "new" && (
                                  <DropdownMenuItem onClick={() => { openPanel("followup", lead); setFollowupFields({ senderName: "", senderTitle: "", senderEmail: "info@licenseiq.ai", senderPhone: "" }); }} data-testid={`action-followup-${lead.id}`}>
                                    <MessageSquare className="h-4 w-4 mr-2 text-purple-600" /> Send Follow-Up
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => openCompose(lead)} data-testid={`action-email-${lead.id}`}>
                                  <Send className="h-4 w-4 mr-2 text-slate-500" /> Custom Email
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { openPanel("status", lead); setNewStatus(lead.status); setStatusNotes(lead.notes || ""); }} data-testid={`action-status-${lead.id}`}>
                                  <RefreshCw className="h-4 w-4 mr-2 text-slate-500" /> Change Status
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { openPanel("notes", lead); setEditNotes(lead.notes || ""); setEditContactFields({ name: lead.name || "", company: lead.company || "", position: (lead as any).position || "", phone: (lead as any).phone || "" }); }} data-testid={`action-notes-${lead.id}`}>
                                  <Paperclip className="h-4 w-4 mr-2 text-orange-600" /> Lead Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDeleteConfirm(lead)} className="text-red-600 focus:text-red-600" data-testid={`action-delete-${lead.id}`}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete Lead
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span>Rows per page:</span>
                  <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 w-[70px] text-xs" data-testid="select-page-size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((s) => (
                        <SelectItem key={s} value={s.toString()}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-500 dark:text-slate-400 mr-2">Page {currentPage} of {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} data-testid="page-first"><ChevronsLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} data-testid="page-prev"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} data-testid="page-next"><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} data-testid="page-last"><ChevronsRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <span className="font-semibold">{deleteConfirm?.name || deleteConfirm?.email}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLead} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white" data-testid="button-confirm-delete">
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {renderInlinePanel()}
    </MainLayout>
  );
}
