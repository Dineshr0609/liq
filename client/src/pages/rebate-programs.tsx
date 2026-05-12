import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Loader2, X, Save, Play, Pause, XCircle, Calendar, DollarSign, RefreshCw } from 'lucide-react';
import type { RebateProgram, Contract } from '@shared/schema';

const PROGRAM_TYPES = ['Volume', 'Growth', 'Loyalty', 'Promotional'];
const FREQUENCIES = ['Monthly', 'Quarterly', 'Annually'];

interface Tier {
  minAmount: string;
  maxAmount: string;
  rate: string;
}

interface ProgramFormData {
  name: string;
  description: string;
  programType: string;
  contractId: string;
  startDate: string;
  endDate: string;
  calculationFrequency: string;
  retroactive: boolean;
  tiers: Tier[];
}

const emptyForm: ProgramFormData = {
  name: '',
  description: '',
  programType: 'Volume',
  contractId: '',
  startDate: '',
  endDate: '',
  calculationFrequency: 'Quarterly',
  retroactive: false,
  tiers: [],
};

function statusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'suspended': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400';
  }
}

export default function RebateProgramsPage() {
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProgramFormData>(emptyForm);
  const { toast } = useToast();

  const { data: programs, isLoading } = useQuery<RebateProgram[]>({
    queryKey: ['/api/rebate-programs'],
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ['/api/contracts'],
  });

  const buildPayload = (data: ProgramFormData) => ({
    name: data.name,
    description: data.description || undefined,
    programType: data.programType.toLowerCase() || undefined,
    contractId: data.contractId || undefined,
    startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
    endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
    calculationFrequency: data.calculationFrequency.toLowerCase() || undefined,
    retroactive: data.retroactive,
    tiers: data.tiers.length > 0 ? data.tiers.map(t => ({
      minAmount: parseFloat(t.minAmount) || 0,
      maxAmount: parseFloat(t.maxAmount) || 0,
      rate: parseFloat(t.rate) || 0,
    })) : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProgramFormData) => {
      const res = await apiRequest('POST', '/api/rebate-programs', buildPayload(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rebate-programs'] });
      toast({ title: 'Rebate program created successfully' });
      setShowCreatePanel(false);
      setFormData(emptyForm);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create program', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProgramFormData }) => {
      const res = await apiRequest('PATCH', `/api/rebate-programs/${id}`, buildPayload(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rebate-programs'] });
      toast({ title: 'Rebate program updated successfully' });
      setEditingId(null);
      setFormData(emptyForm);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update program', description: error.message, variant: 'destructive' });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/rebate-programs/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rebate-programs'] });
      toast({ title: 'Program status updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/rebate-programs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rebate-programs'] });
      toast({ title: 'Rebate program deleted' });
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete program', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (program: RebateProgram) => {
    const tiers = Array.isArray(program.tiers) ? (program.tiers as any[]).map((t: any) => ({
      minAmount: String(t.minAmount ?? ''),
      maxAmount: String(t.maxAmount ?? ''),
      rate: String(t.rate ?? ''),
    })) : [];
    setEditingId(program.id);
    setFormData({
      name: program.name,
      description: program.description || '',
      programType: program.programType ? program.programType.charAt(0).toUpperCase() + program.programType.slice(1) : 'Volume',
      contractId: program.contractId || '',
      startDate: program.startDate ? new Date(program.startDate).toISOString().split('T')[0] : '',
      endDate: program.endDate ? new Date(program.endDate).toISOString().split('T')[0] : '',
      calculationFrequency: program.calculationFrequency ? program.calculationFrequency.charAt(0).toUpperCase() + program.calculationFrequency.slice(1) : 'Quarterly',
      retroactive: program.retroactive || false,
      tiers,
    });
    setShowCreatePanel(false);
  };

  const addTier = () => {
    setFormData({ ...formData, tiers: [...formData.tiers, { minAmount: '', maxAmount: '', rate: '' }] });
  };

  const removeTier = (index: number) => {
    setFormData({ ...formData, tiers: formData.tiers.filter((_, i) => i !== index) });
  };

  const updateTier = (index: number, field: keyof Tier, value: string) => {
    const newTiers = [...formData.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setFormData({ ...formData, tiers: newTiers });
  };

  const getContractName = (contractId: string | null) => {
    if (!contractId || !contracts) return null;
    const contract = contracts.find((c) => c.id === contractId);
    return contract?.displayName || contract?.originalName || contractId;
  };

  const renderFormPanel = (isEdit: boolean, programId?: string) => (
    <div className="mt-2 p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/30 border-orange-300/50" data-testid={isEdit ? `panel-edit-program-${programId}` : 'panel-create-program'}>
      <h3 className="font-semibold mb-4">{isEdit ? 'Edit Program' : 'Create New Program'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="program-name">Name *</Label>
          <Input
            id="program-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Program name"
            data-testid="input-program-name"
          />
        </div>
        <div>
          <Label htmlFor="program-type">Program Type</Label>
          <Select value={formData.programType} onValueChange={(val) => setFormData({ ...formData, programType: val })}>
            <SelectTrigger data-testid="select-program-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {PROGRAM_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="program-description">Description</Label>
          <Input
            id="program-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Program description"
            data-testid="input-program-description"
          />
        </div>
        <div>
          <Label htmlFor="program-contract">Contract</Label>
          <Select value={formData.contractId} onValueChange={(val) => setFormData({ ...formData, contractId: val })}>
            <SelectTrigger data-testid="select-program-contract">
              <SelectValue placeholder="Select contract" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No contract</SelectItem>
              {contracts?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.displayName || c.originalName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="program-frequency">Calculation Frequency</Label>
          <Select value={formData.calculationFrequency} onValueChange={(val) => setFormData({ ...formData, calculationFrequency: val })}>
            <SelectTrigger data-testid="select-program-frequency">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="program-start-date">Start Date</Label>
          <Input
            id="program-start-date"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            data-testid="input-program-start-date"
          />
        </div>
        <div>
          <Label htmlFor="program-end-date">End Date</Label>
          <Input
            id="program-end-date"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            data-testid="input-program-end-date"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="program-retroactive"
            checked={formData.retroactive}
            onChange={(e) => setFormData({ ...formData, retroactive: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
            data-testid="checkbox-program-retroactive"
          />
          <Label htmlFor="program-retroactive">Retroactive</Label>
        </div>
      </div>

      <Separator className="my-4" />
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Tiers</Label>
          <Button variant="outline" size="sm" onClick={addTier} data-testid="button-add-tier">
            <Plus className="h-3 w-3 mr-1" /> Add Tier
          </Button>
        </div>
        {formData.tiers.map((tier, index) => (
          <div key={index} className="flex items-center gap-2 mb-2" data-testid={`tier-row-${index}`}>
            <Input
              type="number"
              placeholder="Min Amount"
              value={tier.minAmount}
              onChange={(e) => updateTier(index, 'minAmount', e.target.value)}
              className="w-32"
              data-testid={`input-tier-min-${index}`}
            />
            <Input
              type="number"
              placeholder="Max Amount"
              value={tier.maxAmount}
              onChange={(e) => updateTier(index, 'maxAmount', e.target.value)}
              className="w-32"
              data-testid={`input-tier-max-${index}`}
            />
            <Input
              type="number"
              placeholder="Rate %"
              value={tier.rate}
              onChange={(e) => updateTier(index, 'rate', e.target.value)}
              className="w-24"
              data-testid={`input-tier-rate-${index}`}
            />
            <Button variant="ghost" size="sm" onClick={() => removeTier(index)} data-testid={`button-remove-tier-${index}`}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {formData.tiers.length === 0 && (
          <p className="text-sm text-muted-foreground">No tiers configured</p>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (isEdit) setEditingId(null);
            else setShowCreatePanel(false);
            setFormData(emptyForm);
          }}
          data-testid={isEdit ? `button-cancel-edit-program-${programId}` : 'button-cancel-create'}
        >
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending}
          onClick={() => {
            if (isEdit && programId) {
              updateMutation.mutate({ id: programId, data: formData });
            } else {
              createMutation.mutate(formData);
            }
          }}
          data-testid={isEdit ? `button-save-edit-program-${programId}` : 'button-save-program'}
        >
          {(createMutation.isPending || updateMutation.isPending) ? (
            <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
          ) : (
            <><Save className="h-4 w-4 mr-1" /> Save</>
          )}
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <MainLayout title="Rebate Programs" description="Manage rebate programs">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground" data-testid="text-loading">Loading programs...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Rebate Programs"
      description="Manage rebate programs"
      actions={
        <Button onClick={() => { setShowCreatePanel(true); setEditingId(null); setFormData(emptyForm); }} data-testid="button-create-program">
          <Plus className="h-4 w-4 mr-1" /> Create Program
        </Button>
      }
    >
      <div className="space-y-4">
        {showCreatePanel && renderFormPanel(false)}

        {programs && programs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {programs.map((program) => (
              <div key={program.id} data-testid={`card-program-${program.id}`}>
                {editingId === program.id ? (
                  renderFormPanel(true, program.id)
                ) : (
                  <Card className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg" data-testid={`text-program-name-${program.id}`}>{program.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(program.status || 'draft')}`} data-testid={`badge-program-status-${program.id}`}>
                        {program.status || 'draft'}
                      </span>
                    </div>
                    {program.description && (
                      <p className="text-sm text-muted-foreground mb-3" data-testid={`text-program-desc-${program.id}`}>{program.description}</p>
                    )}
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Type:</span>
                        <Badge variant="outline" data-testid={`badge-program-type-${program.id}`}>{program.programType || 'volume'}</Badge>
                      </div>
                      {program.contractId && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Contract:</span>
                          <span data-testid={`text-program-contract-${program.id}`}>{getContractName(program.contractId)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span data-testid={`text-program-dates-${program.id}`}>
                          {program.startDate ? new Date(program.startDate).toLocaleDateString() : '—'}
                          {' → '}
                          {program.endDate ? new Date(program.endDate).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-3 w-3 text-muted-foreground" />
                        <span data-testid={`text-program-frequency-${program.id}`}>{program.calculationFrequency || 'quarterly'}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-muted-foreground">Accrued:</span>
                          <span className="font-medium" data-testid={`text-program-accrued-${program.id}`}>${Number(program.totalAccrued || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-orange-700" />
                          <span className="text-xs text-muted-foreground">Paid:</span>
                          <span className="font-medium" data-testid={`text-program-paid-${program.id}`}>${Number(program.totalPaid || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {program.status !== 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => statusMutation.mutate({ id: program.id, status: 'active' })}
                            disabled={statusMutation.isPending}
                            data-testid={`button-activate-${program.id}`}
                            title="Activate"
                          >
                            <Play className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {program.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => statusMutation.mutate({ id: program.id, status: 'suspended' })}
                            disabled={statusMutation.isPending}
                            data-testid={`button-suspend-${program.id}`}
                            title="Suspend"
                          >
                            <Pause className="h-4 w-4 text-yellow-600" />
                          </Button>
                        )}
                        {program.status !== 'expired' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => statusMutation.mutate({ id: program.id, status: 'expired' })}
                            disabled={statusMutation.isPending}
                            data-testid={`button-expire-${program.id}`}
                            title="Expire"
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(program)}
                          data-testid={`button-edit-program-${program.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(program.id)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-program-${program.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {deletingId === program.id && (
                      <div className="mt-2 p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/30 border-orange-300/50" data-testid={`panel-delete-program-${program.id}`}>
                        <p className="font-semibold text-sm">Delete this program?</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Are you sure you want to delete <strong>{program.name}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2 mt-3">
                          <Button variant="outline" size="sm" onClick={() => setDeletingId(null)} data-testid={`button-cancel-delete-program-${program.id}`}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(program.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-confirm-delete-program-${program.id}`}
                          >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
              <DollarSign className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2" data-testid="text-no-programs">No rebate programs found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Get started by creating your first rebate program
            </p>
            <Button onClick={() => { setShowCreatePanel(true); setFormData(emptyForm); }} data-testid="button-create-first-program">
              <Plus className="h-4 w-4 mr-1" /> Create Program
            </Button>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
