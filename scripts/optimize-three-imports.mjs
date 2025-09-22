#!/usr/bin/env node

/**
 * Three.js Import Optimization Script
 *
 * This script analyzes Three.js imports across the codebase and provides
 * recommendations for optimization. It identifies unused imports and
 * suggests tree-shaking improvements.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

class ThreeJSOptimizer {
  constructor() {
    this.threeImports = new Map();
    this.usageAnalysis = new Map();
    this.sourceDir = "./src";
    this.totalFiles = 0;
    this.optimizedFiles = 0;
  }

  /**
   * Scan all TypeScript files for Three.js imports
   */
  scanDirectory(dirPath) {
    const files = readdirSync(dirPath);

    for (const file of files) {
      const fullPath = join(dirPath, file);
      const stat = statSync(fullPath);

      if (
        stat.isDirectory() &&
        !file.startsWith(".") &&
        file !== "node_modules"
      ) {
        this.scanDirectory(fullPath);
      } else if (extname(file) === ".ts" && !file.includes(".d.ts")) {
        this.analyzeFile(fullPath);
      }
    }
  }

  /**
   * Analyze a single file for Three.js imports and usage
   */
  analyzeFile(filePath) {
    this.totalFiles++;
    const content = readFileSync(filePath, "utf-8");

    // Find Three.js imports
    const threeImportRegex = /import\s*{([^}]+)}\s*from\s*['"]three['"]/g;
    const threeMatches = [...content.matchAll(threeImportRegex)];

    if (threeMatches.length > 0) {
      console.log(`\n📁 Analyzing: ${filePath}`);

      for (const match of threeMatches) {
        const imports = match[1]
          .split(",")
          .map((imp) => imp.trim())
          .filter((imp) => imp.length > 0);

        console.log(`  📦 Imports: ${imports.join(", ")}`);

        // Analyze usage of each import
        for (const importName of imports) {
          const usageCount = this.countUsage(content, importName);
          console.log(`    • ${importName}: ${usageCount} usage(s)`);

          if (!this.usageAnalysis.has(importName)) {
            this.usageAnalysis.set(importName, { files: [], totalUsage: 0 });
          }

          const analysis = this.usageAnalysis.get(importName);
          analysis.files.push({ filePath, usage: usageCount });
          analysis.totalUsage += usageCount;
        }

        this.threeImports.set(filePath, imports);
      }
    }
  }

  /**
   * Count usage occurrences of an import in file content
   */
  countUsage(content, importName) {
    // Remove the import statement to avoid false positives
    const contentWithoutImports = content.replace(
      /import\s*{[^}]+}\s*from\s*['"][^'"]+['"]/g,
      "",
    );

    // Count occurrences (simple word boundary matching)
    const regex = new RegExp(`\\b${importName}\\b`, "g");
    const matches = contentWithoutImports.match(regex);
    return matches ? matches.length : 0;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    console.log("\n🎯 OPTIMIZATION ANALYSIS");
    console.log("========================\n");

    console.log(`📊 Files scanned: ${this.totalFiles}`);
    console.log(`📦 Files with Three.js imports: ${this.threeImports.size}\n`);

    // Most used imports
    const sortedByUsage = [...this.usageAnalysis.entries()].sort(
      (a, b) => b[1].totalUsage - a[1].totalUsage,
    );

    console.log("🔥 Most Used Three.js Imports:");
    sortedByUsage.slice(0, 10).forEach(([name, data]) => {
      console.log(
        `  • ${name}: ${data.totalUsage} total uses across ${data.files.length} files`,
      );
    });

    // Unused or rarely used imports
    console.log("\n⚠️  Potentially Unused/Rarely Used Imports:");
    const unusedImports = sortedByUsage.filter(
      ([, data]) => data.totalUsage <= 2,
    );

    if (unusedImports.length > 0) {
      unusedImports.forEach(([name, data]) => {
        console.log(
          `  • ${name}: ${data.totalUsage} uses in ${data.files.length} files`,
        );
        data.files.forEach((file) => {
          if (file.usage === 0) {
            console.log(`    ❌ Unused in: ${file.filePath}`);
          }
        });
      });
    } else {
      console.log("  ✅ No unused imports detected");
    }

    // Bundle optimization potential
    this.calculateOptimizationPotential();
  }

  /**
   * Calculate potential bundle size reduction
   */
  calculateOptimizationPotential() {
    console.log("\n📦 Bundle Optimization Potential:");

    const uniqueImports = new Set(this.usageAnalysis.keys());
    const totalImports = uniqueImports.size;

    // Estimate current Three.js usage
    const coreImports = [
      "Scene",
      "PerspectiveCamera",
      "WebGLRenderer",
      "Mesh",
      "Group",
    ];
    const geometryImports = [...uniqueImports].filter((imp) =>
      imp.includes("Geometry"),
    );
    const materialImports = [...uniqueImports].filter((imp) =>
      imp.includes("Material"),
    );
    const lightImports = [...uniqueImports].filter((imp) =>
      imp.includes("Light"),
    );
    const controlImports = [...uniqueImports].filter((imp) =>
      imp.includes("Control"),
    );

    console.log(`  📋 Total unique imports: ${totalImports}`);
    console.log(
      `  🏗️  Core imports: ${coreImports.filter((imp) => uniqueImports.has(imp)).length}/${coreImports.length}`,
    );
    console.log(`  🔺 Geometry imports: ${geometryImports.length}`);
    console.log(`  🎨 Material imports: ${materialImports.length}`);
    console.log(`  💡 Light imports: ${lightImports.length}`);
    console.log(`  🎮 Control imports: ${controlImports.length}`);

    // Optimization recommendations
    console.log("\n💡 Optimization Recommendations:");
    console.log("  1. ✅ Use selective imports from three-optimized.ts");
    console.log(
      "  2. 🔄 Replace full Three.js imports with specific module imports",
    );
    console.log("  3. 📦 Enable tree-shaking in build configuration");
    console.log("  4. 🧹 Remove unused imports to reduce bundle size");

    const estimatedReduction = Math.min(60, (totalImports / 100) * 40);
    console.log(
      `  📊 Estimated bundle size reduction: ~${estimatedReduction.toFixed(1)}%`,
    );

    // Specific optimization suggestions
    this.generateSpecificOptimizations();
  }

  /**
   * Generate specific optimization suggestions
   */
  generateSpecificOptimizations() {
    console.log("\n🔧 Specific Optimizations:");

    const optimizations = [
      {
        name: "Replace full Three.js imports",
        description: "Use @lib/three-optimized for commonly used imports",
        impact: "High",
        effort: "Low",
      },
      {
        name: "Lazy load less common Three.js modules",
        description: "Dynamically import rarely used Three.js components",
        impact: "Medium",
        effort: "Medium",
      },
      {
        name: "Split Three.js into chunks",
        description:
          "Separate geometry, materials, and utilities into different chunks",
        impact: "Medium",
        effort: "High",
      },
      {
        name: "Use Three.js alternatives for simple operations",
        description:
          "Replace Three.js Vector2/Vector3 with lightweight alternatives where possible",
        impact: "Low",
        effort: "High",
      },
    ];

    optimizations.forEach((opt, index) => {
      console.log(`  ${index + 1}. ${opt.name}`);
      console.log(`     📝 ${opt.description}`);
      console.log(
        `     📈 Impact: ${opt.impact} | 🛠️  Effort: ${opt.effort}\n`,
      );
    });
  }

  /**
   * Run the complete analysis
   */
  run() {
    console.log("🔍 Three.js Import Optimization Analysis");
    console.log("========================================\n");

    this.scanDirectory(this.sourceDir);
    this.generateRecommendations();

    console.log("\n✅ Analysis complete!");
    console.log("\nNext steps:");
    console.log("1. Review the three-optimized.ts module");
    console.log("2. Replace Three.js imports with optimized imports");
    console.log("3. Test the application to ensure functionality");
    console.log("4. Measure bundle size reduction");
  }
}

// Run the optimizer
const optimizer = new ThreeJSOptimizer();
optimizer.run();
