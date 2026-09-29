import test from "node:test";
import assert from "node:assert/strict";
import { addInterval } from "../lib/dates";

test("Monatsende bleibt bei monatlichen Rechnungen auch über Februar erhalten", () => {
  let run = new Date("2026-07-31T00:00:00.000Z");
  const dates: string[] = [];
  for (let month = 0; month < 21; month++) {
    dates.push(run.toISOString().slice(0, 10));
    run = addInterval(run, "MONTHLY");
  }
  assert.equal(new Set(dates.slice(0, 12).map((date) => date.slice(0, 7))).size, 12);
  assert.deepEqual(dates.slice(6, 10), ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  assert.deepEqual(dates.slice(18, 21), ["2028-01-31", "2028-02-29", "2028-03-31"]);
});
