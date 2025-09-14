#!/usr/bin/env node

/**
 * Simple test script for TopoJSON functionality
 * This validates the core TopoJSON functions work correctly
 */

import {
  lonLatToSphere,
  createUnifiedBorderGeometry,
  createCountrySelectionMeshes,
  createInteractiveCountriesFromTopo,
  disposeTopoJSONMeshes,
} from "./src/lib/utils/geojson.utils.js";

// Mock TopoJSON data for testing
const mockTopology = {
  type: "Topology",
  arcs: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ], // Simple square
    [
      [2, 0],
      [3, 0],
      [3, 1],
      [2, 1],
      [2, 0],
    ], // Another square
  ],
  objects: {
    countries: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "TEST1",
          properties: { NAME: "Test Country 1" },
          geometry: {
            type: "Polygon",
            arcs: [[0]],
          },
        },
        {
          type: "Feature",
          id: "TEST2",
          properties: { NAME: "Test Country 2" },
          geometry: {
            type: "Polygon",
            arcs: [[1]],
          },
        },
      ],
    },
  },
};

console.log("🧪 Testing TopoJSON functionality...\n");

// Test 1: Coordinate conversion
console.log("1. Testing coordinate conversion...");
try {
  const point = lonLatToSphere(0, 0, 2);
  console.log(
    `✅ lonLatToSphere: (0,0) -> (${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)})`,
  );
} catch (error) {
  console.error("❌ lonLatToSphere failed:", error.message);
}

// Test 2: Unified border geometry creation
console.log("\n2. Testing unified border geometry creation...");
try {
  const result = createUnifiedBorderGeometry(mockTopology);
  console.log(
    `✅ createUnifiedBorderGeometry: ${result.countryCount} countries, ${result.arcCount} arcs`,
  );
  console.log(`   Border mesh: ${result.borderMesh.name}`);
  console.log(
    `   Selection meshes: ${result.selectionMeshes.children.length} children`,
  );
} catch (error) {
  console.error("❌ createUnifiedBorderGeometry failed:", error.message);
}

// Test 3: Country selection meshes
console.log("\n3. Testing country selection meshes...");
try {
  const selectionMeshes = createCountrySelectionMeshes(mockTopology);
  console.log(
    `✅ createCountrySelectionMeshes: ${selectionMeshes.children.length} selection meshes`,
  );
} catch (error) {
  console.error("❌ createCountrySelectionMeshes failed:", error.message);
}

// Test 4: Complete interactive countries creation
console.log("\n4. Testing complete interactive countries creation...");
try {
  const interactiveCountries = createInteractiveCountriesFromTopo(mockTopology);
  console.log(
    `✅ createInteractiveCountriesFromTopo: ${interactiveCountries.name}`,
  );
  console.log(`   Children: ${interactiveCountries.children.length}`);
  console.log(
    `   Rendering mode: ${interactiveCountries.userData.renderingMode}`,
  );

  // Test cleanup
  disposeTopoJSONMeshes(interactiveCountries);
  console.log(`✅ disposeTopoJSONMeshes: Cleanup successful`);
} catch (error) {
  console.error("❌ createInteractiveCountriesFromTopo failed:", error.message);
}

console.log("\n🎉 TopoJSON functionality tests completed!");
