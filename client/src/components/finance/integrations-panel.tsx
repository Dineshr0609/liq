import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, RotateCcw, Copy, Trash, Download } from "lucide-react";

interface ApiKey { id: string; label: string; keyPrefix: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string; isActive?: boolean; }
interface InboundEvent { id: string; sourceEventId: string; eventType: string; receivedAt: string; outcome: string | null; signatureValid?: boolean; payload?: any; errorMessage?: string | null; }

export function IntegrationsPanel() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>API Keys & Inbound Events</CardTitle>
            <CardDescription>Manage credentials for the public <code className="text-xs">/api/inbound-events</code> endpoint and inspect events received by the LicenseIQ Intake Agent.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" data-testid="button-download-envelope-schema">
            <a href="/api/inbound-events/schema" download="licenseiq-inbound-event-schema.json"><Download className="mr-1 h-3 w-3" /> Envelope Schema</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="keys">
          <TabsList>
            <TabsTrigger value="keys" data-testid="tab-api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="events" data-testid="tab-event-log">Event Log</TabsTrigger>
          </TabsList>
          <TabsContent value="keys" className="mt-4"><ApiKeysSection /></TabsContent>
          <TabsContent value="events" className="mt-4"><EventLogSection /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ApiKeysSection() {
  const { toast } = useToast();
  const { data: keys, isLoading } = useQuery<ApiKey[]>({ queryKey: ["/api/finance/api-keys"] });
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLegalEntity, setNewLegalEntity] = useState("");
  const [createdSecret, setCreatedSecret] = useState<{ keyPrefix: string; secret: string } | null>(null);

  const createMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/finance/api-keys", { label: newName, legalEntityId: newLegalEntity.trim() || null })).json(),
    onSuccess: (k: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/api-keys"] });
      setCreatedSecret({ keyPrefix: k.keyPrefix, secret: k.secret });
      setNewName("");
      setNewLegalEntity("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const revokeMut = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/finance/api-keys/${id}/revoke`, {})).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance/api-keys"] }); toast({ title: "Key revoked" }); },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Each key is shown once on creation. Store the secret securely.</p>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-orange-600 hover:bg-orange-700" data-testid="button-create-api-key"><Plus className="mr-1 h-3 w-3" /> New API Key</Button>
      </div>
      <div className="rounded border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Prefix</th><th className="px-3 py-2">Legal Entity Scope</th><th className="px-3 py-2">Last Used</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs">Loading…</td></tr>}
            {(keys || []).map((k: any) => (
              <tr key={k.id} className="border-t border-neutral-100" data-testid={`row-api-key-${k.id}`}>
                <td className="px-3 py-2">{k.label}</td>
                <td className="px-3 py-2 font-mono text-xs">{k.keyPrefix}…</td>
                <td className="px-3 py-2 font-mono text-[11px]" data-testid={`text-key-legal-entity-${k.id}`}>{k.legalEntityId || <span className="text-muted-foreground">All</span>}</td>
                <td className="px-3 py-2 text-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td>
                <td className="px-3 py-2">{k.revokedAt ? <Badge variant="outline" className="text-[10px]">Revoked</Badge> : <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>}</td>
                <td className="px-3 py-2 text-right">{!k.revokedAt && <Button size="sm" variant="ghost" onClick={() => revokeMut.mutate(k.id)} data-testid={`button-revoke-${k.id}`}><Trash className="h-3 w-3" /></Button>}</td>
              </tr>
            ))}
            {!isLoading && (keys || []).length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">No API keys yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreatedSecret(null); }}>
        <DialogContent data-testid="dialog-new-api-key">
          <DialogHeader><DialogTitle>{createdSecret ? "Save Your Secret" : "New API Key"}</DialogTitle></DialogHeader>
          {createdSecret ? (
            <div className="space-y-3">
              <p className="text-sm text-orange-700">This is the only time the secret is shown. Copy it now.</p>
              <div className="rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs break-all" data-testid="text-new-secret">{createdSecret.secret}</div>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdSecret.secret); }} data-testid="button-copy-secret"><Copy className="mr-1 h-3 w-3" /> Copy</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Key Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. ERP Inbound" data-testid="input-key-name" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Legal Entity Scope (optional)</label>
                <Input value={newLegalEntity} onChange={(e) => setNewLegalEntity(e.target.value)} placeholder="Leave blank to allow any entity for this tenant" data-testid="input-key-legal-entity" />
                <p className="text-[10px] text-muted-foreground">When set, inbound events from this key are pinned to the specified legal_entity_id and any envelope claiming a different entity is rejected.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            {createdSecret ? (
              <Button onClick={() => { setCreateOpen(false); setCreatedSecret(null); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="bg-orange-600 hover:bg-orange-700" disabled={!newName || createMut.isPending} onClick={() => createMut.mutate()} data-testid="button-confirm-create-key">Create</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventLogSection() {
  const { toast } = useToast();
  const { data: events, isLoading } = useQuery<InboundEvent[]>({ queryKey: ["/api/finance/inbound-events"], refetchInterval: 8000 });
  const [selected, setSelected] = useState<InboundEvent | null>(null);

  const replayMut = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/finance/inbound-events/${id}/replay`, {})).json(),
    onSuccess: (r: any) => { toast({ title: "Replayed", description: r.outcome }); queryClient.invalidateQueries({ queryKey: ["/api/finance/inbound-events"] }); queryClient.invalidateQueries({ queryKey: ["/api/finance/claims"] }); },
    onError: (e: any) => toast({ title: "Replay failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs"><tr><th className="px-2 py-2">Received</th><th className="px-2 py-2">Type</th><th className="px-2 py-2">Signature</th><th className="px-2 py-2">Outcome</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="px-2 py-6 text-center text-xs">Loading…</td></tr>}
            {(events || []).map(e => (
              <tr key={e.id} className={`cursor-pointer border-t border-neutral-100 ${selected?.id === e.id ? "bg-orange-50" : "hover:bg-neutral-50"}`} onClick={() => setSelected(e)} data-testid={`row-event-${e.id}`}>
                <td className="px-2 py-1.5 text-[11px]">{new Date(e.receivedAt).toLocaleString()}</td>
                <td className="px-2 py-1.5 text-[11px] font-mono">{e.eventType}</td>
                <td className="px-2 py-1.5"><Badge variant="outline" className="text-[10px]">{e.signatureValid ? "valid" : "invalid"}</Badge></td>
                <td className="px-2 py-1.5 text-[11px]">{e.outcome || "—"}</td>
              </tr>
            ))}
            {!isLoading && (events || []).length === 0 && <tr><td colSpan={4} className="px-2 py-6 text-center text-xs text-muted-foreground">No events received.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="rounded border border-neutral-200 p-3">
        {selected ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{selected.eventType}</div>
              <Button size="sm" variant="outline" onClick={() => replayMut.mutate(selected.id)} disabled={replayMut.isPending} data-testid="button-replay-event"><RotateCcw className="mr-1 h-3 w-3" /> Replay</Button>
            </div>
            <div className="text-xs text-muted-foreground">Source: {selected.sourceEventId}</div>
            {selected.errorMessage && <div className="text-xs text-red-600">{selected.errorMessage}</div>}
            <pre className="max-h-80 overflow-auto rounded bg-neutral-50 p-2 text-[10px]">{JSON.stringify(selected.payload, null, 2)}</pre>
          </div>
        ) : <div className="text-center text-xs text-muted-foreground">Select an event to inspect.</div>}
      </div>
    </div>
  );
}
