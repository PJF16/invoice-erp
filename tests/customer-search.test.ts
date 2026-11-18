import test from "node:test";
import assert from "node:assert/strict";
import { customerSearchWhere } from "../lib/customer-search";

test("sucht nach Kundendaten und behandelt LIKE-Metazeichen als Text", () => {
  const match = { contains: "A\\%\\_\\\\", mode: "insensitive" };
  assert.deepEqual(customerSearchWhere("  A%_\\  "), { OR: [
    { name: match }, { customerNumber: match }, { email: match },
    { zip: match }, { city: match }, { uid: match },
  ] });
  assert.deepEqual(customerSearchWhere(["A", "B"]), {});
});
