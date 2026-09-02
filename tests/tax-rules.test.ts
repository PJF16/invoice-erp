import assert from "node:assert/strict";
import test from "node:test";
import { assessTaxTreatment } from "../lib/tax-rules";
import { checkVatId, normalizeVatId } from "../lib/vat-id";

test("inländische Umsätze bleiben Standard", () => {
  const result = assessTaxTreatment({
    customerType: "BUSINESS",
    countryCode: "AT",
    uid: "ATU12345678",
    supplyKinds: ["GOODS", "ELECTRONIC_SERVICE"],
  });
  assert.equal(result.expectedTreatment, "STANDARD");
  assert.equal(result.requiresValidUid, false);
});

test("EU-B2B-Waren werden als innergemeinschaftliche Lieferung erkannt", () => {
  const result = assessTaxTreatment({
    customerType: "BUSINESS",
    countryCode: "DE",
    uid: "DE123456789",
    supplyKinds: ["GOODS"],
  });
  assert.equal(result.expectedTreatment, "INTRA_EU_SUPPLY");
  assert.equal(result.requiresValidUid, true);
});

test("EU-B2B-Software wird als Reverse Charge erkannt", () => {
  const result = assessTaxTreatment({
    customerType: "BUSINESS",
    countryCode: "DE",
    uid: "DE123456789",
    supplyKinds: ["ELECTRONIC_SERVICE"],
  });
  assert.equal(result.expectedTreatment, "REVERSE_CHARGE");
  assert.equal(result.requiresValidUid, true);
});

test("gemischte EU-B2B-Waren und Dienstleistungen müssen getrennt werden", () => {
  const result = assessTaxTreatment({
    customerType: "BUSINESS",
    countryCode: "DE",
    uid: "DE123456789",
    supplyKinds: ["GOODS", "SERVICE"],
  });
  assert.equal(result.expectedTreatment, null);
  assert.equal(result.requiresManualReview, true);
  assert.match(result.reason, /unterschiedliche Steuerbehandlungen/);
});

test("B2C-Ausland bleibt bis zur OSS-Entscheidung offen", () => {
  const result = assessTaxTreatment({
    customerType: "CONSUMER",
    countryCode: "DE",
    supplyKinds: ["ELECTRONIC_SERVICE"],
  });
  assert.equal(result.expectedTreatment, null);
  assert.equal(result.requiresManualReview, true);
});

test("B2B-Dienstleistung in die Schweiz ist keine Ausfuhrlieferung", () => {
  const result = assessTaxTreatment({
    customerType: "BUSINESS",
    countryCode: "CH",
    uid: "CHE123456789",
    supplyKinds: ["ELECTRONIC_SERVICE", "SERVICE"],
  });
  assert.equal(result.expectedTreatment, "THIRD_COUNTRY_SERVICE");
  assert.equal(result.requiresManualReview, false);
});

test("B2B-Ware in die Schweiz bleibt eine Ausfuhrlieferung", () => {
  const result = assessTaxTreatment({
    customerType: "BUSINESS",
    countryCode: "CH",
    uid: "CHE123456789",
    supplyKinds: ["GOODS"],
  });
  assert.equal(result.expectedTreatment, "EXPORT");
});

test("Ware und Dienstleistung in die Schweiz müssen getrennt werden", () => {
  const result = assessTaxTreatment({
    customerType: "BUSINESS",
    countryCode: "CH",
    uid: "CHE123456789",
    supplyKinds: ["GOODS", "SERVICE"],
  });
  assert.equal(result.expectedTreatment, null);
  assert.match(result.reason, /unterschiedliche Steuerbehandlungen/);
});

test("UID wird für VIES normalisiert", () => {
  assert.deepEqual(normalizeVatId("DE 123.456.789", "AT"), {
    countryCode: "DE",
    vatNumber: "123456789",
  });
  assert.deepEqual(normalizeVatId("123456789", "GR"), {
    countryCode: "EL",
    vatNumber: "123456789",
  });
});

test("gültige VIES-SOAP-Antwort wird ausgelesen", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`<?xml version="1.0"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body><checkVatResponse xmlns="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
        <countryCode>DE</countryCode><vatNumber>123456789</vatNumber>
        <requestDate>2026-09-01</requestDate><valid>true</valid>
        <name>Beispiel GmbH</name><address>Musterstraße 1</address>
      </checkVatResponse></soap:Body>
    </soap:Envelope>`, { status: 200 });
  try {
    const result = await checkVatId("DE123456789");
    assert.equal(result.status, "VALID");
    assert.equal(result.name, "Beispiel GmbH");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VIES-Verfügbarkeitfehler wird als Warnstatus behandelt", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body><soap:Fault><faultstring>MS_UNAVAILABLE</faultstring></soap:Fault></soap:Body>
    </soap:Envelope>`, { status: 200 });
  try {
    const result = await checkVatId("DE123456789");
    assert.equal(result.status, "UNAVAILABLE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
