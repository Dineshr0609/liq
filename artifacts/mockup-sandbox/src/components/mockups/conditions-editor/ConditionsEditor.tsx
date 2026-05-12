import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  X,
  GripVertical,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Layers,
  Info,
} from "lucide-react";

type Op = "equals" | "in" | "not_in" | "contains" | "between";
type IncExc = "include" | "exclude";

type Condition = {
  id: string;
  field: string;
  op: Op;
  value: string;
  group: string;
  type: IncExc;
  mapping: { status: "mapped" | "suggested" | "unmapped"; target?: string; confidence?: number };
};

const FIELD_OPTIONS = [
  { code: "product", label: "Product", master: "products" },
  { code: "product_category", label: "Product Category", master: "product_classifications" },
  { code: "partner", label: "Partner", master: "partner_master" },
  { code: "customer", label: "Customer", master: "customers" },
  { code: "territory", label: "Territory", master: "territory_master" },
];

const OP_LABEL: Record<Op, string> = {
  equals: "is",
  in: "is one of",
  not_in: "is not one of",
  contains: "contains",
  between: "between",
};

const SEED: Condition[] = [
  {
    id: "c1", field: "product", op: "in",
    value: "SoundPro Wireless Headphones - Black",
    group: "G1", type: "include",
    mapping: { status: "mapped", target: "ITEM-1042 · SoundPro WH Black", confidence: 0.98 },
  },
  {
    id: "c2", field: "product", op: "in",
    value: "SoundPro Wireless Headphones - White",
    group: "G1", type: "include",
    mapping: { status: "mapped", target: "ITEM-1043 · SoundPro WH White", confidence: 0.97 },
  },
  {
    id: "c3", field: "territory", op: "equals",
    value: "North America",
    group: "G1", type: "include",
    mapping: { status: "mapped", target: "TERR-NA · North America", confidence: 1.0 },
  },
  {
    id: "c4", field: "product_category", op: "in",
    value: "Premium Audio Accessories",
    group: "G2", type: "include",
    mapping: { status: "suggested", target: "CAT-AUD-PREM · Premium Audio", confidence: 0.82 },
  },
  {
    id: "c5", field: "customer", op: "equals",
    value: "Acme Retail Group",
    group: "G2", type: "include",
    mapping: { status: "unmapped" },
  },
];

const GROUP_COLORS: Record<string, string> = {
  G1: "bg-orange-50 border-orange-300",
  G2: "bg-blue-50 border-blue-300",
  G3: "bg-violet-50 border-violet-300",
};
const GROUP_DOT: Record<string, string> = {
  G1: "bg-orange-500",
  G2: "bg-blue-500",
  G3: "bg-violet-500",
};

function MappingPill({ m }: { m: Condition["mapping"] }) {
  if (m.status === "mapped")
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" />
        {m.target}
        <span className="text-emerald-500">· {Math.round((m.confidence ?? 0) * 100)}%</span>
      </span>
    );
  if (m.status === "suggested")
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
        <Sparkles className="w-3 h-3" />
        liQ AI suggests: {m.target}
        <span className="text-amber-600">· {Math.round((m.confidence ?? 0) * 100)}%</span>
        <button className="ml-1 underline hover:text-amber-900">Confirm</button>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
      <AlertCircle className="w-3 h-3" />
      Unmapped <button className="ml-1 underline hover:text-red-900">Map now</button>
    </span>
  );
}

function ConditionRow({ c, onChange, onDelete }: {
  c: Condition;
  onChange: (next: Condition) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-[24px_140px_120px_1fr_110px_36px_28px] gap-2 items-start py-2">
      <div className="pt-2 text-gray-400 cursor-grab">
        <GripVertical className="w-4 h-4" />
      </div>
      <Select value={c.field} onValueChange={(v) => onChange({ ...c, field: v })}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {FIELD_OPTIONS.map((f) => (
            <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={c.op} onValueChange={(v) => onChange({ ...c, op: v as Op })}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(OP_LABEL) as Op[]).map((op) => (
            <SelectItem key={op} value={op}>{OP_LABEL[op]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="space-y-1">
        <Input
          className="h-9"
          value={c.value}
          onChange={(e) => onChange({ ...c, value: e.target.value })}
          placeholder="value from contract text"
        />
        <MappingPill m={c.mapping} />
      </div>
      <Select value={c.group} onValueChange={(v) => onChange({ ...c, group: v })}>
        <SelectTrigger className="h-9">
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${GROUP_DOT[c.group] ?? "bg-gray-400"}`} />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="G1"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500" />Group 1</span></SelectItem>
          <SelectItem value="G2"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />Group 2</span></SelectItem>
          <SelectItem value="G3"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-violet-500" />Group 3</span></SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant={c.type === "include" ? "default" : "outline"}
        size="sm"
        className={c.type === "include" ? "h-9 bg-emerald-600 hover:bg-emerald-700" : "h-9 text-red-600"}
        onClick={() => onChange({ ...c, type: c.type === "include" ? "exclude" : "include" })}
        title="Toggle include / exclude"
      >
        {c.type === "include" ? "✓" : "✕"}
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-red-600" onClick={onDelete}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function GroupBlock({
  groupId,
  conditions,
  onChange,
  onDelete,
  onAdd,
}: {
  groupId: string;
  conditions: Condition[];
  onChange: (c: Condition) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className={`rounded-lg border-2 ${GROUP_COLORS[groupId] ?? "bg-gray-50 border-gray-300"} p-3`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${GROUP_DOT[groupId]}`} />
          <span className="font-semibold text-sm">Group {groupId.slice(1)}</span>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">All must match · AND</Badge>
        </div>
        <span className="text-xs text-gray-500">{conditions.length} condition{conditions.length === 1 ? "" : "s"}</span>
      </div>
      <Separator className="my-2" />
      <div className="divide-y divide-white/60">
        {conditions.map((c) => (
          <ConditionRow key={c.id} c={c} onChange={onChange} onDelete={() => onDelete(c.id)} />
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-2 text-xs h-7" onClick={onAdd}>
        <Plus className="w-3 h-3 mr-1" /> Add condition to this group
      </Button>
    </div>
  );
}

export function ConditionsEditor() {
  const [conditions, setConditions] = useState<Condition[]>(SEED);

  const groups = Array.from(new Set(conditions.map((c) => c.group))).sort();

  const update = (next: Condition) =>
    setConditions((cs) => cs.map((c) => (c.id === next.id ? next : c)));
  const remove = (id: string) =>
    setConditions((cs) => cs.filter((c) => c.id !== id));
  const addToGroup = (g: string) =>
    setConditions((cs) => [
      ...cs,
      { id: `c${Date.now()}`, field: "product", op: "in", value: "", group: g, type: "include", mapping: { status: "unmapped" } },
    ]);
  const addGroup = () => {
    const next = `G${groups.length + 1}`;
    setConditions((cs) => [
      ...cs,
      { id: `c${Date.now()}`, field: "product", op: "in", value: "", group: next, type: "include", mapping: { status: "unmapped" } },
    ]);
  };

  const unmappedCount = conditions.filter((c) => c.mapping.status === "unmapped").length;
  const suggestedCount = conditions.filter((c) => c.mapping.status === "suggested").length;
  const mappedCount = conditions.filter((c) => c.mapping.status === "mapped").length;

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-[1080px] mx-auto">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold">Conditions</h2>
              <Badge variant="outline" className="text-[11px]">Rule: Quarterly Volume Rebate – Tiered T3</Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Conditions inside the same group are joined with <strong>AND</strong>. Different groups are joined with <strong>OR</strong>.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">{mappedCount} mapped</span>
            <span className="px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">{suggestedCount} suggested</span>
            <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">{unmappedCount} unmapped</span>
          </div>
        </div>

        <Card className="bg-orange-50/40 border-orange-200 mb-4">
          <CardContent className="py-3 px-4 flex items-start gap-2">
            <Info className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
            <div className="text-xs text-orange-900">
              Effective logic preview:&nbsp;
              <code className="bg-white px-1.5 py-0.5 rounded border border-orange-200 text-[11px]">
                (product IN [SoundPro WH Black, SoundPro WH White] AND territory = North America)
                {"  OR  "}
                (product_category IN [Premium Audio Accessories] AND customer = Acme Retail Group)
              </code>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {groups.map((g, idx) => (
            <div key={g}>
              <GroupBlock
                groupId={g}
                conditions={conditions.filter((c) => c.group === g)}
                onChange={update}
                onDelete={remove}
                onAdd={() => addToGroup(g)}
              />
              {idx < groups.length - 1 && (
                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 border-t border-dashed border-gray-300" />
                  <Badge className="bg-gray-700 hover:bg-gray-700 text-[10px] uppercase tracking-wider">OR</Badge>
                  <div className="flex-1 border-t border-dashed border-gray-300" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={addGroup}>
            <Plus className="w-4 h-4 mr-1" /> Add OR group
          </Button>
          <Button variant="ghost" size="sm" className="text-orange-700">
            <Sparkles className="w-4 h-4 mr-1" /> Auto-map all suggested
          </Button>
        </div>

        <Separator className="my-6" />

        <div className="text-[11px] text-gray-500 space-y-1">
          <div><strong>Storage:</strong> each row → one <code>contract_qualifiers</code> row. <code>qualifier_field</code> = field code, <code>qualifier_value</code> = value, <code>operator</code> = op, <code>qualifier_type</code> = include/exclude, <code>qualifier_logic</code> = group id (G1/G2/…).</div>
          <div><strong>AI mapping:</strong> per-row → resolves <code>qualifier_value</code> against the field's master table; persists link marker in <code>notes</code>.</div>
          <div><strong>Verify gate:</strong> a rule cannot be marked Verified while any condition is Unmapped.</div>
        </div>
      </div>
    </div>
  );
}
