import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { GoogleProfile } from '../models/User';
import { badRequest, created, notFound, ok, serverError, unauthorized } from '../validation/auth.validation';

export class AuthController {
    async register(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return badRequest(res, errors.array());
            }

            const { email, password, firstName, lastName, companyName } = req.body;

            // Validate password strength
            const passwordValidation = authService.validatePassword(password);
            if (!passwordValidation.isValid) {
                return badRequest(res, passwordValidation.errors);
            }

            const result = await authService.register({
                email,
                password,
                firstName,
                lastName,
                companyName
            });

            const sanitizedUser = authService.sanitizeUser(result.user);

            return created(
                res,
                {
                    user: sanitizedUser,
                    tokens: result.tokens
                }, 'User registered successfully'
            );
        } catch (error: any) {
            if (error.message === 'User with this email already exists') {
                return badRequest(res, error.message);
            }
            next(error);
        }
    }

    async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return badRequest(res, errors.array());
            }

            const { email, password } = req.body;

            const result = await authService.login({ email, password });

            console.log('Login result user:', result.user); // Debug logging
            console.log('isActive type:', typeof result.user.isActive); // Debug logging
            console.log('isActive value:', result.user.isActive); // Debug logging

            const sanitizedUser = authService.sanitizeUser(result.user);

            return ok(res, {
                user: sanitizedUser,
                tokens: result.tokens
            });
        } catch (error: any) {
            if (error.message === 'Invalid email or password' ||
                error.message === 'Account is deactivated. Please contact support.') {
                return unauthorized(res, error.message);
            }
            next(error);
        }
    }

    async refreshToken(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return badRequest(res, 'Refresh token is required');
            }

            const result = await authService.refreshToken(refreshToken);

            const sanitizedUser = authService.sanitizeUser(result.user);

            return ok(res, {
                user: sanitizedUser,
                tokens: result.tokens
            });
        } catch (error: any) {
            return unauthorized(res, error.message);
        }
    }

    async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const user = await userService.findById(req.user!.id);
            if (!user) {
                return notFound(res, 'User not found');
            }

            const sanitizedUser = authService.sanitizeUser(user);

            return ok(res, {
                user: sanitizedUser
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
                return notFound(res, 'User not found');
            }

            const sanitizedUser = authService.sanitizeUser(updatedUser);

            return ok(res, {
                user: sanitizedUser
            });
        } catch (error) {
            next(error);
        }
    }

    async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return badRequest(res, 'Current password and new password are required');
            }

            // Validate new password strength
            const passwordValidation = authService.validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return badRequest(res,
                    passwordValidation.errors,
                    'New password does not meet requirements'
                );
            }

            // Get user with password
            const user = await userService.findById(req.user!.id);
            if (!user) {
                return notFound(res, 'User not found');
            }

            // Check if user has a password (traditional login users)
            if (!user.password) {
                return badRequest(res, 'This account uses Google OAuth and does not have a password to change');
            }

            // Validate current password
            const isValidCurrentPassword = await userService.validatePassword(currentPassword, user.password);
            if (!isValidCurrentPassword) {
                return badRequest(res, 'Current password is incorrect');
            }

            // Update password
            await userService.updatePassword(req.user!.id, newPassword);

            return created(res, null, 'Password changed successfully');
        } catch (error) {
            next(error);
        }
    }

    async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { email } = req.body;

            if (!email) {
                return badRequest(res, 'Email is required');
            }

            // Always return success for security (don't reveal if email exists)
            try {
                await authService.generatePasswordResetToken(email);
                // In a real implementation, send email here
            } catch (error) {
                // Silently ignore errors for security
            }

            return created(res, null, 'If an account with that email exists, a password reset link has been sent.')
        } catch (error) {
            next(error);
        }
    }

    async resetPassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword) {
                return badRequest(res, 'Token and new password are required');
            }

            // Validate password strength
            const passwordValidation = authService.validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return badRequest(res, 'Password does not meet requirements');
            }

            await authService.resetPassword(token, newPassword);

            return ok(res, {
                success: true,
                message: 'Password reset successfully'
            });
        } catch (error: any) {
            return badRequest(res, error.message);
        }
    }


    async googleAuthCallback(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            if (!req.user) {
                return unauthorized(res, 'User not found');
            }

            // The user profile is set by passport - it should be a GoogleProfile
            const profile = req.user as any as GoogleProfile;

            const result = await authService.authenticateWithGoogle(profile);
            const sanitizedUser = authService.sanitizeUser(result.user);

            // For API response, return JSON with tokens
            // In a real frontend integration, you'd redirect to the frontend with tokens
            return ok(res, {
                user: sanitizedUser,
                tokens: result.tokens,
                isNewUser: result.isNewUser
            });
        } catch (error: any) {
            console.error('Google auth callback error:', error);
            return unauthorized(res, 'Google authentication failed');
        }
    }

    async googleJWTAuth(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { credential } = req.body;

            if (!credential) {
                return badRequest(res, 'Google JWT credential is required');
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

            return created(
                res,
                {
                    user: sanitizedUser,
                    tokens: result.tokens,
                    isNewUser: result.isNewUser
                }, result.isNewUser ? 'User registered successfully with Google' : 'Login successful with Google'
            );
        } catch (error: any) {
            console.error('Google JWT auth error:', error);
            return serverError(res, error.message || 'Google authentication failed');
        }
    }
}

export const authController = new AuthController();
