import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { GoogleProfile } from '../models/User';

export class AuthController {
    // Validation rules
    registerValidation = [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long'),
        body('firstName')
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('First name must be between 2 and 100 characters'),
        body('lastName')
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Last name must be between 2 and 100 characters'),
        body('companyName')
            .optional()
            .trim()
            .isLength({ max: 255 })
            .withMessage('Company name must be less than 255 characters')
    ];

    loginValidation = [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email'),
        body('password')
            .notEmpty()
            .withMessage('Password is required')
    ];

    async register(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Validation failed',
                        details: errors.array()
                    }
                });
            }

            const { email, password, firstName, lastName, companyName } = req.body;

            // Validate password strength
            const passwordValidation = authService.validatePassword(password);
            if (!passwordValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Password does not meet requirements',
                        details: passwordValidation.errors
                    }
                });
            }

            const result = await authService.register({
                email,
                password,
                firstName,
                lastName,
                companyName
            });

            const sanitizedUser = authService.sanitizeUser(result.user);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: sanitizedUser,
                    tokens: result.tokens
                }
            });
        } catch (error: any) {
            if (error.message === 'User with this email already exists') {
                return res.status(409).json({
                    success: false,
                    error: {
                        message: error.message
                    }
                });
            }
            next(error);
        }
    }

    async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Validation failed',
                        details: errors.array()
                    }
                });
            }

            const { email, password } = req.body;

            const result = await authService.login({ email, password });

            console.log('Login result user:', result.user); // Debug logging
            console.log('isActive type:', typeof result.user.isActive); // Debug logging
            console.log('isActive value:', result.user.isActive); // Debug logging

            const sanitizedUser = authService.sanitizeUser(result.user);

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: sanitizedUser,
                    tokens: result.tokens
                }
            });
        } catch (error: any) {
            if (error.message === 'Invalid email or password' ||
                error.message === 'Account is deactivated. Please contact support.') {
                return res.status(401).json({
                    success: false,
                    error: {
                        message: error.message
                    }
                });
            }
            next(error);
        }
    }

    async refreshToken(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Refresh token is required'
                    }
                });
            }

            const result = await authService.refreshToken(refreshToken);

            const sanitizedUser = authService.sanitizeUser(result.user);

            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    user: sanitizedUser,
                    tokens: result.tokens
                }
            });
        } catch (error: any) {
            return res.status(401).json({
                success: false,
                error: {
                    message: error.message
                }
            });
        }
    }

    async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const user = await userService.findById(req.user!.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: {
                        message: 'User not found'
                    }
                });
            }

            const sanitizedUser = authService.sanitizeUser(user);

            res.json({
                success: true,
                data: {
                    user: sanitizedUser
                }
            });
        } catch (error) {
            next(error);
        }
    }

    async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { firstName, lastName, companyName } = req.body;

            const updateData: any = {};
            if (firstName !== undefined) updateData.firstName = firstName;
            if (lastName !== undefined) updateData.lastName = lastName;
            if (companyName !== undefined) updateData.companyName = companyName;

            const updatedUser = await userService.updateUser(req.user!.id, updateData);
            if (!updatedUser) {
                return res.status(404).json({
                    success: false,
                    error: {
                        message: 'User not found'
                    }
                });
            }

            const sanitizedUser = authService.sanitizeUser(updatedUser);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    user: sanitizedUser
                }
            });
        } catch (error) {
            next(error);
        }
    }

    async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Current password and new password are required'
                    }
                });
            }

            // Validate new password strength
            const passwordValidation = authService.validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'New password does not meet requirements',
                        details: passwordValidation.errors
                    }
                });
            }

            // Get user with password
            const user = await userService.findById(req.user!.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: {
                        message: 'User not found'
                    }
                });
            }

            // Check if user has a password (traditional login users)
            if (!user.password) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'This account uses Google OAuth and does not have a password to change'
                    }
                });
            }

            // Validate current password
            const isValidCurrentPassword = await userService.validatePassword(currentPassword, user.password);
            if (!isValidCurrentPassword) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Current password is incorrect'
                    }
                });
            }

            // Update password
            await userService.updatePassword(req.user!.id, newPassword);

            res.json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Email is required'
                    }
                });
            }

            // Always return success for security (don't reveal if email exists)
            try {
                await authService.generatePasswordResetToken(email);
                // In a real implementation, send email here
            } catch (error) {
                // Silently ignore errors for security
            }

            res.json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.'
            });
        } catch (error) {
            next(error);
        }
    }

    async resetPassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Token and new password are required'
                    }
                });
            }

            // Validate password strength
            const passwordValidation = authService.validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Password does not meet requirements',
                        details: passwordValidation.errors
                    }
                });
            }

            await authService.resetPassword(token, newPassword);

            res.json({
                success: true,
                message: 'Password reset successfully'
            });
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                error: {
                    message: error.message
                }
            });
        }
    }

    async googleAuthCallback(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        message: 'Google authentication failed'
                    }
                });
            }

            // The user profile is set by passport - it should be a GoogleProfile
            const profile = req.user as any as GoogleProfile;

            const result = await authService.authenticateWithGoogle(profile);
            const sanitizedUser = authService.sanitizeUser(result.user);

            // For API response, return JSON with tokens
            // In a real frontend integration, you'd redirect to the frontend with tokens
            res.json({
                success: true,
                message: result.isNewUser ? 'User registered successfully with Google' : 'Login successful with Google',
                data: {
                    user: sanitizedUser,
                    tokens: result.tokens,
                    isNewUser: result.isNewUser
                }
            });
        } catch (error: any) {
            console.error('Google auth callback error:', error);
            return res.status(500).json({
                success: false,
                error: {
                    message: error.message || 'Google authentication failed'
                }
            });
        }
    }

    async googleJWTAuth(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { credential } = req.body;

            if (!credential) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Google JWT credential is required'
                    }
                });
            }

            // Decode the JWT token to get user info
            const payload = JSON.parse(Buffer.from(credential.split('.')[1], 'base64').toString());

            // Create a profile object similar to the Google Profile interface
            const profile: GoogleProfile = {
                id: payload.sub,
                email: payload.email,
                verified_email: payload.email_verified,
                name: payload.name,
                given_name: payload.given_name,
                family_name: payload.family_name,
                picture: payload.picture,
                locale: payload.locale || 'en'
            };

            const result = await authService.authenticateWithGoogle(profile);
            const sanitizedUser = authService.sanitizeUser(result.user);

            res.json({
                success: true,
                message: result.isNewUser ? 'User registered successfully with Google' : 'Login successful with Google',
                data: {
                    user: sanitizedUser,
                    tokens: result.tokens,
                    isNewUser: result.isNewUser
                }
            });
        } catch (error: any) {
            console.error('Google JWT auth error:', error);
            return res.status(500).json({
                success: false,
                error: {
                    message: error.message || 'Google authentication failed'
                }
            });
        }
    }
}

export const authController = new AuthController();
