import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play, Database, ChevronRight, Clock, Rows3, Loader2, AlertTriangle,
  Copy, Trash2, Plus, X, Download, Search, Star, StarOff, Hash,
  TableIcon, Eye, MoreHorizontal, FileJson, FileSpreadsheet, BookmarkPlus,
  RotateCcw, Columns3, ArrowUpDown, ChevronDown, Filter, Braces,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  truncated: boolean;
  elapsed: number;
  isWrite: boolean;
  message: string;
}

interface TableInfo {
  name: string;
  columnCount: number;
  rowCount: number;
  columns: { column_name: string; data_type: string; is_nullable: string }[];
}

interface QueryTab {
  id: string;
  name: string;
  query: string;
  result: QueryResult | null;
  error: string | null;
  isExecuting: boolean;
}

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

interface HistoryItem {
  query: string;
  timestamp: Date;
  success: boolean;
  message: string;
  elapsed: number;
}

interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
  value2: string;
}

const OPERATORS = [
  { value: '=', label: '= equals', types: ['all'] },
  { value: '!=', label: '≠ not equals', types: ['all'] },
  { value: 'LIKE', label: 'contains', types: ['text'] },
  { value: 'NOT LIKE', label: 'not contains', types: ['text'] },
  { value: 'ILIKE_START', label: 'starts with', types: ['text'] },
  { value: 'ILIKE_END', label: 'ends with', types: ['text'] },
  { value: '>', label: '> greater than', types: ['number', 'date'] },
  { value: '<', label: '< less than', types: ['number', 'date'] },
  { value: '>=', label: '≥ greater or equal', types: ['number', 'date'] },
  { value: '<=', label: '≤ less or equal', types: ['number', 'date'] },
  { value: 'BETWEEN', label: 'between', types: ['number', 'date'] },
  { value: 'IN', label: 'in list', types: ['all'] },
  { value: 'IS NULL', label: 'is null', types: ['all'] },
  { value: 'IS NOT NULL', label: 'is not null', types: ['all'] },
];

function getColumnType(dataType: string): string {
  if (dataType.includes('int') || dataType.includes('numeric') || dataType.includes('decimal') || dataType.includes('real') || dataType.includes('serial') || dataType.includes('double') || dataType.includes('float')) return 'number';
  if (dataType.includes('timestamp') || dataType.includes('date')) return 'date';
  if (dataType.includes('bool')) return 'boolean';
  return 'text';
}

function getOperatorsForType(colType: string) {
  return OPERATORS.filter(op => op.types.includes('all') || op.types.includes(colType));
}

function buildFilterSQL(tableName: string, conditions: FilterCondition[], logic: 'AND' | 'OR', columns: { column_name: string; data_type: string }[], limit: number): string {
  const validConditions = conditions.filter(c => {
    if (!c.column || !c.operator) return false;
    if (['IS NULL', 'IS NOT NULL'].includes(c.operator)) return true;
    if (c.operator === 'BETWEEN') return c.value.trim() !== '' && c.value2.trim() !== '';
    return c.value.trim() !== '';
  });

  let sql = `SELECT * FROM ${tableName}`;

  if (validConditions.length > 0) {
    const whereClauses = validConditions.map((c, i) => {
      const col = `"${c.column}"`;
      const colInfo = columns.find(x => x.column_name === c.column);
      const colType = colInfo ? getColumnType(colInfo.data_type) : 'text';
      const needsQuote = colType === 'text' || colType === 'date';
      const q = (v: string) => needsQuote ? `'${v.replace(/'/g, "''")}'` : v;

      switch (c.operator) {
        case '=': return `${col} = ${q(c.value)}`;
        case '!=': return `${col} != ${q(c.value)}`;
        case 'LIKE': return `${col}::text ILIKE '%${c.value.replace(/'/g, "''")}%'`;
        case 'NOT LIKE': return `${col}::text NOT ILIKE '%${c.value.replace(/'/g, "''")}%'`;
        case 'ILIKE_START': return `${col}::text ILIKE '${c.value.replace(/'/g, "''")}%'`;
        case 'ILIKE_END': return `${col}::text ILIKE '%${c.value.replace(/'/g, "''")}'`;
        case '>': return `${col} > ${q(c.value)}`;
        case '<': return `${col} < ${q(c.value)}`;
        case '>=': return `${col} >= ${q(c.value)}`;
        case '<=': return `${col} <= ${q(c.value)}`;
        case 'BETWEEN': return `${col} BETWEEN ${q(c.value)} AND ${q(c.value2)}`;
        case 'IN': {
          const vals = c.value.split(',').map(v => q(v.trim())).join(', ');
          return `${col} IN (${vals})`;
        }
        case 'IS NULL': return `${col} IS NULL`;
        case 'IS NOT NULL': return `${col} IS NOT NULL`;
        default: return `${col} = ${q(c.value)}`;
      }
    });
    sql += `\nWHERE ${whereClauses.join(`\n  ${logic} `)}`;
  }

  sql += `\nLIMIT ${limit};`;
  return sql;
}

function genFilterId() {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const SAVED_QUERIES_KEY = "licenseiq_sql_saved_queries";
const HISTORY_KEY = "licenseiq_sql_history";

const QUICK_QUERIES = [
  { label: "All Tables", query: "SELECT table_name,\n  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as columns\nFROM information_schema.tables t\nWHERE table_schema = 'public' AND table_type = 'BASE TABLE'\nORDER BY table_name;" },
  { label: "Table Sizes", query: "SELECT\n  relname AS table_name,\n  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,\n  pg_size_pretty(pg_relation_size(c.oid)) AS data_size,\n  n_live_tup AS row_estimate\nFROM pg_class c\nJOIN pg_stat_user_tables s ON s.relname = c.relname\nWHERE c.relkind = 'r'\nORDER BY pg_total_relation_size(c.oid) DESC;" },
  { label: "Foreign Keys", query: "SELECT\n  tc.table_name,\n  kcu.column_name,\n  ccu.table_name AS foreign_table,\n  ccu.column_name AS foreign_column\nFROM information_schema.table_constraints tc\nJOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name\nJOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name\nWHERE tc.constraint_type = 'FOREIGN KEY'\nORDER BY tc.table_name;" },
  { label: "Indexes", query: "SELECT\n  tablename,\n  indexname,\n  indexdef\nFROM pg_indexes\nWHERE schemaname = 'public'\nORDER BY tablename, indexname;" },
  { label: "Active Connections", query: "SELECT\n  pid,\n  usename,\n  application_name,\n  client_addr,\n  state,\n  query_start,\n  LEFT(query, 100) AS current_query\nFROM pg_stat_activity\nWHERE datname = current_database()\nORDER BY query_start DESC;" },
  { label: "DB Size", query: "SELECT\n  pg_database.datname AS database_name,\n  pg_size_pretty(pg_database_size(pg_database.datname)) AS size\nFROM pg_database\nWHERE datname = current_database();" },
];

function generateTabId() {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function SqlConsole() {
  const [tabs, setTabs] = useState<QueryTab[]>([
    { id: generateTabId(), name: "Query 1", query: "SELECT table_name,\n  (SELECT COUNT(*) FROM information_schema.columns c\n   WHERE c.table_name = t.table_name AND c.table_schema = 'public') as columns\nFROM information_schema.tables t\nWHERE table_schema = 'public' AND table_type = 'BASE TABLE'\nORDER BY table_name;", result: null, error: null, isExecuting: false },
  ]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [tableSearch, setTableSearch] = useState("");
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]").map((h: any) => ({ ...h, timestamp: new Date(h.timestamp) })); } catch { return []; }
  });
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_QUERIES_KEY) || "[]"); } catch { return []; }
  });
  const [showSaved, setShowSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [resultPage, setResultPage] = useState(0);
  const [cellInspect, setCellInspect] = useState<{ col: string; row: number; value: any } | null>(null);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [filterTable, setFilterTable] = useState<string>('');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([{ id: genFilterId(), column: '', operator: '=', value: '', value2: '' }]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [filterLimit, setFilterLimit] = useState(100);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const ROWS_PER_PAGE = 100;

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const tablesQuery = useQuery<TableInfo[]>({ queryKey: ["/api/admin/sql-console/tables"] });

  const filteredTables = (tablesQuery.data || []).filter(t =>
    !tableSearch || t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(savedQueries));
  }, [savedQueries]);

  const updateTab = useCallback((id: string, updates: Partial<QueryTab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const executeMutation = useMutation({
    mutationFn: async ({ tabId, sql }: { tabId: string; sql: string }) => {
      updateTab(tabId, { isExecuting: true, error: null });
      const res = await apiRequest("POST", "/api/admin/sql-console", { query: sql });
      return { tabId, data: await res.json() as QueryResult, sql };
    },
    onSuccess: ({ tabId, data, sql }) => {
      updateTab(tabId, { result: data, error: null, isExecuting: false });
      setResultPage(0);
      setSortColumn(null);
      addHistory(sql, true, data.message, data.elapsed);
    },
    onError: (err: any, { tabId, sql }) => {
      const msg = err?.message || "Query execution failed";
      updateTab(tabId, { error: msg, result: null, isExecuting: false });
      addHistory(sql, false, msg, 0);
    },
  });

  const addHistory = (query: string, success: boolean, message: string, elapsed: number) => {
    setHistory(prev => [{ query: query.trim(), timestamp: new Date(), success, message, elapsed }, ...prev].slice(0, 100));
  };

  const executeCurrentTab = () => {
    const q = activeTab.query.trim();
    if (!q) return;
    const statements = q.split(/;\s*\n/).map(s => s.trim()).filter(s => s && s !== ";");
    if (statements.length > 1) {
      const last = statements[statements.length - 1].replace(/;$/, "").trim();
      executeMutation.mutate({ tabId: activeTab.id, sql: last });
      statements.slice(0, -1).forEach(stmt => {
        const s = stmt.replace(/;$/, "").trim();
        if (s) {
          apiRequest("POST", "/api/admin/sql-console", { query: s })
            .then(r => r.json())
            .then((data: any) => addHistory(s, true, data.message, data.elapsed))
            .catch((e: any) => addHistory(s, false, e?.message || "Failed", 0));
        }
      });
    } else {
      executeMutation.mutate({ tabId: activeTab.id, sql: q.replace(/;$/, "") });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      executeCurrentTab();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = activeTab.query;
        updateTab(activeTab.id, { query: val.substring(0, start) + "  " + val.substring(end) });
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
      }
    }
  };

  const addTab = () => {
    const newTab: QueryTab = { id: generateTabId(), name: `Query ${tabs.length + 1}`, query: "", result: null, error: null, isExecuting: false };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[Math.min(idx, newTabs.length - 1)].id);
    }
  };

  const renameTab = (id: string) => {
    const name = prompt("Tab name:", tabs.find(t => t.id === id)?.name);
    if (name) updateTab(id, { name });
  };

  const saveQuery = () => {
    const name = prompt("Save query as:", activeTab.name);
    if (!name) return;
    const saved: SavedQuery = { id: Date.now().toString(), name, query: activeTab.query, createdAt: new Date().toISOString() };
    setSavedQueries(prev => [saved, ...prev]);
    toast({ title: "Query saved", description: name });
  };

  const loadSavedQuery = (sq: SavedQuery) => {
    updateTab(activeTab.id, { query: sq.query, name: sq.name });
    setShowSaved(false);
  };

  const deleteSavedQuery = (id: string) => {
    setSavedQueries(prev => prev.filter(s => s.id !== id));
  };

  const handleTableClick = (tableName: string) => {
    const q = `SELECT * FROM ${tableName} LIMIT 100;`;
    updateTab(activeTab.id, { query: q });
    executeMutation.mutate({ tabId: activeTab.id, sql: `SELECT * FROM ${tableName} LIMIT 100` });
  };

  const handleDescribeTable = (tableName: string) => {
    const q = `SELECT column_name, data_type, is_nullable, column_default\nFROM information_schema.columns\nWHERE table_name = '${tableName}' AND table_schema = 'public'\nORDER BY ordinal_position;`;
    updateTab(activeTab.id, { query: q });
    executeMutation.mutate({ tabId: activeTab.id, sql: q });
  };

  const handleCountTable = (tableName: string) => {
    const q = `SELECT COUNT(*)::int AS total_rows FROM ${tableName};`;
    updateTab(activeTab.id, { query: q });
    executeMutation.mutate({ tabId: activeTab.id, sql: q.replace(";", "") });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const exportCSV = () => {
    if (!activeTab.result || activeTab.result.rows.length === 0) return;
    const { columns, rows } = activeTab.result;
    const header = columns.join(",");
    const csvRows = rows.map(r => columns.map(c => {
      const val = r[c];
      if (val === null) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(","));
    const csv = [header, ...csvRows].join("\n");
    downloadFile(csv, `query-result-${Date.now()}.csv`, "text/csv");
  };

  const exportJSON = () => {
    if (!activeTab.result || activeTab.result.rows.length === 0) return;
    const json = JSON.stringify(activeTab.result.rows, null, 2);
    downloadFile(json, `query-result-${Date.now()}.json`, "application/json");
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: filename });
  };

  const formatCellValue = (value: any): string => {
    if (value === null) return "NULL";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const getDataTypeIcon = (type: string) => {
    if (type.includes("int") || type.includes("numeric") || type.includes("decimal") || type.includes("serial")) return "#";
    if (type.includes("text") || type.includes("char") || type.includes("varchar")) return "Aa";
    if (type.includes("bool")) return "✓";
    if (type.includes("json")) return "{}";
    if (type.includes("timestamp") || type.includes("date")) return "📅";
    if (type.includes("uuid")) return "🔑";
    return "·";
  };

  const getSortedRows = () => {
    if (!activeTab.result) return [];
    let rows = [...activeTab.result.rows];
    if (sortColumn) {
      rows.sort((a, b) => {
        const av = a[sortColumn], bv = b[sortColumn];
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  };

  const sortedRows = getSortedRows();
  const pagedRows = sortedRows.slice(resultPage * ROWS_PER_PAGE, (resultPage + 1) * ROWS_PER_PAGE);
  const totalPages = Math.ceil(sortedRows.length / ROWS_PER_PAGE);

  const toggleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
  };

  const filterTableInfo = (tablesQuery.data || []).find(t => t.name === filterTable);
  const filterColumns = filterTableInfo?.columns || [];

  const addFilterCondition = () => {
    setFilterConditions(prev => [...prev, { id: genFilterId(), column: '', operator: '=', value: '', value2: '' }]);
  };

  const removeFilterCondition = (id: string) => {
    setFilterConditions(prev => prev.length <= 1 ? prev : prev.filter(c => c.id !== id));
  };

  const updateFilterCondition = (id: string, updates: Partial<FilterCondition>) => {
    setFilterConditions(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const resetFilters = () => {
    setFilterConditions([{ id: genFilterId(), column: '', operator: '=', value: '', value2: '' }]);
    setFilterLogic('AND');
    if (filterTable) {
      const q = `SELECT * FROM ${filterTable} LIMIT ${filterLimit};`;
      updateTab(activeTab.id, { query: q });
      executeMutation.mutate({ tabId: activeTab.id, sql: `SELECT * FROM ${filterTable} LIMIT ${filterLimit}` });
    }
  };

  const openFilterBuilder = (tableName: string) => {
    setFilterTable(tableName);
    setFilterConditions([{ id: genFilterId(), column: '', operator: '=', value: '', value2: '' }]);
    setFilterLogic('AND');
    setShowFilterBuilder(true);
  };

  const filterDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!showFilterBuilder || !filterTable) return;
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      const sql = buildFilterSQL(filterTable, filterConditions, filterLogic, filterColumns, filterLimit);
      updateTab(activeTab.id, { query: sql });
      executeMutation.mutate({ tabId: activeTab.id, sql: sql.replace(/;$/, '') });
    }, 400);
    return () => { if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current); };
  }, [filterConditions, filterLogic, filterTable, filterLimit, showFilterBuilder]);

  const activeFilterCount = filterConditions.filter(c => {
    if (!c.column || !c.operator) return false;
    if (['IS NULL', 'IS NOT NULL'].includes(c.operator)) return true;
    if (c.operator === 'BETWEEN') return c.value.trim() !== '' && c.value2.trim() !== '';
    return c.value.trim() !== '';
  }).length;

  return (
    <MainLayout title="SQL Console" description="Database query & administration">
      <div className="grid grid-cols-12 gap-3 h-[calc(100vh-120px)]">
        {/* Left Sidebar */}
        <div className="col-span-3 overflow-hidden flex flex-col gap-2">
          {/* Table Browser */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="pb-2 pt-3 px-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  Tables
                  {tablesQuery.data && <Badge variant="secondary" className="text-[10px] h-4 px-1">{filteredTables.length}</Badge>}
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => tablesQuery.refetch()} data-testid="btn-refresh-tables">
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
              <div className="relative mt-1.5">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search tables..."
                  className="h-7 text-xs pl-7"
                  data-testid="input-table-search"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-2 pb-2">
                {tablesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-0">
                    {filteredTables.map((table) => (
                      <Collapsible key={table.name} open={expandedTable === table.name} onOpenChange={(open) => setExpandedTable(open ? table.name : null)}>
                        <div className="flex items-center group">
                          <CollapsibleTrigger className="flex-1" data-testid={`table-${table.name}`}>
                            <div className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted text-left w-full">
                              <div className="flex items-center gap-1 min-w-0">
                                <ChevronRight className={`h-3 w-3 flex-shrink-0 transition-transform ${expandedTable === table.name ? "rotate-90" : ""}`} />
                                <TableIcon className="h-3 w-3 flex-shrink-0 text-orange-500" />
                                <span className="text-[11px] font-mono truncate">{table.name}</span>
                              </div>
                              <Badge variant="outline" className="text-[9px] px-1 h-3.5 font-mono">{table.rowCount}</Badge>
                            </div>
                          </CollapsibleTrigger>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100" data-testid={`btn-menu-${table.name}`}>
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => handleTableClick(table.name)} data-testid={`btn-select-${table.name}`}>
                                <Eye className="h-3 w-3 mr-2" /> SELECT * (100 rows)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openFilterBuilder(table.name)} data-testid={`btn-filter-${table.name}`}>
                                <Filter className="h-3 w-3 mr-2" /> Visual Filter Builder
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDescribeTable(table.name)}>
                                <Columns3 className="h-3 w-3 mr-2" /> Describe Table
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCountTable(table.name)}>
                                <Hash className="h-3 w-3 mr-2" /> Count Rows
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => copyToClipboard(`SELECT * FROM ${table.name}\nWHERE `)}>
                                <Copy className="h-3 w-3 mr-2" /> Copy SELECT template
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyToClipboard(`INSERT INTO ${table.name} (${table.columns.map(c => c.column_name).join(", ")})\nVALUES ();`)}>
                                <Copy className="h-3 w-3 mr-2" /> Copy INSERT template
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <CollapsibleContent>
                          <div className="ml-5 pl-2 border-l space-y-0 py-0.5">
                            {table.columns.map((col) => (
                              <Tooltip key={col.column_name}>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-between py-0.5 px-1 text-[10px] hover:bg-muted/50 rounded cursor-default"
                                    onClick={() => copyToClipboard(col.column_name)}>
                                    <div className="flex items-center gap-1 min-w-0">
                                      <span className="text-[9px] text-muted-foreground/70 w-3 text-center flex-shrink-0">{getDataTypeIcon(col.data_type)}</span>
                                      <span className="font-mono text-muted-foreground truncate">{col.column_name}</span>
                                    </div>
                                    <span className="text-muted-foreground/50 flex-shrink-0 ml-1 text-[9px]">{col.data_type}{col.is_nullable === "NO" ? " !" : ""}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="text-xs">
                                  <p className="font-mono">{col.column_name}</p>
                                  <p className="text-muted-foreground">{col.data_type} {col.is_nullable === "NO" ? "NOT NULL" : "NULLABLE"}</p>
                                  <p className="text-muted-foreground/70 text-[10px]">Click to copy</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Quick Queries */}
          <Card className="flex-shrink-0">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Play className="h-3 w-3" /> Quick Queries
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="space-y-0.5">
                {QUICK_QUERIES.map((qq, i) => (
                  <Button key={i} variant="ghost" size="sm" className="w-full justify-start h-6 text-[11px] px-2"
                    onClick={() => { updateTab(activeTab.id, { query: qq.query }); executeMutation.mutate({ tabId: activeTab.id, sql: qq.query.replace(/;$/, "") }); }}
                    data-testid={`btn-quick-${i}`}>
                    {qq.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="col-span-9 flex flex-col gap-2 overflow-hidden">
          {/* Tab Bar */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg px-1 py-1 flex-shrink-0">
            <ScrollArea className="flex-1" orientation="horizontal">
              <div className="flex items-center gap-0.5">
                {tabs.map((tab) => (
                  <div key={tab.id}
                    className={`flex items-center gap-1 px-3 py-1 rounded text-xs cursor-pointer group transition-colors ${tab.id === activeTabId ? "bg-background shadow-sm font-medium" : "hover:bg-background/50 text-muted-foreground"}`}
                    onClick={() => setActiveTabId(tab.id)}
                    onDoubleClick={() => renameTab(tab.id)}
                    data-testid={`tab-${tab.id}`}>
                    {tab.isExecuting && <Loader2 className="h-3 w-3 animate-spin text-orange-500" />}
                    {tab.result && !tab.isExecuting && <div className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                    {tab.error && !tab.isExecuting && <div className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                    <span className="truncate max-w-[100px]">{tab.name}</span>
                    {tabs.length > 1 && (
                      <X className="h-3 w-3 opacity-0 group-hover:opacity-100 hover:text-destructive" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={addTab} data-testid="btn-add-tab">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Query Editor */}
          <Card className="flex-shrink-0">
            <CardContent className="pt-3 pb-2 px-3">
              <textarea
                ref={textareaRef}
                value={activeTab.query}
                onChange={(e) => updateTab(activeTab.id, { query: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full h-28 p-3 font-mono text-[13px] bg-muted/30 border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-orange-500/30 leading-relaxed"
                placeholder="Enter SQL query... (Ctrl+Enter to execute, Tab for indent)"
                spellCheck={false}
                data-testid="input-sql-query"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <Button onClick={executeCurrentTab} disabled={activeTab.isExecuting || !activeTab.query.trim()} className="bg-orange-600 hover:bg-orange-700 h-8" data-testid="btn-execute-query">
                    {activeTab.isExecuting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                    Execute
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => updateTab(activeTab.id, { query: "", result: null, error: null })} data-testid="btn-clear">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={saveQuery} data-testid="btn-save-query">
                    <BookmarkPlus className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                  <Button variant={showSaved ? "secondary" : "outline"} size="sm" className="h-8" onClick={() => { setShowSaved(!showSaved); setShowHistory(false); }}>
                    <Star className="h-3.5 w-3.5 mr-1" /> Saved{savedQueries.length > 0 && ` (${savedQueries.length})`}
                  </Button>
                  <Button variant={showHistory ? "secondary" : "outline"} size="sm" className="h-8" onClick={() => { setShowHistory(!showHistory); setShowSaved(false); }}>
                    <Clock className="h-3.5 w-3.5 mr-1" /> History{history.length > 0 && ` (${history.length})`}
                  </Button>
                  <span className="text-[10px] text-muted-foreground ml-1">Ctrl+Enter to run</span>
                </div>
                {activeTab.result && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Rows3 className="h-3 w-3" />{activeTab.result.message}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{activeTab.result.elapsed}ms</span>
                    {activeTab.result.truncated && <Badge variant="destructive" className="text-[10px]">1000 limit</Badge>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7"><Download className="h-3 w-3 mr-1" /> Export</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={exportCSV} data-testid="btn-export-csv"><FileSpreadsheet className="h-3 w-3 mr-2" /> Export CSV</DropdownMenuItem>
                        <DropdownMenuItem onClick={exportJSON} data-testid="btn-export-json"><FileJson className="h-3 w-3 mr-2" /> Export JSON</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => copyToClipboard(JSON.stringify(activeTab.result?.rows, null, 2))}><Copy className="h-3 w-3 mr-2" /> Copy as JSON</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Visual Filter Builder */}
          {showFilterBuilder && (
            <Card className="flex-shrink-0 border-orange-200 dark:border-orange-900/50" data-testid="filter-builder-panel">
              <CardHeader className="py-2 px-3 flex-row items-center justify-between border-b bg-orange-50/50 dark:bg-orange-950/20">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-orange-600" />
                  <span className="text-xs font-medium">Visual Filter</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono border-orange-300 text-orange-700">{filterTable}</Badge>
                  {activeFilterCount > 0 && (
                    <Badge className="text-[10px] h-4 px-1.5 bg-orange-600">{activeFilterCount} active</Badge>
                  )}
                  <div className="flex items-center gap-0.5 ml-2 bg-muted rounded-md p-0.5">
                    <Button
                      variant={filterLogic === 'AND' ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-5 text-[10px] px-2 ${filterLogic === 'AND' ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                      onClick={() => setFilterLogic('AND')}
                      data-testid="btn-filter-and"
                    >AND</Button>
                    <Button
                      variant={filterLogic === 'OR' ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-5 text-[10px] px-2 ${filterLogic === 'OR' ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                      onClick={() => setFilterLogic('OR')}
                      data-testid="btn-filter-or"
                    >OR</Button>
                  </div>
                  <Select value={String(filterLimit)} onValueChange={(v) => setFilterLimit(Number(v))}>
                    <SelectTrigger className="h-5 w-20 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                      <SelectItem value="250">250 rows</SelectItem>
                      <SelectItem value="500">500 rows</SelectItem>
                      <SelectItem value="1000">1000 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => {
                        const sql = buildFilterSQL(filterTable, filterConditions, filterLogic, filterColumns, filterLimit);
                        copyToClipboard(sql);
                      }} data-testid="btn-copy-filter-sql">
                        <Braces className="h-3 w-3 mr-1" /> SQL
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p className="text-xs">Copy generated SQL</p></TooltipContent>
                  </Tooltip>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={resetFilters} data-testid="btn-reset-filters">
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowFilterBuilder(false)} data-testid="btn-close-filter">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-3 py-2">
                <div className="space-y-1.5">
                  {filterConditions.map((condition, idx) => {
                    const colInfo = filterColumns.find(c => c.column_name === condition.column);
                    const colType = colInfo ? getColumnType(colInfo.data_type) : 'text';
                    const availableOps = getOperatorsForType(colType);
                    const needsValue = !['IS NULL', 'IS NOT NULL'].includes(condition.operator);
                    const needsValue2 = condition.operator === 'BETWEEN';

                    return (
                      <div key={condition.id} className="flex items-center gap-1.5" data-testid={`filter-row-${idx}`}>
                        {idx > 0 && (
                          <span className="text-[10px] text-orange-600 font-medium w-8 text-center flex-shrink-0">{filterLogic}</span>
                        )}
                        {idx === 0 && <span className="text-[10px] text-muted-foreground w-8 text-center flex-shrink-0">Where</span>}

                        <Select value={condition.column} onValueChange={(v) => updateFilterCondition(condition.id, { column: v, value: '', value2: '' })}>
                          <SelectTrigger className="h-7 w-44 text-[11px] font-mono" data-testid={`filter-col-${idx}`}>
                            <SelectValue placeholder="Column..." />
                          </SelectTrigger>
                          <SelectContent>
                            {filterColumns.map(col => (
                              <SelectItem key={col.column_name} value={col.column_name}>
                                <span className="font-mono text-[11px]">{col.column_name}</span>
                                <span className="text-muted-foreground ml-1 text-[9px]">{col.data_type}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={condition.operator} onValueChange={(v) => updateFilterCondition(condition.id, { operator: v })}>
                          <SelectTrigger className="h-7 w-36 text-[11px]" data-testid={`filter-op-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableOps.map(op => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {needsValue && (
                          <Input
                            value={condition.value}
                            onChange={(e) => updateFilterCondition(condition.id, { value: e.target.value })}
                            placeholder={condition.operator === 'IN' ? "val1, val2, ..." : "Value..."}
                            className="h-7 text-[11px] font-mono flex-1 min-w-[120px]"
                            data-testid={`filter-val-${idx}`}
                          />
                        )}

                        {needsValue2 && (
                          <>
                            <span className="text-[10px] text-muted-foreground">and</span>
                            <Input
                              value={condition.value2}
                              onChange={(e) => updateFilterCondition(condition.id, { value2: e.target.value })}
                              placeholder="Value 2..."
                              className="h-7 text-[11px] font-mono w-28"
                              data-testid={`filter-val2-${idx}`}
                            />
                          </>
                        )}

                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFilterCondition(condition.id)}
                          disabled={filterConditions.length <= 1}
                          data-testid={`btn-remove-filter-${idx}`}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={addFilterCondition} data-testid="btn-add-filter-condition">
                    <Plus className="h-3 w-3 mr-1" /> Add condition
                  </Button>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {activeTab.result && (
                      <span className="flex items-center gap-1">
                        <Rows3 className="h-3 w-3" />
                        <span className="font-medium text-foreground">{activeTab.result.rows.length}</span>
                        {activeFilterCount > 0 ? ' filtered' : ''} rows
                        {activeTab.result.truncated && <Badge variant="outline" className="text-[9px] h-3.5 px-1">limit reached</Badge>}
                      </span>
                    )}
                    {activeTab.isExecuting && <Loader2 className="h-3 w-3 animate-spin text-orange-500" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saved Queries Panel */}
          {showSaved && savedQueries.length > 0 && (
            <Card className="flex-shrink-0 max-h-36">
              <CardContent className="p-2">
                <ScrollArea className="max-h-28">
                  <div className="space-y-0.5">
                    {savedQueries.map((sq) => (
                      <div key={sq.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted group text-xs">
                        <Star className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                        <span className="font-medium truncate w-28">{sq.name}</span>
                        <span className="font-mono text-muted-foreground truncate flex-1">{sq.query.substring(0, 80)}</span>
                        <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => loadSavedQuery(sq)}>Load</Button>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteSavedQuery(sq.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* History Panel */}
          {showHistory && history.length > 0 && (
            <Card className="flex-shrink-0 max-h-36">
              <CardContent className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Recent queries</span>
                  <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => setHistory([])}>Clear all</Button>
                </div>
                <ScrollArea className="max-h-24">
                  <div className="space-y-0.5">
                    {history.slice(0, 30).map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 py-0.5 px-2 rounded hover:bg-muted cursor-pointer group text-[11px]"
                        onClick={() => { updateTab(activeTab.id, { query: item.query }); setShowHistory(false); }}
                        data-testid={`history-${i}`}>
                        <Badge variant={item.success ? "default" : "destructive"} className="text-[8px] px-1 h-3.5 flex-shrink-0">
                          {item.success ? "OK" : "ERR"}
                        </Badge>
                        <span className="font-mono truncate flex-1">{item.query}</span>
                        <span className="text-muted-foreground/60 flex-shrink-0">{item.elapsed}ms</span>
                        <Button size="sm" variant="ghost" className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); copyToClipboard(item.query); }}>
                          <Copy className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
              {activeTab.error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive border-b flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <pre className="text-xs font-mono whitespace-pre-wrap">{activeTab.error}</pre>
                </div>
              )}
              {activeTab.result && activeTab.result.rows.length > 0 ? (
                <>
                  <div className="flex-1 overflow-auto">
                    <div className="min-w-max">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-10 text-center text-[10px] sticky top-0 bg-muted/30">#</TableHead>
                            {activeTab.result.columns.map((col) => (
                              <TableHead key={col} className="text-[11px] font-mono whitespace-nowrap sticky top-0 bg-muted/30 cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleSort(col)}>
                                <div className="flex items-center gap-1">
                                  {col}
                                  {sortColumn === col && <ArrowUpDown className="h-3 w-3 text-orange-500" />}
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedRows.map((row, i) => (
                            <TableRow key={i} className="hover:bg-muted/30">
                              <TableCell className="text-center text-[10px] text-muted-foreground">{resultPage * ROWS_PER_PAGE + i + 1}</TableCell>
                              {activeTab.result!.columns.map((col) => {
                                const val = formatCellValue(row[col]);
                                const isNull = row[col] === null;
                                const isLong = val.length > 50;
                                return (
                                  <TableCell key={col}
                                    className={`text-[11px] font-mono max-w-[250px] truncate cursor-default ${isNull ? "text-muted-foreground/50 italic" : ""}`}
                                    title={val}
                                    onClick={() => isLong && setCellInspect({ col, row: resultPage * ROWS_PER_PAGE + i, value: row[col] })}>
                                    {val.length > 80 ? val.substring(0, 80) + "..." : val}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/20 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        Showing {resultPage * ROWS_PER_PAGE + 1}-{Math.min((resultPage + 1) * ROWS_PER_PAGE, sortedRows.length)} of {sortedRows.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" disabled={resultPage === 0} onClick={() => setResultPage(0)}>First</Button>
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" disabled={resultPage === 0} onClick={() => setResultPage(p => p - 1)}>Prev</Button>
                        <span className="text-[10px] px-2">{resultPage + 1} / {totalPages}</span>
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" disabled={resultPage >= totalPages - 1} onClick={() => setResultPage(p => p + 1)}>Next</Button>
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" disabled={resultPage >= totalPages - 1} onClick={() => setResultPage(totalPages - 1)}>Last</Button>
                      </div>
                    </div>
                  )}
                </>
              ) : activeTab.result && activeTab.result.rows.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Rows3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{activeTab.result.isWrite ? activeTab.result.message : "No rows returned"}</p>
                  </div>
                </div>
              ) : !activeTab.error ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Database className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Run a query to see results</p>
                    <p className="text-xs mt-1">Click a table on the left or use a Quick Query to get started</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Ctrl+Enter to execute • Tab for indent • Double-click tab to rename</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Cell Inspector Modal */}
          {cellInspect && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setCellInspect(null)}>
              <Card className="w-[600px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <CardHeader className="py-2 px-4 flex-row items-center justify-between">
                  <CardTitle className="text-sm font-mono">{cellInspect.col} (Row {cellInspect.row + 1})</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6" onClick={() => copyToClipboard(formatCellValue(cellInspect.value))}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setCellInspect(null)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[60vh]">
                    <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words bg-muted/30">
                      {typeof cellInspect.value === "object" ? JSON.stringify(cellInspect.value, null, 2) : formatCellValue(cellInspect.value)}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
