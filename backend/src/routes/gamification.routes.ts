/**
 * Gamification Routes
 * API endpoints for gamification features
 */

import { Router, Request, Response } from 'express';
import { gamificationService } from '../services/gamification/gamification.service';
import { LeaderboardTimeframe, PointType } from '../services/gamification/gamification.types';

const router = Router();

/**
 * @route GET /api/v1/gamification/profile
 * @desc Get user's gamification profile
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid || 'demo-user';
    const profile = await gamificationService.getOrCreateProfile(userId);

    res.json({
      success: true,
      data: profile
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route PUT /api/v1/gamification/profile/display-name
 * @desc Update user's display name
 */
router.put('/profile/display-name', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid || 'demo-user';
    const { displayName } = req.body;

    if (!displayName || typeof displayName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Display name is required'
      });
    }

    const success = await gamificationService.updateDisplayName(userId, displayName);

    res.json({
      success,
      message: success ? 'Display name updated' : 'Failed to update display name'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/gamification/achievements
 * @desc Get all achievements (user's progress included)
 */
router.get('/achievements', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid || 'demo-user';
    const achievements = await gamificationService.getUserAchievements(userId);

    res.json({
      success: true,
      data: achievements
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/gamification/achievements/all
 * @desc Get all available achievements (without user progress)
 */
router.get('/achievements/all', async (req: Request, res: Response) => {
  try {
    const achievements = gamificationService.getAllAchievements();

    res.json({
      success: true,
      data: achievements,
      total: achievements.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/gamification/achievements/:id/claim
 * @desc Claim rewards for an unlocked achievement
 */
router.post('/achievements/:id/claim', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid || 'demo-user';
    const { id } = req.params;

    const rewards = await gamificationService.claimAchievementRewards(userId, id);

    if (rewards) {
      res.json({
        success: true,
        data: { rewards },
        message: 'Rewards claimed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Cannot claim rewards for this achievement'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/gamification/challenges
 * @desc Get active challenges
 */
router.get('/challenges', async (req: Request, res: Response) => {
  try {
    const challenges = gamificationService.getActiveChallenges();

    res.json({
      success: true,
      data: challenges,
      total: challenges.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/gamification/challenges/:id/join
 * @desc Join a challenge
 */
router.post('/challenges/:id/join', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid || 'demo-user';
    const { id } = req.params;

    const userChallenge = await gamificationService.joinChallenge(userId, id);

    if (userChallenge) {
      res.json({
        success: true,
        data: userChallenge,
        message: 'Successfully joined challenge'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Cannot join this challenge'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/gamification/leaderboard
 * @desc Get leaderboard
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const { timeframe = 'all_time', limit = 10 } = req.query;

    const validTimeframes = Object.values(LeaderboardTimeframe);
    const tf = validTimeframes.includes(timeframe as LeaderboardTimeframe)
      ? (timeframe as LeaderboardTimeframe)
      : LeaderboardTimeframe.ALL_TIME;

    const leaderboard = await gamificationService.getLeaderboard(tf, Number(limit));

    res.json({
      success: true,
      data: leaderboard,
      timeframe: tf,
      total: leaderboard.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/gamification/notifications
 * @desc Get user notifications
 */
router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid || 'demo-user';
    const { unread } = req.query;

    const notifications = await gamificationService.getNotifications(
      userId,
      unread === 'true'
    );

    res.json({
      success: true,
      data: notifications,
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route PUT /api/v1/gamification/notifications/:id/read
 * @desc Mark notification as read
 */
router.put('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid || 'demo-user';
    const { id } = req.params;

    const success = await gamificationService.markNotificationRead(userId, id);

    res.json({
      success,
      message: success ? 'Notification marked as read' : 'Notification not found'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/gamification/daily-login
 * @desc Record daily login and get streak bonus
 */
router.post('/daily-login', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid || 'demo-user';

    const result = await gamificationService.recordDailyLogin(userId);

    res.json({
      success: true,
      data: result,
      message: `Daily login recorded! Streak: ${result.streak} days, Bonus: ${result.bonusPoints} points`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/gamification/events
 * @desc Record a gamification event (for internal use)
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid || 'demo-user';
    const { event, metric, value } = req.body;

    if (event) {
      await gamificationService.recordEvent(userId, event);
    }

    if (metric && typeof value === 'number') {
      await gamificationService.recordMetric(userId, metric, value);
    }

    res.json({
      success: true,
      message: 'Event recorded'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/gamification/points
 * @desc Award points (admin only)
 */
router.post('/points', async (req: Request, res: Response) => {
  try {
    const { userId, type, amount, reason } = req.body;

    if (!userId || !type || !amount || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, type, amount, reason'
      });
    }

    const validTypes = Object.values(PointType);
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid point type. Valid types: ${validTypes.join(', ')}`
      });
    }

    const transaction = await gamificationService.awardPoints(
      userId,
      type as PointType,
      amount,
      reason
    );

    res.json({
      success: true,
      data: transaction,
      message: `Awarded ${amount} ${type} to user ${userId}`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/gamification/stats
 * @desc Get gamification statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const allAchievements = gamificationService.getAllAchievements();
    const activeChallenges = gamificationService.getActiveChallenges();
    const topLeaderboard = await gamificationService.getLeaderboard(LeaderboardTimeframe.ALL_TIME, 5);

    res.json({
      success: true,
      data: {
        totalAchievements: allAchievements.length,
        activeChallenges: activeChallenges.length,
        topPlayers: topLeaderboard,
        achievementCategories: [
          'efficiency',
          'reliability',
          'safety',
          'optimization',
          'learning',
          'engagement',
          'sustainability'
        ]
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
