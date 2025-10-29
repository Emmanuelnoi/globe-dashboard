/**
 * Leaderboard Types
 */

import { GameMode } from '../../features/quiz/models/quiz.models';

/**
 * Leaderboard Type
 */
export type LeaderboardType = 'global' | 'weekly' | 'monthly' | 'mode-specific';

/**
 * Leaderboard Entry
 */
export interface LeaderboardEntry {
  id?: string;
  userId: string;
  username?: string;
  avatarUrl?: string;
  leaderboardType: LeaderboardType;
  gameMode?: GameMode | 'all';
  totalScore: number;
  totalGames: number;
  averageScore: number;
  bestScore: number;
  bestStreak: number;
  countriesDiscovered: number;
  achievementsUnlocked: number;
  rank?: number;
  percentile?: number;
  lastUpdated: Date;
  periodStart?: Date;
  periodEnd?: Date;
}
