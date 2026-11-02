FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile=false

FROM deps AS builder
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
