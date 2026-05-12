import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { ContractRulesEditor } from "@/components/RoyaltyRulesEditor";
import CombinedRulesView from "@/components/CombinedRulesView";
import { Link } from "wouter";
import { formatDateUSA } from "@/lib/dateFormat";
import { useErpValueMap, ErpValueDisplay } from "@/hooks/useErpValueMap";
import { 
  FileText, 
  Download, 
  Edit, 
  Eye, 
  Share, 
  Flag,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Clock,
  User,
  Calendar,
  Trash2,
  Calculator,
  Sparkles,
  Network,
  ListChecks,
  ScrollText,
  ChevronDown,
  ChevronUp,
  Copy,
  Library,
  ExternalLink,
  Loader2,
  Shield,
  TrendingUp,
  BookOpen,
  AlertCircle,
  MoreHorizontal,
  Upload,
  Info,
  Layers,
  Users,
  History,
  FileCheck,
  ListOrdered,
  MapPin,
  DollarSign,
  Building,
  Settings,
  CreditCard,
  Database
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function getContractTypeLabel(code: string | null | undefined, contractTypes?: Array<{ code: string; name: string }>): string {
  if (!code) return 'Unknown';
  if (contractTypes) {
    const match = contractTypes.find(ct => ct.code === code);
    if (match) return match.name;
  }
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ContractAnalysis() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  if (id === 'new') return null;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [extractedTextExpanded, setExtractedTextExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showContractInfo, setShowContractInfo] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState("summary");
  // Save-as-template dialog state. Two axes per task spec:
  //   scope:     minimal | standard | maximal  (how much of the contract to snapshot)
  //   visibility: public | private             (private == only owner sees it later)
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDescription, setTplDescription] = useState("");
  const [tplScope, setTplScope] = useState<"minimal" | "standard" | "maximal">("standard");
  // Default visibility = public so saving a template makes it available to
  // teammates by default (matching task spec). Users opt down to "private"
  // when the template is genuinely just for themselves.
  const [tplVisibility, setTplVisibility] = useState<"public" | "private">("public");
  const requestedSections = useRef<Set<string>>(new Set());
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const contractDetailsRef = useRef<any>(null);
  const contractDetailsComputedForId = useRef<string | null>(null);
  const { erpValueMap, erpMappingInfoMap } = useErpValueMap(id);
  const replacePdfInputRef = useRef<HTMLInputElement>(null);

  const { data: contractTypesData } = useQuery<{ contractTypes: Array<{ code: string; name: string }> }>({
    queryKey: ["/api/contract-types"],
  });
  const contractTypesList = contractTypesData?.contractTypes || [];

  const analysisSectionMutation = useMutation({
    mutationFn: async (section: string) => {
      setLoadingSection(section);
      const response = await apiRequest("POST", `/api/contracts/${id}/analysis/${section}`);
      return response.json();
    },
    onSuccess: () => {
      setLoadingSection(null);
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
    },
    onError: (error: Error) => {
      setLoadingSection(null);
      toast({
        title: "Analysis Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const triggerSectionAnalysis = useCallback((section: string) => {
    if (!analysisSectionMutation.isPending) {
      requestedSections.current.add(section);
      analysisSectionMutation.mutate(section);
    }
  }, [analysisSectionMutation]);

  const replacePdfMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/contracts/${id}/replace-pdf`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to replace PDF');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "PDF Replaced", description: `File updated to ${data.fileName}` });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
    },
    onError: (error: Error) => {
      toast({ title: "Replace Failed", description: error.message, variant: "destructive" });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/contracts/${id}/reprocess`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reprocessing Started",
        description: "The document is being reanalyzed with improved AI detection.",
      });
      // Invalidate and refetch contract data
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Reprocessing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/contracts/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contract Deleted",
        description: "The contract has been permanently deleted.",
      });
      
      // Invalidate all related caches
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] }); // Contracts list
      queryClient.invalidateQueries({ queryKey: ["/api/calculations/all"] }); // Global calculations page
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${id}`] }); // This contract's detail
      
      // Redirect to contracts list
      setLocation("/contracts");
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save the current contract as a reusable template. The server snapshots
  // rules + clauses according to scope (minimal/standard/maximal) and stores
  // visibility (public for the company / private to the user).
  const saveAsTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contracts/${id}/save-as-template`, {
        name: tplName.trim(),
        description: tplDescription.trim() || undefined,
        scope: tplScope,
        visibility: tplVisibility,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Template saved",
        description: `"${data?.name || tplName}" is now available when creating contracts.`,
      });
      // Refresh the templates list so the new entry appears in the New Contract panel.
      queryClient.invalidateQueries({ queryKey: ["/api/contract-templates"] });
      setSaveAsTemplateOpen(false);
      setTplName("");
      setTplDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Could not save template",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const flagMutation = useMutation({
    mutationFn: async (flagged: boolean) => {
      const response = await apiRequest("PATCH", `/api/contracts/${id}/flag`, { flagged });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${id}`] });
      toast({
        title: data.flagged ? "Flagged for Review" : "Flag Removed",
        description: data.flagged 
          ? "Contract has been flagged for review by administrators."
          : "Review flag has been removed from this contract.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message || "Failed to update flag status.",
        variant: "destructive",
      });
    },
  });

  const triggerExtractionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/contracts/${id}/extract-dynamic`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Dynamic Extraction Started",
        description: "AI is analyzing the contract structure. Results will appear shortly.",
      });
      // Invalidate both extraction runs and dynamic rules to show fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id, "extraction-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id, "dynamic-rules"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Extraction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: extractionRuns = [] } = useQuery({
    queryKey: ["/api/contracts", id, "extraction-runs"],
    enabled: !!id,
  }) as { data: any[] };

  const { data: dynamicRules = [] } = useQuery({
    queryKey: ["/api/contracts", id, "dynamic-rules"],
    enabled: !!id,
  }) as { data: any[] };

  const [enrichmentTriggered, setEnrichmentTriggered] = useState(false);

  const { data: enrichmentStatusData } = useQuery<{ state: string; total: number; processed: number; error?: string }>({
    queryKey: ['/api/contracts', id, 'enrichment-status'],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${id}/enrichment-status`);
      if (!res.ok) return { state: 'idle', total: 0, processed: 0 };
      return res.json();
    },
    enabled: !!id && enrichmentTriggered,
    refetchInterval: enrichmentTriggered ? 2000 : false,
  });

  const isEnrichmentRunning = enrichmentStatusData?.state === 'running';
  const enrichmentProgress = enrichmentStatusData?.processed || 0;
  const enrichmentTotal = enrichmentStatusData?.total || 0;

  useEffect(() => {
    if (enrichmentTriggered && enrichmentStatusData?.state === 'completed') {
      setEnrichmentTriggered(false);
      toast({ title: "AI Enrichment Complete", description: `${enrichmentStatusData?.processed || 0} rules enriched.` });
      setLocation(`/contracts/${id}/rules`);
    } else if (enrichmentTriggered && enrichmentStatusData?.state === 'failed') {
      setEnrichmentTriggered(false);
      toast({ title: "Enrichment Issue", description: "Some rules could not be enriched. You can still view the rules.", variant: "destructive" });
      setLocation(`/contracts/${id}/rules`);
    }
  }, [enrichmentStatusData?.state]);

  const enrichAndNavigateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/contracts/${id}/enrich-rules`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.alreadyEnriched || data?.count === 0) {
        setLocation(`/contracts/${id}/rules`);
        return;
      }
      setEnrichmentTriggered(true);
      toast({
        title: "AI Enrichment Started",
        description: "Enriching rules with AI details. You'll be navigated to the rules page when complete.",
      });
    },
    onError: () => {
      setLocation(`/contracts/${id}/rules`);
    },
  });

  const { data: contract, isLoading, error } = useQuery({
    queryKey: ["/api/contracts", id],
    enabled: !!id,
    retry: false,
    refetchInterval: (query) => {
      const c = query.state.data as any;
      if (c && (c.status === 'processing' || c.status === 'uploading' || c.status === 'uploaded')) {
        return 2000;
      }
      return false;
    },
    refetchIntervalInBackground: false,
  }) as { data: any; isLoading: boolean; error: any };

  const hasContractDocument = !!(contract?.rawText);

  // Fetch fee rules for this contract (NEW)
  const { data: contractRulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ["/api/contracts", id, "rules"],
    enabled: !!id && !!contract,
    retry: false,
    refetchInterval: contract?.status === 'processing' ? 3000 : false, // Auto-refresh during processing
    refetchIntervalInBackground: false,
  }) as { data: any; isLoading: boolean };

  const prevStatusRef = useRef(contract?.status);
  useEffect(() => {
    if (prevStatusRef.current && prevStatusRef.current !== contract?.status && contract?.status === 'analyzed') {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id, "rules"] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', id, 'combined-rules'] });
    }
    prevStatusRef.current = contract?.status;
  }, [contract?.status, id, queryClient]);

  const { data: combinedRulesData } = useQuery<any>({
    queryKey: ['/api/contracts', id, 'combined-rules'],
    enabled: !!id && !!contract,
  });

  const { data: pipelineResults } = useQuery<any>({
    queryKey: ['/api/contracts', id, 'pipeline', 'results'],
    queryFn: () => fetch(`/api/contracts/${id}/pipeline/results`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: !!id && !!contract,
  });

  const { data: clausesData } = useQuery({
    queryKey: ['/api/contracts', id, 'clauses-list'],
    queryFn: () => fetch(`/api/contracts/${id}/clauses-list`, { credentials: "include" }).then(r => r.json()),
    enabled: !!id && !!contract,
  });

  const { data: termsData } = useQuery({
    queryKey: ['/api/contracts', id, 'terms'],
    queryFn: () => fetch(`/api/contracts/${id}/terms`, { credentials: "include" }).then(r => r.json()),
    enabled: !!id && !!contract,
  });

  const { data: partnersData } = useQuery({
    queryKey: ['/api/contracts', id, 'partners'],
    queryFn: () => fetch(`/api/contracts/${id}/partners`, { credentials: "include" }).then(r => r.json()),
    enabled: !!id && !!contract,
  });

  const { data: versionsData } = useQuery({
    queryKey: [`/api/contracts/${id}/versions`],
    enabled: !!id && !!contract,
  });

  const { data: masterData } = useQuery({
    queryKey: ['/api/contracts', id, 'master'],
    queryFn: () => fetch(`/api/contracts/${id}/master`, { credentials: "include" }).then(r => r.json()),
    enabled: !!id && !!contract,
  });

  const clauses = Array.isArray(clausesData) ? clausesData : clausesData?.clauses || [];
  const terms = Array.isArray(termsData) ? termsData : [];
  const partners = Array.isArray(partnersData) ? partnersData : [];
  const versions = versionsData?.versions || [];

  const handleManageRules = () => {
    setLocation(`/contracts/${id}/pipeline`);
  };

  const analysis = contract?.analysis;
  const hasAnalysis = contract?.status === 'analyzed';

  // Rule-readiness gate (mirrors server/services/contractApprovalIntegrity.ts).
  // A contract version cannot be approved until every active rule is approved.
  const ruleReadiness = useMemo(() => {
    const raw: any = contractRulesData;
    const all: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.rules) ? raw.rules : [];
    const active = all.filter(r => r.isActive !== false);
    let approved = 0, pending = 0, rejected = 0;
    for (const r of active) {
      const s = (r.approvalStatus || 'pending').toLowerCase();
      if (s === 'approved') approved++;
      else if (s === 'rejected') rejected++;
      else pending++;
    }
    const total = active.length;
    const isReady = total > 0 && approved === total;
    return { total, approved, pending, rejected, isReady };
  }, [contractRulesData]);

  const latestVersion: any = Array.isArray(versions) && versions.length > 0
    ? [...versions].sort((a: any, b: any) => (b.versionNumber || 0) - (a.versionNumber || 0))[0]
    : null;
  // Fall back to the contract row's own approval_state for newly-added contracts
  // that haven't yet had a version row minted (those start as 'draft').
  const approvalState: string | undefined =
    latestVersion?.approvalState || (contract as any)?.approvalState;
  const versionLabel: string = latestVersion?.versionNumber
    ? `v${latestVersion.versionNumber}`
    : `v${(contract as any)?.currentVersion ?? 1}`;
  const processingStatus = ((contract as any)?.status || '').toString().toLowerCase();
  const isProcessing = processingStatus === 'processing' || processingStatus === 'uploaded' || processingStatus === 'pending';
  const hasFailed = processingStatus === 'failed' || processingStatus === 'error';
  // Lifecycle status comes from contractStatus (Draft/Active/Pending/Expired/Terminated) — only shows Active
  // when the user explicitly activates the contract from the edit page.
  const lifecycleStatus = ((contract as any)?.contractStatus || (isProcessing ? '' : 'Draft')).toString();
  const lifecycleLower = lifecycleStatus.toLowerCase();
  const isActive: boolean = lifecycleLower === 'active';

  const contractDetails = useMemo(() => {
    const cacheKey = `${id}_${contract?.status}_${!!analysis}_${!!contractRulesData}`;
    if (contractDetailsRef.current && contractDetailsComputedForId.current === cacheKey) {
      return contractDetailsRef.current;
    }

    if (!contract) return {};

    const rawText = contract.rawText || '';
    const initialSummary = analysis?.summary || '';

    let party1: string | null = null;
    let party2: string | null = null;
    let party2Label = 'COUNTER PARTY';

    const keyTermsObj = analysis?.keyTerms as any;

    if (keyTermsObj?.licensor && keyTermsObj.licensor !== 'Not specified') {
      party1 = typeof keyTermsObj.licensor === 'string' ? keyTermsObj.licensor : null;
    }
    if (keyTermsObj?.licensee && keyTermsObj.licensee !== 'Not specified') {
      if (Array.isArray(keyTermsObj.licensee)) {
        const licenseeNames = keyTermsObj.licensee.filter((l: any) => typeof l === 'string');
        party2 = licenseeNames.join(', ') || null;
        if (licenseeNames.length > 1) party2Label = 'AUTHORIZED PARTNERS';
      } else if (typeof keyTermsObj.licensee === 'string') {
        party2 = keyTermsObj.licensee;
      }
    }

    if (rawText) {
      if (!party1) {
        const licensorNextLine = rawText.match(/(?:Licensor|Program\s+Sponsor|Owning\s+Party)\s*(?:\/[^\n]*)?\s*\n\s*([A-Z][A-Za-z\s&.,'']+?)(?:\n|$)/im);
        if (licensorNextLine) {
          party1 = licensorNextLine[1]?.trim();
        }
      }

      if (!party1) {
        const licensorInline = rawText.match(/(?:Licensor|Owning\s+Party)\s*:\s*([A-Z][A-Za-z\s&.,'']+?)(?:\n|$)/im);
        if (licensorInline) {
          party1 = licensorInline[1]?.trim();
        }
      }

      if (!party2) {
        const licenseeInline = rawText.match(/(?:Licensee|Counterparty)\s*:\s*([A-Z][A-Za-z\s&.,'']+?)(?:\n|$)/im);
        if (licenseeInline) {
          party2 = licenseeInline[1]?.trim();
        }
      }

      if (!party2) {
        const licenseeNextLine = rawText.match(/(?:Licensee|Counterparty)\s*(?:\/[^\n]*)?\s*\n\s*([A-Z][A-Za-z\s&.,'']+?)(?:\n|$)/im);
        if (licenseeNextLine) {
          party2 = licenseeNextLine[1]?.trim();
        }
      }

      if (!party2) {
        const partnerSection = rawText.match(/(?:Authorized\s+(?:Specialty\s+)?(?:Retail\s+)?Partners?|Assigned\s+Licensees?\s*\/?\s*Partners?)\s*\n/i);
        if (partnerSection) {
          party2Label = 'AUTHORIZED PARTNERS';
          const partnerNames = rawText.slice(partnerSection.index! + partnerSection[0].length, partnerSection.index! + partnerSection[0].length + 800);
          const allNames: string[] = [];
          const nameRegex = /([A-Z][A-Za-z\s]+(?:Boutique|Gallery|Group|Systems|Solutions|Partners|Labs|Technologies|Services|Corp\.?|Inc\.?|LLC|Ltd\.?|Audio|Sound))/g;
          let nm;
          while ((nm = nameRegex.exec(partnerNames)) !== null) {
            const name = nm[1]?.trim();
            if (name && !name.match(/^(Partner|Classification|Status|Effective|Expiration|Active|Specialty|Performance|Retailer|Date|Category|Channel|Type)/i)) {
              allNames.push(name);
            }
          }
          if (allNames.length > 0) {
            party2 = Array.from(new Set(allNames)).join(', ');
          }
        }
      }

      if (!party1 || !party2) {
        const betweenRaw = rawText.match(/(?:agreement|contract)\s+(?:is\s+)?(?:made\s+)?(?:and\s+entered\s+into\s+)?(?:by\s+and\s+)?between\s+([^,("]+?)\s*(?:\([^)]*\))?\s*(?:,?\s*(?:a\s+\w+\s+(?:corporation|company|entity|LLC|partnership))?)?\s*(?:,\s*|\s+and\s+)([^,("]+?)(?:\s*\(|,|\s*$)/im);
        if (betweenRaw) {
          party1 = party1 || betweenRaw[1]?.trim();
          party2 = party2 || betweenRaw[2]?.trim();
        }
      }
    }

    if (!party1 && contract.organizationName) {
      party1 = contract.organizationName;
    }
    if (!party1 && (contract as any).organization_name) {
      party1 = (contract as any).organization_name;
    }
    if (!party2 && contract.counterpartyName) {
      party2 = contract.counterpartyName;
    }
    if (!party2 && (contract as any).counterparty_name) {
      party2 = (contract as any).counterparty_name;
    }

    if (!party1 || !party2) {
      if (!party1 && keyTermsObj?.licensor && keyTermsObj.licensor !== 'Not specified') {
        party1 = typeof keyTermsObj.licensor === 'string' ? keyTermsObj.licensor : null;
      }
      if (!party2 && keyTermsObj?.licensee && keyTermsObj.licensee !== 'Not specified') {
        if (Array.isArray(keyTermsObj.licensee)) {
          party2 = keyTermsObj.licensee.filter((l: any) => typeof l === 'string').join(', ') || null;
        } else if (typeof keyTermsObj.licensee === 'string') {
          party2 = keyTermsObj.licensee;
        }
      }
    }

    if (!party1 || !party2) {
      const summaryMatch = initialSummary.match(/between\s+([^,]+?)\s+and\s+([^,]+?)(?:\.|,|$)/i);
      if (summaryMatch) {
        party1 = party1 || summaryMatch[1]?.trim();
        party2 = party2 || summaryMatch[2]?.trim();
      }
    }

    if (party1 && party2 && rawText) {
      const vendorPattern = /(?:vendor\s*(?:number|#|no\.?)?[:\s]*\d+[^.]*?(?:and|,)\s*)([A-Z][A-Za-z\s''.&]+)/i;
      const vendorMatch = rawText.match(vendorPattern);
      const summaryVendorPattern = /(?:vendor|supplier)\s*(?:\([^)]*\))?\s*(?:and|,)\s*([A-Z][A-Za-z\s''.&]+)/i;
      const summaryVendorMatch = initialSummary.match(summaryVendorPattern);

      const vendorName = vendorMatch?.[1]?.trim() || summaryVendorMatch?.[1]?.trim();
      const buyerPattern = /(?:products?\s+to|supplies?\s+to|primary\s+supplier\s+(?:of\s+)?(?:certain\s+)?(?:products?\s+)?to)\s+([A-Z][A-Za-z''.&]+(?:\s+[A-Z][A-Za-z''.&]+){0,4})/i;
      const buyerMatch = rawText.match(buyerPattern) || initialSummary.match(buyerPattern);
      const buyerName = buyerMatch?.[1]?.trim()?.replace(/[.,\s]+$/, '')?.replace(/\.\s.*$/, '');

      if (vendorName && party1 && vendorName.toLowerCase().includes(party1.toLowerCase().substring(0, 8))) {
        const temp = party1;
        party1 = party2;
        party2 = temp;
      } else if (buyerName && party2 && buyerName.toLowerCase().includes(party2.toLowerCase().substring(0, 8))) {
        const temp = party1;
        party1 = party2;
        party2 = temp;
      }
    }

    let paymentTerms: string | null = null;
    let contractValue: string | null = keyTermsObj?.contractValue || null;
    let territory: string | null = contract?.territoryScope || keyTermsObj?.territory || null;

    if (rawText) {
      const billingFreqMatch = rawText.match(/Billing\s+Frequency\s*[*:]*\s*(\S.*)/i);
      if (billingFreqMatch) {
        const freqValue = billingFreqMatch[1].trim().replace(/^[A-Z]-/i, '');
        if (freqValue) paymentTerms = freqValue;
      }
    }
    if (!paymentTerms && contract?.paymentFrequency) {
      paymentTerms = contract.paymentFrequency;
    }
    if (!paymentTerms) {
      paymentTerms = keyTermsObj?.paymentTerms || null;
    }

    const searchText = rawText || initialSummary || '';
    const isRebateContract = /rebate|distributor|reseller|distribution/i.test(contract?.contractType || '');
    if (searchText) {
      if (isRebateContract) {
        const rebatePaymentPatterns = [
          /(?:payment\s+(?:terms?|shall\s+be\s+due))[:\s]*(?:.*?)(net\s+\w+\s*\(\d+\)\s*days[^.]*)/i,
          /(?:payment\s+for\s+all\s+orders\s+shall\s+be\s+due)\s+(net\s+\w+\s*\(\d+\)\s*days)/i,
          /(?:payment)[:\s]*(?:.*?)(net\s+\d+\s*days[^.]*)/i,
        ];
        for (const pat of rebatePaymentPatterns) {
          const m = searchText.match(pat);
          if (m) {
            paymentTerms = m[1]?.trim();
            break;
          }
        }
        if (!paymentTerms) {
          paymentTerms = "Net 30 days from invoice date";
        }
      } else if (!paymentTerms) {
        const paymentPatterns = [
          /(?:payment\s+terms?|payment\s+schedule|payment\s+shall\s+be)[:\s]*([^\n.]{10,150})/i,
          /(?:license\s+fee|royalt(?:y|ies)|fee\s+schedule|compensation)[:\s]*([^\n.]{10,150})/i,
          /(?:shall\s+pay|agrees?\s+to\s+pay|will\s+pay)[:\s]*([^\n.]{10,150})/i,
          /(?:payment\s+frequency)[:\s]*(\w+)/i,
        ];
        for (const pat of paymentPatterns) {
          const m = searchText.match(pat);
          if (m) {
            paymentTerms = m[1]?.trim();
            break;
          }
        }
      }

      if (isRebateContract) {
        const rebateRates: string[] = [];
        const tierPattern = /(?:Tier\s*\d|rebate\s+percentage)[^%]*?([\d.]+)\s*%/gi;
        let tierMatch;
        while ((tierMatch = tierPattern.exec(searchText)) !== null) {
          const pct = tierMatch[1] + '%';
          if (!rebateRates.includes(pct)) rebateRates.push(pct);
        }
        if (rebateRates.length > 0) {
          contractValue = rebateRates.join(', ') + ' rebate tiers';
        } else {
          const percentagesInText = searchText.match(/[\d.]+\s*%/g);
          if (percentagesInText && percentagesInText.length > 0) {
            const uniquePcts = [...new Set(percentagesInText.map(p => p.trim()))].slice(0, 4);
            contractValue = uniquePcts.join(', ') + ' rebate rates';
          }
        }
      } else if (!contractValue) {
        const percentagesInText = searchText.match(/[\d.]+\s*%/g);
        const amountsInText = searchText.match(/\$[\d,]+(?:\.\d{2})?/g);
        const parts: string[] = [];
        if (percentagesInText && percentagesInText.length > 0) {
          const cleanPct = percentagesInText[0].replace(/(\d+)\.0+%/, '$1%');
          parts.push(cleanPct + ' contract fee rate');
        }
        if (amountsInText && amountsInText.length > 0) {
          parts.push(amountsInText[0] + ' minimum guarantee');
        }
        if (parts.length > 0) {
          contractValue = parts.join(', ');
        }
      }

      const rulesList = contractRulesData?.rules || contractRulesData || [];
      if (Array.isArray(rulesList)) {
        if (!contract?.territoryScope) {
          const allTerritoryArrays = rulesList
            .map((r: any) => r.territories)
            .filter((t: any) => Array.isArray(t) && t.length > 0);
          if (allTerritoryArrays.length > 0) {
            const merged = new Set<string>();
            for (const arr of allTerritoryArrays) arr.forEach((t: string) => merged.add(t));
            const rulesTerritory = Array.from(merged).join(', ');
            const territoryStr = Array.isArray(territory) ? territory.join(',') : (typeof territory === 'string' ? territory : '');
            if (!territory || merged.size > (territoryStr.split(',').length)) {
              territory = rulesTerritory;
            }
          }
        }
      }
      if (!territory && Array.isArray(rulesList)) {
        const territoryRules = rulesList.filter((r: any) => 
          /territory/i.test(r.ruleName || r.rule_name || '') && (r.sourceText || r.source_text)
        );
        if (territoryRules.length > 0) {
          const knownRegions = [
            'United States of America', 'United States', 'USA', 'U.S.A.',
            'Canada', 'Mexico', 'European Union', 'EU', 'United Kingdom', 'UK',
            'Australia', 'Japan', 'China', 'India', 'Brazil', 'Germany', 'France',
            'North America', 'South America', 'Europe', 'Asia Pacific', 'Asia',
            'Latin America', 'Middle East', 'Africa', 'Worldwide', 'Global',
          ];
          const regionPattern = new RegExp('(' + knownRegions.map(r => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
          const foundRegions: string[] = [];
          for (const r of territoryRules) {
            const src = r.sourceText || r.source_text || '';
            const matches = src.match(regionPattern);
            if (matches) {
              for (const m of matches) {
                const normalized = m.trim();
                if (!foundRegions.some(f => f.toLowerCase() === normalized.toLowerCase())) {
                  foundRegions.push(normalized);
                }
              }
            }
          }
          if (foundRegions.length > 0) {
            territory = foundRegions.join(', ');
          } else {
            const primaryRule = territoryRules.find((r: any) => /definition|scope|primary/i.test(r.ruleName || r.rule_name || '')) || territoryRules[0];
            const src = primaryRule.sourceText || primaryRule.source_text || '';
            const listMatch = src.match(/(?:consist\s+of|include|following)[^:]*:\s*(.+)/is);
            if (listMatch) {
              territory = listMatch[1].replace(/\s+/g, ' ').trim().substring(0, 150);
            }
          }
        }
      }

      if (!territory) {
        const knownRegions = [
          'United States of America', 'United States', 'Canada', 'Mexico',
          'European Union', 'United Kingdom', 'North America', 'Worldwide', 'Global',
        ];
        const regionPattern = new RegExp('(?:territory|territories|geographic\\s+regions?)\\b[^.]*?(' +
          knownRegions.map(r => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
        const matches = searchText.match(regionPattern);
        if (matches && matches.length > 0) {
          const foundRegions: string[] = [];
          for (const m of matches) {
            for (const region of knownRegions) {
              if (m.toLowerCase().includes(region.toLowerCase()) && !foundRegions.includes(region)) {
                foundRegions.push(region);
              }
            }
          }
          if (foundRegions.length > 0) territory = foundRegions.join(', ');
        }
      }

      if (!territory) {
        const authorizedTableMatch = searchText.match(
          /(?:Authorized\s+Territor(?:y|ies))\s*\n\s*(?:Status\s+Region|Region\s+Status)[^\n]*\n((?:\s*(?:Authorized|Active|Included|Conditionally\s+Authorized)\s+[^\n]+\n?)+)/im
        );
        if (authorizedTableMatch) {
          const tableBlock = authorizedTableMatch[1];
          const rowMatches = tableBlock.match(
            /(?:Authorized|Active|Included|Conditionally\s+Authorized)\s+([A-Z][A-Za-z\s,();]+?)(?:\n|$)/gim
          );
          if (rowMatches && rowMatches.length > 0) {
            const regions = rowMatches.map(r => r.replace(/^\s*(?:Authorized|Active|Included|Conditionally\s+Authorized)\s+/i, '').trim())
              .filter(r => r.length > 1);
            if (regions.length > 0) territory = regions.join(', ');
          }
        }
      }
    }

    let startDate = contract.effectiveStart 
      ? new Date(contract.effectiveStart).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : null;
    let endDate = contract.effectiveEnd 
      ? new Date(contract.effectiveEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : null;
    
    if (!startDate && keyTermsObj?.effectiveDate) {
      try {
        const d = new Date(keyTermsObj.effectiveDate);
        if (!isNaN(d.getTime())) startDate = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch {}
    }
    if (!endDate && keyTermsObj?.expirationDate) {
      try {
        const d = new Date(keyTermsObj.expirationDate);
        if (!isNaN(d.getTime())) endDate = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch {}
    }
    
    if ((!startDate || !endDate) && rawText) {
      const startPatterns = [
        /(?:effective\s+date|commencement\s+date|start\s+date)\*?\s*[:=\s]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        /(?:effective\s+date|commencement\s+date|start\s+date|effective\s+as\s+of)[:\s]*(\w+\s+\d{1,2},?\s+\d{4})/i,
        /(?:commencing|beginning|starting)\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})/i,
        /(?:commencing|beginning|starting)\s+(?:on\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      ];
      const endPatterns = [
        /(?:expiration\s+date|termination\s+date|end\s+date)\*?\s*[:=\s]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        /(?:expiration\s+date|termination\s+date|end\s+date|expires?\s+on)[:\s]*(\w+\s+\d{1,2},?\s+\d{4})/i,
        /(?:expiring|ending|terminating)\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})/i,
        /(?:through|until|to)\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
      ];
      if (!startDate) {
        for (const pat of startPatterns) {
          const m = pat.exec(rawText);
          if (m) { startDate = m[1]; break; }
        }
      }
      if (!endDate) {
        for (const pat of endPatterns) {
          const m = pat.exec(rawText);
          if (m) { endDate = m[1]; break; }
        }
      }
    }

    let agreementType: string | null = null;
    if (rawText) {
      const typeMatch = rawText.match(/(?:Agreement\s+Type|Contract\s+Type)\s*[:\s]\s*([^\n]{3,60})/i);
      if (typeMatch) agreementType = typeMatch[1]?.trim();
    }
    if (!agreementType && contract.contractType) {
      agreementType = getContractTypeLabel(contract.contractType, contractTypesList);
    }

    const details = {
      licensor: party1 || 'Not specified',
      licensee: party2 || 'Not specified',
      party2Label,
      paymentTerms: paymentTerms,
      contractValue: contractValue,
      territory: territory,
      startDate: startDate,
      endDate: endDate,
      agreementType: agreementType,
    };

    contractDetailsRef.current = details;
    contractDetailsComputedForId.current = `${id}_${contract?.status}_${!!analysis}_${!!contractRulesData}`;

    return details;
  }, [id, contract?.rawText, contract?.status, analysis, contract?.effectiveStart, contract?.effectiveEnd, contractRulesData]);

  const partySyncRef = useRef<string | null>(null);
  useEffect(() => {
    if (!contract || !contractDetails) return;
    const party1 = contractDetails.licensor;
    const party2 = contractDetails.licensee;
    if (!party1 || party1 === 'Not specified') return;
    const syncKey = `${contract.id}_${party1}_${party2}`;
    if (partySyncRef.current === syncKey) return;
    const dbOrg = contract.organizationName || contract.owningParty || '';
    const dbCounter = contract.counterpartyName || '';
    if (dbOrg !== party1 || (party2 && party2 !== 'Not specified' && dbCounter !== party2)) {
      const updates: Record<string, string> = {};
      if (dbOrg !== party1) {
        updates.organizationName = party1;
        updates.owningParty = party1;
      }
      if (party2 && party2 !== 'Not specified' && dbCounter !== party2) {
        updates.counterpartyName = party2;
      }
      if (Object.keys(updates).length > 0) {
        partySyncRef.current = syncKey;
        apiRequest("PATCH", `/api/contracts/${contract.id}`, updates).catch((err: any) => {
          if (err?.code === 'CONTRACT_VALIDATION_FAILED' && Array.isArray(err?.failures)) {
            toast({
              title: `Cannot activate — ${err.failures.length} issue${err.failures.length === 1 ? '' : 's'} found`,
              description: err.summary || err.failures.map((f: any) => `• ${f.message}`).join('\n'),
              variant: 'destructive',
              duration: 12000,
            });
          }
        });
      }
    }
  }, [contract, contractDetails]);

  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  if (isLoading) {
    return (
      <MainLayout title="Loading..." description="Loading contract analysis">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-96" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex space-x-3">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!contract || !contract.id) {
    return (
      <MainLayout title="Contract Not Found" description="The requested contract could not be found">
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Contract Not Found</h3>
            <p className="text-muted-foreground mb-6">
              The contract you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button onClick={() => setLocation("/contracts")}>
              Back to Contracts
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const handleViewOriginal = () => {
    // Open the original PDF file in a new window
    window.open(`/api/contracts/${id}/file`, '_blank');
  };

  const handleDownloadReport = async () => {
    try {
      const response = await apiRequest("GET", `/api/contracts/${id}/report`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${contract?.originalName || 'contract'}_analysis_report.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Report Downloaded",
          description: "Analysis report has been downloaded successfully.",
        });
      } else {
        throw new Error('Failed to download report');
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download analysis report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShareAnalysis = async () => {
    try {
      const shareData = {
        title: `${contract?.originalName || 'Contract'} Analysis`,
        text: analysis?.summary || 'Contract Analysis Report',
        url: window.location.href,
      };

      if (navigator.share) {
        await navigator.share(shareData);
        toast({
          title: "Shared Successfully",
          description: "Analysis has been shared.",
        });
      } else {
        // Fallback: copy link to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link Copied",
          description: "Analysis link has been copied to your clipboard.",
        });
      }
    } catch (error) {
      console.error('Share failed:', error);
      toast({
        title: "Share Failed",
        description: "Unable to share analysis. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFlagForReview = () => {
    const isCurrentlyFlagged = contract?.flaggedForReview || false;
    flagMutation.mutate(!isCurrentlyFlagged);
  };

  const handleExport = () => {
    handleDownloadReport();
  };

  const handleEditAnalysis = () => {
    // Navigate to the edit analysis page or show edit modal
    toast({
      title: "Edit Analysis",
      description: "Analysis editing functionality is being developed. For now, you can reprocess the contract to regenerate analysis.",
    });
  };

  const handleReprocess = () => {
    reprocessMutation.mutate();
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100';
      case 'medium':
        return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100';
      case 'low':
        return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100';
      default:
        return 'bg-muted border-border text-foreground';
    }
  };

  return (
    <MainLayout 
      title={`${contract?.originalName || 'Contract'} Analysis`}
      description={`${contract?.contractNumber ? contract.contractNumber + ' · ' : ''}${hasAnalysis ? 'Processed' : 'Processing'} ${contract?.createdAt ? formatDistanceToNow(new Date(contract.createdAt), { addSuffix: true }) : 'recently'}`}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-wrap gap-y-2">
            <Badge 
              variant={contract?.status === 'analyzed' ? 'default' : 
                      contract?.status === 'processing' ? 'secondary' : 'outline'}
              data-testid="badge-contract-status"
            >
              {contract?.status}
            </Badge>
            {approvalState && (
              <Badge
                variant="outline"
                className={
                  approvalState === 'approved'
                    ? 'border-green-300 text-green-700 dark:border-green-800 dark:text-green-400'
                    : approvalState === 'rejected'
                      ? 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-400'
                      : approvalState === 'superseded'
                        ? 'border-gray-300 text-gray-500 dark:border-gray-700 dark:text-gray-400 line-through'
                        : approvalState === 'draft'
                          ? 'border-stone-300 text-stone-700 dark:border-stone-700 dark:text-stone-300'
                          : 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400'
                }
                data-testid="badge-approval-state"
              >
                {approvalState === 'approved' ? 'Approved'
                  : approvalState === 'rejected' ? 'Rejected'
                  : approvalState === 'superseded' ? 'Superseded'
                  : approvalState === 'draft' ? 'Draft'
                  : 'Pending approval'}
                {` · ${versionLabel}`}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={
                isProcessing
                  ? 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-800 dark:text-orange-300'
                  : hasFailed
                    ? 'border-red-300 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-300'
                    : lifecycleLower === 'active'
                      ? 'border-green-300 text-green-700 dark:border-green-800 dark:text-green-400'
                      : lifecycleLower === 'pending'
                        ? 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400'
                        : lifecycleLower === 'expired' || lifecycleLower === 'terminated'
                          ? 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-400'
                          : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400'
              }
              data-testid="badge-active-state"
            >
              {isProcessing ? 'Processing…' : hasFailed ? 'Failed' : (lifecycleStatus || 'Draft')}
            </Badge>
            {ruleReadiness.total > 0 && (
              <Badge
                variant="outline"
                className={
                  ruleReadiness.isReady
                    ? 'border-green-300 text-green-700 dark:border-green-800 dark:text-green-400'
                    : 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400'
                }
                data-testid="badge-rule-readiness"
                title={ruleReadiness.isReady
                  ? 'All active rules approved — ready to calculate'
                  : `${ruleReadiness.pending} rule(s) need sign-off${ruleReadiness.rejected > 0 ? `, ${ruleReadiness.rejected} rejected` : ''}`}
              >
                {ruleReadiness.approved}/{ruleReadiness.total} rules approved
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              onClick={() => setLocation(`/contracts/${id}/manage`)} 
              data-testid="button-edit-contract"
              variant="outline"
              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-500 dark:hover:bg-stone-950"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Contract
            </Button>
            <Button 
              onClick={handleManageRules} 
              data-testid="button-manage-rules"
              variant="outline"
              className="border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-900 dark:text-orange-500 dark:hover:bg-stone-950"
            >
              <ListChecks className="h-4 w-4 mr-2" />
              Manage Contract Fee Rules
            </Button>

            {/* Sample Data dropdown — pulls the static format guides keyed
                off this contract's flow type. Lets the user grab a clean,
                column-correct CSV for any of the four ingestion kinds. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  data-testid="button-sample-data"
                  className="border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Sample Data
                  <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Format guides
                </DropdownMenuLabel>
                {[
                  { kind: "sales", label: "Sales sample" },
                  { kind: "credit_memos", label: "Credit memos sample" },
                  { kind: "pos", label: "POS sample" },
                  { kind: "po_receipts", label: "PO receipts sample" },
                ].map((s) => (
                  <DropdownMenuItem key={s.kind} asChild>
                    <a
                      href={`/api/contracts/${id}/sample/${s.kind}`}
                      data-testid={`link-contract-sample-${s.kind}`}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {s.label}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Contract action menu — Save-as-Template lives here per spec. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  data-testid="button-contract-actions"
                  className="border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  <MoreHorizontal className="h-4 w-4 mr-2" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  data-testid="button-save-as-template"
                  onSelect={async () => {
                    if (!tplName) {
                      const c = (contract ?? {}) as { flowTypeCode?: string; contractType?: string };
                      const flowCode = c.flowTypeCode || c.contractType || 'RLA';
                      const flowEntry = contractTypesList.find((ct) => ct.code === flowCode);
                      const flowName = flowEntry?.name || flowCode;
                      let nextN = 1;
                      try {
                        const resp = await fetch(`/api/contract-templates?flow=${encodeURIComponent(flowCode)}`, { credentials: 'include' });
                        if (resp.ok) {
                          const data = await resp.json();
                          const list: Array<{ name?: string }> = data?.templates ?? [];
                          const re = new RegExp(`^${flowName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s+Copy\\s+(\\d+)$`, 'i');
                          const used = list
                            .map((t) => (t.name ?? '').match(re))
                            .filter((m): m is RegExpMatchArray => !!m)
                            .map((m) => parseInt(m[1], 10))
                            .filter((n) => Number.isFinite(n));
                          nextN = used.length ? Math.max(...used) + 1 : 1;
                        }
                      } catch {
                        // naming collision is non-fatal; user can edit before submit
                      }
                      setTplName(`${flowName} Copy ${nextN}`);
                    }
                    setSaveAsTemplateOpen(true);
                  }}
                >
                  <Library className="h-3.5 w-3.5 mr-2" />
                  Save as Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>


            {deleteDialogOpen && (
              <div className="mt-2 p-4 border rounded-lg bg-muted/50 border-destructive/30">
                <p className="font-semibold text-red-600">Delete Contract & All Related Data</p>
                <div className="space-y-3 mt-2">
                  <p className="font-semibold text-foreground">
                    Are you sure you want to delete "{contract?.originalName}"?
                  </p>
                  <p className="text-red-600 font-medium">
                    This action cannot be undone and will permanently delete:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-foreground bg-red-50 dark:bg-red-950 p-3 rounded-md">
                    <li>Contract file and AI analysis</li>
                    <li>All contract fee rules and formulas</li>
                    <li>All sales data</li>
                    <li>All contract fee calculations and history</li>
                    <li>Contract embeddings and AI data</li>
                    <li>All audit trail records</li>
                  </ul>
                  <p className="text-sm text-muted-foreground italic">
                    You can always re-upload the contract PDF to extract rules again.
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Everything"}
                  </Button>
                </div>
              </div>
            )}


            {showContractInfo && (
              <div className="mt-2 p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/30 border-orange-300/50">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-5 w-5 text-sky-500" />
                  <p className="font-semibold">Contract Information</p>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">File Name</span>
                    <span className="font-medium text-right max-w-[60%] truncate" data-testid="text-info-filename">{contract?.originalName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">File Size</span>
                    <span data-testid="text-info-filesize">{(() => { const bytes = contract?.fileSize || 0; if (bytes < 1024) return bytes + ' B'; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / 1024 / 1024).toFixed(1) + ' MB'; })()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Contract Type</span>
                    <span data-testid="text-info-type">{getContractTypeLabel(contract?.contractType, contractTypesList)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="capitalize" data-testid="text-info-status">{contract?.status}</Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Priority</span>
                    <Badge variant="outline" className="capitalize" data-testid="text-info-priority">{contract?.priority}</Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Upload Date</span>
                    <span data-testid="text-info-upload-date">{formatDateUSA(contract?.createdAt)}</span>
                  </div>
                  {contract?.uploadedByUser && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Uploaded By</span>
                      <span data-testid="text-info-uploaded-by">
                        {contract?.uploadedByUser?.firstName && contract?.uploadedByUser?.lastName
                          ? `${contract.uploadedByUser.firstName} ${contract.uploadedByUser.lastName}`
                          : contract?.uploadedByUser?.email
                        }
                      </span>
                    </div>
                  )}
                  {analysis?.processingTime && analysis.processingTime > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Processing Time</span>
                      <span data-testid="text-info-processing-time">{analysis.processingTime}s</span>
                    </div>
                  )}
                  <div className="pt-3 flex gap-2">
                    <input
                      ref={replacePdfInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      data-testid="input-replace-pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) replacePdfMutation.mutate(file);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      data-testid="button-replace-pdf"
                      disabled={replacePdfMutation.isPending}
                      onClick={() => replacePdfInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {replacePdfMutation.isPending ? 'Uploading...' : 'Replace PDF'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      data-testid="button-view-original-info"
                      onClick={() => window.open(`/api/contracts/${id}/file`, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Original
                    </Button>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowContractInfo(false)}>Close</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!hasAnalysis ? (
          /* Processing State */
          <Card>
            <CardContent className="text-center py-12">
              {contract?.status === 'failed' ? (
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              ) : (
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4" />
              )}
              <h3 className="text-lg font-medium mb-2">
                {contract?.status === 'processing' ? 'Analysis in Progress' 
                  : contract?.status === 'failed' ? 'Analysis Failed'
                  : 'Waiting for Analysis'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {contract?.status === 'processing' 
                  ? 'Our AI is analyzing your contract. This usually takes 30-60 seconds.'
                  : contract?.status === 'failed'
                  ? 'The AI analysis encountered an issue. You can try reprocessing the contract.'
                  : 'Analysis will begin shortly.'
                }
              </p>
              <div className="flex gap-3 justify-center">
                {contract?.status === 'failed' && (
                  <Button 
                    onClick={handleReprocess} 
                    disabled={reprocessMutation.isPending}
                    data-testid="button-reprocess-failed"
                  >
                    {reprocessMutation.isPending ? "Reprocessing..." : "Reprocess Contract"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setLocation("/contracts")}>
                  Back to Contracts
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Analysis Results */
          <div className="space-y-6">
            {/* Key Contract Details - Top Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Parties Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contract Parties
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Company</p>
                    <div className="text-sm font-medium" data-testid="text-licensor">
                      {contractDetails.licensor ? (
                        <ErpValueDisplay value={contractDetails.licensor} erpValueMap={erpValueMap} erpMappingInfoMap={erpMappingInfoMap} />
                      ) : "Not identified"}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{contractDetails.party2Label || 'Counter Party'}</p>
                    <div className="text-sm font-medium" data-testid="text-licensee">
                      {contractDetails.licensee ? (
                        <ErpValueDisplay value={contractDetails.licensee} erpValueMap={erpValueMap} erpMappingInfoMap={erpMappingInfoMap} />
                      ) : "Not identified"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key Dates Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Key Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Start Date</p>
                    <p className="text-sm font-medium" data-testid="text-start-date">
                      {contractDetails.startDate || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">End Date</p>
                    <p className="text-sm font-medium" data-testid="text-end-date">
                      {contractDetails.endDate || "Not specified"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Terms Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Financial Terms
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Payment Terms</p>
                    <p className="text-sm font-medium" data-testid="text-payment-terms">
                      {contractDetails.paymentTerms || "Not specified"}
                    </p>
                  </div>
                  {contractDetails.contractValue && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Contract Value</p>
                      <p className="text-sm font-medium" data-testid="text-contract-value">
                        {contractDetails.contractValue}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Agreement Type Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Agreement Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Agreement Type</p>
                    <p className="text-sm font-medium" data-testid="text-agreement-type">
                      {contractDetails.agreementType || getContractTypeLabel(contract?.contractType, contractTypesList) || contract?.contractType || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Territory</p>
                    <div className="text-sm font-medium" data-testid="text-jurisdiction">
                      {contractDetails.territory ? (
                        <ErpValueDisplay value={contractDetails.territory} erpValueMap={erpValueMap} erpMappingInfoMap={erpMappingInfoMap} columnFieldName="territory_name" />
                      ) : "Not specified"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="w-full">
            {/* Main Analysis Panel */}
            <div className="space-y-6">
              <Tabs
                value={activeAnalysisTab}
                onValueChange={(value) => {
                  setActiveAnalysisTab(value);
                  if (hasContractDocument) {
                    if (value === "risks" && (!analysis?.riskAnalysis || analysis.riskAnalysis.length === 0)) {
                      triggerSectionAnalysis("risks");
                    } else if (value === "insights" && (!analysis?.insights || analysis.insights.length === 0)) {
                      triggerSectionAnalysis("insights");
                    } else if (value === "summary" && (!analysis?.summary || analysis.summary.length < 200 || analysis.summary.includes("being generated in the background"))) {
                      triggerSectionAnalysis("summary");
                    }
                  }
                }}
                data-testid="tabs-analysis"
              >
                <TabsList className="w-full justify-start" data-testid="tabs-list-analysis">
                  <TabsTrigger value="summary" data-testid="tab-trigger-summary" className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    AI Summary
                  </TabsTrigger>
                  <TabsTrigger value="risks" data-testid="tab-trigger-risks" className="flex items-center gap-2">
                    {loadingSection === "risks" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                    Risk Analysis
                    {loadingSection === "risks" && (
                      <span className="text-xs text-muted-foreground ml-1">Generating...</span>
                    )}
                    {analysis?.riskAnalysis && analysis.riskAnalysis.length > 0 && !loadingSection && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs" data-testid="badge-risks-count">
                        {analysis.riskAnalysis.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="insights" data-testid="tab-trigger-insights" className="flex items-center gap-2">
                    {loadingSection === "insights" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}
                    Business Insights
                    {loadingSection === "insights" && (
                      <span className="text-xs text-muted-foreground ml-1">Generating...</span>
                    )}
                    {analysis?.insights && analysis.insights.length > 0 && !loadingSection && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs" data-testid="badge-insights-count">
                        {analysis.insights.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="clauses" data-testid="tab-trigger-clauses" className="flex items-center gap-2">
                    <ListOrdered className="h-4 w-4" />
                    Clauses
                    {clauses.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">{clauses.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="rules" data-testid="tab-trigger-rules-view" className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Rules
                  </TabsTrigger>
                  <TabsTrigger value="partners" data-testid="tab-trigger-partners" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Partners
                    {partners.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">{partners.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="policies" data-testid="tab-trigger-policies" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Policies
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="summary" data-testid="tab-content-summary">
                  <Card>
                    <CardContent className="pt-6">
                      {analysis?.summary && analysis.summary.length >= 200 && !analysis.summary.includes("being generated in the background") ? (
                        (() => {
                          const summaryText = analysis.summary as string;
                          const paragraphs = summaryText.split(/\n\n+/).filter((p: string) => p.trim().length > 0);
                          const effectiveParagraphs = paragraphs.length >= 2 ? paragraphs : (() => {
                            const sentences = summaryText.split(/(?<=[.!?])\s+/);
                            const mid = Math.ceil(sentences.length / 2);
                            return [sentences.slice(0, mid).join(' '), sentences.slice(mid).join(' ')].filter(p => p.trim());
                          })();

                          return (
                            <div className="space-y-5" data-testid="summary-formatted">
                              <div className="space-y-4">
                                {effectiveParagraphs.map((para: string, idx: number) => (
                                  <div key={idx} className="flex gap-3">
                                    <div className="flex-shrink-0 mt-1">
                                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${idx === 0 ? 'bg-orange-100 dark:bg-orange-950/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                                        {idx === 0 ? (
                                          <FileText className={`h-4 w-4 ${idx === 0 ? 'text-orange-700 dark:text-orange-500' : 'text-emerald-600 dark:text-emerald-400'}`} />
                                        ) : (
                                          <Calculator className={`h-4 w-4 text-emerald-600 dark:text-emerald-400`} />
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="text-sm font-semibold text-foreground mb-1">
                                        {idx === 0 ? 'Agreement Overview' : 'Financial Structure'}
                                      </h4>
                                      <p className="text-sm text-muted-foreground leading-relaxed">{para.trim()}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()
                      ) : !hasContractDocument ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <AlertTriangle className="h-8 w-8 text-orange-400" />
                          <p className="text-sm font-medium">No Contract Document Available</p>
                          <p className="text-xs text-muted-foreground text-center max-w-md">AI analysis requires a contract document. Upload a document to enable the AI summary.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            data-testid="btn-upload-doc-summary"
                            disabled={replacePdfMutation.isPending}
                            onClick={() => replacePdfInputRef.current?.click()}
                          >
                            {replacePdfMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4 mr-2" /> Upload Document</>}
                          </Button>
                        </div>
                      ) : loadingSection === "summary" ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Generating AI summary...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <Lightbulb className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">AI summary has not been generated yet.</p>
                          <Button variant="outline" size="sm" className="mt-2" data-testid="btn-generate-summary" disabled={analysisSectionMutation.isPending} onClick={() => triggerSectionAnalysis("summary")}>
                            {analysisSectionMutation.isPending && loadingSection === "summary" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Lightbulb className="h-4 w-4 mr-2" /> Generate AI Summary</>}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="risks" data-testid="tab-content-risks">
                  <Card>
                    <CardContent className="pt-6">
                      {analysis?.riskAnalysis && analysis.riskAnalysis.length > 0 ? (
                        <div className="space-y-4">
                          {analysis.riskAnalysis.map((risk: any, index: number) => (
                            <div key={index} className={`p-4 rounded-lg border ${getRiskLevelColor(risk.level)}`}>
                              <div className="flex items-start space-x-3">
                                <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <AlertTriangle className="h-4 w-4" />
                                </div>
                                <div>
                                  <span className="font-medium capitalize">{risk.level} Risk - {risk.title}</span>
                                  <p className="text-sm mt-1">{risk.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : !hasContractDocument ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <AlertTriangle className="h-8 w-8 text-orange-400" />
                          <p className="text-sm font-medium">No Contract Document Available</p>
                          <p className="text-xs text-muted-foreground text-center max-w-md">AI analysis requires a contract document. Upload a document to enable risk analysis.</p>
                          <Button variant="outline" size="sm" className="mt-2" data-testid="btn-upload-doc-risks" disabled={replacePdfMutation.isPending} onClick={() => replacePdfInputRef.current?.click()}>
                            {replacePdfMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4 mr-2" /> Upload Document</>}
                          </Button>
                        </div>
                      ) : analysisSectionMutation.isPending ? (
                        <div className="space-y-4">
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <Shield className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Risk analysis has not been generated yet.</p>
                          <Button variant="outline" size="sm" className="mt-2" data-testid="btn-generate-risks" disabled={analysisSectionMutation.isPending} onClick={() => triggerSectionAnalysis("risks")}>
                            {analysisSectionMutation.isPending && loadingSection === "risks" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Shield className="h-4 w-4 mr-2" /> Generate Risk Analysis</>}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="insights" data-testid="tab-content-insights">
                  <Card>
                    <CardContent className="pt-6">
                      {analysis?.insights && analysis.insights.length > 0 ? (
                        <div className="space-y-4">
                          {analysis.insights.map((insight: any, index: number) => (
                            <div key={index} className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                              <div className="flex items-start space-x-3">
                                <div className="h-8 w-8 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Lightbulb className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-orange-950 dark:text-orange-100">{insight.title}</h4>
                                  <p className="text-sm text-orange-800 dark:text-orange-300 mt-1">{insight.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : !hasContractDocument ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <AlertTriangle className="h-8 w-8 text-orange-400" />
                          <p className="text-sm font-medium">No Contract Document Available</p>
                          <p className="text-xs text-muted-foreground text-center max-w-md">AI analysis requires a contract document. Upload a document to enable business insights.</p>
                          <Button variant="outline" size="sm" className="mt-2" data-testid="btn-upload-doc-insights" disabled={replacePdfMutation.isPending} onClick={() => replacePdfInputRef.current?.click()}>
                            {replacePdfMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4 mr-2" /> Upload Document</>}
                          </Button>
                        </div>
                      ) : analysisSectionMutation.isPending ? (
                        <div className="space-y-4">
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <TrendingUp className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Business insights have not been generated yet.</p>
                          <Button variant="outline" size="sm" className="mt-2" data-testid="btn-generate-insights" disabled={analysisSectionMutation.isPending} onClick={() => triggerSectionAnalysis("insights")}>
                            {analysisSectionMutation.isPending && loadingSection === "insights" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Lightbulb className="h-4 w-4 mr-2" /> Generate Business Insights</>}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>



                <TabsContent value="clauses" data-testid="tab-content-clauses">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ListOrdered className="h-5 w-5 text-orange-600" />
                        Contract Clauses
                        {clauses.length > 0 && <Badge variant="secondary">{clauses.length}</Badge>}
                      </CardTitle>
                      <CardDescription>Extracted and defined clauses</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {clauses.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No clauses defined yet</p>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-3 font-medium">ID</th>
                                <th className="text-left p-3 font-medium">Section</th>
                                <th className="text-left p-3 font-medium">Text</th>
                                <th className="text-left p-3 font-medium">Category</th>
                                <th className="text-left p-3 font-medium">Flow Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clauses.map((clause: any, idx: number) => (
                                <tr key={clause.id || idx} className="border-t">
                                  <td className="p-3 font-mono text-xs">{clause.clauseIdentifier || clause.clause_identifier || '-'}</td>
                                  <td className="p-3">{clause.sectionRef || clause.section_ref || '-'}</td>
                                  <td className="p-3 max-w-md truncate">{clause.text || '-'}</td>
                                  <td className="p-3">{clause.clauseCategoryCode || clause.clause_category_code || '-'}</td>
                                  <td className="p-3">{clause.flowTypeCode || clause.flow_type_code || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="rules" data-testid="tab-content-rules-view">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-orange-600" />
                        Contract Fee Rules
                      </CardTitle>
                      <CardDescription>Fee calculation rules defined for this contract</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const rulesList = contractRulesData?.rules || (Array.isArray(contractRulesData) ? contractRulesData : []);
                        if (rulesList.length === 0) return <p className="text-muted-foreground text-center py-8">No rules defined yet</p>;
                        return (
                          <div className="space-y-3">
                            {rulesList.map((rule: any, idx: number) => (
                              <div key={rule.id || idx} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full shadow-sm ring-2 ring-white dark:ring-gray-800 ${
                                      rule.reviewStatus === 'verified' ? 'bg-green-500' :
                                      rule.reviewStatus === 'under_review' ? 'bg-yellow-400' :
                                      rule.reviewStatus === 'rejected' ? 'bg-gray-400' : 'bg-red-500'
                                    }`} title={
                                      rule.reviewStatus === 'verified' ? 'Verified' :
                                      rule.reviewStatus === 'under_review' ? 'Under Review' :
                                      rule.reviewStatus === 'rejected' ? 'Rejected' : 'AI Extracted'
                                    } />
                                    <h4 className="font-medium">{rule.ruleName || rule.rule_name || `Rule ${idx + 1}`}</h4>
                                  </div>
                                  <div className="flex gap-2">
                                    {rule.ruleType && <Badge variant="outline">{rule.ruleType}</Badge>}
                                    <Badge variant={rule.isActive !== false ? "default" : "secondary"}>{rule.isActive !== false ? "Active" : "Inactive"}</Badge>
                                    <Badge variant="outline" className={`text-xs ${
                                      rule.reviewStatus === 'verified' ? 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800' :
                                      rule.reviewStatus === 'under_review' ? 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950 dark:border-yellow-800' :
                                      rule.reviewStatus === 'rejected' ? 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900 dark:border-gray-700' :
                                      'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800'
                                    }`}>{
                                      rule.reviewStatus === 'verified' ? 'Verified' :
                                      rule.reviewStatus === 'under_review' ? 'Under Review' :
                                      rule.reviewStatus === 'rejected' ? 'Rejected' : 'AI Extracted'
                                    }</Badge>
                                  </div>
                                </div>
                                {(rule.description || rule.calculationFormula) && (
                                  <p className="text-sm text-muted-foreground">{rule.description || rule.calculationFormula}</p>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                                  {rule.baseRate != null && (
                                    <div>
                                      <p className="text-xs text-muted-foreground">Base Rate</p>
                                      <p className="font-medium">{rule.baseRate}%</p>
                                    </div>
                                  )}
                                  {rule.minimumGuarantee != null && (
                                    <div>
                                      <p className="text-xs text-muted-foreground">Minimum Guarantee</p>
                                      <p className="font-medium">${Number(rule.minimumGuarantee).toLocaleString()}</p>
                                    </div>
                                  )}
                                  {rule.territories && rule.territories.length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground">Territories</p>
                                      <p className="font-medium">{rule.territories.join(', ')}</p>
                                    </div>
                                  )}
                                  {rule.productCategories && rule.productCategories.length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground">Products</p>
                                      <p className="font-medium">{rule.productCategories.join(', ')}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="partners" data-testid="tab-content-partners">
                  <PartyAssignmentsReadOnly contractId={id!} partners={partners} />
                </TabsContent>

                <TabsContent value="policies" data-testid="tab-content-policies">
                  <ContractPoliciesViewTab contractId={id!} contract={contract} />
                </TabsContent>

              </Tabs>

              {/* Extracted Text from PDF - Like ChatGPT */}
              {contract?.rawText && (
                <Card>
                  <CardHeader 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExtractedTextExpanded(!extractedTextExpanded)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <ScrollText className="h-5 w-5 text-orange-600" />
                        Extracted Text from PDF
                        <Badge variant="outline" className="ml-2">
                          {contract.rawText.length.toLocaleString()} chars
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(contract.rawText || '');
                            toast({
                              title: "Copied",
                              description: "Full text copied to clipboard",
                            });
                          }}
                          data-testid="button-copy-extracted-text"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                        {extractedTextExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {extractedTextExpanded && (
                    <CardContent>
                      <div 
                        className="bg-muted/30 rounded-lg p-4 max-h-[600px] overflow-y-auto font-mono text-sm whitespace-pre-wrap border"
                        data-testid="text-extracted-content"
                      >
                        {contract.rawText}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* AI Mapping Suggestions - Hidden from contract view */}

              {/* Dynamic Extraction Results - HIDDEN */}
              {false && extractionRuns && extractionRuns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Network className="h-5 w-5 text-purple-500" />
                      AI Dynamic Extraction
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {extractionRuns.slice(0, 3).map((run: any) => (
                      <div key={run.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={run.status === 'completed' ? 'default' : run.status === 'processing' ? 'secondary' : 'destructive'}>
                            {run.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {run.createdAt ? formatDistanceToNow(new Date(run.createdAt), { addSuffix: true }) : 'recently'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Confidence</p>
                            <p className="font-medium">{run.overallConfidence ? Math.round(Number(run.overallConfidence) * 100) : '0'}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Entities</p>
                            <p className="font-medium">{run.nodesExtracted || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Rules</p>
                            <p className="font-medium">{run.rulesExtracted || 0}</p>
                          </div>
                        </div>
                        {run.validationResults && run.validationResults.issues && run.validationResults.issues.length > 0 && (
                          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-sm">
                            <p className="text-amber-800 dark:text-amber-200">
                              {run.validationResults.issues.length} validation {run.validationResults.issues.length === 1 ? 'issue' : 'issues'} found
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    {dynamicRules && dynamicRules.length > 0 && (
                      <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                          Dynamically Extracted Rules ({dynamicRules.length})
                        </h4>
                        <div className="space-y-2">
                          {dynamicRules.slice(0, 3).map((rule: any) => (
                            <div key={rule.id} className="flex items-center justify-between text-sm">
                              <span className="text-purple-800 dark:text-purple-200">{rule.ruleName}</span>
                              <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                                {rule.isActive ? 'Active' : 'Pending Review'}
                              </Badge>
                            </div>
                          ))}
                          {dynamicRules.length > 3 && (
                            <p className="text-sm text-muted-foreground italic">
                              + {dynamicRules.length - 3} more rules
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Enhanced Fee Rules Editor - HIDDEN */}
              {false && (
                <ContractRulesEditor 
                  contractId={id || ''}
                  ruleSets={contractRulesData?.ruleSets || []}
                  onRulesUpdate={() => {
                    // Refetch rules when they're updated
                    queryClient.invalidateQueries({ queryKey: ['/api/contracts', id, 'rules'] });
                  }}
                  onReprocess={handleReprocess}
                />
              )}

              {/* Combined Rules View - Shows both manual and ERP-generated rules */}
              <CombinedRulesView contractId={id || ''} />

            </div>
          </div>
          </div>
        )}
      </div>

      {/* Save-as-template dialog. Hosted at the page root so it overlays
          everything else and survives tab switches. Submits to
          POST /api/contracts/:id/save-as-template (saveAsTemplateMutation). */}
      <Dialog open={saveAsTemplateOpen} onOpenChange={setSaveAsTemplateOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-save-as-template">
          <DialogHeader>
            <DialogTitle className="text-base">Save as Template</DialogTitle>
            <DialogDescription className="text-xs">
              Snapshots this contract's rules and clauses so you (or your team)
              can spin up similar contracts in one click.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name" className="text-xs font-medium">
                Template name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tpl-name"
                data-testid="input-template-name"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="e.g. Standard Distributor Rebate Program"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc" className="text-xs font-medium">
                Description <span className="text-zinc-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="tpl-desc"
                data-testid="input-template-description"
                value={tplDescription}
                onChange={(e) => setTplDescription(e.target.value.slice(0, 280))}
                rows={2}
                className="text-sm resize-none"
                placeholder="When and why someone would pick this template…"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Snapshot scope</Label>
              <RadioGroup
                value={tplScope}
                onValueChange={(v) => setTplScope(v as typeof tplScope)}
                className="grid grid-cols-3 gap-2"
              >
                {([
                  { v: "minimal",  label: "Minimal",  hint: "Rules + clauses" },
                  { v: "standard", label: "Standard", hint: "+ party role slots" },
                  { v: "maximal",  label: "Maximal",  hint: "+ accrual policies + sales sample CSV" },
                ] as const).map((s) => (
                  <label
                    key={s.v}
                    htmlFor={`tpl-scope-${s.v}`}
                    className={`flex flex-col gap-1 rounded-md border p-2 cursor-pointer text-xs ${
                      tplScope === s.v
                        ? "border-orange-300 bg-orange-50/60"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                    data-testid={`radio-template-scope-${s.v}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem id={`tpl-scope-${s.v}`} value={s.v} />
                      <span className="font-medium">{s.label}</span>
                    </div>
                    <span className="text-[10.5px] text-zinc-500 leading-snug">{s.hint}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Visibility</Label>
              <RadioGroup
                value={tplVisibility}
                onValueChange={(v) => setTplVisibility(v as typeof tplVisibility)}
                className="grid grid-cols-2 gap-2"
              >
                {([
                  { v: "private", label: "Private",        hint: "Only you can use it" },
                  { v: "public",  label: "My Company",     hint: "Visible to everyone in your org" },
                ] as const).map((s) => (
                  <label
                    key={s.v}
                    htmlFor={`tpl-vis-${s.v}`}
                    className={`flex flex-col gap-1 rounded-md border p-2 cursor-pointer text-xs ${
                      tplVisibility === s.v
                        ? "border-orange-300 bg-orange-50/60"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                    data-testid={`radio-template-visibility-${s.v}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem id={`tpl-vis-${s.v}`} value={s.v} />
                      <span className="font-medium">{s.label}</span>
                    </div>
                    <span className="text-[10.5px] text-zinc-500 leading-snug">{s.hint}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveAsTemplateOpen(false)}
              disabled={saveAsTemplateMutation.isPending}
              data-testid="button-cancel-save-template"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={!tplName.trim() || saveAsTemplateMutation.isPending}
              onClick={() => saveAsTemplateMutation.mutate()}
              data-testid="button-confirm-save-template"
            >
              {saveAsTemplateMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</>
              ) : (
                <><Library className="h-3.5 w-3.5 mr-1.5" /> Save Template</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function PartyAssignmentsReadOnly({ contractId, partners }: { contractId: string; partners: any[] }) {
  const { data: roleCatalog } = useQuery<any>({
    queryKey: ['/api/party-roles/catalog'],
    queryFn: () => fetch('/api/party-roles/catalog', { credentials: 'include' }).then(r => r.json()),
  });
  const { data: requiredRoles } = useQuery<any>({
    queryKey: ['/api/contracts', contractId, 'required-roles'],
    queryFn: () => fetch(`/api/contracts/${contractId}/required-roles`, { credentials: 'include' }).then(r => r.json()),
  });
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
  const fmt = (d: any) => d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-600" />
          Party Assignments
          {partners.length > 0 && <Badge variant="secondary">{partners.length}</Badge>}
        </CardTitle>
        <CardDescription>Parties assigned to this contract — used downstream by calculations, accruals, journal entries and settlement.</CardDescription>
      </CardHeader>
      <CardContent>
        {requiredRoles?.slots?.length ? (
          <div className="mb-4 rounded-md border bg-muted/30 p-3" data-testid="banner-required-roles">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required Roles for this Contract Type</div>
              <div className="text-xs text-muted-foreground">{(requiredRoles.slots.filter((s: any) => s.required).length - (requiredRoles.missing?.length || 0))} / {requiredRoles.slots.filter((s: any) => s.required).length} filled</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {requiredRoles.slots.map((s: any) => {
                const isMissing = (requiredRoles.missing || []).some((m: any) => m.role === s.role);
                return (
                  <Badge key={s.role} variant="outline" className={`text-[11px] ${isMissing && s.required ? 'border-red-300 text-red-700 bg-red-50' : 'border-green-300 text-green-700 bg-green-50'}`} data-testid={`badge-required-${s.role}`}>
                    {isMissing ? '○' : '✓'} {s.label}{s.required ? ' (required)' : ''}
                  </Badge>
                );
              })}
            </div>
          </div>
        ) : null}

        {partners.length === 0 ? (
          <p className="text-muted-foreground text-center py-8" data-testid="text-no-parties">No parties assigned yet</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Party</th>
                  <th className="text-left p-3 font-medium">Kind</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Effective</th>
                  <th className="text-left p-3 font-medium">Primary</th>
                  <th className="text-left p-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p: any, idx: number) => {
                  const aId = p.assignment_id || p.assignmentId || idx;
                  const kind = p.party_kind || p.partyKind || (p.company_id ? 'organization' : 'partner');
                  const role = p.party_role || p.partyRole;
                  const effStart = p.effective_start || p.effectiveStart;
                  const effEnd = p.effective_end || p.effectiveEnd;
                  const isPrimary = p.is_primary ?? p.isPrimary;
                  return (
                    <tr key={aId} className="border-t" data-testid={`row-party-${aId}`}>
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span data-testid={`text-party-name-${aId}`}>{p.resolved_name || p.partner_name || p.partner_id || p.raw_value || '—'}</span>
                          {linkBadge(p.link_status)}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] capitalize">{kind === 'organization' ? 'Internal' : 'External'}</Badge>
                      </td>
                      <td className="p-3">
                        {role ? (
                          <Badge variant="outline" className={`text-[11px] ${roleChipClass(role)}`} data-testid={`badge-role-${aId}`}>{roleLabel(role)}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(effStart)}{effStart || effEnd ? ' → ' : ''}{effEnd ? fmt(effEnd) : (effStart ? 'open' : '')}</td>
                      <td className="p-3">
                        {isPrimary ? <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">Primary</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 max-w-xs truncate text-xs">{p.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContractPoliciesViewTab({ contractId, contract }: { contractId: string; contract: any }) {
  const [policySection, setPolicySection] = useState('financial-policies');

  const { data: companySettings } = useQuery<any>({ queryKey: ['/api/settings/company'] });
  const { data: contractTypes } = useQuery<any[]>({ queryKey: ['/api/contract-types'] });

  const contractType = contractTypes?.find((t: any) => t.code === contract?.contractType);

  const getEffective = (policyKey: string, field: string, defaultValue: any) => {
    const contractPol = contract?.[policyKey];
    if (contractPol && field in contractPol) return { value: contractPol[field], source: 'Contract' };
    const typePol = contractType?.[policyKey];
    if (typePol && field in typePol) return { value: typePol[field], source: contractType?.name || 'Contract Type' };
    const compPol = companySettings?.[policyKey];
    if (compPol && field in compPol) return { value: compPol[field], source: 'Company' };
    return { value: defaultValue, source: 'System Default' };
  };

  const formatValue = (val: any) => {
    if (typeof val === 'string') return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return String(val);
  };

  const PolicyRow = ({ label, policyKey, field, defaultValue }: { label: string; policyKey: string; field: string; defaultValue: any }) => {
    const { value, source } = getEffective(policyKey, field, defaultValue);
    return (
      <div className="flex items-center justify-between py-3 border-b last:border-b-0" data-testid={`policy-view-${policyKey}-${field}`}>
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm">{formatValue(value)}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
            source === 'Contract' ? 'text-green-600 border-green-300' :
            source === 'Company' ? 'text-blue-600 border-blue-300' :
            source === 'System Default' ? 'text-gray-500 border-gray-300' :
            'text-orange-600 border-orange-300'
          }`}>
            {source}
          </Badge>
        </div>
      </div>
    );
  };

  const sections = [
    { key: 'financial-policies', label: 'Financial Policies', icon: DollarSign },
    { key: 'period-management', label: 'Period Management', icon: Calendar },
    { key: 'dataset-control', label: 'Dataset Control', icon: Database },
    { key: 'settlement-payment', label: 'Settlement & Payment', icon: CreditCard },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration Policies
            </CardTitle>
            <CardDescription className="mt-1">
              Effective policy values for this contract (Company → Contract Type → Contract)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.href = `/contracts/${contractId}/manage?tab=policies`} data-testid="button-edit-policies">
            <Edit className="h-4 w-4 mr-1" />
            Edit Policies
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-50 dark:bg-blue-950/20 mb-4" data-testid="banner-policy-cascade">
          <Layers className="w-4 h-4 text-blue-600" />
          <span className="text-sm">
            <span className="font-medium">Inheritance:</span>{' '}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300">Company</Badge>
            {' → '}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300">{contractType?.name || 'Contract Type'}</Badge>
            {' → '}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300">Contract</Badge>
          </span>
        </div>

        <div className="flex gap-6">
          <div className="w-48 shrink-0 space-y-1">
            {sections.map(item => {
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
                  data-testid={`policy-view-tab-${item.key}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-0">
            {policySection === 'financial-policies' && (
              <div>
                <PolicyRow label="Cutoff Policy" policyKey="financialPolicies" field="cutoffPolicy" defaultValue="period_end" />
                <PolicyRow label="Rounding Method" policyKey="financialPolicies" field="roundingMethod" defaultValue="round_half_up" />
                <PolicyRow label="Accrual Mode" policyKey="financialPolicies" field="accrualMode" defaultValue="automatic" />
                <PolicyRow label="Payment Mode" policyKey="financialPolicies" field="paymentMode" defaultValue="net" />
                <PolicyRow label="FX Method" policyKey="financialPolicies" field="fxMethod" defaultValue="spot_rate" />
              </div>
            )}
            {policySection === 'period-management' && (
              <div>
                <PolicyRow label="Period Frequency" policyKey="periodPolicies" field="periodFrequency" defaultValue="monthly" />
                <PolicyRow label="Period Naming" policyKey="periodPolicies" field="periodNaming" defaultValue="calendar" />
              </div>
            )}
            {policySection === 'dataset-control' && (
              <div>
                <PolicyRow label="Completeness Threshold (%)" policyKey="datasetPolicies" field="completenessThreshold" defaultValue={95} />
                <PolicyRow label="Data Retention (Months)" policyKey="datasetPolicies" field="dataRetentionMonths" defaultValue={84} />
              </div>
            )}
            {policySection === 'settlement-payment' && (
              <div>
                <PolicyRow label="Payment Frequency" policyKey="settlementPolicies" field="defaultPaymentFrequency" defaultValue="monthly" />
                <PolicyRow label="Payment Terms (Days)" policyKey="settlementPolicies" field="paymentTermsDays" defaultValue={30} />
                <PolicyRow label="Settlement Method" policyKey="settlementPolicies" field="settlementMethod" defaultValue="check" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
