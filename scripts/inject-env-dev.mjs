#!/usr/bin/env node
/**
 * Inject Environment Variables for Development
 * Reads .env.local and generates environment.ts with actual values
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Read .env.local
let envVars = {
  supabaseUrl: "",
  supabaseAnonKey: "",
};

try {
  const envContent = readFileSync(".env.local", "utf-8");
  const lines = envContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim();

    if (key === "VITE_SUPABASE_URL") {
      envVars.supabaseUrl = value;
    } else if (key === "VITE_SUPABASE_ANON_KEY") {
      envVars.supabaseAnonKey = value;
    }
  }

  console.log("✅ Loaded environment variables from .env.local");
  console.log(
    `   VITE_SUPABASE_URL: ${envVars.supabaseUrl ? "✓ Set" : "✗ Not set"}`,
  );
  console.log(
    `   VITE_SUPABASE_ANON_KEY: ${envVars.supabaseAnonKey ? "✓ Set" : "✗ Not set"}`,
  );
} catch (error) {
  console.warn("⚠️  Warning: Could not load .env.local file");
  console.warn("   Creating environment.ts with empty Supabase credentials");
  console.warn("   Please create .env.local with your Supabase credentials");
}

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
  buildDate: '${new Date().toISOString()}',
} as const;

export type Environment = typeof environment;
`;

const outputPath = join(process.cwd(), "src", "environments", "environment.ts");
writeFileSync(outputPath, envContent, "utf-8");

console.log("✅ Generated src/environments/environment.ts");

if (!envVars.supabaseUrl || !envVars.supabaseAnonKey) {
  console.error("\n❌ ERROR: Supabase credentials are missing!");
  console.error("   Please create .env.local with:");
  console.error("   VITE_SUPABASE_URL=your-supabase-url");
  console.error("   VITE_SUPABASE_ANON_KEY=your-anon-key");
  process.exit(1);
}
