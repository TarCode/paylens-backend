import rateLimit from 'express-rate-limit';
import { AuthRequest } from './auth.middleware';

// Rate limiting for usage operations - stricter limits
export const usageRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each user to 20 usage increments per 15 minutes
    message: {
        success: false,
        error: {
            message: 'Too many usage requests. Please wait before trying again.',
            code: 'RATE_LIMIT_EXCEEDED'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => {
        // Use user ID from authenticated request for per-user rate limiting
        return req.user?.id || req.ip || 'unknown';
    },
    skip: (req: AuthRequest) => {
        // Skip rate limiting for enterprise users
        return req.user?.subscriptionTier === 'enterprise';
    }
});