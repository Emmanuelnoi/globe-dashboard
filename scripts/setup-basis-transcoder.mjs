#!/usr/bin/env node

/**
 * Setup Basis Universal Transcoder
 *
 * Downloads and installs the Basis Universal WASM transcoder files
 * required for KTX2 texture loading in Three.js.
 *
 * Usage: node scripts/setup-basis-transcoder.mjs
 */

import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// Basis transcoder files from Three.js examples
const BASIS_FILES = [
  {
    name: "basis_transcoder.js",
    url: "https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/libs/basis/basis_transcoder.js",
  },
  {
    name: "basis_transcoder.wasm",
    url: "https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/libs/basis/basis_transcoder.wasm",
  },
];

const OUTPUT_DIR = join(PROJECT_ROOT, "public", "libs", "basis");

async function downloadFile(url, outputPath) {
  console.log(`  Downloading: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await writeFile(outputPath, Buffer.from(buffer));

  console.log(`  ✓ Saved: ${outputPath}`);
}

async function setup() {
  console.log("🔧 Setting up Basis Universal Transcoder...\n");

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}\n`);
  }

  // Download files
  for (const file of BASIS_FILES) {
    const outputPath = join(OUTPUT_DIR, file.name);

    if (existsSync(outputPath)) {
      console.log(`  ⏭️  Skipping (exists): ${file.name}`);
      continue;
    }

    await downloadFile(file.url, outputPath);
  }

  console.log("\n✅ Basis Universal Transcoder setup complete!");
  console.log("\n📝 Next steps:");
  console.log(
    "   1. Convert textures to KTX2 format using toktx or basisu CLI",
  );
  console.log("   2. Place .ktx2 files in public/textures/");
  console.log("   3. The texture loader will automatically use them\n");

  console.log("Example texture conversion:");
  console.log(
    "   npx ktx create --format UASTC --encode uastc input.jpg output.ktx2\n",
  );
}

setup().catch((error) => {
  console.error("❌ Setup failed:", error.message);
  process.exit(1);
});
