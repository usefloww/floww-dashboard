FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/sdk/package.json ./packages/sdk/
RUN pnpm install --frozen-lockfile

# Test stage - contains all dependencies for running tests in CI
FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
# Tests can be run using: docker run --rm <image> pnpm test:ci

# Build application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=8192"
RUN pnpm run build

# Production runtime - Web Server
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Copy Nitro build output and full node_modules
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules

# Set production environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start server using Bun (matches the Nitro bun preset)
CMD ["bun", "run", ".output/server/index.mjs"]

# Worker runtime - Background Jobs
FROM node:22-alpine AS worker

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9

WORKDIR /app

# Worker still needs full node_modules for tsx and server code
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server ./server

# Set production environment
ENV NODE_ENV=production

# Start worker
CMD ["pnpm", "worker"]
