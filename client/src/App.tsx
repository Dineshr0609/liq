import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { UploadModalProvider } from "@/contexts/upload-modal-context";
import { UploadFlowModal } from "@/components/upload/upload-flow-modal";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/lib/protected-route";
import Landing from "@/pages/landing";
import Solutions from "@/pages/solutions";
import HighTechSolution from "@/pages/solutions/hightech";
import LicensingSolution from "@/pages/solutions/licensing";
import CpgSolution from "@/pages/solutions/cpg";
import SaasSolution from "@/pages/solutions/saas";
import PeSolution from "@/pages/solutions/pe";
import DistributorProgramsSolution from "@/pages/solutions/distributor-programs";
import LicensingRoyaltiesSolution from "@/pages/solutions/licensing-royalties";
import RebatesSolution from "@/pages/solutions/rebates";
import PriceProtectionSolution from "@/pages/solutions/price-protection";
import RevenueShareSolution from "@/pages/solutions/revenue-share";
import About from "@/pages/about";
import Privacy from "@/pages/privacy";
import Pricing from "@/pages/pricing";
import EarlyAdopter from "@/pages/early-adopter";
import FAQ from "@/pages/faq";
import VerifyPage from "@/pages/verify";
import AuditResources from "@/pages/resources/audit";
import BlogsPage from "@/pages/resources/blogs";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Contracts from "@/pages/contracts";
import HelpPage from "@/pages/help";
import Analytics from "@/pages/analytics";
import Reports from "@/pages/reports";
import Users from "@/pages/users";
import CreateUser from "@/pages/create-user";
import Audit from "@/pages/audit";
import PipelineResults from "@/pages/pipeline-results";
import ContractAnalysis from "@/pages/contract-analysis";
import NotFound from "@/pages/not-found";
import SalesUpload from "@/pages/sales-upload";
import ContractQnA from "@/pages/contract-qna";
import RAGDashboard from "@/pages/rag-dashboard";
import AdminLeads from "@/pages/admin-leads";
import SqlConsole from "@/pages/sql-console";
import EmailTemplates from "@/pages/email-templates";
import CalculationsPage from "@/pages/calculations";
import CalculationReportPage from "@/pages/calculation-report";
import ContractManagement from "@/pages/contract-management";
import MasterDataMapping from "@/pages/master-data-mapping";
import ErpCatalog from "@/pages/erp-catalog";
import ErpDataImport from "@/pages/erp-data-import";
import LicenseiqSchema from "@/pages/licenseiq-schema";
import DataManagement from "@/pages/data-management";
import Configuration from "@/pages/configuration";
import MasterData from "@/pages/master-data";
import NavigationManager from "@/pages/navigation-manager";
import KnowledgeBase from "@/pages/knowledge-base";
import ErpIntegration from "@/pages/erp-integration";
import ErpHub from "@/pages/erp-hub";
import MasterDataItems from "@/pages/master-data-items";
import ErpMappingRules from "@/pages/erp-mapping-rules";
import SystemSettings from "@/pages/system-settings";
import CompanySettings from "@/pages/company-settings";
import CalculationAuditTrail from "@/pages/calculation-audit-trail";
import AccuracyDashboard from "@/pages/accuracy-dashboard";
import Customers from "@/pages/customers";
import RebatePrograms from "@/pages/rebate-programs";
import RulePlayground from "@/pages/rule-playground";
import FinancialControlCenter from "@/pages/financial-control-center";
import NewContract from "@/pages/new-contract";
import ComingSoonPage from "@/pages/coming-soon";
import ScheduleDemo from "@/pages/schedule-demo";
import BlogManagement from "@/pages/blog-management";
import AccrualManagement from "@/pages/accrual-management";
import JournalEntryHub from "@/pages/journal-entry-hub";
import PeriodCloseWorkspace from "@/pages/period-close-workspace";
import SettlementWorkspace from "@/pages/settlement-workspace";
import ClaimsWorkspace from "@/pages/claims-workspace";
import DeductionsWorkspace from "@/pages/deductions-workspace";
import InvoicesMemos from "@/pages/invoices-memos";
import ApprovalsInbox from "@/pages/approvals-inbox";
import ContractsIngest from "@/pages/contracts-ingest";
import ContractsInbox from "@/pages/contracts-inbox";
import ContractsListNew from "@/pages/contracts-list-new";
import ContractEdit from "@/pages/contract-edit";
import FieldMapReview from "@/pages/field-map-review";
import OutstandingObligations from "@/pages/outstanding-obligations";
import ObligationCanonicalAudit from "@/pages/obligation-canonical-audit";
import Templates from "@/pages/templates";
function AdjustmentsDisputes() { return <ComingSoonPage title="Adjustments & Disputes" groupName="Finance Hub" />; }
function FinancialDataLayer1() { return <ComingSoonPage title="Financial Data Layer" groupName="Financial Data Layer" />; }
function FinancialDataLayer2() { return <ComingSoonPage title="Financial Data Layer" groupName="Financial Data Layer" />; }
function FinancialDataLayer3() { return <ComingSoonPage title="Financial Data Layer" groupName="Financial Data Layer" />; }

function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" /></div>;
  }
  if (isAuthenticated) {
    return <SidebarProvider><FinancialControlCenter /></SidebarProvider>;
  }
  return <Landing />;
}

function ProtectedPage({ component: Component }: { component: React.ComponentType<any> }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" /></div>;
  }
  if (!user) {
    window.location.href = "/auth";
    return null;
  }
  return <SidebarProvider><Component /></SidebarProvider>;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/solutions" component={Solutions} />
      <Route path="/solutions/hightech" component={HighTechSolution} />
      <Route path="/solutions/licensing" component={LicensingSolution} />
      <Route path="/solutions/cpg" component={CpgSolution} />
      <Route path="/solutions/saas" component={SaasSolution} />
      <Route path="/solutions/pe" component={PeSolution} />
      <Route path="/solutions/distributor-programs" component={DistributorProgramsSolution} />
      <Route path="/solutions/licensing-royalties" component={LicensingRoyaltiesSolution} />
      <Route path="/solutions/rebates" component={RebatesSolution} />
      <Route path="/solutions/price-protection" component={PriceProtectionSolution} />
      <Route path="/solutions/revenue-share" component={RevenueShareSolution} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/early-adopter" component={EarlyAdopter} />
      <Route path="/faq" component={FAQ} />
      <Route path="/verify/:token" component={VerifyPage} />
      <Route path="/resources/audit" component={AuditResources} />
      <Route path="/schedule-demo" component={ScheduleDemo} />
      <Route path="/resources/blogs" component={BlogsPage} />
      <Route path="/resources/blogs/:slug" component={BlogsPage} />

      {/* Home page - shows landing or dashboard based on auth */}
      <Route path="/" component={HomePage} />

      {/* Protected routes - each handles its own auth check */}
      <Route path="/financial-control-center">{() => <ProtectedPage component={FinancialControlCenter} />}</Route>
      <Route path="/contracts">{() => <ProtectedPage component={ContractsListNew} />}</Route>
      <Route path="/contracts/legacy">{() => <ProtectedPage component={Contracts} />}</Route>
      <Route path="/help">{() => <ProtectedPage component={HelpPage} />}</Route>
      <Route path="/help/:id">{() => <ProtectedPage component={HelpPage} />}</Route>
      <Route path="/analytics">{() => <ProtectedPage component={Analytics} />}</Route>
      <Route path="/reports">{() => <ProtectedPage component={Reports} />}</Route>
      <Route path="/users">{() => <ProtectedPage component={Users} />}</Route>
      <Route path="/users/new">{() => <ProtectedPage component={CreateUser} />}</Route>
      <Route path="/audit">{() => <ProtectedPage component={Audit} />}</Route>
      <Route path="/sales-upload">{() => <ProtectedPage component={SalesUpload} />}</Route>
      <Route path="/calculations/:id/audit-trail">{() => <ProtectedPage component={CalculationAuditTrail} />}</Route>
      <Route path="/calculations/:id/report">{() => <ProtectedPage component={CalculationReportPage} />}</Route>
      <Route path="/calculations">{() => <ProtectedPage component={CalculationsPage} />}</Route>
      <Route path="/contracts/ingest">{() => <ProtectedPage component={ContractsIngest} />}</Route>
      <Route path="/contracts/inbox">{() => <ProtectedPage component={ContractsInbox} />}</Route>
      <Route path="/templates">{() => <ProtectedPage component={Templates} />}</Route>
      <Route path="/contracts/new">{() => <ProtectedPage component={NewContract} />}</Route>
      <Route path="/contracts/:id/manage">{() => <ProtectedPage component={ContractManagement} />}</Route>
      <Route path="/contracts/:id/pipeline">{() => <ProtectedPage component={PipelineResults} />}</Route>
      <Route path="/contracts/:id/field-map">{() => <ProtectedPage component={FieldMapReview} />}</Route>
      <Route path="/contracts/:id/analysis">{() => <ProtectedPage component={ContractAnalysis} />}</Route>
      <Route path="/contracts/:id">{() => <ProtectedPage component={ContractEdit} />}</Route>
      <Route path="/contract-qna">{() => <ProtectedPage component={ContractQnA} />}</Route>
      <Route path="/rag-dashboard">{() => <ProtectedPage component={RAGDashboard} />}</Route>
      <Route path="/admin/leads">{() => <ProtectedPage component={AdminLeads} />}</Route>
      <Route path="/admin/sql-console">{() => <ProtectedPage component={SqlConsole} />}</Route>
      <Route path="/admin/email-templates">{() => <ProtectedPage component={EmailTemplates} />}</Route>
      <Route path="/admin/blogs">{() => <ProtectedPage component={BlogManagement} />}</Route>
      <Route path="/erp-hub">{() => <ProtectedPage component={ErpHub} />}</Route>
      <Route path="/erp-mapping-rules">{() => <ProtectedPage component={ErpMappingRules} />}</Route>
      <Route path="/master-data-mapping">{() => <ProtectedPage component={MasterDataMapping} />}</Route>
      <Route path="/erp-catalog">{() => <ProtectedPage component={ErpCatalog} />}</Route>
      <Route path="/erp-import">{() => <ProtectedPage component={ErpDataImport} />}</Route>
      <Route path="/erp-integration">{() => <ProtectedPage component={ErpIntegration} />}</Route>
      <Route path="/licenseiq-schema">{() => <ProtectedPage component={LicenseiqSchema} />}</Route>
      <Route path="/data-management">{() => <ProtectedPage component={DataManagement} />}</Route>
      <Route path="/master-data">{() => <ProtectedPage component={MasterData} />}</Route>
      <Route path="/master-data/items">{() => <ProtectedPage component={MasterDataItems} />}</Route>
      <Route path="/configuration">{() => <ProtectedPage component={Configuration} />}</Route>
      <Route path="/navigation-manager">{() => <ProtectedPage component={NavigationManager} />}</Route>
      <Route path="/knowledge-base">{() => <ProtectedPage component={KnowledgeBase} />}</Route>
      <Route path="/system-settings">{() => <ProtectedPage component={SystemSettings} />}</Route>
      <Route path="/accuracy-dashboard">{() => <ProtectedPage component={AccuracyDashboard} />}</Route>
      <Route path="/company-settings">{() => <ProtectedPage component={CompanySettings} />}</Route>
      <Route path="/customers">{() => <ProtectedPage component={Customers} />}</Route>
      <Route path="/rebate-programs">{() => <ProtectedPage component={RebatePrograms} />}</Route>
      <Route path="/rule-playground">{() => <ProtectedPage component={RulePlayground} />}</Route>
      <Route path="/accrual-management">{() => <ProtectedPage component={AccrualManagement} />}</Route>
      <Route path="/journal-entry-hub">{() => <ProtectedPage component={JournalEntryHub} />}</Route>
      <Route path="/period-close-workspace">{() => <ProtectedPage component={PeriodCloseWorkspace} />}</Route>
      <Route path="/settlement-workspace">{() => <ProtectedPage component={SettlementWorkspace} />}</Route>
      <Route path="/claims-workspace">{() => <ProtectedPage component={ClaimsWorkspace} />}</Route>
      <Route path="/deductions-workspace">{() => <ProtectedPage component={DeductionsWorkspace} />}</Route>
      <Route path="/invoices-memos">{() => <ProtectedPage component={InvoicesMemos} />}</Route>
      <Route path="/approvals-inbox">{() => <ProtectedPage component={ApprovalsInbox} />}</Route>
      <Route path="/outstanding-obligations">{() => <ProtectedPage component={OutstandingObligations} />}</Route>
      <Route path="/admin/obligation-canonical-audit">{() => <ProtectedPage component={ObligationCanonicalAudit} />}</Route>
      <Route path="/adjustments-disputes">{() => <ProtectedPage component={AdjustmentsDisputes} />}</Route>
      <Route path="/financial-data-layer-1">{() => <ProtectedPage component={FinancialDataLayer1} />}</Route>
      <Route path="/financial-data-layer-2">{() => <ProtectedPage component={FinancialDataLayer2} />}</Route>
      <Route path="/financial-data-layer-3">{() => <ProtectedPage component={FinancialDataLayer3} />}</Route>

      {/* 404 - only shows for genuinely invalid URLs when authenticated */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <UploadModalProvider>
            <Toaster />
            <Router />
            <UploadFlowModal />
          </UploadModalProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
