#!/usr/bin/env node
/**
 * Inject Environment Variables Script
 * Generates environment configuration from process.env for production builds
 *
 * Works with:
 * - Vercel: Reads from process.env (set in Vercel dashboard)
 * - Netlify: Reads from process.env (set in Netlify dashboard)
 * - Local builds: Falls back to .env.local
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// Try to read from process.env first (Vercel/Netlify deployment)
let envVars = {
  supabaseUrl: process.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
  sentryDsn: process.env.VITE_SENTRY_DSN || "",
  googleAnalyticsId: process.env.VITE_GA_TRACKING_ID || "",
};

// If not in process.env, try to read from .env.local (local builds only)
if (!envVars.supabaseUrl || !envVars.supabaseAnonKey) {
  const envLocalPath = ".env.local";

  if (existsSync(envLocalPath)) {
    console.log(
      "📂 Reading from .env.local (local build - not used on Vercel/Netlify)...",
    );
    try {
      const envContent = readFileSync(envLocalPath, "utf-8");
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
        } else if (key === "VITE_SENTRY_DSN" && !envVars.sentryDsn) {
          envVars.sentryDsn = value;
        } else if (
          key === "VITE_GA_TRACKING_ID" &&
          !envVars.googleAnalyticsId
        ) {
          envVars.googleAnalyticsId = value;
        }
      }
    } catch (error) {
      console.warn("⚠️  Warning: Could not read .env.local:", error.message);
    }
  }
}

const envContent = `/**
 * Production Environment Configuration (Generated)
 * DO NOT EDIT - This file is auto-generated from environment variables
 */

export const environment = {
  production: true,
  gbifApiUrl: 'https://api.gbif.org/v1',
  enableDebugLogging: false,
  enablePerformanceMonitoring: true,
  enableAnalytics: true,
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
  sentryDsn: '${envVars.sentryDsn}',
  sentryEnvironment: 'production',
  sentryTracesSampleRate: 0.1,
  sentryEnabled: ${!!envVars.sentryDsn},
  googleAnalyticsId: '${envVars.googleAnalyticsId}',
  analyticsEnabled: ${!!envVars.googleAnalyticsId},
  supabaseUrl: '${envVars.supabaseUrl}',
  supabaseAnonKey: '${envVars.supabaseAnonKey}',
  version: '1.0.0',
  buildDate: '${new Date().toISOString()}',
} as const;

export type Environment = typeof environment;
`;

const outputPath = join(
  process.cwd(),
  "src",
  "environments",
  "environment.prod.ts",
);
writeFileSync(outputPath, envContent, "utf-8");

// Detect deployment platform
const platform = process.env.VERCEL
  ? "Vercel"
  : process.env.NETLIFY
    ? "Netlify"
    : "Local";
console.log(
  `✅ Environment variables injected successfully (${platform} build)`,
);
console.log(`   Supabase URL: ${envVars.supabaseUrl ? "✓ Set" : "✗ Not set"}`);
console.log(
  `   Supabase Key: ${envVars.supabaseAnonKey ? "✓ Set" : "✗ Not set"}`,
);
console.log(`   Sentry DSN: ${envVars.sentryDsn ? "✓ Set" : "✗ Not set"}`);
console.log(
  `   GA Tracking: ${envVars.googleAnalyticsId ? "✓ Set" : "✗ Not set"}`,
);
