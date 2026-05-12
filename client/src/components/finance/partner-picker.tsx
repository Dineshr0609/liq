import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface PartnerPickerProps {
  value: string;
  onChange: (v: string) => void;
  partners: string[];
  testId?: string;
  placeholder?: string;
}

const CUSTOM_KEY = "__custom__";

export function PartnerPicker({ value, onChange, partners, testId, placeholder }: PartnerPickerProps) {
  const inList = !!value && partners.includes(value);
  const [mode, setMode] = useState<"select" | "custom">(value && !inList ? "custom" : "select");

  useEffect(() => {
    if (value && !partners.includes(value) && partners.length > 0) {
      setMode("custom");
    }
  }, [value, partners]);

  if (mode === "custom" || partners.length === 0) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Type partner name"}
          data-testid={testId ? `${testId}-input` : undefined}
        />
        {partners.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-[11px]"
            onClick={() => { setMode("select"); onChange(""); }}
            data-testid={testId ? `${testId}-back-to-list` : undefined}
          >
            From list
          </Button>
        )}
      </div>
    );
  }

  return (
    <Select
      value={inList ? value : ""}
      onValueChange={(v) => {
        if (v === CUSTOM_KEY) { setMode("custom"); onChange(""); return; }
        onChange(v);
      }}
    >
      <SelectTrigger data-testid={testId ? `${testId}-select` : undefined}>
        <SelectValue placeholder={placeholder || "Select a partner…"} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {partners.map((p) => (
          <SelectItem key={p} value={p}>{p}</SelectItem>
        ))}
        <SelectItem value={CUSTOM_KEY}>
          <span className="flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Type a different partner…</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
