# Multi-stage build for PayLens Backend
FROM node:20.10.0-alpine AS base

# Install dependencies only (for caching)
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=development

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force 

# Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 paylens

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy migration scripts and other necessary files
COPY src/scripts ./dist/scripts

USER paylens


EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Make sure we are root
USER root
# Install curl and tar for wait-for-it
RUN apk add --no-cache bash curl tar

RUN npm install -g ts-node typescript

RUN curl -sSL https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh \
-o /usr/local/bin/wait-for-it.sh && \
chmod +x /usr/local/bin/wait-for-it.sh

CMD ["wait-for-it.sh", "db:5432", "--", "sh", "-c", "npm run db:migrate && npm start"]

