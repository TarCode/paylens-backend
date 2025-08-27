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

export const authenticateToken = async (
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

export const checkSubscriptionLimits = (
    req: Request,
    res: Response,
    next: NextFunction
): Response | void => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: 'User not authenticated' }
        });
    }

    const { usageCount, monthlyLimit, subscriptionTier } = req.user;

    // Skip limits for enterprise users
    if (subscriptionTier === 'enterprise') {
        return next();
    }

    // Check usage limits
    if (usageCount >= monthlyLimit) {
        return res.status(429).json({
            success: false,
            error: {
                message: 'Monthly usage limit exceeded. Please upgrade your subscription.',
                code: 'USAGE_LIMIT_EXCEEDED',
                currentUsage: usageCount,
                limit: monthlyLimit
            }
        });
    }

    next();
};

export const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): Response | void => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: { message: 'User not authenticated' }
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Insufficient permissions',
                    requiredRoles: roles,
                    userRole: req.user.role
                }
            });
        }

        next();
    };
};
