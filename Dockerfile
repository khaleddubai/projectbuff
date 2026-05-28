# =============================================================================
# AEGIS — Multi-stage Dockerfile
# Builds both the API (Express) and Web (Next.js) services
# =============================================================================

# ---- Base stage (shared dependencies) ----
FROM node:20-alpine AS base
WORKDIR /app

# Install build deps for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# ---- API dependencies ----
FROM base AS api-deps
WORKDIR /app/apps/api
COPY apps/api/package.json apps/api/package-lock.json* ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# ---- API build ----
FROM api-deps AS api-build
WORKDIR /app/apps/api
COPY apps/api/ ./
RUN npx tsc --noEmit false

# ---- Web dependencies ----
FROM base AS web-deps
WORKDIR /app/apps/web
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# ---- Web build ----
FROM web-deps AS web-build
WORKDIR /app/apps/web
COPY apps/web/ ./
RUN npm run build

# ---- Production: API runtime ----
FROM node:20-alpine AS api
WORKDIR /app

# Create output directory for mission artifacts
RUN mkdir -p /app/output

RUN apk add --no-cache python3 make g++ sqlite wget

# Copy built API artifacts
COPY --from=api-build /app/apps/api/dist ./dist
COPY --from=api-build /app/apps/api/package.json ./
COPY --from=api-build /app/apps/api/node_modules ./node_modules

# Copy shared root configs
COPY .env.example .env.example
COPY apps/api/.env.example ./apps/api/.env.example 2>/dev/null || true

# Copy entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]

# ---- Production: Web runtime (Next.js standalone) ----
FROM node:20-alpine AS web
WORKDIR /app

RUN apk add --no-cache wget

RUN addgroup --system --gid 1001 aegis && \
    adduser --system --uid 1001 aegis

# Copy standalone build (Next.js output)
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./.next/static
COPY --from=web-build /app/apps/web/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

USER aegis

CMD ["node", "server.js"]
