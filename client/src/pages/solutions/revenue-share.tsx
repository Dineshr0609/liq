import { Link } from "wouter";
import { PublicNavigation } from "@/components/public-navigation";
import { PublicFooter } from "@/components/public-footer";
import { ErpLogos } from "@/components/erp-logos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, CheckCircle, ArrowRight, ArrowLeft
} from "lucide-react";

export default function RevenueShareSolution() {
  const flow = {
    title: "Revenue Share & Marketplace Splits",
    icon: TrendingUp,
    gradient: "from-orange-700 to-orange-600",
    items: [
      "Multi-party revenue allocation",
      "Usage and transaction-based splits",
      "ERP-ready journal outputs",
      "Audit-ready explanations",
    ],
    description: "Manage complex revenue sharing arrangements with precision. From marketplace splits to Original Equipment Manufacturer agreements, ensure every party receives their contractual share.",
    benefits: [
      "Automate multi-party revenue allocations based on contracts",
      "Handle usage-based and transaction-based splits accurately",
      "Generate ERP-ready journal entries for seamless integration",
      "Provide clear audit narratives explaining every allocation",
    ],
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <PublicNavigation currentPage="solutions" />

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-orange-50 to-orange-50 dark:from-slate-950 dark:via-stone-950/20 dark:to-stone-950/20 pt-28 pb-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <Link href="/solutions">
            <span className="inline-flex items-center gap-2 text-orange-700 hover:text-orange-800 mb-6 cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
              Back to Solutions
            </span>
          </Link>
          
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r ${flow.gradient} text-white mb-4`}>
              <flow.icon className="h-10 w-10" />
            </div>
            <Badge className="bg-orange-700 text-white px-4 py-2">
              Solutions by Revenue Flow
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
              {flow.title}
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
              {flow.description}
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">What We Cover</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {flow.items.map((item, idx) => (
                <Card key={idx} className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
                  <CardContent className="p-4 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-orange-700 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-700 dark:text-slate-300 font-medium">{item}</p>
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
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Key Benefits</h2>
            <div className="space-y-4">
              {flow.benefits.map((benefit, idx) => (
                <Card key={idx} className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-600 dark:text-green-400 text-sm font-bold">{idx + 1}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">{benefit}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-8">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 text-center">Supported ERPs</h3>
                <ErpLogos size="md" />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-orange-800 to-orange-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Automate Revenue Sharing?</h2>
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
