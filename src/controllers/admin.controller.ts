import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { userService } from '../services/database/user.service';
import { schedulerService } from '../services/scheduler.service';

export class AdminController {
    // Reset usage for a specific user
    async resetUserUsage(req: AuthRequest, res: Response): Promise<Response> {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: { message: 'User not authenticated' }
                });
            }

            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Admin access required' }
                });
            }

            const { userId } = req.params;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'User ID is required' }
                });
            }

            const resetResult = await userService.resetMonthlyUsage(userId);

            if (resetResult.errors.length > 0) {
                return res.status(500).json({
                    success: false,
                    error: { message: resetResult.errors[0] }
                });
            }

            return res.json({
                success: true,
                data: {
                    message: `Reset usage for ${resetResult.resetCount} user(s)`,
                    resetCount: resetResult.resetCount
                }
            });
        } catch (error) {
            console.error('Admin reset user usage error:', error);
            return res.status(500).json({
                success: false,
                error: { message: 'Failed to reset user usage' }
            });
        }
    }

    // Reset usage for all users
    async resetAllUsage(req: AuthRequest, res: Response): Promise<Response> {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: { message: 'User not authenticated' }
                });
            }

            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Admin access required' }
                });
            }

            const resetResult = await userService.resetMonthlyUsage();

            if (resetResult.errors.length > 0) {
                return res.status(500).json({
                    success: false,
                    error: { message: resetResult.errors[0] }
                });
            }

            return res.json({
                success: true,
                data: {
                    message: `Reset usage for ${resetResult.resetCount} user(s)`,
                    resetCount: resetResult.resetCount
                }
            });
        } catch (error) {
            console.error('Admin reset all usage error:', error);
            return res.status(500).json({
                success: false,
                error: { message: 'Failed to reset usage for all users' }
            });
        }
    }

    // Get usage statistics for all users
    async getUsageStats(req: AuthRequest, res: Response): Promise<Response> {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: { message: 'User not authenticated' }
                });
            }

            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Admin access required' }
                });
            }

            const users = await userService.getAllUsers(1000); // Get up to 1000 users

            const stats = {
                totalUsers: users.length,
                activeUsers: users.filter(u => u.isActive).length,
                usageByTier: {
                    free: users.filter(u => u.subscriptionTier === 'free').length,
                    pro: users.filter(u => u.subscriptionTier === 'pro').length,
                    business: users.filter(u => u.subscriptionTier === 'business').length,
                    enterprise: users.filter(u => u.subscriptionTier === 'enterprise').length
                },
                totalUsage: users.reduce((sum, u) => sum + u.usageCount, 0),
                usersNearLimit: users.filter(u =>
                    u.subscriptionTier !== 'enterprise' &&
                    u.usageCount >= u.monthlyLimit * 0.8
                ).length,
                usersAtLimit: users.filter(u =>
                    u.subscriptionTier !== 'enterprise' &&
                    u.usageCount >= u.monthlyLimit
                ).length
            };

            return res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Admin get usage stats error:', error);
            return res.status(500).json({
                success: false,
                error: { message: 'Failed to get usage statistics' }
            });
        }
    }

    // Get scheduler status
    async getSchedulerStatus(req: AuthRequest, res: Response): Promise<Response> {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: { message: 'User not authenticated' }
                });
            }

            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Admin access required' }
                });
            }

            const status = schedulerService.getStatus();

            return res.json({
                success: true,
                data: {
                    schedulerRunning: status.isRunning,
                    nextCheck: status.nextCheck?.toISOString(),
                    message: status.isRunning
                        ? `Scheduler running, next check: ${status.nextCheck?.toLocaleString()}`
                        : 'Scheduler not running'
                }
            });
        } catch (error) {
            console.error('Admin get scheduler status error:', error);
            return res.status(500).json({
                success: false,
                error: { message: 'Failed to get scheduler status' }
            });
        }
    }

    // Manually trigger monthly reset
    async triggerMonthlyReset(req: AuthRequest, res: Response): Promise<Response> {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: { message: 'User not authenticated' }
                });
            }

            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Admin access required' }
                });
            }

            const resetResult = await schedulerService.triggerMonthlyReset();

            if (resetResult.errors.length > 0) {
                return res.status(500).json({
                    success: false,
                    error: { message: resetResult.errors[0] }
                });
            }

            return res.json({
                success: true,
                data: {
                    message: `Manual monthly reset completed: ${resetResult.resetCount} user(s) had their usage reset`,
                    resetCount: resetResult.resetCount
                }
            });
        } catch (error) {
            console.error('Admin trigger monthly reset error:', error);
            return res.status(500).json({
                success: false,
                error: { message: 'Failed to trigger monthly reset' }
            });
        }
    }
}

export const adminController = new AdminController();
