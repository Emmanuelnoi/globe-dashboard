import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
  effect,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CloudSyncService } from '../../../core/services/cloud-sync.service';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Sign-Up Prompt Modal Component
 *
 * Encourages users to create an account to sync their progress.
 * Triggered after:
 * - 3 completed quiz games
 * - 10 country discoveries
 * - Earning their first achievement
 *
 * Features:
 * - Glass morphism design matching app aesthetic
 * - Email/password sign up
 * - Google OAuth option
 * - Data migration promise (local → cloud)
 * - Dismissible with "Maybe Later" option
 */
@Component({
  selector: 'app-signup-prompt-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signup-prompt-modal.html',
  styleUrls: ['./signup-prompt-modal.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 })),
      ]),
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate(
          '300ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
    ]),
  ],
})
export class SignupPromptModalComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly cloudSync = inject(CloudSyncService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);

  // Timer reference for cleanup
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  // Inputs
  readonly isOpen = input<boolean>(false);
  readonly triggerReason = input<string>("You're making great progress!");
  readonly directMode = input<boolean>(false); // Skip prompt, go directly to signup form
  readonly statsToMigrate = input<{
    gamesPlayed?: number;
    countriesDiscovered?: number;
    achievementsUnlocked?: number;
  }>({});

  // Outputs
  readonly close = output<void>();
  readonly signupSuccess = output<void>();
  readonly switchToSignIn = output<void>();

  // Form state
  readonly email = signal<string>('');
  readonly password = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);

  // UI state
  readonly currentStep = signal<
    'prompt' | 'signup' | 'migrating' | 'email-confirmation'
  >('prompt');

  constructor() {
    // Watch directMode and automatically skip to signup step
    effect(() => {
      const isOpen = this.isOpen();
      const directMode = this.directMode();

      if (isOpen && directMode) {
        // Skip prompt, go directly to signup form
        this.currentStep.set('signup');
      } else if (isOpen && !directMode) {
        // Reset to prompt when opening normally
        this.currentStep.set('prompt');
      }
    });

    // Register cleanup for timer on component destroy
    this.destroyRef.onDestroy(() => {
      if (this.closeTimer) clearTimeout(this.closeTimer);
    });
  }

  /**
   * Handle "Sign Up" button click
   */
  onSignUpClick(): void {
    this.currentStep.set('signup');
    this.error.set(null);
  }

  /**
   * Handle form submission
   */
  async onSubmit(): Promise<void> {
    // Validate form
    if (!this.email() || !this.password()) {
      this.error.set('Please fill in all fields');
      return;
    }

    if (this.password() !== this.confirmPassword()) {
      this.error.set('Passwords do not match');
      return;
    }

    if (this.password().length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Sign up with Supabase
      const { user, error: signupError } = await this.supabase.signUp(
        this.email(),
        this.password(),
      );

      if (signupError || !user) {
        throw new Error(signupError?.message || 'Sign up failed');
      }

      this.logger.success('✅ Account created successfully!');

      // Check if we have a session (email confirmation disabled)
      // or if email confirmation is required
      if (this.supabase.isAuthenticated()) {
        // Session exists - migrate data immediately
        this.currentStep.set('migrating');
        await this.cloudSync.migrateAnonymousDataToUser(user.id);
      } else {
        // No session - email confirmation required
        // this.logger.debug('Email confirmation required');
        this.currentStep.set('email-confirmation');
        this.isLoading.set(false);
        return; // Don't proceed with migration
      }

      this.logger.success('✅ Progress synced to cloud!');

      // Emit success
      this.signupSuccess.emit();

      // Close modal after brief delay
      if (this.closeTimer) clearTimeout(this.closeTimer);
      this.closeTimer = setTimeout(() => {
        this.onClose();
      }, 2000);
    } catch (error) {
      this.logger.error('❌ Sign up failed:', error);
      this.error.set(error instanceof Error ? error.message : 'Sign up failed');
      this.currentStep.set('signup');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Handle Google OAuth sign up
   */
  async onGoogleSignUp(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const { error } = await this.supabase.signInWithGoogle();

      if (error) {
        throw new Error(error.message);
      }

      // OAuth redirect will happen automatically
      // Migration will happen after redirect in auth callback
    } catch (error) {
      this.logger.error('❌ Google sign up failed:', error);
      this.error.set(
        error instanceof Error ? error.message : 'Google sign up failed',
      );
      this.isLoading.set(false);
    }
  }

  /**
   * Handle "Maybe Later" click
   */
  onMaybeLater(): void {
    // this.logger.debug('User dismissed sign-up prompt');
    this.onClose();
  }

  /**
   * Handle modal close
   */
  onClose(): void {
    this.currentStep.set('prompt');
    this.email.set('');
    this.password.set('');
    this.confirmPassword.set('');
    this.error.set(null);
    this.showPassword.set(false);
    this.close.emit();
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword.update((show) => !show);
  }

  /**
   * Handle backdrop click
   */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
