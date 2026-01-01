#!/usr/bin/env node
/**
 * Inject Environment Variables for Development
 * Reads .env.local (local) or process.env (CI) and generates environment.ts with actual values
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const isCI = process.env.CI === "true" || process.env.CI === "1";

// Read environment variables
let envVars = {
  supabaseUrl: "",
  supabaseAnonKey: "",
};

// Try to load from process.env first (CI or environment variables)
envVars.supabaseUrl = process.env.VITE_SUPABASE_URL || "";
envVars.supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

// If not in CI and values not set, try .env.local
if (!isCI && (!envVars.supabaseUrl || !envVars.supabaseAnonKey)) {
  if (existsSync(".env.local")) {
    try {
      const envContent = readFileSync(".env.local", "utf-8");
      const lines = envContent.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=").trim();

        if (key === "VITE_SUPABASE_URL" && !envVars.supabaseUrl) {
          envVars.supabaseUrl = value;
        } else if (
          key === "VITE_SUPABASE_ANON_KEY" &&
          !envVars.supabaseAnonKey
        ) {
          envVars.supabaseAnonKey = value;
        }
      }

      console.log("✅ Loaded environment variables from .env.local");
    } catch (error) {
      console.warn("⚠️  Warning: Could not load .env.local file");
    }
  } else {
    console.warn("⚠️  Warning: .env.local file not found");
  }
}

// Log the source and status
if (isCI) {
  console.log("✅ Running in CI mode - using environment variables");
} else {
  console.log("✅ Running in development mode");
}

console.log(
  `   VITE_SUPABASE_URL: ${envVars.supabaseUrl ? "✓ Set" : "✗ Not set"}`,
);
console.log(
  `   VITE_SUPABASE_ANON_KEY: ${envVars.supabaseAnonKey ? "✓ Set" : "✗ Not set"}`,
);

const envContent = `/**
 * Development Environment Configuration
 * This file is AUTO-GENERATED from .env.local
 * DO NOT EDIT - Run "pnpm start" to regenerate
 */

export const environment = {
  production: false,
  gbifApiUrl: 'https://api.gbif.org/v1',
  enableDebugLogging: true,
  enablePerformanceMonitoring: true,
  enableAnalytics: false,
  cacheEnabled: true,
  cacheTTL: 7 * 24 * 60 * 60 * 1000,
  cacheMaxSize: 50 * 1024 * 1024,
  cacheMaxEntries: 100,
  rateLimitEnabled: true,
  maxRequestsPerMinute: 300,
  maxRequestsPerHour: 10000,
  enableWebWorkers: true,
  maxWebWorkers: 6,
  dataLoadingBatchSize: 1000,
  dataLoadingProgressiveStages: 5,
  sentryDsn: '',
  sentryEnvironment: 'development',
  sentryTracesSampleRate: 1.0,
  sentryEnabled: false,
  googleAnalyticsId: '',
  analyticsEnabled: false,
  supabaseUrl: '${envVars.supabaseUrl}',
  supabaseAnonKey: '${envVars.supabaseAnonKey}',
  version: '1.0.0-dev',
  cacheVersion: '1.0.0',
  buildDate: '${new Date().toISOString()}',
} as const;

export type Environment = typeof environment;
`;

const outputPath = join(process.cwd(), "src", "environments", "environment.ts");
writeFileSync(outputPath, envContent, "utf-8");

console.log("✅ Generated src/environments/environment.ts");

// Only fail if not in CI and credentials are missing
if (!isCI && (!envVars.supabaseUrl || !envVars.supabaseAnonKey)) {
  console.error("\n❌ ERROR: Supabase credentials are missing!");
  console.error("   Please create .env.local with:");
  console.error("   VITE_SUPABASE_URL=your-supabase-url");
  console.error("   VITE_SUPABASE_ANON_KEY=your-anon-key");
  process.exit(1);
}

// In CI, warn but don't fail if credentials are missing (E2E tests may not need them)
if (isCI && (!envVars.supabaseUrl || !envVars.supabaseAnonKey)) {
  console.warn("\n⚠️  Warning: Supabase credentials not set in CI");
  console.warn("   E2E tests will run with empty credentials");
  console.warn(
    "   Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as GitHub secrets if needed",
  );
}
