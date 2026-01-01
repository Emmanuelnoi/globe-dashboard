/**
 * Notification Helpers
 *
 * Shared utilities for notification services:
 * - Duration constants
 * - Achievement tier colors
 * - Achievement category icons
 * - Sound effect player
 */

/**
 * Notification duration constants (milliseconds)
 */
export const NOTIFICATION_DURATIONS = {
  achievement: 4000,
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 8000,
  quizError: 5000,
  quizWarning: 4000,
  quizInfo: 3000,
} as const;

/**
 * Achievement tier color mapping
 */
export const TIER_COLORS = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  platinum: '#e5e4e2',
  diamond: '#b9f2ff',
} as const;

/**
 * Get color for achievement tier
 */
export function getTierColor(tier: string): string {
  return TIER_COLORS[tier as keyof typeof TIER_COLORS] || '#10b981';
}

/**
 * Achievement category icon mapping
 */
export const CATEGORY_ICONS = {
  quiz: '🎯',
  discovery: '🗺️',
  exploration: '🔍',
  social: '👥',
  milestone: '⭐',
} as const;

/**
 * Get icon for achievement category
 */
export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || '🏆';
}

/**
 * Notification Sound Player
 *
 * Manages Web Audio API context for achievement sounds.
 * Automatically cleans up resources on destroy.
 */
export class NotificationSoundPlayer {
  private audioContext: AudioContext | null = null;

  /**
   * Play achievement unlock sound
   * Two-tone chime: C5 → E5 → G5
   */
  playAchievementSound(): void {
    try {
      // Initialize audio context if needed
      if (!this.audioContext) {
        this.audioContext = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Create two-tone chime progression
      oscillator.frequency.setValueAtTime(
        523.25,
        this.audioContext.currentTime,
      ); // C5
      oscillator.frequency.setValueAtTime(
        659.25,
        this.audioContext.currentTime + 0.1,
      ); // E5
      oscillator.frequency.setValueAtTime(
        783.99,
        this.audioContext.currentTime + 0.2,
      ); // G5

      // Fade out for smooth sound
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.5,
      );

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);
    } catch (error) {
      // Silent fail - sound is optional feature
      console.debug('Failed to play achievement sound:', error);
    }
  }

  /**
   * Cleanup audio context resources
   */
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
