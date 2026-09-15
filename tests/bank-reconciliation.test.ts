import assert from "node:assert/strict";
import test from "node:test";
import { parseElbaCsv, suggestMatches, type MatchCandidate } from "../lib/bank-reconciliation";

const invoice = (overrides: Partial<MatchCandidate> = {}): MatchCandidate => ({
  id: "invoice-1",
  number: "RE-2025/0042",
  customerName: "Mustermann Beratung GmbH",
  issueDate: new Date("2025-09-01T12:00:00Z"),
  dueDate: new Date("2025-09-15T12:00:00Z"),
  grossTotal: 120,
  paidTotal: 0,
  skontoGranted: 0,
  skontoPercent: 0,
  skontoDays: 0,
  ...overrides,
});

test("liest das kopflose ELBA-Format samt BOM und Auftraggeberdaten", () => {
  const csv = '\uFEFF02.09.2025;"Auftraggeber: Max Mustermann Zahlungsreferenz: RE-2025/0042 IBAN Auftraggeber: AT001234567890123456 BIC Auftraggeber: TESTATXX";02.09.2025;120,00;EUR;02.09.2025 08:55:55:943\n';
  const [row] = parseElbaCsv(csv);
  assert.equal(row.amount, 120);
  assert.equal(row.counterpartyName, "Max Mustermann");
  assert.equal(row.paymentReference, "RE-2025/0042");
  assert.equal(row.counterpartyIban, "AT001234567890123456");
});

test("verarbeitet Semikolons, Zeilenumbrüche und doppelte Anführungszeichen in Textfeldern", () => {
  const csv = '02.09.2025;"Auftraggeber: Max; Mustermann Zahlungsreferenz: Rechnung ""42""\nDanke IBAN Auftraggeber: AT001234567890123456";02.09.2025;1.234,56;EUR;ref\n';
  const [row] = parseElbaCsv(csv);
  assert.equal(row.amount, 1234.56);
  assert.match(row.description, /Max; Mustermann/);
  assert.match(row.description, /"42"/);
});

test("ordnet Rechnungsnummer und passenden Betrag automatisch zu", () => {
  const suggestions = suggestMatches({
    amount: 120,
    bookingDate: new Date("2025-09-10T12:00:00Z"),
    description: "Auftraggeber: Max Mustermann Zahlungsreferenz: RE-2025/0042",
    counterpartyName: "Max Mustermann",
  }, [invoice()]);
  assert.equal(suggestions[0]?.invoiceId, "invoice-1");
  assert.equal(suggestions[0]?.confidence, "AUTO");
});

test("verwechselt eine Rechnungsnummer nicht mit einer längeren Ziffernfolge", () => {
  const suggestions = suggestMatches({
    amount: 80,
    bookingDate: new Date("2025-09-10T12:00:00Z"),
    description: "Zahlungsreferenz: XRE-2025/00421Y",
    counterpartyName: null,
  }, [invoice()]);
  assert.equal(suggestions.length, 0);
});

test("macht bei passendem Betrag und Kundennamen nur einen Vorschlag", () => {
  const suggestions = suggestMatches({
    amount: 120,
    bookingDate: new Date("2025-09-10T12:00:00Z"),
    description: "Auftraggeber: Mustermann Beratung",
    counterpartyName: "Mustermann Beratung",
  }, [invoice()]);
  assert.equal(suggestions[0]?.confidence, "SUGGESTION");
  assert.ok((suggestions[0]?.score ?? 0) >= 50);
});

test("erkennt einen fristgerechten Skontobetrag", () => {
  const suggestions = suggestMatches({
    amount: 117.6,
    bookingDate: new Date("2025-09-08T12:00:00Z"),
    description: "Zahlungsreferenz RE 2025 0042",
    counterpartyName: "Mustermann Beratung",
  }, [invoice({ skontoPercent: 2, skontoDays: 10 })]);
  assert.equal(suggestions[0]?.confidence, "AUTO");
  assert.equal(suggestions[0]?.grantSkonto, true);
});
