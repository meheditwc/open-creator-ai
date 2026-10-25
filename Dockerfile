# Runtime image for Open Creator AI.
#
# Stage 1 builds the studio bundle, stage 2 ships the daemon + the bundle.
# The daemon has no native dependencies, so the runtime image stays small.

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/daemon/package.json apps/daemon/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN npm ci

COPY apps/daemon apps/daemon
COPY apps/web apps/web
COPY packages/shared packages/shared

RUN npm run build

FROM node:22-alpine AS runtime

RUN apk add --no-cache ffmpeg yt-dlp

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/daemon/package.json apps/daemon/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN npm ci --omit=dev --workspaces --include-workspace-root && npm cache clean --force

COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY apps/daemon ./apps/daemon
COPY packages/shared ./packages/shared

ENV PORT=9861 \
    OPENCREATOR_HOST=0.0.0.0 \
    OPENCREATOR_DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 9861

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:9861/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/daemon/src/index.ts"]
