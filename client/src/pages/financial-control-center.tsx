import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { openLiqAI } from "@/components/liq-ai-panel";
import { apiRequest } from "@/lib/queryClient";
import {
  BarChart3, DollarSign, FileText, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, Activity, Shield, XCircle,
  CircleDot, Layers, Calculator, Calendar, ChevronRight,
  Lock, Zap, Search, Sparkles, ArrowRight,
  Upload, Bot, Wallet
} from "lucide-react";

type ObligationAgingSummary = {
  totals: Record<string, number>;
  countsByStatus: Record<string, number>;
  totalsByKind: Record<string, number>;
  totalsByPartner: Array<{ partnerName: string; total: number; count: number }>;
  totalOutstanding: number;
};

function formatCurrency(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

type PeriodType = 'monthly' | 'quarterly' | 'annual';

interface PeriodOption {
  value: string;
  label: string;
  type: PeriodType;
  startDate: Date;
  endDate: Date;
}

function generatePeriodOptions(): PeriodOption[] {
  const options: PeriodOption[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (let offset = 0; offset < 12; offset++) {
    const year = currentMonth - offset < 0 ? currentYear - 1 : currentYear;
    const month = ((currentMonth - offset) % 12 + 12) % 12;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const monthName = start.toLocaleString('en-US', { month: 'short' });
    options.push({
      value: `m-${year}-${String(month + 1).padStart(2, '0')}`,
      label: `${monthName} ${year}`,
      type: 'monthly',
      startDate: start,
      endDate: end,
    });
  }

  for (let offset = 0; offset < 4; offset++) {
    const q = Math.floor(currentMonth / 3) - offset;
    const year = q < 0 ? currentYear - 1 : currentYear;
    const quarter = ((q % 4) + 4) % 4;
    const startMonth = quarter * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    options.push({
      value: `q-${year}-Q${quarter + 1}`,
      label: `Q${quarter + 1} ${year}`,
      type: 'quarterly',
      startDate: start,
      endDate: end,
    });
  }

  return options;
}

function getCurrentMonthValue(): string {
  const now = new Date();
  return `m-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function PeriodSelector({ value, onChange, allowedTypes, className }: {
  value: string;
  onChange: (value: string) => void;
  allowedTypes: PeriodType[];
  className?: string;
}) {
  const allPeriods = useMemo(() => generatePeriodOptions(), []);
  const filteredPeriods = useMemo(() => allPeriods.filter(p => allowedTypes.includes(p.type)), [allPeriods, allowedTypes]);

  const groupedPeriods = useMemo(() => {
    const groups: Record<string, PeriodOption[]> = {};
    for (const p of filteredPeriods) {
      const groupLabel = p.type === 'monthly' ? 'Monthly' : p.type === 'quarterly' ? 'Quarterly' : 'Annual';
      if (!groups[groupLabel]) groups[groupLabel] = [];
      groups[groupLabel].push(p);
    }
    return groups;
  }, [filteredPeriods]);

  const selectedLabel = filteredPeriods.find(p => p.value === value)?.label || 'Select Period';

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-period">
          <SelectValue placeholder="Select period">{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groupedPeriods).map(([group, periods]) => (
            <div key={group}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group}</div>
              {periods.map(p => (
                <SelectItem key={p.value} value={p.value} data-testid={`period-option-${p.value}`}>
                  {p.label}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function getPeriodLabel(periodValue: string): string {
  const allPeriods = generatePeriodOptions();
  return allPeriods.find(p => p.value === periodValue)?.label || '';
}

const CONTRACT_CREATE_PATTERNS = [
  /^create\s+(a\s+)?contract/i,
  /^generate\s+(a\s+)?contract/i,
  /^make\s+(a\s+)?contract/i,
  /^new\s+contract/i,
  /^set\s+up\s+(a\s+)?contract/i,
  /^draft\s+(a\s+)?contract/i,
];

const SAMPLE_PROMPTS = {
  questions: [
    { icon: "📋", text: "What are my active contracts?" },
    { icon: "🧮", text: "Show pending calculations" },
    { icon: "📜", text: "Summarize contract fee rules" },
    { icon: "🔒", text: "What is blocking close?" },
    { icon: "⚠️", text: "Detect anomalies in accruals" },
    { icon: "📈", text: "Explain period variance" },
  ],
  contracts: [
    "Create a contract \"Distributor Reseller Agreement\" between Super Lenses Company and North West Distribution effective 03/03/2026 to 03/03/2029. Products: Headphones (SKU: SL-HP, MAP: $80 USD / $85 CAD) and Soundbars (SKU: SL-SB, MAP: $150 USD / $160 CAD). Territory: US and Canada. Volume rebate tiers: Tier 1 (0-1000 units) 2% of Net Sales, Tier 2 (1001-5000 units) 5% of Net Sales, Tier 3 (5001+ units) 8% of Net Sales. Rebates calculated retrospectively per quarter. Payment net 30 days.",
    "Create a contract \"TechSound Premium Audio License 2026\" for TechSound Audio Inc with BestBuy Electronics from 01/01/2026 to 12/31/2026. Products: Bluetooth Speakers (5% contract fee on net sales), Wireless Headphones (7% contract fee), and Studio Microphones (flat fee $3,000/month). Territories: United States, Canada, Mexico. Minimum annual guarantee $75,000. Quarterly payments due within 30 days.",
    "Create a contract \"Global Soundbar Distribution\" between TechSound Audio Inc and Pacific Rim Distributors from 06/01/2026 to 05/31/2028. Products: Home Theater Soundbars and Portable Speakers. Tiered contract fee: 3% on first $250,000 sales, 5% on $250,001-$750,000, 7% on sales above $750,000. Territory: Asia Pacific (Japan, South Korea, Australia). Minimum quarterly guarantee $15,000.",
  ],
};

function isContractCreationPrompt(text: string): boolean {
  return CONTRACT_CREATE_PATTERNS.some(pattern => pattern.test(text.trim()));
}

interface ChatMessage {
  role: string;
  content: string;
  sources?: any[];
  confidence?: number;
  contractId?: string;
  contractName?: string;
  rulesCreated?: number;
  isContractCreation?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  isContractCreation: boolean;
}

function generateConversationTitle(firstMessage: string, isContract: boolean): string {
  if (isContract) {
    const match = firstMessage.match(/"([^"]+)"/);
    if (match) return match[1];
    return "New Contract";
  }
  return firstMessage.length > 45 ? firstMessage.slice(0, 45) + "..." : firstMessage;
}

function LiQAgentTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const QUICK_ACTIONS = [
    { icon: "📋", text: "What are my active contracts?", category: "Contracts" },
    { icon: "🧮", text: "Show pending calculations", category: "Calculations" },
    { icon: "📜", text: "Summarize contract fee rules", category: "Rules" },
    { icon: "🔒", text: "What is blocking close?", category: "Period Close" },
    { icon: "⚠️", text: "Detect anomalies in accruals", category: "Accruals" },
    { icon: "📈", text: "Explain period variance", category: "Variance" },
    { icon: "💰", text: "What is total accrual exposure?", category: "Accruals" },
    { icon: "📊", text: "Show unposted journal entries", category: "Journal Entries" },
    { icon: "🔍", text: "Which contracts expire this quarter?", category: "Contracts" },
  ];

  const CONTRACT_ACTIONS = [
    { icon: "📝", text: SAMPLE_PROMPTS.contracts[0], label: "Create Distributor Agreement" },
    { icon: "🎧", text: SAMPLE_PROMPTS.contracts[1], label: "Create Audio License" },
    { icon: "🌏", text: SAMPLE_PROMPTS.contracts[2], label: "Create Global Distribution" },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (file.type !== 'application/pdf') return;

    const formData = new FormData();
    formData.append('file', file);
    try {
      await fetch('/api/contracts/upload', { method: 'POST', body: formData, credentials: 'include' });
      openLiqAI(`I just uploaded a contract PDF: ${file.name}. Please tell me about it once processing completes.`, true);
    } catch {
      openLiqAI(`I tried to upload ${file.name} but it failed. What should I do?`, true);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950">
      <input type="file" ref={fileInputRef} accept=".pdf,application/pdf" onChange={handleFileUpload} className="hidden" data-testid="input-liq-file-upload" />

      <div className="px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-[#ea580c] flex items-center justify-center mb-4">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">How can I help you today?</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
              Click any question below — answers appear in the liQ AI panel on the right
            </p>
          </div>

          <div className="mb-6">
            <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Quick Questions</div>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_ACTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => openLiqAI(q.text, true)}
                  className="text-left p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-orange-400 dark:hover:border-orange-600 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all group"
                  data-testid={`prompt-${i}`}
                >
                  <div className="text-sm mb-1">{q.icon}</div>
                  <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">{q.text}</div>
                  <div className="text-[9px] text-gray-400 mt-1.5 uppercase tracking-wider">{q.category}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Create a Contract</div>
            <div className="grid grid-cols-3 gap-2">
              {CONTRACT_ACTIONS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => openLiqAI(c.text, true)}
                  className="text-left p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-orange-400 dark:hover:border-orange-600 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all group"
                  data-testid={`contract-prompt-${i}`}
                >
                  <div className="text-sm mb-1">{c.icon}</div>
                  <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">{c.label}</div>
                  <div className="text-[9px] text-gray-400 mt-1.5 uppercase tracking-wider">AI Create</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-5 py-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-600 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-all"
            data-testid="button-liq-upload-welcome"
          >
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
              <Upload className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-left">
              <div className="text-xs font-medium text-orange-600 dark:text-orange-400">Click to upload a PDF contract</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Uses same processing pipeline as Upload & Process</div>
            </div>
          </button>

          <div className="mt-6 text-center">
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              All responses appear in the <span className="font-semibold text-orange-600">liQ AI</span> panel →
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineStrip({ snapshot, execution, risk, readiness }: { snapshot: any; execution: any; risk: any; readiness: any }) {
  const totalContracts = snapshot?.totalContracts || 0;
  const analyzed = snapshot?.activeContracts || 0;
  const calcsCompleted = execution?.totalCalculations || 0;
  const accruals = execution?.accrualsByFlow || { pending: 0, approved: 0 };
  const pendingAccruals = accruals.pending || 0;
  const journalsGenerated = execution?.journalStatus?.generated || 0;
  const journalsPending = Math.max(0, execution?.journalStatus?.pending || 0);
  const failedContracts = risk?.failedContracts || 0;

  const readinessItems = readiness ? [
    readiness.contractsProcessed, readiness.rulesExtracted, readiness.rulesValidated,
    readiness.calculationsRun, readiness.approvalsComplete, readiness.journalsGenerated,
  ] : [];
  const completedCount = readinessItems.filter((s: any) => s?.complete).length;
  const readinessScore = readinessItems.length > 0 ? Math.round((completedCount / readinessItems.length) * 100) : 0;

  const steps = [
    { label: 'Data Ingestion', status: totalContracts > 0 ? 'done' : 'idle', value: totalContracts > 0 ? '✓' : '—', color: totalContracts > 0 ? 'text-green-600' : 'text-gray-400', dot: totalContracts > 0 ? 'bg-green-500' : 'bg-gray-400', ai: 'Sales and POS data ingestion status' },
    { label: 'Contract Intelligence', status: analyzed > 0 ? 'done' : 'idle', value: analyzed > 0 ? '✓' : '—', color: analyzed > 0 ? 'text-green-600' : 'text-gray-400', dot: analyzed > 0 ? 'bg-green-500' : 'bg-gray-400', ai: 'Contract intelligence status' },
    { label: 'Calculation Engine', status: calcsCompleted > 0 ? 'done' : 'idle', value: calcsCompleted > 0 ? `${calcsCompleted} runs` : '—', color: calcsCompleted > 0 ? 'text-green-600' : 'text-gray-400', dot: calcsCompleted > 0 ? 'bg-green-500' : 'bg-gray-400', ai: 'Calculation engine run status' },
    { label: 'Accrual Management', status: pendingAccruals > 0 ? 'warn' : (accruals.approved > 0 ? 'done' : 'idle'), value: pendingAccruals > 0 ? `${pendingAccruals} pending` : (accruals.approved > 0 ? '✓' : '—'), color: pendingAccruals > 0 ? 'text-amber-600' : (accruals.approved > 0 ? 'text-green-600' : 'text-gray-400'), dot: pendingAccruals > 0 ? 'bg-amber-500' : (accruals.approved > 0 ? 'bg-green-500' : 'bg-gray-400'), ai: 'Accrual management status' },
    { label: 'Journal Entries', status: journalsPending > 0 ? 'warn' : (journalsGenerated > 0 ? 'done' : 'idle'), value: journalsPending > 0 ? `${journalsPending} unposted` : (journalsGenerated > 0 ? '✓' : '—'), color: journalsPending > 0 ? 'text-amber-600' : (journalsGenerated > 0 ? 'text-green-600' : 'text-gray-400'), dot: journalsPending > 0 ? 'bg-amber-500' : (journalsGenerated > 0 ? 'bg-green-500' : 'bg-gray-400'), ai: 'Journal entry hub status' },
    { label: 'ERP Sync', status: failedContracts > 0 ? 'block' : (journalsGenerated > 0 ? 'done' : 'idle'), value: failedContracts > 0 ? `${failedContracts} failed` : (journalsGenerated > 0 ? '✓' : '—'), color: failedContracts > 0 ? 'text-red-600' : (journalsGenerated > 0 ? 'text-green-600' : 'text-gray-400'), dot: failedContracts > 0 ? 'bg-red-500' : (journalsGenerated > 0 ? 'bg-green-500' : 'bg-gray-400'), ai: 'ERP sync status' },
    { label: 'Period Close', status: readinessScore >= 100 ? 'done' : readinessScore >= 50 ? 'warn' : 'idle', value: `${readinessScore}% ready`, color: readinessScore >= 80 ? 'text-green-600' : readinessScore >= 50 ? 'text-amber-600' : 'text-gray-400', dot: readinessScore >= 80 ? 'bg-green-500' : readinessScore >= 50 ? 'bg-amber-500' : 'bg-gray-400', ai: 'Period close readiness' },
  ];

  return (
    <div className="flex items-center py-2.5 px-4 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 overflow-x-auto gap-0" data-testid="pipeline-strip">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-shrink-0">
          <button onClick={() => openLiqAI(step.ai)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" data-testid={`pipe-step-${i}`}>
            <div className={`w-2 h-2 rounded-full ${step.dot}`} />
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{step.label}</span>
            <span className={`text-[11px] font-semibold ${step.color}`}>{step.value}</span>
          </button>
          {i < steps.length - 1 && <span className="text-gray-300 dark:text-gray-600 mx-0.5 text-xs">›</span>}
        </div>
      ))}
      <div className="flex-1" />
      <a href="/period-close-workspace" className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 transition-colors" data-testid="link-period-close">
        <Lock className="h-3 w-3" /> Go to Period Close <ArrowRight className="h-3 w-3" />
      </a>
    </div>
  );
}

function MetricRow({ dot, label, value, status, statusVariant, bar, barPct, barColor }: {
  dot: string; label: string; value: string | number; status?: string; statusVariant?: 'ok' | 'warn' | 'block' | 'idle'; bar?: boolean; barPct?: number; barColor?: string;
}) {
  const sv: Record<string, string> = {
    ok: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    warn: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    block: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    idle: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 text-xs">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <span className="flex-1 text-gray-500 dark:text-gray-400">{label}</span>
      {bar && <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${barPct || 0}%`, backgroundColor: barColor || '#ea580c' }} /></div>}
      <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
      {status && statusVariant && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sv[statusVariant]}`}>{status}</span>}
    </div>
  );
}

function MiniChip({ label, variant }: { label: string; variant: 'up' | 'down' | 'warn' | 'ok' | 'info' | 'idle' }) {
  const s: Record<string, string> = {
    up: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    down: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    warn: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    ok: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    info: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    idle: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s[variant]}`}>{label}</span>;
}

function CheckItem({ status, label, value, onClick }: { status: 'done' | 'warn' | 'block' | 'idle'; label: string; value: string; onClick?: () => void; }) {
  const ico = { done: <CheckCircle2 className="h-4 w-4 text-green-500" />, warn: <AlertTriangle className="h-4 w-4 text-amber-500" />, block: <XCircle className="h-4 w-4 text-red-500" />, idle: <CircleDot className="h-4 w-4 text-gray-400" /> };
  const col = { done: 'text-green-600', warn: 'text-amber-600', block: 'text-red-600', idle: 'text-gray-400' };
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors" onClick={onClick} data-testid={`check-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      {ico[status]}
      <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">{label}</span>
      <span className={`text-[11px] font-medium ${col[status]}`}>{value}</span>
    </div>
  );
}

function BlockerCard({ severity, title, description, action, onClick }: { severity: 'critical' | 'high' | 'medium'; title: string; description: string; action: string; onClick?: () => void; }) {
  const bc = severity === 'critical' ? 'border-l-red-500' : severity === 'high' ? 'border-l-orange-500' : 'border-l-amber-500';
  const sc = severity === 'critical' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : severity === 'high' ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  return (
    <div className={`flex gap-3 items-start p-3 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 border-l-[3px] ${bc} rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors`} onClick={onClick} data-testid={`blocker-${severity}`}>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 capitalize ${sc}`}>{severity}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-900 dark:text-white mb-0.5">{title}</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">{description}</div>
        <div className="text-[11px] text-orange-600 dark:text-orange-400 mt-1">{action}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-3 mt-5 first:mt-0">
      <h3 className="text-[13px] font-bold text-gray-900 dark:text-white">{title}</h3>
      {subtitle && <span className="text-[11px] text-gray-400 dark:text-gray-500">{subtitle}</span>}
      {actions && <div className="ml-auto flex gap-2">{actions}</div>}
    </div>
  );
}

function StatCard({ icon: Icon, iconBg, title, subtitle, value, valueColor, footer, progressPct, onClick, testId }: {
  icon: any; iconBg: string; title: string; subtitle?: string; value: string | number; valueColor?: string;
  footer?: React.ReactNode; progressPct?: number; onClick?: () => void; testId: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 cursor-pointer hover:border-orange-400 dark:hover:border-orange-600 hover:bg-gray-50/50 dark:hover:bg-gray-900 transition-all" onClick={onClick} data-testid={testId}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}><Icon className="h-4 w-4" /></div>
        <div><div className="text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</div>{subtitle && <div className="text-[10px] text-gray-400">{subtitle}</div>}</div>
      </div>
      <div className={`text-[28px] font-extrabold leading-none mb-1 ${valueColor || 'text-gray-900 dark:text-white'}`}>{value}</div>
      {footer && <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 flex-wrap">{footer}</div>}
      {progressPct !== undefined && (
        <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
          <div className="h-full rounded-full bg-[#ea580c] transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function FinancialControlCenter() {
  const [activeTab, setActiveTab] = useState("liq-agent");
  const [period, setPeriod] = useState(() => getCurrentMonthValue());
  const periodLabel = getPeriodLabel(period);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/analytics/financial-control-center"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const {
    data: obligationAging,
    isLoading: obligationAgingLoading,
    isError: obligationAgingError,
  } = useQuery<ObligationAgingSummary>({
    queryKey: ["/api/obligations/aging"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const snapshot = data?.snapshot;
  const readiness = data?.readiness;
  const risk = data?.riskMonitor;
  const execution = data?.executionStatus;

  if (isLoading) {
    return (
      <MainLayout title="Financial Control Center" description="Loading financial intelligence...">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </MainLayout>
    );
  }

  const totalContracts = snapshot?.totalContracts || 0;
  const analyzed = snapshot?.activeContracts || 0;
  const statusBreakdown = snapshot?.contractStatusBreakdown || [];
  const uploaded = statusBreakdown.find((s: any) => s.status === 'uploaded')?.count || 0;
  const processing = statusBreakdown.find((s: any) => s.status === 'processing')?.count || 0;
  const failed = statusBreakdown.find((s: any) => s.status === 'failed')?.count || 0;
  const draft = statusBreakdown.find((s: any) => s.status === 'draft')?.count || 0;
  const pendingNew = uploaded + processing + draft;
  const accrualExposure = snapshot?.accrualExposure || 0;

  const readinessItems = readiness ? [readiness.contractsProcessed, readiness.rulesExtracted, readiness.rulesValidated, readiness.calculationsRun, readiness.approvalsComplete, readiness.journalsGenerated] : [];
  const completedCount = readinessItems.filter((s: any) => s?.complete).length;
  const readinessScore = readinessItems.length > 0 ? Math.round((completedCount / readinessItems.length) * 100) : 0;

  const accruals = execution?.accrualsByFlow || { draft: 0, pending: 0, approved: 0, rejected: 0, draftAmount: 0, pendingAmount: 0, approvedAmount: 0, rejectedAmount: 0 };
  const journalsGenerated = execution?.journalStatus?.generated || 0;
  const journalsPending = Math.max(0, execution?.journalStatus?.pending || 0);
  const journalTotal = journalsGenerated + journalsPending;

  const failedContracts = risk?.failedContracts || 0;
  const validationErrors = risk?.validationErrors || 0;
  const stuckContracts = failedContracts + validationErrors;
  const missingMappings = execution?.missingMappingsCount || 0;
  const overrideCount = execution?.overrideRulesCount || 0;

  const obligationTotalOutstanding = obligationAging?.totalOutstanding || 0;
  const obligationPartnerCount = obligationAging?.totalsByPartner?.length || 0;
  const obligationOver60 = (obligationAging?.totals?.['61_90'] || 0) + (obligationAging?.totals?.['90_plus'] || 0);
  const obligationOver90 = obligationAging?.totals?.['90_plus'] || 0;
  const obligationSeverity: 'ok' | 'warn' | 'block' = obligationOver90 > 0
    ? 'block'
    : obligationOver60 > 0
      ? 'warn'
      : 'ok';
  const obligationSeverityClasses: Record<string, { iconBg: string; valueColor: string; ring: string }> = {
    ok: { iconBg: 'bg-green-50 text-green-600 dark:bg-green-900/20', valueColor: 'text-green-600', ring: 'hover:border-green-400 dark:hover:border-green-600' },
    warn: { iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20', valueColor: 'text-amber-600', ring: 'hover:border-amber-400 dark:hover:border-amber-600' },
    block: { iconBg: 'bg-red-50 text-red-600 dark:bg-red-900/20', valueColor: 'text-red-600', ring: 'hover:border-red-400 dark:hover:border-red-600' },
  };
  const obligationStyle = obligationSeverityClasses[obligationSeverity];

  const transactionsReceived = execution?.totalSalesTransactions || 0;
  const calcsCompleted = execution?.totalCalculations || 0;
  const exceptionsDetected = execution?.exceptionsDetected || 0;

  return (
    <MainLayout title="Financial Control Center" description="Revenue assurance and contract intelligence — real-time operational view">
      <div className="mt-1">
        <div className="flex items-center justify-between mb-3">
          <PeriodSelector value={period} onChange={setPeriod} allowedTypes={['monthly', 'quarterly']} />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openLiqAI(`What is the overall financial health for ${periodLabel}?`)} data-testid="button-ai-health-check">
              <Sparkles className="h-3 w-3 mr-1" />AI Health Check
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-transparent border-b border-gray-200 dark:border-gray-800 rounded-none h-auto p-0 w-full justify-start gap-0" data-testid="fcc-tabs">
            <TabsTrigger value="liq-agent" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200" data-testid="tab-liq-agent">
              <Bot className="h-3.5 w-3.5 mr-1.5" />liQ Agent
            </TabsTrigger>
            <TabsTrigger value="snapshot" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200" data-testid="tab-snapshot">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />Financial Control Snapshot
            </TabsTrigger>
            <TabsTrigger value="readiness" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200" data-testid="tab-readiness">
              <Lock className="h-3.5 w-3.5 mr-1.5" />Period Close Readiness
            </TabsTrigger>
            <TabsTrigger value="risk" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200" data-testid="tab-risk">
              <Shield className="h-3.5 w-3.5 mr-1.5" />Risk & Exception Monitor
              {stuckContracts > 0 && <span className="ml-1.5 text-[9px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">{stuckContracts}</span>}
            </TabsTrigger>
            <TabsTrigger value="execution" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200" data-testid="tab-execution">
              <Zap className="h-3.5 w-3.5 mr-1.5" />Execution Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="liq-agent" className="mt-4">
            <LiQAgentTab />
          </TabsContent>

          <TabsContent value="snapshot" className="mt-4 space-y-0">
            <SectionHeader title={`📊 Financial Snapshot — ${periodLabel}`} subtitle="All values reflect current calculation engine output" actions={<Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openLiqAI(`Summarize the financial control snapshot for ${periodLabel}`)}><Sparkles className="h-3 w-3 mr-1" />AI Summary</Button>} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard icon={BarChart3} iconBg="bg-orange-50 text-orange-600 dark:bg-orange-900/20" title="Active Contracts" subtitle="By flow type" value={totalContracts} valueColor="text-orange-600" progressPct={Math.min(100, (analyzed / Math.max(totalContracts, 1)) * 100)}
                footer={<div className="flex-1 text-[11px] text-gray-500">Analyzed <strong className="text-gray-900 dark:text-white">{analyzed}</strong> · Processing <strong className="text-gray-900 dark:text-white">{processing}</strong> · Draft <strong className="text-gray-900 dark:text-white">{draft}</strong></div>} testId="kpi-active-contracts" />
              <StatCard icon={Clock} iconBg="bg-amber-50 text-amber-600 dark:bg-amber-900/20" title="Pending New Contracts" subtitle="Awaiting processing" value={pendingNew} valueColor="text-amber-600" progressPct={pendingNew > 0 ? 35 : 0}
                footer={<>{uploaded > 0 && <MiniChip label={`${uploaded} Uploaded`} variant="info" />}{processing > 0 && <MiniChip label={`${processing} Processing`} variant="warn" />}</>}
                onClick={() => openLiqAI('Show pending new contracts in the queue')} testId="kpi-pending" />
              <StatCard icon={DollarSign} iconBg="bg-purple-50 text-purple-600 dark:bg-purple-900/20" title="Total Accrual Exposure" subtitle={`${periodLabel} · all flows`} value={formatCurrency(accrualExposure)} valueColor="text-orange-600" progressPct={100}
                footer={<div className="flex-1 text-[11px] text-gray-400">Approved {formatCurrency(snapshot?.approvedLicenseFees || 0)} · Pending {formatCurrency(snapshot?.pendingApprovalAmount || 0)}</div>} testId="kpi-exposure" />
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 cursor-pointer hover:border-orange-400 transition-all" data-testid="kpi-readiness">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-50 text-green-600 dark:bg-green-900/20"><Lock className="h-4 w-4" /></div>
                  <div><div className="text-xs font-semibold text-gray-500">Period Readiness Score</div><div className="text-[10px] text-gray-400">{periodLabel}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-[70px] h-[70px] flex-shrink-0">
                    <svg viewBox="0 0 80 80" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="40" cy="40" r="33" fill="none" stroke="currentColor" strokeWidth="9" className="text-gray-100 dark:text-gray-800" />
                      <circle cx="40" cy="40" r="33" fill="none" strokeWidth="9" strokeLinecap="round" stroke="#ea580c" strokeDasharray={`${(readinessScore / 100) * 207.3} 207.3`} className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-extrabold text-orange-600">{readinessScore}%</span>
                      <span className="text-[8px] font-semibold text-gray-400 uppercase">Ready</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px]"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /><span className="text-gray-500">{completedCount} Complete</span></div>
                    <div className="flex items-center gap-1.5 text-[11px]"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="text-gray-500">{Math.max(0, readinessItems.length - completedCount)} Pending</span></div>
                  </div>
                </div>
              </div>
            </div>

            <Link
              href="/outstanding-obligations"
              className={`block bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-4 cursor-pointer transition-all ${obligationStyle.ring}`}
              data-testid="kpi-outstanding-obligations"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${obligationStyle.iconBg}`}>
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Liability Aging</div>
                    <span className="text-[10px] text-gray-400">MDF, advances, reserves &amp; bonuses</span>
                  </div>
                  {obligationAgingLoading ? (
                    <div className="flex items-center gap-3 mt-2" data-testid="status-obligations-loading">
                      <Skeleton className="h-7 w-24" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  ) : obligationAgingError ? (
                    <div className="flex items-baseline gap-3 mt-1 flex-wrap" data-testid="status-obligations-error">
                      <span className="text-sm font-semibold text-red-600">Unable to load obligations</span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">Open the obligations page for details</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                      <span
                        className={`text-[26px] font-extrabold leading-none ${obligationStyle.valueColor}`}
                        data-testid="text-obligations-total"
                      >
                        {formatCurrency(obligationTotalOutstanding)}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400" data-testid="text-obligations-partner-count">
                        across <strong className="text-gray-900 dark:text-white">{obligationPartnerCount}</strong> partner{obligationPartnerCount === 1 ? '' : 's'}
                      </span>
                      {obligationOver60 > 0 ? (
                        <span data-testid="badge-obligations-aging-over-60">
                          <MiniChip
                            label={`${formatCurrency(obligationOver60)} aging > 60 days${obligationOver90 > 0 ? ` (incl. ${formatCurrency(obligationOver90)} > 90)` : ''}`}
                            variant={obligationSeverity === 'block' ? 'down' : 'warn'}
                          />
                        </span>
                      ) : obligationTotalOutstanding > 0 ? (
                        <span data-testid="badge-obligations-aging-clean">
                          <MiniChip label="Nothing aging > 60 days" variant="ok" />
                        </span>
                      ) : (
                        <span data-testid="badge-obligations-empty">
                          <MiniChip label="No outstanding obligations" variant="idle" />
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </div>
            </Link>

            <FinanceHubKpis periodLabel={periodLabel} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4" data-testid="kpi-accrual-flow">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-50 text-orange-600 dark:bg-orange-900/20"><BarChart3 className="h-4 w-4" /></div>
                  <div className="flex-1"><div className="text-xs font-semibold text-gray-500">Accrual Exposure by Flow</div><div className="text-[10px] text-gray-400">{periodLabel}</div></div>
                  <span className="text-[9px] font-semibold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full uppercase tracking-wider">AI</span>
                </div>
                <MetricRow dot="bg-orange-500" label="Draft Accruals" value={formatCurrency(accruals.draftAmount || 0)} status={`${accruals.draft} items`} statusVariant="idle" />
                <MetricRow dot="bg-amber-500" label="Pending Approval" value={formatCurrency(accruals.pendingAmount || 0)} status={`${accruals.pending} items`} statusVariant="warn" />
                <MetricRow dot="bg-green-500" label="Approved" value={formatCurrency(accruals.approvedAmount || 0)} status={`${accruals.approved} items`} statusVariant="ok" />
                <MetricRow dot="bg-red-500" label="Rejected" value={formatCurrency(accruals.rejectedAmount || 0)} status={`${accruals.rejected} items`} statusVariant={accruals.rejected > 0 ? 'block' : 'idle'} />
              </div>
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4" data-testid="kpi-journals">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-50 text-purple-600 dark:bg-purple-900/20"><FileText className="h-4 w-4" /></div>
                  <div><div className="text-xs font-semibold text-gray-500">Journal Entries & ERP</div><div className="text-[10px] text-gray-400">{periodLabel} posting status</div></div>
                </div>
                <MetricRow dot="bg-gray-400" label="Total JEs Generated" value={journalTotal} status="All flows" statusVariant="idle" />
                <MetricRow dot="bg-green-500" label="Posted to GL" value={journalsGenerated} status="ERP synced" statusVariant="ok" />
                <MetricRow dot="bg-amber-500" label="Pending Approval / Post" value={journalsPending} status={journalsPending > 0 ? "Action needed" : "Done"} statusVariant={journalsPending > 0 ? "warn" : "ok"} />
              </div>
            </div>

            <SectionHeader title="🤖 AI Accrual Insights" subtitle="Active flags requiring review" actions={<Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openLiqAI(`Show all AI-detected anomalies for ${periodLabel}`)}>View All</Button>} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard icon={AlertTriangle} iconBg="bg-red-50 text-red-600 dark:bg-red-900/20" title="Potential Over-accruals" value={risk?.failedContracts || 0} valueColor="text-red-600"
                footer={<span className="text-[10px] text-gray-500">Contracts with detected over-accrual risk</span>} onClick={() => openLiqAI('Explain potential over-accruals')} testId="kpi-over-accruals" />
              <StatCard icon={Search} iconBg="bg-amber-50 text-amber-600 dark:bg-amber-900/20" title="Missing Data Inputs" value={missingMappings} valueColor="text-amber-600"
                footer={<span className="text-[10px] text-gray-500">Contracts with incomplete data</span>} onClick={() => openLiqAI('Which contracts have missing data inputs?')} testId="kpi-missing-data" />
              <StatCard icon={Shield} iconBg="bg-purple-50 text-purple-600 dark:bg-purple-900/20" title="High Risk Contracts" value={risk?.lowConfidenceRules || 0} valueColor="text-purple-600"
                footer={<span className="text-[10px] text-gray-500">Confidence below threshold</span>} onClick={() => openLiqAI('Show high risk contracts')} testId="kpi-high-risk" />
            </div>
          </TabsContent>

          <TabsContent value="readiness" className="mt-4 space-y-0">
            <SectionHeader title={`🗂️ Period Close Readiness — ${periodLabel}`} subtitle="Summary view — open Period Close Workspace for full controls"
              actions={<><Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openLiqAI(`What is the fastest path to close ${periodLabel}?`)}><Sparkles className="h-3 w-3 mr-1" />AI Close Path</Button><Button size="sm" className="text-xs h-7 bg-orange-600 hover:bg-orange-700" onClick={() => window.location.href = '/period-close-workspace'}>Open Workspace <ArrowRight className="h-3 w-3 ml-1" /></Button></>}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-5 flex gap-4 items-center" data-testid="kpi-close-score">
                <div className="relative w-[90px] h-[90px] flex-shrink-0">
                  <svg viewBox="0 0 90 90" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="45" cy="45" r="37" fill="none" stroke="currentColor" strokeWidth="10" className="text-gray-100 dark:text-gray-800" />
                    <circle cx="45" cy="45" r="37" fill="none" strokeWidth="10" strokeLinecap="round" stroke="#ea580c" strokeDasharray={`${(readinessScore / 100) * 232.5} 232.5`} className="transition-all duration-1000" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-extrabold text-orange-600">{readinessScore}%</span>
                    <span className="text-[9px] font-semibold text-gray-400 uppercase">Ready</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">Close Readiness Score</div>
                  <div className="text-xs text-gray-500 mb-3">{readinessItems.length - completedCount > 0 ? `${readinessItems.length - completedCount} items pending` : 'All items complete'}</div>
                  <div className="flex gap-3 text-xs">
                    <div><span className="text-base font-bold text-green-600">{completedCount}</span> <span className="text-gray-400">Complete</span></div>
                    <div><span className="text-base font-bold text-amber-600">{Math.max(0, readinessItems.length - completedCount)}</span> <span className="text-gray-400">Pending</span></div>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4" data-testid="kpi-blockers">
                <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-600 dark:bg-red-900/20"><XCircle className="h-4 w-4" /></div><div className="text-xs font-semibold text-gray-500">Critical Blockers</div></div>
                <div className="space-y-2">
                  {stuckContracts > 0 && <BlockerCard severity="critical" title={`${failedContracts} Failed Contracts`} description={`${failedContracts} failed, ${validationErrors} validation errors`} action="✦ AI can diagnose failures" onClick={() => openLiqAI('How do I resolve failed contract processing?')} />}
                  {journalsPending > 0 && <BlockerCard severity="high" title={`${journalsPending} Unposted JEs`} description={`${journalsPending} JEs awaiting approval or posting`} action="✦ AI can help prioritize" onClick={() => openLiqAI('Which journal entries are still unposted?')} />}
                  {stuckContracts === 0 && journalsPending === 0 && <div className="flex items-center gap-2 p-3 text-xs text-green-600"><CheckCircle2 className="h-4 w-4" /><span>No critical blockers</span></div>}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4" data-testid="close-checklist">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-50 text-orange-600 dark:bg-orange-900/20"><CheckCircle2 className="h-4 w-4" /></div>
                <div className="text-xs font-semibold text-gray-500">Close Checklist — {periodLabel}</div>
                <span className="ml-auto text-[9px] font-semibold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full uppercase tracking-wider">AI Monitored</span>
              </div>
              {readinessItems.map((step: any, i: number) => {
                const labels = ['Contracts Processed', 'Rules Extracted', 'Rules Validated', 'Calculations Run', 'Approvals Complete', 'Journals Generated'];
                const s = step || { complete: false, done: 0, total: 0 };
                return <CheckItem key={i} status={s.complete ? 'done' : (s.done > 0 ? 'warn' : 'idle')} label={labels[i]} value={s.complete ? `Complete · ${s.done}/${s.total}` : `${s.done} of ${s.total}`} onClick={!s.complete ? () => openLiqAI(`What is blocking ${labels[i].toLowerCase()}?`) : undefined} />;
              })}
            </div>
          </TabsContent>

          <TabsContent value="risk" className="mt-4 space-y-0">
            <SectionHeader title={`🛡️ Risk & Exception Monitor — ${periodLabel}`} subtitle="All AI-detected exceptions and compliance issues" actions={<Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openLiqAI(`Full risk assessment for ${periodLabel}`)}><Sparkles className="h-3 w-3 mr-1" />AI Risk Assessment</Button>} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard icon={XCircle} iconBg="bg-red-50 text-red-600 dark:bg-red-900/20" title="Contracts w/ Exceptions" value={stuckContracts} valueColor="text-red-600" footer={<span className="text-[10px] text-gray-500">Blocking processing</span>} onClick={() => openLiqAI('Show contracts with exceptions')} testId="kpi-exceptions" />
              <StatCard icon={Search} iconBg="bg-amber-50 text-amber-600 dark:bg-amber-900/20" title="Missing Data Mappings" value={missingMappings} valueColor="text-amber-600" footer={<MiniChip label={missingMappings === 0 ? 'All Mapped' : `${missingMappings} Gaps`} variant={missingMappings === 0 ? 'ok' : 'warn'} />} onClick={() => openLiqAI('Missing data mappings')} testId="kpi-mappings" />
              <StatCard icon={Activity} iconBg="bg-orange-50 text-orange-600 dark:bg-orange-900/20" title="Failed Interfaces" value={failedContracts} valueColor="text-orange-600" footer={<span className="text-[10px] text-gray-500">{failedContracts === 0 ? 'All operational' : 'Failures detected'}</span>} onClick={() => openLiqAI('Failed ERP interfaces')} testId="kpi-interfaces" />
              <StatCard icon={Shield} iconBg="bg-purple-50 text-purple-600 dark:bg-purple-900/20" title="Overrides Applied" value={overrideCount} valueColor="text-purple-600" footer={<MiniChip label={overrideCount === 0 ? 'Clean period' : `${overrideCount} active`} variant={overrideCount === 0 ? 'ok' : 'warn'} />} onClick={() => openLiqAI('Show overrides applied')} testId="kpi-overrides" />
            </div>
            <SectionHeader title="Active Exceptions" subtitle="Items requiring controller attention" />
            <div className="space-y-2 mb-4">
              {stuckContracts > 0 ? (<>
                {failedContracts > 0 && <BlockerCard severity="critical" title={`${failedContracts} Failed Contract Processing`} description="Contracts failed during AI extraction" action="✦ AI can investigate and suggest resolution" onClick={() => openLiqAI('Explain failed contracts')} />}
                {validationErrors > 0 && <BlockerCard severity="high" title={`${validationErrors} Validation Errors`} description="Rules or data failed validation" action="✦ AI can trace the gap" onClick={() => openLiqAI('Explain validation errors')} />}
              </>) : <div className="flex items-center gap-2 p-4 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs text-green-600"><CheckCircle2 className="h-4 w-4" /><span>No active exceptions</span></div>}
              {(risk?.lowConfidenceRules || 0) > 0 && <BlockerCard severity="medium" title={`${risk.lowConfidenceRules} Low Confidence Rules`} description="AI flagged for manual review" action="✦ AI can explain gaps" onClick={() => openLiqAI('Low confidence rules')} />}
            </div>
            <SectionHeader title="System Health Overview" />
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              {[{ label: 'Contract Exceptions', value: stuckContracts, ok: stuckContracts === 0 }, { label: 'Data Mappings', value: missingMappings, ok: missingMappings === 0 }, { label: 'Interface Status', value: failedContracts, ok: failedContracts === 0 }, { label: 'Manual Overrides', value: overrideCount, ok: overrideCount === 0 }].map((item, i) => (
                <MetricRow key={i} dot={item.ok ? 'bg-green-500' : 'bg-red-500'} label={item.label} value={item.value} status={item.ok ? 'Healthy' : 'Action Needed'} statusVariant={item.ok ? 'ok' : 'warn'} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="execution" className="mt-4 space-y-0">
            <SectionHeader title={`⚡ Execution Status — ${periodLabel}`} subtitle="Pipeline execution from data ingestion through ERP posting" actions={<Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openLiqAI(`Execution pipeline status for ${periodLabel}`)}><Sparkles className="h-3 w-3 mr-1" />AI Summary</Button>} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard icon={TrendingUp} iconBg="bg-green-50 text-green-600 dark:bg-green-900/20" title="Transactions Received" subtitle="Sales + POS data" value={transactionsReceived} valueColor="text-green-600" progressPct={transactionsReceived > 0 ? 100 : 0}
                footer={<><MiniChip label={transactionsReceived > 0 ? 'Data loaded' : 'Awaiting upload'} variant={transactionsReceived > 0 ? 'ok' : 'idle'} /></>} onClick={() => openLiqAI('Transactions received')} testId="kpi-transactions" />
              <StatCard icon={Calculator} iconBg="bg-orange-50 text-orange-600 dark:bg-orange-900/20" title="Calculations Complete" subtitle="Engine runs" value={calcsCompleted} valueColor="text-orange-600" progressPct={calcsCompleted > 0 ? 94 : 0}
                footer={<MiniChip label={calcsCompleted > 0 ? `${formatCurrency(accrualExposure)} calculated` : 'No calculations'} variant={calcsCompleted > 0 ? 'ok' : 'idle'} />} onClick={() => openLiqAI('Calculations completed')} testId="kpi-calcs" />
              <StatCard icon={AlertTriangle} iconBg="bg-amber-50 text-amber-600 dark:bg-amber-900/20" title="Exceptions Detected" subtitle="AI-flagged anomalies" value={exceptionsDetected} valueColor="text-amber-600" progressPct={exceptionsDetected > 0 ? 18 : 0}
                footer={<MiniChip label={exceptionsDetected === 0 ? 'Clean execution' : `${exceptionsDetected} flagged`} variant={exceptionsDetected === 0 ? 'ok' : 'warn'} />} onClick={() => openLiqAI('Show all exceptions')} testId="kpi-exceptions-exec" />
              <StatCard icon={FileText} iconBg="bg-purple-50 text-purple-600 dark:bg-purple-900/20" title="Journals Generated" subtitle="JE hub output" value={journalTotal} valueColor="text-purple-600" progressPct={journalTotal > 0 ? (journalsGenerated / journalTotal) * 100 : 0}
                footer={<><MiniChip label={`${journalsGenerated} Posted`} variant="ok" />{journalsPending > 0 && <MiniChip label={`${journalsPending} Pending`} variant="warn" />}</>} testId="kpi-journals-exec" />
            </div>
            <SectionHeader title="Execution Progress" />
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-4">
              {[
                { label: 'Data Ingestion', pct: transactionsReceived > 0 ? 100 : 0, color: '#22c55e', status: transactionsReceived > 0 ? 'Done' : 'Pending', sv: (transactionsReceived > 0 ? 'ok' : 'idle') as 'ok' | 'idle' },
                { label: 'Contract Intelligence', pct: analyzed > 0 ? Math.round((analyzed / Math.max(totalContracts, 1)) * 100) : 0, color: '#22c55e', status: analyzed > 0 ? `${analyzed} analyzed` : 'Pending', sv: (analyzed > 0 ? 'ok' : 'idle') as 'ok' | 'idle' },
                { label: 'Calculation Engine', pct: calcsCompleted > 0 ? Math.min(100, Math.round((calcsCompleted / Math.max(totalContracts, 1)) * 100)) : 0, color: '#22c55e', status: calcsCompleted > 0 ? `${calcsCompleted} runs` : 'Pending', sv: (calcsCompleted > 0 ? 'ok' : 'idle') as 'ok' | 'idle' },
                { label: 'Accrual Approval', pct: (accruals.approved + accruals.pending) > 0 ? Math.round((accruals.approved / Math.max(accruals.approved + accruals.pending, 1)) * 100) : 0, color: accruals.pending > 0 ? '#f59e0b' : '#22c55e', status: `${accruals.approved}/${accruals.approved + accruals.pending}`, sv: (accruals.pending > 0 ? 'warn' : 'ok') as 'warn' | 'ok' },
                { label: 'JE Posted to GL', pct: journalTotal > 0 ? Math.round((journalsGenerated / journalTotal) * 100) : 0, color: journalsPending > 0 ? '#f59e0b' : '#22c55e', status: `${journalsGenerated}/${journalTotal}`, sv: (journalsPending > 0 ? 'warn' : 'ok') as 'warn' | 'ok' },
              ].map((item, i) => <MetricRow key={i} dot={item.pct >= 100 ? 'bg-green-500' : item.pct > 0 ? 'bg-amber-500' : 'bg-gray-400'} label={item.label} value={`${item.pct}%`} bar barPct={item.pct} barColor={item.color} status={item.status} statusVariant={item.sv} />)}
            </div>
            <SectionHeader title="Execution Pipeline Steps" />
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              {[{ label: 'Sales Data Loaded', done: transactionsReceived > 0 }, { label: 'Contracts Analyzed', done: analyzed > 0 }, { label: 'Calculations Completed', done: calcsCompleted > 0 }, { label: 'Accruals Approved', done: accruals.pending === 0 && accruals.approved > 0 }, { label: 'Journals Posted', done: journalsGenerated > 0 && journalsPending === 0 }, { label: 'No Exceptions', done: exceptionsDetected === 0 }].map((step, i) => (
                <CheckItem key={i} status={step.done ? 'done' : 'idle'} label={step.label} value={step.done ? 'Complete' : 'Pending'} />
              ))}
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </MainLayout>
  );
}


function FinanceHubKpis({ periodLabel }: { periodLabel: string }) {
  const { data } = useQuery<{ openClaims: number; openDocuments: number; awaitingOracle: number }>({ queryKey: ["/api/finance/kpis"] });
  const k = data || { openClaims: 0, openDocuments: 0, awaitingOracle: 0 };
  const tiles = [
    { label: "Open Claims", value: String(k.openClaims || 0), color: "text-orange-600", testId: "kpi-open-claims", href: "/claims-workspace" },
    { label: "Open Documents", value: String(k.openDocuments || 0), color: "text-orange-600", testId: "kpi-open-documents", href: "/invoices-memos" },
    { label: "Awaiting Oracle", value: String(k.awaitingOracle || 0), color: "text-amber-600", testId: "kpi-awaiting-oracle", href: "/invoices-memos" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      {tiles.map(t => (
        <a key={t.testId} href={t.href} data-testid={t.testId} className="block bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:border-orange-400 transition-all">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{t.label}</div>
          <div className={`mt-1 text-2xl font-bold ${t.color}`}>{t.value}</div>
          <div className="text-[10px] text-gray-400 mt-1">{periodLabel}</div>
        </a>
      ))}
    </div>
  );
}
