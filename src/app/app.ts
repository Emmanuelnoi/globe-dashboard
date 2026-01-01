import {
  Component,
  signal,
  ViewContainerRef,
  ViewChild,
  AfterViewInit,
  inject,
  ChangeDetectionStrategy,
  effect,
  computed,
} from '@angular/core';
import { Sidebar } from './layout/component/sidebar/sidebar';
import { ComparisonCard } from './layout/component/comparison-card/comparison-card';
import { NavigationStateService } from './core/services/navigation-state.service';
import { NotificationToast } from './shared/components/notification-toast/notification-toast';
import { GameHub } from './features/quiz/components/game-hub/game-hub';
import { QuizStateService } from './features/quiz/services/quiz-state';
import { MigrationHubComponent } from './features/bird-migration/components/migration-hub/migration-hub';
import { LoggerService } from './core/services/logger.service';
import { SignupPromptModalComponent } from './shared/components/signup-prompt-modal/signup-prompt-modal';
import { SigninModalComponent } from './shared/components/signin-modal/signin-modal';
import { SupabaseService } from './core/services/supabase.service';
import { UserStatsService } from './core/services/user-stats.service';
import { CountryDiscoveryService } from './core/services/country-discovery.service';
import { AchievementsService } from './core/services/achievements.service';
import { LeaderboardComponent } from './features/leaderboard/leaderboard.component';
import { UserProfileComponent } from './features/user-profile/user-profile.component';
import { AchievementNotificationComponent } from './shared/components/achievement-notification/achievement-notification';
import { AchievementsGalleryComponent } from './features/achievements-gallery/achievements-gallery.component';
import { CacheVersionService } from './core/services/cache-version.service';
import type {
  MigrationResult,
  DatabaseConfig,
} from './core/services/cache-version.service';

// Extend Window interface for cache version debugging API
declare global {
  interface Window {
    cacheVersion?: {
      check: () => string;
      clearApiCaches: () => Promise<void>;
      getDatabases: () => readonly DatabaseConfig[];
      migrate: () => Promise<MigrationResult>;
    };
  }
}

@Component({
  selector: 'app-root',
  imports: [
    Sidebar,
    ComparisonCard,
    NotificationToast,
    GameHub,
    MigrationHubComponent,
    SignupPromptModalComponent,
    SigninModalComponent,
    LeaderboardComponent,
    UserProfileComponent,
    AchievementNotificationComponent,
    AchievementsGalleryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="app-container"
      role="application"
      aria-label="3D Global Dashboard"
    >
      <main
        #globeContainer
        aria-label="Interactive 3D globe visualization"
        aria-describedby="globe-description"
      ></main>

      <!-- Hidden description for screen readers -->
      <div id="globe-description" class="sr-only">
        Interactive 3D globe showing country data. Use the sidebar to navigate
        and the comparison table to analyze country statistics.
      </div>

      <app-sidebar />

      <!-- Conditional rendering based on navigation state -->
      @if (navigationService.isCountryComparisonActive()) {
        <app-comparison-card />
      }

      <!-- Game Quiz Feature - Unified Card -->
      @if (navigationService.isGameQuizActive()) {
        <app-game-hub />
      }

      @if (navigationService.isBirdMigrationActive()) {
        <app-migration-hub />
      }

      <!-- Leaderboard Mode - Rankings and Achievements -->
      @if (navigationService.isLeaderboardActive()) {
        <app-leaderboard />
        <app-achievements-gallery />
      }

      <!-- Notification Toast -->
      <app-notification-toast></app-notification-toast>

      <!-- Achievement Notifications -->
      <app-achievement-notification />

      <!-- Auth Button (Top-Right Corner, moves left in Game Quiz mode) -->
      @if (supabase.isAuthenticated()) {
        <!-- Authenticated User Profile Button with Dropdown -->
        <div class="profile-dropdown-container">
          <button
            class="auth-button-topright"
            [class.game-quiz-mode]="navigationService.isGameQuizActive()"
            (click)="toggleProfileDropdown()"
            [attr.aria-label]="'User profile'"
            [attr.aria-expanded]="showProfileDropdown()"
            type="button"
          >
            <span class="auth-icon">👤</span>
            <span class="auth-label">{{ displayName() }}</span>
            <span class="dropdown-arrow">{{
              showProfileDropdown() ? '▲' : '▼'
            }}</span>
          </button>

          <!-- Dropdown Menu with Full Profile Content -->
          @if (showProfileDropdown()) {
            <div class="profile-dropdown-menu">
              <app-user-profile
                (closeRequest)="showProfileDropdown.set(false)"
              />
            </div>
          }
        </div>
      } @else {
        <!-- Non-authenticated Sign In Button -->
        <button
          class="auth-button-topright"
          [class.game-quiz-mode]="navigationService.isGameQuizActive()"
          (click)="onAuthButtonClick()"
          [attr.aria-label]="'Sign in'"
          type="button"
        >
          <span class="auth-icon">🔑</span>
          <span class="auth-label">Sign In</span>
        </button>
      }

      <!-- Sign-Up Prompt Modal -->
      <app-signup-prompt-modal
        [isOpen]="showSignUpModal()"
        [triggerReason]="signUpTriggerReason()"
        [statsToMigrate]="statsToMigrate()"
        [directMode]="signUpDirectMode()"
        (close)="onSignUpModalClose()"
        (signupSuccess)="onSignUpSuccess()"
        (switchToSignIn)="onSwitchToSignIn()"
      />

      <!-- Sign-In Modal -->
      <app-signin-modal
        [isOpen]="showSignInModal()"
        (close)="showSignInModal.set(false)"
        (signinSuccess)="onSignInSuccess()"
        (switchToSignUp)="onSwitchToSignUp()"
      />
    </div>
  `,
  styles: [
    `
      .app-container {
        height: 100vh;
        overflow: hidden;
        position: relative;
        background: radial-gradient(
          ellipse at bottom,
          #1b2735 0%,
          #090a0f 100%
        );
      }

      /* Skip link for keyboard accessibility */
      .skip-link {
        position: absolute;
        top: -40px;
        left: 6px;
        background: #3b82f6;
        color: white;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 500;
        font-size: 14px;
        z-index: 9999;
        transition: top 0.2s ease;
      }

      .skip-link:focus {
        top: 6px;
      }

      /* Screen reader only text */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      /* Main content area */
      main {
        width: 100%;
        height: 100%;
      }

      /* Placeholder views for future features */
      .placeholder-view {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 20px;
        width: min(96vw, 1400px);
        max-width: 1400px;
        z-index: 120;
        pointer-events: auto;
        box-sizing: border-box;

        border-radius: 14px;
        padding: 32px;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.06),
          rgba(255, 255, 255, 0.02)
        );
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(14px) saturate(1.15);
        -webkit-backdrop-filter: blur(14px) saturate(1.15);
        box-shadow:
          0 18px 40px rgba(0, 0, 0, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }

      .placeholder-content {
        text-align: center;
        color: rgba(255, 255, 255, 0.9);
      }

      .placeholder-content h2 {
        margin: 0 0 16px 0;
        font-size: 24px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      .placeholder-content p {
        margin: 0;
        font-size: 16px;
        color: rgba(255, 255, 255, 0.7);
        font-style: italic;
      }

      /* Auth Button (Top-Right Corner) */
      .auth-button-topright {
        position: fixed;
        top: 20px;
        right: min(4vw, 48px);
        z-index: 130;

        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;

        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.12),
          rgba(255, 255, 255, 0.06)
        );
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 12px;
        backdrop-filter: blur(14px) saturate(1.15);
        -webkit-backdrop-filter: blur(14px) saturate(1.15);
        box-shadow:
          0 8px 24px rgba(0, 0, 0, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);

        cursor: pointer;
        transition: all 0.3s ease;

        border: none;
        outline: none;
      }

      /* Move button to left side when in Game Quiz mode */
      .auth-button-topright.game-quiz-mode {
        right: auto;
        left: 50%;
        transform: translateX(-50%);
        top: 20px;
      }

      .auth-button-topright:hover {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.18),
          rgba(255, 255, 255, 0.12)
        );
        border: 1px solid rgba(255, 255, 255, 0.25);
        transform: translateY(-1px);
        box-shadow:
          0 12px 32px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.12);
      }

      .auth-button-topright.game-quiz-mode:hover {
        transform: translateX(-50%) translateY(-1px);
      }

      .auth-button-topright:active {
        transform: translateY(0);
      }

      .auth-button-topright.game-quiz-mode:active {
        transform: translateX(-50%) translateY(0);
      }

      .auth-icon {
        font-size: 18px;
        line-height: 1;
      }

      .auth-label {
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
        white-space: nowrap;
      }

      .dropdown-arrow {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.7);
        margin-left: 4px;
      }

      /* Profile Dropdown Container */
      .profile-dropdown-container {
        position: fixed;
        top: 20px;
        right: min(4vw, 48px);
        z-index: 130;
      }

      /* Profile Dropdown Menu */
      .profile-dropdown-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 400px;
        max-height: calc(100vh - 100px);
        background: transparent;
        animation: dropdownFadeIn 0.2s ease-out;
        z-index: 10000;
      }

      /* Hide the profile card's own header since it's in dropdown */
      .profile-dropdown-menu
        app-user-profile
        ::ng-deep
        .user-profile-container {
        position: static;
        width: 100%;
        max-height: calc(100vh - 100px);
        margin: 0;
      }

      @keyframes dropdownFadeIn {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 720px) {
        .placeholder-view {
          left: 12px;
          right: 12px;
          bottom: 24px;
          transform: none;
          max-width: calc(100% - 24px);
          padding: 24px 16px;
        }

        .placeholder-content h2 {
          font-size: 20px;
        }

        .placeholder-content p {
          font-size: 14px;
        }
      }
    `,
  ],
})
export class App implements AfterViewInit {
  @ViewChild('globeContainer', { read: ViewContainerRef })
  private globeContainer!: ViewContainerRef;

  // Inject services
  protected readonly navigationService = inject(NavigationStateService);
  protected readonly quizStateService = inject(QuizStateService);
  private readonly logger = inject(LoggerService);
  protected readonly supabase = inject(SupabaseService);
  private readonly userStatsService = inject(UserStatsService);
  private readonly discoveryService = inject(CountryDiscoveryService);
  private readonly achievementsService = inject(AchievementsService);
  private readonly cacheVersionService = inject(CacheVersionService);

  protected readonly title = signal('global-dashboard');

  // Sign-up modal state
  protected readonly showSignUpModal = signal(false);
  protected readonly signUpTriggerReason = signal(
    "You're making great progress!",
  );
  protected readonly signUpDirectMode = signal(false); // Skip prompt, go directly to signup form
  protected readonly statsToMigrate = computed(() => ({
    gamesPlayed: this.userStatsService.totalGames(),
    countriesDiscovered: this.discoveryService.totalDiscovered(),
    achievementsUnlocked: this.achievementsService.unlockedCount(),
  }));

  // Sign-in modal state
  protected readonly showSignInModal = signal(false);

  // Profile dropdown state
  protected readonly showProfileDropdown = signal(false);

  // Display name for profile button
  protected readonly displayName = computed(() => {
    const user = this.supabase.currentUser();
    return (
      user?.user_metadata?.['display_name'] ||
      user?.email?.split('@')[0] ||
      'User'
    );
  });

  // Track if user has dismissed the modal (persist to localStorage)
  private hasShownSignUpPrompt = false;
  private readonly SIGNUP_PROMPT_KEY = 'signup-prompt-shown';

  constructor() {
    // Check if we've shown the prompt before
    this.hasShownSignUpPrompt =
      localStorage.getItem(this.SIGNUP_PROMPT_KEY) === 'true';

    // Setup sign-up prompt triggers
    this.setupSignUpTriggers();

    // Close profile dropdown when user signs out
    effect(() => {
      if (!this.supabase.isAuthenticated()) {
        this.showProfileDropdown.set(false);
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    // this.logger.debug('APP COMPONENT: ngAfterViewInit called', 'AppComponent');

    try {
      // this.logger.debug(
      //   'Starting dynamic import of Globe component',
      //   'AppComponent',
      // );
      // Lazy load the Globe component
      const { Globe } = await import('./pages/globe/globe');
      // this.logger.success(
      //   'Globe component imported successfully',
      //   'AppComponent',
      // );

      const _componentRef = this.globeContainer.createComponent(Globe);
      // this.logger.debug('Globe component instance created', 'AppComponent');
    } catch (error) {
      this.logger.error(
        'Failed to load Globe component',
        error,
        'AppComponent',
      );
    }

    // Add cache version debugging helpers to browser console
    window.cacheVersion = {
      check: (): string => this.cacheVersionService.getCurrentVersion(),
      clearApiCaches: (): Promise<void> =>
        this.cacheVersionService.clearAllApiCaches(),
      getDatabases: (): readonly DatabaseConfig[] =>
        this.cacheVersionService.getDatabases(),
      migrate: (): Promise<MigrationResult> =>
        this.cacheVersionService.checkAndMigrate(),
    };

    this.logger.debug(
      'Cache version console helpers available: cacheVersion.check(), cacheVersion.getDatabases(), cacheVersion.clearApiCaches(), cacheVersion.migrate()',
      'AppComponent',
    );
  }

  /**
   * Setup sign-up prompt triggers
   */
  private setupSignUpTriggers(): void {
    // Trigger after 3 completed quizzes
    effect(() => {
      const totalGames = this.userStatsService.totalGames();
      const isAuthenticated = this.supabase.isAuthenticated();

      // this.logger.debug(
      //   `Sign-up trigger check: totalGames=${totalGames}, isAuthenticated=${isAuthenticated}, hasShownPrompt=${this.hasShownSignUpPrompt}`,
      // );

      if (totalGames >= 3 && !isAuthenticated && !this.hasShownSignUpPrompt) {
        this.signUpTriggerReason.set("🎉 You've completed 3 quizzes!");
        this.showSignUpModal.set(true);
        this.hasShownSignUpPrompt = true;
        localStorage.setItem(this.SIGNUP_PROMPT_KEY, 'true');
        // this.logger.debug('Triggered sign-up modal: 3 quizzes completed');
      }
    });

    // Trigger after 10 country discoveries
    effect(() => {
      const totalDiscovered = this.discoveryService.totalDiscovered();
      const isAuthenticated = this.supabase.isAuthenticated();

      if (
        totalDiscovered >= 10 &&
        !isAuthenticated &&
        !this.hasShownSignUpPrompt
      ) {
        this.signUpTriggerReason.set("🌍 You've discovered 10 countries!");
        this.showSignUpModal.set(true);
        this.hasShownSignUpPrompt = true;
        localStorage.setItem(this.SIGNUP_PROMPT_KEY, 'true');
        // this.logger.debug('Triggered sign-up modal: 10 countries discovered');
      }
    });

    // Trigger after first achievement unlocked
    effect(() => {
      const unlockedCount = this.achievementsService.unlockedCount();
      const isAuthenticated = this.supabase.isAuthenticated();

      if (
        unlockedCount >= 1 &&
        !isAuthenticated &&
        !this.hasShownSignUpPrompt
      ) {
        this.signUpTriggerReason.set(
          "🏆 You've unlocked your first achievement!",
        );
        this.showSignUpModal.set(true);
        this.hasShownSignUpPrompt = true;
        localStorage.setItem(this.SIGNUP_PROMPT_KEY, 'true');
        // this.logger.debug('Triggered sign-up modal: first achievement unlocked');
      }
    });

    // Auto-open sign-in modal for password recovery
    effect(() => {
      const passwordRecovery = this.supabase.passwordRecoveryEvent();
      const isPending = this.supabase.isPasswordRecoveryPending();

      if (passwordRecovery || isPending) {
        this.logger.info('Opening sign-in modal for password recovery');
        this.showSignInModal.set(true);
      }
    });

    // Check for password recovery errors in URL hash
    this.checkPasswordRecoveryErrors();
  }

  /**
   * Check URL hash for password recovery errors and valid tokens
   */
  private checkPasswordRecoveryErrors(): void {
    const hash = window.location.hash;

    // Check for valid recovery token
    if (hash.includes('access_token=') && hash.includes('type=recovery')) {
      this.logger.success(
        '🔐 Password recovery link detected!',
        'AppComponent',
      );

      // Trigger password recovery
      this.supabase.passwordRecoveryEvent.set(true);
      sessionStorage.setItem('password-recovery-pending', 'true');

      // Open sign-in modal
      setTimeout(() => {
        this.showSignInModal.set(true);
      }, 500);

      return;
    }

    // Check for OTP expired error
    if (
      hash.includes('error_code=otp_expired') ||
      hash.includes('error=access_denied')
    ) {
      this.logger.error(
        '🔒 Password reset link has expired. Please request a new one.',
      );

      // Open sign-in modal in reset password step
      setTimeout(() => {
        this.showSignInModal.set(true);
      }, 1000);

      // Clear the error from URL
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  /**
   * Handle successful sign-up
   */
  protected onSignUpSuccess(): void {
    this.logger.success('User signed up successfully!', 'AppComponent');
    // Modal will close automatically after migration
  }

  /**
   * Toggle profile dropdown
   */
  protected toggleProfileDropdown(): void {
    this.showProfileDropdown.update((show) => !show);
  }

  /**
   * Handle sign out
   */
  protected async onSignOut(): Promise<void> {
    await this.supabase.signOut();
    this.showProfileDropdown.set(false);
    this.logger.success('Signed out successfully', 'AppComponent');
  }

  /**
   * Handle auth button click (for non-authenticated users)
   */
  protected async onAuthButtonClick(): Promise<void> {
    // Show sign-in modal for non-authenticated users
    this.showSignInModal.set(true);
  }

  /**
   * Handle successful sign-in
   */
  protected onSignInSuccess(): void {
    this.logger.success('User signed in successfully!', 'AppComponent');
    // Modal will close automatically
  }

  /**
   * Switch from sign-up modal to sign-in modal
   */
  protected onSwitchToSignIn(): void {
    this.showSignUpModal.set(false);
    this.showSignInModal.set(true);
  }

  /**
   * Switch from sign-in modal to sign-up modal
   */
  protected onSwitchToSignUp(): void {
    this.showSignInModal.set(false);
    this.signUpDirectMode.set(true); // Skip prompt, go directly to signup form
    this.signUpTriggerReason.set('Create your account');
    this.showSignUpModal.set(true);
  }

  /**
   * Handle modal close - reset direct mode
   */
  protected onSignUpModalClose(): void {
    this.showSignUpModal.set(false);
    this.signUpDirectMode.set(false); // Reset to default (show prompt)
  }
}
