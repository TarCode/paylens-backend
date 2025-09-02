import { Router } from 'express';
import passport from 'passport';
import { authController } from '../controllers/auth.controller';
import { authenticateAndEnsureUser } from '../middleware/auth.middleware';

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

// Protected routes (authentication required)
router.get('/profile', authenticateAndEnsureUser, authController.getProfile);
router.put('/profile', authenticateAndEnsureUser, authController.updateProfile);
router.post('/change-password', authenticateAndEnsureUser, authController.changePassword);

export default router;
