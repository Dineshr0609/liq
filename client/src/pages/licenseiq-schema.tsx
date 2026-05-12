import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit2,
  Trash2,
  Database,
  FileText,
  DollarSign,
  ShoppingCart,
  Package,
  Search,
  Layers,
  CheckCircle2,
  Globe,
  Code,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Building,
  Filter,
  ArrowUpDown,
  Download,
  X,
  AlertCircle,
  Copy,
  Check,
  Terminal,
  Play,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { RefreshCw, Columns3, Eye, EyeOff, RotateCcw } from "lucide-react";

interface LicenseiqEntity {
  id: string;
  name: string;
  technicalName: string;
  description?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

interface LicenseiqField {
  id: string;
  entityId: string;
  fieldName: string;
  dataType: string;
  description?: string;
  isRequired: boolean;
  defaultValue?: string;
  validationRules?: string;
  createdAt: string;
  updatedAt: string;
}

interface LicenseiqApiEndpoint {
  id: string;
  entityId: string;
  operationType: string;
  name: string;
  httpMethod: string;
  pathTemplate: string;
  requestBodyPath?: string;
  responseDataPath?: string;
  paginationType?: string;
  pageParamName?: string;
  limitParamName?: string;
  cursorParamName?: string;
  offsetParamName?: string;
  totalPath?: string;
  hasMorePath?: string;
  nextCursorPath?: string;
  defaultPageSize: number;
  requiredScopes?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Organization Hierarchy": "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-100",
  "Master Data": "bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-100",
  "Transactions": "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100",
  "Transactional": "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100",
  "Rules": "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100",
};

const ENTITY_ICONS: Record<string, typeof Database> = {
  sales_data: ShoppingCart,
  contract_terms: FileText,
  contract_rules: DollarSign,
  payments: DollarSign,
  products: Package,
};

const DATA_TYPES = [
  "string",
  "number",
  "date",
  "boolean",
  "object",
  "array",
];

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      data-testid={`button-copy-${label || "text"}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : (label || "Copy")}
    </Button>
  );
}

function EndpointDetailPanel({ endpoint, entity }: { endpoint: any; entity: any }) {
  const [activeTab, setActiveTab] = useState<"curl" | "postman" | "details">("curl");
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}${endpoint.pathTemplate}`;
  const resolvedUrl = fullUrl.replace(/\{id\}/g, ":id");
  const isWrite = ["POST", "PUT", "PATCH"].includes(endpoint.httpMethod);

  const sampleBody: Record<string, any> = {};
  if (isWrite && entity) {
    const entityName = entity.technicalName || "";
    if (entityName.includes("company")) Object.assign(sampleBody, { companyName: "Acme Corp", companyCode: "ACME-001", industry: "Technology", status: "active" });
    else if (entityName.includes("partner")) Object.assign(sampleBody, { partnerName: "Global Distributors", partnerCode: "GD-001", partnerType: "distributor", status: "active" });
    else if (entityName.includes("product") && !entityName.includes("territory") && !entityName.includes("channel") && !entityName.includes("packaging") && !entityName.includes("bom") && !entityName.includes("attribute") && !entityName.includes("hierarchy") && !entityName.includes("classification")) Object.assign(sampleBody, { productName: "Widget Pro", productCode: "WGT-001", category: "Hardware", unitPrice: 29.99 });
    else if (entityName.includes("customer")) Object.assign(sampleBody, { customerName: "TechCo Industries", customerCode: "TC-001", segment: "Enterprise", status: "active" });
    else if (entityName.includes("sales_transaction")) Object.assign(sampleBody, { records: [{ transactionDate: "2025-01-15", productCode: "WGT-001", quantity: 100, unitPrice: 29.99, totalAmount: 2999.00 }] });
    else if (entityName.includes("territory")) Object.assign(sampleBody, { territoryCode: "US-WEST", territoryName: "US West Region", region: "North America" });
    else if (entityName.includes("channel")) Object.assign(sampleBody, { channelCode: "RETAIL", channelName: "Retail", channelType: "Direct" });
    else Object.assign(sampleBody, { name: "Sample Record", code: "SAMPLE-001", status: "active" });
  }

  const curlCmd = (() => {
    let cmd = `curl -X ${endpoint.httpMethod} \\\n  '${resolvedUrl}'`;
    cmd += ` \\\n  -H 'Content-Type: application/json'`;
    cmd += ` \\\n  -H 'Cookie: connect.sid=YOUR_SESSION_ID'`;
    if (isWrite && Object.keys(sampleBody).length > 0) {
      cmd += ` \\\n  -d '${JSON.stringify(sampleBody, null, 2)}'`;
    }
    if (endpoint.operationType === "list") {
      cmd += ` \\\n  -G -d 'limit=50' -d 'offset=0'`;
    }
    return cmd;
  })();

  const postmanConfig = {
    info: { name: endpoint.name, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
    item: [{
      name: endpoint.name,
      request: {
        method: endpoint.httpMethod,
        header: [{ key: "Content-Type", value: "application/json" }],
        url: {
          raw: resolvedUrl,
          protocol: "https",
          host: [window.location.hostname],
          path: endpoint.pathTemplate.split("/").filter(Boolean),
          ...(endpoint.operationType === "list" ? { query: [{ key: "limit", value: "50" }, { key: "offset", value: "0" }] } : {}),
        },
        ...(isWrite && Object.keys(sampleBody).length > 0 ? { body: { mode: "raw", raw: JSON.stringify(sampleBody, null, 2), options: { raw: { language: "json" } } } } : {}),
      },
    }],
  };

  const sampleResponse = (() => {
    if (endpoint.operationType === "list") {
      return JSON.stringify([{ id: "uuid-here", ...sampleBody, createdAt: "2025-01-15T10:00:00Z" }], null, 2);
    } else if (endpoint.operationType === "get") {
      return JSON.stringify({ id: "uuid-here", ...(Object.keys(sampleBody).length > 0 ? sampleBody : { name: "Sample", status: "active" }), createdAt: "2025-01-15T10:00:00Z" }, null, 2);
    } else if (isWrite) {
      return JSON.stringify({ id: "new-uuid-here", ...sampleBody, createdAt: "2025-01-15T10:00:00Z" }, null, 2);
    }
    return JSON.stringify({ success: true }, null, 2);
  })();

  return (
    <div className="py-4 space-y-4">
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Operation</p>
          <p className="font-medium capitalize">{endpoint.operationType}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Entity</p>
          <p className="font-medium">{entity?.name || "—"}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Pagination</p>
          <p className="font-medium capitalize">{endpoint.paginationType || "None"}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Status</p>
          <Badge variant={endpoint.isActive ? "default" : "secondary"}>{endpoint.isActive ? "Active" : "Inactive"}</Badge>
        </div>
      </div>

      {endpoint.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{endpoint.description}</p>
      )}

      <Separator />

      <div className="flex gap-1 border-b">
        {(["curl", "postman", "details"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            data-testid={`tab-endpoint-${tab}`}
          >
            {tab === "curl" && <span className="flex items-center gap-1.5"><Terminal className="h-3.5 w-3.5" /> cURL</span>}
            {tab === "postman" && <span className="flex items-center gap-1.5"><Play className="h-3.5 w-3.5" /> Postman</span>}
            {tab === "details" && <span className="flex items-center gap-1.5"><Code className="h-3.5 w-3.5" /> Response</span>}
          </button>
        ))}
      </div>

      {activeTab === "curl" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">cURL Command</p>
            <CopyButton text={curlCmd} label="curl" />
          </div>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed" data-testid="code-curl-example">
            {curlCmd}
          </pre>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">Authentication Required</p>
            <p className="text-amber-700 dark:text-amber-300 text-xs">
              Replace <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">YOUR_SESSION_ID</code> with your session cookie.
              Login first: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">POST /api/login</code> with <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">{`{"username":"admin","password":"..."}`}</code>
            </p>
          </div>
        </div>
      )}

      {activeTab === "postman" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Postman Collection (JSON)</p>
            <div className="flex gap-2">
              <CopyButton text={JSON.stringify(postmanConfig, null, 2)} label="postman-json" />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(postmanConfig, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${endpoint.name.replace(/\s+/g, '_')}.postman_collection.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                data-testid="button-download-postman"
              >
                <Download className="h-3.5 w-3.5" /> Download .json
              </Button>
            </div>
          </div>
          <pre className="bg-gray-900 text-blue-300 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto" data-testid="code-postman-example">
            {JSON.stringify(postmanConfig, null, 2)}
          </pre>
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">Import into Postman</p>
            <p className="text-blue-700 dark:text-blue-300 text-xs">
              1. Download the JSON file above. 2. Open Postman → Import → Upload file. 3. Set the <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">connect.sid</code> cookie in Postman's cookie manager.
            </p>
          </div>
        </div>
      )}

      {activeTab === "details" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Sample Response</p>
            <CopyButton text={sampleResponse} label="response" />
          </div>
          <pre className="bg-gray-900 text-yellow-300 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed" data-testid="code-response-example">
            {sampleResponse}
          </pre>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Request Headers</p>
              <div className="space-y-1 font-mono text-xs">
                <p>Content-Type: application/json</p>
                <p>Cookie: connect.sid=&lt;session&gt;</p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Response Codes</p>
              <div className="space-y-1 text-xs">
                <p><Badge variant="outline" className="text-green-600">200</Badge> Success</p>
                <p><Badge variant="outline" className="text-red-600">401</Badge> Unauthorized</p>
                {isWrite && <p><Badge variant="outline" className="text-yellow-600">400</Badge> Validation Error</p>}
                {endpoint.operationType === "get" && <p><Badge variant="outline" className="text-gray-600">404</Badge> Not Found</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteConfirmDialog({ itemName, onConfirm, onCancel }: { itemName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="font-semibold text-lg">Confirm Delete</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete &ldquo;<strong>{itemName}</strong>&rdquo;? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel-delete">
            Cancel
          </Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm} data-testid="button-confirm-delete">
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LookupTableConfig {
  key: string;
  name: string;
  tableName: string;
  description: string;
  category: string;
  apiBase: string;
  codeField: string;
  nameField: string;
  codeLabel: string;
  nameLabel: string;
  extraFields?: { key: string; label: string }[];
  responseKey?: string;
  isMatrix?: boolean;
}

const LOOKUP_TABLES: LookupTableConfig[] = [
  { key: "flow-types", name: "Flow Types", tableName: "flow_types", description: "Contract clause flow classifications (royalty, rebate, penalty, etc.)", category: "Pipeline Config", apiBase: "/api/pipeline/flow-types", codeField: "code", nameField: "name", codeLabel: "Code", nameLabel: "Name" },
  { key: "clause-categories", name: "Clause Categories", tableName: "clause_categories", description: "Categorization of extracted contract clauses", category: "Pipeline Config", apiBase: "/api/pipeline/clause-categories", codeField: "code", nameField: "name", codeLabel: "Code", nameLabel: "Name" },
  { key: "execution-groups", name: "Execution Groups", tableName: "clause_execution_groups", description: "Grouping of clauses for sequential execution during calculation", category: "Pipeline Config", apiBase: "/api/pipeline/execution-groups", codeField: "code", nameField: "name", codeLabel: "Code", nameLabel: "Name" },
  { key: "base-metrics", name: "Base Metrics", tableName: "base_metrics", description: "Calculation base metrics (net_sales, gross_sales, units_sold, etc.)", category: "Pipeline Config", apiBase: "/api/pipeline/base-metrics", codeField: "code", nameField: "name", codeLabel: "Code", nameLabel: "Name" },
  { key: "rule-templates", name: "Rule Templates", tableName: "rule_templates", description: "Pre-defined rule patterns for AI extraction and manual creation", category: "Pipeline Config", apiBase: "/api/pipeline/rule-templates", codeField: "templateCode", nameField: "name", codeLabel: "Template Code", nameLabel: "Name", extraFields: [{ key: "executionGroupCode", label: "Execution Group" }] },
  { key: "subtypes", name: "Program Subtypes", tableName: "subtypes", description: "Catalog of program subtypes (Rebate, Royalty, MDF, Chargeback, …) used by all flow types", category: "Pipeline Config", apiBase: "/api/subtypes/admin", codeField: "code", nameField: "name", codeLabel: "Code", nameLabel: "Name", extraFields: [{ key: "category", label: "Category" }] },
  { key: "flow-subtype-matrix", name: "Flow × Subtype Validity Matrix", tableName: "flow_subtype_validity", description: "Which program subtypes are valid for each flow type (and which one is primary)", category: "Pipeline Config", apiBase: "/api/flow-subtype-validity", codeField: "flowTypeCode", nameField: "subtypeCode", codeLabel: "Flow", nameLabel: "Subtype", isMatrix: true },
  { key: "contract-types", name: "Contract Type Definitions", tableName: "contract_type_definitions", description: "Supported contract types with AI extraction configurations", category: "Contract Config", apiBase: "/api/contract-types", codeField: "code", nameField: "name", codeLabel: "Type Code", nameLabel: "Name" },
  { key: "customer-segments", name: "Customer Segments", tableName: "customer_segments", description: "Customer groupings for rule qualifiers and reporting", category: "Market Data", apiBase: "/api/reference/customer-segments", codeField: "segmentCode", nameField: "segmentName", codeLabel: "Segment Code", nameLabel: "Segment Name" },
  { key: "sales-channels", name: "Sales Channels", tableName: "sales_channels", description: "Distribution and sales channel definitions for territory-based rules", category: "Market Data", apiBase: "/api/reference/sales-channels", codeField: "channel_code", nameField: "channel_name", codeLabel: "Channel Code", nameLabel: "Channel Name" },
  { key: "territory-master", name: "Territory Master", tableName: "territory_master", description: "Geographic territory hierarchy for territory-based contract rules", category: "Market Data", apiBase: "/api/reference/territory-master", codeField: "territory_code", nameField: "territory_name", codeLabel: "Territory Code", nameLabel: "Territory Name" },
  { key: "uom-master", name: "Unit of Measure", tableName: "uom_master", description: "Unit of measure definitions used in contract fee rules and calculations", category: "Market Data", apiBase: "/api/master/uom", codeField: "uom_code", nameField: "uom_name", codeLabel: "UOM Code", nameLabel: "UOM Name", extraFields: [{ key: "uom_category", label: "Category" }] },
  { key: "calc-field-types", name: "Calculation Field Types", tableName: "calculation_field_types", description: "Field type definitions for contract fee calculations per contract type", category: "Contract Config", apiBase: "/api/calculation-field-types", codeField: "fieldCode", nameField: "fieldName", codeLabel: "Field Code", nameLabel: "Field Name", extraFields: [{ key: "contractTypeCode", label: "Contract Type" }] },
];

const LOOKUP_CATEGORY_COLORS: Record<string, string> = {
  "Pipeline Config": "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100",
  "Contract Config": "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100",
  "Market Data": "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100",
};

function FlowSubtypeMatrixPanel({ onBack, config }: { onBack: () => void; config: LookupTableConfig }) {
  const { toast } = useToast();
  const flowsQ = useQuery<any[]>({
    queryKey: ['/api/pipeline/flow-types'],
    queryFn: async () => {
      const r = await fetch('/api/pipeline/flow-types', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load flow types');
      return r.json();
    },
  });
  const subtypesQ = useQuery<any[]>({
    queryKey: ['/api/subtypes/admin'],
    queryFn: async () => {
      const r = await fetch('/api/subtypes/admin', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load subtypes');
      return r.json();
    },
  });
  const matrixQ = useQuery<any[]>({
    queryKey: ['/api/flow-subtype-validity'],
    queryFn: async () => {
      const r = await fetch('/api/flow-subtype-validity', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load matrix');
      return r.json();
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (body: { flowTypeCode: string; subtypeCode: string; isPrimary: boolean }) =>
      apiRequest('POST', '/api/flow-subtype-validity', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flow-subtype-validity'] });
    },
    onError: (e: any) => toast({ title: 'Failed to update matrix', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (body: { flowTypeCode: string; subtypeCode: string }) =>
      apiRequest('DELETE', `/api/flow-subtype-validity?flowTypeCode=${encodeURIComponent(body.flowTypeCode)}&subtypeCode=${encodeURIComponent(body.subtypeCode)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flow-subtype-validity'] });
    },
    onError: (e: any) => toast({ title: 'Failed to update matrix', description: e.message, variant: 'destructive' }),
  });

  const flows = (flowsQ.data || []).filter((f: any) => f.isActive !== false);
  const subtypes = (subtypesQ.data || []).filter((s: any) => s.isActive !== false);
  const matrix = matrixQ.data || [];

  const cellKey = (f: string, s: string) => `${f}::${s}`;
  const cellMap = new Map<string, { isPrimary: boolean }>();
  matrix.forEach((m: any) => cellMap.set(cellKey(m.flowTypeCode, m.subtypeCode), { isPrimary: !!m.isPrimary }));

  const toggleCell = (flowCode: string, subtypeCode: string, currentlyChecked: boolean, currentlyPrimary: boolean) => {
    if (currentlyChecked) {
      deleteMutation.mutate({ flowTypeCode: flowCode, subtypeCode });
    } else {
      upsertMutation.mutate({ flowTypeCode: flowCode, subtypeCode, isPrimary: false });
    }
  };

  const setPrimary = (flowCode: string, subtypeCode: string) => {
    upsertMutation.mutate({ flowTypeCode: flowCode, subtypeCode, isPrimary: true });
  };

  const isLoading = flowsQ.isLoading || subtypesQ.isLoading || matrixQ.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-matrix">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h3 className="text-lg font-semibold">{config.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={LOOKUP_CATEGORY_COLORS[config.category] || ''}>{config.category}</Badge>
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{config.tableName}</code>
          <Badge variant="outline">{matrix.length} valid pairs</Badge>
        </div>
      </div>

      <div className="rounded-md border bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">
        Check a cell to mark a subtype as <strong>valid</strong> for that flow type. Click the ★ to mark
        it as the <strong>primary</strong> subtype for that flow (used by the auto-provision when a contract is created).
        Each flow type can have at most one primary subtype.
      </div>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold sticky left-0 bg-white dark:bg-gray-950 z-10 min-w-[180px]">
                  Subtype \ Flow
                </TableHead>
                {flows.map((f: any) => (
                  <TableHead key={f.code} className="text-xs font-semibold text-center min-w-[120px]" data-testid={`matrix-col-${f.code}`}>
                    <div className="font-mono text-xs">{f.code}</div>
                    <div className="text-[11px] text-gray-500 font-normal">{f.name}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {subtypes.map((s: any) => (
                <TableRow key={s.code} className="hover:bg-orange-50/30 dark:hover:bg-orange-950/10">
                  <TableCell className="sticky left-0 bg-white dark:bg-gray-950 z-10">
                    <div className="font-mono text-xs">{s.code}</div>
                    <div className="text-xs text-gray-500">{s.name}</div>
                    <div className="text-[10px] text-gray-400 uppercase">{s.category}</div>
                  </TableCell>
                  {flows.map((f: any) => {
                    const cell = cellMap.get(cellKey(f.code, s.code));
                    const checked = !!cell;
                    const primary = !!cell?.isPrimary;
                    return (
                      <TableCell key={f.code} className="text-center" data-testid={`matrix-cell-${f.code}-${s.code}`}>
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCell(f.code, s.code, checked, primary)}
                            className="h-4 w-4 cursor-pointer accent-orange-600"
                            data-testid={`matrix-check-${f.code}-${s.code}`}
                          />
                          {checked && (
                            <button
                              type="button"
                              onClick={() => !primary && setPrimary(f.code, s.code)}
                              className={`text-base leading-none ${primary ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'} cursor-pointer`}
                              title={primary ? 'Primary subtype for this flow' : 'Set as primary'}
                              data-testid={`matrix-primary-${f.code}-${s.code}`}
                            >
                              ★
                            </button>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {subtypes.length === 0 && (
                <TableRow><TableCell colSpan={flows.length + 1} className="text-center py-8 text-gray-500">No active subtypes — add some via the Program Subtypes lookup.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function ReferenceLookupManager({ searchQuery, expandedLookup, setExpandedLookup, lookupEditingId, setLookupEditingId, lookupForm, setLookupForm, lookupShowAdd, setLookupShowAdd }: {
  searchQuery: string;
  expandedLookup: string | null;
  setExpandedLookup: (v: string | null) => void;
  lookupEditingId: string | null;
  setLookupEditingId: (v: string | null) => void;
  lookupForm: Record<string, string>;
  setLookupForm: (v: Record<string, string>) => void;
  lookupShowAdd: boolean;
  setLookupShowAdd: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [lookupPendingDelete, setLookupPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const filteredTables = LOOKUP_TABLES.filter(t =>
    !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const expandedConfig = expandedLookup ? LOOKUP_TABLES.find(t => t.key === expandedLookup) : null;

  const { data: lookupData, isLoading: lookupLoading } = useQuery<any[]>({
    queryKey: [expandedConfig?.apiBase || "none"],
    enabled: !!expandedConfig,
    queryFn: async () => {
      if (!expandedConfig) return [];
      const r = await fetch(expandedConfig.apiBase, { credentials: 'include' });
      if (!r.ok) throw new Error("Failed to fetch");
      const data = await r.json();
      if (expandedConfig.responseKey && data[expandedConfig.responseKey]) return data[expandedConfig.responseKey];
      if (Array.isArray(data)) return data;
      const arrKey = Object.keys(data).find(k => Array.isArray(data[k]));
      return arrKey ? data[arrKey] : [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      if (!expandedConfig) throw new Error("No table selected");
      return apiRequest("POST", expandedConfig.apiBase, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === expandedConfig?.apiBase });
      toast({ title: "Record created successfully!" });
      setLookupShowAdd(false);
      setLookupForm({});
    },
    onError: (e: any) => { toast({ title: "Failed to create record", description: e.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, string> }) => {
      if (!expandedConfig) throw new Error("No table selected");
      return apiRequest("PUT", `${expandedConfig.apiBase}/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === expandedConfig?.apiBase });
      toast({ title: "Record updated successfully!" });
      setLookupEditingId(null);
      setLookupForm({});
    },
    onError: (e: any) => { toast({ title: "Failed to update record", description: e.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!expandedConfig) throw new Error("No table selected");
      return apiRequest("DELETE", `${expandedConfig.apiBase}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === expandedConfig?.apiBase });
      toast({ title: "Record deleted successfully!" });
    },
    onError: (e: any) => { toast({ title: "Failed to delete record", description: e.message, variant: "destructive" }); },
  });

  if (expandedConfig?.isMatrix) {
    return <FlowSubtypeMatrixPanel onBack={() => setExpandedLookup(null)} config={expandedConfig} />;
  }

  if (expandedConfig) {
    const records = Array.isArray(lookupData) ? lookupData : [];
    const allFields = [
      { key: expandedConfig.codeField, label: expandedConfig.codeLabel },
      { key: expandedConfig.nameField, label: expandedConfig.nameLabel },
      ...(expandedConfig.extraFields || []),
      { key: "description", label: "Description" },
    ];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setExpandedLookup(null); setLookupShowAdd(false); setLookupEditingId(null); setLookupForm({}); }} data-testid="button-back-lookups">
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div>
              <h3 className="text-lg font-semibold">{expandedConfig.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{expandedConfig.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={LOOKUP_CATEGORY_COLORS[expandedConfig.category] || ""}>{expandedConfig.category}</Badge>
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{expandedConfig.tableName}</code>
            <Badge variant="outline">{records.length} records</Badge>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => {
              setLookupShowAdd(true); setLookupEditingId(null);
              const existingCodes = records.map((r: any) => r[expandedConfig.codeField] || '');
              const codePrefix = expandedConfig.key === 'customer_segments' ? 'SEG' : expandedConfig.key === 'sales_channels' ? 'CH' : expandedConfig.key === 'territory_master' ? 'TERR' : expandedConfig.key === 'contract_types' ? 'CT' : expandedConfig.key === 'subflows' ? 'SF' : expandedConfig.key.substring(0, 3).toUpperCase();
              let maxN = 0;
              existingCodes.forEach((c: string) => { const m = c.match(/(\d+)$/); if (m) { const n = parseInt(m[1], 10); if (n > maxN) maxN = n; } });
              const nextCode = `${codePrefix}-${String(maxN + 1).padStart(3, '0')}`;
              setLookupForm({ [expandedConfig.codeField]: nextCode });
            }} data-testid="button-add-lookup-record">
              <Plus className="h-4 w-4 mr-1" /> Add Record
            </Button>
          </div>
        </div>

        {(lookupShowAdd || lookupEditingId) && (
          <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => { setLookupShowAdd(false); setLookupEditingId(null); setLookupForm({}); }} />
          <div className="fixed top-0 right-0 h-full w-[440px] max-w-[90vw] bg-white dark:bg-gray-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 dark:bg-gray-900 shrink-0">
              <div>
                <h3 className="font-semibold text-lg">{lookupEditingId ? "Edit Record" : "Add New Record"}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{expandedConfig.name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setLookupShowAdd(false); setLookupEditingId(null); setLookupForm({}); }} data-testid="button-cancel-lookup-form">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {allFields.map(f => {
                const isCode = f.key === expandedConfig.codeField;
                return (
                  <div key={f.key}>
                    <Label className="text-xs font-medium">{f.label}</Label>
                    <Input
                      value={lookupForm[f.key] || ""}
                      onChange={(e) => setLookupForm({ ...lookupForm, [f.key]: e.target.value })}
                      placeholder={isCode ? "Auto-generated" : f.label}
                      className={`h-9 text-sm ${isCode ? "bg-gray-100 dark:bg-gray-800 font-mono" : ""}`}
                      disabled={isCode}
                      data-testid={`input-lookup-${f.key}`}
                    />
                    {isCode && <p className="text-xs text-gray-500 mt-0.5">Auto-generated. Cannot be modified.</p>}
                  </div>
                );
              })}
            </div>
            <div className="shrink-0 border-t px-5 py-4 bg-gray-50 dark:bg-gray-900 flex gap-2">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white flex-1" disabled={createMutation.isPending || updateMutation.isPending}
                onClick={() => {
                  const nameVal = lookupForm[expandedConfig.nameField]?.trim();
                  if (!nameVal) {
                    toast({ title: `${expandedConfig.nameLabel} is required`, variant: "destructive" });
                    return;
                  }
                  const dupRecord = records.find((r: any) => {
                    if (lookupEditingId && r.id === lookupEditingId) return false;
                    return (r[expandedConfig.nameField] || '').trim().toLowerCase() === nameVal.toLowerCase();
                  });
                  if (dupRecord) {
                    toast({ title: "Duplicate name", description: `A record with the name "${nameVal}" already exists in ${expandedConfig.name}.`, variant: "destructive" });
                    return;
                  }
                  if (lookupEditingId) {
                    updateMutation.mutate({ id: lookupEditingId, body: lookupForm });
                  } else {
                    createMutation.mutate(lookupForm);
                  }
                }}
                data-testid="button-save-lookup-record"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : lookupEditingId ? "Update" : "Create"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setLookupShowAdd(false); setLookupEditingId(null); setLookupForm({}); }} data-testid="button-cancel-lookup">
                Cancel
              </Button>
            </div>
          </div>
          </>
        )}

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                {allFields.map(f => (
                  <TableHead key={f.key} className="text-xs font-semibold">{f.label}</TableHead>
                ))}
                <TableHead className="text-xs font-semibold w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lookupLoading ? (
                <TableRow><TableCell colSpan={allFields.length + 1} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={allFields.length + 1} className="text-center py-8 text-gray-500">No records found</TableCell></TableRow>
              ) : (
                records.map((record: any) => (
                  <TableRow key={record.id} className="hover:bg-orange-50/50 dark:hover:bg-orange-950/20">
                    {allFields.map(f => (
                      <TableCell key={f.key} className="text-sm">
                        {f.key === expandedConfig.codeField ? (
                          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs font-mono">{record[f.key] || "—"}</code>
                        ) : (
                          <span>{record[f.key] || "—"}</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setLookupEditingId(record.id);
                          setLookupShowAdd(false);
                          const formData: Record<string, string> = {};
                          allFields.forEach(f => { formData[f.key] = record[f.key] || ""; });
                          setLookupForm(formData);
                        }} data-testid={`button-edit-lookup-${record.id}`}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setLookupPendingDelete({ id: record.id, name: record[expandedConfig.nameField] || record[expandedConfig.codeField] || record.id })} data-testid={`button-delete-lookup-${record.id}`}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
        {lookupPendingDelete && (
          <DeleteConfirmDialog
            itemName={lookupPendingDelete.name}
            onConfirm={() => { deleteMutation.mutate(lookupPendingDelete.id); setLookupPendingDelete(null); }}
            onCancel={() => setLookupPendingDelete(null)}
          />
        )}
      </div>
    );
  }

  const grouped: Record<string, LookupTableConfig[]> = {};
  filteredTables.forEach(t => {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{filteredTables.length} reference lookup tables</p>
      </div>
      {Object.entries(grouped).map(([category, tables]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Badge className={LOOKUP_CATEGORY_COLORS[category] || ""}>{category}</Badge>
            <span className="text-xs text-gray-400">({tables.length} tables)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map(t => (
              <Card
                key={t.key}
                className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
                onClick={() => { setExpandedLookup(t.key); setLookupShowAdd(false); setLookupEditingId(null); setLookupForm({}); }}
                data-testid={`card-lookup-${t.key}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-100 dark:from-stone-900 dark:to-orange-950 rounded-lg group-hover:scale-110 transition-transform">
                        <Database className="h-5 w-5 text-orange-700 dark:text-orange-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{t.name}</CardTitle>
                        <code className="text-xs text-gray-500 dark:text-gray-400">{t.tableName}</code>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-orange-600 transition-colors" />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{t.codeLabel} / {t.nameLabel}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{t.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReferenceFieldsView() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const config = selectedTable ? LOOKUP_TABLES.find(t => t.key === selectedTable) : null;

  if (!config) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-orange-600" />
          <h3 className="text-lg font-semibold">Reference Lookup Fields</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select a lookup table to view its field definitions.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {LOOKUP_TABLES.map(t => (
            <Card key={t.key} className="cursor-pointer hover:shadow-md transition-shadow hover:border-orange-300" onClick={() => setSelectedTable(t.key)} data-testid={`card-ref-fields-${t.key}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-sm">{t.name}</span>
                </div>
                <code className="text-xs text-gray-400 mt-1 block">{t.tableName}</code>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const allFields = [
    { key: "id", label: "ID", type: "uuid", required: true },
    { key: config.codeField, label: config.codeLabel, type: "varchar", required: true },
    { key: config.nameField, label: config.nameLabel, type: "varchar", required: true },
    ...(config.extraFields || []).map(f => ({ key: f.key, label: f.label, type: "varchar", required: false })),
    { key: "description", label: "Description", type: "text", required: false },
    { key: "created_at", label: "Created At", type: "timestamp", required: false },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedTable(null)} data-testid="button-back-ref-fields">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h3 className="text-lg font-semibold">{config.name} — Fields</h3>
          <code className="text-xs text-gray-500">{config.tableName}</code>
        </div>
        <Badge className={LOOKUP_CATEGORY_COLORS[config.category] || ""}>{config.category}</Badge>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold">Field Name</TableHead>
              <TableHead className="text-xs font-semibold">Column</TableHead>
              <TableHead className="text-xs font-semibold">Type</TableHead>
              <TableHead className="text-xs font-semibold">Required</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allFields.map(f => (
              <TableRow key={f.key}>
                <TableCell className="font-medium text-sm">{f.label}</TableCell>
                <TableCell><code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{f.key}</code></TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{f.type}</Badge></TableCell>
                <TableCell>{f.required ? <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 text-xs">Required</Badge> : <span className="text-gray-400 text-xs">Optional</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function RefEndpointDetail({ table, method, path, operationType }: { table: LookupTableConfig; method: string; path: string; operationType: string }) {
  const [activeTab, setActiveTab] = useState<"curl" | "postman">("curl");
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}${path}`;
  const isWrite = ["POST", "PUT"].includes(method);

  const sampleBody: Record<string, any> = {};
  if (isWrite) {
    sampleBody[table.codeField] = "SAMPLE-001";
    sampleBody[table.nameField] = "Sample Record";
    if (table.extraFields) {
      table.extraFields.forEach(f => { sampleBody[f.key] = f.key.includes("type") ? "default" : "value"; });
    }
  }

  const curlCmd = (() => {
    let cmd = `curl -X ${method} \\\n  '${fullUrl}'`;
    cmd += ` \\\n  -H 'Content-Type: application/json'`;
    cmd += ` \\\n  -H 'Cookie: connect.sid=YOUR_SESSION_ID'`;
    if (isWrite && Object.keys(sampleBody).length > 0) {
      cmd += ` \\\n  -d '${JSON.stringify(sampleBody, null, 2)}'`;
    }
    return cmd;
  })();

  const postmanConfig = {
    info: { name: `${table.name} - ${method} ${operationType}`, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
    item: [{
      name: `${method} ${table.name}`,
      request: {
        method,
        header: [{ key: "Content-Type", value: "application/json" }],
        url: { raw: fullUrl, protocol: "https", host: [window.location.hostname], path: path.split("/").filter(Boolean) },
        ...(isWrite && Object.keys(sampleBody).length > 0 ? { body: { mode: "raw", raw: JSON.stringify(sampleBody, null, 2), options: { raw: { language: "json" } } } } : {}),
      },
    }],
  };

  return (
    <div className="py-3 space-y-3 border-t">
      <div className="flex gap-1">
        {(["curl", "postman"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab ? "border-orange-600 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            data-testid={`tab-ref-endpoint-${tab}`}
          >
            {tab === "curl" ? <span className="flex items-center gap-1"><Terminal className="h-3 w-3" /> cURL</span> : <span className="flex items-center gap-1"><Play className="h-3 w-3" /> Postman</span>}
          </button>
        ))}
      </div>
      {activeTab === "curl" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">cURL Command</p>
            <CopyButton text={curlCmd} label="ref-curl" />
          </div>
          <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed" data-testid="code-ref-curl">{curlCmd}</pre>
        </div>
      )}
      {activeTab === "postman" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Postman Collection</p>
            <div className="flex gap-2">
              <CopyButton text={JSON.stringify(postmanConfig, null, 2)} label="ref-postman" />
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => {
                const blob = new Blob([JSON.stringify(postmanConfig, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `${table.name.replace(/\s+/g, '_')}_${operationType}.postman_collection.json`; a.click(); URL.revokeObjectURL(url);
              }} data-testid="button-download-ref-postman"><Download className="h-3 w-3" /> Download</Button>
            </div>
          </div>
          <pre className="bg-gray-900 text-blue-300 p-3 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto" data-testid="code-ref-postman">{JSON.stringify(postmanConfig, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function ReferenceApiEndpointsView() {
  const [expandedRef, setExpandedRef] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-5 w-5 text-orange-600" />
        <h3 className="text-lg font-semibold">Reference Lookup API Endpoints</h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">All lookup tables support full CRUD operations via RESTful endpoints. Click any row to see executable cURL and Postman examples.</p>
      <div className="space-y-3">
        {LOOKUP_TABLES.map(t => {
          const ops = [
            { method: "GET", label: "List All", path: t.apiBase, opType: "list" },
            { method: "POST", label: "Create", path: t.apiBase, opType: "create" },
            { method: "PUT", label: "Update", path: `${t.apiBase}/:id`, opType: "update" },
            { method: "DELETE", label: "Delete", path: `${t.apiBase}/:id`, opType: "delete" },
          ];
          const isExpanded = expandedRef === t.key;

          return (
            <Collapsible key={t.key} open={isExpanded} onOpenChange={(open) => setExpandedRef(open ? t.key : null)}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 py-3" data-testid={`trigger-ref-api-${t.key}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <div>
                          <span className="font-medium text-sm">{t.name}</span>
                          <code className="text-xs text-gray-400 ml-2">{t.tableName}</code>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{t.apiBase}</code>
                        <div className="flex gap-1">
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs">GET</Badge>
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-xs">POST</Badge>
                          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 text-xs">PUT</Badge>
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 text-xs">DEL</Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Tabs defaultValue="list">
                      <TabsList className="mb-3">
                        {ops.map(op => (
                          <TabsTrigger key={op.opType} value={op.opType} className="text-xs gap-1" data-testid={`tab-ref-op-${t.key}-${op.opType}`}>
                            <Badge variant="outline" className="text-xs mr-1">{op.method}</Badge> {op.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {ops.map(op => (
                        <TabsContent key={op.opType} value={op.opType}>
                          <RefEndpointDetail table={t} method={op.method} path={op.path} operationType={op.opType} />
                        </TabsContent>
                      ))}
                    </Tabs>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

function ReferenceDataView({ searchQuery, expandedLookup, setExpandedLookup, lookupEditingId, setLookupEditingId, lookupForm, setLookupForm, lookupShowAdd, setLookupShowAdd }: {
  searchQuery: string;
  expandedLookup: string | null;
  setExpandedLookup: (v: string | null) => void;
  lookupEditingId: string | null;
  setLookupEditingId: (v: string | null) => void;
  lookupForm: Record<string, string>;
  setLookupForm: (v: Record<string, string>) => void;
  lookupShowAdd: boolean;
  setLookupShowAdd: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [localSearch, setLocalSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const selectedConfig = expandedLookup ? LOOKUP_TABLES.find(t => t.key === expandedLookup) : null;

  const filteredTables = LOOKUP_TABLES.filter(t =>
    !localSearch || t.name.toLowerCase().includes(localSearch.toLowerCase()) ||
    t.tableName.toLowerCase().includes(localSearch.toLowerCase()) ||
    t.category.toLowerCase().includes(localSearch.toLowerCase())
  );

  const { data: lookupData, isLoading: lookupLoading } = useQuery<any[]>({
    queryKey: [selectedConfig?.apiBase || "none"],
    enabled: !!selectedConfig,
    queryFn: async () => {
      if (!selectedConfig) return [];
      const r = await fetch(selectedConfig.apiBase, { credentials: 'include' });
      if (!r.ok) throw new Error("Failed to fetch");
      const data = await r.json();
      if (selectedConfig.responseKey && data[selectedConfig.responseKey]) return data[selectedConfig.responseKey];
      if (Array.isArray(data)) return data;
      const arrKey = Object.keys(data).find(k => Array.isArray(data[k]));
      return arrKey ? data[arrKey] : [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      if (!selectedConfig) throw new Error("No table selected");
      return apiRequest("POST", selectedConfig.apiBase, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === selectedConfig?.apiBase });
      toast({ title: "Record created successfully!" });
      setLookupShowAdd(false);
      setLookupForm({});
    },
    onError: (e: any) => { toast({ title: "Failed to create record", description: e.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, string> }) => {
      if (!selectedConfig) throw new Error("No table selected");
      return apiRequest("PUT", `${selectedConfig.apiBase}/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === selectedConfig?.apiBase });
      toast({ title: "Record updated successfully!" });
      setLookupEditingId(null);
      setLookupForm({});
    },
    onError: (e: any) => { toast({ title: "Failed to update record", description: e.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!selectedConfig) throw new Error("No table selected");
      return apiRequest("DELETE", `${selectedConfig.apiBase}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === selectedConfig?.apiBase });
      toast({ title: "Record deleted successfully!" });
    },
    onError: (e: any) => { toast({ title: "Failed to delete record", description: e.message, variant: "destructive" }); },
  });

  const records = Array.isArray(lookupData) ? lookupData : [];
  const allFields = selectedConfig ? [
    { key: selectedConfig.codeField, label: selectedConfig.codeLabel },
    { key: selectedConfig.nameField, label: selectedConfig.nameLabel },
    ...(selectedConfig.extraFields || []),
    { key: "description", label: "Description" },
  ] : [];

  const handleAddRecord = () => {
    if (!selectedConfig) return;
    setLookupShowAdd(true);
    setLookupEditingId(null);
    const existingCodes = records.map((r: any) => r[selectedConfig.codeField] || '');
    const codePrefix = selectedConfig.key === 'customer-segments' ? 'SEG' : selectedConfig.key === 'sales-channels' ? 'CH' : selectedConfig.key === 'territory-master' ? 'TERR' : selectedConfig.key === 'contract-types' ? 'CT' : selectedConfig.key === 'subflows' ? 'SF' : selectedConfig.key.substring(0, 3).toUpperCase();
    let maxN = 0;
    existingCodes.forEach((c: string) => { const m = c.match(/(\d+)$/); if (m) { const n = parseInt(m[1], 10); if (n > maxN) maxN = n; } });
    const nextCode = `${codePrefix}-${String(maxN + 1).padStart(3, '0')}`;
    setLookupForm({ [selectedConfig.codeField]: nextCode });
  };

  const handleSave = () => {
    if (!selectedConfig) return;
    const nameVal = lookupForm[selectedConfig.nameField]?.trim();
    if (!nameVal) {
      toast({ title: `${selectedConfig.nameLabel} is required`, variant: "destructive" });
      return;
    }
    const dupRecord = records.find((r: any) => {
      if (lookupEditingId && r.id === lookupEditingId) return false;
      return (r[selectedConfig.nameField] || '').trim().toLowerCase() === nameVal.toLowerCase();
    });
    if (dupRecord) {
      toast({ title: "Duplicate name", description: `A record with the name "${nameVal}" already exists in ${selectedConfig.name}.`, variant: "destructive" });
      return;
    }
    if (lookupEditingId) {
      updateMutation.mutate({ id: lookupEditingId, body: lookupForm });
    } else {
      createMutation.mutate(lookupForm);
    }
  };

  return (
    <div className="flex gap-0 min-h-[600px]">
      <div className="w-64 shrink-0 border rounded-l-lg bg-white dark:bg-gray-950 flex flex-col">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-orange-600" />
            <span className="font-semibold text-sm">Reference Lookups</span>
            <Badge variant="outline" className="text-xs ml-auto">{LOOKUP_TABLES.length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tables..."
              data-testid="input-ref-data-search"
              className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-orange-500"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredTables.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">
              {localSearch ? "No matching tables" : "No tables found"}
            </div>
          ) : (
            filteredTables.map(t => (
              <button
                key={t.key}
                data-testid={`ref-data-nav-${t.key}`}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 dark:border-gray-800 transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/20 ${
                  expandedLookup === t.key
                    ? 'bg-orange-50 dark:bg-orange-950/30 border-l-2 border-l-orange-500 font-medium text-orange-900 dark:text-orange-200'
                    : 'border-l-2 border-l-transparent text-gray-700 dark:text-gray-300'
                }`}
                onClick={() => {
                  setExpandedLookup(t.key);
                  setLookupShowAdd(false);
                  setLookupEditingId(null);
                  setLookupForm({});
                }}
              >
                <div className="font-medium text-xs leading-tight">{t.name}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-gray-400">{t.tableName}</span>
                  <Badge className={`text-[9px] px-1 py-0 h-4 ${LOOKUP_CATEGORY_COLORS[t.category] || ""}`}>{t.category}</Badge>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 border border-l-0 rounded-r-lg bg-white dark:bg-gray-950">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-orange-600" />
              {selectedConfig ? selectedConfig.name : "Reference Data Browser"}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedConfig
                ? selectedConfig.description
                : "Select a lookup table from the left to view and manage records"}
            </p>
          </div>
          {selectedConfig && (
            <div className="flex items-center gap-2">
              <Badge className={LOOKUP_CATEGORY_COLORS[selectedConfig.category] || ""}>{selectedConfig.category}</Badge>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{selectedConfig.tableName}</code>
              <Badge variant="outline">{records.length} records</Badge>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleAddRecord} data-testid="button-add-ref-record">
                <Plus className="h-4 w-4 mr-1" /> Add Record
              </Button>
            </div>
          )}
        </div>

        <div className="p-4">
          {!selectedConfig ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-full mb-4">
                <Database className="h-10 w-10 text-orange-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Table Selected</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">Choose a reference lookup table from the left panel to browse and manage its records.</p>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    {allFields.map(f => (
                      <TableHead key={f.key} className="text-xs font-semibold">{f.label}</TableHead>
                    ))}
                    <TableHead className="text-xs font-semibold w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lookupLoading ? (
                    <TableRow><TableCell colSpan={allFields.length + 1} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
                  ) : records.length === 0 ? (
                    <TableRow><TableCell colSpan={allFields.length + 1} className="text-center py-8 text-gray-500">No records found</TableCell></TableRow>
                  ) : (
                    records.map((record: any) => (
                      <TableRow key={record.id} className="hover:bg-orange-50/50 dark:hover:bg-orange-950/20">
                        {allFields.map(f => (
                          <TableCell key={f.key} className="text-sm">
                            {f.key === selectedConfig.codeField ? (
                              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs font-mono">{record[f.key] || "—"}</code>
                            ) : (
                              <span>{record[f.key] || "—"}</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => {
                              setLookupEditingId(record.id);
                              setLookupShowAdd(false);
                              const formData: Record<string, string> = {};
                              allFields.forEach(f => { formData[f.key] = record[f.key] || ""; });
                              setLookupForm(formData);
                            }} data-testid={`button-edit-ref-${record.id}`}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ id: record.id, name: record[selectedConfig.nameField] || record[selectedConfig.codeField] || record.id })} data-testid={`button-delete-ref-${record.id}`}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>

      {selectedConfig && (lookupShowAdd || lookupEditingId) && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => { setLookupShowAdd(false); setLookupEditingId(null); setLookupForm({}); }} />
          <div className="fixed top-0 right-0 h-full w-[440px] max-w-[90vw] bg-white dark:bg-gray-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 dark:bg-gray-900 shrink-0">
              <div>
                <h3 className="font-semibold text-lg">{lookupEditingId ? "Edit Record" : "Add New Record"}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedConfig.name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setLookupShowAdd(false); setLookupEditingId(null); setLookupForm({}); }} data-testid="button-cancel-ref-form">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {allFields.map(f => {
                const isCode = f.key === selectedConfig.codeField;
                return (
                  <div key={f.key}>
                    <Label className="text-xs font-medium">{f.label}</Label>
                    <Input
                      value={lookupForm[f.key] || ""}
                      onChange={(e) => setLookupForm({ ...lookupForm, [f.key]: e.target.value })}
                      placeholder={isCode ? "Auto-generated" : f.label}
                      className={`h-9 text-sm ${isCode ? "bg-gray-100 dark:bg-gray-800 font-mono" : ""}`}
                      disabled={isCode}
                      data-testid={`input-ref-${f.key}`}
                    />
                    {isCode && <p className="text-xs text-gray-500 mt-0.5">Auto-generated. Cannot be modified.</p>}
                  </div>
                );
              })}
            </div>
            <div className="shrink-0 border-t px-5 py-4 bg-gray-50 dark:bg-gray-900 flex gap-2">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white flex-1" disabled={createMutation.isPending || updateMutation.isPending}
                onClick={handleSave}
                data-testid="button-save-ref-record"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : lookupEditingId ? "Update" : "Create"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setLookupShowAdd(false); setLookupEditingId(null); setLookupForm({}); }} data-testid="button-cancel-ref">
                Cancel
              </Button>
            </div>
          </div>
        </>
      )}

      {pendingDelete && (
        <DeleteConfirmDialog
          itemName={pendingDelete.name}
          onConfirm={() => { deleteMutation.mutate(pendingDelete.id); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

export default function LicenseIQSchema() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [schemaContext, setSchemaContext] = useState<"enterprise" | "reference">("enterprise");
  const [activeSubTab, setActiveSubTab] = useState("listing");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState<LicenseiqEntity | null>(null);
  
  // Reference lookup states
  const [expandedLookup, setExpandedLookup] = useState<string | null>(null);
  const [lookupEditingId, setLookupEditingId] = useState<string | null>(null);
  const [lookupForm, setLookupForm] = useState<Record<string, string>>({});
  const [lookupShowAdd, setLookupShowAdd] = useState(false);

  // Inline delete confirmation state
  const [pendingDelete, setPendingDelete] = useState<{ id: string; type: string; name: string } | null>(null);

  // Entity inline form states
  const [showEntityForm, setShowEntityForm] = useState(false);
  const [entityDialogMode, setEntityDialogMode] = useState<"create" | "edit">("create");
  const [entityForm, setEntityForm] = useState({
    name: "",
    technicalName: "",
    description: "",
    category: "",
  });

  // Field inline form states
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldDialogMode, setFieldDialogMode] = useState<"create" | "edit">("create");
  const [fieldForm, setFieldForm] = useState({
    id: "",
    fieldName: "",
    dataType: "",
    description: "",
    isRequired: false,
    defaultValue: "",
    validationRules: "",
  });

  // API Endpoint states
  const [showEndpointForm, setShowEndpointForm] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<LicenseiqApiEndpoint | null>(null);
  const [expandedEndpointId, setExpandedEndpointId] = useState<string | null>(null);
  const [endpointEntityFilter, setEndpointEntityFilter] = useState<string>("");
  const [endpointForm, setEndpointForm] = useState({
    entityId: "",
    operationType: "list",
    name: "",
    httpMethod: "GET",
    pathTemplate: "",
    requestBodyPath: "",
    responseDataPath: "",
    paginationType: "none",
    pageParamName: "",
    limitParamName: "",
    cursorParamName: "",
    offsetParamName: "",
    totalPath: "",
    hasMorePath: "",
    nextCursorPath: "",
    defaultPageSize: 100,
    requiredScopes: [] as string[],
    isActive: true,
  });

  // Data tab states
  const [selectedDataEntity, setSelectedDataEntity] = useState<string>("");
  const [showDataForm, setShowDataForm] = useState(false);
  const [dataFormMode, setDataFormMode] = useState<"create" | "edit">("create");
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [dataFormValues, setDataFormValues] = useState<Record<string, any>>({});
  
  // City search state for Partner Master headquarters
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citySearchOpen, setCitySearchOpen] = useState(false);
  const [cityPostalCode, setCityPostalCode] = useState<string | null>(null);
  const [debouncedCityQuery, setDebouncedCityQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCityQuery(citySearchQuery), 300);
    return () => clearTimeout(timer);
  }, [citySearchQuery]);

  const { data: citySuggestions = [] } = useQuery<any[]>({
    queryKey: ['/api/reference/cities', debouncedCityQuery],
    queryFn: async () => {
      if (!debouncedCityQuery || debouncedCityQuery.length < 1) return [];
      const res = await fetch(`/api/reference/cities?q=${encodeURIComponent(debouncedCityQuery)}&limit=20`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: debouncedCityQuery.length >= 1,
    staleTime: 30000,
  });

  // Multi-tenant context states for Data tab
  const [dataContextCompanyId, setDataContextCompanyId] = useState<string>("");
  const [entitySearchFilter, setEntitySearchFilter] = useState<string>("");

  const formatUSDate = (val: any): string => {
    if (!val) return '';
    const str = String(val);
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
  };

  const isDateColumn = (colName: string, dataType: string): boolean => {
    return dataType === 'date' || dataType === 'timestamp without time zone' || dataType === 'timestamp with time zone' ||
      colName.endsWith('_date') || colName.endsWith('_at') || colName === 'effective_date' || colName === 'launch_date' ||
      colName === 'start_date' || colName === 'end_date' || colName === 'expiration_date';
  };

  const toInputDateValue = (val: any): string => {
    if (!val) return '';
    const d = new Date(String(val));
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [dataContextBuId, setDataContextBuId] = useState<string>("");
  const [dataContextLocationId, setDataContextLocationId] = useState<string>("");

  // Enterprise data management states - Pagination, Sorting, Filtering
  const [dataPage, setDataPage] = useState(1);
  const [dataPageSize, setDataPageSize] = useState(25);
  const [dataSortColumn, setDataSortColumn] = useState<string>("created_at");
  const [dataSortDirection, setDataSortDirection] = useState<"asc" | "desc">("desc");
  const [dataFilters, setDataFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const HIDDEN_COLS = ['created_by', 'updated_by', 'company_id', 'business_unit_id', 'location_id'];
  const DEFAULT_VISIBLE_COUNT = 8;
  const [columnVisibilityMap, setColumnVisibilityMap] = useState<Record<string, Record<string, boolean>>>({});
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);

  

  // Advanced filter states
  type FilterOperator = "contains" | "equals" | "starts_with" | "ends_with" | "gt" | "gte" | "lt" | "lte" | "between" | "is_null" | "not_null";
  interface AdvancedFilter {
    column: string;
    operator: FilterOperator;
    value: string;
    value2?: string; // For "between" operator
  }
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilter[]>([]);
  const [filterLogic, setFilterLogic] = useState<"and" | "or">("and");
  const [useAdvancedFilters, setUseAdvancedFilters] = useState(false);
  
  // Operator options based on data type
  const textOperators: { value: FilterOperator; label: string }[] = [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "starts_with", label: "Starts with" },
    { value: "ends_with", label: "Ends with" },
    { value: "is_null", label: "Is empty" },
    { value: "not_null", label: "Is not empty" },
  ];
  const numericOperators: { value: FilterOperator; label: string }[] = [
    { value: "equals", label: "Equals" },
    { value: "gt", label: "Greater than" },
    { value: "gte", label: "Greater or equal" },
    { value: "lt", label: "Less than" },
    { value: "lte", label: "Less or equal" },
    { value: "between", label: "Between" },
    { value: "is_null", label: "Is empty" },
    { value: "not_null", label: "Is not empty" },
  ];
  
  const getOperatorsForColumn = (dataType: string) => {
    const numericTypes = ["integer", "bigint", "numeric", "decimal", "real", "double precision", "smallint"];
    if (numericTypes.includes(dataType?.toLowerCase())) return numericOperators;
    return textOperators;
  };

  // Fetch entities
  const { data: entitiesData, isLoading: entitiesLoading } = useQuery<{ entities: LicenseiqEntity[] }>({
    queryKey: ["/api/licenseiq-entities", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "all") params.append("category", selectedCategory);
      const response = await fetch(`/api/licenseiq-entities?${params}`);
      if (!response.ok) throw new Error("Failed to fetch entities");
      return response.json();
    },
  });

  // Fetch fields for selected entity
  const { data: fieldsData, isLoading: fieldsLoading } = useQuery<{ fields: LicenseiqField[] }>({
    queryKey: ["/api/licenseiq-fields", selectedEntity?.id],
    enabled: !!selectedEntity,
    queryFn: async () => {
      const response = await fetch(`/api/licenseiq-fields?entityId=${selectedEntity?.id}`);
      if (!response.ok) throw new Error("Failed to fetch fields");
      return response.json();
    },
  });

  // Entity mutations
  const createEntityMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/licenseiq-entities", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/licenseiq-entities" });
      toast({ title: "Entity created successfully!" });
      setShowEntityForm(false);
      resetEntityForm();
    },
    onError: () => {
      toast({ title: "Failed to create entity", variant: "destructive" });
    },
  });

  const updateEntityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/licenseiq-entities/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/licenseiq-entities" });
      toast({ title: "Entity updated successfully!" });
      setShowEntityForm(false);
      resetEntityForm();
    },
    onError: () => {
      toast({ title: "Failed to update entity", variant: "destructive" });
    },
  });

  const deleteEntityMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/licenseiq-entities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/licenseiq-entities" });
      toast({ title: "Entity deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete entity", variant: "destructive" });
    },
  });

  // Field mutations
  const createFieldMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/licenseiq-fields", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/licenseiq-fields" });
      toast({ title: "Field created successfully!" });
      setShowFieldForm(false);
      resetFieldForm();
    },
    onError: () => {
      toast({ title: "Failed to create field", variant: "destructive" });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/licenseiq-fields/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/licenseiq-fields" });
      toast({ title: "Field updated successfully!" });
      setShowFieldForm(false);
      resetFieldForm();
    },
    onError: () => {
      toast({ title: "Failed to update field", variant: "destructive" });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/licenseiq-fields/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/licenseiq-fields" });
      toast({ title: "Field deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete field", variant: "destructive" });
    },
  });

  // API Endpoints query
  const { data: endpointsData, isLoading: endpointsLoading } = useQuery<LicenseiqApiEndpoint[]>({
    queryKey: ["/api/licenseiq-api-endpoints", endpointEntityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (endpointEntityFilter) params.append("entityId", endpointEntityFilter);
      const response = await fetch(`/api/licenseiq-api-endpoints?${params}`);
      if (!response.ok) throw new Error("Failed to fetch endpoints");
      return response.json();
    },
  });

  // API Endpoint mutations
  const createEndpointMutation = useMutation({
    mutationFn: async (data: typeof endpointForm) => apiRequest("POST", "/api/licenseiq-api-endpoints", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/licenseiq-api-endpoints" });
      toast({ title: "API Endpoint created successfully!" });
      setShowEndpointForm(false);
      setEditingEndpoint(null);
      resetEndpointForm();
    },
    onError: () => {
      toast({ title: "Failed to create endpoint", variant: "destructive" });
    },
  });

  const updateEndpointMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof endpointForm> }) =>
      apiRequest("PATCH", `/api/licenseiq-api-endpoints/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/licenseiq-api-endpoints" });
      toast({ title: "API Endpoint updated successfully!" });
      setShowEndpointForm(false);
      setEditingEndpoint(null);
      resetEndpointForm();
    },
    onError: () => {
      toast({ title: "Failed to update endpoint", variant: "destructive" });
    },
  });

  const deleteEndpointMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/licenseiq-api-endpoints/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/licenseiq-api-endpoints" });
      toast({ title: "API Endpoint deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete endpoint", variant: "destructive" });
    },
  });

  // Data tab queries and mutations
  const { data: availableTablesData } = useQuery<{ tables: { id: string; name: string; technicalName: string; category: string }[] }>({
    queryKey: ["/api/entity-data/available-tables"],
    queryFn: async () => {
      const response = await fetch("/api/entity-data/available-tables");
      if (!response.ok) throw new Error("Failed to fetch available tables");
      return response.json();
    },
  });

  // Fetch current user to check if system admin
  const { data: currentUser } = useQuery<{ id: string; isSystemAdmin?: boolean; primaryCompany?: string }>({
    queryKey: ["/api/user"],
  });
  const isSystemAdmin = currentUser?.isSystemAdmin || !currentUser?.primaryCompany;

  // Fetch user's active login context (shown in top right corner)
  const { data: activeContextData } = useQuery<{ activeContext: { companyId?: string; businessUnitId?: string; locationId?: string } | null }>({
    queryKey: ["/api/user/active-context"],
  });
  const loginContext = activeContextData?.activeContext;

  useEffect(() => {
    if (loginContext?.companyId && !dataContextCompanyId) {
      setDataContextCompanyId(loginContext.companyId);
    }
  }, [loginContext?.companyId]);

  // Fetch companies for context selector
  const { data: companiesData } = useQuery<{ id: string; companyName: string }[]>({
    queryKey: ["/api/master-data/companies"],
  });

  // Fetch business units for selected company
  const { data: businessUnitsData } = useQuery<{ id: string; orgId: string; orgName: string }[]>({
    queryKey: ["/api/master-data/business-units", dataContextCompanyId],
    enabled: !!dataContextCompanyId,
    queryFn: async () => {
      const response = await fetch(`/api/master-data/business-units?companyId=${dataContextCompanyId}`);
      if (!response.ok) throw new Error("Failed to fetch business units");
      return response.json();
    },
  });

  // Fetch locations for selected business unit
  const { data: locationsData } = useQuery<{ id: string; locationName: string }[]>({
    queryKey: ["/api/master-data/locations", dataContextCompanyId, dataContextBuId],
    enabled: !!dataContextCompanyId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dataContextBuId) params.append("orgId", dataContextBuId);
      else if (dataContextCompanyId) params.append("companyId", dataContextCompanyId);
      const response = await fetch(`/api/master-data/locations?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch locations");
      return response.json();
    },
  });

  const effectiveCompanyId = dataContextCompanyId || loginContext?.companyId || '';

  const { data: lookupCompanies } = useQuery<{ id: string; company_name: string }[]>({
    queryKey: ["/api/lookup/companies"],
    queryFn: async () => { const r = await fetch('/api/lookup/companies', { credentials: 'include' }); return r.json(); },
  });
  const { data: lookupSalesChannels } = useQuery<any[]>({
    queryKey: ["/api/lookup/sales-channels"],
    queryFn: async () => { const r = await fetch('/api/lookup/sales-channels', { credentials: 'include' }); return r.json(); },
  });
  // Partner Type dropdown is now database-driven via the partner_types
  // lookup table — admins manage entries from the Partner Type Master
  // entity in this same Schema Catalog page.
  const { data: lookupPartnerTypes } = useQuery<{ value: string; label: string }[]>({
    queryKey: ["/api/lookup/partner-types"],
    queryFn: async () => { const r = await fetch('/api/lookup/partner-types', { credentials: 'include' }); return r.json(); },
  });
  const { data: lookupTerritories } = useQuery<any[]>({
    queryKey: ["/api/lookup/territory-master"],
    queryFn: async () => { const r = await fetch('/api/lookup/territory-master', { credentials: 'include' }); return r.json(); },
  });
  const { data: lookupCategories } = useQuery<any[]>({
    queryKey: ["/api/lookup/product-hierarchy", effectiveCompanyId, "Category"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => { const r = await fetch(`/api/lookup/product-hierarchy?companyId=${effectiveCompanyId}&level=Category`, { credentials: 'include' }); return r.json(); },
  });
  const { data: lookupFamilies } = useQuery<any[]>({
    queryKey: ["/api/lookup/product-hierarchy", effectiveCompanyId, "Family", dataFormValues.product_category_id],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: effectiveCompanyId, level: 'Family' });
      if (dataFormValues.product_category_id) params.append('parentId', dataFormValues.product_category_id);
      const r = await fetch(`/api/lookup/product-hierarchy?${params}`, { credentials: 'include' }); return r.json();
    },
  });
  const { data: lookupLines } = useQuery<any[]>({
    queryKey: ["/api/lookup/product-hierarchy", effectiveCompanyId, "Line", dataFormValues.product_family_id],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: effectiveCompanyId, level: 'Line' });
      if (dataFormValues.product_family_id) params.append('parentId', dataFormValues.product_family_id);
      const r = await fetch(`/api/lookup/product-hierarchy?${params}`, { credentials: 'include' }); return r.json();
    },
  });
  const { data: lookupBrands } = useQuery<any[]>({
    queryKey: ["/api/lookup/product-hierarchy", effectiveCompanyId, "Brand"],
    enabled: !!effectiveCompanyId,
    queryFn: async () => { const r = await fetch(`/api/lookup/product-hierarchy?companyId=${effectiveCompanyId}&level=Brand`, { credentials: 'include' }); return r.json(); },
  });
  const { data: lookupClassifications } = useQuery<any[]>({
    queryKey: ["/api/lookup/product-classifications"],
    queryFn: async () => { const r = await fetch('/api/lookup/product-classifications', { credentials: 'include' }); return r.json(); },
  });
  const { data: lookupProducts } = useQuery<any[]>({
    queryKey: ["/api/lookup/products", effectiveCompanyId],
    enabled: !!effectiveCompanyId,
    queryFn: async () => { const r = await fetch(`/api/lookup/products?companyId=${effectiveCompanyId}`, { credentials: 'include' }); return r.json(); },
  });
  const { data: lookupPartners } = useQuery<any[]>({
    queryKey: ["/api/lookup/partners", effectiveCompanyId],
    enabled: !!effectiveCompanyId,
    queryFn: async () => { const r = await fetch(`/api/lookup/partners?companyId=${effectiveCompanyId}`, { credentials: 'include' }); return r.json(); },
  });
  const { data: lookupContracts } = useQuery<any[]>({
    queryKey: ["/api/lookup/contracts"],
    queryFn: async () => { const r = await fetch('/api/lookup/contracts', { credentials: 'include' }); return r.json(); },
  });

  const hasHierarchyData = (lookupCategories || []).length > 0;

  type DropdownOption = { value: string; label: string };
  type DropdownConfig = Record<string, Record<string, {
    options: DropdownOption[];
    hidden?: boolean;
    readOnlyInCreate?: boolean;
    readOnlyDisplay?: string;
    onChange?: (val: string) => void;
    multiSelect?: boolean;
  }>>;

  const mandatoryFieldsConfig: Record<string, string[]> = {
    sales_channels: ['channel_id', 'channel_code', 'channel_name'],
    territory_master: ['territory_id', 'territory_code', 'territory_name'],
    partner_master: ['partner_id', 'company_id', 'partner_name'],
    product_hierarchy: ['hierarchy_id', 'company_id', 'level_name', 'level_order', 'hierarchy_value'],
    product_classifications: ['classification_dimension', 'classification_value'],
    products: ['product_id', 'company_id', 'sku', 'product_name'],
    product_attributes: ['attribute_id', 'product_id', 'attribute_name', 'attribute_value'],
    product_territory_matrix: ['territory_auth_id', 'product_id', 'territory_id', 'is_authorized'],
    product_channel_matrix: ['channel_auth_id', 'product_id', 'channel_id', 'is_authorized'],
    product_packaging_matrix: ['package_id', 'product_id', 'package_type', 'units_per_package'],
    product_bom: ['bom_id', 'parent_product_id', 'component_product_id', 'component_quantity'],
  };
  const neverMandatoryFields = ['status', 'record_status'];

  const isMandatoryField = (entity: string, colName: string): boolean => {
    if (neverMandatoryFields.includes(colName)) return false;
    return mandatoryFieldsConfig[entity]?.includes(colName) || false;
  };

  const strictTextFieldsConfig: Record<string, string[]> = {
    company_master: ['company_name', 'legal_entity_name', 'industry', 'headquarters_city', 'headquarters_state', 'headquarters_country', 'erp_system', 'primary_currency', 'status', 'record_status'],
    partner_master: ['business_unit', 'partner_name', 'partner_type', 'partner_classification', 'legal_entity_name', 'headquarters_city', 'headquarters_state', 'headquarters_country', 'primary_contact_name', 'status', 'payment_terms', 'payment_method', 'currency', 'primary_sales_channel', 'authorized_channels', 'authorized_territories', 'record_status'],
    territory_master: ['territory_name', 'territory_type', 'tax_jurisdiction', 'language', 'status', 'record_status'],
    sales_channels: ['channel_name', 'channel_type', 'channel_category', 'payment_terms_default', 'status', 'record_status'],
    partner_contract_associations: ['contract_status', 'record_status'],
    product_hierarchy: ['level_name', 'hierarchy_value', 'record_status'],
    product_classifications: ['classification_dimension', 'classification_value', 'record_status'],
    products: ['product_name', 'product_category', 'product_family', 'product_line', 'product_classification', 'asset_type', 'durability_class', 'revenue_type', 'tax_category', 'regulatory_class', 'base_unit_of_measure', 'alternate_uom_sellable', 'product_status', 'record_status'],
    product_attributes: ['attribute_name', 'attribute_category', 'record_status'],
    product_territory_matrix: ['certification_type', 'certification_status', 'record_status'],
    product_channel_matrix: ['record_status'],
    product_packaging_matrix: ['package_type', 'record_status'],
    product_bom: ['component_uom', 'bom_type', 'record_status'],
  };

  const isNumericOnly = (val: string): boolean => /^\d+(\.\d+)?$/.test(val.trim());

  const entityLabelFields: Record<string, string[]> = {
    sales_channels: ['channel_name', 'channel_code'],
    territory_master: ['territory_name', 'territory_code'],
    partner_master: ['partner_name', 'partner_id'],
    product_hierarchy: ['hierarchy_value', 'level_name'],
    product_classifications: ['classification_value', 'classification_dimension'],
    products: ['product_name', 'sku'],
    product_attributes: ['attribute_name', 'attribute_value'],
    product_territory_matrix: ['territory_id', 'product_id'],
    product_channel_matrix: ['channel_id', 'product_id'],
    product_packaging_matrix: ['package_type', 'product_id'],
    product_bom: ['parent_product_id', 'component_product_id'],
    customers: ['customer_name', 'customer_code'],
  };

  const getRecordLabel = (record: any, entity: string): string => {
    const fields = entityLabelFields[entity] || [];
    for (const f of fields) {
      const val = record[f];
      if (val && typeof val === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(val)) return val;
    }
    const nameKey = Object.keys(record).find(k => k.includes('name') && record[k] && typeof record[k] === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(record[k]));
    if (nameKey) return record[nameKey];
    const codeKey = Object.keys(record).find(k => k.includes('code') && record[k] && typeof record[k] === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(record[k]));
    if (codeKey) return record[codeKey];
    return "this record";
  };

  const companyName = (lookupCompanies || []).find(c => c.id === effectiveCompanyId)?.company_name || effectiveCompanyId;

  const getClassificationOptions = (dim: string): DropdownOption[] =>
    (lookupClassifications || []).filter(c => c.classification_dimension === dim).map(c => ({ value: c.classification_value, label: c.classification_value }));

  const statusOptions: DropdownOption[] = [
    { value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }, { value: 'Discontinued', label: 'Discontinued' },
  ];
  const recordStatusOptions: DropdownOption[] = [
    { value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }, { value: 'Archived', label: 'Archived' },
  ];

  const dropdownConfig: DropdownConfig = {
    products: {
      company_id: {
        options: (lookupCompanies || []).map(c => ({ value: c.id, label: c.company_name })),
        readOnlyInCreate: true,
        readOnlyDisplay: companyName,
      },
      product_category: { options: [], hidden: true },
      product_family: { options: [], hidden: true },
      product_line: { options: [], hidden: true },
      product_category_id: {
        options: (lookupCategories || []).map(h => ({ value: h.hierarchy_id, label: h.hierarchy_value })),
        onChange: () => setDataFormValues(prev => ({ ...prev, product_family_id: '', product_line_id: '' })),
      },
      product_family_id: {
        options: (lookupFamilies || []).map(h => ({ value: h.hierarchy_id, label: h.hierarchy_value })),
        onChange: () => setDataFormValues(prev => ({ ...prev, product_line_id: '' })),
      },
      product_line_id: {
        options: (lookupLines || []).map(h => ({ value: h.hierarchy_id, label: h.hierarchy_value })),
      },
      brand_id: {
        options: (lookupBrands || []).map(h => ({ value: h.id, label: h.hierarchy_value })),
      },
      product_classification: { options: getClassificationOptions('Product Type') },
      asset_type: { options: getClassificationOptions('Asset Type') },
      durability_class: { options: getClassificationOptions('Durability') },
      revenue_type: { options: getClassificationOptions('Revenue Type') },
      tax_category: { options: getClassificationOptions('Tax Category') },
      regulatory_class: { options: getClassificationOptions('Regulatory Class') },
      product_status: { options: statusOptions },
      record_status: { options: recordStatusOptions },
    },
    partner_master: {
      company_id: {
        options: (lookupCompanies || []).map(c => ({ value: c.id, label: c.company_name })),
        readOnlyInCreate: true,
        readOnlyDisplay: companyName,
      },
      partner_type: {
        // Sourced from the partner_types lookup table — admins manage
        // entries from the Partner Type Master entity in this catalog.
        options: (lookupPartnerTypes || []).map(pt => ({ value: pt.value, label: pt.label })),
      },
      partner_classification: { options: [
        { value: 'Tier 1', label: 'Tier 1' }, { value: 'Tier 2', label: 'Tier 2' }, { value: 'Tier 3', label: 'Tier 3' },
        { value: 'Strategic', label: 'Strategic' }, { value: 'Standard', label: 'Standard' },
      ]},
      status: { options: statusOptions },
      record_status: { options: recordStatusOptions },
      payment_terms: { options: [
        { value: 'Net 15', label: 'Net 15' }, { value: 'Net 30', label: 'Net 30' }, { value: 'Net 45', label: 'Net 45' },
        { value: 'Net 60', label: 'Net 60' }, { value: 'Net 90', label: 'Net 90' }, { value: 'Due on Receipt', label: 'Due on Receipt' },
      ]},
      payment_method: { options: [
        { value: 'ACH', label: 'ACH' }, { value: 'Wire Transfer', label: 'Wire Transfer' },
        { value: 'Check', label: 'Check' }, { value: 'Credit Card', label: 'Credit Card' },
      ]},
      currency: { options: [
        { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
        { value: 'CAD', label: 'CAD' }, { value: 'AUD', label: 'AUD' }, { value: 'JPY', label: 'JPY' },
      ]},
      primary_sales_channel: {
        options: (lookupSalesChannels || []).map(c => ({ value: c.channel_name, label: c.channel_name })),
      },
      authorized_channels: {
        options: (lookupSalesChannels || []).map(c => ({ value: c.channel_name, label: c.channel_name })),
        multiSelect: true,
      },
      primary_territory: {
        options: (lookupTerritories || []).map(t => ({ value: t.territory_name, label: t.territory_name })),
      },
      authorized_territories: {
        options: (lookupTerritories || []).map(t => ({ value: t.territory_name, label: t.territory_name })),
        multiSelect: true,
      },
    },
    sales_channels: {
      channel_type: { options: [
        { value: 'B2B', label: 'B2B' }, { value: 'B2C', label: 'B2C' },
        { value: 'Direct', label: 'Direct' },
      ]},
      channel_category: { options: [
        { value: 'Physical', label: 'Physical' }, { value: 'Digital', label: 'Digital' },
        { value: 'Hybrid', label: 'Hybrid' },
      ]},
      payment_terms_default: { options: [
        { value: 'Net 15', label: 'Net 15' }, { value: 'Net 30', label: 'Net 30' }, { value: 'Net 45', label: 'Net 45' },
        { value: 'Net 60', label: 'Net 60' }, { value: 'Net 90', label: 'Net 90' },
      ]},
      status: { options: statusOptions },
      record_status: { options: recordStatusOptions },
    },
    territory_master: {
      parent_territory_id: {
        options: (lookupTerritories || []).map(t => ({ value: t.territory_id, label: t.territory_name })),
      },
      territory_type: { options: [
        { value: 'Country', label: 'Country' }, { value: 'Region', label: 'Region' },
        { value: 'State', label: 'State' }, { value: 'City', label: 'City' },
        { value: 'Zone', label: 'Zone' }, { value: 'District', label: 'District' },
      ]},
      region_level: { options: [
        { value: 'Global', label: 'Global' }, { value: 'Continental', label: 'Continental' },
        { value: 'National', label: 'National' }, { value: 'Regional', label: 'Regional' },
        { value: 'Local', label: 'Local' },
      ]},
      currency_code: { options: [
        { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
        { value: 'CAD', label: 'CAD' }, { value: 'AUD', label: 'AUD' }, { value: 'JPY', label: 'JPY' },
      ]},
      language: { options: [
        { value: 'English', label: 'English' }, { value: 'Spanish', label: 'Spanish' },
        { value: 'French', label: 'French' }, { value: 'German', label: 'German' },
        { value: 'Japanese', label: 'Japanese' }, { value: 'Chinese', label: 'Chinese' },
      ]},
      status: { options: statusOptions },
      record_status: { options: recordStatusOptions },
    },
    product_attributes: {
      product_id: {
        options: (lookupProducts || []).map(p => ({ value: p.id, label: `${p.product_name} (${p.product_id})` })),
      },
      attribute_category: { options: [
        { value: 'Physical', label: 'Physical' }, { value: 'Technical', label: 'Technical' },
        { value: 'Marketing', label: 'Marketing' }, { value: 'Compliance', label: 'Compliance' },
      ]},
      record_status: { options: recordStatusOptions },
    },
    partner_contract_associations: {
      partner_id: {
        options: (lookupPartners || []).map(p => ({ value: p.id, label: `${p.partner_name} (${p.partner_id})` })),
      },
      contract_id: {
        options: (Array.isArray(lookupContracts) ? lookupContracts : []).map(c => ({ value: c.id, label: c.contract_number ? `${c.contract_name} (${c.contract_number})` : c.contract_name })),
      },
      contract_status: { options: [
        { value: 'Active', label: 'Active' }, { value: 'Expired', label: 'Expired' },
        { value: 'Pending', label: 'Pending' }, { value: 'Terminated', label: 'Terminated' },
      ]},
      record_status: { options: recordStatusOptions },
    },
    product_territory_matrix: {
      product_id: {
        options: (lookupProducts || []).map(p => ({ value: p.id, label: `${p.product_name} (${p.product_id})` })),
      },
      territory_id: {
        options: (lookupTerritories || []).map(t => ({ value: t.territory_id, label: t.territory_name })),
      },
      certification_status: { options: [
        { value: 'Certified', label: 'Certified' }, { value: 'Pending', label: 'Pending' },
        { value: 'Not Required', label: 'Not Required' }, { value: 'Expired', label: 'Expired' },
      ]},
      record_status: { options: recordStatusOptions },
    },
    product_channel_matrix: {
      product_id: {
        options: (lookupProducts || []).map(p => ({ value: p.id, label: `${p.product_name} (${p.product_id})` })),
      },
      channel_id: {
        options: (lookupSalesChannels || []).map(c => ({ value: c.channel_id, label: c.channel_name })),
      },
      record_status: { options: recordStatusOptions },
    },
    product_packaging_matrix: {
      product_id: {
        options: (lookupProducts || []).map(p => ({ value: p.id, label: `${p.product_name} (${p.product_id})` })),
      },
      package_type: { options: [
        { value: 'Individual', label: 'Individual' }, { value: 'Inner Pack', label: 'Inner Pack' },
        { value: 'Case', label: 'Case' }, { value: 'Pallet', label: 'Pallet' },
        { value: 'Master Carton', label: 'Master Carton' },
      ]},
      record_status: { options: recordStatusOptions },
    },
    product_bom: {
      parent_product_id: {
        options: (lookupProducts || []).map(p => ({ value: p.id, label: `${p.product_name} (${p.product_id})` })),
      },
      component_product_id: {
        options: (lookupProducts || []).map(p => ({ value: p.id, label: `${p.product_name} (${p.product_id})` })),
      },
      bom_type: { options: [
        { value: 'Standard', label: 'Standard' }, { value: 'Phantom', label: 'Phantom' },
        { value: 'Planning', label: 'Planning' },
      ]},
      component_uom: { options: [
        { value: 'EA', label: 'Each' }, { value: 'KG', label: 'Kilogram' },
        { value: 'LB', label: 'Pound' }, { value: 'M', label: 'Meter' },
        { value: 'FT', label: 'Foot' }, { value: 'L', label: 'Liter' },
      ]},
      record_status: { options: recordStatusOptions },
    },
    customers: {
      company_id: {
        options: (lookupCompanies || []).map(c => ({ value: c.id, label: c.company_name })),
        readOnlyInCreate: true,
        readOnlyDisplay: companyName,
      },
      record_status: { options: recordStatusOptions },
    },
    product_hierarchy: {
      company_id: {
        options: (lookupCompanies || []).map(c => ({ value: c.id, label: c.company_name })),
        readOnlyInCreate: true,
        readOnlyDisplay: companyName,
      },
      level_name: { options: [
        { value: 'Category', label: 'Category' }, { value: 'Family', label: 'Family' }, { value: 'Line', label: 'Line' }, { value: 'Brand', label: 'Brand' },
      ]},
      record_status: { options: recordStatusOptions },
    },
    product_classifications: {
      classification_dimension: { options: [
        { value: 'Product Type', label: 'Product Type' }, { value: 'Asset Type', label: 'Asset Type' },
        { value: 'Durability', label: 'Durability' }, { value: 'Revenue Type', label: 'Revenue Type' },
        { value: 'Tax Category', label: 'Tax Category' }, { value: 'Regulatory Class', label: 'Regulatory Class' },
        { value: 'Contract Eligibility', label: 'Contract Eligibility' },
      ]},
      record_status: { options: recordStatusOptions },
    },
  };

  const { data: entityDataResult, isLoading: entityDataLoading, refetch: refetchEntityData } = useQuery<{ records: any[]; total: number; page: number; pageSize: number; totalPages: number; tenantColumns?: { hasCompany: boolean; hasBU: boolean; hasLocation: boolean } }>({
    queryKey: ["/api/entity-data", selectedDataEntity, dataContextCompanyId, dataContextBuId, dataContextLocationId, dataPage, dataPageSize, dataSortColumn, dataSortDirection, dataFilters, useAdvancedFilters, advancedFilters, filterLogic],
    enabled: !!selectedDataEntity,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dataContextCompanyId) params.append("company_id", dataContextCompanyId);
      if (dataContextBuId) params.append("business_unit_id", dataContextBuId);
      if (dataContextLocationId) params.append("location_id", dataContextLocationId);
      // Pagination
      params.append("page", dataPage.toString());
      params.append("pageSize", dataPageSize.toString());
      // Sorting
      params.append("sortColumn", dataSortColumn);
      params.append("sortDirection", dataSortDirection);
      // Filters - simple or advanced
      if (useAdvancedFilters && advancedFilters.length > 0) {
        params.append("advancedFilters", JSON.stringify(advancedFilters));
        params.append("filterLogic", filterLogic);
      } else {
        Object.entries(dataFilters).forEach(([col, val]) => {
          if (val) params.append(`filter_${col}`, val);
        });
      }
      const response = await fetch(`/api/entity-data/${selectedDataEntity}?${params}`);
      if (!response.ok) throw new Error("Failed to fetch entity data");
      return response.json();
    },
  });

  // Check if context is required but not selected (for system admins adding to tenant-aware tables)
  const needsContextSelection = isSystemAdmin && 
    entityDataResult?.tenantColumns?.hasCompany && 
    !dataContextCompanyId && 
    !loginContext?.companyId;

  const { data: entityColumnsData } = useQuery<{ columns: { column_name: string; data_type: string; is_nullable: string }[] }>({
    queryKey: ["/api/entity-data", selectedDataEntity, "columns"],
    enabled: !!selectedDataEntity,
    queryFn: async () => {
      const response = await fetch(`/api/entity-data/${selectedDataEntity}/columns`);
      if (!response.ok) throw new Error("Failed to fetch columns");
      return response.json();
    },
  });

  const allDisplayColumns = (entityColumnsData?.columns || []).filter(
    col => !HIDDEN_COLS.includes(col.column_name)
  );
  const currentEntityVisibility = selectedDataEntity ? (columnVisibilityMap[selectedDataEntity] || {}) : {};
  const hasCustomVisibility = selectedDataEntity && columnVisibilityMap[selectedDataEntity];
  const visibleColumns = allDisplayColumns.filter((col, idx) => {
    if (hasCustomVisibility) return currentEntityVisibility[col.column_name] !== false;
    return idx < DEFAULT_VISIBLE_COUNT;
  });
  const visibleCount = visibleColumns.length;
  const totalCount = allDisplayColumns.length;

  const toggleColumnVisibility = (colName: string) => {
    const current = columnVisibilityMap[selectedDataEntity] || {};
    const isVisible = current[colName] !== false;
    if (isVisible && visibleCount <= 1) return;
    const init: Record<string, boolean> = {};
    if (!hasCustomVisibility) {
      allDisplayColumns.forEach((c, i) => { init[c.column_name] = i < DEFAULT_VISIBLE_COUNT; });
    }
    setColumnVisibilityMap(prev => ({
      ...prev,
      [selectedDataEntity]: { ...(hasCustomVisibility ? current : init), [colName]: !isVisible }
    }));
  };

  const showAllColumns = () => {
    const all: Record<string, boolean> = {};
    allDisplayColumns.forEach(c => { all[c.column_name] = true; });
    setColumnVisibilityMap(prev => ({ ...prev, [selectedDataEntity]: all }));
  };

  const resetColumns = () => {
    setColumnVisibilityMap(prev => {
      const copy = { ...prev };
      delete copy[selectedDataEntity];
      return copy;
    });
  };

  const createDataRecordMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      if (!selectedDataEntity) {
        throw new Error("No entity selected");
      }
      // Auto-inject organizational context - use selector value or fall back to login context
      const tenantCols = entityDataResult?.tenantColumns;
      const effectiveCompanyId = dataContextCompanyId || loginContext?.companyId;
      const effectiveBuId = dataContextBuId || loginContext?.businessUnitId;
      const effectiveLocationId = dataContextLocationId || loginContext?.locationId;
      
      const dataWithContext = {
        ...data,
        ...(effectiveCompanyId && tenantCols?.hasCompany && { company_id: effectiveCompanyId }),
        ...(effectiveBuId && tenantCols?.hasBU && { business_unit_id: effectiveBuId }),
        ...(effectiveLocationId && tenantCols?.hasLocation && { location_id: effectiveLocationId }),
      };
      return apiRequest("POST", `/api/entity-data/${selectedDataEntity}`, dataWithContext);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entity-data", selectedDataEntity, dataContextCompanyId, dataContextBuId, dataContextLocationId] });
      toast({ title: "Record created successfully!" });
      setShowDataForm(false);
      setDataFormValues({});
    },
    onError: (error: any) => {
      toast({ title: "Failed to create record", description: error.message, variant: "destructive" });
    },
  });

  const updateDataRecordMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      if (!selectedDataEntity) {
        throw new Error("No entity selected");
      }
      // Preserve organizational context on update - use existing values from record, or context selector, or login context
      const tenantCols = entityDataResult?.tenantColumns;
      const effectiveCompanyId = data.company_id || dataContextCompanyId || loginContext?.companyId;
      const effectiveBuId = data.business_unit_id || dataContextBuId || loginContext?.businessUnitId;
      const effectiveLocationId = data.location_id || dataContextLocationId || loginContext?.locationId;
      
      const dataWithContext = {
        ...data,
        ...(tenantCols?.hasCompany && effectiveCompanyId && { company_id: effectiveCompanyId }),
        ...(tenantCols?.hasBU && effectiveBuId && { business_unit_id: effectiveBuId }),
        ...(tenantCols?.hasLocation && effectiveLocationId && { location_id: effectiveLocationId }),
      };
      return apiRequest("PATCH", `/api/entity-data/${selectedDataEntity}/${id}`, dataWithContext);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entity-data", selectedDataEntity, dataContextCompanyId, dataContextBuId, dataContextLocationId] });
      toast({ title: "Record updated successfully!" });
      setShowDataForm(false);
      setEditingRecord(null);
      setDataFormValues({});
    },
    onError: (error: any) => {
      toast({ title: "Failed to update record", description: error.message, variant: "destructive" });
    },
  });

  const deleteDataRecordMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!selectedDataEntity) {
        throw new Error("No entity selected");
      }
      return apiRequest("DELETE", `/api/entity-data/${selectedDataEntity}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entity-data", selectedDataEntity, dataContextCompanyId, dataContextBuId, dataContextLocationId] });
      toast({ title: "Record deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete record", variant: "destructive" });
    },
  });

  const resetEntityForm = () => {
    setEntityForm({ name: "", technicalName: "", description: "", category: "" });
  };

  const resetFieldForm = () => {
    setFieldForm({
      id: "",
      fieldName: "",
      dataType: "",
      description: "",
      isRequired: false,
      defaultValue: "",
      validationRules: "",
    });
  };

  const resetEndpointForm = () => {
    setEndpointForm({
      entityId: "",
      operationType: "list",
      name: "",
      httpMethod: "GET",
      pathTemplate: "",
      requestBodyPath: "",
      responseDataPath: "",
      paginationType: "none",
      pageParamName: "",
      limitParamName: "",
      cursorParamName: "",
      offsetParamName: "",
      totalPath: "",
      hasMorePath: "",
      nextCursorPath: "",
      defaultPageSize: 100,
      requiredScopes: [],
      isActive: true,
    });
  };

  const openEditEndpoint = (endpoint: LicenseiqApiEndpoint) => {
    setEditingEndpoint(endpoint);
    setEndpointForm({
      entityId: endpoint.entityId,
      operationType: endpoint.operationType,
      name: endpoint.name,
      httpMethod: endpoint.httpMethod,
      pathTemplate: endpoint.pathTemplate,
      requestBodyPath: endpoint.requestBodyPath || "",
      responseDataPath: endpoint.responseDataPath || "",
      paginationType: endpoint.paginationType || "none",
      pageParamName: endpoint.pageParamName || "",
      limitParamName: endpoint.limitParamName || "",
      cursorParamName: endpoint.cursorParamName || "",
      offsetParamName: endpoint.offsetParamName || "",
      totalPath: endpoint.totalPath || "",
      hasMorePath: endpoint.hasMorePath || "",
      nextCursorPath: endpoint.nextCursorPath || "",
      defaultPageSize: endpoint.defaultPageSize,
      requiredScopes: endpoint.requiredScopes || [],
      isActive: endpoint.isActive,
    });
    setShowEndpointForm(true);
  };

  const handleEndpointSubmit = () => {
    if (editingEndpoint) {
      updateEndpointMutation.mutate({ id: editingEndpoint.id, data: endpointForm });
    } else {
      createEndpointMutation.mutate(endpointForm);
    }
  };

  const handleCreateEndpoint = () => {
    setEditingEndpoint(null);
    setEndpointForm({
      entityId: endpointEntityFilter || "",
      operationType: "list",
      name: "",
      httpMethod: "GET",
      pathTemplate: "",
      requestBodyPath: "",
      responseDataPath: "",
      paginationType: "none",
      pageParamName: "",
      limitParamName: "",
      cursorParamName: "",
      offsetParamName: "",
      totalPath: "",
      hasMorePath: "",
      nextCursorPath: "",
      defaultPageSize: 100,
      requiredScopes: [],
      isActive: true,
    });
    setShowEndpointForm(true);
  };

  const handleCreateEntity = () => {
    setEntityDialogMode("create");
    resetEntityForm();
    setShowEntityForm(true);
  };

  const handleEditEntity = (entity: LicenseiqEntity) => {
    setEntityDialogMode("edit");
    setEntityForm({
      name: entity.name,
      technicalName: entity.technicalName,
      description: entity.description || "",
      category: entity.category || "",
    });
    setSelectedEntity(entity);
    setShowEntityForm(true);
  };

  const handleSaveEntity = () => {
    if (entityDialogMode === "create") {
      createEntityMutation.mutate(entityForm);
    } else if (selectedEntity) {
      updateEntityMutation.mutate({ id: selectedEntity.id, data: entityForm });
    }
  };

  const handleCreateField = () => {
    if (!selectedEntity) {
      toast({ title: "Please select an entity first", variant: "destructive" });
      return;
    }
    setFieldDialogMode("create");
    resetFieldForm();
    setShowFieldForm(true);
  };

  const handleEditField = (field: LicenseiqField) => {
    setFieldDialogMode("edit");
    setFieldForm({
      id: field.id,
      fieldName: field.fieldName,
      dataType: field.dataType,
      description: field.description || "",
      isRequired: field.isRequired,
      defaultValue: field.defaultValue || "",
      validationRules: field.validationRules || "",
    });
    setShowFieldForm(true);
  };

  const handleSaveField = () => {
    const fieldData = {
      entityId: selectedEntity?.id,
      ...fieldForm,
    };

    if (fieldDialogMode === "create") {
      createFieldMutation.mutate(fieldData);
    } else {
      updateFieldMutation.mutate({ id: fieldForm.id, data: fieldData });
    }
  };

  const filteredEntities = entitiesData?.entities.filter((entity) =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entity.technicalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entity.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredFields = fieldsData?.fields.filter((field) =>
    field.fieldName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    field.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <MainLayout
      title="LicenseIQ Schema Catalog"
      description="Define and manage your platform's standard data entities and fields"
    >
      <div className="space-y-6">
        {/* Category filter and search */}
        <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search entities or fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white dark:bg-slate-800"
                data-testid="input-search-schema"
              />
            </div>
            {schemaContext === "enterprise" && activeSubTab === "listing" && (
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48 bg-white dark:bg-slate-800" data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Master Data">Master Data</SelectItem>
                  <SelectItem value="Transactional">Transactional</SelectItem>
                  <SelectItem value="Rules">Rules</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

        {/* Main Context Selector */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={schemaContext === "enterprise" ? "default" : "outline"}
            className={schemaContext === "enterprise" ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}
            onClick={() => { setSchemaContext("enterprise"); setActiveSubTab("listing"); }}
            data-testid="tab-entities"
          >
            <Database className="h-4 w-4 mr-2" />
            Enterprise Data Entities
          </Button>
          <Button
            variant={schemaContext === "reference" ? "default" : "outline"}
            className={schemaContext === "reference" ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}
            onClick={() => { setSchemaContext("reference"); setActiveSubTab("listing"); }}
            data-testid="tab-reference-lookups"
          >
            <Layers className="h-4 w-4 mr-2" />
            Contract Reference Lookups
          </Button>
        </div>

        {/* Sub-tabs */}
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-6">
          <TabsList className="bg-gray-50 dark:bg-slate-900 p-1 shadow-sm border border-gray-200 dark:border-slate-700">
            <TabsTrigger value="listing" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm" data-testid="subtab-listing">
              <Database className="h-4 w-4 mr-2" />
              {schemaContext === "enterprise" ? "Entities" : "Tables"}
            </TabsTrigger>
            <TabsTrigger value="fields" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm" data-testid="subtab-fields">
              <FileText className="h-4 w-4 mr-2" />
              Fields
            </TabsTrigger>
            <TabsTrigger value="api-endpoints" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm" data-testid="subtab-api-endpoints">
              <Globe className="h-4 w-4 mr-2" />
              API Endpoints
            </TabsTrigger>
            <TabsTrigger value="data" className="data-[state=active]:bg-green-500 data-[state=active]:text-white" data-testid="subtab-data">
              <Layers className="h-4 w-4 mr-2" />
              Data
            </TabsTrigger>
          </TabsList>

          {/* Listing Sub-Tab */}
          <TabsContent value="listing" className="space-y-6">
          {schemaContext === "enterprise" ? (
          <div className="space-y-6">
            {/* Entity Form - Slide-over Panel */}
            {showEntityForm && (
              <>
              <div className="fixed inset-0 bg-black/30 z-40" onClick={() => {setShowEntityForm(false); resetEntityForm();}} />
              <div className="fixed top-0 right-0 h-full w-[440px] max-w-[90vw] bg-white dark:bg-gray-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 dark:bg-gray-900 shrink-0">
                  <div>
                    <h3 className="font-semibold text-lg">{entityDialogMode === "create" ? "Create New Entity" : "Edit Entity"}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Define a data entity in your platform schema</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {setShowEntityForm(false); resetEntityForm();}} data-testid="button-close-entity-form">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  <div>
                    <Label htmlFor="entity-name">Entity Name*</Label>
                    <Input
                      id="entity-name"
                      placeholder="e.g., Sales Data"
                      value={entityForm.name}
                      onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })}
                      data-testid="input-entity-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="entity-technical-name">Technical Name*</Label>
                    <Input
                      id="entity-technical-name"
                      placeholder="e.g., sales_data"
                      value={entityForm.technicalName}
                      onChange={(e) => setEntityForm({ ...entityForm, technicalName: e.target.value })}
                      data-testid="input-entity-technical-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="entity-category">Category</Label>
                    <Select value={entityForm.category} onValueChange={(value) => setEntityForm({ ...entityForm, category: value })}>
                      <SelectTrigger data-testid="select-entity-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Master Data">Master Data</SelectItem>
                        <SelectItem value="Transactional">Transactional</SelectItem>
                        <SelectItem value="Rules">Rules</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="entity-description">Description</Label>
                    <Textarea
                      id="entity-description"
                      placeholder="Describe this entity's purpose..."
                      value={entityForm.description}
                      onChange={(e) => setEntityForm({ ...entityForm, description: e.target.value })}
                      rows={3}
                      data-testid="textarea-entity-description"
                    />
                  </div>
                </div>
                <div className="shrink-0 border-t px-5 py-4 bg-gray-50 dark:bg-gray-900 flex gap-2">
                  <Button onClick={handleSaveEntity} data-testid="button-save-entity" className="flex-1">
                    {entityDialogMode === "create" ? "Create Entity" : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={() => {setShowEntityForm(false); resetEntityForm();}} data-testid="button-cancel-entity">
                    Cancel
                  </Button>
                </div>
              </div>
              </>
            )}

            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {filteredEntities.length} {filteredEntities.length === 1 ? "entity" : "entities"} found
              </p>
              <Button onClick={handleCreateEntity} className="bg-gradient-to-r from-orange-600 to-orange-800 hover:from-orange-700 hover:to-orange-900" data-testid="button-create-entity">
                <Plus className="h-4 w-4 mr-2" />
                Create Entity
              </Button>
            </div>

            {entitiesLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading entities...</p>
              </div>
            ) : filteredEntities.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Database className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 text-center">
                    {searchQuery || (selectedCategory && selectedCategory !== "all") ? "No entities match your filters" : "No entities defined yet"}
                  </p>
                  {!searchQuery && (!selectedCategory || selectedCategory === "all") && (
                    <Button onClick={handleCreateEntity} className="mt-4" variant="outline" data-testid="button-create-first-entity">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Entity
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEntities.map((entity) => {
                  const Icon = ENTITY_ICONS[entity.technicalName] || Database;
                  return (
                    <Card
                      key={entity.id}
                      className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
                      onClick={() => {
                        setSelectedEntity(entity);
                        setSearchQuery(""); // Clear search when selecting entity to show all fields
                        setActiveSubTab("fields");
                      }}
                      data-testid={`card-entity-${entity.id}`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-100 dark:from-stone-900 dark:to-orange-950 rounded-lg group-hover:scale-110 transition-transform">
                              <Icon className="h-5 w-5 text-orange-700 dark:text-orange-500" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{entity.name}</CardTitle>
                              <code className="text-xs text-gray-500 dark:text-gray-400">
                                {entity.technicalName}
                              </code>
                            </div>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditEntity(entity)}
                              data-testid={`button-edit-entity-${entity.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPendingDelete({ id: entity.id, type: "entity", name: entity.name })}
                              data-testid={`button-delete-entity-${entity.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        {entity.category && (
                          <Badge className={`w-fit mt-2 ${CATEGORY_COLORS[entity.category] || ""}`}>
                            {entity.category}
                          </Badge>
                        )}
                      </CardHeader>
                      {entity.description && (
                        <CardContent>
                          <CardDescription className="text-sm">
                            {entity.description}
                          </CardDescription>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
          ) : (
            <ReferenceLookupManager
              searchQuery={searchQuery}
              expandedLookup={expandedLookup}
              setExpandedLookup={setExpandedLookup}
              lookupEditingId={lookupEditingId}
              setLookupEditingId={setLookupEditingId}
              lookupForm={lookupForm}
              setLookupForm={setLookupForm}
              lookupShowAdd={lookupShowAdd}
              setLookupShowAdd={setLookupShowAdd}
            />
          )}
          </TabsContent>

          {/* Fields Sub-Tab */}
          <TabsContent value="fields" className="space-y-6">
            {schemaContext === "reference" ? (
              <ReferenceFieldsView />
            ) : !selectedEntity ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-semibold">Enterprise Entity Fields</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select an entity to view and manage its field definitions.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {entitiesData?.entities?.map((entity: LicenseiqEntity) => {
                    const Icon = ENTITY_ICONS[entity.technicalName] || Database;
                    return (
                      <Card key={entity.id} className="cursor-pointer hover:shadow-md transition-shadow hover:border-orange-300" onClick={() => setSelectedEntity(entity)} data-testid={`card-ent-fields-${entity.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-orange-600" />
                            <span className="font-medium text-sm">{entity.name}</span>
                          </div>
                          <code className="text-xs text-gray-400 mt-1 block">{entity.technicalName}</code>
                          {entity.category && <Badge className={`mt-2 text-xs ${CATEGORY_COLORS[entity.category] || ""}`}>{entity.category}</Badge>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedEntity(null)} data-testid="button-back-ent-fields">
                      <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-100 dark:from-stone-900 dark:to-orange-950 rounded-lg">
                      {(() => {
                        const Icon = ENTITY_ICONS[selectedEntity.technicalName] || Database;
                        return <Icon className="h-5 w-5 text-orange-700 dark:text-orange-500" />;
                      })()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{selectedEntity.name}</h3>
                      <code className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedEntity.technicalName}
                      </code>
                    </div>
                  </div>
                  <Button onClick={handleCreateField} className="bg-gradient-to-r from-orange-600 to-orange-800 hover:from-orange-700 hover:to-orange-900" data-testid="button-create-field">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Field
                  </Button>
                </div>

                {/* Field Form - Slide-over Panel */}
                {showFieldForm && (
                  <>
                  <div className="fixed inset-0 bg-black/30 z-40" onClick={() => {setShowFieldForm(false); resetFieldForm();}} />
                  <div className="fixed top-0 right-0 h-full w-[440px] max-w-[90vw] bg-white dark:bg-gray-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 dark:bg-gray-900 shrink-0">
                      <div>
                        <h3 className="font-semibold text-lg">{fieldDialogMode === "create" ? "Add New Field" : "Edit Field"}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Define a field for {selectedEntity.name}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => {setShowFieldForm(false); resetFieldForm();}} data-testid="button-close-field-form">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                      <div>
                        <Label htmlFor="field-name">Field Name*</Label>
                        <Input
                          id="field-name"
                          placeholder="e.g., transactionId"
                          value={fieldForm.fieldName}
                          onChange={(e) => setFieldForm({ ...fieldForm, fieldName: e.target.value })}
                          data-testid="input-field-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="field-data-type">Data Type*</Label>
                        <Select value={fieldForm.dataType} onValueChange={(value) => setFieldForm({ ...fieldForm, dataType: value })}>
                          <SelectTrigger data-testid="select-field-data-type">
                            <SelectValue placeholder="Select data type" />
                          </SelectTrigger>
                          <SelectContent>
                            {DATA_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="field-description">Description</Label>
                        <Textarea
                          id="field-description"
                          placeholder="Describe this field's purpose..."
                          value={fieldForm.description}
                          onChange={(e) => setFieldForm({ ...fieldForm, description: e.target.value })}
                          rows={2}
                          data-testid="textarea-field-description"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="field-required"
                          checked={fieldForm.isRequired}
                          onChange={(e) => setFieldForm({ ...fieldForm, isRequired: e.target.checked })}
                          className="rounded border-gray-300"
                          data-testid="checkbox-field-required"
                        />
                        <Label htmlFor="field-required" className="cursor-pointer">
                          Required field
                        </Label>
                      </div>
                    </div>
                    <div className="shrink-0 border-t px-5 py-4 bg-gray-50 dark:bg-gray-900 flex gap-2">
                      <Button onClick={handleSaveField} data-testid="button-save-field" className="flex-1">
                        {fieldDialogMode === "create" ? "Add Field" : "Save Changes"}
                      </Button>
                      <Button variant="outline" onClick={() => {setShowFieldForm(false); resetFieldForm();}} data-testid="button-cancel-field">
                        Cancel
                      </Button>
                    </div>
                  </div>
                  </>
                )}

                {fieldsLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading fields...</p>
                  </div>
                ) : filteredFields.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <FileText className="h-16 w-16 text-gray-400 mb-4" />
                      <p className="text-gray-600 dark:text-gray-400 text-center">
                        {searchQuery ? "No fields match your search" : "No fields defined for this entity yet"}
                      </p>
                      {!searchQuery && (
                        <Button onClick={handleCreateField} className="mt-4" variant="outline" data-testid="button-create-first-field">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First Field
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Field Name</TableHead>
                            <TableHead>Data Type</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredFields.map((field) => (
                            <TableRow key={field.id} data-testid={`row-field-${field.id}`}>
                              <TableCell className="font-mono font-medium">{field.fieldName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{field.dataType}</Badge>
                              </TableCell>
                              <TableCell>
                                {field.isRequired ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <span className="text-gray-400">Optional</span>
                                )}
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-gray-600 dark:text-gray-400">
                                {field.description || "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditField(field)}
                                    data-testid={`button-edit-field-${field.id}`}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setPendingDelete({ id: field.id, type: "field", name: field.fieldName })}
                                    data-testid={`button-delete-field-${field.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* API Endpoints Sub-Tab */}
          <TabsContent value="api-endpoints" className="space-y-6">
            {schemaContext === "reference" ? (
              <ReferenceApiEndpointsView />
            ) : (
            <Card>
              <CardHeader className="border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      LicenseIQ API Endpoints
                    </CardTitle>
                    <CardDescription>
                      Configure outbound API endpoints to push data from LicenseIQ to external systems
                    </CardDescription>
                  </div>
                  <Button onClick={handleCreateEndpoint} data-testid="button-add-endpoint">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Endpoint
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* Entity Filter */}
                <div className="flex gap-4">
                  <div className="flex-1 max-w-xs">
                    <Label>Filter by Entity</Label>
                    <Select value={endpointEntityFilter || "all"} onValueChange={(v) => setEndpointEntityFilter(v === "all" ? "" : v)}>
                      <SelectTrigger data-testid="select-endpoint-entity-filter">
                        <SelectValue placeholder="All Entities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Entities</SelectItem>
                        {entitiesData?.entities?.map(ent => (
                          <SelectItem key={ent.id} value={ent.id}>{ent.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Inline Endpoint Form */}
                {showEndpointForm && (
                  <>
                  <div className="fixed inset-0 bg-black/30 z-40" onClick={() => { setShowEndpointForm(false); setEditingEndpoint(null); resetEndpointForm(); }} />
                  <div className="fixed top-0 right-0 h-full w-[520px] max-w-[90vw] bg-white dark:bg-gray-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 dark:bg-gray-900 shrink-0">
                      <div>
                        <h3 className="font-semibold text-lg">{editingEndpoint ? "Edit Endpoint" : "New Endpoint"}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Define how LicenseIQ data is sent to external APIs</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setShowEndpointForm(false); setEditingEndpoint(null); resetEndpointForm(); }} data-testid="button-close-endpoint-form">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Endpoint Name *</Label>
                          <Input
                            placeholder="e.g., Get All Sales"
                            value={endpointForm.name}
                            onChange={(e) => setEndpointForm(prev => ({ ...prev, name: e.target.value }))}
                            data-testid="input-endpoint-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Operation Type *</Label>
                          <Select value={endpointForm.operationType} onValueChange={(v) => setEndpointForm(prev => ({ ...prev, operationType: v }))}>
                            <SelectTrigger data-testid="select-endpoint-operation">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="list">List (Get All)</SelectItem>
                              <SelectItem value="get">Get (Single Record)</SelectItem>
                              <SelectItem value="create">Create</SelectItem>
                              <SelectItem value="update">Update</SelectItem>
                              <SelectItem value="delete">Delete</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>LicenseIQ Entity *</Label>
                          <Select value={endpointForm.entityId} onValueChange={(v) => setEndpointForm(prev => ({ ...prev, entityId: v }))}>
                            <SelectTrigger data-testid="select-endpoint-entity">
                              <SelectValue placeholder="Select Entity" />
                            </SelectTrigger>
                            <SelectContent>
                              {entitiesData?.entities?.map(ent => (
                                <SelectItem key={ent.id} value={ent.id}>{ent.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-3 pt-6">
                          <input
                            type="checkbox"
                            checked={endpointForm.isActive}
                            onChange={(e) => setEndpointForm(prev => ({ ...prev, isActive: e.target.checked }))}
                            className="h-4 w-4"
                            id="endpoint-active"
                            data-testid="checkbox-endpoint-active"
                          />
                          <Label htmlFor="endpoint-active">Active</Label>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          HTTP Configuration
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>HTTP Method *</Label>
                            <Select value={endpointForm.httpMethod} onValueChange={(v) => setEndpointForm(prev => ({ ...prev, httpMethod: v }))}>
                              <SelectTrigger data-testid="select-endpoint-method">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                                <SelectItem value="PUT">PUT</SelectItem>
                                <SelectItem value="PATCH">PATCH</SelectItem>
                                <SelectItem value="DELETE">DELETE</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label>Path Template *</Label>
                            <Input
                              placeholder="/api/v1/sales or /api/v1/sales/{id}"
                              value={endpointForm.pathTemplate}
                              onChange={(e) => setEndpointForm(prev => ({ ...prev, pathTemplate: e.target.value }))}
                              className="font-mono"
                              data-testid="input-endpoint-path"
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          Response Configuration
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Response Data Path</Label>
                            <Input
                              placeholder="e.g., data.items or results"
                              value={endpointForm.responseDataPath}
                              onChange={(e) => setEndpointForm(prev => ({ ...prev, responseDataPath: e.target.value }))}
                              className="font-mono"
                              data-testid="input-endpoint-response-path"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Request Body Path</Label>
                            <Input
                              placeholder="For POST/PUT - e.g., data"
                              value={endpointForm.requestBodyPath}
                              onChange={(e) => setEndpointForm(prev => ({ ...prev, requestBodyPath: e.target.value }))}
                              className="font-mono"
                              data-testid="input-endpoint-request-path"
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-2 font-medium w-full justify-between" data-testid="trigger-pagination-section">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4" />
                            Pagination Settings
                          </div>
                          <Badge variant="outline">{endpointForm.paginationType}</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4 space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Pagination Type</Label>
                              <Select value={endpointForm.paginationType} onValueChange={(v) => setEndpointForm(prev => ({ ...prev, paginationType: v }))}>
                                <SelectTrigger data-testid="select-endpoint-pagination">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="offset">Offset-based</SelectItem>
                                  <SelectItem value="cursor">Cursor-based</SelectItem>
                                  <SelectItem value="page">Page-based</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Default Page Size</Label>
                              <Input
                                type="number"
                                value={endpointForm.defaultPageSize}
                                onChange={(e) => setEndpointForm(prev => ({ ...prev, defaultPageSize: parseInt(e.target.value) || 100 }))}
                                data-testid="input-endpoint-page-size"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Total Path</Label>
                              <Input
                                placeholder="e.g., meta.total"
                                value={endpointForm.totalPath}
                                onChange={(e) => setEndpointForm(prev => ({ ...prev, totalPath: e.target.value }))}
                                className="font-mono"
                                data-testid="input-endpoint-total-path"
                              />
                            </div>
                          </div>
                          
                          {endpointForm.paginationType === "offset" && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Offset Param</Label>
                                <Input
                                  placeholder="e.g., offset"
                                  value={endpointForm.offsetParamName}
                                  onChange={(e) => setEndpointForm(prev => ({ ...prev, offsetParamName: e.target.value }))}
                                  className="font-mono"
                                  data-testid="input-endpoint-offset-param"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Limit Param</Label>
                                <Input
                                  placeholder="e.g., limit"
                                  value={endpointForm.limitParamName}
                                  onChange={(e) => setEndpointForm(prev => ({ ...prev, limitParamName: e.target.value }))}
                                  className="font-mono"
                                  data-testid="input-endpoint-limit-param"
                                />
                              </div>
                            </div>
                          )}
                          
                          {endpointForm.paginationType === "cursor" && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Cursor Param</Label>
                                <Input
                                  placeholder="e.g., cursor"
                                  value={endpointForm.cursorParamName}
                                  onChange={(e) => setEndpointForm(prev => ({ ...prev, cursorParamName: e.target.value }))}
                                  className="font-mono"
                                  data-testid="input-endpoint-cursor-param"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Next Cursor Path</Label>
                                <Input
                                  placeholder="e.g., meta.next_cursor"
                                  value={endpointForm.nextCursorPath}
                                  onChange={(e) => setEndpointForm(prev => ({ ...prev, nextCursorPath: e.target.value }))}
                                  className="font-mono"
                                  data-testid="input-endpoint-next-cursor-path"
                                />
                              </div>
                            </div>
                          )}
                          
                          {endpointForm.paginationType === "page" && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Page Param</Label>
                                <Input
                                  placeholder="e.g., page"
                                  value={endpointForm.pageParamName}
                                  onChange={(e) => setEndpointForm(prev => ({ ...prev, pageParamName: e.target.value }))}
                                  className="font-mono"
                                  data-testid="input-endpoint-page-param"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Has More Path</Label>
                                <Input
                                  placeholder="e.g., meta.has_more"
                                  value={endpointForm.hasMorePath}
                                  onChange={(e) => setEndpointForm(prev => ({ ...prev, hasMorePath: e.target.value }))}
                                  className="font-mono"
                                  data-testid="input-endpoint-has-more-path"
                                />
                              </div>
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                    <div className="shrink-0 border-t px-5 py-4 bg-gray-50 dark:bg-gray-900 flex gap-2">
                      <Button 
                        onClick={handleEndpointSubmit} 
                        disabled={!endpointForm.name || !endpointForm.entityId || !endpointForm.pathTemplate || createEndpointMutation.isPending || updateEndpointMutation.isPending}
                        data-testid="button-save-endpoint" 
                        className="flex-1"
                      >
                        {editingEndpoint ? "Save Changes" : "Create Endpoint"}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => { setShowEndpointForm(false); setEditingEndpoint(null); resetEndpointForm(); }} 
                        data-testid="button-cancel-endpoint"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                  </>
                )}

                {/* Endpoints List */}
                {endpointsLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading endpoints...</p>
                  </div>
                ) : !endpointsData || endpointsData.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Globe className="h-16 w-16 text-gray-400 mb-4" />
                      <p className="text-gray-600 dark:text-gray-400 text-center">
                        No API endpoints configured yet
                      </p>
                      <Button 
                        onClick={handleCreateEndpoint} 
                        className="mt-4" 
                        variant="outline" 
                        data-testid="button-create-first-endpoint"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Endpoint
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {endpointsData.map((endpoint) => {
                      const entity = entitiesData?.entities?.find(e => e.id === endpoint.entityId);
                      const isExpanded = expandedEndpointId === endpoint.id;
                      
                      return (
                        <Collapsible key={endpoint.id} open={isExpanded} onOpenChange={(open) => setExpandedEndpointId(open ? endpoint.id : null)}>
                          <Card>
                            <CollapsibleTrigger asChild>
                              <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 py-4" data-testid={`trigger-endpoint-${endpoint.id}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    <Badge variant={endpoint.httpMethod === 'GET' ? 'secondary' : endpoint.httpMethod === 'POST' ? 'default' : 'outline'}>
                                      {endpoint.httpMethod}
                                    </Badge>
                                    <span className="font-medium">{endpoint.name}</span>
                                    <span className="font-mono text-sm text-gray-500">{endpoint.pathTemplate}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{entity?.name || "Unknown Entity"}</Badge>
                                    <Badge variant={endpoint.isActive ? "default" : "secondary"}>
                                      {endpoint.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                      <Button size="sm" variant="ghost" onClick={() => openEditEndpoint(endpoint)} data-testid={`button-edit-endpoint-${endpoint.id}`}>
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ id: endpoint.id, type: "endpoint", name: endpoint.name })} data-testid={`button-delete-endpoint-${endpoint.id}`}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <CardContent className="pt-0 border-t">
                                <EndpointDetailPanel endpoint={endpoint} entity={entity} />
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </TabsContent>

          {/* Data Sub-Tab */}
          <TabsContent value="data" className="space-y-6">
            {schemaContext === "reference" ? (
              <ReferenceDataView
                searchQuery={searchQuery}
                expandedLookup={expandedLookup}
                setExpandedLookup={setExpandedLookup}
                lookupEditingId={lookupEditingId}
                setLookupEditingId={setLookupEditingId}
                lookupForm={lookupForm}
                setLookupForm={setLookupForm}
                lookupShowAdd={lookupShowAdd}
                setLookupShowAdd={setLookupShowAdd}
              />
            ) : (
            <div className="flex gap-0 min-h-[600px]">
              {/* Left Sidebar - Entity Navigation */}
              <div className="w-64 shrink-0 border rounded-l-lg bg-white dark:bg-gray-950 flex flex-col">
                <div className="p-3 border-b">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-orange-600" />
                    <span className="font-semibold text-sm">Entities</span>
                    <Badge variant="outline" className="text-xs ml-auto">{(availableTablesData?.tables || []).filter((t: any) => t.technicalName !== 'company_master' && t.technicalName !== 'partner_contract_associations').length}</Badge>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search entities..."
                      data-testid="input-entity-search"
                      className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={entitySearchFilter}
                      onChange={(e) => setEntitySearchFilter(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {(() => {
                    const entityOrder = [
                      'company_master', 'sales_channels', 'territory_master', 'partner_master',
                      'partner_contract_associations', 'product_hierarchy', 'product_classifications',
                      'products', 'product_attributes', 'product_territory_matrix',
                      'product_channel_matrix', 'product_packaging_matrix', 'product_bom',
                    ];
                    const tables = availableTablesData?.tables || [];
                    const visibleTables = tables.filter((t: any) => t.technicalName !== 'company_master' && t.technicalName !== 'partner_contract_associations');
                    const filtered = entitySearchFilter 
                      ? visibleTables.filter((t: any) => t.name.toLowerCase().includes(entitySearchFilter.toLowerCase()) || t.technicalName.toLowerCase().includes(entitySearchFilter.toLowerCase()))
                      : visibleTables;
                    const sorted = [...filtered].sort((a: any, b: any) => {
                      const ai = entityOrder.indexOf(a.technicalName);
                      const bi = entityOrder.indexOf(b.technicalName);
                      if (ai >= 0 && bi >= 0) return ai - bi;
                      if (ai >= 0) return -1;
                      if (bi >= 0) return 1;
                      return a.name.localeCompare(b.name);
                    });
                    if (sorted.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-gray-400">
                          {entitySearchFilter ? "No matching entities" : "No entities found"}
                        </div>
                      );
                    }
                    return sorted.map((table: any) => (
                      <button
                        key={table.id}
                        data-testid={`entity-nav-${table.technicalName}`}
                        className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 dark:border-gray-800 transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/20 ${
                          selectedDataEntity === table.technicalName 
                            ? 'bg-orange-50 dark:bg-orange-950/30 border-l-2 border-l-orange-500 font-medium text-orange-900 dark:text-orange-200' 
                            : 'border-l-2 border-l-transparent text-gray-700 dark:text-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedDataEntity(table.technicalName);
                          setShowDataForm(false);
                          setEditingRecord(null);
                          setDataPage(1);
                          setDataFilters({});
                          setAdvancedFilters([]);
                          setDataSortColumn("created_at");
                          setDataSortDirection("desc");
                        }}
                      >
                        <div className="font-medium text-xs leading-tight">{table.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{table.technicalName}</div>
                      </button>
                    ));
                  })()}
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 border border-l-0 rounded-r-lg bg-white dark:bg-gray-950">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Database className="h-5 w-5 text-green-600" />
                      {selectedDataEntity 
                        ? (availableTablesData?.tables || []).find((t: any) => t.technicalName === selectedDataEntity)?.name || selectedDataEntity
                        : "Entity Data Browser"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selectedDataEntity 
                        ? `Viewing records from ${selectedDataEntity}`
                        : "Select an entity from the left to view and manage records"}
                    </p>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Organizational Context Selector */}
                  {(!selectedDataEntity || entityDataLoading || (entityDataResult?.tenantColumns && (
                    entityDataResult.tenantColumns.hasCompany || 
                    entityDataResult.tenantColumns.hasBU || 
                    entityDataResult.tenantColumns.hasLocation
                  ))) && (
                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Building className="h-3.5 w-3.5 text-orange-700" />
                      <span className="font-medium text-sm text-orange-900 dark:text-orange-200">Organizational Context</span>
                      {selectedDataEntity && entityDataResult?.tenantColumns && (
                        <Badge variant="outline" className="text-xs">
                          Supports: 
                          {entityDataResult.tenantColumns.hasCompany && " Company"}
                          {entityDataResult.tenantColumns.hasBU && " / BU"}
                          {entityDataResult.tenantColumns.hasLocation && " / Location"}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="data-context-company" className="text-xs">Company</Label>
                        <select
                          id="data-context-company"
                          data-testid="select-data-context-company"
                          className="flex h-8 w-full items-center rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-orange-500"
                          value={dataContextCompanyId || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDataContextCompanyId(value);
                            setDataContextBuId("");
                            setDataContextLocationId("");
                          }}
                        >
                          <option value="">Select company...</option>
                          {Array.isArray(companiesData) && companiesData.map((company: any) => (
                            <option key={company.id} value={company.id}>
                              {company.companyName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="data-context-bu" className="text-xs">Business Unit</Label>
                        <select
                          id="data-context-bu"
                          data-testid="select-data-context-bu"
                          className="flex h-8 w-full items-center rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                          value={dataContextBuId || "_all"}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDataContextBuId(value === "_all" ? "" : value);
                            setDataContextLocationId("");
                          }}
                          disabled={!dataContextCompanyId}
                        >
                          <option value="_all">{dataContextCompanyId ? "All Business Units" : "Select company first"}</option>
                          {Array.isArray(businessUnitsData) && businessUnitsData.map((bu: any) => (
                            <option key={bu.id} value={bu.id}>
                              {bu.orgName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="data-context-location" className="text-xs">Location</Label>
                        <select
                          id="data-context-location"
                          data-testid="select-data-context-location"
                          className="flex h-8 w-full items-center rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                          value={dataContextLocationId || "_all"}
                          onChange={(e) => setDataContextLocationId(e.target.value === "_all" ? "" : e.target.value)}
                          disabled={!dataContextBuId}
                        >
                          <option value="_all">{dataContextBuId ? "All Locations" : "Select business unit first"}</option>
                          {Array.isArray(locationsData) && locationsData.map((loc: any) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.locationName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  )}

                  {!selectedDataEntity && (
                    <div className="text-center py-16 text-gray-400">
                      <Layers className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">Select an entity</p>
                      <p className="text-sm mt-1">Choose an entity from the left panel to browse its data</p>
                    </div>
                  )}

                {/* Data Form - Slide-over Panel */}
                {showDataForm && selectedDataEntity && entityColumnsData?.columns && (
                  <>
                  <div className="fixed inset-0 bg-black/30 z-40" onClick={() => { setShowDataForm(false); setEditingRecord(null); setDataFormValues({}); setCitySearchQuery(''); setCityPostalCode(null); setCitySearchOpen(false); }} />
                  <div className="fixed top-0 right-0 h-full w-[480px] max-w-[90vw] bg-white dark:bg-gray-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 dark:bg-gray-900 shrink-0">
                      <div>
                        <h3 className="font-semibold text-lg">{dataFormMode === "create" ? "Add New Record" : "Edit Record"}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(availableTablesData?.tables || []).find((t: any) => t.technicalName === selectedDataEntity)?.name || selectedDataEntity}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setShowDataForm(false);
                          setEditingRecord(null);
                          setDataFormValues({});
                          setCitySearchQuery('');
                          setCityPostalCode(null);
                          setCitySearchOpen(false);
                        }}
                        data-testid="button-close-data-form"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                      <div className="grid grid-cols-1 gap-4">
                        {(() => {
                          // Entity-specific column reordering for the data form.
                          // Default order is ordinal_position; this lets us place
                          // newly added columns next to related ones.
                          const reorder: Record<string, Record<string, string>> = {
                            // for `products`, place `brand_id` immediately before `product_family_id`
                            products: { brand_id: 'product_family_id' },
                          };
                          const cols = [...entityColumnsData.columns];
                          const map = reorder[selectedDataEntity];
                          if (map) {
                            for (const [moveCol, beforeCol] of Object.entries(map)) {
                              const fromIdx = cols.findIndex(c => c.column_name === moveCol);
                              const toIdx = cols.findIndex(c => c.column_name === beforeCol);
                              if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
                                const [item] = cols.splice(fromIdx, 1);
                                const insertAt = cols.findIndex(c => c.column_name === beforeCol);
                                cols.splice(insertAt, 0, item);
                              }
                            }
                          }
                          return cols;
                        })()
                          .filter(col => !['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(col.column_name))
                          .filter(col => {
                            const entityCfg = dropdownConfig[selectedDataEntity];
                            const fieldCfg = entityCfg?.[col.column_name];
                            return !fieldCfg?.hidden;
                          })
                          .map((column) => {
                            const entityCfg = dropdownConfig[selectedDataEntity];
                            const fieldCfg = entityCfg?.[column.column_name];
                            const isReadOnly = fieldCfg?.readOnlyInCreate && dataFormMode === 'create';
                            const prettyLabel = column.column_name.replace(/_id$/, '').replace(/_/g, ' ');

                            if (isReadOnly) {
                              return (
                                <div key={column.column_name}>
                                  <Label className="capitalize">{prettyLabel}</Label>
                                  <Input
                                    value={fieldCfg?.readOnlyDisplay || dataFormValues[column.column_name] || ''}
                                    disabled
                                    className="bg-muted"
                                    data-testid={`input-data-${column.column_name}`}
                                  />
                                </div>
                              );
                            }

                            if (selectedDataEntity === 'partner_master' && column.column_name === 'headquarters_city') {
                              const cityDisplayValue = dataFormValues.headquarters_city
                                ? (cityPostalCode ? `${dataFormValues.headquarters_city} (${cityPostalCode})` : dataFormValues.headquarters_city)
                                : '';
                              return (
                                <div key={column.column_name}>
                                  <Label className="capitalize">
                                    {prettyLabel}
                                    {isMandatoryField(selectedDataEntity, column.column_name) && <span className="text-red-500 ml-1">*</span>}
                                  </Label>
                                  <Popover open={citySearchOpen} onOpenChange={setCitySearchOpen}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="w-full justify-between font-normal h-auto min-h-[36px] text-left"
                                        data-testid="input-data-headquarters_city"
                                      >
                                        <span className={cityDisplayValue ? '' : 'text-muted-foreground'}>
                                          {cityDisplayValue || 'Search city...'}
                                        </span>
                                        <Search className="h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-0" align="start">
                                      <div className="p-2 border-b">
                                        <Input
                                          placeholder="Type city name or ZIP..."
                                          value={citySearchQuery}
                                          onChange={(e) => setCitySearchQuery(e.target.value)}
                                          autoFocus
                                          data-testid="input-city-search"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Escape') {
                                              setCitySearchOpen(false);
                                            }
                                          }}
                                        />
                                      </div>
                                      <div className="max-h-[240px] overflow-y-auto">
                                        {citySuggestions.length === 0 && debouncedCityQuery.length >= 1 && (
                                          <div className="p-3 text-sm text-muted-foreground text-center">No cities found</div>
                                        )}
                                        {citySuggestions.map((s: any) => {
                                          const label = s.postalCode ? `${s.city} (${s.postalCode})` : s.city;
                                          const sublabel = `${s.state}, ${s.country}`;
                                          return (
                                            <div
                                              key={`${s.cityId}-${s.postalCode}`}
                                              className="flex flex-col px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                              onClick={() => {
                                                setDataFormValues(prev => ({
                                                  ...prev,
                                                  headquarters_city: s.city,
                                                  headquarters_state: s.state,
                                                  headquarters_country: s.country,
                                                }));
                                                setCityPostalCode(s.postalCode || null);
                                                setCitySearchQuery('');
                                                setCitySearchOpen(false);
                                              }}
                                              data-testid={`city-option-${s.cityId}`}
                                            >
                                              <span className="text-sm font-medium">{label}</span>
                                              <span className="text-xs text-muted-foreground">{sublabel}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              );
                            }

                            if (selectedDataEntity === 'partner_master' && (column.column_name === 'headquarters_state' || column.column_name === 'headquarters_country')) {
                              const hasAutoFill = !!(dataFormValues.headquarters_city && dataFormValues[column.column_name]);
                              return (
                                <div key={column.column_name}>
                                  <Label className="capitalize">{prettyLabel}</Label>
                                  <Input
                                    value={dataFormValues[column.column_name] || ''}
                                    disabled={hasAutoFill}
                                    className={hasAutoFill ? 'bg-muted' : ''}
                                    onChange={(e) => {
                                      if (!hasAutoFill) {
                                        setDataFormValues(prev => ({ ...prev, [column.column_name]: e.target.value }));
                                      }
                                    }}
                                    data-testid={`input-data-${column.column_name}`}
                                  />
                                  {hasAutoFill && (
                                    <p className="text-xs text-muted-foreground mt-0.5">Auto-filled from selected city.</p>
                                  )}
                                </div>
                              );
                            }

                            if (fieldCfg) {
                              const showMandatory = isMandatoryField(selectedDataEntity, column.column_name) || (column.is_nullable === 'NO' && !neverMandatoryFields.includes(column.column_name));

                              if (fieldCfg.multiSelect) {
                                const currentValues: string[] = (() => {
                                  const raw = dataFormValues[column.column_name];
                                  if (Array.isArray(raw)) return raw;
                                  if (typeof raw === 'string' && raw) return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
                                  return [];
                                })();
                                return (
                                  <div key={column.column_name}>
                                    <Label htmlFor={`data-${column.column_name}`} className="capitalize">
                                      {prettyLabel}
                                      {showMandatory && <span className="text-red-500 ml-1">*</span>}
                                    </Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between font-normal h-auto min-h-[36px] text-left" data-testid={`input-data-${column.column_name}`}>
                                          {currentValues.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {currentValues.map(v => (
                                                <Badge key={v} variant="secondary" className="text-xs">
                                                  {v}
                                                  <button
                                                    type="button"
                                                    className="ml-1 hover:text-red-500"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const newVals = currentValues.filter(x => x !== v);
                                                      setDataFormValues(prev => ({ ...prev, [column.column_name]: newVals.join(', ') }));
                                                    }}
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </Badge>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground">Select...</span>
                                          )}
                                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[250px] p-2" align="start">
                                        {fieldCfg.options.map(opt => (
                                          <div key={opt.value} className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                                            onClick={() => {
                                              const newVals = currentValues.includes(opt.value)
                                                ? currentValues.filter(x => x !== opt.value)
                                                : [...currentValues, opt.value];
                                              setDataFormValues(prev => ({ ...prev, [column.column_name]: newVals.join(', ') }));
                                            }}
                                          >
                                            <Checkbox checked={currentValues.includes(opt.value)} />
                                            <span className="text-sm">{opt.label}</span>
                                          </div>
                                        ))}
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                );
                              }

                              return (
                                <div key={column.column_name}>
                                  <Label htmlFor={`data-${column.column_name}`} className="capitalize">
                                    {prettyLabel}
                                    {showMandatory && <span className="text-red-500 ml-1">*</span>}
                                  </Label>
                                  <Select
                                    value={dataFormValues[column.column_name]?.toString() || '_none'}
                                    onValueChange={(value) => {
                                      const newVal = value === '_none' ? '' : value;
                                      setDataFormValues(prev => ({ ...prev, [column.column_name]: newVal }));
                                      fieldCfg.onChange?.(newVal);
                                    }}
                                  >
                                    <SelectTrigger data-testid={`input-data-${column.column_name}`}>
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="_none">-- Select --</SelectItem>
                                      {fieldCfg.options.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            }

                            if (column.data_type === 'boolean') {
                              const showMandatoryBool = isMandatoryField(selectedDataEntity, column.column_name);
                              return (
                                <div key={column.column_name}>
                                  <Label htmlFor={`data-${column.column_name}`} className="capitalize">
                                    {prettyLabel}
                                    {showMandatoryBool && <span className="text-red-500 ml-1">*</span>}
                                  </Label>
                                  <Select
                                    value={dataFormValues[column.column_name]?.toString() || ''}
                                    onValueChange={(value) => setDataFormValues(prev => ({
                                      ...prev,
                                      [column.column_name]: value === 'true'
                                    }))}
                                  >
                                    <SelectTrigger data-testid={`input-data-${column.column_name}`}>
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="true">Yes</SelectItem>
                                      <SelectItem value="false">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            }

                            const isCodeField = column.column_name.endsWith('_code') || column.column_name === 'code' || 
                              (column.column_name.endsWith('_id') && !['id', 'company_id', 'business_unit_id', 'location_id', 'created_by', 'updated_by'].includes(column.column_name) && column.column_name === entityColumnsData.columns.find(c => c.column_name.endsWith('_id') && !['id', 'company_id', 'business_unit_id', 'location_id', 'created_by', 'updated_by'].includes(c.column_name))?.column_name);
                            const codeDisabled = isCodeField;

                            if (isDateColumn(column.column_name, column.data_type)) {
                              const showMandatoryDate = isMandatoryField(selectedDataEntity, column.column_name) || (column.is_nullable === 'NO' && !neverMandatoryFields.includes(column.column_name));
                              return (
                                <div key={column.column_name}>
                                  <Label htmlFor={`data-${column.column_name}`} className="capitalize">
                                    {prettyLabel}
                                    {showMandatoryDate && <span className="text-red-500 ml-1">*</span>}
                                  </Label>
                                  <Input
                                    id={`data-${column.column_name}`}
                                    type="date"
                                    value={toInputDateValue(dataFormValues[column.column_name])}
                                    onChange={(e) => setDataFormValues(prev => ({
                                      ...prev,
                                      [column.column_name]: e.target.value
                                    }))}
                                    data-testid={`input-data-${column.column_name}`}
                                  />
                                </div>
                              );
                            }

                            const showMandatoryText = isMandatoryField(selectedDataEntity, column.column_name) || (column.is_nullable === 'NO' && !neverMandatoryFields.includes(column.column_name));
                            return (
                              <div key={column.column_name}>
                                <Label htmlFor={`data-${column.column_name}`} className="capitalize">
                                  {prettyLabel}
                                  {showMandatoryText && <span className="text-red-500 ml-1">*</span>}
                                </Label>
                                <Input
                                  id={`data-${column.column_name}`}
                                  placeholder={codeDisabled ? "Auto-generated" : column.column_name}
                                  value={dataFormValues[column.column_name] || ''}
                                  onChange={(e) => setDataFormValues(prev => ({
                                    ...prev,
                                    [column.column_name]: e.target.value
                                  }))}
                                  disabled={codeDisabled}
                                  className={codeDisabled ? "bg-gray-100 dark:bg-gray-800 font-mono" : ""}
                                  data-testid={`input-data-${column.column_name}`}
                                />
                                {codeDisabled && <p className="text-xs text-gray-500 mt-0.5">Auto-generated. Cannot be modified.</p>}
                              </div>
                            );
                          })}
                      </div>
                      {/* Warning for System Admins without context */}
                      {dataFormMode === "create" && needsContextSelection && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                            <span className="font-medium text-amber-800 dark:text-amber-200">
                              Please select an Organizational Context
                            </span>
                          </div>
                          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            As a System Admin, you need to select a Company in the Organizational Context panel above before adding records to this entity.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 border-t px-5 py-4 bg-gray-50 dark:bg-gray-900 flex gap-2">
                      <Button
                        onClick={() => {
                          const columns = entityColumnsData?.columns || [];
                          const editableCols = columns.filter(col => !['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(col.column_name));

                          const missingMandatory: string[] = [];
                          for (const col of editableCols) {
                            const isMandatory = isMandatoryField(selectedDataEntity, col.column_name);
                            if (isMandatory) {
                              const val = dataFormValues[col.column_name];
                              if (val === undefined || val === null || val === '') {
                                const isAutoGen = col.column_name.endsWith('_code') || col.column_name === 'code' ||
                                  (col.column_name.endsWith('_id') && !['company_id', 'business_unit_id', 'location_id'].includes(col.column_name) && col.column_name === editableCols.find(c => c.column_name.endsWith('_id') && !['id', 'company_id', 'business_unit_id', 'location_id', 'created_by', 'updated_by'].includes(c.column_name))?.column_name);
                                const isReadOnlyField = dropdownConfig[selectedDataEntity]?.[col.column_name]?.readOnlyInCreate && dataFormMode === 'create';
                                if (!isAutoGen && !isReadOnlyField) {
                                  missingMandatory.push(col.column_name.replace(/_/g, ' '));
                                }
                              }
                            }
                          }
                          if (missingMandatory.length > 0) {
                            toast({ title: "Required Fields Missing", description: `Please fill in: ${missingMandatory.join(', ')}`, variant: "destructive" });
                            return;
                          }

                          const strictFields = strictTextFieldsConfig[selectedDataEntity] || [];
                          const numericOnlyErrors: string[] = [];
                          for (const fieldName of strictFields) {
                            const val = dataFormValues[fieldName];
                            if (val && typeof val === 'string' && isNumericOnly(val)) {
                              const entityCfg = dropdownConfig[selectedDataEntity];
                              if (!entityCfg?.[fieldName]) {
                                numericOnlyErrors.push(fieldName.replace(/_/g, ' '));
                              }
                            }
                          }
                          if (numericOnlyErrors.length > 0) {
                            toast({ title: "Validation Error", description: `Enter a valid text value for: ${numericOnlyErrors.join(', ')}. Numbers-only entries are not allowed.`, variant: "destructive" });
                            return;
                          }

                          const effDate = dataFormValues['effective_date'] || dataFormValues['start_date'];
                          const expDate = dataFormValues['expiration_date'] || dataFormValues['end_date'];
                          if (effDate && expDate) {
                            const effKey = dataFormValues['effective_date'] ? 'effective_date' : 'start_date';
                            const expKey = dataFormValues['expiration_date'] ? 'expiration_date' : 'end_date';
                            if (new Date(expDate) <= new Date(effDate)) {
                              const expLabel = expKey.replace(/_/g, ' ');
                              const effLabel = effKey.replace(/_/g, ' ');
                              toast({ title: "Date Validation Error", description: `${expLabel} must be later than ${effLabel}.`, variant: "destructive" });
                              return;
                            }
                          }

                          if (dataFormMode === "create") {
                            createDataRecordMutation.mutate(dataFormValues);
                          } else if (editingRecord) {
                            updateDataRecordMutation.mutate({ id: editingRecord.id, data: dataFormValues });
                          }
                        }}
                        disabled={createDataRecordMutation.isPending || updateDataRecordMutation.isPending || (dataFormMode === "create" && needsContextSelection)}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                        data-testid="button-save-data-record"
                      >
                        {(createDataRecordMutation.isPending || updateDataRecordMutation.isPending) ? "Saving..." : "Save Record"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowDataForm(false);
                          setEditingRecord(null);
                          setDataFormValues({});
                        }}
                        data-testid="button-cancel-data-form"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                  </>
                )}

                {/* Data Table */}
                {selectedDataEntity && entityDataLoading && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading data...</p>
                  </div>
                )}

                {selectedDataEntity && !entityDataLoading && entityDataResult?.records && (
                  <div className="space-y-4">
                    {/* Toolbar: Two-zone fixed layout */}
                    <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <p className="text-sm text-gray-500 whitespace-nowrap" data-testid="text-record-count">
                          {entityDataResult.total > 0 
                            ? `Showing ${((entityDataResult.page - 1) * entityDataResult.pageSize) + 1}-${Math.min(entityDataResult.page * entityDataResult.pageSize, entityDataResult.total)} of ${entityDataResult.total} records`
                            : "No records found"
                          }
                        </p>
                        <Button 
                          variant={showFilters ? "secondary" : "outline"} 
                          size="sm" 
                          onClick={() => setShowFilters(!showFilters)}
                          data-testid="button-toggle-filters"
                        >
                          <Filter className="h-4 w-4 mr-1" />
                          Filters {(useAdvancedFilters ? advancedFilters.length : Object.keys(dataFilters).filter(k => dataFilters[k]).length) > 0 && 
                            `(${useAdvancedFilters ? advancedFilters.length : Object.keys(dataFilters).filter(k => dataFilters[k]).length})`}
                        </Button>
                        {(useAdvancedFilters ? advancedFilters.length > 0 : Object.keys(dataFilters).filter(k => dataFilters[k]).length > 0) && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { 
                              setDataFilters({}); 
                              setAdvancedFilters([]);
                              setDataPage(1); 
                            }}
                            data-testid="button-clear-filters"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Clear Filters
                          </Button>
                        )}
                        <Button
                          onClick={async () => {
                            setDataFormMode("create");
                            setEditingRecord(null);
                            setCitySearchQuery('');
                            setCityPostalCode(null);
                            setCitySearchOpen(false);
                            const initValues: Record<string, any> = {};
                            const ecId = dataContextCompanyId || loginContext?.companyId;
                            if (ecId) initValues.company_id = ecId;
                            try {
                              const r = await fetch(`/api/entity-data/${selectedDataEntity}/next-code`, { credentials: "include" });
                              const d = await r.json();
                              if (d.code && d.codeColumn) initValues[d.codeColumn] = d.code;
                            } catch {}
                            setDataFormValues(initValues);
                            setShowDataForm(true);
                          }}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          data-testid="button-add-data-record-toolbar"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Record
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Popover open={columnsDropdownOpen} onOpenChange={setColumnsDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-[140px] justify-between" data-testid="button-columns-toggle">
                              <span className="flex items-center gap-1">
                                <Columns3 className="h-4 w-4" />
                                Columns ({String(visibleCount).padStart(2, '0')}/{String(totalCount).padStart(2, '0')})
                              </span>
                              <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" sideOffset={4} collisionPadding={16} className="w-[260px] p-0" data-testid="columns-dropdown">
                            <div className="p-3 border-b">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Visible Columns</span>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={showAllColumns} data-testid="button-show-all-columns">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Show All
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={resetColumns} data-testid="button-reset-columns">
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Reset
                                  </Button>
                                </div>
                              </div>
                              {visibleCount <= 1 && (
                                <p className="text-xs text-red-500 mt-1">At least one column must be visible</p>
                              )}
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-2">
                              {allDisplayColumns.map((col, idx) => {
                                const isVisible = hasCustomVisibility
                                  ? currentEntityVisibility[col.column_name] !== false
                                  : idx < DEFAULT_VISIBLE_COUNT;
                                return (
                                  <label
                                    key={col.column_name}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer text-sm"
                                    data-testid={`column-toggle-${col.column_name}`}
                                  >
                                    <Checkbox
                                      checked={isVisible}
                                      onCheckedChange={() => toggleColumnVisibility(col.column_name)}
                                      disabled={isVisible && visibleCount <= 1}
                                    />
                                    <span className="capitalize truncate">{col.column_name.replace(/_/g, ' ')}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Label htmlFor="page-size" className="text-sm text-gray-500 whitespace-nowrap">Per page:</Label>
                        <Select value={dataPageSize.toString()} onValueChange={(v) => { setDataPageSize(parseInt(v)); setDataPage(1); }}>
                          <SelectTrigger className="w-[80px]" data-testid="select-page-size">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => refetchEntityData()} data-testid="button-refresh-data">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Column Filters Panel */}
                    {showFilters && entityColumnsData?.columns && (
                      <div className="border rounded-lg p-4 bg-gray-50 dark:bg-slate-800">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-gray-500" />
                            <span className="font-medium text-sm">Filters</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-gray-500">Mode:</Label>
                            <Button
                              variant={useAdvancedFilters ? "outline" : "default"}
                              size="sm"
                              onClick={() => { setUseAdvancedFilters(false); setAdvancedFilters([]); }}
                              className="h-7 text-xs"
                              data-testid="button-simple-filters"
                            >
                              Simple
                            </Button>
                            <Button
                              variant={useAdvancedFilters ? "default" : "outline"}
                              size="sm"
                              onClick={() => { setUseAdvancedFilters(true); setDataFilters({}); }}
                              className="h-7 text-xs"
                              data-testid="button-advanced-filters"
                            >
                              Advanced
                            </Button>
                          </div>
                        </div>
                        
                        {/* Simple Filters */}
                        {!useAdvancedFilters && (
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {entityColumnsData.columns
                              .filter(col => !['created_by', 'updated_by', 'company_id', 'business_unit_id', 'location_id'].includes(col.column_name))
                              .slice(0, 8)
                              .map((col) => (
                                <div key={col.column_name} className="space-y-1">
                                  <Label className="text-xs text-gray-500 capitalize">{col.column_name.replace(/_/g, ' ')}</Label>
                                  <Input
                                    placeholder="Contains..."
                                    value={dataFilters[col.column_name] || ""}
                                    onChange={(e) => {
                                      setDataFilters(prev => ({ ...prev, [col.column_name]: e.target.value }));
                                      setDataPage(1);
                                    }}
                                    className="h-8 text-sm"
                                    data-testid={`input-filter-${col.column_name}`}
                                  />
                                </div>
                              ))}
                          </div>
                        )}
                        
                        {/* Advanced Filters */}
                        {useAdvancedFilters && (
                          <div className="space-y-3">
                            {/* AND/OR Toggle */}
                            <div className="flex items-center gap-3 pb-2 border-b">
                              <Label className="text-xs text-gray-500">Combine filters with:</Label>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant={filterLogic === "and" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setFilterLogic("and")}
                                  className="h-6 text-xs px-3"
                                  data-testid="button-logic-and"
                                >
                                  AND
                                </Button>
                                <Button
                                  variant={filterLogic === "or" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setFilterLogic("or")}
                                  className="h-6 text-xs px-3"
                                  data-testid="button-logic-or"
                                >
                                  OR
                                </Button>
                              </div>
                              <span className="text-xs text-gray-400 ml-2">
                                {filterLogic === "and" ? "All conditions must match" : "Any condition can match"}
                              </span>
                            </div>
                            
                            {/* Filter Rows */}
                            {advancedFilters.map((filter, idx) => {
                              const colDef = entityColumnsData.columns.find(c => c.column_name === filter.column);
                              const operators = getOperatorsForColumn(colDef?.data_type || "text");
                              return (
                                <div key={idx} className="flex items-center gap-2 flex-wrap">
                                  {/* Column Select */}
                                  <Select
                                    value={filter.column}
                                    onValueChange={(v) => {
                                      const newColDef = entityColumnsData.columns.find(c => c.column_name === v);
                                      const newOperators = getOperatorsForColumn(newColDef?.data_type || "text");
                                      const newFilters = [...advancedFilters];
                                      newFilters[idx] = { ...filter, column: v, operator: newOperators[0].value, value: "", value2: "" };
                                      setAdvancedFilters(newFilters);
                                    }}
                                  >
                                    <SelectTrigger className="w-[150px] h-8" data-testid={`select-filter-column-${idx}`}>
                                      <SelectValue placeholder="Column" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {entityColumnsData.columns
                                        .filter(col => !['created_by', 'updated_by', 'company_id', 'business_unit_id', 'location_id'].includes(col.column_name))
                                        .map((col) => (
                                          <SelectItem key={col.column_name} value={col.column_name}>
                                            {col.column_name.replace(/_/g, ' ')}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  {/* Operator Select */}
                                  <Select
                                    value={filter.operator}
                                    onValueChange={(v) => {
                                      const newFilters = [...advancedFilters];
                                      newFilters[idx] = { ...filter, operator: v as FilterOperator };
                                      setAdvancedFilters(newFilters);
                                    }}
                                  >
                                    <SelectTrigger className="w-[140px] h-8" data-testid={`select-filter-operator-${idx}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {operators.map((op) => (
                                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  {/* Value Input(s) */}
                                  {!["is_null", "not_null"].includes(filter.operator) && (
                                    <>
                                      <Input
                                        placeholder="Value"
                                        value={filter.value}
                                        onChange={(e) => {
                                          const newFilters = [...advancedFilters];
                                          newFilters[idx] = { ...filter, value: e.target.value };
                                          setAdvancedFilters(newFilters);
                                        }}
                                        className="w-[150px] h-8"
                                        data-testid={`input-filter-value-${idx}`}
                                      />
                                      {filter.operator === "between" && (
                                        <>
                                          <span className="text-xs text-gray-500">and</span>
                                          <Input
                                            placeholder="Value 2"
                                            value={filter.value2 || ""}
                                            onChange={(e) => {
                                              const newFilters = [...advancedFilters];
                                              newFilters[idx] = { ...filter, value2: e.target.value };
                                              setAdvancedFilters(newFilters);
                                            }}
                                            className="w-[150px] h-8"
                                            data-testid={`input-filter-value2-${idx}`}
                                          />
                                        </>
                                      )}
                                    </>
                                  )}
                                  
                                  {/* Remove Button */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setAdvancedFilters(advancedFilters.filter((_, i) => i !== idx));
                                      setDataPage(1);
                                    }}
                                    className="h-8 px-2 text-red-600 hover:text-red-700"
                                    data-testid={`button-remove-filter-${idx}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            })}
                            
                            {/* Add Filter Button */}
                            <div className="flex items-center gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const firstCol = entityColumnsData.columns.find(
                                    col => !['created_by', 'updated_by', 'company_id', 'business_unit_id', 'location_id'].includes(col.column_name)
                                  );
                                  if (firstCol) {
                                    const operators = getOperatorsForColumn(firstCol.data_type);
                                    setAdvancedFilters([...advancedFilters, {
                                      column: firstCol.column_name,
                                      operator: operators[0].value,
                                      value: ""
                                    }]);
                                  }
                                }}
                                className="h-8"
                                data-testid="button-add-filter"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Filter
                              </Button>
                              {advancedFilters.length > 0 && (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => { setDataPage(1); refetchEntityData(); }}
                                    className="h-8"
                                    disabled={advancedFilters.some(f => {
                                      if (['is_null', 'not_null'].includes(f.operator)) return false;
                                      if (!f.value.trim()) return true;
                                      if (f.operator === 'between' && !f.value2?.trim()) return true;
                                      if (['gt', 'gte', 'lt', 'lte', 'between'].includes(f.operator) && isNaN(parseFloat(f.value))) return true;
                                      if (f.operator === 'between' && isNaN(parseFloat(f.value2 || ''))) return true;
                                      return false;
                                    })}
                                    data-testid="button-apply-filters"
                                  >
                                    Apply Filters
                                  </Button>
                                  {advancedFilters.some(f => {
                                    if (['is_null', 'not_null'].includes(f.operator)) return false;
                                    if (!f.value.trim()) return true;
                                    if (f.operator === 'between' && !f.value2?.trim()) return true;
                                    if (['gt', 'gte', 'lt', 'lte', 'between'].includes(f.operator) && isNaN(parseFloat(f.value))) return true;
                                    return false;
                                  }) && (
                                    <span className="text-xs text-amber-600">Fill in all required values</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="border rounded-lg overflow-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                      <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b sticky top-0 z-20">
                          <tr className="bg-gray-50 dark:bg-slate-900 border-b-2 border-gray-200 dark:border-gray-700">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px] sticky left-0 bg-gray-50 dark:bg-slate-900 z-30">Actions</th>
                            {visibleColumns.map((col) => (
                                <th 
                                  key={col.column_name} 
                                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground capitalize whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 select-none bg-gray-50 dark:bg-slate-900"
                                  onClick={() => {
                                    if (dataSortColumn === col.column_name) {
                                      setDataSortDirection(dataSortDirection === 'asc' ? 'desc' : 'asc');
                                    } else {
                                      setDataSortColumn(col.column_name);
                                      setDataSortDirection('asc');
                                    }
                                    setDataPage(1);
                                  }}
                                  data-testid={`header-sort-${col.column_name}`}
                                >
                                  <div className="flex items-center gap-1">
                                    {col.column_name.replace(/_/g, ' ')}
                                    {dataSortColumn === col.column_name ? (
                                      dataSortDirection === 'asc' ? (
                                        <ChevronUp className="h-4 w-4 text-orange-700" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-orange-700" />
                                      )
                                    ) : (
                                      <ArrowUpDown className="h-3 w-3 text-gray-400" />
                                    )}
                                  </div>
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                          {entityDataResult.records.map((record, idx) => (
                            <tr key={record.id || idx} className="border-b transition-colors hover:bg-muted/50">
                              <td className="p-4 align-middle sticky left-0 bg-white dark:bg-slate-900 z-[5]">
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setDataFormMode("edit");
                                      setEditingRecord(record);
                                      setDataFormValues(record);
                                      setCitySearchQuery('');
                                      setCityPostalCode(null);
                                      setCitySearchOpen(false);
                                      setShowDataForm(true);
                                    }}
                                    data-testid={`button-edit-record-${record.id}`}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => setPendingDelete({ id: record.id, type: "data-record", name: getRecordLabel(record, selectedDataEntity) })}
                                    data-testid={`button-delete-record-${record.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                              {visibleColumns.map((col) => (
                                  <td key={col.column_name} className="p-4 align-middle max-w-[200px] truncate">
                                    {record[col.column_name] === null ? (
                                      <span className="text-gray-400 italic">null</span>
                                    ) : record[col.column_name] === true ? (
                                      <Badge variant="outline" className="bg-green-100">Yes</Badge>
                                    ) : record[col.column_name] === false ? (
                                      <Badge variant="outline" className="bg-gray-100">No</Badge>
                                    ) : typeof record[col.column_name] === 'object' ? (
                                      <span className="text-xs font-mono">{JSON.stringify(record[col.column_name])}</span>
                                    ) : isDateColumn(col.column_name, col.data_type) ? (
                                      formatUSDate(record[col.column_name])
                                    ) : (
                                      String(record[col.column_name])
                                    )}
                                  </td>
                                ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {entityDataResult.totalPages > 1 && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          Page {entityDataResult.page} of {entityDataResult.totalPages}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDataPage(1)}
                            disabled={entityDataResult.page === 1}
                            data-testid="button-first-page"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDataPage(p => Math.max(1, p - 1))}
                            disabled={entityDataResult.page === 1}
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          {/* Page numbers */}
                          {Array.from({ length: Math.min(5, entityDataResult.totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (entityDataResult.totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (entityDataResult.page <= 3) {
                              pageNum = i + 1;
                            } else if (entityDataResult.page >= entityDataResult.totalPages - 2) {
                              pageNum = entityDataResult.totalPages - 4 + i;
                            } else {
                              pageNum = entityDataResult.page - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={entityDataResult.page === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setDataPage(pageNum)}
                                className="w-8"
                                data-testid={`button-page-${pageNum}`}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDataPage(p => Math.min(entityDataResult.totalPages, p + 1))}
                            disabled={entityDataResult.page === entityDataResult.totalPages}
                            data-testid="button-next-page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDataPage(entityDataResult.totalPages)}
                            disabled={entityDataResult.page === entityDataResult.totalPages}
                            data-testid="button-last-page"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {entityDataResult.records.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No records found in this entity.</p>
                        <p className="text-sm">Click "Add Record" to create your first record.</p>
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>
            </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {pendingDelete && (
        <DeleteConfirmDialog
          itemName={pendingDelete.name}
          onConfirm={() => {
            switch (pendingDelete.type) {
              case "entity":
                deleteEntityMutation.mutate(pendingDelete.id);
                break;
              case "field":
                deleteFieldMutation.mutate(pendingDelete.id);
                break;
              case "endpoint":
                deleteEndpointMutation.mutate(pendingDelete.id);
                break;
              case "data-record":
                deleteDataRecordMutation.mutate(pendingDelete.id);
                break;
            }
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </MainLayout>
  );
}
