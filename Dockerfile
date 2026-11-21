# ==============================================================================
# Build With Agora Hackathon - Employee Productivity Assistant Backend Dockerfile
# Optimized for self-hosted Linux (Umbrel / Docker / Portainer)
# Multi-fallback package installation for 100% build reliability
# ==============================================================================

# Stage 1: Build TypeScript and prepare dependencies
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Install pnpm globally via npm
RUN npm install -g pnpm@latest || true

# Copy package manifests
COPY package.json pnpm-lock.yaml* ./

# Install dependencies with fallback to npm --legacy-peer-deps
RUN pnpm install --no-frozen-lockfile || npm install --legacy-peer-deps

# Copy source and TypeScript config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to dist
RUN npm run build || ./node_modules/.bin/tsc

# Prune devDependencies so only production dependencies remain in node_modules
RUN pnpm prune --prod || npm prune --production || true

# Stage 2: Production Runtime
FROM node:22-slim AS runner

WORKDIR /app

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4040

COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 4040

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4040/health || exit 1

CMD ["node", "dist/index.js"]
