import assert from "node:assert/strict";
import test from "node:test";
import { customerDisplayName, customerSchema } from "../lib/validation";

const baseCustomer = {
  name: "Muster GmbH",
  countryCode: "AT",
  customerType: "BUSINESS" as const,
};

test("Unternehmen benötigen weiterhin nur einen Firmennamen", () => {
  assert.equal(customerSchema.safeParse(baseCustomer).success, true);
});

test("Privatkunden benötigen Vor- und Nachnamen", () => {
  const result = customerSchema.safeParse({
    ...baseCustomer,
    customerType: "CONSUMER",
    name: "Max",
    firstName: "Max",
  });

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.issues[0].message, "Nachname ist erforderlich");
});

test("der Anzeigename eines Privatkunden wird aus beiden Namen gebildet", () => {
  assert.equal(customerDisplayName({
    customerType: "CONSUMER",
    name: "wird ersetzt",
    firstName: "  Max  ",
    lastName: "Mustermann",
  }), "Max Mustermann");
});
