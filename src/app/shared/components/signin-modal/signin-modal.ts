import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import {
  SupabaseService,
  PasswordStrength,
} from '../../../core/services/supabase.service';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Sign-In Modal Component
 *
 * Allows users to sign in to their existing account.
 * Features:
 * - Email/password sign in
 * - Google OAuth option
 * - Password reset flow
 * - Glass morphism design matching app aesthetic
 */
@Component({
  selector: 'app-signin-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signin-modal.html',
  styleUrls: ['./signin-modal.scss'],
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
export class SigninModalComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly logger = inject(LoggerService);

  // Inputs
  readonly isOpen = input<boolean>(false);

  // Outputs
  readonly close = output<void>();
  readonly signinSuccess = output<void>();
  readonly switchToSignUp = output<void>();

  // Form state
  readonly email = signal<string>('');
  readonly password = signal<string>('');
  readonly newPassword = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);
  readonly showNewPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);

  // UI state
  readonly currentStep = signal<
    'signin' | 'reset-password' | 'reset-sent' | 'set-new-password'
  >('signin');

  // Password strength
  readonly passwordStrength = computed<PasswordStrength>(() => {
    const pwd = this.newPassword();
    if (!pwd) {
      return { score: 0, label: 'Very Weak', feedback: [], isValid: false };
    }
    return this.supabase.calculatePasswordStrength(pwd);
  });

  // Password match validation
  readonly passwordsMatch = computed<boolean>(() => {
    const newPwd = this.newPassword();
    const confirmPwd = this.confirmPassword();
    return newPwd.length > 0 && newPwd === confirmPwd;
  });

  // Can submit new password
  readonly canSubmitNewPassword = computed<boolean>(() => {
    return this.passwordStrength().isValid && this.passwordsMatch();
  });

  constructor() {
    // Listen for password recovery events
    effect(() => {
      if (this.supabase.passwordRecoveryEvent()) {
        this.logger.info('Password recovery detected, opening reset form');
        this.currentStep.set('set-new-password');
        this.error.set(null);

        // Try to establish session from URL token
        this.verifyRecoveryToken();
      }
    });
  }

  /**
   * Verify and establish session from recovery token in URL
   */
  private async verifyRecoveryToken(): Promise<void> {
    const urlHash = window.location.hash;

    this.logger.info(`📍 URL Hash: ${urlHash.substring(0, 50)}...`);

    const params = new URLSearchParams(urlHash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const tokenType = params.get('type');

    this.logger.info(`🔑 Access Token: ${accessToken ? 'Present' : 'Missing'}`);
    this.logger.info(
      `🔄 Refresh Token: ${refreshToken ? 'Present' : 'Missing'}`,
    );
    this.logger.info(`📝 Type: ${tokenType}`);

    if (accessToken) {
      this.logger.info('Attempting to verify recovery token...');

      try {
        // Try verifyOtp first (recommended for password recovery)
        const { data, error } = await this.supabase['supabase'].auth.verifyOtp({
          token_hash: accessToken,
          type: 'recovery',
        });

        if (error) {
          this.logger.warn('verifyOtp failed, trying setSession...', error);

          // Fallback to setSession if verifyOtp fails
          const { error: setSessionError } = await this.supabase[
            'supabase'
          ].auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || accessToken, // Use access token as fallback
          });

          if (setSessionError) {
            this.logger.error(
              'Both verifyOtp and setSession failed:',
              setSessionError,
            );
            this.error.set(
              'Recovery link is invalid or expired. Please request a new one.',
            );
          } else {
            this.logger.success(
              '✅ Recovery session established via setSession',
            );
            this.error.set(null);
          }
        } else {
          this.logger.success('✅ Recovery session established via verifyOtp');
          this.logger.info(`Session user: ${data.user?.email}`);
          this.error.set(null);
        }
      } catch (err) {
        this.logger.error('Token verification error:', err);
        this.error.set('Failed to verify recovery token. Please try again.');
      }
    } else {
      this.logger.error('No access token found in URL');
      this.error.set(
        'No recovery token found. Please click the link in your email again.',
      );
    }
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

    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Sign in with Supabase
      const { user, error: signinError } = await this.supabase.signIn(
        this.email(),
        this.password(),
      );

      if (signinError || !user) {
        throw new Error(signinError?.message || 'Sign in failed');
      }

      this.logger.success('✅ Signed in successfully!');

      // Emit success
      this.signinSuccess.emit();

      // Close modal after brief delay
      setTimeout(() => {
        this.onClose();
      }, 1000);
    } catch (error) {
      this.logger.error('❌ Sign in failed:', error);
      this.error.set(error instanceof Error ? error.message : 'Sign in failed');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Handle Google OAuth sign in
   */
  async onGoogleSignIn(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const { error } = await this.supabase.signInWithGoogle();

      if (error) {
        throw new Error(error.message);
      }

      // OAuth redirect will happen automatically
    } catch (error) {
      this.logger.error('❌ Google sign in failed:', error);
      this.error.set(
        error instanceof Error ? error.message : 'Google sign in failed',
      );
      this.isLoading.set(false);
    }
  }

  /**
   * Handle "Forgot Password" click
   */
  onForgotPassword(): void {
    this.currentStep.set('reset-password');
    this.error.set(null);
  }

  /**
   * Handle password reset submission
   */
  async onResetPassword(): Promise<void> {
    if (!this.email()) {
      this.error.set('Please enter your email address');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const { error } = await this.supabase.resetPassword(this.email());

      if (error) {
        throw new Error(error.message);
      }

      this.logger.success('✅ Password reset email sent!');
      this.currentStep.set('reset-sent');
    } catch (error) {
      this.logger.error('❌ Password reset failed:', error);
      this.error.set(
        error instanceof Error ? error.message : 'Password reset failed',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Handle modal close
   */
  onClose(): void {
    this.currentStep.set('signin');
    this.email.set('');
    this.password.set('');
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
   * Back to sign in from password reset
   */
  backToSignIn(): void {
    this.currentStep.set('signin');
    this.error.set(null);
  }

  /**
   * Handle new password submission (after clicking email link)
   */
  async onSubmitNewPassword(): Promise<void> {
    if (!this.canSubmitNewPassword()) {
      this.error.set(
        'Please ensure password meets all requirements and passwords match',
      );
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const { error } = await this.supabase.updatePassword(this.newPassword());

      if (error) {
        throw new Error(error.message);
      }

      this.logger.success(
        '✅ Password updated successfully! Signing you in...',
      );

      // Auto sign-in happens via the recovery session
      // Emit success
      this.signinSuccess.emit();

      // Close modal after brief delay
      setTimeout(() => {
        this.onClose();
      }, 2000);
    } catch (error) {
      this.logger.error('❌ Password update failed:', error);
      this.error.set(
        error instanceof Error ? error.message : 'Password update failed',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Toggle new password visibility
   */
  toggleNewPasswordVisibility(): void {
    this.showNewPassword.update((show) => !show);
  }

  /**
   * Toggle confirm password visibility
   */
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((show) => !show);
  }

  /**
   * Get password strength color
   */
  getPasswordStrengthColor(): string {
    const score = this.passwordStrength().score;
    const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
    return colors[score];
  }

  /**
   * Get password strength width percentage
   */
  getPasswordStrengthWidth(): number {
    return (this.passwordStrength().score / 4) * 100;
  }
}
