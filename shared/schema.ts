import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  foreignKey,
  timestamp,
  varchar,
  text,
  integer,
  serial,
  decimal,
  boolean,
  vector,
  unique,
  uniqueIndex,
  real,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  email: varchar("email").unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("viewer"), // owner, admin, editor, viewer, auditor
  isSystemAdmin: boolean("is_system_admin").notNull().default(false), // System-level super admin (can manage all companies)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contracts table
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractNumber: varchar("contract_number").unique(), // Auto-generated unique number: CNT-YYYY-NNN
  fileName: varchar("file_name").notNull(),
  originalName: varchar("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: varchar("file_type").notNull(),
  filePath: varchar("file_path").notNull(),
  fileHash: varchar("file_hash"), // SHA-256 of uploaded file bytes — used for duplicate-upload detection
  contractType: varchar("contract_type"), // @deprecated — use flowTypeCode. Kept for one-release rollback safety.
  contractSubtype: varchar("contract_subtype"), // @deprecated — replaced by per-rule subtype_instances. Kept for one-release rollback safety.
  flowTypeCode: varchar("flow_type_code"), // FK → flow_types.code. Primary contract classifier (VRP, CRP, RLA, SUB, RSM, OEM).
  // Provenance — how this contract record entered the system. Stamped at create time
  // so the Contract Overview can show a Source chip without filename heuristics.
  // Allowed values: 'upload' | 'template' | 'manual' | 'email' | 'connector' | 'fieldmap'.
  // Email / connector / fieldmap are reserved for future ingestion paths.
  source: varchar("source").notNull().default("upload"),
  priority: varchar("priority").notNull().default("normal"), // normal, high, urgent
  status: varchar("status").notNull().default("uploaded"), // uploaded, processing, analyzed, failed
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  notes: text("notes"),
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Editable metadata fields for contract management
  displayName: varchar("display_name"), // User-friendly contract name
  effectiveStart: timestamp("effective_start"), // Contract effective start date
  effectiveEnd: timestamp("effective_end"), // Contract expiration/end date
  renewalTerms: text("renewal_terms"), // Renewal terms and conditions
  governingLaw: varchar("governing_law"), // Jurisdiction/governing law
  organizationName: varchar("organization_name"), // Your organization/company (the party using this platform)
  counterpartyName: varchar("counterparty_name"), // Other party in the contract (vendor, customer, partner, etc.)
  // AI-derived master data link metadata for counterparty (Phase 1 of Linked-Master-Field pattern)
  counterpartyPartnerId: varchar("counterparty_partner_id"), // Resolved partner_master.id (or null)
  counterpartyLinkStatus: varchar("counterparty_link_status").default("unlinked"), // verified | suggested | unlinked | manual
  counterpartyLinkConfidence: real("counterparty_link_confidence"), // 0.00 - 1.00
  counterpartyLinkMethod: varchar("counterparty_link_method"), // exact | normalized | alphanumeric | fuzzy | ai_semantic | manual
  counterpartyLinkRawValue: text("counterparty_link_raw_value"), // Original AI-extracted string preserved for re-resolution
  counterpartyLinkConfirmedBy: varchar("counterparty_link_confirmed_by").references(() => users.id),
  counterpartyLinkConfirmedAt: timestamp("counterparty_link_confirmed_at"),
  // AI-derived master data link metadata for owning party / organization
  organizationCompanyId: varchar("organization_company_id"), // Resolved companies.id (or null)
  organizationLinkStatus: varchar("organization_link_status").default("unlinked"),
  organizationLinkConfidence: real("organization_link_confidence"),
  organizationLinkMethod: varchar("organization_link_method"),
  organizationLinkRawValue: text("organization_link_raw_value"),
  organizationLinkConfirmedBy: varchar("organization_link_confirmed_by").references(() => users.id),
  organizationLinkConfirmedAt: timestamp("organization_link_confirmed_at"),
  contractOwnerId: varchar("contract_owner_id").references(() => users.id), // Internal contract owner
  approvalState: varchar("approval_state").notNull().default("draft"), // draft, pending_approval, approved, rejected, superseded
  currentVersion: integer("current_version").notNull().default(1), // Current version number
  
  // ERP Integration Configuration
  useErpMatching: boolean("use_erp_matching").notNull().default(false), // Toggle: Use ERP data matching vs traditional approach
  erpSystemId: varchar("erp_system_id"), // Which ERP system to map to (references erp_systems.id)
  requireMappingConfirmation: boolean("require_mapping_confirmation").notNull().default(true), // Require user to confirm AI mappings before rule creation
  mappingConfidenceThreshold: real("mapping_confidence_threshold").default(0.70), // Auto-approve mappings above this threshold
  
  // Organizational Context Fields (for multi-location context switching)
  companyId: varchar("company_id"), // References companies table
  businessUnitId: varchar("business_unit_id"), // References business_units table
  locationId: varchar("location_id"), // References locations table
  
  // Extracted PDF text for display in UI
  rawText: text("raw_text"), // Full extracted text from PDF document
  
  // Merged from contract_master — business metadata fields
  contractCategory: varchar("contract_category"),
  owningParty: varchar("owning_party"),
  counterpartyType: varchar("counterparty_type"),
  territoryScope: varchar("territory_scope"),
  channelScope: varchar("channel_scope"),
  contractValueEstimatedAnnual: decimal("contract_value_estimated_annual", { precision: 15, scale: 2 }),
  currency: varchar("currency"),
  paymentFrequency: varchar("payment_frequency"),
  autoRenew: boolean("auto_renew"),
  renewalTermMonths: integer("renewal_term_months"),
  linkedContractId: varchar("linked_contract_id"),
  contractStatus: varchar("contract_status"),
  
  financialPolicies: jsonb("financial_policies"),
  periodPolicies: jsonb("period_policies"),
  datasetPolicies: jsonb("dataset_policies"),
  settlementPolicies: jsonb("settlement_policies"),
  partyRoleSlots: jsonb("party_role_slots"),

  // Slice 2 — when does an obligation accrual hit the books?
  //   'qualifying_sale'   = recognise in the period the qualifying sale fell in
  //   'scheduled_release' = recognise in the period the obligation is released
  // Nullable; null means "fall back to the system_settings default".
  obligationAccrualBasis: varchar("obligation_accrual_basis"),

  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by").references(() => users.id),
});

// Contract analysis results
export const contractAnalysis = pgTable("contract_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  summary: text("summary"),
  keyTerms: jsonb("key_terms"), // Array of extracted terms with confidence scores
  riskAnalysis: jsonb("risk_analysis"), // Risk assessment results
  insights: jsonb("insights"), // AI-generated insights
  confidence: decimal("confidence", { precision: 5, scale: 2 }), // Overall confidence score
  processingTime: integer("processing_time"), // Processing time in seconds
  headerReviewFlags: jsonb("header_review_flags"), // Pipeline header-level review flags (missing dates, parties, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contract embeddings for semantic search (AI-driven matching)
export const contractEmbeddings = pgTable("contract_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  embeddingType: varchar("embedding_type").notNull(), // 'product', 'territory', 'full_contract', 'rule_description'
  sourceText: text("source_text").notNull(), // Original text that was embedded
  embedding: vector("embedding", { dimensions: 384 }), // Hugging Face sentence-transformers/all-MiniLM-L6-v2 produces 384 dimensions
  metadata: jsonb("metadata"), // Additional context (product categories, territories, date ranges, etc.)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contract_embeddings_contract_idx").on(table.contractId),
  index("contract_embeddings_type_idx").on(table.embeddingType),
]);

// System documentation embeddings for LIQ AI platform knowledge
export const systemEmbeddings = pgTable("system_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().unique("system_embeddings_document_id_key"), // Knowledge base entry ID. Constraint name pinned to the existing DB name (Postgres' default `_key` suffix) so drizzle-kit doesn't try to add a redundant `_unique` constraint and hang on its arrow-key truncation prompt.
  category: varchar("category").notNull(), // Category for filtering
  title: varchar("title").notNull(), // Document title
  sourceText: text("source_text").notNull(), // Original text that was embedded
  embedding: vector("embedding", { dimensions: 384 }), // Same dimensions as contract embeddings
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("system_embeddings_category_idx").on(table.category),
  index("system_embeddings_document_idx").on(table.documentId),
]);

// Contract Versions - Full snapshot versioning for contract metadata
export const contractVersions = pgTable("contract_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  versionNumber: integer("version_number").notNull(),
  editorId: varchar("editor_id").notNull().references(() => users.id),
  changeSummary: text("change_summary"), // Brief description of what changed
  metadataSnapshot: jsonb("metadata_snapshot").notNull(), // Full snapshot of editable metadata fields
  fileReference: varchar("file_reference"), // Reference to file if file was changed
  approvalState: varchar("approval_state").notNull().default("draft"), // draft, pending_approval, approved, rejected, superseded
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contract_versions_contract_idx").on(table.contractId),
  index("contract_versions_state_idx").on(table.approvalState),
]);

// Contract Approvals - Approval decisions for contract versions
export const contractApprovals = pgTable("contract_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractVersionId: varchar("contract_version_id").notNull().references(() => contractVersions.id, { onDelete: 'cascade' }),
  approverId: varchar("approver_id").notNull().references(() => users.id),
  status: varchar("status").notNull(), // approved, rejected
  decisionNotes: text("decision_notes"), // Reason for approval/rejection
  decidedAt: timestamp("decided_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contract_approvals_version_idx").on(table.contractVersionId),
]);

// Contract Edit Locks - pessimistic locking so only one user can edit a contract at a time.
// Holders refresh `lastHeartbeatAt` every ~30s; locks idle for >90s are considered stale and
// can be taken over by another user (recorded as a takeover for the audit trail).
export const contractEditLocks = pgTable("contract_edit_locks", {
  contractId: varchar("contract_id").primaryKey().references(() => contracts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  userName: varchar("user_name").notNull(),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
  lastHeartbeatAt: timestamp("last_heartbeat_at").notNull().defaultNow(),
});

// Audit trail
export const auditTrail = pgTable("audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: varchar("action").notNull(), // login, logout, upload, analyze, view, edit, delete, etc.
  resourceType: varchar("resource_type"), // contract, user, analysis, etc.
  resourceId: varchar("resource_id"),
  details: jsonb("details"), // Additional context about the action
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
  isActive: true,
});

// Login schema for authentication
export const loginSchema = z.object({
  username: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Registration schema with validation
export const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address").optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
}).pick({
  username: true,
  password: true,
  email: true,
  firstName: true,
  lastName: true,
});

export const insertContractSchema = createInsertSchema(contracts).pick({
  contractNumber: true, // Optional - auto-generated if not provided
  fileName: true,
  originalName: true,
  fileSize: true,
  fileType: true,
  filePath: true,
  fileHash: true, // SHA-256 of uploaded file bytes — used for duplicate-upload detection
  status: true, // Allow upload route to start contract directly in 'processing' so the page shows the live AI pipeline
  contractType: true,
  contractSubtype: true,
  flowTypeCode: true,
  priority: true,
  uploadedBy: true,
  notes: true,
  // Organizational context fields
  companyId: true,
  businessUnitId: true,
  locationId: true,
}).partial({ contractNumber: true, contractType: true, contractSubtype: true, flowTypeCode: true, companyId: true, businessUnitId: true, locationId: true, fileHash: true, status: true }); // Make optional fields (filled in later by AI analysis)

export const insertContractAnalysisSchema = createInsertSchema(contractAnalysis).pick({
  contractId: true,
  summary: true,
  keyTerms: true,
  riskAnalysis: true,
  insights: true,
  confidence: true,
  processingTime: true,
});

export const insertAuditTrailSchema = createInsertSchema(auditTrail).pick({
  userId: true,
  action: true,
  resourceType: true,
  resourceId: true,
  details: true,
  ipAddress: true,
  userAgent: true,
});

export const insertContractVersionSchema = createInsertSchema(contractVersions).pick({
  contractId: true,
  versionNumber: true,
  editorId: true,
  changeSummary: true,
  metadataSnapshot: true,
  fileReference: true,
  approvalState: true,
});

export const insertContractApprovalSchema = createInsertSchema(contractApprovals).pick({
  contractVersionId: true,
  approverId: true,
  status: true,
  decisionNotes: true,
});

// Schema for updating contract metadata (editable fields only)
export const updateContractMetadataSchema = z.object({
  displayName: z.string().optional(),
  effectiveStart: z.string().optional(), // ISO date string
  effectiveEnd: z.string().optional(), // ISO date string
  renewalTerms: z.string().optional(),
  governingLaw: z.string().optional(),
  organizationName: z.string().optional(),
  counterpartyName: z.string().optional(),
  contractOwnerId: z.string().optional(),
  contractType: z.string().optional(),
  priority: z.string().optional(),
  notes: z.string().optional(),
  changeSummary: z.string().min(1, "Please describe what changed"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContractAnalysis = z.infer<typeof insertContractAnalysisSchema>;
export type ContractAnalysis = typeof contractAnalysis.$inferSelect;
export type InsertAuditTrail = z.infer<typeof insertAuditTrailSchema>;
export type AuditTrail = typeof auditTrail.$inferSelect;
export type InsertContractVersion = z.infer<typeof insertContractVersionSchema>;
export type ContractVersion = typeof contractVersions.$inferSelect;
export type InsertContractApproval = z.infer<typeof insertContractApprovalSchema>;
export type ContractApproval = typeof contractApprovals.$inferSelect;
export type UpdateContractMetadata = z.infer<typeof updateContractMetadataSchema>;

// Financial Analysis table
export const financialAnalysis = pgTable("financial_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("USD"),
  paymentSchedule: jsonb("payment_schedule"), // Array of payment dates and amounts
  royaltyStructure: jsonb("royalty_structure"), // Royalty rates and calculation methods
  revenueProjections: jsonb("revenue_projections"), // Projected income over time
  costImpact: jsonb("cost_impact"), // Cost analysis and budget impact
  currencyRisk: decimal("currency_risk", { precision: 5, scale: 2 }), // Risk score 0-100
  paymentTerms: text("payment_terms"),
  penaltyClauses: jsonb("penalty_clauses"), // Financial penalties and conditions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Compliance Analysis table
export const complianceAnalysis = pgTable("compliance_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  complianceScore: decimal("compliance_score", { precision: 5, scale: 2 }), // Overall compliance score 0-100
  regulatoryFrameworks: jsonb("regulatory_frameworks"), // GDPR, SOX, HIPAA, etc.
  jurisdictionAnalysis: jsonb("jurisdiction_analysis"), // Governing law analysis
  dataProtectionCompliance: boolean("data_protection_compliance"),
  industryStandards: jsonb("industry_standards"), // Industry-specific compliance
  riskFactors: jsonb("risk_factors"), // Compliance risk factors
  recommendedActions: jsonb("recommended_actions"), // Compliance improvement suggestions
  lastComplianceCheck: timestamp("last_compliance_check").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contract Obligations table
export const contractObligations = pgTable("contract_obligations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  obligationType: varchar("obligation_type").notNull(), // payment, delivery, performance, reporting
  description: text("description").notNull(),
  dueDate: timestamp("due_date"),
  responsible: varchar("responsible"), // party responsible for obligation
  status: varchar("status").default("pending"), // pending, completed, overdue, cancelled
  priority: varchar("priority").default("medium"), // low, medium, high, critical
  completionDate: timestamp("completion_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contract Performance Metrics table
export const performanceMetrics = pgTable("performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  performanceScore: decimal("performance_score", { precision: 5, scale: 2 }), // 0-100
  milestoneCompletion: decimal("milestone_completion", { precision: 5, scale: 2 }), // % completed
  onTimeDelivery: boolean("on_time_delivery").default(true),
  budgetVariance: decimal("budget_variance", { precision: 10, scale: 2 }), // Over/under budget
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }), // Quality assessment
  clientSatisfaction: decimal("client_satisfaction", { precision: 5, scale: 2 }), // Satisfaction rating
  renewalProbability: decimal("renewal_probability", { precision: 5, scale: 2 }), // Renewal likelihood
  lastReviewDate: timestamp("last_review_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Strategic Analysis table
export const strategicAnalysis = pgTable("strategic_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  strategicValue: decimal("strategic_value", { precision: 5, scale: 2 }), // Strategic importance score
  marketAlignment: decimal("market_alignment", { precision: 5, scale: 2 }), // How well aligned with market
  competitiveAdvantage: jsonb("competitive_advantage"), // Competitive benefits
  riskConcentration: decimal("risk_concentration", { precision: 5, scale: 2 }), // Risk concentration level
  standardizationScore: decimal("standardization_score", { precision: 5, scale: 2 }), // Template compliance
  negotiationInsights: jsonb("negotiation_insights"), // Negotiation patterns and suggestions
  benchmarkComparison: jsonb("benchmark_comparison"), // Industry benchmark comparison
  recommendations: jsonb("recommendations"), // Strategic recommendations
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contract Comparisons table (for similar contract analysis)
export const contractComparisons = pgTable("contract_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  similarContracts: jsonb("similar_contracts"), // Array of similar contract IDs and similarity scores
  clauseVariations: jsonb("clause_variations"), // Differences in key clauses
  termComparisons: jsonb("term_comparisons"), // Financial and legal term comparisons
  bestPractices: jsonb("best_practices"), // Identified best practices from comparisons
  anomalies: jsonb("anomalies"), // Unusual terms or conditions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Market Benchmarks table
export const marketBenchmarks = pgTable("market_benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractType: varchar("contract_type").notNull(),
  industry: varchar("industry"),
  benchmarkData: jsonb("benchmark_data"), // Market standard terms, rates, etc.
  averageValue: decimal("average_value", { precision: 15, scale: 2 }),
  standardTerms: jsonb("standard_terms"), // Common terms for this contract type
  riskFactors: jsonb("risk_factors"), // Common risk factors
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for new tables
export const insertFinancialAnalysisSchema = createInsertSchema(financialAnalysis).pick({
  contractId: true,
  totalValue: true,
  currency: true,
  paymentSchedule: true,
  royaltyStructure: true,
  revenueProjections: true,
  costImpact: true,
  currencyRisk: true,
  paymentTerms: true,
  penaltyClauses: true,
});

export const insertComplianceAnalysisSchema = createInsertSchema(complianceAnalysis).pick({
  contractId: true,
  complianceScore: true,
  regulatoryFrameworks: true,
  jurisdictionAnalysis: true,
  dataProtectionCompliance: true,
  industryStandards: true,
  riskFactors: true,
  recommendedActions: true,
});

export const insertContractObligationSchema = createInsertSchema(contractObligations).pick({
  contractId: true,
  obligationType: true,
  description: true,
  dueDate: true,
  responsible: true,
  status: true,
  priority: true,
  notes: true,
});

export const insertPerformanceMetricsSchema = createInsertSchema(performanceMetrics).pick({
  contractId: true,
  performanceScore: true,
  milestoneCompletion: true,
  onTimeDelivery: true,
  budgetVariance: true,
  qualityScore: true,
  clientSatisfaction: true,
  renewalProbability: true,
});

export const insertStrategicAnalysisSchema = createInsertSchema(strategicAnalysis).pick({
  contractId: true,
  strategicValue: true,
  marketAlignment: true,
  competitiveAdvantage: true,
  riskConcentration: true,
  standardizationScore: true,
  negotiationInsights: true,
  benchmarkComparison: true,
  recommendations: true,
});

export const insertContractComparisonSchema = createInsertSchema(contractComparisons).pick({
  contractId: true,
  similarContracts: true,
  clauseVariations: true,
  termComparisons: true,
  bestPractices: true,
  anomalies: true,
});

export const insertMarketBenchmarkSchema = createInsertSchema(marketBenchmarks).pick({
  contractType: true,
  industry: true,
  benchmarkData: true,
  averageValue: true,
  standardTerms: true,
  riskFactors: true,
});

// Enhanced types
export type FinancialAnalysis = typeof financialAnalysis.$inferSelect;
export type InsertFinancialAnalysis = z.infer<typeof insertFinancialAnalysisSchema>;
export type ComplianceAnalysis = typeof complianceAnalysis.$inferSelect;
export type InsertComplianceAnalysis = z.infer<typeof insertComplianceAnalysisSchema>;
export type ContractObligation = typeof contractObligations.$inferSelect;
export type InsertContractObligation = z.infer<typeof insertContractObligationSchema>;
export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;
export type StrategicAnalysis = typeof strategicAnalysis.$inferSelect;
export type InsertStrategicAnalysis = z.infer<typeof insertStrategicAnalysisSchema>;
export type ContractComparison = typeof contractComparisons.$inferSelect;
export type InsertContractComparison = z.infer<typeof insertContractComparisonSchema>;
export type MarketBenchmark = typeof marketBenchmarks.$inferSelect;
export type InsertMarketBenchmark = z.infer<typeof insertMarketBenchmarkSchema>;

// Enhanced contract with all analysis data
export type ContractWithAnalysis = Contract & {
  analysis?: ContractAnalysis;
  financialAnalysis?: FinancialAnalysis;
  complianceAnalysis?: ComplianceAnalysis;
  obligations?: ContractObligation[];
  performanceMetrics?: PerformanceMetrics;
  strategicAnalysis?: StrategicAnalysis;
  comparisons?: ContractComparison;
  uploadedByUser?: User;
};

// ======================
// AI-DRIVEN ROYALTY CALCULATION SYSTEM
// ======================

// Sales Data (AI-Matched to Contracts)
export const salesData = pgTable("sales_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchedContractId: varchar("matched_contract_id").references(() => contracts.id, { onDelete: 'set null' }),
  matchConfidence: decimal("match_confidence", { precision: 5, scale: 2 }),
  transactionDate: timestamp("transaction_date").notNull(),
  transactionId: varchar("transaction_id"),
  // Slice 2 — return / chargeback / overpayment linkage. 'sale' is the default;
  // when a row is a return, originalSaleId points back at the original sale so
  // the returns_offset evaluator can replay the original rate (no recompute).
  // Self-FK with set-null on delete so cascading the original never orphans
  // its return row.
  transactionType: varchar("transaction_type").default("sale"),
  originalSaleId: varchar("original_sale_id").references((): AnyPgColumn => salesData.id, { onDelete: 'set null' }),
  productCode: varchar("product_code"),
  productName: varchar("product_name"),
  category: varchar("category"),
  territory: varchar("territory"),
  currency: varchar("currency").default("USD"),
  grossAmount: decimal("gross_amount", { precision: 15, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }),
  quantity: decimal("quantity", { precision: 12, scale: 4 }),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }),
  customFields: jsonb("custom_fields"),
  importJobId: varchar("import_job_id"),
  channel: varchar("channel"),
  customerCode: varchar("customer_code"),
  
  // Multi-location context fields (inherited from matched contract or set during import)
  companyId: varchar("company_id").references(() => companies.id),
  businessUnitId: varchar("business_unit_id").references(() => businessUnits.id),
  locationId: varchar("location_id").references(() => locations.id),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Contract-based Fee Calculations (AI-Matched Workflow)
export const contractCalculations = pgTable("contract_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(), // e.g., "Q1 2024 Royalties"
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  status: varchar("status").default("pending_approval"), // pending_approval, approved, rejected, paid
  totalSalesAmount: decimal("total_sales_amount", { precision: 15, scale: 2 }),
  totalRoyalty: decimal("total_royalty", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("USD"),
  salesCount: integer("sales_count"),
  breakdown: jsonb("breakdown"), // Detailed per-sale breakdown
  chartData: jsonb("chart_data"), // Pre-computed chart data
  calculatedBy: varchar("calculated_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  comments: text("comments"),
  
  // Multi-location context fields (inherited from contract)
  companyId: varchar("company_id").references(() => companies.id),
  businessUnitId: varchar("business_unit_id").references(() => businessUnits.id),
  locationId: varchar("location_id").references(() => locations.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Calculation Rule Results - Per-rule traceability with frozen snapshots
export const calculationRuleResults = pgTable("calculation_rule_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  calculationId: varchar("calculation_id").notNull(),
  ruleId: varchar("rule_id"),
  ruleName: varchar("rule_name").notNull(),
  ruleType: varchar("rule_type").notNull(),
  ruleSnapshot: jsonb("rule_snapshot").notNull(),
  qualificationSummary: jsonb("qualification_summary"),
  adjustmentsApplied: jsonb("adjustments_applied"),
  totalFee: decimal("total_fee", { precision: 15, scale: 2 }).default("0"),
  totalSalesAmount: decimal("total_sales_amount", { precision: 15, scale: 2 }).default("0"),
  transactionCount: integer("transaction_count").default(0),
  // Calc phase the rule was evaluated in (slice 1) — see shared/calcPhases.ts.
  // Existing rows are backfilled to 'gross_calc'.
  phase: varchar("phase").default("gross_calc"),
  // Slice 2 — links a returns_offset / overpayment_offset / advance_recoupment
  // result back to the gross_calc row it is reversing or consuming. Self-FK,
  // set null on delete so cascading a calc never orphans the chain.
  relatedResultId: varchar("related_result_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("calc_rule_results_calc_idx").on(table.calculationId),
  index("calc_rule_results_rule_idx").on(table.ruleId),
  index("calc_rule_results_phase_idx").on(table.phase),
  index("calc_rule_results_related_idx").on(table.relatedResultId),
  foreignKey({
    columns: [table.calculationId],
    foreignColumns: [contractCalculations.id],
    name: "calculation_rule_results_calculation_id_contract_calculations_i",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.relatedResultId],
    foreignColumns: [calculationRuleResults.id],
    name: "calculation_rule_results_related_result_id_calculation_rule_res",
  }).onDelete("set null"),
]);

export const insertCalculationRuleResultSchema = createInsertSchema(calculationRuleResults).omit({
  id: true,
  createdAt: true,
});

export type CalculationRuleResult = typeof calculationRuleResults.$inferSelect;
export type InsertCalculationRuleResult = z.infer<typeof insertCalculationRuleResultSchema>;

// Structured Contract Rules (Extracted from Contracts)
export const contractRules = pgTable("contract_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  ruleType: varchar("rule_type").notNull(), // 'percentage', 'tiered', 'minimum_guarantee', 'cap', 'deduction', 'fixed_fee'
  ruleName: varchar("rule_name").notNull(),
  description: text("description"),
  
  // NEW: JSON-based dynamic formula storage
  formulaDefinition: jsonb("formula_definition"), // Complete FormulaDefinition object with expression tree
  formulaVersion: varchar("formula_version").default("1.0"), // Version for tracking formula changes
  
  // LEGACY: Tabular columns (kept for backwards compatibility during migration)
  // @deprecated The single source of truth for product/territory filters is
  // now `contract_qualifiers` (joined via `source_clause_id`). These columns
  // are kept populated for backward compatibility only and are no longer read
  // by the calculation engine — `storage.getRoyaltyRulesByContract` enriches
  // each rule's arrays from qualifier rows at read time. Safe to drop in a
  // future migration once all read sites have been validated.
  productCategories: text("product_categories").array(), // Array of product categories this rule applies to
  territories: text("territories").array(), // Array of territories
  seasonalAdjustments: jsonb("seasonal_adjustments"), // e.g., {"Spring": 1.10, "Fall": 0.95, "Holiday": 1.20}
  territoryPremiums: jsonb("territory_premiums"), // e.g., {"Secondary": 1.10, "Organic": 1.25}
  volumeTiers: jsonb("volume_tiers"), // [{"min": 0, "max": 4999, "rate": 1.25}, {"min": 5000, "rate": 1.10}]
  baseRate: decimal("base_rate", { precision: 15, scale: 2 }), // Base fee rate
  minimumGuarantee: decimal("minimum_guarantee", { precision: 15, scale: 2 }), // Annual minimum
  calculationFormula: text("calculation_formula"), // Description of how to calculate
  
  // Dynamic field mappings - maps extracted column names to calculation fields
  // Example: { "volumeField": "Quarterly Net Purchases", "rateField": "Rebate %", "minimumField": "Min Annual" }
  fieldMappings: jsonb("field_mappings"),
  
  // Metadata
  priority: integer("priority").default(10), // Lower number = higher priority
  isActive: boolean("is_active").default(true),
  confidence: decimal("confidence", { precision: 5, scale: 2 }), // AI extraction confidence
  reviewStatus: varchar("review_status").default("pending"), // pending, confirmed, rejected - for human-in-the-loop confirmation
  reviewedBy: varchar("reviewed_by").references(() => users.id), // User who confirmed/rejected
  reviewedAt: timestamp("reviewed_at"), // When the rule was reviewed
  sourceSection: varchar("source_section"), // Where in contract this was found
  sourceText: text("source_text"), // Original contract text
  sourcePage: integer("source_page"), // Page number in contract where rule was found
  extractionOrder: integer("extraction_order"), // Preserves the order rules appeared in the PDF/extraction
  
  // Validation fields - verify extracted values exist in source text
  validationStatus: varchar("validation_status").default("pending"), // pending, passed, failed
  validatedConfidence: decimal("validated_confidence", { precision: 5, scale: 2 }), // Adjusted confidence after validation
  validationDetails: jsonb("validation_details"), // Details: { valuesFound: [], valuesMissing: [], confidenceAdjustment: 1.0 }
  
  clauseCategory: varchar("clause_category").default("general"),
  customerSegments: text("customer_segments").array(),
  partnerIds: text("partner_ids").array(),
  channel: varchar("channel"),
  exceptions: jsonb("exceptions"),
  ruleVersionNum: integer("rule_version_num").default(1),
  previousVersionData: jsonb("previous_version_data"),
  specificityScore: integer("specificity_score").default(0),
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  minimumPrice: decimal("minimum_price", { precision: 15, scale: 2 }),
  
  templateCode: varchar("template_code"),
  executionGroup: varchar("execution_group"),
  // Subtype Instance — the per-(contract, subtype) program container this rule belongs to.
  // Nullable during migration; new rules should always have it set.
  subtypeInstanceId: varchar("subtype_instance_id"),
  // Calculation taxonomy (slice 1).
  // calcPhase drives engine ordering — see shared/calcPhases.ts.
  // executionGroup remains a free-form user label and is no longer engine-meaningful.
  calcPhase: varchar("calc_phase").default("gross_calc"),
  triggerSource: varchar("trigger_source").default("sale"),
  // No DB default — the AI extraction must explicitly set this from the
  // contract's aggregation period (per_sale / per_period / per_contract).
  // A silent per_sale default was masking missing extraction (CNT-2026-043
  // had quarterly royalty rules silently downgraded to per_sale).
  aggregationScope: varchar("aggregation_scope"),
  baseMetric: varchar("base_metric"),
  // Tier basis controls how a tiered/rebate_tiered rule's quarterly aggregate is
  // measured against tier thresholds. Values: 'units' | 'amount' | 'auto' (null
  // also treated as 'auto'). When 'auto', the engine falls back to a magnitude
  // heuristic on the largest tier.min for backward compatibility.
  tierBasis: varchar("tier_basis").default("auto"),
  fieldConfidence: jsonb("field_confidence"),
  reviewFlags: jsonb("review_flags"),
  
  sourceClauseId: varchar("source_clause_id"),
  
  uom: varchar("uom"),
  qualifierGroups: jsonb("qualifier_groups"),
  
  milestones: jsonb("milestones"),
  milestoneCount: integer("milestone_count"),
  milestoneTiers: jsonb("milestone_tiers"),
  milestoneConfig: jsonb("milestone_config"),

  // Approval gate — independent from reviewStatus (Traffic Light).
  // Only rules with approvalStatus='approved' participate in fee calculations.
  // Values: 'pending' | 'approved' | 'rejected'
  approvalStatus: text("approval_status").default('pending'),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  approvalNotes: text("approval_notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ======================
// INSERT SCHEMAS
// ======================

export const insertSalesDataSchema = createInsertSchema(salesData).pick({
  matchedContractId: true,
  matchConfidence: true,
  transactionDate: true,
  transactionId: true,
  transactionType: true,
  originalSaleId: true,
  productCode: true,
  productName: true,
  category: true,
  territory: true,
  currency: true,
  grossAmount: true,
  netAmount: true,
  quantity: true,
  unitPrice: true,
  customFields: true,
  importJobId: true,
  channel: true,
  customerCode: true,
});

export const insertContractCalculationSchema = createInsertSchema(contractCalculations).pick({
  contractId: true,
  name: true,
  periodStart: true,
  periodEnd: true,
  totalSalesAmount: true,
  totalRoyalty: true,
  currency: true,
  salesCount: true,
  breakdown: true,
  chartData: true,
  calculatedBy: true,
  comments: true,
  companyId: true,
  businessUnitId: true,
  locationId: true,
});

export const insertContractRuleSchema = createInsertSchema(contractRules).pick({
  contractId: true,
  ruleType: true,
  ruleName: true,
  description: true,
  
  // NEW: JSON-based formula fields
  formulaDefinition: true,
  formulaVersion: true,
  
  // LEGACY: Tabular fields (kept for backwards compatibility)
  productCategories: true,
  territories: true,
  seasonalAdjustments: true,
  territoryPremiums: true,
  volumeTiers: true,
  baseRate: true,
  minimumGuarantee: true,
  calculationFormula: true,
  
  priority: true,
  isActive: true,
  confidence: true,
  reviewStatus: true,
  reviewedBy: true,
  reviewedAt: true,
  sourceSection: true,
  sourceText: true,
  sourcePage: true,
  extractionOrder: true,
  validationStatus: true,
  validatedConfidence: true,
  validationDetails: true,
  clauseCategory: true,
  customerSegments: true,
  channel: true,
  exceptions: true,
  ruleVersionNum: true,
  previousVersionData: true,
  specificityScore: true,
  effectiveDate: true,
  expiryDate: true,
  minimumPrice: true,
  templateCode: true,
  executionGroup: true,
  subtypeInstanceId: true,
  calcPhase: true,
  triggerSource: true,
  aggregationScope: true,
  baseMetric: true,
  tierBasis: true,
  fieldConfidence: true,
  reviewFlags: true,
  sourceClauseId: true,
  uom: true,
  qualifierGroups: true,
  milestones: true,
  milestoneCount: true,
  milestoneTiers: true,
  milestoneConfig: true,
});

// ======================
// TYPES
// ======================

export type SalesData = typeof salesData.$inferSelect;
export type InsertSalesData = z.infer<typeof insertSalesDataSchema>;
export type ContractCalculation = typeof contractCalculations.$inferSelect;
export type InsertContractCalculation = z.infer<typeof insertContractCalculationSchema>;
export type ContractRoyaltyCalculation = ContractCalculation;
export type InsertContractRoyaltyCalculation = InsertContractCalculation;
export const contractRoyaltyCalculations = contractCalculations;
export const insertContractRoyaltyCalculationSchema = insertContractCalculationSchema;
export type ContractRule = typeof contractRules.$inferSelect;
export type InsertContractRule = z.infer<typeof insertContractRuleSchema>;
export type RoyaltyRule = ContractRule;
export type InsertRoyaltyRule = InsertContractRule;
export const royaltyRules = contractRules;
export const insertRoyaltyRuleSchema = insertContractRuleSchema;

// ======================
// DYNAMIC CONTRACT PROCESSING SYSTEM
// AI-Powered Knowledge Graph & Flexible Extraction
// ======================

// Contract Documents - Raw text segments with metadata
export const contractDocuments = pgTable("contract_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  extractionRunId: varchar("extraction_run_id"),
  documentSection: varchar("document_section"), // 'header', 'parties', 'terms', 'payment', 'termination', etc.
  sectionOrder: integer("section_order"), // Order within document
  rawText: text("raw_text").notNull(), // Original text from PDF
  normalizedText: text("normalized_text"), // Cleaned/normalized version
  pageNumber: integer("page_number"),
  metadata: jsonb("metadata"), // Layout info, confidence, formatting details
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contract_documents_contract_idx").on(table.contractId),
  index("contract_documents_extraction_idx").on(table.extractionRunId),
]);

// Contract Graph Nodes - Entities extracted from contracts (people, terms, clauses, etc.)
export const contractGraphNodes = pgTable("contract_graph_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  extractionRunId: varchar("extraction_run_id"),
  nodeType: varchar("node_type").notNull(), // 'party', 'product', 'territory', 'clause', 'term', 'obligation', 'royalty_rule'
  label: varchar("label").notNull(), // Human-readable name
  properties: jsonb("properties").notNull(), // All extracted properties as flexible JSON
  confidence: decimal("confidence", { precision: 5, scale: 2 }), // AI confidence (0-1)
  sourceDocumentId: varchar("source_document_id"),
  sourceText: text("source_text"), // Original text this was extracted from
  embedding: vector("embedding", { dimensions: 384 }), // Semantic embedding for this node
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("graph_nodes_contract_idx").on(table.contractId),
  index("graph_nodes_type_idx").on(table.nodeType),
  index("graph_nodes_extraction_idx").on(table.extractionRunId),
  foreignKey({
    columns: [table.sourceDocumentId],
    foreignColumns: [contractDocuments.id],
    name: "contract_graph_nodes_source_document_id_contract_documents_id_f",
  }).onDelete("no action"),
]);

// Contract Graph Edges - Relationships between nodes
export const contractGraphEdges = pgTable("contract_graph_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  extractionRunId: varchar("extraction_run_id"),
  sourceNodeId: varchar("source_node_id").notNull().references(() => contractGraphNodes.id),
  targetNodeId: varchar("target_node_id").notNull().references(() => contractGraphNodes.id),
  relationshipType: varchar("relationship_type").notNull(), // 'applies_to', 'references', 'requires', 'modifies', etc.
  properties: jsonb("properties"), // Additional relationship metadata
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("graph_edges_contract_idx").on(table.contractId),
  index("graph_edges_source_idx").on(table.sourceNodeId),
  index("graph_edges_target_idx").on(table.targetNodeId),
]);

// Extraction Runs - Track each AI extraction attempt with confidence and validation
export const extractionRuns = pgTable("extraction_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  runType: varchar("run_type").notNull(), // 'initial', 'reprocess', 'manual_correction'
  status: varchar("status").notNull().default("processing"), // 'processing', 'completed', 'failed', 'pending_review'
  overallConfidence: decimal("overall_confidence", { precision: 5, scale: 2 }),
  nodesExtracted: integer("nodes_extracted"),
  edgesExtracted: integer("edges_extracted"),
  rulesExtracted: integer("rules_extracted"),
  validationResults: jsonb("validation_results"), // Results from validation checks
  aiModel: varchar("ai_model").default("llama-3.1-8b"), // Which LLM was used
  processingTime: integer("processing_time"), // Milliseconds
  errorLog: text("error_log"),
  triggeredBy: varchar("triggered_by").references(() => users.id),
  
  currentStage: varchar("current_stage"),
  stageAStatus: varchar("stage_a_status"),
  stageBStatus: varchar("stage_b_status"),
  stageCStatus: varchar("stage_c_status"),
  pipelineMode: varchar("pipeline_mode").default("legacy"),
  
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("extraction_runs_contract_idx").on(table.contractId),
  index("extraction_runs_status_idx").on(table.status),
]);

// Rule Definitions - Dynamic rule storage with extensible formula types
export const ruleDefinitions = pgTable("rule_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  extractionRunId: varchar("extraction_run_id").references(() => extractionRuns.id),
  linkedGraphNodeId: varchar("linked_graph_node_id"), // Link to knowledge graph
  ruleType: varchar("rule_type").notNull(), // Can be ANY type, not just predefined ones
  ruleName: varchar("rule_name").notNull(),
  description: text("description"),
  formulaDefinition: jsonb("formula_definition").notNull(), // Complete FormulaNode tree
  applicabilityFilters: jsonb("applicability_filters"), // When this rule applies (flexible JSON)
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  validationStatus: varchar("validation_status").default("pending"), // 'pending', 'validated', 'failed', 'approved'
  validationErrors: jsonb("validation_errors"), // Any validation issues found
  isActive: boolean("is_active").default(false), // Only active after approval
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("rule_definitions_contract_idx").on(table.contractId),
  index("rule_definitions_status_idx").on(table.validationStatus),
  foreignKey({
    columns: [table.linkedGraphNodeId],
    foreignColumns: [contractGraphNodes.id],
    name: "rule_definitions_linked_graph_node_id_contract_graph_nodes_id_f",
  }).onDelete("no action"),
]);

// Rule Node Definitions - Registry of custom FormulaNode types (extensible system)
export const ruleNodeDefinitions = pgTable("rule_node_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nodeType: varchar("node_type").unique("rule_node_definitions_node_type_key").notNull(), // e.g., 'hybrid_percentage_plus_fixed', 'conditional_tier'
  displayName: varchar("display_name").notNull(),
  description: text("description"),
  schema: jsonb("schema").notNull(), // JSON schema for this node type's structure
  evaluationAdapter: text("evaluation_adapter"), // Optional: custom evaluation logic
  examples: jsonb("examples"), // Example usage
  createdAt: timestamp("created_at").defaultNow(),
});

// Human Review Tasks - Queue for low-confidence extractions
export const humanReviewTasks = pgTable("human_review_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  extractionRunId: varchar("extraction_run_id").references(() => extractionRuns.id),
  taskType: varchar("task_type").notNull(), // 'node_review', 'rule_review', 'relationship_review', 'field_mapping'
  priority: varchar("priority").default("normal"), // 'low', 'normal', 'high', 'critical'
  status: varchar("status").default("pending"), // 'pending', 'in_review', 'approved', 'rejected', 'needs_revision'
  targetId: varchar("target_id"), // ID of the node/rule/edge being reviewed
  targetType: varchar("target_type"), // 'graph_node', 'rule_definition', 'graph_edge', 'field_mapping'
  originalData: jsonb("original_data").notNull(), // Original AI extraction
  suggestedCorrection: jsonb("suggested_correction"), // User's correction
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  reviewNotes: text("review_notes"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("review_tasks_contract_idx").on(table.contractId),
  index("review_tasks_status_idx").on(table.status),
  index("review_tasks_assigned_idx").on(table.assignedTo),
]);

// Sales Field Mappings - Learned associations between sales data columns and contract terms
export const salesFieldMappings = pgTable("sales_field_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'set null' }), // Can be contract-specific or global (null)
  sourceFieldName: varchar("source_field_name").notNull(), // Field name from sales data (e.g., "Item", "SKU")
  targetFieldType: varchar("target_field_type").notNull(), // Semantic type (e.g., "productName", "territory", "quantity")
  mappingConfidence: decimal("mapping_confidence", { precision: 5, scale: 2 }),
  mappingMethod: varchar("mapping_method").default("ai_semantic"), // 'ai_semantic', 'manual', 'learned', 'exact_match'
  sampleValues: jsonb("sample_values"), // Example values to help validate mapping
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  usageCount: integer("usage_count").default(0), // How many times this mapping was successfully used
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("field_mappings_contract_idx").on(table.contractId),
  index("field_mappings_source_idx").on(table.sourceFieldName),
]);

// Semantic Index Entries - GraphRAG embeddings for enhanced search
export const semanticIndexEntries = pgTable("semantic_index_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  indexType: varchar("index_type").notNull(), // 'graph_node', 'document_chunk', 'rule_description', 'combined'
  sourceId: varchar("source_id"), // ID of source (graph node, document, rule)
  content: text("content").notNull(), // Text content that was embedded
  embedding: vector("embedding", { dimensions: 384 }),
  metadata: jsonb("metadata"), // Context about this entry (node type, section, etc.)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("semantic_index_contract_idx").on(table.contractId),
  index("semantic_index_type_idx").on(table.indexType),
]);

// Rule Validation Events - Audit trail for rule validation
export const ruleValidationEvents = pgTable("rule_validation_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleDefinitionId: varchar("rule_definition_id").notNull(),
  validationType: varchar("validation_type").notNull(), // 'dimensional', 'ai_consistency', 'monte_carlo', 'manual'
  validationResult: varchar("validation_result").notNull(), // 'passed', 'failed', 'warning'
  issues: jsonb("issues"), // Array of validation issues found
  recommendations: jsonb("recommendations"), // Suggested fixes
  validatorId: varchar("validator_id").references(() => users.id), // For manual validations
  validatedAt: timestamp("validated_at").defaultNow(),
}, (table) => [
  index("validation_events_rule_idx").on(table.ruleDefinitionId),
  foreignKey({
    columns: [table.ruleDefinitionId],
    foreignColumns: [ruleDefinitions.id],
    name: "rule_validation_events_rule_definition_id_rule_definitions_id_f",
  }).onDelete("no action"),
]);

// ======================
// INSERT SCHEMAS FOR NEW TABLES
// ======================

export const insertContractDocumentSchema = createInsertSchema(contractDocuments).pick({
  contractId: true,
  extractionRunId: true,
  documentSection: true,
  sectionOrder: true,
  rawText: true,
  normalizedText: true,
  pageNumber: true,
  metadata: true,
});

export const insertContractGraphNodeSchema = createInsertSchema(contractGraphNodes).pick({
  contractId: true,
  extractionRunId: true,
  nodeType: true,
  label: true,
  properties: true,
  confidence: true,
  sourceDocumentId: true,
  sourceText: true,
});

export const insertContractGraphEdgeSchema = createInsertSchema(contractGraphEdges).pick({
  contractId: true,
  extractionRunId: true,
  sourceNodeId: true,
  targetNodeId: true,
  relationshipType: true,
  properties: true,
  confidence: true,
});

export const insertExtractionRunSchema = createInsertSchema(extractionRuns).pick({
  contractId: true,
  runType: true,
  status: true,
  overallConfidence: true,
  nodesExtracted: true,
  edgesExtracted: true,
  rulesExtracted: true,
  validationResults: true,
  aiModel: true,
  processingTime: true,
  errorLog: true,
  triggeredBy: true,
  currentStage: true,
  stageAStatus: true,
  stageBStatus: true,
  stageCStatus: true,
  pipelineMode: true,
});

export const insertRuleDefinitionSchema = createInsertSchema(ruleDefinitions).pick({
  contractId: true,
  extractionRunId: true,
  linkedGraphNodeId: true,
  ruleType: true,
  ruleName: true,
  description: true,
  formulaDefinition: true,
  applicabilityFilters: true,
  confidence: true,
  validationStatus: true,
  validationErrors: true,
  isActive: true,
  version: true,
});

export const insertRuleNodeDefinitionSchema = createInsertSchema(ruleNodeDefinitions).pick({
  nodeType: true,
  displayName: true,
  description: true,
  schema: true,
  evaluationAdapter: true,
  examples: true,
});

export const insertHumanReviewTaskSchema = createInsertSchema(humanReviewTasks).pick({
  contractId: true,
  extractionRunId: true,
  taskType: true,
  priority: true,
  status: true,
  targetId: true,
  targetType: true,
  originalData: true,
  suggestedCorrection: true,
  confidence: true,
  reviewNotes: true,
  assignedTo: true,
});

export const insertSalesFieldMappingSchema = createInsertSchema(salesFieldMappings).pick({
  contractId: true,
  sourceFieldName: true,
  targetFieldType: true,
  mappingConfidence: true,
  mappingMethod: true,
  sampleValues: true,
  approvedBy: true,
});

export const insertSemanticIndexEntrySchema = createInsertSchema(semanticIndexEntries).pick({
  contractId: true,
  indexType: true,
  sourceId: true,
  content: true,
  metadata: true,
});

export const insertRuleValidationEventSchema = createInsertSchema(ruleValidationEvents).pick({
  ruleDefinitionId: true,
  validationType: true,
  validationResult: true,
  issues: true,
  recommendations: true,
  validatorId: true,
});

// ======================
// LEAD CAPTURE TABLES
// ======================

// Early access signups from landing page
export const earlyAccessSignups = pgTable("early_access_signups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  name: varchar("name"),
  company: varchar("company"),
  source: varchar("source").default("landing_page"),
  status: varchar("status").notNull().default("new"),
  notes: text("notes"),
  verificationToken: varchar("verification_token"),
  verificationData: jsonb("verification_data"),
  verifiedAt: timestamp("verified_at"),
  activityLog: jsonb("activity_log").default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("early_access_email_idx").on(table.email),
  index("early_access_status_idx").on(table.status),
]);

// Demo requests from pricing section
export const demoRequests = pgTable("demo_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  name: varchar("name"),
  company: varchar("company"),
  position: varchar("position"),
  phone: varchar("phone"),
  message: text("message"),
  planTier: varchar("plan_tier").notNull(),
  source: varchar("source").default("pricing_section"),
  status: varchar("status").notNull().default("new"),
  notes: text("notes"),
  verificationToken: varchar("verification_token"),
  verificationData: jsonb("verification_data"),
  verifiedAt: timestamp("verified_at"),
  activityLog: jsonb("activity_log").default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("demo_requests_email_idx").on(table.email),
  index("demo_requests_status_idx").on(table.status),
  index("demo_requests_plan_idx").on(table.planTier),
]);

// ======================
// EMAIL TEMPLATES
// ======================

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateKey: varchar("template_key").notNull().unique("email_templates_template_key_key"),
  name: varchar("name").notNull(),
  subject: varchar("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  description: text("description"),
  variables: jsonb("variables").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("email_templates_key_idx").on(table.templateKey),
]);

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

// ======================
// ERP CATALOG SYSTEM (Universal ERP Support)
// ======================

// ERP Systems - Define supported ERP vendors (Oracle, SAP, NetSuite, custom, etc.)
export const erpSystems = pgTable("erp_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // e.g., "Oracle ERP Cloud", "SAP S/4HANA", "Custom ERP"
  vendor: varchar("vendor").notNull(), // oracle, sap, microsoft, netsuite, workday, custom
  version: varchar("version"), // e.g., "21D", "2023", "v2.1"
  description: text("description"),
  category: varchar("category").default("enterprise"), // enterprise, sme, custom
  status: varchar("status").notNull().default("active"), // active, archived
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("erp_systems_vendor_idx").on(table.vendor),
  index("erp_systems_status_idx").on(table.status),
]);

// ERP Entities - Tables/objects within each ERP system (AR_CUSTOMERS, INV_ITEMS, etc.)
export const erpEntities = pgTable("erp_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: varchar("system_id").notNull().references(() => erpSystems.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(), // Display name: "Customer Master", "Item Master"
  technicalName: varchar("technical_name").notNull(), // e.g., "AR_CUSTOMERS", "INV_ITEMS"
  entityType: varchar("entity_type").notNull(), // customers, items, suppliers, invoices, etc.
  description: text("description"),
  sampleData: jsonb("sample_data"), // Example records for reference
  status: varchar("status").notNull().default("active"), // active, archived
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("erp_entities_system_idx").on(table.systemId),
  index("erp_entities_type_idx").on(table.entityType),
]);

// ERP Fields - Field definitions for each entity
export const erpFields = pgTable("erp_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull().references(() => erpEntities.id, { onDelete: 'cascade' }),
  fieldName: varchar("field_name").notNull(), // e.g., "CUSTOMER_ID", "ITEM_NUMBER"
  dataType: varchar("data_type").notNull(), // varchar, number, date, boolean, json
  constraints: jsonb("constraints"), // { maxLength: 240, required: true, pattern: "..." }
  sampleValues: text("sample_values"), // Example values: "100001, 100002, 100003"
  description: text("description"),
  isPrimaryKey: boolean("is_primary_key").default(false),
  isRequired: boolean("is_required").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("erp_fields_entity_idx").on(table.entityId),
]);

// ERP Entity Records - Store actual data records for ERP entities
export const erpEntityRecords = pgTable("erp_entity_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull().references(() => erpEntities.id, { onDelete: 'cascade' }),
  data: jsonb("data").notNull(), // Stores the actual record data as JSON
  companyId: varchar("company_id"), // Multi-tenant scoping
  businessUnitId: varchar("business_unit_id"),
  locationId: varchar("location_id"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("erp_entity_records_entity_idx").on(table.entityId),
  index("erp_entity_records_company_idx").on(table.companyId),
]);

// ======================
// ERP API INTEGRATION (iPaaS-Style Architecture)
// ======================

// Integration Connections - Store authentication and base URL per ERP instance
export const integrationConnections = pgTable("integration_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(), // e.g., "Oracle Fusion - Production"
  erpSystemId: varchar("erp_system_id").notNull().references(() => erpSystems.id),
  
  // Company Hierarchy - Tenant scoping
  companyId: varchar("company_id"), // Which company owns this connection
  businessUnitId: varchar("business_unit_id"), // Optional: specific BU
  locationId: varchar("location_id"), // Optional: specific location
  
  // Connection Configuration
  baseUrl: varchar("base_url", { length: 500 }).notNull(), // Base API URL
  authType: varchar("auth_type", { length: 50 }).notNull(), // oauth2_client, oauth2_auth_code, api_key, basic_auth
  
  // OAuth2 Configuration (encrypted values stored separately in secrets)
  clientId: varchar("client_id", { length: 200 }), // OAuth2 client ID (non-sensitive)
  tokenUrl: varchar("token_url", { length: 500 }), // OAuth2 token endpoint
  authUrl: varchar("auth_url", { length: 500 }), // OAuth2 authorization endpoint (for auth_code flow)
  scopes: varchar("scopes", { length: 500 }), // Space-separated OAuth2 scopes
  
  // API Key Configuration
  apiKeyHeader: varchar("api_key_header", { length: 100 }), // Header name for API key (e.g., "X-API-Key")
  apiKeyLocation: varchar("api_key_location", { length: 20 }).default("header"), // header, query
  
  // Basic Auth Configuration
  basicUsername: varchar("basic_username", { length: 200 }), // Username for Basic Auth
  basicPassword: varchar("basic_password", { length: 500 }), // Password for Basic Auth (should be encrypted in production)
  
  // Rate Limiting Configuration
  rateLimitRpm: integer("rate_limit_rpm").default(60), // Requests per minute limit
  rateLimitConcurrent: integer("rate_limit_concurrent").default(5), // Max concurrent requests
  
  // Retry Configuration
  retryMaxAttempts: integer("retry_max_attempts").default(3),
  retryBackoffMs: integer("retry_backoff_ms").default(1000), // Base backoff in milliseconds
  
  // Health Check Configuration
  healthCheckEndpoint: varchar("health_check_endpoint", { length: 200 }), // Lightweight endpoint for health checks
  lastHealthCheckAt: timestamp("last_health_check_at"),
  lastHealthCheckStatus: varchar("last_health_check_status", { length: 20 }), // healthy, unhealthy, unknown
  lastHealthCheckMessage: text("last_health_check_message"),
  
  // Connection Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, inactive, error
  lastConnectedAt: timestamp("last_connected_at"),
  
  // Metadata
  description: text("description"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("integration_connections_erp_idx").on(table.erpSystemId),
  index("integration_connections_company_idx").on(table.companyId),
  index("integration_connections_status_idx").on(table.status),
]);

// Integration Endpoint Templates - API endpoint configurations per entity + operation
export const integrationEndpointTemplates = pgTable("integration_endpoint_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  erpSystemId: varchar("erp_system_id").notNull().references(() => erpSystems.id, { onDelete: 'cascade' }),
  erpEntityId: varchar("erp_entity_id").references(() => erpEntities.id, { onDelete: 'cascade' }),
  
  // Operation Type
  operationType: varchar("operation_type", { length: 30 }).notNull(), // metadata, list, get, upsert, delete
  name: varchar("name", { length: 200 }).notNull(), // e.g., "Get Customers List"
  
  // HTTP Configuration
  httpMethod: varchar("http_method", { length: 10 }).notNull().default("GET"), // GET, POST, PUT, PATCH, DELETE
  pathTemplate: varchar("path_template", { length: 500 }).notNull(), // e.g., "/api/v1/customers" or "/api/v1/customers/{id}"
  
  // Query Parameters
  queryDefaults: jsonb("query_defaults"), // Default query parameters: { "limit": 100, "offset": 0 }
  
  // Pagination Configuration
  paginationType: varchar("pagination_type", { length: 30 }).default("offset"), // offset, cursor, page, none
  paginationConfig: jsonb("pagination_config"), // { offsetParam: "offset", limitParam: "limit", maxLimit: 1000 }
  
  // Request Configuration
  requestHeaders: jsonb("request_headers"), // Additional headers to send
  requestBodyTemplate: jsonb("request_body_template"), // Template for POST/PUT body
  
  // Response Configuration
  responseDataPath: varchar("response_data_path", { length: 200 }), // JSONPath to data: "data.items" or "results"
  responseTotalPath: varchar("response_total_path", { length: 200 }), // JSONPath to total count: "data.totalCount"
  responseSchema: jsonb("response_schema"), // Expected response schema for validation
  
  // Throttling Hints
  expectedResponseTimeMs: integer("expected_response_time_ms").default(5000),
  requiresCompanyScope: boolean("requires_company_scope").default(true),
  
  // Sample Data
  samplePayload: jsonb("sample_payload"), // Example request payload
  sampleResponse: jsonb("sample_response"), // Example response
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, deprecated
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("endpoint_templates_erp_idx").on(table.erpSystemId),
  index("endpoint_templates_entity_idx").on(table.erpEntityId),
  index("endpoint_templates_operation_idx").on(table.operationType),
]);

// Integration Operations - Scheduled or triggered data sync jobs
export const integrationOperations = pgTable("integration_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(), // e.g., "Nightly Customer Sync"
  
  // Connection & Template References
  connectionId: varchar("connection_id").notNull(),
  endpointTemplateId: varchar("endpoint_template_id").notNull(),
  mappingId: varchar("mapping_id").references(() => masterDataMappings.id), // Optional: mapping version to use
  mappingVersion: integer("mapping_version"), // Which version of the mapping
  
  // Company Hierarchy - Tenant scoping
  companyId: varchar("company_id"), // Which company owns this operation
  businessUnitId: varchar("business_unit_id"), // Optional: specific BU
  locationId: varchar("location_id"), // Optional: specific location
  
  // Operation Mode
  operationMode: varchar("operation_mode", { length: 30 }).notNull(), // metadata_sync, data_import, data_export
  
  // Scheduling
  schedule: varchar("schedule", { length: 100 }), // Cron expression: "0 2 * * *" (2 AM daily), null = manual
  isEnabled: boolean("is_enabled").notNull().default(true),
  
  // Incremental Sync Configuration
  highWatermarkField: varchar("high_watermark_field", { length: 100 }), // Field for incremental sync: "lastModifiedDate"
  lastHighWatermark: varchar("last_high_watermark", { length: 200 }), // Last synced value
  lastCursor: varchar("last_cursor", { length: 500 }), // For cursor-based pagination
  
  // Dry Run Configuration
  dryRunAllowed: boolean("dry_run_allowed").notNull().default(true),
  requiresApproval: boolean("requires_approval").notNull().default(false), // Require approval before commit
  
  // Execution Status
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: varchar("last_run_status", { length: 20 }), // success, failed, partial
  lastRunRecordsProcessed: integer("last_run_records_processed"),
  lastRunRecordsFailed: integer("last_run_records_failed"),
  lastRunDurationMs: integer("last_run_duration_ms"),
  lastRunError: text("last_run_error"),
  
  // Next Run
  nextRunAt: timestamp("next_run_at"),
  
  // Retry Policy
  retryPolicy: jsonb("retry_policy"), // { maxAttempts: 3, backoffMs: 1000, exponential: true }
  
  // Metadata
  description: text("description"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("integration_operations_connection_idx").on(table.connectionId),
  index("integration_operations_template_idx").on(table.endpointTemplateId),
  index("integration_operations_company_idx").on(table.companyId),
  index("integration_operations_mode_idx").on(table.operationMode),
  index("integration_operations_schedule_idx").on(table.isEnabled),
  foreignKey({
    columns: [table.connectionId],
    foreignColumns: [integrationConnections.id],
    name: "integration_operations_connection_id_integration_connections_id",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.endpointTemplateId],
    foreignColumns: [integrationEndpointTemplates.id],
    name: "integration_operations_endpoint_template_id_integration_endpoin",
  }).onDelete("no action"),
]);

// Integration Health Events - Connection monitoring and audit trail
export const integrationHealthEvents = pgTable("integration_health_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").notNull(),
  
  // Health Check Result
  status: varchar("status", { length: 20 }).notNull(), // healthy, unhealthy, timeout, error
  statusCode: integer("status_code"), // HTTP status code if applicable
  message: text("message"),
  
  // Performance Metrics
  latencyMs: integer("latency_ms"), // Response time in milliseconds
  rateLimitRemaining: integer("rate_limit_remaining"), // From X-RateLimit-Remaining header
  rateLimitReset: timestamp("rate_limit_reset"), // When rate limit resets
  
  // Event Metadata
  eventType: varchar("event_type", { length: 30 }).notNull(), // health_check, api_call, auth_refresh, error
  details: jsonb("details"), // Additional event details
  
  checkedAt: timestamp("checked_at").defaultNow(),
}, (table) => [
  index("health_events_connection_idx").on(table.connectionId),
  index("health_events_status_idx").on(table.status),
  index("health_events_type_idx").on(table.eventType),
  index("health_events_checked_idx").on(table.checkedAt),
  foreignKey({
    columns: [table.connectionId],
    foreignColumns: [integrationConnections.id],
    name: "integration_health_events_connection_id_integration_connections",
  }).onDelete("cascade"),
]);

// LicenseIQ API Endpoints - Outbound API configuration for LicenseIQ entities
export const licenseiqApiEndpoints = pgTable("licenseiq_api_endpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull().references(() => licenseiqEntities.id, { onDelete: 'cascade' }),
  
  // Operation Type
  operationType: varchar("operation_type", { length: 30 }).notNull(), // list, get, create, update, delete
  name: varchar("name", { length: 200 }).notNull(), // e.g., "Get Sales Data"
  
  // HTTP Configuration
  httpMethod: varchar("http_method", { length: 10 }).notNull().default("GET"),
  pathTemplate: varchar("path_template", { length: 500 }).notNull(), // e.g., "/api/v1/sales-data" or "/api/v1/sales-data/{id}"
  
  // Query Parameters
  queryDefaults: jsonb("query_defaults"),
  
  // Pagination Configuration
  paginationType: varchar("pagination_type", { length: 30 }).default("offset"),
  paginationConfig: jsonb("pagination_config"),
  
  // Request/Response Configuration
  requestBodySchema: jsonb("request_body_schema"),
  responseDataPath: varchar("response_data_path", { length: 200 }),
  responseSchema: jsonb("response_schema"),
  
  // Sample Data
  sampleRequest: jsonb("sample_request"),
  sampleResponse: jsonb("sample_response"),
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("active"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("licenseiq_api_entity_idx").on(table.entityId),
  index("licenseiq_api_operation_idx").on(table.operationType),
]);

// ======================
// MASTER DATA MAPPING (ERP INTEGRATION)
// ======================

// AI-driven master data mapping for ERP integrations with company hierarchy and versioning
export const masterDataMappings = pgTable("master_data_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mappingName: varchar("mapping_name").notNull(), // e.g., "Oracle ERP - Customers"
  erpSystemId: varchar("erp_system_id").references(() => erpSystems.id), // FK to erp_systems table
  erpSystem: varchar("erp_system").notNull(), // ERP system name (e.g., "Oracle EBS 12.2") - kept for backward compatibility
  entityType: varchar("entity_type").notNull(), // Entity type name (e.g., "Customers", "Items")
  licenseiqEntityId: varchar("licenseiq_entity_id"), // FK to licenseiq_entities
  
  // Company Hierarchy - Tenant scoping
  companyId: varchar("company_id").references(() => companies.id), // Which company owns this mapping
  businessUnitId: varchar("business_unit_id").references(() => businessUnits.id), // Optional: specific BU
  locationId: varchar("location_id").references(() => locations.id), // Optional: specific location
  
  // Versioning
  version: integer("version").notNull().default(1), // Version number (1, 2, 3...)
  parentMappingId: varchar("parent_mapping_id"), // Reference to previous version (self-FK)
  
  // Legacy field - kept for backward compatibility
  customerId: varchar("customer_id").references(() => contracts.id), // DEPRECATED: Use companyId instead
  
  sourceSchema: jsonb("source_schema").notNull(), // ERP schema structure (source)
  targetSchema: jsonb("target_schema").notNull(), // LicenseIQ schema structure (target)
  mappingResults: jsonb("mapping_results").notNull(), // Array of {source_field, target_field, transformation_rule, confidence}
  status: varchar("status").notNull().default("draft"), // draft, approved, deprecated, archived
  aiModel: varchar("ai_model").default("llama-3.3-70b-versatile"), // Track which AI model was used
  aiConfidence: real("ai_confidence"), // Overall AI confidence score (0-1)
  createdBy: varchar("created_by").notNull().references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id), // Who approved this mapping
  approvedAt: timestamp("approved_at"), // When was it approved
  notes: text("notes"), // Additional mapping notes or transformation logic
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("master_data_mappings_customer_idx").on(table.customerId),
  index("master_data_mappings_erp_idx").on(table.erpSystem),
  index("master_data_mappings_entity_idx").on(table.entityType),
  index("master_data_mappings_status_idx").on(table.status),
  index("master_data_mappings_company_idx").on(table.companyId),
  index("master_data_mappings_bu_idx").on(table.businessUnitId),
  index("master_data_mappings_loc_idx").on(table.locationId),
  index("master_data_mappings_version_idx").on(table.version),
  index("master_data_mappings_erp_system_id_idx").on(table.erpSystemId),
  foreignKey({
    columns: [table.licenseiqEntityId],
    foreignColumns: [licenseiqEntities.id],
    name: "master_data_mappings_licenseiq_entity_id_licenseiq_entities_id_",
  }).onDelete("no action"),
]);

// Data import jobs - Track ERP data import/ingestion operations with company hierarchy
export const dataImportJobs = pgTable("data_import_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mappingId: varchar("mapping_id").notNull().references(() => masterDataMappings.id, { onDelete: 'cascade' }),
  mappingVersion: integer("mapping_version"), // Which version of mapping was used
  
  // Source Reference - Links to configured import source (optional for legacy imports)
  sourceId: varchar("source_id"), // Links to data_import_sources (no FK due to circular reference)
  
  // Connection & Template References - Links to API configuration
  connectionId: varchar("connection_id").references(() => integrationConnections.id), // Which connection to use for API calls
  endpointTemplateId: varchar("endpoint_template_id"), // Which API template to use
  
  // Company Hierarchy - Tenant scoping (required for data isolation)
  companyId: varchar("company_id").references(() => companies.id), // Which company owns this import job
  businessUnitId: varchar("business_unit_id").references(() => businessUnits.id), // Optional: specific BU
  locationId: varchar("location_id").references(() => locations.id), // Optional: specific location
  
  // ERP Source Info
  erpSystemId: varchar("erp_system_id").references(() => erpSystems.id), // Source ERP system
  entityType: varchar("entity_type"), // Which entity was imported (Customers, Items, etc.)
  
  // Legacy field - kept for backward compatibility
  customerId: varchar("customer_id").references(() => contracts.id), // DEPRECATED: Use companyId instead
  
  jobName: varchar("job_name").notNull(), // e.g., "Oracle Customers Import - 2025-11-04"
  jobType: varchar("job_type").notNull().default("import"), // import, dry_run, validation
  uploadMeta: jsonb("upload_meta"), // { fileName, fileSize, recordCount, sourceType: 'file'|'api', etc. }
  status: varchar("status").notNull().default("pending"), // pending, processing, completed, failed, cancelled
  recordsTotal: integer("records_total").default(0),
  recordsProcessed: integer("records_processed").default(0),
  recordsFailed: integer("records_failed").default(0),
  recordsSkipped: integer("records_skipped").default(0), // Skipped due to duplicates or filters
  errorLog: jsonb("error_log"), // Array of error messages
  processingLog: jsonb("processing_log"), // Detailed processing steps
  createdBy: varchar("created_by").notNull().references(() => users.id),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("data_import_jobs_mapping_idx").on(table.mappingId),
  index("data_import_jobs_customer_idx").on(table.customerId),
  index("data_import_jobs_status_idx").on(table.status),
  index("data_import_jobs_company_idx").on(table.companyId),
  index("data_import_jobs_bu_idx").on(table.businessUnitId),
  index("data_import_jobs_loc_idx").on(table.locationId),
  index("data_import_jobs_erp_system_idx").on(table.erpSystemId),
  index("data_import_jobs_job_type_idx").on(table.jobType),
  index("data_import_jobs_connection_idx").on(table.connectionId),
  index("data_import_jobs_template_idx").on(table.endpointTemplateId),
  index("data_import_jobs_source_idx").on(table.sourceId),
  foreignKey({
    columns: [table.endpointTemplateId],
    foreignColumns: [integrationEndpointTemplates.id],
    name: "data_import_jobs_endpoint_template_id_integration_endpoint_temp",
  }).onDelete("no action"),
]);

// Imported ERP records - Stores actual imported data with vector embeddings and company hierarchy
export const importedErpRecords = pgTable("imported_erp_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => dataImportJobs.id, { onDelete: 'cascade' }),
  mappingId: varchar("mapping_id").notNull().references(() => masterDataMappings.id),
  mappingVersion: integer("mapping_version"), // Which version of mapping was used
  
  // Company Hierarchy - Tenant scoping (required for data isolation)
  companyId: varchar("company_id").references(() => companies.id), // Which company owns this record
  businessUnitId: varchar("business_unit_id").references(() => businessUnits.id), // Optional: specific BU
  locationId: varchar("location_id").references(() => locations.id), // Optional: specific location
  
  // LicenseIQ Entity Reference
  licenseiqEntityId: varchar("licenseiq_entity_id"), // Which LicenseIQ entity this maps to
  licenseiqRecordId: varchar("licenseiq_record_id"), // Link to canonical record if committed
  
  // Legacy field - kept for backward compatibility
  customerId: varchar("customer_id").references(() => contracts.id), // DEPRECATED: Use companyId instead
  
  sourceRecord: jsonb("source_record").notNull(), // Original ERP data (source)
  targetRecord: jsonb("target_record").notNull(), // Mapped LicenseIQ data (target)
  recordStatus: varchar("record_status").notNull().default("staged"), // staged, committed, failed, skipped
  validationErrors: jsonb("validation_errors"), // Array of validation error messages
  embedding: vector("embedding", { dimensions: 384 }), // HuggingFace MiniLM embeddings
  metadata: jsonb("metadata"), // { primaryKey, recordType, tags, sourceRowNumber, etc. }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("imported_records_job_idx").on(table.jobId),
  index("imported_records_mapping_idx").on(table.mappingId),
  index("imported_records_customer_idx").on(table.customerId),
  index("imported_records_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  index("imported_records_company_idx").on(table.companyId),
  index("imported_records_bu_idx").on(table.businessUnitId),
  index("imported_records_loc_idx").on(table.locationId),
  index("imported_records_status_idx").on(table.recordStatus),
  index("imported_records_licenseiq_entity_idx").on(table.licenseiqEntityId),
  foreignKey({
    columns: [table.licenseiqEntityId],
    foreignColumns: [licenseiqEntities.id],
    name: "imported_erp_records_licenseiq_entity_id_licenseiq_entities_id_",
  }).onDelete("no action"),
  foreignKey({
    columns: [table.licenseiqRecordId],
    foreignColumns: [licenseiqEntityRecords.id],
    name: "imported_erp_records_licenseiq_record_id_licenseiq_entity_recor",
  }).onDelete("no action"),
]);

// Data Import Sources - Configurable data sources (file/API) with filters and scheduling
export const dataImportSources = pgTable("data_import_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "Oracle Customers Daily Sync"
  description: text("description"),
  
  // Source Type
  sourceType: varchar("source_type").notNull().default("file"), // file, api
  
  // API Configuration (when sourceType = 'api')
  connectionId: varchar("connection_id").references(() => integrationConnections.id), // Which ERP connection
  endpointTemplateId: varchar("endpoint_template_id"), // Which API endpoint
  
  // Mapping Configuration
  mappingId: varchar("mapping_id").references(() => masterDataMappings.id), // Default mapping to use
  erpSystemId: varchar("erp_system_id").references(() => erpSystems.id), // Source ERP system
  entityType: varchar("entity_type"), // Which entity to import (Customers, Items, etc.)
  licenseiqEntityId: varchar("licenseiq_entity_id"), // Target LicenseIQ entity
  
  // Company Hierarchy - Tenant scoping
  companyId: varchar("company_id").references(() => companies.id), // Which company owns this source
  businessUnitId: varchar("business_unit_id").references(() => businessUnits.id), // Optional: specific BU
  locationId: varchar("location_id").references(() => locations.id), // Optional: specific location
  
  // Filter Configuration (applies to both file and API imports)
  filters: jsonb("filters"), // { dateRange: {from, to}, status: [], fields: [{field, operator, value}], incremental: {field, lastValue} }
  
  // Scheduling Configuration
  scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
  scheduleType: varchar("schedule_type"), // manual, hourly, daily, weekly, custom
  scheduleCron: varchar("schedule_cron"), // Cron expression for custom schedules
  lastRunAt: timestamp("last_run_at"), // When was last successful run
  nextRunAt: timestamp("next_run_at"), // When is next scheduled run
  
  // Import Options
  importOptions: jsonb("import_options"), // { dryRunFirst: true, skipDuplicates: true, validateOnly: false, batchSize: 100 }
  
  // Status & Metadata
  status: varchar("status").notNull().default("active"), // active, paused, disabled, error
  lastError: text("last_error"), // Last error message if any
  successCount: integer("success_count").default(0), // Total successful runs
  failureCount: integer("failure_count").default(0), // Total failed runs
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("data_import_sources_company_idx").on(table.companyId),
  index("data_import_sources_bu_idx").on(table.businessUnitId),
  index("data_import_sources_loc_idx").on(table.locationId),
  index("data_import_sources_type_idx").on(table.sourceType),
  index("data_import_sources_status_idx").on(table.status),
  index("data_import_sources_connection_idx").on(table.connectionId),
  index("data_import_sources_mapping_idx").on(table.mappingId),
  index("data_import_sources_erp_idx").on(table.erpSystemId),
  foreignKey({
    columns: [table.endpointTemplateId],
    foreignColumns: [integrationEndpointTemplates.id],
    name: "data_import_sources_endpoint_template_id_integration_endpoint_t",
  }).onDelete("no action"),
  foreignKey({
    columns: [table.licenseiqEntityId],
    foreignColumns: [licenseiqEntities.id],
    name: "data_import_sources_licenseiq_entity_id_licenseiq_entities_id_f",
  }).onDelete("no action"),
]);

// ========================================
// LICENSEIQ SCHEMA CATALOG
// ========================================

// LicenseIQ Entities - Defines standard entities in the LicenseIQ platform
export const licenseiqEntities = pgTable("licenseiq_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Sales Data", "Contracts", "Fee Rules"
  technicalName: varchar("technical_name", { length: 100 }).notNull().unique("licenseiq_entities_technical_name_key"), // e.g., "sales_data", "contracts"
  description: text("description"), // Description of the entity
  category: varchar("category", { length: 50 }), // e.g., "Transactional", "Master Data", "Rules"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// LicenseIQ Fields - Defines standard fields for each entity
export const licenseiqFields = pgTable("licenseiq_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull().references(() => licenseiqEntities.id, { onDelete: 'cascade' }),
  fieldName: varchar("field_name", { length: 100 }).notNull(), // e.g., "productName", "quantity"
  dataType: varchar("data_type", { length: 50 }).notNull(), // e.g., "string", "number", "date", "boolean"
  description: text("description"), // Description of the field
  isRequired: boolean("is_required").notNull().default(false), // Is this field mandatory
  defaultValue: varchar("default_value"), // Default value if any
  validationRules: text("validation_rules"), // JSON string with validation rules
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("licenseiq_fields_entity_idx").on(table.entityId),
]);

// ======================
// MASTER DATA MANAGEMENT
// ======================

// Companies table
export const companies = pgTable("companies", {
  id: varchar("company_id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: varchar("company_name", { length: 500 }).notNull(),
  companyDescr: text("company_descr"),
  address1: varchar("address1", { length: 500 }),
  address2: varchar("address2", { length: 500 }),
  address3: varchar("address3", { length: 500 }),
  city: varchar("city", { length: 200 }),
  stateProvince: varchar("state_province", { length: 200 }),
  county: varchar("county", { length: 200 }),
  country: varchar("country", { length: 200 }),
  contactPerson: varchar("contact_person", { length: 300 }),
  contactEmail: varchar("contact_email", { length: 300 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  contactPreference: varchar("contact_preference", { length: 50 }), // email, phone, both
  
  // Audit columns
  status: varchar("status", { length: 1 }).notNull().default("A"), // A=Active, I=Inactive, D=Deleted
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  creationDate: timestamp("creation_date").notNull().defaultNow(),
  lastUpdatedBy: varchar("last_updated_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastUpdateDate: timestamp("last_update_date").notNull().defaultNow(),
}, (table) => [
  index("companies_status_idx").on(table.status),
  index("companies_name_idx").on(table.companyName),
]);

// Business Units table
export const businessUnits = pgTable("business_units", {
  id: varchar("org_id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  orgName: varchar("org_name", { length: 500 }).notNull(),
  orgDescr: text("org_descr"),
  address1: varchar("address1", { length: 500 }),
  contactPerson: varchar("contact_person", { length: 300 }),
  contactEmail: varchar("contact_email", { length: 300 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  contactPreference: varchar("contact_preference", { length: 50 }),
  
  // Audit columns
  status: varchar("status", { length: 1 }).notNull().default("A"),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  creationDate: timestamp("creation_date").notNull().defaultNow(),
  lastUpdatedBy: varchar("last_updated_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastUpdateDate: timestamp("last_update_date").notNull().defaultNow(),
}, (table) => [
  index("business_units_company_idx").on(table.companyId),
  index("business_units_status_idx").on(table.status),
  index("business_units_name_idx").on(table.orgName),
]);

// Locations table
export const locations = pgTable("locations", {
  id: varchar("loc_id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  orgId: varchar("org_id").notNull().references(() => businessUnits.id, { onDelete: 'cascade' }),
  locName: varchar("loc_name", { length: 500 }).notNull(),
  locDescr: text("loc_descr"),
  address1: varchar("address1", { length: 500 }),
  contactPerson: varchar("contact_person", { length: 300 }),
  contactEmail: varchar("contact_email", { length: 300 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  contactPreference: varchar("contact_preference", { length: 50 }),
  
  // Audit columns
  status: varchar("status", { length: 1 }).notNull().default("A"),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  creationDate: timestamp("creation_date").notNull().defaultNow(),
  lastUpdatedBy: varchar("last_updated_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastUpdateDate: timestamp("last_update_date").notNull().defaultNow(),
}, (table) => [
  index("locations_company_idx").on(table.companyId),
  index("locations_org_idx").on(table.orgId),
  index("locations_status_idx").on(table.status),
  index("locations_name_idx").on(table.locName),
]);

// User Organization Roles - Links users to organizations/locations with specific roles
export const userOrganizationRoles = pgTable("user_organization_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  businessUnitId: varchar("business_unit_id"), // Optional - user can be assigned to company level
  locationId: varchar("location_id").references(() => locations.id, { onDelete: 'cascade' }), // Optional - user can be assigned to specific location
  
  // Role for this specific organization/location context
  role: varchar("role").notNull().default("viewer"), // owner, admin, editor, viewer, auditor
  
  // Audit columns
  status: varchar("status", { length: 1 }).notNull().default("A"), // A=Active, I=Inactive
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  creationDate: timestamp("creation_date").notNull().defaultNow(),
  lastUpdatedBy: varchar("last_updated_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastUpdateDate: timestamp("last_update_date").notNull().defaultNow(),
}, (table) => [
  index("user_org_roles_user_idx").on(table.userId),
  index("user_org_roles_company_idx").on(table.companyId),
  index("user_org_roles_bu_idx").on(table.businessUnitId),
  index("user_org_roles_location_idx").on(table.locationId),
  index("user_org_roles_status_idx").on(table.status),
  // Unique constraint: One role per user per organization path
  unique("user_org_unique").on(table.userId, table.companyId, table.businessUnitId, table.locationId),
  foreignKey({
    columns: [table.businessUnitId],
    foreignColumns: [businessUnits.id],
    name: "user_organization_roles_business_unit_id_business_units_org_id_",
  }).onDelete("cascade"),
]);

// User Active Context - Stores the current active organization context per user (session-level)
export const userActiveContext = pgTable("user_active_context", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique("user_active_context_user_id_key").references(() => users.id, { onDelete: 'cascade' }), // One active context per user
  activeOrgRoleId: varchar("active_org_role_id").notNull(), // Current active organization role
  lastSwitched: timestamp("last_switched").notNull().defaultNow(), // When user last switched context
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("user_active_ctx_user_idx").on(table.userId),
  index("user_active_ctx_role_idx").on(table.activeOrgRoleId),
  foreignKey({
    columns: [table.activeOrgRoleId],
    foreignColumns: [userOrganizationRoles.id],
    name: "user_active_context_active_org_role_id_user_organization_roles_",
  }).onDelete("cascade"),
]);

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  creationDate: true,
  lastUpdateDate: true,
});

export const insertBusinessUnitSchema = createInsertSchema(businessUnits).omit({
  id: true,
  creationDate: true,
  lastUpdateDate: true,
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  creationDate: true,
  lastUpdateDate: true,
});

export const insertUserOrganizationRoleSchema = createInsertSchema(userOrganizationRoles).omit({
  id: true,
  creationDate: true,
  lastUpdateDate: true,
});

export const insertUserActiveContextSchema = createInsertSchema(userActiveContext).omit({
  id: true,
  updatedAt: true,
});

// Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type BusinessUnit = typeof businessUnits.$inferSelect;
export type InsertBusinessUnit = z.infer<typeof insertBusinessUnitSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type UserOrganizationRole = typeof userOrganizationRoles.$inferSelect;
export type InsertUserOrganizationRole = z.infer<typeof insertUserOrganizationRoleSchema>;
export type UserActiveContext = typeof userActiveContext.$inferSelect;
export type InsertUserActiveContext = z.infer<typeof insertUserActiveContextSchema>;


// LicenseIQ Entity Records - Stores actual data for each entity (flexible schema)
export const licenseiqEntityRecords = pgTable("licenseiq_entity_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull().references(() => licenseiqEntities.id, { onDelete: 'cascade' }),
  recordData: jsonb("record_data").notNull(), // Flexible JSON data matching the entity's fields
  
  // Organization Hierarchy - Records must be linked to company hierarchy
  grpId: varchar("grp_id").notNull().references(() => companies.id, { onDelete: 'restrict' }), // Company ID - MANDATORY
  orgId: varchar("org_id").notNull().references(() => businessUnits.id, { onDelete: 'restrict' }), // Business Unit ID - MANDATORY
  locId: varchar("loc_id").notNull().references(() => locations.id, { onDelete: 'restrict' }), // Location ID - MANDATORY
  
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("licenseiq_records_entity_idx").on(table.entityId),
  index("licenseiq_records_grp_idx").on(table.grpId),
  index("licenseiq_records_org_idx").on(table.orgId),
  index("licenseiq_records_loc_idx").on(table.locId),
]);

// ERP to LicenseIQ Field Mappings - Maps ERP fields to LicenseIQ schema fields
export const erpLicenseiqFieldMappings = pgTable("erp_licenseiq_field_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  erpSystemId: varchar("erp_system_id").notNull().references(() => erpSystems.id, { onDelete: 'cascade' }),
  erpEntityId: varchar("erp_entity_id").notNull().references(() => erpEntities.id, { onDelete: 'cascade' }),
  erpFieldId: varchar("erp_field_id").notNull().references(() => erpFields.id, { onDelete: 'cascade' }),
  licenseiqEntityId: varchar("licenseiq_entity_id").notNull(),
  licenseiqFieldId: varchar("licenseiq_field_id").notNull(),
  mappingType: varchar("mapping_type", { length: 50 }).default("direct"), // direct, transform, derived
  transformExpression: text("transform_expression"), // Optional transformation logic
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("erp_liq_mapping_erp_idx").on(table.erpSystemId, table.erpFieldId),
  index("erp_liq_mapping_liq_idx").on(table.licenseiqEntityId, table.licenseiqFieldId),
  foreignKey({
    columns: [table.licenseiqEntityId],
    foreignColumns: [licenseiqEntities.id],
    name: "erp_licenseiq_field_mappings_licenseiq_entity_id_licenseiq_enti",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.licenseiqFieldId],
    foreignColumns: [licenseiqFields.id],
    name: "erp_licenseiq_field_mappings_licenseiq_field_id_licenseiq_field",
  }).onDelete("cascade"),
]);

export const insertErpLicenseiqFieldMappingSchema = createInsertSchema(erpLicenseiqFieldMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ErpLicenseiqFieldMapping = typeof erpLicenseiqFieldMappings.$inferSelect;
export type InsertErpLicenseiqFieldMapping = z.infer<typeof insertErpLicenseiqFieldMappingSchema>;

// Insert schemas for lead capture
export const insertEarlyAccessSignupSchema = createInsertSchema(earlyAccessSignups).pick({
  email: true,
  name: true,
  company: true,
  source: true,
});

export const insertDemoRequestSchema = createInsertSchema(demoRequests).pick({
  email: true,
  planTier: true,
  source: true,
});

// Insert schemas for ERP Catalog
export const insertErpSystemSchema = createInsertSchema(erpSystems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertErpEntitySchema = createInsertSchema(erpEntities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertErpFieldSchema = createInsertSchema(erpFields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertErpEntityRecordSchema = createInsertSchema(erpEntityRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  createdBy: z.string().optional(), // Set by route handler from req.user
  companyId: z.string().optional().nullable(),
  businessUnitId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
});

// Insert schemas for Integration API
export const insertIntegrationConnectionSchema = createInsertSchema(integrationConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastHealthCheckAt: true,
  lastConnectedAt: true,
});

export const insertIntegrationEndpointTemplateSchema = createInsertSchema(integrationEndpointTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationOperationSchema = createInsertSchema(integrationOperations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
  nextRunAt: true,
});

export const insertIntegrationHealthEventSchema = createInsertSchema(integrationHealthEvents).omit({
  id: true,
  checkedAt: true,
});

export const insertLicenseiqApiEndpointSchema = createInsertSchema(licenseiqApiEndpoints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schema for master data mappings
export const insertMasterDataMappingSchema = createInsertSchema(masterDataMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

// Insert schema for data import jobs
export const insertDataImportJobSchema = createInsertSchema(dataImportJobs).omit({
  id: true,
  createdAt: true,
});

// Insert schema for imported ERP records
export const insertImportedErpRecordSchema = createInsertSchema(importedErpRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schema for data import sources
export const insertDataImportSourceSchema = createInsertSchema(dataImportSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  successCount: true,
  failureCount: true,
});

// Insert schemas for LicenseIQ Catalog
export const insertLicenseiqEntitySchema = createInsertSchema(licenseiqEntities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLicenseiqFieldSchema = createInsertSchema(licenseiqFields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLicenseiqEntityRecordSchema = createInsertSchema(licenseiqEntityRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ======================
// TYPES FOR NEW TABLES
// ======================

export type ContractDocument = typeof contractDocuments.$inferSelect;
export type InsertContractDocument = z.infer<typeof insertContractDocumentSchema>;
export type ContractGraphNode = typeof contractGraphNodes.$inferSelect;
export type InsertContractGraphNode = z.infer<typeof insertContractGraphNodeSchema>;
export type ContractGraphEdge = typeof contractGraphEdges.$inferSelect;
export type InsertContractGraphEdge = z.infer<typeof insertContractGraphEdgeSchema>;
export type ExtractionRun = typeof extractionRuns.$inferSelect;
export type InsertExtractionRun = z.infer<typeof insertExtractionRunSchema>;
export type RuleDefinition = typeof ruleDefinitions.$inferSelect;
export type InsertRuleDefinition = z.infer<typeof insertRuleDefinitionSchema>;
export type RuleNodeDefinition = typeof ruleNodeDefinitions.$inferSelect;
export type InsertRuleNodeDefinition = z.infer<typeof insertRuleNodeDefinitionSchema>;
export type HumanReviewTask = typeof humanReviewTasks.$inferSelect;
export type InsertHumanReviewTask = z.infer<typeof insertHumanReviewTaskSchema>;
export type SalesFieldMapping = typeof salesFieldMappings.$inferSelect;
export type InsertSalesFieldMapping = z.infer<typeof insertSalesFieldMappingSchema>;
export type SemanticIndexEntry = typeof semanticIndexEntries.$inferSelect;
export type InsertSemanticIndexEntry = z.infer<typeof insertSemanticIndexEntrySchema>;
export type RuleValidationEvent = typeof ruleValidationEvents.$inferSelect;
export type InsertRuleValidationEvent = z.infer<typeof insertRuleValidationEventSchema>;
export type EarlyAccessSignup = typeof earlyAccessSignups.$inferSelect;
export type InsertEarlyAccessSignup = z.infer<typeof insertEarlyAccessSignupSchema>;
export type DemoRequest = typeof demoRequests.$inferSelect;
export type InsertDemoRequest = z.infer<typeof insertDemoRequestSchema>;
export type ErpSystem = typeof erpSystems.$inferSelect;
export type InsertErpSystem = z.infer<typeof insertErpSystemSchema>;
export type ErpEntity = typeof erpEntities.$inferSelect;
export type InsertErpEntity = z.infer<typeof insertErpEntitySchema>;
export type ErpField = typeof erpFields.$inferSelect;
export type InsertErpField = z.infer<typeof insertErpFieldSchema>;
export type ErpEntityRecord = typeof erpEntityRecords.$inferSelect;
export type InsertErpEntityRecord = z.infer<typeof insertErpEntityRecordSchema>;
export type IntegrationConnection = typeof integrationConnections.$inferSelect;
export type InsertIntegrationConnection = z.infer<typeof insertIntegrationConnectionSchema>;
export type IntegrationEndpointTemplate = typeof integrationEndpointTemplates.$inferSelect;
export type InsertIntegrationEndpointTemplate = z.infer<typeof insertIntegrationEndpointTemplateSchema>;
export type IntegrationOperation = typeof integrationOperations.$inferSelect;
export type InsertIntegrationOperation = z.infer<typeof insertIntegrationOperationSchema>;
export type IntegrationHealthEvent = typeof integrationHealthEvents.$inferSelect;
export type InsertIntegrationHealthEvent = z.infer<typeof insertIntegrationHealthEventSchema>;
export type LicenseiqApiEndpoint = typeof licenseiqApiEndpoints.$inferSelect;
export type InsertLicenseiqApiEndpoint = z.infer<typeof insertLicenseiqApiEndpointSchema>;
export type MasterDataMapping = typeof masterDataMappings.$inferSelect;
export type InsertMasterDataMapping = z.infer<typeof insertMasterDataMappingSchema>;
export type DataImportJob = typeof dataImportJobs.$inferSelect;
export type InsertDataImportJob = z.infer<typeof insertDataImportJobSchema>;
export type ImportedErpRecord = typeof importedErpRecords.$inferSelect;
export type InsertImportedErpRecord = z.infer<typeof insertImportedErpRecordSchema>;
export type DataImportSource = typeof dataImportSources.$inferSelect;
export type InsertDataImportSource = z.infer<typeof insertDataImportSourceSchema>;
export type LicenseiqEntity = typeof licenseiqEntities.$inferSelect;
export type InsertLicenseiqEntity = z.infer<typeof insertLicenseiqEntitySchema>;
export type LicenseiqField = typeof licenseiqFields.$inferSelect;
export type InsertLicenseiqField = z.infer<typeof insertLicenseiqFieldSchema>;
export type LicenseiqEntityRecord = typeof licenseiqEntityRecords.$inferSelect;
export type InsertLicenseiqEntityRecord = z.infer<typeof insertLicenseiqEntityRecordSchema>;

// ======================
// ROLES MANAGEMENT
// ======================

export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleName: varchar("role_name").notNull().unique("roles_role_name_key"), // Unique role identifier (e.g., 'admin', 'editor', 'custom_analyst'). Constraint name pinned to the existing DB name (Postgres' default `_key` suffix from when it was first created) so drizzle-kit doesn't try to ADD a redundant `roles_role_name_unique` constraint and hang on its arrow-key truncation prompt during post-merge.
  displayName: varchar("display_name").notNull(), // User-friendly name
  description: text("description"), // Role description
  isSystemRole: boolean("is_system_role").default(false), // Prevent deletion of system roles (admin, owner, etc.)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("roles_name_idx").on(table.roleName),
]);

// Insert schema for roles
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for roles
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

// ======================
// NAVIGATION PERMISSIONS
// ======================

export const navigationPermissions = pgTable("navigation_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemKey: varchar("item_key").notNull().unique("navigation_permissions_item_key_key"), // Unique identifier for nav item (e.g., 'dashboard', 'contracts')
  itemName: varchar("item_name").notNull(), // Display name
  href: varchar("href").notNull(), // Route path
  iconName: varchar("icon_name"), // Icon identifier
  defaultRoles: jsonb("default_roles").$type<string[]>().default([]), // Default roles that can see this item
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("nav_perm_item_key_idx").on(table.itemKey),
]);

export const roleNavigationPermissions = pgTable("role_navigation_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: varchar("role").notNull(), // Role name (admin, owner, user, etc.)
  navItemKey: varchar("nav_item_key").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("role_nav_perm_role_idx").on(table.role),
  index("role_nav_perm_item_idx").on(table.navItemKey),
  foreignKey({
    columns: [table.navItemKey],
    foreignColumns: [navigationPermissions.itemKey],
    name: "role_navigation_permissions_nav_item_key_navigation_permissions",
  }).onDelete("cascade"),
]);

export const userNavigationOverrides = pgTable("user_navigation_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  navItemKey: varchar("nav_item_key").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("user_nav_override_user_idx").on(table.userId),
  index("user_nav_override_item_idx").on(table.navItemKey),
  foreignKey({
    columns: [table.navItemKey],
    foreignColumns: [navigationPermissions.itemKey],
    name: "user_navigation_overrides_nav_item_key_navigation_permissions_i",
  }).onDelete("cascade"),
]);

// Insert schemas for navigation permissions
export const insertNavigationPermissionSchema = createInsertSchema(navigationPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleNavigationPermissionSchema = createInsertSchema(roleNavigationPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserNavigationOverrideSchema = createInsertSchema(userNavigationOverrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for navigation permissions
export type NavigationPermission = typeof navigationPermissions.$inferSelect;
export type InsertNavigationPermission = z.infer<typeof insertNavigationPermissionSchema>;
export type RoleNavigationPermission = typeof roleNavigationPermissions.$inferSelect;
export type InsertRoleNavigationPermission = z.infer<typeof insertRoleNavigationPermissionSchema>;
export type UserNavigationOverride = typeof userNavigationOverrides.$inferSelect;
export type InsertUserNavigationOverride = z.infer<typeof insertUserNavigationOverrideSchema>;

// ==================================
// NAVIGATION CATEGORIES (Tree Structure)
// ==================================

export const navigationCategories = pgTable("navigation_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryKey: varchar("category_key").notNull().unique("navigation_categories_category_key_key"), // Unique identifier (e.g., 'contract_mgmt', 'analytics')
  categoryName: varchar("category_name").notNull(), // Display name (e.g., 'Contract Management')
  iconName: varchar("icon_name"), // Icon for category header
  description: text("description"), // Optional description
  defaultSortOrder: integer("default_sort_order").default(0), // Order in sidebar
  isCollapsible: boolean("is_collapsible").default(true), // Can be collapsed?
  defaultExpanded: boolean("default_expanded").default(true), // Expanded by default?
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("nav_cat_key_idx").on(table.categoryKey),
  index("nav_cat_sort_idx").on(table.defaultSortOrder),
]);

export const navigationItemCategories = pgTable("navigation_item_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  navItemKey: varchar("nav_item_key").notNull(),
  categoryKey: varchar("category_key").notNull(),
  sortOrder: integer("sort_order").default(0), // Order within category
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("nav_item_cat_item_idx").on(table.navItemKey),
  index("nav_item_cat_cat_idx").on(table.categoryKey),
  foreignKey({
    columns: [table.navItemKey],
    foreignColumns: [navigationPermissions.itemKey],
    name: "navigation_item_categories_nav_item_key_navigation_permissions_",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.categoryKey],
    foreignColumns: [navigationCategories.categoryKey],
    name: "navigation_item_categories_category_key_navigation_categories_c",
  }).onDelete("cascade"),
]);

export const userCategoryPreferences = pgTable("user_category_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  navItemKey: varchar("nav_item_key").notNull(),
  categoryKey: varchar("category_key").notNull(),
  sortOrder: integer("sort_order").default(0), // User's custom order
  isVisible: boolean("is_visible").default(true), // User can hide items
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("user_cat_pref_user_idx").on(table.userId),
  index("user_cat_pref_item_idx").on(table.navItemKey),
  foreignKey({
    columns: [table.navItemKey],
    foreignColumns: [navigationPermissions.itemKey],
    name: "user_category_preferences_nav_item_key_navigation_permissions_i",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.categoryKey],
    foreignColumns: [navigationCategories.categoryKey],
    name: "user_category_preferences_category_key_navigation_categories_ca",
  }).onDelete("cascade"),
]);

export const userCategoryState = pgTable("user_category_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryKey: varchar("category_key").notNull(),
  isExpanded: boolean("is_expanded").default(true), // Remember collapsed/expanded state
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("user_cat_state_user_idx").on(table.userId),
  index("user_cat_state_cat_idx").on(table.categoryKey),
  foreignKey({
    columns: [table.categoryKey],
    foreignColumns: [navigationCategories.categoryKey],
    name: "user_category_state_category_key_navigation_categories_category",
  }).onDelete("cascade"),
]);

// Insert schemas for navigation categories
export const insertNavigationCategorySchema = createInsertSchema(navigationCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNavigationItemCategorySchema = createInsertSchema(navigationItemCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserCategoryPreferenceSchema = createInsertSchema(userCategoryPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserCategoryStateSchema = createInsertSchema(userCategoryState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for navigation categories
export type NavigationCategory = typeof navigationCategories.$inferSelect;
export type InsertNavigationCategory = z.infer<typeof insertNavigationCategorySchema>;
export type NavigationItemCategory = typeof navigationItemCategories.$inferSelect;
export type InsertNavigationItemCategory = z.infer<typeof insertNavigationItemCategorySchema>;
export type UserCategoryPreference = typeof userCategoryPreferences.$inferSelect;
export type InsertUserCategoryPreference = z.infer<typeof insertUserCategoryPreferenceSchema>;
export type UserCategoryState = typeof userCategoryState.$inferSelect;
export type InsertUserCategoryState = z.infer<typeof insertUserCategoryStateSchema>;

// ======================
// PENDING TERM MAPPINGS (ERP-AWARE EXTRACTION)
// ======================
// Stores proposed AI mappings from contract terms to ERP fields before user confirmation

export const pendingTermMappings = pgTable("pending_term_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'set null' }), // Optional for company-level mappings
  companyId: varchar("company_id").references(() => companies.id, { onDelete: 'cascade' }), // Company context for persistent mappings
  extractionRunId: varchar("extraction_run_id"), // Links to extraction_runs table
  
  // Original contract data
  originalTerm: varchar("original_term").notNull(), // e.g., "Licensor", "Licensed Products"
  originalValue: text("original_value"), // e.g., "ABC Nursery", "Rose Bushes"
  sourceText: text("source_text"), // Original text snippet from PDF
  sourceSection: varchar("source_section"), // Section of PDF where term was found (e.g., "Payment Terms", "Parties")
  sourcePage: integer("source_page"), // Page number in PDF where term was found
  
  // AI-suggested ERP mapping
  erpSystemId: varchar("erp_system_id").references(() => erpSystems.id),
  erpEntityId: varchar("erp_entity_id").references(() => erpEntities.id),
  erpFieldId: varchar("erp_field_id").references(() => erpFields.id),
  erpFieldName: varchar("erp_field_name"), // Denormalized for display: e.g., "SupplierName"
  erpEntityName: varchar("erp_entity_name"), // Denormalized for display: e.g., "Suppliers"
  
  // Linked ERP record value (from physical entity tables like items, vendors)
  erpRecordId: varchar("erp_record_id"), // ID of the linked record from physical table
  erpRecordValue: varchar("erp_record_value"), // Denormalized display value from the record
  erpRecordTable: varchar("erp_record_table"), // Table name where the record exists (e.g., "items", "vendors")
  
  // Mapping metadata
  confidence: real("confidence").notNull().default(0), // 0-1 AI confidence score
  mappingMethod: varchar("mapping_method").notNull().default("ai"), // 'ai', 'fuzzy', 'exact', 'manual'
  alternativeMappings: jsonb("alternative_mappings"), // Array of other possible mappings with scores
  
  // User confirmation status
  status: varchar("status").notNull().default("pending"), // 'pending', 'confirmed', 'rejected', 'modified'
  confirmedBy: varchar("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
  userModifiedValue: text("user_modified_value"), // If user changed the mapping
  userModifiedFieldId: varchar("user_modified_field_id"), // If user selected different field
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("pending_term_mappings_contract_idx").on(table.contractId),
  index("pending_term_mappings_company_idx").on(table.companyId),
  index("pending_term_mappings_status_idx").on(table.status),
  index("pending_term_mappings_erp_idx").on(table.erpSystemId),
  index("pending_term_mappings_run_idx").on(table.extractionRunId),
]);

export const insertPendingTermMappingSchema = createInsertSchema(pendingTermMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PendingTermMapping = typeof pendingTermMappings.$inferSelect;
export type InsertPendingTermMapping = z.infer<typeof insertPendingTermMappingSchema>;

// ======================
// ERP MAPPING RULES SYSTEM
// ======================
// Parallel calculation engine that uses confirmed ERP field mappings for rule-based calculations

// Organization-level calculation settings
export const orgCalculationSettings = pgTable("org_calculation_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  calculationApproach: varchar("calculation_approach").notNull().default("manual"), // 'manual' or 'erp_mapping'
  defaultApproach: boolean("default_approach").notNull().default(true),
  allowContractOverride: boolean("allow_contract_override").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("org_calc_settings_company_idx").on(table.companyId),
]);

// ERP Mapping Rule Sets - groups of related mapping rules
export const erpMappingRuleSets = pgTable("erp_mapping_rule_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  businessUnitId: varchar("business_unit_id").references(() => businessUnits.id),
  locationId: varchar("location_id").references(() => locations.id),
  sourceSystemId: varchar("source_system_id").notNull().references(() => erpSystems.id, { onDelete: 'cascade' }),
  sourceEntityId: varchar("source_entity_id").references(() => erpEntities.id),
  targetEntityId: varchar("target_entity_id").references(() => licenseiqEntities.id),
  mappingId: varchar("mapping_id").references(() => masterDataMappings.id),
  status: varchar("status").notNull().default("draft"), // 'draft', 'active', 'inactive'
  version: integer("version").notNull().default(1),
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("erp_rule_sets_company_idx").on(table.companyId),
  index("erp_rule_sets_status_idx").on(table.status),
  index("erp_rule_sets_source_idx").on(table.sourceSystemId),
]);

// Individual ERP Mapping Rules within a rule set
export const erpMappingRules = pgTable("erp_mapping_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleSetId: varchar("rule_set_id").notNull().references(() => erpMappingRuleSets.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  priority: integer("priority").notNull().default(1),
  sourceField: varchar("source_field").notNull(), // ERP field name
  sourceFieldId: varchar("source_field_id").references(() => erpFields.id),
  targetField: varchar("target_field").notNull(), // LicenseIQ field name
  targetFieldId: varchar("target_field_id").references(() => licenseiqFields.id),
  transformationType: varchar("transformation_type").notNull().default("direct"), // 'direct', 'lookup', 'formula', 'conditional'
  transformationConfig: jsonb("transformation_config"), // Transformation parameters
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("erp_mapping_rules_set_idx").on(table.ruleSetId),
  index("erp_mapping_rules_priority_idx").on(table.priority),
]);

// Conditions that determine when a rule applies
export const erpMappingConditions = pgTable("erp_mapping_conditions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").notNull().references(() => erpMappingRules.id, { onDelete: 'cascade' }),
  fieldName: varchar("field_name").notNull(),
  operator: varchar("operator").notNull(), // 'equals', 'contains', 'greater_than', 'between', 'in', 'not_null'
  value: varchar("value"),
  valueList: jsonb("value_list"), // For 'in' operator
  logicOperator: varchar("logic_operator").notNull().default("AND"), // 'AND', 'OR'
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("erp_mapping_conditions_rule_idx").on(table.ruleId),
]);

// Calculated output fields from rules
export const erpMappingOutputs = pgTable("erp_mapping_outputs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").notNull().references(() => erpMappingRules.id, { onDelete: 'cascade' }),
  outputField: varchar("output_field").notNull(),
  calculationType: varchar("calculation_type").notNull(), // 'percentage', 'fixed', 'tiered', 'formula'
  calculationConfig: jsonb("calculation_config"), // Calculation parameters
  roundingMode: varchar("rounding_mode").default("nearest"), // 'none', 'up', 'down', 'nearest'
  decimalPlaces: integer("decimal_places").default(2),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("erp_mapping_outputs_rule_idx").on(table.ruleId),
]);

// Audit trail for rule executions
export const erpRuleExecutionLog = pgTable("erp_rule_execution_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleSetId: varchar("rule_set_id").notNull().references(() => erpMappingRuleSets.id, { onDelete: 'cascade' }),
  calculationId: varchar("calculation_id"),
  salesRecordId: varchar("sales_record_id"),
  inputData: jsonb("input_data"),
  outputData: jsonb("output_data"),
  rulesApplied: jsonb("rules_applied"), // Which rules fired
  executionTimeMs: integer("execution_time_ms"),
  status: varchar("status").notNull().default("success"), // 'success', 'partial', 'failed'
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at").defaultNow(),
}, (table) => [
  index("erp_rule_exec_log_set_idx").on(table.ruleSetId),
  index("erp_rule_exec_log_calc_idx").on(table.calculationId),
  index("erp_rule_exec_log_date_idx").on(table.executedAt),
  foreignKey({
    columns: [table.calculationId],
    foreignColumns: [contractRoyaltyCalculations.id],
    name: "erp_rule_execution_log_calculation_id_contract_calculations_id_",
  }).onDelete("no action"),
]);

// Insert schemas for ERP Mapping Rules
export const insertOrgCalculationSettingsSchema = createInsertSchema(orgCalculationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertErpMappingRuleSetSchema = createInsertSchema(erpMappingRuleSets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertErpMappingRuleSchema = createInsertSchema(erpMappingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertErpMappingConditionSchema = createInsertSchema(erpMappingConditions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertErpMappingOutputSchema = createInsertSchema(erpMappingOutputs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertErpRuleExecutionLogSchema = createInsertSchema(erpRuleExecutionLog).omit({
  id: true,
  executedAt: true,
});

// Types for ERP Mapping Rules
export type OrgCalculationSettings = typeof orgCalculationSettings.$inferSelect;
export type InsertOrgCalculationSettings = z.infer<typeof insertOrgCalculationSettingsSchema>;
export type ErpMappingRuleSet = typeof erpMappingRuleSets.$inferSelect;
export type InsertErpMappingRuleSet = z.infer<typeof insertErpMappingRuleSetSchema>;
export type ErpMappingRule = typeof erpMappingRules.$inferSelect;
export type InsertErpMappingRule = z.infer<typeof insertErpMappingRuleSchema>;
export type ErpMappingCondition = typeof erpMappingConditions.$inferSelect;
export type InsertErpMappingCondition = z.infer<typeof insertErpMappingConditionSchema>;
export type ErpMappingOutput = typeof erpMappingOutputs.$inferSelect;
export type InsertErpMappingOutput = z.infer<typeof insertErpMappingOutputSchema>;
export type ErpRuleExecutionLog = typeof erpRuleExecutionLog.$inferSelect;
export type InsertErpRuleExecutionLog = z.infer<typeof insertErpRuleExecutionLogSchema>;

// ======================
// CALCULATION BLUEPRINTS SYSTEM
// ======================
// Materialized calculation rules that merge manual fee rules with ERP field mappings
// for executable calculations based on the organization's calculation approach

export const calculationBlueprints = pgTable("calculation_blueprints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  royaltyRuleId: varchar("royalty_rule_id").notNull().references(() => contractRules.id, { onDelete: 'cascade' }),
  erpRuleSetId: varchar("erp_rule_set_id"),
  name: varchar("name").notNull(),
  description: text("description"),
  ruleType: varchar("rule_type").notNull(), // 'percentage', 'tiered', 'minimum_guarantee', etc.
  calculationLogic: jsonb("calculation_logic").notNull(), // Merged formula with ERP field bindings
  erpFieldBindings: jsonb("erp_field_bindings"), // Maps dimensions to ERP fields: { "product": "ItemDescription", "territory": "LOCATION_NAME" }
  dualTerminologyMap: jsonb("dual_terminology_map"), // Contract term → ERP field display format
  matchingCriteria: jsonb("matching_criteria"), // Conditions for when this blueprint applies to sales data
  priority: integer("priority").notNull().default(10),
  status: varchar("status").notNull().default("active"), // 'active', 'draft', 'inactive'
  version: integer("version").notNull().default(1),
  isFullyMapped: boolean("is_fully_mapped").notNull().default(false), // All required fields have ERP mappings
  unmappedFields: text("unmapped_fields").array(), // List of fields that need ERP mapping
  materializedAt: timestamp("materialized_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("calc_blueprints_contract_idx").on(table.contractId),
  index("calc_blueprints_company_idx").on(table.companyId),
  index("calc_blueprints_rule_idx").on(table.royaltyRuleId),
  index("calc_blueprints_status_idx").on(table.status),
  foreignKey({
    columns: [table.erpRuleSetId],
    foreignColumns: [erpMappingRuleSets.id],
    name: "calculation_blueprints_erp_rule_set_id_erp_mapping_rule_sets_id",
  }).onDelete("set null"),
]);

export const blueprintDimensions = pgTable("blueprint_dimensions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blueprintId: varchar("blueprint_id").notNull().references(() => calculationBlueprints.id, { onDelete: 'cascade' }),
  dimensionType: varchar("dimension_type").notNull(), // 'product', 'territory', 'container_size', 'season', etc.
  contractTerm: varchar("contract_term").notNull(), // Original term from contract (e.g., "Pacific Sunset Rose")
  erpFieldName: varchar("erp_field_name"), // Mapped ERP field (e.g., "ItemDescription")
  erpFieldId: varchar("erp_field_id").references(() => erpFields.id),
  mappingId: varchar("mapping_id").references(() => pendingTermMappings.id),
  matchValue: varchar("match_value"), // Value to match in ERP data
  isMapped: boolean("is_mapped").notNull().default(false),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("blueprint_dims_blueprint_idx").on(table.blueprintId),
  index("blueprint_dims_type_idx").on(table.dimensionType),
]);

export const insertCalculationBlueprintSchema = createInsertSchema(calculationBlueprints).omit({
  id: true,
  materializedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlueprintDimensionSchema = createInsertSchema(blueprintDimensions).omit({
  id: true,
  createdAt: true,
});

export type CalculationBlueprint = typeof calculationBlueprints.$inferSelect;
export type InsertCalculationBlueprint = z.infer<typeof insertCalculationBlueprintSchema>;
export type BlueprintDimension = typeof blueprintDimensions.$inferSelect;
export type InsertBlueprintDimension = z.infer<typeof insertBlueprintDimensionSchema>;

// ======================
// CALCULATION LINE ITEMS (DETAILED RESULTS WITH DYNAMIC DIMENSIONS)
// ======================
// Stores individual line-item calculations with ERP-mapped dimension data for multi-dimensional reporting

export const calculationLineItems = pgTable("calculation_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  calculationId: varchar("calculation_id").notNull(),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  salesDataId: varchar("sales_data_id").references(() => salesData.id, { onDelete: 'set null' }),
  blueprintId: varchar("blueprint_id"),
  ruleId: varchar("rule_id").references(() => contractRules.id, { onDelete: 'set null' }),
  
  // Transaction details
  transactionDate: timestamp("transaction_date"),
  transactionId: varchar("transaction_id"),
  
  // Amounts
  salesAmount: decimal("sales_amount", { precision: 15, scale: 2 }),
  quantity: decimal("quantity", { precision: 12, scale: 4 }),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }),
  calculatedFee: decimal("calculated_fee", { precision: 15, scale: 2 }).notNull(),
  appliedRate: decimal("applied_rate", { precision: 10, scale: 4 }),
  // How many source sales rows were rolled up into this line item.
  // 1 for per-transaction line items; N for aggregated rebate-tier rollups.
  transactionCount: integer("transaction_count").default(1),
  
  // Rule/tier info
  ruleName: varchar("rule_name"),
  ruleType: varchar("rule_type"),
  tierApplied: varchar("tier_applied"), // e.g., "Tier 2: 5,000-10,000 units"
  
  // Dynamic ERP-mapped dimensions (stored as JSONB for flexibility)
  // Each key is an ERP field name, value is the matched value
  // e.g., {"ItemDescription": "Aurora Flame Maple", "Territory": "Pacific Northwest", "ItemClass": "Ornamental"}
  dimensions: jsonb("dimensions").notNull().default(sql`'{}'::jsonb`),
  
  // Standard dimension fields for common groupings (denormalized for query performance)
  vendorName: varchar("vendor_name"),
  vendorCode: varchar("vendor_code"),
  itemName: varchar("item_name"),
  itemCode: varchar("item_code"),
  itemClass: varchar("item_class"),
  territory: varchar("territory"),
  period: varchar("period"), // e.g., "2024-Q1", "2024-01"
  
  // Multi-location context
  companyId: varchar("company_id").references(() => companies.id),
  businessUnitId: varchar("business_unit_id"),
  locationId: varchar("location_id").references(() => locations.id),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("calc_line_items_calc_idx").on(table.calculationId),
  index("calc_line_items_contract_idx").on(table.contractId),
  index("calc_line_items_vendor_idx").on(table.vendorName),
  index("calc_line_items_item_idx").on(table.itemName),
  index("calc_line_items_class_idx").on(table.itemClass),
  index("calc_line_items_territory_idx").on(table.territory),
  index("calc_line_items_period_idx").on(table.period),
  foreignKey({
    columns: [table.blueprintId],
    foreignColumns: [calculationBlueprints.id],
    name: "calculation_line_items_blueprint_id_calculation_blueprints_id_f",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.calculationId],
    foreignColumns: [contractRoyaltyCalculations.id],
    name: "calculation_line_items_calculation_id_contract_calculations_id_",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.businessUnitId],
    foreignColumns: [businessUnits.id],
    name: "calculation_line_items_business_unit_id_business_units_org_id_f",
  }).onDelete("no action"),
]);

// Dynamic dimension metadata - stores which dimensions are available for a contract based on ERP mappings
export const calculationDimensionConfig = pgTable("calculation_dimension_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  dimensionKey: varchar("dimension_key").notNull(), // Key in the dimensions JSONB (e.g., "ItemDescription")
  displayName: varchar("display_name").notNull(), // User-friendly name (e.g., "Product")
  erpFieldId: varchar("erp_field_id").references(() => erpFields.id),
  erpFieldName: varchar("erp_field_name"), // ERP field name for reference
  dimensionType: varchar("dimension_type").notNull(), // 'product', 'vendor', 'territory', 'category', 'custom'
  isGroupable: boolean("is_groupable").notNull().default(true), // Can be used for grouping in reports
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("calc_dim_config_contract_idx").on(table.contractId),
  uniqueIndex("calc_dim_config_unique_idx").on(table.contractId, table.dimensionKey),
]);

export const insertCalculationLineItemSchema = createInsertSchema(calculationLineItems).omit({
  id: true,
  createdAt: true,
});

export const insertCalculationDimensionConfigSchema = createInsertSchema(calculationDimensionConfig).omit({
  id: true,
  createdAt: true,
});

export type CalculationLineItem = typeof calculationLineItems.$inferSelect;
export type InsertCalculationLineItem = z.infer<typeof insertCalculationLineItemSchema>;
export type CalculationDimensionConfig = typeof calculationDimensionConfig.$inferSelect;
export type InsertCalculationDimensionConfig = z.infer<typeof insertCalculationDimensionConfigSchema>;

// =====================================================
// SYSTEM AND COMPANY SETTINGS
// =====================================================

// System-level settings (Super Admin only) - singleton table
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // AI Configuration
  aiProvider: varchar("ai_provider").notNull().default("anthropic"), // 'groq' | 'openai' | 'anthropic'
  aiModel: varchar("ai_model").notNull().default("claude-sonnet-4-5"), // Default AI model
  aiTemperature: real("ai_temperature").notNull().default(0.1), // AI temperature (0-1)
  aiMaxTokens: integer("ai_max_tokens").notNull().default(8192), // Max tokens per request
  aiRetryAttempts: integer("ai_retry_attempts").notNull().default(3), // Retry attempts on failure
  
  // Confidence Thresholds
  autoConfirmThreshold: real("auto_confirm_threshold").notNull().default(0.85), // Auto-confirm rules above this
  lowConfidenceThreshold: real("low_confidence_threshold").notNull().default(0.60), // Flag rules below this for review
  
  // Extraction Settings
  defaultExtractionMode: varchar("default_extraction_mode").notNull().default("rag"), // 'rag' or 'legacy' - controls how rules are extracted from contracts
  
  // Analysis Mode
  analysisMode: varchar("analysis_mode").notNull().default("on_demand"), // 'on_demand' or 'auto_complete' - controls when AI analysis sections are generated
  
  // Calculation Settings
  defaultEvaluationMode: varchar("default_evaluation_mode").notNull().default("universal"), // 'legacy', 'universal', or 'hybrid'

  // Slice 2 — global default for contracts that don't pin their own
  // obligationAccrualBasis. 'scheduled_release' is the conservative default:
  // accruals hit the books in the period they are released, not the period
  // the qualifying sale fell in.
  defaultObligationAccrualBasis: varchar("default_obligation_accrual_basis").notNull().default("scheduled_release"),

  // Nightly obligation expiry sweep — forfeits stale MDF / bonus obligations
  // whose expiryDate has passed and rolloverPolicy='forfeit'. The sweep is
  // run once per active company per day by the in-process scheduler in
  // server/services/obligationExpiryScheduler.ts. The toggle, hour-of-day
  // (UTC), last-run timestamp, and last error are all stored here so System
  // Settings can show admins the latest status.
  obligationExpirySweepEnabled: boolean("obligation_expiry_sweep_enabled").notNull().default(true),
  obligationExpirySweepHourUtc: integer("obligation_expiry_sweep_hour_utc").notNull().default(2),
  obligationExpirySweepLastRunAt: timestamp("obligation_expiry_sweep_last_run_at"),
  obligationExpirySweepLastError: text("obligation_expiry_sweep_last_error"),
  obligationExpirySweepLastResult: jsonb("obligation_expiry_sweep_last_result"),
  // Tracks the timestamp of the most recent failed sweep run we already
  // emailed admins about, so we never send duplicate alerts for the same
  // run. Compared against the run's startedAt for crashes (lastRunAt is
  // not advanced on crash) and against lastRunAt for partial-failure runs.
  obligationExpirySweepLastNotifiedAt: timestamp("obligation_expiry_sweep_last_notified_at"),
  // startedAt of the most recent top-level crash attempt. Combined with
  // lastNotifiedAt this gives us a true "once per failed run" dedupe for
  // crashes (we send iff lastNotifiedAt < lastCrashStartedAt).
  obligationExpirySweepLastCrashStartedAt: timestamp("obligation_expiry_sweep_last_crash_started_at"),

  // Security Settings
  sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(60), // Session timeout
  maxLoginAttempts: integer("max_login_attempts").notNull().default(5), // Max failed login attempts
  passwordMinLength: integer("password_min_length").notNull().default(8), // Minimum password length
  require2FA: boolean("require_2fa").notNull().default(false), // Require 2-factor auth
  
  // Storage Settings
  maxFileSizeMB: integer("max_file_size_mb").notNull().default(50), // Max file size in MB
  allowedFileTypes: jsonb("allowed_file_types").notNull().default(["pdf", "docx", "xlsx", "csv"]),
  fileRetentionDays: integer("file_retention_days").notNull().default(365), // File retention period
  
  // Feature Flags
  enableBetaFeatures: boolean("enable_beta_features").notNull().default(false),
  enableAuditLogging: boolean("enable_audit_logging").notNull().default(true),
  enableEmailNotifications: boolean("enable_email_notifications").notNull().default(true),
  
  // API Settings
  apiRateLimitPerMinute: integer("api_rate_limit_per_minute").notNull().default(100),
  
  // SMTP / Email Configuration
  smtpHost: varchar("smtp_host").default("smtppro.zoho.com"),
  smtpPort: integer("smtp_port").default(465),
  smtpSecure: boolean("smtp_secure").default(true),
  smtpUser: varchar("smtp_user").default("info@licenseiq.ai"),
  smtpPassword: varchar("smtp_password"),
  smtpFromName: varchar("smtp_from_name").default("LicenseIQ"),
  smtpFromEmail: varchar("smtp_from_email").default("info@licenseiq.ai"),
  
  // Extraction Prompts (stored as JSON for flexibility)
  extractionPrompts: jsonb("extraction_prompts"), // Custom prompts for AI extraction
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company-level settings (per company configuration)
export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  
  // Localization
  dateFormat: varchar("date_format").notNull().default("MM/DD/YYYY"), // MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
  defaultCurrency: varchar("default_currency").notNull().default("USD"),
  timezone: varchar("timezone").notNull().default("America/New_York"),
  numberFormat: varchar("number_format").notNull().default("1,000.00"), // 1,000.00 or 1.000,00
  
  // Contract Types (which types this company can process)
  allowedContractTypes: jsonb("allowed_contract_types").notNull().default(["direct_sales", "distributor_reseller", "referral", "royalty_license", "rebate_mdf", "chargebacks_claims", "marketplace_platforms", "usage_service_based"]),
  customContractTypes: jsonb("custom_contract_types"), // Additional custom types
  requiredFieldsByType: jsonb("required_fields_by_type"), // Required fields per contract type
  
  // Regions/Territories
  allowedRegions: jsonb("allowed_regions"), // List of allowed regions
  defaultRegion: varchar("default_region"),
  territoryHierarchy: jsonb("territory_hierarchy"), // Regional hierarchy structure
  
  // Approval Workflow
  enableApprovalWorkflow: boolean("enable_approval_workflow").notNull().default(true),
  approvalChain: jsonb("approval_chain"), // JSON array of approver roles/users
  autoApprovalThresholdAmount: real("auto_approval_threshold_amount"), // Auto-approve below this amount
  escalationDays: integer("escalation_days").notNull().default(3), // Days before escalation
  
  // Branding
  companyLogo: varchar("company_logo"), // Logo URL
  primaryColor: varchar("primary_color").default("#6366f1"), // Primary brand color
  reportHeaderText: text("report_header_text"),
  reportFooterText: text("report_footer_text"),
  
  // Notification Settings
  emailDigestFrequency: varchar("email_digest_frequency").notNull().default("daily"), // daily, weekly, immediate
  alertThresholdAmount: real("alert_threshold_amount"), // Alert for calculations above this
  
  // ERP Defaults
  defaultErpSystemId: varchar("default_erp_system_id"),
  autoSyncEnabled: boolean("auto_sync_enabled").notNull().default(false),
  syncScheduleCron: varchar("sync_schedule_cron"), // Cron expression for sync
  
  // Calculation Defaults
  roundingMethod: varchar("rounding_method").notNull().default("round_half_up"),
  defaultPaymentTermsDays: integer("default_payment_terms_days").notNull().default(30),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
  
  financialPolicies: jsonb("financial_policies").default(sql`'{}'::jsonb`),
  periodPolicies: jsonb("period_policies").default(sql`'{}'::jsonb`),
  datasetPolicies: jsonb("dataset_policies").default(sql`'{}'::jsonb`),
  settlementPolicies: jsonb("settlement_policies").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("company_settings_company_idx").on(table.companyId),
]);

// Contract type definitions (master list)
export const contractTypeDefinitions = pgTable("contract_type_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull().unique("contract_type_definitions_code_unique"), // direct_sales, distributor_reseller, etc.
  name: varchar("name").notNull(), // Display name
  description: text("description"),
  icon: varchar("icon"), // Icon name for UI
  color: varchar("color"), // Color for badges
  isSystemType: boolean("is_system_type").notNull().default(false), // System-defined vs custom
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  
  // AI Extraction Prompt Templates per contract type - LEGACY MODE
  extractionPrompt: text("extraction_prompt"), // Main prompt for extracting contract terms (Legacy)
  ruleExtractionPrompt: text("rule_extraction_prompt"), // Prompt for extracting payment/fee rules (Legacy)
  erpMappingPrompt: text("erp_mapping_prompt"), // Prompt for ERP field mapping
  sampleExtractionOutput: text("sample_extraction_output"), // Example output format for AI guidance (Legacy)
  
  // AI Extraction Prompt Templates per contract type - RAG MODE (chunk-based with citations)
  ragExtractionPrompt: text("rag_extraction_prompt"), // RAG-specific main extraction prompt
  ragRuleExtractionPrompt: text("rag_rule_extraction_prompt"), // RAG-specific rule extraction with mandatory citations
  ragSampleExtractionOutput: text("rag_sample_extraction_output"), // RAG-specific example output format
  
  // Template-Driven Rule Extraction - expected rule slots per contract type
  ruleSlots: jsonb("rule_slots"),
  
  financialPolicies: jsonb("financial_policies"),
  periodPolicies: jsonb("period_policies"),
  datasetPolicies: jsonb("dataset_policies"),
  settlementPolicies: jsonb("settlement_policies"),
  partyRoleSlots: jsonb("party_role_slots"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractTypeDefinitionSchema = createInsertSchema(contractTypeDefinitions).omit({
  id: true,
  createdAt: true,
});

// Types
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type ContractTypeDefinition = typeof contractTypeDefinitions.$inferSelect;
export type InsertContractTypeDefinition = z.infer<typeof insertContractTypeDefinitionSchema>;


// ==========================================
// Calculation Field Types - Dynamic field definitions per contract type
// ==========================================
export const calculationFieldTypes = pgTable("calculation_field_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractTypeCode: varchar("contract_type_code").notNull(), // References contractTypeDefinitions.code
  fieldCode: varchar("field_code").notNull(), // Internal identifier (volume_threshold, rate_percentage, etc.)
  fieldName: varchar("field_name").notNull(), // Display name (Volume/Threshold, Rate/Percentage, etc.)
  fieldCategory: varchar("field_category").notNull(), // basis, rate, threshold, modifier, constraint
  description: text("description"), // Help text for users
  isRequired: boolean("is_required").notNull().default(false),
  sortOrder: integer("sort_order").default(0),
  defaultColumnPatterns: text("default_column_patterns").array(), // Patterns for auto-detect (e.g., ['volume', 'quantity', 'units'])
  dataType: varchar("data_type").notNull().default('number'), // number, percentage, currency, text, date
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCalculationFieldTypeSchema = createInsertSchema(calculationFieldTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CalculationFieldType = typeof calculationFieldTypes.$inferSelect;
export type InsertCalculationFieldType = z.infer<typeof insertCalculationFieldTypeSchema>;


// Accuracy Testing Framework Tables
export const accuracyTestCases = pgTable("accuracy_test_cases", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  contractType: varchar("contract_type").notNull(),
  description: text("description"),
  contractText: text("contract_text").notNull(),
  groundTruth: jsonb("ground_truth").notNull(), // Array of expected field values
  source: varchar("source").notNull().default('synthetic'), // 'synthetic', 'pdf_upload', 'manual'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accuracyTestRuns = pgTable("accuracy_test_runs", {
  id: serial("id").primaryKey(),
  extractionMode: varchar("extraction_mode").notNull(), // 'legacy', 'rag', 'rag_comprehensive'
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  status: varchar("status").notNull().default("pending"), // pending, running, completed, failed
  totalTests: integer("total_tests"),
  passedTests: integer("passed_tests"),
  failedTests: integer("failed_tests"),
  overallAccuracy: real("overall_accuracy"),
  metrics: jsonb("metrics"), // Detailed metrics by contract type, field type, etc.
});

export const accuracyTestResults = pgTable("accuracy_test_results", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => accuracyTestRuns.id, { onDelete: 'cascade' }),
  testCaseId: integer("test_case_id").notNull().references(() => accuracyTestCases.id, { onDelete: 'cascade' }),
  passed: boolean("passed").notNull(),
  accuracy: real("accuracy").notNull(),
  fieldResults: jsonb("field_results").notNull(), // Per-field comparison results
  extractedData: jsonb("extracted_data"), // What was actually extracted
  extractionTimeMs: integer("extraction_time_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for accuracy testing
export const insertAccuracyTestCaseSchema = createInsertSchema(accuracyTestCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccuracyTestRunSchema = createInsertSchema(accuracyTestRuns).omit({
  id: true,
  startedAt: true,
});

export const insertAccuracyTestResultSchema = createInsertSchema(accuracyTestResults).omit({
  id: true,
  createdAt: true,
});

// Types for accuracy testing
export type AccuracyTestCase = typeof accuracyTestCases.$inferSelect;
export type InsertAccuracyTestCase = z.infer<typeof insertAccuracyTestCaseSchema>;
export type AccuracyTestRun = typeof accuracyTestRuns.$inferSelect;
export type InsertAccuracyTestRun = z.infer<typeof insertAccuracyTestRunSchema>;
export type AccuracyTestResult = typeof accuracyTestResults.$inferSelect;
export type InsertAccuracyTestResult = z.infer<typeof insertAccuracyTestResultSchema>;

// ======================
// CONTRACT STRUCTURED DATA TABLES
// ======================
// Note: contract_master table has been consolidated into the contracts table.
// Business metadata fields (contractCategory, owningParty, counterpartyType, etc.)
// are now stored directly on the contracts table.

export const contractTerms = pgTable("contract_terms", {
  termId: varchar("term_id").primaryKey(),
  contractId: varchar("contract_id").notNull(),
  termSequence: integer("term_sequence"),
  termName: varchar("term_name"),
  termType: varchar("term_type"),
  calculationBasis: varchar("calculation_basis"),
  rateType: varchar("rate_type"),
  rateValue: decimal("rate_value", { precision: 15, scale: 6 }),
  tierMin: decimal("tier_min", { precision: 15, scale: 2 }),
  tierMax: decimal("tier_max", { precision: 15, scale: 2 }),
  tierUom: varchar("tier_uom"),
  appliesToProductCategory: varchar("applies_to_product_category"),
  appliesToProductFamily: varchar("applies_to_product_family"),
  appliesToProductIds: text("applies_to_product_ids"),
  excludedProductIds: text("excluded_product_ids"),
  appliesToTerritory: varchar("applies_to_territory"),
  appliesToChannel: varchar("applies_to_channel"),
  paymentTiming: varchar("payment_timing"),
  paymentMethod: varchar("payment_method"),
  requiresClaim: boolean("requires_claim"),
  claimDeadlineDays: integer("claim_deadline_days"),
  requiresProofOfPerformance: boolean("requires_proof_of_performance"),
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  notes: text("notes"),
  linkedRuleId: varchar("linked_rule_id"),
}, (table) => [
  index("contract_terms_contract_idx").on(table.contractId),
]);

export const contractQualifiers = pgTable("contract_qualifiers", {
  qualifierId: varchar("qualifier_id").primaryKey(),
  termId: varchar("term_id").notNull(),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'cascade' }),
  contractClauseId: varchar("contract_clause_id").references(() => contractClauses.id, { onDelete: 'set null' }),
  qualifierType: varchar("qualifier_type"),
  qualifierField: varchar("qualifier_field"),
  qualifierAttribute: varchar("qualifier_attribute"),
  operator: varchar("operator"),
  qualifierValue: varchar("qualifier_value"),
  qualifierValueNumeric: decimal("qualifier_value_numeric", { precision: 15, scale: 2 }),
  qualifierLogic: varchar("qualifier_logic"),
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  notes: text("notes"),
}, (table) => [
  index("contract_qualifiers_term_idx").on(table.termId),
  index("contract_qualifiers_contract_idx").on(table.contractId),
  index("contract_qualifiers_clause_idx").on(table.contractClauseId),
]);

export const contractPartnerAssignments = pgTable("contract_partner_assignments", {
  assignmentId: varchar("assignment_id").primaryKey(),
  contractId: varchar("contract_id").notNull(),
  partnerId: varchar("partner_id"),
  assignmentType: varchar("assignment_type"),
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  status: varchar("status"),
  customTerms: boolean("custom_terms"),
  notes: text("notes"),
  // Multi-role party assignment fields (v1: Financial + Operational)
  partyKind: varchar("party_kind"), // 'partner' | 'organization'
  companyId: varchar("company_id"), // FK companies (when partyKind='organization')
  partyRole: varchar("party_role"), // owning_party, counterparty, billed_party, payee_party, remit_to_party, guarantor, finance_owner, execution_owner, legal_owner, notice_recipient
  isPrimary: boolean("is_primary").default(false),
  effectiveStart: timestamp("effective_start"),
  effectiveEnd: timestamp("effective_end"),
  // Linked-master-field metadata (mirrors counterparty/owning_party on contracts)
  rawValue: text("raw_value"),
  linkStatus: varchar("link_status"), // verified | suggested | unlinked | manual
  linkConfidence: decimal("link_confidence", { precision: 5, scale: 4 }),
  linkMethod: varchar("link_method"),
}, (table) => [
  index("contract_partner_assignments_contract_idx").on(table.contractId),
  index("contract_partner_assignments_role_idx").on(table.contractId, table.partyRole),
]);

// Rule Field Whitelist — admin-curated list of (object, attribute) pairs that
// can appear in rule conditions. company_id NULL = system default.
export const ruleFieldWhitelist = pgTable("rule_field_whitelist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  objectCode: varchar("object_code").notNull(),
  attributeCode: varchar("attribute_code").notNull(),
  label: varchar("label").notNull(),
  fieldType: varchar("field_type").notNull().default("text"),
  masterTable: varchar("master_table"),
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  sequence: integer("sequence").notNull().default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("rule_field_whitelist_company_idx").on(table.companyId),
  index("rule_field_whitelist_object_idx").on(table.objectCode),
  uniqueIndex("rule_field_whitelist_unique_idx").on(table.companyId, table.objectCode, table.attributeCode),
]);
export type RuleFieldWhitelist = typeof ruleFieldWhitelist.$inferSelect;

// Insert schemas for contract structured data tables
export const insertContractTermSchema = createInsertSchema(contractTerms).omit({});

export const insertContractQualifierSchema = createInsertSchema(contractQualifiers).omit({});

export const insertContractPartnerAssignmentSchema = createInsertSchema(contractPartnerAssignments).omit({});

// Types for contract structured data tables
export type ContractTerm = typeof contractTerms.$inferSelect;
export type InsertContractTerm = z.infer<typeof insertContractTermSchema>;
export type ContractQualifier = typeof contractQualifiers.$inferSelect;
export type InsertContractQualifier = z.infer<typeof insertContractQualifierSchema>;
export type ContractPartnerAssignment = typeof contractPartnerAssignments.$inferSelect;
export type InsertContractPartnerAssignment = z.infer<typeof insertContractPartnerAssignmentSchema>;

// ======================
// CUSTOMER SEGMENTS TABLE
// ======================
export const customerSegments = pgTable("customer_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  segmentName: varchar("segment_name").notNull(),
  segmentCode: varchar("segment_code").notNull(),
  description: text("description"),
  companyId: varchar("company_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerSegmentSchema = createInsertSchema(customerSegments).pick({
  segmentName: true,
  segmentCode: true,
  description: true,
  companyId: true,
  isActive: true,
});

export type CustomerSegment = typeof customerSegments.$inferSelect;
export type InsertCustomerSegment = z.infer<typeof insertCustomerSegmentSchema>;

// ======================
// PARTNER TYPES (lookup table powering the Partner Master "Partner Type" dropdown)
// ======================
// Shape mirrors `customer_segments` so it slots cleanly into the existing
// reference-data CRUD pattern. `companyId` is nullable: rows with NULL
// companyId are global system defaults available to every tenant; rows
// with an explicit companyId are that tenant's overrides / additions.
export const partnerTypes = pgTable("partner_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  companyId: varchar("company_id"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// `id`/`createdAt`/`updatedAt` are auto-generated by the DB defaults so
// they're already optional on the inferred type — we skip `.omit()` to
// avoid the codebase-wide `boolean is not assignable to never` issue
// that affects every other `.pick()` / `.omit()` schema in this file.
export const insertPartnerTypeSchema = createInsertSchema(partnerTypes);

export type PartnerType = typeof partnerTypes.$inferSelect;
export type InsertPartnerType = z.infer<typeof insertPartnerTypeSchema>;

// ======================
// CUSTOMERS TABLE
// ======================
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  name: varchar("name").notNull(),
  code: varchar("code"),
  segmentId: varchar("segment_id").references(() => customerSegments.id),
  segment: varchar("segment"),
  channel: varchar("channel"),
  territory: varchar("territory"),
  contactEmail: varchar("contact_email"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).pick({
  companyId: true,
  name: true,
  code: true,
  segmentId: true,
  segment: true,
  channel: true,
  territory: true,
  contactEmail: true,
  isActive: true,
  metadata: true,
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

// ======================
// REBATE PROGRAMS TABLE
// ======================
export const rebatePrograms = pgTable("rebate_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id"),
  name: varchar("name").notNull(),
  description: text("description"),
  programType: varchar("program_type").default("volume"),
  status: varchar("status").default("draft"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  qualificationCriteria: jsonb("qualification_criteria"),
  tiers: jsonb("tiers"),
  retroactive: boolean("retroactive").default(false),
  calculationFrequency: varchar("calculation_frequency").default("quarterly"),
  totalAccrued: decimal("total_accrued", { precision: 15, scale: 2 }).default("0"),
  totalPaid: decimal("total_paid", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRebateProgramSchema = createInsertSchema(rebatePrograms).pick({
  contractId: true,
  companyId: true,
  name: true,
  description: true,
  programType: true,
  status: true,
  startDate: true,
  endDate: true,
  qualificationCriteria: true,
  tiers: true,
  retroactive: true,
  calculationFrequency: true,
  totalAccrued: true,
  totalPaid: true,
});

export type RebateProgram = typeof rebatePrograms.$inferSelect;
export type InsertRebateProgram = z.infer<typeof insertRebateProgramSchema>;

// ======================
// RULE DECISION LOGS TABLE
// ======================
export const ruleDecisionLogs = pgTable("rule_decision_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").references(() => contractRules.id, { onDelete: 'set null' }),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'cascade' }),
  transactionId: varchar("transaction_id"),
  inputSnapshot: jsonb("input_snapshot"),
  outputDecision: jsonb("output_decision"),
  conditionMatched: text("condition_matched"),
  alternativesConsidered: jsonb("alternatives_considered"),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  specificityScore: integer("specificity_score"),
  calculationSteps: jsonb("calculation_steps"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRuleDecisionLogSchema = createInsertSchema(ruleDecisionLogs).pick({
  ruleId: true,
  contractId: true,
  transactionId: true,
  inputSnapshot: true,
  outputDecision: true,
  conditionMatched: true,
  alternativesConsidered: true,
  confidenceScore: true,
  specificityScore: true,
  calculationSteps: true,
});

export type RuleDecisionLog = typeof ruleDecisionLogs.$inferSelect;
export type InsertRuleDecisionLog = z.infer<typeof insertRuleDecisionLogSchema>;

// ======================
// CONTRACT PROCESSING PIPELINE — REFERENCE & OUTPUT TABLES
// 3-Stage Extraction: Stage A (Clause Segmentation), Stage B (Rule Template Mapping), Stage C (Conflict Detection)
// ======================

export const flowTypes = pgTable("flow_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").unique("pipeline_flow_types_code_key").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  // Key into aiPromptRegistry for the grounded extraction prompt for this flow type.
  // Used by groqService to route extraction per Phase 6 (round 2). Nullable during migration.
  defaultExtractionPromptKey: varchar("default_extraction_prompt_key"),
  // Task 68 — structured cash direction so the Posted-Accrual → Obligation
  // promotion service no longer has to read direction from prompt text or
  // hardcoded constants. Values: 'outbound' (we owe partner — CRP / RLA /
  // SUB / RSM), 'inbound' (partner owes us — VRP), 'derived' (OEM and
  // similar where the contract author must explicitly pin direction). The
  // promotion service refuses to guess on 'derived' and returns a clear
  // operator error.
  cashDirection: varchar("cash_direction").notNull().default("derived"),
  // Task 69 — per-flow-type override of the (claim_type, direction) →
  // document_type matrix. Stored as { rows: DocumentTypeMatrixRow[] }; an
  // empty/missing rows array means "inherit fully from company / built-in".
  // Sparse: only rows that diverge from the upstream matrix need to be
  // listed. Resolved by resolveDocumentTypeForClaim() in
  // server/services/intakeAgentService.ts. UI lives in the Pipeline →
  // Flow Types editor on company-settings.tsx.
  documentTypeOverrides: jsonb("document_type_overrides"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// Task 69 — Settlement Document Type Matrix
// ---------------------------------------------------------------------------
// The mapping (claim_type, direction) → document_type used to be hardcoded in
// the seed function for the legacy `claim_type_outcome` table and was
// recomputed from defaults if the row was missing. Task 69 promotes it to a
// 4-level cascade resolved per claim:
//
//   contract.settlementPolicies.documentTypeMatrix
//     → flow_types.documentTypeOverrides
//       → companySettings.settlementPolicies.documentTypeMatrix
//         → BUILT_IN_DOCUMENT_TYPE_MATRIX (this file)
//
// Each level stores a sparse list of rows; the resolver returns the first
// matching (claim_type, direction) it finds. The legacy
// `claim_type_outcome` table is kept as a defensive read-only fallback inside
// documentTypeForClaim(), but is no longer the source of truth — everything
// new should go through the cascade.
// ---------------------------------------------------------------------------

export const CLAIM_TYPES = [
  "price_protection",
  "chargeback",
  "mdf",
  "royalty_statement",
  "rebate_settlement",
  "other",
] as const;

export const SETTLEMENT_DIRECTIONS = ["inbound", "outbound"] as const;

export const SETTLEMENT_DOCUMENT_TYPES = [
  "credit_memo",
  "debit_memo",
  "ar_invoice",
  "ap_invoice",
] as const;

export type ClaimTypeCode = (typeof CLAIM_TYPES)[number];
export type SettlementDirection = (typeof SETTLEMENT_DIRECTIONS)[number];
export type SettlementDocumentType = (typeof SETTLEMENT_DOCUMENT_TYPES)[number];

export const documentTypeMatrixRowSchema = z.object({
  claimType: z.enum(CLAIM_TYPES),
  direction: z.enum(SETTLEMENT_DIRECTIONS),
  documentType: z.enum(SETTLEMENT_DOCUMENT_TYPES),
  notes: z.string().optional().nullable(),
});

export const documentTypeMatrixSchema = z.object({
  rows: z.array(documentTypeMatrixRowSchema).default([]),
});

export type DocumentTypeMatrixRow = z.infer<typeof documentTypeMatrixRowSchema>;
export type DocumentTypeMatrix = z.infer<typeof documentTypeMatrixSchema>;

// Built-in fallback. Note: outbound rebate_settlement is `credit_memo` (not
// `ar_invoice` as the legacy seed had it) — settling a rebate we owe is an
// offset against AR, not an invoice we send. Task 69 fixes this regression.
export const BUILT_IN_DOCUMENT_TYPE_MATRIX: DocumentTypeMatrixRow[] = [
  // Inbound — partner is asking us for credit / submitting a claim against us
  { claimType: "price_protection", direction: "inbound", documentType: "credit_memo" },
  { claimType: "chargeback", direction: "inbound", documentType: "credit_memo" },
  { claimType: "mdf", direction: "inbound", documentType: "ap_invoice" },
  { claimType: "royalty_statement", direction: "inbound", documentType: "ap_invoice" },
  { claimType: "rebate_settlement", direction: "inbound", documentType: "credit_memo" },
  { claimType: "other", direction: "inbound", documentType: "ap_invoice" },
  // Outbound — we owe partner / are issuing the financial document
  { claimType: "price_protection", direction: "outbound", documentType: "debit_memo" },
  { claimType: "chargeback", direction: "outbound", documentType: "debit_memo" },
  { claimType: "mdf", direction: "outbound", documentType: "ar_invoice" },
  { claimType: "royalty_statement", direction: "outbound", documentType: "ar_invoice" },
  // Task 69 fix — was incorrectly seeded as `ar_invoice`. Settling an
  // outbound rebate (we owe the customer) issues a credit_memo, not an AR
  // invoice (which would mean we're billing the customer again).
  { claimType: "rebate_settlement", direction: "outbound", documentType: "credit_memo" },
  { claimType: "other", direction: "outbound", documentType: "ar_invoice" },
];

/**
 * Look up a document type from a sparse matrix override list. Returns null
 * when no row in the list matches — callers walk up the cascade and only
 * fall through to the built-in matrix when every level returned null.
 */
export function lookupDocumentTypeMatrixRow(
  rows: unknown,
  claimType: string,
  direction: SettlementDirection,
): SettlementDocumentType | null {
  if (!Array.isArray(rows)) return null;
  for (const raw of rows) {
    const parsed = documentTypeMatrixRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    if (parsed.data.claimType === claimType && parsed.data.direction === direction) {
      return parsed.data.documentType;
    }
  }
  return null;
}

// =============================================================================
// Company Flow-Type Defaults — replaces contract_type_definitions as the home
// for per-flow-type policy defaults. Resolved at contract create and snapshotted
// onto the contract row, so editing defaults here does NOT retroactively
// change existing contracts.
//
// Lookup keys: (companyId, flowTypeCode, optional subflowCode, optional programId)
// A row with both subflowCode = null and programId = null is the flow-type
// default for that company. More specific rows override coarser ones.
// =============================================================================
export const companyFlowTypeDefaults = pgTable("company_flow_type_defaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  flowTypeCode: varchar("flow_type_code").notNull(),
  subflowCode: varchar("subflow_code"),
  programId: varchar("program_id"),
  financialPolicies: jsonb("financial_policies"),
  periodPolicies: jsonb("period_policies"),
  datasetPolicies: jsonb("dataset_policies"),
  settlementPolicies: jsonb("settlement_policies"),
  partyRoleSlots: jsonb("party_role_slots"),
  ruleSlots: jsonb("rule_slots"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("cfd_company_flow_subflow_program_idx").on(
    table.companyId, table.flowTypeCode, table.subflowCode, table.programId,
  ),
]);

export const insertCompanyFlowTypeDefaultsSchema = createInsertSchema(companyFlowTypeDefaults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CompanyFlowTypeDefaults = typeof companyFlowTypeDefaults.$inferSelect;
export type InsertCompanyFlowTypeDefaults = z.infer<typeof insertCompanyFlowTypeDefaultsSchema>;

export const clauseExecutionGroups = pgTable("clause_execution_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").unique("clause_execution_groups_code_key").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ruleTemplates = pgTable("rule_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateCode: varchar("template_code").unique("rule_templates_template_code_key").notNull(),
  name: varchar("name").notNull(),
  executionGroupCode: varchar("execution_group_code").notNull(),
  description: text("description"),
  requiredFields: jsonb("required_fields"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const baseMetrics = pgTable("base_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").unique("pipeline_base_metrics_code_key").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  salesColumn: varchar("sales_column"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clauseCategories = pgTable("clause_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").unique("pipeline_clause_categories_code_key").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contractClauses = pgTable("contract_clauses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  extractionRunId: varchar("extraction_run_id").references(() => extractionRuns.id, { onDelete: 'set null' }),
  clauseIdentifier: varchar("clause_identifier"),
  sectionRef: varchar("section_ref"),
  text: text("text").notNull(),
  clauseCategoryCode: varchar("clause_category_code"),
  flowTypeCode: varchar("flow_type_code"),
  affectsAccrual: boolean("affects_accrual").notNull().default(false),
  confidence: real("confidence"),
  evidence: jsonb("evidence"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contract_clauses_contract_idx").on(table.contractId),
  index("contract_clauses_extraction_idx").on(table.extractionRunId),
  index("contract_clauses_category_idx").on(table.clauseCategoryCode),
]);

export const ruleConflicts = pgTable("rule_conflicts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  extractionRunId: varchar("extraction_run_id").references(() => extractionRuns.id, { onDelete: 'set null' }),
  conflictIdentifier: varchar("conflict_identifier"),
  ruleIds: jsonb("rule_ids"),
  reason: text("reason"),
  resolution: text("resolution"),
  status: varchar("status").default("open"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("rule_conflicts_contract_idx").on(table.contractId),
  index("rule_conflicts_extraction_idx").on(table.extractionRunId),
]);

export const extractionStageResults = pgTable("extraction_stage_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  extractionRunId: varchar("extraction_run_id").notNull(),
  stage: varchar("stage").notNull(),
  status: varchar("status").notNull().default("pending"),
  rawOutput: jsonb("raw_output"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("extraction_stage_results_run_idx").on(table.extractionRunId),
  index("extraction_stage_results_stage_idx").on(table.stage),
  foreignKey({
    columns: [table.extractionRunId],
    foreignColumns: [extractionRuns.id],
    name: "extraction_stage_results_extraction_run_id_extraction_runs_id_f",
  }).onDelete("cascade"),
]);

// Insert schemas for pipeline tables
export const insertFlowTypeSchema = createInsertSchema(flowTypes).pick({
  code: true,
  name: true,
  description: true,
  isActive: true,
});

export const insertClauseExecutionGroupSchema = createInsertSchema(clauseExecutionGroups).pick({
  code: true,
  name: true,
  description: true,
});

export const insertRuleTemplateSchema = createInsertSchema(ruleTemplates).pick({
  templateCode: true,
  name: true,
  executionGroupCode: true,
  description: true,
  requiredFields: true,
  isActive: true,
});

export const insertBaseMetricSchema = createInsertSchema(baseMetrics).pick({
  code: true,
  name: true,
  description: true,
  salesColumn: true,
});

export const insertClauseCategorySchema = createInsertSchema(clauseCategories).pick({
  code: true,
  name: true,
  description: true,
});

export const insertContractClauseSchema = createInsertSchema(contractClauses).pick({
  contractId: true,
  extractionRunId: true,
  clauseIdentifier: true,
  sectionRef: true,
  text: true,
  clauseCategoryCode: true,
  flowTypeCode: true,
  affectsAccrual: true,
  confidence: true,
  evidence: true,
});

export const insertRuleConflictSchema = createInsertSchema(ruleConflicts).pick({
  contractId: true,
  extractionRunId: true,
  conflictIdentifier: true,
  ruleIds: true,
  reason: true,
  resolution: true,
});

export const insertExtractionStageResultSchema = createInsertSchema(extractionStageResults).pick({
  extractionRunId: true,
  stage: true,
  status: true,
  rawOutput: true,
  errorMessage: true,
  startedAt: true,
  completedAt: true,
});

// Types for pipeline tables
export type FlowType = typeof flowTypes.$inferSelect;
export type InsertFlowType = z.infer<typeof insertFlowTypeSchema>;
export type ClauseExecutionGroup = typeof clauseExecutionGroups.$inferSelect;
export type InsertClauseExecutionGroup = z.infer<typeof insertClauseExecutionGroupSchema>;
export type RuleTemplate = typeof ruleTemplates.$inferSelect;
export type InsertRuleTemplate = z.infer<typeof insertRuleTemplateSchema>;
export type BaseMetric = typeof baseMetrics.$inferSelect;
export type InsertBaseMetric = z.infer<typeof insertBaseMetricSchema>;
export type ClauseCategory = typeof clauseCategories.$inferSelect;
export type InsertClauseCategory = z.infer<typeof insertClauseCategorySchema>;
export type ContractClause = typeof contractClauses.$inferSelect;
export type InsertContractClause = z.infer<typeof insertContractClauseSchema>;
export type RuleConflict = typeof ruleConflicts.$inferSelect;
export type InsertRuleConflict = z.infer<typeof insertRuleConflictSchema>;
export type ExtractionStageResult = typeof extractionStageResults.$inferSelect;
export type InsertExtractionStageResult = z.infer<typeof insertExtractionStageResultSchema>;

// ============================================
// Finance Hub Tables
// ============================================

export const accruals = pgTable("accruals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accrualId: varchar("accrual_id").notNull().unique("accruals_accrual_id_key"),
  contractId: varchar("contract_id"),
  contractName: varchar("contract_name"),
  counterparty: varchar("counterparty"),
  flowType: varchar("flow_type"),
  subtypeInstanceId: varchar("subtype_instance_id"),
  period: varchar("period").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).default("0"),
  status: varchar("status").default("draft"),
  aiConfidence: integer("ai_confidence"),
  tier: varchar("tier"),
  rate: varchar("rate"),
  netSales: decimal("net_sales", { precision: 15, scale: 2 }),
  thresholdApplied: varchar("threshold_applied"),
  companyId: varchar("company_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAccrualSchema = createInsertSchema(accruals).omit({ id: true, createdAt: true, updatedAt: true });
export type Accrual = typeof accruals.$inferSelect;
export type InsertAccrual = z.infer<typeof insertAccrualSchema>;

export const accrualAuditTrail = pgTable("accrual_audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accrualId: varchar("accrual_id").notNull(),
  eventType: varchar("event_type").notNull(),
  description: text("description"),
  userId: varchar("user_id"),
  userName: varchar("user_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accrualCalculationTrace = pgTable("accrual_calculation_trace", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accrualId: varchar("accrual_id").notNull(),
  netSales: decimal("net_sales", { precision: 15, scale: 2 }),
  rebateRate: varchar("rebate_rate"),
  threshold: varchar("threshold"),
  accrualTotal: decimal("accrual_total", { precision: 15, scale: 2 }),
  steps: jsonb("steps"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jeId: varchar("je_id").notNull().unique("journal_entries_je_id_key"),
  sourceAccrualId: varchar("source_accrual_id"),
  contractId: varchar("contract_id"),
  contractName: varchar("contract_name"),
  counterparty: varchar("counterparty"),
  flowType: varchar("flow_type"),
  subtypeInstanceId: varchar("subtype_instance_id"),
  period: varchar("period").notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),
  jeStage: varchar("je_stage").default("draft"),
  erpSyncStatus: varchar("erp_sync_status").default("na"),
  balanced: boolean("balanced").default(false),
  companyId: varchar("company_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;

export const journalEntryLines = pgTable("journal_entry_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jeId: varchar("je_id").notNull(),
  accountCode: varchar("account_code"),
  accountName: varchar("account_name"),
  debitAmount: decimal("debit_amount", { precision: 15, scale: 2 }).default("0"),
  creditAmount: decimal("credit_amount", { precision: 15, scale: 2 }).default("0"),
  description: text("description"),
});

export const jeErpSyncLog = pgTable("je_erp_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jeId: varchar("je_id").notNull(),
  syncStatus: varchar("sync_status"),
  erpSystem: varchar("erp_system"),
  errorMessage: text("error_message"),
  syncedAt: timestamp("synced_at").defaultNow(),
});

export const jeReconciliation = pgTable("je_reconciliation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jeId: varchar("je_id").notNull(),
  erpPostedAmount: decimal("erp_posted_amount", { precision: 15, scale: 2 }),
  liqAmount: decimal("liq_amount", { precision: 15, scale: 2 }),
  variance: decimal("variance", { precision: 15, scale: 2 }),
  reconciled: boolean("reconciled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const periodClose = pgTable("period_close", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodLabel: varchar("period_label").notNull(),
  status: varchar("status").default("open"),
  readinessScore: integer("readiness_score").default(0),
  closeDate: timestamp("close_date"),
  closedBy: varchar("closed_by"),
  // Subledger Close workspace — SLA + sign-off chain (Phase 1).
  cutoffAt: timestamp("cutoff_at"),
  closeDay: integer("close_day"),
  closeTargetDay: integer("close_target_day"),
  slaState: varchar("sla_state").default("on_track"), // on_track | at_risk | late
  preparedBy: varchar("prepared_by"),
  preparedAt: timestamp("prepared_at"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  lockedBy: varchar("locked_by"),
  lockedAt: timestamp("locked_at"),
  companyId: varchar("company_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPeriodCloseSchema = createInsertSchema(periodClose).omit({ id: true, createdAt: true, updatedAt: true });
export type PeriodClose = typeof periodClose.$inferSelect;
export type InsertPeriodClose = z.infer<typeof insertPeriodCloseSchema>;

export const periodCloseChecklist = pgTable("period_close_checklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: varchar("period_id").notNull(),
  itemName: varchar("item_name").notNull(),
  status: varchar("status").default("idle"),
  progressText: varchar("progress_text"),
  completedAt: timestamp("completed_at"),
});

export const periodCloseBlockers = pgTable("period_close_blockers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: varchar("period_id").notNull(),
  severity: varchar("severity").default("medium"),
  title: varchar("title").notNull(),
  description: text("description"),
  aiSuggestion: text("ai_suggestion"),
  resolved: boolean("resolved").default(false),
  relatedAccrualId: varchar("related_accrual_id"),
  relatedJeId: varchar("related_je_id"),
  // Subledger Close workspace — assignment + AI provenance + multi-obligation linkage.
  assigneeUserId: varchar("assignee_user_id"),
  assignedAt: timestamp("assigned_at"),
  proposedByAi: boolean("proposed_by_ai").default(false),
  // Forward-ref to closeDecisions (defined below) — no FK to avoid declaration cycle.
  proposedDecisionId: varchar("proposed_decision_id"),
  relatedObligationIds: text("related_obligation_ids").array(),
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Phase 1b — supports the EXISTS subquery in the Worksheet grid that
  // checks "does this obligation have an unresolved blocker?".
  index("period_close_blockers_period_resolved_idx").on(table.periodId, table.resolved),
]);

export const periodCloseAuditTrail = pgTable("period_close_audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: varchar("period_id").notNull(),
  eventType: varchar("event_type"),
  description: text("description").notNull(),
  userName: varchar("user_name"),
  userRole: varchar("user_role"),
  iconColor: varchar("icon_color").default("gray"),
  // Subledger Close workspace — distinguish AI from human actors + back-refs
  // to the decision / batch that produced the event (for SOX evidence pulls).
  actorType: varchar("actor_type").default("user"), // user | ai | system
  userId: varchar("user_id"),
  // Forward-refs to closeDecisions / closeBatchOperations (defined below) —
  // no FK to avoid declaration cycle.
  sourceDecisionId: varchar("source_decision_id"),
  sourceBatchOperationId: varchar("source_batch_operation_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const periodVariance = pgTable("period_variance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: varchar("period_id").notNull(),
  flowType: varchar("flow_type").notNull(),
  previousAmount: decimal("previous_amount", { precision: 15, scale: 2 }).default("0"),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).default("0"),
  changePct: decimal("change_pct", { precision: 5, scale: 1 }),
  aiFlagged: boolean("ai_flagged").default(false),
  aiExplanation: text("ai_explanation"),
});

export const contractCloseStatus = pgTable("contract_close_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: varchar("period_id").notNull(),
  contractId: varchar("contract_id"),
  accrualId: varchar("accrual_id"),
  contractName: varchar("contract_name"),
  counterparty: varchar("counterparty"),
  flowType: varchar("flow_type"),
  accrualAmount: decimal("accrual_amount", { precision: 15, scale: 2 }),
  accrualStatus: varchar("accrual_status"),
  jeStatus: varchar("je_status"),
  erpSyncStatus: varchar("erp_sync_status"),
  closeStatus: varchar("close_status").default("partial"),
});

// ===========================================================================
// Slice 3 — Obligations Lifecycle
// ===========================================================================
// Stateful obligations (MDF, recoupable advances, returns reserves,
// performance bonuses, signing bonuses, milestone payments, minimum
// true-ups). Each row is the single source of truth for "what do we owe
// (or are owed) and in what state". Obligations are produced by the
// `obligation_accrual` evaluators at period close and transitioned through
// claim → approve → pay (or expire / reverse) by the obligation_release
// and obligation_expiry phases.
export const obligations = pgTable("obligations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  ruleId: varchar("rule_id").references(() => contractRules.id, { onDelete: 'set null' }),
  // Resolved partner_master.id when known (no FK because partner_master
  // does not yet exist as a Drizzle table — varchar mirrors
  // contracts.counterpartyPartnerId).
  partnerId: varchar("partner_id"),
  partnerName: varchar("partner_name"),
  // One of OBLIGATION_KINDS in shared/calcPhases.ts.
  kind: varchar("kind").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  outstandingAmount: decimal("outstanding_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: varchar("currency").default("USD"),
  // The funding period this obligation was accrued in (e.g. "Mar 2026").
  fundingPeriod: varchar("funding_period"),
  // Date the obligation hits the GL — depends on contract's accrual basis.
  accrualDate: timestamp("accrual_date").defaultNow(),
  // Date the obligation is scheduled to become claimable / payable.
  plannedReleaseDate: timestamp("planned_release_date"),
  actualReleaseDate: timestamp("actual_release_date"),
  // Date after which any unclaimed amount expires per rolloverPolicy.
  expiryDate: timestamp("expiry_date"),
  // One of OBLIGATION_STATUSES in shared/calcPhases.ts.
  status: varchar("status").notNull().default("accrued"),
  claimedAmount: decimal("claimed_amount", { precision: 15, scale: 2 }).default("0"),
  claimedAt: timestamp("claimed_at"),
  claimReference: varchar("claim_reference"),
  proofUrl: varchar("proof_url"),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  expiredAt: timestamp("expired_at"),
  // Draft JE that books this transition (latest one wins; full history is
  // in obligation_events). FK-wired to journal_entries for referential
  // integrity; ON DELETE SET NULL preserves the obligation if the draft
  // JE is purged.
  linkedJournalEntryId: varchar("linked_journal_entry_id").references(() => journalEntries.id, { onDelete: 'set null' }),
  // Self-FK for true-ups / rollovers — links a true-up obligation back to
  // the original accrual it adjusts.
  relatedObligationId: varchar("related_obligation_id").references((): AnyPgColumn => obligations.id, { onDelete: 'set null' }),
  // Task 68 — Posted-Accrual → Obligation bridge.
  //
  // sourceAccrualId       : the accrual_id (e.g. "ACC-MOHRYC8H") that was
  //                         promoted to this obligation. The promotion
  //                         service treats this as the idempotency key:
  //                         a re-post for the same accrual finds the
  //                         existing obligation and updates it in place
  //                         instead of inserting a duplicate.
  // supersededByObligationId : when finance issues a true-up / clawback
  //                         that REPLACES this obligation, point to the
  //                         replacement here so callers know the row is
  //                         no longer the source of truth. Self-FK.
  // adjustmentReason      : human-readable rationale written by finance
  //                         when an obligation is adjusted or superseded
  //                         (audit trail in obligation_events still
  //                         records who/when/from→to status).
  sourceAccrualId: varchar("source_accrual_id"),
  supersededByObligationId: varchar("superseded_by_obligation_id").references((): AnyPgColumn => obligations.id, { onDelete: 'set null' }),
  adjustmentReason: text("adjustment_reason"),
  rolloverPolicy: varchar("rollover_policy").default("forfeit"), // forfeit | rollover | extend
  notes: text("notes"),
  metadata: jsonb("metadata"),
  // Task 41 — workspace presentation fields
  direction: varchar("direction").default("outbound"), // outbound | inbound
  sourceChannel: varchar("source_channel"),
  agentHandled: boolean("agent_handled").default(false),
  disputeState: varchar("dispute_state").default("none"), // none | open | responded | resolved
  dueAt: timestamp("due_at"),
  visibility: varchar("visibility").default("internal"),
  companyId: varchar("company_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("obligations_contract_idx").on(table.contractId),
  index("obligations_partner_idx").on(table.partnerId),
  index("obligations_kind_idx").on(table.kind),
  index("obligations_status_idx").on(table.status),
  index("obligations_planned_release_idx").on(table.plannedReleaseDate),
  index("obligations_company_idx").on(table.companyId),
  // Task 68 — accrual_id is the idempotency key for promotion. Index it
  // so the upsert lookup in promoteAccrualToObligation is O(log N) and
  // backfill scans don't sequential-scan.
  index("obligations_source_accrual_idx").on(table.sourceAccrualId),
  // Phase 1b — composite for the Period Close Worksheet grid. The grid
  // scans (company_id, funding_period) for every page of every period.
  index("obligations_company_period_idx").on(table.companyId, table.fundingPeriod),
]);

// Per-obligation event log: every state-machine transition writes one row.
export const obligationEvents = pgTable("obligation_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  obligationId: varchar("obligation_id").notNull().references(() => obligations.id, { onDelete: 'cascade' }),
  // accrued | claim_submitted | claim_approved | paid | expired | reversed |
  // recouped | trued_up
  eventType: varchar("event_type").notNull(),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status"),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  description: text("description"),
  userId: varchar("user_id"),
  userName: varchar("user_name"),
  // Phase that emitted this event (obligation_accrual, obligation_release,
  // obligation_expiry, or net_adjustment for recoupment).
  phase: varchar("phase"),
  linkedJournalEntryId: varchar("linked_journal_entry_id").references(() => journalEntries.id, { onDelete: 'set null' }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("obligation_events_obligation_idx").on(table.obligationId),
  index("obligation_events_event_type_idx").on(table.eventType),
]);

export const insertObligationSchema = createInsertSchema(obligations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertObligationEventSchema = createInsertSchema(obligationEvents).omit({
  id: true,
  createdAt: true,
});
export type Obligation = typeof obligations.$inferSelect;
export type InsertObligation = z.infer<typeof insertObligationSchema>;
export type ObligationEvent = typeof obligationEvents.$inferSelect;
export type InsertObligationEvent = z.infer<typeof insertObligationEventSchema>;

// ---------------------------------------------------------------------------
// Recoupment / overpayment balances ledger
// ---------------------------------------------------------------------------
// Per (contract, rule) running balance for stateful net_adjustment rules
// (advance_recoupment, overpayment_offset). The rule's formulaDefinition
// only seeds the STARTING balance the first time a calculation runs against
// it; thereafter the ledger is the authoritative remaining-balance source so
// the same balance can't be consumed twice across periods.
export const recoupmentBalances = pgTable("recoupment_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  ruleId: varchar("rule_id").notNull().references(() => contractRules.id, { onDelete: 'cascade' }),
  // 'advance_recoupment' | 'overpayment_offset' — mirrors contract_rules.rule_type
  // for the stateful net_adjustment family.
  balanceType: varchar("balance_type").notNull(),
  startingBalance: decimal("starting_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  remainingBalance: decimal("remaining_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: varchar("currency").default("USD"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("recoupment_balances_contract_rule_uniq").on(table.contractId, table.ruleId),
  index("recoupment_balances_contract_idx").on(table.contractId),
]);

// Per-period consumption events. One row per (calculation, balance) pair so
// the audit trail shows exactly which calc consumed which portion of which
// balance. Linked to the calculation_rule_results row that actually booked
// the consumption for end-to-end traceability.
export const recoupmentLedgerEntries = pgTable("recoupment_ledger_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  balanceId: varchar("balance_id").notNull().references(() => recoupmentBalances.id, { onDelete: 'cascade' }),
  contractId: varchar("contract_id").notNull(),
  ruleId: varchar("rule_id").notNull(),
  calculationId: varchar("calculation_id"),
  ruleResultId: varchar("rule_result_id"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }).notNull().default("0"),
  consumed: decimal("consumed", { precision: 15, scale: 2 }).notNull().default("0"),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }).notNull().default("0"),
  // 'auto' (default) for engine-booked consumption rows, 'manual_adjustment'
  // for finance-user balance corrections written via the manual-adjustment
  // endpoint. The audit trail uses this to badge the row.
  entryType: varchar("entry_type").notNull().default("auto"),
  // Required when entryType='manual_adjustment': human-readable justification
  // (e.g. "Partner mailed a $5k check on 4/12, applying outside the calc flow").
  reason: text("reason"),
  // User id of the finance user who booked a manual adjustment. Null for
  // auto rows since those are written by the calc engine, not a person.
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("recoupment_ledger_balance_idx").on(table.balanceId),
  index("recoupment_ledger_calculation_idx").on(table.calculationId),
  index("recoupment_ledger_contract_idx").on(table.contractId),
  foreignKey({
    columns: [table.calculationId],
    foreignColumns: [contractCalculations.id],
    name: "recoupment_ledger_entries_calculation_id_contract_calculations_",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.ruleResultId],
    foreignColumns: [calculationRuleResults.id],
    name: "recoupment_ledger_entries_rule_result_id_calculation_rule_resul",
  }).onDelete("set null"),
]);

export const insertRecoupmentBalanceSchema = createInsertSchema(recoupmentBalances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRecoupmentLedgerEntrySchema = createInsertSchema(recoupmentLedgerEntries).omit({
  id: true,
  createdAt: true,
});
export type RecoupmentBalance = typeof recoupmentBalances.$inferSelect;
export type InsertRecoupmentBalance = z.infer<typeof insertRecoupmentBalanceSchema>;
export type RecoupmentLedgerEntry = typeof recoupmentLedgerEntries.$inferSelect;
export type InsertRecoupmentLedgerEntry = z.infer<typeof insertRecoupmentLedgerEntrySchema>;

export const blogs = pgTable("blogs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  slug: varchar("slug").notNull().unique("blogs_slug_key"),
  excerpt: text("excerpt"),
  content: text("content"),
  category: varchar("category").default("General"),
  author: varchar("author").default("LicenseIQ Team"),
  featuredImage: text("featured_image"),
  readTime: varchar("read_time"),
  isFeatured: boolean("is_featured").default(false),
  status: varchar("status").default("draft"),
  publishedAt: timestamp("published_at"),
  metaTitle: varchar("meta_title"),
  metaDescription: text("meta_description"),
  tags: text("tags").array(),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogSchema = createInsertSchema(blogs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBlog = z.infer<typeof insertBlogSchema>;
export type Blog = typeof blogs.$inferSelect;

export const uomMaster = pgTable("uom_master", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uomCode: varchar("uom_code").notNull().unique("uom_master_uom_code_key"),
  uomName: varchar("uom_name").notNull(),
  uomCategory: varchar("uom_category"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  companyId: varchar("company_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const settlements = pgTable("settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  counterparty: varchar("counterparty").notNull(),
  contractId: varchar("contract_id"),
  contractName: varchar("contract_name"),
  claimId: varchar("claim_id"),
  claimRef: varchar("claim_ref"),
  settlementType: varchar("settlement_type").default("customer_rebates"),
  flowType: varchar("flow_type"),
  subtypeInstanceId: varchar("subtype_instance_id"),
  period: varchar("period"),
  accrualAmount: decimal("accrual_amount", { precision: 15, scale: 2 }).default("0"),
  claimAmount: decimal("claim_amount", { precision: 15, scale: 2 }).default("0"),
  variance: decimal("variance", { precision: 15, scale: 2 }).default("0"),
  matchStatus: varchar("match_status").default("open"),
  matchPct: integer("match_pct").default(0),
  settlementStatus: varchar("settlement_status").default("open"),
  // Task 41 — inline dispute state
  disputeState: varchar("dispute_state").default("none"), // none | open | responded | resolved
  disputeReason: text("dispute_reason"),
  aiAnalysis: text("ai_analysis"),
  resolution: varchar("resolution"),
  postedAmount: decimal("posted_amount", { precision: 15, scale: 2 }),
  jeId: varchar("je_id"),
  companyId: varchar("company_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Phase 1b — composite for the Period Close Worksheet grid join.
  index("settlements_contract_period_idx").on(table.contractId, table.period),
]);

export const settlementLineItems = pgTable("settlement_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementId: varchar("settlement_id").notNull(),
  category: varchar("category"),
  lineName: varchar("line_name"),
  accrualAmount: decimal("accrual_amount", { precision: 15, scale: 2 }).default("0"),
  claimAmount: decimal("claim_amount", { precision: 15, scale: 2 }).default("0"),
  variance: decimal("variance", { precision: 15, scale: 2 }).default("0"),
  status: varchar("status").default("pending"),
  sortOrder: integer("sort_order").default(0),
});

export const saleContractMatches = pgTable("sale_contract_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull(),
  contractId: varchar("contract_id").notNull(),
  ruleId: varchar("rule_id"),
  matchType: varchar("match_type").default("category"),
  specificityScore: integer("specificity_score").default(0),
  matchReason: text("match_reason"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SaleContractMatch = typeof saleContractMatches.$inferSelect;
export type InsertSaleContractMatch = typeof saleContractMatches.$inferInsert;

export const uploadedDatasets = pgTable("uploaded_datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  source: varchar("source").default("Manual Upload"),
  records: integer("records").default(0),
  status: varchar("status").default("validated"),
  type: varchar("type").default("sales"),
  validRows: integer("valid_rows"),
  errorRows: integer("error_rows"),
  totalRows: integer("total_rows"),
  matchedContracts: integer("matched_contracts"),
  matchedRecords: integer("matched_records"),
  unmatchedRecords: integer("unmatched_records"),
  avgConfidence: varchar("avg_confidence"),
  companyWide: boolean("company_wide").default(false),
  companyId: varchar("company_id"),
  contractId: varchar("contract_id"),
  uploadedBy: varchar("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const calculationRuns = pgTable("calculation_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  runDate: timestamp("run_date").notNull().defaultNow(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 4 }),
  status: varchar("status").default("draft"),
  evaluationMode: varchar("evaluation_mode"),
  formulaSourceSummary: jsonb("formula_source_summary"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
});

export type CalculationRun = typeof calculationRuns.$inferSelect;
export type InsertCalculationRun = typeof calculationRuns.$inferInsert;

export const calculationAuditItems = pgTable("calculation_audit_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => calculationRuns.id, { onDelete: "cascade" }),
  ruleId: varchar("rule_id").references(() => contractRules.id),
  contractId: varchar("contract_id"),
  sourceClauseRef: varchar("source_clause_ref"),
  transactionIds: jsonb("transaction_ids"),
  inputValue: decimal("input_value", { precision: 15, scale: 4 }),
  calculatedAmount: decimal("calculated_amount", { precision: 15, scale: 4 }),
  formulaSource: varchar("formula_source"),
  formulaSnapshot: jsonb("formula_snapshot"),
  tierMode: varchar("tier_mode"),
  breakdown: jsonb("breakdown"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CalculationAuditItem = typeof calculationAuditItems.$inferSelect;
export type InsertCalculationAuditItem = typeof calculationAuditItems.$inferInsert;

// ===========================================================================
// Task 41 — Finance Hub Phase A: Claims, Documents, Intake Pipeline
// ===========================================================================

// --- Inbound claims (workspace-owned for inbound; outbound reuses obligations)
export const inboundClaims = pgTable("inbound_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimNumber: varchar("claim_number"),
  claimType: varchar("claim_type").notNull(), // price_protection, chargeback, mdf, royalty_statement, rebate_settlement, other
  partnerId: varchar("partner_id"),
  partnerName: varchar("partner_name"),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'set null' }),
  contractName: varchar("contract_name"),
  period: varchar("period"),
  claimedAmount: decimal("claimed_amount", { precision: 15, scale: 2 }).default("0"),
  approvedAmount: decimal("approved_amount", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency").default("USD"),
  status: varchar("status").notNull().default("received"), // received, validating, needs_review, agent_handling, approved, partial_approved, rejected, disputed, settled, escalated
  priority: varchar("priority").default("standard"), // urgent, agent_handling, standard
  agentHandled: boolean("agent_handled").default(false),
  disputeState: varchar("dispute_state").default("none"), // none, open, responded, resolved
  disputeReason: text("dispute_reason"),
  sourceChannel: varchar("source_channel"), // dataiq, customer_ipaas, manual, simulate
  sourceEventId: varchar("source_event_id"),
  externalClaimId: varchar("external_claim_id"), // upstream stable claim id (used for claim.updated correlation)
  legalEntityId: varchar("legal_entity_id"),
  approvalWorkflowId: varchar("approval_workflow_id"), // reserved for Phase C
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp("approved_at"),
  dueAt: timestamp("due_at"),
  linkedDocumentId: varchar("linked_document_id"),
  rawPayload: jsonb("raw_payload"),
  metadata: jsonb("metadata"),
  companyId: varchar("company_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("inbound_claims_status_idx").on(table.status),
  index("inbound_claims_partner_idx").on(table.partnerId),
  index("inbound_claims_contract_idx").on(table.contractId),
  index("inbound_claims_company_idx").on(table.companyId),
  // Tenant-scoped uniqueness — two tenants may legitimately receive the same
  // upstream source_event_id without colliding, mirroring the idempotency
  // model on inbound_event_log(company_id, source_event_id).
  uniqueIndex("inbound_claims_company_source_uq").on(table.companyId, table.sourceEventId),
  // Phase 1b — composite for the Period Close Worksheet grid join.
  index("inbound_claims_contract_period_idx").on(table.contractId, table.period),
]);

export const inboundClaimLines = pgTable("inbound_claim_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").notNull().references(() => inboundClaims.id, { onDelete: 'cascade' }),
  description: text("description"),
  sku: varchar("sku"),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).default("0"),
  unitAmount: decimal("unit_amount", { precision: 15, scale: 4 }).default("0"),
  amount: decimal("amount", { precision: 15, scale: 2 }).default("0"),
  metadata: jsonb("metadata"),
  sortOrder: integer("sort_order").default(0),
}, (table) => [index("inbound_claim_lines_claim_idx").on(table.claimId)]);

export const inboundClaimEvents = pgTable("inbound_claim_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").notNull().references(() => inboundClaims.id, { onDelete: 'cascade' }),
  eventType: varchar("event_type").notNull(),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status"),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  description: text("description"),
  userId: varchar("user_id"),
  userName: varchar("user_name"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("inbound_claim_events_claim_idx").on(table.claimId)]);

// --- Finance documents (AP, AR, CM, DM)
export const financeDocuments = pgTable("finance_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentNumber: varchar("document_number").notNull().unique("finance_documents_document_number_key"),
  documentType: varchar("document_type").notNull(), // ap_invoice, ar_invoice, credit_memo, debit_memo
  partnerId: varchar("partner_id"),
  partnerName: varchar("partner_name"),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'set null' }),
  contractName: varchar("contract_name"),
  period: varchar("period"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: varchar("currency").default("USD"),
  status: varchar("status").notNull().default("draft"), // draft, sent, awaiting_oracle, posted, paid, voided
  oracleDocNumber: varchar("oracle_doc_number"),
  oracleStatus: varchar("oracle_status"), // pending, accepted, rejected
  accrualDate: timestamp("accrual_date"),
  dueDate: timestamp("due_date"),
  sourceClaimId: varchar("source_claim_id"),
  sourceObligationId: varchar("source_obligation_id"),
  jeId: varchar("je_id"),
  legalEntityId: varchar("legal_entity_id"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  companyId: varchar("company_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("finance_docs_type_idx").on(table.documentType),
  index("finance_docs_status_idx").on(table.status),
  index("finance_docs_partner_idx").on(table.partnerId),
  index("finance_docs_contract_idx").on(table.contractId),
  // Phase 1b — composite for the Period Close Worksheet grid join.
  index("finance_documents_contract_period_idx").on(table.contractId, table.period),
]);

export const financeDocumentLines = pgTable("finance_document_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => financeDocuments.id, { onDelete: 'cascade' }),
  description: text("description"),
  sku: varchar("sku"),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).default("0"),
  unitAmount: decimal("unit_amount", { precision: 15, scale: 4 }).default("0"),
  amount: decimal("amount", { precision: 15, scale: 2 }).default("0"),
  glAccount: varchar("gl_account"),
  sortOrder: integer("sort_order").default(0),
}, (table) => [index("finance_doc_lines_doc_idx").on(table.documentId)]);

export const financeDocumentEvents = pgTable("finance_document_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => financeDocuments.id, { onDelete: 'cascade' }),
  eventType: varchar("event_type").notNull(),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status"),
  description: text("description"),
  userId: varchar("user_id"),
  userName: varchar("user_name"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("finance_doc_events_doc_idx").on(table.documentId)]);

// --- Agent activity log (Intake Agent reasoning steps)
export const agentActivity = pgTable("agent_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentName: varchar("agent_name").notNull().default("LicenseIQ Intake Agent"),
  scope: varchar("scope"), // claim, document, event, system
  scopeId: varchar("scope_id"),
  step: varchar("step").notNull(), // received, entity_resolution, validation, decision, escalation
  status: varchar("status").notNull().default("info"), // info, success, warn, error
  summary: text("summary"),
  details: jsonb("details"),
  companyId: varchar("company_id"),
  legalEntityId: varchar("legal_entity_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("agent_activity_scope_idx").on(table.scope, table.scopeId),
  index("agent_activity_company_idx").on(table.companyId),
  index("agent_activity_created_idx").on(table.createdAt),
]);

// --- Contract decision proposer queue (Phase C of agent runtime).
// Each row is an action the agent is suggesting on a specific contract:
// e.g. "mark this expired-but-still-active contract as expired". The user
// can accept (which performs the actionType) or dismiss. We keep the row
// after the decision so we have a full audit log + can show "you dismissed
// this 3 days ago" so we don't keep re-proposing the same thing.
export const contractDecisions = pgTable("contract_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  // Mirrors the morning-brief priority "type" so the UI can group decisions
  // visually next to the brief that produced them.
  proposalType: varchar("proposal_type").notNull(), // expired-active | expiring | missing-rules | pending-review
  urgency: varchar("urgency").notNull().default("med"), // high | med | low
  summary: text("summary").notNull(), // 1-line user-facing description
  // What "Accept" should do. Recognized values are dispatched in
  // server/services/contractProposerService.ts. Unknown values are stored
  // for forward-compat but rejected at accept time so we never silently
  // mutate.
  actionType: varchar("action_type").notNull(), // mark-expired | acknowledge | open-detail
  actionParams: jsonb("action_params"), // optional payload for the action
  status: varchar("status").notNull().default("pending"), // pending | accepted | dismissed
  proposedAt: timestamp("proposed_at").defaultNow(),
  decidedAt: timestamp("decided_at"),
  decidedBy: varchar("decided_by"), // userId who clicked accept/dismiss
  decisionNote: text("decision_note"),
}, (t) => [
  index("contract_decisions_company_idx").on(t.companyId),
  index("contract_decisions_contract_idx").on(t.contractId),
  index("contract_decisions_status_idx").on(t.status),
  // Prevent the proposer from creating duplicate pending decisions for the
  // same contract+proposal-type combination. A unique partial index would
  // be ideal but Drizzle doesn't expose one cleanly; we enforce uniqueness
  // in the proposer code via existence check.
  index("contract_decisions_dedupe_idx").on(t.contractId, t.proposalType, t.status),
]);
export type ContractDecision = typeof contractDecisions.$inferSelect;
export const insertContractDecisionSchema = createInsertSchema(contractDecisions).omit({
  id: true, proposedAt: true, decidedAt: true, decidedBy: true, decisionNote: true, status: true,
});
export type InsertContractDecision = z.infer<typeof insertContractDecisionSchema>;

// ────────── Phase E: Persistent agent threads (contracts domain) ──────────
// Mirrors the close_chat_threads + close_chat_messages pattern. Threads are
// strictly private to a user (enforced in the route layer). Scope is
// portfolio-wide for now — the contracts agent lives at /contracts (a list
// page), not on a single contract — so we key on (userId, companyId) only.
// If we later add per-contract conversations, add a nullable contract_id
// column and an index for it.
export const contractChatThreads = pgTable("contract_chat_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  companyId: varchar("company_id"),
  // Auto-derived from the first user message (truncated to 80 chars). Users
  // can rename via PATCH later if we wire a UI for it.
  title: varchar("title").notNull().default("New conversation"),
  status: varchar("status").notNull().default("active"), // active | archived
  // Sort key for the history dropdown. Updated on every turn.
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("contract_chat_threads_user_idx").on(t.userId),
  index("contract_chat_threads_company_idx").on(t.companyId),
  index("contract_chat_threads_user_status_idx").on(t.userId, t.status),
]);
export type ContractChatThread = typeof contractChatThreads.$inferSelect;
export const insertContractChatThreadSchema = createInsertSchema(contractChatThreads).omit({
  id: true, createdAt: true, lastMessageAt: true, status: true, title: true,
});
export type InsertContractChatThread = z.infer<typeof insertContractChatThreadSchema>;

// One row per turn (user prompt or assistant reply). `content` is jsonb so
// the assistant rows can carry the structured FormattedAnswer payload
// (sources / confidence / toolsUsed) without re-running the LLM on reload.
export const contractChatMessages = pgTable("contract_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => contractChatThreads.id, { onDelete: 'cascade' }),
  role: varchar("role").notNull(), // user | assistant | error
  content: jsonb("content").notNull(), // { text: string, sources?, confidence?, toolsUsed? }
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("contract_chat_messages_thread_idx").on(t.threadId),
  index("contract_chat_messages_thread_created_idx").on(t.threadId, t.createdAt),
]);
export type ContractChatMessage = typeof contractChatMessages.$inferSelect;
export const insertContractChatMessageSchema = createInsertSchema(contractChatMessages).omit({
  id: true, createdAt: true,
});
export type InsertContractChatMessage = z.infer<typeof insertContractChatMessageSchema>;

// --- Inbound event log (every POST to /api/inbound-events)
export const inboundEventLog = pgTable("inbound_event_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id"),
  legalEntityId: varchar("legal_entity_id"),
  companyId: varchar("company_id"),
  sourceEventId: varchar("source_event_id"),
  eventType: varchar("event_type"),
  signatureValid: boolean("signature_valid").default(false),
  outcome: varchar("outcome").notNull(), // accepted, rejected, duplicate, replayed, escalated
  errorMessage: text("error_message"),
  payload: jsonb("payload"),
  result: jsonb("result"),
  receivedAt: timestamp("received_at").defaultNow(),
}, (table) => [
  index("inbound_event_log_key_idx").on(table.apiKeyId),
  index("inbound_event_log_received_idx").on(table.receivedAt),
  // Idempotency is scoped per tenant: two different tenants may legitimately
  // emit the same source_event_id, and one tenant must never observe another
  // tenant's prior result via a duplicate response. The legacy global unique
  // index has been replaced with a (company_id, source_event_id) tuple.
  uniqueIndex("inb_evt_log_company_source_uq").on(table.companyId, table.sourceEventId),
]);

// --- API keys for /api/inbound-events
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyPrefix: varchar("key_prefix").notNull().unique("api_keys_key_prefix_key"), // public id like "liq_live_AB12CD"
  hashedSecret: varchar("hashed_secret").notNull(), // sha256 of secret (legacy lookup)
  encryptedSecret: text("encrypted_secret"), // AES-256-GCM(secret) — required for HMAC verification
  legalEntityId: varchar("legal_entity_id"),
  companyId: varchar("company_id"), // tenant scope
  label: varchar("label"),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"),
  revokedAt: timestamp("revoked_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("api_keys_prefix_idx").on(table.keyPrefix)]);

// --- claim_type → document_type config
export const claimTypeOutcome = pgTable("claim_type_outcome", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimType: varchar("claim_type").notNull(),
  direction: varchar("direction").notNull(), // inbound, outbound
  documentType: varchar("document_type").notNull(),
  description: text("description"),
}, (t) => ({
  claimTypeDirectionUq: uniqueIndex("claim_type_outcome_type_dir_uq").on(t.claimType, t.direction),
}));

export const insertInboundClaimSchema = createInsertSchema(inboundClaims).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFinanceDocumentSchema = createInsertSchema(financeDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export type InboundClaim = typeof inboundClaims.$inferSelect;
export type InsertInboundClaim = z.infer<typeof insertInboundClaimSchema>;
export type InboundClaimLine = typeof inboundClaimLines.$inferSelect;
export type InboundClaimEvent = typeof inboundClaimEvents.$inferSelect;
export type FinanceDocument = typeof financeDocuments.$inferSelect;
export type InsertFinanceDocument = z.infer<typeof insertFinanceDocumentSchema>;
export type FinanceDocumentLine = typeof financeDocumentLines.$inferSelect;
export type FinanceDocumentEvent = typeof financeDocumentEvents.$inferSelect;
export type AgentActivity = typeof agentActivity.$inferSelect;
export type InboundEventLogEntry = typeof inboundEventLog.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type ClaimTypeOutcome = typeof claimTypeOutcome.$inferSelect;

// --- Deductions (Finance Hub Phase B): customer short-pays / chargebacks
export const deductionReasonCodes = pgTable("deduction_reason_codes", {
  code: varchar("code").primaryKey(),
  description: text("description").notNull(),
  defaultDisposition: varchar("default_disposition").notNull().default("dispute"), // write_off | dispute | match
  isActive: boolean("is_active").default(true),
});

export const deductions = pgTable("deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  partnerId: varchar("partner_id"),
  partnerName: varchar("partner_name"),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'set null' }),
  contractName: varchar("contract_name"),
  deductionNumber: varchar("deduction_number"),
  deductedAmount: decimal("deducted_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: varchar("currency").default("USD"),
  deductionDate: timestamp("deduction_date").defaultNow(),
  originalInvoiceRef: varchar("original_invoice_ref"),
  reasonCode: varchar("reason_code").references(() => deductionReasonCodes.code, { onDelete: 'set null' }),
  reasonText: text("reason_text"),
  status: varchar("status").notNull().default("needs_review"), // open | needs_review | matched | disputed | written_off | recovered
  validityScore: real("validity_score").default(0),
  matchedClaimId: varchar("matched_claim_id").references(() => inboundClaims.id, { onDelete: 'set null' }),
  matchedObligationId: varchar("matched_obligation_id").references(() => obligations.id, { onDelete: 'set null' }),
  sourceChannel: varchar("source_channel").default("manual"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("deductions_company_idx").on(table.companyId),
  index("deductions_status_idx").on(table.status),
  index("deductions_partner_idx").on(table.partnerId),
  uniqueIndex("deductions_company_number_uq").on(table.companyId, table.deductionNumber),
]);

export const deductionEvents = pgTable("deduction_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deductionId: varchar("deduction_id").notNull().references(() => deductions.id, { onDelete: 'cascade' }),
  eventType: varchar("event_type").notNull(),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status"),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  description: text("description"),
  userId: varchar("user_id"),
  userName: varchar("user_name"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("deduction_events_deduction_idx").on(table.deductionId)]);

export const insertDeductionSchema = createInsertSchema(deductions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDeductionReasonCodeSchema = createInsertSchema(deductionReasonCodes);
export type Deduction = typeof deductions.$inferSelect;
export type InsertDeduction = z.infer<typeof insertDeductionSchema>;
export type DeductionEvent = typeof deductionEvents.$inferSelect;
export type DeductionReasonCode = typeof deductionReasonCodes.$inferSelect;

// --- Multi-step approvals (Finance Hub Phase B)
// Chains describe the ordered approval ladder for a given entity scope.
// Steps reference roles (not specific users) so the engine resolves a pool of
// eligible approvers at decision time, supporting role rotation/back-fill.
export const approvalChains = pgTable("approval_chains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  // Scope = document type. See server/services/approvalDocTypes.ts for the
  // canonical catalog (contract, contract_change, claim, manual_accrual,
  // journal_entry, deduction, document, period_close).
  scope: varchar("scope").notNull(),
  // Optional sub-type filter (e.g. claim_type=mdf, contract_type=royalty_license).
  subtype: varchar("subtype"),
  // Optional direction filter (claims: inbound | outbound).
  direction: varchar("direction"),
  description: text("description"),
  minAmount: decimal("min_amount", { precision: 15, scale: 2 }).default("0"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  companyId: varchar("company_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("approval_chains_scope_idx").on(t.scope, t.companyId),
]);

export const approvalChainSteps = pgTable("approval_chain_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chainId: varchar("chain_id").notNull().references(() => approvalChains.id, { onDelete: 'cascade' }),
  sequence: integer("sequence").notNull(), // 1-based
  approverRole: varchar("approver_role").notNull(), // matches users.role / system role code
  label: varchar("label"), // friendly step name e.g. "Finance Lead"
  requiresAll: boolean("requires_all").default(false), // true = every eligible approver must approve
  // Service-level agreement (hours). NULL = no SLA enforced for this step.
  slaHours: integer("sla_hours"),
  // Send a reminder email every N hours while this step is pending.
  reminderHours: integer("reminder_hours"),
  // What to do when the SLA expires: none | escalate | auto_approve | auto_reject.
  // "escalate" means advance to the next step (or finalize as approved if last).
  onTimeoutAction: varchar("on_timeout_action").default("none"),
}, (t) => [
  index("approval_chain_steps_chain_idx").on(t.chainId),
]);

export const approvalRequests = pgTable("approval_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chainId: varchar("chain_id").notNull().references(() => approvalChains.id, { onDelete: 'restrict' }),
  entityType: varchar("entity_type").notNull(), // claim | document | deduction
  entityId: varchar("entity_id").notNull(),
  entityLabel: varchar("entity_label"), // human-readable summary at request time
  amount: decimal("amount", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency").default("USD"),
  currentStep: integer("current_step").notNull().default(1),
  status: varchar("status").notNull().default("pending"), // pending | approved | rejected | cancelled
  requestedBy: varchar("requested_by"),
  requestedAt: timestamp("requested_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  companyId: varchar("company_id"),
  // SLA + reminder tracking for the *current* step. Reset whenever the
  // request advances to a new step.
  currentStepDueAt: timestamp("current_step_due_at"),
  lastReminderAt: timestamp("last_reminder_at"),
}, (t) => [
  index("approval_requests_status_idx").on(t.status),
  index("approval_requests_entity_idx").on(t.entityType, t.entityId),
  index("approval_requests_company_idx").on(t.companyId),
]);

// Audit log of every approval-related email we attempted to send. Lets the
// scheduler avoid re-sending duplicate "request" notifications for the same
// step and gives admins forensic visibility when an approver claims they
// "never got an email".
export const approvalNotifications = pgTable("approval_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => approvalRequests.id, { onDelete: 'cascade' }),
  step: integer("step").notNull(),
  kind: varchar("kind").notNull(), // request | reminder | approved | rejected | escalated | auto_decided
  recipientEmail: varchar("recipient_email").notNull(),
  recipientUserId: varchar("recipient_user_id"),
  sentAt: timestamp("sent_at").defaultNow(),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
}, (t) => [
  index("approval_notifications_request_idx").on(t.requestId),
]);

export const approvalDecisions = pgTable("approval_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => approvalRequests.id, { onDelete: 'cascade' }),
  step: integer("step").notNull(),
  approverId: varchar("approver_id"),
  approverName: varchar("approver_name"),
  approverRole: varchar("approver_role"),
  decision: varchar("decision").notNull(), // approve | reject
  comment: text("comment"),
  decidedAt: timestamp("decided_at").defaultNow(),
}, (t) => [
  index("approval_decisions_request_idx").on(t.requestId),
]);

export type ApprovalChain = typeof approvalChains.$inferSelect;
export type ApprovalChainStep = typeof approvalChainSteps.$inferSelect;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type ApprovalDecision = typeof approvalDecisions.$inferSelect;
export type ApprovalNotification = typeof approvalNotifications.$inferSelect;

// ============================================================================
// FLOW / SUBTYPE TAXONOMY (Round 1 — Phases 1–5b)
// ============================================================================
// flow_types  : 6 contract-level flows (VRP, CRP, RLA, SUB, RSM, OEM) — defined above.
// subtypes    : 10 rule-level subtypes (RA, CB, PP, MDF, ROY, RSS, PTR, SBE, COM, MIN).
// flow_subtype_validity : matrix of which (flow_type, subtype) pairs are allowed.
// subtype_instances     : per-(contract, subtype) container that owns the rules + policies.
// accrual_policies      : versioned 1:1 with subtype_instance.
// settlement_policies   : versioned 1:1 with subtype_instance, with 5 child detail tables.
// rule_types            : 6 canonical rule_type codes used by the calculation engines.
// ============================================================================

export const subtypes = pgTable("subtypes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").unique("subtypes_code_key").notNull(), // RA, CB, PP, MDF, ROY, RSS, PTR, SBE, COM, MIN
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // financial | operational
  defaultAggregationPeriod: varchar("default_aggregation_period").notNull().default("per_sale"),
  defaultEngineHandler: varchar("default_engine_handler").notNull().default("universal"),
  defaultGlAccount: varchar("default_gl_account"),
  defaultFinanceHubTab: varchar("default_finance_hub_tab"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const flowSubtypeValidity = pgTable("flow_subtype_validity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flowTypeCode: varchar("flow_type_code").notNull().references(() => flowTypes.code, { onDelete: 'cascade' }),
  subtypeCode: varchar("subtype_code").notNull().references(() => subtypes.code, { onDelete: 'cascade' }),
  isPrimary: boolean("is_primary").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("flow_subtype_validity_pair_idx").on(table.flowTypeCode, table.subtypeCode),
]);

export const subtypeInstances = pgTable("subtype_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  subtypeCode: varchar("subtype_code").notNull().references(() => subtypes.code),
  label: varchar("label").notNull(), // human auto-label, e.g. "TechSound — Volume Rebate"
  status: varchar("status").notNull().default("active"), // active | superseded | archived
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("subtype_instances_contract_idx").on(table.contractId),
  index("subtype_instances_subtype_idx").on(table.subtypeCode),
]);

export const accrualPolicies = pgTable("accrual_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subtypeInstanceId: varchar("subtype_instance_id").notNull().references(() => subtypeInstances.id, { onDelete: 'cascade' }),
  versionNum: integer("version_num").notNull().default(1),
  isCurrent: boolean("is_current").notNull().default(true),
  // Aggregation period (e.g. per_sale, monthly, quarterly, annual) — used by calculationService.
  aggregationPeriod: varchar("aggregation_period").notNull().default("per_sale"),
  // When the obligation accrues to the books: 'qualifying_sale' | 'scheduled_release'.
  obligationAccrualBasis: varchar("obligation_accrual_basis").notNull().default("qualifying_sale"),
  // GL account override (else falls back to subtype.default_gl_account).
  glAccount: varchar("gl_account"),
  // Finance Hub tab override (else falls back to subtype.default_finance_hub_tab).
  financeHubTab: varchar("finance_hub_tab"),
  // Per-period release behaviour.
  releaseTriggerType: varchar("release_trigger_type").notNull().default("period_end"), // period_end | claim_received | manual | sale_event
  notes: text("notes"),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  supersededBy: varchar("superseded_by"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("accrual_policies_instance_idx").on(table.subtypeInstanceId),
  uniqueIndex("accrual_policies_current_idx").on(table.subtypeInstanceId).where(sql`is_current = true`),
  foreignKey({
    columns: [table.supersededBy],
    foreignColumns: [table.id],
    name: "accrual_policies_superseded_by_fk",
  }),
]);

export const settlementPolicies = pgTable("settlement_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subtypeInstanceId: varchar("subtype_instance_id").notNull().references(() => subtypeInstances.id, { onDelete: 'cascade' }),
  versionNum: integer("version_num").notNull().default(1),
  isCurrent: boolean("is_current").notNull().default(true),
  notes: text("notes"),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  supersededBy: varchar("superseded_by"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("settlement_policies_instance_idx").on(table.subtypeInstanceId),
  uniqueIndex("settlement_policies_current_idx").on(table.subtypeInstanceId).where(sql`is_current = true`),
  foreignKey({
    columns: [table.supersededBy],
    foreignColumns: [table.id],
    name: "settlement_policies_superseded_by_fk",
  }),
]);

export const paymentSchedules = pgTable("payment_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementPolicyId: varchar("settlement_policy_id").notNull(),
  cadence: varchar("cadence").notNull().default("quarterly"), // monthly | quarterly | annual | event_driven
  paymentTermsDays: integer("payment_terms_days").notNull().default(30), // net X days
  paymentDay: integer("payment_day"), // day-of-month for scheduled payouts
  trueUpCadence: varchar("true_up_cadence"), // optional true-up cadence (e.g., annual)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("payment_schedules_policy_idx").on(table.settlementPolicyId),
  foreignKey({
    columns: [table.settlementPolicyId],
    foreignColumns: [settlementPolicies.id],
    name: "pmt_sched_set_pol_fk",
  }).onDelete('cascade'),
]);

export const settlementMethods = pgTable("settlement_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementPolicyId: varchar("settlement_policy_id").notNull(),
  method: varchar("method").notNull().default("ach"), // ach | wire | check | credit_memo | offset
  bankAccountRef: varchar("bank_account_ref"),
  remitToParty: varchar("remit_to_party").default("counterparty"), // counterparty | organization | other
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("settlement_methods_policy_idx").on(table.settlementPolicyId),
  foreignKey({
    columns: [table.settlementPolicyId],
    foreignColumns: [settlementPolicies.id],
    name: "set_meth_set_pol_fk",
  }).onDelete('cascade'),
]);

export const overpaymentHandlings = pgTable("overpayment_handlings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementPolicyId: varchar("settlement_policy_id").notNull(),
  // What to do when claim/payment exceeds accrual: 'offset_next' | 'refund' | 'write_off' | 'hold'
  strategy: varchar("strategy").notNull().default("offset_next"),
  thresholdAmount: decimal("threshold_amount", { precision: 15, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("overpayment_handlings_policy_idx").on(table.settlementPolicyId),
  foreignKey({
    columns: [table.settlementPolicyId],
    foreignColumns: [settlementPolicies.id],
    name: "over_hand_set_pol_fk",
  }).onDelete('cascade'),
]);

export const disputeHandlings = pgTable("dispute_handlings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementPolicyId: varchar("settlement_policy_id").notNull(),
  // What happens when counterparty disputes: 'hold_payment' | 'partial_pay' | 'escalate' | 'auto_resolve_credit'
  defaultStrategy: varchar("default_strategy").notNull().default("hold_payment"),
  responseSlaDays: integer("response_sla_days").default(15),
  escalationContact: varchar("escalation_contact"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("dispute_handlings_policy_idx").on(table.settlementPolicyId),
  foreignKey({
    columns: [table.settlementPolicyId],
    foreignColumns: [settlementPolicies.id],
    name: "disp_hand_set_pol_fk",
  }).onDelete('cascade'),
]);

export const fxRules = pgTable("fx_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementPolicyId: varchar("settlement_policy_id").notNull().references(() => settlementPolicies.id, { onDelete: 'cascade' }),
  // Rate source: 'contract_rate' | 'period_avg' | 'spot_at_settlement' | 'fixed'
  rateSource: varchar("rate_source").notNull().default("spot_at_settlement"),
  fixedRate: decimal("fixed_rate", { precision: 15, scale: 6 }),
  baseCurrency: varchar("base_currency").default("USD"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("fx_rules_policy_idx").on(table.settlementPolicyId),
]);

export const ruleTypes = pgTable("rule_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").unique("rule_types_code_key").notNull(), // percentage, per_unit, flat_amount, tiered_volume, tiered_cumulative, metered_usage
  name: varchar("name").notNull(),
  description: text("description"),
  engineHandler: varchar("engine_handler").notNull().default("universal"), // universal | legacy
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas + types for new taxonomy tables
export const insertSubtypeSchema = createInsertSchema(subtypes).omit({ id: true, createdAt: true, updatedAt: true });
export type Subtype = typeof subtypes.$inferSelect;
export type InsertSubtype = z.infer<typeof insertSubtypeSchema>;

export const insertFlowSubtypeValiditySchema = createInsertSchema(flowSubtypeValidity).omit({ id: true, createdAt: true });
export type FlowSubtypeValidity = typeof flowSubtypeValidity.$inferSelect;
export type InsertFlowSubtypeValidity = z.infer<typeof insertFlowSubtypeValiditySchema>;

// === Flow Type Prompts (Pass 1: keyed by flow_type_code) =====================
// Mirrors the prompt-column shape of contract_type_definitions but keyed by
// the new pipeline flow type (CRP/RLA/VRP/SUB/RSM/OEM, …). Authored via
// System Settings → AI Prompts → Flow Type Prompts. The extraction loader
// prefers these over legacy contract_type prompts when a flow_type_code is
// set on the contract. Both Legacy + RAG mode prompts supported.
export const flowTypePrompts = pgTable("flow_type_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flowTypeCode: varchar("flow_type_code").notNull().unique("flow_type_prompts_flow_type_code_key").references(() => flowTypes.code, { onDelete: 'cascade' }),
  // Legacy mode prompts
  extractionPrompt: text("extraction_prompt"),
  ruleExtractionPrompt: text("rule_extraction_prompt"),
  erpMappingPrompt: text("erp_mapping_prompt"),
  sampleExtractionOutput: text("sample_extraction_output"),
  // RAG mode prompts (chunk-based with mandatory citations)
  ragExtractionPrompt: text("rag_extraction_prompt"),
  ragRuleExtractionPrompt: text("rag_rule_extraction_prompt"),
  ragSampleExtractionOutput: text("rag_sample_extraction_output"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFlowTypePromptSchema = createInsertSchema(flowTypePrompts).omit({ id: true, createdAt: true, updatedAt: true });
export type FlowTypePrompt = typeof flowTypePrompts.$inferSelect;
export type InsertFlowTypePrompt = z.infer<typeof insertFlowTypePromptSchema>;

// === Subtype / Program Prompts (Pass 1: keyed by subtype_code) ===============
// Optional per-program prompt overrides for each financial/operational subtype
// (RA/ROY/RSS/PP/MDF/CB/MIN/PTR/COM/SBE). Most specific in the resolution
// chain — applied first when a contract has a subtype instance whose code
// matches. Falls through to flow-type prompts, then legacy contract-type
// prompts, then the hard-coded defaults.
export const subtypePrompts = pgTable("subtype_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subtypeCode: varchar("subtype_code").notNull().unique("subtype_prompts_subtype_code_key").references(() => subtypes.code, { onDelete: 'cascade' }),
  // Legacy mode prompts
  extractionPrompt: text("extraction_prompt"),
  ruleExtractionPrompt: text("rule_extraction_prompt"),
  erpMappingPrompt: text("erp_mapping_prompt"),
  sampleExtractionOutput: text("sample_extraction_output"),
  // RAG mode prompts
  ragExtractionPrompt: text("rag_extraction_prompt"),
  ragRuleExtractionPrompt: text("rag_rule_extraction_prompt"),
  ragSampleExtractionOutput: text("rag_sample_extraction_output"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSubtypePromptSchema = createInsertSchema(subtypePrompts).omit({ id: true, createdAt: true, updatedAt: true });
export type SubtypePrompt = typeof subtypePrompts.$inferSelect;
export type InsertSubtypePrompt = z.infer<typeof insertSubtypePromptSchema>;

export const insertSubtypeInstanceSchema = createInsertSchema(subtypeInstances).omit({ id: true, createdAt: true, updatedAt: true });
export type SubtypeInstance = typeof subtypeInstances.$inferSelect;
export type InsertSubtypeInstance = z.infer<typeof insertSubtypeInstanceSchema>;

export const insertAccrualPolicySchema = createInsertSchema(accrualPolicies).omit({ id: true, createdAt: true, updatedAt: true });
export type AccrualPolicy = typeof accrualPolicies.$inferSelect;
export type InsertAccrualPolicy = z.infer<typeof insertAccrualPolicySchema>;

export const insertSettlementPolicySchema = createInsertSchema(settlementPolicies).omit({ id: true, createdAt: true, updatedAt: true });
export type SettlementPolicy = typeof settlementPolicies.$inferSelect;
export type InsertSettlementPolicy = z.infer<typeof insertSettlementPolicySchema>;

export const insertPaymentScheduleSchema = createInsertSchema(paymentSchedules).omit({ id: true, createdAt: true, updatedAt: true });
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;
export type InsertPaymentSchedule = z.infer<typeof insertPaymentScheduleSchema>;

export const insertSettlementMethodSchema = createInsertSchema(settlementMethods).omit({ id: true, createdAt: true, updatedAt: true });
export type SettlementMethod = typeof settlementMethods.$inferSelect;
export type InsertSettlementMethod = z.infer<typeof insertSettlementMethodSchema>;

export const insertOverpaymentHandlingSchema = createInsertSchema(overpaymentHandlings).omit({ id: true, createdAt: true, updatedAt: true });
export type OverpaymentHandling = typeof overpaymentHandlings.$inferSelect;
export type InsertOverpaymentHandling = z.infer<typeof insertOverpaymentHandlingSchema>;

export const insertDisputeHandlingSchema = createInsertSchema(disputeHandlings).omit({ id: true, createdAt: true, updatedAt: true });
export type DisputeHandling = typeof disputeHandlings.$inferSelect;
export type InsertDisputeHandling = z.infer<typeof insertDisputeHandlingSchema>;

export const insertFxRuleSchema = createInsertSchema(fxRules).omit({ id: true, createdAt: true, updatedAt: true });
export type FxRule = typeof fxRules.$inferSelect;
export type InsertFxRule = z.infer<typeof insertFxRuleSchema>;

export const insertRuleTypeSchema = createInsertSchema(ruleTypes).omit({ id: true, createdAt: true, updatedAt: true });
export type RuleType = typeof ruleTypes.$inferSelect;
export type InsertRuleType = z.infer<typeof insertRuleTypeSchema>;

// ============================================================================
// CONTRACT TEMPLATES (Task #46 — matrix-driven, replaces 9 hardcoded templates)
// ============================================================================
// Templates declare a flow_type_code only; rule + clause slot generation
// queries flow_subtype_validity at seed time and at contract-create time so
// admin matrix edits never break templates. Snapshot semantics: when a contract
// is created from a template, template data is copied onto the contract — later
// edits to the template do NOT propagate.
//
// isSystem=true rows are reseeded on startup but never overwritten.
// User-owned templates (isSystem=false) are independent and immune to reseed.
// visibility='public' means visible to all users in the same companyId;
// 'private' means only the creator. No system-wide user templates.
// ============================================================================

export const contractTemplates = pgTable("contract_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flowTypeCode: varchar("flow_type_code").notNull().references(() => flowTypes.code, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  // 'public' = visible company-wide; 'private' = creator only.
  // Ignored for system templates (always visible to everyone).
  visibility: varchar("visibility").notNull().default("private"),
  ownerUserId: varchar("owner_user_id"),
  companyId: varchar("company_id"),
  parentTemplateId: varchar("parent_template_id"),
  versionNum: integer("version_num").notNull().default(1),
  // 'minimal' | 'standard' | 'maximal' — controls what was snapshotted from
  // the originating contract when the template was saved.
  snapshotScope: varchar("snapshot_scope").notNull().default("standard"),
  // Denormalized jsonb so we don't need parallel child tables.
  partyRoleSlots: jsonb("party_role_slots"),
  accrualPolicies: jsonb("accrual_policies"),
  // Optional snapshot of the originating contract's sales sample (Maximal scope).
  salesSampleCsv: text("sales_sample_csv"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("contract_templates_flow_idx").on(table.flowTypeCode),
  index("contract_templates_owner_idx").on(table.ownerUserId),
  index("contract_templates_company_idx").on(table.companyId),
  uniqueIndex("contract_templates_system_flow_idx")
    .on(table.flowTypeCode)
    .where(sql`is_system = true`),
  foreignKey({
    columns: [table.parentTemplateId],
    foreignColumns: [table.id],
    name: "contract_templates_parent_fk",
  }).onDelete('set null'),
]);

export const templateClauses = pgTable("template_clauses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => contractTemplates.id, { onDelete: 'cascade' }),
  // Subtype this clause belongs to (drives matrix-aware filtering at create time).
  subtypeCode: varchar("subtype_code").references(() => subtypes.code, { onDelete: 'set null' }),
  text: text("text").notNull(),
  clauseCategoryCode: varchar("clause_category_code"),
  isPrimary: boolean("is_primary").notNull().default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("template_clauses_template_idx").on(table.templateId),
  index("template_clauses_subtype_idx").on(table.subtypeCode),
]);

export const templateRules = pgTable("template_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => contractTemplates.id, { onDelete: 'cascade' }),
  // Subtype this rule belongs to (drives matrix-aware filtering at create time).
  subtypeCode: varchar("subtype_code").references(() => subtypes.code, { onDelete: 'set null' }),
  ruleName: varchar("rule_name").notNull(),
  description: text("description"),
  ruleType: varchar("rule_type").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  // Single jsonb captures the full rule shape so snapshotting and re-hydrating
  // is symmetric. Mirrors the contract_rules columns the engine consumes.
  payload: jsonb("payload").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("template_rules_template_idx").on(table.templateId),
  index("template_rules_subtype_idx").on(table.subtypeCode),
]);

export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;

export const insertTemplateClauseSchema = createInsertSchema(templateClauses).omit({ id: true, createdAt: true });
export type TemplateClause = typeof templateClauses.$inferSelect;
export type InsertTemplateClause = z.infer<typeof insertTemplateClauseSchema>;

export const insertTemplateRuleSchema = createInsertSchema(templateRules).omit({ id: true, createdAt: true });
export type TemplateRule = typeof templateRules.$inferSelect;
export type InsertTemplateRule = z.infer<typeof insertTemplateRuleSchema>;

// ===========================================================================
// Subledger Close Workspace — AI Co-Pilot + Worksheet (Phase 1)
// ===========================================================================
// Six tables that power the Period Close subledger workspace shipped as
// Variants C (Worksheet) and D (Co-Pilot). Spec: docs/period-close-data-model.md
//
//   close_chat_threads     ─ Co-Pilot conversation containers (private to user)
//   close_decisions        ─ AI-proposed actions awaiting human approval
//   close_chat_messages    ─ append-only chat turns + tool-use blocks
//   pinned_kpis            ─ saved AI-generated custom KPIs
//   close_saved_views      ─ Worksheet presets + cross-mode handoff state
//   close_batch_operations ─ idempotency receipts for batch JE/settle/claim
//
// Decisions locked in §9 of the spec: pins default user-private, threads
// always private, decisions company-visible, 12h decision TTL with hard
// cap on lock, Claude Sonnet primary with gpt-4o visible fallback,
// SSE for streaming, two-tier KPI flow (free-form ask → structured pin).

export const closeChatThreads = pgTable("close_chat_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: varchar("period_id").notNull().references(() => periodClose.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title").default("Untitled close session"),
  // Optional scope context — when the thread was spawned with a filter
  // (e.g. "rebates only" or selection of obligations) this preserves it
  // so the model can reference what's in scope.
  // Shape: { flow?: string[], status?: string[], obligationIds?: string[] }
  scopeFilter: jsonb("scope_filter"),
  // The provider/model active at thread creation. Per-message provider/
  // model are stored on close_chat_messages so a Claude→OpenAI fallback
  // mid-thread is auditable per the locked design.
  modelProvider: varchar("model_provider").default("anthropic"),
  modelName: varchar("model_name"),
  status: varchar("status").default("active"), // active | archived
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  companyId: varchar("company_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("close_chat_threads_period_user_idx").on(t.periodId, t.userId),
  index("close_chat_threads_company_idx").on(t.companyId),
]);

export const insertCloseChatThreadSchema = createInsertSchema(closeChatThreads).omit({ id: true, createdAt: true, updatedAt: true });
export type CloseChatThread = typeof closeChatThreads.$inferSelect;
export type InsertCloseChatThread = z.infer<typeof insertCloseChatThreadSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Decisions — defined before close_chat_messages because messages back-ref
// the decision they proposed via decisionId.
// ─────────────────────────────────────────────────────────────────────────────
export const closeDecisions = pgTable("close_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: varchar("period_id").notNull().references(() => periodClose.id, { onDelete: 'cascade' }),
  threadId: varchar("thread_id").references(() => closeChatThreads.id, { onDelete: 'set null' }),
  // Back-ref to the assistant message that proposed it. No FK to avoid
  // declaration cycle (close_chat_messages references close_decisions).
  messageId: varchar("message_id"),
  // Allow-list, enforced server-side in the route handler:
  //   post_jes | settle_obligations | resolve_claims | apply_deductions
  //   | reverse_accruals | release_obligations | hold_for_review
  //   | request_info | flag_blocker
  actionType: varchar("action_type").notNull(),
  // Action-type-specific payload, validated by Zod against an action-type
  // discriminated union before insert.
  payload: jsonb("payload").notNull(),
  // Denormalized for fast filtering of the Decision Queue UI without
  // having to crack the payload jsonb on every list render.
  affectedObligationIds: text("affected_obligation_ids").array(),
  affectedAmount: decimal("affected_amount", { precision: 15, scale: 2 }),
  affectedCount: integer("affected_count").default(0),
  riskLevel: varchar("risk_level").default("low"), // low | medium | high | requires_controller
  rationale: text("rationale"),
  // Citations: [{type:'obligation',id:'...',note:'...'}]
  citations: jsonb("citations"),
  // State machine: pending | approved | rejected | executed | failed | expired | superseded
  status: varchar("status").notNull().default("pending"),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  executedAt: timestamp("executed_at"),
  // Forward-ref to closeBatchOperations (defined below) — no FK to avoid cycle.
  batchOperationId: varchar("batch_operation_id"),
  executionError: text("execution_error"),
  // 12h server-side default — set at insert time via DEFAULT now() + interval.
  expiresAt: timestamp("expires_at").default(sql`now() + interval '12 hours'`),
  // Set when lazy-supersession check finds an affected obligation has been
  // modified after the decision was created (per locked design §9 #2).
  supersededAt: timestamp("superseded_at"),
  supersededReason: text("superseded_reason"),
  companyId: varchar("company_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("close_decisions_period_status_idx").on(t.periodId, t.status),
  index("close_decisions_thread_idx").on(t.threadId),
  index("close_decisions_company_idx").on(t.companyId),
]);

export const insertCloseDecisionSchema = createInsertSchema(closeDecisions).omit({ id: true, createdAt: true, updatedAt: true });
export type CloseDecision = typeof closeDecisions.$inferSelect;
export type InsertCloseDecision = z.infer<typeof insertCloseDecisionSchema>;

export const closeChatMessages = pgTable("close_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => closeChatThreads.id, { onDelete: 'cascade' }),
  // Standard chat-completion roles plus 'tool' for tool-call results.
  role: varchar("role").notNull(), // user | assistant | tool | system
  // Anthropic-style content blocks: [{type:'text',text:...},{type:'tool_use',...}]
  // Persisted as JSON so multi-modal content and tool-use calls don't need a
  // separate columnar encoding per provider.
  content: jsonb("content").notNull(),
  // Per-message provider/model, populated for assistant messages only.
  // Lets a Claude→OpenAI fallback within a thread be audited (locked decision §9 #3).
  modelProvider: varchar("model_provider"),
  modelName: varchar("model_name"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  // If this assistant message proposed a decision, point to it. NULL for plain Q&A.
  decisionId: varchar("decision_id").references(() => closeDecisions.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("close_chat_messages_thread_idx").on(t.threadId, t.createdAt),
]);

export const insertCloseChatMessageSchema = createInsertSchema(closeChatMessages).omit({ id: true, createdAt: true });
export type CloseChatMessage = typeof closeChatMessages.$inferSelect;
export type InsertCloseChatMessage = z.infer<typeof insertCloseChatMessageSchema>;

export const pinnedKpis = pgTable("pinned_kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Default is user-private; explicit "Share with team" promotes to company.
  scope: varchar("scope").notNull().default("user"), // user | company
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id"),
  prompt: text("prompt").notNull(),
  label: varchar("label").notNull(),
  // The constrained query plan that re-runs this KPI deterministically.
  // Shape: { aggregation: 'sum'|'count'|'avg', dimensions: [...],
  //          filters: [...], metric: '...', comparison?: 'mom'|'yoy'|'ytd' }
  // Required for pinning (per locked decision §9 #5); NULL falls through
  // to "ask only, can't be pinned" rejection at promote time.
  queryPlan: jsonb("query_plan"),
  preferredChart: varchar("preferred_chart").default("number"), // number | bar | line | sparkline | concentration
  iconHint: varchar("icon_hint"),
  severity: varchar("severity"), // info | warning | alert
  sortOrder: integer("sort_order").default(0),
  lastRunAt: timestamp("last_run_at"),
  // Cached result for instant first-paint render.
  lastRunValue: jsonb("last_run_value"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("pinned_kpis_owner_idx").on(t.ownerUserId, t.scope),
  index("pinned_kpis_company_idx").on(t.companyId, t.scope),
]);

export const insertPinnedKpiSchema = createInsertSchema(pinnedKpis).omit({ id: true, createdAt: true, updatedAt: true });
export type PinnedKpi = typeof pinnedKpis.$inferSelect;
export type InsertPinnedKpi = z.infer<typeof insertPinnedKpiSchema>;

export const closeSavedViews = pgTable("close_saved_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // saved   = user-curated preset
  // handoff = transient state when switching Worksheet ↔ Co-Pilot (5-min TTL)
  // autosave = last-used filter restore on next visit
  kind: varchar("kind").notNull().default("saved"),
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: 'cascade' }),
  scope: varchar("scope").notNull().default("user"), // user | company
  companyId: varchar("company_id"),
  name: varchar("name"), // null for handoff/autosave
  // { flows?: string[], statuses?: string[], partners?: string[],
  //   pipelineStages?: string[], hasBlocker?: boolean,
  //   amountMin?: number, amountMax?: number, search?: string }
  filters: jsonb("filters").notNull().default(sql`'{}'::jsonb`),
  // { visible: string[], order: string[], widths: {col: number} }
  columnConfig: jsonb("column_config"),
  // Selected obligation ids — populated for handoff so destination view
  // can pick up the same selection.
  selectedObligationIds: text("selected_obligation_ids").array(),
  fromMode: varchar("from_mode"), // worksheet | copilot | null
  toMode: varchar("to_mode"),     // worksheet | copilot | null
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("close_saved_views_owner_idx").on(t.ownerUserId, t.kind),
  index("close_saved_views_company_idx").on(t.companyId, t.kind),
]);

export const insertCloseSavedViewSchema = createInsertSchema(closeSavedViews).omit({ id: true, createdAt: true, updatedAt: true });
export type CloseSavedView = typeof closeSavedViews.$inferSelect;
export type InsertCloseSavedView = z.infer<typeof insertCloseSavedViewSchema>;

export const closeBatchOperations = pgTable("close_batch_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Client-supplied. UI generates a UUID per click; AI executor uses
  // close_decisions.id. Unique within (company, operation_type) so retries
  // collapse and double-clicks can't post twice.
  idempotencyKey: varchar("idempotency_key").notNull(),
  // Mirrors close_decisions.action_type allow-list:
  //   post_jes | settle_obligations | resolve_claims | apply_deductions
  //   | reverse_accruals | release_obligations
  operationType: varchar("operation_type").notNull(),
  periodId: varchar("period_id").notNull().references(() => periodClose.id, { onDelete: 'cascade' }),
  initiatedBy: varchar("initiated_by").references(() => users.id, { onDelete: 'set null' }),
  initiatedVia: varchar("initiated_via"), // worksheet | copilot | api
  // Exact request body so a retry produces the same response.
  payload: jsonb("payload").notNull(),
  status: varchar("status").default("pending"), // pending | running | succeeded | partial | failed
  // { succeeded: number, failed: number, errors: [{obligationId, message}] }
  resultSummary: jsonb("result_summary"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  companyId: varchar("company_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  uniqueIndex("close_batch_ops_idem_uq").on(t.companyId, t.operationType, t.idempotencyKey),
  index("close_batch_ops_period_idx").on(t.periodId, t.createdAt),
]);

export const insertCloseBatchOperationSchema = createInsertSchema(closeBatchOperations).omit({ id: true, createdAt: true });
export type CloseBatchOperation = typeof closeBatchOperations.$inferSelect;
export type InsertCloseBatchOperation = z.infer<typeof insertCloseBatchOperationSchema>;
