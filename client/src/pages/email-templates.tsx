import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Edit, Eye, RotateCcw, Send, Save, X, Code, FileText, ChevronLeft } from "lucide-react";
import { format } from "date-fns";

interface EmailTemplate {
  id: string;
  templateKey: string;
  name: string;
  subject: string;
  htmlBody: string;
  description: string | null;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function EmailTemplates() {
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [editSubject, setEditSubject] = useState("");
  const [editHtmlBody, setEditHtmlBody] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testTemplateId, setTestTemplateId] = useState("");

  const { data: templates, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/admin/email-templates'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PUT', `/api/admin/email-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-templates'] });
      toast({ title: "Template updated", description: "Email template saved successfully." });
      setEditingTemplate(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update template", variant: "destructive" });
    }
  });

  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/admin/email-templates/${id}/reset`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-templates'] });
      toast({ title: "Template reset", description: "Template restored to default." });
      setEditingTemplate(null);
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/admin/email-templates/${id}/preview`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      return apiRequest('POST', `/api/admin/email-templates/${id}/send-test`, { testEmail: email });
    },
    onSuccess: () => {
      toast({ title: "Test email sent", description: `Test email sent to ${testEmail}` });
      setShowTestDialog(false);
      setTestEmail("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to send test email", variant: "destructive" });
    }
  });

  const openEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setEditSubject(template.subject);
    setEditHtmlBody(template.htmlBody);
    setEditActive(template.isActive);
  };

  const saveEdit = () => {
    if (!editingTemplate) return;
    updateMutation.mutate({
      id: editingTemplate.id,
      data: { subject: editSubject, htmlBody: editHtmlBody, isActive: editActive },
    });
  };

  const openTest = (templateId: string) => {
    setTestTemplateId(templateId);
    setTestEmail("");
    setShowTestDialog(true);
  };

  if (editingTemplate) {
    return (
      <MainLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)} data-testid="button-back-templates">
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{editingTemplate.name}</h1>
              <p className="text-sm text-muted-foreground">{editingTemplate.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code className="h-4 w-4" /> Template Editor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Subject Line</Label>
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      data-testid="input-template-subject"
                    />
                  </div>
                  <div>
                    <Label>HTML Body (inner content — header/footer are added automatically)</Label>
                    <Textarea
                      value={editHtmlBody}
                      onChange={(e) => setEditHtmlBody(e.target.value)}
                      className="font-mono text-xs min-h-[400px]"
                      data-testid="input-template-body"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={editActive} onCheckedChange={setEditActive} data-testid="switch-template-active" />
                    <Label>Active</Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Label className="w-full text-sm text-muted-foreground">Available Variables:</Label>
                    {(editingTemplate.variables || []).map((v) => (
                      <Badge key={v} variant="outline" className="font-mono text-xs">{`{{${v}}}`}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={updateMutation.isPending} className="bg-orange-600 hover:bg-orange-700" data-testid="button-save-template">
                  <Save className="h-4 w-4 mr-1" /> {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => previewMutation.mutate(editingTemplate.id)} disabled={previewMutation.isPending} data-testid="button-preview-template">
                  <Eye className="h-4 w-4 mr-1" /> Preview
                </Button>
                <Button variant="outline" onClick={() => openTest(editingTemplate.id)} data-testid="button-test-template">
                  <Send className="h-4 w-4 mr-1" /> Send Test
                </Button>
                <Button variant="ghost" className="text-red-600" onClick={() => { if (confirm('Reset this template to the default? Your customizations will be lost.')) resetMutation.mutate(editingTemplate.id); }} data-testid="button-reset-template">
                  <RotateCcw className="h-4 w-4 mr-1" /> Reset to Default
                </Button>
              </div>
            </div>

            <div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Live Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {previewHtml ? (
                    <div className="space-y-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Subject:</span>{" "}
                        <span className="font-medium">{previewSubject}</span>
                      </div>
                      <div className="border rounded-lg overflow-hidden bg-white" style={{ minHeight: 400 }}>
                        <iframe
                          srcDoc={previewHtml}
                          className="w-full border-0"
                          style={{ height: 600 }}
                          title="Email Preview"
                          data-testid="iframe-email-preview"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                      <Eye className="h-10 w-10 mb-3 opacity-30" />
                      <p>Click "Preview" to see how this email will look</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Mail className="h-6 w-6 text-orange-600" /> Email Templates
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage email templates for customer communications. All emails use LicenseIQ branding.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No email templates found. They will be created automatically on server restart.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <Card key={template.id} className="hover:border-orange-300 transition-colors" data-testid={`card-template-${template.templateKey}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{template.name}</h3>
                        <Badge variant={template.isActive ? "default" : "secondary"} className={template.isActive ? "bg-green-600" : ""}>
                          {template.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Key: <code className="bg-muted px-1 rounded">{template.templateKey}</code>
                        </span>
                        <span>Subject: <em>{template.subject}</em></span>
                        {template.updatedAt && (
                          <span>Updated: {format(new Date(template.updatedAt), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(template.variables || []).map((v) => (
                          <Badge key={v} variant="outline" className="font-mono text-[10px] py-0">{`{{${v}}}`}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-4">
                      <Button variant="outline" size="sm" onClick={() => openEdit(template)} data-testid={`button-edit-${template.templateKey}`}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { previewMutation.mutate(template.id); setEditingTemplate(null); }} data-testid={`button-preview-${template.templateKey}`}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openTest(template.id)} data-testid={`button-test-${template.templateKey}`}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {previewHtml && !editingTemplate && (
          <Dialog open={!!previewHtml} onOpenChange={() => { setPreviewHtml(null); setPreviewSubject(""); }}>
            <DialogContent className="max-w-3xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle>Email Preview</DialogTitle>
              </DialogHeader>
              <div className="text-sm mb-2">
                <span className="text-muted-foreground">Subject:</span>{" "}
                <span className="font-medium">{previewSubject}</span>
              </div>
              <div className="border rounded-lg overflow-auto bg-white" style={{ maxHeight: '65vh' }}>
                <iframe
                  srcDoc={previewHtml}
                  className="w-full border-0"
                  style={{ height: 550 }}
                  title="Email Preview"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Test Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Recipient Email</Label>
                <Input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your@email.com"
                  type="email"
                  data-testid="input-test-email"
                />
                <p className="text-xs text-muted-foreground mt-1">Variable placeholders will show as [variableName]</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTestDialog(false)}>Cancel</Button>
              <Button
                onClick={() => sendTestMutation.mutate({ id: testTemplateId, email: testEmail })}
                disabled={!testEmail || sendTestMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
                data-testid="button-send-test-email"
              >
                <Send className="h-4 w-4 mr-1" />
                {sendTestMutation.isPending ? 'Sending...' : 'Send Test'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
