import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request interface to include user
declare global {
    namespace Express {
        interface User {
            id: string;
            email: string;
            role: string;
            subscriptionTier: string;
            usageCount: number;
            monthlyLimit: number;
            lastUsageReset: Date;
            billingPeriodStart: Date;
        }
    }
}

export interface AuthRequest extends Request {
    user?: Express.User;
}

/**
 * Enhanced authentication middleware that combines JWT verification and user existence check.
 * This middleware should be used for all protected routes.
 * 
 * @example
 * In your route file:
 * router.get('/profile', authenticateAndEnsureUser, userController.getProfile);
 * 
 * For routes that also need role checking:
 * router.get('/admin', authenticateAndEnsureUser, requireRole(['admin']), adminController.getData);
 * 
 * For routes that need subscription limit checking:
 * router.post('/api-call', authenticateAndEnsureUser, checkSubscriptionLimits, apiController.makeCall);
 */
export const authenticateAndEnsureUser = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response | void> => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Access token is required'
                }
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

        // Add user to request object
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role || 'user',
            subscriptionTier: decoded.subscriptionTier || 'free',
            usageCount: decoded.usageCount || 0,
            monthlyLimit: decoded.monthlyLimit || 100,
            lastUsageReset: decoded.lastUsageReset || new Date(),
            billingPeriodStart: decoded.billingPeriodStart || new Date()
        };

        // Ensure user exists (this should always pass after the above assignment)
        if (!req.user) {
            return res.status(500).json({
                success: false,
                error: {
                    message: 'Authentication failed'
                }
            });
        }

        next();
    } catch (error) {
        console.error('JWT verification error:', error);
        return res.status(401).json({
            success: false,
            error: {
                message: 'Invalid or expired token'
            }
        });
    }
};
