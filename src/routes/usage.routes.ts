import { Router } from 'express';
import { usageController } from '../controllers/usage.controller';
import { authenticateAndEnsureUser } from '../middleware/auth.middleware';
import { securityMiddleware } from '../middleware/security.middleware';
import { usageRateLimit } from '@/middleware/rateLimit.middleware';

const router = Router();

// All usage routes require authentication
router.use(authenticateAndEnsureUser);
router.use(securityMiddleware);

// Get current usage data
router.get('/', usageController.getUsage.bind(usageController));

// Increment usage count (limits are now checked atomically in the database)
router.post('/increment', usageRateLimit, usageController.incrementUsage.bind(usageController));

export default router;
