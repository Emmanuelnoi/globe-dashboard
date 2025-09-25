export type GameMode =
  | 'find-country'
  | 'capital-match'
  | 'flag-id'
  | 'facts-guess'
  | 'explore-learn';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type GameState =
  | 'idle'
  | 'playing'
  | 'question'
  | 'evaluating'
  | 'results'
  | 'ended';

export interface GameConfiguration {
  mode: GameMode;
  difficulty: Difficulty;
  questionCount: number;
  seed?: string;
}

export interface Question {
  id: string;
  type: GameMode;
  prompt: string;
  correctAnswer: string;
  choices?: string[];
  metadata?: {
    countryId?: string;
    factType?: string;
    flagUrl?: string;
    [key: string]: any;
  };
}

export interface QuestionResult {
  questionId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
  pointsEarned: number;
  streakAtTime: number;
}

export interface GameSession {
  id: string;
  configuration: GameConfiguration;
  questions: Question[];
  results: QuestionResult[];
  startTime: Date;
  endTime?: Date;
  finalScore: number;
  bestStreak: number;
  completed: boolean;
}

export interface UserStatsV1 {
  version: 1;
  totalGames: number;
  totalScore: number;
  averageScore: number;
  bestScore: number;
  bestStreak: number;
  gamesByMode: {
    [key in GameMode]: {
      gamesPlayed: number;
      totalScore: number;
      averageScore: number;
      bestScore: number;
      bestStreak: number;
    };
  };
  lastUpdated: Date;
}

export interface ScoreBreakdown {
  basePoints: number;
  timeBonus: number;
  streakMultiplier: number;
  difficultyMultiplier: number;
  totalPoints: number;
}
