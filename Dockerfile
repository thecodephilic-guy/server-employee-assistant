# ==============================================================================
# Build With Agora Hackathon - Employee Productivity Assistant Backend Dockerfile
# Optimized for self-hosted Linux (Umbrel / Docker / Portainer)
# Debian-slim with official PNPM_HOME configuration
# ==============================================================================

# Stage 1: Build TypeScript
FROM node:22-slim AS builder

WORKDIR /app

# Configure PNPM environment per official pnpm docs & symlink to /usr/local/bin
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN ln -sf "$PNPM_HOME/pnpm" /usr/local/bin/pnpm && ln -sf "$PNPM_HOME/pnpx" /usr/local/bin/pnpx

# Copy package manifests
COPY package.json pnpm-lock.yaml* ./

# Install dependencies for build
RUN pnpm install --no-frozen-lockfile

# Copy source code and config
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
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN ln -sf "$PNPM_HOME/pnpm" /usr/local/bin/pnpm && ln -sf "$PNPM_HOME/pnpx" /usr/local/bin/pnpx

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --no-frozen-lockfile --ignore-scripts

COPY --from=builder /app/dist ./dist

EXPOSE 4040

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4040/health || exit 1

CMD ["node", "dist/index.js"]
