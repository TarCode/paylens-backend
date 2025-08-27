import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);

// Reset usage for specific user
router.post('/users/:userId/reset-usage', adminController.resetUserUsage.bind(adminController));

// Reset usage for all users
router.post('/reset-all-usage', adminController.resetAllUsage.bind(adminController));

// Get usage statistics
router.get('/usage-stats', adminController.getUsageStats.bind(adminController));

// Scheduler management
router.get('/scheduler/status', adminController.getSchedulerStatus.bind(adminController));
router.post('/scheduler/trigger-reset', adminController.triggerMonthlyReset.bind(adminController));

export default router;
