import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { usageController } from '../controllers/usage.controller';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Rate limiting for usage operations - stricter limits
const usageRateLimit = rateLimit({
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

// Security middleware for usage routes
const securityMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Log suspicious activity
    const userAgent = req.get('User-Agent') || '';
    const suspiciousPatterns = ['curl', 'wget', 'python', 'bot', 'crawler'];

    if (suspiciousPatterns.some(pattern => userAgent.toLowerCase().includes(pattern))) {
        console.warn(`🚨 Suspicious usage request from ${req.ip}:`, {
            userAgent,
            userId: req.user?.id,
            endpoint: req.path,
            method: req.method
        });
    }

    // Add security headers
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
    });

    next();
};

// All usage routes require authentication
router.use(authenticateToken);
router.use(securityMiddleware);

// Get current usage data
router.get('/', usageController.getUsage.bind(usageController));

// Increment usage count (limits are now checked atomically in the database)
router.post('/increment', usageRateLimit, usageController.incrementUsage.bind(usageController));

export default router;
