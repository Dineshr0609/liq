import { ReactNode } from "react";
import { Lightbulb, AlertTriangle, Shield, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 flex gap-2">
      <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" /> <div>{children}</div>
    </div>
  );
}
export function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 flex gap-2">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> <div>{children}</div>
    </div>
  );
}
export function Pro({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-800 flex gap-2">
      <Shield className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <span className="font-semibold mr-1">Admin only.</span>
        {children}
      </div>
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="my-3 space-y-2 list-decimal list-inside text-sm text-zinc-800 leading-relaxed">{children}</ol>;
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-bold text-zinc-900 mt-6 mb-2">{children}</h2>;
}
export function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold text-zinc-900 mt-4 mb-1.5">{children}</h3>;
}
export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm text-zinc-700 leading-relaxed my-2">{children}</p>;
}
export function UL({ children }: { children: ReactNode }) {
  return <ul className="my-2 space-y-1 list-disc list-inside text-sm text-zinc-700">{children}</ul>;
}
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="px-1.5 py-0.5 text-[11px] rounded border border-zinc-300 bg-zinc-100 text-zinc-700 font-mono">{children}</kbd>;
}
export function UI({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-zinc-900">{children}</span>;
}
export function Related({ items }: { items: Array<{ id: string; title: string }> }) {
  if (!items.length) return null;
  return (
    <div className="mt-8 pt-4 border-t border-zinc-200">
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Related</div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <Link href={`/help/${it.id}`} className="text-sm text-orange-700 hover:text-orange-800 inline-flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> {it.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
