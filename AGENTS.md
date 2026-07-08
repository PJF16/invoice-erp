# invoice-erp

Lagerverwaltung (Phase 1) und später Rechnungsprogramm. Deutschsprachige Oberfläche.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Prisma 7 + PostgreSQL (Driver-Adapter `@prisma/adapter-pg`; Datenbank-URL steht in `prisma.config.ts`, **nicht** im Schema)
- Auth.js v5 (Credentials, JWT-Sessions); Session-Guard in `app/(dashboard)/layout.tsx` und `requireSession()` in den API-Routen — die Middleware macht nur den Redirect
- Generierter Prisma-Client liegt in `lib/generated/prisma/` (gitignored, `npm install` erzeugt ihn via postinstall)

## Befehle

- `docker compose up -d db` — Postgres für die Entwicklung (Host-Port 5433)
- `npm run dev` / `npm run build`
- `npm run db:migrate` / `npm run db:seed`

## Konventionen

- Bestandsänderungen laufen ausschließlich über `bookMovement()` in `lib/movements.ts` (Transaktion: Movement + Stock zusammen; OUT nie unter 0). Nie `Stock` direkt schreiben.
- API-Routen: Zod-Schemas aus `lib/validation.ts`, Fehler über `handleApiError()`; Fehlermeldungen auf Deutsch.
- Die REST-API unter `app/api/` wird später von einer iOS-App mitbenutzt — Breaking Changes vermeiden.
