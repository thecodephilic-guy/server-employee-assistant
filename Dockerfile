# ==============================================================================
# Build With Agora Hackathon - Employee Productivity Assistant Backend Dockerfile
# Optimized for self-hosted Linux (Umbrel / Docker / Portainer)
# Uses Debian-slim for universal glibc compatibility on x86_64 and arm64
# ==============================================================================

# Stage 1: Build TypeScript
FROM node:22-slim AS builder

WORKDIR /app

# Install build essentials and enable pnpm
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@latest || (corepack enable && corepack prepare pnpm@latest --activate)

# Copy package manifests
COPY package.json pnpm-lock.yaml* ./

# Install dependencies (use --no-frozen-lockfile to adapt to host container architecture)
RUN pnpm install --no-frozen-lockfile

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to dist
RUN pnpm run build

# Stage 2: Production Runtime
FROM node:22-slim AS runner

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4040

RUN npm install -g pnpm@latest || (corepack enable && corepack prepare pnpm@latest --activate)

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --no-frozen-lockfile --ignore-scripts

COPY --from=builder /app/dist ./dist

EXPOSE 4040

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4040/health || exit 1

CMD ["node", "dist/index.js"]
