# PayLens Backend

Backend API for PayLens payment analysis tool built with Node.js, TypeScript, and PostgreSQL.

## Features

- 🔐 Secure JWT-based authentication
- 👤 User management with role-based access control
- 📊 Usage tracking and limits
- 🔄 Monthly usage resets
- 🛡️ Admin panel for user management
- 📈 Payment data analysis
- 🔒 Security middleware and rate limiting

## Quick Start

### Prerequisites

- Node.js 16+
- PostgreSQL 12+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd paylens/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb paylens

   # Run migrations
   npm run db:migrate
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Admin User Setup

### Secure Admin Creation

The system uses **environment-based admin creation** for maximum security. This approach:

- ✅ **No API endpoints** for admin creation
- ✅ **Server-startup only** - credentials only checked during deployment
- ✅ **One-time creation** - prevents duplicate admin users
- ✅ **Automatic cleanup** - environment variables cleared after use

### Configuration

Add these environment variables to create an admin user on first startup:

```env
# Admin User Configuration
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=secure-admin-password-here
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=User
```

### How It Works

1. **Server Startup**: On first run, the server checks for `ADMIN_EMAIL` and `ADMIN_PASSWORD`
2. **Admin Check**: Verifies no admin user already exists
3. **User Creation**: Creates admin user with enterprise tier (unlimited usage)
4. **Cleanup**: Removes environment variables for security
5. **Normal Operation**: Subsequent startups skip admin creation

### Security Benefits

- **No API Exploitation**: Malicious users can't trigger admin creation
- **Deployment-Only**: Admin credentials only exist during initial setup
- **Automatic Protection**: System prevents multiple admin creation attempts
- **Clean Environment**: Sensitive variables removed after use

### Admin Features

Once created, the admin user has access to:

- 📊 **Usage Statistics** - View all users and their usage
- 🔄 **Manual Resets** - Reset individual or all user usage
- 📈 **Scheduler Control** - Monitor and control monthly resets
- 👤 **User Management** - View and manage user accounts

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Usage Tracking
- `POST /api/usage/increment` - Increment usage (with limits)
- `GET /api/usage` - Get usage statistics

### Admin Only
- `GET /api/admin/usage-stats` - System usage statistics
- `POST /api/admin/users/:userId/reset-usage` - Reset user usage
- `POST /api/admin/reset-all-usage` - Reset all users
- `GET /api/admin/scheduler/status` - Scheduler status
- `POST /api/admin/scheduler/trigger-reset` - Manual reset

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    subscription_tier VARCHAR(20) DEFAULT 'free',
    monthly_limit INTEGER DEFAULT 100,
    usage_count INTEGER DEFAULT 0,
    last_usage_reset TIMESTAMP DEFAULT NOW(),
    billing_period_start TIMESTAMP DEFAULT NOW(),
    -- ... other fields
);
```

## Security Features

- 🔒 **JWT Authentication** with refresh tokens
- 🛡️ **Rate Limiting** on sensitive endpoints
- 📝 **Request Logging** for suspicious activity
- 🚫 **SQL Injection Protection** via parameterized queries
- 🔐 **Password Hashing** with bcrypt
- 📊 **Usage Limits** with database-level enforcement

## Development

```bash
# Development with auto-restart
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Format code
npm run format
```

## Deployment

1. Set environment variables (including admin credentials for first deployment)
2. Run database migrations
3. Start the server
4. Remove admin environment variables after successful startup

## Environment Variables

See `.env.example` for all required configuration options.

**Important**: Never commit actual `.env` files to version control. Use `.env.example` as a template.

## License

Private - All rights reserved.
