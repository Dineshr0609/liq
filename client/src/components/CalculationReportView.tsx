import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { 
  BarChart3, 
  FileText, 
  Download, 
  Layers, 
  Package, 
  MapPin, 
  Users, 
  Calendar,
  TrendingUp,
  DollarSign,
  Hash
} from 'lucide-react';
import { formatDateUSA } from '@/lib/dateFormat';
import { DualTerminologyBadge } from './DualTerminologyBadge';
import { LinkedValueBadge } from './LinkedValueBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useErpValueMap, ErpValueDisplay } from '@/hooks/useErpValueMap';

interface DimensionConfig {
  dimensionKey: string;
  displayName: string;
  dimensionType: string;
  erpFieldName?: string;
  isGroupable: boolean;
  sortOrder: number;
}

interface AggregatedResult {
  dimensionValue: string;
  totalSalesAmount: number;
  totalQuantity: number;
  totalFee: number;
  transactionCount: number;
  avgRate?: number;
}

interface LineItem {
  id: string;
  transactionDate: string;
  transactionId?: string;
  salesAmount: number;
  quantity: number;
  unitPrice: number;
  calculatedFee: number;
  appliedRate: number;
  ruleName?: string;
  ruleType?: string;
  tierApplied?: string;
  dimensions: Record<string, string>;
  vendorName?: string;
  itemName?: string;
  itemClass?: string;
  territory?: string;
  period?: string;
  transactionCount?: number;
}

interface CalculationReportProps {
  calculationId: string;
  contractId?: string;
}

const getDimensionIcon = (dimensionType: string) => {
  switch (dimensionType) {
    case 'vendor':
      return <Users className="h-4 w-4" />;
    case 'product':
      return <Package className="h-4 w-4" />;
    case 'category':
      return <Layers className="h-4 w-4" />;
    case 'territory':
      return <MapPin className="h-4 w-4" />;
    case 'period':
      return <Calendar className="h-4 w-4" />;
    case 'summary':
      return <BarChart3 className="h-4 w-4" />;
    case 'detail':
      return <FileText className="h-4 w-4" />;
    default:
      return <Layers className="h-4 w-4" />;
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatNumber = (value: number, decimals = 0) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

export default function CalculationReportView({ calculationId, contractId }: CalculationReportProps) {
  const [activeTab, setActiveTab] = useState('summary');

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['/api/calculations', calculationId, 'report'],
    enabled: !!calculationId
  });

  const { data: dimensionsData, isLoading: dimensionsLoading } = useQuery<{ dimensions: DimensionConfig[] }>({
    queryKey: ['/api/contracts', contractId, 'dimensions'],
    enabled: !!contractId
  });

  const { data: aggregatedData, isLoading: aggregatedLoading } = useQuery<{ dimensionKey: string; data: AggregatedResult[] }>({
    queryKey: ['/api/calculations', calculationId, 'aggregate', activeTab],
    enabled: !!calculationId && activeTab !== 'summary' && activeTab !== 'detail'
  });

  const { data: lineItemsData, isLoading: lineItemsLoading } = useQuery<{ lineItems: LineItem[] }>({
    queryKey: ['/api/calculations', calculationId, 'line-items'],
    enabled: !!calculationId && activeTab === 'detail'
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/calculations', calculationId, 'summary-report'],
    enabled: !!calculationId && activeTab === 'summary'
  });

  const effectiveSummaryData = useMemo(() => {
    const sd = summaryData as any;
    if (sd?.byRule?.length > 0 || sd?.byItemClass?.length > 0) {
      return sd;
    }
    const items = (reportData as any)?.lineItems;
    if (!items || items.length === 0) return sd || null;
    const ruleMap = new Map<string, { ruleName: string; ruleType: string | null; totalQuantity: number; totalFee: number; transactionCount: number }>();
    const classMap = new Map<string, { itemClass: string; totalQuantity: number; totalFee: number; transactionCount: number }>();
    for (const item of items) {
      const rKey = item.ruleName || 'Unknown';
      const existing = ruleMap.get(rKey) || { ruleName: rKey, ruleType: item.ruleType || null, totalQuantity: 0, totalFee: 0, transactionCount: 0 };
      existing.totalQuantity += parseFloat(item.quantity) || 0;
      existing.totalFee += parseFloat(item.calculatedFee) || 0;
      existing.transactionCount += 1;
      ruleMap.set(rKey, existing);

      const cKey = item.itemClass || item.dimensions?.item_class || item.dimensions?.category || 'Unclassified';
      const cExisting = classMap.get(cKey) || { itemClass: cKey, totalQuantity: 0, totalFee: 0, transactionCount: 0 };
      cExisting.totalQuantity += parseFloat(item.quantity) || 0;
      cExisting.totalFee += parseFloat(item.calculatedFee) || 0;
      cExisting.transactionCount += 1;
      classMap.set(cKey, cExisting);
    }
    return {
      ...(sd || {}),
      byRule: Array.from(ruleMap.values()).sort((a, b) => b.totalFee - a.totalFee),
      byItemClass: Array.from(classMap.values()).sort((a, b) => b.totalFee - a.totalFee),
    };
  }, [summaryData, reportData]);

  // Fetch ERP value mappings for displaying ERP terminology
  const { erpValueMap, erpMappingInfoMap } = useErpValueMap(contractId);

  const standardTabs: DimensionConfig[] = [
    { dimensionKey: 'summary', displayName: 'Summary', dimensionType: 'summary', isGroupable: false, sortOrder: 0 },
    { dimensionKey: 'detail', displayName: 'Detail', dimensionType: 'detail', isGroupable: false, sortOrder: 1 },
    { dimensionKey: 'item_name', displayName: 'By Product', dimensionType: 'product', isGroupable: true, sortOrder: 2 },
    { dimensionKey: 'vendor_name', displayName: 'By Vendor', dimensionType: 'vendor', isGroupable: true, sortOrder: 3 },
    { dimensionKey: 'item_class', displayName: 'By Category', dimensionType: 'category', isGroupable: true, sortOrder: 4 },
    { dimensionKey: 'territory', displayName: 'By Territory', dimensionType: 'territory', isGroupable: true, sortOrder: 5 },
    { dimensionKey: 'period', displayName: 'By Period', dimensionType: 'period', isGroupable: true, sortOrder: 6 },
    { dimensionKey: 'rule_name', displayName: 'By Rule', dimensionType: 'rule', isGroupable: true, sortOrder: 7 },
  ];

  const standardKeys = new Set(standardTabs.map(t => t.dimensionKey));

  const apiDimensions = (dimensionsData?.dimensions || []);
  for (const apiDim of apiDimensions) {
    const match = standardTabs.find(t => t.dimensionKey === apiDim.dimensionKey);
    if (match && apiDim.displayName) {
      match.displayName = apiDim.displayName;
      if (apiDim.erpFieldName) match.erpFieldName = apiDim.erpFieldName;
    }
  }

  const extraDimensions = apiDimensions.filter(d => !standardKeys.has(d.dimensionKey));
  const dimensions = [...standardTabs, ...extraDimensions];
  const report = reportData as any;

  if (reportLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="calculation-report-view">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="text-report-title">
              <BarChart3 className="h-5 w-5" />
              Calculation Report
            </CardTitle>
            <CardDescription>
              {report?.calculationName || 'Contract Fee Calculation'} 
              {report?.periodStart && report?.periodEnd && (
                <span className="ml-2">
                  ({formatDateUSA(report.periodStart)} - {formatDateUSA(report.periodEnd)})
                </span>
              )}
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            data-testid="button-export-report"
            onClick={() => {
              const link = document.createElement('a');
              link.href = `/api/calculations/${calculationId}/report/${activeTab}/pdf`;
              link.download = `report-${activeTab}.pdf`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            disabled={activeTab === 'summary' || activeTab === 'detail'}
          >
            <Download className="h-4 w-4 mr-1" />
            Export PDF
          </Button>
        </div>

        <div className="flex gap-4 mt-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
            <DollarSign className="h-4 w-4 text-orange-700" />
            <div>
              <div className="text-xs text-muted-foreground">Total Sales</div>
              <div className="font-semibold text-orange-700" data-testid="text-total-sales">
                {formatCurrency(report?.totalSalesAmount || 0)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-xs text-muted-foreground">Total Contract Fee</div>
              <div className="font-semibold text-green-600" data-testid="text-total-fee">
                {formatCurrency(report?.totalFee || 0)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
            <Hash className="h-4 w-4 text-purple-600" />
            <div>
              <div className="text-xs text-muted-foreground">Transactions</div>
              <div className="font-semibold text-purple-600" data-testid="text-transaction-count">
                {formatNumber(report?.transactionCount || 0)}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4" data-testid="tabs-dimensions">
            {dimensions.map((dim) => (
              <TabsTrigger 
                key={dim.dimensionKey} 
                value={dim.dimensionKey}
                className="flex items-center gap-1"
                data-testid={`tab-${dim.dimensionKey}`}
              >
                {getDimensionIcon(dim.dimensionType)}
                {dim.displayName}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="summary">
            {summaryLoading && !effectiveSummaryData ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <SummaryView data={effectiveSummaryData} erpValueMap={erpValueMap} erpMappingInfoMap={erpMappingInfoMap} />
            )}
          </TabsContent>

          <TabsContent value="detail">
            {lineItemsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <DetailView lineItems={lineItemsData?.lineItems || []} erpValueMap={erpValueMap} erpMappingInfoMap={erpMappingInfoMap} />
            )}
          </TabsContent>

          {dimensions
            .filter(dim => dim.dimensionKey !== 'summary' && dim.dimensionKey !== 'detail')
            .map((dim) => (
              <TabsContent key={dim.dimensionKey} value={dim.dimensionKey}>
                {aggregatedLoading && activeTab === dim.dimensionKey ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <AggregatedView 
                    dimensionName={dim.displayName} 
                    data={activeTab === dim.dimensionKey ? aggregatedData?.data || [] : []} 
                    erpValueMap={erpValueMap}
                    erpMappingInfoMap={erpMappingInfoMap}
                  />
                )}
              </TabsContent>
            ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SummaryView({ data, erpValueMap, erpMappingInfoMap }: { data: any; erpValueMap?: Map<string, string>; erpMappingInfoMap?: Map<string, any> }) {
  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No summary data available. Run a calculation to see results.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Rule</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byRule?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Contract Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byRule.map((row: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="font-medium">{row.ruleName || 'Unknown'}</div>
                        <Badge variant="outline" className="text-xs">{row.ruleType}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(row.totalQuantity)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(row.totalFee)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">No rule breakdown available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Product Category</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byItemClass?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Category</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Contract Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byItemClass.map((row: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        <ErpValueDisplay value={row.itemClass} erpValueMap={erpValueMap || new Map()} erpMappingInfoMap={erpMappingInfoMap} columnFieldName="product_category" />
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(row.totalQuantity)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(row.totalFee)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">No product category breakdown available</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailView({ lineItems, erpValueMap, erpMappingInfoMap }: { lineItems: LineItem[]; erpValueMap: Map<string, string>; erpMappingInfoMap?: Map<string, any> }) {
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  const totalRows = lineItems.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const startRow = totalRows === 0 ? 0 : safePageIndex * pageSize + 1;
  const endRow = Math.min(totalRows, (safePageIndex + 1) * pageSize);
  const pagedItems = useMemo(
    () => lineItems.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize),
    [lineItems, safePageIndex, pageSize]
  );

  if (lineItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No line item details available. Line items are populated when calculations are run.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-right">#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Sales Amount</TableHead>
              <TableHead>Rule Applied</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Formula</TableHead>
              <TableHead className="text-right">Contract Fee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.map((item, idx) => (
            <TableRow key={item.id} data-testid={`row-line-item-${item.id}`}>
              <TableCell
                className="text-right text-xs text-muted-foreground tabular-nums"
                data-testid={`text-row-number-${item.id}`}
              >
                {safePageIndex * pageSize + idx + 1}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {item.transactionDate ? formatDateUSA(item.transactionDate) : '-'}
              </TableCell>
              <TableCell>
                <div className="font-medium">
                  <ErpValueDisplay 
                    value={item.itemName || '-'} 
                    erpValueMap={erpValueMap}
                    erpMappingInfoMap={erpMappingInfoMap}
                    columnFieldName="product_name"
                  />
                </div>
                {item.vendorName && (
                  <div className="text-xs text-muted-foreground">
                    <ErpValueDisplay 
                      value={item.vendorName} 
                      erpValueMap={erpValueMap}
                      erpMappingInfoMap={erpMappingInfoMap}
                      columnFieldName="vendor_name"
                    />
                  </div>
                )}
              </TableCell>
              <TableCell>
                {item.itemClass && (
                  <ErpValueDisplay 
                    value={item.itemClass} 
                    erpValueMap={erpValueMap}
                    erpMappingInfoMap={erpMappingInfoMap}
                    columnFieldName="product_category"
                  />
                )}
              </TableCell>
              <TableCell
                className="text-right tabular-nums"
                data-testid={`text-row-count-${item.id}`}
                title={`${item.transactionCount ?? 1} source transaction(s) summed into this row`}
              >
                {item.transactionCount ?? 1}
              </TableCell>
              <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
              <TableCell className="text-right">{formatCurrency(item.salesAmount)}</TableCell>
              <TableCell>
                <div className="text-sm">{item.ruleName || '-'}</div>
                {item.tierApplied && (
                  <div className="text-xs text-muted-foreground">{item.tierApplied}</div>
                )}
              </TableCell>
              <TableCell className="text-right">
                {item.appliedRate
                  ? (item.ruleType === 'per_unit' || item.ruleType === 'per-unit' || item.ruleType === 'fixed_fee' || item.ruleType === 'fixed'
                    ? `$${item.appliedRate.toFixed(4)}/unit`
                    : `${(item.appliedRate * 100).toFixed(2)}%`)
                  : '-'}
              </TableCell>
              <TableCell>
                {item.ruleName && item.ruleName !== 'No matching rule' ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-xs space-y-0.5 cursor-help max-w-[220px]">
                          {item.ruleType === 'per_unit' || item.ruleType === 'per-unit' || item.ruleType === 'fixed_fee' || item.ruleType === 'fixed' ? (
                            <>
                              <div className="font-mono text-orange-700 dark:text-orange-400">
                                {formatNumber(item.quantity)} × ${item.appliedRate ? (item.appliedRate).toFixed(4) : '0'}
                              </div>
                              <div className="text-[9px] text-muted-foreground">qty × rate/unit</div>
                            </>
                          ) : (
                            <>
                              <div className="font-mono text-orange-700 dark:text-orange-400">
                                {formatCurrency(item.salesAmount)} × {item.appliedRate ? `${(item.appliedRate * 100).toFixed(2)}%` : '0%'}
                              </div>
                              <div className="text-[9px] text-muted-foreground">amount × rate%</div>
                            </>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[340px] text-xs p-3 space-y-1.5">
                        <div className="font-semibold border-b pb-1 mb-1">Formula Breakdown</div>
                        {item.ruleType === 'per_unit' || item.ruleType === 'per-unit' || item.ruleType === 'fixed_fee' || item.ruleType === 'fixed' ? (
                          <>
                            <div><span className="text-muted-foreground">Quantity</span> = <span className="font-mono">{formatNumber(item.quantity)}</span></div>
                            <div className="text-[10px] text-muted-foreground pl-2">↳ sales_data.quantity</div>
                            <div><span className="text-muted-foreground">Rate/Unit</span> = <span className="font-mono">${item.appliedRate?.toFixed(4)}</span></div>
                            <div className="text-[10px] text-muted-foreground pl-2">↳ contract_rules.base_rate</div>
                            <div className="border-t pt-1 mt-1"><span className="text-muted-foreground">Fee</span> = <span className="font-mono font-semibold">{formatNumber(item.quantity)} × ${item.appliedRate?.toFixed(4)} = {formatCurrency(item.calculatedFee)}</span></div>
                            <div className="text-[10px] text-muted-foreground pl-2">↳ calculation_rule_results.total_fee</div>
                          </>
                        ) : (
                          <>
                            <div><span className="text-muted-foreground">Sales Amount</span> = <span className="font-mono">{formatCurrency(item.salesAmount)}</span></div>
                            <div className="text-[10px] text-muted-foreground pl-2">↳ sales_data.net_amount</div>
                            <div><span className="text-muted-foreground">Rate</span> = <span className="font-mono">{item.appliedRate ? `${(item.appliedRate * 100).toFixed(2)}%` : '-'}</span></div>
                            <div className="text-[10px] text-muted-foreground pl-2">↳ contract_rules.base_rate ÷ 100</div>
                            <div className="border-t pt-1 mt-1"><span className="text-muted-foreground">Fee</span> = <span className="font-mono font-semibold">{formatCurrency(item.salesAmount)} × {item.appliedRate ? `${(item.appliedRate * 100).toFixed(2)}%` : '0%'} = {formatCurrency(item.calculatedFee)}</span></div>
                            <div className="text-[10px] text-muted-foreground pl-2">↳ calculation_rule_results.total_fee</div>
                          </>
                        )}
                        <div className="border-t pt-1 mt-1 text-[10px] text-muted-foreground">
                          Rule: contract_rules.rule_name = "{item.ruleName}"
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No rule matched</span>
                )}
              </TableCell>
              <TableCell className="text-right font-medium text-green-600">
                {formatCurrency(item.calculatedFee)}
              </TableCell>
            </TableRow>
          ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1" data-testid="pagination-line-items">
        <div className="text-sm text-muted-foreground" data-testid="text-pagination-summary">
          Showing <span className="font-medium text-foreground">{startRow}</span>
          {'\u2013'}
          <span className="font-medium text-foreground">{endRow}</span> of{' '}
          <span className="font-medium text-foreground">{totalRows}</span> rows
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPageIndex(0);
              }}
            >
              <SelectTrigger className="h-8 w-[80px]" data-testid="select-page-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)} data-testid={`option-page-size-${n}`}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(0)}
              disabled={safePageIndex === 0}
              data-testid="button-page-first"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(Math.max(0, safePageIndex - 1))}
              disabled={safePageIndex === 0}
              data-testid="button-page-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2" data-testid="text-page-indicator">
              Page <span className="font-medium">{safePageIndex + 1}</span> of{' '}
              <span className="font-medium">{totalPages}</span>
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(Math.min(totalPages - 1, safePageIndex + 1))}
              disabled={safePageIndex >= totalPages - 1}
              data-testid="button-page-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(totalPages - 1)}
              disabled={safePageIndex >= totalPages - 1}
              data-testid="button-page-last"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AggregatedView({ dimensionName, data, erpValueMap, erpMappingInfoMap }: { dimensionName: string; data: AggregatedResult[]; erpValueMap?: Map<string, string>; erpMappingInfoMap?: Map<string, any> }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available for {dimensionName}. Run a calculation to populate this view.
      </div>
    );
  }

  // Check if all values are "Unknown" - this means the dimension data wasn't captured in the source
  const allUnknown = data.every(row => row.dimensionValue === 'Unknown' || !row.dimensionValue);
  
  if (allUnknown && (dimensionName.includes('Supplier') || dimensionName.includes('Vendor'))) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-3">
        <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <div className="font-medium">Supplier data not available</div>
        <p className="text-sm max-w-md mx-auto">
          The uploaded sales data does not include supplier information. To see this breakdown, 
          ensure your sales data includes a supplier or vendor column when importing.
        </p>
      </div>
    );
  }

  const totalFee = data.reduce((sum, row) => sum + row.totalFee, 0);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{dimensionName}</TableHead>
            <TableHead className="text-right">Transactions</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Sales Amount</TableHead>
            <TableHead className="text-right">Contract Fee</TableHead>
            <TableHead className="text-right">% of Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={idx} data-testid={`row-aggregated-${idx}`}>
              <TableCell className="font-medium">
                <ErpValueDisplay 
                  value={row.dimensionValue} 
                  erpValueMap={erpValueMap || new Map()}
                  erpMappingInfoMap={erpMappingInfoMap}
                  columnFieldName={dimensionName.toLowerCase().includes('vendor') ? 'vendor_name' : dimensionName.toLowerCase().includes('categor') || dimensionName.toLowerCase().includes('class') ? 'product_category' : 'product_name'}
                />
              </TableCell>
              <TableCell className="text-right">{formatNumber(row.transactionCount)}</TableCell>
              <TableCell className="text-right">{formatNumber(row.totalQuantity)}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.totalSalesAmount)}</TableCell>
              <TableCell className="text-right font-medium text-green-600">
                {formatCurrency(row.totalFee)}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="secondary">
                  {totalFee > 0 ? ((row.totalFee / totalFee) * 100).toFixed(1) : 0}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{formatNumber(data.reduce((s, r) => s + r.transactionCount, 0))}</TableCell>
            <TableCell className="text-right">{formatNumber(data.reduce((s, r) => s + r.totalQuantity, 0))}</TableCell>
            <TableCell className="text-right">{formatCurrency(data.reduce((s, r) => s + r.totalSalesAmount, 0))}</TableCell>
            <TableCell className="text-right text-green-600">{formatCurrency(totalFee)}</TableCell>
            <TableCell className="text-right">100%</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
