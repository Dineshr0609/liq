import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Calculator, 
  Settings, 
  ArrowRight, 
  CheckCircle, 
  Database,
  FileCode,
  ExternalLink,
  Loader2,
  Info,
  Layers,
  AlertCircle,
  CheckCircle2,
  Edit,
  Trash2,
  Plus,
  Save,
  Sparkles,
  User,
  Undo2
} from 'lucide-react';
import { Link } from 'wouter';
import { DualTerminologyBadge } from './DualTerminologyBadge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CombinedRulesViewProps {
  contractId: string;
}

interface ConfirmedTermMapping {
  id: string;
  contractId: string;
  originalTerm: string;
  originalValue: string | null;
  erpEntityId: string | null;
  erpFieldId: string | null;
  erpFieldName: string | null;
  erpEntityName: string | null;
  suggestedErpFieldName: string | null;
  erpRecordId: string | null;
  erpRecordValue: string | null;
  erpRecordTable: string | null;
  confidence: string | null;
  status: string;
  confirmedAt: string | null;
  erpCatalogField: string | null;
  erpCatalogEntity: string | null;
  erpSystemName: string | null;
}

interface CombinedRulesData {
  contractId: string;
  calculationApproach: string;
  manualRules: any[];
  erpGeneratedRules: any[];
  confirmedTermMappings: ConfirmedTermMapping[];
  combinedCount: number;
  summary: {
    manualCount: number;
    erpCount: number;
    confirmedMappingsCount: number;
    calculationMode: string;
  };
}

interface BlueprintData {
  blueprints: Array<{
    id: string;
    name: string;
    ruleType: string;
    isFullyMapped: boolean;
    unmappedFields: string[];
    dimensions: Array<{
      dimensionType: string;
      contractTerm: string;
      erpFieldName: string | null;
      isMapped: boolean;
    }>;
  }>;
  totalCount: number;
  fullyMappedCount: number;
}

const CALCULATION_APPROACH_LABELS: Record<string, string> = {
  manual: 'Manual Rules Only',
  erp_rules: 'ERP Mapping Rules Only',
  erp_mapping_rules: 'ERP Mapping Rules',
  hybrid: 'Hybrid (Manual + ERP)',
};

interface EditingMapping {
  id: string;
  sourceField: string;
  targetField: string;
}

export function CombinedRulesView({ contractId }: CombinedRulesViewProps) {
  const { toast } = useToast();
  const [editingMapping, setEditingMapping] = useState<EditingMapping | null>(null);
  const [editFormData, setEditFormData] = useState({ contractTerm: '', erpFieldName: '' });
  
  const { data, isLoading, error } = useQuery<CombinedRulesData>({
    queryKey: ['/api/contracts', contractId, 'combined-rules'],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/combined-rules`);
      if (!res.ok) throw new Error('Failed to fetch combined rules');
      return res.json();
    },
    enabled: !!contractId,
  });

  const { data: blueprintData, isLoading: blueprintLoading } = useQuery<BlueprintData>({
    queryKey: ['/api/contracts', contractId, 'blueprints'],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/blueprints`);
      if (!res.ok) throw new Error('Failed to fetch blueprints');
      return res.json();
    },
    enabled: !!contractId,
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await apiRequest('DELETE', `/api/contracts/${contractId}/rules/${ruleId}`);
    },
    onSuccess: () => {
      toast({ title: 'Rule deleted', description: 'The rule has been removed successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'combined-rules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'blueprints'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete rule.', variant: 'destructive' });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      await apiRequest('DELETE', `/api/confirmed-term-mappings/${mappingId}`);
    },
    onSuccess: () => {
      toast({ title: 'Mapping deleted', description: 'The mapping has been removed.' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'combined-rules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'blueprints'] });
      queryClient.invalidateQueries({ queryKey: ['/api/confirmed-term-mappings'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete mapping.', variant: 'destructive' });
    },
  });

  const updateMappingMutation = useMutation({
    mutationFn: async ({ id, contractTerm, erpFieldName }: { id: string; contractTerm: string; erpFieldName: string }) => {
      await apiRequest('PATCH', `/api/confirmed-term-mappings/${id}`, { contractTerm, erpFieldName });
    },
    onSuccess: () => {
      toast({ title: 'Mapping updated', description: 'The mapping has been updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'combined-rules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'blueprints'] });
      queryClient.invalidateQueries({ queryKey: ['/api/confirmed-term-mappings'] });
      setEditingMapping(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update mapping.', variant: 'destructive' });
    },
  });

  const handleEditMapping = (rule: any) => {
    setEditFormData({ contractTerm: rule.sourceField, erpFieldName: rule.targetField });
    setEditingMapping({ id: rule.id, sourceField: rule.sourceField, targetField: rule.targetField });
  };

  const handleSaveMapping = () => {
    if (!editingMapping) return;
    updateMappingMutation.mutate({
      id: editingMapping.id,
      contractTerm: editFormData.contractTerm,
      erpFieldName: editFormData.erpFieldName
    });
  };

  const deleteBlueprintMutation = useMutation({
    mutationFn: async (blueprintId: string) => {
      await apiRequest('DELETE', `/api/blueprints/${blueprintId}`);
    },
    onSuccess: () => {
      toast({ title: 'Blueprint deleted', description: 'The blueprint has been removed.' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'blueprints'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete blueprint.', variant: 'destructive' });
    },
  });

  const regenerateBlueprintsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/contracts/${contractId}/materialize-blueprints`);
    },
    onSuccess: () => {
      toast({ title: 'Blueprints regenerated', description: 'All blueprints have been re-materialized.' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'blueprints'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'combined-rules'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to regenerate blueprints.', variant: 'destructive' });
    },
  });

  const revertMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      await apiRequest('PATCH', `/api/pending-mappings/${mappingId}`, { status: 'pending' });
    },
    onSuccess: () => {
      toast({ title: 'Mapping reverted', description: 'The mapping has been moved back to pending for review.' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'combined-rules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'pending-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'blueprints'] });
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}/pending-mappings?status=confirmed`] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to revert mapping.', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading rules...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Unable to load combined rules.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { manualRules, erpGeneratedRules, confirmedTermMappings = [], calculationApproach, summary } = data;

  return (
    <div className="space-y-6">
      {/* Term Mappings - Hidden from contract view */}

      {/* Contract Calculation Rules - Hidden from contract view */}

      {/* Blueprint Execution Status section hidden from Contract View - internal/admin feature */}

      {editingMapping && (
        <div className="mt-2 p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/30 border-orange-300/50" data-testid="panel-edit-erp-mapping">
          <p className="font-semibold mb-1">Edit Mapping</p>
          <p className="text-sm text-muted-foreground mb-4">Modify the contract term or ERP field name for this mapping.</p>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="contractTerm">Contract Term</Label>
              <Input
                id="contractTerm"
                value={editFormData.contractTerm}
                onChange={(e) => setEditFormData(prev => ({ ...prev, contractTerm: e.target.value }))}
                placeholder="Enter contract term"
                data-testid="input-edit-contract-term"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="erpFieldName">ERP Field Name</Label>
              <Input
                id="erpFieldName"
                value={editFormData.erpFieldName}
                onChange={(e) => setEditFormData(prev => ({ ...prev, erpFieldName: e.target.value }))}
                placeholder="Enter ERP field name"
                data-testid="input-edit-erp-field"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditingMapping(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveMapping} 
              disabled={updateMappingMutation.isPending || !editFormData.contractTerm || !editFormData.erpFieldName}
              data-testid="button-save-mapping"
            >
              {updateMappingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CombinedRulesView;
