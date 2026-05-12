import { PublicNavigation } from "@/components/public-navigation";
import { PublicFooter } from "@/components/public-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Shield, FileCheck, Scale, CheckCircle, 
  ArrowRight, BookOpen, Download, FileText
} from "lucide-react";

export default function AuditResources() {
  const auditGuides = [
    {
      title: "SOC 2 Compliance Guide",
      description: "Complete guide to achieving SOC 2 compliance for contract fee calculations",
      icon: Shield,
      tag: "Compliance"
    },
    {
      title: "ASC 606 Revenue Recognition",
      description: "Best practices for ASC 606 compliant revenue recognition workflows",
      icon: Scale,
      tag: "Accounting"
    },
    {
      title: "Audit Trail Documentation",
      description: "How to maintain comprehensive audit trails for regulatory compliance",
      icon: FileCheck,
      tag: "Documentation"
    },
    {
      title: "Internal Controls Framework",
      description: "Implementing internal controls for contract-to-cash processes",
      icon: CheckCircle,
      tag: "Controls"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <PublicNavigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <BookOpen className="h-4 w-4" />
            Resource Center
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
            Audit Resources
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            Comprehensive guides and documentation to help your finance team maintain 
            compliance and pass audits with confidence.
          </p>
        </div>
      </section>

      {/* Audit Guides */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
            Audit Compliance Guides
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {auditGuides.map((guide, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="h-12 w-12 bg-gradient-to-br from-orange-600 to-amber-800 rounded-lg flex items-center justify-center mb-4">
                      <guide.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded">
                      {guide.tag}
                    </span>
                  </div>
                  <CardTitle className="text-xl group-hover:text-orange-700 transition-colors">
                    {guide.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    {guide.description}
                  </p>
                  <div className="flex items-center text-orange-700 font-medium text-sm">
                    Read Guide <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Downloadable Resources */}
      <section className="py-16 px-4 bg-slate-50 dark:bg-slate-800/50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
            Downloadable Templates
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="text-center p-6">
              <Download className="h-12 w-12 text-orange-700 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Audit Checklist</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                Pre-audit preparation checklist for contract fee calculations
              </p>
              <Button variant="outline" size="sm">
                Download PDF
              </Button>
            </Card>
            <Card className="text-center p-6">
              <FileText className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Control Matrix</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                Internal controls documentation template
              </p>
              <Button variant="outline" size="sm">
                Download Excel
              </Button>
            </Card>
            <Card className="text-center p-6">
              <Shield className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Compliance Report</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                Sample compliance report for auditor review
              </p>
              <Button variant="outline" size="sm">
                Download Template
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Need Help with Audit Preparation?
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-8">
            Our platform provides built-in audit trails and compliance documentation.
          </p>
          <Link href="/early-adopter">
            <Button size="lg" className="bg-gradient-to-r from-orange-700 to-amber-800 text-white">
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
