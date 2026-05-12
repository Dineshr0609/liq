import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Upload as UploadIcon,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  Tag,
  Pencil,
  CheckCircle2,
  ArrowLeft,
  Eye,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useUploadModal } from "@/contexts/upload-modal-context";
import { useToast } from "@/hooks/use-toast";

type FlowType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

type PreviewData = {
  tempFilePath: string;
  tempFileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  pageCount: number;
  textPreview: string;
  textLength: number;
  aiMetadata: {
    suggestedName?: string;
    parties?: string[];
    effectiveDate?: string;
    expiryDate?: string;
    estimatedValue?: string;
    summary?: string;
  };
};

type DuplicateUpload = {
  id: string;
  contractNumber?: string;
  displayName?: string;
  originalName?: string;
  status?: string;
};

type Phase = "form" | "review";

const ACCEPTED_EXTS = [".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg"];
const ACCEPTED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg",
];

function formatFileSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function UploadFlowModal() {
  const { isOpen, close } = useUploadModal();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [phase, setPhase] = useState<Phase>("form");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [flowTypeCode, setFlowTypeCode] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [notes, setNotes] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [duplicateUpload, setDuplicateUpload] = useState<DuplicateUpload | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const { data: flowTypesData } = useQuery<FlowType[]>({
    queryKey: ["/api/pipeline/flow-types"],
    enabled: isOpen,
  });
  const activeFlowTypes = (Array.isArray(flowTypesData) ? flowTypesData : []).filter(
    (ft) => ft.isActive,
  );

  // Reset all internal state whenever the modal closes so reopening starts
  // from a clean form.
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setPhase("form");
        setSelectedFile(null);
        setFlowTypeCode("");
        setPriority("normal");
        setNotes("");
        setMoreOpen(false);
        setPreviewData(null);
        setDuplicateUpload(null);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Esc closes when not mid-flight.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !previewMutation.isPending && !uploadMutation.isPending) {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch("/api/contracts/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data?.error === "duplicate_upload") {
        const err: any = new Error(data.message || "Duplicate upload detected");
        err.duplicate = data.existingContract;
        throw err;
      }
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Preview failed");
      }
      return data as PreviewData;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setPhase("review");
    },
    onError: (error: any) => {
      if (error?.duplicate) {
        setDuplicateUpload(error.duplicate);
        return;
      }
      toast({
        title: "Couldn't scan that file",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (force: boolean = false) => {
      if (!previewData) throw new Error("No preview data");
      const formData = new FormData();
      formData.append("tempFileName", previewData.tempFileName);
      formData.append("originalName", previewData.originalName);
      formData.append("fileSize", String(previewData.fileSize));
      formData.append("mimeType", previewData.mimeType);
      formData.append("flowTypeCode", flowTypeCode);
      formData.append("priority", priority);
      formData.append("notes", notes);
      if (force) formData.append("force", "true");
      const response = await fetch("/api/contracts/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data?.error === "duplicate_upload") {
        const err: any = new Error(data.message || "Duplicate upload detected");
        err.duplicate = data.existingContract;
        throw err;
      }
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Upload failed");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Contract created",
        description: "AI extraction has started — opening the contract now.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/metrics"] });
      close();
      setLocation(`/contracts/${data.id}`);
    },
    onError: (error: any) => {
      if (error?.duplicate) {
        setDuplicateUpload(error.duplicate);
        return;
      }
      toast({
        title: "Couldn't create contract",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChosen = (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
  };

  const handleStartUpload = () => {
    if (!selectedFile) {
      toast({
        title: "Pick a file first",
        description: "Drop a contract document or browse for one.",
        variant: "destructive",
      });
      return;
    }
    if (!flowTypeCode) {
      toast({
        title: "Pick a flow type",
        description: "Tell us what kind of contract this is.",
        variant: "destructive",
      });
      return;
    }
    previewMutation.mutate();
  };

  const handleConfirm = () => {
    uploadMutation.mutate(false);
  };

  const handleReupload = () => {
    setPreviewData(null);
    setPhase("form");
  };

  if (!isOpen) return null;

  const isFlightInProgress = previewMutation.isPending || uploadMutation.isPending;

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-zinc-900/40 backdrop-blur-[1px] z-40"
        onClick={() => !isFlightInProgress && close()}
        data-testid="modal-upload-scrim"
      />

      {/* Phase 1 — Upload modal */}
      {phase === "form" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 pointer-events-none">
          <div
            className="bg-white rounded-lg shadow-2xl w-[520px] border border-zinc-200 pointer-events-auto"
            data-testid="modal-upload-form"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadIcon className="h-4 w-4 text-orange-600" />
                <h2 className="text-sm font-bold text-zinc-900">Upload contract</h2>
              </div>
              <button
                className="text-zinc-400 hover:text-zinc-700"
                onClick={close}
                disabled={isFlightInProgress}
                data-testid="button-close-upload-modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Drop zone */}
              <label
                htmlFor="upload-flow-file-input"
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileChosen(file);
                }}
                className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? "border-orange-500 bg-orange-50"
                    : "border-orange-300 bg-orange-50/40 hover:bg-orange-50"
                }`}
                data-testid="upload-dropzone"
              >
                <input
                  id="upload-flow-file-input"
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_EXTS.join(",")}
                  onChange={(e) => handleFileChosen(e.target.files?.[0] || null)}
                  data-testid="input-upload-file"
                />
                <div className="h-10 w-10 mx-auto rounded-full bg-orange-100 flex items-center justify-center mb-2">
                  <UploadIcon className="h-5 w-5 text-orange-600" />
                </div>
                <div className="text-sm font-semibold text-zinc-900">
                  Drop a file or <span className="text-orange-600 underline">browse</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  PDF, DOCX, PNG up to 50 MB
                </div>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-[9px]">
                  {["PDF", "DOCX", "PNG", "JPG"].map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600 font-semibold"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </label>

              {/* Flow type */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-700 flex items-center gap-1">
                  Flow type <span className="text-red-500">*</span>
                  <span className="text-[10px] font-normal text-zinc-400 ml-1">
                    — what kind of contract is this?
                  </span>
                </label>
                <div className="mt-1.5 relative">
                  <select
                    value={flowTypeCode}
                    onChange={(e) => setFlowTypeCode(e.target.value)}
                    className="w-full text-[12px] border border-zinc-300 rounded px-2.5 py-1.5 bg-white text-zinc-900 appearance-none pr-8"
                    data-testid="select-flow-type"
                  >
                    <option value="">Select flow type…</option>
                    {activeFlowTypes.map((ft) => (
                      <option key={ft.id || ft.code} value={ft.code}>
                        {ft.code} — {ft.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                </div>
              </div>

              {/* More options */}
              <div>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  className="w-full text-left flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-700"
                  data-testid="button-toggle-more-options"
                >
                  {moreOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}{" "}
                  More options
                  <span className="text-[10px] text-zinc-400 ml-1">
                    (priority, notes)
                  </span>
                </button>
                {moreOpen && (
                  <div className="mt-2 space-y-2 pl-4">
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">
                        Priority
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="mt-1 w-full text-[12px] border border-zinc-300 rounded px-2 py-1 bg-white"
                        data-testid="select-priority"
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">
                        Notes
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Optional notes about this contract…"
                        className="mt-1 w-full text-[12px] border border-zinc-300 rounded px-2 py-1 bg-white resize-none"
                        data-testid="textarea-notes"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Selected file preview */}
              {selectedFile && (
                <div className="border border-zinc-200 rounded bg-zinc-50/50 px-3 py-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-zinc-500" />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[11px] font-semibold text-zinc-800 truncate"
                      data-testid="text-selected-filename"
                    >
                      {selectedFile.name}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {formatFileSize(selectedFile.size)}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    disabled={isFlightInProgress}
                    className="text-zinc-400 hover:text-zinc-700"
                    data-testid="button-clear-selected-file"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between rounded-b-lg">
              <div className="text-[10px] text-zinc-500">
                ~30 sec extract · auto-routed to AI
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={close}
                  disabled={isFlightInProgress}
                  className="text-[11px] px-3 py-1.5 text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
                  data-testid="button-cancel-upload"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartUpload}
                  disabled={isFlightInProgress || !selectedFile || !flowTypeCode}
                  className="text-[11px] px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold flex items-center gap-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-upload-and-process"
                >
                  {previewMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Scanning…
                    </>
                  ) : (
                    <>
                      Upload &amp; process <ChevronRight className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2 — Review sheet */}
      {phase === "review" && previewData && (
        <ReviewSheet
          previewData={previewData}
          flowTypeCode={flowTypeCode}
          flowTypeLabel={
            activeFlowTypes.find((ft) => ft.code === flowTypeCode)?.name || flowTypeCode
          }
          isPending={uploadMutation.isPending}
          onClose={close}
          onReupload={handleReupload}
          onConfirm={handleConfirm}
        />
      )}

      {/* Duplicate upload dialog (sits above either phase) */}
      {duplicateUpload && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50"
          onClick={() => !isFlightInProgress && setDuplicateUpload(null)}
          data-testid="modal-duplicate-upload"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg shadow-xl border border-amber-200 w-[480px] p-5"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-700" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-zinc-900">
                  This file is already uploaded
                </div>
                <div className="text-[12px] text-zinc-600 mt-1">
                  An identical file is already on record as{" "}
                  <span className="font-semibold text-zinc-900">
                    {duplicateUpload.contractNumber || duplicateUpload.id.slice(0, 8)}
                  </span>
                  {duplicateUpload.displayName ? (
                    <>
                      {" "}
                      — <span className="italic">{duplicateUpload.displayName}</span>
                    </>
                  ) : null}
                  . Open it, or upload this file again as a new copy.
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                onClick={() => setDuplicateUpload(null)}
                disabled={isFlightInProgress}
                className="text-xs px-3 py-1.5 rounded border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                data-testid="button-cancel-duplicate"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const id = duplicateUpload.id;
                  setDuplicateUpload(null);
                  close();
                  setLocation(`/contracts/${id}`);
                }}
                disabled={isFlightInProgress}
                className="text-xs px-3 py-1.5 rounded border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 font-semibold"
                data-testid="button-open-existing"
              >
                Open existing
              </button>
              <button
                onClick={() => {
                  setDuplicateUpload(null);
                  // If we already have preview data we can force-create from
                  // it; otherwise we need to re-run preview first.
                  if (previewData) {
                    uploadMutation.mutate(true);
                  } else if (selectedFile) {
                    previewMutation.mutate();
                  }
                }}
                disabled={isFlightInProgress}
                className="text-xs px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-white font-semibold disabled:opacity-50"
                data-testid="button-upload-anyway"
              >
                Upload anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetaRow({
  icon,
  label,
  value,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-zinc-100 last:border-0">
      <div className="text-zinc-400 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">
          {label}
        </div>
        <div
          className="text-[12px] text-zinc-900 font-semibold mt-0.5 break-words"
          data-testid={testId}
        >
          {value}
        </div>
      </div>
      <Pencil className="h-3 w-3 text-zinc-300" />
    </div>
  );
}

function ReviewSheet({
  previewData,
  flowTypeCode,
  flowTypeLabel,
  isPending,
  onClose,
  onReupload,
  onConfirm,
}: {
  previewData: PreviewData;
  flowTypeCode: string;
  flowTypeLabel: string;
  isPending: boolean;
  onClose: () => void;
  onReupload: () => void;
  onConfirm: () => void;
}) {
  const meta = previewData.aiMetadata || {};
  const partiesText =
    meta.parties && meta.parties.length > 0
      ? meta.parties.join("  ·  ")
      : "Will be detected during AI extraction";
  const datesText =
    meta.effectiveDate || meta.expiryDate
      ? `${meta.effectiveDate || "TBD"} → ${meta.expiryDate || "TBD"}`
      : "Will be detected during AI extraction";
  const valueText =
    meta.estimatedValue && meta.estimatedValue !== "null"
      ? meta.estimatedValue
      : "Will be detected during AI extraction";

  return (
    <aside
      className="fixed top-0 right-0 h-screen w-full sm:w-[640px] max-w-[100vw] bg-white shadow-2xl z-50 border-l border-zinc-200 flex flex-col pointer-events-auto"
      data-testid="sheet-review"
    >
      {/* Sheet header */}
      <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={onReupload}
            disabled={isPending}
            className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50"
            data-testid="button-back-to-form"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Review before creating</h2>
            <div className="text-[10px] text-zinc-500">
              Verify what the AI extracted, then confirm to create the contract
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          disabled={isPending}
          className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50"
          data-testid="button-close-review-sheet"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stepper */}
      <div className="px-5 py-2 border-b border-zinc-100 flex items-center gap-3 text-[10px]">
        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" /> Upload
        </div>
        <div className="h-px w-6 bg-zinc-200" />
        <div className="flex items-center gap-1.5 text-orange-700 font-bold">
          <span className="h-4 w-4 rounded-full bg-orange-600 text-white text-[9px] flex items-center justify-center">
            2
          </span>
          Review &amp; approve
        </div>
        <div className="h-px w-6 bg-zinc-200" />
        <div className="flex items-center gap-1.5 text-zinc-400 font-semibold">
          <span className="h-4 w-4 rounded-full border border-zinc-300 text-[9px] flex items-center justify-center">
            3
          </span>
          AI processing
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* File card */}
        <div className="bg-zinc-50 border border-zinc-200 rounded p-3 flex items-center gap-3">
          <div className="h-10 w-8 rounded bg-orange-100 flex items-center justify-center">
            <FileText className="h-4 w-4 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-[12px] font-bold text-zinc-900 truncate"
              data-testid="text-review-filename"
            >
              {previewData.originalName}
            </div>
            <div className="text-[10px] text-zinc-500">
              {formatFileSize(previewData.fileSize)} · ~{previewData.pageCount} pages
              {previewData.textLength > 0
                ? ` · ${previewData.textLength.toLocaleString()} chars extracted`
                : ""}
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {meta.summary && (
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-[11px] font-bold text-zinc-800">AI summary</span>
            </div>
            <div
              className="p-3 text-[12px] text-zinc-700 leading-relaxed"
              data-testid="text-ai-summary"
            >
              {meta.summary}
            </div>
          </div>
        )}

        {/* AI-detected key fields */}
        <div className="bg-white border border-zinc-200 rounded">
          <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-[11px] font-bold text-zinc-800">
                AI-detected details
              </span>
            </div>
            <span className="text-[9px] text-zinc-500">
              you'll be able to edit anything on the contract page
            </span>
          </div>
          <div className="p-3">
            <MetaRow
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Contract name"
              value={meta.suggestedName || previewData.originalName}
              testId="meta-name"
            />
            <MetaRow
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="Flow type"
              value={`${flowTypeCode} — ${flowTypeLabel}`}
              testId="meta-flow"
            />
            <MetaRow
              icon={<Users className="h-3.5 w-3.5" />}
              label="Parties"
              value={partiesText}
              testId="meta-parties"
            />
            <MetaRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Effective"
              value={datesText}
              testId="meta-dates"
            />
            <MetaRow
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Estimated value"
              value={valueText}
              testId="meta-value"
            />
          </div>
        </div>

        {/* Text preview */}
        {previewData.textPreview ? (
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[11px] font-bold text-zinc-800">Text preview</span>
              <span className="text-[9px] text-zinc-400 ml-auto">
                first {Math.min(previewData.textPreview.length, 5000).toLocaleString()}{" "}
                chars
              </span>
            </div>
            <div className="p-3 max-h-[160px] overflow-y-auto">
              <pre className="text-[10px] font-mono whitespace-pre-wrap text-zinc-600 leading-relaxed">
                {previewData.textPreview.slice(0, 5000)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-900 leading-relaxed">
              No text could be extracted from this file. The AI will attempt OCR after
              the contract is created.
            </div>
          </div>
        )}

        {/* What happens next */}
        <div className="bg-orange-50/60 border border-orange-200 rounded p-3">
          <div className="text-[11px] font-bold text-orange-900 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> What happens after you confirm
          </div>
          <ol className="text-[11px] text-orange-900 space-y-1 list-decimal list-inside">
            <li>The contract is created and the page opens immediately.</li>
            <li>
              5 AI agents run in the background — terms, rules, master-data,
              qualifiers, verification.
            </li>
            <li>
              The page is read-only while AI works. Editing unlocks when extraction
              completes.
            </li>
          </ol>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
        <button
          onClick={onClose}
          disabled={isPending}
          className="text-[11px] text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
          data-testid="button-cancel-review"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onReupload}
            disabled={isPending}
            className="text-[11px] px-3 py-1.5 text-zinc-700 border border-zinc-300 rounded bg-white hover:bg-zinc-50 disabled:opacity-50"
            data-testid="button-reupload"
          >
            Re-upload
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="text-[11px] px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold shadow-sm flex items-center gap-1 disabled:opacity-50"
            data-testid="button-confirm-create"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirm &amp; create contract
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
