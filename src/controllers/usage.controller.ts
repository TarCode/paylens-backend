import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { userService } from '../services/database/user.service';
import { authService } from '../services/auth/auth.service';

// In-memory request deduplication cache (use Redis in production)
const recentRequests = new Map<string, number>();
const REQUEST_DEDUPE_WINDOW = 5000; // 5 seconds

export class UsageController {
    async incrementUsage(req: AuthRequest, res: Response): Promise<Response> {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: { message: 'User not authenticated' }
                });
            }

            const userId = req.user.id;
            const requestKey = `${userId}-${Date.now()}`;
            const now = Date.now();

            // Request deduplication - prevent rapid duplicate requests
            if (recentRequests.has(userId)) {
                const lastRequestTime = recentRequests.get(userId)!;
                if (now - lastRequestTime < REQUEST_DEDUPE_WINDOW) {
                    console.warn(`🚨 Rapid usage request blocked for user ${userId} from ${req.ip}`);
                    return res.status(429).json({
                        success: false,
                        error: {
                            message: 'Request too frequent. Please wait before trying again.',
                            code: 'REQUEST_TOO_FREQUENT'
                        }
                    });
                }
            }
            recentRequests.set(userId, now);

            // Clean up old entries from deduplication cache
            for (const [key, timestamp] of recentRequests.entries()) {
                if (now - timestamp > REQUEST_DEDUPE_WINDOW * 2) {
                    recentRequests.delete(key);
                }
            }

            // Increment usage count with atomic limit checking
            const result = await userService.incrementUsageCount(userId);

            if (!result.canIncrement) {
                // Log usage limit violations for monitoring
                if (result.error?.includes('limit exceeded')) {
                    console.warn(`🚨 Usage limit exceeded for user ${userId} from ${req.ip}:`, {
                        currentUsage: result.user?.usageCount,
                        monthlyLimit: result.user?.monthlyLimit,
                        subscriptionTier: result.user?.subscriptionTier
                    });
                }

                // Determine appropriate status code based on error
                const statusCode = result.error?.includes('not found') ? 404 :
                    result.error?.includes('limit exceeded') ? 429 : 400;

                return res.status(statusCode).json({
                    success: false,
                    error: {
                        message: result.error,
                        code: statusCode === 429 ? 'USAGE_LIMIT_EXCEEDED' : 'INCREMENT_FAILED',
                        currentUsage: result.user?.usageCount,
                        limit: result.user?.monthlyLimit
                    }
                });
            }

            // Generate new tokens with updated usage count
            const tokens = await authService.generateTokens(result.user!);

            return res.json({
                success: true,
                data: {
                    user: result.user,
                    tokens: tokens,
                    usageCount: result.user!.usageCount,
                    monthlyLimit: result.user!.monthlyLimit
                }
            });
        } catch (error) {
            console.error('Increment usage error:', error);
            return res.status(500).json({
                success: false,
                error: { message: 'Failed to increment usage' }
            });
        }
    }

    async getUsage(req: AuthRequest, res: Response): Promise<Response> {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: { message: 'User not authenticated' }
                });
            }

            const userId = req.user.id;
            const user = await userService.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: { message: 'User not found' }
                });
            }

            return res.json({
                success: true,
                data: {
                    usageCount: user.usageCount,
                    monthlyLimit: user.monthlyLimit,
                    subscriptionTier: user.subscriptionTier,
                    usagePercentage: user.monthlyLimit > 0 ?
                        Math.round((user.usageCount / user.monthlyLimit) * 100) : 0
                }
            });
        } catch (error) {
            console.error('Get usage error:', error);
            return res.status(500).json({
                success: false,
                error: { message: 'Failed to get usage data' }
            });
        }
    }
}

export const usageController = new UsageController();
