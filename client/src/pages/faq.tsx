import { Link } from "wouter";
import { PublicNavigation } from "@/components/public-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import licenseIQLogoLight from "@assets/licenseiq-logo-transparent_1772668276822.png";
import {
  CheckCircle, Calculator, FileCheck, Shield,
  TrendingUp, Clock, Users, AlertTriangle,
  Scale, Database, Zap
} from "lucide-react";
import { PublicFooter } from "@/components/public-footer";

export default function FAQ() {
  const faqs = [
    {
      id: "accrual",
      question: "1. How do you determine the correct amount to accrue?",
      auditorQuestion: "Is the accrual calculated using consistent, documented logic tied to contractual obligations?",
      icon: Calculator,
      howWeSupport: [
        "Accruals are derived directly from contract-defined rules, not spreadsheets",
        "Each accrual is traceable to:",
        "• The source contract",
        "• The specific clause or rate",
        "• The underlying transaction or reported data",
        "Calculations are deterministic and reproducible"
      ]
    },
    {
      id: "evidence",
      question: "2. What evidence supports these calculations?",
      auditorQuestion: "Can Finance reproduce the numbers independently and explain the logic?",
      icon: FileCheck,
      howWeSupport: [
        "Every calculation produces a full evidence package, including:",
        "• Contract clause references",
        "• Input data used",
        "• Applied rates, tiers, and thresholds",
        "• Calculation steps",
        "Outputs are consistent across periods unless the contract or data changes"
      ]
    },
    {
      id: "validation",
      question: "3. How do you validate third-party or partner-reported data?",
      auditorQuestion: "Are partner reports trusted blindly, or validated against contract rules?",
      icon: Shield,
      howWeSupport: [
        "Partner and licensee data is validated against contract eligibility rules",
        "Exceptions are flagged and documented",
        "Finance can demonstrate:",
        "• What was accepted",
        "• What was rejected",
        "• Why"
      ]
    },
    {
      id: "leakage",
      question: "4. How do you prevent or detect revenue leakage?",
      auditorQuestion: "Are there controls to detect under-reporting, over-claims, or pricing violations?",
      icon: TrendingUp,
      howWeSupport: [
        "Rule-based validation combined with variance detection",
        "Historical trend comparisons",
        "Threshold-based exception flags",
        "Documented follow-up and resolution paths"
      ]
    },
    {
      id: "consistency",
      question: "5. How do you ensure consistency period over period?",
      auditorQuestion: "Are accruals and settlements calculated consistently across closes?",
      icon: Clock,
      howWeSupport: [
        "Contract logic is versioned and locked per period",
        "Any contract change automatically creates a new effective version",
        "Period-over-period differences are explainable and traceable"
      ]
    },
    {
      id: "approval",
      question: "6. Who reviews and approves the calculations?",
      auditorQuestion: "Is there a documented review and approval process?",
      icon: Users,
      howWeSupport: [
        "Configurable review checkpoints",
        "Clear ownership between:",
        "• Contract interpretation",
        "• Data validation",
        "• Final posting approval",
        "Audit logs show who reviewed, approved, and when"
      ]
    },
    {
      id: "disputes",
      question: "7. How do you handle disputes or restatements?",
      auditorQuestion: "Are disputes handled systematically and documented?",
      icon: AlertTriangle,
      howWeSupport: [
        "Disputes are tied to:",
        "• The original contract",
        "• The affected data and calculation",
        "Adjustments create clear reversal and rebooking entries",
        "Full historical trail is preserved"
      ]
    },
    {
      id: "judgment",
      question: "8. How do you ensure management judgment is applied appropriately?",
      auditorQuestion: "Where does judgment exist, and how is it controlled?",
      icon: Scale,
      howWeSupport: [
        "Judgment points are explicit and documented",
        "Overrides require justification and approval",
        "All overrides are fully auditable and traceable"
      ]
    },
    {
      id: "integration",
      question: "9. How do these calculations integrate into the general ledger?",
      auditorQuestion: "Are postings controlled, accurate, and reconciled?",
      icon: Database,
      howWeSupport: [
        "Produces ERP-ready journal entries",
        "Supports reconciliation between:",
        "• Sub-ledger calculations",
        "• GL balances",
        "Clear mapping between calculation outputs and posted entries"
      ]
    },
    {
      id: "response",
      question: "10. How quickly can you respond to audit questions?",
      auditorQuestion: "Can Finance respond without manual reconstruction?",
      icon: Zap,
      howWeSupport: [
        "Evidence is available on demand",
        "No spreadsheet rebuilding or ad-hoc explanations",
        "Audit questions are answered using the same system used to calculate the numbers"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <PublicNavigation currentPage="faq" />

      {/* Hero Section */}
      <section className="pt-28 pb-16 bg-black">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="bg-orange-600 text-white px-4 py-2 mb-6">
              For Finance & Accounting Leaders
            </Badge>
            <h1 className="text-5xl font-bold text-white mb-6">
              How LicenseIQ Answers Questions Auditors Ask
            </h1>
            <p className="text-xl text-slate-300">
              This guide reflects real questions auditors ask during revenue, accrual, and channel program audits — especially where contracts, estimates, and partner data are involved.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">
              {faqs.map((faq) => {
                const IconComponent = faq.icon;
                return (
                  <Card key={faq.id} className="border-2 hover:border-orange-200 dark:hover:border-orange-800 transition-colors" data-testid={`faq-${faq.id}`}>
                    <CardContent className="p-0">
                      <Accordion type="single" collapsible>
                        <AccordionItem value={faq.id} className="border-0">
                          <AccordionTrigger className="px-6 py-5 hover:no-underline">
                            <div className="flex items-start gap-4 text-left">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center flex-shrink-0">
                                <IconComponent className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                                  {faq.question}
                                </h3>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-6 pb-6">
                            <div className="ml-14 space-y-6">
                              {/* What Auditors Want to Know */}
                              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">
                                  What auditors want to know:
                                </p>
                                <p className="text-slate-700 dark:text-slate-300">
                                  {faq.auditorQuestion}
                                </p>
                              </div>

                              {/* How LicenseIQ Supports This */}
                              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
                                <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3">
                                  How LicenseIQ supports this:
                                </p>
                                <ul className="space-y-2">
                                  {faq.howWeSupport.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                                      {item.startsWith("•") ? (
                                        <span className="ml-4">{item}</span>
                                      ) : (
                                        <>
                                          <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                                          <span>{item}</span>
                                        </>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Closing Statement */}
            <div className="mt-16 text-center">
              <div className="bg-gradient-to-r from-orange-700 to-orange-900 rounded-2xl p-8 text-white">
                <p className="text-2xl font-bold mb-4">
                  LicenseIQ doesn't just calculate the numbers — it explains them.
                </p>
                <Link href="/early-adopter">
                  <Button className="bg-white text-orange-700 hover:bg-orange-50 font-semibold px-8 h-12" data-testid="button-learn-more">
                    Learn About the Early Adopter Program
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}
