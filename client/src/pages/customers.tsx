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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Loader2, Users, X, Save } from 'lucide-react';
import type { Customer } from '@shared/schema';

const SEGMENTS = ['Enterprise', 'Mid-Market', 'SMB', 'Government'];
const CHANNELS = ['Direct', 'Distributor', 'Online', 'Retail', 'Wholesale'];

interface CustomerFormData {
  name: string;
  code: string;
  segment: string;
  channel: string;
  territory: string;
  contactEmail: string;
}

const emptyForm: CustomerFormData = {
  name: '',
  code: '',
  segment: '',
  channel: '',
  territory: '',
  contactEmail: '',
};

export default function CustomersPage() {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm);
  const { toast } = useToast();

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const res = await apiRequest('POST', '/api/customers', {
        name: data.name,
        code: data.code || undefined,
        segment: data.segment || undefined,
        channel: data.channel || undefined,
        territory: data.territory || undefined,
        contactEmail: data.contactEmail || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({ title: 'Customer created successfully' });
      setShowAddPanel(false);
      setFormData(emptyForm);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create customer', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => {
      const res = await apiRequest('PATCH', `/api/customers/${id}`, {
        name: data.name,
        code: data.code || undefined,
        segment: data.segment || undefined,
        channel: data.channel || undefined,
        territory: data.territory || undefined,
        contactEmail: data.contactEmail || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({ title: 'Customer updated successfully' });
      setEditingId(null);
      setFormData(emptyForm);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update customer', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({ title: 'Customer deleted successfully' });
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete customer', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({
      name: customer.name,
      code: customer.code || '',
      segment: customer.segment || '',
      channel: customer.channel || '',
      territory: customer.territory || '',
      contactEmail: customer.contactEmail || '',
    });
    setShowAddPanel(false);
  };

  const handleAddClick = () => {
    setShowAddPanel(true);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const renderFormPanel = (isEdit: boolean, customerId?: string) => (
    <div className="mt-2 p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/30 border-orange-300/50" data-testid={isEdit ? `panel-edit-customer-${customerId}` : 'panel-add-customer'}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="customer-name">Name *</Label>
          <Input
            id="customer-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Customer name"
            data-testid="input-customer-name"
          />
        </div>
        <div>
          <Label htmlFor="customer-code">Code</Label>
          <Input
            id="customer-code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="Customer code"
            data-testid="input-customer-code"
          />
        </div>
        <div>
          <Label htmlFor="customer-segment">Segment</Label>
          <Select value={formData.segment} onValueChange={(val) => setFormData({ ...formData, segment: val })}>
            <SelectTrigger data-testid="select-customer-segment">
              <SelectValue placeholder="Select segment" />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="customer-channel">Channel</Label>
          <Select value={formData.channel} onValueChange={(val) => setFormData({ ...formData, channel: val })}>
            <SelectTrigger data-testid="select-customer-channel">
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="customer-territory">Territory</Label>
          <Input
            id="customer-territory"
            value={formData.territory}
            onChange={(e) => setFormData({ ...formData, territory: e.target.value })}
            placeholder="Territory"
            data-testid="input-customer-territory"
          />
        </div>
        <div>
          <Label htmlFor="customer-email">Contact Email</Label>
          <Input
            id="customer-email"
            type="email"
            value={formData.contactEmail}
            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            placeholder="email@example.com"
            data-testid="input-customer-email"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (isEdit) setEditingId(null);
            else setShowAddPanel(false);
            setFormData(emptyForm);
          }}
          data-testid={isEdit ? `button-cancel-edit-${customerId}` : 'button-cancel-add'}
        >
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending}
          onClick={() => {
            if (isEdit && customerId) {
              updateMutation.mutate({ id: customerId, data: formData });
            } else {
              createMutation.mutate(formData);
            }
          }}
          data-testid={isEdit ? `button-save-edit-${customerId}` : 'button-save-customer'}
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
      <MainLayout title="Customer Management" description="Manage your customers">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground" data-testid="text-loading">Loading customers...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Customer Management"
      description="Manage your customers"
      actions={
        <Button onClick={handleAddClick} data-testid="button-add-customer">
          <Plus className="h-4 w-4 mr-1" /> Add Customer
        </Button>
      }
    >
      <div className="space-y-4">
        {showAddPanel && renderFormPanel(false)}

        <Card>
          {customers && customers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                    {editingId === customer.id ? (
                      <TableCell colSpan={8}>
                        {renderFormPanel(true, customer.id)}
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className="font-medium" data-testid={`text-customer-name-${customer.id}`}>{customer.name}</TableCell>
                        <TableCell data-testid={`text-customer-code-${customer.id}`}>{customer.code || '—'}</TableCell>
                        <TableCell data-testid={`text-customer-segment-${customer.id}`}>{customer.segment || '—'}</TableCell>
                        <TableCell data-testid={`text-customer-channel-${customer.id}`}>{customer.channel || '—'}</TableCell>
                        <TableCell data-testid={`text-customer-territory-${customer.id}`}>{customer.territory || '—'}</TableCell>
                        <TableCell data-testid={`text-customer-email-${customer.id}`}>{customer.contactEmail || '—'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={customer.isActive ? 'default' : 'secondary'}
                            data-testid={`badge-customer-status-${customer.id}`}
                          >
                            {customer.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(customer)}
                              data-testid={`button-edit-customer-${customer.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(customer.id)}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-customer-${customer.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {deletingId === customer.id && (
                            <div className="mt-2 p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/30 border-orange-300/50 text-left" data-testid={`panel-delete-customer-${customer.id}`}>
                              <p className="font-semibold text-sm">Delete this customer?</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Are you sure you want to delete <strong>{customer.name}</strong>? This action cannot be undone.
                              </p>
                              <div className="flex justify-end gap-2 mt-3">
                                <Button variant="outline" size="sm" onClick={() => setDeletingId(null)} data-testid={`button-cancel-delete-${customer.id}`}>
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteMutation.mutate(customer.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-confirm-delete-${customer.id}`}
                                >
                                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                <Users className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2" data-testid="text-no-customers">No customers found</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Get started by adding your first customer
              </p>
              <Button onClick={handleAddClick} data-testid="button-add-first-customer">
                <Plus className="h-4 w-4 mr-1" /> Add Customer
              </Button>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
