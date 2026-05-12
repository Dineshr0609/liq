import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUploadModal } from "@/contexts/upload-modal-context";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileText, BarChart3, Cpu, Cloud, Factory, Store, Film, Shield, Package,
  ArrowLeft, Plus, Loader2, BookTemplate, Pencil, CheckCircle2,
  Layers, ScrollText, FileBarChart, Database, Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const ICON_MAP: Record<string, any> = {
  FileText, BarChart3, Cpu, Cloud, Factory, Store, Film, Shield, Package
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  orange: { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-600", border: "border-orange-200 dark:border-orange-800", badge: "bg-orange-100 dark:bg-orange-900/30" },
  blue: { bg: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-600", border: "border-blue-200 dark:border-blue-800", badge: "bg-blue-100 dark:bg-blue-900/30" },
  purple: { bg: "bg-purple-50 dark:bg-purple-950/20", text: "text-purple-600", border: "border-purple-200 dark:border-purple-800", badge: "bg-purple-100 dark:bg-purple-900/30" },
  cyan: { bg: "bg-cyan-50 dark:bg-cyan-950/20", text: "text-cyan-600", border: "border-cyan-200 dark:border-cyan-800", badge: "bg-cyan-100 dark:bg-cyan-900/30" },
  green: { bg: "bg-green-50 dark:bg-green-950/20", text: "text-green-600", border: "border-green-200 dark:border-green-800", badge: "bg-green-100 dark:bg-green-900/30" },
  red: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-600", border: "border-red-200 dark:border-red-800", badge: "bg-red-100 dark:bg-red-900/30" },
  pink: { bg: "bg-pink-50 dark:bg-pink-950/20", text: "text-pink-600", border: "border-pink-200 dark:border-pink-800", badge: "bg-pink-100 dark:bg-pink-900/30" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-600", border: "border-amber-200 dark:border-amber-800", badge: "bg-amber-100 dark:bg-amber-900/30" },
  teal: { bg: "bg-teal-50 dark:bg-teal-950/20", text: "text-teal-600", border: "border-teal-200 dark:border-teal-800", badge: "bg-teal-100 dark:bg-teal-900/30" },
};

export default function NewContract() {
  const [, setLocation] = useLocation();
  const { open: openUploadModal } = useUploadModal();
  const { toast } = useToast();
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);

  const { data: templatesData, isLoading } = useQuery<{ templates: any[] }>({
    queryKey: ["/api/contract-templates"],
  });

  const templates = templatesData?.templates || [];

  const createFromTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/contract-templates/${templateId}/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create contract from template');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      toast({
        title: 'Contract Created',
        description: `"${data.templateName}" has been created with all sample data.`,
      });
      setCreatingTemplate(null);
      setLocation(`/contracts/${data.contractId}`);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setCreatingTemplate(null);
    },
  });

  const handleCreateFromTemplate = (templateId: string) => {
    setCreatingTemplate(templateId);
    createFromTemplateMutation.mutate(templateId);
  };

  return (
    <MainLayout title="New Contract" description="Choose how to create your new contract">
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} data-testid="button-back-contracts">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Contracts
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card 
            className="border-2 border-dashed border-orange-300 dark:border-orange-700 hover:border-orange-500 dark:hover:border-orange-500 transition-colors cursor-pointer group"
            onClick={() => setLocation("/contracts/new/manage")}
            data-testid="card-start-from-scratch"
          >
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Pencil className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start from Scratch</h3>
              <p className="text-sm text-muted-foreground">
                Create a blank contract and fill in all the details manually. Best for unique agreements that don't fit a standard template.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed border-muted-foreground/20 bg-muted/30">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Upload Contract</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a contract document (PDF, Word) and let our AI-native engine extract all terms, rules, and clauses automatically.
              </p>
              <Button variant="outline" onClick={() => openUploadModal()} data-testid="button-upload-contract">
                Upload Document
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <BookTemplate className="h-5 w-5 text-orange-600" />
            <h2 className="text-xl font-semibold">Contract Templates</h2>
            <Badge variant="outline" className="text-xs">{templates.length} templates</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Select a template to instantly create a fully populated contract with rules, terms, clauses, and sample sales data. 
            Each template demonstrates a different contract type with realistic data across all tabs.
          </p>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-56 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template: any) => {
                const colors = COLOR_MAP[template.color] || COLOR_MAP.orange;
                const IconComponent = ICON_MAP[template.icon] || FileText;
                const isCreating = creatingTemplate === template.id;

                return (
                  <Card
                    key={template.id}
                    className={`border ${colors.border} hover:shadow-md transition-all cursor-pointer group ${isCreating ? 'opacity-70 pointer-events-none' : ''}`}
                    onClick={() => !isCreating && handleCreateFromTemplate(template.id)}
                    data-testid={`card-template-${template.id}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`p-2.5 rounded-xl ${colors.badge} shrink-0`}>
                          {isCreating ? (
                            <Loader2 className={`h-5 w-5 ${colors.text} animate-spin`} />
                          ) : (
                            <IconComponent className={`h-5 w-5 ${colors.text}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm leading-tight mb-1 group-hover:text-orange-600 transition-colors">
                            {template.name}
                          </h3>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                              {template.contractTypeName}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{template.duration}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {template.description}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t pt-2">
                        <span className="flex items-center gap-1" data-testid={`stat-rules-${template.id}`}>
                          <Layers className="h-3 w-3" />
                          {template.stats.rules} Rules
                        </span>
                        <span className="flex items-center gap-1" data-testid={`stat-terms-${template.id}`}>
                          <ScrollText className="h-3 w-3" />
                          {template.stats.terms} Terms
                        </span>
                        <span className="flex items-center gap-1">
                          <FileBarChart className="h-3 w-3" />
                          {template.stats.clauses} Clauses
                        </span>
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          {template.stats.salesRecords} Sales
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/api/contract-templates/${template.id}/sample/sales`, '_blank');
                          }}
                          className="ml-auto flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium transition-colors"
                          title="Download sample sales data CSV"
                          data-testid={`btn-download-sales-${template.id}`}
                        >
                          <Download className="h-3 w-3" />
                          Sales CSV
                        </button>
                      </div>

                      {isCreating && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-orange-600">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Creating contract...
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className={`rounded-lg p-4 bg-muted/50 border`}>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Each template creates a fully analyzed contract with all tabs populated: analysis summary, rules (all 6 editor tabs), 
                contract terms, pipeline clauses, and matching sales transactions ready for calculation testing. 
                You can modify any template contract after creation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
