import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from './database.service';
import { User, CreateUserData, UpdateUserData } from '../models/User';

export class UserService {
    async createUser(userData: CreateUserData): Promise<User> {
        const { email, password, googleId, firstName, lastName, companyName } = userData;

        // Hash password if provided (for traditional registration)
        let hashedPassword = null;
        if (password) {
            const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
            hashedPassword = await bcrypt.hash(password, saltRounds);
        }

        const userId = uuidv4();
        const now = new Date();

        // Determine subscription tier based on company name (for now, default to free)
        const subscriptionTier = companyName ? 'free' : 'free';
        const monthlyLimit = this.getMonthlyLimit(subscriptionTier);

        const query = `
      INSERT INTO users (
        id, email, password, google_id, first_name, last_name, company_name,
        role, subscription_tier, monthly_limit, usage_count,
        is_active, email_verified, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

        const values = [
            userId,
            email,
            hashedPassword,
            googleId || null,
            firstName,
            lastName,
            companyName || null,
            'user',
            subscriptionTier,
            monthlyLimit,
            0, // usage_count
            true, // is_active (activate user immediately)
            true, // email_verified (for development - in production use email verification)
            now,
            now
        ];

        const result = await dbService.query<User>(query, values);
        return result.rows[0];
    }

    async findByEmail(email: string): Promise<User | null> {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await dbService.query<User>(query, [email]);
        return result.rows[0] || null;
    }

    async findById(id: string): Promise<User | null> {
        const query = 'SELECT * FROM users WHERE id = $1';
        const result = await dbService.query<User>(query, [id]);
        return result.rows[0] || null;
    }

    async findByGoogleId(googleId: string): Promise<User | null> {
        const query = 'SELECT * FROM users WHERE google_id = $1';
        const result = await dbService.query<User>(query, [googleId]);
        return result.rows[0] || null;
    }

    async updateUser(id: string, updateData: UpdateUserData): Promise<User | null> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        Object.entries(updateData).forEach(([key, value]) => {
            if (value !== undefined) {
                // Convert camelCase to snake_case
                const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                fields.push(`${dbKey} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        });

        if (fields.length === 0) {
            return await this.findById(id);
        }

        values.push(id); // Add ID for WHERE clause
        values.push(new Date()); // Add updated_at timestamp

        const query = `
      UPDATE users
      SET ${fields.join(', ')}, updated_at = $${paramCount + 1}
      WHERE id = $${paramCount}
      RETURNING *
    `;

        const result = await dbService.query<User>(query, values);
        return result.rows[0] || null;
    }

    async incrementUsageCount(userId: string): Promise<{ user: User | null; canIncrement: boolean; error?: string; wasReset?: boolean }> {
        // First, check if user needs monthly reset
        const resetCheck = await this.checkAndResetMonthlyUsage(userId);
        let user = resetCheck.user;

        if (!user) {
            return { user: null, canIncrement: false, error: 'User not found' };
        }

        // Use a database transaction with row-level locking to prevent race conditions
        const query = `
            UPDATE users
            SET usage_count = usage_count + 1, updated_at = NOW()
            WHERE id = $1
            AND (
                subscription_tier = 'enterprise'
                OR usage_count < monthly_limit
            )
            RETURNING *
        `;
        const result = await dbService.query<User>(query, [userId]);

        if (result.rows.length === 0) {
            // Check current user status after potential reset
            const userCheck = await this.findById(userId);
            if (!userCheck) {
                return { user: null, canIncrement: false, error: 'User not found' };
            }

            if (userCheck.subscriptionTier === 'enterprise') {
                // This shouldn't happen, but handle edge case
                return { user: null, canIncrement: false, error: 'Enterprise user increment failed' };
            }

            return {
                user: userCheck,
                canIncrement: false,
                error: `Usage limit exceeded. Current: ${userCheck.usageCount}, Limit: ${userCheck.monthlyLimit}`,
                wasReset: resetCheck.wasReset
            };
        }

        return {
            user: result.rows[0],
            canIncrement: true,
            wasReset: resetCheck.wasReset
        };
    }

    async resetMonthlyUsage(userId?: string): Promise<{ resetCount: number; errors: string[] }> {
        const result = { resetCount: 0, errors: [] as string[] };

        try {
            let query: string;
            let params: any[];

            if (userId) {
                // Reset specific user
                query = `
                    UPDATE users
                    SET usage_count = 0,
                        last_usage_reset = NOW(),
                        billing_period_start = DATE_TRUNC('month', NOW()),
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                `;
                params = [userId];
            } else {
                // Reset all users whose billing period has ended
                query = `
                    UPDATE users
                    SET usage_count = 0,
                        last_usage_reset = NOW(),
                        billing_period_start = DATE_TRUNC('month', NOW()),
                        updated_at = NOW()
                    WHERE billing_period_start < DATE_TRUNC('month', NOW())
                    RETURNING *
                `;
                params = [];
            }

            const dbResult = await dbService.query<User>(query, params);
            result.resetCount = dbResult.rows.length;

            if (result.resetCount > 0) {
                console.log(`✅ Reset usage for ${result.resetCount} user(s)`);
            }

        } catch (error) {
            const errorMsg = `Failed to reset monthly usage: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('❌', errorMsg);
            result.errors.push(errorMsg);
        }

        return result;
    }

    // Check if user needs monthly reset
    async checkAndResetMonthlyUsage(userId: string): Promise<{ wasReset: boolean; user: User | null }> {
        try {
            const user = await this.findById(userId);
            if (!user) {
                return { wasReset: false, user: null };
            }

            // Check if current date is in a new month compared to billing_period_start
            const currentMonth = new Date();
            currentMonth.setDate(1); // First day of current month
            currentMonth.setHours(0, 0, 0, 0);

            const lastResetMonth = new Date(user.billingPeriodStart);
            lastResetMonth.setDate(1);
            lastResetMonth.setHours(0, 0, 0, 0);

            if (currentMonth > lastResetMonth) {
                // Reset usage for this user
                const resetResult = await this.resetMonthlyUsage(userId);
                if (resetResult.resetCount > 0) {
                    // Fetch updated user data
                    const updatedUser = await this.findById(userId);
                    return { wasReset: true, user: updatedUser };
                }
            }

            return { wasReset: false, user };
        } catch (error) {
            console.error('Error checking monthly reset:', error);
            return { wasReset: false, user: null };
        }
    }

    async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    async updatePassword(id: string, newPassword: string): Promise<void> {
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        const query = `
      UPDATE users
      SET password = $1, updated_at = NOW()
      WHERE id = $2
    `;
        await dbService.query(query, [hashedPassword, id]);
    }

    async deactivateUser(id: string): Promise<void> {
        const query = `
      UPDATE users
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;
        await dbService.query(query, [id]);
    }

    private getMonthlyLimit(tier: string): number {
        const limits = {
            free: 5,
            pro: 100,
            business: 1000,
            enterprise: -1 // unlimited
        };
        return limits[tier as keyof typeof limits] || 5;
    }

    // Get all users (admin function)
    async getAllUsers(limit: number = 50, offset: number = 0): Promise<User[]> {
        const query = `
      SELECT * FROM users
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
        const result = await dbService.query<User>(query, [limit, offset]);
        return result.rows;
    }

    // Get user statistics
    async getUserStats(userId: string): Promise<any> {
        const query = `
      SELECT
        u.usage_count,
        u.monthly_limit,
        u.subscription_tier,
        u.created_at as registration_date,
        u.updated_at as last_updated
      FROM users u
      WHERE u.id = $1
    `;
        const result = await dbService.query(query, [userId]);
        return result.rows[0];
    }
}

export const userService = new UserService();
