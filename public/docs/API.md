# invoice-erp REST API

Die vollständige, maschinenlesbare Beschreibung steht unter `GET /api/openapi` (OpenAPI 3.1). Eine HTML-Übersicht ist unter `/api-docs` verfügbar.

## Authentifizierung

Erzeuge unter **API & Integrationen** einen Schlüssel. Der Klartext wird genau einmal angezeigt und serverseitig ausschließlich als SHA-256-Hash gespeichert.

```http
Authorization: Bearer ierp_...
```

Ein Schlüssel hat stets dieselbe Rolle und dieselben Modulrechte (`STOCK`, `INVOICES`) wie sein Benutzer. Ändern sich die Benutzerrechte, wirkt dies sofort. Ein optionales Ablaufdatum und der letzte Nutzungszeitpunkt sind in der Schlüsselverwaltung sichtbar. Bestehende Auth.js-Session-Cookies bleiben für Weboberfläche und iOS-App vollständig kompatibel.

Test:

```bash
curl https://erp.example.com/api/me \
  -H 'Authorization: Bearer ierp_IHR_SCHLUESSEL'
```

## Konventionen

- Request- und Response-Daten sind JSON, außer PDF-, ZIP- und Datei-Downloads sowie `multipart/form-data` beim Nachweis-Upload.
- Datumswerte sind ISO-8601 (`2026-09-10` oder ein ISO-Zeitstempel).
- Geldbeträge sind Dezimalzahlen in EUR. Prisma-Decimal-Werte können in Antworten als JSON-Strings erscheinen; Integrationen sollten beides akzeptieren und nicht mit binären Fließkommazahlen summieren.
- Erfolgreiches Anlegen antwortet mit HTTP 201, sonstige erfolgreiche Aktionen mit 200.
- Fehler haben mindestens die Form `{ "error": "Deutsche Fehlermeldung" }`; `code` kann zusätzlich vorhanden sein.
- Typische Statuscodes: 400 Eingabe/Workflow, 401 Authentifizierung, 403 Berechtigung, 404 nicht gefunden, 409 Konflikt.
- Große Listen unterstützen `limit` (maximal 500) und `offset`. Unterstützte Filter stehen in OpenAPI.

## Rechnung erstellen und herunterladen

1. Kunde über `POST /api/customers` anlegen oder über `GET /api/customers` auswählen.
2. Entwurf über `POST /api/invoices` erstellen.
3. Entwurf über `POST /api/invoices/{id}/finalize` finalisieren. Hier werden Nummer, Kundensnapshot und gegebenenfalls Hardware-Lagerbuchungen atomar erzeugt.
4. PDF über `GET /api/invoices/{id}/pdf` herunterladen.
5. Optional über `POST /api/invoices/{id}/send` per E-Mail senden.

Beispiel:

```bash
curl https://erp.example.com/api/invoices \
  -H 'Authorization: Bearer ierp_IHR_SCHLUESSEL' \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId": "KUNDEN_ID",
    "issueDate": "2026-09-10",
    "dueDate": "2026-09-24",
    "taxTreatment": "STANDARD",
    "lines": [{
      "description": "Beratung",
      "quantity": 2,
      "unit": "Std",
      "unitPrice": 120,
      "taxRate": 20,
      "supplyKind": "SERVICE"
    }]
  }'
```

Eine Rechnung wird niemals durch simples Setzen eines Felds storniert. `POST /api/invoices/{id}/status` mit `{ "status": "CANCELED" }` erzeugt eine verknüpfte Gutschrift mit negierten Beträgen und bucht Hardware zurück.

## Angebot erstellen und umwandeln

1. `POST /api/offers` erzeugt einen Entwurf.
2. `POST /api/offers/{id}/finalize` vergibt die Angebotsnummer.
3. `POST /api/offers/{id}/status` mit `ACCEPTED` nimmt das Angebot an.
4. `POST /api/offers/{id}/convert` erzeugt einen verknüpften Rechnungsentwurf.
5. `GET /api/offers/{id}/pdf` liefert das PDF.

## Lager und Lieferscheine

Bestandsänderungen laufen ausschließlich über `POST /api/movements`, `POST /api/delivery-notes` oder beim Finalisieren einer Hardware-Rechnung. `OUT` kann den Bestand nicht unter null senken. Bei `ADJUST` ist `quantity` der neue absolute Bestand, bei `IN` und `OUT` die positive Buchungsmenge.

Ein Lieferschein mit `deliveryMethod: STOCK` bucht seine Positionen atomar aus den angegebenen Lagern. `DISTRIBUTOR_DIRECT` verlangt einen Distributor und benötigt kein Lager. Stornos erfolgen über `POST /api/delivery-notes/{id}/cancel`; optionale `lines` ermöglichen Teilstornos.

## Zahlungen und Mahnungen

- `POST /api/invoices/{id}/payments` erfasst Teil- oder Vollzahlungen.
- `DELETE /api/invoices/{id}/payments/{paymentId}` entfernt eine Zahlung und berechnet den Status neu.
- Der Rechnungsstatus `PAID` bucht den gesamten offenen Restbetrag als Zahlung; `OPEN` entfernt alle Zahlungen.
- `POST /api/invoices/{id}/remind` versendet eine Zahlungserinnerung nach den konfigurierten Vorlagen.

## Dateien und Exporte

PDF-Endpunkte antworten mit `application/pdf`. `POST /api/export` liefert `application/zip` und enthält nur finalisierte Belege. Nachweise werden per `multipart/form-data` mit den Feldern `file`, `type` und optional `note` an `/api/invoices/{id}/evidences` gesendet; maximal 10 MB.

```bash
curl https://erp.example.com/api/invoices/RECHNUNGS_ID/pdf \
  -H 'Authorization: Bearer ierp_IHR_SCHLUESSEL' \
  --output rechnung.pdf
```

## Rückwärtskompatibilität

Die bestehenden Endpunkte unter `/api` bleiben unverändert, damit die iOS-App weiterarbeitet. Neue optionale Felder und neue Endpunkte sind additive Änderungen. Breaking Changes werden künftig unter einem neuen Basispfad versioniert.
