import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { storage, type OrgAccessContext } from "./storage";
import { isAuthenticated } from "./auth";
import { RulesEngine } from "./services/rulesEngine";
import type { RoyaltyCalculationInput } from "./services/rulesEngine";
import { buildFormulaDefinition, type TableData, type FieldMappings as BuilderFieldMappings } from "../shared/formulaDefinitionBuilder";
import { syncQualifiersFromRule, cascadeDeleteQualifiersForRule, getParityReport, backfillQualifiersForContract, syncConditionsFromRule, loadConditionsForContract } from "./services/qualifierSync";
import { sendIfLocked } from "./services/contractEditLock";
import { conditionsArraySchema } from "@shared/qualifierRegistry";

async function getAutoFieldMappingsForRule(
  formulaDefinition: any,
  contractTypeCode?: string
): Promise<Record<string, string> | null> {
  const tableColumns = formulaDefinition?.tableData?.columns;
  if (!tableColumns || !Array.isArray(tableColumns) || tableColumns.length === 0) return null;

  try {
    const fieldTypes = await storage.getCalculationFieldTypes(contractTypeCode || 'royalty_license');
    if (fieldTypes && fieldTypes.length > 0) {
      const mappings: Record<string, string> = {};
      const lowerColumns = tableColumns.map((c: string) => c.toLowerCase());
      for (const field of fieldTypes) {
        const patterns = field.defaultColumnPatterns || [];
        for (let idx = 0; idx < tableColumns.length; idx++) {
          if (!mappings[field.fieldCode] && patterns.some((p: string) => lowerColumns[idx].includes(p.toLowerCase()))) {
            mappings[field.fieldCode] = tableColumns[idx];
            break;
          }
        }
      }
      const result: Record<string, string> = {};
      if (mappings.units_sold || mappings.volume_tier || mappings.net_revenue) {
        result.volumeField = mappings.units_sold || mappings.volume_tier || mappings.net_revenue;
      }
      if (mappings.royalty_rate || mappings.per_unit_rate) {
        result.rateField = mappings.royalty_rate || mappings.per_unit_rate;
      }
      if (mappings.minimum_royalty || mappings.minimum_payment) {
        result.minimumField = mappings.minimum_royalty || mappings.minimum_payment;
      }
      if (mappings.product_category) {
        result.descriptionField = mappings.product_category;
      }
      if (Object.keys(result).length > 0) return result;
    }
  } catch (err) { /* fall through to fallback */ }

  const FALLBACK: Array<{ key: string; patterns: string[] }> = [
    { key: 'volumeField', patterns: ['volume', 'sales', 'units', 'threshold', 'tier', 'quantity', 'size', 'container'] },
    { key: 'rateField', patterns: ['rate', 'contract fee', 'fee', 'price', 'percent', '%', 'base'] },
    { key: 'minimumField', patterns: ['minimum', 'min', 'guarantee', 'floor'] },
    { key: 'descriptionField', patterns: ['description', 'name', 'category', 'product', 'label', 'variety'] },
  ];
  const result: Record<string, string> = {};
  const lowerColumns = tableColumns.map((c: string) => c.toLowerCase());
  for (const { key, patterns } of FALLBACK) {
    for (let idx = 0; idx < tableColumns.length; idx++) {
      if (!result[key] && patterns.some(p => lowerColumns[idx].includes(p))) {
        result[key] = tableColumns[idx];
        break;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

// Helper: Check if user is a TRUE system admin (only explicit flag, not tenant admins)
// This is stricter than the routes.ts pattern to prevent tenant admins from bypassing scope
function isSystemAdmin(user: any): boolean {
  if (!user) return false;
  // Only explicit isSystemAdmin flag grants system-level access
  // user.role === 'admin' does NOT grant bypass because that can be a tenant admin
  return user.isSystemAdmin === true;
}

// Audit logging function
async function createAuditLog(req: any, action: string, resourceType?: string, resourceId?: string, details?: any) {
  if (req.user?.id) {
    try {
      await storage.createAuditLog({
        userId: req.user.id,
        action,
        resourceType,
        resourceId,
        details,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
}

// Helper: Validate contract access with proper tenant isolation
// Uses context-aware storage lookup to enforce 3-level hierarchy (Company → BU → Location)
// IMPORTANT: Does NOT grant bypass based on user.role - only isSystemAdmin === true bypasses
async function validateContractAccess(contractId: string, user: any): Promise<{ contract: any; authorized: boolean; error?: string }> {
  const userId = user.id;
  const userIsSystemAdmin = user.isSystemAdmin === true;
  
  // Only TRUE system admins bypass org context filtering
  if (userIsSystemAdmin) {
    const contract = await storage.getContract(contractId);
    if (!contract) {
      // Always return 403 to prevent ID probing (uniform error)
      return { contract: undefined, authorized: false, error: 'Access denied' };
    }
    return { contract, authorized: true };
  }
  
  const activeContext = user.activeContext;
  
  // Strict context validation: companyId is mandatory for all non-system-admin access
  if (!activeContext || !activeContext.companyId) {
    return { contract: undefined, authorized: false, error: 'Access denied' };
  }
  
  const contextRole = activeContext.role;
  const hasContextAdminAccess = contextRole === 'admin' || contextRole === 'owner' || contextRole === 'company_admin';

  // Build org context for filtering - preserve role for admin/owner to avoid uploadedBy filter
  const orgContext: OrgAccessContext = {
    activeContext: hasContextAdminAccess ? activeContext : { ...activeContext, role: 'user' },
    globalRole: hasContextAdminAccess ? contextRole : 'viewer',
    userId,
    isSystemAdmin: false,
  };

  // Get contract with org context filtering (tenant-scoped lookup)
  const contract = await storage.getContract(contractId, orgContext);
  if (!contract) {
    return { contract: undefined, authorized: false, error: 'Access denied' };
  }

  // If not a context admin, must be the uploader
  if (!hasContextAdminAccess && contract.uploadedBy !== userId) {
    return { contract, authorized: false, error: 'Access denied' };
  }

  return { contract, authorized: true };
}

export function registerRulesRoutes(app: Express): void {
  // =====================================================
  // RULES ENGINE API ENDPOINTS
  // =====================================================

  // Get fee rules for a contract (secured with full multi-tenant validation)
  app.get('/api/contracts/:id/rules', isAuthenticated, async (req: any, res) => {
    try {
      const contractId = req.params.id;

      // Validate contract access with full 3-level hierarchy
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      
      if (!contract) {
        return res.status(404).json({ message: error || 'Contract not found' });
      }
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }

      // Get fee rules from database
      const rules = await storage.getRoyaltyRulesByContract(contractId);
      
      console.log(`📋 [RULES API] Returning ${rules.length} rules for contract ${contractId}`);
      
      // Format response
      res.json({
        rules,
        total: rules.length
      });
    } catch (error) {
      console.error('Error fetching rules:', error);
      res.status(500).json({ message: 'Failed to fetch rules' });
    }
  });

  app.post('/api/contracts/:id/re-extract-rules-rich', isAuthenticated, async (req: any, res) => {
    try {
      const contractId = req.params.id;
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      
      if (!contract) return res.status(404).json({ message: error || 'Contract not found' });
      if (!authorized) return res.status(403).json({ message: error || 'Access denied' });

      const rules = await storage.getRoyaltyRulesByContract(contractId);
      if (rules.length === 0) {
        return res.json({ message: 'No rules to re-extract', updatedCount: 0 });
      }

      let contractText = (contract as any).rawText || '';
      
      if (!contractText) {
        const analysis = await storage.getContractAnalysis(contractId);
        if (analysis) {
          const keyTerms = analysis.keyTerms as any;
          if (keyTerms && typeof keyTerms === 'object') {
            contractText = JSON.stringify(keyTerms);
          }
        }
      }
      
      if (!contractText) {
        const ruleTexts = rules
          .map(r => [r.sourceText, r.sourceSection, r.description].filter(Boolean).join('\n'))
          .filter(t => t.length > 0)
          .join('\n\n');
        if (ruleTexts) {
          contractText = ruleTexts;
        }
      }
      
      if (!contractText) {
        return res.status(400).json({ message: 'No contract text available for re-extraction. Try re-uploading the contract.' });
      }

      const { claudeService } = await import('./services/claudeService');
      const richFormulas = await claudeService.generateRichFormulaDefinitions(rules, contractText);
      
      let updatedCount = 0;
      for (let i = 0; i < rules.length && i < richFormulas.length; i++) {
        if (richFormulas[i] && typeof richFormulas[i] === 'object') {
          try {
            const existingFormula = rules[i].formulaDefinition as any || {};
            const mergedFormula = {
              ...existingFormula,
              ...richFormulas[i],
            };
            if (existingFormula.tableData && !richFormulas[i].tableData) {
              mergedFormula.tableData = existingFormula.tableData;
            }
            if (existingFormula.calculation && !richFormulas[i].calculation) {
              mergedFormula.calculation = existingFormula.calculation;
            }
            if (existingFormula.conditions && !richFormulas[i].conditions) {
              mergedFormula.conditions = existingFormula.conditions;
            }
            const updateData: any = { formulaDefinition: mergedFormula };
            const existingMappings = rules[i].fieldMappings as any;
            if (!existingMappings || Object.keys(existingMappings).length === 0) {
              const autoMappings = await getAutoFieldMappingsForRule(mergedFormula, (contract as any).contractType || undefined);
              if (autoMappings) {
                updateData.fieldMappings = autoMappings;
                console.log(`   🗺️ [Re-extract] Auto-mapped fields for "${rules[i].ruleName}": ${JSON.stringify(autoMappings)}`);
              }
            }
            await storage.updateRoyaltyRule(rules[i].id, updateData);
            updatedCount++;
          } catch (err) {
            console.error(`Failed to update rule ${rules[i].id}:`, err);
          }
        }
      }

      console.log(`✅ [Re-extract] Updated ${updatedCount}/${rules.length} rules with rich format`);
      res.json({ 
        message: `Updated ${updatedCount} rules with rich format`,
        updatedCount,
        totalRules: rules.length
      });
    } catch (error) {
      console.error('Error re-extracting rules:', error);
      res.status(500).json({ message: 'Failed to re-extract rules' });
    }
  });

  // Delete a fee rule (secured with full multi-tenant validation)
  app.delete('/api/contracts/:contractId/rules/:ruleId', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, ruleId } = req.params;

      // Validate contract access with full 3-level hierarchy
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      
      if (!contract) {
        return res.status(404).json({ message: error || 'Contract not found' });
      }
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }

      if (await sendIfLocked(res, contractId)) return;

      // Cascade-delete qualifier rows linked to this rule's clause BEFORE
      // deleting the rule itself — qualifiers are the single source of truth
      // for product/territory filters and must not be left orphaned.
      try {
        const existingRules = await storage.getRoyaltyRulesByContract(contractId);
        const ruleToDelete = existingRules.find((r: any) => r.id === ruleId);
        if (ruleToDelete) {
          const removed = await cascadeDeleteQualifiersForRule(ruleToDelete as any);
          if (removed > 0) {
            console.log(`[RULES] Cascade-deleted ${removed} qualifier row(s) for rule ${ruleId}`);
          }
        }
      } catch (syncErr) {
        console.error('[RULES] Qualifier cascade-delete failed:', syncErr);
      }

      // Delete the rule
      await storage.deleteRoyaltyRule(ruleId);

      // Log the deletion
      await createAuditLog(req, 'rule_deleted', 'royalty_rule', ruleId, {
        contractId
      });

      try {
        const { revertContractApprovalIfRulesIncomplete } = await import('./services/contractApprovalIntegrity');
        await revertContractApprovalIfRulesIncomplete(contractId, `Rule ${ruleId} was deleted`);
      } catch (revertErr) {
        console.error('[contractApprovalIntegrity] delete-rule revert failed:', revertErr);
      }

      res.json({ message: 'Rule deleted successfully' });
    } catch (error) {
      console.error('Error deleting rule:', error);
      res.status(500).json({ message: 'Failed to delete rule' });
    }
  });

  // Create a new fee rule (secured with full multi-tenant validation)
  app.post('/api/contracts/:contractId/rules', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId } = req.params;
      const ruleData = req.body;

      // Validate contract access with full 3-level hierarchy
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      
      if (!contract) {
        return res.status(404).json({ message: error || 'Contract not found' });
      }
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }

      if (await sendIfLocked(res, contractId)) return;

      // Create the rule
      const newRule = await storage.createRoyaltyRule({
        ...ruleData,
        contractId
      });

      // Sync qualifiers from the new rule's productCategories/territories so
      // the qualifiers table stays consistent with the rule.
      try {
        const syncResult = await syncQualifiersFromRule(newRule as any);
        if (!syncResult.skipped) {
          console.log(`[RULES] Synced ${syncResult.written} qualifier row(s) for new rule ${newRule.id}`);
        }
      } catch (syncErr) {
        console.error('[RULES] Qualifier sync on create failed:', syncErr);
      }

      // Log the creation
      await createAuditLog(req, 'rule_created', 'royalty_rule', newRule.id, {
        contractId,
        ruleName: ruleData.ruleName
      });

      try {
        const { revertContractApprovalIfRulesIncomplete } = await import('./services/contractApprovalIntegrity');
        await revertContractApprovalIfRulesIncomplete(contractId, `New rule '${ruleData.ruleName}' was added`);
      } catch (revertErr) {
        console.error('[contractApprovalIntegrity] create-rule revert failed:', revertErr);
      }

      res.json({ message: 'Rule created successfully', rule: newRule });
    } catch (error) {
      console.error('Error creating rule:', error);
      res.status(500).json({ message: 'Failed to create rule' });
    }
  });

  // Update a fee rule (secured with full multi-tenant validation)
  app.patch('/api/contracts/:contractId/rules/:ruleId', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, ruleId } = req.params;
      const updates = req.body;

      // Validate contract access with full 3-level hierarchy
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      
      if (!contract) {
        return res.status(404).json({ message: error || 'Contract not found' });
      }
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }

      if (await sendIfLocked(res, contractId)) return;

      // VERSIONING: Fetch current rule state and create version snapshot before update
      const existingRules = await storage.getRoyaltyRulesByContract(contractId);
      const currentRule = existingRules.find((r: any) => r.id === ruleId);
      if (currentRule) {
        const currentVersionNum = (currentRule as any).ruleVersionNum || 1;
        const previousSnapshot: any = {
          ruleName: currentRule.ruleName,
          ruleType: currentRule.ruleType,
          baseRate: currentRule.baseRate,
          volumeTiers: currentRule.volumeTiers,
          productCategories: currentRule.productCategories,
          territories: currentRule.territories,
          formulaDefinition: currentRule.formulaDefinition,
          clauseCategory: (currentRule as any).clauseCategory,
          customerSegments: (currentRule as any).customerSegments,
          channel: (currentRule as any).channel,
          minimumPrice: (currentRule as any).minimumPrice,
          previousVersionData: (currentRule as any).previousVersionData,
          updatedAt: currentRule.updatedAt ? new Date(currentRule.updatedAt).toISOString() : new Date().toISOString(),
        };
        updates.ruleVersionNum = currentVersionNum + 1;
        updates.previousVersionData = previousSnapshot;
      }

      // UNIVERSAL APPROACH: Auto-generate executable FormulaDefinition from tableData
      if (updates.formulaDefinition?.tableData && updates.fieldMappings) {
        try {
          const tableData: TableData = updates.formulaDefinition.tableData;
          const fieldMappings: BuilderFieldMappings = {
            volume: updates.fieldMappings.volumeField,
            rate: updates.fieldMappings.rateField,
            minimum: updates.fieldMappings.minimumField,
            description: updates.fieldMappings.descriptionField,
          };
          
          // Build executable formula from edited table data
          const executableFormula = buildFormulaDefinition({
            tableData,
            fieldMappings,
            ruleName: updates.ruleName || 'Dynamic Rule',
            minimumGuarantee: updates.minimumGuarantee,
            productFilters: updates.productCategories,
            territoryFilters: updates.territories,
          });
          
          // Merge the executable formula into formulaDefinition (preserve tableData for re-editing)
          updates.formulaDefinition = {
            ...updates.formulaDefinition,
            ...executableFormula,
            tableData, // Keep original tableData for future edits
          };
          
          console.log('[RULES] Generated executable formula from tableData:', {
            name: executableFormula.name,
            hasFormula: !!executableFormula.formula,
            formulaType: executableFormula.formula?.type,
            fieldMappingsReceived: fieldMappings,
            tableRows: tableData.rows?.length || 0
          });
        } catch (buildError) {
          console.error('[RULES] Error building formula definition:', buildError);
          // Continue with save even if formula build fails
        }
      }

      // Approval lifecycle is owned by the dedicated approve/reject endpoints,
      // never by a generic rule edit. Strip these so a frontend that round-trips
      // the whole rule object cannot accidentally preserve approval through a
      // substance change.
      delete updates.approvalStatus;
      delete updates.approvedBy;
      delete updates.approvedAt;

      // If the rule was already approved and the edit changes substance, demote
      // the rule back to pending so the contract approval cascade re-opens.
      const editsRuleSubstance = Object.keys(updates).some(k =>
        !['updatedAt', 'reviewStatus', 'reviewedBy', 'reviewedAt', 'isActive',
          'ruleVersionNum', 'previousVersionData'].includes(k)
      );
      if (editsRuleSubstance && currentRule && (currentRule as any).approvalStatus === 'approved') {
        (updates as any).approvalStatus = 'pending';
        (updates as any).approvedBy = null;
        (updates as any).approvedAt = null;
      }

      // Mint a pending contract version (or append to the existing one) BEFORE
      // applying the rule edit, so the prior rule snapshot is captured for
      // the discard flow.
      if (editsRuleSubstance && currentRule) {
        try {
          const { ensurePendingVersionForRuleEdit } = await import('./services/contractVersionMint');
          await ensurePendingVersionForRuleEdit(
            contractId,
            ruleId,
            req.user?.id || contractId,
            updates.ruleName || (currentRule as any).ruleName || 'Rule',
          );
        } catch (mintErr) {
          console.error('[contractVersionMint] PATCH contract-rules mint failed:', mintErr);
        }
      }

      // Update the rule
      const updatedRule = await storage.updateRoyaltyRule(ruleId, updates);

      // Sync qualifiers from the updated rule so contract_qualifiers stays the
      // single source of truth. Deletes prior product/territory qualifier rows
      // for this rule's clause and reinserts them from the new arrays.
      try {
        const syncResult = await syncQualifiersFromRule(updatedRule as any);
        if (!syncResult.skipped) {
          console.log(`[RULES] Synced ${syncResult.written} qualifier row(s) for updated rule ${ruleId}`);
        }
      } catch (syncErr) {
        console.error('[RULES] Qualifier sync on update failed:', syncErr);
      }

      // Cascade: if any active rule is no longer approved, demote any approved
      // contract version snapshots back to pending_approval so the contract
      // must be re-approved before fees can be calculated.
      try {
        const { revertContractApprovalIfRulesIncomplete } = await import('./services/contractApprovalIntegrity');
        await revertContractApprovalIfRulesIncomplete(contractId, `Rule '${(updatedRule as any).ruleName || ruleId}' was edited`);
      } catch (revertErr) {
        console.error('[contractApprovalIntegrity] PATCH contract-rules revert failed:', revertErr);
      }

      // Log the update
      await createAuditLog(req, 'rule_updated', 'royalty_rule', ruleId, {
        contractId,
        updates
      });

      res.json({ message: 'Rule updated successfully' });
    } catch (error) {
      console.error('Error updating rule:', error);
      res.status(500).json({ message: 'Failed to update rule' });
    }
  });

  // Get version history for a fee rule
  app.get('/api/contracts/:contractId/rules/:ruleId/versions', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, ruleId } = req.params;

      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      if (!contract) {
        return res.status(404).json({ message: error || 'Contract not found' });
      }
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }

      const rules = await storage.getRoyaltyRulesByContract(contractId);
      const rule = rules.find((r: any) => r.id === ruleId);
      if (!rule) {
        return res.status(404).json({ message: 'Rule not found' });
      }

      const currentVersion = (rule as any).ruleVersionNum || 1;
      const previousVersions: Array<{ version: number; data: any; updatedAt: string }> = [];

      let versionData = (rule as any).previousVersionData;
      let versionNum = currentVersion - 1;

      while (versionData && versionNum >= 1) {
        const { previousVersionData: nestedPrevious, updatedAt, ...snapshotData } = versionData;
        previousVersions.push({
          version: versionNum,
          data: snapshotData,
          updatedAt: updatedAt || '',
        });
        versionData = nestedPrevious;
        versionNum--;
      }

      res.json({
        currentVersion,
        previousVersions,
      });
    } catch (error) {
      console.error('Error fetching rule versions:', error);
      res.status(500).json({ message: 'Failed to fetch rule versions' });
    }
  });

  // Restore a fee rule to a previous version
  // POST /api/contracts/:contractId/rules/:ruleId/restore/:version
  // Walks the previousVersionData chain to find the requested snapshot, then
  // snapshots the current state as the new previousVersionData (so the restore
  // itself becomes a reversible version) and applies the snapshot fields.
  app.post('/api/contracts/:contractId/rules/:ruleId/restore/:version', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, ruleId } = req.params;
      const targetVersion = parseInt(req.params.version, 10);
      if (!Number.isFinite(targetVersion) || targetVersion < 1) {
        return res.status(400).json({ message: 'Version must be a positive integer' });
      }

      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      if (!contract) return res.status(404).json({ message: error || 'Contract not found' });
      if (!authorized) return res.status(403).json({ message: error || 'Access denied' });

      const rules = await storage.getRoyaltyRulesByContract(contractId);
      const currentRule = rules.find((r: any) => r.id === ruleId);
      if (!currentRule) return res.status(404).json({ message: 'Rule not found' });

      const currentVersion = (currentRule as any).ruleVersionNum || 1;
      if (targetVersion >= currentVersion) {
        return res.status(400).json({
          message: `Cannot restore to version ${targetVersion} — current version is ${currentVersion}. Pick a prior version.`,
        });
      }

      // Walk the previousVersionData chain back to the requested version.
      let versionData: any = (currentRule as any).previousVersionData;
      let versionNum = currentVersion - 1;
      while (versionData && versionNum > targetVersion) {
        versionData = versionData.previousVersionData;
        versionNum--;
      }
      if (!versionData || versionNum !== targetVersion) {
        return res.status(404).json({ message: `Version ${targetVersion} not found in history` });
      }

      // Strip the chain pointer + timestamp from the snapshot — only restore real rule fields.
      const { previousVersionData: _nested, updatedAt: _ts, ...restoredFields } = versionData;

      // Snapshot the CURRENT state so the restore is itself reversible (mirrors PUT behavior).
      const currentSnapshot: any = {
        ruleName: currentRule.ruleName,
        ruleType: currentRule.ruleType,
        baseRate: currentRule.baseRate,
        volumeTiers: currentRule.volumeTiers,
        productCategories: currentRule.productCategories,
        territories: currentRule.territories,
        formulaDefinition: currentRule.formulaDefinition,
        clauseCategory: (currentRule as any).clauseCategory,
        customerSegments: (currentRule as any).customerSegments,
        channel: (currentRule as any).channel,
        minimumPrice: (currentRule as any).minimumPrice,
        previousVersionData: (currentRule as any).previousVersionData,
        updatedAt: currentRule.updatedAt
          ? new Date(currentRule.updatedAt).toISOString()
          : new Date().toISOString(),
      };

      const updates: any = {
        ...restoredFields,
        ruleVersionNum: currentVersion + 1,
        previousVersionData: currentSnapshot,
        updatedAt: new Date(),
      };

      const restored = await storage.updateRoyaltyRule(ruleId, updates);

      await createAuditLog(req, 'rule_restored', 'royalty_rule', ruleId, {
        contractId,
        fromVersion: currentVersion,
        toVersion: targetVersion,
      });

      res.json({
        message: `Rule restored to version ${targetVersion}`,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        rule: restored,
      });
    } catch (err) {
      console.error('Error restoring rule version:', err);
      res.status(500).json({ message: 'Failed to restore rule version' });
    }
  });

  /**
   * @deprecated Legacy `license_rule_sets` endpoint — DO NOT USE for new work.
   *
   * This route operates on the legacy DSL rule storage system (`license_rule_sets` table
   * with `rules_dsl` JSONB column). That system has been replaced by `contract_rules`,
   * which is the only storage the calculation engine reads from.
   *
   * Current state: the underlying table has been dropped from the database and the
   * `storage.getLicenseRuleSet` / `storage.updateLicenseRuleSet` methods no longer exist
   * on the storage interface. Any call to this endpoint will throw at runtime.
   *
   * Kept in place for backward-compat only. New code MUST use the `contract_rules`
   * endpoints (POST/PUT/DELETE `/api/contracts/:contractId/rules` and
   * `/api/contracts/:contractId/rules/:ruleId`). To migrate any historical rows from
   * `license_rule_sets` (if the table is restored), call
   * `POST /api/admin/migrate-rule-sets-to-contract-rules`.
   *
   * TODO: Remove this handler and the matching frontend caller in
   * `client/src/components/RoyaltyRulesEditor.tsx` once the legacy editor is retired.
   */
  app.put('/api/contracts/:contractId/rules/:ruleSetId/rule/:ruleIndex', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, ruleSetId, ruleIndex } = req.params;
      const updatedRule = req.body;
      const index = parseInt(ruleIndex);

      // Validate contract access with full 3-level hierarchy
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      
      if (!contract) {
        return res.status(404).json({ message: error || 'Contract not found' });
      }
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }

      // Get the rule set
      const ruleSet = await storage.getLicenseRuleSet(ruleSetId);
      if (!ruleSet || ruleSet.contractId !== contractId) {
        return res.status(404).json({ message: 'Rule set not found' });
      }

      // Get current rules
      const rulesDsl = ruleSet.rulesDsl as any;
      const rules = rulesDsl?.rules || [];
      if (index < 0 || index >= rules.length) {
        return res.status(400).json({ message: 'Invalid rule index' });
      }

      // Update the rule
      rules[index] = {
        ...rules[index],
        ...updatedRule,
        id: rules[index].id, // Preserve the ID
      };

      const updatedRulesDsl = {
        ...rulesDsl,
        rules
      };

      await storage.updateLicenseRuleSet(ruleSetId, {
        rulesDsl: updatedRulesDsl
      } as any);

      // Log the update
      await createAuditLog(req, 'rule_updated', 'license_rule', ruleSetId, {
        ruleIndex: index,
        ruleName: updatedRule.ruleName
      });

      res.json({ message: 'Rule updated successfully', rule: rules[index] });
    } catch (error) {
      console.error('Error updating rule:', error);
      res.status(500).json({ message: 'Failed to update rule' });
    }
  });

  /**
   * @deprecated Legacy `license_rule_sets` endpoint — DO NOT USE for new work.
   * See deprecation note on the corresponding PUT handler above. Use the
   * `contract_rules` endpoints instead. Will throw at runtime; the backing table
   * and storage methods no longer exist.
   */
  app.post('/api/contracts/:contractId/rules/:ruleSetId/rule', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, ruleSetId } = req.params;
      const newRule = req.body;

      // Validate contract access with full 3-level hierarchy
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      
      if (!contract) {
        return res.status(404).json({ message: error || 'Contract not found' });
      }
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }

      // Get the rule set
      const ruleSet = await storage.getLicenseRuleSet(ruleSetId);
      if (!ruleSet || ruleSet.contractId !== contractId) {
        return res.status(404).json({ message: 'Rule set not found' });
      }

      // Add the new rule
      const rulesDsl = ruleSet.rulesDsl as any;
      const rules = rulesDsl?.rules || [];
      const ruleWithId = {
        ...newRule,
        id: crypto.randomUUID(),
        priority: newRule.priority || rules.length + 1
      };
      
      rules.push(ruleWithId);

      const updatedRulesDsl = {
        ...rulesDsl,
        rules
      };

      await storage.updateLicenseRuleSet(ruleSetId, {
        rulesDsl: updatedRulesDsl
      } as any);

      // Log the addition
      await createAuditLog(req, 'rule_added', 'license_rule', ruleSetId, {
        ruleName: newRule.ruleName
      });

      res.json({ message: 'Rule added successfully', rule: ruleWithId });
    } catch (error) {
      console.error('Error adding rule:', error);
      res.status(500).json({ message: 'Failed to add rule' });
    }
  });

  /**
   * @deprecated Legacy `license_rule_sets` endpoint — DO NOT USE for new work.
   * See deprecation note on the corresponding PUT handler above. Use the
   * `contract_rules` endpoints instead. Will throw at runtime; the backing table
   * and storage methods no longer exist.
   */
  app.delete('/api/contracts/:contractId/rules/:ruleSetId/rule/:ruleIndex', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, ruleSetId, ruleIndex } = req.params;
      const index = parseInt(ruleIndex);

      // Validate contract access with full 3-level hierarchy
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      
      if (!contract) {
        return res.status(404).json({ message: error || 'Contract not found' });
      }
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }

      // Get the rule set
      const ruleSet = await storage.getLicenseRuleSet(ruleSetId);
      if (!ruleSet || ruleSet.contractId !== contractId) {
        return res.status(404).json({ message: 'Rule set not found' });
      }

      // Get current rules
      const rulesDsl = ruleSet.rulesDsl as any;
      const rules = rulesDsl?.rules || [];
      if (index < 0 || index >= rules.length) {
        return res.status(400).json({ message: 'Invalid rule index' });
      }

      // Remove the rule
      const deletedRule = rules.splice(index, 1)[0];

      const updatedRulesDsl = {
        ...rulesDsl,
        rules
      };

      await storage.updateLicenseRuleSet(ruleSetId, {
        rulesDsl: updatedRulesDsl
      } as any);

      // Log the deletion
      await createAuditLog(req, 'rule_deleted', 'license_rule', ruleSetId, {
        ruleIndex: index,
        ruleName: deletedRule.ruleName
      });

      res.json({ message: 'Rule deleted successfully' });
    } catch (error) {
      console.error('Error deleting rule:', error);
      res.status(500).json({ message: 'Failed to delete rule' });
    }
  });

  // Calculate royalties using the rules engine
  // NOTE: This route is disabled because it conflicts with the working route in routes.ts
  // and uses non-existent storage.getLicenseRuleSetsByContract() function
  // app.post('/api/contracts/:contractId/calculate-fees', isAuthenticated, async (req: any, res) => {
  //   try {
  //     const contractId = req.params.contractId;
  //     const userId = req.user.id;
  //     const calculationInput: RoyaltyCalculationInput = req.body;

  //     // Check permissions
  //     const contract = await storage.getContract(contractId);
  //     if (!contract) {
  //       return res.status(404).json({ message: 'Contract not found' });
  //     }

  //     const userRole = (await storage.getUser(userId))?.role;
  //     const canViewAny = userRole === 'admin' || userRole === 'owner';
      
  //     if (!canViewAny && contract.uploadedBy !== userId) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     // Get rule sets for this contract
  //     const ruleSets = await storage.getLicenseRuleSetsByContract(contractId);
      
  //     if (ruleSets.length === 0) {
  //       return res.status(404).json({ message: 'No rules found for this contract' });
  //     }

  //     // Convert rule sets to RoyaltyRule format for the engine
  //     const allRules = ruleSets.flatMap(ruleSet => {
  //       const rulesDsl = ruleSet.rulesDsl as any;
  //       return (rulesDsl?.rules || []).map((rule: any) => ({
  //         id: rule.id || crypto.randomUUID(),
  //         ruleName: rule.ruleName || rule.description || 'Unnamed Rule',
  //         ruleType: rule.ruleType || 'percentage',
  //         description: rule.description || '',
  //         conditions: rule.conditions || {},
  //         calculation: rule.calculation || {},
  //         priority: rule.priority || 10,
  //         isActive: true,
  //         confidence: rule.confidence || 1.0
  //       }));
  //     });

  //     // Calculate royalties using the rules engine
  //     const result = await RulesEngine.calculateRoyalties(allRules, calculationInput);

  //     // Log the calculation
  //     await createAuditLog(req, 'royalty_calculated', 'contract', contractId, {
  //       inputData: calculationInput,
  //       totalRoyalty: result.totalRoyalty,
  //       rulesApplied: result.metadata.rulesApplied
  //     });

  //     res.json(result);
  //   } catch (error) {
  //     console.error('Error calculating royalties:', error);
  //     res.status(500).json({ message: 'Failed to calculate fees' });
  //   }
  // });

  // Get fee rules for a specific contract
  // Requires contractId and validates full 3-level hierarchy access (Company → BU → Location)
  app.get('/api/royalty-rules', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId } = req.query;
      
      // contractId is required for scoped access
      if (!contractId) {
        return res.status(400).json({ message: 'contractId is required' });
      }
      
      // Validate contract access with full 3-level hierarchy
      const { contract, authorized, error } = await validateContractAccess(contractId as string, req.user);
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }
      
      // Get rules for this specific contract
      const rules = await storage.getRoyaltyRulesByContract(contractId as string);
      const rulesWithContract = rules.map(r => ({ 
        ...r, 
        contractName: contract.displayName || contract.counterpartyName || `Contract ${contract.id.slice(0, 8)}`
      }));
      
      res.json({ rules: rulesWithContract, total: rulesWithContract.length });
    } catch (error) {
      console.error('Error fetching rules:', error);
      res.status(500).json({ message: 'Failed to fetch rules' });
    }
  });

  // Get confirmed term mappings for a specific contract
  // Requires contractId and validates full 3-level hierarchy access
  app.get('/api/confirmed-term-mappings', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId } = req.query;
      
      // contractId is required for scoped access
      if (!contractId) {
        return res.status(400).json({ message: 'contractId is required' });
      }
      
      // Validate contract access with full 3-level hierarchy
      const { contract, authorized, error } = await validateContractAccess(contractId as string, req.user);
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }
      
      // Get confirmed mappings for this specific contract
      const mappings = await storage.getPendingTermMappingsByContract(contractId as string, 'confirmed');
      const mappingsWithContract = mappings.map(m => ({
        ...m,
        contractName: contract.displayName || contract.counterpartyName || `Contract ${contract.id.slice(0, 8)}`
      }));
      
      res.json({ mappings: mappingsWithContract });
    } catch (error) {
      console.error('Error fetching confirmed mappings:', error);
      res.status(500).json({ message: 'Failed to fetch confirmed mappings' });
    }
  });

  // Update a confirmed term mapping
  // Validates full 3-level hierarchy access via validateContractAccess
  app.patch('/api/confirmed-term-mappings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { contractTerm, erpFieldName } = req.body;
      
      // Validate required fields
      if (!contractTerm && !erpFieldName) {
        return res.status(400).json({ message: 'At least one field (contractTerm or erpFieldName) is required' });
      }
      
      // Verify the mapping exists (uniform 403 if not to prevent enumeration)
      const mapping = await storage.getPendingTermMapping(id);
      if (!mapping) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Validate contract access with full 3-level hierarchy
      const { authorized, error } = await validateContractAccess(mapping.contractId, req.user);
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }
      
      // Build update object with only provided fields
      const updates: any = {};
      if (contractTerm !== undefined) updates.contractTerm = contractTerm;
      if (erpFieldName !== undefined) updates.erpFieldName = erpFieldName;
      
      const updatedMapping = await storage.updatePendingTermMapping(id, updates);
      
      await createAuditLog(req, 'mapping_updated', 'term_mapping', id, {
        contractId: mapping.contractId,
        updates
      });
      
      res.json({ mapping: updatedMapping });
    } catch (error) {
      console.error('Error updating mapping:', error);
      res.status(500).json({ message: 'Failed to update mapping' });
    }
  });

  // Delete a confirmed term mapping
  // Validates full 3-level hierarchy access via validateContractAccess (which checks admin role)
  app.delete('/api/confirmed-term-mappings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Verify the mapping exists (uniform 403 if not to prevent enumeration)
      const mapping = await storage.getPendingTermMapping(id);
      if (!mapping) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Validate contract access with full 3-level hierarchy
      // validateContractAccess checks both tenant scope AND admin role requirements
      const { contract, authorized, error } = await validateContractAccess(mapping.contractId, req.user);
      
      if (!authorized) {
        return res.status(403).json({ message: error || 'Access denied' });
      }
      
      await storage.deletePendingTermMapping(id);
      
      await createAuditLog(req, 'mapping_deleted', 'term_mapping', id, {
        contractId: mapping.contractId
      });
      
      res.json({ message: 'Mapping deleted successfully' });
    } catch (error) {
      console.error('Error deleting mapping:', error);
      res.status(500).json({ message: 'Failed to delete mapping' });
    }
  });

  // =====================================================
  // RULE APPROVAL GATE — owner/admin/editor only.
  // Approved rules are the only ones eligible for fee calculation.
  // =====================================================

  // Permission helper for the approval gate.
  // System admins always pass; otherwise the active context role must be
  // owner / admin / company_admin / editor.
  const canApproveRules = (user: any): boolean => {
    if (user?.isSystemAdmin === true) return true;
    const ctxRole = (user?.activeContext?.role || '').toLowerCase();
    const userRole = (user?.role || '').toLowerCase();
    const allowed = ['owner', 'admin', 'company_admin', 'editor'];
    return allowed.includes(ctxRole) || allowed.includes(userRole);
  };

  // POST /api/contracts/:contractId/rules/:ruleId/approve
  app.post('/api/contracts/:contractId/rules/:ruleId/approve', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, ruleId } = req.params;
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      if (!authorized) return res.status(403).json({ message: error || 'Access denied' });

      if (!canApproveRules(req.user)) {
        return res.status(403).json({ message: 'Approval requires owner, admin, or editor role' });
      }

      const { db } = await import('./db');
      const { contractRules } = await import('../shared/schema');
      const { and, eq } = await import('drizzle-orm');

      const updated = await db.update(contractRules)
        .set({
          approvalStatus: 'approved',
          approvedBy: req.user.id,
          approvedAt: new Date(),
          approvalNotes: req.body?.notes ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(contractRules.id, ruleId), eq(contractRules.contractId, contractId)))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ message: 'Rule not found for this contract' });
      }

      await createAuditLog(req, 'rule_approved', 'contract_rule', ruleId, { contractId });
      res.json({ message: 'Rule approved', rule: updated[0] });
    } catch (err) {
      console.error('Error approving rule:', err);
      res.status(500).json({ message: 'Failed to approve rule' });
    }
  });

  // POST /api/contracts/:contractId/rules/:ruleId/reject
  app.post('/api/contracts/:contractId/rules/:ruleId/reject', isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, ruleId } = req.params;
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      if (!authorized) return res.status(403).json({ message: error || 'Access denied' });

      if (!canApproveRules(req.user)) {
        return res.status(403).json({ message: 'Rejection requires owner, admin, or editor role' });
      }

      const notes = (req.body?.approvalNotes ?? req.body?.notes ?? '').toString().trim();
      if (!notes) {
        return res.status(400).json({ message: 'approvalNotes is required when rejecting a rule' });
      }

      const { db } = await import('./db');
      const { contractRules } = await import('../shared/schema');
      const { and, eq } = await import('drizzle-orm');

      const updated = await db.update(contractRules)
        .set({
          approvalStatus: 'rejected',
          approvedBy: req.user.id,
          approvedAt: new Date(),
          approvalNotes: notes,
          updatedAt: new Date(),
        })
        .where(and(eq(contractRules.id, ruleId), eq(contractRules.contractId, contractId)))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ message: 'Rule not found for this contract' });
      }

      await createAuditLog(req, 'rule_rejected', 'contract_rule', ruleId, { contractId, notes });

      try {
        const { revertContractApprovalIfRulesIncomplete } = await import('./services/contractApprovalIntegrity');
        await revertContractApprovalIfRulesIncomplete(contractId, `Rule '${updated[0]?.ruleName || ruleId}' was rejected`);
      } catch (revertErr) {
        console.error('[contractApprovalIntegrity] reject-rule revert failed:', revertErr);
      }

      res.json({ message: 'Rule rejected', rule: updated[0] });
    } catch (err) {
      console.error('Error rejecting rule:', err);
      res.status(500).json({ message: 'Failed to reject rule' });
    }
  });

  /**
   * POST /api/admin/migrate-rule-sets-to-contract-rules
   *
   * One-shot migration utility for moving any historical `license_rule_sets` rows
   * into the modern `contract_rules` table.
   *
   * Background: `license_rule_sets` (legacy DSL storage) was deprecated in favor of
   * `contract_rules` (the only storage the calculation engine reads from). The legacy
   * table has already been dropped from this database, so in the current state this
   * endpoint detects an empty source and reports `migrated: 0`. If the table is ever
   * restored from a backup, this endpoint will pick it up and migrate the data.
   *
   * Idempotent-ish: skips rules whose ruleName already exists in `contract_rules` for
   * the same contractId. System-admin only.
   */
  app.post('/api/admin/migrate-rule-sets-to-contract-rules', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSystemAdmin(req.user)) {
        return res.status(403).json({ message: 'System administrator access required' });
      }

      const { db } = await import('./db');
      const { contractRules } = await import('../shared/schema');
      const { sql, and, eq } = await import('drizzle-orm');

      // 1. Detect whether the legacy table is present at all. to_regclass returns NULL if not.
      const probe: any = await db.execute(sql`SELECT to_regclass('public.license_rule_sets') AS exists`);
      const tableExists = !!(probe?.rows?.[0]?.exists ?? probe?.[0]?.exists);
      if (!tableExists) {
        await createAuditLog(req, 'rule_set_migration_run', 'system', 'license_rule_sets', {
          tableExists: false,
          migrated: 0,
        });
        return res.json({
          tableExists: false,
          message: 'license_rule_sets table does not exist in this database — nothing to migrate.',
          ruleSetsScanned: 0,
          rulesScanned: 0,
          migrated: 0,
          skippedDuplicates: 0,
          failed: 0,
          errors: [],
        });
      }

      // 2. Read every rule set. Use raw SQL since there is no Drizzle schema entry.
      const ruleSetsResult: any = await db.execute(
        sql`SELECT id, contract_id, rules_dsl FROM license_rule_sets`
      );
      const ruleSets: any[] = ruleSetsResult?.rows ?? ruleSetsResult ?? [];

      let rulesScanned = 0;
      let migrated = 0;
      let skippedDuplicates = 0;
      let failed = 0;
      const errors: Array<{ ruleSetId: string; ruleName?: string; error: string }> = [];

      for (const rs of ruleSets) {
        const contractId: string = rs.contract_id || rs.contractId;
        const dsl = rs.rules_dsl || rs.rulesDsl || {};
        const legacyRules: any[] = Array.isArray(dsl?.rules) ? dsl.rules : [];

        for (const lr of legacyRules) {
          rulesScanned++;
          try {
            // Skip if a rule with this name already exists on this contract — keeps the
            // migration safe to re-run without producing duplicates.
            if (lr?.ruleName && contractId) {
              const existing = await db.select({ id: contractRules.id })
                .from(contractRules)
                .where(and(
                  eq(contractRules.contractId, contractId),
                  eq(contractRules.ruleName, lr.ruleName),
                ))
                .limit(1);
              if (existing.length > 0) {
                skippedDuplicates++;
                continue;
              }
            }

            // Map the DSL shape onto the contract_rules columns. Anything we cannot
            // confidently map (DSL conditions, custom expression nodes, etc.) is preserved
            // verbatim under formulaDefinition.legacyDsl so no information is lost.
            await db.insert(contractRules).values({
              contractId,
              ruleName: lr.ruleName || 'Migrated rule',
              ruleType: lr.ruleType || 'percentage',
              baseRate: lr.baseRate != null ? String(lr.baseRate) : null,
              minimumGuarantee: lr.minimumGuarantee != null ? String(lr.minimumGuarantee) : null,
              volumeTiers: lr.volumeTiers ?? lr.tiers ?? null,
              productCategories: Array.isArray(lr.productCategories) ? lr.productCategories : null,
              territories: Array.isArray(lr.territories) ? lr.territories : null,
              priority: typeof lr.priority === 'number' ? lr.priority : 0,
              isActive: lr.isActive !== false,
              clauseCategory: lr.clauseCategory || 'general',
              formulaDefinition: lr.formulaDefinition
                ? lr.formulaDefinition
                : { legacyDsl: lr, migratedFrom: 'license_rule_sets' },
              // Migrated rules land in the review queue: not auto-verified, not auto-approved.
              reviewStatus: 'pending',
              approvalStatus: 'pending',
            });
            migrated++;
          } catch (e: any) {
            failed++;
            errors.push({
              ruleSetId: rs.id,
              ruleName: lr?.ruleName,
              error: e?.message || String(e),
            });
          }
        }
      }

      await createAuditLog(req, 'rule_set_migration_run', 'system', 'license_rule_sets', {
        ruleSetsScanned: ruleSets.length,
        rulesScanned,
        migrated,
        skippedDuplicates,
        failed,
      });

      res.json({
        tableExists: true,
        ruleSetsScanned: ruleSets.length,
        rulesScanned,
        migrated,
        skippedDuplicates,
        failed,
        errors: errors.slice(0, 50),
      });
    } catch (err: any) {
      console.error('Error migrating rule sets to contract rules:', err);
      res.status(500).json({
        message: 'Failed to migrate rule sets',
        error: err?.message || String(err),
      });
    }
  });

  // One-time qualifier backfill — for every rule in a contract, rewrites
  // product/territory qualifier rows from the rule's stored arrays. Safe to
  // re-run. After running, stored arrays and derived values should match
  // and /api/admin/qualifier-parity/:contractId should report zero mismatches.
  app.post('/api/admin/qualifier-backfill/:contractId', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user?.role !== 'sysadmin' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const { contractId } = req.params;
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      if (!contract) return res.status(404).json({ message: error || 'Contract not found' });
      if (!authorized) return res.status(403).json({ message: error || 'Access denied' });

      const result = await backfillQualifiersForContract(contractId);
      await createAuditLog(req, 'qualifier_backfill', 'contract', contractId, result);
      res.json({ contractId, ...result });
    } catch (err: any) {
      console.error('Error running qualifier backfill:', err);
      res.status(500).json({ message: 'Failed to run qualifier backfill', error: err?.message || String(err) });
    }
  });

  // Qualifier parity report — verifies that stored productCategories/territories
  // match what would be derived from contract_qualifiers. Returns only rules
  // that disagree. A clean contract returns { mismatches: [] }.
  app.get('/api/admin/qualifier-parity/:contractId', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user?.role !== 'sysadmin' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const { contractId } = req.params;
      const { contract, authorized, error } = await validateContractAccess(contractId, req.user);
      if (!contract) return res.status(404).json({ message: error || 'Contract not found' });
      if (!authorized) return res.status(403).json({ message: error || 'Access denied' });

      const report = await getParityReport(contractId);
      res.json(report);
    } catch (err: any) {
      console.error('Error generating qualifier parity report:', err);
      res.status(500).json({ message: 'Failed to generate parity report', error: err?.message || String(err) });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Conditions API (new architecture: 5-dim, group-based AND/OR)
  // ─────────────────────────────────────────────────────────────────────────

  // GET conditions for a single rule (read-through to contract_qualifiers
  // filtered by qualifier_field IN (5 new field codes), keyed by clauseId).
  app.get('/api/contract-rules/:ruleId/conditions', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { ruleId } = req.params;
      const { db } = await import('./db');
      const { contractRules } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const [rule] = await db.select().from(contractRules).where(eq(contractRules.id, ruleId)).limit(1);
      if (!rule) return res.status(404).json({ message: 'Rule not found' });

      const { contract, authorized, error } = await validateContractAccess((rule as any).contractId, req.user);
      if (!contract) return res.status(404).json({ message: error || 'Contract not found' });
      if (!authorized) return res.status(403).json({ message: error || 'Access denied' });

      const byKey = await loadConditionsForContract((rule as any).contractId);
      // Merge conditions linked via clause AND via direct rule:<id> termId.
      // De-dupe on (field|op|value|group|type) since the same row can be
      // indexed under both keys.
      const seen = new Set<string>();
      const merged: any[] = [];
      const collect = (arr: any[] | undefined) => {
        if (!arr) return;
        for (const c of arr) {
          const k = `${c.field}|${c.op}|${c.value}|${c.group}|${c.type}`;
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(c);
        }
      };
      if ((rule as any).sourceClauseId) {
        collect(byKey.get((rule as any).sourceClauseId));
      }
      collect(byKey.get(`rule:${ruleId}`));

      // Fallback: if no synced conditions yet, derive virtual ones from the
      // rule's legacy productCategories / territories arrays so the editor
      // surfaces what the list-view chips already show. They will be persisted
      // into contract_qualifiers on the next PUT /conditions save.
      if (merged.length === 0) {
        const legacyProducts: string[] = Array.isArray((rule as any).productCategories)
          ? (rule as any).productCategories.filter((v: any) => typeof v === 'string' && v.trim())
          : [];
        const legacyTerritories: string[] = Array.isArray((rule as any).territories)
          ? (rule as any).territories.filter((v: any) => typeof v === 'string' && v.trim())
          : [];
        for (const p of legacyProducts) {
          collect([{ field: 'product', op: 'in', value: p, group: 'G1', type: 'include' }]);
        }
        for (const t of legacyTerritories) {
          collect([{ field: 'territory', op: 'in', value: t, group: 'G1', type: 'include' }]);
        }
      }

      // Sibling-rule suggestions: when this rule still has no conditions, look
      // at sibling rules on the same contract that DO have product/territory
      // conditions. Surface them as suggestions so the user can one-click
      // copy them. Only suggests inclusion conditions (op='in', type='include')
      // and skips non-product rule types (those legitimately have no products).
      const NON_PRODUCT_RULE_TYPES = new Set([
        'minimum_guarantee', 'payment_schedule',
        'fixed_fee', 'annual_fee', 'milestone_payment', 'late_payment_penalty',
        'cap', 'period_cap', 'contract_cap',
        'mdf_accrual', 'recoupable_advance', 'advance_payment', 'signing_bonus',
      ]);
      const suggestedConditions: Array<{
        fromRuleId: string;
        fromRuleName: string;
        conditions: any[];
      }> = [];
      const ruleTypeLower = ((rule as any).ruleType || '').toLowerCase().trim();
      if (merged.length === 0 && !NON_PRODUCT_RULE_TYPES.has(ruleTypeLower)) {
        const { contractRules } = await import('@shared/schema');
        const { eq, and, ne } = await import('drizzle-orm');
        const siblings = await db
          .select()
          .from(contractRules)
          .where(
            and(
              eq(contractRules.contractId, (rule as any).contractId),
              ne(contractRules.id, ruleId),
            ),
          );
        for (const sib of siblings) {
          const sibAny: any = sib;
          const sibConds: any[] = [];
          const sibSeen = new Set<string>();
          const sibCollect = (arr: any[] | undefined) => {
            if (!arr) return;
            for (const c of arr) {
              if (c.field !== 'product' && c.field !== 'product_category' && c.field !== 'territory') continue;
              if (c.type !== 'include' || c.op !== 'in') continue;
              const k = `${c.field}|${c.op}|${c.value}|${c.group}|${c.type}`;
              if (sibSeen.has(k)) continue;
              sibSeen.add(k);
              sibConds.push(c);
            }
          };
          if (sibAny.sourceClauseId) sibCollect(byKey.get(sibAny.sourceClauseId));
          sibCollect(byKey.get(`rule:${sibAny.id}`));
          // Also include legacy fields for siblings whose conditions haven't
          // been synced yet.
          if (sibConds.length === 0) {
            const sp: string[] = Array.isArray(sibAny.productCategories)
              ? sibAny.productCategories.filter((v: any) => typeof v === 'string' && v.trim() && !v.startsWith('!') && v !== 'General')
              : [];
            const st: string[] = Array.isArray(sibAny.territories)
              ? sibAny.territories.filter((v: any) => typeof v === 'string' && v.trim())
              : [];
            for (const p of sp) sibCollect([{ field: 'product', op: 'in', value: p, group: 'G1', type: 'include' }]);
            for (const t of st) sibCollect([{ field: 'territory', op: 'in', value: t, group: 'G1', type: 'include' }]);
          }
          if (sibConds.length > 0) {
            suggestedConditions.push({
              fromRuleId: sibAny.id,
              fromRuleName: sibAny.ruleName || sibAny.id,
              conditions: sibConds,
            });
          }
        }
      }

      res.json({ ruleId, conditions: merged, suggestedConditions });
    } catch (err: any) {
      console.error('[conditions] GET failed:', err);
      res.status(500).json({ message: 'Failed to load conditions', error: err?.message || String(err) });
    }
  });

  // PUT conditions for a single rule — full replace.
  app.put('/api/contract-rules/:ruleId/conditions', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { ruleId } = req.params;
      const parsed = conditionsArraySchema.safeParse(req.body?.conditions ?? []);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid conditions payload', errors: parsed.error.flatten() });
      }

      const { db } = await import('./db');
      const { contractRules } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const [rule] = await db.select().from(contractRules).where(eq(contractRules.id, ruleId)).limit(1);
      if (!rule) return res.status(404).json({ message: 'Rule not found' });

      const { contract, authorized, error } = await validateContractAccess((rule as any).contractId, req.user);
      if (!contract) return res.status(404).json({ message: error || 'Contract not found' });
      if (!authorized) return res.status(403).json({ message: error || 'Access denied' });

      // Clauseless rules are supported: syncConditionsFromRule writes them
      // under termId='rule:<id>' so the read path can index them by `rule:<id>`.
      const result = await syncConditionsFromRule(rule as any, parsed.data);
      res.json({ ok: true, written: result.written, ruleId });
    } catch (err: any) {
      console.error('[conditions] PUT failed:', err);
      res.status(500).json({ message: 'Failed to save conditions', error: err?.message || String(err) });
    }
  });

  // Catalog of (object, attribute) pairs available for rule conditions.
  // Returns the *active* whitelist for the user's company, falling back to
  // system defaults (company_id NULL) for any object the company hasn't
  // overridden. The frontend uses this to drive both the Object dropdown
  // and the Attribute dropdown in the condition editor.
  app.get('/api/rule-condition-catalog', isAuthenticated, async (req: any, res: Response) => {
    try {
      const companyId = req.user?.activeContext?.companyId || null;
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      const r = await db.execute(sql`
        WITH ranked AS (
          SELECT *,
            ROW_NUMBER() OVER (
              PARTITION BY object_code, attribute_code
              ORDER BY CASE WHEN company_id = ${companyId} THEN 0 ELSE 1 END
            ) AS rn
          FROM rule_field_whitelist
          WHERE is_active = true
            AND (company_id IS NULL OR company_id = ${companyId})
        )
        SELECT object_code, attribute_code, label, field_type, master_table,
               is_default, sequence
        FROM ranked WHERE rn = 1
        ORDER BY object_code, sequence, label
      `);
      const rows = ((r as any).rows ?? r) as any[];
      const byObject: Record<string, any> = {};
      for (const row of rows) {
        if (!byObject[row.object_code]) {
          byObject[row.object_code] = { object: row.object_code, attributes: [] };
        }
        byObject[row.object_code].attributes.push({
          code: row.attribute_code,
          label: row.label,
          fieldType: row.field_type,
          masterTable: row.master_table,
          isDefault: row.is_default,
          sequence: row.sequence,
        });
      }

      // Special case: product_attribute is EAV — the "attributes" the user
      // can pick are the distinct attribute_name values that actually exist
      // in product_attributes for this company's products. Replace the seed
      // placeholder with the real list.
      if (companyId) {
        try {
          // Union the company's own attribute names with the global pool of
          // known attribute names. This keeps the dropdown consistently rich
          // — a tenant that has only loaded "Brand" still sees Material,
          // Connectivity, etc. as picking options. Company-specific names
          // sort first so they're prominent.
          const pa = await db.execute(sql`
            WITH company_attrs AS (
              SELECT DISTINCT pa.attribute_name AS code, 0 AS pri
              FROM product_attributes pa
              JOIN products p ON p.id = pa.product_id
              WHERE p.company_id = ${companyId}
                AND pa.attribute_name IS NOT NULL AND pa.attribute_name <> ''
            ),
            global_attrs AS (
              SELECT DISTINCT attribute_name AS code, 1 AS pri
              FROM product_attributes
              WHERE attribute_name IS NOT NULL AND attribute_name <> ''
            ),
            combined AS (
              SELECT code, MIN(pri) AS pri FROM (
                SELECT * FROM company_attrs UNION ALL SELECT * FROM global_attrs
              ) u GROUP BY code
            )
            SELECT code FROM combined ORDER BY pri, code LIMIT 200
          `);
          const paRows = ((pa as any).rows ?? pa) as Array<{ code: string }>;
          if (paRows.length > 0) {
            byObject['product_attribute'] = {
              object: 'product_attribute',
              attributes: paRows.map((r2, i) => ({
                code: r2.code,
                label: r2.code.replace(/_/g, ' '),
                fieldType: 'text',
                masterTable: 'product_attributes',
                isDefault: i === 0,
                sequence: 10 + i,
              })),
            };
          }
        } catch (e) {
          console.warn('[rule-condition-catalog] product_attribute dynamic load failed:', (e as any)?.message);
        }
      }

      res.json({ objects: Object.values(byObject) });
    } catch (err: any) {
      console.error('[rule-condition-catalog] failed:', err);
      res.status(500).json({ message: 'Failed to load catalog', error: err?.message || String(err) });
    }
  });

  // Master-data values for the condition value picker.
  // Returns [{ id, label }] for the requested qualifier field.
  app.get('/api/condition-values/:field', isAuthenticated, async (req: any, res: Response) => {
    try {
      const field = req.params.field;
      const attribute = typeof req.query.attribute === 'string' ? req.query.attribute.trim() : '';
      const companyId = req.user?.activeContext?.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'No active company context' });
      }
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      let rows: Array<{ id: string; label: string }> = [];

      // When the caller passes a specific attribute, look it up in the
      // whitelist to find the master table + column. Then return distinct
      // values from that column. This lights up dropdowns for Partner.type,
      // Customer.segment, Channel.channel_type, etc. — anything an admin
      // has whitelisted, automatically.
      if (attribute) {
        try {
          const wl = await db.execute(sql`
            SELECT master_table FROM rule_field_whitelist
            WHERE object_code = ${field}
              AND attribute_code = ${attribute}
              AND is_active = true
              AND (company_id IS NULL OR company_id = ${companyId})
            ORDER BY CASE WHEN company_id = ${companyId} THEN 0 ELSE 1 END
            LIMIT 1
          `);
          const wlRows = ((wl as any).rows ?? wl) as Array<{ master_table: string | null }>;
          const masterTable = wlRows[0]?.master_table;

          // Special case: product.brand → values come from product_hierarchy
          // (level_name='Brand'). The id returned is the hierarchy row's UUID,
          // which matches what products.brand_id stores, so the OFOV engine
          // can compare them directly without a join at evaluation time.
          if (field === 'product' && attribute === 'brand_id') {
            const r = await db.execute(sql`
              SELECT id::text AS id, hierarchy_value AS label
              FROM product_hierarchy
              WHERE company_id = ${companyId}
                AND lower(level_name) = 'brand'
                AND COALESCE(record_status,'Active') = 'Active'
                AND hierarchy_value IS NOT NULL AND hierarchy_value <> ''
              ORDER BY hierarchy_value LIMIT 500
            `);
            rows = ((r as any).rows ?? r) as any[];
            return res.json({ field, attribute, values: rows });
          }

          // Special case: product_attribute → values come from product_attributes
          if (field === 'product_attribute') {
            const r = await db.execute(sql`
              SELECT DISTINCT pa.attribute_value AS id, pa.attribute_value AS label
              FROM product_attributes pa
              JOIN products p ON p.id = pa.product_id
              WHERE p.company_id = ${companyId}
                AND pa.attribute_name = ${attribute}
                AND pa.attribute_value IS NOT NULL
                AND pa.attribute_value <> ''
              ORDER BY 2 LIMIT 500
            `);
            rows = ((r as any).rows ?? r) as any[];
            return res.json({ field, attribute, values: rows });
          }

          if (masterTable) {
            // Validate identifier — only allow [a-z0-9_] to prevent injection
            const validIdent = /^[a-z][a-z0-9_]*$/.test(attribute) && /^[a-z][a-z0-9_]*$/.test(masterTable);
            if (validIdent) {
              const hasCompanyCol = !['territory_master', 'sales_channels', 'product_classifications'].includes(masterTable);
              const filter = hasCompanyCol
                ? sql`WHERE ${sql.raw(`"${attribute}"`)} IS NOT NULL AND ${sql.raw(`"${attribute}"`)} <> '' AND company_id = ${companyId}`
                : sql`WHERE ${sql.raw(`"${attribute}"`)} IS NOT NULL AND ${sql.raw(`"${attribute}"`)} <> ''`;
              const q = sql`
                SELECT DISTINCT ${sql.raw(`"${attribute}"`)} AS id, ${sql.raw(`"${attribute}"`)} AS label
                FROM ${sql.raw(`"${masterTable}"`)}
              `;
              const r = await db.execute(sql`${q} ${filter} ORDER BY 2 LIMIT 500`);
              rows = ((r as any).rows ?? r) as any[];
              return res.json({ field, attribute, values: rows });
            }
          }
        } catch (e: any) {
          console.warn('[condition-values] dynamic attribute lookup failed:', e?.message);
        }
      }

      switch (field) {
        case 'product': {
          const r = await db.execute(sql`
            SELECT id::text AS id, product_name AS label
            FROM products
            WHERE product_name IS NOT NULL AND company_id = ${companyId}
            ORDER BY product_name LIMIT 500`);
          rows = (r as any).rows ?? (r as any);
          break;
        }
        case 'product_category': {
          // Categories can live in two places:
          //   (1) product_hierarchy (modern Schema Catalog — level_name='Category')
          //   (2) products.product_category (legacy denormalized column)
          // Union both, dedupe by lower(label), prefer hierarchy IDs when present.
          const r = await db.execute(sql`
            WITH hier AS (
              SELECT id::text AS id, hierarchy_value AS label
              FROM product_hierarchy
              WHERE company_id = ${companyId}
                AND lower(level_name) = 'category'
                AND COALESCE(record_status,'Active') = 'Active'
                AND hierarchy_value IS NOT NULL AND hierarchy_value <> ''
            ),
            legacy AS (
              SELECT DISTINCT product_category AS id, product_category AS label
              FROM products
              WHERE company_id = ${companyId}
                AND product_category IS NOT NULL AND product_category <> ''
            ),
            combined AS (
              SELECT id, label FROM hier
              UNION ALL
              SELECT l.id, l.label FROM legacy l
              WHERE NOT EXISTS (
                SELECT 1 FROM hier h WHERE lower(h.label) = lower(l.label)
              )
            )
            SELECT id, label FROM combined ORDER BY label LIMIT 500`);
          rows = (r as any).rows ?? (r as any);
          break;
        }
        case 'partner': {
          const r = await db.execute(sql`
            SELECT id::text AS id, partner_name AS label
            FROM partner_master
            WHERE partner_name IS NOT NULL AND company_id = ${companyId}
            ORDER BY partner_name LIMIT 500`);
          rows = (r as any).rows ?? (r as any);
          break;
        }
        case 'customer': {
          const r = await db.execute(sql`
            SELECT id::text AS id, name AS label
            FROM customers
            WHERE name IS NOT NULL AND company_id = ${companyId}
            ORDER BY name LIMIT 500`);
          rows = (r as any).rows ?? (r as any);
          break;
        }
        case 'territory': {
          // territory_master has no company_id column — it is shared reference data.
          const r = await db.execute(sql`
            SELECT id::text AS id, territory_name AS label
            FROM territory_master
            WHERE territory_name IS NOT NULL
            ORDER BY territory_name LIMIT 500`);
          rows = (r as any).rows ?? (r as any);
          break;
        }
        default:
          return res.status(400).json({ message: `Unknown field: ${field}` });
      }
      res.json({ field, values: rows });
    } catch (err: any) {
      console.error('[condition-values] GET failed:', err);
      res.status(500).json({ message: 'Failed to load values', error: err?.message || String(err) });
    }
  });

  // Heuristic prefill for the Add Rule form. Given the rule name (and optional
  // description) the user is typing, returns a best-guess ruleType + baseMetric
  // with a confidence score and human-readable rationale. Pure keyword matching —
  // no LLM call — so it stays fast (<5ms) and predictable.
  app.post('/api/rules/suggest', isAuthenticated, async (req: any, res: Response) => {
    try {
      const name = String(req.body?.name || '').trim();
      const description = String(req.body?.description || '').trim();
      if (name.length < 3) {
        return res.json({ suggestion: null });
      }
      const text = `${name} ${description}`.toLowerCase();

      // Rule-type keyword scoring. Higher-specificity matches win on tie.
      type RuleHit = { value: string; weight: number; matched: string };
      const ruleRules: Array<{ value: string; patterns: Array<{ re: RegExp; w: number; tag: string }> }> = [
        { value: 'mdf_accrual', patterns: [
          { re: /\b(mdf|market\s+development\s+fund)/, w: 10, tag: 'MDF' },
        ]},
        { value: 'recoupable_advance', patterns: [
          { re: /\brecoup/, w: 10, tag: 'recoup' },
          { re: /\badvance/, w: 6, tag: 'advance' },
        ]},
        { value: 'returns_reserve', patterns: [
          { re: /\b(returns?\s+reserve|reserve\s+for\s+returns?)/, w: 10, tag: 'returns reserve' },
        ]},
        { value: 'performance_bonus', patterns: [
          { re: /\bperformance\s+bonus/, w: 10, tag: 'performance bonus' },
          { re: /\bbonus/, w: 4, tag: 'bonus' },
        ]},
        { value: 'signing_bonus', patterns: [
          { re: /\bsigning\s+bonus/, w: 10, tag: 'signing bonus' },
        ]},
        { value: 'milestone_payment', patterns: [
          { re: /\bmilestone/, w: 8, tag: 'milestone' },
        ]},
        { value: 'minimum_guarantee', patterns: [
          { re: /\b(minimum\s+guarantee|mg|min\.?\s*guarantee)\b/, w: 9, tag: 'minimum guarantee' },
          { re: /\b(annual|quarterly|monthly)\s+minimum/, w: 6, tag: 'minimum' },
        ]},
        { value: 'mgr', patterns: [
          { re: /\bmgr\b|\bminimum\s+guaranteed\s+royalty/, w: 10, tag: 'MGR' },
        ]},
        { value: 'cap', patterns: [
          { re: /\bcap\b|\bcapped\b|\bceiling/, w: 8, tag: 'cap' },
        ]},
        { value: 'late_payment_penalty', patterns: [
          { re: /\blate\s+(payment|fee|penalty)/, w: 10, tag: 'late payment' },
          { re: /\bpenalty/, w: 5, tag: 'penalty' },
        ]},
        { value: 'tiered', patterns: [
          { re: /\btier(ed|s)?\b/, w: 9, tag: 'tier' },
          { re: /\bvolume\s+(band|break)/, w: 7, tag: 'volume break' },
        ]},
        { value: 'per_unit', patterns: [
          { re: /\bper\s+unit\b|\bper-unit\b|\$\/unit/, w: 9, tag: 'per unit' },
        ]},
        { value: 'fixed_fee', patterns: [
          { re: /\bflat\s+fee|\bfixed\s+fee|\blump\s+sum/, w: 9, tag: 'fixed fee' },
        ]},
        { value: 'annual_fee', patterns: [
          { re: /\bannual\s+fee|\byearly\s+fee/, w: 9, tag: 'annual fee' },
        ]},
        { value: 'rebate_rate', patterns: [
          { re: /\brebate/, w: 9, tag: 'rebate' },
        ]},
        { value: 'discount', patterns: [
          { re: /\bdiscount/, w: 8, tag: 'discount' },
        ]},
        { value: 'chargeback', patterns: [
          { re: /\bchargeback/, w: 10, tag: 'chargeback' },
        ]},
        { value: 'returns_offset', patterns: [
          { re: /\breturns?\s+(offset|deduction|adjustment)/, w: 9, tag: 'returns offset' },
        ]},
        { value: 'percentage', patterns: [
          { re: /\b(royalty|royalties)\b/, w: 6, tag: 'royalty' },
          { re: /\bcommission/, w: 6, tag: 'commission' },
          { re: /\bpercentage|\bpercent\b|%\s*of\b/, w: 5, tag: 'percentage' },
        ]},
      ];
      const ruleHits: RuleHit[] = [];
      for (const r of ruleRules) {
        for (const p of r.patterns) {
          if (p.re.test(text)) ruleHits.push({ value: r.value, weight: p.w, matched: p.tag });
        }
      }
      ruleHits.sort((a, b) => b.weight - a.weight);
      const topRule = ruleHits[0] || null;

      // Base-metric scoring.
      const metricRules: Array<{ value: string; re: RegExp; w: number; tag: string }> = [
        { value: 'net_sales', re: /\bnet\s+sales\b/, w: 10, tag: 'net sales' },
        { value: 'gross_sales', re: /\bgross\s+sales\b/, w: 10, tag: 'gross sales' },
        { value: 'net_revenue', re: /\bnet\s+revenue\b/, w: 10, tag: 'net revenue' },
        { value: 'gross_revenue', re: /\bgross\s+revenue\b/, w: 10, tag: 'gross revenue' },
        { value: 'units', re: /\bunits?\s+(sold|shipped)?\b|\bquantity\b/, w: 8, tag: 'units' },
        { value: 'invoice_amount', re: /\binvoice(d)?\s+(amount|total)\b/, w: 9, tag: 'invoice amount' },
      ];
      let topMetric: { value: string; weight: number; tag: string } | null = null;
      for (const m of metricRules) {
        if (m.re.test(text)) {
          if (!topMetric || m.w > topMetric.weight) topMetric = { value: m.value, weight: m.w, tag: m.tag };
        }
      }
      // Rule-types that don't consume a sales-side metric default to not_applicable.
      const NON_METRIC_RULE_TYPES = new Set([
        'mdf_accrual', 'recoupable_advance', 'advance_payment', 'signing_bonus',
        'fixed_fee', 'annual_fee', 'milestone_payment', 'late_payment_penalty',
        'cap', 'period_cap', 'contract_cap', 'discount', 'chargeback',
      ]);
      let metricSuggestion: { value: string; tag: string } | null = topMetric
        ? { value: topMetric.value, tag: topMetric.tag }
        : (topRule && NON_METRIC_RULE_TYPES.has(topRule.value))
          ? { value: 'not_applicable', tag: 'not applicable for this rule type' }
          : null;

      // Confidence is a soft blend — top rule weight (max 10) + metric bonus.
      const ruleConf = topRule ? Math.min(1, topRule.weight / 10) : 0;
      const metricConf = topMetric ? Math.min(1, topMetric.weight / 10) : (metricSuggestion ? 0.5 : 0);
      const confidence = topRule
        ? Number((0.7 * ruleConf + 0.3 * metricConf).toFixed(2))
        : 0;

      const rationaleParts: string[] = [];
      if (topRule) rationaleParts.push(`matched "${topRule.matched}" → ${topRule.value}`);
      if (metricSuggestion && topMetric) rationaleParts.push(`matched "${metricSuggestion.tag}" → ${metricSuggestion.value}`);
      else if (metricSuggestion) rationaleParts.push(`metric defaulted to "${metricSuggestion.value}" (${metricSuggestion.tag})`);

      return res.json({
        suggestion: topRule ? {
          ruleType: topRule.value,
          baseMetric: metricSuggestion?.value || null,
          templateCode: null,
          confidence,
          rationale: rationaleParts.join('; ') || null,
        } : null,
      });
    } catch (err: any) {
      console.error('[rules/suggest] failed:', err);
      res.status(500).json({ message: 'Suggestion failed', error: err?.message || String(err) });
    }
  });

  // ==================================================================
  // Rule Field Whitelist Admin — manage the catalog of (object, attribute)
  // pairs that can appear in rule conditions. System rows (company_id NULL)
  // ship as defaults; tenants can override them with company-scoped rows.
  // ==================================================================
  const isAdminUser = (req: any) =>
    req.user?.isSystemAdmin === true ||
    ['admin', 'owner'].includes(req.user?.role);

  // GET — list system rows + the active company's rows
  app.get('/api/rule-field-whitelist', isAuthenticated, async (req: any, res: Response) => {
    try {
      const companyId = req.user?.activeContext?.companyId || null;
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      const r = await db.execute(sql`
        SELECT id, company_id, object_code, attribute_code, label,
               field_type, master_table, is_active, is_system, is_default,
               sequence, created_at, updated_at
        FROM rule_field_whitelist
        WHERE company_id IS NULL
           OR company_id = ${companyId}
        ORDER BY object_code, sequence, label
      `);
      const rows = ((r as any).rows ?? r) as any[];
      res.json({ rows, activeCompanyId: companyId });
    } catch (err: any) {
      console.error('[rule-field-whitelist GET] failed:', err);
      res.status(500).json({ message: 'Failed to load whitelist', error: err?.message || String(err) });
    }
  });

  // POST — create a new company-scoped whitelist entry
  app.post('/api/rule-field-whitelist', isAuthenticated, async (req: any, res: Response) => {
    try {
      if (!isAdminUser(req)) return res.status(403).json({ message: 'Admin only' });
      const companyId = req.user?.activeContext?.companyId;
      if (!companyId) return res.status(400).json({ message: 'No active company context' });
      const body = req.body || {};
      const objectCode = String(body.objectCode || body.object_code || '').trim();
      const attributeCode = String(body.attributeCode || body.attribute_code || '').trim();
      const label = String(body.label || '').trim();
      const fieldType = String(body.fieldType || body.field_type || 'text').trim();
      const masterTable = body.masterTable ?? body.master_table ?? null;
      const isActive = body.isActive !== false;
      const isDefault = body.isDefault === true;
      const sequence = Number.isFinite(Number(body.sequence)) ? Number(body.sequence) : 100;

      if (!objectCode || !attributeCode || !label) {
        return res.status(400).json({ message: 'objectCode, attributeCode, and label are required' });
      }
      const ident = /^[a-z][a-z0-9_]*$/;
      if (!ident.test(objectCode) || !ident.test(attributeCode)) {
        return res.status(400).json({ message: 'objectCode and attributeCode must be lowercase snake_case identifiers' });
      }
      if (masterTable && !ident.test(String(masterTable))) {
        return res.status(400).json({ message: 'masterTable must be a lowercase snake_case identifier' });
      }

      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      const r = await db.execute(sql`
        INSERT INTO rule_field_whitelist
          (company_id, object_code, attribute_code, label, field_type,
           master_table, is_active, is_system, is_default, sequence)
        VALUES
          (${companyId}, ${objectCode}, ${attributeCode}, ${label}, ${fieldType},
           ${masterTable}, ${isActive}, false, ${isDefault}, ${sequence})
        ON CONFLICT (company_id, object_code, attribute_code) DO UPDATE SET
          label = EXCLUDED.label,
          field_type = EXCLUDED.field_type,
          master_table = EXCLUDED.master_table,
          is_active = EXCLUDED.is_active,
          is_default = EXCLUDED.is_default,
          sequence = EXCLUDED.sequence,
          updated_at = NOW()
        RETURNING *
      `);
      const rows = ((r as any).rows ?? r) as any[];
      res.json({ row: rows[0] });
    } catch (err: any) {
      console.error('[rule-field-whitelist POST] failed:', err);
      res.status(500).json({ message: 'Failed to create whitelist entry', error: err?.message || String(err) });
    }
  });

  // PATCH — update an existing entry. Only company-scoped rows owned by the
  // active company are editable; system rows (company_id NULL) are read-only
  // and must be overridden first.
  app.patch('/api/rule-field-whitelist/:id', isAuthenticated, async (req: any, res: Response) => {
    try {
      if (!isAdminUser(req)) return res.status(403).json({ message: 'Admin only' });
      const companyId = req.user?.activeContext?.companyId;
      if (!companyId) return res.status(400).json({ message: 'No active company context' });
      const id = String(req.params.id);
      const body = req.body || {};

      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      const exist = await db.execute(sql`
        SELECT id, company_id FROM rule_field_whitelist WHERE id = ${id} LIMIT 1
      `);
      const existRow = (((exist as any).rows ?? exist) as any[])[0];
      if (!existRow) return res.status(404).json({ message: 'Not found' });
      if (!existRow.company_id) {
        return res.status(400).json({ message: 'System rows are read-only. Use the override action to create an editable copy.' });
      }
      if (existRow.company_id !== companyId) {
        return res.status(403).json({ message: 'Cannot edit another company\'s row' });
      }

      const ident = /^[a-z][a-z0-9_]*$/;
      const updates: string[] = [];
      const params: any[] = [];
      const add = (sqlFrag: any, value: any) => { params.push(value); };

      // Build a SET clause incrementally using safe templated SQL
      let setSql = sql`updated_at = NOW()`;
      if (typeof body.label === 'string' && body.label.trim()) {
        setSql = sql`${setSql}, label = ${body.label.trim()}`;
      }
      if (typeof body.fieldType === 'string' && body.fieldType.trim()) {
        setSql = sql`${setSql}, field_type = ${body.fieldType.trim()}`;
      }
      if ('masterTable' in body) {
        const mt = body.masterTable;
        if (mt && !ident.test(String(mt))) return res.status(400).json({ message: 'invalid masterTable' });
        setSql = sql`${setSql}, master_table = ${mt || null}`;
      }
      if (typeof body.isActive === 'boolean') {
        setSql = sql`${setSql}, is_active = ${body.isActive}`;
      }
      if (typeof body.isDefault === 'boolean') {
        setSql = sql`${setSql}, is_default = ${body.isDefault}`;
      }
      if (Number.isFinite(Number(body.sequence))) {
        setSql = sql`${setSql}, sequence = ${Number(body.sequence)}`;
      }
      if (typeof body.attributeCode === 'string' && body.attributeCode.trim()) {
        const ac = body.attributeCode.trim();
        if (!ident.test(ac)) return res.status(400).json({ message: 'invalid attributeCode' });
        setSql = sql`${setSql}, attribute_code = ${ac}`;
      }

      const r = await db.execute(sql`
        UPDATE rule_field_whitelist
        SET ${setSql}
        WHERE id = ${id}
        RETURNING *
      `);
      const rows = ((r as any).rows ?? r) as any[];
      res.json({ row: rows[0] });
    } catch (err: any) {
      console.error('[rule-field-whitelist PATCH] failed:', err);
      res.status(500).json({ message: 'Failed to update whitelist entry', error: err?.message || String(err) });
    }
  });

  // DELETE — remove a company-scoped entry. System rows cannot be deleted.
  app.delete('/api/rule-field-whitelist/:id', isAuthenticated, async (req: any, res: Response) => {
    try {
      if (!isAdminUser(req)) return res.status(403).json({ message: 'Admin only' });
      const companyId = req.user?.activeContext?.companyId;
      if (!companyId) return res.status(400).json({ message: 'No active company context' });
      const id = String(req.params.id);

      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      const exist = await db.execute(sql`
        SELECT id, company_id FROM rule_field_whitelist WHERE id = ${id} LIMIT 1
      `);
      const existRow = (((exist as any).rows ?? exist) as any[])[0];
      if (!existRow) return res.status(404).json({ message: 'Not found' });
      if (!existRow.company_id) {
        return res.status(400).json({ message: 'System rows cannot be deleted. Deactivate via override instead.' });
      }
      if (existRow.company_id !== companyId) {
        return res.status(403).json({ message: 'Cannot delete another company\'s row' });
      }

      await db.execute(sql`DELETE FROM rule_field_whitelist WHERE id = ${id}`);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[rule-field-whitelist DELETE] failed:', err);
      res.status(500).json({ message: 'Failed to delete whitelist entry', error: err?.message || String(err) });
    }
  });

  // POST /:id/override — clone a system row (company_id NULL) into a
  // company-scoped editable copy. The new row inherits all fields from the
  // source. If a company-scoped copy already exists for the same
  // (object, attribute) pair it is returned unchanged.
  app.post('/api/rule-field-whitelist/:id/override', isAuthenticated, async (req: any, res: Response) => {
    try {
      if (!isAdminUser(req)) return res.status(403).json({ message: 'Admin only' });
      const companyId = req.user?.activeContext?.companyId;
      if (!companyId) return res.status(400).json({ message: 'No active company context' });
      const id = String(req.params.id);

      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      const src = await db.execute(sql`
        SELECT * FROM rule_field_whitelist WHERE id = ${id} LIMIT 1
      `);
      const srcRow = (((src as any).rows ?? src) as any[])[0];
      if (!srcRow) return res.status(404).json({ message: 'Not found' });
      if (srcRow.company_id) {
        return res.status(400).json({ message: 'Row is already company-scoped' });
      }

      const r = await db.execute(sql`
        INSERT INTO rule_field_whitelist
          (company_id, object_code, attribute_code, label, field_type,
           master_table, is_active, is_system, is_default, sequence)
        VALUES
          (${companyId}, ${srcRow.object_code}, ${srcRow.attribute_code},
           ${srcRow.label}, ${srcRow.field_type}, ${srcRow.master_table},
           ${srcRow.is_active}, false, ${srcRow.is_default}, ${srcRow.sequence})
        ON CONFLICT (company_id, object_code, attribute_code) DO UPDATE SET
          updated_at = NOW()
        RETURNING *
      `);
      const rows = ((r as any).rows ?? r) as any[];
      res.json({ row: rows[0] });
    } catch (err: any) {
      console.error('[rule-field-whitelist override] failed:', err);
      res.status(500).json({ message: 'Failed to override whitelist entry', error: err?.message || String(err) });
    }
  });
}