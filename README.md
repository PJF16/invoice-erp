# Lagerverwaltung (invoice-erp)

Modernes Lagerverwaltungsprogramm mit Mehrbenutzer-Login, mehreren Lagern, Lieferanten-Erfassung und vollständiger Bewegungshistorie. Dazu eine iOS-App mit Barcode-Scanner ([ios/](ios/README.md)). Geplant: Rechnungsmodul.

## Funktionen

- **Bestand**: Alle Artikel mit Menge, filterbar nach Lager, mit Verteilung über alle Lager und Volltextsuche
- **Ein-/Ausbuchen** direkt aus der Bestandsliste (Ausbuchen unter 0 wird abgelehnt)
- **Artikel**: Bezeichnung, SKU, Barcode (vorbereitet für den Scanner der iOS-App), Beschreibung
- **Lager**: beliebig viele Standorte
- **Historie**: jede Bewegung mit Zeitpunkt, Typ (Eingang/Ausgang/Korrektur), Menge, Lager und Benutzer
- **Benutzer**: Admin kann Mitarbeiter-Konten anlegen (Rollen: Admin / Mitarbeiter)
- **REST-API** unter `/api/…` — dieselben Endpunkte nutzt später die iOS-App (inkl. `GET /api/items/by-barcode/{code}`)

## Entwicklung

Voraussetzungen: Node.js ≥ 20, Docker.

```bash
cp .env.example .env        # AUTH_SECRET eintragen: openssl rand -base64 32
npm install                 # generiert auch den Prisma-Client
docker compose up -d db     # Postgres (Host-Port 5433)
npm run db:migrate          # Migrationen anwenden
npm run db:seed             # Admin-User + Hauptlager anlegen
npm run dev
```

Danach auf <http://localhost:3000> mit `admin@example.com` / `admin1234` anmelden (**Passwort nach dem ersten Login ändern** bzw. per `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` in `.env` setzen, bevor geseedet wird).

## Produktion (Docker auf eigenem Server)

```bash
cp .env.example .env        # sichere Werte setzen: POSTGRES_PASSWORD, AUTH_SECRET
docker compose up -d --build
```

Der App-Container führt beim Start automatisch `prisma migrate deploy` aus und lauscht auf Port 3000. Für den ersten Admin-User einmalig seeden:

```bash
docker compose exec app npx prisma db seed 2>/dev/null || true
```

Falls das Image kein Seed-Tooling enthält, alternativ lokal mit `DATABASE_URL` auf den Server zeigen und `npm run db:seed` ausführen. Davor ggf. `SEED_ADMIN_EMAIL` und `SEED_ADMIN_PASSWORD` setzen.

> **Hinweis:** Für den Betrieb über das Internet einen Reverse-Proxy mit HTTPS davorschalten (z.B. Caddy oder Traefik).

## API-Überblick

| Endpunkt | Methoden | Beschreibung |
| --- | --- | --- |
| `/api/items` | GET, POST | Artikel suchen/anlegen |
| `/api/items/{id}` | GET, PATCH, DELETE | Artikel lesen/ändern/löschen |
| `/api/items/by-barcode/{code}` | GET | Artikel per Barcode (für Scanner) |
| `/api/warehouses` | GET, POST | Lager |
| `/api/warehouses/{id}` | PATCH, DELETE | Lager ändern/löschen |
| `/api/stock` | GET | Bestand, Filter: `?warehouseId=`, `?q=` |
| `/api/suppliers` | GET | Alle bisher verwendeten Lieferanten |
| `/api/movements` | GET, POST | Historie / Buchung (`type`: `IN`, `OUT`, `ADJUST`) |
| `/api/users` | GET, POST | Benutzer (nur Admin) |

Alle Endpunkte erfordern eine angemeldete Session.
