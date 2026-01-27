/**
 * Gamification Types
 * Types and interfaces for the gamification system
 */

// Achievement categories
export enum AchievementCategory {
  EFFICIENCY = 'efficiency',
  RELIABILITY = 'reliability',
  SAFETY = 'safety',
  OPTIMIZATION = 'optimization',
  LEARNING = 'learning',
  ENGAGEMENT = 'engagement',
  SUSTAINABILITY = 'sustainability'
}

// Achievement rarity levels
export enum AchievementRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

// Point types
export enum PointType {
  EFFICIENCY_POINTS = 'efficiency_points',
  SAFETY_POINTS = 'safety_points',
  OPTIMIZATION_POINTS = 'optimization_points',
  ENGAGEMENT_POINTS = 'engagement_points',
  BONUS_POINTS = 'bonus_points'
}

// Challenge status
export enum ChallengeStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

// Leaderboard timeframe
export enum LeaderboardTimeframe {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL_TIME = 'all_time'
}

// Achievement definition
export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  points: number;
  criteria: AchievementCriteria;
  rewards?: Reward[];
  hidden?: boolean;
  createdAt: Date;
}

// Achievement criteria
export interface AchievementCriteria {
  type: 'threshold' | 'streak' | 'cumulative' | 'event' | 'composite';
  metric?: string;
  target?: number;
  duration?: number; // in days for streaks
  conditions?: AchievementCriteria[]; // for composite
  operator?: 'AND' | 'OR'; // for composite
}

// User achievement progress
export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  progress: number;
  completed: boolean;
  completedAt?: Date;
  claimed: boolean;
  claimedAt?: Date;
}

// Challenge definition
export interface Challenge {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  startDate: Date;
  endDate: Date;
  criteria: ChallengeCriteria;
  rewards: Reward[];
  participants?: number;
  maxParticipants?: number;
  status: ChallengeStatus;
}

// Challenge criteria
export interface ChallengeCriteria {
  metric: string;
  target: number;
  comparison: 'gte' | 'lte' | 'eq' | 'between';
  targetEnd?: number; // for 'between'
}

// User challenge participation
export interface UserChallenge {
  id: string;
  userId: string;
  challengeId: string;
  joined: Date;
  progress: number;
  status: ChallengeStatus;
  rank?: number;
}

// Reward types
export interface Reward {
  type: 'points' | 'badge' | 'title' | 'feature_unlock' | 'discount';
  value: number | string;
  description: string;
}

// User profile
export interface GamificationProfile {
  userId: string;
  displayName: string;
  avatar?: string;
  title?: string;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  totalPoints: number;
  pointsByType: Record<PointType, number>;
  achievementsUnlocked: number;
  totalAchievements: number;
  currentStreak: number;
  longestStreak: number;
  joinedAt: Date;
  lastActiveAt: Date;
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatar?: string;
  level: number;
  points: number;
  change?: number; // position change since last period
}

// Point transaction
export interface PointTransaction {
  id: string;
  userId: string;
  type: PointType;
  amount: number;
  reason: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Level definition
export interface LevelDefinition {
  level: number;
  name: string;
  minExperience: number;
  maxExperience: number;
  perks?: string[];
  badge?: string;
}

// Notification for gamification events
export interface GamificationNotification {
  id: string;
  userId: string;
  type: 'achievement_unlocked' | 'level_up' | 'challenge_complete' | 'reward_earned' | 'streak_milestone';
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

// Statistics for a BESS system
export interface BESSGamificationStats {
  bessId: string;
  name: string;
  efficiencyScore: number;
  reliabilityScore: number;
  safetyScore: number;
  overallScore: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
  achievements: string[];
}

// Team/organization stats
export interface TeamStats {
  teamId: string;
  name: string;
  totalPoints: number;
  memberCount: number;
  averageLevel: number;
  topAchievements: string[];
  rank: number;
}

// Default achievements
export const DEFAULT_ACHIEVEMENTS: Omit<Achievement, 'id' | 'createdAt'>[] = [
  // Efficiency achievements
  {
    name: 'Efficiency Pioneer',
    description: 'Achieve 90% round-trip efficiency for the first time',
    category: AchievementCategory.EFFICIENCY,
    rarity: AchievementRarity.COMMON,
    icon: '⚡',
    points: 100,
    criteria: { type: 'threshold', metric: 'round_trip_efficiency', target: 90 }
  },
  {
    name: 'Efficiency Master',
    description: 'Maintain 95% efficiency for 30 consecutive days',
    category: AchievementCategory.EFFICIENCY,
    rarity: AchievementRarity.EPIC,
    icon: '🏆',
    points: 1000,
    criteria: { type: 'streak', metric: 'daily_efficiency_95', duration: 30 }
  },
  {
    name: 'Energy Saver',
    description: 'Save 1 MWh through optimization',
    category: AchievementCategory.EFFICIENCY,
    rarity: AchievementRarity.UNCOMMON,
    icon: '💡',
    points: 250,
    criteria: { type: 'cumulative', metric: 'energy_saved_kwh', target: 1000 }
  },

  // Safety achievements
  {
    name: 'Safety First',
    description: 'Complete 100 safe operating hours',
    category: AchievementCategory.SAFETY,
    rarity: AchievementRarity.COMMON,
    icon: '🛡️',
    points: 100,
    criteria: { type: 'cumulative', metric: 'safe_operating_hours', target: 100 }
  },
  {
    name: 'Zero Incidents',
    description: '30 days without safety incidents',
    category: AchievementCategory.SAFETY,
    rarity: AchievementRarity.RARE,
    icon: '✅',
    points: 500,
    criteria: { type: 'streak', metric: 'incident_free_day', duration: 30 }
  },
  {
    name: 'Guardian Angel',
    description: 'Prevent a potential thermal event through early detection',
    category: AchievementCategory.SAFETY,
    rarity: AchievementRarity.LEGENDARY,
    icon: '👼',
    points: 2000,
    criteria: { type: 'event', metric: 'thermal_event_prevented' },
    hidden: true
  },

  // Optimization achievements
  {
    name: 'Peak Shaver',
    description: 'Shave 100 kW of peak demand',
    category: AchievementCategory.OPTIMIZATION,
    rarity: AchievementRarity.UNCOMMON,
    icon: '📉',
    points: 200,
    criteria: { type: 'cumulative', metric: 'peak_shaved_kw', target: 100 }
  },
  {
    name: 'Arbitrage Artist',
    description: 'Complete 50 profitable arbitrage cycles',
    category: AchievementCategory.OPTIMIZATION,
    rarity: AchievementRarity.RARE,
    icon: '💰',
    points: 500,
    criteria: { type: 'cumulative', metric: 'arbitrage_cycles', target: 50 }
  },
  {
    name: 'Revenue Champion',
    description: 'Generate R$100,000 in revenue',
    category: AchievementCategory.OPTIMIZATION,
    rarity: AchievementRarity.EPIC,
    icon: '🏅',
    points: 1500,
    criteria: { type: 'cumulative', metric: 'total_revenue', target: 100000 }
  },

  // Reliability achievements
  {
    name: 'Always On',
    description: 'Achieve 99% availability for one month',
    category: AchievementCategory.RELIABILITY,
    rarity: AchievementRarity.RARE,
    icon: '🔋',
    points: 500,
    criteria: { type: 'threshold', metric: 'monthly_availability', target: 99 }
  },
  {
    name: 'Iron Battery',
    description: '1000 cycles without degradation above normal',
    category: AchievementCategory.RELIABILITY,
    rarity: AchievementRarity.LEGENDARY,
    icon: '🦾',
    points: 2500,
    criteria: { type: 'cumulative', metric: 'healthy_cycles', target: 1000 }
  },

  // Engagement achievements
  {
    name: 'First Steps',
    description: 'Complete your first day using the system',
    category: AchievementCategory.ENGAGEMENT,
    rarity: AchievementRarity.COMMON,
    icon: '👶',
    points: 50,
    criteria: { type: 'event', metric: 'first_day_complete' }
  },
  {
    name: 'Power User',
    description: 'Use the system for 30 consecutive days',
    category: AchievementCategory.ENGAGEMENT,
    rarity: AchievementRarity.UNCOMMON,
    icon: '💪',
    points: 300,
    criteria: { type: 'streak', metric: 'daily_login', duration: 30 }
  },
  {
    name: 'Explorer',
    description: 'Visit every page in the application',
    category: AchievementCategory.ENGAGEMENT,
    rarity: AchievementRarity.COMMON,
    icon: '🗺️',
    points: 100,
    criteria: { type: 'event', metric: 'all_pages_visited' }
  },

  // Sustainability achievements
  {
    name: 'Carbon Crusher',
    description: 'Offset 1 ton of CO2 emissions',
    category: AchievementCategory.SUSTAINABILITY,
    rarity: AchievementRarity.RARE,
    icon: '🌱',
    points: 500,
    criteria: { type: 'cumulative', metric: 'co2_offset_kg', target: 1000 }
  },
  {
    name: 'Green Champion',
    description: 'Store 100 MWh of renewable energy',
    category: AchievementCategory.SUSTAINABILITY,
    rarity: AchievementRarity.EPIC,
    icon: '🌍',
    points: 1000,
    criteria: { type: 'cumulative', metric: 'renewable_stored_kwh', target: 100000 }
  }
];

// Level definitions
export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  { level: 1, name: 'Novice', minExperience: 0, maxExperience: 100 },
  { level: 2, name: 'Apprentice', minExperience: 100, maxExperience: 300 },
  { level: 3, name: 'Operator', minExperience: 300, maxExperience: 600 },
  { level: 4, name: 'Specialist', minExperience: 600, maxExperience: 1000 },
  { level: 5, name: 'Expert', minExperience: 1000, maxExperience: 1500 },
  { level: 6, name: 'Master', minExperience: 1500, maxExperience: 2200 },
  { level: 7, name: 'Grandmaster', minExperience: 2200, maxExperience: 3000 },
  { level: 8, name: 'Legend', minExperience: 3000, maxExperience: 4000 },
  { level: 9, name: 'Mythic', minExperience: 4000, maxExperience: 5500 },
  { level: 10, name: 'Transcendent', minExperience: 5500, maxExperience: Infinity }
];
