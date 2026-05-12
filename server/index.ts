import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
// Preserve raw body for HMAC-signed inbound endpoint BEFORE json parser runs.
app.use("/api/inbound-events", express.raw({ type: "*/*", limit: "5mb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Database initialization: ensure vector extension and indexes exist
async function initializeDatabase() {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");

    // Enable pgvector extension
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    log("✓ pgvector extension enabled");

    // Create HNSW index for fast vector similarity search
    // Using IF NOT EXISTS to avoid errors on repeated deployments
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS contract_embeddings_embedding_hnsw_idx 
      ON contract_embeddings 
      USING hnsw (embedding vector_cosine_ops);
    `);
    log("✓ HNSW index created for vector similarity search");

    // Seed LicenseIQ Schema Catalog with standard entities
    const { seedLicenseIQSchema } = await import("./seed-licenseiq-schema");
    await seedLicenseIQSchema();

    // Seed System Knowledge Base for LIQ AI platform questions
    const { SystemKnowledgeSeeder } = await import(
      "./services/systemKnowledgeSeeder"
    );
    await SystemKnowledgeSeeder.seedKnowledgeBase();

    // Seed Navigation System (categories, items, mappings, permissions)
    const { seedNavigation } = await import("./seed-navigation");
    await seedNavigation();

    // Seed Master Data (admin user, Monrovia company hierarchy)
    const { seedMasterData } = await import("./seed-master-data");
    await seedMasterData();

    // Seed Rule Taxonomy (subtypes, flow_subtype_validity, rule_types,
    // rule_field_whitelist, deduction_reason_codes). Must run BEFORE the
    // contract template seeder, which iterates over subtypes + the
    // validity matrix to derive template clauses and rules.
    const { seedRuleTaxonomy } = await import("./seed-rule-taxonomy");
    await seedRuleTaxonomy();

    // Seed Geography Masters (countries, states, cities)
    const { seedGeographyMasters } = await import("./seed-geography");
    await seedGeographyMasters();

    // Seed ERP Systems, Entities, Fields, and LicenseIQ Schema Data
    const { seedErpData } = await import("./seed-erp-data");
    await seedErpData();

    // Seed Contract Processing Pipeline Reference Data
    const { seedPipelineReferenceData } = await import("./seed-pipeline-data");
    await seedPipelineReferenceData();

    // Contract seeding removed — contracts should be uploaded via UI

    // Seed System Contract Templates (one per flow type, matrix-driven)
    const { seedSystemContractTemplates } = await import("./services/contractTemplateSeeder");
    await seedSystemContractTemplates();

    // Backfill default subtype_instances + settlement/accrual policies for
    // any contracts that exist but have no instance yet (e.g. uploaded
    // before the taxonomy was seeded). Idempotent — no-op once everything
    // already has its defaults.
    const { seedDefaultPolicies } = await import("./seed-default-policies");
    await seedDefaultPolicies();

    // One-time: Copy TechSound schema data to CimpleIT Inc
    const { seedCimpleitData } = await import("./seed-cimpleit-data");
    await seedCimpleitData();
  } catch (error: any) {
    log(`⚠ Database initialization warning: ${error.message}`);
    // Don't fail server startup if index creation fails
  }
}

(async () => {
  // Initialize database before starting server
  await initializeDatabase();

  const server = await registerRoutes(app);

  // Start nightly obligation expiry scheduler. Runs in-process and is
  // gated on the system_settings toggle (admins can switch it off in UI).
  try {
    const { startObligationExpiryScheduler } = await import('./services/obligationExpiryScheduler');
    startObligationExpiryScheduler();
  } catch (e: any) {
    log(`⚠ Failed to start obligation expiry scheduler: ${e?.message || e}`);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: process.env.HOST || "127.0.0.1",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
