import { PublicNavigation } from "@/components/public-navigation";
import { PublicFooter } from "@/components/public-footer";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function About() {
  const principlesRef = useRef<HTMLDivElement>(null);
  const [visiblePrinciples, setVisiblePrinciples] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-idx"));
            setTimeout(() => {
              setVisiblePrinciples((prev) => [...new Set([...prev, idx])]);
            }, idx * 110);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    const items = principlesRef.current?.querySelectorAll("[data-idx]");
    items?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const steps = 5;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps);
    }, 1100);
    return () => clearInterval(interval);
  }, []);

  const traceSteps = [
    "Signed Contract",
    "Executable Rules",
    "Validated Transactions",
    "Accruals & Settlements",
    "ERP Journal Entry",
  ];

  const principles = [
    {
      num: "01",
      title: "Contract is the source of truth",
      desc: "Not programs, not claims, not spreadsheets. Every calculation traces back to a specific contract clause.",
    },
    {
      num: "02",
      title: "Traceability over optimization",
      desc: "Every number must be explainable, reproducible, and defensible — not just fast or approximate.",
    },
    {
      num: "03",
      title: "Finance owns execution",
      desc: "We build tools Finance controls — not black boxes that produce numbers nobody can explain.",
    },
    {
      num: "04",
      title: "ERP remains system of record",
      desc: "LicenseIQ computes and proves. ERPs book and pay. We never replace the systems you depend on.",
    },
  ];

  const whoCards = [
    {
      label: "Segment",
      title: "Mid-Market Electronics & Manufacturing",
      desc: "Complex channel structures with multiple distributor tiers, where contract-driven revenue is material and audit scrutiny is real.",
    },
    {
      label: "Revenue Model",
      title: "Distributor-Led Revenue",
      desc: "Companies where the majority of revenue flows through indirect channel partners governed by rebate, chargeback, and incentive contracts.",
    },
    {
      label: "Use Case",
      title: "Licensing & Fee-Heavy Businesses",
      desc: "Organizations with tiered fee structures, minimum guarantees, and usage-based calculations that demand precise, defensible execution.",
    },
    {
      label: "Trigger",
      title: "Organizations Under Audit Pressure",
      desc: "Finance teams where traceability and period-over-period reproducibility are non-negotiable — not nice to have.",
    },
  ];

  const problemList = [
    "Contract logic interpreted by analysts every close cycle",
    "Accruals built outside ERP with no audit linkage",
    "Disputes resolved through emails and tribal knowledge",
    "Audit questions answered with spreadsheets and explanations",
  ];

  return (
    <div className="min-h-screen bg-black">
      <PublicNavigation currentPage="about" />

      <section className="pt-32 md:pt-40 pb-20 md:pb-24 px-6 md:px-16 max-w-[1140px] mx-auto relative">
        <div className="absolute top-8 right-[-80px] w-[560px] h-[560px] bg-[radial-gradient(circle,rgba(232,82,10,0.07)_0%,transparent_65%)] pointer-events-none hidden md:block" />

        <div className="flex items-center gap-3 mb-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-7 h-0.5 bg-orange-600 flex-shrink-0" />
          <span className="text-xs font-semibold tracking-[0.22em] uppercase text-orange-600" data-testid="text-eyebrow">
            About LicenseIQ
          </span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white uppercase leading-[1.05] tracking-tight max-w-[860px] mb-7 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150" data-testid="text-hero-heading">
          Channel revenue is complex.
          <br />
          <span className="text-orange-600">
            The gap between contract
            <br className="hidden md:block" />
            and journal entry
          </span>{" "}
          shouldn't be.
        </h1>

        <p className="text-lg font-light leading-relaxed text-slate-400 max-w-[600px] mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300" data-testid="text-hero-body">
          LicenseIQ was built for finance teams who know their biggest source of
          revenue risk isn't their ERP — it's the spreadsheets sitting between
          their signed contracts and their books.
        </p>

        <div className="w-16 h-[3px] bg-orange-600 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500" />
      </section>

      <hr className="border-t border-white/[0.06]" />

      <section className="bg-[#141414] py-20 md:py-24 px-6 md:px-16">
        <div className="max-w-[1140px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] uppercase text-orange-600 mb-5" data-testid="text-problem-label">
              The Problem We Solve
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white uppercase leading-[1.08] mb-6" data-testid="text-problem-heading">
              Contracts decide revenue.
              <br />
              Systems don't
              <br />
              execute them.
            </h2>
            <p className="text-[15px] leading-relaxed text-slate-400 mb-4">
              Distributor agreements, channel rebates, royalties, price
              protection — these contracts determine real money. But they were
              never designed to be executed by finance systems.
            </p>
            <p className="text-[15px] leading-relaxed text-slate-400 mb-6">
              So finance teams fill the gap the only way they can: manually, in
              spreadsheets, one period at a time.
            </p>
            <ul className="space-y-3 mt-6">
              {problemList.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-slate-400 leading-relaxed"
                  data-testid={`text-problem-item-${i}`}
                >
                  <span className="text-orange-600 flex-shrink-0 mt-0.5">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-l-[3px] border-orange-600 bg-orange-600/10 p-8 md:p-10">
            <blockquote className="text-lg md:text-xl font-light italic leading-relaxed text-white mb-6" data-testid="text-pullquote">
              "If I asked today which clause drove this accrual, which
              transactions were included, and how to prove it to an auditor —
              you probably need a spreadsheet, a person, and a meeting."
            </blockquote>
            <cite className="text-xs font-semibold tracking-[0.18em] uppercase text-orange-600 not-italic" data-testid="text-pullquote-cite">
              The conversation LicenseIQ ends
            </cite>
          </div>
        </div>
      </section>

      <hr className="border-t border-white/[0.06]" />

      <section className="py-20 md:py-24 px-6 md:px-16 max-w-[1140px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-start">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] uppercase text-orange-600 mb-5">
              Our Mission
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white uppercase leading-[1.08] mb-6" data-testid="text-mission-heading">
              Make contract-driven revenue fully traceable — from signature to
              journal entry.
            </h2>
            <p className="text-[15px] leading-[1.85] text-slate-400 mb-4">
              We built LicenseIQ because the gap between a signed contract and a
              defensible journal entry is where finance teams lose time,
              confidence, and sleep.
            </p>
            <p className="text-[15px] leading-[1.85] text-slate-400 mb-4">
              Our platform converts complex commercial agreements into executable
              financial logic — so revenue, accruals, and settlements are
              accurate, explainable, and audit-ready without rebuilding the
              systems you already run on.
            </p>
            <p className="text-[15px] leading-[1.85] text-slate-400">
              Finance shouldn't have to interpret contracts. It should own the
              execution.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-[0.22em] uppercase text-orange-600 mb-5">
              Our Design Principles
            </p>
            <div ref={principlesRef} className="flex flex-col">
              {principles.map((p, i) => (
                <div
                  key={i}
                  data-idx={i}
                  className={`py-6 border-b border-white/[0.06] grid grid-cols-[40px_1fr] gap-4 items-start transition-all duration-500 ${
                    i === 0 ? "border-t border-t-white/[0.06]" : ""
                  } ${
                    visiblePrinciples.includes(i)
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-4"
                  }`}
                  data-testid={`principle-${i}`}
                >
                  <span className="text-xs font-bold tracking-wider text-orange-600 mt-0.5">
                    {p.num}
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-white mb-1">
                      {p.title}
                    </div>
                    <div className="text-[13px] text-slate-400 leading-relaxed">
                      {p.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="border-t border-white/[0.06]" />

      <section className="bg-[#141414] py-20 md:py-24 px-6 md:px-16">
        <div className="max-w-[1140px] mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-12 lg:mb-14 gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] uppercase text-orange-600 mb-5">
                Who We Serve
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white uppercase leading-[1.08] max-w-[480px]" data-testid="text-who-heading">
                Built for finance teams
                <br />
                managing contract complexity
              </h2>
            </div>
            <p className="text-sm text-slate-400 max-w-[300px] leading-relaxed lg:text-right">
              Especially where analysts are manually interpreting contracts today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[2px]">
            {whoCards.map((card, i) => (
              <div
                key={i}
                className="bg-[#1a1a1a] p-10 md:p-11 relative overflow-hidden group cursor-default hover:bg-[#222222] transition-colors duration-250"
                data-testid={`card-who-${i}`}
              >
                <div className="absolute top-0 left-0 w-full h-[3px] bg-orange-600 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-300" />
                <p className="text-xs font-semibold tracking-[0.2em] uppercase text-orange-600 mb-3">
                  {card.label}
                </p>
                <h3 className="text-xl font-bold text-white uppercase leading-[1.15] mb-3">
                  {card.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 md:py-28 px-6 md:px-16 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(232,82,10,0.06)_0%,transparent_65%)] pointer-events-none" />

        <p className="text-xs font-semibold tracking-[0.22em] uppercase text-orange-600 mb-5 relative z-10">
          How LicenseIQ Works
        </p>
        <h2 className="text-3xl md:text-5xl font-extrabold text-white uppercase leading-[1.05] max-w-[740px] mx-auto mb-5 relative z-10" data-testid="text-trace-heading">
          One straight line from
          <br />
          contract to journal entry.
        </h2>
        <p className="text-base font-light text-slate-400 max-w-[520px] mx-auto mb-14 leading-relaxed relative z-10">
          No spreadsheet middleware. No manual interpretation. No "trust me"
          explanations at audit time.
        </p>

        <div className="flex items-center justify-center flex-wrap gap-0 mb-14 relative z-10">
          {traceSteps.map((step, i) => (
            <div key={i} className="flex items-center">
              <div
                className={`border border-white/10 px-5 py-3 text-xs font-semibold tracking-wider uppercase whitespace-nowrap transition-all duration-350 ${
                  i === activeStep
                    ? "bg-orange-600 border-orange-600 text-white"
                    : "bg-[#1a1a1a] text-slate-300"
                }`}
                data-testid={`trace-step-${i}`}
              >
                {step}
              </div>
              {i < traceSteps.length - 1 && (
                <span className="text-orange-600 text-base px-1.5 opacity-40">→</span>
              )}
            </div>
          ))}
        </div>

        <Link href="/early-adopter">
          <Button
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm tracking-widest uppercase px-12 py-6 h-auto transition-all hover:-translate-y-0.5 relative z-10"
            data-testid="button-see-action"
          >
            See It In Action
          </Button>
        </Link>
      </section>

      <PublicFooter />
    </div>
  );
}
