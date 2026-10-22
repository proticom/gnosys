# ─── Stage 1: Build ──────────────────────────────────────────────────────
FROM node:24.22.1-alpine AS builder

WORKDIR /app

# Node 24 includes SQLite FTS5. Node 23.x is unsupported.
# Git is used by history features; SQLite is built into Node.
RUN apk add --no-cache git

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

# ─── Stage 2: Runtime ────────────────────────────────────────────────────
FROM node:24.22.1-alpine

WORKDIR /app

# Keep the Alpine trust store at or above 20261020-r0 for the eMudhra CA fix.
RUN apk upgrade --no-cache ca-certificates && apk add --no-cache git

# Copy built artifacts and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# v5.12: the brain lives on a host-local volume (/data). NEVER back this with an
# SMB/NFS share — network filesystems corrupt SQLite under gnosys's many small
# writes. GNOSYS_LOCAL_ONLY keeps this server authoritative (no remote hop).
ENV NODE_ENV=production \
    GNOSYS_HOME=/data \
    GNOSYS_LOCAL_ONLY=1

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 7777

# Set GNOSYS_SERVE_TOKEN at runtime to require `Authorization: Bearer <token>`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:7777/health || exit 1

# Network-hosted MCP. Binds 0.0.0.0 INSIDE the container (isolated); control
# external access with the host firewall / Tailscale + a bearer token.
ENTRYPOINT ["node", "/app/dist/cli.js"]
CMD ["serve", "--transport", "http", "--host", "0.0.0.0", "--port", "7777"]
