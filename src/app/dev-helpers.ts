/**
 * Development Helper Functions
 *
 * These functions make it easier to access Angular services from the browser console
 * for testing and debugging purposes.
 *
 * Usage in browser console:
 * ```javascript
 * // Access services
 * const { supabase, cloudSync, userStats } = getServices();
 *
 * // Test cloud sync
 * await cloudSync.syncToCloud();
 *
 * // Check auth status
 * console.log('Authenticated:', supabase.isAuthenticated());
 * ```
 */

import { SupabaseService } from './core/services/supabase.service';
import { CloudSyncService } from './core/services/cloud-sync.service';
import { UserStatsService } from './core/services/user-stats.service';

declare global {
  interface Window {
    getServices: () => {
      supabase: SupabaseService;
      cloudSync: CloudSyncService;
      userStats: UserStatsService;
    };
    testCloudSync: () => Promise<void>;
    checkAuthStatus: () => void;
    clearLocalData: () => Promise<void>;
    runFullDiagnostics: () => Promise<void>;
  }
}

/**
 * Get Angular services from the browser console
 */
export function getServices(): {
  supabase: SupabaseService;
  cloudSync: CloudSyncService;
  userStats: UserStatsService;
} {
  const appRoot = document.querySelector('app-root');
  if (!appRoot) {
    console.error('❌ App root not found. Make sure the app is loaded.');
    throw new Error('App root not found');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ng = (window as any).ng;
  if (!ng) {
    console.error(
      '❌ Angular devtools not available. Are you in development mode?',
    );
    throw new Error('Angular devtools not available');
  }

  // Try to get injector using Angular's debugging API
  let injector;

  try {
    // Method 1: Try getInjector if available
    if (ng.getInjector) {
      injector = ng.getInjector(appRoot);
    }
  } catch {
    // Ignore and try next method
  }

  if (!injector) {
    try {
      // Method 2: Get from context
      const context = ng.getContext(appRoot);
      if (context && context.injector) {
        injector = context.injector;
      }
    } catch {
      // Ignore and try next method
    }
  }

  if (!injector) {
    try {
      // Method 3: Get from component
      const component = ng.getComponent(appRoot);
      if (component) {
        // Try accessing injector through different paths
        injector =
          component.injector ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          (component as any).__ngContext__?.[0] ||
          ng.getOwningComponent?.(appRoot)?.injector;
      }
    } catch {
      // Ignore
    }
  }

  if (!injector) {
    console.error('❌ Could not get Angular injector.');
    console.error('💡 Try: ng.probe(document.querySelector("app-root"))');
    throw new Error('Could not get injector');
  }

  return {
    supabase: injector.get(SupabaseService),
    cloudSync: injector.get(CloudSyncService),
    userStats: injector.get(UserStatsService),
  };
}

/**
 * Test cloud sync functionality
 */
export async function testCloudSync(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('🧪 Testing Cloud Sync...\n');

  try {
    const { supabase, cloudSync, userStats } = getServices();

    // Check authentication
    console.log('1️⃣ Checking authentication...');
    const isAuth = supabase.isAuthenticated();
    const user = supabase.currentUser();
    console.log(`   ${isAuth ? '✅' : '❌'} Authenticated: ${isAuth}`);
    if (user) {
      console.log(`   👤 User: ${user.email}`);
    }

    if (!isAuth) {
      console.error('❌ User not authenticated. Please sign in first.');
      return;
    }

    // Get local stats
    console.log('\n2️⃣ Checking local data...');
    const stats = await userStats.getStats();
    const sessions = await userStats.getRecentSessions(10);
    console.log(`   📊 Total games: ${stats?.totalGames || 0}`);
    console.log(`   📝 Recent sessions: ${sessions.length}`);

    if (!stats || sessions.length === 0) {
      console.warn('⚠️ No local data found. Play some quiz games first!');
      return;
    }

    // Test sync to cloud
    console.log('\n3️⃣ Syncing to cloud...');
    await cloudSync.syncToCloud();

    const syncStatus = cloudSync.getSyncStatus();
    console.log(
      `   ${syncStatus.status === 'synced' ? '✅' : '❌'} Sync status: ${syncStatus.status}`,
    );
    if (syncStatus.error) {
      console.error(`   ❌ Error: ${syncStatus.error}`);
    } else {
      console.log('   ✅ Data successfully synced to cloud!');
      console.log(
        '\n📍 Next: Check Supabase Dashboard → Table Editor → quiz_sessions',
      );
    }

    // Show sync info
    console.log('\n4️⃣ Sync Information:');
    console.log(`   Last sync: ${syncStatus.lastSyncTime}`);
    console.log(`   Pending: ${syncStatus.pendingCount} items`);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Check authentication status
 */
export function checkAuthStatus(): void {
  console.log('🔐 Authentication Status:\n');

  try {
    const { supabase } = getServices();

    const isAuth = supabase.isAuthenticated();
    const user = supabase.currentUser();
    const session = supabase.currentSession();

    console.log(`✅ Authenticated: ${isAuth}`);
    if (user) {
      console.log(`\n👤 User Information:`);
      console.log(`   Email: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${user.created_at}`);
    }

    if (session) {
      console.log(`\n🔑 Session Information:`);
      console.log(
        `   Expires: ${new Date(session.expires_at! * 1000).toLocaleString()}`,
      );
    }

    if (!isAuth) {
      console.log('\n💡 To sign in:');
      console.log('   const { supabase } = getServices();');
      console.log('   await supabase.signIn("email", "password");');
    }
  } catch (error) {
    console.error('❌ Failed to check auth status:', error);
  }
}

/**
 * Clear local IndexedDB data (for testing sync from cloud)
 */
export async function clearLocalData(): Promise<void> {
  console.log('🗑️ Clearing local data...\n');

  try {
    const { userStats } = getServices();

    // Export backup first
    console.log('1️⃣ Creating backup...');
    const backup = await userStats.exportData();
    if (backup) {
      console.log(`   ✅ Backup created: ${backup.sessions.length} sessions`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__backup = backup; // Store in window for recovery
      console.log('   💾 Backup stored in window.__backup');
    }

    // Clear data
    console.log('\n2️⃣ Clearing data...');
    await userStats.clearAllData();
    console.log('   ✅ Local data cleared');

    // Verify
    console.log('\n3️⃣ Verifying...');
    const stats = await userStats.getStats();
    const sessions = await userStats.getRecentSessions();
    console.log(`   📊 Stats: ${stats ? 'NOT cleared!' : 'Cleared ✅'}`);
    console.log(`   📝 Sessions: ${sessions.length} (should be 0)`);

    if (!stats && sessions.length === 0) {
      console.log('\n✅ Local data successfully cleared!');
      console.log('\n💡 To restore from cloud:');
      console.log('   const { cloudSync } = getServices();');
      console.log('   await cloudSync.syncFromCloud();');
      console.log('\n💡 To restore from backup:');
      console.log('   const { userStats } = getServices();');
      console.log('   await userStats.importData(window.__backup);');
    }
  } catch (error) {
    console.error('❌ Failed to clear data:', error);
  }
}

/**
 * Run full diagnostic test suite
 */
export async function runFullDiagnostics(): Promise<void> {
  console.log('🔬 RUNNING FULL DIAGNOSTICS\n');
  console.log('='.repeat(60));

  try {
    const { supabase, cloudSync, userStats } = getServices();

    // Test 1: Authentication
    console.log('\n📋 TEST 1: Authentication Status');
    console.log('-'.repeat(60));
    const isAuth = supabase.isAuthenticated();
    const user = supabase.currentUser();
    console.log(
      `   Status: ${isAuth ? '✅ AUTHENTICATED' : '❌ NOT AUTHENTICATED'}`,
    );
    if (user) {
      console.log(`   Email: ${user.email}`);
      console.log(`   User ID: ${user.id}`);
    } else {
      console.error('   ❌ FAILED: No user session found');
      console.log('\n💡 Action: Please sign in using the UI first');
      return;
    }

    // Test 2: Local Data
    console.log('\n📋 TEST 2: Local Data Check');
    console.log('-'.repeat(60));
    const stats = await userStats.getStats();
    const sessions = await userStats.getRecentSessions(10);
    console.log(`   Total Games: ${stats?.totalGames || 0}`);
    console.log(`   Best Score: ${stats?.bestScore || 0}`);
    console.log(`   Average Score: ${stats?.averageScore?.toFixed(2) || 0}`);
    console.log(`   Recent Sessions: ${sessions.length}`);

    if (sessions.length > 0) {
      console.log('\n   📝 Session Details:');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sessions.slice(0, 3).forEach((session: any, i: number) => {
        console.log(
          `      ${i + 1}. Mode: ${session.configuration.mode}, Score: ${session.finalScore}, Questions: ${session.questions?.length || 0}`,
        );
      });
    }

    if (!stats || sessions.length === 0) {
      console.warn('   ⚠️ No local data found. Play some quiz games first!');
      return;
    }

    // Test 3: Cloud Sync Configuration
    console.log('\n📋 TEST 3: Cloud Sync Configuration');
    console.log('-'.repeat(60));
    const syncStatus = cloudSync.getSyncStatus();
    console.log(`   Sync Status: ${syncStatus.status}`);
    console.log(`   Is Authenticated: ${syncStatus.isAuthenticated}`);
    console.log(`   Pending Items: ${syncStatus.pendingCount}`);
    console.log(`   Last Sync: ${syncStatus.lastSyncTime || 'Never'}`);
    if (syncStatus.error) {
      console.error(`   ❌ Last Error: ${syncStatus.error}`);
    }

    // Test 4: Upload to Cloud
    console.log('\n📋 TEST 4: Uploading to Cloud');
    console.log('-'.repeat(60));
    console.log('   Starting upload...');

    try {
      await cloudSync.syncToCloud();
      const newStatus = cloudSync.getSyncStatus();

      if (newStatus.status === 'synced') {
        console.log('   ✅ SUCCESS: Data uploaded to cloud');
        console.log(`   Synced at: ${newStatus.lastSyncTime}`);
      } else if (newStatus.status === 'error') {
        console.error(`   ❌ FAILED: ${newStatus.error}`);
        console.log('\n   📊 Error Details:');
        console.log(`      Status: ${newStatus.status}`);
        console.log(`      Error: ${newStatus.error}`);
      } else {
        console.warn(`   ⚠️ Unexpected status: ${newStatus.status}`);
      }
    } catch (error) {
      console.error('   ❌ EXCEPTION during sync:', error);
      if (error instanceof Error) {
        console.error('      Message:', error.message);
        console.error('      Stack:', error.stack);
      }
    }

    // Test 5: Verify Upload Success
    console.log('\n📋 TEST 5: Verifying Upload');
    console.log('-'.repeat(60));
    console.log('   Checking if data exists in cloud...');

    try {
      const { data: cloudSessions, error: sessionsError } =
        await supabase.getQuizSessions(user.id, 5);

      if (sessionsError) {
        console.error(
          `   ❌ Failed to retrieve sessions: ${sessionsError.message}`,
        );
      } else if (cloudSessions && cloudSessions.length > 0) {
        console.log(`   ✅ Found ${cloudSessions.length} sessions in cloud`);
        console.log('\n   📝 Cloud Session Details:');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cloudSessions.forEach((session: any, i: number) => {
          console.log(
            `      ${i + 1}. Mode: ${session.configuration.mode}, Score: ${session.finalScore}`,
          );
        });
      } else {
        console.warn(
          '   ⚠️ No sessions found in cloud (upload may have failed)',
        );
      }

      const { data: cloudStats, error: statsError } =
        await supabase.getUserStats(user.id);

      if (statsError) {
        console.error(`   ❌ Failed to retrieve stats: ${statsError.message}`);
      } else if (cloudStats) {
        console.log(`   ✅ Found user stats in cloud`);
        console.log(`      Total Games: ${cloudStats.totalGames}`);
        console.log(`      Best Score: ${cloudStats.bestScore}`);
      } else {
        console.warn('   ⚠️ No stats found in cloud (upload may have failed)');
      }
    } catch (error) {
      console.error('   ❌ EXCEPTION during verification:', error);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Authentication: ${isAuth ? 'PASS' : 'FAIL'}`);
    console.log(
      `✅ Local Data: ${stats && sessions.length > 0 ? 'PASS' : 'FAIL'}`,
    );
    console.log(
      `✅ Cloud Sync: ${cloudSync.getSyncStatus().status === 'synced' ? 'PASS' : 'FAIL'}`,
    );

    console.log('\n💡 Next Steps:');
    console.log('   1. Check your Supabase Dashboard → Table Editor');
    console.log('   2. Look for data in: quiz_sessions, user_stats');
    console.log('   3. Verify user_id matches:', user.id);
  } catch (error) {
    console.error('\n❌ CRITICAL ERROR in diagnostics:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

/**
 * Initialize dev helpers in development mode
 */
export function initDevHelpers(): void {
  if (typeof window !== 'undefined') {
    window.getServices = getServices;
    window.testCloudSync = testCloudSync;
    window.checkAuthStatus = checkAuthStatus;
    window.clearLocalData = clearLocalData;
    window.runFullDiagnostics = runFullDiagnostics;

    // eslint-disable-next-line no-console
    console.log('🛠️ Dev helpers loaded! Available commands:');
    // eslint-disable-next-line no-console
    console.log('   - getServices() - Access Angular services');
    // eslint-disable-next-line no-console
    console.log('   - testCloudSync() - Test cloud sync');
    // eslint-disable-next-line no-console
    console.log('   - checkAuthStatus() - Check auth status');
    // eslint-disable-next-line no-console
    console.log('   - clearLocalData() - Clear local data (for testing)');
    // eslint-disable-next-line no-console
    console.log('   - runFullDiagnostics() - Run complete test suite ⭐ NEW');
  }
}
