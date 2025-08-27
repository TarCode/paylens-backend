# Multi-stage build for PayLens Backend
FROM node:20.10.0-alpine AS base

# Install dependencies for building
RUN apk add --no-cache libc6-compat bash curl tar

WORKDIR /app
ENV NODE_ENV=development

# -----------------------------
# Dependencies stage
# -----------------------------
FROM base AS deps

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# -----------------------------
# Builder stage
# -----------------------------
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Compile TypeScript
RUN npm run build

# -----------------------------
# Production stage
# -----------------------------
FROM base AS runner

WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 paylens

# Copy compiled app and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Install dockerize to wait for Postgres
RUN curl -sSL https://github.com/jwilder/dockerize/releases/download/v0.7.0/dockerize-linux-amd64-v0.7.0.tar.gz \
    | tar -C /usr/local/bin -xzv

# Switch to non-root user
USER paylens

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# Use dockerize to wait for Postgres and run migrations + start
CMD ["dockerize", "-wait", "tcp://db:5432", "-timeout", "30s", "sh", "-c", "npm run db:migrate && npm start"]
