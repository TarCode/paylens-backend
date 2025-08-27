# 🚀 PayLens Backend - Fly.io Deployment Guide

Complete instructions for deploying the PayLens backend to Fly.io with PostgreSQL database.

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ **Fly.io Account** - [Sign up at fly.io](https://fly.io)
- ✅ **Fly CLI** - Install from [fly.io/docs/getting-started](https://fly.io/docs/getting-started/installing-flyctl/)
- ✅ **Node.js 18+** - Required for local development
- ✅ **PostgreSQL** - For local database (optional, can use Fly Postgres)
- ✅ **Google OAuth Credentials** - From Google Cloud Console

## 🏗️ Step 1: Project Setup

### 1.1 Initialize Fly.io App
```bash
# Login to Fly.io
fly auth login

# Navigate to backend directory
cd backend

# Initialize Fly app (choose a unique app name)
fly launch --name paylens-backend

# When prompted:
# - Choose your region (e.g., iad for Virginia)
# - Don't deploy yet (we'll configure first)
```

### 1.2 Set Environment Variables
```bash
# Set basic configuration
fly secrets set NODE_ENV=production
fly secrets set PORT=3001

# Set JWT secrets (generate strong random strings)
fly secrets set JWT_SECRET="$(openssl rand -hex 32)"
fly secrets set REFRESH_TOKEN_SECRET="$(openssl rand -hex 32)"

# Set database URL (we'll create the database next)
fly secrets set DATABASE_URL="postgresql://..."

# Set Google OAuth (get from Google Cloud Console)
fly secrets set GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
fly secrets set REACT_APP_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"

# Set bcrypt rounds for production
fly secrets set BCRYPT_ROUNDS=12

# Set rate limiting
fly secrets set RATE_LIMIT_WINDOW_MS=900000
fly secrets set RATE_LIMIT_MAX_REQUESTS=100

# Set CORS origin (your frontend URL)
fly secrets set CORS_ORIGIN="https://your-frontend-domain.com"
```

## 🗄️ Step 2: Database Setup

### Option A: Fly.io PostgreSQL (Recommended)
```bash
# Create PostgreSQL database on Fly.io
fly pg create --name paylens-db

# Get database connection string
fly pg connect --app paylens-db

# The DATABASE_URL will be automatically set in your Fly app
# You can check it with: fly secrets list
```

### Option B: External PostgreSQL
```bash
# Set your external PostgreSQL connection string
fly secrets set DATABASE_URL="postgresql://username:password@host:5432/database"
```

## 👑 Step 3: Admin User Setup

### Secure Admin Creation
Set admin credentials as environment variables (will be created on first startup):

```bash
# Set admin user details
fly secrets set ADMIN_EMAIL="admin@yourcompany.com"
fly secrets set ADMIN_PASSWORD="secure-admin-password-here"
fly secrets set ADMIN_FIRST_NAME="Admin"
fly secrets set ADMIN_LAST_NAME="User"
```

**⚠️ IMPORTANT:** Remove these secrets after successful deployment for security!

## 🚀 Step 4: Deploy

### 4.1 Build and Deploy
```bash
# Deploy to Fly.io
fly deploy

# Monitor deployment logs
fly logs
```

### 4.2 Verify Deployment
```bash
# Check app status
fly status

# Test health endpoint
curl https://paylens-backend.fly.dev/health

# Check app logs
fly logs
```

## ⚙️ Step 5: Database Migration

### Run Migrations on Fly.io
```bash
# SSH into your Fly app
fly ssh console

# Navigate to app directory
cd /app

# Run database migrations
npm run db:migrate

# Exit SSH
exit
```

## 🔐 Step 6: Post-Deployment Security

### Remove Admin Creation Secrets
```bash
# Remove admin creation secrets (security best practice)
fly secrets unset ADMIN_EMAIL
fly secrets unset ADMIN_PASSWORD
fly secrets unset ADMIN_FIRST_NAME
fly secrets unset ADMIN_LAST_NAME
```

### Verify Admin User Creation
```bash
# Check that admin user was created successfully
curl -X POST https://paylens-backend.fly.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"your-admin-password"}'
```

## 🌐 Step 7: Domain & SSL Setup (Optional)

### Custom Domain
```bash
# Add custom domain
fly certs add your-domain.com

# Set DNS records as instructed by Fly.io
```

### SSL Certificate
Fly.io automatically provides SSL certificates for all apps. Your API will be available at:
- `https://paylens-backend.fly.dev` (default)
- `https://your-domain.com` (custom domain)

## 🔍 Step 8: Testing & Monitoring

### Test API Endpoints
```bash
# Test health endpoint
curl https://paylens-backend.fly.dev/health

# Test auth endpoints
curl -X POST https://paylens-backend.fly.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword","firstName":"Test","lastName":"User"}'

# Test usage endpoints (requires authentication)
curl https://paylens-backend.fly.dev/api/usage \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Monitor Application
```bash
# View real-time logs
fly logs

# Check app status
fly status

# Monitor resource usage
fly vm status
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check database connectivity
fly pg connect --app paylens-db

# Verify DATABASE_URL secret
fly secrets list
```

#### 2. Build Failures
```bash
# Check build logs
fly logs --app paylens-backend

# Rebuild with verbose logging
fly deploy --verbose
```

#### 3. Migration Failures
```bash
# SSH and run migrations manually
fly ssh console
cd /app
npm run db:migrate
```

#### 4. Environment Variable Issues
```bash
# List all secrets
fly secrets list

# Update a secret
fly secrets set KEY_NAME="new_value"
```

### Performance Optimization

#### Scale Application
```bash
# Scale to multiple instances
fly scale count 2

# Adjust memory/CPU
fly scale memory 512
fly scale vm shared-cpu-1x
```

#### Database Optimization
```bash
# Scale database
fly pg scale --vm-size shared-cpu-2x --volume-size 10

# Monitor database performance
fly pg connect --app paylens-db
```

## 📊 Step 9: Production Checklist

- [ ] ✅ App deployed successfully
- [ ] ✅ Database connected and migrated
- [ ] ✅ Admin user created and accessible
- [ ] ✅ Google OAuth configured
- [ ] ✅ SSL certificate active
- [ ] ✅ Environment variables secured
- [ ] ✅ Health checks passing
- [ ] ✅ Rate limiting configured
- [ ] ✅ CORS properly configured
- [ ] ✅ Usage tracking working
- [ ] ✅ Monthly reset scheduler running

## 🔄 Updates & Maintenance

### Deploy Updates
```bash
# Deploy code changes
fly deploy

# Deploy with specific environment
NODE_ENV=production fly deploy
```

### Database Backups
```bash
# Create database backup
fly pg backup --app paylens-db

# List available backups
fly pg backups --app paylens-db

# Restore from backup
fly pg restore --app paylens-db --backup-id BACKUP_ID
```

### Monitoring & Logs
```bash
# Continuous log streaming
fly logs -f

# Search logs for specific terms
fly logs | grep "ERROR"

# Set up log retention
fly secrets set LOG_LEVEL=info
```

## 🎯 Next Steps

After successful deployment:

1. **Frontend Deployment** - Deploy your React frontend
2. **Domain Configuration** - Set up custom domain if needed
3. **Monitoring Setup** - Configure error tracking and monitoring
4. **Backup Strategy** - Set up automated database backups
5. **Scaling** - Monitor usage and scale as needed

## 📞 Support

For deployment issues:
- Check Fly.io documentation: [fly.io/docs](https://fly.io/docs)
- Review deployment logs: `fly logs`
- Check app status: `fly status`
- SSH for debugging: `fly ssh console`

Your PayLens backend is now deployed and ready for production! 🚀

---

**Deployment completed successfully?** ⭐ Star this repo and share your deployment story!

**Need help?** Check the troubleshooting section or open an issue.
