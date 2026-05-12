import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { useUploadModal } from "@/contexts/upload-modal-context";
import { 
  FileCheck2, 
  Clock, 
  AlertTriangle,
  DollarSign,
  BookOpen,
  ClipboardCheck,
  Upload,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Activity,
  CircleDot,
  FileText,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Calculator,
  ListChecks,
  ShoppingCart,
} from "lucide-react";
import {
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Sector,
} from "recharts";
import { useState, useCallback } from "react";

const STATUS_COLORS: Record<string, string> = {
  analyzed: '#10b981',
  processing: '#f59e0b',
  uploaded: '#6366f1',
  failed: '#ef4444',
};

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#7c3aed'];

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

function KPICard({ 
  title, value, subtitle, icon: Icon, color, onClick, sparkline 
}: { 
  title: string; value: string | number; subtitle?: string; icon: any; color: string; onClick?: () => void; sparkline?: number[];
}) {
  return (
    <Card 
      className={`relative overflow-hidden transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
      data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            {sparkline && sparkline.length > 0 && (
              <MiniSparkline data={sparkline} color={color.includes('purple') ? '#a855f7' : color.includes('emerald') ? '#10b981' : '#6366f1'} />
            )}
          </div>
        </div>
        {onClick && (
          <div className="absolute bottom-2 right-3">
            <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 60;
  const height = 20;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="mt-1" data-testid="sparkline-chart">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 8} dy={0} textAnchor="middle" fill="hsl(var(--foreground))" className="text-xs font-medium">
        {payload.type || 'Other'}
      </text>
      <text x={cx} y={cy + 10} dy={0} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="text-[10px]">
        {value} ({(percent * 100).toFixed(0)}%)
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { open: openUploadModal } = useUploadModal();
  const [activePieIndex, setActivePieIndex] = useState(0);

  const onPieEnter = useCallback((_: any, index: number) => {
    setActivePieIndex(index);
  }, []);

  const { data: kpis, isLoading } = useQuery<{
    totalActiveContracts: number;
    contractsByType: Array<{ type: string; count: number }>;
    pendingProcessing: number;
    contractsWithExceptions: number;
    periodAccrualExposure: number;
    journalsGenerated: number;
    pendingReviews: number;
    rulesNeedingReview: number;
    recentCalculations: Array<{ name: string; amount: number; status: string; date: string }>;
    contractStatusBreakdown: Array<{ status: string; count: number }>;
    ruleConfidenceDistribution: Array<{ range: string; count: number }>;
    monthlyActivity: Array<{ month: string; uploads: number; calculations: number }>;
    topContractsByValue: Array<{ name: string; value: number; status: string }>;
    approvalPipeline: { draft: number; pendingApproval: number; approved: number; rejected: number };
  }>({
    queryKey: ["/api/analytics/dashboard-kpis"],
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const totalContracts = kpis?.contractStatusBreakdown?.reduce((sum, s) => sum + s.count, 0) || 0;

  const revenueSparkline = kpis?.monthlyActivity?.map(m => m.calculations) || [];

  const pipelineTotal = kpis?.approvalPipeline 
    ? kpis.approvalPipeline.draft + kpis.approvalPipeline.pendingApproval + kpis.approvalPipeline.approved + kpis.approvalPipeline.rejected
    : 0;

  const approvedAmount = kpis?.recentCalculations
    ?.filter(c => c.status === 'approved')
    .reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

  const pendingAmount = kpis?.recentCalculations
    ?.filter(c => c.status === 'pending_approval')
    .reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

  const totalCalcCount = kpis?.recentCalculations?.length || 0;
  const avgCalcAmount = totalCalcCount > 0 
    ? (kpis?.recentCalculations?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0) / totalCalcCount 
    : 0;

  const approvedCount = kpis?.recentCalculations?.filter(c => c.status === 'approved').length || 0;
  const pendingCount = kpis?.recentCalculations?.filter(c => c.status === 'pending_approval').length || 0;

  return (
    <MainLayout title="Financial Control Dashboard" description="LicenseIQ — Revenue assurance and contract intelligence at a glance">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground" data-testid="text-welcome">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
            </h2>
            <p className="text-sm text-muted-foreground">
              Financial control layer — monitor contract revenue flows, accruals, and compliance
            </p>
          </div>
          <Button onClick={() => openUploadModal()} data-testid="button-upload-contract">
            <Upload className="h-4 w-4 mr-2" />
            Upload Contract
          </Button>
        </div>

        <Card className="relative overflow-hidden border shadow-sm bg-gradient-to-br from-white via-orange-50/30 to-orange-50/40 dark:from-gray-900 dark:via-stone-950/30 dark:to-stone-950/30" data-testid="workflow-diagram">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-orange-600 via-purple-500 to-amber-500" />
          <CardContent className="relative py-6 px-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900">
                  <Activity className="h-4 w-4 text-orange-700 dark:text-orange-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Revenue Assurance Pipeline</h3>
                  <p className="text-xs text-muted-foreground">Contract-to-cash workflow</p>
                </div>
              </div>
              <Badge variant="outline" className="border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-500 bg-orange-50 dark:bg-orange-950/40 text-[10px] font-medium">
                4 Steps
              </Badge>
            </div>
            <div className="relative">
              <div className="absolute top-7 left-[40px] right-[40px] h-[2px] bg-gradient-to-r from-orange-300/50 via-violet-300/50 via-purple-300/50 via-emerald-300/50 to-amber-300/50 dark:from-orange-800/30 dark:via-violet-700/30 dark:to-amber-700/30 hidden lg:block" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { step: 1, label: "Upload Contract", desc: "Import PDF or document", icon: Upload, href: "/contracts/ingest", gradient: "from-orange-600 to-orange-700", ring: "ring-orange-200 dark:ring-orange-800", glow: "hover:shadow-orange-200/50 dark:hover:shadow-orange-900/30", cardBg: "hover:bg-orange-50/60 dark:hover:bg-stone-950/20", borderHover: "hover:border-orange-300 dark:hover:border-orange-800", numBg: "bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300" },
                  { step: 2, label: "Contract Fee Rules", desc: "Configure fee structures", icon: FileText, href: "/contracts/7b7f014f-16e9-4f99-a6a0-8ba4104d43e7/rules", gradient: "from-purple-500 to-purple-600", ring: "ring-purple-200 dark:ring-purple-800", glow: "hover:shadow-purple-200/50 dark:hover:shadow-purple-900/30", cardBg: "hover:bg-purple-50/60 dark:hover:bg-purple-950/20", borderHover: "hover:border-purple-300 dark:hover:border-purple-700", numBg: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300" },
                  { step: 3, label: "Sales Upload", desc: "Import sales transactions", icon: ShoppingCart, href: "/sales-upload", gradient: "from-emerald-500 to-emerald-600", ring: "ring-emerald-200 dark:ring-emerald-800", glow: "hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/30", cardBg: "hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20", borderHover: "hover:border-emerald-300 dark:hover:border-emerald-700", numBg: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300" },
                  { step: 4, label: "Contract Fee Calculator", desc: "Calculate & generate invoices", icon: Calculator, href: "/calculations", gradient: "from-amber-500 to-amber-600", ring: "ring-amber-200 dark:ring-amber-800", glow: "hover:shadow-amber-200/50 dark:hover:shadow-amber-900/30", cardBg: "hover:bg-amber-50/60 dark:hover:bg-amber-950/20", borderHover: "hover:border-amber-300 dark:hover:border-amber-700", numBg: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300" },
                ].map((item) => (
                  <button
                    key={item.step}
                    onClick={() => setLocation(item.href)}
                    className={`group relative flex flex-col items-center text-center p-4 rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 ${item.cardBg} ${item.borderHover} transition-all duration-300 hover:scale-[1.03] hover:shadow-lg ${item.glow} cursor-pointer`}
                    data-testid={`workflow-step-${item.step}`}
                  >
                    <div className={`relative z-10 flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br ${item.gradient} shadow-lg ring-4 ${item.ring} mb-3 transition-transform duration-300 group-hover:scale-110`}>
                      <item.icon className="h-6 w-6 text-white" />
                      <div className={`absolute -top-1.5 -right-1.5 flex items-center justify-center h-5 w-5 rounded-full ${item.numBg} border border-white dark:border-gray-800 text-[10px] font-bold shadow-sm`}>
                        {item.step}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground leading-tight mb-0.5">{item.label}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KPICard
              title="Active Contracts"
              value={kpis?.totalActiveContracts || 0}
              subtitle={`${totalContracts} total across all statuses`}
              icon={FileCheck2}
              color="bg-emerald-500"
              onClick={() => setLocation("/contracts")}
            />
            <KPICard
              title="Pending Processing"
              value={kpis?.pendingProcessing || 0}
              subtitle="Contracts awaiting AI analysis"
              icon={Clock}
              color="bg-amber-500"
              onClick={() => setLocation("/contracts")}
            />
            <KPICard
              title="Exceptions"
              value={kpis?.contractsWithExceptions || 0}
              subtitle="Failed + validation issues"
              icon={AlertTriangle}
              color="bg-red-500"
            />
            <KPICard
              title="Period Accrual Exposure"
              value={formatCurrency(kpis?.periodAccrualExposure || 0)}
              subtitle="Total calculated contract fees"
              icon={DollarSign}
              color="bg-purple-500"
              sparkline={revenueSparkline}
            />
            <KPICard
              title="Journals Generated"
              value={kpis?.journalsGenerated || 0}
              subtitle="Approved this period"
              icon={BookOpen}
              color="bg-orange-600"
            />
            <KPICard
              title="Pending Reviews"
              value={(kpis?.pendingReviews || 0) + (kpis?.rulesNeedingReview || 0)}
              subtitle={`${kpis?.rulesNeedingReview || 0} rules + ${kpis?.pendingReviews || 0} calculations`}
              icon={ClipboardCheck}
              color="bg-orange-500"
            />
          </div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="widget-approved-fees">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approved Contract Fees</p>
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  ${approvedAmount >= 1000000 ? `${(approvedAmount / 1000000).toFixed(1)}M` : approvedAmount >= 1000 ? `${(approvedAmount / 1000).toFixed(1)}K` : approvedAmount.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">{approvedCount} approved calculation{approvedCount !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>

            <Card data-testid="widget-pending-fees">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Approval</p>
                </div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  ${pendingAmount >= 1000000 ? `${(pendingAmount / 1000000).toFixed(1)}M` : pendingAmount >= 1000 ? `${(pendingAmount / 1000).toFixed(1)}K` : pendingAmount.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">{pendingCount} pending calculation{pendingCount !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>

            <Card data-testid="widget-avg-fee">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-orange-600" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Contract Fee</p>
                </div>
                <p className="text-2xl font-bold">
                  ${avgCalcAmount >= 1000000 ? `${(avgCalcAmount / 1000000).toFixed(1)}M` : avgCalcAmount >= 1000 ? `${(avgCalcAmount / 1000).toFixed(1)}K` : avgCalcAmount.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">Per calculation average</p>
              </CardContent>
            </Card>

            <Card data-testid="widget-approval-rate">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approval Rate</p>
                </div>
                <p className="text-2xl font-bold">
                  {totalCalcCount > 0 ? Math.round((approvedCount / totalCalcCount) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground mb-2">{approvedCount} of {totalCalcCount} calculations</p>
                <Progress value={totalCalcCount > 0 ? (approvedCount / totalCalcCount) * 100 : 0} className="h-2" />
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-600" />
                Monthly Activity
              </CardTitle>
              <CardDescription>Contract uploads (bars) and calculations (line) over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={kpis?.monthlyActivity || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Bar dataKey="uploads" name="Uploads" fill="url(#barGradient)" radius={[4, 4, 0, 0]} barSize={28} />
                    <Line type="monotone" dataKey="calculations" name="Calculations" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-orange-600" />
                Contract Status
              </CardTitle>
              <CardDescription>Current processing pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <ChartSkeleton /> : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={kpis?.contractStatusBreakdown?.filter(s => s.count > 0) || []}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        label={({ status, count, percent }) => `${count} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {kpis?.contractStatusBreakdown?.filter(s => s.count > 0).map((entry, index) => (
                          <Cell key={index} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 justify-center mt-1">
                    {kpis?.contractStatusBreakdown?.filter(s => s.count > 0).map((s) => (
                      <div key={s.status} className="flex items-center gap-1.5 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.status] || '#94a3b8' }} />
                        <span className="text-muted-foreground capitalize">{s.status}</span>
                        <span className="font-medium">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-500" />
                Contract Portfolio
              </CardTitle>
              <CardDescription>Breakdown by contract type</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <ChartSkeleton /> : (
                kpis?.contractsByType && kpis.contractsByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        activeIndex={activePieIndex}
                        activeShape={renderActiveShape}
                        data={kpis.contractsByType}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        onMouseEnter={onPieEnter}
                      >
                        {kpis.contractsByType.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => {
                          const total = kpis.contractsByType.reduce((s, c) => s + c.count, 0);
                          const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
                          return [`${value} (${pct}%)`, name || 'Other'];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                    <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No contract types assigned yet</p>
                  </div>
                )
              )}
            </CardContent>
          </Card>


          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                Approval Pipeline
              </CardTitle>
              <CardDescription>Contract approval workflow status</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <ChartSkeleton /> : (
                pipelineTotal > 0 ? (
                  <div className="space-y-4 pt-2">
                    <div className="h-4 w-full rounded-full overflow-hidden bg-muted flex" data-testid="pipeline-progress-bar">
                      {kpis?.approvalPipeline && (
                        <>
                          {kpis.approvalPipeline.approved > 0 && (
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-700"
                              style={{ width: `${(kpis.approvalPipeline.approved / pipelineTotal) * 100}%` }}
                            />
                          )}
                          {kpis.approvalPipeline.pendingApproval > 0 && (
                            <div 
                              className="h-full bg-amber-500 transition-all duration-700"
                              style={{ width: `${(kpis.approvalPipeline.pendingApproval / pipelineTotal) * 100}%` }}
                            />
                          )}
                          {kpis.approvalPipeline.draft > 0 && (
                            <div 
                              className="h-full bg-slate-400 transition-all duration-700"
                              style={{ width: `${(kpis.approvalPipeline.draft / pipelineTotal) * 100}%` }}
                            />
                          )}
                          {kpis.approvalPipeline.rejected > 0 && (
                            <div 
                              className="h-full bg-red-500 transition-all duration-700"
                              style={{ width: `${(kpis.approvalPipeline.rejected / pipelineTotal) * 100}%` }}
                            />
                          )}
                        </>
                      )}
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Approved', value: kpis?.approvalPipeline?.approved || 0, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
                        { label: 'Pending', value: kpis?.approvalPipeline?.pendingApproval || 0, color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400', icon: Clock },
                        { label: 'Draft', value: kpis?.approvalPipeline?.draft || 0, color: 'bg-slate-400', textColor: 'text-slate-600 dark:text-slate-400', icon: FileText },
                        { label: 'Rejected', value: kpis?.approvalPipeline?.rejected || 0, color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', icon: XCircle },
                      ].filter(item => item.value > 0).map((item) => (
                        <div key={item.label} className="flex items-center gap-3">
                          <item.icon className={`h-4 w-4 ${item.textColor}`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium">{item.label}</span>
                              <span className={`text-xs font-bold ${item.textColor}`}>{item.value}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${item.color} transition-all duration-700`}
                                style={{ width: `${(item.value / pipelineTotal) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-center text-muted-foreground">{pipelineTotal} total in pipeline</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                    <TrendingUp className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No approval data yet</p>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-purple-500" />
                    Recent Calculations
                  </CardTitle>
                  <CardDescription>Latest contract fee calculation runs</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : kpis?.recentCalculations && kpis.recentCalculations.length > 0 ? (
                <div className="space-y-2">
                  {kpis.recentCalculations.map((calc, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                      data-testid={`calc-row-${index}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{calc.name}</p>
                        <p className="text-xs text-muted-foreground">{calc.date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{formatCurrency(calc.amount)}</span>
                        <Badge 
                          variant={calc.status === 'approved' ? 'default' : calc.status === 'paid' ? 'default' : 'secondary'}
                          className={
                            calc.status === 'approved' ? 'bg-emerald-500 text-white' : 
                            calc.status === 'paid' ? 'bg-orange-600 text-white' : 
                            calc.status === 'pending_approval' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : ''
                          }
                        >
                          {calc.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <DollarSign className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No calculations run yet</p>
                  <p className="text-xs mt-1">Run contract fee calculations from a contract's dashboard</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-orange-600" />
                    Top Contracts by Value
                  </CardTitle>
                  <CardDescription>Highest value contracts in portfolio</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} data-testid="button-view-all-contracts">
                  View All
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : kpis?.topContractsByValue && kpis.topContractsByValue.some(c => c.value > 0) ? (
                <div className="space-y-2">
                  {kpis.topContractsByValue.filter(c => c.value > 0).map((contract, index) => {
                    const maxVal = Math.max(...kpis.topContractsByValue.map(c => c.value));
                    const pct = maxVal > 0 ? (contract.value / maxVal) * 100 : 0;
                    return (
                      <div 
                        key={index} 
                        className="relative p-3 rounded-lg bg-muted/50"
                        data-testid={`contract-value-row-${index}`}
                      >
                        <div className="absolute inset-y-0 left-0 rounded-lg bg-orange-600/10" style={{ width: `${pct}%` }} />
                        <div className="relative flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{contract.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{formatCurrency(contract.value)}</span>
                            <Badge variant="outline" className="capitalize text-xs">{contract.status}</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No contract values available</p>
                  <p className="text-xs mt-1">Financial analysis populates during contract processing</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {!isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="widget-fee-breakdown">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Contract Fee Breakdown
                </CardTitle>
                <CardDescription>Financial summary by approval status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="text-sm font-medium">Approved</p>
                        <p className="text-xs text-muted-foreground">{approvedCount} calculation{approvedCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      ${approvedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium">Pending Approval</p>
                        <p className="text-xs text-muted-foreground">{pendingCount} calculation{pendingCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      ${pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="border-t pt-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Total Calculated</p>
                    <p className="text-lg font-bold">
                      ${(approvedAmount + pendingAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="widget-contract-timeline">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-orange-600" />
                  Contract Activity Timeline
                </CardTitle>
                <CardDescription>Recent contract and calculation events</CardDescription>
              </CardHeader>
              <CardContent>
                {kpis?.recentCalculations && kpis.recentCalculations.length > 0 ? (
                  <div className="relative">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-3">
                      {kpis.recentCalculations.slice(0, 5).map((calc, index) => (
                        <div key={index} className="flex items-start gap-3 pl-1" data-testid={`timeline-event-${index}`}>
                          <div className={`relative z-10 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                            calc.status === 'approved' ? 'border-emerald-500 bg-emerald-500/10' :
                            calc.status === 'paid' ? 'border-orange-600 bg-orange-600/10' :
                            calc.status === 'pending_approval' ? 'border-amber-500 bg-amber-500/10' :
                            'border-muted-foreground bg-muted'
                          }`}>
                            <div className={`h-2 w-2 rounded-full ${
                              calc.status === 'approved' ? 'bg-emerald-500' :
                              calc.status === 'paid' ? 'bg-orange-600' :
                              calc.status === 'pending_approval' ? 'bg-amber-500' :
                              'bg-muted-foreground'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium truncate">{calc.name}</p>
                              <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">{calc.date}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Calculation: {formatCurrency(calc.amount)} · <span className="capitalize">{calc.status.replace('_', ' ')}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Activity className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs mt-1">Upload contracts and run calculations to see activity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
