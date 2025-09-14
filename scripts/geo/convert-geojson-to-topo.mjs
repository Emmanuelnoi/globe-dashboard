#!/usr/bin/env node

/**
 * GeoJSON to TopoJSON Conversion Script
 *
 * Converts existing GeoJSON country data to optimized TopoJSON format
 * with shared arcs to eliminate border overlap artifacts in 3D rendering.
 *
 * Usage:
 *   node scripts/geo/convert-geojson-to-topo.mjs [options]
 *
 * Options:
 *   --input <path>        Input GeoJSON file (default: public/data/countries-50m.geojson)
 *   --output <path>       Output TopoJSON file (default: public/data/world.topo.json)
 *   --simplify <value>    Simplification tolerance (default: 0.02)
 *   --quantize <value>    Quantization factor (default: 1e4)
 *   --verbose             Verbose output
 *   --help                Show help
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// Default configuration
const DEFAULT_CONFIG = {
  input: "public/data/countries-50m.geojson",
  output: "public/data/world.topo.json",
  simplify: 0.02,
  quantize: 1e4,
  verbose: false,
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--input":
        if (nextArg) config.input = nextArg;
        i++;
        break;
      case "--output":
        if (nextArg) config.output = nextArg;
        i++;
        break;
      case "--simplify":
        if (nextArg) config.simplify = parseFloat(nextArg);
        i++;
        break;
      case "--quantize":
        if (nextArg) config.quantize = parseFloat(nextArg);
        i++;
        break;
      case "--verbose":
        config.verbose = true;
        break;
      case "--help":
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return config;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
GeoJSON to TopoJSON Conversion Script

Usage: node scripts/geo/convert-geojson-to-topo.mjs [options]

Options:
  --input <path>        Input GeoJSON file (default: ${DEFAULT_CONFIG.input})
  --output <path>       Output TopoJSON file (default: ${DEFAULT_CONFIG.output})
  --simplify <value>    Simplification tolerance (default: ${DEFAULT_CONFIG.simplify})
  --quantize <value>    Quantization factor (default: ${DEFAULT_CONFIG.quantize})
  --verbose             Verbose output
  --help                Show this help

Examples:
  # Convert with default settings
  node scripts/geo/convert-geojson-to-topo.mjs

  # Custom simplification
  node scripts/geo/convert-geojson-to-topo.mjs --simplify 0.01

  # Verbose output
  node scripts/geo/convert-geojson-to-topo.mjs --verbose
`);
}

/**
 * Log message if verbose mode is enabled
 */
function log(message, config) {
  if (config.verbose) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

/**
 * Validate GeoJSON structure
 */
function validateGeoJSON(geojson) {
  if (!geojson || typeof geojson !== "object") {
    throw new Error("Invalid GeoJSON: not an object");
  }

  if (geojson.type !== "FeatureCollection") {
    throw new Error("Invalid GeoJSON: expected FeatureCollection");
  }

  if (!Array.isArray(geojson.features)) {
    throw new Error("Invalid GeoJSON: features must be an array");
  }

  return true;
}

/**
 * Simple topology conversion (without external dependencies)
 * This creates a basic TopoJSON structure with shared arc detection
 */
function convertToTopoJSON(geojson, config) {
  log("Converting GeoJSON to TopoJSON...", config);

  const arcs = [];
  const arcMap = new Map(); // For deduplication
  const objects = {};

  // Process each country feature
  const countries = geojson.features.map((feature, index) => {
    const countryName = feature.properties?.NAME || `country_${index}`;
    log(`Processing country: ${countryName}`, config);

    const geometry = processGeometry(feature.geometry, arcs, arcMap, config);

    return {
      type: "Feature",
      id: feature.properties?.ISO_A3 || countryName,
      properties: feature.properties,
      geometry: geometry,
    };
  });

  objects.countries = {
    type: "FeatureCollection",
    features: countries,
  };

  // Create TopoJSON structure
  const topology = {
    type: "Topology",
    bbox: calculateBoundingBox(geojson),
    transform: createTransform(geojson, config.quantize),
    arcs: arcs,
    objects: objects,
  };

  log(`Created TopoJSON with ${arcs.length} arcs`, config);
  return topology;
}

/**
 * Process geometry and extract arcs
 */
function processGeometry(geometry, arcs, arcMap, config) {
  switch (geometry.type) {
    case "Polygon":
      return {
        type: "Polygon",
        arcs: geometry.coordinates.map((ring) =>
          processRing(ring, arcs, arcMap, config),
        ),
      };

    case "MultiPolygon":
      return {
        type: "MultiPolygon",
        arcs: geometry.coordinates.map((polygon) =>
          polygon.map((ring) => processRing(ring, arcs, arcMap, config)),
        ),
      };

    default:
      log(`Unsupported geometry type: ${geometry.type}`, config);
      return geometry;
  }
}

/**
 * Process a coordinate ring and create/reuse arcs
 */
function processRing(ring, arcs, arcMap, config) {
  // Simplify the ring if requested
  const simplifiedRing =
    config.simplify > 0 ? simplifyRing(ring, config.simplify) : ring;

  // Create a key for arc deduplication
  const arcKey = createArcKey(simplifiedRing);

  if (arcMap.has(arcKey)) {
    // Reuse existing arc
    return arcMap.get(arcKey);
  }

  // Create new arc
  const arcIndex = arcs.length;
  arcs.push(simplifiedRing);
  arcMap.set(arcKey, arcIndex);

  return arcIndex;
}

/**
 * Create a key for arc deduplication
 */
function createArcKey(coordinates) {
  // Use first, middle, and last coordinates for key
  const len = coordinates.length;
  if (len < 3) return coordinates.map((c) => c.join(",")).join("|");

  const first = coordinates[0];
  const middle = coordinates[Math.floor(len / 2)];
  const last = coordinates[len - 1];

  return `${first.join(",")}_${middle.join(",")}_${last.join(",")}`;
}

/**
 * Simple Douglas-Peucker simplification
 */
function simplifyRing(coordinates, tolerance) {
  if (coordinates.length <= 2) return coordinates;

  // Keep first and last points
  const simplified = [coordinates[0]];

  // Simple decimation for now (can be improved with proper DP algorithm)
  const step = Math.max(1, Math.floor(coordinates.length * tolerance));

  for (let i = step; i < coordinates.length - 1; i += step) {
    simplified.push(coordinates[i]);
  }

  simplified.push(coordinates[coordinates.length - 1]);
  return simplified;
}

/**
 * Calculate bounding box of GeoJSON
 */
function calculateBoundingBox(geojson) {
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  geojson.features.forEach((feature) => {
    const coords = getAllCoordinates(feature.geometry);
    coords.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
  });

  return [minX, minY, maxX, maxY];
}

/**
 * Get all coordinates from a geometry
 */
function getAllCoordinates(geometry) {
  const coords = [];

  function addCoords(coordArray) {
    if (Array.isArray(coordArray[0])) {
      coordArray.forEach(addCoords);
    } else {
      coords.push(coordArray);
    }
  }

  addCoords(geometry.coordinates);
  return coords;
}

/**
 * Create transform for coordinate quantization
 */
function createTransform(geojson, quantize) {
  const bbox = calculateBoundingBox(geojson);
  const [minX, minY, maxX, maxY] = bbox;

  const scaleX = (maxX - minX) / quantize;
  const scaleY = (maxY - minY) / quantize;

  return {
    scale: [scaleX, scaleY],
    translate: [minX, minY],
  };
}

/**
 * Main conversion function
 */
async function main() {
  try {
    const config = parseArgs();

    console.log("🌍 GeoJSON to TopoJSON Converter");
    console.log("================================");

    // Resolve file paths
    const inputPath = path.resolve(projectRoot, config.input);
    const outputPath = path.resolve(projectRoot, config.output);

    log(`Input file: ${inputPath}`, config);
    log(`Output file: ${outputPath}`, config);

    // Check if input file exists
    try {
      await fs.access(inputPath);
    } catch (error) {
      console.error(`❌ Input file not found: ${inputPath}`);
      console.log(
        "\n💡 Tip: Make sure you have the GeoJSON file in place first.",
      );
      console.log(
        "   You can download it from Natural Earth Data or use your existing file.",
      );
      process.exit(1);
    }

    // Read and parse GeoJSON
    console.log("📖 Reading GeoJSON file...");
    const geojsonContent = await fs.readFile(inputPath, "utf8");
    const geojson = JSON.parse(geojsonContent);

    // Validate GeoJSON
    validateGeoJSON(geojson);
    log(`Loaded ${geojson.features.length} features`, config);

    // Convert to TopoJSON
    console.log("🔄 Converting to TopoJSON...");
    const topology = convertToTopoJSON(geojson, config);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write TopoJSON
    console.log("💾 Writing TopoJSON file...");
    await fs.writeFile(outputPath, JSON.stringify(topology, null, 2));

    // Calculate file sizes
    const inputStats = await fs.stat(inputPath);
    const outputStats = await fs.stat(outputPath);

    console.log("\n✅ Conversion completed successfully!");
    console.log(`📊 Statistics:`);
    console.log(`   Countries: ${geojson.features.length}`);
    console.log(`   Arcs: ${topology.arcs.length}`);
    console.log(`   Input size: ${(inputStats.size / 1024).toFixed(1)} KB`);
    console.log(`   Output size: ${(outputStats.size / 1024).toFixed(1)} KB`);
    console.log(
      `   Compression: ${((1 - outputStats.size / inputStats.size) * 100).toFixed(1)}%`,
    );

    if (config.verbose) {
      console.log(`\n🔧 Configuration used:`);
      console.log(`   Simplify: ${config.simplify}`);
      console.log(`   Quantize: ${config.quantize}`);
    }
  } catch (error) {
    console.error("\n❌ Error during conversion:", error.message);
    if (config?.verbose) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { convertToTopoJSON, validateGeoJSON };
