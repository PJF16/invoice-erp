type Method = "get" | "post" | "patch" | "put" | "delete";
type OperationOptions = {
  body?: string;
  bodyRequired?: boolean;
  binary?: "application/pdf" | "application/zip" | "application/octet-stream";
  parameters?: Record<string, unknown>[];
  admin?: boolean;
};

const id = { name: "id", in: "path", required: true, schema: { type: "string" } };
const evidenceId = { name: "evidenceId", in: "path", required: true, schema: { type: "string" } };
const query = (name: string, type = "string", description?: string) => ({ name, in: "query", required: false, description, schema: { type } });
const pagination = [query("limit", "integer", "Seitengröße, maximal 500"), query("offset", "integer", "Anzahl zu überspringender Datensätze")];

function operation(tag: string, summary: string, options: OperationOptions = {}): Record<string, unknown> {
  const success = options.binary
    ? { description: "Datei", content: { [options.binary]: { schema: { type: "string", format: "binary" } } } }
    : { description: "Erfolgreich", content: { "application/json": { schema: {} } } };
  return {
    tags: [tag],
    summary,
    ...(options.admin ? { description: "Nur für Administratoren." } : {}),
    ...(options.parameters ? { parameters: options.parameters } : {}),
    ...(options.body ? {
      requestBody: {
        required: options.bodyRequired ?? true,
        content: { "application/json": { schema: { $ref: `#/components/schemas/${options.body}` } } },
      },
    } : {}),
    responses: {
      "200": success,
      ...(options.body ? { "201": success } : {}),
      "400": { $ref: "#/components/responses/BadRequest" },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "404": { $ref: "#/components/responses/NotFound" },
      "409": { $ref: "#/components/responses/Conflict" },
    },
  };
}

const path = (methods: Partial<Record<Method, ReturnType<typeof operation>>>) => methods;

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "invoice-erp API",
    version: "1.0.0",
    description: "Vollständige REST-API für Lager, Kunden, Angebote, Lieferscheine, Rechnungen und Administration. Geldbeträge sind Dezimalzahlen in EUR, Datumswerte ISO-8601. Entwürfe werden erst durch die jeweiligen finalize-Endpunkte rechtswirksam und erhalten dort ihre Nummer.",
  },
  servers: [{ url: "/", description: "Aktuelle Installation" }],
  security: [{ bearerAuth: [] }],
  tags: [
    "Authentifizierung", "Dashboard", "Kunden", "Artikel", "Lager", "Bestand", "Lagerbewegungen",
    "Lieferscheine", "Softwareartikel", "Angebote", "Rechnungen", "Zahlungen", "Nachweise",
    "Wiederkehrende Rechnungen", "Export", "Einstellungen", "Benutzer", "Monitoring", "Backups",
  ].map((name) => ({ name })),
  paths: {
    "/api/openapi": path({ get: { ...operation("Authentifizierung", "OpenAPI-3.1-Spezifikation abrufen"), security: [] } }),
    "/api/me": path({ get: operation("Authentifizierung", "Aktuellen Benutzer und Berechtigungen abrufen") }),
    "/api/api-keys": path({
      get: operation("Authentifizierung", "Eigene API-Schlüssel auflisten"),
      post: operation("Authentifizierung", "API-Schlüssel erstellen (Klartext nur in dieser Antwort)", { body: "ApiKeyInput" }),
    }),
    "/api/api-keys/{id}": path({ delete: operation("Authentifizierung", "Eigenen API-Schlüssel widerrufen", { parameters: [id] }) }),
    "/api/dashboard": path({ get: operation("Dashboard", "Kennzahlen und Übersichten des Dashboards abrufen") }),
    "/api/customers": path({
      get: operation("Kunden", "Kunden auflisten", { parameters: [query("q"), ...pagination] }),
      post: operation("Kunden", "Kunden anlegen", { body: "CustomerInput" }),
    }),
    "/api/customers/{id}": path({
      get: operation("Kunden", "Kundendetails abrufen", { parameters: [id] }),
      patch: operation("Kunden", "Kunden ändern", { parameters: [id], body: "CustomerPatch" }),
      delete: operation("Kunden", "Unbenutzten Kunden löschen", { parameters: [id] }),
    }),
    "/api/customers/{id}/vat-verification": path({ post: operation("Kunden", "UID über VIES prüfen und protokollieren", { parameters: [id] }) }),
    "/api/items": path({
      get: operation("Artikel", "Hardwareartikel suchen/auflisten", { parameters: [query("q", "string", "Suche in Name, SKU und Barcode"), ...pagination] }),
      post: operation("Artikel", "Hardwareartikel anlegen", { body: "ItemInput" }),
    }),
    "/api/items/{id}": path({
      get: operation("Artikel", "Hardwareartikel mit Beständen abrufen", { parameters: [id] }),
      patch: operation("Artikel", "Hardwareartikel ändern", { parameters: [id], body: "ItemPatch" }),
      delete: operation("Artikel", "Unbenutzten Hardwareartikel löschen", { parameters: [id] }),
    }),
    "/api/items/by-barcode/{code}": path({ get: operation("Artikel", "Artikel anhand Barcode abrufen", { parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }] }) }),
    "/api/warehouses": path({
      get: operation("Lager", "Lager auflisten"),
      post: operation("Lager", "Lager anlegen", { body: "WarehouseInput" }),
    }),
    "/api/warehouses/{id}": path({
      get: operation("Lager", "Lager samt Beständen abrufen", { parameters: [id] }),
      patch: operation("Lager", "Lager ändern", { parameters: [id], body: "WarehousePatch" }),
      delete: operation("Lager", "Unbenutztes Lager löschen", { parameters: [id] }),
    }),
    "/api/stock": path({ get: operation("Bestand", "Bestände pro Artikel abrufen", { parameters: [query("warehouseId"), query("q")] }) }),
    "/api/suppliers": path({ get: operation("Bestand", "Bisher verwendete Lieferantennamen abrufen") }),
    "/api/movements": path({
      get: operation("Lagerbewegungen", "Bewegungen auflisten", { parameters: [query("warehouseId"), query("itemId"), query("type"), ...pagination] }),
      post: operation("Lagerbewegungen", "Bestand atomar ein-, aus- oder korrekturbuchen", { body: "MovementInput" }),
    }),
    "/api/movements/{id}": path({ get: operation("Lagerbewegungen", "Bewegungsdetails abrufen", { parameters: [id] }) }),
    "/api/movements/{id}/billing-status": path({ patch: operation("Lagerbewegungen", "Abrechnungsstatus einer Kundenübergabe ändern", { parameters: [id], body: "BillingStatusInput" }) }),
    "/api/movements/{id}/cancel": path({ post: operation("Lagerbewegungen", "Kundenübergabe stornieren und Bestand zurückbuchen", { parameters: [id], body: "CancellationInput" }) }),
    "/api/movement-customers": path({ get: operation("Lagerbewegungen", "Kunden mit Übergaben für Filter abrufen") }),
    "/api/customer-handovers": path({ get: operation("Lagerbewegungen", "Kundenübergaben aus Bewegungen und Lieferscheinen abrufen", { parameters: [query("customerId"), query("status"), query("source"), ...pagination] }) }),
    "/api/delivery-notes": path({
      get: operation("Lieferscheine", "Lieferscheine auflisten", { parameters: [query("customerId"), ...pagination] }),
      post: operation("Lieferscheine", "Lieferschein erstellen und Bestand atomar ausbuchen", { body: "DeliveryNoteInput" }),
    }),
    "/api/delivery-notes/{id}": path({ get: operation("Lieferscheine", "Lieferscheindetails abrufen", { parameters: [id] }) }),
    "/api/delivery-notes/{id}/pdf": path({ get: operation("Lieferscheine", "Lieferschein als PDF herunterladen", { parameters: [id], binary: "application/pdf" }) }),
    "/api/delivery-notes/{id}/cancel": path({ post: operation("Lieferscheine", "Lieferschein vollständig oder teilweise stornieren", { parameters: [id], body: "DeliveryCancellationInput" }) }),
    "/api/delivery-note-lines/{id}/billing-status": path({ patch: operation("Lieferscheine", "Abrechnungsstatus einer Lieferscheinposition ändern", { parameters: [id], body: "BillingStatusInput" }) }),
    "/api/software-items": path({
      get: operation("Softwareartikel", "Softwareartikel auflisten"),
      post: operation("Softwareartikel", "Softwareartikel anlegen", { body: "SoftwareItemInput" }),
    }),
    "/api/software-items/{id}": path({
      get: operation("Softwareartikel", "Softwareartikel abrufen", { parameters: [id] }),
      patch: operation("Softwareartikel", "Softwareartikel ändern", { parameters: [id], body: "SoftwareItemPatch" }),
      delete: operation("Softwareartikel", "Unbenutzten Softwareartikel löschen", { parameters: [id] }),
    }),
    "/api/offers": path({
      get: operation("Angebote", "Angebote auflisten", { parameters: [query("status"), ...pagination] }),
      post: operation("Angebote", "Angebotsentwurf erstellen", { body: "OfferInput" }),
    }),
    "/api/offers/{id}": path({
      get: operation("Angebote", "Angebot abrufen", { parameters: [id] }),
      patch: operation("Angebote", "Angebotsentwurf vollständig ändern", { parameters: [id], body: "OfferInput" }),
      delete: operation("Angebote", "Angebotsentwurf löschen", { parameters: [id] }),
    }),
    "/api/offers/{id}/finalize": path({ post: operation("Angebote", "Angebot finalisieren und Nummer vergeben", { parameters: [id] }) }),
    "/api/offers/{id}/status": path({ post: operation("Angebote", "Angebot annehmen, ablehnen oder öffnen", { parameters: [id], body: "OfferStatusInput" }) }),
    "/api/offers/{id}/convert": path({ post: operation("Angebote", "Angenommenes Angebot in Rechnungsentwurf umwandeln", { parameters: [id] }) }),
    "/api/offers/{id}/pdf": path({ get: operation("Angebote", "Angebot als PDF herunterladen", { parameters: [id], binary: "application/pdf" }) }),
    "/api/invoices": path({
      get: operation("Rechnungen", "Rechnungen und Gutschriften auflisten", { parameters: [query("status"), query("customerId"), query("q"), ...pagination] }),
      post: operation("Rechnungen", "Rechnungsentwurf erstellen", { body: "InvoiceInput" }),
    }),
    "/api/invoices/{id}": path({
      get: operation("Rechnungen", "Rechnung mit Positionen abrufen", { parameters: [id] }),
      patch: operation("Rechnungen", "Rechnungsentwurf vollständig ändern", { parameters: [id], body: "InvoiceInput" }),
      delete: operation("Rechnungen", "Rechnungsentwurf löschen", { parameters: [id] }),
    }),
    "/api/invoices/{id}/finalize": path({ post: operation("Rechnungen", "Rechnung finalisieren, Nummer vergeben und Hardware buchen", { parameters: [id], body: "FinalizeInvoiceInput", bodyRequired: false }) }),
    "/api/invoices/{id}/send": path({ post: operation("Rechnungen", "Finalisierte Rechnung per E-Mail senden", { parameters: [id] }) }),
    "/api/invoices/{id}/remind": path({ post: operation("Rechnungen", "Zahlungserinnerung senden", { parameters: [id] }) }),
    "/api/invoices/{id}/status": path({ post: operation("Rechnungen", "Zahlungsstatus ändern oder Stornorechnung erzeugen", { parameters: [id], body: "InvoiceStatusInput" }) }),
    "/api/invoices/{id}/pdf": path({ get: operation("Rechnungen", "Rechnung als PDF herunterladen", { parameters: [id], binary: "application/pdf" }) }),
    "/api/invoices/{id}/payments": path({
      get: operation("Zahlungen", "Zahlungen einer Rechnung auflisten", { parameters: [id] }),
      post: operation("Zahlungen", "Zahlung erfassen", { parameters: [id], body: "PaymentInput" }),
    }),
    "/api/invoices/{id}/payments/{paymentId}": path({ delete: operation("Zahlungen", "Zahlung löschen", { parameters: [id, { name: "paymentId", in: "path", required: true, schema: { type: "string" } }] }) }),
    "/api/invoices/{id}/evidences": path({
      get: operation("Nachweise", "Metadaten der Rechnungsnachweise auflisten", { parameters: [id] }),
      post: { ...operation("Nachweise", "Nachweis hochladen (multipart/form-data, max. 10 MB)", { parameters: [id] }), requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file", "type"], properties: { file: { type: "string", format: "binary" }, type: { $ref: "#/components/schemas/EvidenceType" }, note: { type: "string" } } } } } } },
    }),
    "/api/invoices/{id}/evidences/{evidenceId}": path({
      get: operation("Nachweise", "Nachweisdatei herunterladen", { parameters: [id, evidenceId], binary: "application/octet-stream" }),
      delete: operation("Nachweise", "Nachweis entfernen", { parameters: [id, evidenceId] }),
    }),
    "/api/recurring-invoices": path({
      get: operation("Wiederkehrende Rechnungen", "Vorlagen auflisten"),
      post: operation("Wiederkehrende Rechnungen", "Vorlage anlegen", { body: "RecurringInvoiceInput" }),
    }),
    "/api/recurring-invoices/{id}": path({
      get: operation("Wiederkehrende Rechnungen", "Vorlage samt erzeugten Rechnungen abrufen", { parameters: [id] }),
      patch: operation("Wiederkehrende Rechnungen", "Vorlage vollständig ändern", { parameters: [id], body: "RecurringInvoiceInput" }),
      delete: operation("Wiederkehrende Rechnungen", "Vorlage löschen", { parameters: [id] }),
    }),
    "/api/recurring-invoices/{id}/run": path({ post: operation("Wiederkehrende Rechnungen", "Vorlage sofort ausführen", { parameters: [id] }) }),
    "/api/export": path({ post: operation("Export", "Finalisierte Belege als ZIP exportieren", { body: "ExportFilter", binary: "application/zip" }) }),
    "/api/export-schedules": path({
      get: operation("Export", "Exportpläne auflisten"),
      post: operation("Export", "Exportplan anlegen", { body: "ExportScheduleInput" }),
    }),
    "/api/export-schedules/{id}": path({
      get: operation("Export", "Exportplan abrufen", { parameters: [id] }),
      patch: operation("Export", "Exportplan ändern", { parameters: [id], body: "ExportSchedulePatch" }),
      delete: operation("Export", "Exportplan löschen", { parameters: [id] }),
    }),
    "/api/export-schedules/{id}/run": path({ post: operation("Export", "Exportplan sofort ausführen und versenden", { parameters: [id] }) }),
    "/api/settings": path({
      get: operation("Einstellungen", "Firmeneinstellungen abrufen"),
      put: operation("Einstellungen", "Firmeneinstellungen ersetzen", { body: "SettingsInput", admin: true }),
    }),
    "/api/users": path({
      get: operation("Benutzer", "Benutzer auflisten", { admin: true }),
      post: operation("Benutzer", "Benutzer anlegen", { body: "UserInput", admin: true }),
    }),
    "/api/users/{id}": path({
      get: operation("Benutzer", "Benutzer abrufen", { parameters: [id], admin: true }),
      patch: operation("Benutzer", "Benutzer ändern", { parameters: [id], body: "UserPatch", admin: true }),
    }),
    "/api/mail-events": path({ get: operation("Monitoring", "Mail-Versandereignisse abrufen", { parameters: [query("status"), query("kind"), ...pagination] }) }),
    "/api/backup-settings": path({
      get: operation("Backups", "Backup-Einstellungen abrufen", { admin: true }),
      put: operation("Backups", "Backup-Einstellungen ersetzen", { body: "BackupSettingsInput", admin: true }),
    }),
    "/api/backups/run": path({ post: operation("Backups", "Backup sofort ausführen", { admin: true }) }),
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key", description: "API-Schlüssel im Format ierp_…" },
    },
    responses: {
      BadRequest: { description: "Ungültige Eingabe", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      Unauthorized: { description: "Nicht angemeldet oder ungültiger API-Schlüssel", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      Forbidden: { description: "Fehlende Rolle oder Modulberechtigung", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      NotFound: { description: "Nicht gefunden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      Conflict: { description: "Konflikt oder eindeutiger Wert bereits vorhanden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
    },
    schemas: {
      Error: { type: "object", required: ["error"], properties: { error: { type: "string" }, code: { type: ["string", "null"] } } },
      ApiKeyInput: { type: "object", required: ["name"], properties: { name: { type: "string", maxLength: 100 }, expiresAt: { type: ["string", "null"], description: "ISO-Datum (gilt bis Tagesende UTC) oder ISO-Zeitstempel." } } },
      TaxTreatment: { type: "string", enum: ["STANDARD", "REVERSE_CHARGE", "INTRA_EU_SUPPLY", "EXPORT", "THIRD_COUNTRY_SERVICE"] },
      SupplyKind: { type: "string", enum: ["GOODS", "SERVICE", "ELECTRONIC_SERVICE"] },
      EvidenceType: { type: "string", enum: ["TRANSPORT_PROOF", "EXPORT_PROOF", "TAX_DOCUMENT", "OTHER"] },
      ItemInput: { type: "object", required: ["name"], properties: { name: { type: "string" }, sku: { type: ["string", "null"] }, barcode: { type: ["string", "null"] }, description: { type: ["string", "null"] }, supplyKind: { $ref: "#/components/schemas/SupplyKind", default: "GOODS" } } },
      ItemPatch: { type: "object", description: "Teiländerung; zulässig sind name, sku, barcode, description und supplyKind.", additionalProperties: true },
      WarehouseInput: { type: "object", required: ["name"], properties: { name: { type: "string" }, location: { type: ["string", "null"] } } },
      WarehousePatch: { type: "object", description: "Teiländerung; name und location sind optional.", additionalProperties: true },
      MovementInput: { type: "object", required: ["itemId", "warehouseId", "type", "quantity"], properties: { itemId: { type: "string" }, warehouseId: { type: "string" }, type: { type: "string", enum: ["IN", "OUT", "ADJUST"] }, quantity: { type: "integer", minimum: 0, description: "Bei ADJUST der neue absolute Bestand, sonst positive Buchungsmenge." }, customerId: { type: ["string", "null"], description: "Nur bei OUT." }, supplier: { type: ["string", "null"], description: "Typischerweise nur bei IN." }, note: { type: ["string", "null"] } } },
      BillingStatusInput: { type: "object", required: ["billingStatus"], properties: { billingStatus: { type: "string", enum: ["PENDING", "INVOICED", "GIFTED"] } } },
      CancellationInput: { type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 3, maxLength: 500 } } },
      CustomerInput: { type: "object", required: ["name"], properties: { customerNumber: { type: ["string", "null"] }, name: { type: "string", description: "Firmenname; bei Privatkunden wird der Anzeigename aus Vor- und Nachname gebildet." }, firstName: { type: ["string", "null"] }, lastName: { type: ["string", "null"] }, contactPerson: { type: ["string", "null"] }, email: { type: ["string", "null"], format: "email" }, street: { type: "string", default: "" }, zip: { type: "string", default: "" }, city: { type: "string", default: "" }, country: { type: "string", default: "Österreich" }, countryCode: { type: "string", pattern: "^[A-Z]{2}$", default: "AT" }, customerType: { type: "string", enum: ["BUSINESS", "CONSUMER"], default: "BUSINESS" }, uid: { type: ["string", "null"] }, defaultTaxTreatment: { $ref: "#/components/schemas/TaxTreatment" }, paymentDays: { type: ["integer", "null"], minimum: 0, maximum: 365 }, notes: { type: ["string", "null"] } } },
      CustomerPatch: { type: "object", description: "Teiländerung mit denselben Feldern wie CustomerInput; alle Felder optional.", additionalProperties: true },
      SoftwareItemInput: { type: "object", required: ["name", "unitPrice"], properties: { name: { type: "string" }, description: { type: ["string", "null"] }, unitPrice: { type: "number", minimum: 0 }, unit: { type: "string", default: "Monat" }, active: { type: "boolean", default: true }, supplyKind: { type: "string", enum: ["SERVICE", "ELECTRONIC_SERVICE"] } } },
      SoftwareItemPatch: { type: "object", description: "Teiländerung mit denselben Feldern wie SoftwareItemInput; alle Felder optional.", additionalProperties: true },
      DocumentLine: { type: "object", required: ["description", "quantity", "unitPrice"], properties: { description: { type: "string" }, quantity: { type: "number", exclusiveMinimum: 0 }, unit: { type: "string", default: "Stk" }, unitPrice: { type: "number", minimum: 0 }, taxRate: { type: "integer", enum: [0, 10, 13, 20], default: 20 }, supplyKind: { $ref: "#/components/schemas/SupplyKind" }, softwareItemId: { type: ["string", "null"] }, itemId: { type: ["string", "null"] }, warehouseId: { type: ["string", "null"] }, sourceMovementId: { type: ["string", "null"] }, sourceDeliveryNoteLineId: { type: ["string", "null"] } } },
      InvoiceInput: { type: "object", required: ["customerId", "issueDate", "dueDate", "lines"], properties: { customerId: { type: "string" }, issueDate: { type: "string", format: "date" }, dueDate: { type: "string", format: "date" }, deliveryDate: { type: ["string", "null"], format: "date" }, servicePeriodStart: { type: ["string", "null"], format: "date" }, servicePeriodEnd: { type: ["string", "null"], format: "date" }, taxTreatment: { $ref: "#/components/schemas/TaxTreatment" }, notes: { type: ["string", "null"] }, lines: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/DocumentLine" } } } },
      OfferInput: { type: "object", required: ["customerId", "issueDate", "validUntil", "lines"], properties: { customerId: { type: "string" }, issueDate: { type: "string", format: "date" }, validUntil: { type: "string", format: "date" }, deliveryDate: { type: ["string", "null"], format: "date" }, servicePeriodStart: { type: ["string", "null"], format: "date" }, servicePeriodEnd: { type: ["string", "null"], format: "date" }, taxTreatment: { $ref: "#/components/schemas/TaxTreatment" }, notes: { type: ["string", "null"] }, lines: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/DocumentLine" } } } },
      OfferStatusInput: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["OPEN", "ACCEPTED", "REJECTED"] } } },
      InvoiceStatusInput: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["OPEN", "PAID", "CANCELED"], description: "CANCELED erzeugt immer eine verknüpfte Stornorechnung." } } },
      FinalizeInvoiceInput: { type: "object", properties: { acknowledgeUidWarning: { type: "boolean", default: false }, uidCheckOverrideReason: { type: ["string", "null"], minLength: 3, maxLength: 500 } } },
      PaymentInput: { type: "object", required: ["amount", "date"], properties: { amount: { type: "number", exclusiveMinimum: 0 }, date: { type: "string", format: "date" }, method: { type: "string", enum: ["BANK_TRANSFER", "CASH", "CARD", "DIRECT_DEBIT", "PAYPAL", "OTHER"] }, reference: { type: ["string", "null"] }, note: { type: ["string", "null"] }, grantSkonto: { type: "boolean", default: false } } },
      DeliveryNoteInput: { type: "object", required: ["customerId", "lines"], properties: { customerId: { type: "string" }, issueDate: { type: "string", format: "date" }, deliveryMethod: { type: "string", enum: ["STOCK", "DISTRIBUTOR_DIRECT"], default: "STOCK" }, distributor: { type: ["string", "null"] }, distributorReference: { type: ["string", "null"] }, trackingNumber: { type: ["string", "null"] }, notes: { type: ["string", "null"] }, lines: { type: "array", minItems: 1, maxItems: 200, items: { type: "object", required: ["itemId", "quantity"], properties: { itemId: { type: "string" }, warehouseId: { type: ["string", "null"] }, quantity: { type: "integer", minimum: 1 } } } } } },
      DeliveryCancellationInput: { allOf: [{ $ref: "#/components/schemas/CancellationInput" }, { type: "object", properties: { lines: { type: "array", items: { type: "object", required: ["lineId", "quantity"], properties: { lineId: { type: "string" }, quantity: { type: "integer", minimum: 1 } } } } } }] },
      RecurringLine: { type: "object", required: ["quantity"], properties: { softwareItemId: { type: ["string", "null"] }, description: { type: ["string", "null"] }, unitPrice: { type: ["number", "null"], minimum: 0 }, priceAdjustmentType: { type: "string", enum: ["ABSOLUTE", "PERCENTAGE"] }, priceAdjustmentValue: { type: "number", minimum: 0 }, priceAdjustmentIsDiscount: { type: "boolean" }, quantity: { type: "number", exclusiveMinimum: 0 }, unit: { type: "string" }, taxRate: { type: "integer", enum: [0, 10, 13, 20] }, supplyKind: { $ref: "#/components/schemas/SupplyKind" } } },
      RecurringInvoiceInput: { type: "object", required: ["name", "customerId", "nextRun", "lines"], properties: { name: { type: "string" }, customerId: { type: "string" }, interval: { type: "string", enum: ["MONTHLY", "QUARTERLY", "YEARLY"] }, nextRun: { type: "string", format: "date-time" }, active: { type: "boolean" }, autoSend: { type: "boolean" }, taxTreatment: { $ref: "#/components/schemas/TaxTreatment" }, notes: { type: ["string", "null"] }, lines: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/RecurringLine" } } } },
      ExportFilter: { type: "object", required: ["types"], properties: { dateFrom: { type: ["string", "null"], format: "date" }, dateTo: { type: ["string", "null"], format: "date" }, types: { type: "array", minItems: 1, items: { type: "string", enum: ["INVOICE", "CREDIT_NOTE"] } }, status: { type: ["string", "null"], enum: ["OPEN", "SENT", "PAID", "CANCELED", null] }, customerId: { type: ["string", "null"] } } },
      ExportScheduleInput: { type: "object", required: ["name", "nextRun", "types", "recipientEmail", "emailSubject", "emailBody"], properties: { name: { type: "string" }, active: { type: "boolean" }, interval: { type: "string", enum: ["MONTHLY", "QUARTERLY", "YEARLY"] }, nextRun: { type: "string", format: "date-time" }, period: { type: "string", enum: ["PREVIOUS_MONTH", "PREVIOUS_QUARTER", "PREVIOUS_YEAR", "ALL_TIME"] }, types: { type: "array", items: { type: "string", enum: ["INVOICE", "CREDIT_NOTE"] } }, recipientEmail: { type: "string" }, emailSubject: { type: "string" }, emailBody: { type: "string" } } },
      ExportSchedulePatch: { type: "object", description: "Teiländerung mit denselben Feldern wie ExportScheduleInput; alle Felder optional.", additionalProperties: true },
      SettingsInput: { type: "object", description: "Vollständige Firmeneinstellungen; GET /api/settings liefert die aktuelle Form als Vorlage.", required: ["name", "street", "zip", "city", "country", "uid", "iban", "bic", "bankName", "email", "phone", "invoicePrefix", "invoiceNumberCycle", "offerPrefix", "deliveryNotePrefix", "paymentDays", "emailSubject", "emailBody", "autoReminders", "reminderDays", "maxReminders", "reminderSubject", "reminderBody", "skontoPercent", "skontoDays"], properties: { name: { type: "string" }, street: { type: "string" }, zip: { type: "string" }, city: { type: "string" }, country: { type: "string" }, uid: { type: "string" }, iban: { type: "string" }, bic: { type: "string" }, bankName: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, invoicePrefix: { type: "string", maxLength: 20 }, invoiceNumberCycle: { type: "string", enum: ["YEARLY", "DAILY", "CUSTOM"] }, nextInvoiceNumber: { type: "integer", minimum: 1 }, offerPrefix: { type: "string", maxLength: 20 }, deliveryNotePrefix: { type: "string", maxLength: 20 }, paymentDays: { type: "integer", minimum: 0, maximum: 365 }, emailSubject: { type: "string" }, emailBody: { type: "string" }, autoReminders: { type: "boolean" }, reminderDays: { type: "integer", minimum: 1, maximum: 90 }, maxReminders: { type: "integer", minimum: 1, maximum: 10 }, reminderSubject: { type: "string" }, reminderBody: { type: "string" }, skontoPercent: { type: "integer", minimum: 0, maximum: 100 }, skontoDays: { type: "integer", minimum: 0, maximum: 365 } } },
      BackupSettingsInput: { type: "object", description: "Vollständige Backup-Einstellungen. smbPassword nur zum Setzen oder Ändern mitsenden.", required: ["enabled", "target", "interval", "nextRun", "localPath", "smbHost", "smbPort", "smbShare", "smbPath", "smbDomain", "smbUsername"], properties: { enabled: { type: "boolean" }, target: { type: "string", enum: ["LOCAL", "SMB"] }, interval: { type: "string", enum: ["DAILY", "WEEKLY", "MONTHLY"] }, nextRun: { type: ["string", "null"], format: "date-time" }, localPath: { type: "string" }, smbHost: { type: "string" }, smbPort: { type: "integer", minimum: 1, maximum: 65535 }, smbShare: { type: "string" }, smbPath: { type: "string" }, smbDomain: { type: "string" }, smbUsername: { type: "string" }, smbPassword: { type: "string", writeOnly: true } } },
      UserInput: { type: "object", required: ["email", "name", "password"], properties: { email: { type: "string", format: "email" }, name: { type: "string" }, password: { type: "string", minLength: 8 }, role: { type: "string", enum: ["ADMIN", "MEMBER"] }, modules: { type: "array", items: { type: "string", enum: ["STOCK", "INVOICES"] } } } },
      UserPatch: { type: "object", required: ["name"], properties: { email: { type: "string", format: "email" }, name: { type: "string" }, password: { type: "string", minLength: 8 }, role: { type: "string", enum: ["ADMIN", "MEMBER"] }, modules: { type: "array", items: { type: "string", enum: ["STOCK", "INVOICES"] } } } },
    },
  },
} as const;

export type ApiPath = keyof typeof openApiDocument.paths;
