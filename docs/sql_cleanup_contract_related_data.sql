-- ============================================================================
-- LicenseIQ: DELETE ALL CONTRACT-RELATED DATA (Keep contracts table intact)
-- ============================================================================
-- This script deletes ALL data from every table that depends on or relates to
-- contracts, while preserving the contracts table itself.
--
-- Deletion order respects foreign key dependencies:
--   Child tables (deepest) are deleted FIRST, parent tables LAST.
--
-- Generated: 2026-04-03
-- ============================================================================

BEGIN;  -- Wrap everything in a transaction for safety

-- ============================================================================
-- LAYER 1: Deepest children (no other table depends on these)
-- ============================================================================

-- Calculation results (children of contract_calculations)
DELETE FROM calculation_rule_results;        -- 69 rows  → per-rule frozen snapshots
DELETE FROM calculation_line_items;          -- 1,574 rows → individual line items
DELETE FROM calculation_dimension_config;    -- 35 rows  → dimension configurations

-- Blueprint children
DELETE FROM blueprint_dimensions;           -- children of calculation_blueprints

-- Rule children
DELETE FROM rule_validation_events;         -- 0 rows   → rule verification audit events
DELETE FROM rule_decision_logs;             -- 0 rows   → per-transaction rule decision logs

-- Extraction children
DELETE FROM extraction_stage_results;       -- 27 rows  → stage-level extraction outputs

-- Journal entry children
DELETE FROM journal_entry_lines;            -- 102 rows → debit/credit line items
DELETE FROM je_erp_sync_log;               -- 0 rows   → ERP sync tracking
DELETE FROM je_reconciliation;             -- 0 rows   → reconciliation records

-- Accrual children
DELETE FROM accrual_audit_trail;            -- 51 rows  → accrual change history
DELETE FROM accrual_calculation_trace;      -- 51 rows  → step-by-step calc audit

-- Period close children
DELETE FROM period_close_audit_trail;       -- 0 rows   → period close change log
DELETE FROM period_close_blockers;          -- 0 rows   → items blocking period close
DELETE FROM period_close_checklist;         -- 0 rows   → checklist items per period
DELETE FROM period_variance;               -- 0 rows   → variance analysis records

-- Contract version children
DELETE FROM contract_approvals;             -- 0 rows   → approval/rejection decisions

-- Accuracy testing children
DELETE FROM accuracy_test_results;          -- 0 rows   → individual test results

-- ============================================================================
-- LAYER 2: Mid-level tables (depended on by Layer 1, depend on contracts)
-- ============================================================================

-- Calculation runs (parent of calculation_rule_results, calculation_line_items)
DELETE FROM contract_calculations;          -- 45 rows  → calculation run headers
DELETE FROM calculation_blueprints;         -- 0 rows   → complex calculation configs

-- Financial tables
DELETE FROM journal_entries;                -- 51 rows  → accounting journal entries
DELETE FROM accruals;                       -- 51 rows  → financial accrual records
DELETE FROM period_close;                   -- 0 rows   → fiscal period management

-- Rule tables
DELETE FROM rule_conflicts;                 -- 8 rows   → conflicting rule pairs
DELETE FROM rule_definitions;               -- 0 rows   → extracted rule logic definitions

-- Contract qualifiers and terms (depend on contract_rules / contracts)
DELETE FROM contract_qualifiers;            -- 15 rows  → inclusion/exclusion product filters
DELETE FROM contract_rules;                 -- 40 rows  → calculation rules per contract

-- Contract clauses and categories
DELETE FROM clause_execution_groups;        -- 3 rows   → clause execution groupings
DELETE FROM clause_categories;              -- 6 rows   → clause category definitions
DELETE FROM contract_clauses;               -- 90 rows  → extracted clause text blocks
DELETE FROM contract_terms;                 -- 23 rows  → extracted legal/financial terms

-- Contract analysis and insights
DELETE FROM contract_analysis;              -- 9 rows   → AI-generated summaries and risk
DELETE FROM contract_embeddings;            -- 27 rows  → vector embeddings for RAG
DELETE FROM semantic_index_entries;         -- 18 rows  → semantic search index
DELETE FROM financial_analysis;             -- 0 rows   → financial metadata
DELETE FROM compliance_analysis;            -- 0 rows   → compliance assessments
DELETE FROM strategic_analysis;             -- 0 rows   → strategic value analysis
DELETE FROM performance_metrics;            -- 0 rows   → contract KPIs

-- Contract versions and documents
DELETE FROM contract_versions;              -- 7 rows   → version snapshots
DELETE FROM contract_documents;             -- 0 rows   → associated document files

-- Contract graph
DELETE FROM contract_graph_edges;           -- 0 rows   → relationship edges
DELETE FROM contract_graph_nodes;           -- 0 rows   → entity nodes

-- Contract associations
DELETE FROM contract_obligations;           -- 0 rows   → performance/payment obligations
DELETE FROM contract_comparisons;           -- 0 rows   → similarity comparisons
DELETE FROM contract_close_status;          -- 0 rows   → contract close tracking
DELETE FROM contract_partner_assignments;   -- 18 rows  → partner-contract links

-- Extraction tracking
DELETE FROM human_review_tasks;             -- 0 rows   → manual review queue
DELETE FROM extraction_runs;                -- 9 rows   → AI extraction run history

-- ============================================================================
-- LAYER 3: Data tables linked to contracts
-- ============================================================================

-- Sales data (has matched_contract_id FK to contracts)
DELETE FROM sales_data;                     -- 1,309 rows → all uploaded sales transactions
DELETE FROM sales_field_mappings;           -- 0 rows     → sales column mapping configs
DELETE FROM uploaded_datasets;              -- dataset upload history records

-- Other contract-linked data
DELETE FROM rebate_programs;                -- 0 rows   → rebate scheme definitions
DELETE FROM master_data_mappings;           -- 0 rows   → ERP master data links
DELETE FROM pending_term_mappings;          -- 490 rows → pending ERP term mappings

-- Audit trail (has user FK but tracks contract actions)
DELETE FROM audit_trail;                    -- 85 rows  → system-wide audit log

-- Testing data
DELETE FROM accuracy_test_runs;             -- 0 rows   → test run headers
DELETE FROM accuracy_test_cases;            -- 21 rows  → test case definitions

-- Rule templates (not FK'd to contracts but contract-type specific)
DELETE FROM rule_templates;                 -- 12 rows  → rule slot templates per type

-- ============================================================================
-- CONTRACTS TABLE: NOT DELETED (preserved as requested)
-- ============================================================================
-- DELETE FROM contracts;                   -- 9 rows   → SKIPPED (keeping contracts)

COMMIT;

-- ============================================================================
-- VERIFICATION: Run after the script to confirm cleanup
-- ============================================================================
-- SELECT 'contracts' AS table_name, COUNT(*) AS remaining_rows FROM contracts
-- UNION ALL SELECT 'contract_rules', COUNT(*) FROM contract_rules
-- UNION ALL SELECT 'contract_qualifiers', COUNT(*) FROM contract_qualifiers
-- UNION ALL SELECT 'contract_clauses', COUNT(*) FROM contract_clauses
-- UNION ALL SELECT 'contract_calculations', COUNT(*) FROM contract_calculations
-- UNION ALL SELECT 'calculation_rule_results', COUNT(*) FROM calculation_rule_results
-- UNION ALL SELECT 'sales_data', COUNT(*) FROM sales_data
-- UNION ALL SELECT 'accruals', COUNT(*) FROM accruals
-- UNION ALL SELECT 'journal_entries', COUNT(*) FROM journal_entries
-- UNION ALL SELECT 'audit_trail', COUNT(*) FROM audit_trail
-- ORDER BY table_name;
