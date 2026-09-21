import assert from "node:assert/strict";
import test from "node:test";
import { formatLocalizedDateInput, normalizeDateInput, parseLocalizedNumber } from "../lib/localized-input";
import { invoiceSchema } from "../lib/validation";

test("normalisiert deutsche und ISO-Datumsangaben", () => {
  assert.equal(normalizeDateInput("21.09.2026"), "2026-09-21");
  assert.equal(normalizeDateInput("21/9/2026"), "2026-09-21");
  assert.equal(normalizeDateInput("21-9-2026"), "2026-09-21");
  assert.equal(normalizeDateInput("2026-09-21"), "2026-09-21");
  assert.equal(formatLocalizedDateInput("2026-09-21"), "21.09.2026");
});

test("weist unmögliche Datumsangaben zurück", () => {
  assert.equal(normalizeDateInput("31.02.2026"), null);
  assert.equal(normalizeDateInput("kein Datum"), null);
});

test("liest Dezimalzahlen mit Komma und Punkt", () => {
  assert.equal(parseLocalizedNumber("1,5"), 1.5);
  assert.equal(parseLocalizedNumber("19.99"), 19.99);
  assert.equal(parseLocalizedNumber("1,"), 1);
  assert.equal(parseLocalizedNumber(""), null);
});

test("die Rechnungs-API akzeptiert manuell eingegebene deutsche Daten", () => {
  const result = invoiceSchema.safeParse({
    customerId: "customer-1",
    issueDate: "21.09.2026",
    dueDate: "5.10.2026",
    deliveryDate: null,
    servicePeriodStart: "1.09.2026",
    servicePeriodEnd: "30.09.2026",
    taxTreatment: "STANDARD",
    notes: null,
    lines: [{
      description: "Beratung",
      quantity: 1.5,
      unit: "Stunden",
      unitPrice: 99.5,
      taxRate: 20,
      supplyKind: "SERVICE",
    }],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.issueDate.toISOString(), "2026-09-21T00:00:00.000Z");
    assert.equal(result.data.dueDate.toISOString(), "2026-10-05T00:00:00.000Z");
  }
});
