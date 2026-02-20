/**
 * 🎯 Performance Test Script for Render-on-Demand Optimization
 *
 * Instructions:
 * 1. Open http://localhost:4200 in Chrome
 * 2. Open DevTools (F12) → Console tab
 * 3. Paste this entire script and press Enter
 * 4. Follow the on-screen instructions
 */

(function () {
  console.clear();
  console.log(
    "%c🎯 RENDER-ON-DEMAND PERFORMANCE TEST",
    "color: #00ff88; font-size: 20px; font-weight: bold",
  );
  console.log("%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "color: #00ff88");

  // Test state
  const state = {
    frames: 0,
    renders: 0,
    lastTime: performance.now(),
    testResults: [],
    isMonitoring: false,
  };

  // Hook into rendering to count actual renders
  let renderingDetected = false;
  const canvas = document.querySelector("canvas");

  if (!canvas) {
    console.error("❌ Canvas not found! Make sure the globe is loaded.");
    return;
  }

  // Monitor WebGL rendering
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (gl) {
    const originalDrawArrays = gl.drawArrays;
    const originalDrawElements = gl.drawElements;

    gl.drawArrays = function (...args) {
      state.renders++;
      renderingDetected = true;
      return originalDrawArrays.apply(this, args);
    };

    gl.drawElements = function (...args) {
      state.renders++;
      renderingDetected = true;
      return originalDrawElements.apply(this, args);
    };
  }

  // Frame counter
  let animFrameId;
  function countFrame() {
    state.frames++;
    animFrameId = requestAnimationFrame(countFrame);
  }
  countFrame();

  // Performance monitor
  function updateStats() {
    const now = performance.now();
    const elapsed = now - state.lastTime;

    if (elapsed >= 1000) {
      const fps = Math.round((state.frames * 1000) / elapsed);
      const rps = Math.round((state.renders * 1000) / elapsed);

      console.log(
        `%c📊 FPS: ${fps}/60 | Renders: ${rps}/sec | ${renderingDetected ? "🟢 RENDERING" : "⚪ IDLE"}`,
        `color: ${fps > 0 ? "#ffaa00" : "#00ff88"}; font-weight: bold`,
      );

      if (performance.memory) {
        const memMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
        console.log(`💾 Memory: ${memMB} MB`);
      }

      state.frames = 0;
      state.renders = 0;
      state.lastTime = now;
      renderingDetected = false;
    }
  }

  // Start monitoring
  const monitorInterval = setInterval(updateStats, 100);

  // Test functions
  const tests = {
    async testIdleState() {
      console.log(
        "\n%c━━━ TEST 1: Idle State (Render-on-Demand) ━━━",
        "color: #0088ff; font-weight: bold",
      );
      console.log("⏱️  Monitoring for 5 seconds while idle...");
      console.log("🎯 EXPECTED: FPS should be 0, no rendering");

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const fps = Math.round((state.frames * 1000) / 5000);
      const success = fps === 0;

      if (success) {
        console.log(
          "%c✅ PASS: No continuous rendering when idle (FPS = 0)",
          "color: #00ff00; font-weight: bold",
        );
      } else {
        console.log(
          `%c❌ FAIL: Still rendering when idle (FPS = ${fps})`,
          "color: #ff0000; font-weight: bold",
        );
      }

      state.testResults.push({ test: "Idle State", success, fps });
      return success;
    },

    async testCameraMovement() {
      console.log(
        "\n%c━━━ TEST 2: Camera Movement ━━━",
        "color: #0088ff; font-weight: bold",
      );
      console.log("🖱️  Please ROTATE the globe now...");
      console.log(
        "🎯 EXPECTED: FPS = 60 while moving, then drops to 0 when stopped",
      );
      console.log("⏱️  Monitoring for 5 seconds...");

      await new Promise((resolve) => setTimeout(resolve, 5000));

      console.log("%cℹ️  Manual verification required", "color: #ffaa00");
      console.log("   Did the globe rotate smoothly? (Y/N)");
      console.log("   Did rendering stop after you stopped moving? (Y/N)");

      state.testResults.push({
        test: "Camera Movement",
        success: null,
        manual: true,
      });
    },

    async testCountryClick() {
      console.log(
        "\n%c━━━ TEST 3: Country Clicking ━━━",
        "color: #0088ff; font-weight: bold",
      );
      console.log("🖱️  Please CLICK on a country now...");
      console.log("🎯 EXPECTED: Brief render, then stops");
      console.log("⏱️  Monitoring for 3 seconds...");

      await new Promise((resolve) => setTimeout(resolve, 3000));

      console.log("%cℹ️  Manual verification required", "color: #ffaa00");
      console.log("   Did the country highlight appear? (Y/N)");
      console.log("   Did rendering stop after highlighting? (Y/N)");

      state.testResults.push({
        test: "Country Click",
        success: null,
        manual: true,
      });
    },

    async testMigrationAnimations() {
      console.log(
        "\n%c━━━ TEST 4: Migration Animations ━━━",
        "color: #0088ff; font-weight: bold",
      );
      console.log("🐦 This test requires manual navigation:");
      console.log('   1. Click "Bird Migration" in the nav');
      console.log("   2. Select a migration path");
      console.log("   3. Observe continuous rendering (FPS = 60)");
      console.log("   4. Clear all migrations");
      console.log("   5. Observe rendering stops (FPS = 0)");
      console.log("\n⏸️  Test paused - press Enter when ready to verify...");

      state.testResults.push({
        test: "Migration Animations",
        success: null,
        manual: true,
      });
    },

    showResults() {
      console.log(
        "\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "color: #00ff88",
      );
      console.log(
        "%c📋 TEST RESULTS SUMMARY",
        "color: #00ff88; font-size: 18px; font-weight: bold",
      );
      console.log(
        "%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "color: #00ff88",
      );

      state.testResults.forEach((result, i) => {
        const icon =
          result.success === true
            ? "✅"
            : result.success === false
              ? "❌"
              : "ℹ️";
        const color =
          result.success === true
            ? "#00ff00"
            : result.success === false
              ? "#ff0000"
              : "#ffaa00";
        console.log(
          `%c${icon} Test ${i + 1}: ${result.test}`,
          `color: ${color}; font-weight: bold`,
        );
        if (result.fps !== undefined) {
          console.log(`   FPS: ${result.fps}`);
        }
        if (result.manual) {
          console.log("   (Manual verification required)");
        }
      });

      console.log(
        "\n%c🎯 OPTIMIZATION STATUS:",
        "color: #00ff88; font-weight: bold",
      );
      const automated = state.testResults.filter((r) => !r.manual);
      const passed = automated.filter((r) => r.success).length;

      if (passed === automated.length && automated.length > 0) {
        console.log(
          "%c✅ All automated tests PASSED!",
          "color: #00ff00; font-size: 16px; font-weight: bold",
        );
        console.log("   GPU usage should drop by 80-90% when idle");
        console.log("   Fan noise should be minimal or silent");
      } else {
        console.log(
          "%c⚠️  Some tests need attention",
          "color: #ffaa00; font-size: 16px; font-weight: bold",
        );
      }

      console.log(
        "\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "color: #00ff88",
      );
    },
  };

  // Export test controls to window
  window.perfTest = {
    runTest1: tests.testIdleState,
    runTest2: tests.testCameraMovement,
    runTest3: tests.testCountryClick,
    runTest4: tests.testMigrationAnimations,
    showResults: tests.showResults,

    async runAll() {
      console.log(
        "%c🚀 Running all tests...",
        "color: #00ff88; font-size: 16px; font-weight: bold",
      );
      await tests.testIdleState();
      await tests.testCameraMovement();
      await tests.testCountryClick();
      await tests.testMigrationAnimations();
      tests.showResults();
    },

    stop() {
      clearInterval(monitorInterval);
      cancelAnimationFrame(animFrameId);
      console.log(
        "%c⏸️  Monitoring stopped",
        "color: #ffaa00; font-weight: bold",
      );
    },

    getStats() {
      return {
        frames: state.frames,
        renders: state.renders,
        results: state.testResults,
      };
    },
  };

  // Initial instructions
  console.log("\n%c📖 INSTRUCTIONS:", "color: #00ff88; font-weight: bold");
  console.log("%cRun individual tests:", "color: #66ccff");
  console.log("  perfTest.runTest1()  - Test idle state (automated)");
  console.log("  perfTest.runTest2()  - Test camera movement");
  console.log("  perfTest.runTest3()  - Test country clicking");
  console.log("  perfTest.runTest4()  - Test migration animations");
  console.log("\n%cOr run all tests:", "color: #66ccff");
  console.log("  perfTest.runAll()");
  console.log("\n%cView results:", "color: #66ccff");
  console.log("  perfTest.showResults()");
  console.log("\n%cStop monitoring:", "color: #66ccff");
  console.log("  perfTest.stop()");

  console.log(
    "\n%c✅ Monitoring started! Stats will appear every second.",
    "color: #00ff00; font-weight: bold",
  );
  console.log(
    '%c💡 TIP: Watch for "⚪ IDLE" vs "🟢 RENDERING" status',
    "color: #ffaa00",
  );
  console.log("\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "color: #00ff88");
})();
