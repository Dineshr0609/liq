import {
  users,
  contracts,
  contractAnalysis,
  contractEmbeddings,
  contractVersions,
  contractApprovals,
  contractEditLocks,
  auditTrail,
  financialAnalysis,
  complianceAnalysis,
  contractObligations,
  performanceMetrics,
  strategicAnalysis,
  contractComparisons,
  marketBenchmarks,
  contractCalculations,
  salesData,
  contractRules,
  contractPartnerAssignments,
  extractionRuns,
  contractGraphNodes,
  contractGraphEdges,
  ruleDefinitions,
  ruleValidationEvents,
  earlyAccessSignups,
  demoRequests,
  emailTemplates,
  masterDataMappings,
  erpSystems,
  erpEntities,
  erpFields,
  erpEntityRecords,
  dataImportJobs,
  importedErpRecords,
  dataImportSources,
  licenseiqEntities,
  licenseiqFields,
  licenseiqEntityRecords,
  companies,
  businessUnits,
  locations,
  userOrganizationRoles,
  userActiveContext,
  integrationConnections,
  integrationEndpointTemplates,
  integrationOperations,
  integrationHealthEvents,
  licenseiqApiEndpoints,
  type User,
  type InsertUser,
  type UserOrganizationRole,
  type InsertUserOrganizationRole,
  type UserActiveContext,
  type InsertUserActiveContext,
  type Contract,
  type InsertContract,
  type ContractAnalysis,
  type InsertContractAnalysis,
  type AuditTrail,
  type InsertAuditTrail,
  type ContractWithAnalysis,
  type FinancialAnalysis,
  type InsertFinancialAnalysis,
  type ComplianceAnalysis,
  type InsertComplianceAnalysis,
  type ContractObligation,
  type InsertContractObligation,
  type PerformanceMetrics,
  type InsertPerformanceMetrics,
  type StrategicAnalysis,
  type InsertStrategicAnalysis,
  type ContractComparison,
  type InsertContractComparison,
  type MarketBenchmark,
  type InsertMarketBenchmark,
  type ContractRoyaltyCalculation,
  type InsertContractRoyaltyCalculation,
  calculationRuleResults,
  type CalculationRuleResult,
  type InsertCalculationRuleResult,
  type SalesData,
  type InsertSalesData,
  type RoyaltyRule,
  type InsertRoyaltyRule,
  type EarlyAccessSignup,
  type InsertEarlyAccessSignup,
  type DemoRequest,
  type InsertDemoRequest,
  type EmailTemplate,
  type InsertEmailTemplate,
  type ContractVersion,
  type InsertContractVersion,
  type ContractApproval,
  type InsertContractApproval,
  type ErpSystem,
  type InsertErpSystem,
  type ErpEntity,
  type InsertErpEntity,
  type ErpField,
  type InsertErpField,
  type ErpEntityRecord,
  type InsertErpEntityRecord,
  type MasterDataMapping,
  type InsertMasterDataMapping,
  type LicenseiqEntity,
  type InsertLicenseiqEntity,
  type LicenseiqField,
  type InsertLicenseiqField,
  type LicenseiqEntityRecord,
  type InsertLicenseiqEntityRecord,
  type DataImportSource,
  type InsertDataImportSource,
  type Company,
  type InsertCompany,
  type BusinessUnit,
  type InsertBusinessUnit,
  type Location,
  type InsertLocation,
  type IntegrationConnection,
  type InsertIntegrationConnection,
  type IntegrationEndpointTemplate,
  type InsertIntegrationEndpointTemplate,
  type IntegrationOperation,
  type InsertIntegrationOperation,
  type IntegrationHealthEvent,
  type InsertIntegrationHealthEvent,
  type LicenseiqApiEndpoint,
  type InsertLicenseiqApiEndpoint,
  pendingTermMappings,
  type PendingTermMapping,
  type InsertPendingTermMapping,
  orgCalculationSettings,
  erpMappingRuleSets,
  erpMappingRules,
  erpMappingConditions,
  erpMappingOutputs,
  erpRuleExecutionLog,
  type OrgCalculationSettings,
  type InsertOrgCalculationSettings,
  type ErpMappingRuleSet,
  type InsertErpMappingRuleSet,
  type ErpMappingRule,
  type InsertErpMappingRule,
  type ErpMappingCondition,
  type InsertErpMappingCondition,
  type ErpMappingOutput,
  type InsertErpMappingOutput,
  type ErpRuleExecutionLog,
  type InsertErpRuleExecutionLog,
  saleContractMatches,
  systemSettings,
  companySettings,
  contractTypeDefinitions,
  calculationFieldTypes,
  type SystemSettings,
  type InsertSystemSettings,
  type CompanySettings,
  type InsertCompanySettings,
  type ContractTypeDefinition,
  type InsertContractTypeDefinition,
  type CalculationFieldType,
  type InsertCalculationFieldType,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ilike, count, gte, sql, inArray, isNull } from "drizzle-orm";

/**
 * Organizational context for hierarchical access control
 */
export interface OrgAccessContext {
  activeContext: any; // User's active organizational context (companyId, businessUnitId, locationId, role)
  globalRole: string; // User's global system role
  userId?: string; // User ID for fallback filtering
  isSystemAdmin?: boolean; // System Admin bypass flag
}

/**
 * Hierarchical Access Control Helper (Table-Agnostic)
 * Builds query conditions based on organizational context.
 * Hierarchy: Company > Business Unit > Location
 * 
 * Legacy contracts (with NULL org fields) are included for Company Admins/Owners.
 * 
 * @param columns - Object with column references: { companyId, businessUnitId, locationId }
 * @param context - Organizational access context
 * @returns Drizzle query condition or null (no filtering needed)
 */
function buildOrgContextFilter(
  columns: { companyId: any; businessUnitId: any; locationId: any; uploadedBy?: any },
  context: OrgAccessContext
) {
  const { activeContext, globalRole, isSystemAdmin, userId } = context;
  
  // No active context
  if (!activeContext) {
    // System Admins see everything
    if (isSystemAdmin) {
      return null;
    }
    // Non-system-admin users without org context: restrict to their own uploads
    if (userId && columns.uploadedBy) {
      return eq(columns.uploadedBy, userId);
    }
    return sql`FALSE`;
  }

  // System Admin with active context: only filter by company, never restrict to BU/location
  // System Admins select a company to focus on, but should see ALL data within that company
  if (isSystemAdmin) {
    const { companyId } = activeContext;
    if (companyId) {
      return eq(columns.companyId, companyId);
    }
    return null;
  }

  const { companyId, businessUnitId, locationId, role: contextRole } = activeContext;
  const isAdminOrOwner = contextRole === 'admin' || contextRole === 'owner';

  // Location level: User assigned to a specific location
  if (locationId) {
    return eq(columns.locationId, locationId);
  }

  // Business Unit level: User assigned to a BU (no specific location)
  if (businessUnitId) {
    return eq(columns.businessUnitId, businessUnitId);
  }

  // Company level: User assigned to company only (no BU, no location)
  if (companyId) {
    return eq(columns.companyId, companyId);
  }

  // Fallback: no filtering
  return null;
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserRole(id: string, role: string): Promise<User>;
  getAllUsers(search?: string, role?: string): Promise<User[]>;
  getAllUsersWithCompanies(): Promise<any[]>;
  getUsersByCompany(companyId: string): Promise<any[]>;
  deleteUser(id: string): Promise<void>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  resetUserPassword(id: string, newPassword: string): Promise<User>;
  getAdminCount(): Promise<number>;
  
  // Contract operations
  createContract(contract: InsertContract): Promise<Contract>;
  getContract(id: string, context?: OrgAccessContext): Promise<ContractWithAnalysis | undefined>;
  getContracts(userId?: string, limit?: number, offset?: number, context?: OrgAccessContext): Promise<{ contracts: ContractWithAnalysis[], total: number }>;
  updateContractStatus(id: string, status: string, processingTime?: number): Promise<Contract>;
  searchContracts(query: string, userId?: string, context?: OrgAccessContext): Promise<ContractWithAnalysis[]>;
  getContractsByUser(userId: string, context?: OrgAccessContext): Promise<Contract[]>;
  deleteContract(id: string): Promise<void>;
  updateContractMetadata(id: string, metadata: any, userId: string): Promise<Contract>;
  submitContractForApproval(id: string, userId: string): Promise<Contract>;
  updateContractErpMatching(id: string, enabled: boolean): Promise<Contract>;
  
  // Contract versioning operations
  createContractVersion(version: any): Promise<any>;
  getContractVersions(contractId: string): Promise<any[]>;
  getContractVersion(versionId: string): Promise<any | undefined>;
  
  // Contract approval operations
  createContractApproval(approval: any): Promise<any>;
  getContractApprovals(versionId: string): Promise<any[]>;
  getPendingApprovals(userId: string): Promise<any[]>;

  // Contract analysis operations
  createContractAnalysis(analysis: InsertContractAnalysis): Promise<ContractAnalysis>;
  getContractAnalysis(contractId: string): Promise<ContractAnalysis | undefined>;
  updateContractAnalysis(contractId: string, analysis: Partial<InsertContractAnalysis>): Promise<ContractAnalysis>;
  deleteContractAnalysis(contractId: string): Promise<void>;
  
  // Contract embeddings operations
  saveContractEmbedding(data: {
    contractId: string;
    embeddingType: string;
    embedding: number[];
    sourceText: string;
    metadata?: any;
  }): Promise<void>;
  
  // Financial analysis operations
  createFinancialAnalysis(analysis: InsertFinancialAnalysis): Promise<FinancialAnalysis>;
  getFinancialAnalysis(contractId: string): Promise<FinancialAnalysis | undefined>;
  updateFinancialAnalysis(contractId: string, analysis: Partial<InsertFinancialAnalysis>): Promise<FinancialAnalysis>;
  deleteFinancialAnalysis(contractId: string): Promise<void>;
  
  // Compliance analysis operations
  createComplianceAnalysis(analysis: InsertComplianceAnalysis): Promise<ComplianceAnalysis>;
  getComplianceAnalysis(contractId: string): Promise<ComplianceAnalysis | undefined>;
  updateComplianceAnalysis(contractId: string, analysis: Partial<InsertComplianceAnalysis>): Promise<ComplianceAnalysis>;
  deleteComplianceAnalysis(contractId: string): Promise<void>;
  
  // Contract obligations operations
  createContractObligation(obligation: InsertContractObligation): Promise<ContractObligation>;
  getContractObligations(contractId: string): Promise<ContractObligation[]>;
  updateObligationStatus(id: string, status: string, completionDate?: Date): Promise<ContractObligation>;
  deleteContractObligation(id: string): Promise<void>;
  
  // Performance metrics operations
  createPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics>;
  getPerformanceMetrics(contractId: string): Promise<PerformanceMetrics | undefined>;
  updatePerformanceMetrics(contractId: string, metrics: Partial<InsertPerformanceMetrics>): Promise<PerformanceMetrics>;
  deletePerformanceMetrics(contractId: string): Promise<void>;
  
  // Strategic analysis operations
  createStrategicAnalysis(analysis: InsertStrategicAnalysis): Promise<StrategicAnalysis>;
  getStrategicAnalysis(contractId: string): Promise<StrategicAnalysis | undefined>;
  updateStrategicAnalysis(contractId: string, analysis: Partial<InsertStrategicAnalysis>): Promise<StrategicAnalysis>;
  deleteStrategicAnalysis(contractId: string): Promise<void>;
  
  // Contract comparison operations
  createContractComparison(comparison: InsertContractComparison): Promise<ContractComparison>;
  getContractComparison(contractId: string): Promise<ContractComparison | undefined>;
  updateContractComparison(contractId: string, comparison: Partial<InsertContractComparison>): Promise<ContractComparison>;
  deleteContractComparison(contractId: string): Promise<void>;
  
  // Market benchmark operations
  createMarketBenchmark(benchmark: InsertMarketBenchmark): Promise<MarketBenchmark>;
  getMarketBenchmarks(contractType?: string, industry?: string): Promise<MarketBenchmark[]>;
  updateMarketBenchmark(id: string, benchmark: Partial<InsertMarketBenchmark>): Promise<MarketBenchmark>;
  deleteMarketBenchmark(id: string): Promise<void>;
  
  // Audit trail operations
  createAuditLog(audit: InsertAuditTrail): Promise<AuditTrail>;
  getAuditLogs(userId?: string, limit?: number, offset?: number): Promise<{ logs: AuditTrail[], total: number }>;
  
  // Analytics operations
  getContractMetrics(userId?: string, context?: OrgAccessContext): Promise<{
    totalContracts: number;
    processing: number;
    analyzed: number;
    recentUploads: number;
    activeUsers: number;
  }>;

  getDashboardKPIs(userId?: string, context?: OrgAccessContext): Promise<{
    totalActiveContracts: number;
    contractsByType: Array<{ type: string; count: number }>;
    pendingProcessing: number;
    contractsWithExceptions: number;
    periodAccrualExposure: number;
    journalsGenerated: number;
    pendingReviews: number;
    rulesNeedingReview: number;
    recentCalculations: Array<{ name: string; amount: number; status: string; date: string }>;
    contractStatusBreakdown: Array<{ status: string; count: number }>;
    ruleConfidenceDistribution: Array<{ range: string; count: number }>;
    monthlyActivity: Array<{ month: string; uploads: number; calculations: number }>;
    topContractsByValue: Array<{ name: string; value: number; status: string }>;
    approvalPipeline: { draft: number; pendingApproval: number; approved: number; rejected: number };
  }>;
  
  // Advanced analytics operations
  getPortfolioAnalytics(userId?: string, companyId?: string): Promise<{
    totalValue: number;
    avgPerformanceScore: number;
    complianceRate: number;
    upcomingObligations: number;
    renewalsPending: number;
  }>;

  // Aggregate analytics operations
  getFinancialAnalytics(userId?: string, companyId?: string): Promise<{
    totalContractValue: number;
    avgContractValue: number;
    totalPaymentScheduled: number;
    currencyDistribution: Record<string, number>;
    riskDistribution: { low: number; medium: number; high: number };
    topPaymentTerms: Array<{ term: string; count: number }>;
  }>;

  getComplianceAnalytics(userId?: string, companyId?: string): Promise<{
    avgComplianceScore: number;
    complianceDistribution: { compliant: number; partial: number; nonCompliant: number };
    topRegulatoryFrameworks: Array<{ framework: string; count: number }>;
    jurisdictionBreakdown: Record<string, number>;
    dataProtectionCompliance: number;
  }>;

  getStrategicAnalytics(userId?: string, companyId?: string): Promise<{
    avgStrategicValue: number;
    marketAlignmentDistribution: { high: number; medium: number; low: number };
    competitiveAdvantages: Array<{ advantage: string; count: number }>;
    avgRiskConcentration: number;
    topRecommendations: Array<{ recommendation: string; frequency: number }>;
  }>;

  getPerformanceAnalytics(userId?: string, companyId?: string): Promise<{
    avgPerformanceScore: number;
    avgMilestoneCompletion: number;
    onTimeDeliveryRate: number;
    avgBudgetVariance: number;
    avgQualityScore: number;
    avgRenewalProbability: number;
  }>;

  getRiskAnalytics(userId?: string, companyId?: string): Promise<{
    riskDistribution: { high: number; medium: number; low: number };
    topRiskFactors: Array<{ risk: string; frequency: number }>;
    avgRiskScore: number;
    contractsAtRisk: number;
    riskTrends: Array<{ date: string; riskScore: number }>;
  }>;

  // Sales data operations
  createSalesData(salesData: InsertSalesData): Promise<SalesData>;
  createBulkSalesData(salesDataArray: InsertSalesData[]): Promise<SalesData[]>;
  getSalesDataByContract(contractId: string, context?: OrgAccessContext): Promise<SalesData[]>;
  getSalesForContractViaJunction(contractId: string): Promise<SalesData[]>;
  getAllSalesData(limit?: number, offset?: number, context?: OrgAccessContext): Promise<{ salesData: SalesData[], total: number }>;
  updateSalesDataMatch(id: string, contractId: string, confidence: number): Promise<SalesData>;
  deleteSalesData(id: string): Promise<void>;
  deleteAllSalesDataForContract(contractId: string): Promise<void>;
  
  // Contract fee calculation operations
  createContractRoyaltyCalculation(calculation: InsertContractRoyaltyCalculation): Promise<ContractRoyaltyCalculation>;
  getContractRoyaltyCalculations(contractId: string, context?: OrgAccessContext): Promise<ContractRoyaltyCalculation[]>;
  getContractRoyaltyCalculation(id: string, context?: OrgAccessContext): Promise<ContractRoyaltyCalculation | undefined>;
  updateCalculationStatus(id: string, status: string, comments?: string): Promise<ContractRoyaltyCalculation>;
  deleteContractRoyaltyCalculation(id: string): Promise<void>;
  deleteAllCalculationsForContract(contractId: string): Promise<void>;

  // Calculation rule results (traceability)
  createCalculationRuleResult(result: InsertCalculationRuleResult): Promise<CalculationRuleResult>;
  createCalculationRuleResults(results: InsertCalculationRuleResult[]): Promise<CalculationRuleResult[]>;
  getCalculationRuleResults(calculationId: string): Promise<CalculationRuleResult[]>;
  deleteCalculationRuleResults(calculationId: string): Promise<void>;

  // Contract rule operations
  createRoyaltyRule(rule: InsertRoyaltyRule): Promise<RoyaltyRule>;
  getRoyaltyRulesByContract(contractId: string): Promise<RoyaltyRule[]>;
  getActiveRoyaltyRulesByContract(contractId: string): Promise<RoyaltyRule[]>;
  deleteRoyaltyRule(ruleId: string): Promise<void>;
  deleteRoyaltyRulesByContract(contractId: string): Promise<void>;
  updateRoyaltyRule(ruleId: string, updates: Partial<InsertRoyaltyRule>): Promise<RoyaltyRule>;
  
  // Dynamic extraction operations
  getExtractionRun(id: string): Promise<any>;
  getExtractionRunsByContract(contractId: string): Promise<any[]>;
  getContractKnowledgeGraph(contractId: string): Promise<{ nodes: any[], edges: any[] }>;
  getDynamicRulesByContract(contractId: string): Promise<any[]>;
  getRuleValidationEvents(ruleId: string): Promise<any[]>;
  
  // Lead capture operations
  createEarlyAccessSignup(signup: InsertEarlyAccessSignup): Promise<EarlyAccessSignup>;
  getAllEarlyAccessSignups(status?: string): Promise<EarlyAccessSignup[]>;
  updateEarlyAccessSignupStatus(id: string, status?: string, notes?: string): Promise<EarlyAccessSignup>;
  createDemoRequest(request: InsertDemoRequest): Promise<DemoRequest>;
  getAllDemoRequests(status?: string, planTier?: string): Promise<DemoRequest[]>;
  updateDemoRequestStatus(id: string, status?: string, notes?: string): Promise<DemoRequest>;
  appendLeadActivity(id: string, type: 'early_access' | 'demo_request', entry: { action: string; details?: string; emailSubject?: string; emailPreview?: string; by?: string }): Promise<void>;
  getLeadByEmail(email: string): Promise<{ id: string; type: 'early_access' | 'demo_request'; status: string } | null>;
  setLeadVerificationToken(id: string, type: 'early_access' | 'demo_request', token: string): Promise<void>;
  getLeadByVerificationToken(token: string): Promise<{ id: string; email: string; name: string | null; company: string | null; type: 'early_access' | 'demo_request'; verificationData: any } | null>;
  submitLeadVerification(id: string, type: 'early_access' | 'demo_request', data: any): Promise<void>;
  
  // Email template operations
  getAllEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateByKey(templateKey: string): Promise<EmailTemplate | undefined>;
  updateEmailTemplate(id: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate>;
  resetEmailTemplate(id: string): Promise<EmailTemplate>;
  
  // Master data mapping operations
  createMasterDataMapping(mapping: InsertMasterDataMapping): Promise<MasterDataMapping>;
  getMasterDataMapping(id: string): Promise<MasterDataMapping | undefined>;
  getAllMasterDataMappings(filters?: { erpSystem?: string; entityType?: string; status?: string; companyId?: string | null; isSystemAdmin?: boolean }): Promise<MasterDataMapping[]>;
  updateMasterDataMapping(id: string, updates: Partial<InsertMasterDataMapping>): Promise<MasterDataMapping>;
  deleteMasterDataMapping(id: string): Promise<void>;
  
  // ERP Systems operations
  createErpSystem(system: InsertErpSystem): Promise<ErpSystem>;
  getErpSystem(id: string): Promise<ErpSystem | undefined>;
  getAllErpSystems(status?: string): Promise<ErpSystem[]>;
  updateErpSystem(id: string, updates: Partial<InsertErpSystem>): Promise<ErpSystem>;
  deleteErpSystem(id: string): Promise<void>;
  
  // ERP Entities operations
  createErpEntity(entity: InsertErpEntity): Promise<ErpEntity>;
  getErpEntity(id: string): Promise<ErpEntity | undefined>;
  getAllErpEntities(): Promise<ErpEntity[]>;
  getErpEntitiesBySystem(systemId: string, entityType?: string): Promise<ErpEntity[]>;
  updateErpEntity(id: string, updates: Partial<InsertErpEntity>): Promise<ErpEntity>;
  deleteErpEntity(id: string): Promise<void>;
  
  // ERP Fields operations
  createErpField(field: InsertErpField): Promise<ErpField>;
  getErpField(id: string): Promise<ErpField | undefined>;
  getErpFieldsByEntity(entityId: string): Promise<ErpField[]>;
  updateErpField(id: string, updates: Partial<InsertErpField>): Promise<ErpField>;
  deleteErpField(id: string): Promise<void>;
  
  // LicenseIQ Entities operations
  createLicenseiqEntity(entity: InsertLicenseiqEntity): Promise<LicenseiqEntity>;
  getLicenseiqEntity(id: string): Promise<LicenseiqEntity | undefined>;
  getAllLicenseiqEntities(category?: string): Promise<LicenseiqEntity[]>;
  updateLicenseiqEntity(id: string, updates: Partial<InsertLicenseiqEntity>): Promise<LicenseiqEntity>;
  deleteLicenseiqEntity(id: string): Promise<void>;
  
  // LicenseIQ Fields operations
  createLicenseiqField(field: InsertLicenseiqField): Promise<LicenseiqField>;
  getLicenseiqField(id: string): Promise<LicenseiqField | undefined>;
  getLicenseiqFieldsByEntity(entityId: string): Promise<LicenseiqField[]>;
  updateLicenseiqField(id: string, updates: Partial<InsertLicenseiqField>): Promise<LicenseiqField>;
  deleteLicenseiqField(id: string): Promise<void>;
  
  // LicenseIQ Entity Records operations
  createLicenseiqEntityRecord(record: InsertLicenseiqEntityRecord): Promise<LicenseiqEntityRecord>;
  getLicenseiqEntityRecord(id: string): Promise<LicenseiqEntityRecord | undefined>;
  getLicenseiqEntityRecordsByEntity(entityId: string): Promise<LicenseiqEntityRecord[]>;
  updateLicenseiqEntityRecord(id: string, updates: Partial<InsertLicenseiqEntityRecord>): Promise<LicenseiqEntityRecord>;
  deleteLicenseiqEntityRecord(id: string): Promise<void>;
  
  // Sample data for field mapping preview
  getItemsSample(context: { activeContext: any; isAdmin: boolean }, limit: number): Promise<any[]>;
  getPartnersSample(context: { activeContext: any; isAdmin: boolean }, limit: number): Promise<any[]>;
  
  // Data Import Sources operations (iPaaS-style configurable sources)
  createDataImportSource(source: InsertDataImportSource): Promise<DataImportSource>;
  getDataImportSource(id: string): Promise<DataImportSource | undefined>;
  getDataImportSources(filters: {
    companyId?: string;
    businessUnitId?: string;
    locationId?: string;
    sourceType?: string;
    status?: string;
    erpSystemId?: string;
  }): Promise<DataImportSource[]>;
  updateDataImportSource(id: string, updates: Partial<InsertDataImportSource>): Promise<DataImportSource>;
  deleteDataImportSource(id: string): Promise<void>;
  updateSourceRunStats(id: string, success: boolean): Promise<void>;
  
  // Data import jobs operations
  createDataImportJob(job: any): Promise<any>;
  getDataImportJobs(contractId?: string, status?: string): Promise<any[]>;
  getDataImportJob(id: string): Promise<any | undefined>;
  updateDataImportJob(id: string, updates: any): Promise<any>;
  
  // Imported ERP records operations
  createImportedErpRecords(records: any[]): Promise<void>;
  getImportedErpRecords(contractId?: string, jobId?: string): Promise<any[]>;
  searchSemanticMatches(embedding: number[], contractId?: string, limit?: number): Promise<any[]>;
  
  // Enhanced ERP Integration - Mapping Management with Versioning and Company Hierarchy
  getMappingsWithFilters(filters: {
    companyId?: string;
    businessUnitId?: string;
    locationId?: string;
    erpSystemId?: string;
    entityType?: string;
    status?: string;
    latestVersionOnly?: boolean;
  }): Promise<any[]>;
  getMappingVersionHistory(mappingId: string): Promise<any[]>;
  getMappingsByParent(parentMappingId: string): Promise<any[]>;
  createMappingVersion(parentId: string, updates: any, createdBy: string): Promise<any>;
  approveMappingVersion(mappingId: string, approvedBy: string): Promise<any>;
  revertToMappingVersion(mappingId: string, targetVersion: number, createdBy: string): Promise<any>;
  deprecateMapping(mappingId: string): Promise<any>;
  
  // Enhanced ERP Integration - Data Import with Dry-Run and Company Hierarchy
  getImportJobsWithFilters(filters: {
    companyId?: string;
    businessUnitId?: string;
    locationId?: string;
    erpSystemId?: string;
    entityType?: string;
    status?: string;
    jobType?: string;
  }): Promise<any[]>;
  getImportedRecordsByJob(jobId: string, status?: string): Promise<any[]>;
  updateImportedRecordStatus(recordId: string, status: string, errors?: any): Promise<any>;
  commitStagedRecords(jobId: string): Promise<{ committed: number; failed: number }>;
  discardStagedRecords(jobId: string): Promise<number>;
  
  // Master Data operations - Company
  createCompany(company: InsertCompany): Promise<Company>;
  getCompany(id: string): Promise<Company | undefined>;
  getAllCompanies(status?: string): Promise<Company[]>;
  updateCompany(id: string, updates: Partial<InsertCompany>, userId: string): Promise<Company>;
  deleteCompany(id: string): Promise<void>;
  
  // Master Data operations - Business Unit
  createBusinessUnit(unit: InsertBusinessUnit): Promise<BusinessUnit>;
  getBusinessUnit(id: string): Promise<BusinessUnit | undefined>;
  getBusinessUnitsByCompany(companyId: string, status?: string): Promise<BusinessUnit[]>;
  updateBusinessUnit(id: string, updates: Partial<InsertBusinessUnit>, userId: string): Promise<BusinessUnit>;
  deleteBusinessUnit(id: string): Promise<void>;
  
  // Master Data operations - Location
  createLocation(location: InsertLocation): Promise<Location>;
  getLocation(id: string): Promise<Location | undefined>;
  getLocationsByCompany(companyId: string, status?: string): Promise<Location[]>;
  getLocationsByBusinessUnit(orgId: string, status?: string): Promise<Location[]>;
  updateLocation(id: string, updates: Partial<InsertLocation>, userId: string): Promise<Location>;
  deleteLocation(id: string): Promise<void>;
  
  // Master Data operations - Get full hierarchy
  getMasterDataHierarchy(status?: string): Promise<any>;
  
  // User Organization Roles operations
  createUserOrganizationRole(role: InsertUserOrganizationRole): Promise<UserOrganizationRole>;
  getUserOrganizationRoleById(id: string): Promise<UserOrganizationRole | undefined>;
  getUserOrganizationRoles(userId: string): Promise<any[]>;
  getAllUserOrganizationRoles(): Promise<any[]>;
  updateUserOrganizationRole(id: string, updates: Partial<InsertUserOrganizationRole>, userId: string): Promise<UserOrganizationRole>;
  deleteUserOrganizationRole(id: string): Promise<void>;
  getUsersByOrganization(companyId: string, businessUnitId?: string, locationId?: string): Promise<any[]>;
  
  // User Active Context operations
  getUserActiveContext(userId: string): Promise<UserActiveContext | undefined>;
  setUserActiveContext(userId: string, orgRoleId: string): Promise<UserActiveContext>;
  deleteUserActiveContext(userId: string): Promise<void>;
  
  // Integration Connection operations
  createIntegrationConnection(connection: InsertIntegrationConnection): Promise<IntegrationConnection>;
  getIntegrationConnection(id: string): Promise<IntegrationConnection | undefined>;
  getIntegrationConnections(filters?: { erpSystemId?: string; companyId?: string; businessUnitId?: string; locationId?: string; status?: string }): Promise<IntegrationConnection[]>;
  updateIntegrationConnection(id: string, updates: Partial<InsertIntegrationConnection>): Promise<IntegrationConnection>;
  deleteIntegrationConnection(id: string): Promise<void>;
  updateConnectionHealth(id: string, status: string, message?: string): Promise<void>;
  
  // Integration Endpoint Template operations
  createEndpointTemplate(template: InsertIntegrationEndpointTemplate): Promise<IntegrationEndpointTemplate>;
  getEndpointTemplate(id: string): Promise<IntegrationEndpointTemplate | undefined>;
  getEndpointTemplates(filters?: { erpSystemId?: string; entityId?: string; operationType?: string }): Promise<IntegrationEndpointTemplate[]>;
  updateEndpointTemplate(id: string, updates: Partial<InsertIntegrationEndpointTemplate>): Promise<IntegrationEndpointTemplate>;
  deleteEndpointTemplate(id: string): Promise<void>;
  
  // Integration Operation operations
  createIntegrationOperation(operation: InsertIntegrationOperation): Promise<IntegrationOperation>;
  getIntegrationOperation(id: string): Promise<IntegrationOperation | undefined>;
  getIntegrationOperations(filters?: { connectionId?: string; companyId?: string; operationMode?: string; isEnabled?: boolean }): Promise<IntegrationOperation[]>;
  updateIntegrationOperation(id: string, updates: Partial<InsertIntegrationOperation>): Promise<IntegrationOperation>;
  deleteIntegrationOperation(id: string): Promise<void>;
  updateOperationRunStatus(id: string, status: string, stats?: { recordsProcessed?: number; recordsFailed?: number; durationMs?: number; error?: string }): Promise<void>;
  
  // Integration Health Event operations
  createHealthEvent(event: InsertIntegrationHealthEvent): Promise<IntegrationHealthEvent>;
  getHealthEvents(connectionId: string, limit?: number): Promise<IntegrationHealthEvent[]>;
  
  // LicenseIQ API Endpoint operations
  createLicenseiqApiEndpoint(endpoint: InsertLicenseiqApiEndpoint): Promise<LicenseiqApiEndpoint>;
  getLicenseiqApiEndpoint(id: string): Promise<LicenseiqApiEndpoint | undefined>;
  getLicenseiqApiEndpoints(entityId?: string): Promise<LicenseiqApiEndpoint[]>;
  updateLicenseiqApiEndpoint(id: string, updates: Partial<InsertLicenseiqApiEndpoint>): Promise<LicenseiqApiEndpoint>;
  deleteLicenseiqApiEndpoint(id: string): Promise<void>;
  
  // Pending Term Mapping operations (ERP-aware extraction)
  createPendingTermMapping(mapping: InsertPendingTermMapping): Promise<PendingTermMapping>;
  getPendingTermMapping(id: string): Promise<PendingTermMapping | undefined>;
  getPendingTermMappingsByContract(contractId: string, status?: string): Promise<PendingTermMapping[]>;
  getPendingTermMappingsByCompany(companyId: string, status?: string, contractId?: string): Promise<PendingTermMapping[]>;
  getConfirmedCompanyMappings(companyId: string): Promise<PendingTermMapping[]>;
  getPendingTermMappingsByExtractionRun(runId: string): Promise<PendingTermMapping[]>;
  updatePendingTermMapping(id: string, updates: Partial<InsertPendingTermMapping>): Promise<PendingTermMapping>;
  confirmPendingTermMapping(id: string, userId: string, modifiedValue?: string, modifiedFieldId?: string, erpRecordId?: string, erpRecordValue?: string, erpRecordTable?: string, modifiedEntityName?: string, modifiedFieldName?: string): Promise<PendingTermMapping>;
  bulkConfirmPendingTermMappings(ids: string[], userId: string): Promise<PendingTermMapping[]>;
  rejectPendingTermMapping(id: string, userId: string): Promise<PendingTermMapping>;
  deletePendingTermMapping(id: string): Promise<void>;
  deletePendingTermMappingsByContract(contractId: string): Promise<void>;
  
  // System Settings operations
  getSystemSettings(): Promise<SystemSettings | undefined>;
  updateSystemSettings(updates: Partial<InsertSystemSettings>): Promise<SystemSettings>;
  
  // Company Settings operations
  getCompanySettings(companyId: string): Promise<CompanySettings | undefined>;
  updateCompanySettings(companyId: string, updates: Partial<InsertCompanySettings>): Promise<CompanySettings>;
  
  // Contract Type Definitions operations
  getContractTypeDefinitions(): Promise<ContractTypeDefinition[]>;
  createContractTypeDefinition(type: InsertContractTypeDefinition): Promise<ContractTypeDefinition>;
  updateContractTypeDefinition(id: string, updates: Partial<InsertContractTypeDefinition>): Promise<ContractTypeDefinition>;
  deleteContractTypeDefinition(id: string): Promise<void>;
  
  // Calculation Field Types operations
  getCalculationFieldTypes(contractTypeCode?: string): Promise<CalculationFieldType[]>;
  createCalculationFieldType(fieldType: InsertCalculationFieldType): Promise<CalculationFieldType>;
  updateCalculationFieldType(id: string, updates: Partial<InsertCalculationFieldType>): Promise<CalculationFieldType>;
  deleteCalculationFieldType(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Case-insensitive username lookup
    const [user] = await db.select().from(users).where(ilike(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Case-insensitive email lookup
    const [user] = await db.select().from(users).where(ilike(users.email, email));
    return user;
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(search?: string, role?: string): Promise<User[]> {
    let query = db.select().from(users);
    
    const conditions = [];
    if (search) {
      conditions.push(
        ilike(users.email, `%${search}%`)
      );
    }
    if (role) {
      conditions.push(eq(users.role, role));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(users.createdAt));
  }

  async getAllUsersWithCompanies(): Promise<any[]> {
    // Get all users with their company assignments aggregated
    // Explicitly select non-sensitive fields (exclude password)
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        isSystemAdmin: users.isSystemAdmin,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    
    // Get all organization roles with company names
    const allOrgRoles = await db
      .select({
        userId: userOrganizationRoles.userId,
        companyId: userOrganizationRoles.companyId,
        companyName: companies.companyName,
        role: userOrganizationRoles.role,
      })
      .from(userOrganizationRoles)
      .leftJoin(companies, eq(userOrganizationRoles.companyId, companies.id));
    
    // Group company assignments by user
    const userCompanyMap = new Map<string, { companyId: string; companyName: string; role: string }[]>();
    for (const role of allOrgRoles) {
      if (!userCompanyMap.has(role.userId)) {
        userCompanyMap.set(role.userId, []);
      }
      userCompanyMap.get(role.userId)!.push({
        companyId: role.companyId,
        companyName: role.companyName || 'Unknown',
        role: role.role,
      });
    }
    
    // Merge user data with company assignments (no password exposed)
    return allUsers.map(user => ({
      ...user,
      companies: userCompanyMap.get(user.id) || [],
      // Primary company is the first one (for display purposes)
      primaryCompany: userCompanyMap.get(user.id)?.[0]?.companyName || null,
    }));
  }

  async getUsersByCompany(companyId: string): Promise<any[]> {
    // Get all users that have at least one organization role in this company
    // Explicitly exclude password for security
    const usersWithRolesInCompany = await db
      .selectDistinct({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        isSystemAdmin: users.isSystemAdmin,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(userOrganizationRoles, eq(users.id, userOrganizationRoles.userId))
      .where(eq(userOrganizationRoles.companyId, companyId))
      .orderBy(desc(users.createdAt));
    
    return usersWithRolesInCompany;
  }

  // Contract operations
  async createContract(contract: InsertContract): Promise<Contract> {
    // Auto-generate contract number if not provided
    if (!contract.contractNumber) {
      const currentYear = new Date().getFullYear();
      
      // Get the highest contract number for the current year
      const [lastContract] = await db
        .select({ contractNumber: contracts.contractNumber })
        .from(contracts)
        .where(sql`contract_number LIKE ${`CNT-${currentYear}-%`}`)
        .orderBy(desc(contracts.contractNumber))
        .limit(1);
      
      let nextNumber = 1;
      if (lastContract?.contractNumber) {
        const parts = lastContract.contractNumber.split('-');
        if (parts.length === 3) {
          const parsed = parseInt(parts[2]);
          if (!isNaN(parsed)) {
            nextNumber = parsed + 1;
          }
        }
      }
      
      if (nextNumber <= 1) {
        const allContracts = await db
          .select({ contractNumber: contracts.contractNumber })
          .from(contracts)
          .where(sql`contract_number LIKE ${`CNT-${currentYear}-%`}`);
        let maxNum = 0;
        for (const c of allContracts) {
          const p = c.contractNumber?.split('-');
          if (p && p.length === 3) {
            const n = parseInt(p[2]);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          }
        }
        if (maxNum > 0) nextNumber = maxNum + 1;
      }
      
      // Generate formatted contract number: CNT-YYYY-NNN
      contract.contractNumber = `CNT-${currentYear}-${String(nextNumber).padStart(3, '0')}`;
    }
    
    const [newContract] = await db
      .insert(contracts)
      .values(contract)
      .returning();
    return newContract;
  }

  async getContract(id: string, context?: OrgAccessContext): Promise<ContractWithAnalysis | undefined> {
    // Build filter conditions: ID is required, context and userId are optional
    const filterConditions: any[] = [eq(contracts.id, id), isNull(contracts.deletedAt)];

    // Apply organizational context filter
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: contracts.companyId,
          businessUnitId: contracts.businessUnitId,
          locationId: contracts.locationId,
          uploadedBy: contracts.uploadedBy,
        },
        context
      );
      if (orgFilter) {
        filterConditions.push(orgFilter);
      }

      // Also apply user filter if not admin/owner (context role or system admin can see all within their scope)
      const contextRole = context.activeContext?.role;
      const isAdminLevel = context.isSystemAdmin || contextRole === 'admin' || contextRole === 'owner';
      if (context.userId && !isAdminLevel) {
        filterConditions.push(eq(contracts.uploadedBy, context.userId));
      }
    }

    const result = await db
      .select({
        contract: contracts,
        analysis: contractAnalysis,
        uploadedByUser: users,
      })
      .from(contracts)
      .leftJoin(contractAnalysis, eq(contracts.id, contractAnalysis.contractId))
      .leftJoin(users, eq(contracts.uploadedBy, users.id))
      .where(and(...filterConditions));

    if (result.length === 0) return undefined;

    const { contract, analysis, uploadedByUser } = result[0];
    return {
      ...contract,
      analysis: analysis || undefined,
      uploadedByUser: uploadedByUser || undefined,
    };
  }

  async getContracts(userId?: string, limit = 20, offset = 0, context?: OrgAccessContext): Promise<{ contracts: ContractWithAnalysis[], total: number }> {
    let contractsQuery = db
      .select({
        contract: contracts,
        analysis: contractAnalysis,
        uploadedByUser: users,
      })
      .from(contracts)
      .leftJoin(contractAnalysis, eq(contracts.id, contractAnalysis.contractId))
      .leftJoin(users, eq(contracts.uploadedBy, users.id));

    let countQuery = db.select({ count: count() }).from(contracts);

    // Build filter conditions — always exclude soft-deleted contracts
    const filterConditions: any[] = [isNull(contracts.deletedAt)];

    // Apply organizational context filter if provided
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: contracts.companyId,
          businessUnitId: contracts.businessUnitId,
          locationId: contracts.locationId,
          uploadedBy: contracts.uploadedBy,
        },
        context
      );
      if (orgFilter) {
        filterConditions.push(orgFilter);
      }
    }

    // Apply user filter if provided (for non-admin users without org context)
    if (userId) {
      filterConditions.push(eq(contracts.uploadedBy, userId));
    }

    // Apply combined filters
    const combinedFilter = filterConditions.length === 1 
      ? filterConditions[0] 
      : and(...filterConditions);
    contractsQuery = contractsQuery.where(combinedFilter);
    countQuery = countQuery.where(combinedFilter);

    const [contractsResult, totalResult] = await Promise.all([
      contractsQuery
        .orderBy(desc(contracts.createdAt))
        .limit(limit)
        .offset(offset),
      countQuery
    ]);

    const seen = new Set<string>();
    const contractsWithAnalysis = contractsResult
      .filter(({ contract }) => {
        if (seen.has(contract.id)) return false;
        seen.add(contract.id);
        return true;
      })
      .map(({ contract, analysis, uploadedByUser }) => ({
        ...contract,
        analysis: analysis || undefined,
        uploadedByUser: uploadedByUser || undefined,
      }));

    // Hydrate per-contract counts (parties, rules) so the list view doesn't
    // need to do N+1 queries. Single GROUP BY each — cheap enough for 20-row
    // pagination, indexed on contract_id in both source tables.
    const contractIds = contractsWithAnalysis.map((c) => c.id);
    const partyCounts: Record<string, number> = {};
    const ruleCounts: Record<string, number> = {};
    if (contractIds.length > 0) {
      const [pRows, rRows] = await Promise.all([
        db
          .select({
            contractId: contractPartnerAssignments.contractId,
            n: count(),
          })
          .from(contractPartnerAssignments)
          .where(inArray(contractPartnerAssignments.contractId, contractIds))
          .groupBy(contractPartnerAssignments.contractId),
        db
          .select({
            contractId: contractRules.contractId,
            n: count(),
          })
          .from(contractRules)
          .where(inArray(contractRules.contractId, contractIds))
          .groupBy(contractRules.contractId),
      ]);
      for (const r of pRows) partyCounts[r.contractId as any] = Number(r.n);
      for (const r of rRows) ruleCounts[r.contractId as any] = Number(r.n);
    }
    const enriched = contractsWithAnalysis.map((c) => ({
      ...c,
      partiesCount: partyCounts[c.id] || 0,
      rulesCount: ruleCounts[c.id] || 0,
    }));

    return {
      contracts: enriched as any,
      total: totalResult[0].count,
    };
  }

  async updateContractStatus(id: string, status: string, processingTime?: number): Promise<Contract> {
    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (status === 'processing') {
      updateData.processingStartedAt = new Date();
    } else if (status === 'completed' || status === 'analyzed' || status === 'failed') {
      updateData.processingCompletedAt = new Date();
    }

    const [contract] = await db
      .update(contracts)
      .set(updateData)
      .where(eq(contracts.id, id))
      .returning();
    return contract;
  }

  async updateContractFlag(id: string, flagged: boolean): Promise<Contract> {
    const [contract] = await db
      .update(contracts)
      .set({ 
        flaggedForReview: flagged,
        updatedAt: new Date() 
      })
      .where(eq(contracts.id, id))
      .returning();
    return contract;
  }

  async searchContracts(query: string, userId?: string, context?: OrgAccessContext): Promise<ContractWithAnalysis[]> {
    // Comprehensive search conditions across all contract-related fields
    const searchPattern = `%${query}%`;
    
    const searchConditions = or(
      // Contract basic fields
      ilike(contracts.originalName, searchPattern),
      ilike(contracts.displayName, searchPattern),
      ilike(contracts.contractNumber, searchPattern),
      ilike(contracts.contractType, searchPattern),
      ilike(contracts.notes, searchPattern),
      
      // Contract metadata fields
      ilike(contracts.counterpartyName, searchPattern),
      ilike(contracts.organizationName, searchPattern),
      ilike(contracts.governingLaw, searchPattern),
      ilike(contracts.renewalTerms, searchPattern),
      
      // User fields (who created the contract)
      ilike(users.username, searchPattern),
      ilike(users.firstName, searchPattern),
      ilike(users.lastName, searchPattern),
      
      // Contract analysis fields
      ilike(contractAnalysis.summary, searchPattern),
      // Search in JSONB fields using text cast for insights and keyTerms
      sql`${contractAnalysis.insights}::text ILIKE ${searchPattern}`,
      sql`${contractAnalysis.keyTerms}::text ILIKE ${searchPattern}`
    );

    // Build base query
    let baseQuery = db
      .select({
        contract: contracts,
        analysis: contractAnalysis,
        uploadedByUser: users,
      })
      .from(contracts)
      .leftJoin(contractAnalysis, eq(contracts.id, contractAnalysis.contractId))
      .leftJoin(users, eq(contracts.uploadedBy, users.id));

    // Build filter conditions
    const filterConditions: any[] = [searchConditions];

    // Apply organizational context filter
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: contracts.companyId,
          businessUnitId: contracts.businessUnitId,
          locationId: contracts.locationId,
          uploadedBy: contracts.uploadedBy,
        },
        context
      );
      if (orgFilter) {
        filterConditions.push(orgFilter);
      }
    }

    // Apply user filter if provided
    if (userId) {
      filterConditions.push(eq(contracts.uploadedBy, userId));
    }

    // Apply combined filters
    baseQuery = baseQuery.where(and(...filterConditions));

    // Execute base contract search
    const contractResults = await baseQuery.orderBy(desc(contracts.createdAt));
    
    // Also search in fee rules and get matching contract IDs
    // First, find contracts that match through rules
    const rulesSearchConditions = or(
      ilike(contractRules.ruleName, searchPattern),
      ilike(contractRules.description, searchPattern),
      ilike(contractRules.sourceText, searchPattern),
      ilike(contractRules.sourceSection, searchPattern),
      ilike(contractRules.calculationFormula, searchPattern)
    );
    
    let rulesSearchQuery = db
      .select({
        contractId: contractRules.contractId,
        uploadedBy: contracts.uploadedBy
      })
      .from(contractRules)
      .leftJoin(contracts, eq(contractRules.contractId, contracts.id));
    
    // Apply combined conditions: search pattern + context + user filter
    const rulesFilterConditions: any[] = [rulesSearchConditions];
    
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: contracts.companyId,
          businessUnitId: contracts.businessUnitId,
          locationId: contracts.locationId,
          uploadedBy: contracts.uploadedBy,
        },
        context
      );
      if (orgFilter) {
        rulesFilterConditions.push(orgFilter);
      }
    }
    
    if (userId) {
      rulesFilterConditions.push(eq(contracts.uploadedBy, userId));
    }
    
    rulesSearchQuery = rulesSearchQuery.where(and(...rulesFilterConditions));
    
    const rulesResults = await rulesSearchQuery;
    
    const contractIdsFromRules = new Set(rulesResults.map(r => r.contractId).filter(Boolean));
    
    // Also search by date (separate query to avoid SQL errors with OR conditions)
    // Search for dates in formats: "11/3/2025", "11/03/2025", "November", "2025"
    const dateFilterConditions: any[] = [
      or(
        sql`to_char(${contracts.createdAt}, 'MM/DD/YYYY') ILIKE ${searchPattern}`,
        sql`to_char(${contracts.createdAt}, 'FMMM/FMDD/YYYY') ILIKE ${searchPattern}`,
        sql`to_char(${contracts.createdAt}, 'FMMonth') ILIKE ${searchPattern}`,
        sql`to_char(${contracts.createdAt}, 'YYYY') ILIKE ${searchPattern}`
      )
    ];

    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: contracts.companyId,
          businessUnitId: contracts.businessUnitId,
          locationId: contracts.locationId,
          uploadedBy: contracts.uploadedBy,
        },
        context
      );
      if (orgFilter) {
        dateFilterConditions.push(orgFilter);
      }
    }

    if (userId) {
      dateFilterConditions.push(eq(contracts.uploadedBy, userId));
    }

    const dateSearchResults = await db
      .select({
        id: contracts.id
      })
      .from(contracts)
      .where(and(...dateFilterConditions));
    
    const contractIdsFromDates = new Set(dateSearchResults.map(r => r.id));
    
    // Combine all contract IDs from rules and dates
    const allAdditionalIds = new Set([...contractIdsFromRules, ...contractIdsFromDates]);
    
    // If we found contracts through rules or dates search, fetch those contracts too
    if (allAdditionalIds.size > 0) {
      const contractIdsArray = Array.from(allAdditionalIds);
      
      // Build filters for additional fetch: IDs + context + userId
      const additionalFilterConditions: any[] = [inArray(contracts.id, contractIdsArray)];

      if (context) {
        const orgFilter = buildOrgContextFilter(
          {
            companyId: contracts.companyId,
            businessUnitId: contracts.businessUnitId,
            locationId: contracts.locationId,
            uploadedBy: contracts.uploadedBy,
          },
          context
        );
        if (orgFilter) {
          additionalFilterConditions.push(orgFilter);
        }
      }

      if (userId) {
        additionalFilterConditions.push(eq(contracts.uploadedBy, userId));
      }

      const additionalContractsQuery = db
        .select({
          contract: contracts,
          analysis: contractAnalysis,
          uploadedByUser: users,
        })
        .from(contracts)
        .leftJoin(contractAnalysis, eq(contracts.id, contractAnalysis.contractId))
        .leftJoin(users, eq(contracts.uploadedBy, users.id))
        .where(and(...additionalFilterConditions))
        .orderBy(desc(contracts.createdAt));
      
      const additionalContracts = await additionalContractsQuery;
      
      // Combine results and deduplicate by contract ID
      const allResults = [...contractResults, ...additionalContracts];
      const uniqueContractsMap = new Map();
      
      allResults.forEach(result => {
        if (!uniqueContractsMap.has(result.contract.id)) {
          uniqueContractsMap.set(result.contract.id, result);
        }
      });
      
      return Array.from(uniqueContractsMap.values()).map(({ contract, analysis, uploadedByUser }) => ({
        ...contract,
        analysis: analysis || undefined,
        uploadedByUser: uploadedByUser || undefined,
      }));
    }

    // Return just contract results if no rules/dates matches
    return contractResults.map(({ contract, analysis, uploadedByUser }) => ({
      ...contract,
      analysis: analysis || undefined,
      uploadedByUser: uploadedByUser || undefined,
    }));
  }

  async getContractsByUser(userId: string, context?: OrgAccessContext): Promise<Contract[]> {
    // Build filter conditions: userId is required, context is optional
    const filterConditions: any[] = [eq(contracts.uploadedBy, userId), isNull(contracts.deletedAt)];

    // Apply organizational context filter
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: contracts.companyId,
          businessUnitId: contracts.businessUnitId,
          locationId: contracts.locationId,
          uploadedBy: contracts.uploadedBy,
        },
        context
      );
      if (orgFilter) {
        filterConditions.push(orgFilter);
      }
    }

    return await db
      .select()
      .from(contracts)
      .where(and(...filterConditions))
      .orderBy(desc(contracts.createdAt));
  }

  async getContractsByVendor(vendorId: string): Promise<Contract[]> {
    return await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.vendorId, vendorId), isNull(contracts.deletedAt)))
      .orderBy(desc(contracts.createdAt));
  }

  async deleteContract(id: string): Promise<void> {
    // Database cascade deletes will automatically remove all child records:
    // - contractAnalysis (onDelete: cascade)
    // - contractEmbeddings (onDelete: cascade)
    // - contractVersions (onDelete: cascade)
    // - contractRules (onDelete: cascade)
    // - contractCalculations (onDelete: cascade)
    // - dynamicExtractionRuns (onDelete: cascade)
    // - documentChatSessions (onDelete: cascade)
    // - etc.
    // 
    // Sales data uses matchedContractId with onDelete: set null, so it won't be deleted
    // but the contract reference will be cleared
    
    // Preserve confirmed/modified mappings as company-level knowledge (detach from contract)
    await db.update(pendingTermMappings)
      .set({ contractId: null })
      .where(and(
        eq(pendingTermMappings.contractId, id),
        inArray(pendingTermMappings.status, ['confirmed', 'modified'])
      ));
    // Delete non-confirmed mappings (pending, rejected)
    await db.delete(pendingTermMappings).where(eq(pendingTermMappings.contractId, id));
    
    await db.delete(contracts).where(eq(contracts.id, id));
  }

  async updateContractMetadata(id: string, metadata: any, userId: string): Promise<Contract> {
    // Get current contract to capture current state
    const [currentContract] = await db.select().from(contracts).where(eq(contracts.id, id));
    
    if (!currentContract) {
      throw new Error("Contract not found");
    }

    // Helper function to parse date strings to Date objects
    const parseDate = (dateValue: any): Date | null => {
      if (!dateValue) return null;
      // If already a Date object, return it
      if (dateValue instanceof Date) return dateValue;
      // Try parsing string to Date
      try {
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
      } catch {
        return null;
      }
    };

    // Create metadata snapshot of ALL editable fields (including undefined to preserve schema)
    const metadataSnapshot = {
      displayName: metadata.displayName !== undefined ? metadata.displayName : currentContract.displayName,
      effectiveStart: metadata.effectiveStart !== undefined ? parseDate(metadata.effectiveStart) : currentContract.effectiveStart,
      effectiveEnd: metadata.effectiveEnd !== undefined ? parseDate(metadata.effectiveEnd) : currentContract.effectiveEnd,
      renewalTerms: metadata.renewalTerms !== undefined ? metadata.renewalTerms : currentContract.renewalTerms,
      governingLaw: metadata.governingLaw !== undefined ? metadata.governingLaw : currentContract.governingLaw,
      organizationName: metadata.organizationName !== undefined ? metadata.organizationName : currentContract.organizationName,
      counterpartyName: metadata.counterpartyName !== undefined ? metadata.counterpartyName : currentContract.counterpartyName,
      contractOwnerId: metadata.contractOwnerId !== undefined ? metadata.contractOwnerId : currentContract.contractOwnerId,
      contractType: metadata.contractType !== undefined ? metadata.contractType : currentContract.contractType,
      priority: metadata.priority !== undefined ? metadata.priority : currentContract.priority,
      notes: metadata.notes !== undefined ? metadata.notes : currentContract.notes,
      changeSummary: metadata.changeSummary || 'Metadata updated',
    };

    // Decide whether this edit produces a NEW version or just updates the current one.
    // A version bump only happens after an approval boundary (the latest version is
    // approved / rejected / superseded). Until then — including the very first edit
    // of a freshly-uploaded contract — we keep iterating on the current pending/draft
    // version so the contract doesn't jump to v2 without v1 ever being approved.
    const allVersions = await db
      .select()
      .from(contractVersions)
      .where(eq(contractVersions.contractId, id));
    const sortedVersions = [...allVersions].sort(
      (a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0),
    );
    const latestVersionRow = sortedVersions[0];
    const latestState = latestVersionRow?.approvalState;
    const isFinalized = latestState === 'approved'
      || latestState === 'rejected'
      || latestState === 'superseded';

    const baseVersion = currentContract.currentVersion ?? 0;
    const newVersion = isFinalized
      ? (baseVersion || 0) + 1
      : (latestVersionRow?.versionNumber ?? Math.max(baseVersion, 1));

    if (isFinalized) {
      // A new metadata edit on top of an approved/finalized version invalidates any
      // prior approval — mark previously approved or pending versions as 'superseded'.
      await db
        .update(contractVersions)
        .set({ approvalState: 'superseded' })
        .where(and(
          eq(contractVersions.contractId, id),
          inArray(contractVersions.approvalState, ['approved', 'pending_approval']),
        ));
    }

    const [updatedContract] = await db
      .update(contracts)
      .set({
        displayName: metadataSnapshot.displayName,
        effectiveStart: metadataSnapshot.effectiveStart,
        effectiveEnd: metadataSnapshot.effectiveEnd,
        renewalTerms: metadataSnapshot.renewalTerms,
        governingLaw: metadataSnapshot.governingLaw,
        organizationName: metadataSnapshot.organizationName,
        counterpartyName: metadataSnapshot.counterpartyName,
        contractOwnerId: metadataSnapshot.contractOwnerId,
        contractType: metadataSnapshot.contractType,
        priority: metadataSnapshot.priority,
        notes: metadataSnapshot.notes,
        currentVersion: newVersion,
        approvalState: 'pending_approval', // New metadata version requires re-approval
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();

    // Either update the existing pending/draft version row in place, or insert a
    // brand-new pending version row (when crossing an approval boundary).
    if (!isFinalized && latestVersionRow) {
      await db
        .update(contractVersions)
        .set({
          editorId: userId,
          changeSummary: metadataSnapshot.changeSummary,
          metadataSnapshot,
          approvalState: 'pending_approval',
        })
        .where(eq(contractVersions.id, latestVersionRow.id));
    } else {
      await db.insert(contractVersions).values({
        contractId: id,
        versionNumber: newVersion,
        editorId: userId,
        changeSummary: metadataSnapshot.changeSummary,
        metadataSnapshot,
        approvalState: 'pending_approval',
      });
    }

    return updatedContract;
  }

  async submitContractForApproval(id: string, userId: string): Promise<Contract> {
    const [contract] = await db
      .update(contracts)
      .set({
        approvalState: 'pending_approval',
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();

    const versionNumber = contract.currentVersion || 1;

    const existingVersions = await db
      .select()
      .from(contractVersions)
      .where(
        and(
          eq(contractVersions.contractId, id),
          eq(contractVersions.versionNumber, versionNumber)
        )
      );

    if (existingVersions.length > 0) {
      await db
        .update(contractVersions)
        .set({ approvalState: 'pending_approval' })
        .where(
          and(
            eq(contractVersions.contractId, id),
            eq(contractVersions.versionNumber, versionNumber)
          )
        );
    } else {
      await db.insert(contractVersions).values({
        contractId: id,
        versionNumber,
        changeSummary: 'Initial submission for approval',
        editorId: userId,
        approvalState: 'pending_approval',
        metadataSnapshot: {
          displayName: contract.displayName,
          contractType: contract.contractType,
          organizationName: contract.organizationName,
          counterpartyName: contract.counterpartyName,
        },
      });
    }

    return contract;
  }

  async updateContractErpMatching(id: string, enabled: boolean): Promise<Contract> {
    const [contract] = await db
      .update(contracts)
      .set({
        useErpMatching: enabled,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();

    if (!contract) {
      throw new Error("Contract not found");
    }

    return contract;
  }

  async createContractVersion(version: any): Promise<any> {
    const [newVersion] = await db.insert(contractVersions).values(version).returning();
    return newVersion;
  }

  async getContractVersions(contractId: string): Promise<any[]> {
    const versions = await db
      .select({
        id: contractVersions.id,
        contractId: contractVersions.contractId,
        versionNumber: contractVersions.versionNumber,
        changeSummary: contractVersions.changeSummary,
        metadataSnapshot: contractVersions.metadataSnapshot,
        editorId: contractVersions.editorId,
        editorUsername: users.username,
        createdAt: contractVersions.createdAt,
        approvalState: contractVersions.approvalState,
      })
      .from(contractVersions)
      .leftJoin(users, eq(contractVersions.editorId, users.id))
      .where(eq(contractVersions.contractId, contractId))
      .orderBy(desc(contractVersions.versionNumber));
    return versions;
  }

  async getContractVersion(versionId: string): Promise<any | undefined> {
    const [version] = await db
      .select()
      .from(contractVersions)
      .where(eq(contractVersions.id, versionId));
    return version;
  }

  async createContractApproval(approval: any): Promise<any> {
    const [newApproval] = await db.insert(contractApprovals).values(approval).returning();
    
    // Update the version approval state
    await db
      .update(contractVersions)
      .set({ approvalState: approval.status })
      .where(eq(contractVersions.id, approval.contractVersionId));

    // If approved, update the contract with the approved version's metadata
    if (approval.status === 'approved') {
      const [version] = await db
        .select()
        .from(contractVersions)
        .where(eq(contractVersions.id, approval.contractVersionId));
      
      if (version && version.metadataSnapshot) {
        const snapshot: any = version.metadataSnapshot;
        
        // Helper to safely convert date values from JSONB
        const parseSnapshotDate = (value: any): Date | null | undefined => {
          if (!value) return value === null ? null : undefined;
          if (value instanceof Date) return value;
          if (typeof value === 'string') {
            try {
              const parsed = new Date(value);
              return isNaN(parsed.getTime()) ? null : parsed;
            } catch {
              return null;
            }
          }
          return null;
        };
        
        await db
          .update(contracts)
          .set({ 
            approvalState: 'approved',
            displayName: snapshot.displayName,
            effectiveStart: parseSnapshotDate(snapshot.effectiveStart),
            effectiveEnd: parseSnapshotDate(snapshot.effectiveEnd),
            renewalTerms: snapshot.renewalTerms,
            governingLaw: snapshot.governingLaw,
            organizationName: snapshot.organizationName,
            counterpartyName: snapshot.counterpartyName,
            contractOwnerId: snapshot.contractOwnerId,
            contractType: snapshot.contractType,
            priority: snapshot.priority,
            notes: snapshot.notes,
            currentVersion: version.versionNumber,
          })
          .where(eq(contracts.id, version.contractId));
      }
    }

    return newApproval;
  }

  async getContractApprovals(versionId: string): Promise<any[]> {
    return await db
      .select()
      .from(contractApprovals)
      .where(eq(contractApprovals.contractVersionId, versionId))
      .orderBy(desc(contractApprovals.decidedAt));
  }

  async getPendingApprovals(userId: string): Promise<any[]> {
    // Get all pending versions with contract info
    const pendingVersions = await db
      .select({
        version: contractVersions,
        contract: contracts,
        editor: users,
      })
      .from(contractVersions)
      .innerJoin(contracts, eq(contractVersions.contractId, contracts.id))
      .leftJoin(users, eq(contractVersions.editorId, users.id))
      .where(eq(contractVersions.approvalState, 'pending_approval'))
      .orderBy(desc(contractVersions.createdAt));

    return pendingVersions.map(({ version, contract, editor }) => ({
      ...version,
      contract,
      editor,
    }));
  }

  // Contract analysis operations
  async createContractAnalysis(analysis: InsertContractAnalysis): Promise<ContractAnalysis> {
    const [newAnalysis] = await db
      .insert(contractAnalysis)
      .values(analysis)
      .returning();
    return newAnalysis;
  }

  async deleteContractAnalysis(contractId: string): Promise<void> {
    await db.delete(contractAnalysis).where(eq(contractAnalysis.contractId, contractId));
  }

  async getContractAnalysis(contractId: string): Promise<ContractAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(contractAnalysis)
      .where(eq(contractAnalysis.contractId, contractId));
    return analysis;
  }

  async updateContractAnalysis(contractId: string, analysisData: Partial<InsertContractAnalysis>): Promise<ContractAnalysis> {
    const [analysis] = await db
      .update(contractAnalysis)
      .set({ ...analysisData, updatedAt: new Date() })
      .where(eq(contractAnalysis.contractId, contractId))
      .returning();
    return analysis;
  }

  // Audit trail operations
  async createAuditLog(audit: InsertAuditTrail): Promise<AuditTrail> {
    const [log] = await db
      .insert(auditTrail)
      .values(audit)
      .returning();
    return log;
  }

  async getAuditLogs(userId?: string, limit = 50, offset = 0): Promise<{ logs: AuditTrail[], total: number }> {
    let logsQuery = db.select().from(auditTrail);
    let countQuery = db.select({ count: count() }).from(auditTrail);

    if (userId) {
      logsQuery = logsQuery.where(eq(auditTrail.userId, userId));
      countQuery = countQuery.where(eq(auditTrail.userId, userId));
    }

    const [logs, totalResult] = await Promise.all([
      logsQuery
        .orderBy(desc(auditTrail.createdAt))
        .limit(limit)
        .offset(offset),
      countQuery
    ]);

    return {
      logs,
      total: totalResult[0].count,
    };
  }

  async deleteUser(id: string): Promise<void> {
    const { pool } = await import("./db.js");
    const fkColumns = [
      { table: 'contracts', columns: ['uploaded_by', 'contract_owner_id'] },
      { table: 'contract_clause_edits', columns: ['editor_id'] },
      { table: 'contract_approvals', columns: ['approver_id'] },
      { table: 'calculation_results', columns: ['calculated_by', 'approved_by', 'rejected_by'] },
      { table: 'contract_clause_reviews', columns: ['reviewed_by'] },
      { table: 'contract_processing_runs', columns: ['triggered_by'] },
      { table: 'review_tasks', columns: ['assigned_to', 'reviewed_by'] },
      { table: 'contract_validation_results', columns: ['approved_by', 'validator_id'] },
      { table: 'companies', columns: ['created_by', 'last_updated_by'] },
      { table: 'business_units', columns: ['created_by', 'last_updated_by'] },
      { table: 'locations', columns: ['created_by', 'last_updated_by'] },
      { table: 'erp_systems', columns: ['created_by'] },
      { table: 'erp_mapping_rules', columns: ['created_by'] },
      { table: 'erp_value_links', columns: ['created_by', 'approved_by'] },
      { table: 'erp_api_endpoints', columns: ['created_by'] },
      { table: 'erp_import_filters', columns: ['created_by'] },
      { table: 'audit_trail', columns: ['created_by'] },
      { table: 'accrual_entries', columns: ['created_by'] },
      { table: 'journal_entries', columns: ['created_by'] },
      { table: 'period_close_confirmations', columns: ['confirmed_by'] },
    ];
    for (const { table, columns } of fkColumns) {
      for (const col of columns) {
        await pool.query(`UPDATE "${table}" SET "${col}" = NULL WHERE "${col}" = $1`, [id]);
      }
    }
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [id]);
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async resetUserPassword(id: string, newPassword: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ password: newPassword, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAdminCount(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.role, 'owner')));
    return result[0].count;
  }

  // Delete contract analysis  
  async deleteContractAnalysis(contractId: string): Promise<void> {
    await db.delete(contractAnalysis).where(eq(contractAnalysis.contractId, contractId));
  }

  // Contract embeddings operations
  async saveContractEmbedding(data: {
    contractId: string;
    embeddingType: string;
    embedding: number[];
    sourceText: string;
    metadata?: any;
  }): Promise<void> {
    const vectorString = `[${data.embedding.join(',')}]`;
    await db.insert(contractEmbeddings).values({
      contractId: data.contractId,
      embeddingType: data.embeddingType,
      embedding: sql`${vectorString}::vector`,
      sourceText: data.sourceText,
      metadata: data.metadata || {}
    });
  }

  // Financial analysis operations
  async createFinancialAnalysis(analysisData: InsertFinancialAnalysis): Promise<FinancialAnalysis> {
    const [analysis] = await db
      .insert(financialAnalysis)
      .values(analysisData)
      .returning();
    return analysis;
  }

  async getFinancialAnalysis(contractId: string): Promise<FinancialAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(financialAnalysis)
      .where(eq(financialAnalysis.contractId, contractId));
    return analysis;
  }

  async updateFinancialAnalysis(contractId: string, updates: Partial<InsertFinancialAnalysis>): Promise<FinancialAnalysis> {
    const [analysis] = await db
      .update(financialAnalysis)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(financialAnalysis.contractId, contractId))
      .returning();
    return analysis;
  }

  async deleteFinancialAnalysis(contractId: string): Promise<void> {
    await db.delete(financialAnalysis).where(eq(financialAnalysis.contractId, contractId));
  }

  // Compliance analysis operations
  async createComplianceAnalysis(analysisData: InsertComplianceAnalysis): Promise<ComplianceAnalysis> {
    const [analysis] = await db
      .insert(complianceAnalysis)
      .values(analysisData)
      .returning();
    return analysis;
  }

  async getComplianceAnalysis(contractId: string): Promise<ComplianceAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(complianceAnalysis)
      .where(eq(complianceAnalysis.contractId, contractId));
    return analysis;
  }

  async updateComplianceAnalysis(contractId: string, updates: Partial<InsertComplianceAnalysis>): Promise<ComplianceAnalysis> {
    const [analysis] = await db
      .update(complianceAnalysis)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(complianceAnalysis.contractId, contractId))
      .returning();
    return analysis;
  }

  async deleteComplianceAnalysis(contractId: string): Promise<void> {
    await db.delete(complianceAnalysis).where(eq(complianceAnalysis.contractId, contractId));
  }

  // Contract obligations operations
  async createContractObligation(obligationData: InsertContractObligation): Promise<ContractObligation> {
    const [obligation] = await db
      .insert(contractObligations)
      .values(obligationData)
      .returning();
    return obligation;
  }

  async getContractObligations(contractId: string): Promise<ContractObligation[]> {
    return await db
      .select()
      .from(contractObligations)
      .where(eq(contractObligations.contractId, contractId))
      .orderBy(desc(contractObligations.dueDate));
  }

  async updateObligationStatus(id: string, status: string, completionDate?: Date): Promise<ContractObligation> {
    const updates: any = { status, updatedAt: new Date() };
    if (completionDate) {
      updates.completionDate = completionDate;
    }
    
    const [obligation] = await db
      .update(contractObligations)
      .set(updates)
      .where(eq(contractObligations.id, id))
      .returning();
    return obligation;
  }

  async deleteContractObligation(id: string): Promise<void> {
    await db.delete(contractObligations).where(eq(contractObligations.id, id));
  }

  // Performance metrics operations
  async createPerformanceMetrics(metricsData: InsertPerformanceMetrics): Promise<PerformanceMetrics> {
    const [metrics] = await db
      .insert(performanceMetrics)
      .values(metricsData)
      .returning();
    return metrics;
  }

  async getPerformanceMetrics(contractId: string): Promise<PerformanceMetrics | undefined> {
    const [metrics] = await db
      .select()
      .from(performanceMetrics)
      .where(eq(performanceMetrics.contractId, contractId));
    return metrics;
  }

  async updatePerformanceMetrics(contractId: string, updates: Partial<InsertPerformanceMetrics>): Promise<PerformanceMetrics> {
    const [metrics] = await db
      .update(performanceMetrics)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(performanceMetrics.contractId, contractId))
      .returning();
    return metrics;
  }

  async deletePerformanceMetrics(contractId: string): Promise<void> {
    await db.delete(performanceMetrics).where(eq(performanceMetrics.contractId, contractId));
  }

  // Strategic analysis operations
  async createStrategicAnalysis(analysisData: InsertStrategicAnalysis): Promise<StrategicAnalysis> {
    const [analysis] = await db
      .insert(strategicAnalysis)
      .values(analysisData)
      .returning();
    return analysis;
  }

  async getStrategicAnalysis(contractId: string): Promise<StrategicAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(strategicAnalysis)
      .where(eq(strategicAnalysis.contractId, contractId));
    return analysis;
  }

  async updateStrategicAnalysis(contractId: string, updates: Partial<InsertStrategicAnalysis>): Promise<StrategicAnalysis> {
    const [analysis] = await db
      .update(strategicAnalysis)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(strategicAnalysis.contractId, contractId))
      .returning();
    return analysis;
  }

  async deleteStrategicAnalysis(contractId: string): Promise<void> {
    await db.delete(strategicAnalysis).where(eq(strategicAnalysis.contractId, contractId));
  }

  // Contract comparison operations
  async createContractComparison(comparisonData: InsertContractComparison): Promise<ContractComparison> {
    const [comparison] = await db
      .insert(contractComparisons)
      .values(comparisonData)
      .returning();
    return comparison;
  }

  async getContractComparison(contractId: string): Promise<ContractComparison | undefined> {
    const [comparison] = await db
      .select()
      .from(contractComparisons)
      .where(eq(contractComparisons.contractId, contractId));
    return comparison;
  }

  async updateContractComparison(contractId: string, updates: Partial<InsertContractComparison>): Promise<ContractComparison> {
    const [comparison] = await db
      .update(contractComparisons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractComparisons.contractId, contractId))
      .returning();
    return comparison;
  }

  async deleteContractComparison(contractId: string): Promise<void> {
    await db.delete(contractComparisons).where(eq(contractComparisons.contractId, contractId));
  }

  // Market benchmark operations
  async createMarketBenchmark(benchmarkData: InsertMarketBenchmark): Promise<MarketBenchmark> {
    const [benchmark] = await db
      .insert(marketBenchmarks)
      .values(benchmarkData)
      .returning();
    return benchmark;
  }

  async getMarketBenchmarks(contractType?: string, industry?: string): Promise<MarketBenchmark[]> {
    let query = db.select().from(marketBenchmarks);
    
    if (contractType || industry) {
      const conditions = [];
      if (contractType) conditions.push(eq(marketBenchmarks.contractType, contractType));
      if (industry) conditions.push(eq(marketBenchmarks.industry, industry));
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(marketBenchmarks.lastUpdated));
  }

  async updateMarketBenchmark(id: string, updates: Partial<InsertMarketBenchmark>): Promise<MarketBenchmark> {
    const [benchmark] = await db
      .update(marketBenchmarks)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(marketBenchmarks.id, id))
      .returning();
    return benchmark;
  }

  async deleteMarketBenchmark(id: string): Promise<void> {
    await db.delete(marketBenchmarks).where(eq(marketBenchmarks.id, id));
  }

  // Analytics operations
  async getContractMetrics(userId?: string, context?: OrgAccessContext): Promise<{
    totalContracts: number;
    processing: number;
    analyzed: number;
    recentUploads: number;
    activeUsers: number;
  }> {
    const filterConditions: any[] = [];
    
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: contracts.companyId,
          businessUnitId: contracts.businessUnitId,
          locationId: contracts.locationId,
        },
        context
      );
      if (orgFilter) {
        filterConditions.push(orgFilter);
      }
    }
    
    if (userId) {
      filterConditions.push(eq(contracts.uploadedBy, userId));
    }

    const baseFilter = filterConditions.length > 0 
      ? (filterConditions.length === 1 ? filterConditions[0] : and(...filterConditions))
      : undefined;

    const [
      totalResult,
      processingResult,
      analyzedResult,
      recentResult,
      activeUsersResult
    ] = await Promise.all([
      baseFilter 
        ? db.select({ count: count() }).from(contracts).where(and(baseFilter, isNull(contracts.deletedAt)))
        : db.select({ count: count() }).from(contracts).where(isNull(contracts.deletedAt)),
      baseFilter
        ? db.select({ count: count() }).from(contracts).where(and(baseFilter, isNull(contracts.deletedAt), eq(contracts.status, 'processing')))
        : db.select({ count: count() }).from(contracts).where(and(isNull(contracts.deletedAt), eq(contracts.status, 'processing'))),
      baseFilter
        ? db.select({ count: count() }).from(contracts).where(and(baseFilter, isNull(contracts.deletedAt), eq(contracts.status, 'analyzed')))
        : db.select({ count: count() }).from(contracts).where(and(isNull(contracts.deletedAt), eq(contracts.status, 'analyzed'))),
      baseFilter
        ? db.select({ count: count() }).from(contracts).where(and(baseFilter, isNull(contracts.deletedAt), gte(contracts.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))))
        : db.select({ count: count() }).from(contracts).where(and(isNull(contracts.deletedAt), gte(contracts.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))),
      db.select({ count: count() }).from(users).where(eq(users.isActive, true))
    ]);

    return {
      totalContracts: totalResult[0].count,
      processing: processingResult[0].count,
      analyzed: analyzedResult[0].count,
      recentUploads: recentResult[0].count,
      activeUsers: activeUsersResult[0].count,
    };
  }

  async getDashboardKPIs(userId?: string, context?: OrgAccessContext): Promise<{
    totalActiveContracts: number;
    contractsByType: Array<{ type: string; count: number }>;
    pendingProcessing: number;
    contractsWithExceptions: number;
    periodAccrualExposure: number;
    journalsGenerated: number;
    pendingReviews: number;
    rulesNeedingReview: number;
    recentCalculations: Array<{ name: string; amount: number; status: string; date: string }>;
    contractStatusBreakdown: Array<{ status: string; count: number }>;
    ruleConfidenceDistribution: Array<{ range: string; count: number }>;
    monthlyActivity: Array<{ month: string; uploads: number; calculations: number }>;
    topContractsByValue: Array<{ name: string; value: number; status: string }>;
    approvalPipeline: { draft: number; pendingApproval: number; approved: number; rejected: number };
  }> {
    const filterConditions: any[] = [];
    
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: contracts.companyId,
          businessUnitId: contracts.businessUnitId,
          locationId: contracts.locationId,
        },
        context
      );
      if (orgFilter) {
        filterConditions.push(orgFilter);
      }
    }
    
    if (userId) {
      filterConditions.push(eq(contracts.uploadedBy, userId));
    }

    const baseFilter = filterConditions.length > 0 
      ? (filterConditions.length === 1 ? filterConditions[0] : and(...filterConditions))
      : undefined;

    const calcOrgFilter = context ? buildOrgContextFilter(
      {
        companyId: contractCalculations.companyId,
        businessUnitId: contractCalculations.businessUnitId,
        locationId: contractCalculations.locationId,
      },
      context
    ) : null;

    const [
      activeContracts,
      contractTypes,
      processingContracts,
      failedContracts,
      allRules,
      calculations,
      approvalStates,
      contractsWithDates,
    ] = await Promise.all([
      baseFilter
        ? db.select({ count: count() }).from(contracts).where(and(baseFilter, eq(contracts.status, 'analyzed')))
        : db.select({ count: count() }).from(contracts).where(eq(contracts.status, 'analyzed')),
      baseFilter
        ? db.select({ type: contracts.contractType, count: count() }).from(contracts).where(baseFilter).groupBy(contracts.contractType)
        : db.select({ type: contracts.contractType, count: count() }).from(contracts).groupBy(contracts.contractType),
      baseFilter
        ? db.select({ count: count() }).from(contracts).where(and(baseFilter, eq(contracts.status, 'processing')))
        : db.select({ count: count() }).from(contracts).where(eq(contracts.status, 'processing')),
      baseFilter
        ? db.select({ count: count() }).from(contracts).where(and(baseFilter, eq(contracts.status, 'failed')))
        : db.select({ count: count() }).from(contracts).where(eq(contracts.status, 'failed')),
      baseFilter
        ? db.select({
            id: contractRules.id,
            confidence: contractRules.confidence,
            reviewStatus: contractRules.reviewStatus,
            validationStatus: contractRules.validationStatus,
            isActive: contractRules.isActive,
          }).from(contractRules)
            .innerJoin(contracts, eq(contractRules.contractId, contracts.id))
            .where(baseFilter)
        : db.select({
            id: contractRules.id,
            confidence: contractRules.confidence,
            reviewStatus: contractRules.reviewStatus,
            validationStatus: contractRules.validationStatus,
            isActive: contractRules.isActive,
          }).from(contractRules),
      calcOrgFilter
        ? db.select({
            id: contractCalculations.id,
            name: contractCalculations.name,
            totalRoyalty: contractCalculations.totalRoyalty,
            status: contractCalculations.status,
            createdAt: contractCalculations.createdAt,
          }).from(contractCalculations)
            .where(calcOrgFilter)
            .orderBy(desc(contractCalculations.createdAt)).limit(10)
        : (baseFilter
          ? db.select({
              id: contractCalculations.id,
              name: contractCalculations.name,
              totalRoyalty: contractCalculations.totalRoyalty,
              status: contractCalculations.status,
              createdAt: contractCalculations.createdAt,
            }).from(contractCalculations)
              .innerJoin(contracts, eq(contractCalculations.contractId, contracts.id))
              .where(baseFilter)
              .orderBy(desc(contractCalculations.createdAt)).limit(10)
          : db.select({
              id: contractCalculations.id,
              name: contractCalculations.name,
              totalRoyalty: contractCalculations.totalRoyalty,
              status: contractCalculations.status,
              createdAt: contractCalculations.createdAt,
            }).from(contractCalculations)
              .orderBy(desc(contractCalculations.createdAt)).limit(10)
        ),
      baseFilter
        ? db.select({ state: contracts.approvalState, count: count() }).from(contracts).where(baseFilter).groupBy(contracts.approvalState)
        : db.select({ state: contracts.approvalState, count: count() }).from(contracts).groupBy(contracts.approvalState),
      baseFilter
        ? db.select({ createdAt: contracts.createdAt }).from(contracts).where(baseFilter)
        : db.select({ createdAt: contracts.createdAt }).from(contracts),
    ]);

    const contractsByType = contractTypes
      .filter(ct => ct.type)
      .map(ct => ({ type: ct.type || 'Unknown', count: ct.count }));

    const pendingRules = allRules.filter(r => r.reviewStatus === 'pending').length;
    const failedValidation = allRules.filter(r => r.validationStatus === 'failed').length;
    
    const confidenceRanges = [
      { range: 'High (80-100%)', count: 0 },
      { range: 'Medium (50-79%)', count: 0 },
      { range: 'Low (0-49%)', count: 0 },
    ];
    allRules.forEach(r => {
      const conf = parseFloat(r.confidence?.toString() || '0');
      if (conf >= 80) confidenceRanges[0].count++;
      else if (conf >= 50) confidenceRanges[1].count++;
      else confidenceRanges[2].count++;
    });

    const totalAccrual = calculations.reduce((sum, c) => 
      sum + parseFloat(c.totalRoyalty?.toString() || '0'), 0);
    
    const journalsCount = calculations.filter(c => 
      c.status === 'approved' || c.status === 'paid').length;

    const recentCalcs = calculations.slice(0, 5).map(c => ({
      name: c.name,
      amount: parseFloat(c.totalRoyalty?.toString() || '0'),
      status: c.status || 'pending',
      date: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US') : '',
    }));

    const statusMap: Record<string, number> = { uploaded: 0, processing: 0, analyzed: 0, failed: 0 };
    const allContracts = await (baseFilter 
      ? db.select({ status: contracts.status, count: count() }).from(contracts).where(baseFilter).groupBy(contracts.status)
      : db.select({ status: contracts.status, count: count() }).from(contracts).groupBy(contracts.status));
    allContracts.forEach(c => { statusMap[c.status] = c.count; });
    const contractStatusBreakdown = Object.entries(statusMap).map(([status, cnt]) => ({ status, count: cnt }));

    const now = new Date();
    const months: Array<{ month: string; uploads: number; calculations: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      
      const uploads = contractsWithDates.filter(c => {
        if (!c.createdAt) return false;
        const cd = new Date(c.createdAt);
        return cd >= monthStart && cd < monthEnd;
      }).length;

      const calcs = calculations.filter(c => {
        if (!c.createdAt) return false;
        const cd = new Date(c.createdAt);
        return cd >= monthStart && cd < monthEnd;
      }).length;

      months.push({ month: monthLabel, uploads, calculations: calcs });
    }

    const topContracts = await (baseFilter
      ? db.select({
          name: contracts.displayName,
          originalName: contracts.originalName,
          status: contracts.status,
          totalValue: financialAnalysis.totalValue,
        }).from(contracts)
          .leftJoin(financialAnalysis, eq(contracts.id, financialAnalysis.contractId))
          .where(baseFilter)
          .orderBy(desc(financialAnalysis.totalValue))
          .limit(5)
      : db.select({
          name: contracts.displayName,
          originalName: contracts.originalName,
          status: contracts.status,
          totalValue: financialAnalysis.totalValue,
        }).from(contracts)
          .leftJoin(financialAnalysis, eq(contracts.id, financialAnalysis.contractId))
          .orderBy(desc(financialAnalysis.totalValue))
          .limit(5));

    const topContractsByValue = topContracts.map(c => ({
      name: (c.name || c.originalName || 'Unnamed').substring(0, 30),
      value: parseFloat(c.totalValue?.toString() || '0'),
      status: c.status,
    }));

    const approvalPipeline = { draft: 0, pendingApproval: 0, approved: 0, rejected: 0 };
    approvalStates.forEach(a => {
      const key = a.state === 'pending_approval' ? 'pendingApproval' : a.state as keyof typeof approvalPipeline;
      if (key in approvalPipeline) approvalPipeline[key] = a.count;
    });

    const pendingApprovalCalcs = calculations.filter(c => c.status === 'pending_approval').length;

    return {
      totalActiveContracts: activeContracts[0].count,
      contractsByType,
      pendingProcessing: processingContracts[0].count,
      contractsWithExceptions: failedContracts[0].count + failedValidation,
      periodAccrualExposure: totalAccrual,
      journalsGenerated: journalsCount,
      pendingReviews: pendingApprovalCalcs,
      rulesNeedingReview: pendingRules,
      recentCalculations: recentCalcs,
      contractStatusBreakdown,
      ruleConfidenceDistribution: confidenceRanges,
      monthlyActivity: months,
      topContractsByValue,
      approvalPipeline,
    };
  }

  // Advanced analytics operations
  async getPortfolioAnalytics(userId?: string): Promise<{
    totalValue: number;
    avgPerformanceScore: number;
    complianceRate: number;
    upcomingObligations: number;
    renewalsPending: number;
  }> {
    // This is a complex aggregation that would join multiple analytics tables
    // For now, return sample data - this would be enhanced in production
    return {
      totalValue: 0,
      avgPerformanceScore: 0,
      complianceRate: 0,
      upcomingObligations: 0,
      renewalsPending: 0,
    };
  }

  // Aggregate analytics implementations
  async getFinancialAnalytics(userId?: string, companyId?: string): Promise<{
    totalContractValue: number;
    avgContractValue: number;
    totalPaymentScheduled: number;
    currencyDistribution: Record<string, number>;
    riskDistribution: { low: number; medium: number; high: number };
    topPaymentTerms: Array<{ term: string; count: number }>;
  }> {
    let contractsQuery = db
      .select({
        contractId: contracts.id,
        totalValue: financialAnalysis.totalValue,
        currency: financialAnalysis.currency,
        currencyRisk: financialAnalysis.currencyRisk,
        paymentTerms: financialAnalysis.paymentTerms,
      })
      .from(contracts)
      .leftJoin(financialAnalysis, eq(contracts.id, financialAnalysis.contractId));

    const conditions = [];
    if (userId) conditions.push(eq(contracts.uploadedBy, userId));
    if (companyId) conditions.push(eq(contracts.companyId, companyId));
    if (conditions.length > 0) {
      contractsQuery = contractsQuery.where(and(...conditions));
    }

    const results = await contractsQuery;
    
    const totalValue = results
      .filter(r => r.totalValue)
      .reduce((sum, r) => sum + parseFloat(r.totalValue?.toString() || '0'), 0);
    
    const avgValue = results.filter(r => r.totalValue).length > 0 ? 
      totalValue / results.filter(r => r.totalValue).length : 0;

    const currencyDistribution: Record<string, number> = {};
    const paymentTermsCount: Record<string, number> = {};
    const riskCounts = { low: 0, medium: 0, high: 0 };

    results.forEach(r => {
      if (r.currency) {
        currencyDistribution[r.currency] = (currencyDistribution[r.currency] || 0) + 1;
      }
      if (r.paymentTerms) {
        paymentTermsCount[r.paymentTerms] = (paymentTermsCount[r.paymentTerms] || 0) + 1;
      }
      if (r.currencyRisk) {
        const risk = parseFloat(r.currencyRisk.toString());
        if (risk < 30) riskCounts.low++;
        else if (risk < 70) riskCounts.medium++;
        else riskCounts.high++;
      }
    });

    const topPaymentTerms = Object.entries(paymentTermsCount)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalContractValue: totalValue,
      avgContractValue: avgValue,
      totalPaymentScheduled: totalValue, // Simplified - would calculate from payment schedules
      currencyDistribution,
      riskDistribution: riskCounts,
      topPaymentTerms,
    };
  }

  async getComplianceAnalytics(userId?: string, companyId?: string): Promise<{
    avgComplianceScore: number;
    complianceDistribution: { compliant: number; partial: number; nonCompliant: number };
    topRegulatoryFrameworks: Array<{ framework: string; count: number }>;
    jurisdictionBreakdown: Record<string, number>;
    dataProtectionCompliance: number;
  }> {
    let complianceQuery = db
      .select({
        complianceScore: complianceAnalysis.complianceScore,
        regulatoryFrameworks: complianceAnalysis.regulatoryFrameworks,
        jurisdictionAnalysis: complianceAnalysis.jurisdictionAnalysis,
        dataProtectionCompliance: complianceAnalysis.dataProtectionCompliance,
      })
      .from(contracts)
      .leftJoin(complianceAnalysis, eq(contracts.id, complianceAnalysis.contractId));

    const conditions = [];
    if (userId) conditions.push(eq(contracts.uploadedBy, userId));
    if (companyId) conditions.push(eq(contracts.companyId, companyId));
    if (conditions.length > 0) {
      complianceQuery = complianceQuery.where(and(...conditions));
    }

    const results = await complianceQuery;
    const validResults = results.filter(r => r.complianceScore);

    const avgScore = validResults.length > 0 ? 
      validResults.reduce((sum, r) => sum + parseFloat(r.complianceScore?.toString() || '0'), 0) / validResults.length : 0;

    const distribution = { compliant: 0, partial: 0, nonCompliant: 0 };
    let dataProtectionCount = 0;
    const frameworkCounts: Record<string, number> = {};
    const jurisdictionCounts: Record<string, number> = {};

    validResults.forEach(r => {
      const score = parseFloat(r.complianceScore?.toString() || '0');
      if (score >= 80) distribution.compliant++;
      else if (score >= 50) distribution.partial++;
      else distribution.nonCompliant++;

      if (r.dataProtectionCompliance) dataProtectionCount++;

      // Process regulatory frameworks and jurisdictions from JSONB data
      if (r.regulatoryFrameworks && Array.isArray(r.regulatoryFrameworks)) {
        r.regulatoryFrameworks.forEach((fw: any) => {
          if (typeof fw === 'string') {
            frameworkCounts[fw] = (frameworkCounts[fw] || 0) + 1;
          }
        });
      }
    });

    const topFrameworks = Object.entries(frameworkCounts)
      .map(([framework, count]) => ({ framework, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      avgComplianceScore: avgScore,
      complianceDistribution: distribution,
      topRegulatoryFrameworks: topFrameworks,
      jurisdictionBreakdown: jurisdictionCounts,
      dataProtectionCompliance: dataProtectionCount,
    };
  }

  async getStrategicAnalytics(userId?: string, companyId?: string): Promise<{
    avgStrategicValue: number;
    marketAlignmentDistribution: { high: number; medium: number; low: number };
    competitiveAdvantages: Array<{ advantage: string; count: number }>;
    avgRiskConcentration: number;
    topRecommendations: Array<{ recommendation: string; frequency: number }>;
  }> {
    let strategicQuery = db
      .select({
        strategicValue: strategicAnalysis.strategicValue,
        marketAlignment: strategicAnalysis.marketAlignment,
        competitiveAdvantage: strategicAnalysis.competitiveAdvantage,
        riskConcentration: strategicAnalysis.riskConcentration,
        recommendations: strategicAnalysis.recommendations,
      })
      .from(contracts)
      .leftJoin(strategicAnalysis, eq(contracts.id, strategicAnalysis.contractId));

    const conditions = [];
    if (userId) conditions.push(eq(contracts.uploadedBy, userId));
    if (companyId) conditions.push(eq(contracts.companyId, companyId));
    if (conditions.length > 0) {
      strategicQuery = strategicQuery.where(and(...conditions));
    }

    const results = await strategicQuery;
    const validResults = results.filter(r => r.strategicValue);

    const avgStrategicValue = validResults.length > 0 ? 
      validResults.reduce((sum, r) => sum + parseFloat(r.strategicValue?.toString() || '0'), 0) / validResults.length : 0;

    const avgRiskConcentration = validResults.length > 0 ? 
      validResults.reduce((sum, r) => sum + parseFloat(r.riskConcentration?.toString() || '0'), 0) / validResults.length : 0;

    const alignmentDistribution = { high: 0, medium: 0, low: 0 };
    const advantageCounts: Record<string, number> = {};
    const recommendationCounts: Record<string, number> = {};

    validResults.forEach(r => {
      const alignment = parseFloat(r.marketAlignment?.toString() || '0');
      if (alignment >= 80) alignmentDistribution.high++;
      else if (alignment >= 50) alignmentDistribution.medium++;
      else alignmentDistribution.low++;

      // Process competitive advantages and recommendations from JSONB
      if (r.competitiveAdvantage && Array.isArray(r.competitiveAdvantage)) {
        r.competitiveAdvantage.forEach((adv: any) => {
          if (typeof adv === 'object' && adv.advantage) {
            advantageCounts[adv.advantage] = (advantageCounts[adv.advantage] || 0) + 1;
          }
        });
      }

      if (r.recommendations && Array.isArray(r.recommendations)) {
        r.recommendations.forEach((rec: any) => {
          if (typeof rec === 'object' && rec.title) {
            recommendationCounts[rec.title] = (recommendationCounts[rec.title] || 0) + 1;
          }
        });
      }
    });

    return {
      avgStrategicValue,
      marketAlignmentDistribution: alignmentDistribution,
      competitiveAdvantages: Object.entries(advantageCounts)
        .map(([advantage, count]) => ({ advantage, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      avgRiskConcentration,
      topRecommendations: Object.entries(recommendationCounts)
        .map(([recommendation, frequency]) => ({ recommendation, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5),
    };
  }

  async getPerformanceAnalytics(userId?: string, companyId?: string): Promise<{
    avgPerformanceScore: number;
    avgMilestoneCompletion: number;
    onTimeDeliveryRate: number;
    avgBudgetVariance: number;
    avgQualityScore: number;
    avgRenewalProbability: number;
  }> {
    let performanceQuery = db
      .select({
        performanceScore: performanceMetrics.performanceScore,
        milestoneCompletion: performanceMetrics.milestoneCompletion,
        onTimeDelivery: performanceMetrics.onTimeDelivery,
        budgetVariance: performanceMetrics.budgetVariance,
        qualityScore: performanceMetrics.qualityScore,
        renewalProbability: performanceMetrics.renewalProbability,
      })
      .from(contracts)
      .leftJoin(performanceMetrics, eq(contracts.id, performanceMetrics.contractId));

    const conditions = [];
    if (userId) conditions.push(eq(contracts.uploadedBy, userId));
    if (companyId) conditions.push(eq(contracts.companyId, companyId));
    if (conditions.length > 0) {
      performanceQuery = performanceQuery.where(and(...conditions));
    }

    const results = await performanceQuery;
    const validResults = results.filter(r => r.performanceScore);

    if (validResults.length === 0) {
      return {
        avgPerformanceScore: 0,
        avgMilestoneCompletion: 0,
        onTimeDeliveryRate: 0,
        avgBudgetVariance: 0,
        avgQualityScore: 0,
        avgRenewalProbability: 0,
      };
    }

    const avgPerformanceScore = validResults.reduce((sum, r) => 
      sum + parseFloat(r.performanceScore?.toString() || '0'), 0) / validResults.length;
    
    const avgMilestoneCompletion = validResults.reduce((sum, r) => 
      sum + parseFloat(r.milestoneCompletion?.toString() || '0'), 0) / validResults.length;
    
    const onTimeCount = validResults.filter(r => r.onTimeDelivery).length;
    const onTimeDeliveryRate = (onTimeCount / validResults.length) * 100;
    
    const avgBudgetVariance = validResults.reduce((sum, r) => 
      sum + parseFloat(r.budgetVariance?.toString() || '0'), 0) / validResults.length;
    
    const avgQualityScore = validResults.reduce((sum, r) => 
      sum + parseFloat(r.qualityScore?.toString() || '0'), 0) / validResults.length;
    
    const avgRenewalProbability = validResults.reduce((sum, r) => 
      sum + parseFloat(r.renewalProbability?.toString() || '0'), 0) / validResults.length;

    return {
      avgPerformanceScore,
      avgMilestoneCompletion,
      onTimeDeliveryRate,
      avgBudgetVariance,
      avgQualityScore,
      avgRenewalProbability,
    };
  }

  async getRiskAnalytics(userId?: string, companyId?: string): Promise<{
    riskDistribution: { high: number; medium: number; low: number };
    topRiskFactors: Array<{ risk: string; frequency: number }>;
    avgRiskScore: number;
    contractsAtRisk: number;
    riskTrends: Array<{ date: string; riskScore: number }>;
  }> {
    // Aggregate risk data from multiple analysis tables
    let analysisQuery = db
      .select({
        contractId: contracts.id,
        createdAt: contracts.createdAt,
        riskAnalysis: contractAnalysis.riskAnalysis,
        currencyRisk: financialAnalysis.currencyRisk,
        complianceScore: complianceAnalysis.complianceScore,
        riskConcentration: strategicAnalysis.riskConcentration,
      })
      .from(contracts)
      .leftJoin(contractAnalysis, eq(contracts.id, contractAnalysis.contractId))
      .leftJoin(financialAnalysis, eq(contracts.id, financialAnalysis.contractId))
      .leftJoin(complianceAnalysis, eq(contracts.id, complianceAnalysis.contractId))
      .leftJoin(strategicAnalysis, eq(contracts.id, strategicAnalysis.contractId));

    const conditions = [];
    if (userId) conditions.push(eq(contracts.uploadedBy, userId));
    if (companyId) conditions.push(eq(contracts.companyId, companyId));
    if (conditions.length > 0) {
      analysisQuery = analysisQuery.where(and(...conditions));
    }

    const results = await analysisQuery;

    const riskDistribution = { high: 0, medium: 0, low: 0 };
    const riskFactorCounts: Record<string, number> = {};
    const riskScores: number[] = [];
    let contractsAtRisk = 0;
    const riskTrends: Array<{ date: string; riskScore: number }> = [];

    results.forEach(r => {
      let overallRisk = 0;
      let riskCount = 0;

      // Aggregate various risk scores
      if (r.currencyRisk) {
        overallRisk += parseFloat(r.currencyRisk.toString());
        riskCount++;
      }
      
      if (r.complianceScore) {
        // Convert compliance score to risk (inverse relationship)
        overallRisk += (100 - parseFloat(r.complianceScore.toString()));
        riskCount++;
      }

      if (r.riskConcentration) {
        overallRisk += parseFloat(r.riskConcentration.toString());
        riskCount++;
      }

      if (riskCount > 0) {
        const avgRisk = overallRisk / riskCount;
        riskScores.push(avgRisk);

        // Categorize risk level
        if (avgRisk >= 70) {
          riskDistribution.high++;
          contractsAtRisk++;
        } else if (avgRisk >= 40) {
          riskDistribution.medium++;
        } else {
          riskDistribution.low++;
        }

        // Add to risk trends (simplified monthly aggregation)
        if (r.createdAt) {
          const monthKey = r.createdAt.toISOString().slice(0, 7); // YYYY-MM
          riskTrends.push({ date: monthKey, riskScore: avgRisk });
        }
      }

      // Process risk factors from contract analysis
      if (r.riskAnalysis && Array.isArray(r.riskAnalysis)) {
        r.riskAnalysis.forEach((risk: any) => {
          if (typeof risk === 'object' && risk.title) {
            riskFactorCounts[risk.title] = (riskFactorCounts[risk.title] || 0) + 1;
          }
        });
      }
    });

    const avgRiskScore = riskScores.length > 0 ? 
      riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length : 0;

    // Group risk trends by month and average
    const trendMap = new Map<string, { total: number; count: number }>();
    riskTrends.forEach(trend => {
      const existing = trendMap.get(trend.date) || { total: 0, count: 0 };
      existing.total += trend.riskScore;
      existing.count += 1;
      trendMap.set(trend.date, existing);
    });

    const aggregatedTrends = Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, riskScore: data.total / data.count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-6); // Last 6 months

    return {
      riskDistribution,
      topRiskFactors: Object.entries(riskFactorCounts)
        .map(([risk, frequency]) => ({ risk, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
      avgRiskScore,
      contractsAtRisk,
      riskTrends: aggregatedTrends,
    };
  }

  // Sales data operations
  async createSalesData(data: InsertSalesData): Promise<SalesData> {
    const [salesDataRecord] = await db.insert(salesData).values(data).returning();
    return salesDataRecord;
  }

  async createBulkSalesData(salesDataArray: InsertSalesData[]): Promise<SalesData[]> {
    if (salesDataArray.length === 0) return [];
    const records = await db.insert(salesData).values(salesDataArray).returning();
    return records;
  }

  async getSalesDataByContract(contractId: string, context?: OrgAccessContext): Promise<SalesData[]> {
    const filterConditions: any[] = [eq(salesData.matchedContractId, contractId)];
    
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: salesData.companyId,
          businessUnitId: salesData.businessUnitId,
          locationId: salesData.locationId,
        },
        context
      );
      if (orgFilter) {
        filterConditions.push(orgFilter);
      }
    }
    
    const result = await db
      .select()
      .from(salesData)
      .where(and(...filterConditions))
      .orderBy(desc(salesData.transactionDate));
    
    if (result.length > 0) {
      console.log(`📊 [SALES] Found ${result.length} sales directly matched to contract ${contractId}.`);
      return result;
    }

    console.log(`📊 [SALES] No sales data matched to contract ${contractId}. Sales must be uploaded with this contract selected, or matched via Sales Matching. Company-wide fallback is disabled to prevent cross-contract contamination.`);
    return [];
  }

  async getSalesForContractViaJunction(contractId: string): Promise<SalesData[]> {
    const result = await db
      .select({ salesData: salesData })
      .from(saleContractMatches)
      .innerJoin(salesData, eq(saleContractMatches.saleId, salesData.id))
      .where(eq(saleContractMatches.contractId, contractId))
      .orderBy(desc(salesData.transactionDate));

    if (result.length > 0) {
      console.log(`📊 [SALES-JUNCTION] Found ${result.length} sales linked to contract ${contractId} via sale_contract_matches.`);
      return result.map(r => r.salesData);
    }

    console.log(`📊 [SALES-JUNCTION] No junction matches found for contract ${contractId}. Falling back to matched_contract_id.`);
    return this.getSalesDataByContract(contractId);
  }

  async getAllSalesData(limit: number = 100, offset: number = 0, context?: OrgAccessContext): Promise<{ salesData: SalesData[], total: number }> {
    const filterConditions: any[] = [];
    
    // Apply organizational context filtering
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: salesData.companyId,
          businessUnitId: salesData.businessUnitId,
          locationId: salesData.locationId,
        },
        context
      );
      if (orgFilter) {
        filterConditions.push(orgFilter);
      }
    }
    
    // Build base query with optional filters
    const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;
    
    const [totalResult] = await db
      .select({ count: count() })
      .from(salesData)
      .where(whereClause);
      
    const data = await db
      .select()
      .from(salesData)
      .where(whereClause)
      .orderBy(desc(salesData.transactionDate))
      .limit(limit)
      .offset(offset);
    
    return {
      salesData: data,
      total: totalResult?.count || 0,
    };
  }

  async updateSalesDataMatch(id: string, contractId: string, confidence: number): Promise<SalesData> {
    const [updated] = await db
      .update(salesData)
      .set({ 
        matchedContractId: contractId, 
        matchConfidence: confidence.toString() 
      })
      .where(eq(salesData.id, id))
      .returning();
    return updated;
  }

  async deleteSalesData(id: string): Promise<void> {
    await db.delete(salesData).where(eq(salesData.id, id));
  }

  async deleteAllSalesDataForContract(contractId: string): Promise<void> {
    await db.delete(salesData).where(eq(salesData.matchedContractId, contractId));
  }

  // Contract fee calculation operations
  async createContractRoyaltyCalculation(calculation: InsertContractRoyaltyCalculation): Promise<ContractRoyaltyCalculation> {
    const [created] = await db
      .insert(contractCalculations)
      .values(calculation)
      .returning();
    return created;
  }

  async getContractRoyaltyCalculations(contractId: string, context?: OrgAccessContext): Promise<ContractRoyaltyCalculation[]> {
    const filterConditions: any[] = [eq(contractCalculations.contractId, contractId)];
    
    // Apply organizational context filtering
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: contractCalculations.companyId,
          businessUnitId: contractCalculations.businessUnitId,
          locationId: contractCalculations.locationId,
        },
        context
      );
      if (orgFilter) {
        filterConditions.push(orgFilter);
      }
    }
    
    return await db
      .select()
      .from(contractCalculations)
      .where(and(...filterConditions))
      .orderBy(desc(contractCalculations.createdAt));
  }

  async getContractRoyaltyCalculation(id: string, context?: OrgAccessContext): Promise<ContractRoyaltyCalculation | undefined> {
    const filterConditions: any[] = [eq(contractCalculations.id, id)];
    
    // Apply organizational context filtering
    if (context) {
      const orgFilter = buildOrgContextFilter(
        {
          companyId: contractCalculations.companyId,
          businessUnitId: contractCalculations.businessUnitId,
          locationId: contractCalculations.locationId,
        },
        context
      );
      if (orgFilter) {
        filterConditions.push(orgFilter);
      }
    }
    
    const [calculation] = await db
      .select()
      .from(contractCalculations)
      .where(and(...filterConditions));
    return calculation;
  }

  async updateCalculationStatus(id: string, status: string, comments?: string): Promise<ContractRoyaltyCalculation> {
    const updateData: any = { status };
    if (comments !== undefined) {
      updateData.comments = comments;
    }
    
    const [updated] = await db
      .update(contractCalculations)
      .set(updateData)
      .where(eq(contractCalculations.id, id))
      .returning();
    return updated;
  }

  async deleteContractRoyaltyCalculation(id: string): Promise<void> {
    await db.delete(contractCalculations).where(eq(contractCalculations.id, id));
  }

  async deleteAllCalculationsForContract(contractId: string): Promise<void> {
    await db.delete(contractCalculations).where(eq(contractCalculations.contractId, contractId));
  }

  async createCalculationRuleResult(result: InsertCalculationRuleResult): Promise<CalculationRuleResult> {
    const [newResult] = await db.insert(calculationRuleResults).values(result).returning();
    return newResult;
  }

  async createCalculationRuleResults(results: InsertCalculationRuleResult[]): Promise<CalculationRuleResult[]> {
    if (results.length === 0) return [];
    const inserted = await db.insert(calculationRuleResults).values(results).returning();
    return inserted;
  }

  async getCalculationRuleResults(calculationId: string): Promise<CalculationRuleResult[]> {
    return await db
      .select()
      .from(calculationRuleResults)
      .where(eq(calculationRuleResults.calculationId, calculationId))
      .orderBy(desc(calculationRuleResults.totalFee));
  }

  async deleteCalculationRuleResults(calculationId: string): Promise<void> {
    await db.delete(calculationRuleResults).where(eq(calculationRuleResults.calculationId, calculationId));
  }

  // Royalty rule operations
  async createRoyaltyRule(rule: InsertRoyaltyRule): Promise<RoyaltyRule> {
    const [newRule] = await db.insert(contractRules).values(rule).returning();
    return newRule;
  }

  async getRoyaltyRulesByContract(contractId: string): Promise<RoyaltyRule[]> {
    const result = await db.execute(sql`
      SELECT * FROM contract_rules 
      WHERE contract_id = ${contractId} AND is_active = true
      ORDER BY 
        COALESCE(extraction_order, 999999) ASC,
        COALESCE(
          source_page::int,
          COALESCE((regexp_match(source_section, '[Pp]age\s*([0-9]+)'))[1]::int, 999999)
        ) ASC,
        priority ASC,
        created_at ASC
    `);
    // Convert snake_case columns to camelCase for frontend compatibility
    const mapped = (result.rows as any[]).map(row => ({
      id: row.id,
      contractId: row.contract_id,
      ruleName: row.rule_name,
      ruleType: row.rule_type,
      description: row.description,
      calculationBasis: row.calculation_basis,
      rateType: row.rate_type,
      rateValue: row.rate_value,
      minimumFee: row.minimum_fee,
      maximumFee: row.maximum_fee,
      thresholdType: row.threshold_type,
      thresholdValue: row.threshold_value,
      tierStructure: row.tier_structure,
      effectiveDate: row.effective_date,
      expiryDate: row.expiry_date,
      priority: row.priority,
      conditions: row.conditions,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sourceText: row.source_text,
      sourceSection: row.source_section,
      confidence: row.confidence,
      sourcePage: row.source_page,
      validationStatus: row.validation_status,
      validatedConfidence: row.validated_confidence,
      validationDetails: row.validation_details,
      formulaDefinition: row.formula_definition,
      reviewStatus: row.review_status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      approvalStatus: row.approval_status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      // Add missing fields for rule categorization
      minimumGuarantee: row.minimum_guarantee,
      baseRate: row.base_rate,
      volumeTiers: row.volume_tiers,
      calculation: row.calculation,
      productCategories: row.product_categories,
      territories: row.territories,
      seasonalAdjustments: row.seasonal_adjustments,
      territoryPremiums: row.territory_premiums,
      fieldMappings: row.field_mappings,
      extractionOrder: row.extraction_order,
      ruleVersionNum: row.rule_version_num,
      previousVersionData: row.previous_version_data,
      clauseCategory: row.clause_category,
      customerSegments: row.customer_segments,
      channel: row.channel,
      minimumPrice: row.minimum_price,
      sourceClauseId: row.source_clause_id,
      // Phase taxonomy (Task #5 slice 1) — mirror getActiveRoyaltyRulesByContract
      // so all callers see consistent metadata regardless of which fetch they use.
      calcPhase: row.calc_phase,
      triggerSource: row.trigger_source,
      aggregationScope: row.aggregation_scope,
      // Calculation engine fields surfaced by the side-panel rule editor.
      // These columns exist in the contract_rules schema but were dropped
      // by the manual snake→camel mapper; the editor was rendering empty
      // fields as a result.
      baseMetric: row.base_metric,
      templateCode: row.template_code,
      executionGroup: row.execution_group,
      calculationFormula: row.calculation_formula,
      formulaVersion: row.formula_version,
      partnerIds: row.partner_ids,
      exceptions: row.exceptions,
      specificityScore: row.specificity_score,
      fieldConfidence: row.field_confidence,
      reviewFlags: row.review_flags,
      uom: row.uom,
      qualifierGroups: row.qualifier_groups,
      milestones: row.milestones,
      milestoneCount: row.milestone_count,
      milestoneTiers: row.milestone_tiers,
      milestoneConfig: row.milestone_config,
      approvalNotes: row.approval_notes,
    }));

    // Single source of truth: enrich productCategories/territories from
    // contract_qualifiers when a rule has linkable qualifier rows. Stored
    // arrays remain as fallback for rules without sourceClauseId.
    const { enrichRulesWithDerivedArrays } = await import("./services/qualifierSync");
    return (await enrichRulesWithDerivedArrays(mapped as any, contractId)) as RoyaltyRule[];
  }

  async getActiveRoyaltyRulesByContract(contractId: string): Promise<RoyaltyRule[]> {
    const result = await db.execute(sql`
      SELECT * FROM contract_rules 
      WHERE contract_id = ${contractId} AND is_active = true
      ORDER BY 
        COALESCE(extraction_order, 999999) ASC,
        source_page ASC NULLS LAST,
        priority ASC
    `);
    // Convert snake_case columns to camelCase for frontend compatibility
    const mapped = (result.rows as any[]).map(row => ({
      id: row.id,
      contractId: row.contract_id,
      ruleName: row.rule_name,
      ruleType: row.rule_type,
      description: row.description,
      calculationBasis: row.calculation_basis,
      rateType: row.rate_type,
      rateValue: row.rate_value,
      minimumFee: row.minimum_fee,
      maximumFee: row.maximum_fee,
      thresholdType: row.threshold_type,
      thresholdValue: row.threshold_value,
      tierStructure: row.tier_structure,
      effectiveDate: row.effective_date,
      expiryDate: row.expiry_date,
      priority: row.priority,
      conditions: row.conditions,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sourceText: row.source_text,
      sourceSection: row.source_section,
      confidence: row.confidence,
      sourcePage: row.source_page,
      validationStatus: row.validation_status,
      validatedConfidence: row.validated_confidence,
      validationDetails: row.validation_details,
      formulaDefinition: row.formula_definition,
      reviewStatus: row.review_status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      approvalStatus: row.approval_status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      // Add missing fields for rule categorization
      minimumGuarantee: row.minimum_guarantee,
      baseRate: row.base_rate,
      volumeTiers: row.volume_tiers,
      calculation: row.calculation,
      productCategories: row.product_categories,
      territories: row.territories,
      seasonalAdjustments: row.seasonal_adjustments,
      territoryPremiums: row.territory_premiums,
      fieldMappings: row.field_mappings,
      extractionOrder: row.extraction_order,
      ruleVersionNum: row.rule_version_num,
      previousVersionData: row.previous_version_data,
      clauseCategory: row.clause_category,
      customerSegments: row.customer_segments,
      channel: row.channel,
      minimumPrice: row.minimum_price,
      sourceClauseId: row.source_clause_id,
      // Phase taxonomy (Task #5 slice 1) — surface so route-level fallback
      // resolveCalcPhase respects an explicit per-rule override.
      calcPhase: row.calc_phase,
      triggerSource: row.trigger_source,
      aggregationScope: row.aggregation_scope,
      // Calculation engine fields surfaced by the side-panel rule editor.
      // Mirror getRoyaltyRulesByContract so both fetch paths return the same
      // shape — the editor was rendering empty fields when this mapper was
      // used.
      baseMetric: row.base_metric,
      templateCode: row.template_code,
      executionGroup: row.execution_group,
      calculationFormula: row.calculation_formula,
      formulaVersion: row.formula_version,
      partnerIds: row.partner_ids,
      exceptions: row.exceptions,
      specificityScore: row.specificity_score,
      fieldConfidence: row.field_confidence,
      reviewFlags: row.review_flags,
      uom: row.uom,
      qualifierGroups: row.qualifier_groups,
      milestones: row.milestones,
      milestoneCount: row.milestone_count,
      milestoneTiers: row.milestone_tiers,
      milestoneConfig: row.milestone_config,
      approvalNotes: row.approval_notes,
    }));

    // Single source of truth: enrich productCategories/territories from
    // contract_qualifiers when a rule has linkable qualifier rows. Stored
    // arrays remain as fallback for rules without sourceClauseId.
    const { enrichRulesWithDerivedArrays } = await import("./services/qualifierSync");
    return (await enrichRulesWithDerivedArrays(mapped as any, contractId)) as RoyaltyRule[];
  }

  async deleteRoyaltyRule(ruleId: string): Promise<void> {
    await db.delete(contractRules).where(eq(contractRules.id, ruleId));
  }

  async deleteRoyaltyRulesByContract(contractId: string): Promise<void> {
    await db.delete(contractRules).where(eq(contractRules.contractId, contractId));
  }

  async updateRoyaltyRule(ruleId: string, updates: Partial<InsertRoyaltyRule>): Promise<RoyaltyRule> {
    const [updated] = await db
      .update(contractRules)
      .set(updates)
      .where(eq(contractRules.id, ruleId))
      .returning();
    return updated;
  }

  // Dynamic extraction operations
  async getExtractionRun(id: string): Promise<any> {
    const run = await db.query.extractionRuns.findFirst({
      where: (runs, { eq }) => eq(runs.id, id),
    });
    return run;
  }

  async getExtractionRunsByContract(contractId: string): Promise<any[]> {
    const runs = await db.query.extractionRuns.findMany({
      where: (runs, { eq }) => eq(runs.contractId, contractId),
      orderBy: (runs, { desc }) => [desc(runs.createdAt)],
    });
    return runs;
  }

  async getContractKnowledgeGraph(contractId: string): Promise<{ nodes: any[], edges: any[] }> {
    const nodes = await db.query.contractGraphNodes.findMany({
      where: (nodes, { eq }) => eq(nodes.contractId, contractId),
    });
    
    const edges = await db.query.contractGraphEdges.findMany({
      where: (edges, { eq }) => eq(edges.contractId, contractId),
    });
    
    return { nodes, edges };
  }

  async getDynamicRulesByContract(contractId: string): Promise<any[]> {
    const rules = await db.query.ruleDefinitions.findMany({
      where: (rules, { eq }) => eq(rules.contractId, contractId),
      orderBy: (rules, { desc }) => [desc(rules.createdAt)],
    });
    return rules;
  }

  async getRuleValidationEvents(ruleId: string): Promise<any[]> {
    const events = await db.query.ruleValidationEvents.findMany({
      where: (events, { eq }) => eq(events.ruleDefinitionId, ruleId),
      orderBy: (events, { desc }) => [desc(events.createdAt)],
    });
    return events;
  }

  // Lead capture operations
  async createEarlyAccessSignup(signup: InsertEarlyAccessSignup): Promise<EarlyAccessSignup> {
    const [result] = await db
      .insert(earlyAccessSignups)
      .values(signup)
      .returning();
    return result;
  }

  async getAllEarlyAccessSignups(status?: string): Promise<EarlyAccessSignup[]> {
    let query = db.select().from(earlyAccessSignups);
    
    if (status) {
      query = query.where(eq(earlyAccessSignups.status, status));
    }
    
    return await query.orderBy(desc(earlyAccessSignups.createdAt));
  }

  async updateEarlyAccessSignupStatus(id: string, status?: string, notes?: string): Promise<EarlyAccessSignup> {
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (status) {
      updateData.status = status;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    const [result] = await db
      .update(earlyAccessSignups)
      .set(updateData)
      .where(eq(earlyAccessSignups.id, id))
      .returning();
    return result;
  }

  async createDemoRequest(request: InsertDemoRequest): Promise<DemoRequest> {
    const [result] = await db
      .insert(demoRequests)
      .values(request)
      .returning();
    return result;
  }

  async getAllDemoRequests(status?: string, planTier?: string): Promise<DemoRequest[]> {
    let query = db.select().from(demoRequests);
    
    const conditions = [];
    if (status) {
      conditions.push(eq(demoRequests.status, status));
    }
    if (planTier) {
      conditions.push(eq(demoRequests.planTier, planTier));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(demoRequests.createdAt));
  }

  async updateDemoRequestStatus(id: string, status?: string, notes?: string): Promise<DemoRequest> {
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (status) {
      updateData.status = status;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    const [result] = await db
      .update(demoRequests)
      .set(updateData)
      .where(eq(demoRequests.id, id))
      .returning();
    return result;
  }

  async appendLeadActivity(id: string, type: 'early_access' | 'demo_request', entry: { action: string; details?: string; emailSubject?: string; emailPreview?: string; by?: string }): Promise<void> {
    const logEntry = { ...entry, timestamp: new Date().toISOString() };
    const table = type === 'early_access' ? earlyAccessSignups : demoRequests;
    const [existing] = await db.select({ activityLog: table.activityLog }).from(table).where(eq(table.id, id));
    const currentLog = Array.isArray(existing?.activityLog) ? existing.activityLog : [];
    (currentLog as any[]).push(logEntry);
    await db.update(table).set({ activityLog: currentLog, updatedAt: new Date() }).where(eq(table.id, id));
  }

  async getLeadByEmail(email: string): Promise<{ id: string; type: 'early_access' | 'demo_request'; status: string } | null> {
    const [ea] = await db.select({ id: earlyAccessSignups.id, status: earlyAccessSignups.status }).from(earlyAccessSignups).where(eq(earlyAccessSignups.email, email.toLowerCase())).limit(1);
    if (ea) return { id: ea.id, type: 'early_access', status: ea.status };
    const [dr] = await db.select({ id: demoRequests.id, status: demoRequests.status }).from(demoRequests).where(eq(demoRequests.email, email.toLowerCase())).limit(1);
    if (dr) return { id: dr.id, type: 'demo_request', status: dr.status };
    return null;
  }

  async setLeadVerificationToken(id: string, type: 'early_access' | 'demo_request', token: string): Promise<void> {
    if (type === 'early_access') {
      await db.update(earlyAccessSignups).set({ verificationToken: token, updatedAt: new Date() }).where(eq(earlyAccessSignups.id, id));
    } else {
      await db.update(demoRequests).set({ verificationToken: token, updatedAt: new Date() }).where(eq(demoRequests.id, id));
    }
  }

  async getLeadByVerificationToken(token: string): Promise<{ id: string; email: string; name: string | null; company: string | null; type: 'early_access' | 'demo_request'; verificationData: any } | null> {
    const [ea] = await db.select().from(earlyAccessSignups).where(eq(earlyAccessSignups.verificationToken, token)).limit(1);
    if (ea) return { id: ea.id, email: ea.email, name: ea.name, company: ea.company, type: 'early_access', verificationData: ea.verificationData };
    const [dr] = await db.select().from(demoRequests).where(eq(demoRequests.verificationToken, token)).limit(1);
    if (dr) return { id: dr.id, email: dr.email, name: null, company: null, type: 'demo_request', verificationData: dr.verificationData };
    return null;
  }

  async submitLeadVerification(id: string, type: 'early_access' | 'demo_request', data: any): Promise<void> {
    const now = new Date();
    if (type === 'early_access') {
      await db.update(earlyAccessSignups).set({ verificationData: data, verifiedAt: now, status: 'verified', updatedAt: now }).where(eq(earlyAccessSignups.id, id));
    } else {
      await db.update(demoRequests).set({ verificationData: data, verifiedAt: now, status: 'verified', updatedAt: now }).where(eq(demoRequests.id, id));
    }
  }

  // Email template operations
  async getAllEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).orderBy(emailTemplates.name);
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [result] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
    return result;
  }

  async getEmailTemplateByKey(templateKey: string): Promise<EmailTemplate | undefined> {
    const [result] = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, templateKey)).limit(1);
    return result;
  }

  async updateEmailTemplate(id: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate> {
    const [result] = await db
      .update(emailTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id))
      .returning();
    return result;
  }

  async resetEmailTemplate(id: string): Promise<EmailTemplate> {
    const [existing] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
    if (!existing) throw new Error('Template not found');
    const { DEFAULT_TEMPLATES } = await import('./email-templates.js');
    const defaultTemplate = DEFAULT_TEMPLATES[existing.templateKey];
    if (!defaultTemplate) throw new Error('No default template found for this key');
    const [result] = await db
      .update(emailTemplates)
      .set({
        subject: defaultTemplate.subject,
        htmlBody: defaultTemplate.htmlBody,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, id))
      .returning();
    return result;
  }

  // Master data mapping operations
  async createMasterDataMapping(mapping: any): Promise<any> {
    const [result] = await db
      .insert(masterDataMappings)
      .values(mapping)
      .returning();
    return result;
  }

  async getMasterDataMapping(id: string): Promise<any | undefined> {
    const [mapping] = await db
      .select()
      .from(masterDataMappings)
      .where(eq(masterDataMappings.id, id));
    return mapping;
  }

  async getAllMasterDataMappings(filters?: { erpSystem?: string; entityType?: string; status?: string; companyId?: string | null; isSystemAdmin?: boolean }): Promise<any[]> {
    let query = db.select().from(masterDataMappings);
    
    const conditions = [];
    if (filters?.erpSystem) {
      conditions.push(eq(masterDataMappings.erpSystem, filters.erpSystem));
    }
    if (filters?.entityType) {
      conditions.push(eq(masterDataMappings.entityType, filters.entityType));
    }
    if (filters?.status) {
      conditions.push(eq(masterDataMappings.status, filters.status));
    }

    if (!filters?.isSystemAdmin) {
      if (filters?.companyId) {
        conditions.push(
          or(
            eq(masterDataMappings.companyId, filters.companyId),
            isNull(masterDataMappings.companyId)
          )!
        );
      } else {
        conditions.push(isNull(masterDataMappings.companyId));
      }
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(masterDataMappings.createdAt));
  }

  async updateMasterDataMapping(id: string, updates: Partial<any>): Promise<any> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };
    
    const [result] = await db
      .update(masterDataMappings)
      .set(updateData)
      .where(eq(masterDataMappings.id, id))
      .returning();
    return result;
  }

  async deleteMasterDataMapping(id: string): Promise<void> {
    // First, delete related imported ERP records that reference this mapping
    await db
      .delete(importedErpRecords)
      .where(eq(importedErpRecords.mappingId, id));
    
    // Then delete the mapping itself
    await db
      .delete(masterDataMappings)
      .where(eq(masterDataMappings.id, id));
  }

  // ERP Systems operations
  async createErpSystem(system: InsertErpSystem): Promise<ErpSystem> {
    const [result] = await db
      .insert(erpSystems)
      .values(system)
      .returning();
    return result;
  }

  async getErpSystem(id: string): Promise<ErpSystem | undefined> {
    const [result] = await db
      .select()
      .from(erpSystems)
      .where(eq(erpSystems.id, id));
    return result;
  }

  async getAllErpSystems(status?: string): Promise<ErpSystem[]> {
    const conditions = status ? eq(erpSystems.status, status) : undefined;
    const results = await db
      .select()
      .from(erpSystems)
      .where(conditions)
      .orderBy(desc(erpSystems.createdAt));
    return results;
  }

  async updateErpSystem(id: string, updates: Partial<InsertErpSystem>): Promise<ErpSystem> {
    const [result] = await db
      .update(erpSystems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(erpSystems.id, id))
      .returning();
    return result;
  }

  async deleteErpSystem(id: string): Promise<void> {
    await db
      .delete(erpSystems)
      .where(eq(erpSystems.id, id));
  }

  // ERP Entities operations
  async createErpEntity(entity: InsertErpEntity): Promise<ErpEntity> {
    const [result] = await db
      .insert(erpEntities)
      .values(entity)
      .returning();
    return result;
  }

  async getErpEntity(id: string): Promise<ErpEntity | undefined> {
    const [result] = await db
      .select()
      .from(erpEntities)
      .where(eq(erpEntities.id, id));
    return result;
  }

  async getAllErpEntities(): Promise<ErpEntity[]> {
    const results = await db
      .select()
      .from(erpEntities)
      .orderBy(erpEntities.name);
    return results;
  }

  async getErpEntitiesBySystem(systemId: string, entityType?: string): Promise<ErpEntity[]> {
    const conditions = entityType
      ? and(eq(erpEntities.systemId, systemId), eq(erpEntities.entityType, entityType))
      : eq(erpEntities.systemId, systemId);
    
    const results = await db
      .select()
      .from(erpEntities)
      .where(conditions)
      .orderBy(erpEntities.name);
    return results;
  }

  async updateErpEntity(id: string, updates: Partial<InsertErpEntity>): Promise<ErpEntity> {
    const [result] = await db
      .update(erpEntities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(erpEntities.id, id))
      .returning();
    return result;
  }

  async deleteErpEntity(id: string): Promise<void> {
    await db
      .delete(erpEntities)
      .where(eq(erpEntities.id, id));
  }

  // ERP Fields operations
  async createErpField(field: InsertErpField): Promise<ErpField> {
    const [result] = await db
      .insert(erpFields)
      .values(field)
      .returning();
    return result;
  }

  async getErpField(id: string): Promise<ErpField | undefined> {
    const [result] = await db
      .select()
      .from(erpFields)
      .where(eq(erpFields.id, id));
    return result;
  }

  async getErpFieldsByEntity(entityId: string): Promise<ErpField[]> {
    const results = await db
      .select()
      .from(erpFields)
      .where(eq(erpFields.entityId, entityId))
      .orderBy(erpFields.fieldName);
    return results;
  }

  async updateErpField(id: string, updates: Partial<InsertErpField>): Promise<ErpField> {
    const [result] = await db
      .update(erpFields)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(erpFields.id, id))
      .returning();
    return result;
  }

  async deleteErpField(id: string): Promise<void> {
    await db
      .delete(erpFields)
      .where(eq(erpFields.id, id));
  }

  // ERP Entity Records operations
  async createErpEntityRecord(record: InsertErpEntityRecord): Promise<ErpEntityRecord> {
    const [result] = await db
      .insert(erpEntityRecords)
      .values(record)
      .returning();
    return result;
  }

  async getErpEntityRecord(id: string): Promise<ErpEntityRecord | undefined> {
    const [result] = await db
      .select()
      .from(erpEntityRecords)
      .where(eq(erpEntityRecords.id, id));
    return result;
  }

  async getErpEntityRecordsByEntity(entityId: string, context?: OrgAccessContext): Promise<ErpEntityRecord[]> {
    const conditions: any[] = [eq(erpEntityRecords.entityId, entityId)];
    
    if (context?.activeContext) {
      const { companyId, businessUnitId, locationId, role } = context.activeContext;
      const isSuperAdmin = role === 'system_admin';
      
      if (!isSuperAdmin && companyId) {
        conditions.push(
          or(
            eq(erpEntityRecords.companyId, companyId),
            isNull(erpEntityRecords.companyId)
          )
        );
      }
    }
    
    const results = await db
      .select()
      .from(erpEntityRecords)
      .where(and(...conditions))
      .orderBy(desc(erpEntityRecords.createdAt));
    return results;
  }

  async updateErpEntityRecord(id: string, updates: Partial<InsertErpEntityRecord>): Promise<ErpEntityRecord> {
    const [result] = await db
      .update(erpEntityRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(erpEntityRecords.id, id))
      .returning();
    return result;
  }

  async deleteErpEntityRecord(id: string): Promise<void> {
    await db
      .delete(erpEntityRecords)
      .where(eq(erpEntityRecords.id, id));
  }

  // LicenseIQ Entities operations
  async createLicenseiqEntity(entity: InsertLicenseiqEntity): Promise<LicenseiqEntity> {
    const [result] = await db
      .insert(licenseiqEntities)
      .values(entity)
      .returning();
    return result;
  }

  async getLicenseiqEntity(id: string): Promise<LicenseiqEntity | undefined> {
    const [result] = await db
      .select()
      .from(licenseiqEntities)
      .where(eq(licenseiqEntities.id, id));
    return result;
  }

  async getAllLicenseiqEntities(category?: string): Promise<LicenseiqEntity[]> {
    const conditions = category ? eq(licenseiqEntities.category, category) : undefined;
    const results = await db
      .select()
      .from(licenseiqEntities)
      .where(conditions)
      .orderBy(licenseiqEntities.name);
    return results;
  }

  async updateLicenseiqEntity(id: string, updates: Partial<InsertLicenseiqEntity>): Promise<LicenseiqEntity> {
    const [result] = await db
      .update(licenseiqEntities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(licenseiqEntities.id, id))
      .returning();
    return result;
  }

  async deleteLicenseiqEntity(id: string): Promise<void> {
    await db
      .delete(licenseiqEntities)
      .where(eq(licenseiqEntities.id, id));
  }

  // LicenseIQ Fields operations
  async createLicenseiqField(field: InsertLicenseiqField): Promise<LicenseiqField> {
    const [result] = await db
      .insert(licenseiqFields)
      .values(field)
      .returning();
    return result;
  }

  async getLicenseiqField(id: string): Promise<LicenseiqField | undefined> {
    const [result] = await db
      .select()
      .from(licenseiqFields)
      .where(eq(licenseiqFields.id, id));
    return result;
  }

  async getLicenseiqFieldsByEntity(entityId: string): Promise<LicenseiqField[]> {
    const results = await db
      .select()
      .from(licenseiqFields)
      .where(eq(licenseiqFields.entityId, entityId))
      .orderBy(licenseiqFields.fieldName);
    return results;
  }

  async updateLicenseiqField(id: string, updates: Partial<InsertLicenseiqField>): Promise<LicenseiqField> {
    const [result] = await db
      .update(licenseiqFields)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(licenseiqFields.id, id))
      .returning();
    return result;
  }

  async deleteLicenseiqField(id: string): Promise<void> {
    await db
      .delete(licenseiqFields)
      .where(eq(licenseiqFields.id, id));
  }

  // LicenseIQ Entity Records operations
  async createLicenseiqEntityRecord(record: InsertLicenseiqEntityRecord): Promise<LicenseiqEntityRecord> {
    const [result] = await db
      .insert(licenseiqEntityRecords)
      .values(record)
      .returning();
    return result;
  }

  async getLicenseiqEntityRecord(id: string): Promise<LicenseiqEntityRecord | undefined> {
    const [result] = await db
      .select()
      .from(licenseiqEntityRecords)
      .where(eq(licenseiqEntityRecords.id, id));
    return result;
  }

  async getLicenseiqEntityRecordsByEntity(entityId: string): Promise<LicenseiqEntityRecord[]> {
    const results = await db
      .select()
      .from(licenseiqEntityRecords)
      .where(eq(licenseiqEntityRecords.entityId, entityId))
      .orderBy(desc(licenseiqEntityRecords.createdAt));
    return results;
  }

  async updateLicenseiqEntityRecord(id: string, updates: Partial<InsertLicenseiqEntityRecord>): Promise<LicenseiqEntityRecord> {
    const [result] = await db
      .update(licenseiqEntityRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(licenseiqEntityRecords.id, id))
      .returning();
    return result;
  }

  async deleteLicenseiqEntityRecord(id: string): Promise<void> {
    await db
      .delete(licenseiqEntityRecords)
      .where(eq(licenseiqEntityRecords.id, id));
  }

  // Sample data for field mapping preview
  async getItemsSample(context: { activeContext: any; isAdmin: boolean }, limit: number): Promise<any[]> {
    try {
      let query = `SELECT * FROM items`;
      const params: any[] = [];
      
      if (!context.isAdmin) {
        if (context.activeContext?.companyId) {
          query += ` WHERE (company_id = $1 OR company_id IS NULL)`;
          params.push(context.activeContext.companyId);
        } else {
          query += ` WHERE company_id IS NULL`;
        }
      }
      
      query += ` LIMIT ${limit}`;
      
      const result = await db.execute(sql.raw(query.replace(/\$1/g, `'${params[0] || ''}'`)));
      return Array.isArray(result) ? result : (result as any).rows || [];
    } catch (error) {
      console.error('❌ [STORAGE] getItemsSample error:', error);
      return [];
    }
  }

  async getPartnersSample(context: { activeContext: any; isAdmin: boolean }, limit: number): Promise<any[]> {
    try {
      let query = `SELECT * FROM partner_master`;
      const params: any[] = [];
      
      if (!context.isAdmin) {
        if (context.activeContext?.companyId) {
          query += ` WHERE (company_id = $1 OR company_id IS NULL)`;
          params.push(context.activeContext.companyId);
        } else {
          query += ` WHERE company_id IS NULL`;
        }
      }
      
      query += ` LIMIT ${limit}`;
      
      const result = await db.execute(sql.raw(query.replace(/\$1/g, `'${params[0] || ''}'`)));
      return Array.isArray(result) ? result : (result as any).rows || [];
    } catch (error) {
      console.error('❌ [STORAGE] getPartnersSample error:', error);
      return [];
    }
  }

  // Data Import Sources operations (iPaaS-style configurable sources)
  async createDataImportSource(source: InsertDataImportSource): Promise<DataImportSource> {
    const [result] = await db
      .insert(dataImportSources)
      .values(source)
      .returning();
    return result;
  }

  async getDataImportSource(id: string): Promise<DataImportSource | undefined> {
    const [result] = await db
      .select()
      .from(dataImportSources)
      .where(eq(dataImportSources.id, id));
    return result;
  }

  async getDataImportSources(filters: {
    companyId?: string;
    businessUnitId?: string;
    locationId?: string;
    sourceType?: string;
    status?: string;
    erpSystemId?: string;
  }): Promise<DataImportSource[]> {
    const conditions = [];
    
    if (filters.companyId) {
      conditions.push(eq(dataImportSources.companyId, filters.companyId));
    }
    if (filters.businessUnitId) {
      conditions.push(eq(dataImportSources.businessUnitId, filters.businessUnitId));
    }
    if (filters.locationId) {
      conditions.push(eq(dataImportSources.locationId, filters.locationId));
    }
    if (filters.sourceType) {
      conditions.push(eq(dataImportSources.sourceType, filters.sourceType));
    }
    if (filters.status) {
      conditions.push(eq(dataImportSources.status, filters.status));
    }
    if (filters.erpSystemId) {
      conditions.push(eq(dataImportSources.erpSystemId, filters.erpSystemId));
    }
    
    let query = db.select().from(dataImportSources);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query.orderBy(desc(dataImportSources.createdAt));
    return results;
  }

  async updateDataImportSource(id: string, updates: Partial<InsertDataImportSource>): Promise<DataImportSource> {
    const [result] = await db
      .update(dataImportSources)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dataImportSources.id, id))
      .returning();
    return result;
  }

  async deleteDataImportSource(id: string): Promise<void> {
    await db
      .delete(dataImportSources)
      .where(eq(dataImportSources.id, id));
  }

  async updateSourceRunStats(id: string, success: boolean): Promise<void> {
    const source = await this.getDataImportSource(id);
    if (!source) return;
    
    await db
      .update(dataImportSources)
      .set({
        successCount: success ? (source.successCount || 0) + 1 : source.successCount,
        failureCount: success ? source.failureCount : (source.failureCount || 0) + 1,
        lastRunAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dataImportSources.id, id));
  }

  // Data import jobs operations
  async createDataImportJob(job: any): Promise<any> {
    const [result] = await db
      .insert(dataImportJobs)
      .values(job)
      .returning();
    return result;
  }

  async getDataImportJobs(contractId?: string, status?: string): Promise<any[]> {
    let query = db.select().from(dataImportJobs);
    
    const conditions = [];
    if (contractId) {
      conditions.push(eq(dataImportJobs.customerId, contractId));
    }
    if (status) {
      conditions.push(eq(dataImportJobs.status, status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query.orderBy(desc(dataImportJobs.createdAt));
    return results;
  }

  async getDataImportJob(id: string): Promise<any | undefined> {
    const [result] = await db
      .select()
      .from(dataImportJobs)
      .where(eq(dataImportJobs.id, id));
    return result;
  }

  async updateDataImportJob(id: string, updates: any): Promise<any> {
    const [result] = await db
      .update(dataImportJobs)
      .set(updates)
      .where(eq(dataImportJobs.id, id))
      .returning();
    return result;
  }

  // Imported ERP records operations
  async createImportedErpRecords(records: any[]): Promise<void> {
    if (records.length === 0) return;
    
    await db.insert(importedErpRecords).values(records);
  }

  async getImportedErpRecords(contractId?: string, jobId?: string): Promise<any[]> {
    let query = db.select().from(importedErpRecords);
    
    const conditions = [];
    if (contractId) {
      conditions.push(eq(importedErpRecords.customerId, contractId));
    }
    if (jobId) {
      conditions.push(eq(importedErpRecords.jobId, jobId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query.orderBy(desc(importedErpRecords.createdAt));
    return results;
  }

  async searchSemanticMatches(embedding: number[], contractId?: string, limit: number = 10): Promise<any[]> {
    const embeddingStr = JSON.stringify(embedding);
    
    let query = `
      SELECT 
        id,
        job_id,
        mapping_id,
        customer_id,
        source_record,
        target_record,
        metadata,
        created_at,
        1 - (embedding <=> $1::vector) as similarity
      FROM imported_erp_records
    `;
    
    const params: any[] = [embeddingStr];
    
    if (contractId) {
      query += ' WHERE customer_id = $2';
      params.push(contractId);
    }
    
    query += ' ORDER BY embedding <=> $1::vector';
    query += ` LIMIT ${limit}`;
    
    const result = await db.execute(sql.raw(query, ...params));
    return result.rows as any[];
  }

  // Enhanced ERP Integration - Mapping Management with Versioning and Company Hierarchy
  async getMappingsWithFilters(filters: {
    companyId?: string;
    businessUnitId?: string;
    locationId?: string;
    erpSystemId?: string;
    entityType?: string;
    status?: string;
    latestVersionOnly?: boolean;
    includeGlobal?: boolean; // Only system admins should set this to true
  }): Promise<any[]> {
    const conditions = [];
    
    // Hierarchy-based filtering with inheritance
    // - Company filter: show company-specific + (optionally) global mappings
    // - BU filter: show BU-specific + company-level (no BU) mappings
    // - Location filter: show location-specific + higher-level mappings
    if (filters.companyId) {
      if (filters.includeGlobal) {
        // System admins can see global mappings alongside company-specific ones
        conditions.push(
          or(
            eq(masterDataMappings.companyId, filters.companyId),
            isNull(masterDataMappings.companyId)
          )
        );
      } else {
        // Non-admins only see company-specific mappings (no global leakage)
        conditions.push(eq(masterDataMappings.companyId, filters.companyId));
      }
    } else if (!filters.includeGlobal) {
      // If no company filter and not system admin, exclude global mappings
      conditions.push(sql`${masterDataMappings.companyId} IS NOT NULL`);
    }
    
    if (filters.businessUnitId) {
      // Show BU-specific + company-level (no BU assigned) mappings
      conditions.push(
        or(
          eq(masterDataMappings.businessUnitId, filters.businessUnitId),
          isNull(masterDataMappings.businessUnitId)
        )
      );
    }
    if (filters.locationId) {
      // Show location-specific + higher-level mappings (no location assigned)
      conditions.push(
        or(
          eq(masterDataMappings.locationId, filters.locationId),
          isNull(masterDataMappings.locationId)
        )
      );
    }
    if (filters.erpSystemId) {
      conditions.push(eq(masterDataMappings.erpSystemId, filters.erpSystemId));
    }
    if (filters.entityType) {
      conditions.push(eq(masterDataMappings.entityType, filters.entityType));
    }
    if (filters.status) {
      conditions.push(eq(masterDataMappings.status, filters.status));
    }
    
    let query = db.select().from(masterDataMappings);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    let results = await query.orderBy(desc(masterDataMappings.createdAt));
    
    // If latestVersionOnly, filter to only latest versions
    if (filters.latestVersionOnly) {
      const latestVersions = new Map<string, any>();
      for (const mapping of results) {
        const key = `${mapping.erpSystem}-${mapping.entityType}-${mapping.companyId || 'global'}`;
        const existing = latestVersions.get(key);
        if (!existing || mapping.version > existing.version) {
          latestVersions.set(key, mapping);
        }
      }
      results = Array.from(latestVersions.values());
    }
    
    return results;
  }

  async getMappingVersionHistory(mappingId: string): Promise<any[]> {
    // Get the root mapping (could be this one or an ancestor)
    const mapping = await this.getMasterDataMapping(mappingId);
    if (!mapping) return [];
    
    // Find the root by traversing up
    let rootId = mappingId;
    let currentMapping = mapping;
    while (currentMapping.parentMappingId) {
      rootId = currentMapping.parentMappingId;
      currentMapping = await this.getMasterDataMapping(rootId) as any;
      if (!currentMapping) break;
    }
    
    // Now get all versions (root + children)
    const allMappings = await db.select().from(masterDataMappings);
    const versions: any[] = [];
    
    // Add root if matches
    const root = allMappings.find(m => m.id === rootId);
    if (root) versions.push(root);
    
    // Recursively find all children
    const findChildren = (parentId: string) => {
      const children = allMappings.filter(m => m.parentMappingId === parentId);
      for (const child of children) {
        versions.push(child);
        findChildren(child.id);
      }
    };
    findChildren(rootId);
    
    // Sort by version descending
    return versions.sort((a, b) => (b.version || 0) - (a.version || 0));
  }

  async getMappingsByParent(parentMappingId: string): Promise<any[]> {
    const results = await db.select()
      .from(masterDataMappings)
      .where(eq(masterDataMappings.parentMappingId, parentMappingId))
      .orderBy(desc(masterDataMappings.version));
    return results;
  }

  async createMappingVersion(parentId: string, updates: any, createdBy: string): Promise<any> {
    const parent = await this.getMasterDataMapping(parentId);
    if (!parent) throw new Error('Parent mapping not found');
    
    // Create new version with incremented version number
    const newVersion = (parent.version || 1) + 1;
    
    const [newMapping] = await db.insert(masterDataMappings).values({
      ...parent,
      ...updates,
      id: undefined, // Let the database generate a new ID
      parentMappingId: parentId,
      version: newVersion,
      status: 'draft',
      createdBy,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    return newMapping;
  }

  async approveMappingVersion(mappingId: string, approvedBy: string): Promise<any> {
    const [updated] = await db.update(masterDataMappings)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(masterDataMappings.id, mappingId))
      .returning();
    
    // Deprecate all other versions of the same mapping
    if (updated.parentMappingId || updated.version === 1) {
      const allVersions = await this.getMappingVersionHistory(mappingId);
      for (const version of allVersions) {
        if (version.id !== mappingId && version.status === 'approved') {
          await db.update(masterDataMappings)
            .set({ status: 'deprecated', updatedAt: new Date() })
            .where(eq(masterDataMappings.id, version.id));
        }
      }
    }
    
    return updated;
  }

  async revertToMappingVersion(mappingId: string, targetVersion: number, createdBy: string): Promise<any> {
    const history = await this.getMappingVersionHistory(mappingId);
    const targetMapping = history.find(m => m.version === targetVersion);
    
    if (!targetMapping) throw new Error(`Version ${targetVersion} not found`);
    
    // Create a new version based on the target
    const latestVersion = Math.max(...history.map(m => m.version || 0));
    
    const [newMapping] = await db.insert(masterDataMappings).values({
      ...targetMapping,
      id: undefined,
      parentMappingId: mappingId,
      version: latestVersion + 1,
      status: 'draft',
      createdBy,
      approvedBy: null,
      approvedAt: null,
      notes: `Reverted from version ${targetVersion}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    return newMapping;
  }

  async deprecateMapping(mappingId: string): Promise<any> {
    const [updated] = await db.update(masterDataMappings)
      .set({ status: 'deprecated', updatedAt: new Date() })
      .where(eq(masterDataMappings.id, mappingId))
      .returning();
    return updated;
  }

  // Enhanced ERP Integration - Data Import with Dry-Run and Company Hierarchy
  async getImportJobsWithFilters(filters: {
    companyId?: string;
    businessUnitId?: string;
    locationId?: string;
    erpSystemId?: string;
    entityType?: string;
    status?: string;
    jobType?: string;
  }): Promise<any[]> {
    const conditions = [];
    
    if (filters.companyId) {
      conditions.push(eq(dataImportJobs.companyId, filters.companyId));
    }
    if (filters.businessUnitId) {
      conditions.push(eq(dataImportJobs.businessUnitId, filters.businessUnitId));
    }
    if (filters.locationId) {
      conditions.push(eq(dataImportJobs.locationId, filters.locationId));
    }
    if (filters.erpSystemId) {
      conditions.push(eq(dataImportJobs.erpSystemId, filters.erpSystemId));
    }
    if (filters.entityType) {
      conditions.push(eq(dataImportJobs.entityType, filters.entityType));
    }
    if (filters.status) {
      conditions.push(eq(dataImportJobs.status, filters.status));
    }
    if (filters.jobType) {
      conditions.push(eq(dataImportJobs.jobType, filters.jobType));
    }
    
    let query = db.select().from(dataImportJobs);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(dataImportJobs.createdAt));
  }

  async getImportedRecordsByJob(jobId: string, status?: string): Promise<any[]> {
    const conditions = [eq(importedErpRecords.jobId, jobId)];
    
    if (status) {
      conditions.push(eq(importedErpRecords.recordStatus, status));
    }
    
    return await db.select()
      .from(importedErpRecords)
      .where(and(...conditions))
      .orderBy(importedErpRecords.createdAt);
  }

  async updateImportedRecordStatus(recordId: string, status: string, errors?: any): Promise<any> {
    const updateData: any = {
      recordStatus: status,
      updatedAt: new Date(),
    };
    
    if (errors) {
      updateData.validationErrors = errors;
    }
    
    const [updated] = await db.update(importedErpRecords)
      .set(updateData)
      .where(eq(importedErpRecords.id, recordId))
      .returning();
    return updated;
  }

  async commitStagedRecords(jobId: string): Promise<{ committed: number; failed: number }> {
    // Get the job to find the mapping and organization context
    const job = await this.getDataImportJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    
    // Get the mapping to find the LicenseIQ entity ID
    let licenseiqEntityId: string | null = null;
    if (job.mappingId) {
      const mapping = await this.getFieldMapping(job.mappingId);
      if (mapping?.licenseiqEntityId) {
        licenseiqEntityId = mapping.licenseiqEntityId;
      }
    }
    
    // Get all staged records for this job
    const stagedRecords = await this.getImportedRecordsByJob(jobId, 'staged');
    
    let committed = 0;
    let failed = 0;
    
    for (const record of stagedRecords) {
      try {
        // Create a canonical record in licenseiq_entity_records if we have the entity ID and org context
        if (licenseiqEntityId && job.companyId && job.businessUnitId && job.locationId) {
          const canonicalRecord = await db.insert(licenseiqEntityRecords).values({
            entityId: licenseiqEntityId,
            recordData: record.targetRecord || record.sourceRecord,
            grpId: job.companyId,
            orgId: job.businessUnitId,
            locId: job.locationId,
            createdBy: job.createdBy,
          }).returning();
          
          // Link the canonical record back to the import record
          await db.update(importedErpRecords)
            .set({ 
              recordStatus: 'committed', 
              licenseiqRecordId: canonicalRecord[0]?.id,
              updatedAt: new Date() 
            })
            .where(eq(importedErpRecords.id, record.id));
        } else {
          // Just mark as committed without creating canonical record
          await db.update(importedErpRecords)
            .set({ recordStatus: 'committed', updatedAt: new Date() })
            .where(eq(importedErpRecords.id, record.id));
        }
        committed++;
      } catch (error) {
        console.error(`Failed to commit record ${record.id}:`, error);
        await db.update(importedErpRecords)
          .set({
            recordStatus: 'failed',
            validationErrors: { error: String(error) },
            updatedAt: new Date(),
          })
          .where(eq(importedErpRecords.id, record.id));
        failed++;
      }
    }
    
    // Update job status
    await this.updateDataImportJob(jobId, {
      status: failed === 0 ? 'completed' : 'completed_with_errors',
      recordsProcessed: committed,
      recordsFailed: failed,
      completedAt: new Date(),
    });
    
    return { committed, failed };
  }

  async discardStagedRecords(jobId: string): Promise<number> {
    const stagedRecords = await this.getImportedRecordsByJob(jobId, 'staged');
    
    for (const record of stagedRecords) {
      await db.update(importedErpRecords)
        .set({ recordStatus: 'discarded', updatedAt: new Date() })
        .where(eq(importedErpRecords.id, record.id));
    }
    
    // Update job status
    await this.updateDataImportJob(jobId, {
      status: 'cancelled',
      completedAt: new Date(),
    });
    
    return stagedRecords.length;
  }

  // Master Data operations - Company
  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db
      .insert(companies)
      .values(company)
      .returning();
    return newCompany;
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id));
    return company;
  }

  async getAllCompanies(status?: string): Promise<Company[]> {
    let query = db.select().from(companies);
    
    if (status) {
      query = query.where(eq(companies.status, status)) as any;
    }
    
    return await query.orderBy(companies.companyName);
  }

  async updateCompany(id: string, updates: Partial<InsertCompany>, userId: string): Promise<Company> {
    const [updated] = await db
      .update(companies)
      .set({ ...updates, lastUpdateDate: new Date(), lastUpdatedBy: userId })
      .where(eq(companies.id, id))
      .returning();
    return updated;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  // Master Data operations - Business Unit
  async createBusinessUnit(unit: InsertBusinessUnit): Promise<BusinessUnit> {
    const [newUnit] = await db
      .insert(businessUnits)
      .values(unit)
      .returning();
    return newUnit;
  }

  async getBusinessUnit(id: string): Promise<BusinessUnit | undefined> {
    const [unit] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, id));
    return unit;
  }

  async getBusinessUnitsByCompany(companyId: string, status?: string): Promise<BusinessUnit[]> {
    let query = db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.companyId, companyId));
    
    if (status) {
      query = query.where(and(
        eq(businessUnits.companyId, companyId),
        eq(businessUnits.status, status)
      )) as any;
    }
    
    return await query.orderBy(businessUnits.orgName);
  }

  async updateBusinessUnit(id: string, updates: Partial<InsertBusinessUnit>, userId: string): Promise<BusinessUnit> {
    const [updated] = await db
      .update(businessUnits)
      .set({ ...updates, lastUpdateDate: new Date(), lastUpdatedBy: userId })
      .where(eq(businessUnits.id, id))
      .returning();
    return updated;
  }

  async deleteBusinessUnit(id: string): Promise<void> {
    await db.delete(businessUnits).where(eq(businessUnits.id, id));
  }

  // Master Data operations - Location
  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db
      .insert(locations)
      .values(location)
      .returning();
    return newLocation;
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, id));
    return location;
  }

  async getLocationsByCompany(companyId: string, status?: string): Promise<Location[]> {
    let query = db
      .select()
      .from(locations)
      .where(eq(locations.companyId, companyId));
    
    if (status) {
      query = query.where(and(
        eq(locations.companyId, companyId),
        eq(locations.status, status)
      )) as any;
    }
    
    return await query.orderBy(locations.locName);
  }

  async getLocationsByBusinessUnit(orgId: string, status?: string): Promise<Location[]> {
    let query = db
      .select()
      .from(locations)
      .where(eq(locations.orgId, orgId));
    
    if (status) {
      query = query.where(and(
        eq(locations.orgId, orgId),
        eq(locations.status, status)
      )) as any;
    }
    
    return await query.orderBy(locations.locName);
  }

  async updateLocation(id: string, updates: Partial<InsertLocation>, userId: string): Promise<Location> {
    const [updated] = await db
      .update(locations)
      .set({ ...updates, lastUpdateDate: new Date(), lastUpdatedBy: userId })
      .where(eq(locations.id, id))
      .returning();
    return updated;
  }

  async deleteLocation(id: string): Promise<void> {
    await db.delete(locations).where(eq(locations.id, id));
  }

  // Master Data operations - Get full hierarchy
  async getMasterDataHierarchy(status?: string): Promise<any> {
    let companiesQuery = db.select().from(companies);
    if (status) {
      companiesQuery = companiesQuery.where(eq(companies.status, status)) as any;
    }
    const allCompanies = await companiesQuery.orderBy(companies.companyName);
    
    const hierarchy = await Promise.all(
      allCompanies.map(async (company) => {
        let unitsQuery = db
          .select()
          .from(businessUnits)
          .where(eq(businessUnits.companyId, company.id));
        
        if (status) {
          unitsQuery = unitsQuery.where(and(
            eq(businessUnits.companyId, company.id),
            eq(businessUnits.status, status)
          )) as any;
        }
        
        const units = await unitsQuery.orderBy(businessUnits.orgName);
        
        const unitsWithLocations = await Promise.all(
          units.map(async (unit) => {
            let locsQuery = db
              .select()
              .from(locations)
              .where(eq(locations.orgId, unit.id));
            
            if (status) {
              locsQuery = locsQuery.where(and(
                eq(locations.orgId, unit.id),
                eq(locations.status, status)
              )) as any;
            }
            
            const locs = await locsQuery.orderBy(locations.locName);
            
            return {
              ...unit,
              locations: locs,
            };
          })
        );
        
        return {
          ...company,
          businessUnits: unitsWithLocations,
        };
      })
    );
    
    return hierarchy;
  }

  // User Organization Roles operations
  async createUserOrganizationRole(roleData: InsertUserOrganizationRole): Promise<UserOrganizationRole> {
    const [role] = await db
      .insert(userOrganizationRoles)
      .values(roleData)
      .returning();
    return role;
  }

  async getUserOrganizationRoles(userId: string): Promise<any[]> {
    const roles = await db
      .select({
        id: userOrganizationRoles.id,
        userId: userOrganizationRoles.userId,
        companyId: userOrganizationRoles.companyId,
        companyName: companies.companyName,
        businessUnitId: userOrganizationRoles.businessUnitId,
        businessUnitName: businessUnits.orgName,
        locationId: userOrganizationRoles.locationId,
        locationName: locations.locName,
        role: userOrganizationRoles.role,
        status: userOrganizationRoles.status,
        creationDate: userOrganizationRoles.creationDate,
        lastUpdateDate: userOrganizationRoles.lastUpdateDate,
      })
      .from(userOrganizationRoles)
      .leftJoin(companies, eq(userOrganizationRoles.companyId, companies.id))
      .leftJoin(businessUnits, eq(userOrganizationRoles.businessUnitId, businessUnits.id))
      .leftJoin(locations, eq(userOrganizationRoles.locationId, locations.id))
      .where(eq(userOrganizationRoles.userId, userId))
      .orderBy(companies.companyName, businessUnits.orgName, locations.locName);
    
    return roles;
  }

  async getAllUserOrganizationRoles(): Promise<any[]> {
    const roles = await db
      .select({
        id: userOrganizationRoles.id,
        userId: userOrganizationRoles.userId,
        username: users.username,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        companyId: userOrganizationRoles.companyId,
        companyName: companies.companyName,
        businessUnitId: userOrganizationRoles.businessUnitId,
        businessUnitName: businessUnits.orgName,
        locationId: userOrganizationRoles.locationId,
        locationName: locations.locName,
        role: userOrganizationRoles.role,
        status: userOrganizationRoles.status,
        creationDate: userOrganizationRoles.creationDate,
        lastUpdateDate: userOrganizationRoles.lastUpdateDate,
      })
      .from(userOrganizationRoles)
      .leftJoin(users, eq(userOrganizationRoles.userId, users.id))
      .leftJoin(companies, eq(userOrganizationRoles.companyId, companies.id))
      .leftJoin(businessUnits, eq(userOrganizationRoles.businessUnitId, businessUnits.id))
      .leftJoin(locations, eq(userOrganizationRoles.locationId, locations.id))
      .orderBy(users.username, companies.companyName);
    
    return roles;
  }

  async getUserOrganizationRoleById(id: string): Promise<UserOrganizationRole | undefined> {
    const [role] = await db
      .select()
      .from(userOrganizationRoles)
      .where(eq(userOrganizationRoles.id, id));
    return role;
  }

  async updateUserOrganizationRole(id: string, updates: Partial<InsertUserOrganizationRole>, userId: string): Promise<UserOrganizationRole> {
    const [updated] = await db
      .update(userOrganizationRoles)
      .set({ ...updates, lastUpdateDate: new Date(), lastUpdatedBy: userId })
      .where(eq(userOrganizationRoles.id, id))
      .returning();
    return updated;
  }

  async deleteUserOrganizationRole(id: string): Promise<void> {
    await db.delete(userOrganizationRoles).where(eq(userOrganizationRoles.id, id));
  }

  async getUsersByOrganization(companyId: string, businessUnitId?: string, locationId?: string): Promise<any[]> {
    // Build the WHERE condition based on hierarchy level:
    // - Company only: all users in company
    // - Company + BU: users in that BU (all locations within BU)
    // - Company + BU + Location: only users at that specific location
    
    let whereCondition;
    
    if (locationId) {
      // Location level: only users assigned to this specific location
      whereCondition = and(
        eq(userOrganizationRoles.companyId, companyId),
        eq(userOrganizationRoles.locationId, locationId)
      );
    } else if (businessUnitId) {
      // BU level: users in this BU (at BU level or any location within BU)
      whereCondition = and(
        eq(userOrganizationRoles.companyId, companyId),
        eq(userOrganizationRoles.businessUnitId, businessUnitId)
      );
    } else {
      // Company level: all users in the company
      whereCondition = eq(userOrganizationRoles.companyId, companyId);
    }
    
    const results = await db
      .select({
        id: users.id,  // Use actual user ID, not role assignment ID
        orgRoleId: userOrganizationRoles.id,  // Keep role assignment ID separate
        userId: userOrganizationRoles.userId,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        userRole: users.role,  // User's global role
        role: userOrganizationRoles.role,  // Org-level role
        status: userOrganizationRoles.status,
        isActive: users.isActive,
        businessUnitId: userOrganizationRoles.businessUnitId,
        locationId: userOrganizationRoles.locationId,
      })
      .from(userOrganizationRoles)
      .leftJoin(users, eq(userOrganizationRoles.userId, users.id))
      .where(whereCondition)
      .orderBy(users.username);
    
    return results;
  }

  // User Active Context operations
  async getUserActiveContext(userId: string): Promise<UserActiveContext | undefined> {
    const [context] = await db
      .select()
      .from(userActiveContext)
      .where(eq(userActiveContext.userId, userId));
    return context;
  }

  async setUserActiveContext(userId: string, orgRoleId: string): Promise<UserActiveContext> {
    // Check if user already has an active context
    const existing = await this.getUserActiveContext(userId);
    
    if (existing) {
      // Update existing context
      const [updated] = await db
        .update(userActiveContext)
        .set({ 
          activeOrgRoleId: orgRoleId, 
          lastSwitched: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(userActiveContext.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new context
      const [created] = await db
        .insert(userActiveContext)
        .values({ 
          userId, 
          activeOrgRoleId: orgRoleId,
          lastSwitched: new Date()
        })
        .returning();
      return created;
    }
  }

  async deleteUserActiveContext(userId: string): Promise<void> {
    await db.delete(userActiveContext).where(eq(userActiveContext.userId, userId));
  }

  // Integration Connection operations
  async createIntegrationConnection(connection: InsertIntegrationConnection): Promise<IntegrationConnection> {
    const [created] = await db
      .insert(integrationConnections)
      .values(connection)
      .returning();
    return created;
  }

  async getIntegrationConnection(id: string): Promise<IntegrationConnection | undefined> {
    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.id, id));
    return connection;
  }

  async getIntegrationConnections(filters?: { erpSystemId?: string; companyId?: string; businessUnitId?: string; locationId?: string; status?: string }): Promise<IntegrationConnection[]> {
    const conditions: any[] = [];
    
    if (filters?.erpSystemId) {
      conditions.push(eq(integrationConnections.erpSystemId, filters.erpSystemId));
    }
    if (filters?.companyId) {
      conditions.push(eq(integrationConnections.companyId, filters.companyId));
    }
    if (filters?.businessUnitId) {
      conditions.push(eq(integrationConnections.businessUnitId, filters.businessUnitId));
    }
    if (filters?.locationId) {
      conditions.push(eq(integrationConnections.locationId, filters.locationId));
    }
    if (filters?.status) {
      conditions.push(eq(integrationConnections.status, filters.status));
    }

    if (conditions.length === 0) {
      return await db.select().from(integrationConnections).orderBy(desc(integrationConnections.createdAt));
    }

    return await db
      .select()
      .from(integrationConnections)
      .where(and(...conditions))
      .orderBy(desc(integrationConnections.createdAt));
  }

  async updateIntegrationConnection(id: string, updates: Partial<InsertIntegrationConnection>): Promise<IntegrationConnection> {
    const [updated] = await db
      .update(integrationConnections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(integrationConnections.id, id))
      .returning();
    return updated;
  }

  async deleteIntegrationConnection(id: string): Promise<void> {
    await db.delete(integrationConnections).where(eq(integrationConnections.id, id));
  }

  async updateConnectionHealth(id: string, status: string, message?: string): Promise<void> {
    await db
      .update(integrationConnections)
      .set({
        lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: status,
        lastHealthCheckMessage: message,
        updatedAt: new Date()
      })
      .where(eq(integrationConnections.id, id));
  }

  // Integration Endpoint Template operations
  async createEndpointTemplate(template: InsertIntegrationEndpointTemplate): Promise<IntegrationEndpointTemplate> {
    const [created] = await db
      .insert(integrationEndpointTemplates)
      .values(template)
      .returning();
    return created;
  }

  async getEndpointTemplate(id: string): Promise<IntegrationEndpointTemplate | undefined> {
    const [template] = await db
      .select()
      .from(integrationEndpointTemplates)
      .where(eq(integrationEndpointTemplates.id, id));
    return template;
  }

  async getEndpointTemplates(filters?: { erpSystemId?: string; entityId?: string; operationType?: string }): Promise<IntegrationEndpointTemplate[]> {
    const conditions: any[] = [];
    
    if (filters?.erpSystemId) {
      conditions.push(eq(integrationEndpointTemplates.erpSystemId, filters.erpSystemId));
    }
    if (filters?.entityId) {
      conditions.push(eq(integrationEndpointTemplates.erpEntityId, filters.entityId));
    }
    if (filters?.operationType) {
      conditions.push(eq(integrationEndpointTemplates.operationType, filters.operationType));
    }

    if (conditions.length === 0) {
      return await db.select().from(integrationEndpointTemplates).orderBy(integrationEndpointTemplates.name);
    }

    return await db
      .select()
      .from(integrationEndpointTemplates)
      .where(and(...conditions))
      .orderBy(integrationEndpointTemplates.name);
  }

  async updateEndpointTemplate(id: string, updates: Partial<InsertIntegrationEndpointTemplate>): Promise<IntegrationEndpointTemplate> {
    const [updated] = await db
      .update(integrationEndpointTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(integrationEndpointTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteEndpointTemplate(id: string): Promise<void> {
    await db.delete(integrationEndpointTemplates).where(eq(integrationEndpointTemplates.id, id));
  }

  // Integration Operation operations
  async createIntegrationOperation(operation: InsertIntegrationOperation): Promise<IntegrationOperation> {
    const [created] = await db
      .insert(integrationOperations)
      .values(operation)
      .returning();
    return created;
  }

  async getIntegrationOperation(id: string): Promise<IntegrationOperation | undefined> {
    const [operation] = await db
      .select()
      .from(integrationOperations)
      .where(eq(integrationOperations.id, id));
    return operation;
  }

  async getIntegrationOperations(filters?: { connectionId?: string; companyId?: string; operationMode?: string; isEnabled?: boolean }): Promise<IntegrationOperation[]> {
    const conditions: any[] = [];
    
    if (filters?.connectionId) {
      conditions.push(eq(integrationOperations.connectionId, filters.connectionId));
    }
    if (filters?.companyId) {
      conditions.push(eq(integrationOperations.companyId, filters.companyId));
    }
    if (filters?.operationMode) {
      conditions.push(eq(integrationOperations.operationMode, filters.operationMode));
    }
    if (filters?.isEnabled !== undefined) {
      conditions.push(eq(integrationOperations.isEnabled, filters.isEnabled));
    }

    if (conditions.length === 0) {
      return await db.select().from(integrationOperations).orderBy(desc(integrationOperations.createdAt));
    }

    return await db
      .select()
      .from(integrationOperations)
      .where(and(...conditions))
      .orderBy(desc(integrationOperations.createdAt));
  }

  async updateIntegrationOperation(id: string, updates: Partial<InsertIntegrationOperation>): Promise<IntegrationOperation> {
    const [updated] = await db
      .update(integrationOperations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(integrationOperations.id, id))
      .returning();
    return updated;
  }

  async deleteIntegrationOperation(id: string): Promise<void> {
    await db.delete(integrationOperations).where(eq(integrationOperations.id, id));
  }

  async updateOperationRunStatus(id: string, status: string, stats?: { recordsProcessed?: number; recordsFailed?: number; durationMs?: number; error?: string }): Promise<void> {
    await db
      .update(integrationOperations)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: status,
        lastRunRecordsProcessed: stats?.recordsProcessed,
        lastRunRecordsFailed: stats?.recordsFailed,
        lastRunDurationMs: stats?.durationMs,
        lastRunError: stats?.error,
        updatedAt: new Date()
      })
      .where(eq(integrationOperations.id, id));
  }

  // Integration Health Event operations
  async createHealthEvent(event: InsertIntegrationHealthEvent): Promise<IntegrationHealthEvent> {
    const [created] = await db
      .insert(integrationHealthEvents)
      .values(event)
      .returning();
    return created;
  }

  async getHealthEvents(connectionId: string, limit: number = 50): Promise<IntegrationHealthEvent[]> {
    return await db
      .select()
      .from(integrationHealthEvents)
      .where(eq(integrationHealthEvents.connectionId, connectionId))
      .orderBy(desc(integrationHealthEvents.checkedAt))
      .limit(limit);
  }

  // LicenseIQ API Endpoint operations
  async createLicenseiqApiEndpoint(endpoint: InsertLicenseiqApiEndpoint): Promise<LicenseiqApiEndpoint> {
    const [created] = await db
      .insert(licenseiqApiEndpoints)
      .values(endpoint)
      .returning();
    return created;
  }

  async getLicenseiqApiEndpoint(id: string): Promise<LicenseiqApiEndpoint | undefined> {
    const [endpoint] = await db
      .select()
      .from(licenseiqApiEndpoints)
      .where(eq(licenseiqApiEndpoints.id, id));
    return endpoint;
  }

  async getLicenseiqApiEndpoints(entityId?: string): Promise<LicenseiqApiEndpoint[]> {
    if (entityId) {
      return await db
        .select()
        .from(licenseiqApiEndpoints)
        .where(eq(licenseiqApiEndpoints.entityId, entityId))
        .orderBy(licenseiqApiEndpoints.name);
    }
    return await db.select().from(licenseiqApiEndpoints).orderBy(licenseiqApiEndpoints.name);
  }

  async updateLicenseiqApiEndpoint(id: string, updates: Partial<InsertLicenseiqApiEndpoint>): Promise<LicenseiqApiEndpoint> {
    const [updated] = await db
      .update(licenseiqApiEndpoints)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(licenseiqApiEndpoints.id, id))
      .returning();
    return updated;
  }

  async deleteLicenseiqApiEndpoint(id: string): Promise<void> {
    await db.delete(licenseiqApiEndpoints).where(eq(licenseiqApiEndpoints.id, id));
  }

  // Pending Term Mapping operations (ERP-aware extraction)
  async createPendingTermMapping(mapping: InsertPendingTermMapping): Promise<PendingTermMapping> {
    const existingConditions = [
      eq(pendingTermMappings.originalTerm, mapping.originalTerm),
      eq(pendingTermMappings.erpFieldName, mapping.erpFieldName),
    ];
    if (mapping.contractId) {
      existingConditions.push(eq(pendingTermMappings.contractId, mapping.contractId));
    }
    if (mapping.companyId) {
      existingConditions.push(eq(pendingTermMappings.companyId, mapping.companyId));
    }
    const [existing] = await db
      .select()
      .from(pendingTermMappings)
      .where(and(...existingConditions))
      .limit(1);
    if (existing) {
      return existing;
    }
    const [created] = await db
      .insert(pendingTermMappings)
      .values(mapping)
      .returning();
    return created;
  }

  async getPendingTermMapping(id: string): Promise<PendingTermMapping | undefined> {
    const [mapping] = await db
      .select()
      .from(pendingTermMappings)
      .where(eq(pendingTermMappings.id, id));
    return mapping;
  }

  async getPendingTermMappingsByContract(contractId: string, status?: string): Promise<PendingTermMapping[]> {
    // Use raw SQL to join with items/vendors tables and get live ERP values
    const statusCondition = status ? `AND ptm.status = '${status}'` : '';
    const result = await db.execute(sql`
      SELECT 
        ptm.*,
        ptm.erp_record_value as live_erp_value
      FROM pending_term_mappings ptm
      WHERE ptm.contract_id = ${contractId} ${sql.raw(statusCondition)}
      ORDER BY ptm.confidence DESC
    `);
    
    // Map snake_case SQL results to camelCase for frontend compatibility
    return (result.rows as any[]).map(row => ({
      id: row.id,
      contractId: row.contract_id,
      extractionRunId: row.extraction_run_id,
      originalTerm: row.original_term,
      originalValue: row.original_value,
      sourceText: row.source_text,
      erpSystemId: row.erp_system_id,
      erpEntityId: row.erp_entity_id,
      erpFieldId: row.erp_field_id,
      erpFieldName: row.erp_field_name,
      erpEntityName: row.erp_entity_name,
      confidence: row.confidence,
      mappingMethod: row.mapping_method,
      alternativeMappings: row.alternative_mappings,
      status: row.status,
      confirmedBy: row.confirmed_by,
      confirmedAt: row.confirmed_at,
      userModifiedValue: row.user_modified_value,
      userModifiedFieldId: row.user_modified_field_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      erpRecordId: row.erp_record_id,
      erpRecordTable: row.erp_record_table,
      // Use live value from joined tables, fall back to cached value
      erpRecordValue: row.live_erp_value || row.erp_record_value,
    })) as PendingTermMapping[];
  }

  async getPendingTermMappingsByCompany(companyId: string, status?: string, contractId?: string): Promise<any[]> {
    // Get all mappings for a company (across all contracts belonging to that company)
    // Also fetch ERP source field info from master_data_mappings
    const statusCondition = status ? `AND ptm.status = '${status}'` : '';
    const contractCondition = contractId ? `AND ptm.contract_id = '${contractId}'` : '';
    const result = await db.execute(sql`
      SELECT DISTINCT ON (LOWER(ptm.original_term), ptm.erp_field_name, ptm.contract_id)
        ptm.*,
        c.display_name as contract_name,
        ptm.erp_record_value as live_erp_value,
        mdm.erp_system as erp_source_system,
        mdm.mapping_results as erp_mapping_results,
        lf.field_name as resolved_field_name,
        le.name as resolved_entity_name
      FROM pending_term_mappings ptm
      LEFT JOIN contracts c ON ptm.contract_id = c.id
      LEFT JOIN licenseiq_fields lf ON ptm.user_modified_field_id = lf.id
      LEFT JOIN licenseiq_entities le ON lf.entity_id = le.id
      LEFT JOIN master_data_mappings mdm ON (
          mdm.entity_type = ptm.erp_entity_name 
          OR (mdm.entity_type = 'Suppliers' AND ptm.erp_entity_name = 'Partner Master')
          OR (mdm.entity_type = 'Partner Master' AND ptm.erp_entity_name = 'Suppliers')
        )
        AND (mdm.company_id = ${companyId} OR mdm.company_id IS NULL)
        AND mdm.status IN ('approved', 'draft')
      WHERE (ptm.company_id = ${companyId} OR c.company_id = ${companyId}) ${sql.raw(statusCondition)} ${sql.raw(contractCondition)}
      ORDER BY LOWER(ptm.original_term), ptm.erp_field_name, ptm.contract_id, ptm.confidence DESC, ptm.created_at DESC
    `);
    
    return (result.rows as any[]).map(row => {
      // Extract the ERP source field and derive the LicenseIQ target field from mapping_results
      let erpSourceField = null;
      let derivedLicenseiqField = null;
      if (row.erp_mapping_results && Array.isArray(row.erp_mapping_results)) {
        // Normalize field name for matching (remove special chars, lowercase)
        const normalizeField = (field: string) => field?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        const storedFieldNorm = normalizeField(row.erp_field_name);
        
        // First, try to find by matching stored field to target_field (LicenseIQ field)
        let fieldMapping = row.erp_mapping_results.find((m: any) => {
          const targetNorm = normalizeField(m.target_field);
          return targetNorm === storedFieldNorm || 
                 targetNorm.includes(storedFieldNorm) || 
                 storedFieldNorm.includes(targetNorm);
        });
        
        // If not found, try matching stored field to source_field (ERP field)
        if (!fieldMapping) {
          fieldMapping = row.erp_mapping_results.find((m: any) => {
            const sourceNorm = normalizeField(m.source_field);
            return sourceNorm === storedFieldNorm || 
                   sourceNorm.includes(storedFieldNorm) || 
                   storedFieldNorm.includes(sourceNorm);
          });
        }
        
        if (fieldMapping) {
          erpSourceField = fieldMapping.source_field;
          derivedLicenseiqField = fieldMapping.target_field;
        }
      }
      
      return {
        id: row.id,
        contractId: row.contract_id,
        companyId: row.company_id,
        extractionRunId: row.extraction_run_id,
        originalTerm: row.original_term,
        originalValue: row.original_value,
        sourceText: row.source_text,
        sourceSection: row.source_section,
        sourcePage: row.source_page,
        erpSystemId: row.erp_system_id,
        erpEntityId: row.erp_entity_id,
        erpFieldId: row.erp_field_id,
        erpFieldName: row.resolved_field_name || row.erp_field_name,
        erpEntityName: row.resolved_entity_name || row.erp_entity_name,
        confidence: row.confidence,
        mappingMethod: row.mapping_method,
        alternativeMappings: row.alternative_mappings,
        status: row.status,
        confirmedBy: row.confirmed_by,
        confirmedAt: row.confirmed_at,
        userModifiedValue: row.user_modified_value,
        userModifiedFieldId: row.user_modified_field_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        erpRecordId: row.erp_record_id,
        erpRecordTable: row.erp_record_table,
        erpRecordValue: row.live_erp_value || row.erp_record_value,
        contractName: row.contract_name,
        // ERP source mapping info
        erpSourceSystem: row.erp_source_system,
        erpSourceField: erpSourceField,
        // Derived LicenseIQ field from ERP mapping (dynamic)
        derivedLicenseiqField: derivedLicenseiqField,
      };
    });
  }

  async getConfirmedCompanyMappings(companyId: string): Promise<PendingTermMapping[]> {
    // Get all confirmed mappings for a company (used for auto-applying to new contracts)
    const result = await db.execute(sql`
      SELECT DISTINCT ON (ptm.original_term, ptm.erp_field_name)
        ptm.*
      FROM pending_term_mappings ptm
      LEFT JOIN contracts c ON ptm.contract_id = c.id
      WHERE (ptm.company_id = ${companyId} OR c.company_id = ${companyId})
        AND ptm.status IN ('confirmed', 'modified')
      ORDER BY ptm.original_term, ptm.erp_field_name, ptm.confirmed_at DESC NULLS LAST
    `);
    
    return (result.rows as any[]).map(row => ({
      id: row.id,
      contractId: row.contract_id,
      companyId: row.company_id,
      extractionRunId: row.extraction_run_id,
      originalTerm: row.original_term,
      originalValue: row.original_value,
      sourceText: row.source_text,
      erpSystemId: row.erp_system_id,
      erpEntityId: row.erp_entity_id,
      erpFieldId: row.erp_field_id,
      erpFieldName: row.erp_field_name,
      erpEntityName: row.erp_entity_name,
      confidence: row.confidence,
      mappingMethod: row.mapping_method,
      alternativeMappings: row.alternative_mappings,
      status: row.status,
      confirmedBy: row.confirmed_by,
      confirmedAt: row.confirmed_at,
      userModifiedValue: row.user_modified_value,
      userModifiedFieldId: row.user_modified_field_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      erpRecordId: row.erp_record_id,
      erpRecordTable: row.erp_record_table,
      erpRecordValue: row.erp_record_value,
    })) as PendingTermMapping[];
  }

  async getPendingTermMappingsByExtractionRun(runId: string): Promise<PendingTermMapping[]> {
    return await db
      .select()
      .from(pendingTermMappings)
      .where(eq(pendingTermMappings.extractionRunId, runId))
      .orderBy(desc(pendingTermMappings.confidence));
  }

  async updatePendingTermMapping(id: string, updates: Partial<InsertPendingTermMapping>): Promise<PendingTermMapping> {
    const [updated] = await db
      .update(pendingTermMappings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pendingTermMappings.id, id))
      .returning();
    return updated;
  }

  async confirmPendingTermMapping(
    id: string, 
    userId: string, 
    modifiedValue?: string, 
    modifiedFieldId?: string,
    erpRecordId?: string,
    erpRecordValue?: string,
    erpRecordTable?: string,
    modifiedEntityName?: string,
    modifiedFieldName?: string
  ): Promise<PendingTermMapping> {
    const updateData: Partial<InsertPendingTermMapping> & { confirmedAt: Date; updatedAt: Date } = {
      status: "confirmed",
      confirmedBy: userId,
      confirmedAt: new Date(),
      updatedAt: new Date()
    };
    
    if (modifiedValue) {
      updateData.userModifiedValue = modifiedValue;
    }
    if (modifiedFieldId) {
      updateData.userModifiedFieldId = modifiedFieldId;
    }
    if (modifiedEntityName) {
      updateData.erpEntityName = modifiedEntityName;
    }
    if (modifiedFieldName) {
      updateData.erpFieldName = modifiedFieldName;
    }
    if (erpRecordId) {
      updateData.erpRecordId = erpRecordId;
    }
    if (erpRecordValue) {
      updateData.erpRecordValue = erpRecordValue;
    }
    if (erpRecordTable) {
      updateData.erpRecordTable = erpRecordTable;
    }
    
    const [updated] = await db
      .update(pendingTermMappings)
      .set(updateData)
      .where(eq(pendingTermMappings.id, id))
      .returning();
    return updated;
  }

  async bulkConfirmPendingTermMappings(ids: string[], userId: string): Promise<PendingTermMapping[]> {
    if (ids.length === 0) return [];
    
    const updated = await db
      .update(pendingTermMappings)
      .set({
        status: "confirmed",
        confirmedBy: userId,
        confirmedAt: new Date(),
        updatedAt: new Date()
      })
      .where(inArray(pendingTermMappings.id, ids))
      .returning();
    return updated;
  }

  async rejectPendingTermMapping(id: string, userId: string): Promise<PendingTermMapping> {
    const [updated] = await db
      .update(pendingTermMappings)
      .set({
        status: "rejected",
        confirmedBy: userId,
        confirmedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(pendingTermMappings.id, id))
      .returning();
    return updated;
  }

  async deletePendingTermMapping(id: string): Promise<void> {
    await db.delete(pendingTermMappings).where(eq(pendingTermMappings.id, id));
  }

  async deletePendingTermMappingsByContract(contractId: string): Promise<void> {
    await db.delete(pendingTermMappings).where(eq(pendingTermMappings.contractId, contractId));
  }

  // ======================
  // ERP MAPPING RULES SYSTEM
  // ======================

  // Organization Calculation Settings
  async getOrgCalculationSettings(companyId: string): Promise<OrgCalculationSettings | undefined> {
    const [settings] = await db
      .select()
      .from(orgCalculationSettings)
      .where(eq(orgCalculationSettings.companyId, companyId));
    return settings;
  }

  async createOrgCalculationSettings(settings: InsertOrgCalculationSettings): Promise<OrgCalculationSettings> {
    const [created] = await db
      .insert(orgCalculationSettings)
      .values(settings)
      .returning();
    return created;
  }

  async updateOrgCalculationSettings(id: string, updates: Partial<InsertOrgCalculationSettings>): Promise<OrgCalculationSettings> {
    const [updated] = await db
      .update(orgCalculationSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(orgCalculationSettings.id, id))
      .returning();
    return updated;
  }

  async upsertOrgCalculationSettings(companyId: string, approach: string, userId?: string): Promise<OrgCalculationSettings> {
    const existing = await this.getOrgCalculationSettings(companyId);
    if (existing) {
      return this.updateOrgCalculationSettings(existing.id, { calculationApproach: approach });
    }
    return this.createOrgCalculationSettings({
      companyId,
      calculationApproach: approach,
      createdBy: userId || null
    });
  }

  // ERP Mapping Rule Sets
  async getErpMappingRuleSets(filters: {
    companyId?: string;
    businessUnitId?: string;
    locationId?: string;
    sourceSystemId?: string;
    status?: string;
  }): Promise<ErpMappingRuleSet[]> {
    const conditions = [];
    
    if (filters.companyId) {
      conditions.push(eq(erpMappingRuleSets.companyId, filters.companyId));
    }
    if (filters.businessUnitId) {
      conditions.push(eq(erpMappingRuleSets.businessUnitId, filters.businessUnitId));
    }
    if (filters.locationId) {
      conditions.push(eq(erpMappingRuleSets.locationId, filters.locationId));
    }
    if (filters.sourceSystemId) {
      conditions.push(eq(erpMappingRuleSets.sourceSystemId, filters.sourceSystemId));
    }
    if (filters.status) {
      conditions.push(eq(erpMappingRuleSets.status, filters.status));
    }

    let query = db.select().from(erpMappingRuleSets);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query.orderBy(desc(erpMappingRuleSets.createdAt));
    return results;
  }

  async getErpMappingRuleSet(id: string): Promise<ErpMappingRuleSet | undefined> {
    const [ruleSet] = await db
      .select()
      .from(erpMappingRuleSets)
      .where(eq(erpMappingRuleSets.id, id));
    return ruleSet;
  }

  async createErpMappingRuleSet(ruleSet: InsertErpMappingRuleSet): Promise<ErpMappingRuleSet> {
    const [created] = await db
      .insert(erpMappingRuleSets)
      .values(ruleSet)
      .returning();
    return created;
  }

  async updateErpMappingRuleSet(id: string, updates: Partial<InsertErpMappingRuleSet>): Promise<ErpMappingRuleSet> {
    const [updated] = await db
      .update(erpMappingRuleSets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(erpMappingRuleSets.id, id))
      .returning();
    return updated;
  }

  async deleteErpMappingRuleSet(id: string): Promise<void> {
    await db.delete(erpMappingRuleSets).where(eq(erpMappingRuleSets.id, id));
  }

  async activateErpMappingRuleSet(id: string): Promise<ErpMappingRuleSet> {
    return this.updateErpMappingRuleSet(id, { status: 'active' });
  }

  async deactivateErpMappingRuleSet(id: string): Promise<ErpMappingRuleSet> {
    return this.updateErpMappingRuleSet(id, { status: 'inactive' });
  }

  // ERP Mapping Rules
  async getErpMappingRules(ruleSetId: string): Promise<ErpMappingRule[]> {
    return await db
      .select()
      .from(erpMappingRules)
      .where(eq(erpMappingRules.ruleSetId, ruleSetId))
      .orderBy(erpMappingRules.priority);
  }

  async getErpMappingRule(id: string): Promise<ErpMappingRule | undefined> {
    const [rule] = await db
      .select()
      .from(erpMappingRules)
      .where(eq(erpMappingRules.id, id));
    return rule;
  }

  async createErpMappingRule(rule: InsertErpMappingRule): Promise<ErpMappingRule> {
    const [created] = await db
      .insert(erpMappingRules)
      .values(rule)
      .returning();
    return created;
  }

  async updateErpMappingRule(id: string, updates: Partial<InsertErpMappingRule>): Promise<ErpMappingRule> {
    const [updated] = await db
      .update(erpMappingRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(erpMappingRules.id, id))
      .returning();
    return updated;
  }

  async deleteErpMappingRule(id: string): Promise<void> {
    await db.delete(erpMappingRules).where(eq(erpMappingRules.id, id));
  }

  // ERP Mapping Conditions
  async getErpMappingConditions(ruleId: string): Promise<ErpMappingCondition[]> {
    return await db
      .select()
      .from(erpMappingConditions)
      .where(eq(erpMappingConditions.ruleId, ruleId))
      .orderBy(erpMappingConditions.orderIndex);
  }

  async createErpMappingCondition(condition: InsertErpMappingCondition): Promise<ErpMappingCondition> {
    const [created] = await db
      .insert(erpMappingConditions)
      .values(condition)
      .returning();
    return created;
  }

  async updateErpMappingCondition(id: string, updates: Partial<InsertErpMappingCondition>): Promise<ErpMappingCondition> {
    const [updated] = await db
      .update(erpMappingConditions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(erpMappingConditions.id, id))
      .returning();
    return updated;
  }

  async deleteErpMappingCondition(id: string): Promise<void> {
    await db.delete(erpMappingConditions).where(eq(erpMappingConditions.id, id));
  }

  // ERP Mapping Outputs
  async getErpMappingOutputs(ruleId: string): Promise<ErpMappingOutput[]> {
    return await db
      .select()
      .from(erpMappingOutputs)
      .where(eq(erpMappingOutputs.ruleId, ruleId));
  }

  async createErpMappingOutput(output: InsertErpMappingOutput): Promise<ErpMappingOutput> {
    const [created] = await db
      .insert(erpMappingOutputs)
      .values(output)
      .returning();
    return created;
  }

  async updateErpMappingOutput(id: string, updates: Partial<InsertErpMappingOutput>): Promise<ErpMappingOutput> {
    const [updated] = await db
      .update(erpMappingOutputs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(erpMappingOutputs.id, id))
      .returning();
    return updated;
  }

  async deleteErpMappingOutput(id: string): Promise<void> {
    await db.delete(erpMappingOutputs).where(eq(erpMappingOutputs.id, id));
  }

  // ERP Rule Execution Log
  async createErpRuleExecutionLog(log: InsertErpRuleExecutionLog): Promise<ErpRuleExecutionLog> {
    const [created] = await db
      .insert(erpRuleExecutionLog)
      .values(log)
      .returning();
    return created;
  }

  async getErpRuleExecutionLogs(filters: {
    ruleSetId?: string;
    calculationId?: string;
    status?: string;
    limit?: number;
  }): Promise<ErpRuleExecutionLog[]> {
    const conditions = [];
    
    if (filters.ruleSetId) {
      conditions.push(eq(erpRuleExecutionLog.ruleSetId, filters.ruleSetId));
    }
    if (filters.calculationId) {
      conditions.push(eq(erpRuleExecutionLog.calculationId, filters.calculationId));
    }
    if (filters.status) {
      conditions.push(eq(erpRuleExecutionLog.status, filters.status));
    }

    let query = db.select().from(erpRuleExecutionLog);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query
      .orderBy(desc(erpRuleExecutionLog.executedAt))
      .limit(filters.limit || 100);
    return results;
  }

  // Get full rule set with all rules, conditions, and outputs
  async getErpMappingRuleSetWithDetails(id: string): Promise<{
    ruleSet: ErpMappingRuleSet;
    rules: Array<ErpMappingRule & { conditions: ErpMappingCondition[]; outputs: ErpMappingOutput[] }>;
  } | null> {
    const ruleSet = await this.getErpMappingRuleSet(id);
    if (!ruleSet) return null;

    const rules = await this.getErpMappingRules(id);
    const rulesWithDetails = await Promise.all(
      rules.map(async (rule) => {
        const conditions = await this.getErpMappingConditions(rule.id);
        const outputs = await this.getErpMappingOutputs(rule.id);
        return { ...rule, conditions, outputs };
      })
    );

    return { ruleSet, rules: rulesWithDetails };
  }

  // =====================================================
  // SYSTEM SETTINGS OPERATIONS
  // =====================================================

  async getSystemSettings(): Promise<SystemSettings | undefined> {
    const [settings] = await db.select().from(systemSettings).limit(1);
    return settings;
  }

  async updateSystemSettings(updates: Partial<InsertSystemSettings>): Promise<SystemSettings> {
    // Check if settings exist
    const existing = await this.getSystemSettings();
    
    if (existing) {
      // Update existing
      const [updated] = await db
        .update(systemSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(systemSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new
      const [created] = await db
        .insert(systemSettings)
        .values(updates as any)
        .returning();
      return created;
    }
  }

  // =====================================================
  // COMPANY SETTINGS OPERATIONS
  // =====================================================

  async getCompanySettings(companyId: string): Promise<CompanySettings | undefined> {
    const [settings] = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.companyId, companyId));
    return settings;
  }

  async updateCompanySettings(companyId: string, updates: Partial<InsertCompanySettings>): Promise<CompanySettings> {
    // Check if settings exist for this company
    const existing = await this.getCompanySettings(companyId);
    
    if (existing) {
      // Update existing
      const [updated] = await db
        .update(companySettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(companySettings.companyId, companyId))
        .returning();
      return updated;
    } else {
      // Create new
      const [created] = await db
        .insert(companySettings)
        .values({ ...updates, companyId } as any)
        .returning();
      return created;
    }
  }

  // =====================================================
  // CONTRACT TYPE DEFINITIONS OPERATIONS
  // =====================================================

  async getContractTypeDefinitions(): Promise<ContractTypeDefinition[]> {
    return await db
      .select()
      .from(contractTypeDefinitions)
      .orderBy(contractTypeDefinitions.sortOrder);
  }

  async createContractTypeDefinition(type: InsertContractTypeDefinition): Promise<ContractTypeDefinition> {
    const [created] = await db
      .insert(contractTypeDefinitions)
      .values(type)
      .returning();
    return created;
  }

  async updateContractTypeDefinition(id: string, updates: Partial<InsertContractTypeDefinition>): Promise<ContractTypeDefinition> {
    const [updated] = await db
      .update(contractTypeDefinitions)
      .set(updates)
      .where(eq(contractTypeDefinitions.id, id))
      .returning();
    return updated;
  }

  async deleteContractTypeDefinition(id: string): Promise<void> {
    // Check if it's a system type
    const [type] = await db
      .select()
      .from(contractTypeDefinitions)
      .where(eq(contractTypeDefinitions.id, id));
    
    if (type?.isSystemType) {
      throw new Error('Cannot delete system-defined contract types');
    }
    
    await db.delete(contractTypeDefinitions).where(eq(contractTypeDefinitions.id, id));
  }

  // =====================================================
  // CALCULATION FIELD TYPES OPERATIONS
  // =====================================================

  async getCalculationFieldTypes(contractTypeCode?: string): Promise<CalculationFieldType[]> {
    if (contractTypeCode) {
      return await db
        .select()
        .from(calculationFieldTypes)
        .where(and(
          eq(calculationFieldTypes.contractTypeCode, contractTypeCode),
          eq(calculationFieldTypes.isActive, true)
        ))
        .orderBy(calculationFieldTypes.sortOrder);
    }
    
    return await db
      .select()
      .from(calculationFieldTypes)
      .where(eq(calculationFieldTypes.isActive, true))
      .orderBy(calculationFieldTypes.contractTypeCode, calculationFieldTypes.sortOrder);
  }

  async createCalculationFieldType(fieldType: InsertCalculationFieldType): Promise<CalculationFieldType> {
    const [created] = await db
      .insert(calculationFieldTypes)
      .values(fieldType)
      .returning();
    return created;
  }

  async updateCalculationFieldType(id: string, updates: Partial<InsertCalculationFieldType>): Promise<CalculationFieldType> {
    const [updated] = await db
      .update(calculationFieldTypes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(calculationFieldTypes.id, id))
      .returning();
    if (!updated) throw new Error('Calculation field type not found');
    return updated;
  }

  async deleteCalculationFieldType(id: string): Promise<void> {
    await db
      .delete(calculationFieldTypes)
      .where(eq(calculationFieldTypes.id, id));
  }

  // ===== Contract Edit Locks =====
  // Pessimistic single-editor lock per contract. A lock with no heartbeat in the
  // last LOCK_STALE_MS milliseconds is considered abandoned and may be taken over.
  private static LOCK_STALE_MS = 90_000;

  async getContractEditLock(contractId: string): Promise<{
    contractId: string;
    userId: string;
    userName: string;
    acquiredAt: Date;
    lastHeartbeatAt: Date;
    isStale: boolean;
  } | null> {
    const [row] = await db
      .select()
      .from(contractEditLocks)
      .where(eq(contractEditLocks.contractId, contractId));
    if (!row) return null;
    const isStale = Date.now() - new Date(row.lastHeartbeatAt).getTime() > DatabaseStorage.LOCK_STALE_MS;
    return { ...row, isStale };
  }

  /**
   * Acquire (or refresh) the edit lock for a contract.
   * Returns { acquired: true } if this user now holds the lock, otherwise
   * { acquired: false, lock } describing the active holder.
   * `force` will take over a lock held by another user (used for stale locks
   * or explicit takeover).
   */
  async acquireContractEditLock(
    contractId: string,
    userId: string,
    userName: string,
    force: boolean = false,
  ): Promise<{ acquired: boolean; lock: any; tookOver?: boolean }> {
    const existing = await this.getContractEditLock(contractId);
    const now = new Date();

    if (!existing) {
      const [row] = await db
        .insert(contractEditLocks)
        .values({ contractId, userId, userName, acquiredAt: now, lastHeartbeatAt: now })
        .returning();
      return { acquired: true, lock: { ...row, isStale: false } };
    }

    if (existing.userId === userId) {
      const [row] = await db
        .update(contractEditLocks)
        .set({ lastHeartbeatAt: now })
        .where(eq(contractEditLocks.contractId, contractId))
        .returning();
      return { acquired: true, lock: { ...row, isStale: false } };
    }

    if (existing.isStale || force) {
      const [row] = await db
        .update(contractEditLocks)
        .set({ userId, userName, acquiredAt: now, lastHeartbeatAt: now })
        .where(eq(contractEditLocks.contractId, contractId))
        .returning();
      return { acquired: true, lock: { ...row, isStale: false }, tookOver: true };
    }

    return { acquired: false, lock: existing };
  }

  async releaseContractEditLock(contractId: string, userId: string): Promise<void> {
    // Only the holder can release; stale locks self-release on next acquire attempt.
    await db
      .delete(contractEditLocks)
      .where(and(
        eq(contractEditLocks.contractId, contractId),
        eq(contractEditLocks.userId, userId),
      ));
  }

  /**
   * Verify that `userId` holds an active (non-stale) lock for the contract.
   * Used as a guard before mutating contract metadata or rules.
   */
  async assertContractEditLockHeld(contractId: string, userId: string): Promise<{
    held: boolean;
    holder?: { userId: string; userName: string };
  }> {
    const lock = await this.getContractEditLock(contractId);
    if (!lock) return { held: false };
    if (lock.isStale) return { held: false };
    if (lock.userId !== userId) {
      return { held: false, holder: { userId: lock.userId, userName: lock.userName } };
    }
    return { held: true };
  }

}

export const storage = new DatabaseStorage();
