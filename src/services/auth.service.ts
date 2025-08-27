import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { userService } from './user.service';
import { User, AuthTokens, JWTPayload, GoogleProfile } from '../models/User';

export class AuthService {
    private jwtSecret: string;
    private jwtExpiresIn: string;
    private refreshTokenSecret: string;
    private refreshTokenExpiresIn: string;

    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
        this.refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'fallback-refresh-secret';
        this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
    }

    async register(userData: {
        email: string;
        password?: string; // Optional for Google OAuth
        googleId?: string; // Google OAuth ID
        firstName: string;
        lastName: string;
        companyName?: string;
    }): Promise<{ user: User; tokens: AuthTokens }> {
        // Check if user already exists
        const existingUser = await userService.findByEmail(userData.email);
        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        // Create new user
        const user = await userService.createUser(userData);

        // Generate tokens
        const tokens = await this.generateTokens(user);

        return { user, tokens };
    }

    async login(credentials: { email: string; password: string }): Promise<{ user: User; tokens: AuthTokens }> {
        // Find user by email
        const user = await userService.findByEmail(credentials.email);
        if (!user) {
            throw new Error('Invalid email or password');
        }

        // Check if user has password (traditional login) or googleId (Google OAuth)
        if (!user.password && user.googleId) {
            throw new Error('This account uses Google OAuth. Please sign in with Google.');
        }

        if (!user.password) {
            throw new Error('Invalid email or password');
        }

        // Validate password
        const isValidPassword = await userService.validatePassword(credentials.password, user.password);
        if (!isValidPassword) {
            throw new Error('Invalid email or password');
        }

        // Check if user is active
        console.log('User isActive check:', user.isActive, typeof user.isActive); // Debug logging
        console.log('Full user object:', JSON.stringify(user, null, 2)); // Debug logging

        // Convert PostgreSQL boolean to JavaScript boolean
        const isActive = !!user.isActive;

        if (!isActive) {
            console.log('User is inactive, throwing error'); // Debug logging
            throw new Error('Account is deactivated. Please contact support.');
        }

        // Generate tokens
        const tokens = await this.generateTokens(user);

        return { user, tokens };
    }

    async authenticateWithGoogle(profile: GoogleProfile): Promise<{ user: User; tokens: AuthTokens; isNewUser: boolean }> {
        // Check if user already exists by email
        let user = await userService.findByEmail(profile.email);

        console.log('Google auth - Found user by email:', profile.email, user ? { id: user.id, isActive: user.isActive, googleId: user.googleId } : 'null');

        let isNewUser = false;

        if (!user) {
            // Check if user exists by Google ID
            user = await userService.findByGoogleId(profile.id);

            if (!user) {
                // Create new user from Google profile
                const userData = {
                    email: profile.email,
                    googleId: profile.id,
                    firstName: profile.given_name,
                    lastName: profile.family_name,
                    emailVerified: profile.verified_email,
                    isActive: true,
                    role: 'user' as const,
                    subscriptionTier: 'free' as const,
                    monthlyLimit: 100,
                    usageCount: 0
                };

                user = await userService.createUser(userData);
                isNewUser = true;
            }
        } else if (!user.isActive) {
            // Existing user but deactivated - reactivate and link Google account
            console.log('Reactivating user:', user.id, 'with Google ID:', profile.id);

            try {
                const updateResult = await userService.updateUser(user.id, {
                    googleId: profile.id,
                    isActive: true,
                    emailVerified: profile.verified_email
                });

                if (!updateResult) {
                    console.error('Update user returned null for user ID:', user?.id || 'unknown');
                    throw new Error('Failed to update user in database');
                }

                const updatedUserId = user.id; // Store ID before potentially nullifying user
                user = await userService.findById(updatedUserId); // Get updated user

                if (!user) {
                    console.error('Failed to find updated user with ID:', updatedUserId);
                    throw new Error('Failed to retrieve updated user from database');
                }

                console.log('Successfully reactivated user:', user.id, 'isActive:', user.isActive);
                isNewUser = false;
            } catch (error) {
                console.error('Error during user reactivation:', error);
                throw new Error('Account reactivation failed. Please contact support.');
            }
        } else if (!user.googleId) {
            // Existing active user, just link Google account
            await userService.updateUser(user.id, { googleId: profile.id });
            user = await userService.findById(user.id); // Get updated user
            isNewUser = false;
        }

        if (!user || !user.isActive) {
            throw new Error('Account reactivation failed. Please contact support.');
        }

        // Generate tokens
        const tokens = await this.generateTokens(user);

        return { user, tokens, isNewUser };
    }

    async refreshToken(refreshToken: string): Promise<{ user: User; tokens: AuthTokens }> {
        try {
            // Verify refresh token
            const decoded = (jwt.verify as any)(refreshToken, this.refreshTokenSecret);

            // Find user
            const user = await userService.findById(decoded.id);
            if (!user || !user.isActive) {
                throw new Error('Invalid refresh token');
            }

            // Generate new tokens
            const tokens = await this.generateTokens(user);

            return { user, tokens };
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    async generateTokens(user: User): Promise<AuthTokens> {
        const payload: JWTPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
            subscriptionTier: user.subscriptionTier,
            usageCount: user.usageCount,
            monthlyLimit: user.monthlyLimit,
            lastUsageReset: user.lastUsageReset,
            billingPeriodStart: user.billingPeriodStart
        };

        const accessToken = (jwt.sign as any)(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn
        });

        const refreshToken = (jwt.sign as any)(
            { id: user.id, email: user.email },
            this.refreshTokenSecret,
            {
                expiresIn: this.refreshTokenExpiresIn
            }
        );

        return { accessToken, refreshToken };
    }

    async verifyToken(token: string): Promise<JWTPayload> {
        try {
            const decoded = (jwt.verify as any)(token, this.jwtSecret) as JWTPayload;
            return decoded;
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    async generatePasswordResetToken(email: string): Promise<string> {
        const user = await userService.findByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }

        const resetToken = uuidv4();
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // In a real implementation, you'd store this in the database
        // For now, we'll just return the token
        return resetToken;
    }

    async resetPassword(token: string, newPassword: string): Promise<void> {
        // In a real implementation, you'd validate the token against the database
        // For now, we'll just update the password (this is simplified)
        throw new Error('Password reset functionality needs to be implemented with database storage');
    }

    async generateEmailVerificationToken(userId: string): Promise<string> {
        const verificationToken = uuidv4();

        // In a real implementation, you'd store this in the database
        // For now, we'll just return the token
        return verificationToken;
    }

    async verifyEmail(token: string): Promise<void> {
        // In a real implementation, you'd validate the token and update the user's email_verified status
        throw new Error('Email verification functionality needs to be implemented with database storage');
    }

    // Get user profile (without sensitive data)
    sanitizeUser(user: User): Omit<User, 'password' | 'emailVerificationToken' | 'passwordResetToken' | 'passwordResetExpires'> {
        const { password, emailVerificationToken, passwordResetToken, passwordResetExpires, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    // Validate password strength
    validatePassword(password: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Validate email format
    validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

export const authService = new AuthService();
