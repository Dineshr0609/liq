-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "calculation_dimension_config" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"contract_id" varchar NOT NULL,
	"dimension_key" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"erp_field_id" varchar,
	"erp_field_name" varchar,
	"dimension_type" varchar NOT NULL,
	"is_groupable" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calculation_field_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_type_code" varchar NOT NULL,
	"field_code" varchar NOT NULL,
	"field_name" varchar NOT NULL,
	"field_category" varchar NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0,
	"default_column_patterns" text[],
	"data_type" varchar DEFAULT 'number' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calculation_line_items" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"calculation_id" varchar NOT NULL,
	"contract_id" varchar NOT NULL,
	"sales_data_id" varchar,
	"blueprint_id" varchar,
	"rule_id" varchar,
	"transaction_date" timestamp,
	"transaction_id" varchar,
	"sales_amount" numeric(15, 2),
	"quantity" numeric(12, 4),
	"unit_price" numeric(15, 2),
	"calculated_fee" numeric(15, 2) NOT NULL,
	"applied_rate" numeric(10, 4),
	"rule_name" varchar,
	"rule_type" varchar,
	"tier_applied" varchar,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"vendor_name" varchar,
	"vendor_code" varchar,
	"item_name" varchar,
	"item_code" varchar,
	"item_class" varchar,
	"territory" varchar,
	"period" varchar,
	"company_id" varchar,
	"business_unit_id" varchar,
	"location_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_master" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"company_id" varchar(50) NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"legal_entity_name" varchar(255),
	"industry" varchar(100),
	"headquarters_city" varchar(100),
	"headquarters_state" varchar(50),
	"headquarters_country" varchar(100),
	"annual_revenue_millions" numeric,
	"employee_count" integer,
	"erp_system" varchar(100),
	"erp_version" varchar(50),
	"fiscal_year_end" date,
	"primary_currency" varchar(10),
	"tax_id" varchar(50),
	"website" varchar(255),
	"status" varchar(50) DEFAULT 'Active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "company_master_company_id_key" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "contract_type_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"icon" varchar,
	"color" varchar,
	"is_system_type" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"extraction_prompt" text,
	"rule_extraction_prompt" text,
	"erp_mapping_prompt" text,
	"sample_extraction_output" text,
	"updated_at" timestamp DEFAULT now(),
	"rag_extraction_prompt" text,
	"rag_rule_extraction_prompt" text,
	"rag_sample_extraction_output" text,
	CONSTRAINT "contract_type_definitions_code_key" UNIQUE("code"),
	CONSTRAINT "contract_type_definitions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "data_import_sources" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"source_type" varchar DEFAULT 'file' NOT NULL,
	"connection_id" varchar,
	"endpoint_template_id" varchar,
	"mapping_id" varchar,
	"erp_system_id" varchar,
	"entity_type" varchar,
	"licenseiq_entity_id" varchar,
	"company_id" varchar,
	"business_unit_id" varchar,
	"location_id" varchar,
	"filters" jsonb,
	"schedule_enabled" boolean DEFAULT false NOT NULL,
	"schedule_type" varchar,
	"schedule_cron" varchar,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"import_options" jsonb,
	"status" varchar DEFAULT 'active' NOT NULL,
	"last_error" text,
	"success_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demo_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"plan_tier" varchar NOT NULL,
	"source" varchar DEFAULT 'pricing_section',
	"status" varchar DEFAULT 'new' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "early_access_signups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"name" varchar,
	"company" varchar,
	"source" varchar DEFAULT 'landing_page',
	"status" varchar DEFAULT 'new' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"item_number" varchar(50) NOT NULL,
	"description" varchar(500) NOT NULL,
	"license_fee_type" varchar(100),
	"full_legal_product_name" varchar(500),
	"language" varchar(50),
	"price_tier" varchar(50),
	"item_category" varchar(100),
	"license_fee_category" varchar(100),
	"additional_category" varchar(100),
	"license_brand" varchar(200),
	"license_property" varchar(200),
	"item_type" varchar(100),
	"item_class" varchar(100),
	"uom" varchar(20),
	"sell_uom" varchar(20),
	"buy_uom" varchar(20),
	"retail_uom" varchar(20),
	"component_item" boolean DEFAULT false,
	"mfg_item_number" varchar(100),
	"licensor_item_number" varchar(100),
	"vendor_item_number" varchar(100),
	"item_status" varchar(50) DEFAULT 'Active',
	"gtin" varchar(50),
	"vendor" varchar(200),
	"company_id" varchar,
	"business_unit_id" varchar,
	"location_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar,
	"updated_by" varchar,
	CONSTRAINT "items_item_number_key" UNIQUE("item_number")
);
--> statement-breakpoint
CREATE TABLE "market_benchmarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_type" varchar NOT NULL,
	"industry" varchar,
	"benchmark_data" jsonb,
	"average_value" numeric(15, 2),
	"standard_terms" jsonb,
	"risk_factors" jsonb,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_contract_associations" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"association_id" varchar(50) NOT NULL,
	"partner_id" varchar(50),
	"contract_id" varchar(100),
	"effective_date" date,
	"expiration_date" date,
	"contract_status" varchar(50),
	"is_primary_contract" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "partner_contract_associations_association_id_key" UNIQUE("association_id")
);
--> statement-breakpoint
CREATE TABLE "partner_master" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"partner_id" varchar(50) NOT NULL,
	"company_id" varchar(50),
	"business_unit" varchar(100),
	"partner_name" varchar(255) NOT NULL,
	"partner_type" varchar(100),
	"partner_classification" varchar(50),
	"legal_entity_name" varchar(255),
	"headquarters_city" varchar(100),
	"headquarters_state" varchar(50),
	"headquarters_country" varchar(100),
	"primary_contact_name" varchar(200),
	"primary_contact_email" varchar(200),
	"status" varchar(50) DEFAULT 'Active',
	"onboarding_date" date,
	"payment_terms" varchar(50),
	"payment_method" varchar(50),
	"currency" varchar(10),
	"tax_id" varchar(50),
	"credit_limit" numeric,
	"primary_sales_channel" varchar(50),
	"authorized_channels" text,
	"primary_territory" varchar(50),
	"authorized_territories" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "partner_master_partner_id_key" UNIQUE("partner_id")
);
--> statement-breakpoint
CREATE TABLE "product_attributes" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"attribute_id" varchar(50) NOT NULL,
	"product_id" varchar(50),
	"attribute_name" varchar(200) NOT NULL,
	"attribute_value" varchar(500),
	"attribute_category" varchar(100),
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "product_attributes_attribute_id_key" UNIQUE("attribute_id")
);
--> statement-breakpoint
CREATE TABLE "product_bom" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"bom_id" varchar(50) NOT NULL,
	"parent_product_id" varchar(50),
	"component_product_id" varchar(50),
	"component_quantity" numeric,
	"component_uom" varchar(50),
	"bom_type" varchar(100),
	"sequence_number" integer,
	"is_optional" boolean DEFAULT false,
	"substitute_product_id" varchar(50),
	"scrap_factor_percent" numeric,
	"effective_date" date,
	"expiration_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "product_bom_bom_id_key" UNIQUE("bom_id")
);
--> statement-breakpoint
CREATE TABLE "product_channel_matrix" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"channel_auth_id" varchar(50) NOT NULL,
	"product_id" varchar(50),
	"channel_id" varchar(50),
	"is_authorized" boolean DEFAULT false,
	"restriction_reason" text,
	"channel_specific_sku" varchar(100),
	"channel_specific_pricing" boolean DEFAULT false,
	"min_order_quantity" integer,
	"max_order_quantity" integer,
	"effective_date" date,
	"expiration_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "product_channel_matrix_channel_auth_id_key" UNIQUE("channel_auth_id")
);
--> statement-breakpoint
CREATE TABLE "product_classifications" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"classification_dimension" varchar(100) NOT NULL,
	"classification_value" varchar(200),
	"description" text,
	"use_case" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "product_classifications_dim_val_unique" UNIQUE("classification_dimension","classification_value")
);
--> statement-breakpoint
CREATE TABLE "product_hierarchy" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"hierarchy_id" varchar(50) NOT NULL,
	"company_id" varchar(50),
	"level_name" varchar(100),
	"level_order" integer,
	"parent_hierarchy_id" varchar(50),
	"hierarchy_value" varchar(200),
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "product_hierarchy_hierarchy_id_key" UNIQUE("hierarchy_id")
);
--> statement-breakpoint
CREATE TABLE "product_packaging_matrix" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"package_id" varchar(50) NOT NULL,
	"product_id" varchar(50),
	"package_type" varchar(50),
	"package_code" varchar(20),
	"units_per_package" integer,
	"is_base_unit" boolean DEFAULT false,
	"is_sellable" boolean DEFAULT true,
	"list_price_package" numeric,
	"standard_cost_package" numeric,
	"barcode_package" varchar(50),
	"weight_kg_package" numeric,
	"dimensions_cm" varchar(50),
	"effective_date" date,
	"expiration_date" date,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "product_packaging_matrix_package_id_key" UNIQUE("package_id")
);
--> statement-breakpoint
CREATE TABLE "product_territory_matrix" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"territory_auth_id" varchar(50) NOT NULL,
	"product_id" varchar(50),
	"territory_id" varchar(50),
	"is_authorized" boolean DEFAULT false,
	"restriction_reason" text,
	"requires_certification" boolean DEFAULT false,
	"certification_type" varchar(100),
	"certification_status" varchar(50),
	"effective_date" date,
	"expiration_date" date,
	"import_duty_pct" numeric,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "product_territory_matrix_territory_auth_id_key" UNIQUE("territory_auth_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"is_system_role" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "roles_role_name_key" UNIQUE("role_name")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"product_id" varchar(50) NOT NULL,
	"company_id" varchar(50),
	"sku" varchar(100),
	"product_name" varchar(300) NOT NULL,
	"product_category" varchar(100),
	"product_family" varchar(100),
	"product_line" varchar(100),
	"product_classification" varchar(100),
	"asset_type" varchar(50),
	"durability_class" varchar(100),
	"revenue_type" varchar(100),
	"tax_category" varchar(50),
	"regulatory_class" varchar(100),
	"list_price" numeric,
	"standard_cost" numeric,
	"base_unit_of_measure" varchar(50),
	"alternate_uom_sellable" varchar(100),
	"case_pack_quantity" integer,
	"inner_pack_quantity" integer,
	"product_status" varchar(50) DEFAULT 'Active',
	"eligible_for_rebates" boolean DEFAULT false,
	"eligible_for_royalties" boolean DEFAULT false,
	"has_bom" boolean DEFAULT false,
	"is_component_only" boolean DEFAULT false,
	"manufacturing_lead_time_days" integer,
	"launch_date" date,
	"barcode_upc" varchar(50),
	"weight_kg" numeric,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"product_category_id" varchar,
	"product_family_id" varchar,
	"product_line_id" varchar,
	CONSTRAINT "products_product_id_key" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "rule_node_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_type" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"schema" jsonb NOT NULL,
	"evaluation_adapter" text,
	"examples" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "rule_node_definitions_node_type_key" UNIQUE("node_type")
);
--> statement-breakpoint
CREATE TABLE "sales_channels" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"channel_id" varchar(50) NOT NULL,
	"channel_code" varchar(50),
	"channel_name" varchar(200) NOT NULL,
	"channel_type" varchar(50),
	"channel_category" varchar(50),
	"typical_margin_pct_low" numeric,
	"typical_margin_pct_high" numeric,
	"requires_certification" boolean DEFAULT false,
	"payment_terms_default" varchar(50),
	"min_order_value_usd" numeric,
	"max_credit_limit_usd" varchar(100),
	"volume_discount_eligible" boolean DEFAULT false,
	"coop_advertising_eligible" boolean DEFAULT false,
	"status" varchar(50) DEFAULT 'Active',
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "sales_channels_channel_id_key" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"title" varchar NOT NULL,
	"source_text" text NOT NULL,
	"embedding" vector(384),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_embeddings_document_id_key" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_model" varchar DEFAULT 'llama-3.3-70b-versatile' NOT NULL,
	"ai_temperature" real DEFAULT 0.1 NOT NULL,
	"ai_max_tokens" integer DEFAULT 8000 NOT NULL,
	"ai_retry_attempts" integer DEFAULT 3 NOT NULL,
	"auto_confirm_threshold" real DEFAULT 0.85 NOT NULL,
	"low_confidence_threshold" real DEFAULT 0.6 NOT NULL,
	"session_timeout_minutes" integer DEFAULT 60 NOT NULL,
	"max_login_attempts" integer DEFAULT 5 NOT NULL,
	"password_min_length" integer DEFAULT 8 NOT NULL,
	"require_2fa" boolean DEFAULT false NOT NULL,
	"max_file_size_mb" integer DEFAULT 50 NOT NULL,
	"allowed_file_types" jsonb DEFAULT '["pdf","docx","xlsx","csv"]'::jsonb NOT NULL,
	"file_retention_days" integer DEFAULT 365 NOT NULL,
	"enable_beta_features" boolean DEFAULT false NOT NULL,
	"enable_audit_logging" boolean DEFAULT true NOT NULL,
	"enable_email_notifications" boolean DEFAULT true NOT NULL,
	"api_rate_limit_per_minute" integer DEFAULT 100 NOT NULL,
	"extraction_prompts" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"default_evaluation_mode" varchar DEFAULT 'universal' NOT NULL,
	"default_extraction_mode" varchar DEFAULT 'rag' NOT NULL,
	"ai_provider" varchar DEFAULT 'anthropic' NOT NULL,
	"analysis_mode" varchar DEFAULT 'on_demand' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territory_master" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"territory_id" varchar(50) NOT NULL,
	"territory_code" varchar(50),
	"territory_name" varchar(200) NOT NULL,
	"territory_type" varchar(50),
	"parent_territory_id" varchar(50),
	"region_level" integer,
	"currency_code" varchar(10),
	"tax_jurisdiction" varchar(200),
	"regulatory_requirements" varchar(500),
	"language" varchar(100),
	"status" varchar(50) DEFAULT 'Active',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"record_status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "territory_master_territory_id_key" UNIQUE("territory_id")
);
--> statement-breakpoint
CREATE TABLE "accuracy_test_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"extraction_mode" varchar(50) NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_tests" integer,
	"passed_tests" integer,
	"failed_tests" integer,
	"overall_accuracy" real,
	"metrics" jsonb
);
--> statement-breakpoint
CREATE TABLE "accuracy_test_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"test_case_id" integer NOT NULL,
	"passed" boolean NOT NULL,
	"accuracy" real NOT NULL,
	"field_results" jsonb NOT NULL,
	"extracted_data" jsonb,
	"extraction_time_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accuracy_test_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"contract_type" varchar(100) NOT NULL,
	"description" text,
	"contract_text" text NOT NULL,
	"ground_truth" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"source" varchar DEFAULT 'synthetic' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"username" varchar,
	"password" varchar DEFAULT 'temp' NOT NULL,
	"is_system_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_key" UNIQUE("username"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "audit_trail" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"resource_type" varchar,
	"resource_id" varchar,
	"details" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calculation_blueprints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"royalty_rule_id" varchar NOT NULL,
	"erp_rule_set_id" varchar,
	"name" varchar NOT NULL,
	"description" text,
	"rule_type" varchar NOT NULL,
	"calculation_logic" jsonb NOT NULL,
	"erp_field_bindings" jsonb,
	"dual_terminology_map" jsonb,
	"matching_criteria" jsonb,
	"priority" integer DEFAULT 10 NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_fully_mapped" boolean DEFAULT false NOT NULL,
	"unmapped_fields" text[],
	"materialized_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blueprint_dimensions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" varchar NOT NULL,
	"dimension_type" varchar NOT NULL,
	"contract_term" varchar NOT NULL,
	"erp_field_name" varchar,
	"erp_field_id" varchar,
	"mapping_id" varchar,
	"match_value" varchar,
	"is_mapped" boolean DEFAULT false NOT NULL,
	"confidence" numeric(5, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"company_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(500) NOT NULL,
	"company_descr" text,
	"address1" varchar(500),
	"address2" varchar(500),
	"address3" varchar(500),
	"city" varchar(200),
	"state_province" varchar(200),
	"county" varchar(200),
	"country" varchar(200),
	"contact_person" varchar(300),
	"contact_email" varchar(300),
	"contact_phone" varchar(50),
	"contact_preference" varchar(50),
	"status" varchar(1) DEFAULT 'A' NOT NULL,
	"created_by" varchar NOT NULL,
	"creation_date" timestamp DEFAULT now() NOT NULL,
	"last_updated_by" varchar NOT NULL,
	"last_update_date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_units" (
	"org_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"org_name" varchar(500) NOT NULL,
	"org_descr" text,
	"address1" varchar(500),
	"contact_person" varchar(300),
	"contact_email" varchar(300),
	"contact_phone" varchar(50),
	"contact_preference" varchar(50),
	"status" varchar(1) DEFAULT 'A' NOT NULL,
	"created_by" varchar NOT NULL,
	"creation_date" timestamp DEFAULT now() NOT NULL,
	"last_updated_by" varchar NOT NULL,
	"last_update_date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"date_format" varchar DEFAULT 'MM/DD/YYYY' NOT NULL,
	"default_currency" varchar DEFAULT 'USD' NOT NULL,
	"timezone" varchar DEFAULT 'America/New_York' NOT NULL,
	"number_format" varchar DEFAULT '1,000.00' NOT NULL,
	"allowed_contract_types" jsonb DEFAULT '["direct_sales","distributor_reseller","referral","royalty_license","rebate_mdf"]'::jsonb NOT NULL,
	"custom_contract_types" jsonb,
	"required_fields_by_type" jsonb,
	"allowed_regions" jsonb,
	"default_region" varchar,
	"territory_hierarchy" jsonb,
	"enable_approval_workflow" boolean DEFAULT true NOT NULL,
	"approval_chain" jsonb,
	"auto_approval_threshold_amount" real,
	"escalation_days" integer DEFAULT 3 NOT NULL,
	"company_logo" varchar,
	"primary_color" varchar DEFAULT '#6366f1',
	"report_header_text" text,
	"report_footer_text" text,
	"email_digest_frequency" varchar DEFAULT 'daily' NOT NULL,
	"alert_threshold_amount" real,
	"default_erp_system_id" varchar,
	"auto_sync_enabled" boolean DEFAULT false NOT NULL,
	"sync_schedule_cron" varchar,
	"rounding_method" varchar DEFAULT 'round_half_up' NOT NULL,
	"default_payment_terms_days" integer DEFAULT 30 NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"compliance_score" numeric(5, 2),
	"regulatory_frameworks" jsonb,
	"jurisdiction_analysis" jsonb,
	"data_protection_compliance" boolean,
	"industry_standards" jsonb,
	"risk_factors" jsonb,
	"recommended_actions" jsonb,
	"last_compliance_check" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_version_id" varchar NOT NULL,
	"approver_id" varchar NOT NULL,
	"status" varchar NOT NULL,
	"decision_notes" text,
	"decided_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"editor_id" varchar NOT NULL,
	"change_summary" text,
	"metadata_snapshot" jsonb NOT NULL,
	"file_reference" varchar,
	"approval_state" varchar DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_comparisons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"similar_contracts" jsonb,
	"clause_variations" jsonb,
	"term_comparisons" jsonb,
	"best_practices" jsonb,
	"anomalies" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"extraction_run_id" varchar,
	"document_section" varchar,
	"section_order" integer,
	"raw_text" text NOT NULL,
	"normalized_text" text,
	"page_number" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"embedding_type" varchar NOT NULL,
	"source_text" text NOT NULL,
	"embedding" vector(384),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_graph_edges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"extraction_run_id" varchar,
	"source_node_id" varchar NOT NULL,
	"target_node_id" varchar NOT NULL,
	"relationship_type" varchar NOT NULL,
	"properties" jsonb,
	"confidence" numeric(5, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_graph_nodes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"extraction_run_id" varchar,
	"node_type" varchar NOT NULL,
	"label" varchar NOT NULL,
	"properties" jsonb NOT NULL,
	"confidence" numeric(5, 2),
	"source_document_id" varchar,
	"source_text" text,
	"embedding" vector(384),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_obligations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"obligation_type" varchar NOT NULL,
	"description" text NOT NULL,
	"due_date" timestamp,
	"responsible" varchar,
	"status" varchar DEFAULT 'pending',
	"priority" varchar DEFAULT 'medium',
	"completion_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar NOT NULL,
	"original_name" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" varchar NOT NULL,
	"file_path" varchar NOT NULL,
	"contract_type" varchar,
	"priority" varchar DEFAULT 'normal' NOT NULL,
	"status" varchar DEFAULT 'uploaded' NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"notes" text,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"contract_number" varchar,
	"display_name" varchar,
	"effective_start" timestamp,
	"effective_end" timestamp,
	"renewal_terms" text,
	"governing_law" varchar,
	"counterparty_name" varchar,
	"contract_owner_id" varchar,
	"approval_state" varchar DEFAULT 'draft' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"organization_name" varchar,
	"use_erp_matching" boolean DEFAULT false NOT NULL,
	"company_id" varchar,
	"business_unit_id" varchar,
	"location_id" varchar,
	"erp_system_id" varchar,
	"require_mapping_confirmation" boolean DEFAULT true NOT NULL,
	"mapping_confidence_threshold" real DEFAULT 0.7,
	"contract_subtype" varchar,
	"raw_text" text,
	"contract_category" varchar,
	"owning_party" varchar,
	"counterparty_type" varchar,
	"territory_scope" varchar,
	"channel_scope" varchar,
	"contract_value_estimated_annual" numeric(15, 2),
	"currency" varchar,
	"payment_frequency" varchar,
	"auto_renew" boolean,
	"renewal_term_months" integer,
	"linked_contract_id" varchar,
	"contract_status" varchar,
	CONSTRAINT "contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"erp_system_id" varchar(255) NOT NULL,
	"company_id" varchar(255),
	"business_unit_id" varchar(255),
	"location_id" varchar(255),
	"base_url" varchar(500) NOT NULL,
	"auth_type" varchar(50) NOT NULL,
	"client_id" varchar(200),
	"token_url" varchar(500),
	"auth_url" varchar(500),
	"scopes" varchar(500),
	"api_key_header" varchar(100),
	"api_key_location" varchar(20) DEFAULT 'header',
	"rate_limit_rpm" integer DEFAULT 60,
	"rate_limit_concurrent" integer DEFAULT 5,
	"retry_max_attempts" integer DEFAULT 3,
	"retry_backoff_ms" integer DEFAULT 1000,
	"health_check_endpoint" varchar(200),
	"last_health_check_at" timestamp,
	"last_health_check_status" varchar(20),
	"last_health_check_message" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_connected_at" timestamp,
	"description" text,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"basic_username" varchar(200),
	"basic_password" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "data_import_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mapping_id" varchar NOT NULL,
	"customer_id" varchar,
	"job_name" varchar NOT NULL,
	"upload_meta" jsonb,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"records_total" integer DEFAULT 0,
	"records_processed" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"error_log" jsonb,
	"created_by" varchar NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"mapping_version" integer,
	"company_id" varchar,
	"business_unit_id" varchar,
	"location_id" varchar,
	"erp_system_id" varchar,
	"entity_type" varchar,
	"job_type" varchar DEFAULT 'import' NOT NULL,
	"records_skipped" integer DEFAULT 0,
	"processing_log" jsonb,
	"connection_id" varchar,
	"endpoint_template_id" varchar,
	"source_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "integration_endpoint_templates" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"erp_system_id" varchar(255) NOT NULL,
	"erp_entity_id" varchar(255),
	"operation_type" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"http_method" varchar(10) DEFAULT 'GET' NOT NULL,
	"path_template" varchar(500) NOT NULL,
	"query_defaults" jsonb,
	"pagination_type" varchar(30) DEFAULT 'offset',
	"pagination_config" jsonb,
	"request_headers" jsonb,
	"request_body_template" jsonb,
	"response_data_path" varchar(200),
	"response_total_path" varchar(200),
	"response_schema" jsonb,
	"expected_response_time_ms" integer DEFAULT 5000,
	"requires_company_scope" boolean DEFAULT true,
	"sample_payload" jsonb,
	"sample_response" jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_systems" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"vendor" varchar NOT NULL,
	"version" varchar,
	"description" text,
	"category" varchar DEFAULT 'enterprise',
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "master_data_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mapping_name" varchar NOT NULL,
	"erp_system" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"source_schema" jsonb NOT NULL,
	"target_schema" jsonb NOT NULL,
	"mapping_results" jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"ai_model" varchar DEFAULT 'llama-3.3-70b-versatile',
	"created_by" varchar NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"customer_id" varchar,
	"erp_system_id" varchar,
	"licenseiq_entity_id" varchar,
	"company_id" varchar,
	"business_unit_id" varchar,
	"location_id" varchar,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_mapping_id" varchar,
	"ai_confidence" real,
	"approved_by" varchar,
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "erp_entities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"technical_name" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"description" text,
	"sample_data" jsonb,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_entity_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" varchar NOT NULL,
	"data" jsonb NOT NULL,
	"company_id" varchar,
	"business_unit_id" varchar,
	"location_id" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_fields" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" varchar NOT NULL,
	"field_name" varchar NOT NULL,
	"data_type" varchar NOT NULL,
	"constraints" jsonb,
	"sample_values" text,
	"description" text,
	"is_primary_key" boolean DEFAULT false,
	"is_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_licenseiq_field_mappings" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"erp_system_id" varchar NOT NULL,
	"erp_entity_id" varchar NOT NULL,
	"erp_field_id" varchar NOT NULL,
	"licenseiq_entity_id" varchar NOT NULL,
	"licenseiq_field_id" varchar NOT NULL,
	"mapping_type" varchar(50) DEFAULT 'direct',
	"transform_expression" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "licenseiq_entities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"technical_name" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "licenseiq_entities_technical_name_key" UNIQUE("technical_name")
);
--> statement-breakpoint
CREATE TABLE "licenseiq_fields" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" varchar NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"data_type" varchar(50) NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"default_value" varchar,
	"validation_rules" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_mapping_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_set_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"priority" integer DEFAULT 1 NOT NULL,
	"source_field" varchar NOT NULL,
	"source_field_id" varchar,
	"target_field" varchar NOT NULL,
	"target_field_id" varchar,
	"transformation_type" varchar DEFAULT 'direct' NOT NULL,
	"transformation_config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_mapping_conditions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" varchar NOT NULL,
	"field_name" varchar NOT NULL,
	"operator" varchar NOT NULL,
	"value" varchar,
	"value_list" jsonb,
	"logic_operator" varchar DEFAULT 'AND' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_mapping_outputs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" varchar NOT NULL,
	"output_field" varchar NOT NULL,
	"calculation_type" varchar NOT NULL,
	"calculation_config" jsonb,
	"rounding_mode" varchar DEFAULT 'nearest',
	"decimal_places" integer DEFAULT 2,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_mapping_rule_sets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"company_id" varchar NOT NULL,
	"business_unit_id" varchar,
	"location_id" varchar,
	"source_system_id" varchar NOT NULL,
	"source_entity_id" varchar,
	"target_entity_id" varchar,
	"mapping_id" varchar,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"effective_date" timestamp,
	"expiry_date" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_rule_execution_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_set_id" varchar NOT NULL,
	"calculation_id" varchar,
	"sales_record_id" varchar,
	"input_data" jsonb,
	"output_data" jsonb,
	"rules_applied" jsonb,
	"execution_time_ms" integer,
	"status" varchar DEFAULT 'success' NOT NULL,
	"error_message" text,
	"executed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"total_value" numeric(15, 2),
	"currency" varchar DEFAULT 'USD',
	"payment_schedule" jsonb,
	"royalty_structure" jsonb,
	"revenue_projections" jsonb,
	"cost_impact" jsonb,
	"currency_risk" numeric(5, 2),
	"payment_terms" text,
	"penalty_clauses" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "human_review_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"extraction_run_id" varchar,
	"task_type" varchar NOT NULL,
	"priority" varchar DEFAULT 'normal',
	"status" varchar DEFAULT 'pending',
	"target_id" varchar,
	"target_type" varchar,
	"original_data" jsonb NOT NULL,
	"suggested_correction" jsonb,
	"confidence" numeric(5, 2),
	"review_notes" text,
	"assigned_to" varchar,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "imported_erp_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"mapping_id" varchar NOT NULL,
	"customer_id" varchar,
	"source_record" jsonb NOT NULL,
	"target_record" jsonb NOT NULL,
	"embedding" vector(384),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"mapping_version" integer,
	"company_id" varchar,
	"business_unit_id" varchar,
	"location_id" varchar,
	"licenseiq_entity_id" varchar,
	"licenseiq_record_id" varchar,
	"record_status" varchar DEFAULT 'staged' NOT NULL,
	"validation_errors" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_health_events" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"status_code" integer,
	"message" text,
	"latency_ms" integer,
	"rate_limit_remaining" integer,
	"rate_limit_reset" timestamp,
	"event_type" varchar(30) NOT NULL,
	"details" jsonb,
	"checked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_operations" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"connection_id" varchar(255) NOT NULL,
	"endpoint_template_id" varchar(255) NOT NULL,
	"mapping_id" varchar(255),
	"mapping_version" integer,
	"company_id" varchar(255),
	"business_unit_id" varchar(255),
	"location_id" varchar(255),
	"operation_mode" varchar(30) NOT NULL,
	"schedule" varchar(100),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"high_watermark_field" varchar(100),
	"last_high_watermark" varchar(200),
	"last_cursor" varchar(500),
	"dry_run_allowed" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp,
	"last_run_status" varchar(20),
	"last_run_records_processed" integer,
	"last_run_records_failed" integer,
	"last_run_duration_ms" integer,
	"last_run_error" text,
	"next_run_at" timestamp,
	"retry_policy" jsonb,
	"description" text,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "licenseiq_api_endpoints" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"operation_type" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"http_method" varchar(10) DEFAULT 'GET' NOT NULL,
	"path_template" varchar(500) NOT NULL,
	"query_defaults" jsonb,
	"pagination_type" varchar(30) DEFAULT 'offset',
	"pagination_config" jsonb,
	"request_body_schema" jsonb,
	"response_data_path" varchar(200),
	"response_schema" jsonb,
	"sample_request" jsonb,
	"sample_response" jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "licenseiq_entity_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" varchar NOT NULL,
	"record_data" jsonb NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"grp_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"loc_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"loc_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"loc_name" varchar(500) NOT NULL,
	"loc_descr" text,
	"address1" varchar(500),
	"contact_person" varchar(300),
	"contact_email" varchar(300),
	"contact_phone" varchar(50),
	"contact_preference" varchar(50),
	"status" varchar(1) DEFAULT 'A' NOT NULL,
	"created_by" varchar NOT NULL,
	"creation_date" timestamp DEFAULT now() NOT NULL,
	"last_updated_by" varchar NOT NULL,
	"last_update_date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_key" varchar NOT NULL,
	"category_name" varchar NOT NULL,
	"icon_name" varchar,
	"description" text,
	"default_sort_order" integer DEFAULT 0,
	"is_collapsible" boolean DEFAULT true,
	"default_expanded" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "navigation_categories_category_key_key" UNIQUE("category_key")
);
--> statement-breakpoint
CREATE TABLE "navigation_item_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nav_item_key" varchar NOT NULL,
	"category_key" varchar NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "navigation_permissions" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"item_key" varchar NOT NULL,
	"item_name" varchar NOT NULL,
	"href" varchar NOT NULL,
	"icon_name" varchar,
	"default_roles" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "navigation_permissions_item_key_key" UNIQUE("item_key")
);
--> statement-breakpoint
CREATE TABLE "org_calculation_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"calculation_approach" varchar DEFAULT 'manual' NOT NULL,
	"default_approach" boolean DEFAULT true NOT NULL,
	"allow_contract_override" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pending_term_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar,
	"extraction_run_id" varchar,
	"original_term" varchar NOT NULL,
	"original_value" text,
	"source_text" text,
	"erp_system_id" varchar,
	"erp_entity_id" varchar,
	"erp_field_id" varchar,
	"erp_field_name" varchar,
	"erp_entity_name" varchar,
	"confidence" real DEFAULT 0 NOT NULL,
	"mapping_method" varchar DEFAULT 'ai' NOT NULL,
	"alternative_mappings" jsonb,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"confirmed_by" varchar,
	"confirmed_at" timestamp,
	"user_modified_value" text,
	"user_modified_field_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"erp_record_id" varchar,
	"erp_record_value" varchar,
	"erp_record_table" varchar,
	"company_id" varchar,
	"source_section" varchar,
	"source_page" integer
);
--> statement-breakpoint
CREATE TABLE "performance_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"performance_score" numeric(5, 2),
	"milestone_completion" numeric(5, 2),
	"on_time_delivery" boolean DEFAULT true,
	"budget_variance" numeric(10, 2),
	"quality_score" numeric(5, 2),
	"client_satisfaction" numeric(5, 2),
	"renewal_probability" numeric(5, 2),
	"last_review_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_navigation_permissions" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"role" varchar NOT NULL,
	"nav_item_key" varchar NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "rule_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"extraction_run_id" varchar,
	"linked_graph_node_id" varchar,
	"rule_type" varchar NOT NULL,
	"rule_name" varchar NOT NULL,
	"description" text,
	"formula_definition" jsonb NOT NULL,
	"applicability_filters" jsonb,
	"confidence" numeric(5, 2),
	"validation_status" varchar DEFAULT 'pending',
	"validation_errors" jsonb,
	"is_active" boolean DEFAULT false,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rule_validation_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_definition_id" varchar NOT NULL,
	"validation_type" varchar NOT NULL,
	"validation_result" varchar NOT NULL,
	"issues" jsonb,
	"recommendations" jsonb,
	"validator_id" varchar,
	"validated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_field_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar,
	"source_field_name" varchar NOT NULL,
	"target_field_type" varchar NOT NULL,
	"mapping_confidence" numeric(5, 2),
	"mapping_method" varchar DEFAULT 'ai_semantic',
	"sample_values" jsonb,
	"approved_by" varchar,
	"approved_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "semantic_index_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"index_type" varchar NOT NULL,
	"source_id" varchar,
	"content" text NOT NULL,
	"embedding" vector(384),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strategic_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"strategic_value" numeric(5, 2),
	"market_alignment" numeric(5, 2),
	"competitive_advantage" jsonb,
	"risk_concentration" numeric(5, 2),
	"standardization_score" numeric(5, 2),
	"negotiation_insights" jsonb,
	"benchmark_comparison" jsonb,
	"recommendations" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_organization_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"business_unit_id" varchar,
	"location_id" varchar,
	"role" varchar DEFAULT 'viewer' NOT NULL,
	"status" varchar(1) DEFAULT 'A' NOT NULL,
	"created_by" varchar NOT NULL,
	"creation_date" timestamp DEFAULT now() NOT NULL,
	"last_updated_by" varchar NOT NULL,
	"last_update_date" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_org_unique" UNIQUE("user_id","company_id","business_unit_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "user_active_context" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"active_org_role_id" varchar NOT NULL,
	"last_switched" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_active_context_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_category_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"nav_item_key" varchar NOT NULL,
	"category_key" varchar NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_category_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"category_key" varchar NOT NULL,
	"is_expanded" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_navigation_overrides" (
	"id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
	"user_id" varchar NOT NULL,
	"nav_item_key" varchar NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "extraction_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"run_type" varchar NOT NULL,
	"status" varchar DEFAULT 'processing' NOT NULL,
	"overall_confidence" numeric(5, 2),
	"nodes_extracted" integer,
	"edges_extracted" integer,
	"rules_extracted" integer,
	"validation_results" jsonb,
	"ai_model" varchar DEFAULT 'llama-3.1-8b',
	"processing_time" integer,
	"error_log" text,
	"triggered_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"current_stage" varchar,
	"stage_a_status" varchar DEFAULT 'pending',
	"stage_b_status" varchar DEFAULT 'pending',
	"stage_c_status" varchar DEFAULT 'pending',
	"pipeline_mode" varchar DEFAULT 'legacy'
);
--> statement-breakpoint
CREATE TABLE "contract_calculations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"status" varchar DEFAULT 'pending_approval',
	"total_sales_amount" numeric(15, 2),
	"total_royalty" numeric(15, 2),
	"currency" varchar DEFAULT 'USD',
	"sales_count" integer,
	"breakdown" jsonb,
	"chart_data" jsonb,
	"calculated_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"comments" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"company_id" varchar,
	"business_unit_id" varchar,
	"location_id" varchar
);
--> statement-breakpoint
CREATE TABLE "contract_terms" (
	"term_id" varchar PRIMARY KEY NOT NULL,
	"contract_id" varchar NOT NULL,
	"term_sequence" integer,
	"term_name" varchar,
	"term_type" varchar,
	"calculation_basis" varchar,
	"rate_type" varchar,
	"rate_value" numeric(15, 6),
	"tier_min" numeric(15, 2),
	"tier_max" numeric(15, 2),
	"tier_uom" varchar,
	"applies_to_product_category" varchar,
	"applies_to_product_family" varchar,
	"applies_to_product_ids" text,
	"excluded_product_ids" text,
	"applies_to_territory" varchar,
	"applies_to_channel" varchar,
	"payment_timing" varchar,
	"payment_method" varchar,
	"requires_claim" boolean,
	"claim_deadline_days" integer,
	"requires_proof_of_performance" boolean,
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"notes" text,
	"linked_rule_id" varchar
);
--> statement-breakpoint
CREATE TABLE "contract_qualifiers" (
	"qualifier_id" varchar PRIMARY KEY NOT NULL,
	"term_id" varchar NOT NULL,
	"qualifier_type" varchar,
	"qualifier_field" varchar,
	"operator" varchar,
	"qualifier_value" varchar,
	"qualifier_value_numeric" numeric(15, 2),
	"qualifier_logic" varchar,
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "contract_partner_assignments" (
	"assignment_id" varchar PRIMARY KEY NOT NULL,
	"contract_id" varchar NOT NULL,
	"partner_id" varchar,
	"assignment_type" varchar,
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"status" varchar,
	"custom_terms" boolean,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "contract_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"rule_type" varchar NOT NULL,
	"rule_name" varchar NOT NULL,
	"description" text,
	"product_categories" text[],
	"territories" text[],
	"seasonal_adjustments" jsonb,
	"territory_premiums" jsonb,
	"volume_tiers" jsonb,
	"base_rate" numeric(15, 2),
	"minimum_guarantee" numeric(15, 2),
	"calculation_formula" text,
	"priority" integer DEFAULT 10,
	"is_active" boolean DEFAULT true,
	"confidence" numeric(5, 2),
	"source_section" varchar,
	"source_text" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"formula_definition" jsonb,
	"formula_version" varchar DEFAULT '1.0',
	"review_status" varchar DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"source_page" integer,
	"validation_status" varchar DEFAULT 'pending',
	"validated_confidence" numeric(5, 2),
	"validation_details" jsonb,
	"field_mappings" jsonb,
	"extraction_order" integer,
	"clause_category" varchar DEFAULT 'general',
	"customer_segments" text[],
	"channel" varchar,
	"exceptions" jsonb,
	"rule_version_num" integer DEFAULT 1,
	"previous_version_data" jsonb,
	"specificity_score" integer DEFAULT 0,
	"effective_date" timestamp,
	"expiry_date" timestamp,
	"minimum_price" numeric(15, 2),
	"template_code" varchar,
	"execution_group" varchar,
	"base_metric" varchar,
	"field_confidence" jsonb,
	"review_flags" jsonb,
	"partner_ids" text[]
);
--> statement-breakpoint
CREATE TABLE "flow_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pipeline_flow_types_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sales_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matched_contract_id" varchar,
	"match_confidence" numeric(5, 2),
	"transaction_date" timestamp NOT NULL,
	"transaction_id" varchar,
	"product_code" varchar,
	"product_name" varchar,
	"category" varchar,
	"territory" varchar,
	"currency" varchar DEFAULT 'USD',
	"gross_amount" numeric(15, 2) NOT NULL,
	"net_amount" numeric(15, 2),
	"quantity" numeric(12, 4),
	"unit_price" numeric(15, 2),
	"custom_fields" jsonb,
	"import_job_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"company_id" varchar,
	"business_unit_id" varchar,
	"location_id" varchar,
	"channel" varchar,
	"customer_code" varchar
);
--> statement-breakpoint
CREATE TABLE "rebate_programs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar,
	"company_id" varchar,
	"name" varchar NOT NULL,
	"description" text,
	"program_type" varchar DEFAULT 'volume',
	"status" varchar DEFAULT 'draft',
	"start_date" timestamp,
	"end_date" timestamp,
	"qualification_criteria" jsonb,
	"tiers" jsonb,
	"retroactive" boolean DEFAULT false,
	"calculation_frequency" varchar DEFAULT 'quarterly',
	"total_accrued" numeric(15, 2) DEFAULT '0',
	"total_paid" numeric(15, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rule_decision_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" varchar,
	"contract_id" varchar,
	"transaction_id" varchar,
	"input_snapshot" jsonb,
	"output_decision" jsonb,
	"condition_matched" text,
	"alternatives_considered" jsonb,
	"confidence_score" numeric(5, 2),
	"specificity_score" integer,
	"calculation_steps" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clause_execution_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "clause_execution_groups_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rule_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"execution_group_code" varchar NOT NULL,
	"description" text,
	"required_fields" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rule_templates_template_code_key" UNIQUE("template_code")
);
--> statement-breakpoint
CREATE TABLE "contract_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"summary" text,
	"key_terms" jsonb,
	"risk_analysis" jsonb,
	"insights" jsonb,
	"confidence" numeric(5, 2),
	"processing_time" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"header_review_flags" jsonb
);
--> statement-breakpoint
CREATE TABLE "rule_conflicts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"extraction_run_id" varchar,
	"conflict_identifier" varchar,
	"rule_ids" jsonb,
	"reason" text,
	"resolution" text,
	"created_at" timestamp DEFAULT now(),
	"status" varchar DEFAULT 'open',
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "base_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"sales_column" varchar,
	CONSTRAINT "pipeline_base_metrics_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "contract_clauses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"extraction_run_id" varchar,
	"clause_identifier" varchar,
	"section_ref" varchar,
	"text" text NOT NULL,
	"clause_category_code" varchar,
	"flow_type_code" varchar,
	"affects_accrual" boolean DEFAULT false NOT NULL,
	"confidence" real,
	"evidence" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "extraction_stage_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_run_id" varchar NOT NULL,
	"stage" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"raw_output" jsonb,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "clause_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pipeline_clause_categories_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"icon" varchar,
	"color" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subflows_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "customer_segments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_name" varchar NOT NULL,
	"segment_code" varchar NOT NULL,
	"description" text,
	"company_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"name" varchar NOT NULL,
	"code" varchar,
	"segment" varchar,
	"channel" varchar,
	"territory" varchar,
	"contact_email" varchar,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"segment_id" varchar
);
--> statement-breakpoint
ALTER TABLE "accuracy_test_results" ADD CONSTRAINT "accuracy_test_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."accuracy_test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accuracy_test_results" ADD CONSTRAINT "accuracy_test_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "public"."accuracy_test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_dimensions" ADD CONSTRAINT "blueprint_dimensions_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "public"."calculation_blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_analysis" ADD CONSTRAINT "compliance_analysis_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_approvals" ADD CONSTRAINT "contract_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_approvals" ADD CONSTRAINT "contract_approvals_contract_version_id_fkey" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_comparisons" ADD CONSTRAINT "contract_comparisons_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_embeddings" ADD CONSTRAINT "contract_embeddings_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_graph_edges" ADD CONSTRAINT "contract_graph_edges_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_graph_edges" ADD CONSTRAINT "contract_graph_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "public"."contract_graph_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_graph_edges" ADD CONSTRAINT "contract_graph_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "public"."contract_graph_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_graph_nodes" ADD CONSTRAINT "contract_graph_nodes_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_graph_nodes" ADD CONSTRAINT "contract_graph_nodes_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "public"."contract_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_obligations" ADD CONSTRAINT "contract_obligations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_contract_owner_id_fkey" FOREIGN KEY ("contract_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_erp_system_id_fkey" FOREIGN KEY ("erp_system_id") REFERENCES "public"."erp_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_endpoint_template_id_fkey" FOREIGN KEY ("endpoint_template_id") REFERENCES "public"."integration_endpoint_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_erp_system_id_fkey" FOREIGN KEY ("erp_system_id") REFERENCES "public"."erp_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_mapping_id_fkey" FOREIGN KEY ("mapping_id") REFERENCES "public"."master_data_mappings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_endpoint_templates" ADD CONSTRAINT "integration_endpoint_templates_erp_entity_id_fkey" FOREIGN KEY ("erp_entity_id") REFERENCES "public"."erp_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_endpoint_templates" ADD CONSTRAINT "integration_endpoint_templates_erp_system_id_fkey" FOREIGN KEY ("erp_system_id") REFERENCES "public"."erp_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_systems" ADD CONSTRAINT "erp_systems_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_data_mappings" ADD CONSTRAINT "master_data_mappings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_data_mappings" ADD CONSTRAINT "master_data_mappings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_data_mappings" ADD CONSTRAINT "master_data_mappings_erp_system_id_fkey" FOREIGN KEY ("erp_system_id") REFERENCES "public"."erp_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_entities" ADD CONSTRAINT "erp_entities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_entities" ADD CONSTRAINT "erp_entities_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "public"."erp_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_entity_records" ADD CONSTRAINT "erp_entity_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_entity_records" ADD CONSTRAINT "erp_entity_records_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."erp_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_fields" ADD CONSTRAINT "erp_fields_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."erp_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_licenseiq_field_mappings" ADD CONSTRAINT "erp_licenseiq_field_mappings_erp_entity_id_fkey" FOREIGN KEY ("erp_entity_id") REFERENCES "public"."erp_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_licenseiq_field_mappings" ADD CONSTRAINT "erp_licenseiq_field_mappings_erp_field_id_fkey" FOREIGN KEY ("erp_field_id") REFERENCES "public"."erp_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_licenseiq_field_mappings" ADD CONSTRAINT "erp_licenseiq_field_mappings_erp_system_id_fkey" FOREIGN KEY ("erp_system_id") REFERENCES "public"."erp_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_licenseiq_field_mappings" ADD CONSTRAINT "erp_licenseiq_field_mappings_licenseiq_entity_id_fkey" FOREIGN KEY ("licenseiq_entity_id") REFERENCES "public"."licenseiq_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_licenseiq_field_mappings" ADD CONSTRAINT "erp_licenseiq_field_mappings_licenseiq_field_id_fkey" FOREIGN KEY ("licenseiq_field_id") REFERENCES "public"."licenseiq_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenseiq_fields" ADD CONSTRAINT "licenseiq_fields_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."licenseiq_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_mapping_rules" ADD CONSTRAINT "erp_mapping_rules_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "public"."erp_mapping_rule_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_mapping_conditions" ADD CONSTRAINT "erp_mapping_conditions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."erp_mapping_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_mapping_outputs" ADD CONSTRAINT "erp_mapping_outputs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."erp_mapping_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_rule_execution_log" ADD CONSTRAINT "erp_rule_execution_log_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "public"."erp_mapping_rule_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_analysis" ADD CONSTRAINT "financial_analysis_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_review_tasks" ADD CONSTRAINT "human_review_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_review_tasks" ADD CONSTRAINT "human_review_tasks_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_review_tasks" ADD CONSTRAINT "human_review_tasks_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_review_tasks" ADD CONSTRAINT "human_review_tasks_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_erp_records" ADD CONSTRAINT "imported_erp_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_erp_records" ADD CONSTRAINT "imported_erp_records_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."data_import_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_erp_records" ADD CONSTRAINT "imported_erp_records_mapping_id_fkey" FOREIGN KEY ("mapping_id") REFERENCES "public"."master_data_mappings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_health_events" ADD CONSTRAINT "integration_health_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_operations" ADD CONSTRAINT "integration_operations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_operations" ADD CONSTRAINT "integration_operations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_operations" ADD CONSTRAINT "integration_operations_endpoint_template_id_fkey" FOREIGN KEY ("endpoint_template_id") REFERENCES "public"."integration_endpoint_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_operations" ADD CONSTRAINT "integration_operations_mapping_id_fkey" FOREIGN KEY ("mapping_id") REFERENCES "public"."master_data_mappings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenseiq_api_endpoints" ADD CONSTRAINT "licenseiq_api_endpoints_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."licenseiq_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenseiq_entity_records" ADD CONSTRAINT "licenseiq_entity_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenseiq_entity_records" ADD CONSTRAINT "licenseiq_entity_records_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."licenseiq_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenseiq_entity_records" ADD CONSTRAINT "licenseiq_entity_records_grp_id_fkey" FOREIGN KEY ("grp_id") REFERENCES "public"."companies"("company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenseiq_entity_records" ADD CONSTRAINT "licenseiq_entity_records_loc_id_fkey" FOREIGN KEY ("loc_id") REFERENCES "public"."locations"("loc_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenseiq_entity_records" ADD CONSTRAINT "licenseiq_entity_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."business_units"("org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."business_units"("org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_item_categories" ADD CONSTRAINT "navigation_item_categories_category_key_fkey" FOREIGN KEY ("category_key") REFERENCES "public"."navigation_categories"("category_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_item_categories" ADD CONSTRAINT "navigation_item_categories_nav_item_key_fkey" FOREIGN KEY ("nav_item_key") REFERENCES "public"."navigation_permissions"("item_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_calculation_settings" ADD CONSTRAINT "org_calculation_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_calculation_settings" ADD CONSTRAINT "org_calculation_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_term_mappings" ADD CONSTRAINT "pending_term_mappings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_term_mappings" ADD CONSTRAINT "pending_term_mappings_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_term_mappings" ADD CONSTRAINT "pending_term_mappings_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_term_mappings" ADD CONSTRAINT "pending_term_mappings_erp_entity_id_fkey" FOREIGN KEY ("erp_entity_id") REFERENCES "public"."erp_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_term_mappings" ADD CONSTRAINT "pending_term_mappings_erp_field_id_fkey" FOREIGN KEY ("erp_field_id") REFERENCES "public"."erp_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_term_mappings" ADD CONSTRAINT "pending_term_mappings_erp_system_id_fkey" FOREIGN KEY ("erp_system_id") REFERENCES "public"."erp_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_navigation_permissions" ADD CONSTRAINT "role_navigation_permissions_nav_item_key_fkey" FOREIGN KEY ("nav_item_key") REFERENCES "public"."navigation_permissions"("item_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_definitions" ADD CONSTRAINT "rule_definitions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_definitions" ADD CONSTRAINT "rule_definitions_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_definitions" ADD CONSTRAINT "rule_definitions_linked_graph_node_id_fkey" FOREIGN KEY ("linked_graph_node_id") REFERENCES "public"."contract_graph_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_validation_events" ADD CONSTRAINT "rule_validation_events_rule_definition_id_fkey" FOREIGN KEY ("rule_definition_id") REFERENCES "public"."rule_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_validation_events" ADD CONSTRAINT "rule_validation_events_validator_id_fkey" FOREIGN KEY ("validator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_field_mappings" ADD CONSTRAINT "sales_field_mappings_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_field_mappings" ADD CONSTRAINT "sales_field_mappings_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_index_entries" ADD CONSTRAINT "semantic_index_entries_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_analysis" ADD CONSTRAINT "strategic_analysis_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_roles" ADD CONSTRAINT "user_organization_roles_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_roles" ADD CONSTRAINT "user_organization_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_roles" ADD CONSTRAINT "user_organization_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_roles" ADD CONSTRAINT "user_organization_roles_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_roles" ADD CONSTRAINT "user_organization_roles_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("loc_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_roles" ADD CONSTRAINT "user_organization_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_active_context" ADD CONSTRAINT "user_active_context_active_org_role_id_fkey" FOREIGN KEY ("active_org_role_id") REFERENCES "public"."user_organization_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_active_context" ADD CONSTRAINT "user_active_context_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_preferences" ADD CONSTRAINT "user_category_preferences_category_key_fkey" FOREIGN KEY ("category_key") REFERENCES "public"."navigation_categories"("category_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_preferences" ADD CONSTRAINT "user_category_preferences_nav_item_key_fkey" FOREIGN KEY ("nav_item_key") REFERENCES "public"."navigation_permissions"("item_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_preferences" ADD CONSTRAINT "user_category_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_state" ADD CONSTRAINT "user_category_state_category_key_fkey" FOREIGN KEY ("category_key") REFERENCES "public"."navigation_categories"("category_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_state" ADD CONSTRAINT "user_category_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_navigation_overrides" ADD CONSTRAINT "user_navigation_overrides_nav_item_key_fkey" FOREIGN KEY ("nav_item_key") REFERENCES "public"."navigation_permissions"("item_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_navigation_overrides" ADD CONSTRAINT "user_navigation_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_calculations" ADD CONSTRAINT "contract_royalty_calculations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_calculations" ADD CONSTRAINT "contract_royalty_calculations_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_calculations" ADD CONSTRAINT "contract_royalty_calculations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_calculations" ADD CONSTRAINT "contract_royalty_calculations_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_rules" ADD CONSTRAINT "royalty_rules_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_data" ADD CONSTRAINT "sales_data_matched_contract_id_contracts_id_fk" FOREIGN KEY ("matched_contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD CONSTRAINT "rebate_programs_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_decision_logs" ADD CONSTRAINT "rule_decision_logs_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_decision_logs" ADD CONSTRAINT "rule_decision_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."contract_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_analysis" ADD CONSTRAINT "contract_analysis_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_conflicts" ADD CONSTRAINT "rule_conflicts_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_conflicts" ADD CONSTRAINT "rule_conflicts_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_clauses" ADD CONSTRAINT "contract_clauses_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_clauses" ADD CONSTRAINT "contract_clauses_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_stage_results" ADD CONSTRAINT "extraction_stage_results_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."customer_segments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calc_dim_config_contract_idx" ON "calculation_dimension_config" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "calc_dim_config_unique_idx" ON "calculation_dimension_config" USING btree ("contract_id" text_ops,"dimension_key" text_ops);--> statement-breakpoint
CREATE INDEX "calc_line_items_calc_idx" ON "calculation_line_items" USING btree ("calculation_id" text_ops);--> statement-breakpoint
CREATE INDEX "calc_line_items_class_idx" ON "calculation_line_items" USING btree ("item_class" text_ops);--> statement-breakpoint
CREATE INDEX "calc_line_items_contract_idx" ON "calculation_line_items" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "calc_line_items_item_idx" ON "calculation_line_items" USING btree ("item_name" text_ops);--> statement-breakpoint
CREATE INDEX "calc_line_items_period_idx" ON "calculation_line_items" USING btree ("period" text_ops);--> statement-breakpoint
CREATE INDEX "calc_line_items_territory_idx" ON "calculation_line_items" USING btree ("territory" text_ops);--> statement-breakpoint
CREATE INDEX "calc_line_items_vendor_idx" ON "calculation_line_items" USING btree ("vendor_name" text_ops);--> statement-breakpoint
CREATE INDEX "demo_requests_email_idx" ON "demo_requests" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "demo_requests_plan_idx" ON "demo_requests" USING btree ("plan_tier" text_ops);--> statement-breakpoint
CREATE INDEX "demo_requests_status_idx" ON "demo_requests" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "early_access_email_idx" ON "early_access_signups" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "early_access_status_idx" ON "early_access_signups" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_items_category" ON "items" USING btree ("item_category" text_ops);--> statement-breakpoint
CREATE INDEX "idx_items_company" ON "items" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_items_item_number" ON "items" USING btree ("item_number" text_ops);--> statement-breakpoint
CREATE INDEX "idx_items_status" ON "items" USING btree ("item_status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_items_vendor" ON "items" USING btree ("vendor" text_ops);--> statement-breakpoint
CREATE INDEX "roles_name_idx" ON "roles" USING btree ("role_name" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire" timestamp_ops);--> statement-breakpoint
CREATE INDEX "system_embeddings_category_idx" ON "system_embeddings" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "system_embeddings_document_idx" ON "system_embeddings" USING btree ("document_id" text_ops);--> statement-breakpoint
CREATE INDEX "system_embeddings_embedding_hnsw_idx" ON "system_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "calc_blueprints_company_idx" ON "calculation_blueprints" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "calc_blueprints_contract_idx" ON "calculation_blueprints" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "calc_blueprints_rule_idx" ON "calculation_blueprints" USING btree ("royalty_rule_id" text_ops);--> statement-breakpoint
CREATE INDEX "calc_blueprints_status_idx" ON "calculation_blueprints" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "blueprint_dims_blueprint_idx" ON "blueprint_dimensions" USING btree ("blueprint_id" text_ops);--> statement-breakpoint
CREATE INDEX "blueprint_dims_type_idx" ON "blueprint_dimensions" USING btree ("dimension_type" text_ops);--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("company_name" text_ops);--> statement-breakpoint
CREATE INDEX "companies_status_idx" ON "companies" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "business_units_company_idx" ON "business_units" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "business_units_name_idx" ON "business_units" USING btree ("org_name" text_ops);--> statement-breakpoint
CREATE INDEX "business_units_status_idx" ON "business_units" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "company_settings_company_idx" ON "company_settings" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "contract_approvals_version_idx" ON "contract_approvals" USING btree ("contract_version_id" text_ops);--> statement-breakpoint
CREATE INDEX "contract_versions_contract_idx" ON "contract_versions" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "contract_versions_state_idx" ON "contract_versions" USING btree ("approval_state" text_ops);--> statement-breakpoint
CREATE INDEX "contract_documents_contract_idx" ON "contract_documents" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "contract_documents_extraction_idx" ON "contract_documents" USING btree ("extraction_run_id" text_ops);--> statement-breakpoint
CREATE INDEX "contract_embeddings_contract_idx" ON "contract_embeddings" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "contract_embeddings_embedding_hnsw_idx" ON "contract_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "contract_embeddings_type_idx" ON "contract_embeddings" USING btree ("embedding_type" text_ops);--> statement-breakpoint
CREATE INDEX "graph_edges_contract_idx" ON "contract_graph_edges" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "graph_edges_source_idx" ON "contract_graph_edges" USING btree ("source_node_id" text_ops);--> statement-breakpoint
CREATE INDEX "graph_edges_target_idx" ON "contract_graph_edges" USING btree ("target_node_id" text_ops);--> statement-breakpoint
CREATE INDEX "graph_nodes_contract_idx" ON "contract_graph_nodes" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "graph_nodes_extraction_idx" ON "contract_graph_nodes" USING btree ("extraction_run_id" text_ops);--> statement-breakpoint
CREATE INDEX "graph_nodes_type_idx" ON "contract_graph_nodes" USING btree ("node_type" text_ops);--> statement-breakpoint
CREATE INDEX "integration_connections_company_idx" ON "integration_connections" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "integration_connections_erp_idx" ON "integration_connections" USING btree ("erp_system_id" text_ops);--> statement-breakpoint
CREATE INDEX "integration_connections_status_idx" ON "integration_connections" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "data_import_jobs_bu_idx" ON "data_import_jobs" USING btree ("business_unit_id" text_ops);--> statement-breakpoint
CREATE INDEX "data_import_jobs_company_idx" ON "data_import_jobs" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "data_import_jobs_customer_idx" ON "data_import_jobs" USING btree ("customer_id" text_ops);--> statement-breakpoint
CREATE INDEX "data_import_jobs_erp_system_idx" ON "data_import_jobs" USING btree ("erp_system_id" text_ops);--> statement-breakpoint
CREATE INDEX "data_import_jobs_job_type_idx" ON "data_import_jobs" USING btree ("job_type" text_ops);--> statement-breakpoint
CREATE INDEX "data_import_jobs_loc_idx" ON "data_import_jobs" USING btree ("location_id" text_ops);--> statement-breakpoint
CREATE INDEX "data_import_jobs_mapping_idx" ON "data_import_jobs" USING btree ("mapping_id" text_ops);--> statement-breakpoint
CREATE INDEX "data_import_jobs_status_idx" ON "data_import_jobs" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "endpoint_templates_entity_idx" ON "integration_endpoint_templates" USING btree ("erp_entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "endpoint_templates_erp_idx" ON "integration_endpoint_templates" USING btree ("erp_system_id" text_ops);--> statement-breakpoint
CREATE INDEX "endpoint_templates_operation_idx" ON "integration_endpoint_templates" USING btree ("operation_type" text_ops);--> statement-breakpoint
CREATE INDEX "erp_systems_status_idx" ON "erp_systems" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "erp_systems_vendor_idx" ON "erp_systems" USING btree ("vendor" text_ops);--> statement-breakpoint
CREATE INDEX "master_data_mappings_bu_idx" ON "master_data_mappings" USING btree ("business_unit_id" text_ops);--> statement-breakpoint
CREATE INDEX "master_data_mappings_company_idx" ON "master_data_mappings" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "master_data_mappings_customer_idx" ON "master_data_mappings" USING btree ("customer_id" text_ops);--> statement-breakpoint
CREATE INDEX "master_data_mappings_entity_idx" ON "master_data_mappings" USING btree ("entity_type" text_ops);--> statement-breakpoint
CREATE INDEX "master_data_mappings_erp_idx" ON "master_data_mappings" USING btree ("erp_system" text_ops);--> statement-breakpoint
CREATE INDEX "master_data_mappings_erp_system_id_idx" ON "master_data_mappings" USING btree ("erp_system_id" text_ops);--> statement-breakpoint
CREATE INDEX "master_data_mappings_loc_idx" ON "master_data_mappings" USING btree ("location_id" text_ops);--> statement-breakpoint
CREATE INDEX "master_data_mappings_status_idx" ON "master_data_mappings" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "master_data_mappings_version_idx" ON "master_data_mappings" USING btree ("version" int4_ops);--> statement-breakpoint
CREATE INDEX "erp_entities_system_idx" ON "erp_entities" USING btree ("system_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_entities_type_idx" ON "erp_entities" USING btree ("entity_type" text_ops);--> statement-breakpoint
CREATE INDEX "erp_entity_records_company_idx" ON "erp_entity_records" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_entity_records_entity_idx" ON "erp_entity_records" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_fields_entity_idx" ON "erp_fields" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_liq_mapping_erp_idx" ON "erp_licenseiq_field_mappings" USING btree ("erp_system_id" text_ops,"erp_field_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_liq_mapping_liq_idx" ON "erp_licenseiq_field_mappings" USING btree ("licenseiq_entity_id" text_ops,"licenseiq_field_id" text_ops);--> statement-breakpoint
CREATE INDEX "licenseiq_fields_entity_idx" ON "licenseiq_fields" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_mapping_rules_priority_idx" ON "erp_mapping_rules" USING btree ("priority" int4_ops);--> statement-breakpoint
CREATE INDEX "erp_mapping_rules_set_idx" ON "erp_mapping_rules" USING btree ("rule_set_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_mapping_conditions_rule_idx" ON "erp_mapping_conditions" USING btree ("rule_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_mapping_outputs_rule_idx" ON "erp_mapping_outputs" USING btree ("rule_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_rule_sets_company_idx" ON "erp_mapping_rule_sets" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_rule_sets_source_idx" ON "erp_mapping_rule_sets" USING btree ("source_system_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_rule_sets_status_idx" ON "erp_mapping_rule_sets" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "erp_rule_exec_log_calc_idx" ON "erp_rule_execution_log" USING btree ("calculation_id" text_ops);--> statement-breakpoint
CREATE INDEX "erp_rule_exec_log_date_idx" ON "erp_rule_execution_log" USING btree ("executed_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "erp_rule_exec_log_set_idx" ON "erp_rule_execution_log" USING btree ("rule_set_id" text_ops);--> statement-breakpoint
CREATE INDEX "review_tasks_assigned_idx" ON "human_review_tasks" USING btree ("assigned_to" text_ops);--> statement-breakpoint
CREATE INDEX "review_tasks_contract_idx" ON "human_review_tasks" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "review_tasks_status_idx" ON "human_review_tasks" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "imported_records_bu_idx" ON "imported_erp_records" USING btree ("business_unit_id" text_ops);--> statement-breakpoint
CREATE INDEX "imported_records_company_idx" ON "imported_erp_records" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "imported_records_customer_idx" ON "imported_erp_records" USING btree ("customer_id" text_ops);--> statement-breakpoint
CREATE INDEX "imported_records_embedding_idx" ON "imported_erp_records" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "imported_records_job_idx" ON "imported_erp_records" USING btree ("job_id" text_ops);--> statement-breakpoint
CREATE INDEX "imported_records_licenseiq_entity_idx" ON "imported_erp_records" USING btree ("licenseiq_entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "imported_records_loc_idx" ON "imported_erp_records" USING btree ("location_id" text_ops);--> statement-breakpoint
CREATE INDEX "imported_records_mapping_idx" ON "imported_erp_records" USING btree ("mapping_id" text_ops);--> statement-breakpoint
CREATE INDEX "imported_records_status_idx" ON "imported_erp_records" USING btree ("record_status" text_ops);--> statement-breakpoint
CREATE INDEX "health_events_checked_idx" ON "integration_health_events" USING btree ("checked_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "health_events_connection_idx" ON "integration_health_events" USING btree ("connection_id" text_ops);--> statement-breakpoint
CREATE INDEX "health_events_status_idx" ON "integration_health_events" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "health_events_type_idx" ON "integration_health_events" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "integration_operations_company_idx" ON "integration_operations" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "integration_operations_connection_idx" ON "integration_operations" USING btree ("connection_id" text_ops);--> statement-breakpoint
CREATE INDEX "integration_operations_mode_idx" ON "integration_operations" USING btree ("operation_mode" text_ops);--> statement-breakpoint
CREATE INDEX "integration_operations_schedule_idx" ON "integration_operations" USING btree ("is_enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "integration_operations_template_idx" ON "integration_operations" USING btree ("endpoint_template_id" text_ops);--> statement-breakpoint
CREATE INDEX "licenseiq_api_entity_idx" ON "licenseiq_api_endpoints" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "licenseiq_api_operation_idx" ON "licenseiq_api_endpoints" USING btree ("operation_type" text_ops);--> statement-breakpoint
CREATE INDEX "licenseiq_records_entity_idx" ON "licenseiq_entity_records" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "licenseiq_records_grp_idx" ON "licenseiq_entity_records" USING btree ("grp_id" text_ops);--> statement-breakpoint
CREATE INDEX "licenseiq_records_loc_idx" ON "licenseiq_entity_records" USING btree ("loc_id" text_ops);--> statement-breakpoint
CREATE INDEX "licenseiq_records_org_idx" ON "licenseiq_entity_records" USING btree ("org_id" text_ops);--> statement-breakpoint
CREATE INDEX "locations_company_idx" ON "locations" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "locations_name_idx" ON "locations" USING btree ("loc_name" text_ops);--> statement-breakpoint
CREATE INDEX "locations_org_idx" ON "locations" USING btree ("org_id" text_ops);--> statement-breakpoint
CREATE INDEX "locations_status_idx" ON "locations" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "nav_cat_key_idx" ON "navigation_categories" USING btree ("category_key" text_ops);--> statement-breakpoint
CREATE INDEX "nav_cat_sort_idx" ON "navigation_categories" USING btree ("default_sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "nav_item_cat_cat_idx" ON "navigation_item_categories" USING btree ("category_key" text_ops);--> statement-breakpoint
CREATE INDEX "nav_item_cat_item_idx" ON "navigation_item_categories" USING btree ("nav_item_key" text_ops);--> statement-breakpoint
CREATE INDEX "nav_perm_item_key_idx" ON "navigation_permissions" USING btree ("item_key" text_ops);--> statement-breakpoint
CREATE INDEX "org_calc_settings_company_idx" ON "org_calculation_settings" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "pending_term_mappings_company_idx" ON "pending_term_mappings" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "pending_term_mappings_contract_idx" ON "pending_term_mappings" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "pending_term_mappings_erp_idx" ON "pending_term_mappings" USING btree ("erp_system_id" text_ops);--> statement-breakpoint
CREATE INDEX "pending_term_mappings_run_idx" ON "pending_term_mappings" USING btree ("extraction_run_id" text_ops);--> statement-breakpoint
CREATE INDEX "pending_term_mappings_status_idx" ON "pending_term_mappings" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "role_nav_perm_item_idx" ON "role_navigation_permissions" USING btree ("nav_item_key" text_ops);--> statement-breakpoint
CREATE INDEX "role_nav_perm_role_idx" ON "role_navigation_permissions" USING btree ("role" text_ops);--> statement-breakpoint
CREATE INDEX "rule_definitions_contract_idx" ON "rule_definitions" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "rule_definitions_status_idx" ON "rule_definitions" USING btree ("validation_status" text_ops);--> statement-breakpoint
CREATE INDEX "validation_events_rule_idx" ON "rule_validation_events" USING btree ("rule_definition_id" text_ops);--> statement-breakpoint
CREATE INDEX "field_mappings_contract_idx" ON "sales_field_mappings" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "field_mappings_source_idx" ON "sales_field_mappings" USING btree ("source_field_name" text_ops);--> statement-breakpoint
CREATE INDEX "semantic_index_contract_idx" ON "semantic_index_entries" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "semantic_index_type_idx" ON "semantic_index_entries" USING btree ("index_type" text_ops);--> statement-breakpoint
CREATE INDEX "user_org_roles_bu_idx" ON "user_organization_roles" USING btree ("business_unit_id" text_ops);--> statement-breakpoint
CREATE INDEX "user_org_roles_company_idx" ON "user_organization_roles" USING btree ("company_id" text_ops);--> statement-breakpoint
CREATE INDEX "user_org_roles_location_idx" ON "user_organization_roles" USING btree ("location_id" text_ops);--> statement-breakpoint
CREATE INDEX "user_org_roles_status_idx" ON "user_organization_roles" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "user_org_roles_user_idx" ON "user_organization_roles" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "user_active_ctx_role_idx" ON "user_active_context" USING btree ("active_org_role_id" text_ops);--> statement-breakpoint
CREATE INDEX "user_active_ctx_user_idx" ON "user_active_context" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "user_cat_pref_item_idx" ON "user_category_preferences" USING btree ("nav_item_key" text_ops);--> statement-breakpoint
CREATE INDEX "user_cat_pref_user_idx" ON "user_category_preferences" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "user_cat_state_cat_idx" ON "user_category_state" USING btree ("category_key" text_ops);--> statement-breakpoint
CREATE INDEX "user_cat_state_user_idx" ON "user_category_state" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "user_nav_override_item_idx" ON "user_navigation_overrides" USING btree ("nav_item_key" text_ops);--> statement-breakpoint
CREATE INDEX "user_nav_override_user_idx" ON "user_navigation_overrides" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "extraction_runs_contract_idx" ON "extraction_runs" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "extraction_runs_status_idx" ON "extraction_runs" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "contract_terms_contract_idx" ON "contract_terms" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "contract_qualifiers_term_idx" ON "contract_qualifiers" USING btree ("term_id" text_ops);--> statement-breakpoint
CREATE INDEX "contract_partner_assignments_contract_idx" ON "contract_partner_assignments" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "rule_conflicts_contract_idx" ON "rule_conflicts" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "rule_conflicts_extraction_idx" ON "rule_conflicts" USING btree ("extraction_run_id" text_ops);--> statement-breakpoint
CREATE INDEX "contract_clauses_category_idx" ON "contract_clauses" USING btree ("clause_category_code" text_ops);--> statement-breakpoint
CREATE INDEX "contract_clauses_contract_idx" ON "contract_clauses" USING btree ("contract_id" text_ops);--> statement-breakpoint
CREATE INDEX "contract_clauses_extraction_idx" ON "contract_clauses" USING btree ("extraction_run_id" text_ops);--> statement-breakpoint
CREATE INDEX "extraction_stage_results_run_idx" ON "extraction_stage_results" USING btree ("extraction_run_id" text_ops);--> statement-breakpoint
CREATE INDEX "extraction_stage_results_stage_idx" ON "extraction_stage_results" USING btree ("stage" text_ops);
*/