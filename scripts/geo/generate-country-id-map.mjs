#!/usr/bin/env node

/**
 * Country ID Map Generator
 *
 * Generates a GPU texture for instant country selection using color-encoded IDs
 * Output: country-id-map.png + country-id-lookup.json
 *
 * Usage: node scripts/geo/generate-country-id-map.mjs [options]
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas } from "canvas";
import * as topojson from "topojson-client";
import * as d3 from "d3-geo";

// Configuration
const DEFAULT_CONFIG = {
  resolution: "2048x1024",
  outputDir: "src/assets/geo",
  sourceData: "src/assets/geo/countries-110m.json",
  debug: false,
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case "--resolution":
        config.resolution = value;
        break;
      case "--output-dir":
        config.outputDir = value;
        break;
      case "--source":
        config.sourceData = value;
        break;
      case "--debug":
        config.debug = true;
        i--; // No value for debug flag
        break;
      default:
        if (flag?.startsWith("--")) {
          console.warn(`Unknown flag: ${flag}`);
        }
    }
  }

  return config;
}

/**
 * Parse resolution string to width/height
 */
function parseResolution(resolution) {
  const [width, height] = resolution.split("x").map(Number);
  if (!width || !height) {
    throw new Error(
      `Invalid resolution format: ${resolution}. Use WIDTHxHEIGHT (e.g., 2048x1024)`,
    );
  }
  return { width, height };
}

/**
 * Encode country index to RGB color
 */
function encodeCountryId(index) {
  if (index > 0xffffff) {
    throw new Error(`Country index ${index} exceeds 24-bit color space`);
  }

  const r = (index >> 16) & 0xff;
  const g = (index >> 8) & 0xff;
  const b = index & 0xff;

  return {
    r,
    g,
    b,
    hex: `#${index.toString(16).padStart(6, "0")}`,
    css: `rgb(${r}, ${g}, ${b})`,
  };
}

/**
 * Setup equirectangular projection
 */
function createProjection(width, height) {
  return d3
    .geoEquirectangular()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2])
    .precision(0.1);
}

/**
 * Load and validate TopoJSON data
 */
async function loadGeographicData(sourcePath) {
  try {
    const data = JSON.parse(await fs.readFile(sourcePath, "utf8"));

    if (!data.objects || !data.objects.countries) {
      throw new Error("Invalid TopoJSON: missing countries object");
    }

    const countries = topojson.feature(data, data.objects.countries);
    console.log(
      `✅ Loaded ${countries.features.length} countries from ${sourcePath}`,
    );

    return countries.features;
  } catch (error) {
    throw new Error(`Failed to load geographic data: ${error.message}`);
  }
}

/**
 * Validate and prepare country features
 */
function prepareCountryFeatures(features) {
  const validFeatures = [];
  const countryLookup = new Map();

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];

    // Validate required properties
    if (!feature.properties?.NAME || !feature.geometry) {
      console.warn(`⚠️  Skipping feature ${i}: missing name or geometry`);
      continue;
    }

    const countryName = feature.properties.NAME;
    const countryCode =
      feature.properties.ISO_A3 || feature.properties.ADM0_A3 || `UNK_${i}`;

    // Check for duplicates
    if (countryLookup.has(countryCode)) {
      console.warn(
        `⚠️  Duplicate country code ${countryCode} for ${countryName}`,
      );
      continue;
    }

    const countryId = feature.properties.ISO_A3 || countryCode;
    const index = validFeatures.length + 1; // Start from 1 (0 = background)
    const encodedColor = encodeCountryId(index);

    const processedFeature = {
      ...feature,
      countryId,
      index,
      encodedColor,
      name: countryName,
    };

    validFeatures.push(processedFeature);
    countryLookup.set(countryCode, processedFeature);
  }

  console.log(`✅ Prepared ${validFeatures.length} valid country features`);
  return { features: validFeatures, lookup: countryLookup };
}

/**
 * Render country ID map to canvas
 */
function renderCountryIdMap(features, width, height, debug = false) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Set background to black (index 0)
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);

  const projection = createProjection(width, height);
  const pathGenerator = d3.geoPath().projection(projection).context(ctx);

  console.log(
    `🎨 Rendering ${features.length} countries to ${width}x${height} canvas...`,
  );

  let renderedCount = 0;
  let skippedCount = 0;

  for (const feature of features) {
    try {
      // Handle antimeridian crossing and complex geometries
      const geometry = feature.geometry;

      if (!geometry || geometry.coordinates.length === 0) {
        console.warn(`⚠️  Skipping ${feature.name}: empty geometry`);
        skippedCount++;
        continue;
      }

      // Set fill color to encoded country ID
      ctx.fillStyle = feature.encodedColor.css;
      ctx.strokeStyle = "none";
      ctx.lineWidth = 0;

      // Begin path and render
      ctx.beginPath();
      pathGenerator(feature);
      ctx.fill();

      renderedCount++;

      if (debug && renderedCount % 50 === 0) {
        console.log(`  📍 Rendered ${renderedCount} countries...`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to render ${feature.name}: ${error.message}`);
      skippedCount++;
    }
  }

  console.log(
    `✅ Rendered ${renderedCount} countries (${skippedCount} skipped)`,
  );

  // Debug: Add border grid
  if (debug) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;

    // Longitude lines every 30 degrees
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = ((lon + 180) / 360) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Latitude lines every 30 degrees
    for (let lat = -90; lat <= 90; lat += 30) {
      const y = ((90 - lat) / 180) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  return canvas;
}

/**
 * Generate country lookup JSON
 */
function generateCountryLookup(features) {
  const lookup = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalCountries: features.length,
      encoding: "24-bit RGB",
      format: "equirectangular",
    },
    countries: {},
  };

  for (const feature of features) {
    lookup.countries[feature.countryId] = {
      name: feature.name,
      index: feature.index,
      encodedColor: feature.encodedColor,
      properties: {
        iso_a3: feature.properties.ISO_A3,
        name_long: feature.properties.NAME_LONG,
        continent: feature.properties.CONTINENT,
        region: feature.properties.REGION_UN,
        subregion: feature.properties.SUBREGION,
      },
    };
  }

  return lookup;
}

/**
 * Validate output directory and create if needed
 */
async function ensureOutputDirectory(outputDir) {
  try {
    await fs.access(outputDir);
  } catch {
    console.log(`📁 Creating output directory: ${outputDir}`);
    await fs.mkdir(outputDir, { recursive: true });
  }
}

/**
 * Save canvas as PNG
 */
async function saveCanvas(canvas, filePath) {
  const buffer = canvas.toBuffer("image/png");
  await fs.writeFile(filePath, buffer);

  const sizeKB = Math.round(buffer.length / 1024);
  console.log(`💾 Saved PNG: ${filePath} (${sizeKB}KB)`);
}

/**
 * Save lookup JSON
 */
async function saveLookupJson(lookup, filePath) {
  const json = JSON.stringify(lookup, null, 2);
  await fs.writeFile(filePath, json, "utf8");

  const sizeKB = Math.round(json.length / 1024);
  console.log(`💾 Saved JSON: ${filePath} (${sizeKB}KB)`);
}

/**
 * Main execution
 */
async function main() {
  console.log("🌍 Country ID Map Generator");
  console.log("============================");

  try {
    // Parse configuration
    const config = parseArgs();
    const { width, height } = parseResolution(config.resolution);

    console.log(`📋 Configuration:
  Resolution: ${width}x${height}
  Output Dir: ${config.outputDir}
  Source Data: ${config.sourceData}
  Debug Mode: ${config.debug}`);

    // Load and prepare data
    const features = await loadGeographicData(config.sourceData);
    const { features: preparedFeatures } = prepareCountryFeatures(features);

    // Validate we don't exceed color space
    if (preparedFeatures.length > 0xffffff) {
      throw new Error(
        `Too many countries (${preparedFeatures.length}). Maximum: ${0xffffff}`,
      );
    }

    // Render country ID map
    const canvas = renderCountryIdMap(
      preparedFeatures,
      width,
      height,
      config.debug,
    );

    // Generate lookup data
    const lookup = generateCountryLookup(preparedFeatures);

    // Ensure output directory exists
    await ensureOutputDirectory(config.outputDir);

    // Save outputs
    const pngPath = path.join(config.outputDir, "country-id-map.png");
    const jsonPath = path.join(config.outputDir, "country-id-lookup.json");

    await saveCanvas(canvas, pngPath);
    await saveLookupJson(lookup, jsonPath);

    console.log(`
✅ Country ID Map Generation Complete!
📊 Statistics:
  - Countries processed: ${preparedFeatures.length}
  - Texture resolution: ${width}x${height}
  - Color encoding: 24-bit RGB
  - Output files:
    🖼️  ${pngPath}
    📄 ${jsonPath}

🚀 Integration:
  1. Import these assets in your Angular app
  2. Load as THREE.Texture with NEAREST filtering
  3. Use lookup JSON for ID/color mapping
    `);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

export { main as generateCountryIdMap };
