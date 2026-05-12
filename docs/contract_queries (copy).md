# Contract Queries Reference

**Latest Contract ID:** `TMPL-SOFTWARE-FEE-MMTLRY1F` (GlobalTech Software Fee Agreement 2026)

> Replace the contract ID in any query below with the one you want to inspect.

---

## CONTRACT STORAGE TABLES

### 1. CONTRACTS (main record)
```sql
SELECT * FROM contracts 
WHERE id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 2. CONTRACT_ANALYSIS (AI summary, risks, key terms)
```sql
SELECT * FROM contract_analysis 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 3. CONTRACT_RULES (extracted pricing/fee rules)
```sql
SELECT * FROM contract_rules 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 4. CONTRACT_TERMS (structured pricing terms)
```sql
SELECT * FROM contract_terms 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 5. CONTRACT_QUALIFIERS (conditions on terms)
```sql
SELECT * FROM contract_qualifiers 
WHERE term_id IN (
  SELECT term_id FROM contract_terms 
  WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
);
```

### 6. CONTRACT_PARTNER_ASSIGNMENTS (assigned partners)
```sql
SELECT * FROM contract_partner_assignments 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 7. CONTRACT_CLAUSES (pipeline-extracted clauses)
```sql
SELECT * FROM contract_clauses 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 8. CONTRACT_EMBEDDINGS (vector embeddings for liQ AI)
```sql
SELECT contract_id, chunk_index, section_title, char_length(content) AS content_length 
FROM contract_embeddings 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 9. CONTRACT_CALCULATIONS (payment results)
```sql
SELECT * FROM contract_calculations 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 10. CONTRACT_VERSIONS (version history)
```sql
SELECT * FROM contract_versions 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 11. EXTRACTION_RUNS (pipeline run history)
```sql
SELECT * FROM extraction_runs 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 12. EXTRACTION_STAGE_RESULTS (per-stage results)
```sql
SELECT esr.* FROM extraction_stage_results esr
JOIN extraction_runs er ON er.id = esr.extraction_run_id
WHERE er.contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 13. RULE_CONFLICTS (detected conflicts)
```sql
SELECT * FROM rule_conflicts 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

---

## MASTER / REFERENCE TABLE LOOKUPS

### 14. COMPANY (who owns the contract)
```sql
SELECT * FROM companies 
WHERE company_id = (
  SELECT company_id FROM contracts 
  WHERE id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
);
```

### 15. BUSINESS UNIT
```sql
SELECT * FROM business_units 
WHERE bu_id = (
  SELECT business_unit_id FROM contracts 
  WHERE id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
);
```

### 16. LOCATION
```sql
SELECT * FROM locations 
WHERE location_id = (
  SELECT location_id FROM contracts 
  WHERE id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
);
```

### 17. CONTRACT TYPE DEFINITION
```sql
SELECT * FROM contract_type_definitions 
WHERE type_code = (
  SELECT contract_type FROM contracts 
  WHERE id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
);
```

### 18. FLOW TYPES (pipeline config)
```sql
SELECT * FROM flow_types;
```

### 19. SUBFLOWS
```sql
SELECT * FROM subflows;
```

### 20. RULE TEMPLATES (matched to this contract's rules)
```sql
SELECT * FROM rule_templates 
WHERE template_code IN (
  SELECT DISTINCT template_code FROM contract_rules 
  WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F' 
  AND template_code IS NOT NULL
);
```

### 21. CLAUSE CATEGORIES
```sql
SELECT * FROM clause_categories;
```

### 22. CLAUSE EXECUTION GROUPS
```sql
SELECT * FROM clause_execution_groups;
```

### 23. BASE METRICS
```sql
SELECT * FROM base_metrics;
```

---

## TRANSACTION TABLE LOOKUPS

### 24. SALES DATA (transactions matched to this contract)
```sql
SELECT * FROM sales_data 
WHERE matched_contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

---

## COMBINED QUERY — Contract with All Master, Transaction & Reference Data

```sql
SELECT 
  -- ============ CONTRACTS TABLE ============
  c.id AS contract_uuid,
  c.contract_number,
  c.display_name,
  c.original_name,
  c.status AS processing_status,
  c.contract_type,
  c.effective_start,
  c.effective_end,
  c.counterparty_name,
  c.company_id,
  c.business_unit_id,
  c.location_id,
  c.uploaded_by,
  c.contract_owner_id,
  c.created_at,
  c.updated_at,

  -- ============ CONTRACT METADATA (consolidated from former contract_master) ============
  c.contract_category,
  c.contract_status,
  c.owning_party,
  c.counterparty_type,
  c.territory_scope,
  c.channel_scope,
  c.contract_value_estimated_annual,
  c.currency,
  c.payment_frequency,
  c.auto_renew,
  c.renewal_term_months,
  c.linked_contract_id,

  -- ============ COMPANY MASTER ============
  comp.company_name,
  comp.contact_person,
  comp.contact_email,
  comp.country AS headquarters_country,
  comp.status AS company_status,

  -- ============ BUSINESS UNIT ============
  bu.bu_name,
  bu.bu_type,
  bu.region,

  -- ============ LOCATION ============
  loc.location_name,
  loc.country AS location_country,
  loc.city AS location_city,

  -- ============ CONTRACT TYPE DEFINITION ============
  ctd.type_code,
  ctd.type_name AS contract_type_name,
  ctd.description AS contract_type_description,

  -- ============ PIPELINE RUN (latest) ============
  er.id AS run_id,
  er.status AS pipeline_status,
  er.stage_a_status,
  er.stage_b_status,
  er.stage_c_status,
  er.overall_confidence,
  er.processing_time,
  er.created_at AS pipeline_started,
  er.completed_at AS pipeline_completed,

  -- ============ STAGE TIMING ============
  esa.status AS stage_a_result,
  esa.started_at AS stage_a_start,
  esa.completed_at AS stage_a_end,
  esb.status AS stage_b_result,
  esb.started_at AS stage_b_start,
  esb.completed_at AS stage_b_end,
  esc.status AS stage_c_result,
  esc.started_at AS stage_c_start,
  esc.completed_at AS stage_c_end,

  -- ============ ANALYSIS ============
  ca.summary,
  ca.confidence AS analysis_confidence,
  ca.key_terms,
  ca.risk_analysis,
  ca.insights,
  ca.header_review_flags,

  -- ============ COUNTS ============
  (SELECT COUNT(*) FROM contract_clauses cc WHERE cc.contract_id = c.id) AS clauses_extracted,
  (SELECT COUNT(*) FROM contract_rules rr WHERE rr.contract_id = c.id) AS total_rules,
  (SELECT COUNT(*) FROM contract_rules rr WHERE rr.contract_id = c.id AND rr.template_code IS NOT NULL) AS pipeline_rules_mapped,
  (SELECT COUNT(*) FROM rule_conflicts rc WHERE rc.contract_id = c.id) AS conflicts_found,
  (SELECT COUNT(*) FROM contract_terms ct WHERE ct.contract_id = c.id) AS terms_count,
  (SELECT COUNT(*) FROM contract_qualifiers cq 
     JOIN contract_terms ct2 ON ct2.term_id = cq.term_id 
     WHERE ct2.contract_id = c.id) AS qualifiers_count,
  (SELECT COUNT(*) FROM contract_partner_assignments cpa WHERE cpa.contract_id = c.id) AS partners_assigned,
  (SELECT COUNT(*) FROM contract_embeddings ce WHERE ce.contract_id = c.id) AS embedding_chunks,
  (SELECT COUNT(*) FROM contract_calculations calc WHERE calc.contract_id = c.id) AS calculations_count,
  (SELECT COUNT(*) FROM contract_versions cv WHERE cv.contract_id = c.id) AS versions_count,
  (SELECT COUNT(*) FROM sales_data sd WHERE sd.matched_contract_id = c.id) AS sales_transactions

FROM contracts c

-- Master table joins
LEFT JOIN companies comp ON comp.company_id = c.company_id
LEFT JOIN business_units bu ON bu.bu_id = c.business_unit_id
LEFT JOIN locations loc ON loc.location_id = c.location_id
LEFT JOIN contract_type_definitions ctd ON ctd.type_code = c.contract_type

-- Latest pipeline run
LEFT JOIN extraction_runs er ON er.contract_id = c.id
  AND er.id = (SELECT MAX(er2.id) FROM extraction_runs er2 WHERE er2.contract_id = c.id)

-- Stage results (joined to latest run)
LEFT JOIN extraction_stage_results esa ON esa.extraction_run_id = er.id AND esa.stage = 'A'
LEFT JOIN extraction_stage_results esb ON esb.extraction_run_id = er.id AND esb.stage = 'B'
LEFT JOIN extraction_stage_results esc ON esc.extraction_run_id = er.id AND esc.stage = 'C'

-- Analysis
LEFT JOIN contract_analysis ca ON ca.contract_id = c.id

WHERE c.id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

---
---

# Contract Rules Queries Reference

**Using rules from latest contract:** `TMPL-SOFTWARE-FEE-MMTLRY1F`

> Replace the contract ID in any query below with the one you want to inspect.

---

## CONTRACT_RULES TABLE

### 1. ALL RULES FOR A CONTRACT
```sql
SELECT * FROM contract_rules 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 2. RULES SUMMARY (key fields only)
```sql
SELECT 
  id AS rule_id,
  rule_name,
  rule_type,
  base_rate,
  minimum_guarantee,
  minimum_price,
  priority,
  is_active,
  confidence,
  validation_status,
  review_status,
  template_code,
  execution_group,
  base_metric,
  clause_category,
  channel,
  customer_segments,
  territories,
  product_categories,
  partner_ids,
  effective_date,
  expiry_date
FROM contract_rules 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
ORDER BY priority;
```

### 3. RULE FORMULA & CALCULATION DETAILS
```sql
SELECT 
  id AS rule_id,
  rule_name,
  rule_type,
  base_rate,
  minimum_guarantee,
  calculation_formula,
  formula_definition,
  formula_version,
  volume_tiers,
  seasonal_adjustments,
  territory_premiums,
  exceptions,
  specificity_score
FROM contract_rules 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 4. RULE EXTRACTION & SOURCE DETAILS
```sql
SELECT 
  id AS rule_id,
  rule_name,
  source_section,
  source_page,
  source_text,
  confidence,
  validated_confidence,
  validation_status,
  validation_details,
  field_confidence,
  field_mappings,
  extraction_order,
  review_status,
  reviewed_by,
  reviewed_at,
  review_flags
FROM contract_rules 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 5. RULE VERSION HISTORY
```sql
SELECT 
  id AS rule_id,
  rule_name,
  rule_version_num,
  previous_version_data,
  created_at,
  updated_at
FROM contract_rules 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
ORDER BY rule_version_num;
```

---

## MASTER / REFERENCE TABLES FOR RULES

### 6. RULE TEMPLATES (pipeline templates matched to rules)
```sql
SELECT * FROM rule_templates 
WHERE template_code IN (
  SELECT DISTINCT template_code FROM contract_rules 
  WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F' 
  AND template_code IS NOT NULL
);
```

### 7. ALL RULE TEMPLATES
```sql
SELECT * FROM rule_templates ORDER BY template_code;
```

### 8. CLAUSE EXECUTION GROUPS
```sql
SELECT * FROM clause_execution_groups;
```

### 9. BASE METRICS
```sql
SELECT * FROM base_metrics;
```

### 10. CLAUSE CATEGORIES
```sql
SELECT * FROM clause_categories;
```

### 11. FLOW TYPES (pipeline flow definitions)
```sql
SELECT * FROM flow_types;
```

### 12. SUBFLOWS (sub-steps within each flow type)
```sql
SELECT * FROM subflows ORDER BY flow_type_id;
```

### 13. TERRITORIES referenced by rules
```sql
SELECT * FROM territory_master 
WHERE territory_name IN (
  SELECT UNNEST(territories) FROM contract_rules 
  WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
);
```

### 14. SALES CHANNELS referenced by rules
```sql
SELECT * FROM sales_channels 
WHERE channel_name IN (
  SELECT DISTINCT channel FROM contract_rules 
  WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F' 
  AND channel IS NOT NULL
);
```

### 15. CUSTOMER SEGMENTS referenced by rules
```sql
SELECT * FROM customer_segments 
WHERE segment_name IN (
  SELECT UNNEST(customer_segments) FROM contract_rules 
  WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
);
```

### 16. PRODUCTS referenced by rules
```sql
SELECT * FROM products 
WHERE product_name IN (
  SELECT UNNEST(product_categories) FROM contract_rules 
  WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
);
```

### 17. PARTNERS referenced by rules
```sql
SELECT * FROM partner_master 
WHERE partner_id IN (
  SELECT UNNEST(partner_ids) FROM contract_rules 
  WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F' 
  AND partner_ids IS NOT NULL
);
```

### 18. CALCULATION BLUEPRINTS (formula definitions)
```sql
SELECT * FROM calculation_blueprints;
```

---

## TRANSACTION TABLES FOR RULES

### 19. RULE CONFLICTS (detected between rules)
```sql
SELECT * FROM rule_conflicts 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 20. RULE DECISION LOGS (execution audit trail)
```sql
SELECT * FROM rule_decision_logs 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 21. CONTRACT CALCULATIONS (payment results using rules)
```sql
SELECT * FROM contract_calculations 
WHERE contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

### 22. SALES DATA matched to this contract (input for rule evaluation)
```sql
SELECT * FROM sales_data 
WHERE matched_contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F';
```

---

## COMBINED QUERY — Rules with All Master, Transaction & Reference Data

```sql
SELECT 
  -- ============ RULE CORE ============
  r.id AS rule_id,
  r.contract_id,
  r.rule_name,
  r.rule_type,
  r.description AS rule_description,
  r.base_rate,
  r.minimum_guarantee,
  r.minimum_price,
  r.calculation_formula,
  r.priority,
  r.is_active,
  r.effective_date,
  r.expiry_date,
  r.specificity_score,

  -- ============ RULE EXTRACTION SOURCE ============
  r.source_section,
  r.source_page,
  r.source_text,
  r.confidence,
  r.validated_confidence,
  r.validation_status,
  r.extraction_order,
  r.review_status,

  -- ============ RULE CLASSIFICATION ============
  r.clause_category,
  r.channel,
  r.customer_segments,
  r.territories,
  r.product_categories,
  r.partner_ids,
  r.container_sizes,

  -- ============ RULE FORMULA ============
  r.formula_definition,
  r.formula_version,
  r.volume_tiers,
  r.seasonal_adjustments,
  r.territory_premiums,
  r.exceptions,

  -- ============ PIPELINE MAPPING ============
  r.template_code,
  r.execution_group,
  r.base_metric,
  rt.template_code AS template_ref,
  rt.flow_type_id AS template_flow_type,

  -- ============ PARENT CONTRACT ============
  c.display_name AS contract_name,
  c.contract_number,
  c.contract_type,
  c.contract_category,
  c.contract_status,
  c.effective_start AS contract_start,
  c.effective_end AS contract_end,
  c.counterparty_name,

  -- ============ COMPANY ============
  comp.company_name,
  comp.country AS company_country,

  -- ============ TRANSACTION COUNTS ============
  (SELECT COUNT(*) FROM rule_decision_logs rdl WHERE rdl.rule_id = r.id) AS decision_log_count,
  (SELECT COUNT(*) FROM rule_conflicts rc 
     WHERE rc.contract_id = r.contract_id 
     AND r.id = ANY(string_to_array(rc.rule_ids, ','))) AS conflicts_involving_rule,
  (SELECT COUNT(*) FROM sales_data sd WHERE sd.matched_contract_id = r.contract_id) AS matched_sales_count,
  (SELECT COUNT(*) FROM contract_calculations calc WHERE calc.contract_id = r.contract_id) AS calculations_count

FROM contract_rules r

-- Parent contract
JOIN contracts c ON c.id = r.contract_id

-- Company
LEFT JOIN companies comp ON comp.company_id = c.company_id

-- Pipeline template
LEFT JOIN rule_templates rt ON rt.template_code = r.template_code

WHERE r.contract_id = 'TMPL-SOFTWARE-FEE-MMTLRY1F'
ORDER BY r.priority, r.extraction_order;
```
