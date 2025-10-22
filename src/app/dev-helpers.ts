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

import { ApplicationRef } from '@angular/core';
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
  }
}

/**
 * Get Angular services from the browser console
 */
export function getServices() {
  const appRoot = document.querySelector('app-root');
  if (!appRoot) {
    console.error('❌ App root not found. Make sure the app is loaded.');
    throw new Error('App root not found');
  }

  const ng = (window as any).ng;
  if (!ng) {
    console.error(
      '❌ Angular devtools not available. Are you in development mode?',
    );
    throw new Error('Angular devtools not available');
  }

  const component = ng.getComponent(appRoot);
  if (!component) {
    console.error('❌ Could not get app component.');
    throw new Error('Could not get app component');
  }

  const injector = component.injector;
  if (!injector) {
    console.error('❌ Could not get injector.');
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
export async function testCloudSync() {
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
export function checkAuthStatus() {
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
export async function clearLocalData() {
  console.log('🗑️ Clearing local data...\n');

  try {
    const { userStats } = getServices();

    // Export backup first
    console.log('1️⃣ Creating backup...');
    const backup = await userStats.exportData();
    if (backup) {
      console.log(`   ✅ Backup created: ${backup.sessions.length} sessions`);
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
 * Initialize dev helpers in development mode
 */
export function initDevHelpers() {
  if (typeof window !== 'undefined') {
    window.getServices = getServices;
    window.testCloudSync = testCloudSync;
    window.checkAuthStatus = checkAuthStatus;
    window.clearLocalData = clearLocalData;

    console.log('🛠️ Dev helpers loaded! Available commands:');
    console.log('   - getServices() - Access Angular services');
    console.log('   - testCloudSync() - Test cloud sync');
    console.log('   - checkAuthStatus() - Check auth status');
    console.log('   - clearLocalData() - Clear local data (for testing)');
  }
}
