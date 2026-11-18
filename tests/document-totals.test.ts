import test from "node:test";
import assert from "node:assert/strict";
import { adjustedUnitPrice, calculateDocumentTotals } from "../lib/document-totals";
import { invoiceIssuer, invoiceTaxBreakdown } from "../lib/invoice-snapshot";

test("rundet den Abo-Stückpreis vor Positions- und Summenberechnung", () => {
  const adjustment = { priceAdjustmentType: "PERCENTAGE", priceAdjustmentValue: 5, priceAdjustmentIsDiscount: false } as const;
  const result = calculateDocumentTotals([{ quantity: 100, unitPrice: adjustedUnitPrice(9.99, adjustment), taxRate: 20 }], true);
  assert.deepEqual(result.lines, [{ quantity: 100, unitPrice: 10.49, taxRate: 20, lineNet: 1049 }]);
  assert.equal(result.taxTotal, 209.8);
  assert.equal(result.grossTotal, 1258.8);
  assert.equal(adjustedUnitPrice(0.35, { ...adjustment, priceAdjustmentValue: 10 }), 0.39);
});

test("rundet Menge, Preis und halbe Steuer-Cent dezimal und symmetrisch", () => {
  const positive = calculateDocumentTotals([{ quantity: 1.005, unitPrice: 0.045, taxRate: 10 }], true);
  const negative = calculateDocumentTotals([{ quantity: 1.005, unitPrice: -0.045, taxRate: 10 }], true);
  assert.deepEqual(positive.lines, [{ quantity: 1.01, unitPrice: 0.05, taxRate: 10, lineNet: 0.05 }]);
  assert.equal(positive.taxTotal, 0.01);
  assert.equal(negative.taxTotal, -0.01);
  assert.equal(negative.grossTotal, -0.06);
});

test("liefert dem Storno-PDF den gespeicherten Steuerbetrag und erkennt abweichende Altdaten", () => {
  const lines = [{ taxRate: 10, lineNet: -0.05 }];
  const stored = [{ rate: 10, net: -0.05, tax: -0.01 }];
  assert.deepEqual(invoiceTaxBreakdown({ lines, taxTotal: -0.01, taxTreatment: "STANDARD" }), stored);
  assert.deepEqual(invoiceTaxBreakdown({ lines, taxTotal: -0.01, taxTreatment: "STANDARD", taxBreakdown: stored }), stored);
  assert.equal(invoiceTaxBreakdown({ lines, taxTotal: -0.02, taxTreatment: "STANDARD" }), null);
});

test("nutzt für ausgestellte PDFs den gespeicherten Aussteller", () => {
  const issuer = {
    name: "Test GmbH", street: "Hauptstraße 1", zip: "1010", city: "Wien",
    country: "Österreich", uid: "", email: "", phone: "", bankName: "", iban: "AT-ALT", bic: "",
  };
  const current = { ...issuer, name: "Neue Firma", iban: "AT-NEU" };
  assert.deepEqual(invoiceIssuer(current, issuer), issuer);
  assert.deepEqual(invoiceIssuer(current), current);
});
