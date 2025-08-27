import { userService } from './user.service';

export class SchedulerService {
    private static instance: SchedulerService;
    private monthlyResetInterval: NodeJS.Timeout | null = null;
    private isRunning = false;

    private constructor() { }

    static getInstance(): SchedulerService {
        if (!SchedulerService.instance) {
            SchedulerService.instance = new SchedulerService();
        }
        return SchedulerService.instance;
    }

    // Start the monthly reset scheduler
    startMonthlyReset(): void {
        if (this.isRunning) {
            console.log('📅 Monthly reset scheduler is already running');
            return;
        }

        console.log('📅 Starting monthly reset scheduler...');

        // Check for resets immediately
        this.performMonthlyReset();

        // Set up interval to check every 24 hours
        // In production, you might want to use a proper cron job or external scheduler
        this.monthlyResetInterval = setInterval(() => {
            this.performMonthlyReset();
        }, 24 * 60 * 60 * 1000); // 24 hours

        this.isRunning = true;
        console.log('✅ Monthly reset scheduler started - checking every 24 hours');
    }

    // Stop the scheduler
    stopMonthlyReset(): void {
        if (this.monthlyResetInterval) {
            clearInterval(this.monthlyResetInterval);
            this.monthlyResetInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 Monthly reset scheduler stopped');
    }

    // Perform the monthly reset check and execution
    private async performMonthlyReset(): Promise<void> {
        try {
            const now = new Date();
            const currentDay = now.getDate();

            // Only reset on the 1st of each month
            if (currentDay !== 1) {
                console.log(`📅 Monthly reset check: Not the 1st of the month (it's the ${currentDay}th)`);
                return;
            }

            console.log(`📅 Performing monthly usage reset for ${now.toLocaleDateString()}`);

            // Reset usage for all users whose billing period has ended
            const resetResult = await userService.resetMonthlyUsage();

            if (resetResult.resetCount > 0) {
                console.log(`✅ Monthly reset completed: ${resetResult.resetCount} user(s) had their usage reset`);
            } else {
                console.log('📊 Monthly reset check: No users needed reset (already up to date)');
            }

            if (resetResult.errors.length > 0) {
                console.error('❌ Monthly reset errors:', resetResult.errors);
            }

        } catch (error) {
            console.error('❌ Monthly reset failed:', error);
        }
    }

    // Manual trigger for testing
    async triggerMonthlyReset(): Promise<{ resetCount: number; errors: string[] }> {
        console.log('🔧 Manual monthly reset triggered');
        return await userService.resetMonthlyUsage();
    }

    // Get scheduler status
    getStatus(): { isRunning: boolean; nextCheck?: Date } {
        return {
            isRunning: this.isRunning,
            nextCheck: this.monthlyResetInterval ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined
        };
    }
}

export const schedulerService = SchedulerService.getInstance();
