import { Link } from "wouter";
import { PublicNavigation } from "@/components/public-navigation";
import { PublicFooter } from "@/components/public-footer";
import { ErpLogos } from "@/components/erp-logos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Cpu, CheckCircle, ArrowRight, ArrowLeft
} from "lucide-react";

export default function SaasSolution() {
  const industry = {
    title: "Software as a Service & Platform Businesses",
    subtitle: "Revenue sharing, Original Equipment Manufacturer, and marketplace complexity",
    icon: Cpu,
    gradient: "from-orange-600 to-orange-800",
    challenges: [
      "Revenue-share logic outside billing systems",
      "Manual adjustments every close",
      "Difficulty explaining revenue splits to auditors",
    ],
    solutions: [
      "Contract-to-usage execution",
      "Revenue share and split calculations",
      "ERP-ready journal outputs",
      "Clear audit narratives for revenue allocation",
    ],
    erp: "SAP, Oracle, NetSuite, Salesforce, QuickBooks, Snowflake",
    flows: ["Revenue Share", "Original Equipment Manufacturer Agreements", "Marketplace Splits"],
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <PublicNavigation currentPage="solutions" />

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-orange-50 to-violet-50 dark:from-slate-950 dark:via-stone-950/20 dark:to-violet-950/20 pt-28 pb-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-violet-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <Link href="/solutions">
            <span className="inline-flex items-center gap-2 text-orange-700 hover:text-orange-800 mb-6 cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
              Back to Solutions
            </span>
          </Link>
          
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r ${industry.gradient} text-white mb-4`}>
              <industry.icon className="h-10 w-10" />
            </div>
            <Badge className="bg-orange-700 text-white px-4 py-2">
              Solutions by Industry
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
              {industry.title}
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              {industry.subtitle}
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Common Challenges</h2>
            <div className="space-y-4">
              {industry.challenges.map((challenge, idx) => (
                <Card key={idx} className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-red-600 dark:text-red-400 text-sm font-bold">{idx + 1}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">{challenge}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">How LicenseIQ Helps</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {industry.solutions.map((solution, idx) => (
                <Card key={idx} className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="p-4 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-700 dark:text-slate-300">{solution}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            <Card>
              <CardContent className="p-8">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 text-center">Supported ERPs</h3>
                <ErpLogos size="md" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Revenue Flows</h3>
                <div className="flex flex-wrap gap-2">
                  {industry.flows.map((flow, idx) => (
                    <Badge key={idx} variant="secondary">{flow}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-orange-700 to-violet-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your Contract Execution?</h2>
          <p className="text-orange-100 mb-8 max-w-2xl mx-auto">
            Join forward-thinking finance teams using LicenseIQ for audit-ready contract-to-cash execution.
          </p>
          <Link href="/early-adopter">
            <Button size="lg" className="bg-white text-orange-700 hover:bg-orange-50">
              Join Early Adopter Program
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
