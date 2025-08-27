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

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Usage Tracking
- `POST /api/usage/increment` - Increment usage (with limits)
- `GET /api/usage` - Get usage statistics

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
