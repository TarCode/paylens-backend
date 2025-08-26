import { Router } from 'express';
import passport from 'passport';
import { authController } from '../../controllers/auth/auth.controller';
import { authenticateToken } from '../../middleware/auth.middleware';
import { userService } from '../../services/database/user.service';

const router = Router();

// Public routes (no authentication required)
router.post('/register', authController.registerValidation, authController.register);
router.post('/login', authController.loginValidation, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Google OAuth routes
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    authController.googleAuthCallback
);

// New endpoint for Google Identity Services (frontend sends JWT directly)
router.post('/google/jwt', authController.googleJWTAuth);

// Debug endpoint to check user data
router.get('/debug-user/:email', async (req, res) => {
    try {
        const user = await userService.findByEmail(req.params.email);
        res.json({
            success: true,
            user: user,
            isActiveType: typeof user?.isActive,
            isActiveValue: user?.isActive,
            googleId: user?.googleId,
            rawUser: JSON.stringify(user, null, 2)
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint to fix user status
router.post('/debug-fix-user/:email', async (req, res) => {
    try {
        const user = await userService.findByEmail(req.params.email);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const updatedUser = await userService.updateUser(user.id, {
            isActive: true,
            emailVerified: true
        });

        return res.json({
            success: true,
            message: 'User fixed',
            before: {
                isActive: user.isActive,
                emailVerified: user.emailVerified
            },
            after: {
                isActive: updatedUser?.isActive,
                emailVerified: updatedUser?.emailVerified
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Protected routes (authentication required)
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);
router.post('/change-password', authenticateToken, authController.changePassword);

export default router;
