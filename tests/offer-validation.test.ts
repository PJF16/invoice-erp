import assert from "node:assert/strict";
import test from "node:test";
import { finalizeOfferSchema } from "../lib/validation";

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
