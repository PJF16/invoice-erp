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
- Die REST-API unter `app/api/` wird von der iOS-App (`ios/`, SwiftUI + XcodeGen) mitbenutzt — Breaking Changes vermeiden. iOS-Login läuft über den NextAuth-Credentials-Flow (`/api/auth/csrf` → `/api/auth/callback/credentials`, Session-Cookie).
- Lieferant ist ein Freitextfeld auf `Movement` (nur bei Eingängen); Autocomplete über `GET /api/suppliers` (distinct).
- Rechnungslogik zentral in `lib/invoices.ts` (`computeTotals`, `finalizeInvoice`, `cancelInvoice`): Nummernvergabe atomar über `CompanySettings.lastInvoiceSeq`, Hardware-Positionen buchen via `bookMovementTx()` innerhalb derselben Transaktion. Kundendaten werden bei Finalisierung als Snapshot eingefroren.
- Bei `taxTreatment !== STANDARD` (Reverse Charge, ig. Lieferung, Ausfuhr) werden alle Positionen mit 0% gerechnet; der Hinweistext kommt aus `TAX_NOTES`.
- Wiederkehrende Rechnungen: `lib/recurring.ts` liest Softwareartikel-Preise ERST bei der Erzeugung (Kernanforderung — nie Preise in `RecurringInvoiceLine` snapshotten). Scheduler in `instrumentation.ts` (stündlich).
- PDF: `lib/invoice-pdf.ts` (pdfkit; ist in `next.config.ts` als `serverExternalPackages` eingetragen, sonst fehlen die Font-Dateien). E-Mail: `lib/mailer.ts` (SMTP aus env; `SMTP_JSON=1` = Test-Transport ohne echten Versand).
