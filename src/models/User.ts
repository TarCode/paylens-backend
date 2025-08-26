export interface User {
    id: string;
    email: string;
    password?: string; // Optional for Google OAuth users
    googleId?: string; // Google OAuth ID
    firstName: string;
    lastName: string;
    companyName?: string;
    role: 'user' | 'admin';
    subscriptionTier: 'free' | 'pro' | 'business' | 'enterprise';
    monthlyLimit: number;
    usageCount: number;
    isActive: boolean;
    emailVerified: boolean;
    emailVerificationToken?: string;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    stripeCustomerId?: string;
    subscriptionId?: string;
    subscriptionStatus?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUserData {
    email: string;
    password?: string; // Optional for Google OAuth users
    googleId?: string; // Google OAuth ID
    firstName: string;
    lastName: string;
    companyName?: string;
}

export interface UpdateUserData {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    googleId?: string;
    isActive?: boolean;
    emailVerified?: boolean;
    subscriptionTier?: 'free' | 'pro' | 'business' | 'enterprise';
    monthlyLimit?: number;
    usageCount?: number;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface JWTPayload {
    id: string;
    email: string;
    role: string;
    subscriptionTier: string;
    usageCount: number;
    monthlyLimit: number;
}

export interface GoogleProfile {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}
