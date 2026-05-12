import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  Library,
  Lock,
  Building2,
  ShieldCheck,
  Loader2,
  Pencil,
  Trash2,
  Download,
  FileText,
  Layers,
  ListChecks,
  Search,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
} from 'lucide-react';

type TemplateScope = 'system' | 'company' | 'mine';
type TemplateVisibility = 'public' | 'private';

interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  flowTypeCode: string;
  flowTypeName: string;
  isSystem: boolean;
  visibility: TemplateVisibility;
  ownerUserId: string | null;
  companyId: string | null;
  scope: TemplateScope;
  ownerLabel: string;
  snapshotScope: string;
  versionNum: number;
  stats: { rules: number; clauses: number; subtypes: number };
  usageCount: number;
}

const SAMPLE_KINDS: Array<{ kind: string; label: string }> = [
  { kind: 'sales', label: 'Sales' },
  { kind: 'credit_memos', label: 'Credit Memos' },
  { kind: 'pos', label: 'POS' },
  { kind: 'po_receipts', label: 'PO Receipts' },
];

const SCOPE_META: Record<TemplateScope, { title: string; description: string; icon: typeof Library; testId: string }> = {
  system: {
    title: 'System Templates',
    description: 'Curated by License IQ — visible to every workspace, read-only.',
    icon: ShieldCheck,
    testId: 'section-system-templates',
  },
  company: {
    title: 'My Company',
    description: 'Shared by teammates in your organization.',
    icon: Building2,
    testId: 'section-company-templates',
  },
  mine: {
    title: 'Mine',
    description: 'Templates you saved. Edit metadata or delete any time.',
    icon: Lock,
    testId: 'section-mine-templates',
  },
};

export default function TemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<TemplateListItem | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<TemplateListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<TemplateVisibility>('private');

  const templatesQuery = useQuery<{ templates: TemplateListItem[] }>({
    queryKey: ['/api/contract-templates'],
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      description: string;
      visibility: TemplateVisibility;
    }) => {
      const res = await apiRequest('PATCH', `/api/contract-templates/library/${input.id}`, {
        name: input.name,
        description: input.description,
        visibility: input.visibility,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract-templates'] });
      toast({ title: 'Template updated' });
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/contract-templates/library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract-templates'] });
      toast({ title: 'Template deleted' });
      setDeletingTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const groupedTemplates = useMemo(() => {
    const all = templatesQuery.data?.templates ?? [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? all.filter((t) => {
          return (
            t.name.toLowerCase().includes(q) ||
            (t.description ?? '').toLowerCase().includes(q) ||
            t.flowTypeCode.toLowerCase().includes(q) ||
            t.flowTypeName.toLowerCase().includes(q)
          );
        })
      : all;
    const groups: Record<TemplateScope, TemplateListItem[]> = {
      system: [],
      company: [],
      mine: [],
    };
    for (const t of filtered) groups[t.scope].push(t);
    return groups;
  }, [templatesQuery.data, searchQuery]);

  const totalCount = templatesQuery.data?.templates.length ?? 0;

  const openEditDialog = (tpl: TemplateListItem) => {
    setEditingTemplate(tpl);
    setEditName(tpl.name);
    setEditDescription(tpl.description ?? '');
    setEditVisibility(tpl.visibility);
  };

  const downloadSample = (tpl: TemplateListItem, kind: string) => {
    window.open(`/api/contract-templates/${tpl.id}/sample/${kind}`, '_blank', 'noopener');
  };

  const isOwnTemplate = (tpl: TemplateListItem) =>
    !tpl.isSystem && tpl.ownerUserId != null && user != null && tpl.ownerUserId === user.id;

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
              <Library className="h-6 w-6 text-orange-600" />
              Template Library
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-page-description">
              Browse, rename, and curate the templates that seed new contracts.
              Save a contract as a template from its Overview page to add it here.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" data-testid="badge-template-count">
              {totalCount} {totalCount === 1 ? 'template' : 'templates'}
            </Badge>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, description, or flow type…"
            className="pl-9"
            data-testid="input-search-templates"
          />
        </div>

        {templatesQuery.isLoading ? (
          <div
            className="flex items-center justify-center py-16 text-sm text-muted-foreground"
            data-testid="state-loading"
          >
            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading templates…
          </div>
        ) : templatesQuery.isError ? (
          <Card data-testid="state-error">
            <CardContent className="p-8 text-center text-sm text-red-600">
              Failed to load templates. Try refreshing the page.
            </CardContent>
          </Card>
        ) : totalCount === 0 ? (
          <Card data-testid="state-empty">
            <CardContent className="p-12 text-center space-y-2">
              <Library className="h-10 w-10 text-muted-foreground mx-auto" />
              <div className="text-base font-medium">No templates yet</div>
              <p className="text-sm text-muted-foreground">
                Save a contract as a template from its Overview page to populate
                this library.
              </p>
            </CardContent>
          </Card>
        ) : searchQuery &&
          (Object.keys(groupedTemplates) as TemplateScope[]).every((s) => groupedTemplates[s].length === 0) ? (
          <Card data-testid="state-no-search-results">
            <CardContent className="p-8 text-center space-y-1">
              <Search className="h-6 w-6 text-muted-foreground mx-auto" />
              <div className="text-sm font-medium">No templates match "{searchQuery}"</div>
              <p className="text-xs text-muted-foreground">
                Try a different name, description, or flow type.
              </p>
            </CardContent>
          </Card>
        ) : (
          (Object.keys(SCOPE_META) as TemplateScope[]).map((scope) => {
            const items = groupedTemplates[scope];
            const meta = SCOPE_META[scope];
            const Icon = meta.icon;
            if (searchQuery && items.length === 0) return null;
            return (
              <section key={scope} data-testid={meta.testId} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {meta.title}
                  </h2>
                  <Badge variant="secondary" className="text-xs" data-testid={`badge-count-${scope}`}>
                    {items.length}
                  </Badge>
                  <span className="text-xs text-muted-foreground">— {meta.description}</span>
                </div>

                {items.length === 0 ? (
                  <Card data-testid={`empty-${scope}`}>
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      No templates in this group.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((tpl) => (
                      <TemplateCard
                        key={tpl.id}
                        template={tpl}
                        canEdit={isOwnTemplate(tpl)}
                        onEdit={() => openEditDialog(tpl)}
                        onDelete={() => setDeletingTemplate(tpl)}
                        onDownloadSample={(kind) => downloadSample(tpl, kind)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      <Dialog
        open={editingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTemplate(null);
        }}
      >
        <DialogContent className="sm:max-w-md" data-testid="dialog-edit-template">
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
            <DialogDescription>
              Rename, update the description, or change who can see this template.
              Rules and clauses stay locked to the original snapshot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-tpl-name" className="text-xs font-medium">
                Template name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-tpl-name"
                data-testid="input-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tpl-desc" className="text-xs font-medium">
                Description <span className="text-zinc-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="edit-tpl-desc"
                data-testid="input-edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value.slice(0, 280))}
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Visibility</Label>
              <RadioGroup
                value={editVisibility}
                onValueChange={(v) => setEditVisibility(v as TemplateVisibility)}
                className="grid grid-cols-2 gap-2"
              >
                {([
                  { v: 'private', label: 'Private', hint: 'Only you can use it' },
                  { v: 'public', label: 'My Company', hint: 'Visible to everyone in your org' },
                ] as const).map((s) => (
                  <label
                    key={s.v}
                    htmlFor={`edit-vis-${s.v}`}
                    className={`flex flex-col gap-1 rounded-md border p-2 cursor-pointer text-xs ${
                      editVisibility === s.v
                        ? 'border-orange-300 bg-orange-50/60'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                    data-testid={`radio-edit-visibility-${s.v}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem id={`edit-vis-${s.v}`} value={s.v} />
                      <span className="font-medium">{s.label}</span>
                    </div>
                    <span className="text-[10.5px] text-zinc-500 leading-snug">{s.hint}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingTemplate(null)}
              disabled={updateMutation.isPending}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={!editName.trim() || updateMutation.isPending}
              onClick={() => {
                if (!editingTemplate) return;
                updateMutation.mutate({
                  id: editingTemplate.id,
                  name: editName.trim(),
                  description: editDescription.trim(),
                  visibility: editVisibility,
                });
              }}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingTemplate(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-delete-template">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTemplate ? (
                <>
                  <span className="font-medium text-foreground">"{deletingTemplate.name}"</span> will
                  be permanently removed from your library. Contracts created
                  from it are not affected — they keep their own copy of the
                  rules and clauses.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!deletingTemplate) return;
                deleteMutation.mutate(deletingTemplate.id);
              }}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Deleting…
                </>
              ) : (
                'Delete template'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

// ---------------------------------------------------------------------------

interface UsageContract {
  id: string;
  displayName: string;
  contractNumber: string | null;
  status: string | null;
  contractStatus: string | null;
  createdAt: string | null;
}

interface TemplateUsageResponse {
  templateId: string;
  count: number;
  contracts: UsageContract[];
}

interface TemplateCardProps {
  template: TemplateListItem;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDownloadSample: (kind: string) => void;
}

const STATUS_BADGE_CLS: Record<string, string> = {
  analyzed: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  processing: 'bg-amber-50 border-amber-200 text-amber-700',
  uploaded: 'bg-zinc-50 border-zinc-200 text-zinc-600',
  failed: 'bg-red-50 border-red-200 text-red-700',
};

function TemplateCard({ template, canEdit, onEdit, onDelete, onDownloadSample }: TemplateCardProps) {
  const [usageOpen, setUsageOpen] = useState(false);
  // Per-card list is fetched lazily — only when the user expands the row —
  // so the initial /templates render stays cheap. The count itself comes
  // from the templates list response (already tenant-scoped server-side).
  const usageQuery = useQuery<TemplateUsageResponse>({
    queryKey: ['/api/contract-templates/library', template.id, 'usage'],
    queryFn: async () => {
      const res = await fetch(`/api/contract-templates/library/${template.id}/usage`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load usage (${res.status})`);
      return res.json();
    },
    enabled: usageOpen,
    staleTime: 30_000,
  });

  const usageCount = template.usageCount;
  const usageContracts = usageQuery.data?.contracts ?? [];

  const visibilityBadge = template.isSystem
    ? { label: 'System', cls: 'bg-blue-50 border-blue-200 text-blue-700' }
    : template.visibility === 'public'
      ? { label: 'Company', cls: 'bg-purple-50 border-purple-200 text-purple-700' }
      : { label: 'Private', cls: 'bg-zinc-50 border-zinc-200 text-zinc-700' };

  return (
    <Card data-testid={`card-template-${template.id}`} className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <CardTitle
              className="text-base leading-tight truncate"
              data-testid={`text-template-name-${template.id}`}
            >
              {template.name}
            </CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-[10px]"
                data-testid={`badge-flow-${template.id}`}
              >
                {template.flowTypeName}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] ${visibilityBadge.cls}`}
                data-testid={`badge-visibility-${template.id}`}
              >
                {visibilityBadge.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] capitalize">
                {template.snapshotScope}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                data-testid={`button-menu-${template.id}`}
                aria-label="Template actions"
              >
                <span className="sr-only">Open menu</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Manage</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={onEdit}
                disabled={!canEdit}
                data-testid={`menu-edit-${template.id}`}
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                {canEdit ? 'Edit metadata' : 'Edit (owner only)'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                disabled={!canEdit}
                className={canEdit ? 'text-red-600 focus:text-red-600' : ''}
                data-testid={`menu-delete-${template.id}`}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                {template.isSystem
                  ? 'Delete (system)'
                  : canEdit
                    ? 'Delete'
                    : 'Delete (owner only)'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {template.description ? (
          <CardDescription
            className="text-xs line-clamp-3 mt-1"
            data-testid={`text-template-description-${template.id}`}
          >
            {template.description}
          </CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="pb-3 flex-1 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat
            icon={ListChecks}
            value={template.stats.rules}
            label="Rules"
            testId={`stat-rules-${template.id}`}
          />
          <Stat
            icon={FileText}
            value={template.stats.clauses}
            label="Clauses"
            testId={`stat-clauses-${template.id}`}
          />
          <Stat
            icon={Layers}
            value={template.stats.subtypes}
            label="Subtypes"
            testId={`stat-subtypes-${template.id}`}
          />
        </div>

        <div className="space-y-1.5">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground font-medium">
            Format guides
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_KINDS.map((s) => (
              <Button
                key={s.kind}
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2"
                onClick={() => onDownloadSample(s.kind)}
                data-testid={`button-download-${s.kind}-${template.id}`}
              >
                <Download className="h-3 w-3 mr-1" />
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 pt-1 border-t">
          <button
            type="button"
            onClick={() => setUsageOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 text-left rounded-md hover:bg-muted/40 px-1.5 py-1 transition-colors"
            data-testid={`button-toggle-usage-${template.id}`}
            aria-expanded={usageOpen}
          >
            <span className="flex items-center gap-1.5">
              {usageOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <Link2 className="h-3 w-3 text-muted-foreground" />
              <Badge
                variant="outline"
                className={`text-[10.5px] h-5 px-1.5 ${
                  usageCount > 0
                    ? 'bg-orange-50 border-orange-200 text-orange-700'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                }`}
                data-testid={`badge-usage-${template.id}`}
              >
                Used by {usageCount} {usageCount === 1 ? 'contract' : 'contracts'}
              </Badge>
            </span>
          </button>

          {usageOpen ? (
            <div
              className="rounded-md border bg-muted/20 px-2 py-1.5 max-h-48 overflow-y-auto"
              data-testid={`list-usage-${template.id}`}
            >
              {usageQuery.isLoading ? (
                <div
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-1"
                  data-testid={`state-usage-loading-${template.id}`}
                >
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading contracts…
                </div>
              ) : usageQuery.isError ? (
                <div
                  className="text-[11px] text-red-600 py-1"
                  data-testid={`state-usage-error-${template.id}`}
                >
                  Couldn't load contracts. Try again.
                </div>
              ) : usageContracts.length === 0 ? (
                <div
                  className="text-[11px] text-muted-foreground py-1"
                  data-testid={`state-usage-empty-${template.id}`}
                >
                  No contracts have been created from this template yet.
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {usageContracts.map((c) => {
                    const statusKey = (c.status || '').toLowerCase();
                    const statusCls = STATUS_BADGE_CLS[statusKey] || 'bg-zinc-50 border-zinc-200 text-zinc-600';
                    return (
                      <li key={c.id} data-testid={`row-usage-${template.id}-${c.id}`}>
                        <Link
                          href={`/contracts/${c.id}/analysis`}
                          className="group flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-background"
                          data-testid={`link-usage-contract-${c.id}`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span
                              className="text-[11.5px] truncate group-hover:underline"
                              data-testid={`text-usage-name-${c.id}`}
                            >
                              {c.displayName}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {c.status ? (
                              <Badge
                                variant="outline"
                                className={`text-[9.5px] h-4 px-1 capitalize ${statusCls}`}
                                data-testid={`badge-usage-status-${c.id}`}
                              >
                                {c.status}
                              </Badge>
                            ) : null}
                            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

interface StatProps {
  icon: typeof Library;
  value: number;
  label: string;
  testId: string;
}

function Stat({ icon: Icon, value, label, testId }: StatProps) {
  return (
    <div className="rounded-md border bg-muted/30 p-2" data-testid={testId}>
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}
