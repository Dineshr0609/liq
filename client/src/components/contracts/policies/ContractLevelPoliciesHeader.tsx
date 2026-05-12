import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown, ChevronRight, Receipt, RotateCcw, Save, Settings,
} from "lucide-react";
import {
  CLAIM_TYPES,
  SETTLEMENT_DIRECTIONS,
  SETTLEMENT_DOCUMENT_TYPES,
  BUILT_IN_DOCUMENT_TYPE_MATRIX,
  lookupDocumentTypeMatrixRow,
  type ClaimTypeCode,
  type SettlementDirection,
  type SettlementDocumentType,
  type DocumentTypeMatrixRow,
} from "@shared/schema";

type SettlementPolicies = {
  documentTypeMatrix?: { rows?: DocumentTypeMatrixRow[] } | null;
} & { [key: string]: unknown };

type ContractWithSettlement = {
  id: string;
  obligationAccrualBasis?: string | null;
  settlementPolicies?: SettlementPolicies | null;
  flowTypeCode?: string | null;
};

function ObligationAccrualBasisCard({
  contractId,
  contract,
}: { contractId: string; contract: ContractWithSettlement }) {
  const pinned: string | null = contract?.obligationAccrualBasis ?? null;
  const effective = pinned ?? "system default";

  const updateMutation = useMutation({
    mutationFn: (value: string | null) =>
      apiRequest("PATCH", `/api/contracts/${contractId}`, { obligationAccrualBasis: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId] });
    },
  });

  return (
    <section className="bg-white border border-zinc-200 rounded-lg p-4" data-testid="card-obligation-accrual-basis">
      <header className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Obligation accrual basis</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Controls when this contract's obligations book to the accrual ledger.
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 font-medium border border-zinc-200">
          Effective: {effective.replace(/_/g, " ")}
        </span>
      </header>
      <div className="flex items-center gap-2">
        <Select
          value={pinned ?? "__default__"}
          onValueChange={(v) => updateMutation.mutate(v === "__default__" ? null : v)}
          disabled={updateMutation.isPending}
        >
          <SelectTrigger className="w-72 h-8 text-xs" data-testid="select-obligation-accrual-basis">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Use system default</SelectItem>
            <SelectItem value="qualifying_sale">Qualifying sale (book at calc time)</SelectItem>
            <SelectItem value="scheduled_release">Scheduled release (book at release date)</SelectItem>
          </SelectContent>
        </Select>
        {updateMutation.isPending && (
          <span className="text-[11px] text-zinc-500">Saving…</span>
        )}
      </div>
    </section>
  );
}

function SettlementDocumentTypeCard({
  contractId,
  contract,
}: { contractId: string; contract: ContractWithSettlement }) {
  const { toast } = useToast();
  const settlementPolicies: SettlementPolicies = contract?.settlementPolicies ?? {};
  const persistedRows: DocumentTypeMatrixRow[] = settlementPolicies?.documentTypeMatrix?.rows ?? [];
  const [edits, setEdits] = useState<DocumentTypeMatrixRow[] | null>(null);
  const currentRows = edits ?? persistedRows;
  const hasLocalChanges = edits !== null;

  const { data: companySettings } = useQuery<{ settlementPolicies?: SettlementPolicies | null } | undefined>({
    queryKey: ['/api/settings/company'],
  });
  const { data: flowTypesData } = useQuery<Array<{ code: string; documentTypeOverrides: { rows: DocumentTypeMatrixRow[] } | null }>>({
    queryKey: ['/api/pipeline/flow-types'],
  });
  const upstreamFallback: DocumentTypeMatrixRow[] = useMemo(() => {
    const merged = new Map<string, DocumentTypeMatrixRow>();
    for (const r of BUILT_IN_DOCUMENT_TYPE_MATRIX) merged.set(`${r.claimType}|${r.direction}`, r);
    const companyRows: DocumentTypeMatrixRow[] = companySettings?.settlementPolicies?.documentTypeMatrix?.rows || [];
    for (const r of companyRows) merged.set(`${r.claimType}|${r.direction}`, r);
    const flowTypeCode = contract?.flowTypeCode;
    if (flowTypeCode) {
      const ft = (flowTypesData || []).find(f => f.code === flowTypeCode);
      const ftRows: DocumentTypeMatrixRow[] = ft?.documentTypeOverrides?.rows || [];
      for (const r of ftRows) merged.set(`${r.claimType}|${r.direction}`, r);
    }
    return Array.from(merged.values());
  }, [companySettings, flowTypesData, contract?.flowTypeCode]);

  const saveMutation = useMutation({
    mutationFn: (rows: DocumentTypeMatrixRow[]) => {
      const nextSettlement: SettlementPolicies = {
        ...(settlementPolicies || {}),
        documentTypeMatrix: rows.length === 0 ? null : { rows },
      };
      if (nextSettlement.documentTypeMatrix === null) delete nextSettlement.documentTypeMatrix;
      return apiRequest("PATCH", `/api/contracts/${contractId}`, { settlementPolicies: nextSettlement });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId] });
      setEdits(null);
      toast({ title: 'Saved', description: 'Settlement document type matrix updated for this contract.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message || 'Failed to save', variant: 'destructive' });
    },
  });

  const setCell = (claimType: ClaimTypeCode, direction: SettlementDirection, docType: SettlementDocumentType) => {
    const next = currentRows.filter(r => !(r.claimType === claimType && r.direction === direction));
    next.push({ claimType, direction, documentType: docType });
    next.sort((a, b) => a.claimType === b.claimType ? a.direction.localeCompare(b.direction) : a.claimType.localeCompare(b.claimType));
    setEdits(next);
  };
  const clearCell = (claimType: ClaimTypeCode, direction: SettlementDirection) => {
    setEdits(currentRows.filter(r => !(r.claimType === claimType && r.direction === direction)));
  };

  const overrideMap = new Map<string, SettlementDocumentType>();
  for (const r of currentRows) overrideMap.set(`${r.claimType}|${r.direction}`, r.documentType);

  return (
    <section className="bg-white border border-zinc-200 rounded-lg p-4" data-testid="card-settlement-document-type">
      <header className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-zinc-400" />
            Settlement document type
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Per-claim-type override of the document we generate when a claim
            on this contract is approved. Cells you do not pin inherit from the
            flow-type, company, or built-in matrix in that order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasLocalChanges && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEdits(null)}
              data-testid="button-discard-settlement-doctype"
            >
              Discard
            </Button>
          )}
          <Button
            size="sm"
            disabled={!hasLocalChanges || saveMutation.isPending}
            onClick={() => saveMutation.mutate(currentRows)}
            data-testid="button-save-settlement-doctype"
          >
            <Save className="w-3 h-3 mr-1" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>
      <div className="border rounded-md overflow-hidden" data-testid="contract-doctype-matrix">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Claim type</TableHead>
              {SETTLEMENT_DIRECTIONS.map(dir => (
                <TableHead key={dir} className="capitalize">{dir}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {CLAIM_TYPES.map(claimType => (
              <TableRow key={claimType}>
                <TableCell className="font-medium text-xs capitalize">
                  {claimType.replace(/_/g, ' ')}
                </TableCell>
                {SETTLEMENT_DIRECTIONS.map(direction => {
                  const overrideVal = overrideMap.get(`${claimType}|${direction}`);
                  const inheritedVal = lookupDocumentTypeMatrixRow(upstreamFallback, claimType, direction);
                  const effective = overrideVal ?? inheritedVal ?? '';
                  const isOverridden = overrideVal !== undefined;
                  return (
                    <TableCell key={direction} className="align-top">
                      <div className="space-y-1">
                        <Select
                          value={effective || undefined}
                          onValueChange={(v) => setCell(claimType, direction, v as SettlementDocumentType)}
                        >
                          <SelectTrigger
                            className="h-7 text-xs"
                            data-testid={`contract-doctype-select-${claimType}-${direction}`}
                          >
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {SETTLEMENT_DOCUMENT_TYPES.map(d => (
                              <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                          {isOverridden ? (
                            <>
                              <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] px-1 py-0">Override</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-[10px]"
                                onClick={() => clearCell(claimType, direction)}
                                data-testid={`contract-doctype-reset-${claimType}-${direction}`}
                              >
                                <RotateCcw className="w-2.5 h-2.5 mr-0.5" /> Reset
                              </Button>
                            </>
                          ) : (
                            <span>Inherited: <strong>{(inheritedVal || '—').replace(/_/g, ' ')}</strong></span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

/**
 * Contract-level policy header that sits above the per-subtype-instance
 * accordion editors inside the Policies tab. Hosts the two policy controls
 * that apply to the entire contract (rather than to one subtype instance):
 *   - Obligation accrual basis (system-default override)
 *   - Settlement document-type matrix override
 */
export function ContractLevelPoliciesHeader({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(true);
  const { data: contract } = useQuery<ContractWithSettlement>({
    queryKey: ["/api/contracts", contractId],
  });
  if (!contract) return null;
  return (
    <section
      className="border border-zinc-200 rounded-xl bg-white overflow-hidden"
      data-testid="container-contract-policies-header"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50"
        data-testid="button-toggle-contract-policies-header"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        )}
        <Settings className="h-4 w-4 text-zinc-400" />
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-zinc-900">
            Contract-level overrides
          </div>
          <div className="text-[11px] text-zinc-500">
            Pin defaults for accrual basis and the settlement document-type
            matrix that apply to every subtype on this contract.
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-100 pt-4">
          <ObligationAccrualBasisCard contractId={contractId} contract={contract} />
          <SettlementDocumentTypeCard contractId={contractId} contract={contract} />
        </div>
      )}
    </section>
  );
}

export default ContractLevelPoliciesHeader;
