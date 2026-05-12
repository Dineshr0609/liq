import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

const CUSTOM_KEY = "__custom__";

interface PickerProps {
  value: string;
  onChange: (v: string) => void;
  testId?: string;
  placeholder?: string;
}

type PeriodRow = { id: string | null; label: string; status: string };

export function PeriodPicker({ value, onChange, testId, placeholder }: PickerProps) {
  const periodsQ = useQuery<{ periods: PeriodRow[]; source: string }>({
    queryKey: ["/api/finance/periods"],
  });
  const periods = periodsQ.data?.periods ?? [];
  const labels = periods.map(p => p.label);
  const inList = !!value && labels.includes(value);
  const [mode, setMode] = useState<"select" | "custom">(value && !inList && !periodsQ.isLoading ? "custom" : "select");

  useEffect(() => {
    if (!periodsQ.isLoading && value && !labels.includes(value)) setMode("custom");
  }, [value, labels, periodsQ.isLoading]);

  if (mode === "custom") {
    return (
      <div className="flex items-center gap-1">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "e.g. Apr 2026 or 2026-Q1"} data-testid={testId ? `${testId}-input` : undefined} />
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[11px]" onClick={() => { setMode("select"); onChange(""); }}>From list</Button>
      </div>
    );
  }

  return (
    <Select
      value={inList ? value : ""}
      onValueChange={(v) => { if (v === CUSTOM_KEY) { setMode("custom"); onChange(""); return; } onChange(v); }}
    >
      <SelectTrigger data-testid={testId ? `${testId}-select` : undefined}>
        <SelectValue placeholder={periodsQ.isLoading ? "Loading periods…" : (placeholder || "Select a period…")} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {periods.map((p) => (
          <SelectItem key={p.label} value={p.label}>
            <span className="flex items-center gap-2">
              {p.label}
              {p.status && p.status !== "open" && p.status !== "generated" && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{p.status}</span>
              )}
            </span>
          </SelectItem>
        ))}
        <SelectItem value={CUSTOM_KEY}>
          <span className="flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Type a different period…</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CNY", "MXN", "BRL", "CHF", "SGD", "HKD", "ZAR"];

export function CurrencyPicker({ value, onChange, testId }: PickerProps) {
  const inList = CURRENCIES.includes(value);
  const [mode, setMode] = useState<"select" | "custom">(value && !inList ? "custom" : "select");

  useEffect(() => {
    if (value && !CURRENCIES.includes(value)) setMode("custom");
  }, [value]);

  if (mode === "custom") {
    return (
      <div className="flex items-center gap-1">
        <Input value={value} onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} data-testid={testId ? `${testId}-input` : undefined} />
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[11px]" onClick={() => { setMode("select"); onChange("USD"); }}>From list</Button>
      </div>
    );
  }

  return (
    <Select
      value={inList ? value : "USD"}
      onValueChange={(v) => { if (v === CUSTOM_KEY) { setMode("custom"); onChange(""); return; } onChange(v); }}
    >
      <SelectTrigger data-testid={testId ? `${testId}-select` : undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        <SelectItem value={CUSTOM_KEY}>
          <span className="flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Other…</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
