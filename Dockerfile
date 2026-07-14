FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Platzhalter: prisma generate und next build brauchen keine echte DB-Verbindung
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma CLI + Schema für Migrationen beim Container-Start
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Next.js standalone-Tracing kopiert pg-Abhängigkeiten (z.B. postgres-array) oft
# unvollständig; alte Reste entfernen, damit npm install sie sauber neu auflöst
RUN rm -rf node_modules/pg node_modules/pg-* node_modules/postgres-* node_modules/@prisma/adapter-pg
RUN npm install --no-save prisma@7 dotenv @prisma/adapter-pg pg

COPY docker-entrypoint.sh ./
EXPOSE 3000
CMD ["sh", "docker-entrypoint.sh"]
