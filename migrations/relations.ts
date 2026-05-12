import { relations } from "drizzle-orm/relations";
import { accuracyTestRuns, accuracyTestResults, accuracyTestCases, users, auditTrail, calculationBlueprints, blueprintDimensions, companies, businessUnits, companySettings, contracts, complianceAnalysis, contractApprovals, contractVersions, contractComparisons, contractDocuments, contractEmbeddings, contractGraphEdges, contractGraphNodes, contractObligations, integrationConnections, erpSystems, dataImportJobs, integrationEndpointTemplates, masterDataMappings, erpEntities, erpEntityRecords, erpFields, erpLicenseiqFieldMappings, licenseiqEntities, licenseiqFields, erpMappingRuleSets, erpMappingRules, erpMappingConditions, erpMappingOutputs, erpRuleExecutionLog, financialAnalysis, humanReviewTasks, extractionRuns, importedErpRecords, integrationHealthEvents, integrationOperations, licenseiqApiEndpoints, licenseiqEntityRecords, locations, navigationCategories, navigationItemCategories, navigationPermissions, orgCalculationSettings, pendingTermMappings, performanceMetrics, roleNavigationPermissions, ruleDefinitions, ruleValidationEvents, salesFieldMappings, semanticIndexEntries, strategicAnalysis, userOrganizationRoles, userActiveContext, userCategoryPreferences, userCategoryState, userNavigationOverrides, contractCalculations, contractRules, salesData, rebatePrograms, ruleDecisionLogs, contractAnalysis, ruleConflicts, contractClauses, extractionStageResults, customerSegments, customers } from "./schema";

export const accuracyTestResultsRelations = relations(accuracyTestResults, ({one}) => ({
	accuracyTestRun: one(accuracyTestRuns, {
		fields: [accuracyTestResults.runId],
		references: [accuracyTestRuns.id]
	}),
	accuracyTestCase: one(accuracyTestCases, {
		fields: [accuracyTestResults.testCaseId],
		references: [accuracyTestCases.id]
	}),
}));

export const accuracyTestRunsRelations = relations(accuracyTestRuns, ({many}) => ({
	accuracyTestResults: many(accuracyTestResults),
}));

export const accuracyTestCasesRelations = relations(accuracyTestCases, ({many}) => ({
	accuracyTestResults: many(accuracyTestResults),
}));

export const auditTrailRelations = relations(auditTrail, ({one}) => ({
	user: one(users, {
		fields: [auditTrail.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	auditTrails: many(auditTrail),
	companies_createdBy: many(companies, {
		relationName: "companies_createdBy_users_id"
	}),
	companies_lastUpdatedBy: many(companies, {
		relationName: "companies_lastUpdatedBy_users_id"
	}),
	businessUnits_createdBy: many(businessUnits, {
		relationName: "businessUnits_createdBy_users_id"
	}),
	businessUnits_lastUpdatedBy: many(businessUnits, {
		relationName: "businessUnits_lastUpdatedBy_users_id"
	}),
	contractApprovals: many(contractApprovals),
	contractVersions: many(contractVersions),
	contracts_contractOwnerId: many(contracts, {
		relationName: "contracts_contractOwnerId_users_id"
	}),
	contracts_uploadedBy: many(contracts, {
		relationName: "contracts_uploadedBy_users_id"
	}),
	integrationConnections: many(integrationConnections),
	dataImportJobs: many(dataImportJobs),
	erpSystems: many(erpSystems),
	masterDataMappings: many(masterDataMappings),
	erpEntities: many(erpEntities),
	erpEntityRecords: many(erpEntityRecords),
	humanReviewTasks_assignedTo: many(humanReviewTasks, {
		relationName: "humanReviewTasks_assignedTo_users_id"
	}),
	humanReviewTasks_reviewedBy: many(humanReviewTasks, {
		relationName: "humanReviewTasks_reviewedBy_users_id"
	}),
	integrationOperations: many(integrationOperations),
	licenseiqEntityRecords: many(licenseiqEntityRecords),
	locations_createdBy: many(locations, {
		relationName: "locations_createdBy_users_id"
	}),
	locations_lastUpdatedBy: many(locations, {
		relationName: "locations_lastUpdatedBy_users_id"
	}),
	orgCalculationSettings: many(orgCalculationSettings),
	pendingTermMappings: many(pendingTermMappings),
	ruleValidationEvents: many(ruleValidationEvents),
	salesFieldMappings: many(salesFieldMappings),
	userOrganizationRoles_createdBy: many(userOrganizationRoles, {
		relationName: "userOrganizationRoles_createdBy_users_id"
	}),
	userOrganizationRoles_lastUpdatedBy: many(userOrganizationRoles, {
		relationName: "userOrganizationRoles_lastUpdatedBy_users_id"
	}),
	userOrganizationRoles_userId: many(userOrganizationRoles, {
		relationName: "userOrganizationRoles_userId_users_id"
	}),
	userActiveContexts: many(userActiveContext),
	userCategoryPreferences: many(userCategoryPreferences),
	userCategoryStates: many(userCategoryState),
	userNavigationOverrides: many(userNavigationOverrides),
	extractionRuns: many(extractionRuns),
	contractCalculations_approvedBy: many(contractCalculations, {
		relationName: "contractCalculations_approvedBy_users_id"
	}),
	contractCalculations_calculatedBy: many(contractCalculations, {
		relationName: "contractCalculations_calculatedBy_users_id"
	}),
	contractCalculations_rejectedBy: many(contractCalculations, {
		relationName: "contractCalculations_rejectedBy_users_id"
	}),
}));

export const blueprintDimensionsRelations = relations(blueprintDimensions, ({one}) => ({
	calculationBlueprint: one(calculationBlueprints, {
		fields: [blueprintDimensions.blueprintId],
		references: [calculationBlueprints.id]
	}),
}));

export const calculationBlueprintsRelations = relations(calculationBlueprints, ({many}) => ({
	blueprintDimensions: many(blueprintDimensions),
}));

export const companiesRelations = relations(companies, ({one, many}) => ({
	user_createdBy: one(users, {
		fields: [companies.createdBy],
		references: [users.id],
		relationName: "companies_createdBy_users_id"
	}),
	user_lastUpdatedBy: one(users, {
		fields: [companies.lastUpdatedBy],
		references: [users.id],
		relationName: "companies_lastUpdatedBy_users_id"
	}),
	businessUnits: many(businessUnits),
	companySettings: many(companySettings),
	licenseiqEntityRecords: many(licenseiqEntityRecords),
	locations: many(locations),
	orgCalculationSettings: many(orgCalculationSettings),
	pendingTermMappings: many(pendingTermMappings),
	userOrganizationRoles: many(userOrganizationRoles),
}));

export const businessUnitsRelations = relations(businessUnits, ({one, many}) => ({
	company: one(companies, {
		fields: [businessUnits.companyId],
		references: [companies.companyId]
	}),
	user_createdBy: one(users, {
		fields: [businessUnits.createdBy],
		references: [users.id],
		relationName: "businessUnits_createdBy_users_id"
	}),
	user_lastUpdatedBy: one(users, {
		fields: [businessUnits.lastUpdatedBy],
		references: [users.id],
		relationName: "businessUnits_lastUpdatedBy_users_id"
	}),
	licenseiqEntityRecords: many(licenseiqEntityRecords),
	locations: many(locations),
	userOrganizationRoles: many(userOrganizationRoles),
}));

export const companySettingsRelations = relations(companySettings, ({one}) => ({
	company: one(companies, {
		fields: [companySettings.companyId],
		references: [companies.companyId]
	}),
}));

export const complianceAnalysisRelations = relations(complianceAnalysis, ({one}) => ({
	contract: one(contracts, {
		fields: [complianceAnalysis.contractId],
		references: [contracts.id]
	}),
}));

export const contractsRelations = relations(contracts, ({one, many}) => ({
	complianceAnalyses: many(complianceAnalysis),
	contractVersions: many(contractVersions),
	contractComparisons: many(contractComparisons),
	contractDocuments: many(contractDocuments),
	contractEmbeddings: many(contractEmbeddings),
	contractGraphEdges: many(contractGraphEdges),
	contractGraphNodes: many(contractGraphNodes),
	contractObligations: many(contractObligations),
	user_contractOwnerId: one(users, {
		fields: [contracts.contractOwnerId],
		references: [users.id],
		relationName: "contracts_contractOwnerId_users_id"
	}),
	user_uploadedBy: one(users, {
		fields: [contracts.uploadedBy],
		references: [users.id],
		relationName: "contracts_uploadedBy_users_id"
	}),
	dataImportJobs: many(dataImportJobs),
	masterDataMappings: many(masterDataMappings),
	financialAnalyses: many(financialAnalysis),
	humanReviewTasks: many(humanReviewTasks),
	importedErpRecords: many(importedErpRecords),
	pendingTermMappings: many(pendingTermMappings),
	performanceMetrics: many(performanceMetrics),
	ruleDefinitions: many(ruleDefinitions),
	salesFieldMappings: many(salesFieldMappings),
	semanticIndexEntries: many(semanticIndexEntries),
	strategicAnalyses: many(strategicAnalysis),
	extractionRuns: many(extractionRuns),
	contractCalculations: many(contractCalculations),
	contractRules: many(contractRules),
	salesData: many(salesData),
	rebatePrograms: many(rebatePrograms),
	ruleDecisionLogs: many(ruleDecisionLogs),
	contractAnalyses: many(contractAnalysis),
	ruleConflicts: many(ruleConflicts),
	contractClauses: many(contractClauses),
}));

export const contractApprovalsRelations = relations(contractApprovals, ({one}) => ({
	user: one(users, {
		fields: [contractApprovals.approverId],
		references: [users.id]
	}),
	contractVersion: one(contractVersions, {
		fields: [contractApprovals.contractVersionId],
		references: [contractVersions.id]
	}),
}));

export const contractVersionsRelations = relations(contractVersions, ({one, many}) => ({
	contractApprovals: many(contractApprovals),
	contract: one(contracts, {
		fields: [contractVersions.contractId],
		references: [contracts.id]
	}),
	user: one(users, {
		fields: [contractVersions.editorId],
		references: [users.id]
	}),
}));

export const contractComparisonsRelations = relations(contractComparisons, ({one}) => ({
	contract: one(contracts, {
		fields: [contractComparisons.contractId],
		references: [contracts.id]
	}),
}));

export const contractDocumentsRelations = relations(contractDocuments, ({one, many}) => ({
	contract: one(contracts, {
		fields: [contractDocuments.contractId],
		references: [contracts.id]
	}),
	contractGraphNodes: many(contractGraphNodes),
}));

export const contractEmbeddingsRelations = relations(contractEmbeddings, ({one}) => ({
	contract: one(contracts, {
		fields: [contractEmbeddings.contractId],
		references: [contracts.id]
	}),
}));

export const contractGraphEdgesRelations = relations(contractGraphEdges, ({one}) => ({
	contract: one(contracts, {
		fields: [contractGraphEdges.contractId],
		references: [contracts.id]
	}),
	contractGraphNode_sourceNodeId: one(contractGraphNodes, {
		fields: [contractGraphEdges.sourceNodeId],
		references: [contractGraphNodes.id],
		relationName: "contractGraphEdges_sourceNodeId_contractGraphNodes_id"
	}),
	contractGraphNode_targetNodeId: one(contractGraphNodes, {
		fields: [contractGraphEdges.targetNodeId],
		references: [contractGraphNodes.id],
		relationName: "contractGraphEdges_targetNodeId_contractGraphNodes_id"
	}),
}));

export const contractGraphNodesRelations = relations(contractGraphNodes, ({one, many}) => ({
	contractGraphEdges_sourceNodeId: many(contractGraphEdges, {
		relationName: "contractGraphEdges_sourceNodeId_contractGraphNodes_id"
	}),
	contractGraphEdges_targetNodeId: many(contractGraphEdges, {
		relationName: "contractGraphEdges_targetNodeId_contractGraphNodes_id"
	}),
	contract: one(contracts, {
		fields: [contractGraphNodes.contractId],
		references: [contracts.id]
	}),
	contractDocument: one(contractDocuments, {
		fields: [contractGraphNodes.sourceDocumentId],
		references: [contractDocuments.id]
	}),
	ruleDefinitions: many(ruleDefinitions),
}));

export const contractObligationsRelations = relations(contractObligations, ({one}) => ({
	contract: one(contracts, {
		fields: [contractObligations.contractId],
		references: [contracts.id]
	}),
}));

export const integrationConnectionsRelations = relations(integrationConnections, ({one, many}) => ({
	user: one(users, {
		fields: [integrationConnections.createdBy],
		references: [users.id]
	}),
	erpSystem: one(erpSystems, {
		fields: [integrationConnections.erpSystemId],
		references: [erpSystems.id]
	}),
	dataImportJobs: many(dataImportJobs),
	integrationHealthEvents: many(integrationHealthEvents),
	integrationOperations: many(integrationOperations),
}));

export const erpSystemsRelations = relations(erpSystems, ({one, many}) => ({
	integrationConnections: many(integrationConnections),
	dataImportJobs: many(dataImportJobs),
	integrationEndpointTemplates: many(integrationEndpointTemplates),
	user: one(users, {
		fields: [erpSystems.createdBy],
		references: [users.id]
	}),
	masterDataMappings: many(masterDataMappings),
	erpEntities: many(erpEntities),
	erpLicenseiqFieldMappings: many(erpLicenseiqFieldMappings),
	pendingTermMappings: many(pendingTermMappings),
}));

export const dataImportJobsRelations = relations(dataImportJobs, ({one, many}) => ({
	integrationConnection: one(integrationConnections, {
		fields: [dataImportJobs.connectionId],
		references: [integrationConnections.id]
	}),
	user: one(users, {
		fields: [dataImportJobs.createdBy],
		references: [users.id]
	}),
	contract: one(contracts, {
		fields: [dataImportJobs.customerId],
		references: [contracts.id]
	}),
	integrationEndpointTemplate: one(integrationEndpointTemplates, {
		fields: [dataImportJobs.endpointTemplateId],
		references: [integrationEndpointTemplates.id]
	}),
	erpSystem: one(erpSystems, {
		fields: [dataImportJobs.erpSystemId],
		references: [erpSystems.id]
	}),
	masterDataMapping: one(masterDataMappings, {
		fields: [dataImportJobs.mappingId],
		references: [masterDataMappings.id]
	}),
	importedErpRecords: many(importedErpRecords),
}));

export const integrationEndpointTemplatesRelations = relations(integrationEndpointTemplates, ({one, many}) => ({
	dataImportJobs: many(dataImportJobs),
	erpEntity: one(erpEntities, {
		fields: [integrationEndpointTemplates.erpEntityId],
		references: [erpEntities.id]
	}),
	erpSystem: one(erpSystems, {
		fields: [integrationEndpointTemplates.erpSystemId],
		references: [erpSystems.id]
	}),
	integrationOperations: many(integrationOperations),
}));

export const masterDataMappingsRelations = relations(masterDataMappings, ({one, many}) => ({
	dataImportJobs: many(dataImportJobs),
	user: one(users, {
		fields: [masterDataMappings.createdBy],
		references: [users.id]
	}),
	contract: one(contracts, {
		fields: [masterDataMappings.customerId],
		references: [contracts.id]
	}),
	erpSystem: one(erpSystems, {
		fields: [masterDataMappings.erpSystemId],
		references: [erpSystems.id]
	}),
	importedErpRecords: many(importedErpRecords),
	integrationOperations: many(integrationOperations),
}));

export const erpEntitiesRelations = relations(erpEntities, ({one, many}) => ({
	integrationEndpointTemplates: many(integrationEndpointTemplates),
	user: one(users, {
		fields: [erpEntities.createdBy],
		references: [users.id]
	}),
	erpSystem: one(erpSystems, {
		fields: [erpEntities.systemId],
		references: [erpSystems.id]
	}),
	erpEntityRecords: many(erpEntityRecords),
	erpFields: many(erpFields),
	erpLicenseiqFieldMappings: many(erpLicenseiqFieldMappings),
	pendingTermMappings: many(pendingTermMappings),
}));

export const erpEntityRecordsRelations = relations(erpEntityRecords, ({one}) => ({
	user: one(users, {
		fields: [erpEntityRecords.createdBy],
		references: [users.id]
	}),
	erpEntity: one(erpEntities, {
		fields: [erpEntityRecords.entityId],
		references: [erpEntities.id]
	}),
}));

export const erpFieldsRelations = relations(erpFields, ({one, many}) => ({
	erpEntity: one(erpEntities, {
		fields: [erpFields.entityId],
		references: [erpEntities.id]
	}),
	erpLicenseiqFieldMappings: many(erpLicenseiqFieldMappings),
	pendingTermMappings: many(pendingTermMappings),
}));

export const erpLicenseiqFieldMappingsRelations = relations(erpLicenseiqFieldMappings, ({one}) => ({
	erpEntity: one(erpEntities, {
		fields: [erpLicenseiqFieldMappings.erpEntityId],
		references: [erpEntities.id]
	}),
	erpField: one(erpFields, {
		fields: [erpLicenseiqFieldMappings.erpFieldId],
		references: [erpFields.id]
	}),
	erpSystem: one(erpSystems, {
		fields: [erpLicenseiqFieldMappings.erpSystemId],
		references: [erpSystems.id]
	}),
	licenseiqEntity: one(licenseiqEntities, {
		fields: [erpLicenseiqFieldMappings.licenseiqEntityId],
		references: [licenseiqEntities.id]
	}),
	licenseiqField: one(licenseiqFields, {
		fields: [erpLicenseiqFieldMappings.licenseiqFieldId],
		references: [licenseiqFields.id]
	}),
}));

export const licenseiqEntitiesRelations = relations(licenseiqEntities, ({many}) => ({
	erpLicenseiqFieldMappings: many(erpLicenseiqFieldMappings),
	licenseiqFields: many(licenseiqFields),
	licenseiqApiEndpoints: many(licenseiqApiEndpoints),
	licenseiqEntityRecords: many(licenseiqEntityRecords),
}));

export const licenseiqFieldsRelations = relations(licenseiqFields, ({one, many}) => ({
	erpLicenseiqFieldMappings: many(erpLicenseiqFieldMappings),
	licenseiqEntity: one(licenseiqEntities, {
		fields: [licenseiqFields.entityId],
		references: [licenseiqEntities.id]
	}),
}));

export const erpMappingRulesRelations = relations(erpMappingRules, ({one, many}) => ({
	erpMappingRuleSet: one(erpMappingRuleSets, {
		fields: [erpMappingRules.ruleSetId],
		references: [erpMappingRuleSets.id]
	}),
	erpMappingConditions: many(erpMappingConditions),
	erpMappingOutputs: many(erpMappingOutputs),
}));

export const erpMappingRuleSetsRelations = relations(erpMappingRuleSets, ({many}) => ({
	erpMappingRules: many(erpMappingRules),
	erpRuleExecutionLogs: many(erpRuleExecutionLog),
}));

export const erpMappingConditionsRelations = relations(erpMappingConditions, ({one}) => ({
	erpMappingRule: one(erpMappingRules, {
		fields: [erpMappingConditions.ruleId],
		references: [erpMappingRules.id]
	}),
}));

export const erpMappingOutputsRelations = relations(erpMappingOutputs, ({one}) => ({
	erpMappingRule: one(erpMappingRules, {
		fields: [erpMappingOutputs.ruleId],
		references: [erpMappingRules.id]
	}),
}));

export const erpRuleExecutionLogRelations = relations(erpRuleExecutionLog, ({one}) => ({
	erpMappingRuleSet: one(erpMappingRuleSets, {
		fields: [erpRuleExecutionLog.ruleSetId],
		references: [erpMappingRuleSets.id]
	}),
}));

export const financialAnalysisRelations = relations(financialAnalysis, ({one}) => ({
	contract: one(contracts, {
		fields: [financialAnalysis.contractId],
		references: [contracts.id]
	}),
}));

export const humanReviewTasksRelations = relations(humanReviewTasks, ({one}) => ({
	user_assignedTo: one(users, {
		fields: [humanReviewTasks.assignedTo],
		references: [users.id],
		relationName: "humanReviewTasks_assignedTo_users_id"
	}),
	contract: one(contracts, {
		fields: [humanReviewTasks.contractId],
		references: [contracts.id]
	}),
	extractionRun: one(extractionRuns, {
		fields: [humanReviewTasks.extractionRunId],
		references: [extractionRuns.id]
	}),
	user_reviewedBy: one(users, {
		fields: [humanReviewTasks.reviewedBy],
		references: [users.id],
		relationName: "humanReviewTasks_reviewedBy_users_id"
	}),
}));

export const extractionRunsRelations = relations(extractionRuns, ({one, many}) => ({
	humanReviewTasks: many(humanReviewTasks),
	ruleDefinitions: many(ruleDefinitions),
	contract: one(contracts, {
		fields: [extractionRuns.contractId],
		references: [contracts.id]
	}),
	user: one(users, {
		fields: [extractionRuns.triggeredBy],
		references: [users.id]
	}),
	ruleConflicts: many(ruleConflicts),
	contractClauses: many(contractClauses),
	extractionStageResults: many(extractionStageResults),
}));

export const importedErpRecordsRelations = relations(importedErpRecords, ({one}) => ({
	contract: one(contracts, {
		fields: [importedErpRecords.customerId],
		references: [contracts.id]
	}),
	dataImportJob: one(dataImportJobs, {
		fields: [importedErpRecords.jobId],
		references: [dataImportJobs.id]
	}),
	masterDataMapping: one(masterDataMappings, {
		fields: [importedErpRecords.mappingId],
		references: [masterDataMappings.id]
	}),
}));

export const integrationHealthEventsRelations = relations(integrationHealthEvents, ({one}) => ({
	integrationConnection: one(integrationConnections, {
		fields: [integrationHealthEvents.connectionId],
		references: [integrationConnections.id]
	}),
}));

export const integrationOperationsRelations = relations(integrationOperations, ({one}) => ({
	integrationConnection: one(integrationConnections, {
		fields: [integrationOperations.connectionId],
		references: [integrationConnections.id]
	}),
	user: one(users, {
		fields: [integrationOperations.createdBy],
		references: [users.id]
	}),
	integrationEndpointTemplate: one(integrationEndpointTemplates, {
		fields: [integrationOperations.endpointTemplateId],
		references: [integrationEndpointTemplates.id]
	}),
	masterDataMapping: one(masterDataMappings, {
		fields: [integrationOperations.mappingId],
		references: [masterDataMappings.id]
	}),
}));

export const licenseiqApiEndpointsRelations = relations(licenseiqApiEndpoints, ({one}) => ({
	licenseiqEntity: one(licenseiqEntities, {
		fields: [licenseiqApiEndpoints.entityId],
		references: [licenseiqEntities.id]
	}),
}));

export const licenseiqEntityRecordsRelations = relations(licenseiqEntityRecords, ({one}) => ({
	user: one(users, {
		fields: [licenseiqEntityRecords.createdBy],
		references: [users.id]
	}),
	licenseiqEntity: one(licenseiqEntities, {
		fields: [licenseiqEntityRecords.entityId],
		references: [licenseiqEntities.id]
	}),
	company: one(companies, {
		fields: [licenseiqEntityRecords.grpId],
		references: [companies.companyId]
	}),
	location: one(locations, {
		fields: [licenseiqEntityRecords.locId],
		references: [locations.locId]
	}),
	businessUnit: one(businessUnits, {
		fields: [licenseiqEntityRecords.orgId],
		references: [businessUnits.orgId]
	}),
}));

export const locationsRelations = relations(locations, ({one, many}) => ({
	licenseiqEntityRecords: many(licenseiqEntityRecords),
	company: one(companies, {
		fields: [locations.companyId],
		references: [companies.companyId]
	}),
	user_createdBy: one(users, {
		fields: [locations.createdBy],
		references: [users.id],
		relationName: "locations_createdBy_users_id"
	}),
	user_lastUpdatedBy: one(users, {
		fields: [locations.lastUpdatedBy],
		references: [users.id],
		relationName: "locations_lastUpdatedBy_users_id"
	}),
	businessUnit: one(businessUnits, {
		fields: [locations.orgId],
		references: [businessUnits.orgId]
	}),
	userOrganizationRoles: many(userOrganizationRoles),
}));

export const navigationItemCategoriesRelations = relations(navigationItemCategories, ({one}) => ({
	navigationCategory: one(navigationCategories, {
		fields: [navigationItemCategories.categoryKey],
		references: [navigationCategories.categoryKey]
	}),
	navigationPermission: one(navigationPermissions, {
		fields: [navigationItemCategories.navItemKey],
		references: [navigationPermissions.itemKey]
	}),
}));

export const navigationCategoriesRelations = relations(navigationCategories, ({many}) => ({
	navigationItemCategories: many(navigationItemCategories),
	userCategoryPreferences: many(userCategoryPreferences),
	userCategoryStates: many(userCategoryState),
}));

export const navigationPermissionsRelations = relations(navigationPermissions, ({many}) => ({
	navigationItemCategories: many(navigationItemCategories),
	roleNavigationPermissions: many(roleNavigationPermissions),
	userCategoryPreferences: many(userCategoryPreferences),
	userNavigationOverrides: many(userNavigationOverrides),
}));

export const orgCalculationSettingsRelations = relations(orgCalculationSettings, ({one}) => ({
	company: one(companies, {
		fields: [orgCalculationSettings.companyId],
		references: [companies.companyId]
	}),
	user: one(users, {
		fields: [orgCalculationSettings.createdBy],
		references: [users.id]
	}),
}));

export const pendingTermMappingsRelations = relations(pendingTermMappings, ({one}) => ({
	company: one(companies, {
		fields: [pendingTermMappings.companyId],
		references: [companies.companyId]
	}),
	user: one(users, {
		fields: [pendingTermMappings.confirmedBy],
		references: [users.id]
	}),
	contract: one(contracts, {
		fields: [pendingTermMappings.contractId],
		references: [contracts.id]
	}),
	erpEntity: one(erpEntities, {
		fields: [pendingTermMappings.erpEntityId],
		references: [erpEntities.id]
	}),
	erpField: one(erpFields, {
		fields: [pendingTermMappings.erpFieldId],
		references: [erpFields.id]
	}),
	erpSystem: one(erpSystems, {
		fields: [pendingTermMappings.erpSystemId],
		references: [erpSystems.id]
	}),
}));

export const performanceMetricsRelations = relations(performanceMetrics, ({one}) => ({
	contract: one(contracts, {
		fields: [performanceMetrics.contractId],
		references: [contracts.id]
	}),
}));

export const roleNavigationPermissionsRelations = relations(roleNavigationPermissions, ({one}) => ({
	navigationPermission: one(navigationPermissions, {
		fields: [roleNavigationPermissions.navItemKey],
		references: [navigationPermissions.itemKey]
	}),
}));

export const ruleDefinitionsRelations = relations(ruleDefinitions, ({one, many}) => ({
	contract: one(contracts, {
		fields: [ruleDefinitions.contractId],
		references: [contracts.id]
	}),
	extractionRun: one(extractionRuns, {
		fields: [ruleDefinitions.extractionRunId],
		references: [extractionRuns.id]
	}),
	contractGraphNode: one(contractGraphNodes, {
		fields: [ruleDefinitions.linkedGraphNodeId],
		references: [contractGraphNodes.id]
	}),
	ruleValidationEvents: many(ruleValidationEvents),
}));

export const ruleValidationEventsRelations = relations(ruleValidationEvents, ({one}) => ({
	ruleDefinition: one(ruleDefinitions, {
		fields: [ruleValidationEvents.ruleDefinitionId],
		references: [ruleDefinitions.id]
	}),
	user: one(users, {
		fields: [ruleValidationEvents.validatorId],
		references: [users.id]
	}),
}));

export const salesFieldMappingsRelations = relations(salesFieldMappings, ({one}) => ({
	user: one(users, {
		fields: [salesFieldMappings.approvedBy],
		references: [users.id]
	}),
	contract: one(contracts, {
		fields: [salesFieldMappings.contractId],
		references: [contracts.id]
	}),
}));

export const semanticIndexEntriesRelations = relations(semanticIndexEntries, ({one}) => ({
	contract: one(contracts, {
		fields: [semanticIndexEntries.contractId],
		references: [contracts.id]
	}),
}));

export const strategicAnalysisRelations = relations(strategicAnalysis, ({one}) => ({
	contract: one(contracts, {
		fields: [strategicAnalysis.contractId],
		references: [contracts.id]
	}),
}));

export const userOrganizationRolesRelations = relations(userOrganizationRoles, ({one, many}) => ({
	businessUnit: one(businessUnits, {
		fields: [userOrganizationRoles.businessUnitId],
		references: [businessUnits.orgId]
	}),
	company: one(companies, {
		fields: [userOrganizationRoles.companyId],
		references: [companies.companyId]
	}),
	user_createdBy: one(users, {
		fields: [userOrganizationRoles.createdBy],
		references: [users.id],
		relationName: "userOrganizationRoles_createdBy_users_id"
	}),
	user_lastUpdatedBy: one(users, {
		fields: [userOrganizationRoles.lastUpdatedBy],
		references: [users.id],
		relationName: "userOrganizationRoles_lastUpdatedBy_users_id"
	}),
	location: one(locations, {
		fields: [userOrganizationRoles.locationId],
		references: [locations.locId]
	}),
	user_userId: one(users, {
		fields: [userOrganizationRoles.userId],
		references: [users.id],
		relationName: "userOrganizationRoles_userId_users_id"
	}),
	userActiveContexts: many(userActiveContext),
}));

export const userActiveContextRelations = relations(userActiveContext, ({one}) => ({
	userOrganizationRole: one(userOrganizationRoles, {
		fields: [userActiveContext.activeOrgRoleId],
		references: [userOrganizationRoles.id]
	}),
	user: one(users, {
		fields: [userActiveContext.userId],
		references: [users.id]
	}),
}));

export const userCategoryPreferencesRelations = relations(userCategoryPreferences, ({one}) => ({
	navigationCategory: one(navigationCategories, {
		fields: [userCategoryPreferences.categoryKey],
		references: [navigationCategories.categoryKey]
	}),
	navigationPermission: one(navigationPermissions, {
		fields: [userCategoryPreferences.navItemKey],
		references: [navigationPermissions.itemKey]
	}),
	user: one(users, {
		fields: [userCategoryPreferences.userId],
		references: [users.id]
	}),
}));

export const userCategoryStateRelations = relations(userCategoryState, ({one}) => ({
	navigationCategory: one(navigationCategories, {
		fields: [userCategoryState.categoryKey],
		references: [navigationCategories.categoryKey]
	}),
	user: one(users, {
		fields: [userCategoryState.userId],
		references: [users.id]
	}),
}));

export const userNavigationOverridesRelations = relations(userNavigationOverrides, ({one}) => ({
	navigationPermission: one(navigationPermissions, {
		fields: [userNavigationOverrides.navItemKey],
		references: [navigationPermissions.itemKey]
	}),
	user: one(users, {
		fields: [userNavigationOverrides.userId],
		references: [users.id]
	}),
}));

export const contractCalculationsRelations = relations(contractCalculations, ({one}) => ({
	user_approvedBy: one(users, {
		fields: [contractCalculations.approvedBy],
		references: [users.id],
		relationName: "contractCalculations_approvedBy_users_id"
	}),
	user_calculatedBy: one(users, {
		fields: [contractCalculations.calculatedBy],
		references: [users.id],
		relationName: "contractCalculations_calculatedBy_users_id"
	}),
	contract: one(contracts, {
		fields: [contractCalculations.contractId],
		references: [contracts.id]
	}),
	user_rejectedBy: one(users, {
		fields: [contractCalculations.rejectedBy],
		references: [users.id],
		relationName: "contractCalculations_rejectedBy_users_id"
	}),
}));

export const contractRulesRelations = relations(contractRules, ({one, many}) => ({
	contract: one(contracts, {
		fields: [contractRules.contractId],
		references: [contracts.id]
	}),
	ruleDecisionLogs: many(ruleDecisionLogs),
}));

export const salesDataRelations = relations(salesData, ({one}) => ({
	contract: one(contracts, {
		fields: [salesData.matchedContractId],
		references: [contracts.id]
	}),
}));

export const rebateProgramsRelations = relations(rebatePrograms, ({one}) => ({
	contract: one(contracts, {
		fields: [rebatePrograms.contractId],
		references: [contracts.id]
	}),
}));

export const ruleDecisionLogsRelations = relations(ruleDecisionLogs, ({one}) => ({
	contract: one(contracts, {
		fields: [ruleDecisionLogs.contractId],
		references: [contracts.id]
	}),
	contractRule: one(contractRules, {
		fields: [ruleDecisionLogs.ruleId],
		references: [contractRules.id]
	}),
}));

export const contractAnalysisRelations = relations(contractAnalysis, ({one}) => ({
	contract: one(contracts, {
		fields: [contractAnalysis.contractId],
		references: [contracts.id]
	}),
}));

export const ruleConflictsRelations = relations(ruleConflicts, ({one}) => ({
	contract: one(contracts, {
		fields: [ruleConflicts.contractId],
		references: [contracts.id]
	}),
	extractionRun: one(extractionRuns, {
		fields: [ruleConflicts.extractionRunId],
		references: [extractionRuns.id]
	}),
}));

export const contractClausesRelations = relations(contractClauses, ({one}) => ({
	contract: one(contracts, {
		fields: [contractClauses.contractId],
		references: [contracts.id]
	}),
	extractionRun: one(extractionRuns, {
		fields: [contractClauses.extractionRunId],
		references: [extractionRuns.id]
	}),
}));

export const extractionStageResultsRelations = relations(extractionStageResults, ({one}) => ({
	extractionRun: one(extractionRuns, {
		fields: [extractionStageResults.extractionRunId],
		references: [extractionRuns.id]
	}),
}));

export const customersRelations = relations(customers, ({one}) => ({
	customerSegment: one(customerSegments, {
		fields: [customers.segmentId],
		references: [customerSegments.id]
	}),
}));

export const customerSegmentsRelations = relations(customerSegments, ({many}) => ({
	customers: many(customers),
}));