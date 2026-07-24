# LagerScanner (iOS-App)

SwiftUI-App zum Ein- und Ausbuchen per Barcode-Scan sowie zum Zusammenstellen und Versenden von Paketen gegen die Lagerverwaltungs-API.

## Funktionen

- Login mit denselben Zugangsdaten wie die Weboberfläche (Server-URL einstellbar)
- Barcode-Scanner (VisionKit) + manuelle Barcode-Eingabe als Fallback
- Nach dem Scan: Artikel mit Bestand, Lager wählen, Menge, **Einbuchen/Ausbuchen**
- Im Tab **Paket** einen Kunden und ein Lager wählen, mehrere Artikel fortlaufend scannen und Mengen vor dem Abschluss korrigieren
- Aus dem Paket direkt einen nummerierten Lieferschein erstellen; alle Positionen werden dabei gemeinsam ausgebucht und mit dem Lieferschein verknüpft
- Kundenauswahl über eine Suche nach Name oder Kundennummer
- Beim Einbuchen optional **Lieferant** (mit Vorschlägen aus bisherigen Buchungen) und Notiz

## Öffnen & Starten

```bash
open ios/LagerScanner.xcodeproj
```

In Xcode ein Simulator- oder Geräteziel wählen und starten. Für echte Geräte unter *Signing & Capabilities* das eigene Team auswählen.

Das Projekt wird mit [XcodeGen](https://github.com/yonaskolb/XcodeGen) aus `project.yml` erzeugt — nach Änderungen an der Projektstruktur: `cd ios && xcodegen generate`.

## Hinweise

- Der Barcode muss beim Artikel in der Weboberfläche hinterlegt sein (Feld „Barcode").
- Im Simulator gibt es keine Kamera — dort die manuelle Barcode-Eingabe nutzen.
- `Info.plist` erlaubt aktuell HTTP (`NSAllowsArbitraryLoads`) für Server im lokalen Netz. Sobald der Server über HTTPS erreichbar ist, sollte das entfernt werden.
