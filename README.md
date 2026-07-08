# Lagerverwaltung (invoice-erp)

Modernes Lagerverwaltungs- und Rechnungsprogramm für ein österreichisches Unternehmen: Mehrbenutzer-Login, mehrere Lager, Lieferanten-Erfassung, vollständige Bewegungshistorie, Rechnungserstellung mit korrekter USt (inkl. Reverse Charge) und automatische wiederkehrende Rechnungen. Dazu eine iOS-App mit Barcode-Scanner ([ios/](ios/README.md)).

## Funktionen

- **Bestand**: Alle Artikel mit Menge, filterbar nach Lager, mit Verteilung über alle Lager und Volltextsuche
- **Ein-/Ausbuchen** direkt aus der Bestandsliste (Ausbuchen unter 0 wird abgelehnt)
- **Artikel**: Bezeichnung, SKU, Barcode (vorbereitet für den Scanner der iOS-App), Beschreibung
- **Lager**: beliebig viele Standorte
- **Historie**: jede Bewegung mit Zeitpunkt, Typ (Eingang/Ausgang/Korrektur), Menge, Lager und Benutzer
- **Benutzer**: Admin kann Mitarbeiter-Konten anlegen (Rollen: Admin / Mitarbeiter)
- **REST-API** unter `/api/…` — dieselben Endpunkte nutzt die iOS-App (inkl. `GET /api/items/by-barcode/{code}`)

### Rechnungen

- **Rechnungserstellung** mit Positionen aus Softwareartikeln, Hardware (bucht beim Finalisieren automatisch aus dem Lager aus) und Freitext
- **USt pro Position** (20/13/10/0%) und **Steuerbehandlung pro Rechnung**: Standard, Reverse Charge (EU-B2B, z.B. deutsches Unternehmen), innergemeinschaftliche Lieferung, Ausfuhr — jeweils mit gesetzlichem Hinweis auf dem PDF
- **Fortlaufende Rechnungsnummern** pro Jahr, Präfix in den Einstellungen konfigurierbar (z.B. `RE-2026-001`)
- **Workflow**: Entwurf → Finalisieren (Nummer + Ausbuchung) → per E-Mail senden (PDF-Anhang) → bezahlt / storniert
- **Stornorechnungen**: Stornieren erzeugt einen eigenen Beleg mit eigener Nummer und negierten Beträgen (buchhalterisch korrekt), bucht Hardware zurück und verknüpft beide Belege
- **Dashboard** (Startseite): Monatsumsatz, offene Posten, Überfälliges, Umsatz der letzten 6 Monate, Top-Kunden, letzte Rechnungen
- **Mahnwesen**: Überfällige Rechnungen mit Mahnstufen; Zahlungserinnerungen manuell per Klick oder automatisch (Einstellungen: erste Erinnerung nach X Tagen, Wiederholung im selben Abstand, Maximalanzahl; Vorlagen mit Platzhaltern)
- **Export**: Rechnungen und Gutschriften gefiltert nach Zeitraum, Status und Kunde als ZIP herunterladen; zusätzlich **geplante Exporte**, die zu einem festen Zeitpunkt automatisch erzeugt und per E-Mail versendet werden (z.B. „alle Rechnungen des Vormonats" monatlich am 1. an die Steuerberatung)
- **Wiederkehrende Rechnungen** (monatlich/quartalsweise/jährlich): werden vom eingebauten Scheduler automatisch erzeugt und versendet; **Softwareartikel-Preise werden bei jeder Erzeugung neu gelesen** — Preisänderungen wirken automatisch auf alle künftigen Rechnungen
- **Kundenverwaltung** mit UID und Standard-Steuerbehandlung pro Kunde
- **Einstellungen**: Firmendaten, UID, Bankverbindung (erscheint auf dem PDF), Zahlungsziel, E-Mail-Vorlagen

### E-Mail-Versand (SMTP)

Für den (automatischen) Rechnungsversand in der `.env` konfigurieren:

```bash
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="rechnung@firma.at"
SMTP_PASS="…"
SMTP_FROM="Firma GmbH <rechnung@firma.at>"
```

Der Scheduler prüft stündlich auf fällige wiederkehrende Rechnungen (deaktivierbar mit `DISABLE_RECURRING_SCHEDULER=1`). Ohne SMTP-Konfiguration werden Rechnungen trotzdem erzeugt, nur nicht versendet.

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
| `/api/customers`, `/api/customers/{id}` | GET, POST, PATCH, DELETE | Kunden |
| `/api/software-items`, `/api/software-items/{id}` | GET, POST, PATCH, DELETE | Softwareartikel |
| `/api/invoices` | GET, POST | Rechnungen (POST erzeugt Entwurf) |
| `/api/invoices/{id}` | GET, PATCH, DELETE | Rechnung (Bearbeiten/Löschen nur Entwurf) |
| `/api/invoices/{id}/finalize` | POST | Nummer vergeben + Hardware ausbuchen |
| `/api/invoices/{id}/send` | POST | Per E-Mail versenden (PDF-Anhang) |
| `/api/invoices/{id}/pdf` | GET | PDF abrufen |
| `/api/invoices/{id}/status` | POST | Bezahlt/Offen; `CANCELED` erzeugt eine Stornorechnung |
| `/api/invoices/{id}/remind` | POST | Zahlungserinnerung senden |
| `/api/recurring-invoices`, `…/{id}` | GET, POST, PATCH, DELETE | Wiederkehrende Rechnungen |
| `/api/recurring-invoices/{id}/run` | POST | Sofort eine Rechnung erzeugen |
| `/api/settings` | GET, PUT | Firmeneinstellungen (PUT nur Admin) |
| `/api/export` | POST | Belege gefiltert als ZIP herunterladen |
| `/api/export-schedules`, `…/{id}` | GET, POST, PATCH, DELETE | Geplante Exporte |
| `/api/export-schedules/{id}/run` | POST | Sofort ausführen und versenden |

Alle Endpunkte erfordern eine angemeldete Session.
