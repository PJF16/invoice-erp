import assert from "node:assert/strict";
import test from "node:test";
import { finalizeOfferSchema, offerSchema } from "../lib/validation";

const validOffer = {
  customerId: "customer-1",
  issueDate: "2026-09-15",
  validUntil: "2026-10-15",
  taxTreatment: "STANDARD",
  lines: [{ description: "Beratung", quantity: 1, unitPrice: 100 }],
};

test("Angebote können ohne eigene Nummer und Datum finalisiert werden", () => {
  assert.deepEqual(finalizeOfferSchema.parse({}), {});
});

test("eigene Angebotsnummern werden getrimmt und ein eigenes Datum wird geparst", () => {
  const result = finalizeOfferSchema.parse({
    number: "  EXT-2026-42  ",
    issueDate: "2026-09-15",
  });

  assert.equal(result.number, "EXT-2026-42");
  assert.equal(result.issueDate?.toISOString(), "2026-09-15T00:00:00.000Z");
});

test("leere eigene Angebotsnummern werden abgelehnt", () => {
  assert.equal(finalizeOfferSchema.safeParse({ number: "   " }).success, false);
});

test("eine eigene Angebotsnummer kann bereits beim Erstellen angegeben werden", () => {
  const result = offerSchema.parse({ ...validOffer, number: "  ANG-SPEZIAL-42  " });

  assert.equal(result.number, "ANG-SPEZIAL-42");
});

test("ein Leistungszeitraum muss vollständig und chronologisch sein", () => {
  assert.equal(offerSchema.safeParse({ ...validOffer, servicePeriodStart: "2026-09-20" }).success, false);
  assert.equal(offerSchema.safeParse({
    ...validOffer,
    servicePeriodStart: "2026-09-30",
    servicePeriodEnd: "2026-09-20",
  }).success, false);
});
