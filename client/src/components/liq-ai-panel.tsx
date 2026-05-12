import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormattedAnswer } from "@/components/ui/formatted-answer";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Sparkles, Send, CheckCircle2, ChevronDown, X, FileText,
  PanelRightClose, PanelRight, MessageSquare, Trash2, Bot,
} from "lucide-react";

const LIQ_PANEL_WIDTH_KEY = 'liq-ai-panel-width';
const MIN_PANEL_WIDTH = 340;
const MAX_PANEL_WIDTH = 560;

interface Message {
  type: 'question' | 'answer';
  content: string;
  sources?: Array<{ contractName: string; relevantText: string; similarity: number }>;
  confidence?: number;
  timestamp: Date;
}

interface PageContext {
  page: string;
  label: string;
  icon: string;
  contractId?: string;
  contractName?: string;
  suggestions: string[];
}

function getPageContext(pathname: string): PageContext {
  const contractMatch = pathname.match(/\/contracts\/([^/]+)/);
  const calcMatch = pathname.match(/\/calculations\/([^/]+)/);

  if (pathname === '/' || pathname === '/financial-control-center') {
    return {
      page: 'financial-control-center', label: 'Financial Control Center', icon: '🏠',
      suggestions: [
        "What is the overall financial health?",
        "Show me period close readiness",
        "What contracts need attention?",
        "Summarize accrual exposure",
      ],
    };
  }
  if (contractMatch && pathname.includes('/rules')) {
    return {
      page: 'rules', label: 'Rules Management', icon: '⚙️',
      contractId: contractMatch[1],
      suggestions: [
        "Explain these contract fee rules",
        "Which rules have the highest rates?",
        "Are there any conflicting rules?",
        "What product categories are covered?",
      ],
    };
  }
  if (contractMatch) {
    return {
      page: 'contract-analysis', label: 'Contract Analysis', icon: '📋',
      contractId: contractMatch[1],
      suggestions: [
        "Summarize this contract",
        "What are the key fee terms?",
        "Identify risks in this contract",
        "What territories are covered?",
      ],
    };
  }
  if (pathname === '/contracts') {
    return {
      page: 'contracts', label: 'Contract Search', icon: '🔍',
      suggestions: [
        "How many active contracts do I have?",
        "Which contracts expire this quarter?",
        "Show contracts with highest fee rates",
        "List contracts missing rules",
      ],
    };
  }
  if (calcMatch) {
    return {
      page: 'calculation-detail', label: 'Calculation Detail', icon: '🧮',
      suggestions: [
        "Explain this calculation breakdown",
        "Why is this amount different from last period?",
        "Show the rules applied",
        "Are there any calculation errors?",
      ],
    };
  }
  if (pathname === '/calculations') {
    return {
      page: 'calculations', label: 'Calculation Engine', icon: '🧮',
      suggestions: [
        "Show pending calculations",
        "Which contracts need recalculation?",
        "What is total fee exposure?",
        "Compare this period to last period",
      ],
    };
  }
  if (pathname === '/accrual-management') {
    return {
      page: 'accruals', label: 'Accrual Management', icon: '📊',
      suggestions: [
        "Show pending accruals",
        "What is total accrual exposure?",
        "Which accruals need approval?",
        "Detect anomalies in accruals",
      ],
    };
  }
  if (pathname === '/journal-entry-hub') {
    return {
      page: 'journal-entries', label: 'Journal Entry Hub', icon: '📓',
      suggestions: [
        "Show unposted journal entries",
        "What is the DR/CR balance?",
        "Which JEs are ready for ERP sync?",
        "Summarize JE activity this period",
      ],
    };
  }
  if (pathname === '/period-close-workspace') {
    return {
      page: 'period-close', label: 'Period Close', icon: '🔒',
      suggestions: [
        "What is blocking period close?",
        "Show period close checklist status",
        "What is the readiness score?",
        "Which contracts aren't closed yet?",
      ],
    };
  }
  if (pathname === '/sales-upload') {
    return {
      page: 'sales', label: 'Sales Data', icon: '📈',
      suggestions: [
        "How much sales data has been uploaded?",
        "Show recent upload status",
        "Which contracts need sales data?",
        "What file formats are supported?",
      ],
    };
  }
  if (pathname === '/upload') {
    return {
      page: 'upload', label: 'Upload & Process', icon: '⬆️',
      suggestions: [
        "What file types can I upload?",
        "How does contract processing work?",
        "What is the extraction accuracy?",
        "How long does processing take?",
      ],
    };
  }
  return {
    page: 'general', label: 'LicenseIQ', icon: '✦',
    suggestions: [
      "What is LicenseIQ?",
      "How does the rule engine work?",
      "What are the contract fee rates?",
      "Show me active contracts",
    ],
  };
}

export function openLiqAI(prefillQuestion?: string, autoSend?: boolean) {
  window.dispatchEvent(new CustomEvent('liq-ai-open', { detail: { question: prefillQuestion || '', autoSend: autoSend || false } }));
}

export function LiqAIPanel() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('liq-ai-panel-open');
    return saved !== null ? saved === 'true' : true;
  });
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [location] = useLocation();

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem(LIQ_PANEL_WIDTH_KEY);
    return saved ? Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, parseInt(saved, 10))) : MIN_PANEL_WIDTH;
  });
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(MIN_PANEL_WIDTH);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartXRef.current - ev.clientX;
      const newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, dragStartWidthRef.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setPanelWidth(prev => {
        localStorage.setItem(LIQ_PANEL_WIDTH_KEY, String(prev));
        return prev;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  const context = getPageContext(location);

  useEffect(() => {
    localStorage.setItem('liq-ai-panel-open', String(isOpen));
  }, [isOpen]);

  const pendingQuestionRef = useRef<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsOpen(true);
      if (detail?.question) {
        if (detail?.autoSend) {
          pendingQuestionRef.current = detail.question;
          setQuestion(detail.question);
        } else {
          setQuestion(detail.question);
        }
      }
    };
    window.addEventListener('liq-ai-open', handler);
    return () => window.removeEventListener('liq-ai-open', handler);
  }, []);

  useEffect(() => {
    if (pendingQuestionRef.current && !isAsking) {
      const q = pendingQuestionRef.current;
      pendingQuestionRef.current = null;
      setTimeout(() => handleAsk(q), 100);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askMutation = useMutation({
    mutationFn: async (q: string) => {
      const conversationHistory = messages.slice(-8).map(m => ({
        role: m.type === 'question' ? 'user' : 'assistant',
        content: m.content.length > 2000 ? m.content.slice(0, 2000) + '...' : m.content,
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);

      try {
        const response = await apiRequest('POST', '/api/liq-agent/ask', {
          question: q,
          pageContext: {
            page: context.page,
            label: context.label,
            contractId: context.contractId || undefined,
          },
          conversationHistory,
        });
        clearTimeout(timeoutId);
        return response.json();
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Request timed out. Please try a simpler question.');
        }
        throw err;
      }
    },
    onSuccess: (data: any) => {
      setMessages(prev => [
        ...prev,
        {
          type: 'answer', content: data.answer, sources: data.sources,
          confidence: data.confidence, timestamp: new Date(),
        },
      ]);
      setIsAsking(false);
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Sorry, I couldn't process your request. Please try again.";
      setMessages(prev => [
        ...prev,
        {
          type: 'answer',
          content: errorMessage,
          timestamp: new Date(),
          confidence: 0,
        },
      ]);
      setIsAsking(false);
    },
  });

  const handleAsk = (q?: string) => {
    const text = q || question.trim();
    if (!text) return;
    setMessages(prev => [...prev, { type: 'question', content: text, timestamp: new Date() }]);
    setQuestion("");
    setIsAsking(true);
    askMutation.mutate(text);
  };

  const clearChat = () => { setMessages([]); setQuestion(""); };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-900 hover:bg-orange-50 dark:hover:bg-gray-800 transition-all group"
        data-testid="button-liq-ai-open"
        style={{ boxShadow: '0 4px 24px rgba(234,88,12,0.15)' }}
      >
        <div className="w-8 h-8 rounded-lg bg-[#ea580c] flex items-center justify-center text-white text-sm font-bold">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-[#111] dark:text-gray-100">liQ AI</span>
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </button>
    );
  }

  return (
    <div
      className="flex-shrink-0 flex h-full relative"
      style={{ width: `${panelWidth}px` }}
      data-testid="liq-ai-panel"
    >
      {/* Left edge drag handle */}
      <div
        onMouseDown={handleDragStart}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group hover:bg-[#ea580c]/20 transition-colors"
        data-testid="drag-handle-liq-ai"
      >
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gray-200 dark:bg-gray-700 group-hover:bg-[#ea580c] transition-colors" />
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 h-full ml-1">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3 bg-gradient-to-b from-gray-50 dark:from-gray-900 to-white dark:to-gray-950 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#ea580c] flex items-center justify-center text-white text-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[#111] dark:text-gray-100">liQ AI</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">AI-native contract intelligence</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Online
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          data-testid="button-liq-ai-close"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Context Bar */}
      <div className="px-3 py-2 bg-orange-50 dark:bg-orange-950/30 border-b border-orange-100 dark:border-orange-900/50 text-xs text-[#ea580c] dark:text-orange-400 flex items-center gap-2 flex-shrink-0">
        <span>{context.icon}</span>
        <span className="font-medium">Viewing: {context.label}</span>
        {context.contractId && (
          <span className="text-orange-400 truncate">• Contract</span>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <div className="w-12 h-12 rounded-xl bg-[#ea580c] flex items-center justify-center text-white text-2xl mb-3">
              ✦
            </div>
            <h4 className="text-base font-bold text-[#111] dark:text-gray-100 mb-1">How can I help?</h4>
            <p className="text-xs text-gray-500 max-w-[260px] mb-4">
              Ask about your contracts, rules, calculations, or anything on this page
            </p>
            <div className="w-full space-y-1.5">
              {context.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleAsk(s)}
                  className="w-full text-left text-[11px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#ea580c] hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-[#111] dark:hover:text-gray-100 transition-all"
                  data-testid={`suggestion-${i}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx}>
                {msg.type === 'question' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[88%] bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50 rounded-xl rounded-tr-sm px-3 py-2">
                      <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1 text-right">You</div>
                      <p className="text-xs text-[#111] dark:text-gray-100">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl rounded-tl-sm px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-4 h-4 rounded bg-[#ea580c] flex items-center justify-center">
                          <Sparkles className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-[#ea580c]">liQ AI</span>
                        {msg.confidence !== undefined && (
                          <Badge variant={msg.confidence >= 0.7 ? "default" : msg.confidence >= 0.5 ? "secondary" : "destructive"} className="text-[9px] px-1.5 py-0 h-4">
                            {(msg.confidence * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      <FormattedAnswer content={msg.content} className="text-xs leading-relaxed" />
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <details>
                            <summary className="cursor-pointer text-[10px] font-medium text-[#ea580c] dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 flex items-center gap-1">
                              <ChevronDown className="h-3 w-3" />
                              {msg.sources.length} Source{msg.sources.length > 1 ? 's' : ''}
                            </summary>
                            <div className="mt-1.5 space-y-1.5 pl-3">
                              {msg.sources.map((src, sidx) => (
                                <div key={sidx} className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-100 dark:border-gray-700 text-[10px]">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <FileText className="h-2.5 w-2.5 text-[#ea580c] dark:text-orange-400" />
                                    <span className="font-semibold text-[#111] dark:text-gray-100 truncate">{src.contractName}</span>
                                    <Badge variant="outline" className="text-[9px] ml-auto px-1 py-0">{(src.similarity * 100).toFixed(0)}%</Badge>
                                  </div>
                                  <p className="text-gray-500 leading-relaxed pl-3.5">{src.relevantText}</p>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {isAsking && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ea580c] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#ea580c] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#ea580c] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            Thinking...
          </div>
        )}
      </div>

      {/* Suggestions chips (when there are messages) */}
      {messages.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Suggestions</span>
            <button onClick={clearChat} className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5" data-testid="button-clear-chat">
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {context.suggestions.slice(0, 3).map((s, i) => (
              <button
                key={i}
                onClick={() => handleAsk(s)}
                className="text-[10px] px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-[#ea580c] hover:text-[#ea580c] dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all"
                data-testid={`chip-${i}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-3 py-2.5 border-t border-gray-200 dark:border-gray-800 flex items-end gap-2 flex-shrink-0">
        <textarea
          ref={inputRef}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
          placeholder="Ask liQ AI..."
          disabled={isAsking}
          className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-[#111] dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none resize-none min-h-[36px] max-h-[80px] focus:border-[#ea580c] focus:ring-1 focus:ring-orange-200 dark:focus:ring-orange-800 transition-all"
          rows={1}
          data-testid="input-liq-ai"
        />
        <button
          onClick={() => handleAsk()}
          disabled={isAsking || !question.trim()}
          className="w-8 h-8 rounded-lg flex-shrink-0 bg-[#ea580c] flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          data-testid="button-send-liq-ai"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
      </div>
    </div>
  );
}
