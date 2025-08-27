import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth/auth.routes';
import usageRoutes from './routes/usage.routes';
import adminRoutes from './routes/admin.routes';

// Import middleware
import { errorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';

// Load environment variables
dotenv.config();

// Initialize Google OAuth
import './config/google-oauth';

// Initialize scheduler service
import { schedulerService } from './services/scheduler.service';

// Initialize admin user service
import { userService } from './services/database/user.service';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Initialize admin user (secure, environment-based creation)
const initializeAdminUser = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        const adminFirstName = process.env.ADMIN_FIRST_NAME || 'Admin';
        const adminLastName = process.env.ADMIN_LAST_NAME || 'User';

        // Only proceed if admin credentials are provided
        if (!adminEmail || !adminPassword) {
            console.log('ℹ️  No admin credentials provided - skipping admin user creation');
            return;
        }

        // Check if an admin user already exists
        const existingAdmins = await userService.getAllUsers(1000);
        const adminExists = existingAdmins.some(user => user.role === 'admin');

        if (adminExists) {
            console.log('ℹ️  Admin user already exists - skipping admin user creation');
            return;
        }

        // Hash the admin password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
        const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

        // Create the admin user
        const adminUser = await userService.createUser({
            email: adminEmail,
            password: hashedPassword,
            firstName: adminFirstName,
            lastName: adminLastName,
            companyName: 'PayLens Admin'
        });

        // Update the user to admin role
        await userService.updateUser(adminUser.id, {
            role: 'admin',
            subscriptionTier: 'enterprise',
            monthlyLimit: -1 // Unlimited for admin
        });

        console.log('✅ Admin user created successfully:', {
            email: adminEmail,
            id: adminUser.id,
            role: 'admin',
            subscriptionTier: 'enterprise'
        });

        // Clear the environment variables for security
        delete process.env.ADMIN_EMAIL;
        delete process.env.ADMIN_PASSWORD;
        delete process.env.ADMIN_FIRST_NAME;
        delete process.env.ADMIN_LAST_NAME;

    } catch (error) {
        console.error('❌ Failed to create admin user:', error);
        // Don't throw - allow server to continue even if admin creation fails
    }
};

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Global server reference for graceful shutdown
let server: any;

// Initialize admin user and start server
const startServer = async () => {
    try {
        // Create admin user if configured
        await initializeAdminUser();

        // Start the server
        server = app.listen(PORT, () => {
            console.log(`🚀 PayLens Backend Server running on port ${PORT}`);
            console.log(`📊 Health check available at http://localhost:${PORT}/health`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

            // Start the monthly reset scheduler
            schedulerService.startMonthlyReset();
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown handlers
const gracefulShutdown = (signal: string) => {
    console.log(`🛑 ${signal} received, shutting down gracefully...`);
    schedulerService.stopMonthlyReset();

    if (server) {
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();

export default app;
