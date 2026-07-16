FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ENV DATABASE_URL=file:/tmp/build.db
ENV AUTH_SECRET=build-time-placeholder-secret-32chars
ENV SESSION_SECRET=build-time-placeholder-secret-32chars
ENV APP_URL=https://build.local
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DOCUMENT_STORAGE_DIR=/data/documents
ENV PDF_FONT_PATH=/usr/share/fonts/dejavu/DejaVuSans.ttf
ENV PDF_FONT_BOLD_PATH=/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf

# PDFKit needs a Unicode-capable TTF at runtime. Alpine does not ship fonts in
# the base image, so generated reports would fail before writing a response.
RUN apk add --no-cache openssl font-dejavu
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

RUN chmod +x /app/scripts/railway-start.sh \
  && mkdir -p /data/documents /app/backups \
  && chown -R nextjs:nextjs /app /data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',{headers:{'x-forwarded-proto':'https'}}).then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "scripts/railway-start.sh"]
