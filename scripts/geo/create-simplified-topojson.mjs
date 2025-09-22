#!/usr/bin/env node

import fs from "fs";
import path from "path";
import topoServerPkg from "topojson-server";
import topoClientPkg from "topojson-client";
const { topology, quantize, simplify } = topoServerPkg;
const { feature } = topoClientPkg;

console.log("🌍 Creating simplified TopoJSON from existing data...");

const sourceFile = "dist/global-dashboard/browser/data/world.topo.json";
const outputFile =
  "dist/global-dashboard/browser/data/world-simplified.topo.json";
const publicOutputFile = "public/data/world-simplified.topo.json";

try {
  // Read existing TopoJSON
  const sourceData = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
  console.log(
    `📂 Loaded source: ${(fs.statSync(sourceFile).size / 1024 / 1024).toFixed(2)}MB`,
  );

  // Convert to GeoJSON, simplify, then back to TopoJSON
  const geojson = feature(sourceData, sourceData.objects.countries);
  console.log(`🗺️  Original features: ${geojson.features.length}`);

  // Create simplified topology with aggressive compression
  let simplified = topology({ countries: geojson });

  // Apply simplification (removes unnecessary points) - quantize not available in this version
  if (typeof simplify === "function") {
    simplified = simplify(simplified, 0.02); // Aggressive simplification
    console.log("🔧 Applied geometry simplification");
  } else {
    console.log("⚠️  Simplification not available, using basic compression");
  }

  // Remove unnecessary properties to reduce size
  if (simplified.objects.countries.geometries) {
    simplified.objects.countries.geometries.forEach((geometry) => {
      if (geometry.properties) {
        // Keep only essential properties
        const essential = {
          NAME: geometry.properties.NAME,
          ISO_A3: geometry.properties.ISO_A3,
          ISO_A2: geometry.properties.ISO_A2,
        };
        geometry.properties = essential;
      }
    });
  }

  // Write simplified file
  const simplifiedContent = JSON.stringify(simplified);
  fs.writeFileSync(outputFile, simplifiedContent);

  // Also copy to public directory for development server
  fs.writeFileSync(publicOutputFile, simplifiedContent);

  const originalSize = fs.statSync(sourceFile).size;
  const simplifiedSize = fs.statSync(outputFile).size;
  const reduction = (
    ((originalSize - simplifiedSize) / originalSize) *
    100
  ).toFixed(1);

  console.log(`✅ Simplified TopoJSON created:`);
  console.log(`   Original: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   Simplified: ${(simplifiedSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   Reduction: ${reduction}%`);
  console.log(`   📁 Copied to: ${publicOutputFile}`);
} catch (error) {
  console.error("❌ Failed to create simplified TopoJSON:", error.message);
  process.exit(1);
}
