/**
 * Gamification Service
 * Core service for managing gamification features including achievements, points, and leaderboards
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Achievement,
  AchievementCategory,
  AchievementRarity,
  UserAchievement,
  Challenge,
  ChallengeStatus,
  UserChallenge,
  GamificationProfile,
  LeaderboardEntry,
  LeaderboardTimeframe,
  PointTransaction,
  PointType,
  GamificationNotification,
  LevelDefinition,
  DEFAULT_ACHIEVEMENTS,
  LEVEL_DEFINITIONS,
  AchievementCriteria,
  ChallengeCriteria,
  Reward
} from './gamification.types';

export class GamificationService extends EventEmitter {
  private achievements: Map<string, Achievement> = new Map();
  private userAchievements: Map<string, UserAchievement[]> = new Map();
  private challenges: Map<string, Challenge> = new Map();
  private userChallenges: Map<string, UserChallenge[]> = new Map();
  private profiles: Map<string, GamificationProfile> = new Map();
  private pointTransactions: Map<string, PointTransaction[]> = new Map();
  private notifications: Map<string, GamificationNotification[]> = new Map();

  // Metrics tracking for achievement progress
  private userMetrics: Map<string, Map<string, number>> = new Map();
  private userStreaks: Map<string, Map<string, { count: number; lastDate: Date }>> = new Map();

  constructor() {
    super();
    this.initializeDefaultAchievements();
  }

  /**
   * Initialize default achievements
   */
  private initializeDefaultAchievements(): void {
    for (const achievement of DEFAULT_ACHIEVEMENTS) {
      const id = uuidv4();
      this.achievements.set(id, {
        ...achievement,
        id,
        createdAt: new Date()
      });
    }
  }

  /**
   * Get or create user profile
   */
  async getOrCreateProfile(userId: string, displayName?: string): Promise<GamificationProfile> {
    let profile = this.profiles.get(userId);

    if (!profile) {
      profile = {
        userId,
        displayName: displayName || `User ${userId.slice(0, 8)}`,
        level: 1,
        experience: 0,
        experienceToNextLevel: LEVEL_DEFINITIONS[0].maxExperience,
        totalPoints: 0,
        pointsByType: {
          [PointType.EFFICIENCY_POINTS]: 0,
          [PointType.SAFETY_POINTS]: 0,
          [PointType.OPTIMIZATION_POINTS]: 0,
          [PointType.ENGAGEMENT_POINTS]: 0,
          [PointType.BONUS_POINTS]: 0
        },
        achievementsUnlocked: 0,
        totalAchievements: this.achievements.size,
        currentStreak: 0,
        longestStreak: 0,
        joinedAt: new Date(),
        lastActiveAt: new Date()
      };

      this.profiles.set(userId, profile);
      this.userMetrics.set(userId, new Map());
      this.userStreaks.set(userId, new Map());
      this.userAchievements.set(userId, []);
      this.pointTransactions.set(userId, []);
      this.notifications.set(userId, []);

      // Award first steps achievement
      await this.recordEvent(userId, 'first_day_complete');
    }

    return profile;
  }

  /**
   * Award points to a user
   */
  async awardPoints(
    userId: string,
    type: PointType,
    amount: number,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<PointTransaction> {
    const profile = await this.getOrCreateProfile(userId);

    const transaction: PointTransaction = {
      id: uuidv4(),
      userId,
      type,
      amount,
      reason,
      metadata,
      createdAt: new Date()
    };

    // Update profile
    profile.totalPoints += amount;
    profile.pointsByType[type] += amount;
    profile.lastActiveAt = new Date();

    // Add experience (1 point = 1 XP by default)
    await this.addExperience(userId, amount);

    // Store transaction
    const transactions = this.pointTransactions.get(userId) || [];
    transactions.push(transaction);
    this.pointTransactions.set(userId, transactions);

    // Emit event
    this.emit('points_awarded', { userId, transaction });

    return transaction;
  }

  /**
   * Add experience and handle level ups
   */
  async addExperience(userId: string, amount: number): Promise<{ leveledUp: boolean; newLevel?: number }> {
    const profile = await this.getOrCreateProfile(userId);

    profile.experience += amount;

    // Check for level up
    const currentLevelDef = LEVEL_DEFINITIONS[profile.level - 1];
    const nextLevelDef = LEVEL_DEFINITIONS[profile.level];

    if (nextLevelDef && profile.experience >= nextLevelDef.minExperience) {
      profile.level++;
      profile.experienceToNextLevel = nextLevelDef.maxExperience;

      // Create level up notification
      await this.createNotification(userId, {
        type: 'level_up',
        title: `Level Up! You're now level ${profile.level}`,
        message: `Congratulations! You've reached ${nextLevelDef.name} level.`,
        data: { level: profile.level, levelName: nextLevelDef.name }
      });

      this.emit('level_up', { userId, level: profile.level });

      return { leveledUp: true, newLevel: profile.level };
    }

    return { leveledUp: false };
  }

  /**
   * Record a metric value for achievement tracking
   */
  async recordMetric(userId: string, metric: string, value: number): Promise<void> {
    await this.getOrCreateProfile(userId);

    const metrics = this.userMetrics.get(userId)!;
    const currentValue = metrics.get(metric) || 0;
    metrics.set(metric, currentValue + value);

    // Check achievements that depend on this metric
    await this.checkAchievements(userId, metric);
  }

  /**
   * Record an event for achievement tracking
   */
  async recordEvent(userId: string, eventName: string): Promise<void> {
    await this.getOrCreateProfile(userId);

    // Check event-based achievements
    for (const [achievementId, achievement] of this.achievements) {
      if (
        achievement.criteria.type === 'event' &&
        achievement.criteria.metric === eventName
      ) {
        await this.unlockAchievement(userId, achievementId);
      }
    }
  }

  /**
   * Update streak for a metric
   */
  async updateStreak(userId: string, metric: string, successful: boolean): Promise<number> {
    const profile = await this.getOrCreateProfile(userId);
    const streaks = this.userStreaks.get(userId)!;

    let streak = streaks.get(metric) || { count: 0, lastDate: new Date(0) };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastDate = new Date(streak.lastDate);
    lastDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (successful) {
      if (daysDiff === 1) {
        // Consecutive day
        streak.count++;
      } else if (daysDiff > 1) {
        // Streak broken
        streak.count = 1;
      }
      // daysDiff === 0 means same day, don't increment
      streak.lastDate = today;
    } else {
      // Failed, reset streak
      streak.count = 0;
    }

    streaks.set(metric, streak);

    // Update profile streaks
    if (metric === 'daily_login') {
      profile.currentStreak = streak.count;
      if (streak.count > profile.longestStreak) {
        profile.longestStreak = streak.count;
      }
    }

    // Check streak-based achievements
    await this.checkAchievements(userId, metric);

    // Check streak milestones
    const milestones = [7, 14, 30, 60, 90, 180, 365];
    if (milestones.includes(streak.count)) {
      await this.createNotification(userId, {
        type: 'streak_milestone',
        title: `${streak.count} Day Streak!`,
        message: `Amazing! You've maintained your ${metric.replace(/_/g, ' ')} streak for ${streak.count} days!`,
        data: { metric, streakCount: streak.count }
      });
    }

    return streak.count;
  }

  /**
   * Check and unlock achievements based on current metrics
   */
  private async checkAchievements(userId: string, metric: string): Promise<void> {
    const userAchievements = this.userAchievements.get(userId) || [];
    const metrics = this.userMetrics.get(userId)!;
    const streaks = this.userStreaks.get(userId)!;

    for (const [achievementId, achievement] of this.achievements) {
      // Skip if already unlocked
      if (userAchievements.find(ua => ua.achievementId === achievementId && ua.completed)) {
        continue;
      }

      // Check if this achievement is related to the updated metric
      if (achievement.criteria.metric !== metric) {
        continue;
      }

      let progress = 0;
      let shouldUnlock = false;

      switch (achievement.criteria.type) {
        case 'threshold':
          const value = metrics.get(metric) || 0;
          progress = Math.min(100, (value / (achievement.criteria.target || 1)) * 100);
          shouldUnlock = value >= (achievement.criteria.target || 0);
          break;

        case 'cumulative':
          const cumValue = metrics.get(metric) || 0;
          progress = Math.min(100, (cumValue / (achievement.criteria.target || 1)) * 100);
          shouldUnlock = cumValue >= (achievement.criteria.target || 0);
          break;

        case 'streak':
          const streak = streaks.get(metric);
          if (streak) {
            progress = Math.min(100, (streak.count / (achievement.criteria.duration || 1)) * 100);
            shouldUnlock = streak.count >= (achievement.criteria.duration || 0);
          }
          break;
      }

      // Update progress
      await this.updateAchievementProgress(userId, achievementId, progress);

      // Unlock if criteria met
      if (shouldUnlock) {
        await this.unlockAchievement(userId, achievementId);
      }
    }
  }

  /**
   * Update achievement progress
   */
  private async updateAchievementProgress(
    userId: string,
    achievementId: string,
    progress: number
  ): Promise<void> {
    const userAchievements = this.userAchievements.get(userId) || [];
    let userAchievement = userAchievements.find(ua => ua.achievementId === achievementId);

    if (!userAchievement) {
      userAchievement = {
        id: uuidv4(),
        userId,
        achievementId,
        progress: 0,
        completed: false,
        claimed: false
      };
      userAchievements.push(userAchievement);
      this.userAchievements.set(userId, userAchievements);
    }

    userAchievement.progress = progress;
  }

  /**
   * Unlock an achievement
   */
  async unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
    const achievement = this.achievements.get(achievementId);
    if (!achievement) return false;

    const userAchievements = this.userAchievements.get(userId) || [];
    let userAchievement = userAchievements.find(ua => ua.achievementId === achievementId);

    if (userAchievement?.completed) {
      return false; // Already unlocked
    }

    if (!userAchievement) {
      userAchievement = {
        id: uuidv4(),
        userId,
        achievementId,
        progress: 100,
        completed: true,
        completedAt: new Date(),
        claimed: false
      };
      userAchievements.push(userAchievement);
    } else {
      userAchievement.completed = true;
      userAchievement.completedAt = new Date();
      userAchievement.progress = 100;
    }

    this.userAchievements.set(userId, userAchievements);

    // Update profile
    const profile = await this.getOrCreateProfile(userId);
    profile.achievementsUnlocked++;

    // Create notification
    await this.createNotification(userId, {
      type: 'achievement_unlocked',
      title: `Achievement Unlocked: ${achievement.name}`,
      message: achievement.description,
      data: {
        achievementId,
        name: achievement.name,
        icon: achievement.icon,
        rarity: achievement.rarity,
        points: achievement.points
      }
    });

    this.emit('achievement_unlocked', { userId, achievement });

    return true;
  }

  /**
   * Claim achievement rewards
   */
  async claimAchievementRewards(userId: string, achievementId: string): Promise<Reward[] | null> {
    const achievement = this.achievements.get(achievementId);
    if (!achievement) return null;

    const userAchievements = this.userAchievements.get(userId) || [];
    const userAchievement = userAchievements.find(
      ua => ua.achievementId === achievementId && ua.completed && !ua.claimed
    );

    if (!userAchievement) return null;

    // Mark as claimed
    userAchievement.claimed = true;
    userAchievement.claimedAt = new Date();

    // Award points
    await this.awardPoints(
      userId,
      this.getCategoryPointType(achievement.category),
      achievement.points,
      `Achievement: ${achievement.name}`
    );

    // Apply other rewards
    const rewards: Reward[] = [
      { type: 'points', value: achievement.points, description: `${achievement.points} points` }
    ];

    if (achievement.rewards) {
      rewards.push(...achievement.rewards);
      // Process additional rewards (badges, titles, etc.)
      for (const reward of achievement.rewards) {
        await this.processReward(userId, reward);
      }
    }

    return rewards;
  }

  /**
   * Process a reward
   */
  private async processReward(userId: string, reward: Reward): Promise<void> {
    const profile = await this.getOrCreateProfile(userId);

    switch (reward.type) {
      case 'title':
        profile.title = reward.value as string;
        break;
      case 'points':
        await this.awardPoints(
          userId,
          PointType.BONUS_POINTS,
          reward.value as number,
          reward.description
        );
        break;
      // Handle other reward types
    }
  }

  /**
   * Get point type for achievement category
   */
  private getCategoryPointType(category: AchievementCategory): PointType {
    const mapping: Record<AchievementCategory, PointType> = {
      [AchievementCategory.EFFICIENCY]: PointType.EFFICIENCY_POINTS,
      [AchievementCategory.RELIABILITY]: PointType.EFFICIENCY_POINTS,
      [AchievementCategory.SAFETY]: PointType.SAFETY_POINTS,
      [AchievementCategory.OPTIMIZATION]: PointType.OPTIMIZATION_POINTS,
      [AchievementCategory.LEARNING]: PointType.ENGAGEMENT_POINTS,
      [AchievementCategory.ENGAGEMENT]: PointType.ENGAGEMENT_POINTS,
      [AchievementCategory.SUSTAINABILITY]: PointType.EFFICIENCY_POINTS
    };
    return mapping[category] || PointType.BONUS_POINTS;
  }

  /**
   * Get user achievements
   */
  async getUserAchievements(userId: string): Promise<{
    unlocked: (UserAchievement & { achievement: Achievement })[];
    inProgress: (UserAchievement & { achievement: Achievement })[];
    locked: Achievement[];
  }> {
    await this.getOrCreateProfile(userId);
    const userAchievements = this.userAchievements.get(userId) || [];

    const unlocked: (UserAchievement & { achievement: Achievement })[] = [];
    const inProgress: (UserAchievement & { achievement: Achievement })[] = [];
    const locked: Achievement[] = [];

    for (const [id, achievement] of this.achievements) {
      const userAch = userAchievements.find(ua => ua.achievementId === id);

      if (userAch?.completed) {
        unlocked.push({ ...userAch, achievement });
      } else if (userAch && userAch.progress > 0) {
        inProgress.push({ ...userAch, achievement });
      } else if (!achievement.hidden) {
        locked.push(achievement);
      }
    }

    return { unlocked, inProgress, locked };
  }

  /**
   * Create a challenge
   */
  async createChallenge(challenge: Omit<Challenge, 'id' | 'participants' | 'status'>): Promise<Challenge> {
    const newChallenge: Challenge = {
      ...challenge,
      id: uuidv4(),
      participants: 0,
      status: ChallengeStatus.ACTIVE
    };

    this.challenges.set(newChallenge.id, newChallenge);
    return newChallenge;
  }

  /**
   * Join a challenge
   */
  async joinChallenge(userId: string, challengeId: string): Promise<UserChallenge | null> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.status !== ChallengeStatus.ACTIVE) {
      return null;
    }

    if (challenge.maxParticipants && (challenge.participants || 0) >= challenge.maxParticipants) {
      return null;
    }

    const userChallenges = this.userChallenges.get(userId) || [];
    if (userChallenges.find(uc => uc.challengeId === challengeId)) {
      return null; // Already joined
    }

    const userChallenge: UserChallenge = {
      id: uuidv4(),
      userId,
      challengeId,
      joined: new Date(),
      progress: 0,
      status: ChallengeStatus.ACTIVE
    };

    userChallenges.push(userChallenge);
    this.userChallenges.set(userId, userChallenges);

    challenge.participants = (challenge.participants || 0) + 1;

    return userChallenge;
  }

  /**
   * Update challenge progress
   */
  async updateChallengeProgress(userId: string, challengeId: string, value: number): Promise<void> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return;

    const userChallenges = this.userChallenges.get(userId) || [];
    const userChallenge = userChallenges.find(uc => uc.challengeId === challengeId);

    if (!userChallenge || userChallenge.status !== ChallengeStatus.ACTIVE) return;

    // Calculate progress
    const progress = (value / challenge.criteria.target) * 100;
    userChallenge.progress = Math.min(100, progress);

    // Check completion
    if (this.checkChallengeCriteria(challenge.criteria, value)) {
      userChallenge.status = ChallengeStatus.COMPLETED;

      // Award rewards
      for (const reward of challenge.rewards) {
        await this.processReward(userId, reward);
      }

      await this.createNotification(userId, {
        type: 'challenge_complete',
        title: `Challenge Complete: ${challenge.name}`,
        message: 'Congratulations! You completed the challenge.',
        data: { challengeId, rewards: challenge.rewards }
      });
    }
  }

  /**
   * Check challenge criteria
   */
  private checkChallengeCriteria(criteria: ChallengeCriteria, value: number): boolean {
    switch (criteria.comparison) {
      case 'gte': return value >= criteria.target;
      case 'lte': return value <= criteria.target;
      case 'eq': return value === criteria.target;
      case 'between': return value >= criteria.target && value <= (criteria.targetEnd || Infinity);
      default: return false;
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(
    timeframe: LeaderboardTimeframe = LeaderboardTimeframe.ALL_TIME,
    limit: number = 10
  ): Promise<LeaderboardEntry[]> {
    const profiles = Array.from(this.profiles.values());

    // Filter by timeframe
    const now = new Date();
    let filteredProfiles = profiles;

    if (timeframe !== LeaderboardTimeframe.ALL_TIME) {
      const cutoff = new Date();
      switch (timeframe) {
        case LeaderboardTimeframe.DAILY:
          cutoff.setDate(cutoff.getDate() - 1);
          break;
        case LeaderboardTimeframe.WEEKLY:
          cutoff.setDate(cutoff.getDate() - 7);
          break;
        case LeaderboardTimeframe.MONTHLY:
          cutoff.setMonth(cutoff.getMonth() - 1);
          break;
      }
      filteredProfiles = profiles.filter(p => p.lastActiveAt >= cutoff);
    }

    // Sort by points
    filteredProfiles.sort((a, b) => b.totalPoints - a.totalPoints);

    // Create leaderboard entries
    return filteredProfiles.slice(0, limit).map((profile, index) => ({
      rank: index + 1,
      userId: profile.userId,
      displayName: profile.displayName,
      avatar: profile.avatar,
      level: profile.level,
      points: profile.totalPoints
    }));
  }

  /**
   * Create notification
   */
  async createNotification(
    userId: string,
    notification: Omit<GamificationNotification, 'id' | 'userId' | 'read' | 'createdAt'>
  ): Promise<GamificationNotification> {
    const newNotification: GamificationNotification = {
      ...notification,
      id: uuidv4(),
      userId,
      read: false,
      createdAt: new Date()
    };

    const notifications = this.notifications.get(userId) || [];
    notifications.unshift(newNotification);

    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.splice(100);
    }

    this.notifications.set(userId, notifications);

    this.emit('notification', { userId, notification: newNotification });

    return newNotification;
  }

  /**
   * Get user notifications
   */
  async getNotifications(userId: string, unreadOnly: boolean = false): Promise<GamificationNotification[]> {
    const notifications = this.notifications.get(userId) || [];

    if (unreadOnly) {
      return notifications.filter(n => !n.read);
    }

    return notifications;
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
    const notifications = this.notifications.get(userId) || [];
    const notification = notifications.find(n => n.id === notificationId);

    if (notification) {
      notification.read = true;
      return true;
    }

    return false;
  }

  /**
   * Get all achievements
   */
  getAllAchievements(): Achievement[] {
    return Array.from(this.achievements.values()).filter(a => !a.hidden);
  }

  /**
   * Get active challenges
   */
  getActiveChallenges(): Challenge[] {
    const now = new Date();
    return Array.from(this.challenges.values()).filter(
      c => c.status === ChallengeStatus.ACTIVE && c.endDate > now
    );
  }

  /**
   * Get user profile
   */
  getProfile(userId: string): GamificationProfile | undefined {
    return this.profiles.get(userId);
  }

  /**
   * Update profile display name
   */
  async updateDisplayName(userId: string, displayName: string): Promise<boolean> {
    const profile = this.profiles.get(userId);
    if (profile) {
      profile.displayName = displayName;
      return true;
    }
    return false;
  }

  /**
   * Record daily login
   */
  async recordDailyLogin(userId: string): Promise<{ streak: number; bonusPoints: number }> {
    const streak = await this.updateStreak(userId, 'daily_login', true);

    // Award streak bonus points
    let bonusPoints = 10; // Base daily login points
    if (streak >= 7) bonusPoints += 5;
    if (streak >= 30) bonusPoints += 10;
    if (streak >= 100) bonusPoints += 25;

    await this.awardPoints(
      userId,
      PointType.ENGAGEMENT_POINTS,
      bonusPoints,
      `Daily login (${streak} day streak)`
    );

    return { streak, bonusPoints };
  }
}

// Singleton instance
export const gamificationService = new GamificationService();
